import { t } from './i18n.js';

export function ars(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

export function usd(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// Infiere el tipo de un ticker a partir de su propio símbolo de mercado: los
// CEDEARs siempre terminan en ".BA" (BYMA), las criptomonedas en "-USD" (la
// convención de Yahoo Finance para pares cripto/dólar, ej. "BTC-USD"), y todo
// lo demás es una acción de Wall Street cotizando directo en dólares.
export function tipoDeTicker(tickerBA) {
  const t = (tickerBA || '').toUpperCase();
  if (t.endsWith('.BA')) return 'CEDEAR';
  if (t.endsWith('-USD')) return 'CRYPTO';
  return 'ACCION';
}

// Ticker de un CEDEAR (termina en ".BA") o de un activo en dólares (acción o
// cripto) — determina en qué moneda mostrar montos de esa posición.
export function esTickerAccion(tickerBA) {
  return tipoDeTicker(tickerBA) !== 'CEDEAR';
}

// Aplica el formato de moneda que corresponde según el tipo de ticker.
export function moneda(n, tickerBA) {
  return esTickerAccion(tickerBA) ? usd(n) : ars(n);
}

export function pct(n, decimals = 1) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;
}

export function num(n, decimals = 0) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: decimals }).format(n);
}

export function usdCompact(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function signClass(n) {
  if (n == null || Number.isNaN(n)) return '';
  return n > 0 ? 'is-gain' : n < 0 ? 'is-loss' : '';
}

// Acepta "YPF" o "YPF.BA" (o "ypf.ba") escrito a mano y devuelve siempre el
// ticker "pelado" en mayúsculas, sin duplicar el sufijo si el usuario ya lo puso.
export function limpiarTickerBare(input) {
  return (input || '').trim().toUpperCase().replace(/\.BA$/, '');
}

export function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function relativeTime(iso) {
  if (!iso) return t('format.nunca');
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return t('format.recien');
  if (min === 1) return t('format.hace1Minuto');
  if (min < 60) return t('format.haceMinutos', { n: min });
  const h = Math.floor(min / 60);
  if (h === 1) return t('format.hace1Hora');
  if (h < 24) return t('format.haceHoras', { n: h });
  const d = Math.floor(h / 24);
  return d === 1 ? t('format.hace1Dia') : t('format.haceDias', { n: d });
}
