import { useState } from 'react'
import { StoreProvider } from './store'
import Home from './screens/Home'
import MyCharts from './screens/MyCharts'
import ChartScreen from './screens/ChartScreen'
import EditorRoute from './editor/EditorRoute'
import TabBar from './components/TabBar'

const TAB_ROUTES = new Set(['home', 'list'])

export default function App() {
  // Home and Charts are tabs, switched with the bottom bar and remembered as
  // `tab` so a chart or the photo editor opened from either one returns to
  // that same tab rather than always landing back on Charts.
  const [tab, setTab] = useState('home')
  const [route, setRoute] = useState({ name: 'home' })

  const goBack = () => setRoute({ name: tab })
  const openChart = (id) => setRoute({ name: 'chart', id })
  const openImport = (file) => setRoute({ name: 'import', file })
  const selectTab = (next) => {
    setTab(next)
    setRoute({ name: next })
  }

  return (
    <StoreProvider>
      {TAB_ROUTES.has(route.name) ? (
        <div className="app-shell">
          <div className="app-shell-content">
            {route.name === 'home' && (
              <Home onOpen={openChart} onNew={() => openImport()} onImportFile={openImport} onSeeAll={() => selectTab('list')} />
            )}
            {route.name === 'list' && (
              <MyCharts onOpen={openChart} onNew={() => openImport()} onImportFile={openImport} />
            )}
          </div>
          <TabBar active={tab} onSelect={selectTab} />
        </div>
      ) : (
        <>
          {route.name === 'import' && (
            <EditorRoute initialFile={route.file} onBack={goBack} onGenerated={(id) => setRoute({ name: 'chart', id })} />
          )}
          {route.name === 'chart' && <ChartScreen projectId={route.id} onBack={goBack} />}
        </>
      )}
    </StoreProvider>
  )
}
