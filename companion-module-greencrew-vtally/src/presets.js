// API 2.x presets are draggable onto the Companion button grid.
export function definePresets(self) {
    const presets = {}
    const ids = self.getCameraIds()
    for (const id of ids) {
        for (const mode of ['program', 'preview', 'aux']) {
            const key = `${mode}_${id}`
            presets[key] = {
                type: 'simple',
                name: `CAM ${id} ${mode.toUpperCase()}`,
                style: {
                    text: `CAM ${id}\\n${{ program: 'PGM', preview: 'PVW', aux: 'AUX' }[mode]}`,
                    size: '14',
                    color: 0xffffff,
                    bgcolor: 0x202020,
                },
                steps: [{ down: [{ actionId: mode, options: { camera: id } }], up: [] }],
                feedbacks: [{
                    feedbackId: mode,
                    options: { camera: id },
                    style: mode === 'aux'
                        ? { bgcolor: 0xff5000, color: 0x000000 }
                        : { bgcolor: mode === 'program' ? 0xcc0000 : 0x008800, color: 0xffffff },
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
        { id: 'program', name: 'Program', definitions: ids.map(id => `program_${id}`) },
        { id: 'preview', name: 'Preview', definitions: ids.map(id => `preview_${id}`) },
        { id: 'aux', name: 'AUX', definitions: ids.map(id => `aux_${id}`) },
        { id: 'utility', name: 'Utility', definitions: ['blackout'] },
    ], presets)
}
