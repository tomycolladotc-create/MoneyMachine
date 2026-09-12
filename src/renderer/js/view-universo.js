import { esc, limpiarTickerBare } from './format.js';
import { state, setState } from './state.js';
import { renderGlosario } from './glosario.js';
import { attachTickerAutocomplete } from './ticker-autocomplete.js';

let filtro = '';

function filaTicker(item) {
  return `
    <tr>
      <td class="mono">${esc(item.ticker)}</td>
      <td>${esc(item.sector)}</td>
      <td><button class="icon-btn" data-action="del-ticker" data-ticker="${esc(item.ticker)}" title="Sacar del universo">✕</button></td>
    </tr>`;
}

export function renderUniverso(container, s) {
  const universo = s.universo || [];
  const sectoresExistentes = [...new Set(universo.map((u) => u.sector))].sort();

  const filtrados = universo
    .filter((u) => !filtro || u.ticker.toLowerCase().includes(filtro) || u.sector.toLowerCase().includes(filtro))
    .sort((a, b) => a.sector.localeCompare(b.sector) || a.ticker.localeCompare(b.ticker));

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Universo</h1>
        <p class="view-subtitle">Los tickers que se escanean para armar el ranking de Oportunidades. ${universo.length} en total.</p>
      </div>
    </div>

    <form class="inline-form" id="form-agregar-ticker">
      <input type="text" name="ticker" placeholder="Ticker (ej: AAPL o AAPL.BA)" required style="text-transform:uppercase" />
      <input type="text" name="sector" placeholder="Sector" list="sectores-existentes" required />
      <datalist id="sectores-existentes">${sectoresExistentes.map((sec) => `<option value="${esc(sec)}"></option>`).join('')}</datalist>
      <button type="submit" class="btn-primary">+ Agregar</button>
      <span id="nuevo-ticker-status" class="save-status"></span>
    </form>
    <p class="hint">Los cambios se aplican recién en el próximo refresco (manual o automático), no hace falta reiniciar la app.</p>

    <input type="search" id="buscador-universo" class="search-input" placeholder="Buscar por ticker o sector…" value="${esc(filtro)}" />

    <div class="table-scroll">
      <table class="mov-table universo-table">
        <thead><tr><th>Ticker</th><th>Sector</th><th></th></tr></thead>
        <tbody>${filtrados.map(filaTicker).join('') || '<tr><td colspan="3" class="empty-inline">Sin resultados para ese filtro.</td></tr>'}</tbody>
      </table>
    </div>
    ${renderGlosario(['cedear'])}`;

  container.querySelector('#buscador-universo').addEventListener('input', (ev) => {
    filtro = ev.target.value.trim().toLowerCase();
    renderUniverso(container, s);
  });

  const formAgregar = container.querySelector('#form-agregar-ticker');
  attachTickerAutocomplete(formAgregar.querySelector('[name="ticker"]'), null, { soloBue: true });

  formAgregar.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const status = formAgregar.querySelector('#nuevo-ticker-status');
    const btnSubmit = formAgregar.querySelector('button[type="submit"]');
    const fd = new FormData(ev.target);
    const ticker = limpiarTickerBare(fd.get('ticker'));
    const sector = fd.get('sector').trim();
    if (!ticker || !sector) return;
    if (universo.some((u) => u.ticker === ticker)) {
      status.style.color = 'var(--loss)';
      status.textContent = `${ticker} ya está en el universo.`;
      return;
    }

    btnSubmit.disabled = true;
    status.style.color = '';
    status.textContent = 'Verificando el ticker…';
    const validacion = await window.api.validarTickerBA(`${ticker}.BA`);
    btnSubmit.disabled = false;

    if (!validacion.ok) {
      status.style.color = 'var(--loss)';
      const sugerenciasBA = (validacion.sugerencias || []).filter((s) => s.exchange === 'BUE');
      status.textContent = sugerenciasBA.length
        ? `${ticker}.BA no existe en Yahoo. ¿Quisiste decir ${sugerenciasBA.map((s) => s.symbol).join(' o ')}?`
        : `${ticker}.BA no existe en Yahoo Finance. Revisá el símbolo.`;
      return;
    }

    status.textContent = '';
    const nuevo = [...universo, { ticker, sector }];
    await guardarUniverso(nuevo);
  });

  container.querySelectorAll('[data-action="del-ticker"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nuevo = universo.filter((u) => u.ticker !== btn.dataset.ticker);
      await guardarUniverso(nuevo);
    });
  });
}

async function guardarUniverso(nuevoUniverso) {
  setState({ universo: nuevoUniverso });
  await window.api.saveUniverso(nuevoUniverso);
}
