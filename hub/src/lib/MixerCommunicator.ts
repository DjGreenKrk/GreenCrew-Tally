/* helper so that video mixer connectors do not need to implement events */

import Channel from "../domain/Channel"
import { AppConfiguration } from "./AppConfiguration"
import ServerEventEmitter from "./ServerEventEmitter"

const haveValuesChanged = (lastArray: ChannelList, newArray: ChannelList) => {
    if(Array.isArray(lastArray) && Array.isArray(newArray)) {
        return lastArray.length !== newArray.length || lastArray.some((value, index) => value !== newArray[index])
    } else {
        return lastArray !== newArray
    }
}

export type ChannelList = string[] | null

export class MixerCommunicator {
    configuration: AppConfiguration
    emitter: ServerEventEmitter
    currentPrograms: ChannelList
    currentPreviews: ChannelList
    // Only some sources (Companion) know AUX routing; the others leave it empty.
    currentAuxes: string[]
    isConnected: boolean | null
    currentVmixPreset?: string
    
    constructor(configuration: AppConfiguration, emitter: ServerEventEmitter) {
        this.configuration = configuration
        this.emitter = emitter

        this.currentPrograms = null
        this.currentPreviews = null
        this.currentAuxes = []
        this.isConnected = null
        this.currentVmixPreset = undefined
    }

    private changeProgramsIfNecessary(programs: ChannelList) {
        programs = programs ? programs.map(v => v.toString()) : null
        if (haveValuesChanged(programs, this.currentPrograms)) {
            this.currentPrograms = programs
            return true
        } else {
            return false
        }
    }

    private changePreviewsIfNecessary(previews: ChannelList) {
        previews = previews ? previews.map(v => v.toString()) : null
        if (haveValuesChanged(previews, this.currentPreviews)) {
            this.currentPreviews = previews
            return true
        } else {
            return false
        }
    }

    private changeAuxesIfNecessary(auxes: string[]) {
        auxes = auxes.map(v => v.toString())
        if (haveValuesChanged(auxes, this.currentAuxes)) {
            this.currentAuxes = auxes
            return true
        } else {
            return false
        }
    }

    private emitProgramChanged() {
        this.emitter.emit('program.changed', { programs: this.currentPrograms, previews: this.currentPreviews, auxes: this.currentAuxes })
    }

    notifyProgramPreviewChanged(programs: ChannelList, previews: ChannelList, auxes: string[] = []) {
        const programChanged = this.changeProgramsIfNecessary(programs)
        const previewChanged = this.changePreviewsIfNecessary(previews)
        const auxChanged = this.changeAuxesIfNecessary(auxes)
        if (previewChanged || programChanged || auxChanged) {
            this.emitProgramChanged()
        }
    }

    notifyProgramChanged(programs: ChannelList) {
        const programChanged = this.changeProgramsIfNecessary(programs)
        if (programChanged) {
            this.emitProgramChanged()
        }
    }

    notifyPreviewChanged(previews: ChannelList) {
        const previewChanged = this.changePreviewsIfNecessary(previews)
        if (previewChanged) {
            this.emitProgramChanged()
        }
    }

    notifyChannelNames(count?: number, names?: object) {
        if (count === null) {
            this.notifyChannels(null)
        } else {
            // empty array with `count` elements.
            // `fill` is necessary, because Array() does not fill the array with anything - not even `undefined` ¯\_(ツ)_/¯
            const range = Array(count).fill(null)
            
            const channels = range.map((_,i) => {
                const name = names && names[i+1]
                return new Channel((i+1).toString(), name)
            })

            this.notifyChannels(channels)
        }
    }

    notifyChannels(channels : Channel[] | null) {
        channels = channels || []
        if (JSON.stringify(channels.map(c => c.toJson())) !== JSON.stringify(this.configuration.getChannels().map(c => c.toJson()))) {
            this.configuration.setChannels(channels)
        }
    }

    notifyVmixProject(presetPath?: string) {
        if (this.currentVmixPreset !== presetPath) {
            this.currentVmixPreset = presetPath
            this.emitter.emit('vmix.project.changed', presetPath)
        }
    }

    notifyMixerIsConnected() {
        if (this.isConnected !== true) {
            this.isConnected = true
            this.emitter.emit('mixer.connected')
        }
    }

    notifyMixerIsDisconnected() {
        if (this.isConnected !== false) {
            this.isConnected = false
            this.emitter.emit('mixer.disconnected')
        }
    }

    getCurrentPrograms() {
        return this.currentPrograms
    }

    getCurrentPreviews() {
        return this.currentPreviews
    }

    getCurrentAuxes() {
        return this.currentAuxes
    }
}
