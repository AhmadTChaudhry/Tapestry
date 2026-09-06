import './Welcome.css'
import { StitchesMark } from './BrandMark'

const motif = [
  '0000000000000000', '0001100000110000', '0001210001210000',
  '0001221112210000', '0001222222210000', '0000122222100000',
  '0000012221000000', '0000001110000000', '0000000330000000',
  '0004400330044000', '0000440330440000', '0000044334400000',
  '0000004334000000', '0000000330000000', '0000000330000000',
  '0000000330000000', '0000000000000000',
]
const colors = { 1: '#946886', 2: '#F2B89F', 3: '#648878', 4: '#ADC6B5' }

export function StitchTulip() {
  return <svg className="stitch-tulip" viewBox="0 0 240 272" role="img" aria-label="A tulip made of crochet stitches">
    <defs>
      <pattern id="cotton" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 2H6M2 0V6" stroke="#302742" strokeOpacity=".035" strokeWidth="1" /></pattern>
    </defs>
    <path d="M26 10Q120 0 214 10L224 244Q120 266 16 244Z" fill="#FFFDFA" />
    <path d="M26 10Q120 0 214 10L224 244Q120 266 16 244Z" fill="url(#cotton)" />
    {motif.flatMap((row, y) => [...row].map((color, x) => color !== '0' && <g key={`${x}-${y}`} transform={`translate(${32 + x * 11}, ${24 + y * 12})`}>
      <path d="M1 1Q3 -1 5 3L5 10Q2 7 1 1M9 1Q7 -1 5 3L5 10Q8 7 9 1" fill={colors[color]} />
      <path d="M2 1L5 8L8 1" fill="none" stroke="#FFFFFF" strokeOpacity=".23" strokeWidth="1" />
    </g>))}
    <path d="M40 244L39 255M56 247L56 258M72 249L72 261M88 251L88 263M104 253L104 265M120 253L120 266M136 253L136 265M152 251L152 263M168 249L168 261M184 247L184 258M200 244L201 255" stroke="#FFFDFA" strokeWidth="5" strokeLinecap="round" />
  </svg>
}

export default function Welcome({ onContinue, onNew }) {
  return <main className="welcome-screen">
    <div className="welcome-brand"><StitchesMark /><span className="welcome-brand-lockup"><strong>Stitches</strong><small>Tapestry</small></span></div>
    <div className="welcome-art"><StitchTulip /></div>
    <div className="welcome-copy">
      <h1>A little picture.<br />A lot of possibility.</h1>
      <p>Turn a photo into a crochet chart.<br />Make it yours, one stitch at a time.</p>
    </div>
    <div className="welcome-actions">
      <button className="pill-primary" onClick={onContinue}>Open my charts</button>
      <button className="welcome-new" onClick={onNew}>Start with a photo</button>
    </div>
  </main>
}
