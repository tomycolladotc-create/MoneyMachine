import { ars, pct, usdCompact, esc } from './format.js';
import { barra } from './score-bar.js';
import { renderPriceChart } from './chart.js';
import { openModal, updateModal, closeModal } from './modal.js';
import { renderGlosario } from './glosario.js';

const RATING_LABEL = {
  strong_buy: 'Compra fuerte', strongbuy: 'Compra fuerte',
  buy: 'Compra',
  hold: 'Mantener', none: 'Sin cobertura',
  underperform: 'Bajo rendimiento', reduce: 'Reducir',
  sell: 'Venta', strong_sell: 'Venta fuerte',
};

function stat(label, value) {
  return `<div><span class="metric-label">${label}</span><span class="metric-value">${value}</span></div>`;
}

function contenido(t, chartHTML) {
  const d = t.timing?.detalles || {};
  const tendenciaTexto = d.ema50 != null && d.ema200 != null
    ? (d.ema50 > d.ema200 ? 'EMA50 sobre EMA200 (alcista)' : 'EMA50 bajo EMA200 (bajista)')
    : 'sin dato suficiente';

  return `
    <button class="modal-close" id="modal-close" title="Cerrar">✕</button>
    <header class="modal-header">
      <div>
        <div class="op-ticker" style="font-size:20px">${esc(t.ticker)}</div>
        <div class="op-nombre">${esc(t.nombre)}</div>
      </div>
      <div class="modal-header-badges">
        <span class="chip">${esc(t.sector)}</span>
        <span class="badge badge-gain">${esc(t.clasificacion || '')}</span>
      </div>
    </header>

    <div class="chart-container">${chartHTML}</div>

    <div class="score-block">
      ${barra('Calidad', t.calidad, 'fill-accent')}
      ${barra('Entrada', t.timing?.score ?? 0, 'fill-accent2')}
    </div>

    <h2 style="margin-top:20px">Fundamentals</h2>
    <div class="detail-grid">
      ${stat('Potencial (precio objetivo)', t.potencialPct != null ? pct(t.potencialPct) : '—')}
      ${stat('Rating analistas', RATING_LABEL[t.recommendationKey] || t.recommendationKey || '—')}
      ${stat('Cantidad de analistas', t.numberOfAnalystOpinions ?? '—')}
      ${stat('Market cap (USD)', t.marketCap != null ? '$' + usdCompact(t.marketCap) : '—')}
      ${stat('Ingresos anuales (USD)', t.totalRevenue != null ? '$' + usdCompact(t.totalRevenue) : '—')}
      ${stat('Crecimiento de ingresos', t.revenueGrowth != null ? pct(t.revenueGrowth * 100) : '—')}
      ${stat('ROE', t.returnOnEquity != null ? pct(t.returnOnEquity * 100) : '—')}
      ${stat('Deuda / Patrimonio', t.debtToEquity != null ? t.debtToEquity.toFixed(0) + '%' : '—')}
    </div>

    <h2 style="margin-top:20px">Técnico (timing de entrada)</h2>
    <div class="detail-grid">
      ${stat('Señal', t.timing?.signal || '—')}
      ${stat('RSI (14)', d.rsi != null ? d.rsi.toFixed(0) : '—')}
      ${stat('Momentum (ROC 20)', d.roc != null ? pct(d.roc) : '—')}
      ${stat('Volatilidad (ATR)', d.atrRelPct != null ? d.atrRelPct.toFixed(1) + '%' : '—')}
      ${stat('Tendencia', tendenciaTexto)}
      ${stat('Distancia a EMA50', d.distPct != null ? pct(d.distPct) : '—')}
    </div>

    ${renderGlosario(['potencial', 'rating', 'marketCapIngresos', 'crecimiento', 'roe', 'deuda', 'rsi', 'momentum', 'volatilidad', 'tendencia'])}`;
}

export async function abrirDetalle(t) {
  openModal(contenido(t, `<p class="empty-inline">Cargando histórico de precios…</p>`));
  wireClose();

  try {
    const r = await window.api.getHistorico(t.tickerBA);
    if (r.error) {
      updateModal(contenido(t, `<p class="empty-inline">No se pudo traer el histórico: ${esc(r.error)}</p>`));
    } else {
      updateModal(contenido(t, renderPriceChart(r.bars)));
    }
  } catch (e) {
    updateModal(contenido(t, `<p class="empty-inline">No se pudo traer el histórico: ${esc(e.message)}</p>`));
  }
  wireClose();
}

function wireClose() {
  const btn = document.getElementById('modal-close');
  if (btn) btn.addEventListener('click', closeModal);
}
