import React from 'react'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import { socket } from '../../../hooks/useSocket'
import { MIXER_IDS } from '../../ids'
import CompanionLanAccess from './CompanionLanAccess'

function CompanionSettings() {
    return (
        <MixerSettingsWrapper
            title="Companion HTTP Tally"
            testId="companion"
            description="Receive Program/Preview/AUX snapshots from Bitfocus Companion (module GreenCrew Tally) at /api/companion/tally."
            onSave={() => socket.emit('config.change.companion', MIXER_IDS.companion)}
        >
            <CompanionLanAccess />
        </MixerSettingsWrapper>
    )
}

CompanionSettings.defaultProps = {
    id: MIXER_IDS.companion,
    label: 'Companion (HTTP)',
}

export default CompanionSettings
