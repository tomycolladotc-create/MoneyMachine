const fs = require('fs');
const path = require('path');
const { CONFIG_DEFAULT, CARTERA_DEFAULT, UNIVERSO_DEFAULT } = require('./defaults');

let userDataDir = null;

function init(dir) {
  userDataDir = dir;
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
}

function filePath(name) {
  return path.join(userDataDir, name);
}

function readJSON(name, fallback) {
  const p = filePath(name);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    return fallback;
  }
}

function writeJSON(name, data) {
  const p = filePath(name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

function getConfig() {
  const stored = readJSON('config.json', null);
  if (!stored) {
    writeJSON('config.json', CONFIG_DEFAULT);
    return { ...CONFIG_DEFAULT };
  }
  // completar claves nuevas que no existan todavia en un config guardado viejo
  return { ...CONFIG_DEFAULT, ...stored };
}

function saveConfig(config) {
  writeJSON('config.json', config);
  return config;
}

function getCartera() {
  const stored = readJSON('cartera.json', null);
  if (!stored) {
    writeJSON('cartera.json', CARTERA_DEFAULT);
    return JSON.parse(JSON.stringify(CARTERA_DEFAULT));
  }
  return stored;
}

function saveCartera(cartera) {
  writeJSON('cartera.json', cartera);
  return cartera;
}

function getUniverso() {
  const stored = readJSON('universo.json', null);
  if (!stored) {
    writeJSON('universo.json', UNIVERSO_DEFAULT);
    return JSON.parse(JSON.stringify(UNIVERSO_DEFAULT));
  }
  return stored;
}

function saveUniverso(universo) {
  writeJSON('universo.json', universo);
  return universo;
}

function getSnapshot() {
  return readJSON('snapshot.json', null);
}

function saveSnapshot(snapshot) {
  writeJSON('snapshot.json', snapshot);
}

function getHistorialCartera() {
  return readJSON('historial.json', []);
}

// Un punto por día: si ya hay uno para `punto.fecha` se reemplaza (varios
// refrescos el mismo día no generan varios puntos), si no se agrega al final.
function registrarPuntoHistorial(punto) {
  const historial = getHistorialCartera();
  const i = historial.findIndex((p) => p.fecha === punto.fecha);
  if (i >= 0) historial[i] = punto;
  else historial.push(punto);
  historial.sort((a, b) => a.fecha.localeCompare(b.fecha));
  writeJSON('historial.json', historial);
  return historial;
}

function getUltimoEnvioResumen() {
  return readJSON('resumen-whatsapp.json', {}).ultimoEnvio || null;
}

function registrarUltimoEnvioResumen(fecha) {
  writeJSON('resumen-whatsapp.json', { ultimoEnvio: fecha });
}

module.exports = {
  init,
  getConfig,
  saveConfig,
  getCartera,
  saveCartera,
  getUniverso,
  saveUniverso,
  getSnapshot,
  saveSnapshot,
  getHistorialCartera,
  registrarPuntoHistorial,
  getUltimoEnvioResumen,
  registrarUltimoEnvioResumen,
};
