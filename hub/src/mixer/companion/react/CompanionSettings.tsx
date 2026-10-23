import React from 'react'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import { socket } from '../../../hooks/useSocket'
import { MIXER_IDS } from '../../ids'
import CompanionLanAccess from './CompanionLanAccess'
import { useTranslation } from '../../../i18n'

function CompanionSettings() {
    const { t } = useTranslation()
    return (
        <MixerSettingsWrapper
            title={t('companion.title')}
            testId="companion"
            description={t('companion.description')}
            onSave={() => socket.emit('config.change.companion', MIXER_IDS.companion)}
        >
            <CompanionLanAccess />
        </MixerSettingsWrapper>
    )
}

CompanionSettings.mixerMeta = {
    id: MIXER_IDS.companion,
    label: 'Companion (HTTP)',
}

export default CompanionSettings
