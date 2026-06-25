# SATAN v1.0.0

> Universal Serial Monitor for ESP32 Microcontrollers

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](#license)
[![Platform](https://img.shields.io/badge/Platform-ESP32-blue.svg)](#)
[![Version](https://img.shields.io/badge/Version-v1.0.0-green.svg)](#)

---

## Overview

**SATAN** (Serial Access Terminal & Analysis Node) is a universal web-based serial monitor and controller designed for all ESP32-based microcontroller projects. It connects to your ESP32 over WebSerial, providing real-time serial logging, OLED display mirroring, IR tool controls, and remote device management — all from your browser.

Built to work with **any ESP32 project**, not just one device.

---

## Features

- **Real-time Serial Monitor** — Live serial log with color-coded tags, timestamps, and log level filtering
- **OLED Display Mirroring** — See your device's 128×64 OLED screen live in the browser via canvas rendering
- **IR Tools Control** — IR Jammer, IR Receiver, and IR Remote controls directly from the dashboard
- **D-Pad Navigation** — Virtual D-pad for remote button input (UP, DOWN, LEFT, RIGHT, OK, BACK)
- **OLED Customization** — Color presets (Cyan, Green, Yellow, White, Red, Purple), brightness slider, display invert
- **Device Management** — Connect, Disconnect, and Reboot buttons
- **WebSerial API** — No drivers, no software — just plug in and open in Chrome

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Build | Vite 6 |
| Serial | WebSerial API |
| Icons | Lucide React |
| Animations | Motion |

---

## Run Locally

```bash
# Clone
git clone https://github.com/mxsourav/SATAN.git
cd SATAN

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:3000` in Chrome, plug in your ESP32, and click **CONNECT**.

---

## Author

**mxsourav**

---

## License

MIT License
