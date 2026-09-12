// Cliente para los endpoints no oficiales de Yahoo Finance.
// - El endpoint de chart (histórico de precios) no requiere autenticación.
// - El endpoint quoteSummary (fundamentals) exige una cookie + "crumb" de sesión;
//   sin eso responde 401 "Invalid Crumb".
// Además: para tickers de CEDEARs (sufijo .BA) Yahoo no completa el módulo de
// analistas (recommendationKey/targetMeanPrice/numberOfAnalystOpinions) y calcula
// marketCap mezclando el precio en pesos con la cantidad de acciones global (da
// números sin sentido). Por eso los fundamentals/analistas se piden siempre al
// ticker "pelado" (sin .BA), que es el mismo emisor y responde en USD.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

let sessionPromise = null;

function collectCookies(res, jar) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  raw.forEach((c) => {
    const pair = c.split(';')[0];
    const eq = pair.indexOf('=');
    if (eq > 0) jar[pair.slice(0, eq)] = pair;
  });
}

function cookieHeader(jar) {
  return Object.values(jar).join('; ');
}

async function buildSession() {
  const jar = {};
  try {
    const r1 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA } });
    collectCookies(r1, jar);
  } catch (e) {
    // seguimos igual; getcrumb puede fallar y lo manejamos mas abajo
  }
  const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookieHeader(jar) },
  });
  const crumb = (await r2.text()).trim();
  return { crumb, cookie: cookieHeader(jar) };
}

async function getSession(forceNew = false) {
  if (forceNew || !sessionPromise) {
    sessionPromise = buildSession();
  }
  return sessionPromise;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchChart(tickerBA, { range = '1y', interval = '1d' } = {}) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(tickerBA)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`chart ${tickerBA}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    const desc = json?.chart?.error?.description || 'sin datos';
    throw new Error(`chart ${tickerBA}: ${desc}`);
  }
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const closes = quote.close || [];
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const volumes = quote.volume || [];

  const bars = timestamps
    .map((t, i) => ({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      open: opens[i],
      high: highs[i],
      low: lows[i],
      close: closes[i],
      volume: volumes[i],
    }))
    .filter((b) => b.close != null);

  return {
    currency: result.meta.currency,
    exchangeName: result.meta.exchangeName,
    regularMarketPrice: result.meta.regularMarketPrice,
    bars,
  };
}

async function fetchQuoteSummary(tickerBare, { retried = false } = {}) {
  const session = await getSession();
  const modules = 'price,summaryDetail,financialData,recommendationTrend,defaultKeyStatistics';
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(tickerBare)}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Cookie: session.cookie, Accept: 'application/json' },
  });
  if (res.status === 401 && !retried) {
    await getSession(true);
    return fetchQuoteSummary(tickerBare, { retried: true });
  }
  if (!res.ok) throw new Error(`quoteSummary ${tickerBare}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.quoteSummary?.result?.[0];
  if (!result) {
    const desc = json?.quoteSummary?.error?.description || 'sin datos';
    throw new Error(`quoteSummary ${tickerBare}: ${desc}`);
  }
  return result;
}

// Busca el cierre en o antes de una fecha dada (para resolver el precio de
// movimientos de cartera que no lo traen cargado). Devuelve null si no hay dato.
async function closePriceOnOrBefore(tickerBA, dateStr) {
  const target = new Date(dateStr + 'T00:00:00Z');
  const period2 = Math.floor(target.getTime() / 1000) + 5 * 86400;
  const period1 = Math.floor(target.getTime() / 1000) - 12 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(tickerBA)}?period1=${period1}&period2=${period2}&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) return null;
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  let best = null;
  for (let i = 0; i < timestamps.length; i++) {
    const d = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    if (d <= dateStr && closes[i] != null) best = closes[i];
  }
  return best;
}

// Tipo de cambio de `currency` a USD (para normalizar fundamentals de tickers
// que reportan en BRL/MXN/EUR/etc. antes de compararlos contra los umbrales en
// dólares). No requiere crumb.
async function fetchFxRateToUSD(currency) {
  if (!currency || currency === 'USD') return 1;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(currency)}USD=X?range=5d&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
}

// Autocompletado de símbolos (para sugerir tickers mientras el usuario escribe,
// y para validar/corregir uno que no resuelve). No requiere crumb.
async function buscarSimbolos(query) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) return [];
  const json = await res.json();
  const quotes = json?.quotes || [];
  return quotes
    .filter((q) => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF'))
    .map((q) => ({
      symbol: q.symbol,
      nombre: q.longname || q.shortname || '',
      exchange: q.exchange,
      exchangeDisp: q.exchDisp || q.exchange,
    }))
    // los de Buenos Aires primero: son los que de verdad importan para cargar en la app
    .sort((a, b) => (b.exchange === 'BUE') - (a.exchange === 'BUE'));
}

module.exports = { fetchChart, fetchQuoteSummary, closePriceOnOrBefore, fetchFxRateToUSD, buscarSimbolos, sleep };
