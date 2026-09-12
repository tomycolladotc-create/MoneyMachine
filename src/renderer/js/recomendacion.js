// `codigo` es el valor estable devuelto por portfolio.js (calcularRecomendacion),
// no el texto traducido — así el color del badge no depende del idioma activo.
export function claseRecomendacion(codigo) {
  if (codigo === 'STOP_LOSS') return 'badge-loss';
  if (codigo === 'TAKE_PROFIT_SELL') return 'badge-info';
  if (codigo === 'TAKE_PROFIT_HOLD') return 'badge-purple';
  if (codigo === 'HOLD') return 'badge-gain';
  return 'badge-neutral';
}
