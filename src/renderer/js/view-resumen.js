import { ars, pct, signClass, esc, relativeTime } from './format.js';
import { renderGlosario } from './glosario.js';
import { renderComparisonChart } from './chart.js';

function tile(label, value, sub, cls = '') {
  return `
    <div class="kpi ${cls}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
    </div>`;
}

function filaOportunidad(t) {
  return `
    <li class="mini-row">
      <span class="mini-ticker">${esc(t.ticker)}</span>
      <span class="mini-nombre">${esc(t.nombre)}</span>
      <span class="mini-calidad">${t.calidad.toFixed(0)}</span>
    </li>`;
}

function renderEvolucion(historial) {
  if (!historial || historial.length === 0) {
    return `<p class="empty-inline">Todavía no hay historial registrado — se va guardando un punto por día a partir de hoy.</p>`;
  }
  const fechas = historial.map((p) => p.fecha);
  const series = [
    { nombre: 'Tu cartera', color: 'var(--accent)', valores: historial.map((p) => p.valorHoyTotal) },
    { nombre: 'Plazo fijo tradicional', color: 'var(--accent-2)', valores: historial.map((p) => p.capitalInvertido + p.gananciaPF) },
    { nombre: 'Plazo fijo UVA', color: 'var(--purple)', punteada: true, valores: historial.map((p) => p.capitalInvertido + p.gananciaPFUva) },
    { nombre: 'S&P 500 (CEDEAR)', color: 'var(--info)', punteada: true, valores: historial.map((p) => (p.gananciaBenchmark != null ? p.capitalInvertido + p.gananciaBenchmark : null)) },
  ];
  return renderComparisonChart(fechas, series);
}

export function renderResumen(container, state) {
  const snap = state.snapshot;

  if (!snap) {
    container.innerHTML = `
      <section class="empty-state">
        <h2>Todavía no hay datos</h2>
        <p>Se está haciendo la primera consulta a Yahoo Finance. Esto puede tardar unos minutos la primera vez porque se piden ${'>'}150 tickers con una pausa entre cada uno para no saturar el servicio.</p>
      </section>`;
    return;
  }

  const t = snap.cartera.total;
  const errores = snap.fallaron?.length
    ? `<div class="banner banner-warn">Yahoo no respondió para ${snap.fallaron.length} ticker${snap.fallaron.length === 1 ? '' : 's'}. Se van a reintentar en el próximo refresco. <button class="link-btn" id="ver-errores">Ver detalle</button></div>`
    : '';

  const topAgresivo = snap.oportunidades.AGRESIVO.slice(0, 5);
  const topConservador = snap.oportunidades.CONSERVADOR.slice(0, 5);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Resumen</h1>
        <p class="view-subtitle">Cartera propia vs. plazo fijo · actualizado ${relativeTime(snap.timestamp)}</p>
      </div>
    </div>
    ${errores}
    <div class="kpi-grid">
      ${tile('Total invertido', ars(t.capitalInvertido))}
      ${tile('Valor hoy', ars(t.valorHoyTotal))}
      ${tile('Ganancia', ars(t.gananciaCedear), pct((t.gananciaCedear / t.capitalInvertido) * 100), signClass(t.gananciaCedear))}
      ${tile('Vs. plazo fijo tradicional', ars(t.diferenciaPF), t.diferenciaPF >= 0 ? 'le gana al plazo fijo' : 'pierde contra el plazo fijo', signClass(t.diferenciaPF))}
      ${tile('Vs. plazo fijo UVA', ars(t.diferenciaPFUva), t.diferenciaPFUva >= 0 ? 'le gana al plazo fijo UVA' : 'pierde contra el plazo fijo UVA', signClass(t.diferenciaPFUva))}
      ${t.diferenciaBenchmark != null
        ? tile('Vs. S&P 500', ars(t.diferenciaBenchmark), t.diferenciaBenchmark >= 0 ? 'le gana al S&P 500' : 'pierde contra el S&P 500', signClass(t.diferenciaBenchmark))
        : tile('Vs. S&P 500', '—', 'sin dato disponible hoy')}
    </div>

    <section class="panel chart-container" style="margin-bottom:20px">
      <h2>Evolución de tu cartera</h2>
      ${renderEvolucion(state.historial)}
    </section>

    <div class="two-col">
      <section class="panel">
        <h2>⭐ Comprar ahora — Agresivo</h2>
        ${topAgresivo.length
          ? `<ul class="mini-list">${topAgresivo.map(filaOportunidad).join('')}</ul>`
          : `<p class="empty-inline">Ningún ticker del universo agresivo califica hoy: ninguno superó a la vez el piso de calidad (68) y de timing (78) con los filtros actuales.</p>`}
      </section>
      <section class="panel">
        <h2>⭐ Comprar ahora — Conservador</h2>
        ${topConservador.length
          ? `<ul class="mini-list">${topConservador.map(filaOportunidad).join('')}</ul>`
          : `<p class="empty-inline">Ningún ticker del universo conservador califica hoy: ninguno superó a la vez el piso de calidad (68) y de timing (78) con los filtros actuales.</p>`}
      </section>
    </div>
    ${renderGlosario(['cedear', 'calidad', 'clasificacion', 'plazoFijoTradicional', 'plazoFijoUva', 'sp500'])}`;

  const btn = container.querySelector('#ver-errores');
  if (btn) btn.addEventListener('click', () => {
    alert(snap.fallaron.map((f) => `${f.ticker}: ${f.error}`).join('\n'));
  });
}
