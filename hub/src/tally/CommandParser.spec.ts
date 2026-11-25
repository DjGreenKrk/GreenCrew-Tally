import CommandParser from './CommandParser'
import { LogCommand, ManagementCommand, TallyHoCommand } from './CommandParser'


test('fails if command is invalid #1', () => {
    expect(() => {
        CommandParser.parse("this is an invalid command")
    }).toThrow("Received an invalid command: \"this is an invalid command\"")
})

describe('tally-ho command', () => {
    test('parses a simple command', () => {
        const result = CommandParser.parse('tally-ho "Tally Name"')

        expect(result.command).toEqual("tally-ho")
        const { tallyName } = result as TallyHoCommand
        expect(tallyName).toBe("Tally Name")
    })
    test('fails if command is invalid', () => {
        expect(() => {
            CommandParser.parse("tally-ho Tally")
        }).toThrow("Received an invalid command: \"tally-ho Tally\"")
    })
    test('a NodeMCU tally says nothing about its device', () => {
        const result = CommandParser.parse('tally-ho "Tally Name"') as TallyHoCommand
        expect(result.device).toBeUndefined()
    })
    test('reads the device fields of firmware v2', () => {
        const result = CommandParser.parse('tally-ho "CAM 1" gc/1 id=a1b2c3 fw=2.0.0-dev hw=esp8266 caps=ws2812,pwm') as TallyHoCommand
        expect(result.tallyName).toBe("CAM 1")
        expect(result.device).toEqual({
            protocol: 1,
            id: "a1b2c3",
            firmware: "2.0.0-dev",
            hardware: "esp8266",
            capabilities: ["ws2812", "pwm"],
        })
    })
    test('skips unknown device fields from newer firmware', () => {
        const result = CommandParser.parse('tally-ho "CAM1" gc/2 id=a1 ota=yes fw=2.1.0') as TallyHoCommand
        expect(result.device).toEqual({ protocol: 2, id: "a1", firmware: "2.1.0", capabilities: [] })
    })
    test('ignores text after the name that is not a device description', () => {
        const result = CommandParser.parse('tally-ho "CAM1" something else') as TallyHoCommand
        expect(result.tallyName).toBe("CAM1")
        expect(result.device).toBeUndefined()
    })
    test('reads the pairing and the challenge apart from the device', () => {
        const unpaired = CommandParser.parse('tally-ho "CAM1" gc/1 id=a1b2c3 fw=2.0.0 hw=esp8266 caps=ws2812,pwm pair=- ch=0123456789abcdef') as TallyHoCommand
        expect(unpaired.pairing).toEqual({ hub: null, challenge: '0123456789abcdef' })
        expect(unpaired.device).toEqual({ protocol: 1, id: "a1b2c3", firmware: "2.0.0", hardware: "esp8266", capabilities: ["ws2812", "pwm"] })
        const paired = CommandParser.parse('tally-ho "CAM1" gc/1 id=a1b2c3 pair=1a2b3c4d ch=fedcba9876543210') as TallyHoCommand
        expect(paired.pairing).toEqual({ hub: '1a2b3c4d', challenge: 'fedcba9876543210' })
        const older = CommandParser.parse('tally-ho "CAM1" gc/1 id=a1b2c3') as TallyHoCommand
        expect(older.pairing).toBeUndefined()
    })
})
describe('management replies', () => {
    test('parses the answer of a v2 tally', () => {
        const result = CommandParser.parse('gc/1 paired id=a1b2c3 hub=1a2b3c4d key=fdbdef57e8036737') as ManagementCommand
        expect(result).toEqual({ command: 'management', reply: { kind: 'paired', id: 'a1b2c3', hub: '1a2b3c4d', key: 'fdbdef57e8036737' } })
    })
    test('fails for unknown management lines', () => {
        expect(() => CommandParser.parse('gc/1 pair hub=1a2b3c4d')).toThrow('Received an invalid command')
    })
})
describe('log command', () => {
    test('parses an info log', () => {
        const result = CommandParser.parse('log "Tally Name" INFO "Hello World"')

        expect(result.command).toEqual("log")
        const { tallyName, log } = result as LogCommand
        expect(tallyName).toBe("Tally Name")
        expect(log.isInfo()).toBe(true)
        expect(log.message).toBe("Hello World")
    })
    test('logs as error if log level is invalid', () => {
        const result = CommandParser.parse('log "Tally Name" UNKNOWN "Hello World"')
        expect(result.command).toEqual("log")
        const { tallyName, log } = result as LogCommand
        expect(tallyName).toBe("Tally Name")
        expect(log.isError()).toBe(true)
        expect(log.message).toBe("Hello World")
    })
    test('fails if command is invalid', () => {
        expect(() => {
            CommandParser.parse("log this invalid log")
        }).toThrow("Received an invalid command: \"log this invalid log\"")
    })
})
