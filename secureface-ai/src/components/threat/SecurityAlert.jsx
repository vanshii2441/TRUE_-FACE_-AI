const riskClasses = {
  High: 'danger',
  Medium: 'warning',
  Low: 'success',
}

function SecurityAlert({ alerts, onViewDetails }) {
  return (
    <div className="card threat-alerts-card" id="security-alerts">
      <h3 className="threat-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Recent Security Alerts
      </h3>

      <div className="threat-alert-list">
        {alerts.map((alert) => (
          <div className={`threat-alert-item ${riskClasses[alert.riskLevel]}`} key={alert.id} id={`alert-${alert.id}`}>
            <div className="threat-alert-top">
              <span className={`badge badge-${riskClasses[alert.riskLevel]}`}>
                {alert.riskLevel === 'High' ? '🚨' : alert.riskLevel === 'Medium' ? '⚠️' : 'ℹ️'}{' '}
                {alert.riskLevel.toUpperCase()} RISK
              </span>
            </div>
            <h4 className="threat-alert-title">{alert.title}</h4>
            <div className="threat-alert-meta">
              <span>{alert.source}</span>
              <span className="threat-alert-dot">•</span>
              <span>{alert.time}</span>
            </div>
            {onViewDetails && (
              <button
                className="threat-alert-link"
                onClick={() => onViewDetails(alert)}
              >
                View Details →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default SecurityAlert
