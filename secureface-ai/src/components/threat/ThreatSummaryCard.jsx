function ThreatSummaryCard({ icon, label, value, delta, colorClass }) {
  return (
    <div className={`threat-summary-card ${colorClass}`} id={`summary-${colorClass}`}>
      <div className="threat-summary-icon">{icon}</div>
      <div className="threat-summary-info">
        <span className="threat-summary-label">{label}</span>
        <span className="threat-summary-value">{value}</span>
        <span className="threat-summary-delta">{delta}</span>
      </div>
    </div>
  )
}

export default ThreatSummaryCard
