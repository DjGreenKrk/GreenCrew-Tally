# Changes inherited from kuuminsh/wifi-tally

GreenCrew Tally is based on [kuuminsh/wifi-tally](https://github.com/kuuminsh/wifi-tally) (v0.5.3-kuuminsh.1), which extends the original [vTally](https://github.com/wifi-tally/wifi-tally) by Christian Zenker with vMix-focused workflow improvements and Windows packaging support. This page describes those changes; GreenCrew changes are listed in [Changelog.md](Changelog.md).

## Multiple vMix Inputs per Tally

A Tally can now be assigned to multiple vMix Inputs. A Tally shows Program when any assigned Input is on Program. If none are on Program but at least one is on Preview, it shows Preview.

Existing saved configurations that use the legacy `channelId` field remain supported and are automatically treated as a single assigned Input.

## Improved Input Selection

The Tally assignment control is a multi-select list that:

- Displays 15 Inputs at once for easier navigation of long vMix projects.
- Shows the vMix Input number before its title, for example `8 CAM1 [A]`.
- Uses the Input number from the vMix API rather than the position in the received list.

## Per-vMix-Project Tally Profiles

vTally reads the active vMix project path from the `<preset>` element in the vMix XML response.

- Each vMix project can have its own saved Tally assignments and per-Tally settings.
- Select **Save project** in the web interface to save the current configuration for the active project.
- When vMix opens another project, vTally automatically loads its saved profile.
- If the project has no saved profile, all current Tally Input assignments are cleared and shown as unpatched.
- Project profiles are stored in the existing vTally configuration file, normally `%USERPROFILE%\\.wifi-tally.json` on Windows.

The header shows the active vMix project filename and its profile status: **Saved**, **Not saved**, or **Unsaved changes**.

## Reliable vMix XML Processing

The vMix TCP connector now buffers XML replies using the `XML <length>` protocol header. This avoids parsing incomplete XML when a large vMix response is split across multiple TCP packets.

## vMix Reconnection Timeout

vTally automatically reconnects when vMix is restarted or temporarily closed. It retries the connection every three seconds and resets the retry window after a complete vMix TCP API handshake.

If vTally cannot establish a complete vMix connection within 10 minutes, the backend exits with code `1`. The Electron tray application detects this unexpected backend exit and closes as well.

> **Changed in GC Tally 0.6.0:** the Hub no longer exits. After the 10-minute retry window the reconnect attempts stop, vMix is reported as disconnected (tallies show UNKNOWN) and the rest of the Hub keeps running. To resume, restart the Hub or select another mixer and then vMix again.

## Build Information and Windows Packaging

The web interface displays the application version and frontend build timestamp in the header.

This fork also includes scripts and Electron configuration for building:

- `hub/dist/vtally.exe`: the standalone backend executable.
- `hub/dist/vTally 0.5.1.exe`: the portable Windows application with the backend and web interface.

The packaged application serves its bundled frontend assets correctly. Optional native dependencies for NodeMCU flashing and Roland V-8HD MIDI support are loaded only when available, so an unavailable module does not prevent the Hub from starting.

## Verification

The new behavior is covered by focused unit and integration tests for multi-Input assignments, project-profile persistence and switching, vMix project detection, and Input selection behavior.