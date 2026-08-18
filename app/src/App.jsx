import { useState } from 'react'
import { StoreProvider } from './store'
import MyCharts from './screens/MyCharts'
import ImportGrid from './screens/ImportGrid'
import ChartScreen from './screens/ChartScreen'

export default function App() {
  // Small hand-rolled router: three routes, no library needed.
  const [route, setRoute] = useState({ name: 'list' })

  return (
    <StoreProvider>
      {route.name === 'list' && (
        <MyCharts
          onOpen={(id) => setRoute({ name: 'chart', id })}
          onNew={() => setRoute({ name: 'import' })}
          onImportFile={(file) => setRoute({ name: 'import', file })}
        />
      )}
      {route.name === 'import' && (
        <ImportGrid
          initialFile={route.file}
          onBack={() => setRoute({ name: 'list' })}
          onGenerated={(id) => setRoute({ name: 'chart', id })}
        />
      )}
      {route.name === 'chart' && (
        <ChartScreen projectId={route.id} onBack={() => setRoute({ name: 'list' })} />
      )}
    </StoreProvider>
  )
}
