import { OBSWebSocket } from 'obs-websocket-js/json'
import Channel from '../../domain/Channel'
import { MixerCommunicator } from '../../lib/MixerCommunicator'
import { Connector } from '../interfaces'
import ObsConfiguration from './ObsConfiguration'

const reconnectTimeoutMs = 1000
const RECORD_PAUSED = 'OBS_WEBSOCKET_OUTPUT_PAUSED'

type SceneItem = { sourceName?: unknown, sourceType?: unknown, sceneItemEnabled?: unknown }

// uses the obs-websocket 5 server built into OBS Studio 28+
// @see https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
class ObsConnector implements Connector {
    configuration: ObsConfiguration
    communicator: MixerCommunicator
    // tracks which scenes are embedded into other scenes - directly or nested
    embeddedScenes: Record<string, string[]> = {}
    reconnectTimeout: NodeJS.Timeout | null = null
    obs: OBSWebSocket | null = null
    connected: boolean = false
    private programScene: string | null = null
    // the program scene when the running transition started, null otherwise
    private transitionFrom: string | null = null
    private previewScene: string | null = null
    private isStreaming: boolean = false
    private isRecording: boolean = false
    private createObs: () => OBSWebSocket

    // createObs is injectable for tests
    constructor(configuration: ObsConfiguration, communicator: MixerCommunicator, createObs = () => new OBSWebSocket()) {
        this.configuration = configuration
        this.communicator = communicator
        this.createObs = createObs
    }

    connect() {
        const obs = this.createObs()
        this.obs = obs
        obs.on('CurrentProgramSceneChanged', ({ sceneName }) => this.onProgramSceneChanged(sceneName))
        obs.on('SceneTransitionStarted', () => this.onTransitionStarted())
        obs.on('SceneTransitionVideoEnded', () => this.onTransitionEnded())
        // a transition that is cut short does not send VideoEnded
        obs.on('SceneTransitionEnded', () => this.onTransitionEnded())
        obs.on('CurrentPreviewSceneChanged', ({ sceneName }) => {
            this.previewScene = sceneName
            this.notifyChanged()
        })
        obs.on('StudioModeStateChanged', ({ studioModeEnabled }) => {
            if (studioModeEnabled) {
                this.updatePreviewScene()
            } else {
                this.previewScene = null
                this.notifyChanged()
            }
        })
        const updateScenes = () => this.updateScenes()
        obs.on('SceneListChanged', updateScenes)
        obs.on('SceneNameChanged', updateScenes)
        obs.on('SceneItemCreated', updateScenes)
        obs.on('SceneItemRemoved', updateScenes)
        obs.on('SceneItemEnableStateChanged', updateScenes)
        obs.on('CurrentSceneCollectionChanged', () => {
            this.updateScenes()
            this.updatePreviewScene()
        })
        obs.on('StreamStateChanged', ({ outputActive }) => {
            this.isStreaming = outputActive
            this.notifyChanged()
        })
        obs.on('RecordStateChanged', ({ outputActive, outputState }) => {
            this.isRecording = outputActive && outputState !== RECORD_PAUSED
            this.notifyChanged()
        })
        obs.on('ConnectionClosed', error => {
            if (this.obs !== obs || !this.connected) return
            console.error("Connection to OBS lost:", error.message)
            this.connected = false
            this.communicator.notifyMixerIsDisconnected()
            this.scheduleReconnect()
        })

        this.communicator.notifyProgramPreviewChanged(null, null)
        this.connectSocket()
    }

    private connectSocket() {
        const obs = this.obs
        if (!obs) { return }
        const url = `ws://${this.configuration.getIp().toString()}:${this.configuration.getPort().toNumber()}`
        console.log(`Connecting to OBS at ${url}`)
        obs.connect(url, this.configuration.getPassword() || undefined).then(async () => {
            if (this.obs !== obs) return
            this.connected = true
            this.communicator.notifyMixerIsConnected()
            console.log("Connected to OBS")
            await Promise.all([this.updateScenes(), this.updatePreviewScene(), this.updateOutputs()])
        }).catch(error => {
            if (this.obs !== obs) return
            // 4009: wrong password, 4010: OBS too old for obs-websocket 5
            console.error("error when connecting to OBS:", error?.code ? `${error.code} ${error.message}` : error?.message || error)
            this.connected = false
            this.communicator.notifyMixerIsDisconnected()
            this.scheduleReconnect()
        })
    }

    private scheduleReconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
        }
        this.reconnectTimeout = setTimeout(() => this.connectSocket(), reconnectTimeoutMs)
    }

    private onProgramSceneChanged(sceneName: string) {
        this.programScene = sceneName
        this.notifyChanged()
    }

    /**
     * OBS 28+ reports CurrentProgramSceneChanged only when a transition has
     * ended, but already answers GetCurrentProgramScene with the target scene
     * when it starts. Both scenes are on air while it runs.
     */
    private async onTransitionStarted() {
        const obs = this.obs
        if (!obs || this.programScene === null) return
        this.transitionFrom = this.transitionFrom ?? this.programScene
        try {
            const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene')
            if (this.transitionFrom === null || this.obs !== obs) return // already ended
            this.programScene = currentProgramSceneName
        } catch (err) {
            console.error("Could not read the OBS program scene:", err)
        }
        this.notifyChanged()
    }

    private onTransitionEnded() {
        if (this.transitionFrom === null) return
        this.transitionFrom = null
        this.notifyChanged()
    }

    private async updatePreviewScene() {
        try {
            const { currentPreviewSceneName } = await this.obs!.call('GetCurrentPreviewScene')
            this.previewScene = currentPreviewSceneName
        } catch {
            // fails when studio mode is off
            this.previewScene = null
        }
        this.notifyChanged()
    }

    private async updateOutputs() {
        try {
            const [stream, record] = await Promise.all([this.obs!.call('GetStreamStatus'), this.obs!.call('GetRecordStatus')])
            this.isStreaming = stream.outputActive
            this.isRecording = record.outputActive && !record.outputPaused
            this.notifyChanged()
        } catch (err) {
            console.error("Could not read the OBS stream and record state:", err)
        }
    }

    private async updateScenes() {
        try {
            const obs = this.obs!
            const sceneList = await obs.call('GetSceneList')
            const sceneNames = (sceneList.scenes as { sceneName?: unknown }[])
                .map(scene => scene.sceneName)
                .filter((name): name is string => typeof name === 'string')
                // OBS lists the scenes bottom to top
                .reverse()
            const children: Record<string, string[]> = {}
            await Promise.all(sceneNames.map(async sceneName => {
                const { sceneItems } = await obs.call('GetSceneItemList', { sceneName })
                children[sceneName] = (sceneItems as SceneItem[])
                    .filter(item => item.sourceType === 'OBS_SOURCE_TYPE_SCENE' && item.sceneItemEnabled === true && typeof item.sourceName === 'string')
                    .map(item => item.sourceName as string)
            }))
            this.embeddedScenes = ObsConnector.resolveEmbeddedScenes(children)
            this.communicator.notifyChannels(sceneNames.map(name => new Channel(name, name)))
            if (sceneList.currentProgramSceneName && sceneList.currentProgramSceneName !== this.programScene) {
                this.programScene = sceneList.currentProgramSceneName
            }
            this.notifyChanged()
        } catch (err) {
            console.error("Could not read the OBS scenes:", err)
        }
    }

    /** every scene visible inside a scene, also through scenes nested deeper */
    static resolveEmbeddedScenes(children: Record<string, string[]>): Record<string, string[]> {
        const resolve = (scene: string, seen: Set<string>) => {
            for (const child of children[scene] || []) {
                if (!seen.has(child)) {
                    seen.add(child)
                    resolve(child, seen)
                }
            }
            return seen
        }
        const result: Record<string, string[]> = {}
        for (const scene of Object.keys(children)) {
            const embedded = resolve(scene, new Set())
            embedded.delete(scene)
            result[scene] = Array.from(embedded)
        }
        return result
    }

    private shouldProgramBeShownAsPreview(): boolean {
        const mode = this.configuration.getLiveMode()
        if (mode === "always") {
            return false
        } else if (mode === "record") {
            return !this.isRecording
        } else if(mode === "stream") {
            return !this.isStreaming
        } else if(mode === "streamOrRecord") {
            return !this.isStreaming && !this.isRecording
        } else {
            const exhaustive: never = mode; return exhaustive // if typescript complains about this, we forgot a case
        }
    }

    private withEmbedded(scenes: (string | null)[]): string[] {
        const result: string[] = []
        for (const scene of scenes) {
            if (scene && !result.includes(scene)) {
                result.push(scene, ...(this.embeddedScenes[scene] || []).filter(child => !result.includes(child)))
            }
        }
        return result
    }

    private notifyChanged() {
        if (this.programScene === null) return
        let programs = this.withEmbedded([this.transitionFrom, this.programScene])
        let previews: string[]
        if (this.shouldProgramBeShownAsPreview()) {
            previews = programs
            programs = []
        } else {
            previews = this.withEmbedded([this.previewScene])
        }
        this.communicator.notifyProgramPreviewChanged(programs, previews)
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
            this.reconnectTimeout = null
        }
        const obs = this.obs
        this.obs = null
        this.connected = false
        if (obs) {
            obs.removeAllListeners()
            obs.disconnect().catch(() => {})
        }
    }

    isConnected() {
        return this.obs !== null && this.connected
    }
    static readonly ID = "obs" as const
}

export default ObsConnector
