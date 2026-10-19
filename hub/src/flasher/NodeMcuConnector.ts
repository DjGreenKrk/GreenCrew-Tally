import TallyDevice from './TallyDevice'
import TallySettingsIni from './TallySettingsIni'
import tmp from 'tmp-promise'
import { promises as fs } from 'fs'
import { findFirmwareFiles, FirmwareFile } from './FirmwareAssets'

const baudRate = 115200
const fileName = "tally-settings.ini"

// USB-UART bridges used on ESP8266 boards. nodemcu-tool only knows CH340 and
// CP2102, which hides FTDI-based boards such as D1 Mini clones with FT232R.
const supportedUsbVendorIds = [
  '1A86', // QinHeng CH340/CH341
  '10C4', // Silicon Labs CP2102
  '0403', // FTDI FT232R
]

export const isSupportedSerialPort = (port: {vendorId?: string}) =>
  !!port.vendorId && supportedUsbVendorIds.includes(port.vendorId.toUpperCase())

let mutex = false

const tryToAquireMutex = () => {
  if (!mutex) {
    mutex = true
    return true
  } else {
    return false
  }
}

export interface TallySettingsIniProgressType {
  tallyName: string
  inititalizeDone: boolean
  connectionDone: boolean
  uploadDone: boolean
  rebootDone: boolean
  allDone: boolean
  error: boolean
}

export interface TallyProgramProgressType {
  inititalizeDone: boolean
  connectionDone: boolean
  filesUploaded: number
  filesTotal: number
  rebootDone: boolean
  allDone: boolean
  error: boolean
}

class NodeMcuTimeoutError extends Error {}

export interface SerialPortInfo {
  path: string
  vendorId?: string
  productId?: string
}

/** The subset of the nodemcu-tool API used by the Hub. */
export interface NodeMcuTool {
  onError(handler: (error: unknown) => void): void
  isConnected(): boolean
  connect(path: string, baudRate: number, applyConnectionCheck: boolean): Promise<void>
  disconnect(): Promise<void>
  checkConnection(): Promise<boolean>
  listDevices(showAll: boolean): Promise<SerialPortInfo[]>
  deviceInfo(): Promise<{chipID: string, flashID: string, version: string, modules: string | null}>
  fsinfo(): Promise<{files: {name: string, size: number}[]}>
  download(remoteName: string): Promise<Buffer>
  upload(localName: string, remoteName: string, options: object, progressCb: () => void): Promise<void>
  execute(command: string): Promise<{echo: string, response: string} | null>
  hardreset(): Promise<void>
}

class NodeMcuConnector {
  nodemcu: NodeMcuTool
  // Native operations may finish AFTER their public timeout; the transport
  // remains locked until the operation settles and the port is closed.
  private pendingNativeOperations = new Set<Promise<unknown>>()

  async withMutex<T> (fn: () => T | Promise<T>): Promise<T> {
    if (!this.nodemcu) {
      throw new Error('NodeMCU serial tool is unavailable. Verify serialport is installed and bundled in vtally.exe.')
    }
    // Serialport is a singleton in the current NodeMCU tool: never start a
    // second job while a timed-out native operation may still complete.
    while (!tryToAquireMutex()) {
      await this.sleep(100)
    }
    try {
      if (this.nodemcu.isConnected()) {
        console.warn('Serial terminal was not closed by previous process.')
        await this.nodemcu.disconnect()
        if (this.nodemcu.isConnected()) throw new Error('NodeMCU port remained open after disconnect')
      }
      return await fn()
    } finally {
      // If a native call is still pending, return the timeout/error to the
      // caller now, but retain the global mutex until its LATE completion.
      // Only then is it safe to close the port and allow the next job.
      const pending = this.pendingNativeOperations.size > 0
      const cleanup = this.releaseAfterTransportCleanup()
      if (pending) {
        void cleanup.catch(error => console.error('NodeMCU late transport cleanup failed:', error))
      } else {
        await cleanup
      }
    }
  }

  private async releaseAfterTransportCleanup(): Promise<void> {
    try {
      while (this.pendingNativeOperations.size > 0) {
        await Promise.allSettled(Array.from(this.pendingNativeOperations))
      }
      if (this.nodemcu.isConnected()) {
        await this.nodemcu.disconnect()
        if (this.nodemcu.isConnected()) {
          throw new Error('NodeMCU port remained open after cleanup')
        }
      }
    } finally {
      mutex = false
    }
  }

  // injectable for easier testing
  // Tests inject fakes that implement only the methods a scenario needs.
  constructor(nodemcu?: Partial<NodeMcuTool>) {
    if (nodemcu) {
      this.nodemcu = nodemcu as NodeMcuTool
    } else {
      try {
        // Keep the require literal so pkg can discover and include the
        // NodeMCU flasher and its serialport dependency in vtally.exe.
        this.nodemcu = require('nodemcu-tool') as NodeMcuTool
      } catch (error) {
        console.error(`Could not load the NodeMCU tool: ${error}`)
        this.nodemcu = undefined
      }
    }
    if (this.nodemcu) {
      this.nodemcu.onError((error: unknown) => {
        console.error(error)
      })
    }
  }

  private static async getLocalFiles() {
    return findFirmwareFiles()
  }

    private static async doFilesNeedUpdate(filesOnNodemcu: {name: string, size: number}[]) : Promise<boolean> {
    const localFiles = await NodeMcuConnector.getLocalFiles()
    return localFiles.some(localFile => {  
      return filesOnNodemcu.every(nodeMcuFile => nodeMcuFile.name !== localFile.fileName || nodeMcuFile.size !== localFile.fileSize)
    })
  }

  private sleep(ms: number) {
    return new Promise(resolve => {
      setTimeout(resolve, ms)
    })
  }

  // A timeout is a caller-visible deadline, NOT native cancellation. Track
  // the unresolved operation so withMutex retains the lock until it settles.
  private async withTimeout<T>(operation: () => Promise<T>, ms: number, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const native = Promise.resolve().then(operation)
    this.pendingNativeOperations.add(native)
    void native.then(
      () => { this.pendingNativeOperations.delete(native) },
      () => { this.pendingNativeOperations.delete(native) },
    )
    try {
      return await Promise.race([
        native,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new NodeMcuTimeoutError(message)), ms)
        }),
      ])
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }

  // gracefull connection that retries a few times
  private async connect(path: string) {
    await this.withTimeout(() => this.nodemcu.connect(path, baudRate, false), 5000, 'NodeMCU serial connect timed out')

    // check connection does not always work the first time, so we try it multiple times if necessary
    let retries = 3
    while (true) {
      try {
        return await this.withTimeout(() => this.nodemcu.checkConnection(), 3000, 'NodeMCU check timed out')
      } catch (e){
        if (e instanceof NodeMcuTimeoutError || retries === 0) {
          throw e
        }
        await this.sleep(100)
      }
      retries--
    }
  }

  private async execute(idempotentCommand: string) {
    let retries = 3
    while (true) {
      try {
        const foo = await this.nodemcu.execute(`${idempotentCommand}; print("ok")`)
        if (foo === null || !foo.response) {
          throw new Error("Did not get a response for executing the command.")
        }
        if (foo.response.toString().includes("error")) {
          throw new Error(foo.response.toString())
        }
        if (!foo.response.toString().includes("ok")) {
          throw new Error(`response did not include an "ok": ${foo.response.toString()}`)
        }
        return foo
      } catch (e){
        if (retries === 0) {
          throw e
        }
        await this.sleep(100)
      }
      retries--
    }
    
  }

  async getDevice(): Promise<TallyDevice> {
    const tallyDevice = new TallyDevice()
    let updatePossible = false
    try {
      const localFiles = await NodeMcuConnector.getLocalFiles()
      updatePossible = localFiles.length > 0
    } catch (error) {
      // Firmware availability must not prevent device detection or kill the Hub.
      console.warn('ESP8266 firmware not available for flashing: ' + String(error))
    }
    if (!updatePossible) {
      tallyDevice.update = "not-available"
    }

    try {
      return await this.withMutex(async () => {
        const list = (await this.nodemcu.listDevices(true)).filter(isSupportedSerialPort)
        const device = list[0]
        if (device) {
          
          tallyDevice.path = device.path
          tallyDevice.vendorId = device.vendorId
          tallyDevice.productId = device.productId

          await this.connect(device.path)
          const deviceInfo = await this.nodemcu.deviceInfo()

          tallyDevice.chipId = deviceInfo.chipID
          tallyDevice.flashId = deviceInfo.flashID
          tallyDevice.nodeMcuVersion = deviceInfo.version
          tallyDevice.nodeMcuModules = deviceInfo.modules

          const fsinfo = await this.nodemcu.fsinfo()
          if (updatePossible) {
            tallyDevice.update = await NodeMcuConnector.doFilesNeedUpdate(fsinfo.files) ? "updateable" : "up-to-date"
          }

          const settingsFileExists = fsinfo.files.some(file => file.name === fileName)

          if (settingsFileExists) {
            const res = await this.nodemcu.download(fileName)
            tallyDevice.tallySettings = new TallySettingsIni(res.toString())
          }
        }
        return tallyDevice
      })
    }
    catch (e) {
      // An Error object serializes to {} over Socket.IO, so send its text.
      tallyDevice.errorMessage = e instanceof Error ? e.message : String(e)
      return tallyDevice
    }
  }

  async program(path: string, onProgress: (state: TallyProgramProgressType) => void) {
    let files: FirmwareFile[]
    try {
      files = await NodeMcuConnector.getLocalFiles()
    } catch (error) {
      console.error('Cannot flash ESP8266: ' + String(error))
      onProgress({
        inititalizeDone: false, connectionDone: false, filesUploaded: 0,
        filesTotal: 0, rebootDone: false, allDone: false, error: true,
      })
      return false
    }
    const progress: TallyProgramProgressType = {
      inititalizeDone: false,
      connectionDone: false,
      filesUploaded: 0,
      filesTotal: files.length,
      rebootDone: false,
      allDone: false,
      error: false,
    }
    onProgress(progress)

    try {
      await this.withMutex(async () => {
        progress.inititalizeDone = true
        onProgress(progress)

        await this.connect(path)

        progress.connectionDone = true
        onProgress(progress)

        for(const file of files) {
          await this.saveFileUpload(file.fileName, file.filePath)
          progress.filesUploaded = progress.filesUploaded + 1
          onProgress(progress)
        }

        await this.hardReset(path)

        progress.rebootDone = true
        onProgress(progress)

        progress.allDone = true
        onProgress(progress)
      })
    }
    catch (e) {
      console.error(`programming failed because of: ${e}`)

      progress.error = true
      onProgress(progress)
      return false
    }
  }

  async writeTallySettingsIni(path: string, settingsIniString: string, onProgress: (state: TallySettingsIniProgressType) => void) {
    const settingsIni = new TallySettingsIni(settingsIniString)
    const progress: TallySettingsIniProgressType = {
      tallyName: settingsIni.getTallyName(),
      inititalizeDone: false,
      connectionDone: false,
      uploadDone: false,
      rebootDone: false,
      allDone: false,
      error: false,
    }
    onProgress(progress)

    try {
      if (!settingsIni.getTallyName()) {
        throw new Error(`Exeptected ${fileName} to contain a tally.name, but it was empty.`)
      }
      if (!settingsIni.getStationSsid()) {
        throw new Error(`Exeptected ${fileName} to contain a station ssid, but it was empty.`)
      }
      if (!settingsIni.getHubIp()) {
        throw new Error(`Exeptected ${fileName} to contain a hub.ip name, but it was empty.`)
      }

      await this.withMutex(async () => {
        progress.inititalizeDone = true
        onProgress(progress)

        await this.connect(path)

        progress.connectionDone = true
        onProgress(progress)

        await this.saveContentUpload(fileName, settingsIniString)

        progress.uploadDone = true
        onProgress(progress)
        
        await this.hardReset(path)

        progress.rebootDone = true
        onProgress(progress)

        progress.allDone = true
        onProgress(progress)
      })
      return true
    }
    catch (e) {
      console.error(`${fileName} upload failed because of:`, e)

      progress.error = true
      onProgress(progress)
      return false
    }
  }

  private async hardReset(path: string) {
    await this.withTimeout(() => this.nodemcu.hardreset(), 5000, 'NodeMCU hard reset timed out')
    await this.withTimeout(() => this.nodemcu.disconnect(), 5000, 'NodeMCU serial disconnect timed out')
    await this.sleep(1000)
    await this.connect(path)
    await this.sleep(3000)

    // Do not throw from a timeout callback or poll the transport forever.
    const deadline = Date.now() + 10000
    let lastError: unknown
    while (Date.now() < deadline) {
      try {
        await this.withTimeout(
          () => this.nodemcu.checkConnection(),
          Math.max(1, Math.min(1500, deadline - Date.now())),
          'NodeMCU check after reset timed out',
        )
        return
      } catch (error) {
        lastError = error
        // A timed-out native check may still be active. Do not issue another
        // serial command against the same transport until it has settled.
        if (error instanceof NodeMcuTimeoutError) {
          throw new Error('Could not connect to NodeMCU after hardreset: ' + String(error))
        }
        const remaining = deadline - Date.now()
        if (remaining > 0) await this.sleep(Math.min(250, remaining))
      }
    }
    throw new Error('Could not connect to NodeMCU after hardreset: ' + String(lastError))
  }

  /**
   * uploads content via nodemcu-tool
   * 
   * @param filePath the file path on nodemcu
   * @param content the file content
   */
  private async saveContentUpload(filePath: string, content: string) {
    const { path: tmpPath, cleanup: tmpCleanup } = await tmp.file({})
    try {
      await fs.writeFile(tmpPath, content)
      await this.saveFileUpload(filePath, tmpPath)
    }
    finally {
      tmpCleanup()
    }
  }

  /**
   * uploads a file via nodemcu-tool and does some verification
   * 
   * @param remoteFilePath the file path on nodemcu
   * @param localFilePath the local file path
   */
  private async saveFileUpload(remoteFilePath: string, localFilePath: string) {
    if (!this.nodemcu.isConnected())  {
      throw new Error("Expected to have an already established connection to NodeMCU, but did not.")
    }

    const copyFileName = remoteFilePath + ".swp"

    try {
      await this.nodemcu.upload(localFilePath, copyFileName, {}, () => {})
      await this.sleep(1000)
      const gotContent = await this.nodemcu.download(copyFileName)
      const localContent = await fs.readFile(localFilePath).then(buffer => buffer.toString())

      if (gotContent.toString() !== localContent) {
        throw new Error(`Uploaded file does not match downloaded file. Expected file size of ${localContent.length}, but got ${gotContent.length}`)
      }

      // rename file
      await this.removeFileIfExists(remoteFilePath)
      await this.execute(`file.rename("${copyFileName}", "${remoteFilePath}")`)
    }
    finally {
      await this.removeFileIfExists(copyFileName)
    }
  }
  private async removeFileIfExists(filePath: string) {
    return this.execute(`if file.exists("${filePath}") then file.remove("${filePath}") end`)
  }
}

export default NodeMcuConnector