import { useState, useEffect } from 'react';
import {socket, socketEventEmitter} from './useSocket'
import ProgramTracker from './tracker/program'

const programTracker = new ProgramTracker(socket, socketEventEmitter)

// the hook
function useProgramPreview() {
  const [programs, setPrograms] = useState(programTracker.programs)
  const [previews, setPreviews] = useState(programTracker.previews)
  const [auxes, setAuxes] = useState(programTracker.auxes)

  useEffect(() => {
    const onChange = (programs, previews, auxes) => {
      setPrograms(programs)
      setPreviews(previews)
      setAuxes(auxes)
    }

    programTracker.on("program", onChange)
    return () => {
      // cleanup
      programTracker.off("program", onChange)
    }
  }, [])

  return [programs, previews, auxes] as const
}

export default useProgramPreview
