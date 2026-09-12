const listeners = new Set();

export const state = {
  vista: 'resumen',
  snapshot: null,
  config: null,
  cartera: null,
  universo: null,
  historial: null,
  refrescando: false,
  progreso: null,
  perfilActivo: 'AGRESIVO',
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}
