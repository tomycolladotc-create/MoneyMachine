import { ars, num, pct, signClass, esc, limpiarTickerBare } from './format.js';
import { renderGlosario } from './glosario.js';
import { t } from './i18n.js';

let perfil = 'AGRESIVO';
let presupuesto = 1000000;
let seleccionados = null; // Set<ticker> — null significa "todavía no inicializado para este perfil"
let resultado = null; // { resultado, noEncontrados } de la última corrida
let calculando = false;
let error = null;

function candidatosDelPerfil(s) {
  return (s.snapshot?.oportunidades?.[perfil] || []).map((t) => ({ ticker: t.ticker, nombre: t.nombre, sector: t.sector }));
}

function asegurarSeleccionInicial(s) {
  if (seleccionados == null) {
    seleccionados = new Set(candidatosDelPerfil(s).map((c) => c.ticker));
  }
}

function filaCandidato(c, esManual) {
  const checked = seleccionados.has(c.ticker) ? 'checked' : '';
  return `
    <label class="check-row">
      <input type="checkbox" data-action="toggle-ticker" data-ticker="${esc(c.ticker)}" ${checked} />
      <span class="mono">${esc(c.ticker)}</span>
      <span class="check-nombre">${esc(c.nombre)}</span>
      ${esManual ? `<button type="button" class="icon-btn" data-action="quitar-candidato" data-ticker="${esc(c.ticker)}" title="${t('simulador.sacarDeLaLista')}">✕</button>` : ''}
    </label>`;
}

function filaResultado(r) {
  return `
    <tr>
      <td class="mono">${esc(r.ticker)}</td>
      <td>${esc(r.nombre || '')}</td>
      <td class="num">${r.calidad.toFixed(0)}</td>
      <td class="num">${r.porcentaje.toFixed(1)}%</td>
      <td class="num">${ars(r.monto)}</td>
      <td class="num">${ars(r.precioARS)}</td>
      <td class="num">${num(r.cantidad)}</td>
    </tr>`;
}

// Reparte `presupuesto` entre `candidatos` ({ticker, nombre, calidad, precioARS})
// garantizando que a cada ticker incluido le alcance al menos para 1 unidad:
// primero se reserva el precio de 1 unidad de cada uno que entre (en orden de
// Calidad, salteando los que no entran), y recién el resto del presupuesto se
// reparte a prorrata de Calidad por encima de esa base. Lo que no entra ni con
// 1 unidad queda afuera y se informa por qué.
function asignarPresupuesto(candidatos, presupuesto) {
  const conPrecio = candidatos.filter((c) => c.precioARS != null && c.precioARS > 0);
  const sinPrecio = candidatos.filter((c) => !(c.precioARS != null && c.precioARS > 0));
  const ordenados = [...conPrecio].sort((a, b) => b.calidad - a.calidad);

  const incluidos = [];
  const excluidos = sinPrecio.map((c) => ({ ...c, motivo: t('simulador.motivoSinPrecio') }));
  let costoBase = 0;
  for (const c of ordenados) {
    if (costoBase + c.precioARS <= presupuesto) {
      incluidos.push(c);
      costoBase += c.precioARS;
    } else {
      excluidos.push({ ...c, motivo: t('simulador.motivoNoEntra', { precio: ars(c.precioARS) }) });
    }
  }

  if (incluidos.length === 0) return { filas: [], excluidos };

  const restante = presupuesto - costoBase;
  const totalCalidad = incluidos.reduce((acc, c) => acc + Math.max(c.calidad, 0), 0);
  const filas = incluidos
    .map((c) => {
      const peso = totalCalidad > 0 ? Math.max(c.calidad, 0) / totalCalidad : 1 / incluidos.length;
      const monto = c.precioARS + restante * peso;
      return { ...c, monto, porcentaje: (monto / presupuesto) * 100, cantidad: Math.floor(monto / c.precioARS) };
    })
    .sort((a, b) => b.monto - a.monto);

  return { filas, excluidos };
}

// Proyección a 12 meses (horizonte estándar de un precio objetivo de analistas):
// si cada ticker rindiera exactamente su potencial, ¿cuánto valdría la cartera,
// y cómo se compara contra dejar la misma plata en un plazo fijo? Para el plazo
// fijo UVA no hay forma de saber la inflación real de los próximos 12 meses, así
// que se usa el valor estimado default parejo los 12 meses — una aproximación,
// no una predicción.
function calcularResumenRendimiento(filas, presupuestoTotal, config) {
  const montoTotal = filas.reduce((acc, f) => acc + f.monto, 0) || presupuestoTotal;
  const potencialPonderado = filas.reduce((acc, f) => acc + (f.potencialPct ?? 0) * f.monto, 0) / montoTotal;
  const calidadPonderada = filas.reduce((acc, f) => acc + f.calidad * f.monto, 0) / montoTotal;
  const timingPonderado = filas.reduce((acc, f) => acc + (f.timing?.score ?? 0) * f.monto, 0) / montoTotal;
  const sectores = new Set(filas.map((f) => f.sector)).size;

  const valorEstimado12m = presupuestoTotal * (1 + potencialPonderado / 100);
  const gananciaEstimada = valorEstimado12m - presupuestoTotal;

  const factorPFTradicional = Math.pow(1 + config.TASA_PF_ANUAL / 365, 365);
  const gananciaPFTradicional = presupuestoTotal * factorPFTradicional - presupuestoTotal;

  const factorInflacionEstim = Math.pow(1 + config.INFLACION_MENSUAL_ESTIMADA_DEFAULT, 12);
  const factorPlusUva = Math.pow(1 + config.TASA_PF_UVA_PLUS_ANUAL / 365, 365);
  const gananciaPFUva = presupuestoTotal * factorInflacionEstim * factorPlusUva - presupuestoTotal;

  return {
    potencialPonderado, calidadPonderada, timingPonderado, sectores,
    valorEstimado12m, gananciaEstimada,
    diferenciaPFTradicional: gananciaEstimada - gananciaPFTradicional,
    diferenciaPFUva: gananciaEstimada - gananciaPFUva,
  };
}

function renderResumenRendimiento(r) {
  return `
    <h2 style="margin-top:2px">${t('simulador.rendimientoTitulo')}</h2>
    <p class="hint" style="margin-top:-6px">${t('simulador.rendimientoHint')}</p>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">${t('simulador.potencialPonderado')}</div>
        <div class="kpi-value">${pct(r.potencialPonderado)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">${t('simulador.valorEstimado12m')}</div>
        <div class="kpi-value">${ars(r.valorEstimado12m)}</div>
      </div>
      <div class="kpi ${signClass(r.gananciaEstimada)}">
        <div class="kpi-label">${t('simulador.gananciaEstimada')}</div>
        <div class="kpi-value">${ars(r.gananciaEstimada)}</div>
      </div>
      <div class="kpi ${signClass(r.diferenciaPFTradicional)}">
        <div class="kpi-label">${t('common.vsPfTradicional')}</div>
        <div class="kpi-value">${ars(r.diferenciaPFTradicional)}</div>
        <div class="kpi-sub">${r.diferenciaPFTradicional >= 0 ? t('simulador.leGanariaPf') : t('simulador.perderiaPf')}</div>
      </div>
      <div class="kpi ${signClass(r.diferenciaPFUva)}">
        <div class="kpi-label">${t('common.vsPfUva')}</div>
        <div class="kpi-value">${ars(r.diferenciaPFUva)}</div>
        <div class="kpi-sub">${t('simulador.inflacionEstimadaDefault')}</div>
      </div>
    </div>
    <div class="mini-stats">
      <span>${t('simulador.calidadPromedioPonderada')}: <strong>${r.calidadPonderada.toFixed(0)}</strong></span>
      <span>${t('simulador.timingPromedioPonderado')}: <strong>${r.timingPonderado.toFixed(0)}</strong></span>
      <span>${t('simulador.sectoresDistintos')}: <strong>${r.sectores}</strong></span>
    </div>`;
}

export function renderSimulador(container, s) {
  asegurarSeleccionInicial(s);
  const snap = s.snapshot;
  const universoDatos = snap?.datos || [];
  const candidatosBase = candidatosDelPerfil(s);
  // candidatos manuales: los que están en `seleccionados` pero no vinieron del ranking
  const idsBase = new Set(candidatosBase.map((c) => c.ticker));
  const manuales = [...seleccionados]
    .filter((t) => !idsBase.has(t))
    .map((t) => {
      const d = universoDatos.find((x) => x.ticker === t);
      return { ticker: t, nombre: d?.nombre || t, sector: d?.sector || '' };
    });
  const listaCompleta = [...candidatosBase, ...manuales];

  if (!snap) {
    container.innerHTML = `
      <div class="view-header"><div><h1>${t('simulador.titulo')}</h1></div></div>
      <p class="empty-inline">${t('simulador.esperandoPrimerRefresco')}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>${t('simulador.titulo')}</h1>
        <p class="view-subtitle">${t('simulador.subtitulo')}</p>
      </div>
    </div>

    <div class="sim-controls panel">
      <div class="field-grid">
        <label>${t('simulador.perfil')}
          <select id="sim-perfil">
            <option value="AGRESIVO" ${perfil === 'AGRESIVO' ? 'selected' : ''}>${t('common.agresivo')}</option>
            <option value="CONSERVADOR" ${perfil === 'CONSERVADOR' ? 'selected' : ''}>${t('common.conservador')}</option>
          </select>
        </label>
        <label>${t('simulador.presupuestoTotal')}
          <input type="number" id="sim-presupuesto" value="${presupuesto}" step="1000" min="0" />
        </label>
      </div>

      <h2 style="margin-top:18px">${t('simulador.candidatos', { n: listaCompleta.length })}</h2>
      ${listaCompleta.length === 0
        ? `<p class="empty-inline">${t('simulador.sinCandidatos')}</p>`
        : `<div class="check-list">${candidatosBase.map((c) => filaCandidato(c, false)).join('')}${manuales.map((c) => filaCandidato(c, true)).join('')}</div>`}

      <form class="inline-form" id="form-agregar-manual" style="margin-top:12px">
        <input type="text" name="ticker" placeholder="${t('simulador.agregarAMano')}" style="text-transform:uppercase" list="tickers-universo" />
        <datalist id="tickers-universo">${universoDatos.map((d) => `<option value="${esc(d.ticker)}"></option>`).join('')}</datalist>
        <button type="submit" class="btn-secondary">${t('universo.agregar')}</button>
      </form>

      <div class="form-actions" style="margin-top:16px">
        <button type="button" id="btn-generar" class="btn-primary" ${calculando ? 'disabled' : ''}>${calculando ? t('simulador.calculando') : t('simulador.generarCartera')}</button>
        ${error ? `<span class="save-status" style="color:var(--loss)">${esc(error)}</span>` : ''}
      </div>
    </div>

    <div id="sim-resultado" style="margin-top:20px"></div>
    ${renderGlosario(['repartoCalidad', 'calidad', 'rendimientoEsperado', 'plazoFijoTradicional', 'plazoFijoUva', 'perfiles'])}`;

  const resultadoDiv = container.querySelector('#sim-resultado');
  if (resultado) {
    const avisos = [];
    if (resultado.noEncontrados.length) {
      avisos.push(t('simulador.noEncontrados', { tickers: resultado.noEncontrados.map(esc).join(', ') }));
    }

    if (resultado.resultado.length === 0) {
      resultadoDiv.innerHTML = avisos.map((a) => `<div class="banner banner-warn">${a}</div>`).join('');
    } else {
      const { filas, excluidos } = asignarPresupuesto(resultado.resultado, presupuesto);

      if (excluidos.length) {
        avisos.push(t('simulador.noEntranPresupuesto', { detalle: excluidos.map((e) => `${esc(e.ticker)} — ${esc(e.motivo)}`).join('; ') }));
      }

      resultadoDiv.innerHTML = avisos.map((a) => `<div class="banner banner-warn">${a}</div>`).join('');

      if (filas.length === 0) {
        resultadoDiv.innerHTML += `<p class="empty-inline">${t('simulador.noAlcanzaNiUno')}</p>`;
      } else {
        if (s.config) {
          resultadoDiv.innerHTML += renderResumenRendimiento(calcularResumenRendimiento(filas, presupuesto, s.config));
        }
        resultadoDiv.innerHTML += `
          <h2 style="margin-top:22px">${t('simulador.detallePorTicker')}</h2>
          <div class="table-scroll">
            <table class="mov-table">
              <thead><tr><th>${t('universo.ticker')}</th><th>${t('simulador.empresa')}</th><th>${t('common.calidad')}</th><th>${t('simulador.pctCartera')}</th><th>${t('cartera.monto')}</th><th>${t('simulador.precioActual')}</th><th>${t('simulador.cantidad')}</th></tr></thead>
              <tbody>${filas.map(filaResultado).join('')}</tbody>
              <tfoot><tr class="fila-total"><td colspan="3">${t('cartera.total')}</td><td class="num">100%</td><td class="num">${ars(presupuesto)}</td><td colspan="2"></td></tr></tfoot>
            </table>
          </div>
          <p class="hint">${t('simulador.hintCantidad')}</p>`;
      }
    }
  }

  container.querySelector('#sim-perfil').addEventListener('change', (ev) => {
    perfil = ev.target.value;
    seleccionados = null;
    resultado = null;
    error = null;
    renderSimulador(container, s);
  });

  container.querySelector('#sim-presupuesto').addEventListener('input', (ev) => {
    presupuesto = Number(ev.target.value) || 0;
  });

  container.querySelectorAll('[data-action="toggle-ticker"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) seleccionados.add(cb.dataset.ticker);
      else seleccionados.delete(cb.dataset.ticker);
    });
  });

  container.querySelectorAll('[data-action="quitar-candidato"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      seleccionados.delete(btn.dataset.ticker);
      renderSimulador(container, s);
    });
  });

  container.querySelector('#form-agregar-manual').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const ticker = limpiarTickerBare(fd.get('ticker'));
    if (!ticker) return;
    if (!universoDatos.some((d) => d.ticker === ticker)) {
      error = t('simulador.errorSinDatos', { ticker });
      renderSimulador(container, s);
      return;
    }
    seleccionados.add(ticker);
    error = null;
    renderSimulador(container, s);
  });

  container.querySelector('#btn-generar').addEventListener('click', async () => {
    if (seleccionados.size === 0) {
      error = t('simulador.elegiUnTicker');
      renderSimulador(container, s);
      return;
    }
    if (presupuesto <= 0) {
      error = t('simulador.presupuestoMayorCero');
      renderSimulador(container, s);
      return;
    }
    error = null;
    calculando = true;
    renderSimulador(container, s);
    try {
      resultado = await window.api.simularCartera({ perfil, tickers: [...seleccionados] });
    } catch (e) {
      error = t('simulador.noSePudoCalcular', { mensaje: e.message });
    } finally {
      calculando = false;
      renderSimulador(container, s);
    }
  });
}
