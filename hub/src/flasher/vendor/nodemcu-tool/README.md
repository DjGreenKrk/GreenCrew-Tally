# Vendored from nodemcu-tool

This directory is a trimmed, in-repo copy of the Lua-REPL connector logic
from [wifi-tally/NodeMCU-Tool](https://github.com/wifi-tally/NodeMCU-Tool)
(itself a fork of [AndiDittrich/NodeMCU-Tool](https://github.com/AndiDittrich/NodeMCU-Tool)),
MIT licensed — see `LICENSE.md`.

## Why vendored instead of depended on

The fork pins `serialport@^8`, long unmaintained and years behind current
Node.js. Every file here talks only to `transport/serialport.js`'s small
promise-wrapped API (`connect`, `disconnect`, `write`, `set`, `flush`,
`drain`, `list`, `isConnected`) and knows nothing about the `serialport`
package's own API, so only that one file needed porting to `serialport`
13's class-based API (`SerialPort`, `DelimiterParser` instead of a
constructor function with a `.parsers` namespace, `{path, baudRate}`
instead of a positional path argument). Everything else is copied
unmodified from the upstream fork (commit `f4d1503`).

## What's intentionally missing

Only the Lua-REPL connector tasks `NodeMcuConnector.ts` actually calls are
included: `connect`, `checkConnection`, `deviceInfo`, `listDevices`,
`fsinfo`, `download`, `upload`, `execute`, `hardreset`/`softreset`. The
upstream CLI (`bin/`, `lib/cli/*`), the raw-terminal passthrough
(`transport/serial-terminal.js`, used only by the `run` CLI command) and
the unused `compile`/`format`/`remove`/`run` connector tasks were left out.

## Updating

This is a point-in-time copy, not a dependency that gets `npm update`d.
If upstream fixes a bug in one of these files, port it by hand the same
way `transport/serialport.js` was ported.
