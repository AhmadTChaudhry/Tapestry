import { useState } from 'react'
import { StoreProvider } from './store'
import Home from './screens/Home'
import MyCharts from './screens/MyCharts'
import ChartScreen from './screens/ChartScreen'
import EditorRoute from './editor/EditorRoute'
import TabBar from './components/TabBar'
import Welcome from './components/Welcome'

const TAB_ROUTES = new Set(['home', 'list'])

export default function App() {
  // Home and Charts are tabs, switched with the bottom bar and remembered as
  // `tab` so a chart or the photo editor opened from either one returns to
  // that same tab rather than always landing back on Charts.
  const [tab, setTab] = useState('home')
  const [route, setRoute] = useState({ name: 'home' })
  const [welcoming, setWelcoming] = useState(() => {
    try { return sessionStorage.getItem('tapestry-welcome/v1') !== 'seen' } catch { return true }
  })
  const leaveWelcome = (newChart = false) => {
    try { sessionStorage.setItem('tapestry-welcome/v1', 'seen') } catch { /* Welcome still dismisses if storage is unavailable. */ }
    setWelcoming(false)
    if (newChart) setRoute({ name: 'import' })
  }

  const goBack = () => setRoute({ name: tab })
  const openChart = (id) => setRoute({ name: 'chart', id })
  const openImport = (file) => setRoute({ name: 'import', file })
  const selectTab = (next) => {
    setTab(next)
    setRoute({ name: next })
  }

  return (
    <StoreProvider>
      {welcoming ? <Welcome onContinue={() => leaveWelcome()} onNew={() => leaveWelcome(true)} /> : TAB_ROUTES.has(route.name) ? (
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
            <EditorRoute initialFile={route.file} initialDraftId={route.draftId} onBack={goBack} onGenerated={openChart} />
          )}
          {route.name === 'chart' && <ChartScreen key={route.id} projectId={route.id} onBack={goBack} onOpen={openChart} onEdit={draftId => setRoute({ name: 'import', draftId })} />}
        </>
      )}
    </StoreProvider>
  )
}
