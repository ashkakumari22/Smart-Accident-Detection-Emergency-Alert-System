// Smart Accident Detection - ESP32 firmware (Wokwi). MQTT link to the dashboard.
// Location is NOT handled here: the dashboard reads the browser/device location when the countdown ends.
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#define BTN 4
#define BUZ 5
const char* TP = "MET_project_2026";   // MUST match "MQTT topic" in the dashboard
Adafruit_SSD1306 oled(128, 64, &Wire, -1);
WiFiClient wc; PubSubClient mq(wc);
float ax, ay, az = 1, gx, gy, gz, thG = 3.0, thR = 300, pg, pr;
bool virt = false;                     // true = dashboard drives the sensor values, false = MPU6050 part
int sev = 0, cd = 15, st = 0, ack = -1, shown = -1;  // st: 0 monitor, 1 countdown, 2 alert sent, 3 cancelled
unsigned long t0, tp;

String tp_(const char* s) { return String(TP) + "/" + s; }
bool bzOn = false;
void setBuzzer(bool on) {              // the Wokwi buzzer is passive: it only sounds when driven with a tone
  if (on == bzOn) return;
  bzOn = on;
  if (on) tone(BUZ, 2000); else noTone(BUZ);
}
void cancelAlert() { st = 3; t0 = millis(); setBuzzer(false); }

void cb(char* t, byte* p, unsigned int n) {
  String m; for (unsigned i = 0; i < n; i++) m += (char)p[i];
  String s = t;
  if (s.endsWith("/mode")) virt = (m == "1");
  else if (s.endsWith("/sensor") && virt) sscanf(m.c_str(), "%f,%f,%f,%f,%f,%f", &ax, &ay, &az, &gx, &gy, &gz);
  else if (s.endsWith("/thr")) sscanf(m.c_str(), "%f,%f", &thG, &thR);
  else if (s.endsWith("/cancel") && st == 1) cancelAlert();
  else if (s.endsWith("/ack")) { ack = m.toInt(); t0 = millis(); }   // dashboard reports Telegram result
}

void readMPU() {                       // MPU6050 over I2C, no library (keeps compile time low)
  Wire.beginTransmission(0x68); Wire.write(0x3B); Wire.endTransmission(false);
  if (Wire.requestFrom(0x68, 14) < 14) return;
  int16_t v[7]; for (int i = 0; i < 7; i++) { int h = Wire.read(); v[i] = (h << 8) | Wire.read(); }
  ax = v[0] / 2048.0; ay = v[1] / 2048.0; az = v[2] / 2048.0;   // +-16 g
  gx = v[4] / 16.4;   gy = v[5] / 16.4;   gz = v[6] / 16.4;     // +-2000 deg/s
}

void scr(const char* a, int sa, String b = "", int sb = 1) {   // small title, big value underneath
  oled.clearDisplay(); oled.setTextColor(WHITE);
  oled.setTextSize(sa); oled.setCursor(0, 6); oled.print(a);
  oled.setTextSize(sb); oled.setCursor(0, 8 * sa + 14); oled.print(b);
  oled.display();
}
void updateScreen() {                  // redraw only when the text changes (I2C is slow in the simulator)
  int key = st * 1000 + (st == 1 ? cd : 0) + (st == 2 ? (ack + 2) * 10 : 0);
  if (key == shown) return;
  shown = key;
  if (st == 0) scr("Monitoring", 2);
  else if (st == 1) scr("Accident detected", 1, String(cd) + " s", 4);
  else if (st == 2) { if (ack < 0) scr("Alert triggered", 1, "Sending", 3); else if (ack == 1) scr("Notification sent", 1, "OK", 4); else scr("Notification", 1, "FAILED", 3); }
  else scr("Alert cancelled", 1, "Safe", 4);
}

void setup() {
  Serial.begin(115200);
  pinMode(BTN, INPUT_PULLUP); pinMode(BUZ, OUTPUT);
  oled.begin(SSD1306_SWITCHCAPVCC, 0x3C); Wire.setClock(400000);
  Wire.beginTransmission(0x68); Wire.write(0x6B); Wire.write(0);    Wire.endTransmission();  // wake MPU6050
  Wire.beginTransmission(0x68); Wire.write(0x1C); Wire.write(0x18); Wire.endTransmission();  // accel +-16 g
  Wire.beginTransmission(0x68); Wire.write(0x1B); Wire.write(0x18); Wire.endTransmission();  // gyro +-2000 dps
  WiFi.begin("Wokwi-GUEST", "", 6);
  while (WiFi.status() != WL_CONNECTED) delay(200);
  mq.setServer("broker.hivemq.com", 1883); mq.setBufferSize(512); mq.setCallback(cb);
}

void loop() {
  if (!mq.connected()) {
    if (mq.connect(("esp" + String(random(99999))).c_str())) {
      const char* sub[] = {"sensor", "mode", "thr", "cancel", "ack"};
      for (auto s : sub) mq.subscribe(tp_(s).c_str());
    } else { delay(500); return; }
  }
  mq.loop();
  if (!virt) readMPU();
  float g = sqrt(ax * ax + ay * ay + az * az), r = sqrt(gx * gx + gy * gy + gz * gz);
  bool ex = g > thG || r > thR;
  sev = constrain((int)((g - 1) * 20 + r / 10), 0, 100);
  if (st == 0 && ex) {                                    // accident detected: snapshot + countdown
    st = 1; t0 = millis(); pg = g; pr = r;
    char b[200]; snprintf(b, sizeof b, "{\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f,\"gx\":%.0f,\"gy\":%.0f,\"gz\":%.0f}", ax, ay, az, gx, gy, gz);
    mq.publish(tp_("evt").c_str(), b);
  }
  if (st == 1) {
    pg = max(pg, g); pr = max(pr, r);
    cd = 15 - (millis() - t0) / 1000;
    setBuzzer((millis() / 250) % 2 == 0);        // beep pattern: 250 ms on / 250 ms off
    if (digitalRead(BTN) == LOW) cancelAlert();
    else if (cd <= 0) {                                   // countdown over -> dashboard fetches location + sends Telegram
      char b[80]; snprintf(b, sizeof b, "{\"pg\":%.2f,\"pr\":%.0f}", pg, pr);
      mq.publish(tp_("alert").c_str(), b);
      st = 2; ack = -1; t0 = millis(); setBuzzer(false);
    }
  }
  if (st == 2 && ((ack >= 0 && millis() - t0 > 3000) || millis() - t0 > 15000) && g < 2) st = 0;  // back to monitoring
  if (st == 3 && millis() - t0 > 3000 && g < 2) st = 0;
  updateScreen();
  if (millis() - tp > 400) {
    tp = millis();
    char b[320];
    snprintf(b, sizeof b, "{\"st\":%d,\"sev\":%d,\"cd\":%d,\"g\":%.2f,\"r\":%.0f,\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f,\"gx\":%.0f,\"gy\":%.0f,\"gz\":%.0f,\"pg\":%.2f,\"pr\":%.0f,\"ex\":%d,\"bz\":%d,\"thG\":%.1f,\"thR\":%.0f}",
             st, sev, st == 1 ? cd : 0, g, r, ax, ay, az, gx, gy, gz, pg, pr, ex, st == 1, thG, thR);
    mq.publish(tp_("status").c_str(), b);
    Serial.printf("%s g=%.2f gyro=%.0f\n", virt ? "VIRT" : "HW", g, r);
  }
}
