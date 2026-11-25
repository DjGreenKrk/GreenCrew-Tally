import Log from "../domain/Log"
import { TallyDevice } from "../domain/Tally"
import { ManagementReply, parseManagementReply } from "./ManagementMessages"

// From "tally-ho" of firmware v2: the Hub it is paired with (null: none)
// and the challenge for the next management message (#28)
export type TallyPairing = {
  hub: string | null
  challenge: string
}

export type TallyHoCommand = {
  command: "tally-ho"
  tallyName: string
  device?: TallyDevice
  pairing?: TallyPairing
}

export type ManagementCommand = {
  command: "management"
  reply: ManagementReply
}

export type LogCommand = {
  command: "log"
  tallyName: string
  log: Log
}

export type TallySentCommand = TallyHoCommand | LogCommand | ManagementCommand

export class InvalidCommandError extends Error {
  constructor(...args) {
      super(...args)

      this.message = `Received an invalid command: "${this.message}"`
  }
}

function parseDevice(rest: string): { device?: TallyDevice, pairing?: TallyPairing } {
  const fields = rest.trim().split(/ +/)
  const version = fields[0].match(/^gc\/(\d+)$/)
  if (!version) return {}
  const device: TallyDevice = { protocol: Number(version[1]), capabilities: [] }
  let pair: string | undefined
  let challenge: string | undefined
  for (const field of fields.slice(1)) {
    const [key, ...valueParts] = field.split("=")
    const value = valueParts.join("=")
    if (key === "id") device.id = value
    else if (key === "fw") device.firmware = value
    else if (key === "hw") device.hardware = value
    else if (key === "caps") device.capabilities = value.split(",").filter(cap => cap !== "")
    else if (key === "pair") pair = value
    else if (key === "ch") challenge = value
    // unknown keys come from newer firmware and are skipped
  }
  const pairing = pair !== undefined && challenge !== undefined && /^[0-9a-f]{16}$/.test(challenge) ?
    { hub: /^[0-9a-f]{8}$/.test(pair) ? pair : null, challenge } : undefined
  return pairing ? { device, pairing } : { device }
}

class TallyCommandParser {
  parse(msg: string): TallySentCommand {
    if (msg.startsWith("gc/")) {
        const reply = parseManagementReply(msg)
        if (!reply) throw new InvalidCommandError(msg)
        return { command: "management", reply }
    } else if (msg.startsWith("tally-ho ")) {
        return this.parseTallyHo(msg)
    } else if (msg.startsWith("log ")) {
        return this.parseLog(msg)
    } else {
        throw new InvalidCommandError(msg)
    }
  }

  private parseTallyHo = function(cmd: string) : TallyHoCommand {
    const result = cmd.match(/^([^ ]+) "(.+)"/)
    if (result === null) {
        throw new InvalidCommandError(cmd)
    } else {
        const [, command, tallyName] = result
        if (command !== "tally-ho") {
            throw new InvalidCommandError(command)
        }
        return { command, tallyName, ...parseDevice(cmd.slice(result[0].length)) }
    }
  }

  private parseLog = function(cmd: string) : LogCommand {
    const result = cmd.match(/^([^ ]+) "(.+)" ([^ ]+) "(.*)"/)

    if (result === null) {
        throw new InvalidCommandError(cmd)
    } else {
        const [, command, tallyName, uncleanSeverity, message] = result
        if (command !== "log") {
            throw  new InvalidCommandError(command)
        }
        const severity = (() => {
          if (uncleanSeverity === "INFO" || uncleanSeverity === "WARN" || uncleanSeverity === "ERROR") {
            return uncleanSeverity
          } else {
            console.log(`Invalid severity "${uncleanSeverity}". Using ERROR instead.`)
            return "ERROR"
          }
        })()
        const log = new Log(new Date(), severity, message)
        return { command, tallyName, log }
    }
  }
}

export default new TallyCommandParser()
