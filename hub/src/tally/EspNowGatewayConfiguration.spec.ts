import EspNowGatewayConfiguration from './EspNowGatewayConfiguration'

describe('defaults', () => {
    it("is off with no serial port by default", () => {
        const conf = new EspNowGatewayConfiguration()
        expect(conf.getEnabled()).toEqual(false)
        expect(conf.getSerialPort()).toEqual("")
    })
})

describe('getEnabled/setEnabled, getSerialPort/setSerialPort', () => {
    it("allows enabling it with a serial port", () => {
        const conf = new EspNowGatewayConfiguration()
        conf.setEnabled(true)
        conf.setSerialPort("/dev/ttyUSB0")

        expect(conf.getEnabled()).toEqual(true)
        expect(conf.getSerialPort()).toEqual("/dev/ttyUSB0")
    })
})

describe('fromJson/toJson', () => {
    it("round-trips", () => {
        const conf = new EspNowGatewayConfiguration()
        conf.setEnabled(true)
        conf.setSerialPort("COM5")

        const loaded = new EspNowGatewayConfiguration()
        loaded.fromJson(conf.toJson())

        expect(loaded.getEnabled()).toEqual(true)
        expect(loaded.getSerialPort()).toEqual("COM5")
    })

    it("ignores an invalid serial port type instead of throwing", () => {
        const conf = new EspNowGatewayConfiguration()
        conf.fromJson({ enabled: true, serialPort: 42 } as unknown as { enabled: boolean, serialPort: string })

        expect(conf.getEnabled()).toEqual(true)
        expect(conf.getSerialPort()).toEqual("")
    })
})

describe('clone', () => {
    it("is a separate instance", () => {
        const conf = new EspNowGatewayConfiguration()
        conf.setEnabled(true)
        conf.setSerialPort("COM5")
        const clone = conf.clone()
        conf.setSerialPort("COM7")

        expect(clone.getSerialPort()).toEqual("COM5")
    })
})
