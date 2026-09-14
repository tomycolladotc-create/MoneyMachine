import { pct, esc } from './format.js';
import { setState } from './state.js';
import { barra } from './score-bar.js';
import { abrirDetalle } from './detalle-ticker.js';
import { renderGlosario } from './glosario.js';
import { agruparPorTicker } from './agrupar-oportunidades.js';
import { t, traducirClasificacion, traducirTipoActivo, claseChipTipo } from './i18n.js';

function tarjeta(grupo) {
  const atr = grupo.timing?.detalles?.atrRelPct;
  const esCripto = grupo.instancias.every((i) => i.tipo === 'CRYPTO');
  const chipsTipo = grupo.instancias.map((i) => `<span class="chip ${claseChipTipo(i.tipo)}">${esc(traducirTipoActivo(i.tipo))}</span>`).join('');
  // Cripto no tiene fundamentals (ingresos, potencial de analistas, Calidad):
  // se muestra solo lo que sí se puede calcular con el precio (Volatilidad,
  // Entrada) — ver glosario "cripto".
  const metricas = esCripto
    ? `<div class="op-metrics">
        <div><span class="metric-label">${t('common.volatilidadAtr')}</span><span class="metric-value">${atr != null ? atr.toFixed(1) + '%' : '—'}</span></div>
      </div>`
    : `<div class="op-metrics">
        <div><span class="metric-label">${t('common.potencial')}</span><span class="metric-value">${pct(grupo.potencialPct)}</span></div>
        <div><span class="metric-label">${t('common.crecimientoIngresos')}</span><span class="metric-value">${pct((grupo.revenueGrowth ?? 0) * 100)}</span></div>
        <div><span class="metric-label">${t('common.volatilidadAtr')}</span><span class="metric-value">${atr != null ? atr.toFixed(1) + '%' : '—'}</span></div>
      </div>`;
  return `
    <article class="op-card" data-action="ver-detalle" data-ticker="${esc(grupo.ticker)}" tabindex="0" role="button">
      <header>
        <div>
          <div class="op-ticker">${esc(grupo.ticker)}</div>
          <div class="op-nombre">${esc(grupo.nombre)}</div>
        </div>
        <div style="display:flex; gap:6px">
          ${chipsTipo}
          <span class="chip">${esc(grupo.sector)}</span>
        </div>
      </header>
      ${metricas}
      ${esCripto ? '' : barra(t('common.calidad'), grupo.calidad, 'fill-accent')}
      ${barra(t('common.entrada'), grupo.timing?.score ?? 0, 'fill-accent2')}
      <footer><span class="badge badge-gain">${esc(traducirClasificacion(grupo.clasificacion))}</span></footer>
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
    ${renderGlosario(['calidad', 'entrada', 'potencial', 'crecimiento', 'volatilidad', 'clasificacion', 'perfiles', 'cripto'])}`;

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

  // Una misma empresa que pasa el filtro tanto de CEDEAR como de Acción
  // aparecería duplicada acá — se agrupa para mostrarla una sola vez, y el
  // detalle deja elegir cuál de las dos formas de comprarla mirar.
  const grupos = agruparPorTicker(lista);
  content.innerHTML = `<div class="op-grid">${grupos.map(tarjeta).join('')}</div>`;

  const porTicker = new Map(grupos.map((g) => [g.ticker, g]));
  content.querySelectorAll('[data-action="ver-detalle"]').forEach((card) => {
    const abrir = () => abrirDetalle(porTicker.get(card.dataset.ticker));
    card.addEventListener('click', abrir);
    card.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(); }
    });
  });
}
