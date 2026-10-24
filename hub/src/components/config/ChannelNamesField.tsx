import React from 'react'
import { TextField } from '@mui/material'
import { MAX_CHANNELS } from '../../mixer/channelNames'
import { useTranslation } from '../../i18n'

export const parseChannelNames = (text: string) => text.split('\n').map(line => line.trim()).filter(line => line !== '')

export const areChannelNamesValid = (text: string) => {
    const count = parseChannelNames(text).length
    return count >= 1 && count <= MAX_CHANNELS
}

type Props = {
    value: string
    onChange: (value: string) => void
    testId: string
    hint?: string
}

// One channel name per line; the line number is the channel id.
function ChannelNamesField({ value, onChange, testId, hint }: Props) {
    const { t } = useTranslation()
    const count = parseChannelNames(value).length
    const isValid = areChannelNamesValid(value)
    const status = isValid ? t('channels.count', { count }) : t('channels.range', { max: MAX_CHANNELS })
    return (
        <TextField
            label={t('channels.names')}
            multiline
            minRows={4}
            fullWidth
            value={value}
            onChange={e => onChange(e.target.value)}
            error={!isValid}
            helperText={hint ? `${status}. ${hint}` : status}
            slotProps={{ htmlInput: { 'data-testid': testId } }}
        />
    )
}

export default ChannelNamesField
