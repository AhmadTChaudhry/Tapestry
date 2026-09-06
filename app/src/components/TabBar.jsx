const TABS = [
  { key: 'home', label: 'Home', glyph: '⌂' },
  { key: 'list', label: 'Charts', glyph: '▦' },
]

/** Fixed-position two-item tab bar for switching between the app's top-level
 *  screens on a phone. A normal flex sibling of the active screen, not
 *  position:fixed — the content area already stops short of it, so nothing
 *  needs its own bottom padding to avoid being covered. */
export default function TabBar({ active, onSelect }) {
  return (
    <nav className="app-tab-bar" aria-label="Primary">
      {TABS.map(({ key, label, glyph }) => {
        const current = active === key
        return (
          <button
            key={key}
            className="press"
            type="button"
            aria-current={current ? 'page' : undefined}
            onClick={() => onSelect(key)}
          >
            <span className="app-tab-icon" aria-hidden="true">{glyph}</span>
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
