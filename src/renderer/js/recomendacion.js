export function claseRecomendacion(texto) {
  if (texto.includes('Stop Loss')) return 'badge-loss';
  if (texto.includes('Take Profit')) return 'badge-info';
  if (texto.includes('MANTENER')) return 'badge-purple';
  if (texto.includes('Mantener')) return 'badge-gain';
  return 'badge-neutral';
}
