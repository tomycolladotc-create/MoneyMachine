import { esc } from './format.js';
import { setState } from './state.js';
import { renderGlosario } from './glosario.js';

const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function nombreMes(claveAnioMes) {
  const [anio, mes] = claveAnioMes.split('-').map(Number);
  return `${NOMBRES_MES[mes - 1]} ${anio}`;
}

function mesActualISO() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function renderInflacionKpis(c) {
  const meses = Object.entries(c.INFLACION_MENSUAL).sort(([a], [b]) => a.localeCompare(b));
  if (meses.length === 0) return `<p class="empty-inline">Todavía no se pudo traer ningún dato de INDEC.</p>`;

  const [ultimoMesClave, ultimoMesValor] = meses[meses.length - 1];
  const mesActual = mesActualISO();
  const yaPublicado = mesActual in c.INFLACION_MENSUAL;

  let html = `
    <div class="kpi">
      <div class="kpi-label">Último dato publicado (${esc(nombreMes(ultimoMesClave))})</div>
      <div class="kpi-value">${(ultimoMesValor * 100).toFixed(2)}%</div>
    </div>`;
  if (!yaPublicado) {
    html += `
    <div class="kpi">
      <div class="kpi-label">Estimado para ${esc(nombreMes(mesActual))} (INDEC todavía no lo publicó)</div>
      <div class="kpi-value">${(c.INFLACION_MENSUAL_ESTIMADA_DEFAULT * 100).toFixed(2)}%</div>
    </div>`;
  }
  return html;
}

export function renderConfig(container, state) {
  const c = state.config;
  if (!c) {
    container.innerHTML = `<p class="empty-inline">Cargando configuración…</p>`;
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
        <h1>Configuración</h1>
        <p class="view-subtitle">Tasas, umbrales e inflación mensual. Se guarda solo, en tu disco, apenas cambiás algo — no hace falta apretar nada.</p>
      </div>
    </div>
    <form id="form-config" class="config-form">
      <section class="panel">
        <h2>Cartera</h2>
        <div class="field-grid">
          <label>Stop loss (%)<input type="number" name="STOP_LOSS_PCT" value="${c.STOP_LOSS_PCT}" step="0.1" /></label>
          <label>Take profit (%)<input type="number" name="TAKE_PROFIT_PCT" value="${c.TAKE_PROFIT_PCT}" step="0.1" /></label>
          <label>Comisión broker (%)<input type="number" name="COMISION_PCT" value="${c.COMISION_PCT * 100}" step="0.01" /></label>
        </div>
      </section>

      <section class="panel">
        <h2>Plazos fijos</h2>
        <div class="field-grid">
          <label>Tasa plazo fijo tradicional (% anual)<input type="number" name="TASA_PF_ANUAL" value="${c.TASA_PF_ANUAL * 100}" step="0.1" /></label>
          <label>Plus plazo fijo UVA (% anual)<input type="number" name="TASA_PF_UVA_PLUS_ANUAL" value="${c.TASA_PF_UVA_PLUS_ANUAL * 100}" step="0.1" /></label>
        </div>
      </section>

      <section class="panel">
        <h2>Ranking de oportunidades</h2>
        <div class="field-grid">
          <label>Mínimo de analistas<input type="number" name="MIN_ANALISTAS_RANKING" value="${c.MIN_ANALISTAS_RANKING}" step="1" /></label>
          <label>Potencial mínimo (%)<input type="number" name="MIN_POTENCIAL_RANKING" value="${c.MIN_POTENCIAL_RANKING}" step="0.1" /></label>
        </div>
      </section>

      <section class="panel">
        <h2>Actualización</h2>
        <div class="field-grid">
          <label>Auto-refresco (minutos)<input type="number" name="AUTO_REFRESH_MIN" value="${c.AUTO_REFRESH_MIN}" step="1" min="1" /></label>
          <label>Pausa entre tandas de tickers a Yahoo (segundos)<input type="number" name="SLEEP_SEC" value="${c.SLEEP_SEC}" step="0.05" min="0" /></label>
        </div>
        <label class="check-row" style="margin-top:14px; padding-left:0;">
          <input type="checkbox" name="NOTIFICACIONES_ACTIVADAS" ${c.NOTIFICACIONES_ACTIVADAS ? 'checked' : ''} />
          <span>Avisos de escritorio (posiciones que tocan Stop Loss/Take Profit, nuevas oportunidades de "Comprar ahora")</span>
        </label>
      </section>

      <section class="panel">
        <h2>Resumen por mail</h2>
        <p class="hint">
          Se manda por SMTP desde tu propia cuenta de mail, sin depender de ningún tercero. Con Gmail: activá la verificación en dos pasos en tu cuenta de Google, después andá a <strong>myaccount.google.com/apppasswords</strong> y generá una "contraseña de aplicación" — usá esa contraseña acá abajo (no la de tu cuenta normal). Si usás otro proveedor de mail, cambiá el servidor y puerto SMTP por los suyos.
        </p>
        <label class="check-row" style="padding-left:0;">
          <input type="checkbox" name="RESUMEN_EMAIL_ACTIVADO" ${c.RESUMEN_EMAIL_ACTIVADO ? 'checked' : ''} />
          <span>Activar resumen periódico por mail</span>
        </label>
        <div class="field-grid" style="margin-top:14px">
          <label>Frecuencia
            <select name="RESUMEN_EMAIL_FRECUENCIA">
              <option value="diario" ${c.RESUMEN_EMAIL_FRECUENCIA === 'diario' ? 'selected' : ''}>Diario</option>
              <option value="semanal" ${c.RESUMEN_EMAIL_FRECUENCIA === 'semanal' ? 'selected' : ''}>Semanal</option>
              <option value="mensual" ${c.RESUMEN_EMAIL_FRECUENCIA === 'mensual' ? 'selected' : ''}>Mensual</option>
            </select>
          </label>
          <label>Hora de envío
            <input type="time" name="RESUMEN_EMAIL_HORA" value="${esc(c.RESUMEN_EMAIL_HORA)}" />
          </label>
          <label>Servidor SMTP
            <input type="text" name="RESUMEN_EMAIL_SMTP_HOST" value="${esc(c.RESUMEN_EMAIL_SMTP_HOST)}" placeholder="smtp.gmail.com" />
          </label>
          <label>Puerto SMTP
            <input type="number" name="RESUMEN_EMAIL_SMTP_PORT" value="${c.RESUMEN_EMAIL_SMTP_PORT}" placeholder="587" />
          </label>
          <label>Tu mail (el que manda)
            <input type="email" name="RESUMEN_EMAIL_USUARIO" value="${esc(c.RESUMEN_EMAIL_USUARIO)}" placeholder="vos@gmail.com" />
          </label>
          <label>Contraseña de aplicación
            <input type="password" name="RESUMEN_EMAIL_PASSWORD" value="${esc(c.RESUMEN_EMAIL_PASSWORD)}" placeholder="xxxx xxxx xxxx xxxx" />
          </label>
          <label>Mail destino (dónde lo querés recibir)
            <input type="email" name="RESUMEN_EMAIL_DESTINATARIO" value="${esc(c.RESUMEN_EMAIL_DESTINATARIO)}" placeholder="vos@gmail.com" />
          </label>
        </div>
        <div class="form-actions" style="margin-top:14px">
          <button type="button" class="btn-secondary" id="btn-probar-email">Enviar de prueba ahora</button>
          <span id="email-status" class="save-status"></span>
        </div>
        <p class="hint">La frecuencia solo controla cuándo se manda solo (con el auto-refresco); "Enviar de prueba" siempre manda al toque, para que puedas confirmar que quedó bien configurado.</p>
      </section>

      <section class="panel">
        <h2>Inflación mensual (INDEC)</h2>
        <p class="hint">Se trae sola del IPC Nacional de INDEC (vía datos.gob.ar) en cada refresco automático y se aplica directa — no es editable a mano.</p>
        <div class="kpi-grid" id="inflacion-kpis" style="margin-bottom:14px">${renderInflacionKpis(c)}</div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" id="btn-actualizar-indec">Actualizar desde INDEC ahora</button>
          <span id="indec-status" class="save-status"></span>
        </div>
      </section>

      <div class="form-actions">
        <button type="submit" class="btn-primary">Guardar ahora</button>
        <span id="config-status" class="save-status"></span>
      </div>
      <p class="hint">Todo lo de esta pantalla se guarda solo apenas lo cambiás — este botón es opcional, por si querés la confirmación al toque.</p>
    </form>
    ${renderGlosario(['stopLossTakeProfit', 'comision', 'plazoFijoTradicional', 'plazoFijoUva', 'potencial'])}`;

  container.querySelector('#btn-actualizar-indec').addEventListener('click', async (ev) => {
    const btn = ev.target;
    const status = container.querySelector('#indec-status');
    btn.disabled = true;
    status.style.color = '';
    status.textContent = 'Consultando INDEC…';

    const resultado = await window.api.actualizarInflacionIndec();
    btn.disabled = false;

    if (!resultado.ok) {
      status.style.color = 'var(--loss)';
      status.textContent = `No se pudo actualizar: ${resultado.error}`;
      return;
    }

    state.config = resultado.config; // silencioso, no dispara un re-render
    container.querySelector('#inflacion-kpis').innerHTML = renderInflacionKpis(resultado.config);

    const ultimoMes = Object.keys(resultado.config.INFLACION_MENSUAL).sort().pop();
    status.style.color = 'var(--gain)';
    status.textContent = `Actualizado — último mes disponible: ${ultimoMes ?? '—'}.`;
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
        configStatus.textContent = 'Guardado.';
        setTimeout(() => { if (configStatus) configStatus.textContent = ''; }, 1500);
      }
    }, 500);
  }
  container.querySelector('#form-config').addEventListener('input', autoGuardar);
  container.querySelector('#form-config').addEventListener('change', autoGuardar);

  container.querySelector('#btn-probar-email').addEventListener('click', async (ev) => {
    const btn = ev.target;
    const status = container.querySelector('#email-status');
    const configActual = leerConfigDelFormulario();

    if (!configActual.RESUMEN_EMAIL_USUARIO || !configActual.RESUMEN_EMAIL_PASSWORD || !configActual.RESUMEN_EMAIL_DESTINATARIO) {
      status.style.color = 'var(--loss)';
      status.textContent = 'Completá tu mail, la contraseña y el destinatario primero.';
      return;
    }

    btn.disabled = true;
    status.style.color = '';
    status.textContent = 'Guardando y enviando…';
    // Se guarda antes de probar: así lo que ya tipeaste no se pierde si en el
    // medio termina un auto-refresco de fondo y se vuelve a dibujar la pantalla.
    const guardado = await window.api.saveConfig(configActual);
    setState({ config: guardado });
    const resultado = await window.api.probarResumenEmail(configActual);
    btn.disabled = false;
    if (resultado.ok) {
      status.style.color = 'var(--gain)';
      status.textContent = 'Guardado y enviado — revisá tu casilla.';
    } else {
      status.style.color = 'var(--loss)';
      status.textContent = `Se guardó la configuración, pero el envío dio error: ${resultado.error}`;
    }
  });

  container.querySelector('#form-config').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const guardado = await window.api.saveConfig(leerConfigDelFormulario());
    setState({ config: guardado });
    const status = container.querySelector('#config-status');
    status.textContent = 'Guardado.';
    setTimeout(() => { if (status) status.textContent = ''; }, 2500);
  });
}
