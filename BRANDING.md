# GreenCrew Tally — branding

GreenCrew Tally (short: **GC Tally**) belongs to GreenCrew Tools. Shared branding, design and
writing rules live in [GreenCrew_Tools_Docs](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs)
and are not copied here.

## Logo

Symbol: a tally light with two indicators on the GreenCrew hexagon
([ICONOGRAPHY.md, section 18](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/branding/ICONOGRAPHY.md)).
The source is `app_logo/GreenCrew_Tally_logo.svg` in GreenCrew_Tools_Docs; versioned copies used
by this repository:

| File | Use |
| --- | --- |
| `art/GreenCrew_Tally_logo.svg`, `art/GreenCrew_Tally_logo.png` | source copy, README, Electron resources |
| `hub/public/favicon.svg`, `favicon.png` (64 px) | browser tab, Hub header |
| `hub/public/logo192.png`, `logo512.png` | web app manifest |
| `hub/tray-icon.png` (32 px) | Windows tray |

Regenerate the PNGs from the SVG (for example `rsvg-convert -w 512 -h 512 …`); do not draw them by hand.

## Platform-specific decisions

- The Hub UI still uses Material-UI 4 with its default theme; moving it to the GreenCrew design
  system is part of the UI upgrade ([#8](https://github.com/DjGreenKrk/GreenCrew-Tally/issues/8)).
- Tally light colours (red Program, orange AUX, green Preview, blue for errors) follow broadcast
  conventions, not the GreenCrew palette.
- Technical identifiers keep the vTally names for compatibility (`~/.wifi-tally.json`,
  Companion module id `greencrew-vtally`, `VTALLY_COMPANION_TOKEN`).
