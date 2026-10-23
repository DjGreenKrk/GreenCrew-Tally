// MUI 5+ sliders keep a visually hidden native <input type=range>; keyboard
// events triggered by Cypress do not move it. Set the value like the browser
// does (the native setter clamps to min/max/step) and fire the events React
// listens to.
export const setSliderValue = (selector: string, value: number) => {
  return cy.get(`${selector} input[type=range]`).then($input => {
    const input = $input[0] as HTMLInputElement
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setValue?.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

export const validateSliderValue = (selector: string, value: number) => {
  return cy.get(`${selector} input[type=range]`).should('have.attr', 'aria-valuenow', value.toString())
}
