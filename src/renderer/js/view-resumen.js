import { ars, usd, pct, signClass, esc, relativeTime } from './format.js';
import { renderGlosario } from './glosario.js';
import { renderComparisonChart } from './chart.js';
import { agruparPorTicker } from './agrupar-oportunidades.js';
import { t, traducirTipoActivo, claseChipTipo } from './i18n.js';

function tile(label, value, sub, cls = '') {
  return `
    <div class="kpi ${cls}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
    </div>`;
}

function filaOportunidad(grupo) {
  const chipsTipo = grupo.instancias.map((i) => `<span class="chip ${claseChipTipo(i.tipo)}">${esc(traducirTipoActivo(i.tipo))}</span>`).join(' ');
  return `
    <li class="mini-row">
      <span class="mini-ticker">${esc(grupo.ticker)}</span>
      ${chipsTipo}
      <span class="mini-nombre">${esc(grupo.nombre)}</span>
      <span class="mini-calidad">${grupo.calidad != null ? grupo.calidad.toFixed(0) : '—'}</span>
    </li>`;
}

function renderEvolucion(historial) {
  if (!historial || historial.length === 0) {
    return `<p class="empty-inline">${t('resumen.sinHistorial')}</p>`;
  }
  const fechas = historial.map((p) => p.fecha);
  const series = [
    { nombre: t('resumen.serieCartera'), color: 'var(--accent)', valores: historial.map((p) => p.valorHoyTotal) },
    { nombre: t('common.plazoFijoTradicional'), color: 'var(--accent-2)', valores: historial.map((p) => p.capitalInvertido + p.gananciaPF) },
    { nombre: t('common.plazoFijoUva'), color: 'var(--purple)', punteada: true, valores: historial.map((p) => p.capitalInvertido + p.gananciaPFUva) },
    { nombre: t('resumen.serieSp500'), color: 'var(--info)', punteada: true, valores: historial.map((p) => (p.gananciaBenchmark != null ? p.capitalInvertido + p.gananciaBenchmark : null)) },
  ];
  return renderComparisonChart(fechas, series);
}

export function renderResumen(container, state) {
  const snap = state.snapshot;

  if (!snap) {
    container.innerHTML = `
      <section class="empty-state">
        <h2>${t('resumen.sinDatos')}</h2>
        <p>${t('resumen.sinDatosDetalle')}</p>
      </section>`;
    return;
  }

  const total = snap.cartera.total;
  const totalUsd = snap.cartera.totalUsd;
  const totalCrypto = snap.cartera.totalCrypto;
  const errores = snap.fallaron?.length
    ? `<div class="banner banner-warn">${t('resumen.fallaronTickers', { n: snap.fallaron.length })} <button class="link-btn" id="ver-errores">${t('resumen.verDetalle')}</button></div>`
    : '';

  const topAgresivo = agruparPorTicker(snap.oportunidades.AGRESIVO).slice(0, 5);
  const topConservador = agruparPorTicker(snap.oportunidades.CONSERVADOR).slice(0, 5);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>${t('nav.resumen')}</h1>
        <p class="view-subtitle">${t('resumen.subtitulo', { tiempo: relativeTime(snap.timestamp) })}</p>
      </div>
    </div>
    ${errores}
    <div class="kpi-grid">
      ${tile(t('common.invertido'), ars(total.capitalInvertido))}
      ${tile(t('common.valorHoy'), ars(total.valorHoyTotal))}
      ${tile(t('common.ganancia'), ars(total.gananciaCedear), pct((total.gananciaCedear / total.capitalInvertido) * 100), signClass(total.gananciaCedear))}
      ${tile(t('common.vsPfTradicional'), ars(total.diferenciaPF), total.diferenciaPF >= 0 ? t('common.leGanaPf') : t('common.pierdePf'), signClass(total.diferenciaPF))}
      ${tile(t('common.vsPfUva'), ars(total.diferenciaPFUva), total.diferenciaPFUva >= 0 ? t('common.leGanaPfUva') : t('common.pierdePfUva'), signClass(total.diferenciaPFUva))}
      ${total.diferenciaBenchmark != null
        ? tile(t('common.vsSp500'), ars(total.diferenciaBenchmark), total.diferenciaBenchmark >= 0 ? t('common.leGanaSp500') : t('common.pierdeSp500'), signClass(total.diferenciaBenchmark))
        : tile(t('common.vsSp500'), '—', t('common.sinDatoHoy'))}
    </div>

    ${totalUsd && totalUsd.capitalInvertido > 0 ? `
    <div class="kpi-grid" style="margin-top:10px">
      <div class="kpi-grid-titulo" style="grid-column:1/-1"><span class="chip chip-tipo-accion">${esc(traducirTipoActivo('ACCION'))}</span></div>
      ${tile(t('common.invertido'), usd(totalUsd.capitalInvertido))}
      ${tile(t('common.valorHoy'), usd(totalUsd.valorHoyTotal))}
      ${tile(t('common.ganancia'), usd(totalUsd.gananciaCedear), pct((totalUsd.gananciaCedear / totalUsd.capitalInvertido) * 100), signClass(totalUsd.gananciaCedear))}
      ${totalUsd.diferenciaBenchmark != null
        ? tile(t('common.vsSp500Usd'), usd(totalUsd.diferenciaBenchmark), totalUsd.diferenciaBenchmark >= 0 ? t('common.leGanaSp500') : t('common.pierdeSp500'), signClass(totalUsd.diferenciaBenchmark))
        : tile(t('common.vsSp500Usd'), '—', t('common.sinDatoHoy'))}
    </div>` : ''}

    ${totalCrypto && totalCrypto.capitalInvertido > 0 ? `
    <div class="kpi-grid" style="margin-top:10px">
      <div class="kpi-grid-titulo" style="grid-column:1/-1"><span class="chip chip-tipo-crypto">${esc(traducirTipoActivo('CRYPTO'))}</span></div>
      ${tile(t('common.invertido'), usd(totalCrypto.capitalInvertido))}
      ${tile(t('common.valorHoy'), usd(totalCrypto.valorHoyTotal))}
      ${tile(t('common.ganancia'), usd(totalCrypto.gananciaCedear), pct((totalCrypto.gananciaCedear / totalCrypto.capitalInvertido) * 100), signClass(totalCrypto.gananciaCedear))}
      ${totalCrypto.diferenciaBenchmark != null
        ? tile(t('common.vsBtcUsd'), usd(totalCrypto.diferenciaBenchmark), totalCrypto.diferenciaBenchmark >= 0 ? t('common.leGanaBtc') : t('common.pierdeBtc'), signClass(totalCrypto.diferenciaBenchmark))
        : tile(t('common.vsBtcUsd'), '—', t('common.sinDatoHoy'))}
    </div>` : ''}

    <section class="panel chart-container" style="margin-bottom:20px">
      <h2>${t('resumen.evolucionCartera')}</h2>
      ${renderEvolucion(state.historial)}
    </section>

    <div class="two-col">
      <section class="panel">
        <h2>⭐ ${t('resumen.comprarAhora')} — ${t('common.agresivo')}</h2>
        ${topAgresivo.length
          ? `<ul class="mini-list">${topAgresivo.map(filaOportunidad).join('')}</ul>`
          : `<p class="empty-inline">${t('resumen.ningunoCalificaAgresivo')}</p>`}
      </section>
      <section class="panel">
        <h2>⭐ ${t('resumen.comprarAhora')} — ${t('common.conservador')}</h2>
        ${topConservador.length
          ? `<ul class="mini-list">${topConservador.map(filaOportunidad).join('')}</ul>`
          : `<p class="empty-inline">${t('resumen.ningunoCalificaConservador')}</p>`}
      </section>
    </div>
    ${renderGlosario(['cedear', 'calidad', 'clasificacion', 'plazoFijoTradicional', 'plazoFijoUva', 'sp500', 'accionWallStreet', 'cripto'])}`;

  const btn = container.querySelector('#ver-errores');
  if (btn) btn.addEventListener('click', () => {
    alert(snap.fallaron.map((f) => `${f.ticker}: ${f.error}`).join('\n'));
  });
}
