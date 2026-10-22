import React from 'react'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import { socket } from '../../../hooks/useSocket'
import { SettingsProps } from '../../interfaces'
import TestConfiguration from '../TestConfiguration'
import { useTranslation } from '../../../i18n'

type TestSettingsProps = SettingsProps & {}

function TestSettings(props: TestSettingsProps) {
    const { t } = useTranslation()
    const handleSave = () => {
        if (props.id !== "test") {
            console.warn(`Changing id prop of TestSettings is not supported. But got ${props.id}.`)
        } else {
            socket.emit('config.change.test', new TestConfiguration(), "test")
        }
    }

    return (<MixerSettingsWrapper 
        title={t('test.title')}
        testId="test"
        description={t('test.description')}
        onSave={handleSave}
    ></MixerSettingsWrapper>)
}

TestSettings.defaultProps = {
    id: "test",
    label: "Test Mixer"
}

export default TestSettings
