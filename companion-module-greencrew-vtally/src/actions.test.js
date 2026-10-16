import test from 'node:test'
import assert from 'node:assert/strict'
import { defineActions } from './actions.js'
import { blackout, configuredCameraIds, validateConfiguredState } from './state.js'

function fakeModule(count = 3) {
    return {
        desired: blackout(),
        sent: [],
        errors: [],
        actions: null,
        getCameraIds() { return configuredCameraIds(count) },
        setActionDefinitions(actions) { this.actions = actions },
        setDesired(state) {
            validateConfiguredState(state, count)
            this.desired = state
            this.sent.push(state)
        },
        markSourceInvalid(message) { this.errors.push(message) },
        log() {},
    }
}

test('configured count controls all single-camera action choices', () => {
    for (const count of [1, 3, 8]) {
        const module = fakeModule(count)
        defineActions(module)
        for (const action of ['program', 'preview', 'off']) {
            assert.equal(module.actions[action].options[0].choices.length, count)
        }
        assert.equal(module.actions.sync_sources.options.length, count + 2)
        assert.equal(module.actions.sync_sources.options[0].useVariables, true)
        assert.equal(module.actions.sync_sources.options[1].useVariables, true)
    }
    const module = fakeModule(3)
    defineActions(module)
    assert.equal(module.actions.sync_obs, undefined)
})

test('sync sources sets Program + Preview atomically with varying camera count', async () => {
    const module = fakeModule(4)
    defineActions(module)
    await module.actions.sync_sources.callback({
        options: {
            programSource: 'Input 4',
            previewSource: 'Input 2',
            source_1: 'Input 1',
            source_2: 'Input 2',
            source_3: 'Input 3',
            source_4: 'Input 4',
        },
    })
    assert.deepEqual(module.desired, { programs: ['4'], previews: ['2'] })
    assert.equal(module.sent.length, 1)

    await module.actions.sync_sources.callback({
        options: {
            programSource: 'Input 2',
            previewSource: 'Input 1',
            source_1: 'Input 1',
            source_2: 'Input 2',
            source_3: 'Input 3',
            source_4: 'Input 4',
        },
    })
    assert.deepEqual(module.desired, { programs: ['2'], previews: ['1'] })
    assert.equal(module.sent.length, 2)
})

test('unmapped source rejects snapshot and stops stale heartbeats', async () => {
    const module = fakeModule(2)
    defineActions(module)
    await module.actions.sync_sources.callback({
        options: {
            programSource: 'unknown input',
            previewSource: 'Camera B',
            source_1: 'Camera A',
            source_2: 'Camera B',
        },
    })
    assert.equal(module.sent.length, 0)
    assert.equal(module.errors.length, 1)
    assert.match(module.errors[0], /Unmapped Program source/)
})
