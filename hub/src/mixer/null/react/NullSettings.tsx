import React from 'react'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import { socket } from '../../../hooks/useSocket'
import { MIXER_IDS } from '../../ids'
import { useTranslation } from '../../../i18n'

function NullSettings() {
    const { t } = useTranslation()
    const handleSave = () => {
        socket.emit('config.change.null', MIXER_IDS.null)
    }

    return (<MixerSettingsWrapper 
        title={t('null.title')}
        testId="null"
        description={t('null.description')}
        onSave={handleSave}
    ></MixerSettingsWrapper>)
}

NullSettings.mixerMeta = {
    id: MIXER_IDS.null,
    label: "Off"
}

export default NullSettings
