import { ars, pct, num, signClass, esc, limpiarTickerBare } from './format.js';
import { claseRecomendacion } from './recomendacion.js';
import { state, setState } from './state.js';
import { renderGlosario } from './glosario.js';
import { attachTickerAutocomplete } from './ticker-autocomplete.js';

function filaMovimiento(tickerBA, m, i) {
  return `
    <tr>
      <td>${esc(m.fecha)}</td>
      <td class="cap">${esc(m.tipo)}</td>
      <td class="num">${ars(m.monto_ars)}</td>
      <td class="num">${m.precio != null ? num(m.precio, 2) : '<span class="muted">a resolver</span>'}</td>
      <td><button class="icon-btn" data-action="del-mov" data-ticker="${esc(tickerBA)}" data-i="${i}" title="Eliminar movimiento">✕</button></td>
    </tr>`;
}

function formNuevoMovimiento(tickerBA) {
  return `
    <form class="inline-form" data-action="add-mov" data-ticker="${esc(tickerBA)}">
      <input type="date" name="fecha" required />
      <select name="tipo">
        <option value="compra">Compra</option>
        <option value="venta">Venta</option>
      </select>
      <input type="number" name="monto_ars" placeholder="Monto ARS" step="0.01" required />
      <input type="number" name="precio" placeholder="Precio (opcional)" step="0.01" />
      <button type="submit" class="btn-secondary">Agregar</button>
      <span class="add-mov-status save-status"></span>
    </form>`;
}

// Si el movimiento ya trae precio, no hay nada que resolver. Si no, le pide a
// Yahoo el cierre de esa fecha; si no puede (ticker mal escrito, fecha sin
// operaciones, fecha futura, etc.) devuelve el motivo para mostrarlo y NO
// dejar pasar el guardado, en vez de guardarlo con precio nulo y que falle
// en cada refresco después.
async function resolverPrecioSiFalta(tickerBA, mov) {
  if (mov.precio != null) return { ok: true, mov };

  const resultado = await window.api.resolverPrecioFecha(tickerBA, mov.fecha);
  if (resultado.ok) return { ok: true, mov: { ...mov, precio: resultado.precio } };

  const sugerenciasBA = (resultado.sugerencias || []).filter((s) => s.exchange === 'BUE');
  const mensaje = sugerenciasBA.length
    ? `No se pudo resolver el precio de ${tickerBA} en ${mov.fecha}. ¿El ticker es ${sugerenciasBA.map((s) => s.symbol).join(' o ')}? Si no, probá con otra fecha o cargá el precio a mano.`
    : `No se pudo resolver el precio de ${tickerBA} en ${mov.fecha}. Puede que esa fecha no tenga rueda (fin de semana, feriado, fecha futura) o que el ticker esté mal. Probá otra fecha o cargá el precio a mano.`;
  return { ok: false, mensaje };
}

function tarjetaPosicion(p, tickerBA, abierta) {
  const recClase = claseRecomendacion(p.recomendacion);
  const movs = state.cartera[tickerBA] || [];
  return `
    <article class="pos-card">
      <header class="pos-header" data-action="toggle" data-ticker="${esc(tickerBA)}">
        <div>
          <div class="op-ticker">${esc(tickerBA)}</div>
          <div class="op-nombre">${esc(p.nombre || '')}</div>
        </div>
        <span class="badge ${recClase}">${esc(p.recomendacion)}</span>
      </header>
      <div class="pos-metrics">
        <div><span class="metric-label">Invertido</span><span class="metric-value">${ars(p.capitalInvertido)}</span></div>
        <div><span class="metric-label">Valor hoy</span><span class="metric-value">${ars(p.valorHoyTotal)}</span></div>
        <div><span class="metric-label">Ganancia</span><span class="metric-value ${signClass(p.gananciaCedear)}">${ars(p.gananciaCedear)}</span></div>
        <div><span class="metric-label">Vs. PF tradicional</span><span class="metric-value ${signClass(p.diferenciaPF)}">${ars(p.diferenciaPF)}</span></div>
        <div><span class="metric-label">Vs. PF UVA</span><span class="metric-value ${signClass(p.diferenciaPFUva)}">${ars(p.diferenciaPFUva)}</span></div>
        <div><span class="metric-label">Vs. S&P 500</span><span class="metric-value ${p.diferenciaBenchmark != null ? signClass(p.diferenciaBenchmark) : ''}">${p.diferenciaBenchmark != null ? ars(p.diferenciaBenchmark) : '—'}</span></div>
        <div><span class="metric-label">Potencial</span><span class="metric-value">${p.potencialPct != null ? pct(p.potencialPct) : '—'}</span></div>
      </div>
      ${abierta ? `
        <div class="pos-detail">
          <table class="mov-table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Precio</th><th></th></tr></thead>
            <tbody>${movs.map((m, i) => filaMovimiento(tickerBA, m, i)).join('')}</tbody>
          </table>
          ${formNuevoMovimiento(tickerBA)}
        </div>` : ''}
    </article>`;
}

function filaTotal(t) {
  return `
    <div class="pos-card pos-total">
      <div class="pos-header"><div class="op-ticker">TOTAL</div></div>
      <div class="pos-metrics">
        <div><span class="metric-label">Invertido</span><span class="metric-value">${ars(t.capitalInvertido)}</span></div>
        <div><span class="metric-label">Valor hoy</span><span class="metric-value">${ars(t.valorHoyTotal)}</span></div>
        <div><span class="metric-label">Ganancia</span><span class="metric-value ${signClass(t.gananciaCedear)}">${ars(t.gananciaCedear)}</span></div>
        <div><span class="metric-label">Vs. PF tradicional</span><span class="metric-value ${signClass(t.diferenciaPF)}">${ars(t.diferenciaPF)}</span></div>
        <div><span class="metric-label">Vs. PF UVA</span><span class="metric-value ${signClass(t.diferenciaPFUva)}">${ars(t.diferenciaPFUva)}</span></div>
        <div><span class="metric-label">Vs. S&P 500</span><span class="metric-value ${t.diferenciaBenchmark != null ? signClass(t.diferenciaBenchmark) : ''}">${t.diferenciaBenchmark != null ? ars(t.diferenciaBenchmark) : '—'}</span></div>
      </div>
    </div>`;
}

let tickerExpandido = null;
let agregandoTicker = false;

export function renderCartera(container, s) {
  const snap = s.snapshot;
  const posiciones = snap?.cartera?.posiciones || [];
  const total = snap?.cartera?.total;

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Cartera</h1>
        <p class="view-subtitle">Tus posiciones contra plazo fijo tradicional y plazo fijo UVA.</p>
      </div>
      <button class="btn-primary" id="btn-nuevo-ticker">+ Agregar ticker</button>
    </div>
    ${agregandoTicker ? `
      <form class="inline-form" id="form-nuevo-ticker">
        <input type="text" name="ticker" placeholder="Ticker (ej: AAPL o AAPL.BA)" required style="text-transform:uppercase" />
        <input type="date" name="fecha" required />
        <select name="tipo"><option value="compra">Compra</option><option value="venta">Venta</option></select>
        <input type="number" name="monto_ars" placeholder="Monto ARS" step="0.01" required />
        <input type="number" name="precio" placeholder="Precio (opcional)" step="0.01" />
        <button type="submit" class="btn-secondary">Crear</button>
        <span id="nuevo-ticker-status" class="save-status"></span>
      </form>` : ''}
    ${total ? filaTotal(total) : ''}
    <div class="pos-list">
      ${posiciones.length
        ? posiciones.map((p) => tarjetaPosicion(p, p.ticker, tickerExpandido === p.ticker)).join('')
        : `<p class="empty-inline">Todavía no cargaste movimientos, o los datos de precio se están descargando.</p>`}
    </div>
    ${renderGlosario(['costoPromedio', 'stopLossTakeProfit', 'potencial', 'plazoFijoTradicional', 'plazoFijoUva', 'sp500', 'comision'])}`;

  container.querySelector('#btn-nuevo-ticker').addEventListener('click', () => {
    agregandoTicker = !agregandoTicker;
    renderCartera(container, s);
  });

  const formNuevo = container.querySelector('#form-nuevo-ticker');
  if (formNuevo) {
    attachTickerAutocomplete(formNuevo.querySelector('[name="ticker"]'), null, { soloBue: true });

    formNuevo.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const status = formNuevo.querySelector('#nuevo-ticker-status');
      const btnSubmit = formNuevo.querySelector('button[type="submit"]');
      const fd = new FormData(formNuevo);
      const tickerBA = `${limpiarTickerBare(fd.get('ticker'))}.BA`;

      btnSubmit.disabled = true;
      status.style.color = '';
      status.textContent = 'Verificando el ticker…';
      const validacion = await window.api.validarTickerBA(tickerBA);
      btnSubmit.disabled = false;

      if (!validacion.ok) {
        status.style.color = 'var(--loss)';
        const sugerenciasBA = (validacion.sugerencias || []).filter((s) => s.exchange === 'BUE');
        status.textContent = sugerenciasBA.length
          ? `${tickerBA} no existe en Yahoo. ¿Quisiste decir ${sugerenciasBA.map((s) => s.symbol).join(' o ')}?`
          : `${tickerBA} no existe en Yahoo Finance. Revisá el símbolo.`;
        return;
      }

      const movSinPrecio = {
        fecha: fd.get('fecha'),
        tipo: fd.get('tipo'),
        monto_ars: Number(fd.get('monto_ars')),
        precio: fd.get('precio') ? Number(fd.get('precio')) : null,
      };

      btnSubmit.disabled = true;
      status.style.color = '';
      status.textContent = 'Resolviendo el precio…';
      const resuelto = await resolverPrecioSiFalta(tickerBA, movSinPrecio);
      btnSubmit.disabled = false;

      if (!resuelto.ok) {
        status.style.color = 'var(--loss)';
        status.textContent = resuelto.mensaje;
        return;
      }

      status.textContent = '';
      const nuevaCartera = { ...state.cartera, [tickerBA]: [...(state.cartera[tickerBA] || []), resuelto.mov] };
      agregandoTicker = false;
      await guardarCartera(nuevaCartera);
    });
  }

  container.querySelectorAll('[data-action="toggle"]').forEach((el) => {
    el.addEventListener('click', () => {
      const t = el.dataset.ticker;
      tickerExpandido = tickerExpandido === t ? null : t;
      renderCartera(container, s);
    });
  });

  container.querySelectorAll('[data-action="del-mov"]').forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const tickerBA = btn.dataset.ticker;
      const i = Number(btn.dataset.i);
      const mov = (state.cartera[tickerBA] || [])[i];
      const detalle = mov ? `${mov.tipo} del ${mov.fecha} por ${ars(mov.monto_ars)}` : 'este movimiento';
      if (!confirm(`¿Eliminar ${detalle}? No se puede deshacer.`)) return;
      const movs = [...(state.cartera[tickerBA] || [])];
      movs.splice(i, 1);
      const nuevaCartera = { ...state.cartera, [tickerBA]: movs };
      await guardarCartera(nuevaCartera);
    });
  });

  container.querySelectorAll('[data-action="add-mov"]').forEach((form) => {
    form.addEventListener('click', (ev) => ev.stopPropagation());
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const tickerBA = form.dataset.ticker;
      const status = form.querySelector('.add-mov-status');
      const btnSubmit = form.querySelector('button[type="submit"]');
      const fd = new FormData(form);
      const movSinPrecio = {
        fecha: fd.get('fecha'),
        tipo: fd.get('tipo'),
        monto_ars: Number(fd.get('monto_ars')),
        precio: fd.get('precio') ? Number(fd.get('precio')) : null,
      };

      btnSubmit.disabled = true;
      status.style.color = '';
      status.textContent = 'Resolviendo el precio…';
      const resuelto = await resolverPrecioSiFalta(tickerBA, movSinPrecio);
      btnSubmit.disabled = false;

      if (!resuelto.ok) {
        status.style.color = 'var(--loss)';
        status.textContent = resuelto.mensaje;
        return;
      }

      const nuevaCartera = { ...state.cartera, [tickerBA]: [...(state.cartera[tickerBA] || []), resuelto.mov] };
      await guardarCartera(nuevaCartera);
    });
  });
}

async function guardarCartera(nuevaCartera) {
  setState({ cartera: nuevaCartera });
  const snapshot = await window.api.saveCartera(nuevaCartera);
  const historial = await window.api.getHistorialCartera();
  setState({ snapshot, historial });
}
