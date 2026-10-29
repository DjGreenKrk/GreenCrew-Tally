import { Color, DefaultColorScheme, createCustomColorScheme } from '../tally/ColorScheme'
import { resolveTallyVisual } from './WebTallyPage'

describe('resolveTallyVisual', () => {
  test('maps every state to its scheme color, including highlight and the no-mixer (unknown) state', () => {
    const scheme = createCustomColorScheme({
      program: new Color(1, 1, 1),
      preview: new Color(2, 2, 2),
      aux: new Color(3, 3, 3),
      highlight: new Color(4, 4, 4),
      unknown: new Color(5, 5, 5),
      idle: new Color(6, 6, 6),
    })

    expect(resolveTallyVisual("on-air", scheme)).toEqual({ dataColor: "program", color: scheme.program })
    expect(resolveTallyVisual("preview", scheme)).toEqual({ dataColor: "preview", color: scheme.preview })
    expect(resolveTallyVisual("aux", scheme)).toEqual({ dataColor: "aux", color: scheme.aux })
    expect(resolveTallyVisual("release", scheme)).toEqual({ dataColor: "idle", color: scheme.idle })
    expect(resolveTallyVisual("highlight", scheme)).toEqual({ dataColor: "highlight", color: scheme.highlight })
    expect(resolveTallyVisual("unknown", scheme)).toEqual({ dataColor: "unknown", color: scheme.unknown })
  })

  test('highlight and the no-mixer state are not hardcoded: a custom scheme changes them too', () => {
    const scheme = createCustomColorScheme({ highlight: new Color(9, 8, 7), unknown: new Color(1, 2, 3) })

    expect(resolveTallyVisual("highlight", scheme).color).toEqual(new Color(9, 8, 7))
    expect(resolveTallyVisual("highlight", scheme).color).not.toEqual(DefaultColorScheme.highlight)
    expect(resolveTallyVisual("unknown", scheme).color).toEqual(new Color(1, 2, 3))
    expect(resolveTallyVisual("unknown", scheme).color).not.toEqual(DefaultColorScheme.unknown)
  })
})
