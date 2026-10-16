import { CAMERA_IDS, program, preview, cameraOff, take, blackout, snapshot } from './state.js'

export function defineActions(self) {
    const cameras = CAMERA_IDS.map(id => ({ id, label: `CAM ${id}` }))
    const cameraOption = () => ({ type: 'dropdown', id: 'camera', label: 'Camera', default: '1', choices: cameras })

    self.setActionDefinitions({
        program: {
            name: 'Set Program camera (red)',
            options: [cameraOption()],
            callback: event => self.setDesired(program(self.desired, event.options.camera)),
        },
        preview: {
            name: 'Set Preview camera (green)',
            options: [cameraOption()],
            callback: event => self.setDesired(preview(self.desired, event.options.camera)),
        },
        off: {
            name: 'Clear one camera',
            options: [cameraOption()],
            callback: event => self.setDesired(cameraOff(self.desired, event.options.camera)),
        },
        take: {
            name: 'TAKE: swap Program / Preview',
            options: [],
            callback: () => self.setDesired(take(self.desired)),
        },
        blackout: {
            name: 'Clear all cameras (blackout)',
            options: [],
            callback: () => self.setDesired(blackout()),
        },
        snapshot: {
            name: 'Set full Program / Preview snapshot',
            options: [
                { type: 'textinput', id: 'programs', label: 'Program camera IDs (comma-separated)', default: '1', useVariables: true },
                { type: 'textinput', id: 'previews', label: 'Preview camera IDs (comma-separated)', default: '2', useVariables: true },
            ],
            callback: event => {
                try {
                    self.setDesired(snapshot(event.options.programs, event.options.previews))
                } catch (error) {
                    self.log('error', String(error.message || error))
                }
            },
        },
    })
}
