import { ars, pct, usdCompact, esc } from './format.js';
import { barra } from './score-bar.js';
import { renderPriceChart } from './chart.js';
import { openModal, updateModal, closeModal } from './modal.js';
import { renderGlosario } from './glosario.js';
import { t, traducirClasificacion, traducirSignal } from './i18n.js';

function ratingLabel(key) {
  return t(`detalle.rating.${key}`) || key || '—';
}

function stat(label, value) {
  return `<div><span class="metric-label">${label}</span><span class="metric-value">${value}</span></div>`;
}

function contenido(op, chartHTML) {
  const d = op.timing?.detalles || {};
  const tendenciaTexto = d.ema50 != null && d.ema200 != null
    ? (d.ema50 > d.ema200 ? t('detalle.emaAlcista') : t('detalle.emaBajista'))
    : t('detalle.sinDatoSuficiente');

  return `
    <button class="modal-close" id="modal-close" title="${t('detalle.cerrar')}">✕</button>
    <header class="modal-header">
      <div>
        <div class="op-ticker" style="font-size:20px">${esc(op.ticker)}</div>
        <div class="op-nombre">${esc(op.nombre)}</div>
      </div>
      <div class="modal-header-badges">
        <span class="chip">${esc(op.sector)}</span>
        <span class="badge badge-gain">${esc(op.clasificacion ? traducirClasificacion(op.clasificacion) : '')}</span>
      </div>
    </header>

    <div class="chart-container">${chartHTML}</div>

    <div class="score-block">
      ${barra(t('common.calidad'), op.calidad, 'fill-accent')}
      ${barra(t('common.entrada'), op.timing?.score ?? 0, 'fill-accent2')}
    </div>

    <h2 style="margin-top:20px">${t('detalle.fundamentals')}</h2>
    <div class="detail-grid">
      ${stat(t('detalle.potencialPrecioObjetivo'), op.potencialPct != null ? pct(op.potencialPct) : '—')}
      ${stat(t('detalle.ratingAnalistas'), ratingLabel(op.recommendationKey))}
      ${stat(t('detalle.cantidadAnalistas'), op.numberOfAnalystOpinions ?? '—')}
      ${stat(t('detalle.marketCapUsd'), op.marketCap != null ? '$' + usdCompact(op.marketCap) : '—')}
      ${stat(t('detalle.ingresosAnualesUsd'), op.totalRevenue != null ? '$' + usdCompact(op.totalRevenue) : '—')}
      ${stat(t('common.crecimientoIngresos'), op.revenueGrowth != null ? pct(op.revenueGrowth * 100) : '—')}
      ${stat(t('detalle.roe'), op.returnOnEquity != null ? pct(op.returnOnEquity * 100) : '—')}
      ${stat(t('detalle.deudaPatrimonio'), op.debtToEquity != null ? op.debtToEquity.toFixed(0) + '%' : '—')}
    </div>

    <h2 style="margin-top:20px">${t('detalle.tecnico')}</h2>
    <div class="detail-grid">
      ${stat(t('detalle.senal'), op.timing?.signal ? traducirSignal(op.timing.signal) : '—')}
      ${stat(t('detalle.rsi'), d.rsi != null ? d.rsi.toFixed(0) : '—')}
      ${stat(t('detalle.momentumRoc'), d.roc != null ? pct(d.roc) : '—')}
      ${stat(t('common.volatilidadAtr'), d.atrRelPct != null ? d.atrRelPct.toFixed(1) + '%' : '—')}
      ${stat(t('detalle.tendencia'), tendenciaTexto)}
      ${stat(t('detalle.distanciaEma50'), d.distPct != null ? pct(d.distPct) : '—')}
    </div>

    ${renderGlosario(['potencial', 'rating', 'marketCapIngresos', 'crecimiento', 'roe', 'deuda', 'rsi', 'momentum', 'volatilidad', 'tendencia'])}`;
}

export async function abrirDetalle(op) {
  openModal(contenido(op, `<p class="empty-inline">${t('detalle.cargandoHistorico')}</p>`));
  wireClose();

  try {
    const r = await window.api.getHistorico(op.tickerBA);
    if (r.error) {
      updateModal(contenido(op, `<p class="empty-inline">${t('detalle.noSePudoTraerHistorico', { error: esc(r.error) })}</p>`));
    } else {
      updateModal(contenido(op, renderPriceChart(r.bars)));
    }
  } catch (e) {
    updateModal(contenido(op, `<p class="empty-inline">${t('detalle.noSePudoTraerHistorico', { error: esc(e.message) })}</p>`));
  }
  wireClose();
}

function wireClose() {
  const btn = document.getElementById('modal-close');
  if (btn) btn.addEventListener('click', closeModal);
}
