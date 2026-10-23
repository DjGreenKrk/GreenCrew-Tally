import React, { useState } from 'react'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import ValidatingInput from '../../../components/config/ValidatingInput'
import ExternalLink from '../../../components/ExternalLink'
import { useVmixConfiguration } from '../../../hooks/useConfiguration'
import { socket } from '../../../hooks/useSocket'
import { useTranslation } from '../../../i18n'

const httpApiPort = "8088"

function VmixSettings() {
    const { t } = useTranslation()
    const configuration = useVmixConfiguration()
    const [ip, setIp] = useState<string|null>(null)
    const [ipValid, setIpValid] = useState(true)
    const [port, setPort] = useState<string|null>(null)
    const [portValid, setPortValid] = useState(true)
    const isLoading = !configuration
    const isValid = ipValid && portValid

    const handleSave = () => {
        if (configuration === undefined) {
            console.error("Not saving, because there is an invalid value in the form.")
        } else {
            const config = configuration.clone()
            config.setIp(ip)
            config.setPort(port)

            socket.emit('config.change.vmix', config.toJson(), "vmix")
        }
    }

    return (
        <MixerSettingsWrapper 
            title="vMix"
            testId="vmix"
            description={<>{t('vmix.descriptionBefore')}<ExternalLink href="https://www.vmix.com/help24/index.htm?TCPAPI.html">TCP API</ExternalLink>{t('vmix.descriptionAfter')}</>}
            canBeSaved={isValid}
            isLoading={isLoading}
            onSave={handleSave}
        >
        { configuration && (<>
            <ValidatingInput label={t('vmix.ip')} testId="vmix-ip" object={configuration} propertyName="ip" onValid={(newIp) => { setIp(newIp); setIpValid(true) }} onInvalid={() => setIpValid(false)} />
            <ValidatingInput
                label={t('vmix.port')}
                testId="vmix-port"
                object={configuration}
                propertyName="port"
                onValid={(newPort) => { setPort(newPort); setPortValid(true) }}
                onInvalid={() => setPortValid(false)}
                warningMessage={port === httpApiPort ? t('vmix.portWarning') : ""}
            />
        </>)}
        </MixerSettingsWrapper>
    )
}

VmixSettings.mixerMeta = {
    id: "vmix",
    label: "vMix",
}

export default VmixSettings
