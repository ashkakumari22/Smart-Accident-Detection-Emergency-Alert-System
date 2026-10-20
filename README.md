# Smart Accident Detection & Emergency Alert System

An ESP32-based system that spots a probable road accident from motion data, gives the driver 15 seconds to cancel it, and if nobody cancels, sends the location to an emergency contact on Telegram.

You can't crash a car in a lab, so the whole thing runs as a simulation. The ESP32 circuit and firmware run in the [Wokwi](https://wokwi.com) simulator and talk over MQTT to a browser dashboard with a 3D vehicle simulation, live sensor charts, a map and an event log. The sensor values the firmware analyses come from the 3D crash model, so the detection you see on screen is driven by data and not by a scripted animation.


## How it works

The system follows four steps: **Detect → Verify → Locate → Alert.**

1. **Detect.** The firmware reads three-axis acceleration and angular velocity and computes the totals. If total acceleration is above 3 g or total angular velocity is above 300 °/s, it declares a possible accident. Both thresholds can be changed from the dashboard.
2. **Verify.** A buzzer starts beeping and the OLED shows a 15-second countdown. Pressing the push button (or the Cancel button on the dashboard) cancels the alert and the system goes back to monitoring.
3. **Locate.** If the countdown reaches zero, the dashboard asks the browser for its location through the Geolocation API.
4. **Alert.** The dashboard sends a Telegram message with the peak values, coordinates and a Google Maps link, then reports the result back to the ESP32 so the OLED shows "Notification sent" or "FAILED".

```
a_total = sqrt(ax² + ay² + az²)          [g]
w_total = sqrt(wx² + wy² + wz²)          [deg/s]
accident if  a_total > 3 g  or  w_total > 300 deg/s
severity = clamp(20·(a_total − 1) + w_total/10, 0, 100)
```

The message looks like this:

```
ACCIDENT ALERT
Vehicle: VEH-001
Detected: <time>
Peak: <g> g, <deg/s> deg/s
Location: <lat>, <lon> (+-<accuracy> m)
https://maps.google.com/?q=<lat>,<lon>
```

## Architecture

```
 Wokwi (ESP32 + MPU6050 + OLED + button + buzzer)
        ^  |
  sensor|  |status / evt / alert
        |  v
   Public MQTT broker (HiveMQ)
        ^  |
        |  v
 Browser dashboard (3D sim, charts, map, history)
        |
        +--> Geolocation API  (device location)
        +--> Telegram Bot API (alert message)
```

The firmware has four states: Monitoring (0), Countdown (1), Alert sent (2) and Cancelled (3).

### MQTT topics

All topics sit under the prefix `MET_project_2026/`. The prefix in `sketch.ino` and in the dashboard's `config.js` must match.

| Topic | Direction | Payload |
|---|---|---|
| `sensor` | dashboard → ESP32 | `ax,ay,az,gx,gy,gz` (g and °/s), every 200 ms |
| `mode` | dashboard → ESP32 | `1` = use dashboard values, `0` = use the MPU6050 part |
| `thr` | dashboard → ESP32 | acceleration and gyro thresholds |
| `cancel` | dashboard → ESP32 | software push button |
| `ack` | dashboard → ESP32 | `1` = Telegram delivered, `0` = failed |
| `status` | ESP32 → dashboard | JSON with state, severity, countdown, readings, peaks, buzzer (every 400 ms) |
| `evt` | ESP32 → dashboard | sensor snapshot at the moment of detection |
| `alert` | ESP32 → dashboard | peak acceleration and rotation when the countdown ends |

## Hardware

| Component | Role | Interface |
|---|---|---|
| ESP32 DevKit | Main controller, Wi-Fi, MQTT | — |
| MPU6050 | Accelerometer and gyroscope (±16 g, ±2000 °/s) | I²C, 0x68 |
| SSD1306 OLED (128×64) | Status and countdown | I²C, 0x3C |
| Push button | Cancel a false alarm | GPIO4 (internal pull-up) |
| Buzzer | Warning tone (2 kHz, 250 ms on/off) | GPIO5 |
| NEO-6M GPS | Planned for a physical build, not used in the simulation | UART |

I²C uses SDA on GPIO21 and SCL on GPIO22 at 400 kHz.

## Repository contents

```
index.html, style.css      Dashboard page and styling
config.js                  Topic prefix, broker, Telegram settings
mqtt.js                    MQTT link
ui.js                      Panels and event history
alert.js                   Alert handling, geolocation, Telegram
charts.js                  Live charts
scene.js, car.js           three.js scene and vehicle model
main.js                    Vehicle physics and wiring
sketch.ino                 ESP32 firmware (Wokwi)
diagram.json               Wokwi circuit
```

## Running it

You need Chrome or Edge, a Wokwi account (free), and a Telegram account.

### 1. Telegram bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram, send `/newbot` and follow the prompts. Copy the access token.
2. Open your new bot, press **Start** and send it any message.
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and find your chat ID in the response.
4. Put the token and chat ID in `config.js`.

Keep the token private. Don't commit it, and add `config.js` to `.gitignore` or use a placeholder in the public repo.

### 2. Firmware

1. Create a new ESP32 project on Wokwi.
2. Replace `sketch.ino` and `diagram.json` with the files from this repo.
3. Add the libraries `PubSubClient`, `Adafruit GFX Library` and `Adafruit SSD1306`.
4. Start the simulation.

### 3. Dashboard

Geolocation only works on `localhost` or HTTPS, so serve the folder locally instead of opening the file directly:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`, allow location access when the browser asks, and check that the MQTT and ESP32 chips in the header turn green.

If the dashboard stays offline, your network is probably blocking the broker's WebSocket port (8884). A mobile hotspot fixes it.

## Using the dashboard

| Button | What it does |
|---|---|
| Trigger crash | Car hits a barrier at 72 km/h, peaks around 25 g. Let the countdown run out to send the alert. |
| Sudden brake / swerve | Near miss with no contact. Values go above the thresholds, so the countdown starts. Cancel it to see the false-alarm path. |
| Low-impact event | About 2 g and 40 °/s. Stays below the thresholds and logs as "below threshold". |

## Results

Tested in Wokwi with the dashboard on localhost, thresholds at 3 g and 300 °/s, and a 15-second countdown.

| Test | Result |
|---|---|
| Normal driving | Stays in Monitoring, no countdown |
| Low-impact (about 2 g) | No countdown, logged as below threshold |
| Collision, no cancel | Countdown, alert, Telegram message delivered |
| Collision, cancel | Buzzer stops, nothing sent |
| Sudden brake, cancel | Counts as a false alarm, driving resumes |
| Second run after cancel | Detects again after automatic reset |

Three collision runs gave peaks of 26.3–26.7 g and 342–407 °/s, and each one delivered a Telegram alert with coordinates and a Maps link. The 26 g figure matches the model: 20 m/s stopping in 0.08 s is about 250 m/s², or roughly 25.5 g.

## Limitations

- Sensor values come from a simplified physics model. The 3 g and 300 °/s thresholds are starting values and haven't been calibrated against real driving or crash data.
- The simulated peaks go past the ±16 g range set on the MPU6050. A real sensor would clip them.
- The location is the browser's, so on a laptop it comes from Wi-Fi and IP and was off by about 108–124 m in testing. It is the dashboard device's position, not a vehicle's GNSS fix.
- The Telegram message is sent by the dashboard, not the ESP32, so the page has to stay open.
- The public MQTT broker has no authentication, and the Telegram token sits in a local config file.
- Detection-to-delivery latency wasn't measured. Wokwi doesn't run in strict real time and Telegram timestamps only have minute resolution.
- Alerts go to one predefined contact, not to hospitals or emergency services.

## Future work

- Read a NEO-6M GNSS module over UART for a real satellite position.
- Add orientation change, post-impact motion and speed drop to the detection rule, and later try a small TinyML classifier.
- Calibrate thresholds from logged real driving data and measure the false-alarm rate.
- Add a GSM/LTE module so alerts work without Wi-Fi, and send them from the ESP32 itself.
- Use TLS and per-device credentials for MQTT, and keep tokens on a server.
- Notify hospitals or the 112 service directly, but only once the false-alarm rate is known to be low.

## Built with

ESP32 (Arduino framework), PubSubClient, Adafruit GFX/SSD1306, Wokwi, HiveMQ public broker, mqtt.js, three.js r128, Chart.js 4.4.1, Leaflet 1.9.4, Telegram Bot API, browser Geolocation API.




