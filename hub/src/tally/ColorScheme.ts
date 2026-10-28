
export type ColorSchemeId = "default" | "yellow-pink" | "custom"

export class Color {
  r: number
  g: number
  b: number

  constructor(r: number, g: number, b: number) {
    this.r = r
    this.g = g
    this.b = b
  }

  private calculateChannel(value: number, brightness: number) {
    return Math.ceil(value * brightness / 100)
  }

  // brightness: 0-100
  withBrightness(brightness: number) {
    return new Color(this.calculateChannel(this.r, brightness), this.calculateChannel(this.g, brightness), this.calculateChannel(this.b, brightness))
  }

  toCss() {
    return `rgb(${this.r},${this.g},${this.b})`
  }

  toHex() {
    const channel = (value: number) => value.toString(16).padStart(2, "0")
    return `#${channel(this.r)}${channel(this.g)}${channel(this.b)}`
  }

  static fromHex(hex: string): Color {
    const clean = hex.replace("#", "")
    return new Color(
      parseInt(clean.substring(0, 2), 16) || 0,
      parseInt(clean.substring(2, 4), 16) || 0,
      parseInt(clean.substring(4, 6), 16) || 0,
    )
  }
}

export type ColorScheme = {
  id: ColorSchemeId
  name: string
  description?: string
  program: Color
  preview: Color
  aux: Color
  highlight: Color
  unknown: Color
  idle: Color
}

export const Black : Color = new Color(0, 0, 0)

export type CustomColorChannel = "program" | "preview" | "aux" | "highlight" | "unknown" | "idle"
export const CUSTOM_COLOR_CHANNELS: CustomColorChannel[] = ["program", "preview", "aux", "highlight", "unknown", "idle"]

export const DefaultColorScheme: ColorScheme = {
  id: "default",
  name: "Default",
  description: "The traditional color scheme for Tally Lights.",
  program: new Color(255, 0, 0),
  preview: new Color(0, 255, 0),
  aux: new Color(255, 80, 0),
  highlight: new Color(255, 255, 255),
  unknown: new Color(0, 0, 255),
  idle: new Color(0, 1, 0),
}
export const YellowPinkColorScheme: ColorScheme = {
  id: "yellow-pink",
  name: "Yellow-Pink",
  description: "Intended to give better contrast for the red-green color blind (Protanopia, Deuteranopia).",
  program: new Color(255, 255, 0),
  preview: new Color(255, 0, 255),
  // orange would be hard to tell from the yellow program light
  aux: new Color(0, 255, 255),
  highlight: new Color(255, 255, 255),
  unknown: new Color(0, 0, 255),
  idle: new Color(0, 1, 0),
}

/**
 * Builds the "Custom" color scheme from the (partial) colors stored in the
 * tally defaults, falling back to the Default scheme for any channel not
 * set yet (e.g. right after upgrading from a Hub version without this field).
 */
export function createCustomColorScheme(overrides: Partial<Record<CustomColorChannel, Color>> = {}): ColorScheme {
  return {
    id: "custom",
    name: "Custom",
    description: "Your own colors for each tally state.",
    program: overrides.program ?? DefaultColorScheme.program,
    preview: overrides.preview ?? DefaultColorScheme.preview,
    aux: overrides.aux ?? DefaultColorScheme.aux,
    highlight: overrides.highlight ?? DefaultColorScheme.highlight,
    unknown: overrides.unknown ?? DefaultColorScheme.unknown,
    idle: overrides.idle ?? DefaultColorScheme.idle,
  }
}

const ColorSchemes = {
  getAll(custom?: ColorScheme) {
    return [DefaultColorScheme, YellowPinkColorScheme, custom ?? createCustomColorScheme()]
  },
  getById(id: ColorSchemeId, custom?: ColorScheme) : ColorScheme {
    if (id === "default") {
      return DefaultColorScheme
    } else if (id === "yellow-pink") {
      return YellowPinkColorScheme
    } else if (id === "custom") {
      return custom ?? createCustomColorScheme()
    } else {
      // if typescript complaints, we missed an option
      const unreachable: never = id
      throw new Error(`Unrecognized color scheme: ${String(unreachable)}`)
    }
  }
}

export default ColorSchemes