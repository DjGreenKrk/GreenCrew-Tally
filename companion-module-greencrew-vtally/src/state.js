// Pure tally state helpers; deliberately independent of Companion itself.
export const CAMERA_IDS = ['1', '2', '3', '4', '5', '6', '7', '8']

export function configuredCameraIds(count) {
    const n = Number(count)
    if (!Number.isInteger(n) || n < 1 || n > CAMERA_IDS.length) throw new Error('Camera count must be 1..8')
    return CAMERA_IDS.slice(0, n)
}

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

const auxesOf = state => [...(state.auxes ?? [])]

export function program(state, camera) {
    const id = cameraId(camera)
    return { programs: [id], previews: state.previews.filter(v => v !== id), auxes: auxesOf(state) }
}

export function preview(state, camera) {
    const id = cameraId(camera)
    return { programs: [...state.programs], previews: [id], auxes: auxesOf(state) }
}

export function aux(state, camera) {
    const id = cameraId(camera)
    return { programs: [...state.programs], previews: [...state.previews], auxes: [id] }
}

export function toggleAux(state, camera) {
    const id = cameraId(camera)
    const current = auxesOf(state)
    return {
        programs: [...state.programs],
        previews: [...state.previews],
        auxes: current.includes(id) ? current.filter(v => v !== id) : [...current, id],
    }
}

export function clearAux(state) {
    return { programs: [...state.programs], previews: [...state.previews], auxes: [] }
}

export function cameraOff(state, camera) {
    const id = cameraId(camera)
    return {
        programs: state.programs.filter(v => v !== id),
        previews: state.previews.filter(v => v !== id),
        auxes: auxesOf(state).filter(v => v !== id),
    }
}

export function take(state) {
    if (!state.previews.length) return { programs: [...state.programs], previews: [...state.previews], auxes: auxesOf(state) }
    return { programs: [...state.previews], previews: [...state.programs], auxes: auxesOf(state) }
}

export function blackout() {
    return { programs: [], previews: [], auxes: [] }
}

export function snapshot(programs, previews, auxes) {
    return { programs: csvChannels(programs), previews: csvChannels(previews), auxes: csvChannels(auxes) }
}

// Priority: Program > AUX > Preview.
export function cameraMode(state, camera) {
    const id = cameraId(camera)
    if (state.programs.includes(id)) return 'program'
    if ((state.auxes ?? []).includes(id)) return 'aux'
    if (state.previews.includes(id)) return 'preview'
    return 'off'
}

/**
 * Resolve any mixer source names/IDs into one atomic Program/Preview/AUX snapshot.
 * Unknown sources are errors: callers must not report them as safely OFF.
 */
export function snapshotFromSources(programSource, previewSource, sources, auxSource = '') {
    const ids = configuredCameraIds(sources.length)
    const normalize = value => String(value ?? '').trim()
    const sourceToId = new Map()
    for (const [i, name] of sources.entries()) {
        const id = ids[i]
        const value = normalize(name)
        if (!value) continue
        if (sourceToId.has(value)) throw new Error(`Duplicate source mapping: "${value}"`)
        sourceToId.set(value, id)
    }

    const resolveSource = (name, bus) => {
        const value = normalize(name)
        if (!value) {
            if (bus !== 'Program') return []
            throw new Error('Program source is empty or unavailable')
        }
        const id = sourceToId.get(value)
        // Program/Preview/AUX often carry a non-camera input (graphics, media,
        // multiview): no camera is on that bus then. Throwing would stop the
        // heartbeat and turn every tally UNKNOWN at the Hub. An empty Program
        // (variable unavailable) is still an error, see above.
        return id ? [id] : []
    }

    return {
        programs: resolveSource(programSource, 'Program'),
        previews: resolveSource(previewSource, 'Preview'),
        auxes: resolveSource(auxSource, 'AUX'),
    }
}

export function validateConfiguredState(state, cameraCount) {
    const allowed = new Set(configuredCameraIds(cameraCount))
    for (const id of [...state.programs, ...state.previews, ...(state.auxes ?? [])]) {
        if (!allowed.has(id)) throw new Error('Camera ' + id + ' is outside the configured camera count')
    }
    return state
}
