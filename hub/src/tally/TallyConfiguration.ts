import { ColorSchemeId, DefaultColorScheme } from "./ColorScheme"

export type TallyConfigurationObjectType = {
  stBrightness?: number
  opBrightness?: number
  stColor?: ColorSchemeId
  opColor?: ColorSchemeId
  stPreview?: boolean
  stAux?: boolean
  opIdle?: boolean
}

/**
 * representation of the default values if an individual tally does not override them
 */
export class DefaultTallyConfiguration {
  // Declare static defaults before instance field initializers for TypeScript 6.
  static readonly defaultColorScheme : ColorSchemeId = DefaultColorScheme.id
  static readonly minOperatorLightBrightness = 1
  static readonly defaultBrightness = 100

  private _stageLightBrightness: number = DefaultTallyConfiguration.defaultBrightness
  private _stageColorScheme: ColorSchemeId = DefaultTallyConfiguration.defaultColorScheme
  private _operatorLightBrightness?: number = DefaultTallyConfiguration.defaultBrightness
  private _operatorColorScheme: ColorSchemeId = DefaultTallyConfiguration.defaultColorScheme
  private _stageShowsPreview: boolean = true
  // The stage light is for the people in front of the camera; AUX is mostly
  // relevant to the operator, so it is opt-in there.
  private _stageShowsAux: boolean = false
  // Off by default: on a single RGB light a dim idle colour was mistaken for
  // preview. Power is visible on the ESP board and "no hub" is shown in blue.
  private _operatorShowsIdle: boolean = false

  getStageLightBrightness() { return this._stageLightBrightness }
  setStageLightBrightness(value: number) { 
    if (value === null || value === undefined) {
      value = DefaultTallyConfiguration.defaultBrightness
    }
    this._stageLightBrightness = Math.min(Math.max(value, 0), 100)
  }

  getStageColorScheme() : ColorSchemeId { return this._stageColorScheme }
  setStageColorScheme(scheme: ColorSchemeId) { this._stageColorScheme = scheme }

  getOperatorLightBrightness() { return this._operatorLightBrightness }
  setOperatorLightBrightness(value: number) {
    const minValue = DefaultTallyConfiguration.minOperatorLightBrightness
    if (value === null || value === undefined) {
      value = DefaultTallyConfiguration.defaultBrightness
    } else if (value < minValue) {
      console.warn(`Operator Light Brightness can not be below ${minValue} to prevent a tally light that stays dark because of configuration, but got ${value}. Using ${minValue} instead.`)
      value = minValue
    }
    this._operatorLightBrightness = Math.min(value, 100)
  }

  getOperatorColorScheme() : ColorSchemeId { return this._operatorColorScheme }
  setOperatorColorScheme(scheme: ColorSchemeId) { this._operatorColorScheme = scheme }

  getStageShowsPreview() { return this._stageShowsPreview }
  setStageShowsPreview(shouldItShow: boolean) { this._stageShowsPreview = shouldItShow }

  getStageShowsAux() { return this._stageShowsAux }
  setStageShowsAux(shouldItShow: boolean) { this._stageShowsAux = shouldItShow }

  getOperatorShowsIdle() { return this._operatorShowsIdle}
  setOperatorShowsIdle(shouldItShow: boolean) { this._operatorShowsIdle = shouldItShow }

  toJson() : TallyConfigurationObjectType {
    return {
      stBrightness: this._stageLightBrightness,
      opBrightness: this._operatorLightBrightness,
      stColor: this._stageColorScheme,
      opColor: this._operatorColorScheme,
      stPreview: this._stageShowsPreview,
      stAux: this._stageShowsAux,
      opIdle: this._operatorShowsIdle,
    }
  }
  fromJson(valueObject: TallyConfigurationObjectType) {
    if (valueObject.opBrightness !== undefined) this.setOperatorLightBrightness(valueObject.opBrightness)
    if (valueObject.stBrightness !== undefined) this.setStageLightBrightness(valueObject.stBrightness)
    if (valueObject.stColor !== undefined) this.setStageColorScheme(valueObject.stColor)
    if (valueObject.opColor !== undefined) this.setOperatorColorScheme(valueObject.opColor)
    if (valueObject.stPreview !== undefined) this.setStageShowsPreview(valueObject.stPreview)
    if (valueObject.stAux !== undefined) this.setStageShowsAux(valueObject.stAux)
    if (valueObject.opIdle !== undefined) this.setOperatorShowsIdle(valueObject.opIdle)
  }

  clone(): DefaultTallyConfiguration {
    const clone = new DefaultTallyConfiguration()
    clone.fromJson(this.toJson())
    return clone
  }
}

/**
 * representation of an individual tally that could override DefaultTallyConfiguration
 */
export class TallyConfiguration {
  private _stageLightBrightness: number = undefined
  private _operatorLightBrightness?: number = undefined
  private _stageColorScheme: ColorSchemeId = undefined
  private _operatorColorScheme: ColorSchemeId = undefined
  private _stageShowsPreview: boolean = undefined
  private _stageShowsAux: boolean = undefined
  private _operatorShowsIdle: boolean = undefined

  getStageLightBrightness() { return this._stageLightBrightness }
  setStageLightBrightness(value: number) { 
    if (value === null || value === undefined) {
      this._stageLightBrightness = undefined
      return
    }
    this._stageLightBrightness = Math.min(Math.max(value, 0), 100)
  }

  getStageColorScheme() : ColorSchemeId { return this._stageColorScheme }
  setStageColorScheme(scheme: ColorSchemeId) { this._stageColorScheme = scheme }

  getOperatorLightBrightness() { return this._operatorLightBrightness }
  setOperatorLightBrightness(value: number) {
    const minValue = DefaultTallyConfiguration.minOperatorLightBrightness
    if (value === null || value === undefined) {
      this._operatorLightBrightness = undefined
      return
    } else if (value < minValue) {
      console.warn(`Operator Light Brightness can not be below ${minValue} to prevent a tally light that stays dark because of configuration, but got ${value}. Using ${minValue} instead.`)
      value = minValue
    }
    this._operatorLightBrightness = Math.min(value, 100)
  }

  getOperatorColorScheme() : ColorSchemeId { return this._operatorColorScheme }
  setOperatorColorScheme(scheme: ColorSchemeId) { this._operatorColorScheme = scheme }

  getStageShowsPreview() { return this._stageShowsPreview }
  setStageShowsPreview(shouldItShow: boolean) { this._stageShowsPreview = shouldItShow }

  getStageShowsAux() { return this._stageShowsAux }
  setStageShowsAux(shouldItShow: boolean) { this._stageShowsAux = shouldItShow }

  getOperatorShowsIdle() { return this._operatorShowsIdle}
  setOperatorShowsIdle(shouldItShow: boolean) { this._operatorShowsIdle = shouldItShow }

  toJson() : TallyConfigurationObjectType {
    return {
      stBrightness: this._stageLightBrightness,
      opBrightness: this._operatorLightBrightness,
      stColor: this._stageColorScheme,
      opColor: this._operatorColorScheme,
      stPreview: this._stageShowsPreview,
      stAux: this._stageShowsAux,
      opIdle: this._operatorShowsIdle,
    }
  }
  fromJson(valueObject: TallyConfigurationObjectType) {
    this.setOperatorLightBrightness(valueObject.opBrightness)
    this.setStageLightBrightness(valueObject.stBrightness)
    this.setStageColorScheme(valueObject.stColor)
    this.setOperatorColorScheme(valueObject.opColor)
    this.setStageShowsPreview(valueObject.stPreview)
    this.setStageShowsAux(valueObject.stAux)
    this.setOperatorShowsIdle(valueObject.opIdle)
  }
}

