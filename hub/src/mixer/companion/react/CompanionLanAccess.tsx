import React, { useEffect, useState } from 'react'
import { Button, makeStyles, TextField, Typography } from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import { socket } from '../../../hooks/useSocket'
import { CompanionLanState } from '../../../lib/CompanionLanState'

const useStyles = makeStyles(theme => ({
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
    const classes = useStyles()
    const [visible, setVisible] = useState(false)
    const [copied, setCopied] = useState(false)
    if (!state) return null

    const hubIps = state.hubAddresses.length ? state.hubAddresses.join(' or ') : 'the IP address of this computer'
    const copy = () => {
        if (!state.token) return
        navigator.clipboard?.writeText(state.token).then(() => setCopied(true), () => setVisible(true))
    }

    return (<div className={classes.section} data-testid="companion-lan">
        <Typography variant="h6">Companion on this computer</Typography>
        <Typography paragraph>
            In the GreenCrew Tally connection in Companion use Hub IP <strong>127.0.0.1</strong>, port <strong>{state.httpPort}</strong> and leave the access token empty.
        </Typography>

        <Typography variant="h6">Companion on another computer (LAN)</Typography>
        <Typography paragraph>
            Use Hub IP <strong data-testid="companion-lan-ips">{hubIps}</strong>, port <strong>{state.httpPort}</strong> and the access token below.
        </Typography>

        {state.source === 'none' && <Typography paragraph data-testid="companion-lan-off">
            Remote access is off: only Companion on this computer can send tally data.
        </Typography>}

        {state.source === 'env' && <Alert severity="info" className={classes.token}>
            The token is set by the <code>VTALLY_COMPANION_TOKEN</code> environment variable of the Hub. Change or remove it there.
        </Alert>}
        {state.tooShort && <Alert severity="error" className={classes.token}>
            The token is shorter than 16 characters, so remote access stays off.
        </Alert>}

        {state.source !== 'none' && (state.token !== undefined ? (
            <TextField
                className={classes.token}
                label="Access token"
                value={visible ? state.token : '•'.repeat(24)}
                InputProps={{ readOnly: true }}
                inputProps={{ 'data-testid': 'companion-lan-token' }}
                variant="outlined"
                size="small"
            />
        ) : (
            <Typography paragraph data-testid="companion-lan-hidden">
                A token is set. It is shown only on the computer that runs the Hub.
            </Typography>
        ))}

        <div className={classes.buttons}>
            {state.token !== undefined && <>
                <Button size="small" variant="outlined" onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</Button>
                <Button size="small" variant="outlined" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
            </>}
            {state.canManage && <>
                <Button size="small" variant="contained" color="primary" data-testid="companion-lan-generate" onClick={() => { setCopied(false); onGenerate() }}>
                    {state.source === 'hub' ? 'Generate new token' : 'Allow LAN access (generate token)'}
                </Button>
                {state.source === 'hub' && <Button size="small" variant="outlined" data-testid="companion-lan-disable" onClick={onDisable}>Turn off LAN access</Button>}
            </>}
        </div>
        {state.canManage && state.source === 'hub' && <Typography variant="caption" paragraph>
            A new token replaces the old one at once; update it in Companion afterwards.
        </Typography>}
        {!state.canManage && state.source !== 'env' && <Typography variant="caption" paragraph>
            Open this page on the computer that runs the Hub to change LAN access.
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
