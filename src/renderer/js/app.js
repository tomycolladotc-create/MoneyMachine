import { state, setState, subscribe } from './state.js';
import { renderResumen } from './view-resumen.js';
import { renderOportunidades } from './view-oportunidades.js';
import { renderCartera } from './view-cartera.js';
import { renderSimulador } from './view-simulador.js';
import { renderUniverso } from './view-universo.js';
import { renderConfig } from './view-config.js';
import { relativeTime } from './format.js';
import { t } from './i18n.js';

const viewContainer = document.getElementById('view-container');
const btnRefresh = document.getElementById('btn-refresh');
const refreshLabel = document.getElementById('refresh-label');
const railUpdated = document.getElementById('rail-updated');
const progressTrack = document.getElementById('progress-track');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');

const VISTAS = {
  resumen: renderResumen,
  oportunidades: renderOportunidades,
  cartera: renderCartera,
  simulador: renderSimulador,
  universo: renderUniverso,
  config: renderConfig,
};

// Configuración es un formulario que se puede estar editando sin haber
// guardado todavía: si se la re-dibuja cada vez que pasa cualquier cosa de
// fondo (un refresco automático, el tick del reloj cada 30s), se pierde lo
// que el usuario tenía tipeado sin guardar. Por eso esta vista solo se vuelve
// a dibujar cuando el usuario entra a ella o cuando `state.config` cambia de
// verdad (lo cual solo pasa al guardar, nunca por un refresco de cartera).
let ultimaVistaRenderizada = null;
let ultimoConfigRenderizado = null;

function render() {
  document.querySelectorAll('.rail-item').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.vista === state.vista);
    const label = btn.querySelector('span');
    if (label) label.textContent = t(`nav.${btn.dataset.vista}`);
  });

  const cambioDeVista = state.vista !== ultimaVistaRenderizada;
  if (state.vista === 'config') {
    if (cambioDeVista || state.config !== ultimoConfigRenderizado) {
      VISTAS.config(viewContainer, state);
      ultimoConfigRenderizado = state.config;
    }
  } else {
    VISTAS[state.vista](viewContainer, state);
  }
  ultimaVistaRenderizada = state.vista;

  railUpdated.textContent = state.snapshot ? t('rail.actualizado', { tiempo: relativeTime(state.snapshot.timestamp) }) : t('rail.sinDatos');
  btnRefresh.disabled = state.refrescando;
  refreshLabel.textContent = state.refrescando ? t('rail.actualizando') : t('rail.refrescar');
}

subscribe(render);

document.querySelectorAll('.rail-item').forEach((btn) => {
  btn.addEventListener('click', () => setState({ vista: btn.dataset.vista }));
});

btnRefresh.addEventListener('click', async () => {
  if (state.refrescando) return;
  setState({ refrescando: true });
  try {
    const snapshot = await window.api.refresh();
    const historial = await window.api.getHistorialCartera();
    setState({ snapshot, historial });
  } finally {
    setState({ refrescando: false });
    progressTrack.hidden = true;
    progressLabel.textContent = '';
  }
});

window.api.onRefreshProgress((p) => {
  if (p.etapa === 'universo' && p.total > 0) {
    progressTrack.hidden = false;
    progressFill.style.width = `${(p.done / p.total) * 100}%`;
    progressLabel.textContent = t('rail.consultando', { ticker: p.ticker, done: p.done, total: p.total });
  } else if (p.etapa === 'cartera') {
    progressLabel.textContent = t('rail.recalculando');
  } else if (p.etapa === 'listo') {
    progressTrack.hidden = true;
    progressLabel.textContent = '';
    Promise.all([window.api.getSnapshot(), window.api.getHistorialCartera()])
      .then(([snapshot, historial]) => setState({ snapshot, historial }));
  } else if (p.etapa === 'error') {
    progressLabel.textContent = t('rail.error', { mensaje: p.mensaje });
  }
});

(async () => {
  const [snapshot, config, cartera, universo, historial] = await Promise.all([
    window.api.getSnapshot(),
    window.api.getConfig(),
    window.api.getCartera(),
    window.api.getUniverso(),
    window.api.getHistorialCartera(),
  ]);
  setState({ snapshot, config, cartera, universo, historial });

  // si nunca hubo un refresco todavia, el proceso main ya dispara uno solo al
  // arrancar la app; acá solo mantenemos el reloj de "actualizado hace..." fresco.
  setInterval(() => setState({}), 30000);
})();
