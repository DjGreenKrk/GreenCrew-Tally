import { Button, Checkbox, FormControlLabel, TextField, Typography } from '@mui/material'
import React, { useEffect, useState } from 'react'
import { useEspNowGatewayConfiguration } from '../../hooks/useConfiguration'
import { socket } from '../../hooks/useSocket'
import { useTranslation } from '../../i18n'
import MiniPage from '../layout/MiniPage'

// ESP-NOW gateway (#25): off by default, see EspNowGatewayTallyDriver and
// firmware-v2/README.md's "ESP-NOW gateway" section.
function GatewaySettings() {
  const { t } = useTranslation()
  const configuration = useEspNowGatewayConfiguration()
  const [enabled, setEnabled] = useState(false)
  const [serialPort, setSerialPort] = useState("")
  const isLoading = !configuration

  useEffect(() => {
    setEnabled(configuration?.getEnabled() || false)
    setSerialPort(configuration?.getSerialPort() || "")
  }, [configuration])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!configuration) return
    const config = configuration.clone()
    config.setEnabled(enabled)
    config.setSerialPort(serialPort)
    socket.emit('config.change.espNowGateway', config.toJson())
  }

  return (
    <MiniPage testId="gateway-settings" title={t('gateway.title')}>
      {isLoading ? null : (
        <form onSubmit={handleSubmit}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('gateway.description')}</Typography>
          <FormControlLabel
            control={<Checkbox
              data-testid="gateway-enabled"
              checked={enabled}
              color="primary"
              onChange={(e) => setEnabled(e.target.checked)}
            />}
            label={t('gateway.enabled')}
          />
          <TextField
            data-testid="gateway-port"
            label={t('gateway.port')}
            helperText={t('gateway.portHint')}
            value={serialPort}
            onChange={(e) => setSerialPort(e.target.value)}
            fullWidth
            sx={{ mt: 2, mb: 2 }}
          />
          <Button data-testid="gateway-submit" type="submit" variant="contained" color="primary">{t('common.save')}</Button>
        </form>
      )}
    </MiniPage>
  )
}

export default GatewaySettings
