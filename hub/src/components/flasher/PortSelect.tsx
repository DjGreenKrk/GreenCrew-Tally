import React from 'react'
import { FormControl, InputLabel, makeStyles, Select } from '@material-ui/core'
import { SerialPortChoice } from '../../flasher/TallyDevice'

const adapterNames: Record<string, string> = {
  '1A86': 'CH340',
  '10C4': 'CP210x',
  '0403': 'FTDI',
}

export const describePort = (port: SerialPortChoice) => {
  const adapter = port.vendorId && adapterNames[port.vendorId.toUpperCase()]
  return `${port.path} – ${adapter || (port.supported ? 'USB serial' : 'unknown device')}`
}

/**
 * The port choice only matters when it is ambiguous: several ESP adapters,
 * or none recognised (then the user may pick an unidentified port).
 */
export const needsPortChoice = (ports: SerialPortChoice[], selectedPath?: string) =>
  (ports.filter(port => port.supported).length !== 1 && ports.length > 0)
  || (selectedPath !== undefined && ports.some(port => port.path === selectedPath && !port.supported))

const useStyles = makeStyles(theme => ({
  root: {
    marginBottom: theme.spacing(2),
    minWidth: 240,
  },
}))

type Props = {
  ports: SerialPortChoice[]
  value?: string
  disabled?: boolean
  onChange: (path: string) => void
}

function PortSelect({ ports, value, disabled, onChange }: Props) {
  const classes = useStyles()
  // Recognised ESP adapters first, then the rest in the order Windows lists them.
  const sorted = [...ports.filter(port => port.supported), ...ports.filter(port => !port.supported)]
  return (
    <FormControl className={classes.root} disabled={disabled}>
      <InputLabel shrink htmlFor="flasher-port">Serial port</InputLabel>
      <Select
        native
        data-testid="flasher-port"
        value={value || ''}
        onChange={e => onChange(String(e.target.value))}
        inputProps={{ id: 'flasher-port' }}
      >
        {value === undefined && <option value="">Choose a port…</option>}
        {sorted.map(port => <option key={port.path} value={port.path}>{describePort(port)}</option>)}
      </Select>
    </FormControl>
  )
}

export default PortSelect
