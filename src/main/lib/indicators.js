// Indicadores técnicos, funciones puras sobre arrays de barras ordenadas de
// más vieja a más nueva ({ open, high, low, close }).

function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  seed /= period;
  let prev = seed;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function roc(closes, period = 20) {
  if (closes.length < period + 1) return null;
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - period];
  if (!prev) return null;
  return (last / prev - 1) * 100;
}

function atr(bars, period = 14) {
  if (bars.length < period + 1) return null;
  const trueRanges = [];
  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i];
    const prevClose = bars[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }
  // Wilder smoothing: seed con el promedio simple de las primeras `period` TR
  let seed = 0;
  for (let i = 0; i < period; i++) seed += trueRanges[i];
  let prev = seed / period;
  for (let i = period; i < trueRanges.length; i++) {
    prev = (prev * (period - 1) + trueRanges[i]) / period;
  }
  return prev;
}

module.exports = { ema, rsi, roc, atr };
