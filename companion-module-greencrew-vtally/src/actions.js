import { program, preview, cameraOff, take, blackout, snapshot, snapshotFromSources } from './state.js'

export function defineActions(self) {
    const cameraIds = self.getCameraIds()
    const cameras = cameraIds.map(id => ({ id, label: `CAM ${id}` }))
    const cameraOption = () => ({ type: 'dropdown', id: 'camera', label: 'Camera', default: cameraIds[0], choices: cameras })

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
        sync_sources: {
            name: 'Sync Program + Preview from Companion variables',
            description: 'Map the resolved Program and Preview values of any Companion connection (ATEM, vMix, OBS, etc.) to vTally camera numbers in one complete snapshot.',
            options: [
                { type: 'textinput', id: 'programSource', label: 'Program source variable', default: '', useVariables: true },
                { type: 'textinput', id: 'previewSource', label: 'Preview source variable', default: '', useVariables: true },
                ...cameraIds.map(id => ({
                    type: 'textinput',
                    id: `source_${id}`,
                    label: `Value identifying CAM ${id}`,
                    default: id,
                    description: 'Exact source value (scene name, input number or input name) returned by the selected connection',
                })),
            ],
            callback: event => {
                try {
                    const options = event.options
                    const mapped = cameraIds.map(id => options[`source_${id}`])
                    const state = snapshotFromSources(options.programSource, options.previewSource, mapped)
                    self.setDesired(state)
                } catch (error) {
                    const message = String(error.message || error)
                    self.log('error', `Source synchronization failed: ${message}`)
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
                    const message = String(error.message || error)
                    self.log('error', `Invalid snapshot: ${message}`)
                    self.markSourceInvalid(message)
                }
            },
        },
    })
}
