import React from 'react'
import Layout from '../components/layout/Layout'
import AtemSettings from '../mixer/atem/react/AtemSettings'
import MixerSelection from '../components/config/MixerSelection'
import NullSettings from '../mixer/null/react/NullSettings'
import CompanionSettings from '../mixer/companion/react/CompanionSettings'
import MockSettings from '../mixer/mock/react/MockSettings'
import ManualSettings from '../mixer/manual/react/ManualSettings'
import ObsSettings from '../mixer/obs/react/ObsSettings'
import RolandV8HDSettings from '../mixer/rolandV8HD/react/RolandV8HDSettings'
import RolandV60HDSettings from '../mixer/rolandV60HD/react/RolandV60HDSettings'
import TestSettings from '../mixer/test/react/TestSettings'
import VmixSettings from '../mixer/vmix/react/VmixSettings'
import TallySettings from '../components/config/TallySettings'
import HubDiscovery from '../components/config/HubDiscovery'

const ConfigPage = () => {
  return (
    <Layout testId="config">
      <MixerSelection>
        <NullSettings />
        <CompanionSettings />
        <ManualSettings />
        <AtemSettings />
        <MockSettings />
        <ObsSettings />
        <RolandV8HDSettings />
        <RolandV60HDSettings />
        <TestSettings />
        <VmixSettings />
      </MixerSelection>
      <TallySettings />
      <HubDiscovery />
    </Layout>
  )
}
export default ConfigPage;