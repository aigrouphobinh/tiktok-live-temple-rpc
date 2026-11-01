# Temple 3D visual audit

The `Temple 3D visual audit` GitHub Actions workflow captures the 9:16 OBS scene in headless Chromium so visual changes can be reviewed without depending on a developer's local server.

## Run

The workflow runs when relevant `public/**` files change, on pull requests targeting `main`, or manually from GitHub Actions after this workflow has been merged to the default branch.

It starts the application server on the Actions runner and opens:

```text
/?obs=1&3d=1
```

The capture viewport is exactly `1080 × 1920`. Playwright waits for `window.__TEMPLE_3D_READY__ === true`, verifies that the canvas is visible and that the WebGL context is not lost, then captures the portrait stage and full viewport.

## Artifacts

Each run uploads `temple-3d-visual-audit` for seven days:

- `temple-3d-portrait.png` — clean 9:16 OBS stage.
- `temple-3d-full-page.png` — full viewport capture.
- `temple-3d-visual-report.json` — readiness, viewport, WebGL, console errors, and failed network requests.
- `temple-server.log` — server startup diagnostics.

## Isolated server mode

The workflow sets two optional environment variables:

- `DISABLE_TIKTOK_AUTOCONNECT=1` prevents the test server from connecting to the default TikTok room.
- `DISABLE_ZEROTTS_WORKER=1` skips the optional Python speech worker.

Both features retain their normal startup behavior when these variables are not set. The flags keep the visual audit isolated from external services and Python model dependencies.

## What this verifies

- The application server serves the real page and assets.
- The 3D scene reaches its ready state.
- WebGL 2.0 is available and the scene canvas is visible at the expected dimensions.
- The browser reports console errors and failed requests in the downloadable report.

This is a software-rendered Chromium smoke test. It does not validate physical GPU drivers, OBS Browser Source behavior on a production machine, audio/TTS quality, TikTok connectivity, or the visual quality of every frame on all devices. Review the screenshot artifact before changing camera framing, model placement, or architectural coordinates.


## Physical-device frame-time benchmark

Use the real live scene on the target phone or tablet; do not treat the Chromium visual-audit profiles as device measurements.

1. Serve the current build over HTTPS or a trusted local development origin and open the OBS scene URL with `?obs=1&3d=1&stats=1`.
2. Keep the device plugged in, disable battery-saver mode, close unrelated heavy apps, and allow the device to reach a stable temperature. Record device model, OS/browser version, screen refresh rate, and whether the page is foregrounded.
3. Let the scene warm up for 30 seconds. Capture at least three 60-second windows for each scenario: idle scene, sustained gift activity, and a combined ritual/gift sequence. Reload between render-tier changes; record the tier and pixel ratio reported in the diagnostic line.
4. In the browser remote-debugging console, collect the `[Temple3D] GPU frame stats` entries. Each five-second sample includes `observedFps`, `frameTimeP50Ms`, `frameTimeP95Ms`, and `frameSamples`, alongside draw calls, triangles, geometry/texture counts, active effects, and pixel ratio.
5. Report the median of the window-level P95 frame times across the three runs, plus the worst window, device temperature/throttling observations, and any WebGL context loss. The scene is capped at 30 FPS, so a stable target frame interval is approximately 33.3 ms; frame-time P95 above 50 ms indicates sustained missed-frame pressure and should be investigated.

Each five-second diagnostic window also reports `sampleWindowMs` and `sampleQuality`. P50/P95 are emitted as `null` with `sampleQuality: 'insufficient'` until the window spans at least 4 seconds and contains at least 30 frame intervals. Treat `observedFps` as a window-level cadence estimate; do not interpret percentiles from insufficient windows or very small sample counts.

The interval metric is measured between rendered frames, so it includes time spent rendering the previous frame and skipped animation-frame callbacks. It is a practical end-to-end browser frame cadence indicator, not a GPU-only timer. The five-second samples are bounded to 300 intervals and are emitted only when `stats=1`; normal live sessions do not collect or log these diagnostics. Browser/device memory values and temperature are not exposed consistently across mobile browsers, so record those from the OS or device tooling where available.
