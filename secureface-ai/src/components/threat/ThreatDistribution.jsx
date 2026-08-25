function ThreatDistribution({ data }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)

  // SVG donut chart calculations
  const radius = 80
  const circumference = 2 * Math.PI * radius
  let cumulativeOffset = 0

  const segments = data.map((item) => {
    const percentage = (item.count / total) * 100
    const segmentLength = (percentage / 100) * circumference
    const offset = cumulativeOffset
    cumulativeOffset += segmentLength

    return {
      ...item,
      percentage: Math.round(percentage),
      segmentLength,
      offset,
    }
  })

  return (
    <div className="card threat-distribution-card" id="threat-distribution">
      <h3 className="threat-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
        Threat Distribution
      </h3>

      <div className="threat-donut-wrapper">
        <svg className="threat-donut" viewBox="0 0 200 200">
          {segments.map((seg, i) => (
            <circle
              key={seg.label}
              className="threat-donut-segment"
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="24"
              strokeDasharray={`${seg.segmentLength} ${circumference - seg.segmentLength}`}
              strokeDashoffset={-seg.offset}
              strokeLinecap="round"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
          {/* Center text */}
          <text x="100" y="92" textAnchor="middle" className="threat-donut-total">{total}</text>
          <text x="100" y="114" textAnchor="middle" className="threat-donut-label">Total</text>
        </svg>
      </div>

      <div className="threat-donut-legend">
        {segments.map((seg) => (
          <div className="threat-legend-item" key={seg.label}>
            <span className="threat-legend-dot" style={{ background: seg.color }} />
            <span className="threat-legend-text">{seg.label}</span>
            <span className="threat-legend-count">{seg.count}</span>
            <span className="threat-legend-pct">{seg.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ThreatDistribution
