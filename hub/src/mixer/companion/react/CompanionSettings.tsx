import React, { useEffect, useState } from 'react'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import ChannelNamesField, { areChannelNamesValid, parseChannelNames } from '../../../components/config/ChannelNamesField'
import { useCompanionConfiguration } from '../../../hooks/useConfiguration'
import { socket } from '../../../hooks/useSocket'
import { MIXER_IDS } from '../../ids'
import CompanionLanAccess from './CompanionLanAccess'
import { useTranslation } from '../../../i18n'

function CompanionSettings() {
    const { t } = useTranslation()
    const configuration = useCompanionConfiguration()
    const [names, setNames] = useState('')

    useEffect(() => {
        if (configuration) {
            setNames(configuration.getChannelNames().join('\n'))
        }
    }, [configuration])

    const handleSave = () => {
        if (configuration === undefined) {
            console.error("Not saving, because the configuration is not loaded yet.")
        } else {
            const config = configuration.clone()
            config.setChannelNames(parseChannelNames(names))
            socket.emit('config.change.companion', config.toJson(), MIXER_IDS.companion)
        }
    }

    return (
        <MixerSettingsWrapper
            title={t('companion.title')}
            testId="companion"
            description={t('companion.description')}
            canBeSaved={areChannelNamesValid(names)}
            isLoading={!configuration}
            onSave={handleSave}
        >
            {configuration && <ChannelNamesField value={names} onChange={setNames} testId="companion-channel-names" hint={t('companion.channelsHint')} />}
            <CompanionLanAccess />
        </MixerSettingsWrapper>
    )
}

CompanionSettings.mixerMeta = {
    id: MIXER_IDS.companion,
    label: 'Companion (HTTP)',
}

export default CompanionSettings
