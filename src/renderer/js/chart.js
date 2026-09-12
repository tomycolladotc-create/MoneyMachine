import { ars, esc } from './format.js';

// Gráfico de línea simple en SVG inline (sin librerías externas). `bars` viene
// ordenado de más viejo a más nuevo, con `{ date, close }` por lo menos.
export function renderPriceChart(bars, { width = 640, height = 200 } = {}) {
  if (!bars || bars.length < 2) {
    return `<p class="empty-inline">No hay suficiente historial para graficar.</p>`;
  }

  const closes = bars.map((b) => b.close);
  const min = Math.min(...closes);
  const maxReal = Math.max(...closes);
  const max = min === maxReal ? maxReal + 1 : maxReal;
  const pad = (max - min) * 0.1 || 1;
  const yMin = min - pad;
  const yMax = max + pad;
  const n = closes.length;

  const x = (i) => (i / (n - 1)) * width;
  const y = (v) => height - ((v - yMin) / (yMax - yMin)) * height;

  const puntos = closes.map((c, i) => `${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(' ');
  const area = `0,${height} ${puntos} ${width},${height}`;

  const primero = closes[0];
  const ultimo = closes[n - 1];
  const subio = ultimo >= primero;
  const colorLinea = subio ? 'var(--gain)' : 'var(--loss)';
  const variacion = ((ultimo / primero - 1) * 100).toFixed(1);

  return `
    <div class="chart-head">
      <div>
        <span class="chart-precio">${ars(ultimo)}</span>
        <span class="chart-variacion" style="color:${colorLinea}">${subio ? '+' : ''}${variacion}% en 12 meses</span>
      </div>
      <div class="chart-rango">
        <span>Máx ${ars(maxReal)}</span>
        <span>Mín ${ars(min)}</span>
      </div>
    </div>
    <svg viewBox="0 0 ${width} ${height}" class="price-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style="stop-color:${colorLinea};stop-opacity:0.30" />
          <stop offset="100%" style="stop-color:${colorLinea};stop-opacity:0" />
        </linearGradient>
      </defs>
      <polygon points="${area}" fill="url(#areaFill)" />
      <polyline points="${puntos}" fill="none" style="stroke:${colorLinea}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx="${x(n - 1).toFixed(1)}" cy="${y(ultimo).toFixed(1)}" r="3.5" style="fill:${colorLinea}" />
    </svg>
    <div class="chart-fechas">
      <span>${bars[0].date}</span>
      <span>${bars[n - 1].date}</span>
    </div>`;
}

// Gráfico de varias líneas superpuestas, para comparar series en el tiempo
// (ej: valor de la cartera vs. lo que hubiera dado un plazo fijo). `series` es
// [{ nombre, valores, color, punteada }], todas con la misma cantidad de
// puntos que `fechas`.
export function renderComparisonChart(fechas, series, { width = 640, height = 220 } = {}) {
  if (!fechas || fechas.length < 2) {
    return `<p class="empty-inline">Todavía hay un solo día registrado. A partir del próximo refresco vas a poder ver cómo viene evolucionando.</p>`;
  }

  const todos = series.flatMap((s) => s.valores).filter((v) => v != null);
  const min = Math.min(...todos);
  const maxReal = Math.max(...todos);
  const max = min === maxReal ? maxReal + 1 : maxReal;
  const pad = (max - min) * 0.1 || 1;
  const yMin = min - pad;
  const yMax = max + pad;
  const n = fechas.length;

  const x = (i) => (i / (n - 1)) * width;
  const y = (v) => height - ((v - yMin) / (yMax - yMin)) * height;

  const lineas = series
    .map((s) => {
      const puntos = s.valores
        .map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
        .filter(Boolean)
        .join(' ');
      return `<polyline points="${puntos}" fill="none" style="stroke:${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.punteada ? 'stroke-dasharray="6,5"' : ''} />`;
    })
    .join('');

  const leyenda = series
    .map((s) => `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${esc(s.nombre)}</span>`)
    .join('');

  return `
    <div class="chart-legend">${leyenda}</div>
    <svg viewBox="0 0 ${width} ${height}" class="price-chart" preserveAspectRatio="none">${lineas}</svg>
    <div class="chart-fechas">
      <span>${fechas[0]}</span>
      <span>${fechas[n - 1]}</span>
    </div>`;
}
