const { ema, rsi, roc, atr } = require('./indicators');

// ---------- Score de Timing (0-100) ----------

function scoreTendencia(distPct) {
  if (distPct >= 0 && distPct <= 8) return 100;
  if (distPct > 8 && distPct <= 15) return 60;
  if (distPct > 15) return 10;
  if (distPct >= -10 && distPct < 0) return 70;
  return 20; // distPct < -10
}

function scoreRSI(rsiVal) {
  if (rsiVal >= 45 && rsiVal <= 65) return 100;
  if (rsiVal >= 35 && rsiVal < 45) return 80;
  if (rsiVal > 65 && rsiVal <= 70) return 60;
  if (rsiVal < 35) return 50;
  return 5; // rsiVal > 70
}

function scoreMomentum(rocVal) {
  if (rocVal >= 0 && rocVal <= 10) return 100;
  if (rocVal > 10 && rocVal <= 20) return 60;
  if (rocVal > 20) return 20;
  if (rocVal >= -10 && rocVal < 0) return 70;
  return 30; // rocVal < -10
}

function scoreVolatilidad(atrRelPct) {
  if (atrRelPct <= 1.5) return 100;
  if (atrRelPct <= 3) return 70;
  if (atrRelPct <= 5) return 40;
  return 10;
}

function señalDeTiming(score) {
  if (score >= 75) return 'Comprar';
  if (score >= 55) return 'Vigilar';
  if (score >= 35) return 'Esperar';
  return 'Evitar';
}

// bars: array ordenado viejo->nuevo de { open, high, low, close }
function computeTimingScore(bars) {
  if (!bars || bars.length < 60) return null; // no hay suficiente historial para EMA200/RSI/ATR confiables
  const closes = bars.map((b) => b.close);
  const price = closes[closes.length - 1];

  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const rsiVal = rsi(closes, 14);
  const rocVal = roc(closes, 20);
  const atrVal = atr(bars, 14);

  if (ema50 == null || rsiVal == null || rocVal == null || atrVal == null) return null;

  const distPct = ((price - ema50) / ema50) * 100;
  let tendencia = scoreTendencia(distPct);
  if (ema200 != null) {
    tendencia = ema50 > ema200 ? Math.min(100, tendencia + 20) : Math.max(0, tendencia - 20);
  }

  const rsiScore = scoreRSI(rsiVal);
  const momentumScore = scoreMomentum(rocVal);
  const atrRelPct = (atrVal / price) * 100;
  const volScore = scoreVolatilidad(atrRelPct);

  const score = 0.4 * tendencia + 0.25 * rsiScore + 0.2 * momentumScore + 0.15 * volScore;

  return {
    score,
    signal: señalDeTiming(score),
    detalles: {
      price, ema50, ema200, rsi: rsiVal, roc: rocVal, atr: atrVal,
      distPct, atrRelPct,
      componentes: { tendencia, rsi: rsiScore, momentum: momentumScore, volatilidad: volScore },
    },
  };
}

// ---------- Score de Calidad (0-100) ----------

const USD = { AGRESIVO: { marketCap: 100e6, revenue: 100e6 }, CONSERVADOR: { marketCap: 1000e6, revenue: 1000e6 } };

const RATING_EXCLUIDO = {
  AGRESIVO: new Set(['sell', 'strong_sell']),
  CONSERVADOR: new Set(['sell', 'strong_sell', 'underperform', 'reduce']),
};

const RATING_SCORE = {
  strong_buy: 100, strongbuy: 100,
  buy: 70,
  hold: 40, none: 40,
  underperform: 15, reduce: 15,
  sell: 0, strong_sell: 0,
};

const PESOS = {
  AGRESIVO: { potencial: 0.38, rating: 0.15, crecimiento: 0.39, roe: 0.08, deuda: 0.0 },
  CONSERVADOR: { potencial: 0.25, rating: 0.25, crecimiento: 0.25, roe: 0.13, deuda: 0.12 },
};

function pasaFiltroDuro(t, perfil, config) {
  const umbral = USD[perfil];
  if (t.marketCap == null || t.marketCap < umbral.marketCap) return false;
  if (t.totalRevenue == null || t.totalRevenue < umbral.revenue) return false;
  if (RATING_EXCLUIDO[perfil].has(t.recommendationKey)) return false;
  if (t.numberOfAnalystOpinions == null || t.numberOfAnalystOpinions < config.MIN_ANALISTAS_RANKING) return false;
  if (t.potencialPct == null || t.potencialPct <= config.MIN_POTENCIAL_RANKING) return false;
  return true;
}

function percentiles(values) {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [100];
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((v) => {
    // rango promedio para empates (percentile rank 0-100)
    let lower = 0;
    let equal = 0;
    for (const s of sorted) {
      if (s < v) lower++;
      else if (s === v) equal++;
    }
    const avgRank = lower + (equal - 1) / 2; // 0-indexado
    return (avgRank / (n - 1)) * 100;
  });
}

// Calcula el score de Calidad de cada ticker por percentiles *dentro del grupo
// recibido* (sin aplicar los filtros duros). Se usa tanto para el ranking del
// universo completo (ya filtrado) como para el simulador de cartera, que
// pondera solo dentro de los tickers que el usuario eligió.
// tickers: array de { ticker, marketCap, totalRevenue, recommendationKey,
//   numberOfAnalystOpinions, potencialPct, revenueGrowth, returnOnEquity, debtToEquity }
function puntuarCalidad(tickers, perfil) {
  if (tickers.length === 0) return [];

  const pesos = PESOS[perfil];
  const potenciales = tickers.map((t) => t.potencialPct ?? 0);
  const crecimientos = tickers.map((t) => Math.min((t.revenueGrowth ?? 0) * 100, 200));
  const roes = tickers.map((t) => (t.returnOnEquity ?? 0) * 100);
  const deudas = tickers.map((t) => -(t.debtToEquity ?? 999)); // invertido: menos deuda -> mejor

  const pPotencial = percentiles(potenciales);
  const pCrecimiento = percentiles(crecimientos);
  const pRoe = percentiles(roes);
  const pDeuda = percentiles(deudas);

  return tickers.map((t, i) => {
    const ratingScore = RATING_SCORE[t.recommendationKey] ?? RATING_SCORE.none;
    const calidad =
      pesos.potencial * pPotencial[i] +
      pesos.rating * ratingScore +
      pesos.crecimiento * pCrecimiento[i] +
      pesos.roe * pRoe[i] +
      pesos.deuda * pDeuda[i];
    return {
      ...t,
      calidad,
      percentiles: { potencial: pPotencial[i], crecimiento: pCrecimiento[i], roe: pRoe[i], deuda: pDeuda[i], rating: ratingScore },
    };
  });
}

function calcularCalidadUniverso(tickers, perfil, config) {
  const elegibles = tickers.filter((t) => pasaFiltroDuro(t, perfil, config));
  return puntuarCalidad(elegibles, perfil);
}

function clasificar(calidad, timing) {
  if (calidad >= 68 && timing >= 78) return '⭐ Comprar ahora';
  if (calidad >= 68 && timing < 78) return '⏳ Esperar mejor entrada';
  if (calidad >= 48) return '✓ Vigilar';
  return '○ Esperar';
}

module.exports = {
  computeTimingScore,
  calcularCalidadUniverso,
  puntuarCalidad,
  pasaFiltroDuro,
  clasificar,
  percentiles,
};
