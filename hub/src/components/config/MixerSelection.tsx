import { NativeSelect, Typography } from '@mui/material'
import { makeStyles } from "tss-react/mui"
import React, { useState } from 'react'
import { useAllowedMixersConfiguration, useMixerNameConfiguration } from '../../hooks/useConfiguration'
import Spinner from '../layout/Spinner'
import MiniPage from '../layout/MiniPage'
import { TranslationKey, useTranslation } from '../../i18n'

const useStyles = makeStyles()(theme => ({
    text: {
        color: theme.palette.grey[600]
    },
    select: {
        marginBottom: theme.spacing(2),
    },
}))

type MixerOptionProps = {
    id: string
    label: string
}

function MixerOption({id, label}: MixerOptionProps) {
    return (
        <option key={id} value={id}>{label}</option>
    )
}

// Mixer settings components expose their id and label as a static `mixerMeta` field
// (React 19 no longer supports defaultProps on function components).
type MixerMeta = { id: string, label: string }
type MixerSettingsElement = React.ReactElement & { type: { mixerMeta?: MixerMeta } }

function metaOf(child: React.ReactElement): MixerMeta | undefined {
    return (child?.type as MixerSettingsElement["type"])?.mixerMeta
}

function isValidChild(child: React.ReactElement) {
    const meta = metaOf(child)
    return !!(meta?.id && meta?.label)
}

type MixerSelectionProps = {
    children?: React.ReactElement[]
}

function MixerSelection({children}: MixerSelectionProps) {
    const mixerName = useMixerNameConfiguration()
    const allowedMixers = useAllowedMixersConfiguration()
    
    const [oldMixerName, setOldMixerName] = useState(mixerName)
    const [mixerId, setMixerId] = useState(mixerName)
    const { classes } = useStyles()
    const { t } = useTranslation()

    const isLoading = mixerName === undefined || allowedMixers === undefined
    if (mixerName !== oldMixerName) {
        setMixerId(mixerName)
        setOldMixerName(mixerName)
    }

    const availableChildren = children?.filter((child) => {
        if (!isValidChild(child)) {
            throw new Error(`Expected all nodes of MixerSelection to be ReactNodes implementing SettingProps, but got ${child?.constructor?.name || typeof child}`)
        }

        return allowedMixers?.includes(metaOf(child).id)
    })

    const currentMixer = availableChildren?.reduce((cur, child) => {
        return metaOf(child).id === mixerId ? child : cur
    }, null)

    return (
        <MiniPage title={t('mixer.title')}>
            <Typography sx={{ mb: 2 }} className={classes.text}>{t('mixer.select')}</Typography>
            {isLoading ? <Spinner /> : (<>
                <div className={classes.select}>
                    <NativeSelect data-testid="mixer-select" value={mixerId} onChange={e => setMixerId(e.target.value)}>
                        {availableChildren?.map(child => {
                            return (<MixerOption key={metaOf(child).id} id={metaOf(child).id} label={t(`mixer.label.${metaOf(child).id}` as TranslationKey)} />)
                        })}
                    </NativeSelect>
                </div>
                {currentMixer}
            </>)}
        </MiniPage>
    )
}

export default MixerSelection
