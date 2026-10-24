import React, { useEffect, useState } from 'react'
import { Button, FormControlLabel, Switch } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import MixerSettingsWrapper from '../../../components/config/MixerSettingsWrapper'
import { useManualConfiguration } from '../../../hooks/useConfiguration'
import { socket } from '../../../hooks/useSocket'
import { MIXER_IDS } from '../../ids'
import ChannelNamesField, { areChannelNamesValid, parseChannelNames } from '../../../components/config/ChannelNamesField'
import { useTranslation } from '../../../i18n'

function ManualSettings() {
    const { t } = useTranslation()
    const configuration = useManualConfiguration()
    const [names, setNames] = useState('')
    const [exclusiveProgram, setExclusiveProgram] = useState(false)

    useEffect(() => {
        if (configuration) {
            setNames(configuration.getChannelNames().join('\n'))
            setExclusiveProgram(configuration.isExclusiveProgram())
        }
    }, [configuration])

    const isValid = areChannelNamesValid(names)

    const handleSave = () => {
        if (configuration === undefined) {
            console.error("Not saving, because the configuration is not loaded yet.")
        } else {
            const config = configuration.clone()
            config.setChannelNames(parseChannelNames(names))
            config.setExclusiveProgram(exclusiveProgram)
            socket.emit('config.change.manual', config.toJson(), MIXER_IDS.manual)
        }
    }

    return (
        <MixerSettingsWrapper
            title={t('manual.title')}
            testId="manual"
            description={<>{t('manual.descriptionBefore')}<Button component={RouterLink} to="/control" size="small" color="primary">{t('manual.controlPage')}</Button>{t('manual.descriptionAfter')}</>}
            canBeSaved={isValid}
            isLoading={!configuration}
            onSave={handleSave}
        >
            {configuration && <ChannelNamesField value={names} onChange={setNames} testId="manual-channel-names" />}
            {configuration && <FormControlLabel
                control={<Switch checked={exclusiveProgram} onChange={e => setExclusiveProgram(e.target.checked)} color="primary" slotProps={{ input: { 'data-testid': 'manual-exclusive' } as React.InputHTMLAttributes<HTMLInputElement> }} />}
                label={t('manual.exclusive')}
            />}
        </MixerSettingsWrapper>
    )
}

ManualSettings.mixerMeta = {
    id: MIXER_IDS.manual,
    label: "Manual (phone control)",
}

export default ManualSettings
