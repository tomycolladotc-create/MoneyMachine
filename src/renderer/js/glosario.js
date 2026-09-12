// Arma el glosario a partir del diccionario bilingüe en i18n.js. Cada vista
// elige solo las claves de término que le sirven.

import { t } from './i18n.js';

function item(key) {
  const titulo = t(`glosario.${key}.titulo`);
  const texto = t(`glosario.${key}.texto`);
  const ejemplo = t(`glosario.${key}.ejemplo`);
  if (!titulo || titulo.startsWith('glosario.')) return '';
  return `
    <div class="glosario-item">
      <dt>${titulo}</dt>
      <dd>${texto}${ejemplo && !ejemplo.startsWith('glosario.') ? `<span class="glosario-ejemplo">${t('glosarioEjemplo')} ${ejemplo}</span>` : ''}</dd>
    </div>`;
}

export function renderGlosario(keys) {
  const html = keys.map(item).filter(Boolean).join('');
  if (!html) return '';
  return `
    <details class="glosario">
      <summary>${t('glosarioTitulo')}</summary>
      <dl class="glosario-lista">${html}</dl>
    </details>`;
}
