import { pct, esc } from './format.js';
import { setState } from './state.js';
import { barra } from './score-bar.js';
import { abrirDetalle } from './detalle-ticker.js';
import { renderGlosario } from './glosario.js';
import { t, traducirClasificacion } from './i18n.js';

function tarjeta(op) {
  const atr = op.timing?.detalles?.atrRelPct;
  return `
    <article class="op-card" data-action="ver-detalle" data-ticker="${esc(op.ticker)}" tabindex="0" role="button">
      <header>
        <div>
          <div class="op-ticker">${esc(op.ticker)}</div>
          <div class="op-nombre">${esc(op.nombre)}</div>
        </div>
        <span class="chip">${esc(op.sector)}</span>
      </header>
      <div class="op-metrics">
        <div><span class="metric-label">${t('common.potencial')}</span><span class="metric-value">${pct(op.potencialPct)}</span></div>
        <div><span class="metric-label">${t('common.crecimientoIngresos')}</span><span class="metric-value">${pct((op.revenueGrowth ?? 0) * 100)}</span></div>
        <div><span class="metric-label">${t('common.volatilidadAtr')}</span><span class="metric-value">${atr != null ? atr.toFixed(1) + '%' : '—'}</span></div>
      </div>
      ${barra(t('common.calidad'), op.calidad, 'fill-accent')}
      ${barra(t('common.entrada'), op.timing?.score ?? 0, 'fill-accent2')}
      <footer><span class="badge badge-gain">${esc(traducirClasificacion(op.clasificacion))}</span></footer>
    </article>`;
}

export function renderOportunidades(container, state) {
  const snap = state.snapshot;

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>${t('nav.oportunidades')}</h1>
        <p class="view-subtitle">${t('oportunidades.subtitulo')}</p>
      </div>
    </div>
    <div class="tabs">
      <button class="tab ${state.perfilActivo === 'AGRESIVO' ? 'is-active' : ''}" data-perfil="AGRESIVO">${t('common.agresivo')}</button>
      <button class="tab ${state.perfilActivo === 'CONSERVADOR' ? 'is-active' : ''}" data-perfil="CONSERVADOR">${t('common.conservador')}</button>
    </div>
    <div id="op-content"></div>
    ${renderGlosario(['calidad', 'entrada', 'potencial', 'crecimiento', 'volatilidad', 'clasificacion', 'perfiles'])}`;

  container.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => setState({ perfilActivo: btn.dataset.perfil }));
  });

  const content = container.querySelector('#op-content');
  if (!snap) {
    content.innerHTML = `<p class="empty-inline">${t('oportunidades.sinDatos')}</p>`;
    return;
  }

  const lista = snap.oportunidades[state.perfilActivo] || [];
  if (lista.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <h2>${t('oportunidades.nadaHoy', { perfil: state.perfilActivo === 'AGRESIVO' ? t('common.agresivo') : t('common.conservador') })}</h2>
        <p>${t('oportunidades.nadaHoyDetalle')}</p>
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
