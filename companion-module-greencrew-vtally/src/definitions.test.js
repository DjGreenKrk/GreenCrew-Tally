import test from 'node:test'
import assert from 'node:assert/strict'
import { defineFeedbacks, defineVariables, updateIndicators } from './feedbacks.js'
import { definePresets } from './presets.js'
import { configuredCameraIds, blackout } from './state.js'

function fakeModule(count) {
    return {
        confirmed: blackout(),
        getCameraIds() { return configuredCameraIds(count) },
        setFeedbackDefinitions(definitions) { this.feedbacks = definitions },
        setVariableDefinitions(definitions) { this.variables = definitions },
        setVariableValues(values) { this.values = values },
        setPresetDefinitions(categories, presets) {
            this.categories = categories
            this.presets = presets
        },
        checkFeedbacks() {},
    }
}

test('changing camera count controls feedbacks, variables and presets', () => {
    for (const count of [1, 3, 5, 8]) {
        const module = fakeModule(count)
        defineVariables(module)
        defineFeedbacks(module)
        definePresets(module)
        updateIndicators(module)

        assert.equal(module.feedbacks.program.options[0].choices.length, count)
        assert.equal(module.feedbacks.preview.options[0].choices.length, count)
        assert.equal(module.feedbacks.aux.options[0].choices.length, count)
        assert.equal(module.feedbacks.aux.defaultStyle.bgcolor, 0xff5000)
        assert.equal(module.values.auxes, '')
        assert.equal(module.categories.find(category => category.id === 'aux').definitions.length, count)
        assert.equal(module.presets[`aux_${count}`].steps[0].down[0].actionId, 'aux')
        assert.equal(Object.keys(module.variables).filter(key => key.startsWith('cam_')).length, count)
        assert.equal(Object.keys(module.values).filter(key => key.startsWith('cam_')).length, count)
        assert.equal(module.categories.find(category => category.id === 'program').definitions.length, count)
        assert.equal(module.categories.find(category => category.id === 'preview').definitions.length, count)
        assert.equal(Object.keys(module.presets).length, 3 * count + 1)
        assert.equal(module.presets.program_1.steps[0].down[0].options.camera, '1')
        assert.equal(module.presets[`preview_${count}`].steps[0].down[0].options.camera, String(count))
    }
})

test('a smaller camera count never exposes old higher camera choices or presets', () => {
    const module = fakeModule(2)
    defineVariables(module)
    defineFeedbacks(module)
    definePresets(module)
    assert.equal(module.variables.cam_3, undefined)
    assert.equal(module.presets.program_3, undefined)
    assert.deepEqual(module.feedbacks.program.options[0].choices.map(choice => choice.id), ['1', '2'])
})
