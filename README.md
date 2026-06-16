# Project Projection

A WebXR-based AR sandbox for projectile physics. Point your phone at the floor, place a launcher, set angle + velocity, and throw a ball along the predicted parabolic trajectory. A floating data card stays attached to the ball with live velocity, height, distance, time, and more.

> Built with **Three.js + Vite + TypeScript** targeting the **WebXR Device API** (`immersive-ar` with `hit-test`, `dom-overlay`, optional `hand-tracking`).

## Run it

```bash
npm install
npm run dev
```

The dev server uses `@vitejs/plugin-basic-ssl` to serve HTTPS with an in-process self-signed cert (WebXR refuses HTTP, even on localhost for AR features). Your browser will show a cert warning on first connect — tap *Advanced → Proceed*.

The server binds to `0.0.0.0:5173` so a phone on the same Wi-Fi can connect via the LAN URL printed in the terminal, e.g. `https://192.168.1.42:5173/`.

> The npm scripts invoke `vite` and `tsc` via `node ./node_modules/.../bin.js` rather than the usual bare-name lookup. That's because the workspace folder name contains `:`, which collides with the POSIX `PATH` separator and breaks npm's normal bin-path injection. Direct invocation sidesteps it.

## Device matrix

| Device | Browser | Camera AR | Hand tracking |
| --- | --- | --- | --- |
| Android phone | Chrome (with ARCore) | ✅ | ❌ |
| Meta Quest 2/3/Pro | Meta Quest Browser | ✅ (passthrough) | ✅ |
| Apple Vision Pro | Safari | ✅ | ✅ |
| Desktop Chrome | — | ❌ (shows fallback message) | — |

Hand tracking auto-activates when an `XRHand` is detected on any input source. On phone-only sessions the fist gesture pill stays hidden.

## How to use

1. Open the dev URL on a compatible device.
2. Tap **Enter AR**. The first time on a phone you'll have to accept the self-signed cert warning.
3. Slowly point the camera at the floor or a table. A blue ring (reticle) will appear when a surface is detected.
4. **Tap the screen** to place the launcher at the reticle. The launch arrow auto-aims away from you.
5. Drag the **Angle** and **Velocity** sliders. The dashed predicted trajectory updates live.
6. Tap **Throw**. The ball flies along the path; a floating data card follows it.
7. Tap **Retrieve Ball** to reset. On a hand-tracking headset, holding a closed fist in view for ~0.4 s does the same.

## Architecture

```
src/
  main.ts                 # WebGL/CSS2D renderers, ARButton, animation loop
  physics/projectile.ts   # Pure kinematic simulation + sampling helpers
  xr/hitTest.ts           # XRHitTestSource lifecycle
  xr/handTracking.ts      # Fist gesture detector (fingertip-to-wrist distances)
  scene/reticle.ts        # Flat ring at the hit-test pose
  scene/launcher.ts       # Launch pad + angle arrow group
  scene/trajectory.ts     # Dashed predicted-path line + landing marker
  scene/ball.ts           # Projectile sphere
  scene/dataLabel.ts      # Floating HTML data card via CSS2DRenderer
  ui/state.ts             # Tiny event-emitter state store
  ui/overlay.ts           # DOM bindings (sliders, button, status pill)
  styles.css              # Mobile-first overlay styling
```

### Coordinate convention

The launcher root is placed at the hit-test pose, then rotated about Y to face away from the viewer. All projectile math and child meshes use the launcher's local frame:

- **+X** → horizontal forward (throw direction)
- **+Y** → world up
- **+Z** → unused (sideways)

This keeps the physics 2D and lets us cache the simulation as `Array<{ x, y, t, vx, vy }>`.

### Physics

Plain gravity-only kinematics, no drag:

$$
x(t) = v_0 \cos\theta \cdot t,\qquad y(t) = v_0 \sin\theta \cdot t - \tfrac{1}{2} g t^2
$$

Simulated at 50 Hz up to `t = 4 s` (or until landing). See [src/physics/projectile.ts](src/physics/projectile.ts).

## Troubleshooting

- **"WebXR AR is not available"** on the splash screen — your browser/device doesn't expose `immersive-ar`. Use Android Chrome on an ARCore-supported phone, or a headset browser.
- **Phone shows a cert warning** — expected with the in-process self-signed cert. Tap *Advanced → Proceed*. To avoid it, tunnel with `ngrok http https://localhost:5173` for a real trusted URL, or deploy a preview build (Vercel/Netlify).
- **No reticle appears** — move the phone slowly, scan the floor or a textured surface. Featureless white walls/floors won't track.
- **Hand-pill never shows on a headset** — confirm the browser granted `hand-tracking` (check the browser's session permission dialog).
