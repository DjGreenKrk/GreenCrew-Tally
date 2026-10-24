# Unreleased

* [DEV] The Hub server runs on Express 5 and Socket.IO 4 (was Express 4, Socket.IO 2); the dev proxy uses http-proxy-middleware 3. Nothing changes for users; the browser and the Hub must come from the same version, which the release ZIP always guarantees (#9)

# GC Tally 1.0.0-rc.1

First release candidate of GC Tally 1.0: the first version that is fully GreenCrew Tally, with its own look, two languages and phone support. Companion module unchanged (0.8.0).

* [CHANGE] Empty and loading states on the Tallies, Control and log pages say what to do next; removing a tally asks for confirmation; touch targets are at least 44 px (#36)
* [FEATURE] Phones get a bottom navigation bar (Tallies, Control, Configuration, Flash); a "no connection to the Hub" banner now shows on every page (#34)
* [CHANGE] GreenCrew look for the Hub: black background, GreenCrew green for main actions and the current page, bundled Roboto font (works offline, Polish letters), smaller headings, rounded corners; tally state colours are unchanged (#33)
* [CHANGE] The Hub UI runs on React 19, React Router 7 and MUI 9 (was React 17, Router 5, Material-UI 4); the look and the URLs are unchanged (#8)
* [FEATURE] The Hub UI is bilingual: Polish by default, English with the PL | EN switch in the menu bar or on the About screen; the choice is remembered per browser (#37)
* [FEATURE] About screen: click the logo in the menu bar for the version, author, GreenCrew, licence, repository and the credits to vTally and kuuminsh/wifi-tally (#35)
* [BUGFIX] Switching away from the Roland V-8HD mixer on a computer without MIDI no longer stops the Hub
* [DEV] The browser tests (Cypress 16) run in CI again; they found the Roland bug (#10)

# GC Tally 0.8.0

* [FEATURE] Manual control without a vision mixer (#21, stage 1 of #19): choose **Manual (phone control)** in Configuration, name the channels, and set each one to Off / Preview / AUX / Program on the new **Control** page, e.g. from a phone in the same network. Flash calls attention on the patched tallies; All off clears every channel. Channels are added, removed and renamed in Configuration → Manual (one name per line, up to 32). The setting **Only one channel on Program** (also there) turns the previous Program channel off when another one goes to Program. Changing the channels or the switch does not blink the lights; the states are cleared when the Hub restarts.
* [CHANGE] The menu bar fits on a phone screen
* [CHANGE] Companion module 0.8.0 (version only)

# GC Tally 0.7.0

* [FEATURE] ATEM: inputs on the aux outputs light the tallies in the AUX state; an aux showing a M/E output counts every input visible in it
* [CHANGE] ATEM: the default IP is the switcher factory default 192.168.10.240; the settings explain where to find the IP
* [CHANGE] atem-connection 3.10.3 (the version used by the current Companion ATEM module)
* [FEATURE] OBS: connects to OBS Studio 28+ through its built-in WebSocket server (obs-websocket 5) with an optional password; obs-websocket 4 is no longer supported. Default port 4455; a saved old default 4444 moves to 4455, any other port is kept
* [BUGFIX] OBS: during a transition the target scene is on air from its start (OBS 28+ reports the scene change only at the end)
* [FEATURE] OBS: scenes nested more than one level deep are on air too; a hidden nested scene is not
* [BUGFIX] Companion module 0.7.0 (includes 0.6.2): a Program, Preview or AUX source that is not a camera (graphics, media, multiview) means "no camera on that bus" instead of stopping the heartbeat, which turned every tally UNKNOWN
* [DEV] `hub/scripts/atem-simulator.cjs` and `hub/scripts/obs-simulator.cjs`: a fake ATEM switcher and a fake OBS for testing without hardware; `hub/scripts/check-live-atem.cjs` and `hub/scripts/check-live-obs.cjs` check a real ATEM and OBS

# GC Tally 0.6.1

* [FEATURE] Companion LAN access token is generated, shown and copied in the Hub under Configuration → Companion (HTTP); it is visible only in a browser on the Hub computer. `VTALLY_COMPANION_TOKEN` still works and takes precedence
* [BUGFIX] The Companion settings no longer claim "localhost only"; the page shows the Hub IP addresses to enter in Companion

# GC Tally 0.6.0 (GreenCrew Tally)

First release under the GreenCrew Tally name. Based on kuuminsh/wifi-tally v0.5.3-kuuminsh.1, itself a fork of vTally by Christian Zenker.

* [FEATURE] AUX tally state (orange; cyan in Yellow-Pink), priority Program > AUX > Preview, optional on the stage light
* [FEATURE] Bitfocus Companion 5 module "GreenCrew Tally" 0.6.0 and Companion HTTP source with heartbeat, UNKNOWN on timeout and LAN token
* [FEATURE] WS2812B 4x4 matrix lights (ESP8266 D1 Mini)
* [FEATURE] Flasher: serial port choice, FTDI adapters, reliable upload of precompiled bytecode, verified on ESP8266 hardware
* [FEATURE] Windows ZIP with first-flash script (esptool + NodeMCU image), Companion module and a step-by-step guide
* [CHANGE] Idle state is off by default (dim green was mistaken for Preview)
* [CHANGE] Hub runs on Node.js 24 with TypeScript 6, ESLint 10, Jest 30 and Vite
* [BUGFIX] Busy HTTP/UDP ports are explained at startup instead of crashing the EXE
* [BUGFIX] A lost vMix connection no longer stops the Hub (after 10 minutes of retries it stays disconnected until the Hub is restarted or the mixer re-selected)

# Upcoming

* [BUGFIX] Don't suggest vMix is connected until a hello message is received and tally subscription was acknowledged #85
* [BUGFIX] The logs where written with the path segment `vally-electron`, missing a `t` that is essential to our name. It is now fixed an the files are now:
  * **on Linux**: ~/.config/vtally-electron/logs/main.log
  * **on macOS**: ~/Library/Logs/vtally-electron/main.log
  * **on Windows**: %USERPROFILE%\AppData\Roaming\vtally-electron\logs\main.log

# v0.5.1

* [BUGFIX] Atem did not work when using the Electron distribution #78
* [FEATURE] Improved support when editing scenes in OBS #87 (Thanks, @Fuechschen)
* [FEATURE] When using the Electron distribution, logs are written to a file (please note that the path of the files is wrong in this release and called `vally` instead of `vtally` #93 ):
  * **on Linux**: ~/.config/vally-electron/logs/main.log
  * **on macOS**: ~/Library/Logs/vally-electron/main.log
  * **on Windows**: %USERPROFILE%\AppData\Roaming\vally-electron\logs\main.log

# v0.5.0

Code on the Tally did not change.

* [BREAKING] way of installation has changed. We ship platform specific executables now.
  See [Download Instructions](https://wifi-tally.github.io/download.html) for details.
* [FEATURE] support for Roland V-8HD and V-60HD. Thanks @JWandscheer #58
* [FEATURE] The project got a new name and a logo. Say hello to `vTally` and enjoy the new logo in the GUI.
* [FEATURE] experimental support to edit `tally-settings.ini` and flash the code from the Hub via USB
* [FEATURE] The hub automatically tries to restart in case it crashes. Consider this a safety net: It should never be necessary
  – if it is, please file an issue – but there might be cases where it helps.
* [FEATURE] All releases are published to [npmjs.com](https://www.npmjs.com/package/vtally)

# v0.4.2

A minor feature and maintenance release.

Code on the Tally did not change from `v0.4.1`.

* [ADDED] allow to dim operator light to 1% brightness #57
* [CHANGED] npm dependencies of the hub updated

# v0.4.1

A minor feature and bugfix release.

You only need to update the code on the Tally if you plan on using the new feature
that supports red-green-blue WS2812 light.

* [ADDED] the dim green light for the operator, that indicates the tally is working, can be turned off #50
* [ADDED] support WS2812 leds with red-green-blue order #52
* [CHANGED] npm dependencies of the hub updated
* [BUGFIX] add `init.lua` to the release package. For some reason it got lost along the way

# v0.4.0

**IMPORTANT**: Code on the Tally **HAS** changed. Tallies and the Hub will not be able to communicate
unless you also update the `.lc` files on the Tallies.

* [BREAKING] The protocol between Tally and Hub has been modified. The hub now sends specific information on what colors to show. This step was necessary because we reached the memory limit on NodeMCU with the newly added features.
* [ADDED] Tallies can use a pink-yellow color scheme to be better distinguishable for people with a red-green weakness (Protanopia, Deuteranopia)
* [ADDED] Tallies can be dimmed and the stage light can be turned off completely
* [ADDED] Tallies have an option to hide preview state on the stage light.
* [ADDED] All of the settings above can be changed for ALL Tallies or on a per-Tally basis.
* [ADDED] OBS support to only show on-air status when actually recording or streaming. The Tally Lights will show up as "in preview" when this is not the case.

# v0.3.0

A feature release.

Code on the Tally did not change. If you are doing an upgrade there is no need to
modify the Tallies.

* [ADDED] The Hub allows to turn any device with a browser into a Tally Light ("Web Tally")
* [CHANGED] We recommend updating Node.js to version `14`. The hub will still run with Node.js `12` in the foreseeable future though.
* [CHANGED] Documentation has been cleaned up and the Getting Started Guide has a different order now

# v0.2.1

* [BUGFIX] Tallies and their configuration are stored again

# v0.2.0

There have been numerous technical changes on the hub and the way the release
is built under the hood. One of the results is, that the release packages are now
significantly smaller. We made sure that nothing broke, but if you spot anything
please report it.

Code on the Tally did not change. If you are doing an upgrade there is no need to
modify the Tallies.

* [ADDED] Support for OBS added #27
* [CHANGED] the release size has been reduced significantly. This should speed up download and extraction by a magnitude
* [CHANGED] replaced the UI framework (from bootstrap to MaterialUI). There are some minor changes in the UI, but the general flow stayed the same
* [CHANGED] npm dependencies of the hub updated
* [OTHER] TravisCI, the service we used to build the release packages, has basically discontinued its Open Source support. So the release is now built with Github Actions. This is nothing that you would see when using the software, but still worth mentioning.

# v0.1.0

* [BREAKING] location where the hub stores its configuration has been changed from `hub/config.json` to `$HOME/.wifi-tally.json` #21
* [BREAKING] Pins for Stage Light have been moved from `D2-D4` to `D1-D3`
* [BREAKING] The firmware is no longer part of the repository and will be built on Travis. If you need a firmware for development, get it from the latest release. #25
* [BREAKING] The firmware needs to be updated as the `ws2812` module was added
* [FIXED] prevent hub from crashing on invalid message #19
* [FIXED] hub does boot even if the configuration is empty
* [ADDED] Support for vMix added #12
* [ADDED] the hub does not use generic channel names (like `Channel 1`) if the video mixer has a name configured
* [ADDED] the channel drop-down in the hub is limited to the number of channels supported by the video mixer
* [ADDED] the web page shows if it has lost connection to the hub and reloads #20
* [ADDED] allow the use of LEDs with common cathode #31
* [ADDED] allow the use of WS2812 strips, NeoPixel and the like #29
* [ADDED] better log if it looks as if Atem rejected a connection #16
* [CHANGED] use cross-env to allow hub to run on windows #18
* [CHANGED] npm dependencies of the hub updated
* [CHANGED] firmware version of the tally updated
* [CHANGED] tallies that are not patched in the hub now do not show the "video mixer not connected" error

# v0.1-alpha4

* [FIXED] Compiled `lc` files in the release are working again. #24
* [ADDED] The hub shows indications if the video mixer is connected. #15

# v0.1-alpha3

* [BREAKING] The tallies name is trimmed to `26` characters.
* [BREAKING] Pinout of the tally was changed. See updated documentation. #5
* [FIXED] Following links on the hub is now possible when using the web interface on the machine that runs the hub #1
* [FIXED] Tally sanitizes its hostname if it contains spaces or is longer than 32 characters
* [ADDED] Tally logs the boot reason when starting. This could help determine if the tally crashed (which it never does of course ;) ) or the wifi signal was lost
* [ADDED] Tally buffers up to 10 log messages if the hub is not available. This helps detecting issues once the wifi connection is re-established.
* [ADDED] A separate LED can be used for the operator light on the tally #2
* [ADDED] the operator light is dimly glowing green when everything is connected, but the camera is neither on preview nor program. #7
* [ADDED] the NodeMCU onboard LED indicates if the board is powered and the code started
* [ADDED] Tally indicates if the settings.ini is invalid by blinking blue #11
* [CHANGED] Tally reconnects faster to wifi (`200ms`) when auth timed out, because it indicates low signal strength
* [CHANGED] Logs are better categorized as info, warning and error
