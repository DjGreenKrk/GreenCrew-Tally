import React, { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material'
import MiniPage from '../layout/MiniPage'
import { socket } from '../../hooks/useSocket'
import { DeviceListState, DeviceView, isCrewPassword } from '../../tally/DeviceList'
import { TranslationKey, useTranslation } from '../../i18n'

export type DeviceActions = {
  identify(id: string): void
  pair(id: string): void
  unpair(id: string): void
  forget(id: string): void
  setCrewPassword(password: string): void
}

const ERRORS: Record<string, TranslationKey> = {
  'paired-elsewhere': 'devices.error.pairedElsewhere',
  'already-paired': 'devices.error.alreadyPaired',
  'no-answer': 'devices.error.noAnswer',
  'storage': 'devices.error.storage',
}

function DeviceRow({ device, actions }: { device: DeviceView, actions: DeviceActions }) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const statusText = device.status === 'pairedElsewhere' ?
    t('devices.status.pairedElsewhere', { hub: device.pairedHub || '' }) :
    t(`devices.status.${device.status}` as TranslationKey)
  const startPairing = () => {
    actions.identify(device.id)
    setConfirming(true)
  }
  return <Box data-testid={`device-${device.id}`} sx={{ py: 1.5, borderTop: 1, borderColor: 'divider' }}>
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
      <Typography component="strong" sx={{ fontWeight: 'bold' }}>{device.name}</Typography>
      <Chip size="small" label={statusText} color={device.status === 'paired' ? 'success' : 'default'} data-testid="device-status" />
      {!device.online && <Chip size="small" variant="outlined" label={t('devices.offline')} />}
      {device.duplicateName && <Chip size="small" color="warning" label={t('devices.duplicateName')} data-testid="device-duplicate" />}
    </Stack>
    <Typography variant="body2" color="text.secondary">
      {t('devices.details', { id: device.id, firmware: device.firmware || '?', address: device.address || '?' })}
      {device.status === 'paired' && ' · ' + t(`devices.crew.${device.crewPassword}` as TranslationKey)}
    </Typography>
    {device.status === 'tokenLost' && <Alert severity="warning" sx={{ mt: 1 }}>{t('devices.tokenLostHelp')}</Alert>}
    {device.staleToken && <Alert severity="info" sx={{ mt: 1 }} data-testid="device-stale">{t('devices.staleTokenHelp')}</Alert>}
    {device.lastError && <Alert severity="error" sx={{ mt: 1 }} data-testid="device-error">
      {ERRORS[device.lastError] ? t(ERRORS[device.lastError]) : t('devices.error.other', { reason: device.lastError })}
    </Alert>}
    {confirming && device.status === 'unpaired' && <Alert severity="info" sx={{ mt: 1 }} data-testid="device-confirm"
      action={<>
        <Button color="inherit" size="small" onClick={() => { actions.pair(device.id); setConfirming(false) }} data-testid="device-confirm-pair">
          {t('devices.confirmPair')}
        </Button>
        <Button color="inherit" size="small" onClick={() => setConfirming(false)}>{t('devices.cancel')}</Button>
      </>}>
      {t('devices.confirmText', { name: device.name })}
    </Alert>}
    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
      {device.online && device.address && <Button size="small" onClick={() => actions.identify(device.id)}>{t('devices.identify')}</Button>}
      {device.online && device.status === 'unpaired' && !confirming &&
        <Button size="small" variant="contained" onClick={startPairing} data-testid="device-pair">{t('devices.pair')}</Button>}
      {device.online && device.status === 'paired' &&
        <Button size="small" onClick={() => actions.unpair(device.id)} data-testid="device-unpair">{t('devices.unpair')}</Button>}
      {((!device.online && device.status === 'paired') || device.staleToken) &&
        <Button size="small" onClick={() => actions.forget(device.id)} data-testid="device-forget">{t('devices.forget')}</Button>}
    </Stack>
  </Box>
}

function CrewPassword({ state, actions }: { state: DeviceListState, actions: DeviceActions }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const valid = isCrewPassword(password)
  return <Box sx={{ mt: 3 }}>
    <Typography variant="h6" component="h3">{t('devices.crew.title')}</Typography>
    <Typography variant="body2" sx={{ mb: 1 }}>{t('devices.crew.help')}</Typography>
    <Typography sx={{ mb: 1 }} data-testid="crew-password-state">
      {state.crewPasswordSet ? t('devices.crew.isSet') : t('devices.crew.notSet')}
    </Typography>
    {state.canChangeCrewPassword ? <form onSubmit={event => {
      event.preventDefault()
      if (!valid) return
      actions.setCrewPassword(password)
      setPassword('')
    }}>
      <TextField type="password" size="small" autoComplete="off" label={t('devices.crew.new')} value={password}
        onChange={event => setPassword(event.target.value)}
        error={password !== '' && !valid} helperText={password !== '' && !valid ? t('devices.crew.invalid') : ' '}
        slotProps={{ htmlInput: { 'data-testid': 'crew-password-input', maxLength: 63 } }} />
      <Stack direction="row" spacing={1}>
        <Button type="submit" variant="contained" disabled={!valid} data-testid="crew-password-save">{t('devices.crew.save')}</Button>
        {state.crewPasswordSet && <Button onClick={() => actions.setCrewPassword('')} data-testid="crew-password-clear">{t('devices.crew.clear')}</Button>}
      </Stack>
    </form> : <Typography variant="body2" color="text.secondary">{t('devices.crew.onlyHubComputer')}</Typography>}
  </Box>
}

// Firmware v2 tallies on the network: pairing with this Hub and the crew
// password for their setup access point (#28).
export function DevicesView({ state, actions }: { state?: DeviceListState, actions: DeviceActions }) {
  const { t } = useTranslation()
  if (!state) return null
  return <MiniPage testId="devices" title={t('devices.title')}>
    <Typography variant="body2" sx={{ mb: 2 }}>{t('devices.help')}</Typography>
    {state.devices.length === 0 && <Typography color="text.secondary" data-testid="devices-none">{t('devices.none')}</Typography>}
    {state.devices.map(device => <DeviceRow key={device.id} device={device} actions={actions} />)}
    <CrewPassword state={state} actions={actions} />
  </MiniPage>
}

const socketActions: DeviceActions = {
  identify: id => socket.emit('device.identify', id),
  pair: id => socket.emit('device.pair', id),
  unpair: id => socket.emit('device.unpair', id),
  forget: id => socket.emit('device.forget', id),
  setCrewPassword: password => socket.emit('crewPassword.set', password),
}

function Devices() {
  const [state, setState] = useState<DeviceListState>()
  useEffect(() => {
    socket.on('devices.state', setState)
    socket.emit('devices.get')
    return () => { socket.off('devices.state', setState) }
  }, [])
  return <DevicesView state={state} actions={socketActions} />
}

export default Devices
