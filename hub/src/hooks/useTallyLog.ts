import { useState, useEffect } from 'react';
import {socket, socketEventEmitter} from './useSocket'
import TallyLogTracker from './tracker/tallylog';

const tallyLogTracker = new TallyLogTracker(socket, socketEventEmitter)

const getLogs = (tallyId: string) => {
  if (!tallyLogTracker.logs) { return undefined }
  return Array.from(tallyLogTracker.logs.get(tallyId) ?? [])
}

function useTallyLog(tallyId: string) {
  // undefined: the initial logs did not arrive yet. [] : arrived, nothing logged for this tally.
  const [logs, setLogs] = useState<ReturnType<typeof getLogs>>(getLogs(tallyId))

  useEffect(() => {
    const onChange = (logs) => {
      setLogs(Array.from(logs)) // needs a copy or refresh of component won't trigger
    }
    const onLoaded = () => {
      setLogs(getLogs(tallyId))
    }
    setLogs(getLogs(tallyId))
    tallyLogTracker.on(`log.${tallyId}`, onChange)
    tallyLogTracker.on('loaded', onLoaded)
    return () => {
      tallyLogTracker.off('loaded', onLoaded)
      // cleanup
      tallyLogTracker.off(`log.${tallyId}`, onChange)
    }
  }, [tallyId])

  return logs
}

export default useTallyLog
