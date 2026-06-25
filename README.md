# SATAN v1.0.0

Universal Serial Monitor for ESP32 Microcontrollers

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](#license)
[![Platform](https://img.shields.io/badge/Platform-ESP32-blue.svg)](#)
[![Version](https://img.shields.io/badge/Version-v1.0.0-green.svg)](#)

---

## Overview

SATAN (Serial Access Terminal & Analysis Node) is a universal web-based serial monitor and controller designed for ESP32-based microcontroller projects. It establishes a connection via the WebSerial API, providing real-time serial logging, OLED display mirroring, hardware tool controls, and remote device management directly from a supported browser environment. 

This architecture enables a purely client-side application requiring no local installation, system drivers, or local software dependencies.

## Features

- Real-time Serial Monitor: Live serial logging with categorized tagging, timestamps, and log level filtering.
- OLED Display Mirroring: Real-time rendering of the connected device's 128x64 OLED screen via canvas interpolation.
- Remote Control Interfaces: Integrated controls for IR protocols, debugging interfaces, and directional pad navigation.
- Hardware Management: Device reset, software reboot, and connection state management.
- WebSerial Integration: Driverless serial communication via Chromium-based browsers.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Build System | Vite 6 |
| Serial Interface | WebSerial API |

---

## Development Roadmap

The following visual roadmap outlines the planned development phases and upcoming feature integrations. Updates will be published incrementally as they achieve stability.

```mermaid
timeline
    title SATAN Development Roadmap
    section v1.0.x
        Initial Release : Core WebSerial Monitor
                        : OLED Mirroring
                        : Basic Control Interfaces
    section v1.1.x
        Firmware Flashing : WebSerial Bootloader Protocol Integration
                          : Drag-and-drop .bin deployment
    section v1.2.x
        Universal Support : Modular Device Profiles
                          : Dynamic UI Generation based on hardware
    section v1.3.x
        Data Analysis : Persistent Local Storage Logging
                      : Data Export features (CSV/JSON)
    section v2.0.x
        AI Integration : Automated log analysis via AI API
                       : Anomaly detection and pattern recognition
                       : Backend API Deployment
```

---

## Author

mxsourav

## License

MIT License
