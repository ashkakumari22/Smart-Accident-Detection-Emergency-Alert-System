// 3D world: dusk sky, city street, detailed car, obstacles, particle effects
function fail(msg) { $('cv').insertAdjacentHTML('afterbegin', '<p style="position:absolute;top:60px;left:16px;right:16px;color:#ffb020;font:600 15px Segoe UI">' + msg + '</p>'); throw new Error(msg); }
if (typeof THREE === 'undefined') fail('three.js did not load (CDN blocked?). Check internet / try a phone hotspot, then Ctrl+Shift+R.');
const el = $('cv'); let R;
try { R = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { fail('WebGL is disabled. In Chrome: Settings > System > turn on "Use graphics acceleration", then restart Chrome.'); }
R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
el.appendChild(R.domElement);
const S = new THREE.Scene(); S.fog = new THREE.Fog(0x7a5f78, 45, 190);
const C = new THREE.PerspectiveCamera(55, 1, .1, 400);
const M = (c, r = .7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); return new THREE.CanvasTexture(c); };
const glowT = canvas(64, 64, x => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const glow = (color, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); return s; };
// sky dome
const skyT = canvas(2, 256, x => { const g = x.createLinearGradient(0, 0, 0, 256); [[0, '#0a1230'], [.35, '#1d3a6b'], [.5, '#e0875a'], [.55, '#f2b27a'], [1, '#3a2a2a']].forEach(s => g.addColorStop(s[0], s[1])); x.fillStyle = g; x.fillRect(0, 0, 2, 256); });
S.add(new THREE.Mesh(new THREE.SphereGeometry(300, 16, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false })));
// lights
S.add(new THREE.HemisphereLight(0x9bb4ff, 0x3a2a3a, .75));
const sun = new THREE.DirectionalLight(0xffd2a0, 1.1); sun.position.set(-18, 26, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 }); sun.shadow.camera.updateProjectionMatrix(); S.add(sun);
// ground, road, sidewalks
const flat = (g, m, x, y, z, rot = -Math.PI / 2) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.x = rot; o.receiveShadow = true; S.add(o); return o; };
flat(new THREE.PlaneGeometry(300, 500), M(0x1d2b22, 1), 0, -.05, -150);
flat(new THREE.PlaneGeometry(14, 500), M(0x2b303b, .85), 0, 0, -150);
for (const x of [-6.7, 6.7]) flat(new THREE.PlaneGeometry(.2, 500), M(0xeeeeee), x, .01, -150);
for (const x of [-9.5, 9.5]) flat(new THREE.BoxGeometry(5, .2, 500), M(0x555a66), x, .05, -150, 0);
// scrolling scenery (wraps every 240 m, moves toward the camera at the car's speed)
const scroll = []; const sc = (o, z) => { o.position.z = z; S.add(o); scroll.push(o); return o; };
for (let i = 0; i < 40; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(.3, 2.6), M(0xffd24d)); l.rotation.x = -Math.PI / 2; l.position.y = .02; sc(l, 20 - i * 6); }
const winT = canvas(64, 64, x => { x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if (Math.random() < .45) { x.fillStyle = Math.random() < .5 ? '#ffd9a0' : '#cfe6ff'; x.fillRect(i * 8 + 1, j * 8 + 2, 5, 4); } });
winT.magFilter = THREE.NearestFilter;
const winM = new THREE.MeshStandardMaterial({ color: 0x161c2c, roughness: .9, emissive: 0xffffff, emissiveMap: winT, emissiveIntensity: .85 });
for (let i = 0; i < 15; i++) for (const sd of [-1, 1]) { const w = 6 + Math.random() * 5, h = 8 + Math.random() * 20, b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 9), winM); b.position.set(sd * (16 + w / 2 + Math.random() * 4), h / 2, 0); sc(b, 20 - i * 16 - Math.random() * 4); }
for (let i = 0; i < 20; i++) for (const sd of [-1, 1]) { const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(.15, .2, 1.4, 6), M(0x5a3d2b)); t.position.y = .7;
  const f = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 8), M(0x1f5a3a)); f.position.y = 2.9; g.add(t, f); g.position.x = sd * (12.6 + Math.random()); sc(g, 20 - i * 12 - Math.random() * 5); }
for (let i = 0; i < 10; i++) for (const sd of [-1, 1]) { const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 6, 6), M(0x2a2f3a)); p.position.y = 3;
  const a = new THREE.Mesh(new THREE.BoxGeometry(1.4, .08, .08), M(0x2a2f3a)); a.position.set(-sd * .7, 6, 0);
  const b = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe0a8 })); b.position.set(-sd * 1.4, 5.95, 0);
  const gl = glow(0xffc980, 4); gl.position.copy(b.position); g.add(p, a, b, gl); g.position.x = sd * 7.6; sc(g, 20 - i * 24); }
// particles (smoke 0-59, sparks 60-89)
const fx = []; for (let i = 0; i < 90; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, transparent: true, depthWrite: false, blending: i < 60 ? THREE.NormalBlending : THREE.AdditiveBlending })); s.visible = false; S.add(s); fx.push({ s, v: new THREE.Vector3(), l: 0, L: 1, a: 1, b: 1 }); }
function puff(spark, p, v, L, a, b, color) { const f = fx.find((f, i) => f.l <= 0 && (i >= 60) === spark); if (!f) return;
  f.s.position.copy(p); f.v.copy(v); f.l = f.L = L; f.a = a; f.b = b; f.s.material.color.set(color); f.s.visible = true; }
function stepFx(dt) { fx.forEach(f => { if (f.l <= 0) return; f.l -= dt; if (f.l <= 0) { f.s.visible = false; return; }
  const k = 1 - f.l / f.L; f.s.position.addScaledVector(f.v, dt); f.s.scale.setScalar(f.a + (f.b - f.a) * k); f.s.material.opacity = (1 - k) * .85; }); }
// car
const car = new THREE.Group(), wheels = [];
const paint = new THREE.MeshStandardMaterial({ color: 0xd62839, roughness: .22, metalness: .65 });
const glass = new THREE.MeshStandardMaterial({ color: 0x0a1220, roughness: .05, metalness: .9 });
const headM = new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff1c0, emissiveIntensity: 2 });
const tailM = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1f2d, emissiveIntensity: .6 });
const part = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); car.add(o); return o; };
part(new THREE.BoxGeometry(1.9, .55, 4.3), paint, 0, .68, 0);
part(new THREE.BoxGeometry(1.6, .5, 2.1), glass, 0, 1.2, .3);
part(new THREE.BoxGeometry(1.5, .07, 1.8), paint, 0, 1.47, .3);
part(new THREE.BoxGeometry(1.95, .2, .25), M(0x14161c, .6), 0, .5, -2.2); part(new THREE.BoxGeometry(1.95, .2, .25), M(0x14161c, .6), 0, .5, 2.2);
part(new THREE.BoxGeometry(1.7, .06, .5), M(0x14161c, .5), 0, 1.1, 2.0);
for (const x of [-.65, .65]) { part(new THREE.BoxGeometry(.4, .14, .08), headM, x, .78, -2.18); const g = glow(0xfff1c0, 1.8); g.position.set(x, .78, -2.4); car.add(g); part(new THREE.BoxGeometry(.5, .12, .06), tailM, x * .95, .85, 2.17); }
for (const [x, z] of [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]]) { const g = new THREE.Group(); g.position.set(x, .45, z);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .3, 20), M(0x0c0c0e, .9)); tire.rotation.z = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .32, 12), M(0xc7ccd6, .3, .9)); rim.rotation.z = Math.PI / 2;
  g.add(tire, rim, new THREE.Mesh(new THREE.BoxGeometry(.34, .06, .5), M(0x333844))); car.add(g); wheels.push(g); }
const spot = new THREE.SpotLight(0xfff1cc, 2.2, 70, .55, .55); spot.position.set(0, .9, -2); car.add(spot);
const tg = new THREE.Object3D(); tg.position.set(0, 0, -30); car.add(tg); spot.target = tg;
car.traverse(o => { if (o.isMesh) o.castShadow = true; }); S.add(car);
// obstacles
const bar = new THREE.Group(); for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1.5), M(i % 2 ? 0xff4d5e : 0xffffff)); b.position.set(-6 + i * 2, 1.5, 0); b.castShadow = true; bar.add(b); }
bar.visible = false; S.add(bar);
const truck = new THREE.Group(), truckLamp = new THREE.MeshStandardMaterial({ color: 0x331a00, emissive: 0xff9a1a, emissiveIntensity: 3 });
const tb = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 6), M(0xcfd3da, .5)); tb.position.y = 1.8;
const ts = new THREE.Mesh(new THREE.BoxGeometry(3.05, .5, 6.05), M(0xff8c1a)); ts.position.y = 1.2;
truck.add(tb, ts); for (const x of [-1.2, 1.2]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.3, .25, .1), truckLamp); l.position.set(x, 1.2, 3.05); truck.add(l); const g = glow(0xff9a1a, 2.2); g.position.set(x, 1.2, 3.2); truck.add(g); }
truck.traverse(o => { if (o.isMesh) o.castShadow = true; }); truck.visible = false; S.add(truck);
// impact effects
const flashL = new THREE.PointLight(0xffaa55, 0, 30); flashL.position.set(0, 2, -3); S.add(flashL);
const ring = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffcf70, transparent: true, side: THREE.DoubleSide, depthWrite: false })); ring.visible = false; S.add(ring);
const deb = []; for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.25, .25, .25), M(i % 3 ? 0xd62839 : 0x888888)); m.visible = false; S.add(m); deb.push({ m, v: new THREE.Vector3() }); }
function size() { R.setSize(el.clientWidth, el.clientHeight); C.aspect = el.clientWidth / el.clientHeight; C.updateProjectionMatrix(); }
addEventListener('resize', size); size();
