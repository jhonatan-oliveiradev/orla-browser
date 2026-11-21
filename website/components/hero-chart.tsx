import { FeatureGlyphs } from './feature-catalog';

export function HeroChart() {
  return (
    <div className="hero-chart" aria-hidden="true">
      <svg viewBox="0 0 1440 680" preserveAspectRatio="xMidYMid slice" fill="none">
        <defs>
          <pattern id="night-chart-grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M55.5 0V55.5H0" stroke="#a4afff" strokeOpacity=".07" />
          </pattern>
          <linearGradient id="night-chart-line" x1="110" y1="560" x2="1280" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="#76a6ff" stopOpacity=".2" />
            <stop offset=".32" stopColor="#82b7ff" />
            <stop offset=".63" stopColor="#cdf870" stopOpacity=".45" />
            <stop offset="1" stopColor="#b4f872" />
          </linearGradient>
          <mask id="night-chart-edge"><rect width="1440" height="680" fill="white" /><ellipse cx="720" cy="342" rx="440" ry="236" fill="black" /></mask>
        </defs>
        <rect width="1440" height="680" fill="url(#night-chart-grid)" />
        <g opacity=".46" mask="url(#night-chart-edge)" stroke="url(#night-chart-line)">
          {Array.from({ length: 13 }, (_, n) => (
            <path key={n} d="M-160 610C75 685 220 689 365 555S480 200 730 140s466 95 881-222" transform={`translate(${n * 13 - 80} ${n * 26 - 156})`} />
          ))}
          <path d="M-80 550C244 725 365 642 568 417S903 191 1530 245M-85 94C292 19 398 246 593 285s506-173 950-61" strokeDasharray="4 8" />
        </g>
      </svg>
      <FeatureGlyphs />
    </div>
  );
}
