import { cameraMode } from './state.js'

export function defineFeedbacks(self) {
    const ids = self.getCameraIds()
    const cameraOption = () => ({
        type: 'dropdown',
        id: 'camera',
        label: 'Camera',
        default: ids[0],
        choices: ids.map(id => ({ id, label: `CAM ${id}` })),
    })
    self.setFeedbackDefinitions({
        program: {
            type: 'boolean',
            name: 'Camera on confirmed Program',
            defaultStyle: { bgcolor: 0xcc0000, color: 0xffffff },
            options: [cameraOption()],
            callback: event => !!self.confirmed && self.confirmed.programs.includes(String(event.options.camera)),
        },
        preview: {
            type: 'boolean',
            name: 'Camera on confirmed Preview (if not Program)',
            defaultStyle: { bgcolor: 0x008800, color: 0xffffff },
            options: [cameraOption()],
            callback: event => !!self.confirmed && cameraMode(self.confirmed, event.options.camera) === 'preview',
        },
        connected: {
            type: 'boolean',
            name: 'Hub accepting HTTP snapshots',
            defaultStyle: { bgcolor: 0x008800, color: 0xffffff },
            options: [],
            callback: () => self.confirmed !== null,
        },
    })
}

export function defineVariables(self) {
    const ids = self.getCameraIds()
    self.setVariableDefinitions({
        connected: { name: 'Hub communication (1/0)' },
        programs: { name: 'Confirmed Program camera IDs' },
        previews: { name: 'Confirmed Preview camera IDs' },
        ...Object.fromEntries(ids.map(id => [`cam_${id}`, { name: `Camera ${id} state` }])),
    })
}

export function updateIndicators(self) {
    const ids = self.getCameraIds()
    const state = self.confirmed
    self.setVariableValues({
        connected: state ? '1' : '0',
        programs: state ? state.programs.join(',') : '',
        previews: state ? state.previews.join(',') : '',
        ...Object.fromEntries(ids.map(id => [`cam_${id}`, state ? cameraMode(state, id) : 'unknown'])),
    })
    self.checkFeedbacks('program', 'preview', 'connected')
}
