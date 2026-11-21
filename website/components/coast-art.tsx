export function CoastArt() {
  return (
    <svg className="coast-art" viewBox="0 0 760 430" fill="none" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="coast-water" x1="340" y1="330" x2="650" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#17291e" />
          <stop offset=".64" stopColor="#41604b" />
          <stop offset="1" stopColor="#718b63" />
        </linearGradient>
        <linearGradient id="coast-land" x1="390" y1="340" x2="750" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b7ce7b" />
          <stop offset=".55" stopColor="#e0ecad" />
          <stop offset="1" stopColor="#f2e7bd" />
        </linearGradient>
        <pattern id="coast-grid" width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M36 0H0v36" stroke="#eff4df" strokeOpacity=".18" />
        </pattern>
        <path id="coast-line" d="M-50 489C133 494 203 416 255 355c71-84 169-19 231-106 50-71 21-91 111-146 53-32 130-16 183-92l51-75" />
      </defs>
      <rect width="760" height="430" fill="url(#coast-water)" />
      <g opacity=".55" stroke="#d0e6ac" strokeWidth="1">
        {Array.from({length: 16}, (_, index) => (
          <use key={index} href="#coast-line" transform={`translate(${index * -13} ${index * -9})`} opacity={.86 - index * .033} />
        ))}
      </g>
      <path d="M-50 489C133 494 203 416 255 355c71-84 169-19 231-106 50-71 21-91 111-146 53-32 130-16 183-92l51-75v554Z" fill="url(#coast-land)" />
      <g stroke="#526842" strokeOpacity=".55">
        {Array.from({length: 17}, (_, index) => (
          <use key={index} href="#coast-line" transform={`translate(${index * 9} ${index * 10})`} />
        ))}
      </g>
      <rect width="760" height="430" fill="url(#coast-grid)" />
    </svg>
  );
}
