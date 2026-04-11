# Offline Routes

A simple, privacy-first PWA for cyclists who want basic navigation and radar awareness without the overhead of a dedicated head unit or ride-tracking app. Upload a GPX route, cache map tiles for offline use, pair a Garmin Varia radar over Bluetooth, and ride. No accounts, no cloud sync, no ride recording — just turn-by-turn visibility for soul rides.

## Privacy First

Everything runs entirely on your device:

- **No server, no accounts** — the app is static HTML/JS served from a CDN. There is no backend.
- **All data stays in IndexedDB** — routes, cached map tiles, and paired device info are stored locally in the browser. Nothing leaves your phone.
- **No analytics or tracking** — zero third-party scripts, no telemetry, no cookies.
- **BLE connections are local** — Bluetooth device pairing uses the Web Bluetooth API directly between your browser and the device. No data is relayed.

If you clear your browser data, everything is gone. That's by design.

## Running Locally

Requires [Node.js](https://nodejs.org/) (v18+) and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm dev
```

The dev server runs at `localhost:5173`. BLE pairing requires Chrome/Edge (Web Bluetooth is not supported in Safari or Firefox).

To build for production:

```bash
pnpm build
pnpm preview
```

## Contributing

1. Fork the repo and create a branch
2. `pnpm install && pnpm dev` to get running
3. Make your changes — `pnpm lint` and `pnpm build` should pass clean
4. Open a PR against `giggity`

No test framework is set up yet, so manual testing is the current bar. If you're adding a new BLE device type, the extension point is `BLE_DEVICE_CONFIGS` in `src/lib/ble.ts`.
