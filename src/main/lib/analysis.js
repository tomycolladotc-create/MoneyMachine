const { fetchChart, fetchQuoteSummary, closePriceOnOrBefore, fetchFxRateToUSD, sleep } = require('./yahoo');
const { computeTimingScore, calcularCalidadUniverso, clasificar } = require('./scoring');
const { calcularPosicion, calcularRecomendacion, totalizar, buscarPrecioEnFecha } = require('./portfolio');
const { fundamentalsTicker } = require('./overrides');

// CEDEAR del ETF que sigue al S&P 500, usado como benchmark "vs. el mercado
// americano" para la cartera propia (en pesos, sin tener que convertir moneda).
const BENCHMARK_TICKER = 'SPY.BA';

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// Histórico de precios bajo demanda (para el gráfico del detalle de un ticker).
// No se guarda en el snapshot para no inflar el JSON en disco; se pide fresco
// cada vez que el usuario abre el detalle.
async function obtenerHistorico(tickerBA) {
  const chart = await fetchChart(tickerBA, { range: '1y', interval: '1d' });
  return chart.bars;
}

// Cache de tipos de cambio a USD durante la corrida (alcanza con refrescarlos
// una vez por refresco completo, no por ticker).
const fxCache = new Map();
async function fxRateCacheada(currency) {
  if (!currency || currency === 'USD') return 1;
  if (fxCache.has(currency)) return fxCache.get(currency);
  const rate = await fetchFxRateToUSD(currency);
  fxCache.set(currency, rate);
  return rate;
}

async function fetchTicker(tickerBare, sector) {
  const tickerBA = tickerBare + '.BA';
  const fundTicker = fundamentalsTicker(tickerBare);
  const [chart, qs] = await Promise.all([
    fetchChart(tickerBA, { range: '1y', interval: '1d' }),
    fetchQuoteSummary(fundTicker),
  ]);
  const timing = computeTimingScore(chart.bars);
  const current = qs.financialData?.currentPrice?.raw;
  const target = qs.financialData?.targetMeanPrice?.raw;
  const potencialPct = current && target ? ((target - current) / current) * 100 : null;

  // marketCap/totalRevenue vienen en la moneda de reporte del emisor (USD para
  // la mayoría, pero BRL/MXN/EUR para las overrides de Brasil/México/Europa).
  // Se normalizan a USD para que los umbrales de los filtros duros sean comparables.
  const moneda = qs.financialData?.financialCurrency || 'USD';
  const fx = await fxRateCacheada(moneda);
  const marketCapRaw = qs.summaryDetail?.marketCap?.raw ?? qs.price?.marketCap?.raw ?? null;
  const totalRevenueRaw = qs.financialData?.totalRevenue?.raw ?? null;

  return {
    ticker: tickerBare,
    tickerBA,
    nombre: qs.price?.longName || qs.price?.shortName || tickerBare,
    sector: sector || 'Otro',
    marketCap: marketCapRaw != null && fx != null ? marketCapRaw * fx : marketCapRaw,
    totalRevenue: totalRevenueRaw != null && fx != null ? totalRevenueRaw * fx : totalRevenueRaw,
    recommendationKey: qs.financialData?.recommendationKey ?? 'none',
    numberOfAnalystOpinions: qs.financialData?.numberOfAnalystOpinions?.raw ?? null,
    potencialPct,
    revenueGrowth: qs.financialData?.revenueGrowth?.raw ?? null,
    returnOnEquity: qs.financialData?.returnOnEquity?.raw ?? null,
    debtToEquity: qs.financialData?.debtToEquity?.raw ?? null,
    precioARS: chart.regularMarketPrice ?? chart.bars[chart.bars.length - 1]?.close ?? null,
    timing,
    bars: chart.bars,
  };
}

// Cuántos tickers se piden en paralelo por tanda. Yahoo aguanta bien esta
// concurrencia (probado en la práctica); la pausa configurable (SLEEP_SEC) se
// hace entre tandas en vez de entre cada ticker individual, así se completa
// el universo entero en mucho menos tiempo sin dejar de darle un respiro
// entre ráfagas de pedidos.
const TICKERS_POR_TANDA = 10;

// universo: [{ ticker, sector }] — la lista editable del usuario (ver universe-store).
// onProgress(({ done, total, ticker }))
async function analizarUniverso(config, universo, onProgress) {
  const datos = [];
  const fallaron = [];
  let hechos = 0;

  for (let i = 0; i < universo.length; i += TICKERS_POR_TANDA) {
    const tanda = universo.slice(i, i + TICKERS_POR_TANDA);
    const resultados = await Promise.allSettled(tanda.map(({ ticker: t, sector }) => fetchTicker(t, sector)));

    resultados.forEach((r, idx) => {
      const { ticker: t } = tanda[idx];
      hechos += 1;
      if (r.status === 'fulfilled') {
        datos.push(r.value);
      } else {
        fallaron.push({ ticker: t, error: r.reason?.message || String(r.reason) });
      }
      if (onProgress) onProgress({ done: hechos, total: universo.length, ticker: t });
    });

    if (i + TICKERS_POR_TANDA < universo.length) {
      await sleep(config.SLEEP_SEC * 1000);
    }
  }

  const agresivo = calcularCalidadUniverso(datos, 'AGRESIVO', config)
    .map((t) => ({ ...t, clasificacion: clasificar(t.calidad, t.timing?.score ?? 0) }))
    .filter((t) => t.clasificacion === 'BUY_NOW')
    .sort((a, b) => b.calidad - a.calidad);

  const conservador = calcularCalidadUniverso(datos, 'CONSERVADOR', config)
    .map((t) => ({ ...t, clasificacion: clasificar(t.calidad, t.timing?.score ?? 0) }))
    .filter((t) => t.clasificacion === 'BUY_NOW')
    .sort((a, b) => b.calidad - a.calidad);

  return { datos, fallaron, oportunidades: { AGRESIVO: agresivo, CONSERVADOR: conservador } };
}

async function construirBenchmark() {
  try {
    const chart = await fetchChart(BENCHMARK_TICKER, { range: 'max', interval: '1d' });
    const precioHoy = chart.regularMarketPrice ?? chart.bars[chart.bars.length - 1]?.close ?? null;
    return { precioEnFecha: (fecha) => buscarPrecioEnFecha(chart.bars, fecha), precioHoy };
  } catch (e) {
    return null; // sin benchmark disponible; la cartera se sigue calculando igual, solo sin esa comparación
  }
}

async function resolverPrecioMovimiento(tickerBA, movimiento) {
  if (movimiento.precio != null) return movimiento.precio;
  const precio = await closePriceOnOrBefore(tickerBA, movimiento.fecha);
  if (precio == null) throw new Error(`No se pudo resolver el precio historico de ${tickerBA} en ${movimiento.fecha}`);
  return precio;
}

// cartera: { 'TICKER.BA': [movimientos] }
// datosUniverso: array devuelto por analizarUniverso (para reusar precio actual/potencial ya bajados)
async function analizarCartera(cartera, datosUniverso, config) {
  const hoy = hoyISO();
  const porTickerBare = new Map(datosUniverso.map((d) => [d.ticker, d]));
  const posiciones = [];
  const fallaron = [];

  const tieneMovimientos = Object.values(cartera).some((m) => m && m.length > 0);
  const benchmark = tieneMovimientos ? await construirBenchmark() : null;

  for (const [tickerBA, movimientosRaw] of Object.entries(cartera)) {
    if (!movimientosRaw || movimientosRaw.length === 0) continue;
    const tickerBare = tickerBA.replace(/\.BA$/i, '');
    try {
      const movimientos = [];
      for (const m of movimientosRaw) {
        const precio = await resolverPrecioMovimiento(tickerBA, m);
        movimientos.push({ ...m, precio });
      }

      let precioActual = porTickerBare.get(tickerBare)?.precioARS;
      let potencialPct = porTickerBare.get(tickerBare)?.potencialPct ?? null;
      if (precioActual == null) {
        const chart = await fetchChart(tickerBA, { range: '5d', interval: '1d' });
        precioActual = chart.regularMarketPrice ?? chart.bars[chart.bars.length - 1]?.close;
      }

      const posicion = calcularPosicion(tickerBA, movimientos, precioActual, hoy, config, benchmark);
      const recomendacion = calcularRecomendacion(posicion, precioActual, potencialPct, config);
      posiciones.push({ ...posicion, precioActual, potencialPct, recomendacion, nombre: porTickerBare.get(tickerBare)?.nombre ?? tickerBare });
    } catch (e) {
      fallaron.push({ ticker: tickerBA, error: e.message });
    }
  }

  const total = totalizar(posiciones);
  return { posiciones, total, fallaron };
}

module.exports = { analizarUniverso, analizarCartera, hoyISO, fetchTicker, obtenerHistorico };
