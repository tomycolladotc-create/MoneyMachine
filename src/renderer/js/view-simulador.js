import { ars, usd, num, pct, signClass, esc, limpiarTickerBare } from './format.js';
import { renderGlosario } from './glosario.js';
import { t, traducirTipoActivo, claseChipTipo } from './i18n.js';

let perfil = 'AGRESIVO';
// Qué tipos de activo se pueden usar para armar la cartera sugerida. CEDEAR
// reparte un presupuesto en pesos; Acción y Cripto comparten uno en dólares
// (no se inventa un tipo de cambio para mezclar pesos y dólares en una sola
// cuenta — ver el bloque de abajo).
let tiposActivos = { CEDEAR: true, ACCION: false, CRYPTO: false };

function nuevoBloque(presupuestoDefault) {
  return { presupuesto: presupuestoDefault, seleccionados: null, resultado: null, calculando: false, error: null };
}
// Dos simulaciones independientes, una por moneda.
let bloqueArs = nuevoBloque(1000000);
let bloqueUsd = nuevoBloque(1000);

function candidatosDeTipos(s, tipos) {
  if (tipos.length === 0) return [];
  return (s.snapshot?.oportunidades?.[perfil] || [])
    .filter((op) => tipos.includes(op.tipo || 'CEDEAR'))
    .map((op) => ({ tickerBA: op.tickerBA, ticker: op.ticker, nombre: op.nombre, sector: op.sector, tipo: op.tipo || 'CEDEAR' }));
}

function asegurarSeleccionInicial(bloque, candidatos) {
  if (bloque.seleccionados == null) {
    bloque.seleccionados = new Set(candidatos.map((c) => c.tickerBA));
  }
}

function filaCandidato(bloque, c, esManual, mostrarChipTipo) {
  const checked = bloque.seleccionados.has(c.tickerBA) ? 'checked' : '';
  return `
    <label class="check-row">
      <input type="checkbox" data-action="toggle-ticker" data-ticker="${esc(c.tickerBA)}" ${checked} />
      <span class="mono">${esc(c.ticker)}</span>
      ${mostrarChipTipo ? `<span class="chip ${claseChipTipo(c.tipo)}">${esc(traducirTipoActivo(c.tipo))}</span>` : ''}
      <span class="check-nombre">${esc(c.nombre)}</span>
      ${esManual ? `<button type="button" class="icon-btn" data-action="quitar-candidato" data-ticker="${esc(c.tickerBA)}" title="${t('simulador.sacarDeLaLista')}">✕</button>` : ''}
    </label>`;
}

// Acciones y cripto se pueden comprar fraccionadas (muchos brokers ya lo
// permiten para acciones, y en cripto comprar 0,00001 BTC es lo normal), así
// que su cantidad se muestra con decimales en vez de redondearse a una unidad
// entera como un CEDEAR.
function formatCantidad(cantidad, tipo) {
  if (tipo === 'CRYPTO') return num(cantidad, 8);
  if (tipo === 'ACCION') return num(cantidad, 6);
  return num(Math.floor(cantidad));
}

function filaResultado(r, formatMoneda, mostrarChipTipo) {
  return `
    <tr>
      <td class="mono">${esc(r.ticker)}${mostrarChipTipo ? ` <span class="chip ${claseChipTipo(r.tipo)}">${esc(traducirTipoActivo(r.tipo))}</span>` : ''}</td>
      <td>${esc(r.nombre || '')}</td>
      <td class="num">${r.calidad != null ? r.calidad.toFixed(0) : '—'}</td>
      <td class="num">${r.porcentaje.toFixed(1)}%</td>
      <td class="num">${formatMoneda(r.monto)}</td>
      <td class="num">${formatMoneda(r.precio)}</td>
      <td class="num">${formatCantidad(r.cantidad, r.tipo)}</td>
    </tr>`;
}

// Reparte `presupuesto` entre `candidatos` ({ticker, nombre, pesoAsignacion,
// precio, tipo}) garantizando que a cada CEDEAR incluido le alcance al menos
// para 1 unidad entera (no se puede comprar fraccionado en BYMA acá): primero
// se le reserva el precio de 1 unidad a cada uno que entre (en orden de peso,
// salteando los que no entran), y recién el resto del presupuesto se reparte
// a prorrata de ese peso por encima de esa base. Acción y Cripto no necesitan
// esa reserva — se pueden comprar fraccionadas, así que cualquier monto
// positivo es una compra válida y compiten por su porción del presupuesto
// desde el vamos, sin necesitar alcanzarles para 1 unidad entera.
function asignarPresupuesto(candidatos, presupuesto, formatMoneda) {
  const conPrecio = candidatos.filter((c) => c.precio != null && c.precio > 0);
  const sinPrecio = candidatos.filter((c) => !(c.precio != null && c.precio > 0));
  const ordenados = [...conPrecio].sort((a, b) => b.pesoAsignacion - a.pesoAsignacion);

  const incluidos = [];
  const excluidos = sinPrecio.map((c) => ({ ...c, motivo: t('simulador.motivoSinPrecio') }));
  let costoBase = 0;
  for (const c of ordenados) {
    const costoReservado = c.tipo === 'CEDEAR' ? c.precio : 0;
    if (costoBase + costoReservado <= presupuesto) {
      incluidos.push({ ...c, costoReservado });
      costoBase += costoReservado;
    } else {
      excluidos.push({ ...c, motivo: t('simulador.motivoNoEntra', { precio: formatMoneda(c.precio) }) });
    }
  }

  if (incluidos.length === 0) return { filas: [], excluidos };

  const restante = presupuesto - costoBase;
  const totalPeso = incluidos.reduce((acc, c) => acc + Math.max(c.pesoAsignacion, 0), 0);
  const filas = incluidos
    .map((c) => {
      const peso = totalPeso > 0 ? Math.max(c.pesoAsignacion, 0) / totalPeso : 1 / incluidos.length;
      const monto = c.costoReservado + restante * peso;
      return { ...c, monto, porcentaje: (monto / presupuesto) * 100, cantidad: monto / c.precio };
    })
    .sort((a, b) => b.monto - a.monto);

  return { filas, excluidos };
}

// Proyección a 12 meses (horizonte estándar de un precio objetivo de analistas):
// si cada ticker rindiera exactamente su potencial, ¿cuánto valdría la cartera?
// `incluirPf` compara además contra plazo fijo tradicional/UVA — solo tiene
// sentido para el bloque en pesos, nunca para el de dólares.
function calcularResumenRendimiento(filas, presupuestoTotal, config, incluirPf) {
  const montoTotal = filas.reduce((acc, f) => acc + f.monto, 0) || presupuestoTotal;
  const potencialPonderado = filas.reduce((acc, f) => acc + (f.potencialPct ?? 0) * f.monto, 0) / montoTotal;
  const calidadPonderada = filas.reduce((acc, f) => acc + (f.calidad ?? 0) * f.monto, 0) / montoTotal;
  const timingPonderado = filas.reduce((acc, f) => acc + (f.timing?.score ?? 0) * f.monto, 0) / montoTotal;
  const sectores = new Set(filas.map((f) => f.sector)).size;

  const valorEstimado12m = presupuestoTotal * (1 + potencialPonderado / 100);
  const gananciaEstimada = valorEstimado12m - presupuestoTotal;

  let diferenciaPFTradicional = null;
  let diferenciaPFUva = null;
  if (incluirPf) {
    const factorPFTradicional = Math.pow(1 + config.TASA_PF_ANUAL / 365, 365);
    const gananciaPFTradicional = presupuestoTotal * factorPFTradicional - presupuestoTotal;
    diferenciaPFTradicional = gananciaEstimada - gananciaPFTradicional;

    const factorInflacionEstim = Math.pow(1 + config.INFLACION_MENSUAL_ESTIMADA_DEFAULT, 12);
    const factorPlusUva = Math.pow(1 + config.TASA_PF_UVA_PLUS_ANUAL / 365, 365);
    const gananciaPFUva = presupuestoTotal * factorInflacionEstim * factorPlusUva - presupuestoTotal;
    diferenciaPFUva = gananciaEstimada - gananciaPFUva;
  }

  return {
    potencialPonderado, calidadPonderada, timingPonderado, sectores,
    valorEstimado12m, gananciaEstimada,
    diferenciaPFTradicional, diferenciaPFUva,
  };
}

function renderResumenRendimiento(r, formatMoneda, incluirPf) {
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
        <div class="kpi-value">${formatMoneda(r.valorEstimado12m)}</div>
      </div>
      <div class="kpi ${signClass(r.gananciaEstimada)}">
        <div class="kpi-label">${t('simulador.gananciaEstimada')}</div>
        <div class="kpi-value">${formatMoneda(r.gananciaEstimada)}</div>
      </div>
      ${incluirPf ? `
      <div class="kpi ${signClass(r.diferenciaPFTradicional)}">
        <div class="kpi-label">${t('common.vsPfTradicional')}</div>
        <div class="kpi-value">${formatMoneda(r.diferenciaPFTradicional)}</div>
        <div class="kpi-sub">${r.diferenciaPFTradicional >= 0 ? t('simulador.leGanariaPf') : t('simulador.perderiaPf')}</div>
      </div>
      <div class="kpi ${signClass(r.diferenciaPFUva)}">
        <div class="kpi-label">${t('common.vsPfUva')}</div>
        <div class="kpi-value">${formatMoneda(r.diferenciaPFUva)}</div>
        <div class="kpi-sub">${t('simulador.inflacionEstimadaDefault')}</div>
      </div>` : ''}
    </div>
    <div class="mini-stats">
      <span>${t('simulador.calidadPromedioPonderada')}: <strong>${r.calidadPonderada.toFixed(0)}</strong></span>
      <span>${t('simulador.timingPromedioPonderado')}: <strong>${r.timingPonderado.toFixed(0)}</strong></span>
      <span>${t('simulador.sectoresDistintos')}: <strong>${r.sectores}</strong></span>
    </div>`;
}

// Arma y conecta un bloque de simulación completo (controles, candidatos,
// alta manual, botón de generar y resultado) para un grupo de tipos que
// comparten la misma moneda. `mount` es el elemento donde se dibuja.
function renderBloque(mount, container, s, { idPrefix, bloque, tipos, formatMoneda, incluirPf, labelPresupuesto, pasoPresupuesto }) {
  const candidatosBase = candidatosDeTipos(s, tipos);
  asegurarSeleccionInicial(bloque, candidatosBase);

  const universoDatos = (s.snapshot?.datos || []).filter((d) => tipos.includes(d.tipo || 'CEDEAR'));
  const idsBase = new Set(candidatosBase.map((c) => c.tickerBA));
  const manuales = [...bloque.seleccionados]
    .filter((tk) => !idsBase.has(tk))
    .map((tk) => {
      const d = universoDatos.find((x) => x.tickerBA === tk);
      return { tickerBA: tk, ticker: d?.ticker || tk, nombre: d?.nombre || tk, sector: d?.sector || '', tipo: d?.tipo || tipos[0] };
    });
  const listaCompleta = [...candidatosBase, ...manuales];
  const mostrarChipTipo = tipos.length > 1;
  const chipsBloque = tipos.map((tp) => `<span class="chip ${claseChipTipo(tp)}">${esc(traducirTipoActivo(tp))}</span>`).join(' ');

  mount.innerHTML = `
    <div class="sim-controls panel">
      <h2 style="margin-top:0; display:flex; align-items:center; gap:8px">${chipsBloque}</h2>
      <div class="field-grid">
        <label>${labelPresupuesto}
          <input type="number" id="${idPrefix}-presupuesto" value="${bloque.presupuesto}" step="${pasoPresupuesto}" min="0" />
        </label>
      </div>

      <h3 style="margin-top:18px">${t('simulador.candidatos', { n: listaCompleta.length })}</h3>
      ${listaCompleta.length === 0
        ? `<p class="empty-inline">${t('simulador.sinCandidatos')}</p>`
        : `<div class="check-list">${candidatosBase.map((c) => filaCandidato(bloque, c, false, mostrarChipTipo)).join('')}${manuales.map((c) => filaCandidato(bloque, c, true, mostrarChipTipo)).join('')}</div>`}

      <form class="inline-form" id="${idPrefix}-form-manual" style="margin-top:12px">
        <input type="text" name="ticker" placeholder="${t('simulador.agregarAMano')}" style="text-transform:uppercase" list="${idPrefix}-tickers-universo" />
        <datalist id="${idPrefix}-tickers-universo">${universoDatos.map((d) => `<option value="${esc(d.ticker)}"></option>`).join('')}</datalist>
        <button type="submit" class="btn-secondary">${t('universo.agregar')}</button>
      </form>

      <div class="form-actions" style="margin-top:16px">
        <button type="button" id="${idPrefix}-btn-generar" class="btn-primary" ${bloque.calculando ? 'disabled' : ''}>${bloque.calculando ? t('simulador.calculando') : t('simulador.generarCartera')}</button>
        ${bloque.error ? `<span class="save-status" style="color:var(--loss)">${esc(bloque.error)}</span>` : ''}
      </div>
    </div>
    <div id="${idPrefix}-resultado" style="margin-top:12px; margin-bottom:20px"></div>`;

  const resultadoDiv = mount.querySelector(`#${idPrefix}-resultado`);
  if (bloque.resultado) {
    const avisos = [];
    if (bloque.resultado.noEncontrados.length) {
      avisos.push(t('simulador.noEncontrados', { tickers: bloque.resultado.noEncontrados.map(esc).join(', ') }));
    }

    const conPeso = bloque.resultado.resultado.map((r) => ({
      ...r,
      pesoAsignacion: r.tipo === 'CRYPTO' ? (r.timing?.score ?? 0) : (r.calidad ?? 0),
    }));

    if (conPeso.length === 0) {
      resultadoDiv.innerHTML = avisos.map((a) => `<div class="banner banner-warn">${a}</div>`).join('');
    } else {
      const { filas, excluidos } = asignarPresupuesto(conPeso, bloque.presupuesto, formatMoneda);

      if (excluidos.length) {
        avisos.push(t('simulador.noEntranPresupuesto', { detalle: excluidos.map((e) => `${esc(e.ticker)} — ${esc(e.motivo)}`).join('; ') }));
      }

      resultadoDiv.innerHTML = avisos.map((a) => `<div class="banner banner-warn">${a}</div>`).join('');

      if (filas.length === 0) {
        resultadoDiv.innerHTML += `<p class="empty-inline">${t('simulador.noAlcanzaNiUno')}</p>`;
      } else {
        if (s.config) {
          resultadoDiv.innerHTML += renderResumenRendimiento(calcularResumenRendimiento(filas, bloque.presupuesto, s.config, incluirPf), formatMoneda, incluirPf);
        }
        resultadoDiv.innerHTML += `
          <h2 style="margin-top:22px">${t('simulador.detallePorTicker')}</h2>
          <div class="table-scroll">
            <table class="mov-table">
              <thead><tr><th>${t('universo.ticker')}</th><th>${t('simulador.empresa')}</th><th>${t('common.calidad')}</th><th>${t('simulador.pctCartera')}</th><th>${t('cartera.monto')}</th><th>${t('simulador.precioActual')}</th><th>${t('simulador.cantidad')}</th></tr></thead>
              <tbody>${filas.map((f) => filaResultado(f, formatMoneda, mostrarChipTipo)).join('')}</tbody>
              <tfoot><tr class="fila-total"><td colspan="3">${t('cartera.total')}</td><td class="num">100%</td><td class="num">${formatMoneda(bloque.presupuesto)}</td><td colspan="2"></td></tr></tfoot>
            </table>
          </div>
          <p class="hint">${t('simulador.hintCantidad')}</p>`;
      }
    }
  }

  mount.querySelector(`#${idPrefix}-presupuesto`).addEventListener('input', (ev) => {
    bloque.presupuesto = Number(ev.target.value) || 0;
  });

  mount.querySelectorAll('[data-action="toggle-ticker"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) bloque.seleccionados.add(cb.dataset.ticker);
      else bloque.seleccionados.delete(cb.dataset.ticker);
    });
  });

  mount.querySelectorAll('[data-action="quitar-candidato"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      bloque.seleccionados.delete(btn.dataset.ticker);
      renderSimulador(container, s);
    });
  });

  mount.querySelector(`#${idPrefix}-form-manual`).addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const tickerTexto = limpiarTickerBare(fd.get('ticker'));
    if (!tickerTexto) return;
    const encontrado = universoDatos.find((d) => d.ticker === tickerTexto || d.tickerBA === tickerTexto);
    if (!encontrado) {
      bloque.error = t('simulador.errorSinDatos', { ticker: tickerTexto });
      renderSimulador(container, s);
      return;
    }
    bloque.seleccionados.add(encontrado.tickerBA);
    bloque.error = null;
    renderSimulador(container, s);
  });

  mount.querySelector(`#${idPrefix}-btn-generar`).addEventListener('click', async () => {
    if (bloque.seleccionados.size === 0) {
      bloque.error = t('simulador.elegiUnTicker');
      renderSimulador(container, s);
      return;
    }
    if (bloque.presupuesto <= 0) {
      bloque.error = t('simulador.presupuestoMayorCero');
      renderSimulador(container, s);
      return;
    }
    bloque.error = null;
    bloque.calculando = true;
    renderSimulador(container, s);
    try {
      bloque.resultado = await window.api.simularCartera({ perfil, tickers: [...bloque.seleccionados] });
    } catch (e) {
      bloque.error = t('simulador.noSePudoCalcular', { mensaje: e.message });
    } finally {
      bloque.calculando = false;
      renderSimulador(container, s);
    }
  });
}

export function renderSimulador(container, s) {
  const snap = s.snapshot;

  if (!snap) {
    container.innerHTML = `
      <div class="view-header"><div><h1>${t('simulador.titulo')}</h1></div></div>
      <p class="empty-inline">${t('simulador.esperandoPrimerRefresco')}</p>`;
    return;
  }

  const tiposUsd = ['ACCION', 'CRYPTO'].filter((tp) => tiposActivos[tp]);

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
      </div>
      <h3 style="margin-top:14px">${t('simulador.componerCon')}</h3>
      <div class="check-row-group">
        <label class="check-row"><input type="checkbox" data-action="toggle-tipo" data-tipo="CEDEAR" ${tiposActivos.CEDEAR ? 'checked' : ''} /> ${t('common.cedear')}</label>
        <label class="check-row"><input type="checkbox" data-action="toggle-tipo" data-tipo="ACCION" ${tiposActivos.ACCION ? 'checked' : ''} /> ${t('common.accion')}</label>
        <label class="check-row"><input type="checkbox" data-action="toggle-tipo" data-tipo="CRYPTO" ${tiposActivos.CRYPTO ? 'checked' : ''} /> ${t('common.cripto')}</label>
      </div>
      <p class="hint">${t('simulador.hintPresupuestoPorMoneda')}</p>
    </div>

    ${!tiposActivos.CEDEAR && tiposUsd.length === 0 ? `<p class="empty-inline">${t('simulador.elegiUnTipo')}</p>` : ''}
    <div id="sim-bloque-ars"></div>
    <div id="sim-bloque-usd"></div>
    ${renderGlosario(['repartoCalidad', 'calidad', 'rendimientoEsperado', 'plazoFijoTradicional', 'plazoFijoUva', 'perfiles', 'accionWallStreet', 'cripto'])}`;

  container.querySelector('#sim-perfil').addEventListener('change', (ev) => {
    perfil = ev.target.value;
    bloqueArs.seleccionados = null;
    bloqueArs.resultado = null;
    bloqueArs.error = null;
    bloqueUsd.seleccionados = null;
    bloqueUsd.resultado = null;
    bloqueUsd.error = null;
    renderSimulador(container, s);
  });

  container.querySelectorAll('[data-action="toggle-tipo"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      tiposActivos[cb.dataset.tipo] = cb.checked;
      if (cb.dataset.tipo === 'CEDEAR') {
        bloqueArs.seleccionados = null;
        bloqueArs.resultado = null;
        bloqueArs.error = null;
      } else {
        bloqueUsd.seleccionados = null;
        bloqueUsd.resultado = null;
        bloqueUsd.error = null;
      }
      renderSimulador(container, s);
    });
  });

  if (tiposActivos.CEDEAR) {
    renderBloque(container.querySelector('#sim-bloque-ars'), container, s, {
      idPrefix: 'sim-ars', bloque: bloqueArs, tipos: ['CEDEAR'], formatMoneda: ars, incluirPf: true,
      labelPresupuesto: t('simulador.presupuestoArs'), pasoPresupuesto: 1000,
    });
  }
  if (tiposUsd.length > 0) {
    renderBloque(container.querySelector('#sim-bloque-usd'), container, s, {
      idPrefix: 'sim-usd', bloque: bloqueUsd, tipos: tiposUsd, formatMoneda: usd, incluirPf: false,
      labelPresupuesto: t('simulador.presupuestoUsd'), pasoPresupuesto: 10,
    });
  }
}
