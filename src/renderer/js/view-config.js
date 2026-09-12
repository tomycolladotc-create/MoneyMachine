import { esc } from './format.js';
import { setState } from './state.js';
import { renderGlosario } from './glosario.js';
import { t } from './i18n.js';

function nombreMes(claveAnioMes) {
  const [anio, mes] = claveAnioMes.split('-').map(Number);
  return `${t('config.meses')[mes - 1]} ${anio}`;
}

function mesActualISO() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function renderInflacionKpis(c) {
  const meses = Object.entries(c.INFLACION_MENSUAL).sort(([a], [b]) => a.localeCompare(b));
  if (meses.length === 0) return `<p class="empty-inline">${t('config.sinDatoIndec')}</p>`;

  const [ultimoMesClave, ultimoMesValor] = meses[meses.length - 1];
  const mesActual = mesActualISO();
  const yaPublicado = mesActual in c.INFLACION_MENSUAL;

  let html = `
    <div class="kpi">
      <div class="kpi-label">${t('config.ultimoDatoPublicado', { mes: esc(nombreMes(ultimoMesClave)) })}</div>
      <div class="kpi-value">${(ultimoMesValor * 100).toFixed(2)}%</div>
    </div>`;
  if (!yaPublicado) {
    html += `
    <div class="kpi">
      <div class="kpi-label">${t('config.estimadoPara', { mes: esc(nombreMes(mesActual)) })}</div>
      <div class="kpi-value">${(c.INFLACION_MENSUAL_ESTIMADA_DEFAULT * 100).toFixed(2)}%</div>
    </div>`;
  }
  return html;
}

export function renderConfig(container, state) {
  const c = state.config;
  if (!c) {
    container.innerHTML = `<p class="empty-inline">${t('config.cargandoConfig')}</p>`;
    return;
  }

  // Si el formulario ya está en pantalla, no lo reconstruyas: perdería el
  // foco y cualquier cambio recién tipeado. Esto pasa muy seguido porque
  // cualquier cosa de fondo (refresco automático, guardado automático de acá
  // mismo) dispara un re-render global. Solo se reconstruye de cero cuando
  // se navega a esta pantalla desde otra.
  if (container.querySelector('#form-config')) return;

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>${t('nav.config')}</h1>
        <p class="view-subtitle">${t('config.subtitulo')}</p>
      </div>
    </div>
    <form id="form-config" class="config-form">
      <section class="panel">
        <h2>${t('config.seccionIdioma')}</h2>
        <div class="field-grid">
          <label>${t('config.idioma')}
            <select name="IDIOMA" id="select-idioma">
              <option value="es" ${(c.IDIOMA || 'es') === 'es' ? 'selected' : ''}>${t('config.espanol')}</option>
              <option value="en" ${c.IDIOMA === 'en' ? 'selected' : ''}>${t('config.ingles')}</option>
            </select>
          </label>
        </div>
      </section>

      <section class="panel">
        <h2>${t('config.seccionCartera')}</h2>
        <div class="field-grid">
          <label>${t('config.stopLoss')}<input type="number" name="STOP_LOSS_PCT" value="${c.STOP_LOSS_PCT}" step="0.1" /></label>
          <label>${t('config.takeProfit')}<input type="number" name="TAKE_PROFIT_PCT" value="${c.TAKE_PROFIT_PCT}" step="0.1" /></label>
          <label>${t('config.comisionBroker')}<input type="number" name="COMISION_PCT" value="${c.COMISION_PCT * 100}" step="0.01" /></label>
        </div>
      </section>

      <section class="panel">
        <h2>${t('config.seccionPlazosFijos')}</h2>
        <div class="field-grid">
          <label>${t('config.tasaPfTradicional')}<input type="number" name="TASA_PF_ANUAL" value="${c.TASA_PF_ANUAL * 100}" step="0.1" /></label>
          <label>${t('config.plusPfUva')}<input type="number" name="TASA_PF_UVA_PLUS_ANUAL" value="${c.TASA_PF_UVA_PLUS_ANUAL * 100}" step="0.1" /></label>
        </div>
      </section>

      <section class="panel">
        <h2>${t('config.seccionRanking')}</h2>
        <div class="field-grid">
          <label>${t('config.minAnalistas')}<input type="number" name="MIN_ANALISTAS_RANKING" value="${c.MIN_ANALISTAS_RANKING}" step="1" /></label>
          <label>${t('config.potencialMinimo')}<input type="number" name="MIN_POTENCIAL_RANKING" value="${c.MIN_POTENCIAL_RANKING}" step="0.1" /></label>
        </div>
      </section>

      <section class="panel">
        <h2>${t('config.seccionActualizacion')}</h2>
        <div class="field-grid">
          <label>${t('config.autoRefresco')}<input type="number" name="AUTO_REFRESH_MIN" value="${c.AUTO_REFRESH_MIN}" step="1" min="1" /></label>
          <label>${t('config.pausaTandas')}<input type="number" name="SLEEP_SEC" value="${c.SLEEP_SEC}" step="0.05" min="0" /></label>
        </div>
        <label class="check-row" style="margin-top:14px; padding-left:0;">
          <input type="checkbox" name="NOTIFICACIONES_ACTIVADAS" ${c.NOTIFICACIONES_ACTIVADAS ? 'checked' : ''} />
          <span>${t('config.avisosEscritorio')}</span>
        </label>
      </section>

      <section class="panel">
        <h2>${t('config.seccionResumenMail')}</h2>
        <p class="hint">${t('config.hintResumenMail')}</p>
        <label class="check-row" style="padding-left:0;">
          <input type="checkbox" name="RESUMEN_EMAIL_ACTIVADO" ${c.RESUMEN_EMAIL_ACTIVADO ? 'checked' : ''} />
          <span>${t('config.activarResumenMail')}</span>
        </label>
        <div class="field-grid" style="margin-top:14px">
          <label>${t('config.frecuencia')}
            <select name="RESUMEN_EMAIL_FRECUENCIA">
              <option value="diario" ${c.RESUMEN_EMAIL_FRECUENCIA === 'diario' ? 'selected' : ''}>${t('config.diario')}</option>
              <option value="semanal" ${c.RESUMEN_EMAIL_FRECUENCIA === 'semanal' ? 'selected' : ''}>${t('config.semanal')}</option>
              <option value="mensual" ${c.RESUMEN_EMAIL_FRECUENCIA === 'mensual' ? 'selected' : ''}>${t('config.mensual')}</option>
            </select>
          </label>
          <label>${t('config.horaEnvio')}
            <input type="time" name="RESUMEN_EMAIL_HORA" value="${esc(c.RESUMEN_EMAIL_HORA)}" />
          </label>
          <label>${t('config.servidorSmtp')}
            <input type="text" name="RESUMEN_EMAIL_SMTP_HOST" value="${esc(c.RESUMEN_EMAIL_SMTP_HOST)}" placeholder="smtp.gmail.com" />
          </label>
          <label>${t('config.puertoSmtp')}
            <input type="number" name="RESUMEN_EMAIL_SMTP_PORT" value="${c.RESUMEN_EMAIL_SMTP_PORT}" placeholder="587" />
          </label>
          <label>${t('config.tuMail')}
            <input type="email" name="RESUMEN_EMAIL_USUARIO" value="${esc(c.RESUMEN_EMAIL_USUARIO)}" placeholder="vos@gmail.com" />
          </label>
          <label>${t('config.contrasenaApp')}
            <input type="password" name="RESUMEN_EMAIL_PASSWORD" value="${esc(c.RESUMEN_EMAIL_PASSWORD)}" placeholder="xxxx xxxx xxxx xxxx" />
          </label>
          <label>${t('config.mailDestino')}
            <input type="email" name="RESUMEN_EMAIL_DESTINATARIO" value="${esc(c.RESUMEN_EMAIL_DESTINATARIO)}" placeholder="vos@gmail.com" />
          </label>
        </div>
        <div class="form-actions" style="margin-top:14px">
          <button type="button" class="btn-secondary" id="btn-probar-email">${t('config.enviarPrueba')}</button>
          <span id="email-status" class="save-status"></span>
        </div>
        <p class="hint">${t('config.hintFrecuencia')}</p>
      </section>

      <section class="panel">
        <h2>${t('config.seccionInflacion')}</h2>
        <p class="hint">${t('config.hintInflacion')}</p>
        <div class="kpi-grid" id="inflacion-kpis" style="margin-bottom:14px">${renderInflacionKpis(c)}</div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" id="btn-actualizar-indec">${t('config.actualizarIndec')}</button>
          <span id="indec-status" class="save-status"></span>
        </div>
      </section>

      <div class="form-actions">
        <button type="submit" class="btn-primary">${t('config.guardarAhora')}</button>
        <span id="config-status" class="save-status"></span>
      </div>
      <p class="hint">${t('config.hintGuardado')}</p>
    </form>
    ${renderGlosario(['stopLossTakeProfit', 'comision', 'plazoFijoTradicional', 'plazoFijoUva', 'potencial'])}`;

  container.querySelector('#btn-actualizar-indec').addEventListener('click', async (ev) => {
    const btn = ev.target;
    const status = container.querySelector('#indec-status');
    btn.disabled = true;
    status.style.color = '';
    status.textContent = t('config.consultandoIndec');

    const resultado = await window.api.actualizarInflacionIndec();
    btn.disabled = false;

    if (!resultado.ok) {
      status.style.color = 'var(--loss)';
      status.textContent = t('config.noSePudoActualizar', { error: resultado.error });
      return;
    }

    state.config = resultado.config; // silencioso, no dispara un re-render
    container.querySelector('#inflacion-kpis').innerHTML = renderInflacionKpis(resultado.config);

    const ultimoMes = Object.keys(resultado.config.INFLACION_MENSUAL).sort().pop();
    status.style.color = 'var(--gain)';
    status.textContent = t('config.actualizadoUltimoMes', { mes: ultimoMes ?? '—' });
  });

  // Arma el config completo a partir de lo que hay tipeado AHORA en el
  // formulario (no solo lo ya guardado) — lo usan tanto "Guardar" como
  // "Enviar de prueba", para que probar el mail también deje persistido todo
  // lo demás que hayas tocado y una actualización de fondo no te lo borre.
  // La inflación no se lee del formulario porque ya no es editable ahí: la
  // trae y la aplica sola "Actualizar desde INDEC ahora" (y cada refresco).
  function leerConfigDelFormulario() {
    const fd = new FormData(container.querySelector('#form-config'));

    return {
      ...c,
      IDIOMA: fd.get('IDIOMA') || 'es',
      STOP_LOSS_PCT: Number(fd.get('STOP_LOSS_PCT')),
      TAKE_PROFIT_PCT: Number(fd.get('TAKE_PROFIT_PCT')),
      COMISION_PCT: Number(fd.get('COMISION_PCT')) / 100,
      TASA_PF_ANUAL: Number(fd.get('TASA_PF_ANUAL')) / 100,
      TASA_PF_UVA_PLUS_ANUAL: Number(fd.get('TASA_PF_UVA_PLUS_ANUAL')) / 100,
      MIN_ANALISTAS_RANKING: Number(fd.get('MIN_ANALISTAS_RANKING')),
      MIN_POTENCIAL_RANKING: Number(fd.get('MIN_POTENCIAL_RANKING')),
      AUTO_REFRESH_MIN: Number(fd.get('AUTO_REFRESH_MIN')),
      SLEEP_SEC: Number(fd.get('SLEEP_SEC')),
      NOTIFICACIONES_ACTIVADAS: fd.get('NOTIFICACIONES_ACTIVADAS') != null,
      RESUMEN_EMAIL_ACTIVADO: fd.get('RESUMEN_EMAIL_ACTIVADO') != null,
      RESUMEN_EMAIL_FRECUENCIA: fd.get('RESUMEN_EMAIL_FRECUENCIA'),
      RESUMEN_EMAIL_HORA: fd.get('RESUMEN_EMAIL_HORA') || '09:00',
      RESUMEN_EMAIL_SMTP_HOST: fd.get('RESUMEN_EMAIL_SMTP_HOST').trim(),
      RESUMEN_EMAIL_SMTP_PORT: Number(fd.get('RESUMEN_EMAIL_SMTP_PORT')) || 587,
      RESUMEN_EMAIL_USUARIO: fd.get('RESUMEN_EMAIL_USUARIO').trim(),
      RESUMEN_EMAIL_PASSWORD: fd.get('RESUMEN_EMAIL_PASSWORD'),
      RESUMEN_EMAIL_DESTINATARIO: fd.get('RESUMEN_EMAIL_DESTINATARIO').trim(),
    };
  }

  // Guardado automático: cada cambio (tipear, tildar un check, elegir en un
  // select) se persiste solo, sin depender de que el usuario recuerde apretar
  // "Guardar". Debounced para no escribir en disco en cada tecla.
  let autoGuardarTimer = null;
  const configStatus = container.querySelector('#config-status');
  function autoGuardar() {
    clearTimeout(autoGuardarTimer);
    autoGuardarTimer = setTimeout(async () => {
      const guardado = await window.api.saveConfig(leerConfigDelFormulario());
      state.config = guardado; // se actualiza sin disparar un re-render (ver arriba)
      if (configStatus) {
        configStatus.textContent = t('config.guardado');
        setTimeout(() => { if (configStatus) configStatus.textContent = ''; }, 1500);
      }
    }, 500);
  }
  container.querySelector('#form-config').addEventListener('input', autoGuardar);
  container.querySelector('#form-config').addEventListener('change', autoGuardar);

  // El idioma es la única opción que necesita un re-render completo apenas
  // cambia (todo el texto de la app depende de él) — por eso, a diferencia del
  // resto del formulario, se guarda y aplica al toque en vez de esperar el
  // guardado silencioso de autoGuardar().
  container.querySelector('#select-idioma').addEventListener('change', async () => {
    const guardado = await window.api.saveConfig(leerConfigDelFormulario());
    setState({ config: guardado });
  });

  container.querySelector('#btn-probar-email').addEventListener('click', async (ev) => {
    const btn = ev.target;
    const status = container.querySelector('#email-status');
    const configActual = leerConfigDelFormulario();

    if (!configActual.RESUMEN_EMAIL_USUARIO || !configActual.RESUMEN_EMAIL_PASSWORD || !configActual.RESUMEN_EMAIL_DESTINATARIO) {
      status.style.color = 'var(--loss)';
      status.textContent = t('config.completaMailPrimero');
      return;
    }

    btn.disabled = true;
    status.style.color = '';
    status.textContent = t('config.guardandoYEnviando');
    // Se guarda antes de probar: así lo que ya tipeaste no se pierde si en el
    // medio termina un auto-refresco de fondo y se vuelve a dibujar la pantalla.
    const guardado = await window.api.saveConfig(configActual);
    setState({ config: guardado });
    const resultado = await window.api.probarResumenEmail(configActual);
    btn.disabled = false;
    if (resultado.ok) {
      status.style.color = 'var(--gain)';
      status.textContent = t('config.guardadoYEnviado');
    } else {
      status.style.color = 'var(--loss)';
      status.textContent = t('config.guardadoConError', { error: resultado.error });
    }
  });

  container.querySelector('#form-config').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const guardado = await window.api.saveConfig(leerConfigDelFormulario());
    setState({ config: guardado });
    const status = container.querySelector('#config-status');
    status.textContent = t('config.guardado');
    setTimeout(() => { if (status) status.textContent = ''; }, 2500);
  });
}
