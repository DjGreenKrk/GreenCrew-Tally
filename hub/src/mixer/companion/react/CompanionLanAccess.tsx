import React, { useEffect, useState } from 'react'
import { makeStyles } from "tss-react/mui"
import { Button, TextField, Typography } from '@mui/material'
import { Alert } from '@mui/material'
import { socket } from '../../../hooks/useSocket'
import { CompanionLanState } from '../../../lib/CompanionLanState'
import { useTranslation } from '../../../i18n'

const useStyles = makeStyles()(theme => ({
    section: {
        marginTop: theme.spacing(2),
    },
    token: {
        width: '100%',
        maxWidth: 480,
        margin: theme.spacing(1, 0),
    },
    buttons: {
        '& > *': {
            marginRight: theme.spacing(1),
            marginBottom: theme.spacing(1),
        },
    },
}))

type ViewProps = {
    state?: CompanionLanState
    onGenerate: () => void
    onDisable: () => void
}

export function CompanionLanAccessView({ state, onGenerate, onDisable }: ViewProps) {
    const { classes } = useStyles()
    const { t } = useTranslation()
    const [visible, setVisible] = useState(false)
    const [copied, setCopied] = useState(false)
    if (!state) return null

    const hubIps = state.hubAddresses.length ? state.hubAddresses.join(t('companionLan.or')) : t('companionLan.thisComputer')
    const copy = () => {
        if (!state.token) return
        navigator.clipboard?.writeText(state.token).then(() => setCopied(true), () => setVisible(true))
    }

    return (<div className={classes.section} data-testid="companion-lan">
        <Typography variant="h6">{t('companionLan.localTitle')}</Typography>
        <Typography sx={{ mb: 2 }}>
            {t('companionLan.localBefore')}<strong>127.0.0.1</strong>{t('companionLan.port')}<strong>{state.httpPort}</strong>{t('companionLan.localAfter')}
        </Typography>

        <Typography variant="h6">{t('companionLan.remoteTitle')}</Typography>
        <Typography sx={{ mb: 2 }}>
            {t('companionLan.remoteBefore')}<strong data-testid="companion-lan-ips">{hubIps}</strong>{t('companionLan.port')}<strong>{state.httpPort}</strong>{t('companionLan.remoteAfter')}
        </Typography>

        {state.source === 'none' && <Typography sx={{ mb: 2 }} data-testid="companion-lan-off">
            {t('companionLan.off')}
        </Typography>}

        {state.source === 'env' && <Alert severity="info" className={classes.token}>
            {t('companionLan.envBefore')}<code>VTALLY_COMPANION_TOKEN</code>{t('companionLan.envAfter')}
        </Alert>}
        {state.tooShort && <Alert severity="error" className={classes.token}>
            {t('companionLan.tooShort')}
        </Alert>}

        {state.source !== 'none' && (state.token !== undefined ? (
            <TextField
                className={classes.token}
                label={t('companionLan.token')}
                value={visible ? state.token : '•'.repeat(24)}
                slotProps={{ input: { readOnly: true }, htmlInput: { 'data-testid': 'companion-lan-token' } }}
                variant="outlined"
                size="small"
            />
        ) : (
            <Typography sx={{ mb: 2 }} data-testid="companion-lan-hidden">
                {t('companionLan.hidden')}
            </Typography>
        ))}

        <div className={classes.buttons}>
            {state.token !== undefined && <>
                <Button size="small" variant="outlined" onClick={() => setVisible(!visible)}>{visible ? t('companionLan.hide') : t('companionLan.show')}</Button>
                <Button size="small" variant="outlined" onClick={copy}>{copied ? t('companionLan.copied') : t('companionLan.copy')}</Button>
            </>}
            {state.canManage && <>
                <Button size="small" variant="contained" color="primary" data-testid="companion-lan-generate" onClick={() => { setCopied(false); onGenerate() }}>
                    {state.source === 'hub' ? t('companionLan.regenerate') : t('companionLan.generate')}
                </Button>
                {state.source === 'hub' && <Button size="small" variant="outlined" data-testid="companion-lan-disable" onClick={onDisable}>{t('companionLan.disable')}</Button>}
            </>}
        </div>
        {state.canManage && state.source === 'hub' && <Typography variant="caption" sx={{ mb: 2 }}>
            {t('companionLan.replaceNote')}
        </Typography>}
        {!state.canManage && state.source !== 'env' && <Typography variant="caption" sx={{ mb: 2 }}>
            {t('companionLan.localOnly')}
        </Typography>}
    </div>)
}

function CompanionLanAccess() {
    const [state, setState] = useState<CompanionLanState>()
    useEffect(() => {
        socket.on('companion.lan.state', setState)
        socket.emit('companion.lan.get')
        return () => { socket.off('companion.lan.state', setState) }
    }, [])
    return <CompanionLanAccessView
        state={state}
        onGenerate={() => socket.emit('companion.lan.generate')}
        onDisable={() => socket.emit('companion.lan.disable')}
    />
}

export default CompanionLanAccess
