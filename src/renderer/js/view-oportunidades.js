import { pct, esc } from './format.js';
import { setState } from './state.js';
import { barra } from './score-bar.js';
import { abrirDetalle } from './detalle-ticker.js';
import { renderGlosario } from './glosario.js';

function tarjeta(t) {
  const atr = t.timing?.detalles?.atrRelPct;
  return `
    <article class="op-card" data-action="ver-detalle" data-ticker="${esc(t.ticker)}" tabindex="0" role="button">
      <header>
        <div>
          <div class="op-ticker">${esc(t.ticker)}</div>
          <div class="op-nombre">${esc(t.nombre)}</div>
        </div>
        <span class="chip">${esc(t.sector)}</span>
      </header>
      <div class="op-metrics">
        <div><span class="metric-label">Potencial</span><span class="metric-value">${pct(t.potencialPct)}</span></div>
        <div><span class="metric-label">Crecimiento ingresos</span><span class="metric-value">${pct((t.revenueGrowth ?? 0) * 100)}</span></div>
        <div><span class="metric-label">Volatilidad (ATR)</span><span class="metric-value">${atr != null ? atr.toFixed(1) + '%' : '—'}</span></div>
      </div>
      ${barra('Calidad', t.calidad, 'fill-accent')}
      ${barra('Entrada', t.timing?.score ?? 0, 'fill-accent2')}
      <footer><span class="badge badge-gain">${esc(t.clasificacion)}</span></footer>
    </article>`;
}

export function renderOportunidades(container, state) {
  const snap = state.snapshot;

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Oportunidades</h1>
        <p class="view-subtitle">Solo se listan los que hoy son "⭐ Comprar ahora": calidad ≥ 68 y timing ≥ 78.</p>
      </div>
    </div>
    <div class="tabs">
      <button class="tab ${state.perfilActivo === 'AGRESIVO' ? 'is-active' : ''}" data-perfil="AGRESIVO">Agresivo</button>
      <button class="tab ${state.perfilActivo === 'CONSERVADOR' ? 'is-active' : ''}" data-perfil="CONSERVADOR">Conservador</button>
    </div>
    <div id="op-content"></div>
    ${renderGlosario(['calidad', 'entrada', 'potencial', 'crecimiento', 'volatilidad', 'clasificacion', 'perfiles'])}`;

  container.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => setState({ perfilActivo: btn.dataset.perfil }));
  });

  const content = container.querySelector('#op-content');
  if (!snap) {
    content.innerHTML = `<p class="empty-inline">Todavía no hay datos del universo de CEDEARs.</p>`;
    return;
  }

  const lista = snap.oportunidades[state.perfilActivo] || [];
  if (lista.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <h2>Nada para ${state.perfilActivo === 'AGRESIVO' ? 'perfil agresivo' : 'perfil conservador'} hoy</h2>
        <p>Ningún ticker superó a la vez el piso de calidad (≥68) y de timing (≥78) con los filtros configurados. No es un error: puede que hoy no haya un buen punto de entrada, o que valga la pena revisar los umbrales en Configuración.</p>
      </div>`;
    return;
  }

  content.innerHTML = `<div class="op-grid">${lista.map(tarjeta).join('')}</div>`;

  const porTicker = new Map(lista.map((t) => [t.ticker, t]));
  content.querySelectorAll('[data-action="ver-detalle"]').forEach((card) => {
    const abrir = () => abrirDetalle(porTicker.get(card.dataset.ticker));
    card.addEventListener('click', abrir);
    card.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(); }
    });
  });
}
