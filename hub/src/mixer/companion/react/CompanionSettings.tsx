import React from 'react'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import { socket } from '../../../hooks/useSocket'
import { MIXER_IDS } from '../../ids'

function CompanionSettings() {
    return (
        <MixerSettingsWrapper
            title="Companion HTTP Tally"
            testId="companion"
            description="Receive Program/Preview snapshots from Bitfocus Companion on this computer. API: /api/companion/tally (localhost only)."
            onSave={() => socket.emit('config.change.companion', MIXER_IDS.companion)}
        />
    )
}

CompanionSettings.defaultProps = {
    id: MIXER_IDS.companion,
    label: 'Companion (HTTP)',
}

export default CompanionSettings
