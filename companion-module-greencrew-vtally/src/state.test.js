import test from 'node:test'
import assert from 'node:assert/strict'
import { cameraMode, aux, toggleAux, clearAux, program, preview, cameraOff, take, blackout, snapshot, csvChannels, snapshotFromSources, configuredCameraIds, validateConfiguredState, MAX_CAMERAS } from './state.js'

test('full camera lifecycle without ESP hardware', () => {
    let state = blackout()
    assert.deepEqual(state, { programs: [], previews: [], auxes: [] })
    state = program(state, 1)
    state = preview(state, 2)
    assert.deepEqual(state, { programs: ['1'], previews: ['2'], auxes: [] })
    assert.equal(cameraMode(state, 1), 'program')
    assert.equal(cameraMode(state, 2), 'preview')
    assert.equal(cameraMode(state, 3), 'off')

    state = take(state)
    assert.deepEqual(state, { programs: ['2'], previews: ['1'], auxes: [] })
    state = cameraOff(state, 2)
    assert.deepEqual(state, { programs: [], previews: ['1'], auxes: [] })
    state = blackout()
    assert.deepEqual(state, { programs: [], previews: [], auxes: [] })
})

test('selecting Program removes that camera from Preview', () => {
    assert.deepEqual(program({ programs: ['2'], previews: ['1'] }, 1), {
        programs: ['1'], previews: [], auxes: [],
    })
})

test('Program wins over Preview for a camera on both buses', () => {
    assert.equal(cameraMode({ programs: ['1'], previews: ['1'] }, '1'), 'program')
})

test('snapshot supports multiple cameras and rejects invalid IDs', () => {
    assert.deepEqual(snapshot('1, 3', '2'), { programs: ['1', '3'], previews: ['2'], auxes: [] })
    assert.deepEqual(snapshot('', ''), { programs: [], previews: [], auxes: [] })
    for (const data of ['0', '33', '01', '1,1', '1,', 'foo', '2.5']) {
        assert.throws(() => csvChannels(data))
    }
    assert.throws(() => program(blackout(), 33))
})

test('Program + Preview map to one consistent tally snapshot', () => {
    const mapped = snapshotFromSources('Scena 2', 'Scena 3', ['Scena 1', 'Scena 2', 'Scena 3'])
    assert.deepEqual(mapped, { programs: ['2'], previews: ['3'], auxes: [] })
    const swapped = snapshotFromSources('Scena 3', 'Scena 2', ['Scena 1', 'Scena 2', 'Scena 3'])
    assert.deepEqual(swapped, { programs: ['3'], previews: ['2'], auxes: [] })
    assert.deepEqual(snapshotFromSources('Scene - 1', '', ['Scene - 1', 'Scene - 2', 'Scene - 3']), {
        programs: ['1'], previews: [], auxes: [],
    })
})

test('An unavailable Program is an error, not a false OFF snapshot', () => {
    const mapping = ['Scena 1', 'Scena 2', 'Scena 3']
    assert.throws(() => snapshotFromSources('', 'Scena 2', mapping), /Program source is empty/)
    assert.throws(() => snapshotFromSources('Scena 1', 'Scena 2', ['Scena 1', 'Scena 1']), /Duplicate source mapping/)
})

test('A Program source that is not a camera means no camera on air, not an invalid snapshot', () => {
    const mapping = ['Scena 1', 'Scena 2', 'Scena 3']
    assert.deepEqual(snapshotFromSources('Grafika', 'Scena 2', mapping), { programs: [], previews: ['2'], auxes: [] })
})

test('A Preview source that is not a camera means no camera in Preview, not an invalid snapshot', () => {
    const mapping = ['Scena 1', 'Scena 2', 'Scena 3']
    assert.deepEqual(snapshotFromSources('Scena 1', '12', mapping), { programs: ['1'], previews: [], auxes: [] })
})

test('An AUX source that is not a camera means no camera on AUX, not an invalid snapshot', () => {
    const mapping = ['Scena 1', 'Scena 2', 'Scena 3']
    for (const aux of ['10010', '20', '$(']) {
        assert.deepEqual(snapshotFromSources('Scena 1', 'Scena 2', mapping, aux), {
            programs: ['1'], previews: ['2'], auxes: [],
        })
    }
    assert.deepEqual(snapshotFromSources('Scena 1', 'Scena 2', mapping, 'Scena 3').auxes, ['3'])
})

test('configured cameras limit IDs and reject invalid counts', () => {
    assert.deepEqual(configuredCameraIds(1), ['1'])
    assert.deepEqual(configuredCameraIds(3), ['1', '2', '3'])
    assert.deepEqual(configuredCameraIds(8), ['1', '2', '3', '4', '5', '6', '7', '8'])
    assert.equal(MAX_CAMERAS, 32)
    assert.deepEqual(configuredCameraIds(32), Array.from({ length: 32 }, (_, i) => String(i + 1)))
    assert.deepEqual(csvChannels('12,1,32'), ['12', '1', '32'])
    assert.throws(() => csvChannels('33'), /1\.\.32/)
    for (const invalid of [0, 33, 2.5, -1, 'not-a-number']) {
        assert.throws(() => configuredCameraIds(invalid))
    }
    assert.deepEqual(validateConfiguredState({ programs: ['3'], previews: ['2'], auxes: [] }, 3), {
        programs: ['3'], previews: ['2'], auxes: [],
    })
    assert.throws(() => validateConfiguredState({ programs: [], previews: [], auxes: ['5'] }, 3), /outside the configured camera count/)
    assert.throws(() => validateConfiguredState({ programs: ['4'], previews: ['2'] }, 3), /outside the configured camera count/)
})

test('generic source matching supports non-OBS source values and variable camera counts', () => {
    assert.deepEqual(snapshotFromSources('7', '5', ['5', '7']), {
        programs: ['2'], previews: ['1'], auxes: [],
    })
    assert.deepEqual(snapshotFromSources('Input HD', 'Camera C', ['Camera A', 'Camera B', 'Camera C', 'Input HD']), {
        programs: ['4'], previews: ['3'], auxes: [],
    })
    assert.deepEqual(snapshotFromSources('9', '5', ['5', '7']), { programs: [], previews: ['1'], auxes: [] })
})

test('AUX is an independent bus with priority Program > AUX > Preview', () => {
    let state = aux(blackout(), 3)
    assert.deepEqual(state, { programs: [], previews: [], auxes: ['3'] })
    assert.equal(cameraMode(state, 3), 'aux')
    assert.equal(cameraMode({ programs: [], previews: ['3'], auxes: ['3'] }, 3), 'aux')
    assert.equal(cameraMode({ programs: ['3'], previews: ['3'], auxes: ['3'] }, 3), 'program')
    // Older state without auxes still works.
    assert.equal(cameraMode({ programs: [], previews: ['1'] }, 1), 'preview')

    state = program(preview(state, 2), 1)
    assert.deepEqual(state, { programs: ['1'], previews: ['2'], auxes: ['3'] })
    assert.deepEqual(take(state), { programs: ['2'], previews: ['1'], auxes: ['3'] })
    assert.deepEqual(cameraOff(state, 3), { programs: ['1'], previews: ['2'], auxes: [] })
    assert.deepEqual(blackout(), { programs: [], previews: [], auxes: [] })
})

test('toggleAux adds and removes, clearAux empties only AUX', () => {
    let state = toggleAux({ programs: ['1'], previews: [], auxes: [] }, 2)
    state = toggleAux(state, 3)
    assert.deepEqual(state.auxes, ['2', '3'])
    state = toggleAux(state, 2)
    assert.deepEqual(state.auxes, ['3'])
    assert.deepEqual(clearAux(state), { programs: ['1'], previews: [], auxes: [] })
})

test('snapshot and sources support optional AUX', () => {
    assert.deepEqual(snapshot('1', '2', '3,4'), { programs: ['1'], previews: ['2'], auxes: ['3', '4'] })
    assert.throws(() => snapshot('1', '2', '3,3'))
    const map = ['A', 'B', 'C']
    assert.deepEqual(snapshotFromSources('A', 'B', map, 'C'), { programs: ['1'], previews: ['2'], auxes: ['3'] })
    assert.deepEqual(snapshotFromSources('A', '', map, ''), { programs: ['1'], previews: [], auxes: [] })
    assert.deepEqual(snapshotFromSources('A', 'B', map, 'Z'), { programs: ['1'], previews: ['2'], auxes: [] })
})
