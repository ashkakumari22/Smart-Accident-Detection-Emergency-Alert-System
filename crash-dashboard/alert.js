// At countdown expiry: read browser location -> send Telegram -> update panels
let lastLoc = null, gpsErr = '', map = L.map('map').setView([20, 78], 4), mk = null;
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
if (navigator.geolocation) navigator.geolocation.getCurrentPosition(() => $('gfix').textContent = 'Permission granted – waiting for an accident', e => $('gfix').textContent = 'Permission: ' + e.message);  // ask for permission up front

function setGps(txt) { $('gfix').textContent = txt; }
function showLoc(l) {
  $('glat').textContent = f2(l.lat, 6); $('glon').textContent = f2(l.lon, 6); $('gacc').textContent = '±' + Math.round(l.acc) + ' m';
  $('gupd').textContent = fmt(l.ts); setGps('Fix acquired (device location)');
  const u = 'https://maps.google.com/?q=' + l.lat.toFixed(6) + ',' + l.lon.toFixed(6); $('glink').href = u; $('glink').textContent = u;
  if (mk) mk.setLatLng([l.lat, l.lon]); else mk = L.circleMarker([l.lat, l.lon], { radius: 9, color: '#ff4d5e', fillOpacity: .8 }).addTo(map);
  map.setView([l.lat, l.lon], 16);
}
function msg() {
  const c = cur || {}, l = lastLoc;
  return '🚨 ACCIDENT ALERT\nVehicle: ' + $('veh').value + '\nDetected: ' + fmt(c.det) + '\nPeak: ' + f2(c.pg || 0) + ' g, ' + Math.round(c.pr || 0) + ' °/s\n' +
    (l ? 'Location: ' + l.lat.toFixed(6) + ', ' + l.lon.toFixed(6) + ' (±' + Math.round(l.acc) + ' m)\nhttps://maps.google.com/?q=' + l.lat.toFixed(6) + ',' + l.lon.toFixed(6) : 'Location unavailable (' + gpsErr + ')');
}
async function onAlert() {                                // ESP32: countdown reached zero
  if (cur) { cur.cdEnd = Date.now(); cur.outcome = 'Emergency alert triggered'; }
  tgState = 'sending'; $('outc').textContent = 'Emergency alert triggered – sending…'; badge(); setGps('Requesting browser location…');
  try {
    if ($('fGps').checked) throw new Error('GPS failure (simulated)');
    const p = await new Promise((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }));
    lastLoc = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, ts: Date.now() }; gpsErr = ''; showLoc(lastLoc);
  } catch (e) { lastLoc = null; gpsErr = e.message; setGps('No fix: ' + e.message); }
  if (cur) cur.loc = lastLoc ? f2(lastLoc.lat, 5) + ', ' + f2(lastLoc.lon, 5) : 'unavailable';
  await sendTg();
}
async function sendTg() {
  const tk = $('tok').value.trim(), ch = $('chat').value.trim(); $('prev').textContent = msg();
  tgState = 'sending'; $('tgst').textContent = 'Sending…'; badge(); let ok = false, info = '';
  try {
    if ($('fNet').checked) throw new Error('network failure (simulated)');
    if (!tk || !ch) throw new Error('bot token / chat id missing');
    const r = await fetch('https://api.telegram.org/bot' + tk + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: ch, text: msg() }) });
    const j = await r.json(); ok = j.ok; info = j.description || '';
  } catch (e) { info = e.message; }
  tgState = ok ? 'sent' : 'failed'; $('tgts').textContent = fmt(Date.now());
  $('tgst').textContent = ok ? '✔ Delivered to ' + ($('rcpt').value || 'chat') : '✖ Failed: ' + info; $('retry').disabled = ok;
  $('outc').textContent = ok ? 'Emergency alert sent' : 'Alert triggered, notification FAILED';
  if (cur) cur.tg = ok ? 'Sent ' + fmt(Date.now()) : 'Failed: ' + info;
  pub('ack', ok ? 1 : 0); badge(); renderHist();
}
async function connectBot() {
  try { const j = await (await fetch('https://api.telegram.org/bot' + $('tok').value.trim() + '/getMe')).json();
    $('tgbot').textContent = j.ok ? '✔ @' + j.result.username : '✖ ' + j.description; } catch (e) { $('tgbot').textContent = '✖ network error'; }
}
