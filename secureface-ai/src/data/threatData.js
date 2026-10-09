/* ================================================================
   TRUE FACE AI — Threat Data Configuration & Empty State Defaults
   All mock/fake data removed. Production runtime uses real backend API endpoints.
   ================================================================ */

export const threats = []
export const threatSummary = {
  high: { count: 0, delta: '0 today' },
  medium: { count: 0, delta: '0 today' },
  low: { count: 0, delta: '0 today' },
  total: { count: 0, delta: '0 today' },
}
export const alerts = []
export const threatSources = []
export const trendData = {
  today: [],
  week: [],
  month: [],
}
export const distributionData = [
  { label: 'High Risk', count: 0, color: '#dc2626', bgColor: 'rgba(220,38,38,0.08)' },
  { label: 'Medium Risk', count: 0, color: '#ea580c', bgColor: 'rgba(234,88,12,0.08)' },
  { label: 'Low Risk', count: 0, color: '#16a34a', bgColor: 'rgba(22,163,74,0.08)' },
]
