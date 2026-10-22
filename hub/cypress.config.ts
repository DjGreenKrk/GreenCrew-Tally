import { defineConfig } from 'cypress'
import tallyTasks from './cypress/tasks/tally'
import atemTasks from './cypress/tasks/atem'
import mixerTasks from './cypress/tasks/mixer'

// Manual scenarios need real hardware (an ATEM, a USB tally). They are excluded
// from `cypress run` and CI. Set CYPRESS_INCLUDE_MANUAL=true (npm run
// cypress:open:manual) to see them.
const excludeSpecPattern = process.env.CYPRESS_INCLUDE_MANUAL === 'true' ? [] : ['**/manual_*.spec.ts']

export default defineConfig({
  projectId: '1qd2ua',
  video: false,
  screenshotOnRunFailure: true,
  retries: { runMode: 1, openMode: 0 },
  env: {
    atem_ip: process.env.ATEM_IP || '192.168.178.200',
    atem_port: process.env.ATEM_PORT || '9910',
  },
  e2e: {
    baseUrl: process.env.HUB_URL || 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.spec.ts',
    excludeSpecPattern,
    supportFile: 'cypress/support/e2e.ts',
    setupNodeEvents(on, config) {
      on('task', {
        ...tallyTasks(config),
        ...atemTasks(config),
        ...mixerTasks(config),
      })
      return config
    },
  },
})
