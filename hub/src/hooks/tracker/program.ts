import { EventEmitter } from '../../lib/DisconnectedClientSideSocket'
import { ChannelList } from '../../lib/MixerCommunicator'
import { ClientSideSocket } from '../../lib/SocketEvents'

class ProgramTracker extends EventEmitter{
    programs: ChannelList
    previews: ChannelList
    auxes: string[]
    
    constructor(socket: ClientSideSocket, socketEventEmitter: EventEmitter) {
        super()
        this.programs = null
        this.previews = null
        this.auxes = []

        socket.on('program.state', ({programs, previews, auxes}) => {
            this.programs = programs
            this.previews = previews
            // a Hub without AUX support does not send it
            this.auxes = auxes || []
            this.emit('program', this.programs, this.previews, this.auxes)
        })
        socket.emit('events.program.subscribe')
        socketEventEmitter.on("connected", () => {
            socket.emit('events.program.subscribe')
        })
    }
}

export default ProgramTracker
