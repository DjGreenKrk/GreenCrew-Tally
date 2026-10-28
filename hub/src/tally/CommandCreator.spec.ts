import {UdpTally} from '../domain/Tally'
import CommandCreator from './CommandCreator'
import { Color } from './ColorScheme'
import { DefaultTallyConfiguration } from './TallyConfiguration'
import 'jest-extended'


describe('default case', () => {
    const defaultConfig = new DefaultTallyConfiguration()
    test('it shows HIGHLIGHT regardless of anything else', () => {
        const tally = new UdpTally("test", "channel")
        tally.setHighlight(true)
        expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O255/255/255 S255/255/255 0xAA 125")
    })
    test('it shows PREVIEW in green by default', () => {
        const tally = new UdpTally("test", "channel")
        expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O000/255/000 S000/255/000")
    })
    test('it shows PROGRAM', () => {
        const tally = new UdpTally("test", "channel")
        expect(CommandCreator.createStateCommand(tally, ["channel"], ["other-channel"], defaultConfig)).toEqual("O255/000/000 S255/000/000")
    })
    test('it shows PROGRAM if channel is in preview and on-air', () => {
        const tally = new UdpTally("test", "channel")
        expect(CommandCreator.createStateCommand(tally, ["channel"], ["channel"], defaultConfig)).toEqual("O255/000/000 S255/000/000")
    })
    test('it shows RELEASE if tally is patched and it is not on-air or in preview', () => {
        const tally = new UdpTally("test", "channel")
        expect(CommandCreator.createStateCommand(tally, ["other-channel"], [], defaultConfig)).toEqual("O000/000/000 S000/000/000")
    })
    test('it shows RELEASE if tally is not patched', () => {
        const tally = new UdpTally("test")
        expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O000/000/000 S000/000/000")
    })
    test('it shows UNKNOWN if program is null and tally is patched', () => {
        const tally = new UdpTally("test", "channel")
        expect(CommandCreator.createStateCommand(tally, null, null, defaultConfig)).toEqual("O000/000/255 S000/000/000 0x80 250")
    })
    test('it shows RELEASE if program is null and tally is NOT patched', () => {
        const tally = new UdpTally("test")
        expect(CommandCreator.createStateCommand(tally, null, null, defaultConfig)).toEqual("O000/000/000 S000/000/000")
    })
})


describe("stageLightBrightness()", () => {
    const defaultConfig = new DefaultTallyConfiguration()
    defaultConfig.setStageLightBrightness(50)
    describe('it uses the default', () => {
        const tally = new UdpTally("test", "channel")
        test('for PREVIEW', () => {
            expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O000/255/000 S000/128/000")
        })
        test('for PROGRAM', () => {
            expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O255/000/000 S128/000/000")
        })
        test('for RELEASE', () => {
            expect(CommandCreator.createStateCommand(tally, [], [], defaultConfig)).toEqual("O000/000/000 S000/000/000")
        })
    })
    describe('it can be overridden by a tally configuration', () => {
        const tally = new UdpTally("test", "channel")
        tally.configuration.setStageLightBrightness(25)
        test('for PREVIEW', () => {
            expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O000/255/000 S000/064/000")
        })
        test('for PROGRAM', () => {
            expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O255/000/000 S064/000/000")
        })
    })
    describe('it can be turned completely off', () => {
        const tally = new UdpTally("test", "channel")
        tally.configuration.setStageLightBrightness(0)
        test('for PREVIEW', () => {
            expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O000/255/000 S000/000/000")
        })
        test('for PROGRAM', () => {
            expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O255/000/000 S000/000/000")
        })
    })
})
describe("operatorLightBrightness()", () => {
    const defaultConfig = new DefaultTallyConfiguration()
    defaultConfig.setOperatorLightBrightness(50)
    describe('it uses the default', () => {
        const tally = new UdpTally("test", "channel")
        test('for PREVIEW', () => {
            expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O000/128/000 S000/255/000")
        })
        test('for PROGRAM', () => {
            expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O128/000/000 S255/000/000")
        })
    })
    describe('it can be overridden by a tally configuration', () => {
        const tally = new UdpTally("test", "channel")
        tally.configuration.setOperatorLightBrightness(25)
        test('for PREVIEW', () => {
            expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O000/064/000 S000/255/000")
        })
        test('for PROGRAM', () => {
            expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O064/000/000 S255/000/000")
        })
    })
})
describe("stageColorScheme()", () => {
    const defaultConfig = new DefaultTallyConfiguration()
    defaultConfig.setStageColorScheme("yellow-pink")
    describe('it uses the default', () => {
        const tally = new UdpTally("test", "channel")
        test('for PREVIEW', () => {
            expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O000/255/000 S255/000/255")
        })
        test('for PROGRAM', () => {
            expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O255/000/000 S255/255/000")
        })
    })
    describe('it can be overridden by a tally configuration', () => {
        const tally = new UdpTally("test", "channel")
        tally.configuration.setStageColorScheme("default")
        test('for PREVIEW', () => {
            expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O000/255/000 S000/255/000")
        })
        test('for PROGRAM', () => {
            expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O255/000/000 S255/000/000")
        })
    })
})
describe("operatorColorScheme()", () => {
    const defaultConfig = new DefaultTallyConfiguration()
    defaultConfig.setOperatorColorScheme("yellow-pink")
    describe('it uses the default', () => {
        const tally = new UdpTally("test", "channel")
        test('for PREVIEW', () => {
            expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O255/000/255 S000/255/000")
        })
        test('for PROGRAM', () => {
            expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O255/255/000 S255/000/000")
        })
    })
    describe('it can be overridden by a tally configuration', () => {
        const tally = new UdpTally("test", "channel")
        tally.configuration.setOperatorColorScheme("default")
        test('for PREVIEW', () => {
            expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O000/255/000 S000/255/000")
        })
        test('for PROGRAM', () => {
            expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O255/000/000 S255/000/000")
        })
    })
})
describe("custom color scheme", () => {
    const defaultConfig = new DefaultTallyConfiguration()
    defaultConfig.setOperatorColorScheme("custom")
    defaultConfig.setStageColorScheme("custom")
    defaultConfig.setCustomColor("program", new Color(10, 20, 30))
    defaultConfig.setCustomColor("preview", new Color(40, 50, 60))
    test('is used for both operator and stage when selected as the default', () => {
        const tally = new UdpTally("test", "channel")
        expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O010/020/030 S010/020/030")
        expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O040/050/060 S040/050/060")
    })
    test('the colors can still be overridden per tally while the custom scheme stays shared', () => {
        const tally = new UdpTally("test", "channel")
        tally.configuration.setOperatorColorScheme("default")
        expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O255/000/000 S010/020/030")
    })
})
describe("stageShowPreview()", () => {
    describe('it uses the default', () => {
        const defaultConfig = new DefaultTallyConfiguration()
        defaultConfig.setStageShowsPreview(false)
        const tally = new UdpTally("test", "channel")
        test('for PREVIEW', () => {
            expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O000/255/000 S000/000/000")
        })
        test('for PROGRAM', () => {
            expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O255/000/000 S255/000/000")
        })
    })
    describe('it can be overridden by a tally configuration', () => {
        const defaultConfig = new DefaultTallyConfiguration()
        defaultConfig.setStageShowsPreview(true)
        const tally = new UdpTally("test", "channel")
        tally.configuration.setStageShowsPreview(false)
        test('for PREVIEW', () => {
            expect(CommandCreator.createStateCommand(tally, ["other-channel"], ["channel"], defaultConfig)).toEqual("O000/255/000 S000/000/000")
        })
        test('for PROGRAM', () => {
            expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O255/000/000 S255/000/000")
        })
    })
})
describe("AUX", () => {
    const defaultConfig = new DefaultTallyConfiguration()
    test('it shows AUX in orange on the operator light only by default', () => {
        const tally = new UdpTally("test", "channel")
        expect(CommandCreator.createStateCommand(tally, ["other-channel"], [], defaultConfig, ["channel"])).toEqual("O255/080/000 S000/000/000")
    })
    test('AUX beats PREVIEW', () => {
        const tally = new UdpTally("test", "channel")
        expect(CommandCreator.getState(tally, ["other-channel"], ["channel"], ["channel"])).toEqual("aux")
    })
    test('PROGRAM beats AUX', () => {
        const tally = new UdpTally("test", "channel")
        expect(CommandCreator.getState(tally, ["channel"], ["channel"], ["channel"])).toEqual("on-air")
    })
    test('UNKNOWN beats AUX when the mixer is disconnected', () => {
        const tally = new UdpTally("test", "channel")
        expect(CommandCreator.getState(tally, null, null, ["channel"])).toEqual("unknown")
    })
    test('the yellow-pink scheme uses cyan instead of orange', () => {
        const tally = new UdpTally("test", "channel")
        tally.configuration.setOperatorColorScheme("yellow-pink")
        expect(CommandCreator.createStateCommand(tally, [], [], defaultConfig, ["channel"])).toEqual("O000/255/255 S000/000/000")
    })
    test('the stage light can show AUX by default', () => {
        const config = new DefaultTallyConfiguration()
        config.setStageShowsAux(true)
        const tally = new UdpTally("test", "channel")
        expect(CommandCreator.createStateCommand(tally, [], [], config, ["channel"])).toEqual("O255/080/000 S255/080/000")
    })
    test('a tally can override the stage AUX default', () => {
        const config = new DefaultTallyConfiguration()
        config.setStageShowsAux(true)
        const tally = new UdpTally("test", "channel")
        tally.configuration.setStageShowsAux(false)
        expect(CommandCreator.createStateCommand(tally, [], [], config, ["channel"])).toEqual("O255/080/000 S000/000/000")
    })
})
describe("operatorShowsIdle()", () => {
    test('an unused camera keeps the light off unless idle is enabled', () => {
        const tally = new UdpTally("test", "channel")
        expect(CommandCreator.createStateCommand(tally, [], [], new DefaultTallyConfiguration())).toEqual("O000/000/000 S000/000/000")
    })
    describe('it uses the default', () => {
        const defaultConfig = new DefaultTallyConfiguration()
        defaultConfig.setOperatorShowsIdle(false)
        const tally = new UdpTally("test", "channel")
        test('for PROGRAM', () => {
            expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O255/000/000 S255/000/000")
        })
        test('for RELEASE', () => {
            expect(CommandCreator.createStateCommand(tally, [], [], defaultConfig)).toEqual("O000/000/000 S000/000/000")
        })
    })
    describe('it can be overridden by a tally configuration', () => {
        const defaultConfig = new DefaultTallyConfiguration()
        defaultConfig.setOperatorShowsIdle(true)
        const tally = new UdpTally("test", "channel")
        tally.configuration.setOperatorShowsIdle(false)
        test('for PROGRAM', () => {
            expect(CommandCreator.createStateCommand(tally, ["channel"], [], defaultConfig)).toEqual("O255/000/000 S255/000/000")
        })
        test('for RELEASE', () => {
            expect(CommandCreator.createStateCommand(tally, [], [], defaultConfig)).toEqual("O000/000/000 S000/000/000")
        })
    })
})