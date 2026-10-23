import React from 'react'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import { socket } from '../../../hooks/useSocket'
import TestConfiguration from '../TestConfiguration'
import { useTranslation } from '../../../i18n'

function TestSettings() {
    const { t } = useTranslation()
    const handleSave = () => {
        socket.emit('config.change.test', new TestConfiguration(), "test")
    }

    return (<MixerSettingsWrapper 
        title={t('test.title')}
        testId="test"
        description={t('test.description')}
        onSave={handleSave}
    ></MixerSettingsWrapper>)
}

TestSettings.mixerMeta = {
    id: "test",
    label: "Test Mixer"
}

export default TestSettings
