// Inflación mensual real (IPC Nivel General Nacional) publicada por INDEC, vía
// el portal de datos abiertos del Gobierno (datos.gob.ar) — es un CSV público,
// gratuito, sin API key, mantenido por la Subsecretaría de Programación
// Macroeconómica a partir de los datos oficiales de INDEC.
// Fuente: https://datos.gob.ar/dataset/sspm-indice-precios-al-consumidor-nacional-ipc-base-diciembre-2016

const CSV_URL = 'https://infra.datos.gob.ar/catalog/sspm/dataset/145/distribution/145.3/download/indice-precios-al-consumidor-nivel-general-base-diciembre-2016-mensual.csv';

// Devuelve un mapa { 'YYYY-MM': decimal } con la variación mensual real del
// IPC Nivel General Nacional, para todos los meses que INDEC ya publicó.
async function obtenerInflacionMensualINDEC() {
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`INDEC (datos.gob.ar) respondió HTTP ${res.status}`);
  const texto = await res.text();

  const lineas = texto.trim().split('\n');
  const columnas = lineas[0].split(',');
  const idxFecha = columnas.indexOf('indice_tiempo');
  const idxVariacion = columnas.indexOf('ipc_ng_nacional_tasa_variacion_mensual');
  if (idxFecha === -1 || idxVariacion === -1) {
    throw new Error('El archivo de INDEC cambió de formato (no se encontraron las columnas esperadas).');
  }

  const inflacion = {};
  for (const linea of lineas.slice(1)) {
    const campos = linea.split(',');
    const fecha = campos[idxFecha];
    const variacion = campos[idxVariacion];
    if (!fecha || variacion === undefined || variacion === '') continue;
    const valor = Number(variacion);
    if (Number.isNaN(valor)) continue;
    inflacion[fecha.slice(0, 7)] = valor;
  }
  return inflacion;
}

module.exports = { obtenerInflacionMensualINDEC };
