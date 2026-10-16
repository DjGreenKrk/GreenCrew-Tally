import { CAMERA_IDS } from './state.js'

// API 2.x presets are draggable onto the Companion button grid.
export function definePresets(self) {
    const presets = {}
    for (const id of CAMERA_IDS) {
        for (const mode of ['program', 'preview']) {
            const key = `${mode}_${id}`
            presets[key] = {
                type: 'simple',
                name: `CAM ${id} ${mode.toUpperCase()}`,
                style: {
                    text: `CAM ${id}\\n${mode === 'program' ? 'PGM' : 'PVW'}`,
                    size: '14',
                    color: 0xffffff,
                    bgcolor: 0x202020,
                },
                steps: [{ down: [{ actionId: mode, options: { camera: id } }], up: [] }],
                feedbacks: [{
                    feedbackId: mode,
                    options: { camera: id },
                    style: { bgcolor: mode === 'program' ? 0xcc0000 : 0x008800, color: 0xffffff },
                }],
            }
        }
    }
    presets.blackout = {
        type: 'simple',
        name: 'All tally OFF',
        style: { text: 'ALL\\nOFF', size: '14', color: 0xffffff, bgcolor: 0x252525 },
        steps: [{ down: [{ actionId: 'blackout', options: {} }], up: [] }],
        feedbacks: [],
    }
    self.setPresetDefinitions([
        { id: 'program', name: 'Program', definitions: CAMERA_IDS.map(id => `program_${id}`) },
        { id: 'preview', name: 'Preview', definitions: CAMERA_IDS.map(id => `preview_${id}`) },
        { id: 'utility', name: 'Utility', definitions: ['blackout'] },
    ], presets)
}
