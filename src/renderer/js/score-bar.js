export function barra(label, value, cls) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return `
    <div class="score-row">
      <span class="score-label">${label}</span>
      <div class="score-track"><div class="score-fill ${cls}" style="width:${v}%"></div></div>
      <span class="score-value">${v.toFixed(0)}</span>
    </div>`;
}
