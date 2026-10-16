import test from 'node:test'
import assert from 'node:assert/strict'
import { cameraMode, program, preview, cameraOff, take, blackout, snapshot, csvChannels, snapshotFromScenes } from './state.js'

test('full camera lifecycle without ESP hardware', () => {
    let state = blackout()
    assert.deepEqual(state, { programs: [], previews: [] })
    state = program(state, 1)
    state = preview(state, 2)
    assert.deepEqual(state, { programs: ['1'], previews: ['2'] })
    assert.equal(cameraMode(state, 1), 'program')
    assert.equal(cameraMode(state, 2), 'preview')
    assert.equal(cameraMode(state, 3), 'off')

    state = take(state)
    assert.deepEqual(state, { programs: ['2'], previews: ['1'] })
    state = cameraOff(state, 2)
    assert.deepEqual(state, { programs: [], previews: ['1'] })
    state = blackout()
    assert.deepEqual(state, { programs: [], previews: [] })
})

test('selecting Program removes that camera from Preview', () => {
    assert.deepEqual(program({ programs: ['2'], previews: ['1'] }, 1), {
        programs: ['1'], previews: [],
    })
})

test('Program wins over Preview for a camera on both buses', () => {
    assert.equal(cameraMode({ programs: ['1'], previews: ['1'] }, '1'), 'program')
})

test('snapshot supports multiple cameras and rejects invalid IDs', () => {
    assert.deepEqual(snapshot('1, 3', '2'), { programs: ['1', '3'], previews: ['2'] })
    assert.deepEqual(snapshot('', ''), { programs: [], previews: [] })
    for (const data of ['0', '9', '01', '1,1', '1,', 'foo', '2.5']) {
        assert.throws(() => csvChannels(data))
    }
    assert.throws(() => program(blackout(), 9))
})

test('OBS Program + Preview map to one consistent tally snapshot', () => {
    const mapped = snapshotFromScenes('Scena 2', 'Scena 3', ['Scena 1', 'Scena 2', 'Scena 3'])
    assert.deepEqual(mapped, { programs: ['2'], previews: ['3'] })
    const swapped = snapshotFromScenes('Scena 3', 'Scena 2', ['Scena 1', 'Scena 2', 'Scena 3'])
    assert.deepEqual(swapped, { programs: ['3'], previews: ['2'] })
    assert.deepEqual(snapshotFromScenes('Scene - 1', '', ['Scene - 1', 'Scene - 2', 'Scene - 3']), {
        programs: ['1'], previews: [],
    })
})

test('OBS unknown Program or Preview never becomes a false OFF snapshot', () => {
    const mapping = ['Scena 1', 'Scena 2', 'Scena 3']
    assert.throws(() => snapshotFromScenes('unmapped scene', 'Scena 2', mapping), /Unmapped OBS Program scene/)
    assert.throws(() => snapshotFromScenes('Scena 1', 'unmapped preview', mapping), /Unmapped OBS Preview scene/)
    assert.throws(() => snapshotFromScenes('', 'Scena 2', mapping), /Program scene is empty/)
    assert.throws(() => snapshotFromScenes('Scena 1', 'Scena 2', ['Scena 1', 'Scena 1']), /Duplicate OBS scene/)
})
