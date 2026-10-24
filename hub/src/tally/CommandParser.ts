import Log from "../domain/Log"
import { TallyDevice } from "../domain/Tally"

export type TallyHoCommand = {
  command: "tally-ho"
  tallyName: string
  device?: TallyDevice
}

export type LogCommand = {
  command: "log"
  tallyName: string
  log: Log
}

export type TallySentCommand = TallyHoCommand | LogCommand

export class InvalidCommandError extends Error {
  constructor(...args) {
      super(...args)

      this.message = `Received an invalid command: "${this.message}"`
  }
}

function parseDevice(rest: string): TallyDevice | undefined {
  const fields = rest.trim().split(/ +/)
  const version = fields[0].match(/^gc\/(\d+)$/)
  if (!version) return undefined
  const device: TallyDevice = { protocol: Number(version[1]), capabilities: [] }
  for (const field of fields.slice(1)) {
    const [key, ...valueParts] = field.split("=")
    const value = valueParts.join("=")
    if (key === "id") device.id = value
    else if (key === "fw") device.firmware = value
    else if (key === "hw") device.hardware = value
    else if (key === "caps") device.capabilities = value.split(",").filter(cap => cap !== "")
    // unknown keys come from newer firmware and are skipped
  }
  return device
}

class TallyCommandParser {
  parse(msg: string): TallySentCommand {
    if (msg.startsWith("tally-ho ")) {
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
        const device = parseDevice(cmd.slice(result[0].length))
        return device ? { command, tallyName, device } : { command, tallyName }
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
