const overlay = document.getElementById('modal-overlay');
const panel = document.getElementById('modal-panel');

export function openModal(html) {
  panel.innerHTML = html;
  overlay.hidden = false;
}

export function updateModal(html) {
  if (!overlay.hidden) panel.innerHTML = html;
}

export function closeModal() {
  overlay.hidden = true;
  panel.innerHTML = '';
}

export function modalAbierto() {
  return !overlay.hidden;
}

overlay.addEventListener('click', (ev) => {
  if (ev.target === overlay) closeModal();
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !overlay.hidden) closeModal();
});
