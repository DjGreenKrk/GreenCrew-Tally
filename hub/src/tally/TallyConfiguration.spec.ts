import { Color, DefaultColorScheme, createCustomColorScheme } from './ColorScheme'
import { DefaultTallyConfiguration, TallyConfiguration } from './TallyConfiguration'

describe('DefaultTallyConfiguration', () => {
  test('it has defaults', () => {
    const config = new DefaultTallyConfiguration()

    expect(config.getStageLightBrightness()).toEqual(100)
    expect(config.getOperatorLightBrightness()).toEqual(100)
    expect(config.getStageColorScheme()).toEqual("default")
    expect(config.getOperatorColorScheme()).toEqual("default")
    expect(config.getStageShowsPreview()).toEqual(true)
    expect(config.getStageShowsAux()).toEqual(false)
    expect(config.getOperatorShowsIdle()).toEqual(false)
    expect(config.getCustomColorScheme()).toEqual(createCustomColorScheme())
  })

  describe('setCustomColor', () => {
    test('overrides a single channel and keeps the rest', () => {
      const config = new DefaultTallyConfiguration()
      config.setCustomColor("aux", new Color(9, 8, 7))

      expect(config.getCustomColorScheme().aux).toEqual(new Color(9, 8, 7))
      expect(config.getCustomColorScheme().program).toEqual(DefaultColorScheme.program)
    })
  })

  describe('getStageLightBrightness', () => {
    const testData: [number, number][] = [
      [-1, 0],
      [0, 0],
      [42, 42],
      [100, 100],
      [101, 100],
      [undefined, 100],
      [null, 100]
    ]

    testData.forEach(([input, expectedOutput]) => {
      test(`setting stageLightBrightness to ${input} results in ${expectedOutput}`, () => {
        const config = new DefaultTallyConfiguration()
        config.setStageLightBrightness(input)
        expect(config.getStageLightBrightness()).toEqual(expectedOutput)
      })
    })
  })
  
  describe('getOperatorLightBrightness', () => {
    const testData: [number, number][] = [
      [0, 1], // it should not be possible to turn of the operator light. Prevent a Tally looks "broken" because of misconfiguration.
      [1, 1],
      [20, 20],
      [42, 42],
      [100, 100],
      [101, 100],
      [undefined, 100],
      [null, 100],
    ]

    testData.forEach(([input, expectedOutput]) => {
      test(`setting stageLightBrightness to ${input} results in ${expectedOutput}`, () => {
        const config = new DefaultTallyConfiguration()
        config.setOperatorLightBrightness(input)
        expect(config.getOperatorLightBrightness()).toEqual(expectedOutput)
      })
    })
  })

  describe('fromJson/toJson', () => {
    it("does work", () => {
        const conf = new DefaultTallyConfiguration()
        conf.setOperatorLightBrightness(42)
        conf.setStageLightBrightness(21)
        conf.setOperatorColorScheme("yellow-pink")
        conf.setStageColorScheme("yellow-pink")
        conf.setStageShowsPreview(false)
        conf.setStageShowsAux(true)
        conf.setOperatorShowsIdle(false)
        conf.setCustomColor("program", new Color(1, 2, 3))
        conf.setCustomColor("highlight", new Color(4, 5, 6))

        const loadedConf = new DefaultTallyConfiguration()
        loadedConf.fromJson(conf.toJson())

        expect(loadedConf.getOperatorLightBrightness()).toEqual(42)
        expect(loadedConf.getStageLightBrightness()).toEqual(21)
        expect(loadedConf.getOperatorColorScheme()).toEqual("yellow-pink")
        expect(loadedConf.getOperatorColorScheme()).toEqual("yellow-pink")
        expect(loadedConf.getStageShowsPreview()).toEqual(false)
        expect(loadedConf.getStageShowsAux()).toEqual(true)
        expect(loadedConf.getOperatorShowsIdle()).toEqual(false)
        expect(loadedConf.getCustomColorScheme().program).toEqual(new Color(1, 2, 3))
        expect(loadedConf.getCustomColorScheme().highlight).toEqual(new Color(4, 5, 6))
        // channels never customized keep the Default scheme's colors
        expect(loadedConf.getCustomColorScheme().preview).toEqual(DefaultColorScheme.preview)
    })
    it("handles falsy values correctly", () => {
        const conf = new DefaultTallyConfiguration()
        conf.setStageLightBrightness(0)
        conf.setStageShowsPreview(false)
        conf.setStageShowsAux(true)
        conf.setOperatorShowsIdle(false)

        const loadedConf = new DefaultTallyConfiguration()
        loadedConf.fromJson(conf.toJson())
        
        expect(loadedConf.getStageLightBrightness()).toBe(0)
        expect(loadedConf.getStageShowsPreview()).toBe(false)
        expect(loadedConf.getStageShowsAux()).toBe(true)
        expect(loadedConf.getOperatorShowsIdle()).toBe(false)
    })
  })


  describe('clone', () => {
    it("does work", () => {
      const conf = new DefaultTallyConfiguration()
      conf.setOperatorLightBrightness(42)

      const clone = conf.clone()
      clone.setOperatorLightBrightness(90) // it should be a new instance

      expect(clone.getOperatorLightBrightness()).toEqual(90)
      expect(conf.getOperatorLightBrightness()).toEqual(42)
    })

    it("does not share the custom color scheme with the original", () => {
      const conf = new DefaultTallyConfiguration()
      conf.setCustomColor("idle", new Color(1, 1, 1))

      const clone = conf.clone()
      clone.setCustomColor("idle", new Color(2, 2, 2))

      expect(clone.getCustomColorScheme().idle).toEqual(new Color(2, 2, 2))
      expect(conf.getCustomColorScheme().idle).toEqual(new Color(1, 1, 1))
    })
  })
})
describe('TallyConfiguration', () => {
  test('it has defaults', () => {
    const config = new TallyConfiguration()
  
    expect(config.getStageLightBrightness()).toBeUndefined()
    expect(config.getOperatorLightBrightness()).toBeUndefined()
    expect(config.getStageColorScheme()).toBeUndefined()
    expect(config.getOperatorColorScheme()).toBeUndefined()
    expect(config.getStageShowsPreview()).toBeUndefined()
    expect(config.getStageShowsAux()).toBeUndefined()
    expect(config.getOperatorShowsIdle()).toBeUndefined()
  })

  describe('getStageLightBrightness', () => {
    const testData: [number, number][] = [
      [-1, 0],
      [0, 0],
      [42, 42],
      [100, 100],
      [101, 100],
      [undefined, undefined],
      [null, undefined]
    ]

    testData.forEach(([input, expectedOutput]) => {
      test(`setting stageLightBrightness to ${input} results in ${expectedOutput}`, () => {
        const config = new TallyConfiguration()
        config.setStageLightBrightness(input)
        expect(config.getStageLightBrightness()).toEqual(expectedOutput)
      })
    })
  })

  describe('getOperatorLightBrightness', () => {
    const testData: [number, number][] = [
      [0, 1], // it should not be possible to turn of the operator light. Prevent a Tally looks "broken" because of misconfiguration.
      [1, 1],
      [20, 20],
      [42, 42],
      [100, 100],
      [101, 100],
      [undefined, undefined],
      [null, undefined],
    ]

    testData.forEach(([input, expectedOutput]) => {
      test(`setting stageLightBrightness to ${input} results in ${expectedOutput}`, () => {
        const config = new TallyConfiguration()
        config.setOperatorLightBrightness(input)
        expect(config.getOperatorLightBrightness()).toEqual(expectedOutput)
      })
    })
  })

  describe('fromJson/toJson', () => {
    it("does work", () => {
        const conf = new TallyConfiguration()
        conf.setOperatorLightBrightness(42)
        conf.setStageLightBrightness(21)
        conf.setStageColorScheme("yellow-pink")
        conf.setOperatorColorScheme("yellow-pink")
        conf.setStageShowsPreview(false)
        conf.setStageShowsAux(true)
        conf.setOperatorShowsIdle(false)

        const loadedConf = new TallyConfiguration()
        loadedConf.fromJson(conf.toJson())
        
        expect(loadedConf.getOperatorLightBrightness()).toEqual(42)
        expect(loadedConf.getStageLightBrightness()).toEqual(21)
        expect(loadedConf.getStageColorScheme()).toEqual("yellow-pink")
        expect(loadedConf.getOperatorColorScheme()).toEqual("yellow-pink")
        expect(loadedConf.getStageShowsPreview()).toEqual(false)
        expect(loadedConf.getStageShowsAux()).toEqual(true)
        expect(loadedConf.getOperatorShowsIdle()).toEqual(false)
    })
    it("handles falsy values correctly", () => {
        const conf = new TallyConfiguration()
        conf.setStageLightBrightness(0)
        conf.setStageShowsPreview(false)
        conf.setStageShowsAux(true)
        conf.setOperatorShowsIdle(false)

        const loadedConf = new TallyConfiguration()
        loadedConf.fromJson(conf.toJson())
        
        expect(loadedConf.getStageLightBrightness()).toBe(0)
        expect(loadedConf.getStageShowsPreview()).toBe(false)
        expect(loadedConf.getStageShowsAux()).toBe(true)
        expect(loadedConf.getOperatorShowsIdle()).toBe(false)
    })
    it("loads undefined correctly", () => {
        const conf = new TallyConfiguration()
        conf.setStageLightBrightness(undefined)
        conf.setOperatorLightBrightness(undefined)
        conf.setStageColorScheme(undefined)
        conf.setOperatorColorScheme(undefined)
        conf.setStageShowsPreview(undefined)
        conf.setStageShowsAux(undefined)
        conf.setOperatorShowsIdle(undefined)

        const loadedConf = new TallyConfiguration()
        loadedConf.fromJson(conf.toJson())
        
        expect(loadedConf.getStageLightBrightness()).toBeUndefined()
        expect(loadedConf.getOperatorLightBrightness()).toBeUndefined()
        expect(loadedConf.getStageColorScheme()).toBeUndefined()
        expect(loadedConf.getOperatorColorScheme()).toBeUndefined()
        expect(loadedConf.getStageShowsPreview()).toBeUndefined()
        expect(loadedConf.getStageShowsAux()).toBeUndefined()
        expect(loadedConf.getOperatorShowsIdle()).toBeUndefined()
    })
  })
})
