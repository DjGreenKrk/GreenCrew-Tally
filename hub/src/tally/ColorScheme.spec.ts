import ColorSchemes, { Color, CUSTOM_COLOR_CHANNELS, DefaultColorScheme, createCustomColorScheme } from './ColorScheme'

describe('Color', () => {
  describe('toHex/fromHex', () => {
    test('round-trips', () => {
      const color = new Color(255, 80, 0)
      expect(color.toHex()).toEqual('#ff5000')
      expect(Color.fromHex('#ff5000')).toEqual(new Color(255, 80, 0))
    })
    test('pads single-digit channels', () => {
      expect(new Color(0, 1, 15).toHex()).toEqual('#00010f')
    })
    test('accepts a hex string without the leading #', () => {
      expect(Color.fromHex('ff0000')).toEqual(new Color(255, 0, 0))
    })
  })
})

describe('createCustomColorScheme', () => {
  test('falls back to the Default scheme for every channel', () => {
    const scheme = createCustomColorScheme()
    for (const channel of CUSTOM_COLOR_CHANNELS) {
      expect(scheme[channel]).toEqual(DefaultColorScheme[channel])
    }
    expect(scheme.id).toEqual('custom')
  })

  test('uses the given overrides, keeping the rest at their default', () => {
    const scheme = createCustomColorScheme({ program: new Color(1, 2, 3) })
    expect(scheme.program).toEqual(new Color(1, 2, 3))
    expect(scheme.preview).toEqual(DefaultColorScheme.preview)
  })
})

describe('ColorSchemes', () => {
  describe('getById', () => {
    test('returns the built-in schemes unchanged', () => {
      expect(ColorSchemes.getById('default')).toEqual(DefaultColorScheme)
    })
    test('returns the given custom scheme for "custom"', () => {
      const custom = createCustomColorScheme({ aux: new Color(9, 9, 9) })
      expect(ColorSchemes.getById('custom', custom)).toEqual(custom)
    })
    test('falls back to the default custom colors when none are given', () => {
      expect(ColorSchemes.getById('custom')).toEqual(createCustomColorScheme())
    })
  })

  describe('getAll', () => {
    test('includes the custom scheme with the given colors', () => {
      const custom = createCustomColorScheme({ idle: new Color(5, 5, 5) })
      const all = ColorSchemes.getAll(custom)
      expect(all.map(scheme => scheme.id)).toEqual(['default', 'yellow-pink', 'custom'])
      expect(all[2]).toEqual(custom)
    })
  })
})
