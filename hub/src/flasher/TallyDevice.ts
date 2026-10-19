import TallySettingsIni from "./TallySettingsIni"

export type UpdateType = "not-available" | "up-to-date" | "updateable"

/** A serial port the flasher could use; supported = known ESP USB-UART bridge. */
export interface SerialPortChoice {
  path: string
  vendorId?: string
  productId?: string
  supported: boolean
}

export interface TallyDeviceObjectType {
  vendorId: string
  productId: string
  chipId: string
  flashId: string
  nodeMcuModules: string
  nodeMcuVersion: string
  path: string
  tallySettings?: string
  errorMessage?: string
  update?: UpdateType
  ports?: SerialPortChoice[]
}

class TallyDevice{
  vendorId: string
  productId: string
  chipId: string
  flashId: string
  nodeMcuModules: string
  nodeMcuVersion: string
  path: string
  update?: UpdateType
  tallySettings?: TallySettingsIni
  errorMessage?: string
  ports: SerialPortChoice[] = []

  toJson(): TallyDeviceObjectType {
    return {
      vendorId: this.vendorId,
      productId: this.productId,
      chipId: this.chipId,
      flashId: this.flashId,
      nodeMcuModules: this.nodeMcuModules,
      nodeMcuVersion: this.nodeMcuVersion,
      path: this.path,
      tallySettings: this.tallySettings ? this.tallySettings.toString() : undefined,
      errorMessage: this.errorMessage,
      update: this.update,
      ports: this.ports,
    }
  }

  public static fromJson(data:TallyDeviceObjectType): TallyDevice {
    const device = new TallyDevice()
    device.vendorId = data.vendorId
    device.productId = data.productId
    device.chipId = data.chipId
    device.flashId = data.flashId
    device.nodeMcuModules = data.nodeMcuModules
    device.nodeMcuVersion = data.nodeMcuVersion
    device.path = data.path
    device.tallySettings = data.tallySettings ? new TallySettingsIni(data.tallySettings) : undefined
    device.errorMessage = data.errorMessage
    device.update = data.update
    device.ports = data.ports || []

    return device
  }
}

export default TallyDevice