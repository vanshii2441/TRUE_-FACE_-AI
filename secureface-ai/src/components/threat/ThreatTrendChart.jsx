function ThreatTrendChart({ data, activeRange, onRangeChange }) {
  const ranges = [
    { key: 'today', label: 'Today (4h Blocks)' },
    { key: 'week', label: 'Past 7 Days' },
    { key: 'month', label: 'Past 4 Weeks' },
  ]

  const items = data || []
  const maxValue = Math.max(0, ...items.map((d) => d.value || 0))
  const displayMax = maxValue > 0 ? Math.ceil(maxValue * 1.15) : 5
  const totalPeriodEvents = items.reduce((sum, d) => sum + (d.value || 0), 0)

  return (
    <div className="card threat-trend-card" id="threat-trend">
      <div className="threat-trend-header">
        <div>
          <h3 className="threat-section-title" style={{ margin: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Incident Frequency & Attack Activity
          </h3>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
            {totalPeriodEvents} total incidents recorded in selected period
          </span>
        </div>
        <div className="threat-range-group">
          {ranges.map((r) => (
            <button
              key={r.key}
              type="button"
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
          <span>{displayMax}</span>
          <span>{Math.round(displayMax * 0.75)}</span>
          <span>{Math.round(displayMax * 0.5)}</span>
          <span>{Math.round(displayMax * 0.25)}</span>
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
            {items.map((d, i) => {
              const height = displayMax > 0 ? (d.value / displayMax) * 100 : 0
              const isZero = d.value === 0

              return (
                <div className="threat-bar-group" key={d.label}>
                  <div className="threat-bar-wrapper">
                    <div
                      className={`threat-bar ${isZero ? 'zero-val' : ''}`}
                      style={{
                        height: `${Math.max(isZero ? 4 : 8, height)}%`,
                        animationDelay: `${i * 0.05}s`,
                        opacity: isZero ? 0.35 : 1,
                      }}
                      title={`${d.label}: ${d.value} incidents`}
                    >
                      <span className="threat-bar-value">{d.value}</span>
                    </div>
                  </div>
                  <span className="threat-bar-label" title={d.label}>
                    {d.label}
                  </span>
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
