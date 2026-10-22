import ObsConfiguration from './ObsConfiguration'
import ipPort from '../../domain/IpPort'
import ipAddress from '../../domain/IpAddress'

function createDefaultObsConfiguration() {
    return new ObsConfiguration()
}

describe('getPort/setPort', () => {
    it("has a default", () => {
        const conf = createDefaultObsConfiguration()
        expect(conf.getPort()).toBeTruthy()
    })
    it("allows to set an IpPort", () => {
        const conf = createDefaultObsConfiguration()
        conf.setPort(ipPort(1234))
        expect(conf.getPort().toNumber()).toEqual(1234)
    })
    it("allows to set a number", () => {
        const conf = createDefaultObsConfiguration()
        conf.setPort(1234)
        expect(conf.getPort().toNumber()).toEqual(1234)
    })
    it("allows to restore the default", () => {
        const conf = createDefaultObsConfiguration()
        conf.setPort(1234)
        expect(conf.getPort().toNumber()).toEqual(1234)
        conf.setPort(null)
        expect(conf.getPort()).toBeTruthy()
    })
})

describe('getIp/setIp', () => {
    it("has a default", () => {
        const conf = createDefaultObsConfiguration()
        expect(conf.getIp()).toBeTruthy()
    })
    it("allows to set an IpPort", () => {
        const conf = createDefaultObsConfiguration()
        conf.setIp(ipAddress("1.2.3.4"))
        expect(conf.getIp().toString()).toEqual("1.2.3.4")
    })
    it("allows to set a number", () => {
        const conf = createDefaultObsConfiguration()
        conf.setIp("1.2.3.4")
        expect(conf.getIp().toString()).toEqual("1.2.3.4")
    })
    it("allows to restore the default", () => {
        const conf = createDefaultObsConfiguration()
        conf.setIp("1.2.3.4")
        expect(conf.getIp().toString()).toEqual("1.2.3.4")
        conf.setIp(null)
        expect(conf.getIp()).toBeTruthy()
    })
})

describe('fromJson/toJson', () => {
    it("does work", () => {
        const conf = createDefaultObsConfiguration()
        conf.setIp("1.2.3.4")
        conf.setPort(1234)
        conf.setLiveMode("stream")
        const loadedConf = createDefaultObsConfiguration()
        loadedConf.fromJson(conf.toJson())
        
        expect(loadedConf.getIp().toString()).toEqual("1.2.3.4")
        expect(loadedConf.getPort().toNumber()).toEqual(1234)
        expect(loadedConf.getLiveMode()).toEqual("stream")
    })
})

describe('password', () => {
    it("is empty by default and survives a save", () => {
        const conf = createDefaultObsConfiguration()
        expect(conf.getPassword()).toEqual("")
        conf.setPassword("secret")
        const loadedConf = createDefaultObsConfiguration()
        loadedConf.fromJson(conf.toJson())
        expect(loadedConf.getPassword()).toEqual("secret")
    })
})

describe('port migration', () => {
    it("moves the obs-websocket 4 default 4444 to 4455", () => {
        const conf = createDefaultObsConfiguration()
        conf.fromJson({ ip: "1.2.3.4", port: 4444 })
        expect(conf.getPort().toNumber()).toEqual(4455)
    })
    it("keeps 4444 when it was chosen with the current settings", () => {
        const conf = createDefaultObsConfiguration()
        conf.fromJson({ ip: "1.2.3.4", port: 4444, password: "" })
        expect(conf.getPort().toNumber()).toEqual(4444)
    })
    it("keeps other ports", () => {
        const conf = createDefaultObsConfiguration()
        conf.fromJson({ ip: "1.2.3.4", port: 4456 })
        expect(conf.getPort().toNumber()).toEqual(4456)
    })
})

describe('clone', () => {
    it("does work", () => {
        const conf = createDefaultObsConfiguration()
        conf.setIp("1.2.3.4")
        conf.setPort(1234)
        conf.setLiveMode("stream")
        const clone = conf.clone()
        conf.setIp("2.3.4.5") // it should be a new instance
        
        expect(clone.getIp().toString()).toEqual("1.2.3.4")
        expect(clone.getPort().toNumber()).toEqual(1234)
        expect(clone.getLiveMode()).toEqual("stream")
    })
})
