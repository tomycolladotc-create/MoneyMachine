import { esc, limpiarTickerBare } from './format.js';
import { state, setState } from './state.js';
import { renderGlosario } from './glosario.js';
import { attachTickerAutocomplete } from './ticker-autocomplete.js';
import { t, traducirTipoActivo, claseChipTipo } from './i18n.js';
import { ACCIONES_POPULARES } from './acciones-populares.js';
import { CRIPTOS_POPULARES } from './criptos-populares.js';

let filtro = '';
let tipoNuevo = 'CEDEAR'; // tipo elegido en el form de "agregar ticker", se mantiene entre re-renders

function tipo(item) {
  if (item.tipo === 'ACCION' || item.tipo === 'CRYPTO') return item.tipo;
  return 'CEDEAR'; // entradas viejas sin `tipo` son CEDEARs
}

function filaTicker(item) {
  return `
    <tr>
      <td class="mono">${esc(item.ticker)}</td>
      <td>${esc(item.sector)}</td>
      <td><span class="chip ${claseChipTipo(tipo(item))}">${esc(traducirTipoActivo(tipo(item)))}</span></td>
      <td><button class="icon-btn" data-action="del-ticker" data-ticker="${esc(item.ticker)}" data-tipo="${tipo(item)}" title="${t('universo.sacarDelUniverso')}">✕</button></td>
    </tr>`;
}

const PLACEHOLDER_POR_TIPO = {
  CEDEAR: 'universo.tickerPlaceholder',
  ACCION: 'universo.tickerPlaceholderAccion',
  CRYPTO: 'universo.tickerPlaceholderCripto',
};

const POPULARES_POR_TIPO = { ACCION: ACCIONES_POPULARES, CRYPTO: CRIPTOS_POPULARES };
const BOTON_TRAER_POR_TIPO = { ACCION: 'universo.traerAccionesPopulares', CRYPTO: 'universo.traerCriptosPopulares' };

export function renderUniverso(container, s) {
  const universo = s.universo || [];
  const sectoresExistentes = [...new Set(universo.map((u) => u.sector))].sort();
  const esCedearNuevo = tipoNuevo === 'CEDEAR';

  const filtrados = universo
    .filter((u) => !filtro || u.ticker.toLowerCase().includes(filtro) || u.sector.toLowerCase().includes(filtro))
    .sort((a, b) => a.sector.localeCompare(b.sector) || a.ticker.localeCompare(b.ticker));

  const popularesNuevo = POPULARES_POR_TIPO[tipoNuevo];

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>${t('nav.universo')}</h1>
        <p class="view-subtitle">${t('universo.subtitulo', { n: universo.length })}</p>
      </div>
    </div>

    <form class="inline-form" id="form-agregar-ticker">
      <label class="tipo-radio"><input type="radio" name="tipoNuevo" value="CEDEAR" ${tipoNuevo === 'CEDEAR' ? 'checked' : ''} /> ${t('common.cedear')}</label>
      <label class="tipo-radio"><input type="radio" name="tipoNuevo" value="ACCION" ${tipoNuevo === 'ACCION' ? 'checked' : ''} /> ${t('common.accion')}</label>
      <label class="tipo-radio"><input type="radio" name="tipoNuevo" value="CRYPTO" ${tipoNuevo === 'CRYPTO' ? 'checked' : ''} /> ${t('common.cripto')}</label>
      <input type="text" name="ticker" placeholder="${t(PLACEHOLDER_POR_TIPO[tipoNuevo])}" required style="text-transform:uppercase" />
      <input type="text" name="sector" placeholder="${t('universo.sectorPlaceholder')}" list="sectores-existentes" required />
      <datalist id="sectores-existentes">${sectoresExistentes.map((sec) => `<option value="${esc(sec)}"></option>`).join('')}</datalist>
      <button type="submit" class="btn-primary">${t('universo.agregar')}</button>
      <span id="nuevo-ticker-status" class="save-status"></span>
    </form>
    <p class="hint">${t('universo.hintCambios')}</p>
    ${popularesNuevo ? `
      <div class="form-actions" style="margin-top:-4px; margin-bottom:14px">
        <button type="button" class="btn-secondary" id="btn-traer-populares">${t(BOTON_TRAER_POR_TIPO[tipoNuevo])}</button>
        <span id="traer-populares-status" class="save-status"></span>
      </div>` : ''}

    <input type="search" id="buscador-universo" class="search-input" placeholder="${t('universo.buscarPlaceholder')}" value="${esc(filtro)}" />

    <div class="table-scroll">
      <table class="mov-table universo-table">
        <thead><tr><th>${t('universo.ticker')}</th><th>${t('universo.sector')}</th><th>${t('universo.tipo')}</th><th></th></tr></thead>
        <tbody>${filtrados.map(filaTicker).join('') || `<tr><td colspan="4" class="empty-inline">${t('universo.sinResultados')}</td></tr>`}</tbody>
      </table>
    </div>
    ${renderGlosario(['cedear', 'accionWallStreet', 'cripto'])}`;

  container.querySelector('#buscador-universo').addEventListener('input', (ev) => {
    filtro = ev.target.value.trim().toLowerCase();
    renderUniverso(container, s);
  });

  container.querySelectorAll('input[name="tipoNuevo"]').forEach((radio) => {
    radio.addEventListener('change', (ev) => {
      tipoNuevo = ev.target.value;
      renderUniverso(container, s);
    });
  });

  const formAgregar = container.querySelector('#form-agregar-ticker');
  attachTickerAutocomplete(formAgregar.querySelector('[name="ticker"]'), null, { soloBue: esCedearNuevo });

  formAgregar.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const status = formAgregar.querySelector('#nuevo-ticker-status');
    const btnSubmit = formAgregar.querySelector('button[type="submit"]');
    const fd = new FormData(ev.target);
    const ticker = limpiarTickerBare(fd.get('ticker'));
    const sector = fd.get('sector').trim();
    if (!ticker || !sector) return;
    if (universo.some((u) => u.ticker === ticker && tipo(u) === tipoNuevo)) {
      status.style.color = 'var(--loss)';
      status.textContent = t('universo.yaExiste', { ticker });
      return;
    }

    const simboloAValidar = esCedearNuevo ? `${ticker}.BA` : ticker;
    btnSubmit.disabled = true;
    status.style.color = '';
    status.textContent = t('cartera.verificandoTicker');
    const validacion = await window.api.validarTickerBA(simboloAValidar);
    btnSubmit.disabled = false;

    if (!validacion.ok) {
      status.style.color = 'var(--loss)';
      const sugerencias = esCedearNuevo
        ? (validacion.sugerencias || []).filter((sg) => sg.exchange === 'BUE')
        : (validacion.sugerencias || []);
      status.textContent = sugerencias.length
        ? t('cartera.tickerNoExisteConSugerencia', { ticker: simboloAValidar, sugerencias: sugerencias.map((sg) => sg.symbol).join(' o ') })
        : t('cartera.tickerNoExiste', { ticker: simboloAValidar });
      return;
    }

    status.textContent = '';
    const nuevo = [...universo, { ticker, sector, tipo: tipoNuevo }];
    await guardarUniverso(nuevo);
  });

  const btnTraerPopulares = container.querySelector('#btn-traer-populares');
  if (btnTraerPopulares && popularesNuevo) {
    btnTraerPopulares.addEventListener('click', async () => {
      const status = container.querySelector('#traer-populares-status');
      const yaPresentes = new Set(universo.filter((u) => tipo(u) === tipoNuevo).map((u) => u.ticker));
      const aAgregar = popularesNuevo.filter((a) => !yaPresentes.has(a.ticker));
      if (aAgregar.length === 0) {
        status.textContent = t('universo.todasYaAgregadas');
        return;
      }
      btnTraerPopulares.disabled = true;
      // guardarUniverso dispara un re-render completo de esta vista de
      // inmediato (ver setState más abajo), así que cualquier mensaje de
      // "listo" puesto después quedaría escrito en un nodo ya reemplazado y
      // nunca se vería — la confirmación visible es la tabla creciendo sola.
      const nuevo = [...universo, ...aAgregar.map((a) => ({ ticker: a.ticker, sector: a.sector, tipo: tipoNuevo }))];
      await guardarUniverso(nuevo);
    });
  }

  container.querySelectorAll('[data-action="del-ticker"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nuevo = universo.filter((u) => !(u.ticker === btn.dataset.ticker && tipo(u) === btn.dataset.tipo));
      await guardarUniverso(nuevo);
    });
  });
}

async function guardarUniverso(nuevoUniverso) {
  setState({ universo: nuevoUniverso });
  await window.api.saveUniverso(nuevoUniverso);
}
