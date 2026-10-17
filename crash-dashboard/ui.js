// Panels, history and status chips
const $ = id => document.getElementById(id);
const fmt = t => t ? new Date(t).toLocaleTimeString() : '–';
const f2 = (v, n = 2) => Number(v).toFixed(n);
let ev = [], cur = null, prev = 0, last = null, lastRx = 0, tgState = 'idle';
function setChip(id, text, ok) { $(id).textContent = text; $(id).className = 'chip ' + (ok ? 'ok' : 'bad'); }
$('spd').oninput = () => $('spv').textContent = Math.round($('spd').value);
['thG', 'thR', 'virt'].forEach(k => $(k).onchange = sendConfig);

function badge() {
  const d = last || { st: 0 };
  let t = ['MONITORING', 'ACCIDENT DETECTED', 'ALERT SENT', 'ALERT CANCELLED'][d.st], c = ['', 'w', 's', 'c'][d.st];
  if (d.st === 2 && tgState === 'sending') t = 'SENDING ALERT…';
  if (d.st === 2 && tgState === 'failed') { t = 'SEND FAILED'; c = 'w'; }
  $('badge').textContent = t; $('badge').className = c;
}
function onStatus(d) {
  lastRx = Date.now(); last = d;
  if (d.st === 1 && prev !== 1) {                         // new accident -> new history row
    cur = { id: ev.length + 1, kind: 'acc', scn: sim.scn || '', det: Date.now(), cdEnd: null, pg: d.g, pr: d.r, outcome: 'Countdown running', tg: '–', loc: '–' };
    ev.unshift(cur); tgState = 'idle'; $('detT').textContent = fmt(cur.det); $('outc').textContent = 'Countdown running';
    $('tgst').textContent = '–'; $('retry').disabled = true;
  }
  if (cur && d.st === 1) { cur.pg = Math.max(cur.pg, d.pg); cur.pr = Math.max(cur.pr, d.pr); }
  if (d.st === 3 && prev === 1 && cur) { cur.cdEnd = Date.now(); cur.outcome = 'Cancelled'; $('outc').textContent = cur.scn.startsWith('Hard') ? 'Cancelled – false alarm, vehicle safe' : 'Cancelled by user'; }
  if (d.st === 3 && prev !== 3) setTimeout(resetCar, 1200);   // alert cancelled -> car returns to start
  if (d.st === 0 && prev === 2) resetCar();                    // alert finished -> car returns to start
  prev = d.st;
  badge(); pushChart(d);
  $('lastUp').textContent = fmt(lastRx); $('bz').textContent = d.bz ? 'ON (beeping)' : 'OFF';
  $('cd').textContent = d.st === 1 ? d.cd : '--';
  [['ax', 'ax'], ['ay', 'ay'], ['az', 'az'], ['g', 'g'], ['gx', 'gx'], ['gy', 'gy'], ['gz', 'gz'], ['r', 'r']].forEach(([i, k]) => $(i).textContent = f2(d[k], i === 'r' || i[0] === 'g' && i.length === 2 ? 0 : 2));
  $('g').textContent = f2(d.g); $('r').textContent = Math.round(d.r);
  $('res').textContent = d.ex ? 'THRESHOLD EXCEEDED' : 'NORMAL'; $('res').className = d.ex ? 'res-bad' : '';
  $('pk').textContent = f2(d.pg) + ' g / ' + Math.round(d.pr) + ' °/s'; $('sev').textContent = d.sev;
  renderHist();
}
function onEvt(d) {                                        // ESP32 snapshot at the moment of detection
  $('snap').textContent = 'a=(' + f2(d.ax, 1) + ', ' + f2(d.ay, 1) + ', ' + f2(d.az, 1) + ') g  ω=(' + Math.round(d.gx) + ', ' + Math.round(d.gy) + ', ' + Math.round(d.gz) + ') °/s';
}
function logLow(g) { ev.unshift({ id: ev.length + 1, kind: 'low', scn: 'Low impact', det: Date.now(), pg: g, pr: 40, outcome: 'Below threshold (no alert)', tg: '–', loc: '–' }); renderHist(); }
function renderHist() {
  const f = $('flt').value;
  $('hist').innerHTML = ev.filter(e => f === 'all' || (f === 'det' && e.kind === 'acc') || (f === 'can' && e.outcome === 'Cancelled') || (f === 'sent' && e.tg.startsWith('Sent')))
    .map(e => `<tr><td>${e.id}</td><td>${fmt(e.det)}<br><small>${e.scn || ''}</small></td><td>${e.kind === 'acc' ? fmt(e.det) + ' → ' + fmt(e.cdEnd) : '–'}</td><td>${f2(e.pg)} g / ${Math.round(e.pr)} °/s</td><td>${e.outcome}</td><td>${e.tg}</td><td>${e.loc}</td></tr>`).join('');
}
setInterval(() => {
  $('clock').textContent = new Date().toLocaleTimeString();
  const up = Date.now() - lastRx < 3000;
  setChip('cEsp', 'ESP32/Wokwi: ' + (up ? 'online' : 'offline'), up);
  setChip('cSim', 'Sim: ' + (sim.mode === 'crash' ? 'collision' : sim.run ? 'running' : 'paused'), sim.run || sim.mode === 'crash');
}, 1000);
