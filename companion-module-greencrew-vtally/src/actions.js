import { CAMERA_IDS, program, preview, cameraOff, take, blackout, snapshot, snapshotFromScenes } from './state.js'

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
        sync_obs: {
            name: 'Sync Program + Preview from OBS scenes (atomic)',
            description: 'Use a single Companion trigger with two variable-change events: scene_active and scene_preview. Maps both current scene names into one tally snapshot.',
            options: [
                { type: 'textinput', id: 'programScene', label: 'Current OBS Program scene (variable)', default: '$(obs_local_2:scene_active)', useVariables: true },
                { type: 'textinput', id: 'previewScene', label: 'Current OBS Preview scene (variable)', default: '$(obs_local_2:scene_preview)', useVariables: true },
                { type: 'textinput', id: 'camera1', label: 'OBS scene name for CAM 1', default: 'Scene - 1' },
                { type: 'textinput', id: 'camera2', label: 'OBS scene name for CAM 2', default: 'Scene - 2' },
                { type: 'textinput', id: 'camera3', label: 'OBS scene name for CAM 3', default: 'Scene - 3' },
            ],
            callback: event => {
                try {
                    const options = event.options
                    const state = snapshotFromScenes(options.programScene, options.previewScene, [
                        options.camera1, options.camera2, options.camera3,
                    ])
                    self.setDesired(state)
                } catch (error) {
                    const message = String(error.message || error)
                    self.log('error', `OBS tally sync stopped: ${message}`)
                    self.markSourceInvalid(message)
                }
            },
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
