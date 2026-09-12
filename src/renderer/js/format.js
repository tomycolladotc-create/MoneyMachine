import { t } from './i18n.js';

export function ars(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
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
