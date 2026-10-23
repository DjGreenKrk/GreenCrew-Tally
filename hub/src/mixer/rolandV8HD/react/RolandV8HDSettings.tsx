import React, { useState } from 'react'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import ValidatingInput from '../../../components/config/ValidatingInput'
import { socket } from '../../../hooks/useSocket'
import { useRolandV8HDConfiguration } from '../../../hooks/useConfiguration'
import { useTranslation } from '../../../i18n'

function RolandV8HDSettings() {
    const { t } = useTranslation()
    const configuration = useRolandV8HDConfiguration()
    const [requestInterval, setRequestInterval] = useState<string|number|null>(null)
    const [requestIntervalValid, setRequestIntervalValid] = useState(true)
    const isLoading = !configuration
    const isValid = requestIntervalValid

    const handleSave = () => {
        if (configuration === undefined) {
            console.error("Not saving, because there is an invalid value in the form.")
        } else {
            const config = configuration.clone()
            config.setRequestInterval(requestInterval)
            socket.emit('config.change.rolandV8HD', config.toJson(), "rolandV8HD")
        }
    }

    return (
        <MixerSettingsWrapper
            title="Roland V-8HD"
            testId="rolandV8HD"
            description={t('rolandV8HD.description')}
            canBeSaved={isValid}
            isLoading={isLoading}
            onSave={handleSave}
        >
        { configuration && (<>
            <ValidatingInput label={t('roland.requestInterval')} testId="rolandV8HD-request-interval" object={configuration} propertyName="requestInterval" onValid={(newRequestInterval) => { setRequestInterval(newRequestInterval); setRequestIntervalValid(true) }} onInvalid={() => setRequestIntervalValid(false)} />
            </>)}
        </MixerSettingsWrapper>
    )
}

RolandV8HDSettings.mixerMeta = {
    id: "rolandV8HD",
    label: "Roland V-8HD",
}

export default RolandV8HDSettings
