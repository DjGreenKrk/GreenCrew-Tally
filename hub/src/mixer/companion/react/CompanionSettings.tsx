import React from 'react'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import { socket } from '../../../hooks/useSocket'
import { SettingsProps } from '../../interfaces'
import CompanionConnector from '../CompanionConnector'

function CompanionSettings(_props: SettingsProps) {
    return (
        <MixerSettingsWrapper
            title="Companion HTTP Tally"
            testId="companion"
            description="Receive Program/Preview snapshots from Bitfocus Companion on this computer. API: /api/companion/tally (localhost only)."
            onSave={() => socket.emit('config.change.companion', CompanionConnector.ID)}
        />
    )
}

CompanionSettings.defaultProps = {
    id: CompanionConnector.ID,
    label: 'Companion (HTTP)',
}

export default CompanionSettings
