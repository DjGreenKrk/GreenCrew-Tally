# Running the Hub on a phone (mobile mode, stage 2 of #19)

Stage 1 (#21) added a **Manual (phone control)** mixer source and a **Control** page so a
phone can set tally states by hand — but the Hub still needed a laptop, mini PC or Raspberry
Pi. This stage removes that: the phone itself becomes the Wi-Fi hotspot *and* runs the Hub, for
a fully self-contained setup (no laptop, no router).

## Android: Hub in Termux

The Hub is plain Node.js, so it runs unmodified in [Termux](https://termux.dev/):

1. Install Termux (F-Droid build; the Play Store build is outdated and unsupported by Termux
   itself) and open it.
2. `pkg install nodejs-lts git` (Node 24, matching `hub/package.json`'s `engines.node`).
3. Get the Hub onto the phone, e.g. `git clone` the repository, or copy the `hub/` folder over
   with a file manager / `termux-setup-storage`.
4. Build and run it like a normal (non-packaged) install — this skips the Windows-only
   `gc-tally.exe` step entirely:
   ```sh
   cd hub
   npm install
   npm run build:frontend   # writes hub/build
   npm run build:backend    # writes hub/dist/server.js
   mkdir -p dist/frontend && cp -r build/* dist/frontend/
   node dist/server.js --env=production   # Hub on http://localhost:3000, tallies on UDP 7411
   ```
   `--env=production` is required here: without it the Hub defaults to development mode and
   tries to proxy the UI to a React dev server on port 3001 instead of serving the built
   `dist/frontend` directly, so the web UI fails to load (a plain `gc-tally.exe` sets this for
   you automatically; running from source like this does not). `PORT=<port> node dist/server.js
   --env=production` picks a different HTTP port.
5. Turn on the phone's Wi-Fi hotspot (2.4 GHz, WPA2 — the ESP8266 cannot join a 5 GHz-only or
   WPA3-only hotspot) and let the ESP8266 tallies and any web tally/control browser join it.
6. Keep the Hub alive in the background: Android stops apps (and Termux's Node process with
   them) to save battery. Run `termux-wake-lock` once in the same Termux session before leaving
   the app (needs the Termux:API add-on, or disable battery optimisation for Termux in Android
   Settings → Apps → Termux → Battery), and consider a dedicated/old phone kept plugged in for
   a running show rather than the operator's daily phone.
7. The native `midi` module (Roland V-8HD mixer) and `nodemcu-tool` (USB flashing, which
   pulls in the native `@serialport/bindings` addon) are listed as `optionalDependencies` in
   `hub/package.json`: if their prebuilt binaries don't cover Android/Termux's `arm64` and the
   fallback native build fails, `npm install` still completes instead of aborting — confirmed
   locally by making `midi`'s native build fail on purpose and re-running `npm install`, which
   finished successfully and left `midi` simply not installed. At runtime the Hub already loads
   both defensively and keeps running without them
   (`hub/src/flasher/NodeMcuConnector.ts`, `hub/src/mixer/rolandV8HD/RolandV8HDConnector.ts`,
   both covered by existing tests) — flashing tallies over USB and the Roland mixer just aren't
   available from a phone, same as they already aren't from any serialport-less environment.
   Every other mixer/source (ATEM, OBS, vMix, Companion, Manual) is unaffected.

`npm run build:windows` / `gc-tally.exe` is Windows-only and not part of this path — Termux
runs the built JavaScript directly with `node`.

## iOS: no background Hub, use a small always-on device instead

iOS does not allow a regular app to keep a server running in the background, so the Hub cannot
run on the iPhone itself. The supported alternative: turn on the iPhone's **Personal Hotspot**
and run the Hub on a small always-on device connected to it — a Raspberry Pi, a travel
router capable of running Node.js, or any spare laptop/mini PC. The phone is then only the
hotspot (and optionally also opens the Control/web tally pages); everything else in this
document about hotspot limits and finding the Hub's address still applies.

## Finding the Hub on a hotspot

With no laptop, there's no fixed IP to write down ahead of time. Phone hotspot subnets vary and
are not always the classic `192.168.1.x`:

- Android hotspots commonly use `192.168.43.1` as the phone's own (gateway) address, though
  some Android versions randomise the subnet. On the Android setup in this document the phone
  is both the hotspot *and* the device running the Hub, so the gateway address **is** the Hub.
- An iPhone Personal Hotspot uses `172.20.10.1` for the phone — but on the iOS setup in this
  document the phone is only the hotspot; the Hub runs on a separate Raspberry Pi/travel
  router/laptop, which gets its own DHCP-assigned address on the hotspot's subnet, not
  `172.20.10.1`. **The gateway address is the iPhone, not the Hub**, on this setup — check that
  device's own Wi-Fi/network settings for its address, or give it a static/reserved IP.

- **Firmware v2 tallies** already look for the Hub automatically over mDNS when `hub.ip` is
  left empty (#28). Some Android hotspots filter multicast traffic, which breaks mDNS even
  though the Hub is otherwise reachable; after 3 consecutive failed mDNS searches a v2 tally
  now also tries the network's default gateway as a guess for the Hub's address, logging
  `No hub found via mDNS; trying the Wi-Fi gateway <ip> as a guess` once and then keeping that
  guess refreshed to the current gateway in the background. This fallback only helps the
  **Android** setup, where the gateway genuinely is the Hub; on the **iOS** setup it would guess
  the iPhone itself, not the Raspberry Pi/travel router actually running the Hub, so it won't
  find the Hub there. mDNS keeps retrying in the background regardless and takes over again the
  moment it actually finds a Hub (e.g. after the Hub starts later, or on a network where
  multicast does work).
- **Legacy NodeMCU tallies** have no such fallback; set `hub.ip` by hand on the Flash page to
  the Hub's actual address — the hotspot's gateway address on the Android setup, or the
  Raspberry Pi/travel router's own address (not the iPhone's) on the iOS setup.

## Hotspot limits

- Phone hotspots usually cap out around 8–10 connected clients — plan the number of tallies
  and control devices accordingly.
- The ESP8266 only supports 2.4 GHz Wi-Fi and WPA2 (no WPA3-only networks); make sure the
  hotspot isn't forced to 5 GHz-only or WPA3-only in its advanced settings.

## Not yet verified

This stage has not been tested on a real Android phone (Termux) or a real iPhone hotspot —
only the Hub's own native-module fallback behaviour (unit/integration tests) and the firmware's
gateway-fallback logic (`pio test -e native`) are covered so far. Packaging the Hub as a
prebuilt Linux/arm64 binary (the other option named in #22, alongside running it from source in
Termux) is not attempted here.
