// Live line charts (last 60 samples of the ESP32 status stream)
function mkChart(id, unit) {
  const ds = (l, c, w = 1.5) => ({ label: l, data: [], borderColor: c, borderWidth: w, pointRadius: 0, tension: .2 });
  return new Chart($(id), { type: 'line', data: { labels: [], datasets: [ds('X', '#ff6b6b'), ds('Y', '#4dd4ac'), ds('Z', '#5b8def'), ds('Total', '#ffffff', 2.5),
    { label: 'Threshold', data: [], borderColor: '#ffb020', borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5 }] },
    options: { animation: false, responsive: true, maintainAspectRatio: false,
      scales: { x: { ticks: { display: false }, grid: { color: '#2a3548' } }, y: { ticks: { color: '#8d9bb3' }, grid: { color: '#2a3548' }, title: { display: true, text: unit, color: '#8d9bb3' } } },
      plugins: { legend: { labels: { color: '#c8d2e6', boxWidth: 10 } } } } });
}
const chA = mkChart('chA', 'Acceleration (g)'), chG = mkChart('chG', 'Angular velocity (°/s)');
function push(ch, vals) { ch.data.labels.push(''); ch.data.datasets.forEach((s, i) => s.data.push(vals[i])); if (ch.data.labels.length > 60) { ch.data.labels.shift(); ch.data.datasets.forEach(s => s.data.shift()); } ch.update('none'); }
function pushChart(d) { push(chA, [d.ax, d.ay, d.az, d.g, d.thG]); push(chG, [d.gx, d.gy, d.gz, d.r, d.thR]); }
