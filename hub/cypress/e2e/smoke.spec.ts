/// <reference types="Cypress" />
/// <reference types="../support" />

describe('Smoke Test', () => {
  it('Check that the page is running', () => {
    cy.visit('/')
    cy.getTestId("page-index")
  })

  it('Navigation is working', () => {
    cy.visit('/')
    cy.getTestId("page-index")

    cy.contains("Configuration").click()
    cy.getTestId("page-config")
    
    cy.contains("Control").click()
    cy.getTestId("page-control")

    cy.contains("Flash").click()
    cy.getTestId("page-flasher")

    cy.get("a[aria-label='About GC Tally']").click()
    cy.getTestId("page-about")

    cy.contains("Tallies").click()
    cy.getTestId("page-index")

  })

  it('allows deep links into /config', () => {
    cy.visit('/config')
    cy.getTestId("page-config")
  })

  it('allows deep links into /control and /about', () => {
    cy.visit('/control')
    cy.getTestId("page-control")
    cy.visit('/about')
    cy.getTestId("page-about")
  })

  it('allows deep links into /flasher', () => {
    cy.visit('/flasher')
    cy.getTestId("page-flasher")
  })

  it.skip('should not rely on resources from the internet')
  it.skip('should instantly show the correct state when the server crashes and is restarted')
})