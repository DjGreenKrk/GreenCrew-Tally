import React from 'react'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import { socket } from '../../../hooks/useSocket'
import type { SettingsProps } from '../../interfaces'
import { MIXER_IDS } from '../../ids'

type NullSettingsProps = SettingsProps & {}

function NullSettings(props: NullSettingsProps) {
    const handleSave = () => {
        if (props.id !== MIXER_IDS.null) {
            console.warn(`Changing id prop of NullSettings is not supported. But got ${props.id}.`)
        } else {
            socket.emit('config.change.null', MIXER_IDS.null)
        }
    }

    return (<MixerSettingsWrapper 
        title="Null Configuration"
        testId="null"
        description="Off"
        onSave={handleSave}
    ></MixerSettingsWrapper>)
}

NullSettings.defaultProps = {
    id: MIXER_IDS.null,
    label: "Off"
}

export default NullSettings
