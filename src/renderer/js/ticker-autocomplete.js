import { esc } from './format.js';
import { t } from './i18n.js';

// Engancha un buscador en vivo de tickers (vía Yahoo Finance) a un <input> de
// texto: mientras el usuario escribe, sugiere símbolos reales para evitar
// errores de tipeo o confundir el ticker de acá con el de otro país/mercado.
// `onSelect(resultado)` se llama cuando eligen una sugerencia (resultado ya
// trae el símbolo completo y correcto, ej. "YPFD.BA").
export function attachTickerAutocomplete(inputEl, onSelect, { soloBue = false } = {}) {
  let debounceTimer = null;
  let resultados = [];
  let indiceActivo = -1;

  const wrapper = document.createElement('div');
  wrapper.className = 'autocomplete-wrapper';
  inputEl.parentNode.insertBefore(wrapper, inputEl);
  wrapper.appendChild(inputEl);

  const dropdown = document.createElement('div');
  dropdown.className = 'autocomplete-dropdown';
  dropdown.hidden = true;
  wrapper.appendChild(dropdown);

  function cerrar() {
    dropdown.hidden = true;
    dropdown.innerHTML = '';
    resultados = [];
    indiceActivo = -1;
  }

  function mostrarMensaje(texto) {
    dropdown.innerHTML = `<div class="autocomplete-mensaje">${esc(texto)}</div>`;
    dropdown.hidden = false;
  }

  function render() {
    if (resultados.length === 0) {
      cerrar();
      return;
    }
    dropdown.innerHTML = resultados
      .map(
        (r, i) => `
      <div class="autocomplete-item ${i === indiceActivo ? 'is-active' : ''}" data-i="${i}">
        <span class="mono">${esc(r.symbol)}</span>
        <span class="autocomplete-nombre">${esc(r.nombre)}</span>
        <span class="chip">${esc(r.exchangeDisp)}</span>
      </div>`,
      )
      .join('');
    dropdown.hidden = false;
    dropdown.querySelectorAll('.autocomplete-item').forEach((el) => {
      el.addEventListener('mousedown', (ev) => {
        ev.preventDefault(); // evita que el input pierda foco antes del click
        seleccionar(resultados[Number(el.dataset.i)]);
      });
    });
  }

  function seleccionar(r) {
    inputEl.value = r.symbol;
    cerrar();
    if (onSelect) onSelect(r);
  }

  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = inputEl.value.trim();
    if (q.length < 2) {
      cerrar();
      return;
    }
    mostrarMensaje(t('autocomplete.buscando'));
    debounceTimer = setTimeout(async () => {
      const crudos = await window.api.buscarTicker(q);
      // si el usuario ya siguió escribiendo/borró, esta respuesta llegó tarde: descartarla
      if (inputEl.value.trim() !== q) return;

      const filtrados = soloBue ? crudos.filter((x) => x.exchange === 'BUE') : crudos;
      indiceActivo = -1;

      if (filtrados.length > 0) {
        resultados = filtrados;
        render();
      } else if (soloBue && crudos.length > 0) {
        // Yahoo encontró algo, pero nada listado en Buenos Aires todavía —
        // pasa seguido con prefijos de 2-3 letras. No es que esté roto.
        resultados = [];
        mostrarMensaje(t('autocomplete.nadaEnBue', { q }));
      } else {
        resultados = [];
        mostrarMensaje(t('autocomplete.sinResultados', { q }));
      }
    }, 300);
  });

  inputEl.addEventListener('keydown', (ev) => {
    if (dropdown.hidden) return;
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      indiceActivo = Math.min(indiceActivo + 1, resultados.length - 1);
      render();
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      indiceActivo = Math.max(indiceActivo - 1, 0);
      render();
    } else if (ev.key === 'Enter' && indiceActivo >= 0) {
      ev.preventDefault();
      seleccionar(resultados[indiceActivo]);
    } else if (ev.key === 'Escape') {
      cerrar();
    }
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(cerrar, 150); // le da tiempo al mousedown de la sugerencia antes de cerrar
  });
}
