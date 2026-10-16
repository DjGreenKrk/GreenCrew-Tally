// Pure tally state helpers; deliberately independent of Companion itself.
export const CAMERA_IDS = ['1', '2', '3', '4', '5', '6', '7', '8']

export function cameraId(value) {
    const id = String(value)
    if (!CAMERA_IDS.includes(id)) throw new Error(`Invalid camera ID: ${id}`)
    return id
}

export function csvChannels(value) {
    const text = String(value ?? '').trim()
    if (text === '') return []
    const parts = text.split(',').map(v => v.trim())
    if (parts.some(v => !CAMERA_IDS.includes(v)) || new Set(parts).size !== parts.length) {
        throw new Error('Camera list must contain unique IDs 1..8, separated by commas')
    }
    return parts
}

export function program(state, camera) {
    const id = cameraId(camera)
    return { programs: [id], previews: state.previews.filter(v => v !== id) }
}

export function preview(state, camera) {
    const id = cameraId(camera)
    return { programs: [...state.programs], previews: [id] }
}

export function cameraOff(state, camera) {
    const id = cameraId(camera)
    return { programs: state.programs.filter(v => v !== id), previews: state.previews.filter(v => v !== id) }
}

export function take(state) {
    if (!state.previews.length) return { programs: [...state.programs], previews: [...state.previews] }
    return { programs: [...state.previews], previews: [...state.programs] }
}

export function blackout() {
    return { programs: [], previews: [] }
}

export function snapshot(programs, previews) {
    return { programs: csvChannels(programs), previews: csvChannels(previews) }
}

export function cameraMode(state, camera) {
    const id = cameraId(camera)
    if (state.programs.includes(id)) return 'program'
    if (state.previews.includes(id)) return 'preview'
    return 'off'
}

/**
 * Convert OBS scene names into one atomic tally snapshot.
 * Refuse unknown scene names: treating an unmapped on-air scene as OFF would
 * be dangerous. The caller should stop heartbeats so Hub reports UNKNOWN.
 */
export function snapshotFromScenes(programScene, previewScene, sceneNames) {
    const normalize = value => String(value ?? '').trim()
    const sceneToId = new Map()
    for (const [i, name] of sceneNames.entries()) {
        const id = cameraId(i + 1)
        const value = normalize(name)
        if (!value) continue
        if (sceneToId.has(value)) throw new Error(`Duplicate OBS scene mapping: "${value}"`)
        sceneToId.set(value, id)
    }

    const resolveScene = (name, bus) => {
        const value = normalize(name)
        if (!value) {
            if (bus === 'Preview') return []
            throw new Error('OBS Program scene is empty or unavailable')
        }
        const id = sceneToId.get(value)
        if (!id) throw new Error(`Unmapped OBS ${bus} scene: "${value}"`)
        return [id]
    }

    return {
        programs: resolveScene(programScene, 'Program'),
        previews: resolveScene(previewScene, 'Preview'),
    }
}
