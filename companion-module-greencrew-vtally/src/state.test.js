import test from 'node:test'
import assert from 'node:assert/strict'
import { cameraMode, program, preview, cameraOff, take, blackout, snapshot, csvChannels, snapshotFromSources, configuredCameraIds, validateConfiguredState } from './state.js'

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

test('Program + Preview map to one consistent tally snapshot', () => {
    const mapped = snapshotFromSources('Scena 2', 'Scena 3', ['Scena 1', 'Scena 2', 'Scena 3'])
    assert.deepEqual(mapped, { programs: ['2'], previews: ['3'] })
    const swapped = snapshotFromSources('Scena 3', 'Scena 2', ['Scena 1', 'Scena 2', 'Scena 3'])
    assert.deepEqual(swapped, { programs: ['3'], previews: ['2'] })
    assert.deepEqual(snapshotFromSources('Scene - 1', '', ['Scene - 1', 'Scene - 2', 'Scene - 3']), {
        programs: ['1'], previews: [],
    })
})

test('Unknown Program or Preview never becomes a false OFF snapshot', () => {
    const mapping = ['Scena 1', 'Scena 2', 'Scena 3']
    assert.throws(() => snapshotFromSources('unmapped scene', 'Scena 2', mapping), /Unmapped Program source/)
    assert.throws(() => snapshotFromSources('Scena 1', 'unmapped preview', mapping), /Unmapped Preview source/)
    assert.throws(() => snapshotFromSources('', 'Scena 2', mapping), /Program source is empty/)
    assert.throws(() => snapshotFromSources('Scena 1', 'Scena 2', ['Scena 1', 'Scena 1']), /Duplicate source mapping/)
})

test('configured cameras limit IDs and reject invalid counts', () => {
    assert.deepEqual(configuredCameraIds(1), ['1'])
    assert.deepEqual(configuredCameraIds(3), ['1', '2', '3'])
    assert.deepEqual(configuredCameraIds(8), ['1', '2', '3', '4', '5', '6', '7', '8'])
    for (const invalid of [0, 9, 2.5, -1, 'not-a-number']) {
        assert.throws(() => configuredCameraIds(invalid))
    }
    assert.deepEqual(validateConfiguredState({ programs: ['3'], previews: ['2'] }, 3), {
        programs: ['3'], previews: ['2'],
    })
    assert.throws(() => validateConfiguredState({ programs: ['4'], previews: ['2'] }, 3), /outside the configured camera count/)
})

test('generic source matching supports non-OBS source values and variable camera counts', () => {
    assert.deepEqual(snapshotFromSources('7', '5', ['5', '7']), {
        programs: ['2'], previews: ['1'],
    })
    assert.deepEqual(snapshotFromSources('Input HD', 'Camera C', ['Camera A', 'Camera B', 'Camera C', 'Input HD']), {
        programs: ['4'], previews: ['3'],
    })
    assert.throws(() => snapshotFromSources('9', '5', ['5', '7']), /Unmapped Program source/)
})
