// Vehicle behaviour + scenarios. sensors() derives the MPU6050 readings from the SAME events you see in 3D.
const sim = { run: true, mode: 'cruise', v: 0, v0: 0, t: 0, peak: 0, low: -1, impactTs: null, nearTs: null, scn: '' };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z), rnd = a => (Math.random() - .5) * a;
const cruise = () => $('spd').value / 3.6;
const play = () => { sim.run = true; }, pause = () => { sim.run = false; };
function resetCar() {
  sim.mode = 'cruise'; sim.run = true; sim.low = -1; sim.impactTs = null; sim.nearTs = null; sim.scn = '';
  bar.visible = false; truck.visible = false; ring.visible = false; flashL.intensity = 0; tailM.emissiveIntensity = .6;
  car.position.set(0, 0, 0); car.rotation.set(0, 0, 0); car.scale.set(1, 1, 1);
  deb.forEach(d => d.m.visible = false); fx.forEach(f => { f.l = 0; f.s.visible = false; });
}
function resetAll() { resetCar(); cancelA(); tgState = 'idle'; badge(); }
function ready() { if (sim.mode === 'crash' || sim.mode === 'safe') resetCar(); return sim.mode === 'cruise'; }
function trigger() {                                     // real accident: car hits a barrier
  if (!ready()) return; sim.run = true; sim.scn = 'Collision'; bar.position.z = -70; bar.visible = true; sim.mode = 'approach';
}
function nearMiss() {                                    // false alarm: hard brake + swerve around a stalled truck, no contact
  if (!ready()) return; sim.run = true; sim.scn = 'Hard brake & swerve'; truck.position.set(0, 0, -70); truck.visible = true; sim.mode = 'approachN';
}
function lowImpact() { if (sim.mode === 'cruise' && sim.low < 0) { sim.low = 0; logLow(2.2); } }
function crash() {
  sim.mode = 'crash'; sim.t = 0; sim.impactTs = Date.now(); flash = 1;
  sim.peak = Math.min(sim.v / 0.08 / 9.81, 40);          // stops in 0.08 s -> deceleration in g
  car.scale.z = .72; bar.position.z = -2.4; flashL.intensity = 80; ring.visible = true; ring.userData.t = 0; ring.position.set(0, 1, -2.6);
  deb.forEach(d => { d.m.visible = true; d.m.position.set(rnd(2), 1, -2.5); d.v.set(rnd(14), Math.random() * 9 + 3, Math.random() * 8 + 2); });
  for (let i = 0; i < 30; i++) puff(true, V3(rnd(1.6), 1, -2.4), V3(rnd(12), Math.random() * 8, rnd(10)), .5 + Math.random() * .4, .5, .1, 0xffc060);
}
let flash = 0;
function stepCar(dt) {
  dt *= sim.mode === 'crash' && sim.t < .6 ? .3 : 1;     // slow motion at the moment of impact
  const now = performance.now(); let braking = false;
  if (sim.mode === 'cruise' || sim.mode === 'approach' || sim.mode === 'approachN') sim.v = sim.run ? cruise() : 0;
  else if (sim.mode === 'swerve') {                      // sudden brake + drift to the left, car stays safe
    sim.t += dt; braking = true; const t = sim.t, u = Math.min(t / .9, 1);
    sim.v = sim.v0 * Math.max(0, 1 - t / 1.7);
    car.position.x = -3.4 * u * u * (3 - 2 * u);
    car.rotation.y = .5 * Math.sin(Math.min(t / 1.4, 1) * Math.PI); car.rotation.z = .1 * Math.sin(Math.min(t / 1.2, 1) * Math.PI);
    if (t > 2.2) { sim.mode = 'safe'; sim.v = 0; }
  } else sim.v = 0;
  scroll.forEach(o => { o.position.z += sim.v * dt; if (o.position.z > 20) o.position.z -= 240; });
  wheels.forEach(w => w.rotation.x -= sim.v * dt / .45);
  if (bar.visible) bar.position.z += sim.v * dt; if (truck.visible) truck.position.z += sim.v * dt;
  if (sim.mode === 'approach' && bar.position.z >= -2.4) crash();
  if (sim.mode === 'approachN' && truck.position.z >= -22) { sim.mode = 'swerve'; sim.t = 0; sim.v0 = sim.v; sim.nearTs = Date.now(); }
  if (sim.mode === 'cruise' || sim.mode === 'approach' || sim.mode === 'approachN') car.position.y = sim.v ? .03 * Math.sin(now / 50) : 0;
  if (sim.low >= 0) { sim.low += dt; car.rotation.x = -.06 * Math.sin(Math.PI * Math.min(sim.low / .5, 1)); if (sim.low > .5) { sim.low = -1; car.rotation.x = 0; } }
  tailM.emissiveIntensity = braking || sim.mode === 'safe' || sim.mode === 'crash' ? 3.5 : .6;
  truckLamp.emissiveIntensity = now % 600 < 300 ? 3 : .2;
  if (braking && sim.v > 1) for (const s of [-1, 1]) if (Math.random() < .7) puff(false, V3(car.position.x + s, .3, 1.5), V3(rnd(.6), .8, sim.v * .9), 1.1, .8, 3.2, 0xcfcfd6);
  if (sim.mode === 'crash') {
    sim.t += dt; const spin = sim.t < 1.2 ? 1 : 0;
    car.rotation.z += dt * Math.min(3, sim.t * 8) * spin; car.rotation.x -= dt * .5 * spin; car.rotation.y += dt * .6 * spin;
    car.position.y = Math.max(0, Math.sin(sim.t * 5) * 1.2 * Math.exp(-sim.t * 2));
    deb.forEach(d => { d.v.y -= 20 * dt; d.m.position.addScaledVector(d.v, dt); if (d.m.position.y < .12) { d.m.position.y = .12; d.v.multiplyScalar(.5); } d.m.rotation.x += dt * 5; });
    if (sim.t < 3 && Math.random() < .5) puff(false, V3(rnd(1), 1.1, -1.8), V3(rnd(1.5), 2 + Math.random(), rnd(1)), 1.6, .8, 3.5, 0x666670);
    if (sim.t < .5) puff(true, V3(rnd(1.5), .8, -2.3), V3(rnd(8), Math.random() * 6, rnd(6)), .4, .4, .1, 0xffd080);
    ring.userData.t += dt; ring.scale.setScalar(1 + ring.userData.t * 16); ring.material.opacity = Math.max(0, 1 - ring.userData.t * 2); ring.lookAt(C.position);
    flashL.intensity *= Math.pow(.02, dt);
  }
  stepFx(dt);
}
function sensors() {                                     // what an MPU6050 would read for the current event
  let ax = rnd(.06), ay = rnd(.06), az = 1 + rnd(.06), gx = rnd(6), gy = rnd(6), gz = rnd(6);
  if (sim.mode === 'crash' && sim.t < 1.3) { const k = sim.t < .3 ? 1 : Math.exp(-(sim.t - .3) * 7);
    ax += sim.peak * k; ay += rnd(sim.peak * .6) * k; az += rnd(sim.peak * .4) * k; gx += (150 + Math.random() * 250) * k; gy += rnd(500) * k; gz += rnd(500) * k; }
  if (sim.mode === 'swerve') { const t = sim.t, k = t < .5 ? 1 : Math.exp(-(t - .5) * 2.5), s = t < 1 ? 1 : -.7;
    ax += 4.2 * k; ay += 3.8 * k * s; az += rnd(.5) * k; gx += 60 * k; gz += 380 * k * s; }
  if (sim.low >= 0) { const k = Math.sin(Math.PI * Math.min(sim.low / .5, 1)); ax += 2 * k; gx += 40 * k; }
  return [ax, ay, az, gx, gy, gz];
}
