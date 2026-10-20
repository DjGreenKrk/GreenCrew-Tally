import { MixerCommunicator } from '../../lib/MixerCommunicator'
import { Connector } from '../interfaces'
import RolandV8HDConfiguration from './RolandV8HDConfiguration'

// @see https://static.roland.com/assets/media/pdf/V-8HD_reference_eng03_W.pdf
// Minimal shape of the parts of the native "midi" module that are used here.
interface MidiPort {
    getPortCount(): number
    getPortName(index: number): string
    openPort(index: number): void
    closePort(): void
    isPortOpen(): boolean
}
interface MidiInputPort extends MidiPort {
    ignoreTypes(sysex: boolean, timing: boolean, activeSensing: boolean): void
    on(event: 'message', listener: (deltaTime: number, message: number[]) => void): void
}
interface MidiOutputPort extends MidiPort {
    sendMessage(message: number[]): void
}
interface MidiModule {
    Input: new () => MidiInputPort
    Output: new () => MidiOutputPort
}

class RolandV8HDConnector implements Connector {
    configuration: RolandV8HDConfiguration
    communicator: MixerCommunicator
    queryInterval: number
    connected: boolean
    interval: NodeJS.Timeout | null
    midi: MidiModule | undefined
    midi_input: MidiInputPort
    midi_output: MidiOutputPort
    input_status: number[]

    constructor(configuration: RolandV8HDConfiguration, communicator: MixerCommunicator) {
        this.configuration = configuration
        this.communicator = communicator
        this.connected = false
        this.interval = null
        try {
          const midiModuleName = ['mi', 'di'].join('')
          this.midi = eval('require')(midiModuleName)
        } catch (error) {
          console.error(`Could not load the native MIDI module: ${error}`)
          this.midi = undefined
        }
        this.input_status = [0,0,0,0,0,0,0,0]
    }

    connect() {
        console.log(`Connecting to RolandV8HD V-8HD via MIDI`)
      if (!this.midi) {
        console.error("Roland V-8HD cannot connect because the native MIDI module is unavailable")
        return
      }
        this.midi_input = new this.midi.Input()
        const inputPortCount = this.midi_input.getPortCount()
        // select correct port
        for(let i = 0; i < inputPortCount; i++){
          const name = this.midi_input.getPortName(i)
          if (name.includes("V-8HD")){
            this.midi_input.openPort(i)
            console.log(`Opened Midi Port ${i}: ${name}`)
            break
          }
        }

        this.midi_output = new this.midi.Output()
        const outputPortCount = this.midi_output.getPortCount()
        // select correct port
        for(let i = 0; i < outputPortCount; i++){
          const name = this.midi_output.getPortName(i)
          if (name.includes("V-8HD")){
            this.midi_output.openPort(i)
            console.log(`Opened Midi Output Port ${i}: ${name}`)
            break
          }
        }

        // do not ignore SysEx messages.
        this.midi_input.ignoreTypes(false, true, true);

        // Callback Method for Midi Input
        this.midi_input.on('message', (deltaTime, message) => {
          //Check tally parameter area
          if(message[8] === 12){
              // hdmi input id in byte 11
              const channel_idx = message[10]
              // tally information in byte 12
              const input_status = message[11]
            this.input_status[channel_idx] = input_status

            // only notify program status change after full iteration (8 chans)
            if(channel_idx === 7){
              this.processInputStatus(this.communicator)
            }
          }
        });

        this.interval = setInterval(this.checkRolandV8HDStatus, this.configuration.getRequestInterval(), this.communicator, this.midi_output)

        if(this.midi_input.isPortOpen() && this.midi_output.isPortOpen()){
          this.connected = true
          this.communicator.notifyMixerIsConnected()
        }else{
          console.log(`Cannot connect with RolandV8HD V-8HD. Please check connection and try again.`)
        }
    }

    private processInputStatus(communicator: MixerCommunicator){
      const programs: string[] = []
      const previews: string[] = []
      // iterate through input status array
      for(let i = 0; i < 8; i++){
        // process program
        if(this.input_status[i] === 1){
          programs.push(`${i + 1}`)
        }
        // process preview
        if(this.input_status[i] === 2){
          previews.push(`${i + 1}`)
        }
      }
      communicator.notifyProgramPreviewChanged(programs, previews)
    }

    private checkRolandV8HDStatus(communicator: MixerCommunicator, midi_out: MidiOutputPort){
      // Base SysEx message to RolandV8HD V-8HD
      const sysex_msg = [0xF0, 0x41,0x10,0x00,0x00,0x00,0x68,0x11,0x0C,0x00,0x00,0x00,0x00,0x03,0x71,0xF7]
      // iterate through all 8 input chans
    	for (let i = 0; i < 8; i++){
        if (midi_out){
          midi_out.sendMessage(sysex_msg)
          // increment input channel address
      		sysex_msg[10] += 1
          // decrement checksum by 1
      		sysex_msg[14] -= 1
        }
      }
    }

    disconnect() {
      //clean interval
      clearInterval(this.interval);
      console.log(`RolandV8HD V-8HD connection closed`);
      this.midi_output.closePort()
      this.midi_input.closePort()
      this.connected = false
      this.communicator.notifyMixerIsDisconnected()
      return true
    }

    isConnected() {
        return this.connected
    }

    static readonly ID = "rolandV8HD" as const
}

export default RolandV8HDConnector
