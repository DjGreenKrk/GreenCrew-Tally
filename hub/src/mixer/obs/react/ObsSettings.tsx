import React, { useEffect, useState } from 'react'
import { TextField } from '@mui/material'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import ValidatingInput from '../../../components/config/ValidatingInput'
import ExternalLink from '../../../components/ExternalLink'
import { useObsConfiguration } from '../../../hooks/useConfiguration'
import { socket } from '../../../hooks/useSocket'
import { ObsConfigurationLiveMode } from '../ObsConfiguration'
import { MIXER_IDS } from '../../ids'
import ObsLiveModeSelect from './ObsLiveModeSelect'
import { useTranslation } from '../../../i18n'

function ObsSettings() {
    const { t } = useTranslation()
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
        } else {
            const config = configuration.clone()
            config.setIp(ip)
            config.setPort(port)
            config.setPassword(password)
            config.setLiveMode(liveMode)

            socket.emit('config.change.obs', config.toJson(), MIXER_IDS.obs)
        }
    }

    return (
        <MixerSettingsWrapper 
            title={t('obs.title')}
            testId="obs"
            description={<>{t('obs.descriptionBefore')}<ExternalLink href="https://github.com/obsproject/obs-websocket">{t('obs.descriptionLink')}</ExternalLink>{t('obs.descriptionAfter')}</>}
            canBeSaved={isValid}
            isLoading={isLoading}
            onSave={handleSave}
        >
            { configuration && (<>
                <ValidatingInput label={t('obs.ip')} testId="obs-ip" object={configuration} propertyName="ip" onValid={(newIp) => { setIp(newIp); setIpValid(true) }} onInvalid={() => setIpValid(false)} />
                <ValidatingInput label={t('obs.port')} testId="obs-port" object={configuration} propertyName="port" onValid={(newPort) => { setPort(newPort); setPortValid(true) }} onInvalid={() => setPortValid(false)} />
                <TextField label={t('obs.password')} type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} slotProps={{ htmlInput: { 'data-testid': 'obs-password' } }} style={{ margin: "0 16px 16px 0" }} helperText={t('obs.passwordHelp')} />
                <ObsLiveModeSelect label={t('obs.liveMode')} testId="obs-liveMode" value={liveMode} onChange={setLiveMode} />
            </>)}
        </MixerSettingsWrapper>
    )
}

ObsSettings.mixerMeta = {
    id: MIXER_IDS.obs,
    label: "OBS Studio",
}

export default ObsSettings
