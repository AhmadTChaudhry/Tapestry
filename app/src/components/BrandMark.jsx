export function StitchesMark({ className = '' }) {
  return (
    <svg
      className={`stitches-mark ${className}`.trim()}
      data-testid="stitches-mark"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="46" height="46" rx="16" fill="#FFFDFB" stroke="#DDD4E5" strokeWidth="1.5" />
      <path d="M32.5 12.5c-3.8-3.4-11.2-3.8-15.2-.6-4.8 3.9-2.2 8.2 3 10.1l6.4 2.3c5.5 2 7.5 6.4 3.1 10.2-4.2 3.6-11.9 2.7-15.8-1.4" stroke="#724C80" strokeWidth="4.2" strokeLinecap="round" />
      <path d="M13.5 13.5l3.2 4 3.2-4m-6.4 17 3.2 4 3.2-4m9.8-21 3.2 4 3.2-4m-6.4 17 3.2 4 3.2-4" stroke="#F2B89F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11.5" cy="36.5" r="2.3" fill="#8EA99B" />
    </svg>
  )
}

export function StitchSampler() {
  const cells = [
    ['#724C80', '#724C80', '#F2B89F', '#F2B89F', '#8EA99B'],
    ['#724C80', '#F2B89F', '#F2B89F', '#8EA99B', '#8EA99B'],
    ['#F2B89F', '#F2B89F', '#B4553C', '#B4553C', '#8EA99B'],
    ['#F2B89F', '#B4553C', '#B4553C', '#B4553C', '#F2B89F'],
    ['#8EA99B', '#8EA99B', '#F2B89F', '#F2B89F', '#724C80'],
  ]

  return (
    <svg className="stitch-sampler" viewBox="0 0 96 96" role="img" aria-label="A playful stitch sampler">
      <rect x="3" y="3" width="90" height="90" rx="25" fill="#FFFDFB" stroke="#DDD4E5" strokeWidth="2" />
      <path d="M12 21h72M12 36h72M12 51h72M12 66h72M12 81h72M21 12v72M36 12v72M51 12v72M66 12v72M81 12v72" stroke="#302742" strokeOpacity=".08" strokeWidth="1" />
      {cells.flatMap((row, y) => row.map((color, x) => (
        <path
          key={`${x}-${y}`}
          d="M15 1c2-3 5 0 6 3v6c-3-2-5-5-6-9m12 0c-1-3-4 0-6 3v6c3-2 5-5 6-9"
          transform={`translate(${14 + x * 14} ${15 + y * 14})`}
          fill={color}
        />
      )))}
      <path d="M20 82c10 8 24 8 33 0 7-6 16-6 23 0" stroke="#724C80" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 4" />
      <circle cx="76" cy="81" r="3" fill="#B4553C" />
    </svg>
  )
}
