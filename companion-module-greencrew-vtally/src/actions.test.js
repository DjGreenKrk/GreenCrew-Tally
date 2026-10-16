import test from 'node:test'
import assert from 'node:assert/strict'
import { defineActions } from './actions.js'
import { blackout } from './state.js'

function fakeModule() {
    return {
        desired: blackout(),
        sent: [],
        errors: [],
        actions: null,
        setActionDefinitions(actions) { this.actions = actions },
        setDesired(state) { this.desired = state; this.sent.push(state) },
        markSourceInvalid(message) { this.errors.push(message) },
        log() {},
    }
}

test('single OBS trigger sync action atomically sets both camera buses', async () => {
    const module = fakeModule()
    defineActions(module)
    const action = module.actions.sync_obs
    assert.equal(action.options[0].useVariables, true)
    assert.equal(action.options[1].useVariables, true)

    await action.callback({
        options: {
            programScene: 'Scene - 1',
            previewScene: 'Scene - 2',
            camera1: 'Scene - 1',
            camera2: 'Scene - 2',
            camera3: 'Scene - 3',
        },
    })
    assert.deepEqual(module.desired, { programs: ['1'], previews: ['2'] })

    await action.callback({
        options: {
            programScene: 'Scene - 2',
            previewScene: 'Scene - 1',
            camera1: 'Scene - 1',
            camera2: 'Scene - 2',
            camera3: 'Scene - 3',
        },
    })
    assert.deepEqual(module.desired, { programs: ['2'], previews: ['1'] })
    assert.equal(module.sent.length, 2)
    assert.deepEqual(module.errors, [])
})

test('unknown OBS scene does not send a misleading tally snapshot', async () => {
    const module = fakeModule()
    defineActions(module)
    await module.actions.sync_obs.callback({
        options: {
            programScene: 'Camera X',
            previewScene: 'Scene - 2',
            camera1: 'Scene - 1',
            camera2: 'Scene - 2',
            camera3: 'Scene - 3',
        },
    })
    assert.equal(module.sent.length, 0)
    assert.equal(module.errors.length, 1)
    assert.match(module.errors[0], /Unmapped OBS Program scene/)
})
