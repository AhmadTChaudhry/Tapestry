import '../screens/home-library.css'

const TABS = [
  { key: 'home', label: 'Home', path: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z' },
  { key: 'list', label: 'Charts', path: 'M4 3h5v7H3V4a1 1 0 0 1 1-1Zm11 0h5a1 1 0 0 1 1 1v6h-6ZM3 15h6v6H4a1 1 0 0 1-1-1Zm12 0h6v5a1 1 0 0 1-1 1h-5Z' },
]

export default function TabBar({ active, onSelect }) {
  return <nav className="app-tab-bar tapestry-tab-bar" aria-label="Primary">
    {TABS.map(({ key, label, path }) => <button key={key} type="button" aria-current={active === key ? 'page' : undefined} onClick={() => onSelect(key)}>
      <span className="tapestry-tab-icon"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg></span>
      <span>{label}</span>
    </button>)}
  </nav>
}
