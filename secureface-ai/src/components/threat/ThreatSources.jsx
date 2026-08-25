function ThreatSources({ sources }) {
  return (
    <div className="card threat-sources-card" id="threat-sources">
      <h3 className="threat-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        Top Threat Sources
      </h3>

      <div className="threat-source-list">
        {sources.map((source, i) => {
          const percentage = (source.count / source.max) * 100
          return (
            <div className="threat-source-item" key={source.name} id={`source-${i}`}>
              <div className="threat-source-top">
                <span className="threat-source-name">{source.name}</span>
                <span className="threat-source-count">{source.count} Threats</span>
              </div>
              <div className="threat-source-track">
                <div
                  className="threat-source-fill"
                  style={{
                    width: `${percentage}%`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ThreatSources
