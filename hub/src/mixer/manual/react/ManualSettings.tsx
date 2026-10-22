import React, { useEffect, useState } from 'react'
import { Button, FormControlLabel, Switch, TextField } from '@material-ui/core'
import { Link as RouterLink } from 'react-router-dom'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import { useManualConfiguration } from '../../../hooks/useConfiguration'
import { socket } from '../../../hooks/useSocket'
import { MIXER_IDS } from '../../ids'
import { MAX_MANUAL_CHANNELS } from '../ManualConfiguration'

type ManualSettingsProps = {
    id: typeof MIXER_IDS.manual,
    label: string,
}

const parseNames = (text: string) => text.split('\n').map(line => line.trim()).filter(line => line !== '')

function ManualSettings(props: ManualSettingsProps) {
    const configuration = useManualConfiguration()
    const [names, setNames] = useState('')
    const [exclusiveProgram, setExclusiveProgram] = useState(false)

    useEffect(() => {
        if (configuration) {
            setNames(configuration.getChannelNames().join('\n'))
            setExclusiveProgram(configuration.isExclusiveProgram())
        }
    }, [configuration])

    const count = parseNames(names).length
    const isValid = count >= 1 && count <= MAX_MANUAL_CHANNELS

    const handleSave = () => {
        if (configuration === undefined) {
            console.error("Not saving, because the configuration is not loaded yet.")
        } else if (props.id !== MIXER_IDS.manual) {
            console.warn(`Changing id prop of ManualSettings is not supported. But got ${props.id}.`)
        } else {
            const config = configuration.clone()
            config.setChannelNames(parseNames(names))
            config.setExclusiveProgram(exclusiveProgram)
            socket.emit('config.change.manual', config.toJson(), props.id)
        }
    }

    return (
        <MixerSettingsWrapper
            title="Manual Control"
            testId="manual"
            description={<>No vision mixer: set every channel by hand on the <Button component={RouterLink} to="/control" size="small" color="primary">Control</Button> page, e.g. from a phone in the same network. Patch the tallies to these channels as usual.</>}
            canBeSaved={isValid}
            isLoading={!configuration}
            onSave={handleSave}
        >
            {configuration && <TextField
                label="Channels, one name per line"
                multiline
                minRows={4}
                fullWidth
                value={names}
                onChange={e => setNames(e.target.value)}
                error={!isValid}
                helperText={isValid ? `${count} channel${count === 1 ? '' : 's'}` : `1 to ${MAX_MANUAL_CHANNELS} channels`}
                inputProps={{ 'data-testid': 'manual-channel-names' }}
            />}
            {configuration && <FormControlLabel
                control={<Switch checked={exclusiveProgram} onChange={e => setExclusiveProgram(e.target.checked)} color="primary" inputProps={{ 'data-testid': 'manual-exclusive' } as React.InputHTMLAttributes<HTMLInputElement>} />}
                label="Only one channel on Program: setting a channel to Program turns off the previous one"
            />}
        </MixerSettingsWrapper>
    )
}

ManualSettings.defaultProps = {
    id: MIXER_IDS.manual,
    label: "Manual (phone control)",
}

export default ManualSettings
