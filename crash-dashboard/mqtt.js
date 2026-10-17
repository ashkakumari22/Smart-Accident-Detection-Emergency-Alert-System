// MQTT link to the ESP32 running in Wokwi (public HiveMQ broker)
let mq, T;
function connect() {
  if (mq) mq.end(true);
  T = $('topic').value.trim();
  mq = mqtt.connect('wss://broker.hivemq.com:8884/mqtt');
  mq.on('connect', () => { setChip('cMq', 'MQTT: connected', 1); mq.subscribe([T + '/status', T + '/alert', T + '/evt']); sendConfig(); });
  mq.on('close', () => setChip('cMq', 'MQTT: offline', 0));
  mq.on('message', (t, m) => {
    const d = JSON.parse(m.toString());
    if (t.endsWith('/status')) onStatus(d); else if (t.endsWith('/alert')) onAlert(d); else onEvt(d);
  });
}
function pub(sub, msg) { if (mq && mq.connected) mq.publish(T + '/' + sub, String(msg)); }
function sendConfig() { pub('mode', $('virt').checked ? 1 : 0); pub('thr', $('thG').value + ',' + $('thR').value); }
function cancelA() { pub('cancel', 1); }
