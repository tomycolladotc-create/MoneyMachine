import { pct, usdCompact, esc, tipoDeTicker } from './format.js';
import { barra } from './score-bar.js';
import { renderPriceChart } from './chart.js';
import { openModal, updateModal, closeModal } from './modal.js';
import { renderGlosario } from './glosario.js';
import { t, traducirClasificacion, traducirSignal, traducirTipoActivo, claseChipTipo } from './i18n.js';

function ratingLabel(key) {
  return t(`detalle.rating.${key}`) || key || '—';
}

function stat(label, value) {
  return `<div><span class="metric-label">${label}</span><span class="metric-value">${value}</span></div>`;
}

// `instancias`: todas las formas disponibles de comprar esta empresa
// (CEDEAR/Acción/Cripto) — normalmente una sola, pero puede haber dos si pasa
// el filtro tanto como CEDEAR como acción de Wall Street. `activa` es la que
// se está mostrando ahora mismo.
function selectorTipo(instancias, activa) {
  if (instancias.length < 2) return '';
  return `
    <div class="modal-tipo-selector">
      ${instancias.map((i) => `
        <button type="button" class="chip-btn ${claseChipTipo(i.tipo)} ${i.tipo === activa.tipo ? 'is-active' : ''}" data-action="elegir-tipo" data-tipo="${i.tipo}">
          ${esc(traducirTipoActivo(i.tipo))}
        </button>`).join('')}
    </div>`;
}

function contenido(grupo, activa, chartHTML) {
  const d = activa.timing?.detalles || {};
  const tendenciaTexto = d.ema50 != null && d.ema200 != null
    ? (d.ema50 > d.ema200 ? t('detalle.emaAlcista') : t('detalle.emaBajista'))
    : t('detalle.sinDatoSuficiente');
  const esCripto = activa.tipo === 'CRYPTO';

  return `
    <button class="modal-close" id="modal-close" title="${t('detalle.cerrar')}">✕</button>
    <header class="modal-header">
      <div>
        <div class="op-ticker" style="font-size:20px">${esc(activa.ticker)}</div>
        <div class="op-nombre">${esc(activa.nombre)}</div>
      </div>
      <div class="modal-header-badges">
        <span class="chip">${esc(activa.sector)}</span>
        <span class="badge badge-gain">${esc(activa.clasificacion ? traducirClasificacion(activa.clasificacion) : '')}</span>
      </div>
    </header>

    ${selectorTipo(grupo.instancias, activa)}

    <div class="chart-container">${chartHTML}</div>

    <div class="score-block">
      ${esCripto ? '' : barra(t('common.calidad'), activa.calidad, 'fill-accent')}
      ${barra(t('common.entrada'), activa.timing?.score ?? 0, 'fill-accent2')}
    </div>

    ${esCripto ? '' : `
    <h2 style="margin-top:20px">${t('detalle.fundamentals')}</h2>
    <div class="detail-grid">
      ${stat(t('detalle.potencialPrecioObjetivo'), activa.potencialPct != null ? pct(activa.potencialPct) : '—')}
      ${stat(t('detalle.ratingAnalistas'), ratingLabel(activa.recommendationKey))}
      ${stat(t('detalle.cantidadAnalistas'), activa.numberOfAnalystOpinions ?? '—')}
      ${stat(t('detalle.marketCapUsd'), activa.marketCap != null ? '$' + usdCompact(activa.marketCap) : '—')}
      ${stat(t('detalle.ingresosAnualesUsd'), activa.totalRevenue != null ? '$' + usdCompact(activa.totalRevenue) : '—')}
      ${stat(t('common.crecimientoIngresos'), activa.revenueGrowth != null ? pct(activa.revenueGrowth * 100) : '—')}
      ${stat(t('detalle.roe'), activa.returnOnEquity != null ? pct(activa.returnOnEquity * 100) : '—')}
      ${stat(t('detalle.deudaPatrimonio'), activa.debtToEquity != null ? activa.debtToEquity.toFixed(0) + '%' : '—')}
    </div>`}

    <h2 style="margin-top:20px">${t('detalle.tecnico')}</h2>
    <div class="detail-grid">
      ${stat(t('detalle.senal'), activa.timing?.signal ? traducirSignal(activa.timing.signal) : '—')}
      ${stat(t('detalle.rsi'), d.rsi != null ? d.rsi.toFixed(0) : '—')}
      ${stat(t('detalle.momentumRoc'), d.roc != null ? pct(d.roc) : '—')}
      ${stat(t('common.volatilidadAtr'), d.atrRelPct != null ? d.atrRelPct.toFixed(1) + '%' : '—')}
      ${stat(t('detalle.tendencia'), tendenciaTexto)}
      ${stat(t('detalle.distanciaEma50'), d.distPct != null ? pct(d.distPct) : '—')}
    </div>

    ${esCripto
      ? renderGlosario(['rsi', 'momentum', 'volatilidad', 'tendencia', 'cripto'])
      : renderGlosario(['potencial', 'rating', 'marketCapIngresos', 'crecimiento', 'roe', 'deuda', 'rsi', 'momentum', 'volatilidad', 'tendencia'])}`;
}

// `grupo`: una oportunidad (posiblemente con más de una `instancia` — CEDEAR
// y/o Acción y/o Cripto de la misma empresa, ver agrupar-oportunidades.js).
export async function abrirDetalle(grupo) {
  const instancias = grupo.instancias || [grupo];

  async function mostrar(activa) {
    openModal(contenido(grupo, activa, `<p class="empty-inline">${t('detalle.cargandoHistorico')}</p>`));
    wireModal(activa);

    try {
      const r = await window.api.getHistorico(activa.tickerBA);
      if (r.error) {
        updateModal(contenido(grupo, activa, `<p class="empty-inline">${t('detalle.noSePudoTraerHistorico', { error: esc(r.error) })}</p>`));
      } else {
        updateModal(contenido(grupo, activa, renderPriceChart(r.bars, { moneda: tipoDeTicker(activa.tickerBA) === 'CEDEAR' ? 'ARS' : 'USD' })));
      }
    } catch (e) {
      updateModal(contenido(grupo, activa, `<p class="empty-inline">${t('detalle.noSePudoTraerHistorico', { error: esc(e.message) })}</p>`));
    }
    wireModal(activa);
  }

  function wireModal() {
    const btnCerrar = document.getElementById('modal-close');
    if (btnCerrar) btnCerrar.addEventListener('click', closeModal);

    document.querySelectorAll('[data-action="elegir-tipo"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const siguiente = instancias.find((i) => i.tipo === btn.dataset.tipo);
        if (siguiente) mostrar(siguiente);
      });
    });
  }

  await mostrar(instancias.reduce((mejor, i) => ((i.timing?.score ?? 0) > (mejor.timing?.score ?? 0) ? i : mejor)));
}
