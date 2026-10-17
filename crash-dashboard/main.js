// Animation loop + data stream to the ESP32
let lastT = performance.now();
const deg = r => Math.round(r * 180 / Math.PI);
function loop(now) {
  const dt = Math.min((now - lastT) / 1000, .05); lastT = now;
  stepCar(dt);
  const sh = sim.mode === 'crash' ? Math.exp(-sim.t * 4) * .6 : 0, t = now / 1000;
  C.fov = 55 + sim.v * .25; C.updateProjectionMatrix();
  C.position.set(6.5 + car.position.x * .4 + Math.sin(t * .6) * .2 + rnd(sh), 3.4 + rnd(sh), 10.5);
  C.lookAt(car.position.x * .5, 1.1, -6);
  let txt = 'NO IMPACT', cls = '';
  if (sim.impactTs) { txt = 'IMPACT at ' + fmt(sim.impactTs) + ' (' + f2(sim.peak, 1) + ' g)'; cls = 'hit'; }
  else if (sim.nearTs) { txt = 'NEAR MISS at ' + fmt(sim.nearTs) + ' – no collision'; cls = 'safe'; }
  $('imp').textContent = txt; $('imp').className = cls;
  $('ori').textContent = 'Orientation  roll ' + deg(car.rotation.z) + '°  pitch ' + deg(car.rotation.x) + '°  yaw ' + deg(car.rotation.y) + '°';
  R.render(S, C); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
setInterval(() => { if ($('virt').checked) pub('sensor', sensors().map(v => v.toFixed(2)).join(',')); }, 200);
setInterval(sendConfig, 2000);
$('topic').value = CONFIG.topic; $('tok').value = CONFIG.token; $('chat').value = CONFIG.chatId;
$('rcpt').value = CONFIG.recipient; $('veh').value = CONFIG.vehicle;
connect(); renderHist();
