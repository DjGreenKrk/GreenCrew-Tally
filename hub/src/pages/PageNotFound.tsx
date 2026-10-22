import React from 'react'
import Layout from '../components/layout/Layout'
import MiniPage from '../components/layout/MiniPage'
import { useTranslation } from '../i18n'

const PageNotFound = ({children}) => {
  const { t } = useTranslation()
  return (
    <Layout testId="404">
      <MiniPage title={t('notFound.title')}>{children}</MiniPage>
    </Layout>
  )
}
export default PageNotFound