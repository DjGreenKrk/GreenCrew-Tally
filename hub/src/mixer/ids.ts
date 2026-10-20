// Browser-safe, shared literal identifiers. UI must not import runtime connectors
// merely to access IDs: those pull in OBS WebSocket / Node native modules.
export const MIXER_IDS = {
  atem: 'atem',
  obs: 'obs',
  vmix: 'vmix',
  rolandV8HD: 'rolandV8HD',
  rolandV60HD: 'rolandV60HD',
  companion: 'companion',
  null: 'null',
  mock: 'mock',
  test: 'test',
} as const

export type MixerId = typeof MIXER_IDS[keyof typeof MIXER_IDS]
