import React from 'react'
import { Button, makeStyles, Paper, Typography } from '@material-ui/core'
import Layout from '../components/layout/Layout'
import useChannels from '../hooks/useChannels'
import useProgramPreview from '../hooks/useProgramPreview'
import useTallies from '../hooks/useTallies'
import { useManualConfiguration, useMixerNameConfiguration } from '../hooks/useConfiguration'
import { socket } from '../hooks/useSocket'
import { MIXER_IDS } from '../mixer/ids'
import { ManualChannelState } from '../mixer/manual/ManualState'
import { DefaultColorScheme } from '../tally/ColorScheme'
import { ChannelList } from '../lib/MixerCommunicator'

const stateColors: Record<ManualChannelState, string> = {
    off: '#424242',
    preview: '#2e7d32',
    aux: DefaultColorScheme.aux.toCss(),
    program: '#c62828',
}
const stateLabels: Record<ManualChannelState, string> = {
    off: 'Off',
    preview: 'Preview',
    aux: 'AUX',
    program: 'Program',
}
const buttonStates: ManualChannelState[] = ['off', 'preview', 'aux', 'program']

const useStyles = makeStyles(theme => ({
    toolbar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: theme.spacing(2, 0),
    },
    channel: {
        margin: theme.spacing(0, 0, 2),
        padding: theme.spacing(1.5),
        borderLeft: '12px solid',
        backgroundColor: theme.palette.grey[800],
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: theme.spacing(1),
        marginBottom: theme.spacing(1),
    },
    tallies: {
        color: theme.palette.grey[400],
    },
    buttons: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: theme.spacing(1),
    },
    stateButton: {
        minHeight: 56,
        fontSize: '1rem',
        fontWeight: 'bold',
    },
}))

export function channelState(channelId: string, programs: ChannelList, previews: ChannelList, auxes: string[]): ManualChannelState {
    if (programs?.includes(channelId)) return 'program'
    if (auxes?.includes(channelId)) return 'aux'
    if (previews?.includes(channelId)) return 'preview'
    return 'off'
}

function ControlPage() {
    const classes = useStyles()
    const mixerName = useMixerNameConfiguration()
    const manualConfiguration = useManualConfiguration()
    const channels = useChannels()
    const tallies = useTallies()
    const [programs, previews, auxes] = useProgramPreview()
    const isManual = mixerName === MIXER_IDS.manual

    const flash = (channelId: string) => {
        tallies?.filter(tally => tally.channelIds.includes(channelId))
            .forEach(tally => socket.emit('tally.highlight', tally.name, tally.type))
    }

    if (!isManual) {
        return (
            <Layout testId="control">
                <Typography variant="h5" gutterBottom>Manual control</Typography>
                <Typography paragraph data-testid="control-inactive">
                    The Hub follows a vision mixer now. Switch to manual control to set the tallies by hand from this page.
                </Typography>
                <Button variant="contained" color="primary" disabled={!manualConfiguration} data-testid="control-activate"
                    onClick={() => manualConfiguration && socket.emit('config.change.manual', manualConfiguration.toJson(), MIXER_IDS.manual)}>
                    Use manual control
                </Button>
            </Layout>
        )
    }

    return (
        <Layout testId="control">
            <div className={classes.toolbar}>
                <Typography variant="h5">Manual control</Typography>
                <Button variant="outlined" onClick={() => socket.emit('manual.allOff')} data-testid="control-all-off">All off</Button>
            </div>
            {channels?.map(channel => {
                const state = channelState(channel.id, programs, previews, auxes)
                const patched = tallies?.filter(tally => tally.channelIds.includes(channel.id)).map(tally => tally.name) || []
                return (
                    <Paper key={channel.id} className={classes.channel} style={{ borderLeftColor: stateColors[state] }} data-testid={`control-channel-${channel.id}`} data-state={state}>
                        <div className={classes.header}>
                            <Typography variant="h6">{channel.name || channel.id}</Typography>
                            <Button size="small" onClick={() => flash(channel.id)} disabled={patched.length === 0}>Flash</Button>
                        </div>
                        {patched.length > 0 && <Typography variant="body2" className={classes.tallies} gutterBottom>{patched.join(', ')}</Typography>}
                        <div className={classes.buttons}>
                            {buttonStates.map(buttonState => (
                                <Button
                                    key={buttonState}
                                    className={classes.stateButton}
                                    variant={state === buttonState ? 'contained' : 'outlined'}
                                    style={state === buttonState ? { backgroundColor: stateColors[buttonState], color: '#fff' } : undefined}
                                    aria-pressed={state === buttonState}
                                    data-testid={`control-${channel.id}-${buttonState}`}
                                    onClick={() => socket.emit('manual.set', channel.id, buttonState)}
                                >{stateLabels[buttonState]}</Button>
                            ))}
                        </div>
                    </Paper>
                )
            })}
        </Layout>
    )
}

export default ControlPage
