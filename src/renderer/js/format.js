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
  if (!iso) return 'nunca';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'recién';
  if (min === 1) return 'hace 1 minuto';
  if (min < 60) return `hace ${min} minutos`;
  const h = Math.floor(min / 60);
  if (h === 1) return 'hace 1 hora';
  if (h < 24) return `hace ${h} horas`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}
