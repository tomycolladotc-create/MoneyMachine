const CONFIG_DEFAULT = {
  STOP_LOSS_PCT: -15.0,
  TAKE_PROFIT_PCT: 30.0,
  TASA_PF_ANUAL: 0.225,
  TASA_PF_UVA_PLUS_ANUAL: 0.01,
  COMISION_PCT: 0.005,
  MIN_ANALISTAS_RANKING: 8,
  MIN_POTENCIAL_RANKING: 5.0,
  SLEEP_SEC: 0.15,
  AUTO_REFRESH_MIN: 15,
  INFLACION_MENSUAL: {
    '2026-05': 0.021,
    '2026-06': 0.019,
  },
  INFLACION_MENSUAL_ESTIMADA_DEFAULT: 0.019,
  NOTIFICACIONES_ACTIVADAS: true,
  RESUMEN_EMAIL_ACTIVADO: false,
  RESUMEN_EMAIL_FRECUENCIA: 'diario', // 'diario' | 'semanal' | 'mensual'
  RESUMEN_EMAIL_HORA: '09:00',
  RESUMEN_EMAIL_SMTP_HOST: 'smtp.gmail.com',
  RESUMEN_EMAIL_SMTP_PORT: 587,
  RESUMEN_EMAIL_USUARIO: '',
  RESUMEN_EMAIL_PASSWORD: '',
  RESUMEN_EMAIL_DESTINATARIO: '',
};

// Arranca vacía: el usuario carga sus propias compras/ventas desde la UI.
const CARTERA_DEFAULT = {};

const { TICKER_SECTOR } = require('./universe');

// Punto de partida para el universo editable: se usa una sola vez, la primera
// vez que arranca la app, para sembrar universo.json. De ahí en adelante el
// usuario lo edita desde la UI y este archivo ya no se vuelve a tocar.
const UNIVERSO_DEFAULT = Object.entries(TICKER_SECTOR).map(([ticker, sector]) => ({ ticker, sector }));

module.exports = { CONFIG_DEFAULT, CARTERA_DEFAULT, UNIVERSO_DEFAULT };
