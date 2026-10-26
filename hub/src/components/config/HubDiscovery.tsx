import React, { useEffect, useState } from 'react'
import { Alert, Typography } from '@mui/material'
import MiniPage from '../layout/MiniPage'
import { socket } from '../../hooks/useSocket'
import { HubDiscoveryState } from '../../lib/HubDiscoveryState'
import { useTranslation } from '../../i18n'

// Whether firmware v2 tallies find this Hub on their own (mDNS, #28), and
// the Hub id that pins a tally to this Hub.
export function HubDiscoveryView({ state }: { state?: HubDiscoveryState }) {
  const { t } = useTranslation()
  if (!state) return null
  return <MiniPage testId="hub-discovery" title={t('discovery.title')}>
    {state.status === 'active' && <Typography sx={{ mb: 2 }} data-testid="hub-discovery-active">{t('discovery.active')}</Typography>}
    {state.status === 'off' && <Alert severity="info" sx={{ mb: 2 }} data-testid="hub-discovery-off">{t('discovery.off')}</Alert>}
    {state.status === 'error' && <Alert severity="error" sx={{ mb: 2 }} data-testid="hub-discovery-error">
      {t('discovery.error', { error: state.error || '' })}
    </Alert>}
    <Typography sx={{ mb: 1 }}>
      {t('discovery.hubId')} <strong data-testid="hub-discovery-id">{state.hubId}</strong>
    </Typography>
    <Typography variant="body2" sx={{ mb: 1 }}>{t('discovery.pin')}</Typography>
    <Typography variant="body2" color="text.secondary">{t('discovery.limits')}</Typography>
  </MiniPage>
}

function HubDiscovery() {
  const [state, setState] = useState<HubDiscoveryState>()
  useEffect(() => {
    socket.on('discovery.state', setState)
    socket.emit('discovery.get')
    return () => { socket.off('discovery.state', setState) }
  }, [])
  return <HubDiscoveryView state={state} />
}

export default HubDiscovery
