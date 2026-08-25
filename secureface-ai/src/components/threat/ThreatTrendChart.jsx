function ThreatTrendChart({ data, activeRange, onRangeChange }) {
  const ranges = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Last 7 Days' },
    { key: 'month', label: 'Last 30 Days' },
  ]

  const maxValue = Math.max(...data.map((d) => d.value))

  return (
    <div className="card threat-trend-card" id="threat-trend">
      <div className="threat-trend-header">
        <h3 className="threat-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Threat Activity Over Time
        </h3>
        <div className="threat-range-group">
          {ranges.map((r) => (
            <button
              key={r.key}
              className={`threat-range-btn ${activeRange === r.key ? 'active' : ''}`}
              onClick={() => onRangeChange(r.key)}
              id={`range-${r.key}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="threat-chart-area">
        {/* Y-axis labels */}
        <div className="threat-chart-yaxis">
          <span>{maxValue}</span>
          <span>{Math.round(maxValue * 0.75)}</span>
          <span>{Math.round(maxValue * 0.5)}</span>
          <span>{Math.round(maxValue * 0.25)}</span>
          <span>0</span>
        </div>

        {/* Chart grid + bars */}
        <div className="threat-chart-grid">
          {/* Horizontal grid lines */}
          <div className="threat-grid-line" style={{ bottom: '100%' }} />
          <div className="threat-grid-line" style={{ bottom: '75%' }} />
          <div className="threat-grid-line" style={{ bottom: '50%' }} />
          <div className="threat-grid-line" style={{ bottom: '25%' }} />
          <div className="threat-grid-line" style={{ bottom: '0%' }} />

          {/* Bars */}
          <div className="threat-bars">
            {data.map((d, i) => {
              const height = maxValue > 0 ? (d.value / maxValue) * 100 : 0
              return (
                <div className="threat-bar-group" key={d.label}>
                  <div className="threat-bar-wrapper">
                    <div
                      className="threat-bar"
                      style={{
                        height: `${height}%`,
                        animationDelay: `${i * 0.06}s`,
                      }}
                    >
                      <span className="threat-bar-value">{d.value}</span>
                    </div>
                  </div>
                  <span className="threat-bar-label">{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ThreatTrendChart
