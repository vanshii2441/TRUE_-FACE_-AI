import { useState } from 'react'
import ThreatSummaryCard from '../components/threat/ThreatSummaryCard'
import ThreatTable from '../components/threat/ThreatTable'
import ThreatDetails from '../components/threat/ThreatDetails'
import ThreatDistribution from '../components/threat/ThreatDistribution'
import ThreatTrendChart from '../components/threat/ThreatTrendChart'
import SecurityAlert from '../components/threat/SecurityAlert'
import ThreatSources from '../components/threat/ThreatSources'
import {
  threats,
  threatSummary,
  alerts,
  threatSources,
  trendData,
  distributionData,
} from '../data/threatData'

function ThreatMonitor() {
  const [selectedThreat, setSelectedThreat] = useState(null)
  const [activeFilter, setActiveFilter] = useState('All')
  const [trendRange, setTrendRange] = useState('today')
  const [showExportToast, setShowExportToast] = useState(false)

  const handleExport = () => {
    setShowExportToast(true)
    setTimeout(() => setShowExportToast(false), 3000)
  }

  const handleAlertView = (alert) => {
    // Find the matching threat by time + source
    const match = threats.find(
      (t) => t.time === alert.time && t.source === alert.source
    )
    if (match) setSelectedThreat(match)
  }

  return (
    <div className="animate-in threat-monitor-page">
      {/* Page Header */}
      <div className="threat-page-header">
        <div className="threat-header-left">
          <h1>
            <span className="gradient-text">Threat Monitor</span>
          </h1>
          <p>Monitor and analyze biometric security threats in real time.</p>
        </div>
        <div className="threat-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() =>
              setActiveFilter((prev) => {
                const cycle = ['All', 'High', 'Medium', 'Low']
                const idx = cycle.indexOf(prev)
                return cycle[(idx + 1) % cycle.length]
              })
            }
            id="header-filter-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filter
          </button>
          <button className="btn btn-secondary btn-sm" id="header-date-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Today
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleExport} id="header-export-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="threat-summary-grid mb-24">
        <ThreatSummaryCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
          label="High Risk"
          value={threatSummary.high.count}
          delta={threatSummary.high.delta}
          colorClass="danger"
        />
        <ThreatSummaryCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
          label="Medium Risk"
          value={threatSummary.medium.count}
          delta={threatSummary.medium.delta}
          colorClass="warning"
        />
        <ThreatSummaryCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
          label="Low Risk"
          value={threatSummary.low.count}
          delta={threatSummary.low.delta}
          colorClass="success"
        />
        <ThreatSummaryCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
          label="Total Threats"
          value={threatSummary.total.count}
          delta={threatSummary.total.delta}
          colorClass="info"
        />
      </div>

      {/* Threat Table */}
      <div className="mb-24">
        <ThreatTable
          threats={threats}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onSelectThreat={setSelectedThreat}
          selectedThreatId={selectedThreat?.id}
        />
      </div>

      {/* Charts Row */}
      {/* Analytics Section */}
<div className="threat-analytics-heading">
  <div>
    <h2>Security Analytics</h2>
    <p>Analyze threat patterns and security activity.</p>
  </div>
  <span>↓ Scroll for more</span>
</div>

{/* Charts Row */}
<div className="threat-charts-row mb-24">
        <ThreatDistribution data={distributionData} />
        <ThreatTrendChart
          data={trendData[trendRange]}
          activeRange={trendRange}
          onRangeChange={setTrendRange}
        />
      </div>

      {/* Alerts & Sources Row */}
      <div className="threat-bottom-row">
        <SecurityAlert alerts={alerts} onViewDetails={handleAlertView} />
        <ThreatSources sources={threatSources} />
      </div>

      {/* Threat Details Panel */}
      <ThreatDetails
        threat={selectedThreat}
        onClose={() => setSelectedThreat(null)}
      />

      {/* Export Toast */}
      {showExportToast && (
        <div className="threat-toast" id="export-toast">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Threat report exported successfully
        </div>
      )}
    </div>
  )
}

export default ThreatMonitor
