import React, { useEffect, useState } from 'react'
import { TextField } from '@material-ui/core'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import ValidatingInput from '../../../components/config/ValidatingInput'
import ExternalLink from '../../../components/ExternalLink'
import { useObsConfiguration } from '../../../hooks/useConfiguration'
import { socket } from '../../../hooks/useSocket'
import { ObsConfigurationLiveMode } from '../ObsConfiguration'
import { MIXER_IDS } from '../../ids'
import ObsLiveModeSelect from './ObsLiveModeSelect'

type ObsSettingsProps = {
    id: typeof MIXER_IDS.obs,
    label: string,
}

function ObsSettings(props: ObsSettingsProps) {
    const configuration = useObsConfiguration()
    const [ip, setIp] = useState<string|null>(null)
    const [ipValid, setIpValid] = useState(true)
    const [port, setPort] = useState<string|null>(null)
    const [portValid, setPortValid] = useState(true)
    const [password, setPassword] = useState("")
    const [liveMode, setLiveMode] = useState<ObsConfigurationLiveMode|null>(null)
    const liveModeValid = liveMode !== null
    const isLoading = !configuration
    const isValid = ipValid && portValid && liveModeValid

    useEffect(() => {
        // when default settings change
        if (configuration) {
            setLiveMode(configuration.getLiveMode())
            setPassword(configuration.getPassword())
        }
    }, [configuration])

    const handleSave = () => {
        if (configuration === undefined) {
            console.error("Not saving, because there is an invalid value in the form.")
        } else if (props.id !== MIXER_IDS.obs) {
            console.warn(`Changing id prop of ObsSettings is not supported. But got ${props.id}.`)
        } else {
            const config = configuration.clone()
            config.setIp(ip)
            config.setPort(port)
            config.setPassword(password)
            config.setLiveMode(liveMode)

            socket.emit('config.change.obs', config.toJson(), props.id)
        }
    }

    return (
        <MixerSettingsWrapper 
            title="OBS Studio Configuration"
            testId="obs"
            description={<>Connects to OBS Studio 28 or newer over the network through its built-in <ExternalLink href="https://github.com/obsproject/obs-websocket">WebSocket server</ExternalLink>. In OBS open Tools → WebSocket Server Settings, enable the server and use the port and password shown under Show Connect Info.</>}
            canBeSaved={isValid}
            isLoading={isLoading}
            onSave={handleSave}
        >
            { configuration && (<>
                <ValidatingInput label="Obs IP" testId="obs-ip" object={configuration} propertyName="ip" onValid={(newIp) => { setIp(newIp); setIpValid(true) }} onInvalid={() => setIpValid(false)} />
                <ValidatingInput label="Obs Port" testId="obs-port" object={configuration} propertyName="port" onValid={(newPort) => { setPort(newPort); setPortValid(true) }} onInvalid={() => setPortValid(false)} />
                <TextField label="Obs Password" type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} inputProps={{ 'data-testid': 'obs-password' }} style={{ margin: "0 16px 16px 0" }} helperText="Empty if authentication is off in OBS" />
                <ObsLiveModeSelect label="On-Air Status" testId="obs-liveMode" value={liveMode} onChange={setLiveMode} />
            </>)}
        </MixerSettingsWrapper>
    )
}

ObsSettings.defaultProps = {
    id: MIXER_IDS.obs,
    label: "OBS Studio",
}

export default ObsSettings
