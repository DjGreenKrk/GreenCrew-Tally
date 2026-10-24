/// <reference types="Cypress" />
/// <reference types="../support" />

const twelve = Array.from({ length: 12 }, (_, i) => `Cam ${i + 1}`)
const eight = Array.from({ length: 8 }, (_, i) => `Channel ${i + 1}`)

describe('Check Companion Configuration', () => {
  beforeEach(() => {
    cy.visit('/config')
    cy.getTestId("page-config")

    cy.get("*[data-testid=mixer-select] select").select('companion')

    cy.getTestId("companion")
  })
  afterEach(() => {
    cy.visit('/config')
    cy.get("*[data-testid=mixer-select] select").select('companion')
    cy.getTestId("companion-channel-names").clear().type(eight.join('\n'))
    cy.getTestId("companion-submit").click()
    cy.get("*[data-testid=mixer-select] select").select('test')
    cy.getTestId("test-submit").click()
  })

  it('more channels are accepted from Companion', () => {
    cy.getTestId("companion-channel-names").clear().type(twelve.join('\n'))
    cy.getTestId("companion-submit").click()

    cy.reload()
    cy.getTestId("companion-channel-names").should('have.value', twelve.join('\n'))

    cy.request('/api/companion/tally').its('body.channelCount').should('eq', 12)
    cy.request('POST', '/api/companion/tally', { programs: ['12'], previews: ['11'] })
      .its('body.programs').should('deep.equal', ['12'])
    cy.request({ method: 'POST', url: '/api/companion/tally', body: { programs: ['13'], previews: [] }, failOnStatusCode: false })
      .its('status').should('eq', 400)
  })
})
