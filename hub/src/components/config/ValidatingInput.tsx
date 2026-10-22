import { makeStyles, TextField } from '@material-ui/core'
import React, { useEffect, useRef, useState } from 'react'
import { Configuration } from '../../mixer/interfaces'
import { useTranslation } from '../../i18n'

type ValidatingInputProps = {
    label: string
    testId: string
    object: Configuration
    propertyName: string
    errorMessage?: string
    warningMessage?: string
    onValid?: (value: string|null) => void
    onInvalid?: () => void
}

const useStyles = makeStyles(theme => ({
    input: {
        margin: theme.spacing(0, 2, 2, 0)
    }
}))


const upperCaseFirst = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`

/* an active component that allows easy editing of values of Configuration objects
 * 
 * It validates values by trying to call the setter on the object. If it does not throw an error
 * the value is assumed to be valid.
 */
function ValidatingInput({label, testId, object, propertyName, errorMessage, warningMessage, onValid, onInvalid}: ValidatingInputProps) {
    const getterName = `get${upperCaseFirst(propertyName)}`
    const setterName = `set${upperCaseFirst(propertyName)}`
    if (typeof object[getterName] !== "function") { throw new Error(`${getterName} is not a function`) }
    if (typeof object[setterName] !== "function") { throw new Error(`${setterName} is not a function`) }

    const rawObjectValue = object[getterName]()
    const theObjectValue = rawObjectValue == null ? null : String(rawObjectValue)
    const [value, setValue] = useState<string|null>(theObjectValue)
    const [isValid, setIsValid] = useState(true)
    const classes = useStyles()
    const { t } = useTranslation()

    // Notify the parent after commit, never schedule a timer from render.
    // A ref keeps the latest callback without resetting edits on every render.
    const onValidRef = useRef(onValid)
    onValidRef.current = onValid
    useEffect(() => {
        setValue(theObjectValue)
        setIsValid(true)
        onValidRef.current?.(theObjectValue)
    }, [theObjectValue])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value === "" ? null : e.target.value
        setValue(newValue)
        try {
            object.clone()[setterName](newValue)
            setIsValid(true)
            onValid?.(newValue)
        } catch {
            setIsValid(false)
            onInvalid?.()
        }
    }

    return (
        <TextField
            data-testid={testId}
            label={label} 
            value={value} 
            onChange={handleChange}
            error={!isValid}
            helperText={!isValid ? (errorMessage || t('settings.invalid')) : (warningMessage || "")}
            className={classes.input}
        />
    )
}

export default ValidatingInput
