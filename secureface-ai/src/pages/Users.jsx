import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getUsers, resetUsers } from '../services/api'

function formatDate(isoString) {
  if (!isoString) return 'N/A'

  try {
    return new Date(isoString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

function Users() {
  const [users, setUsers] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resetting, setResetting] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getUsers()
      setUsers(data.users || [])
      setTotalCount(data.total_enrolled || 0)
    } catch (err) {
      setError(err.message || 'Failed to fetch enrolled users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleReset = async () => {
    if (
      !window.confirm(
        'Are you sure you want to reset the FAISS vector database? All enrolled face vectors will be deleted.'
      )
    ) {
      return
    }

    setResetting(true)

    try {
      await resetUsers()
      await fetchUsers()
    } catch (err) {
      alert('Failed to reset vector database: ' + err.message)
    } finally {
      setResetting(false)
    }
  }

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase().trim()

    const matchesSearch =
      !query ||
      String(user.name || '').toLowerCase().includes(query) ||
      String(user.user_id || '').toLowerCase().includes(query) ||
      String(user.faiss_id || '').toLowerCase().includes(query)

    const matchesStatus =
      statusFilter === 'All' || statusFilter === 'Active'

    return matchesSearch && matchesStatus
  })

  return (
    <div className="animate-in users-page">

      {/* Page Header */}
      <div className="page-header users-page-header">
        <div className="users-header-content">
          <div>
            <h1>
              <span className="gradient-text">Registered Users</span>
            </h1>

            <p>
              Manage all identities enrolled in the FAISS 1:N vector database.
              Search, view identity records, or reset the enrolled vector index.
            </p>
          </div>

          <div className="users-header-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={fetchUsers}
              disabled={loading}
              id="refresh-users-btn"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
              </svg>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>

            <Link
              to="/register"
              className="btn btn-primary btn-sm"
              id="register-user-btn"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="7" r="4" />
                <path d="M17 11v6" />
                <path d="M14 14h6" />
                <path d="M3 21v-2a4 4 0 0 1 4-4h4" />
              </svg>
              Register User
            </Link>

            <button
              className="btn btn-danger btn-sm"
              onClick={handleReset}
              disabled={resetting || users.length === 0}
              id="reset-vector-db-btn"
            >
              {resetting ? 'Resetting...' : 'Reset Vector DB'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid-3 mb-24">

        {/* Total Users */}
        <div className="stat-card animate-in animate-delay-1">
          <div className="card-icon primary">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3.87-4" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>

          <div className="stat-info">
            <div className="stat-label">Registered Identities</div>
            <div className="stat-value">{totalCount}</div>
          </div>
        </div>

        {/* Embedding Index */}
        <div className="stat-card animate-in animate-delay-2">
          <div className="card-icon success">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20" />
              <path d="M2 12h20" />
              <path d="M4.93 4.93l14.14 14.14" />
              <path d="M19.07 4.93L4.93 19.07" />
            </svg>
          </div>

          <div className="stat-info">
            <div className="stat-label">Embedding Index</div>
            <div className="stat-value">512-D</div>
          </div>
        </div>

        {/* Anti Spoofing */}
        <div className="stat-card animate-in animate-delay-3">
          <div className="card-icon warning">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>

          <div className="stat-info">
            <div className="stat-label">Anti-Spoofing</div>
            <div className="stat-value users-active-value">
              Active
            </div>
          </div>
        </div>
      </div>

      {/* Identity Database Section */}
      <section className="users-database-section">

        <div className="users-section-header">
          <div>
            <div className="section-title">
              Identity Database
            </div>

            <p className="users-section-subtitle">
              Enrolled biometric identities available for 1:N facial matching.
            </p>
          </div>

          {!loading && !error && (
            <div className="users-record-count">
              <span className="status-dot online" />
              Showing {filteredUsers.length} of {users.length} records
            </div>
          )}
        </div>

        {/* Search & Filter */}
        {!loading && !error && users.length > 0 && (
          <div className="users-controls card">

            <div className="users-search-box">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, User ID, or FAISS ID..."
                aria-label="Search registered users"
                id="users-search"
              />

              {searchQuery && (
                <button
                  type="button"
                  className="users-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="users-filter-box">
              <label htmlFor="users-status-filter">
                Status
              </label>

              <select
                id="users-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Users</option>
                <option value="Active">Active</option>
              </select>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="card users-state-card">
            <div className="users-state-icon loading">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="m4.93 4.93 2.83 2.83" />
                <path d="m16.24 16.24 2.83 2.83" />
                <path d="M2 12h4" />
                <path d="M18 12h4" />
              </svg>
            </div>

            <h3>Loading Identity Database</h3>

            <p>
              Fetching enrolled user records from the FastAPI backend...
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="card users-state-card users-error-card">
            <div className="users-state-icon error">
              ⚠️
            </div>

            <h3>Unable to Load Users</h3>

            <p>{error}</p>

            <button
              className="btn btn-secondary btn-sm"
              onClick={fetchUsers}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty Database */}
        {!loading && !error && users.length === 0 && (
          <div className="card users-empty-state">

            <div className="users-empty-visual">
              <div className="users-empty-ring ring-one" />
              <div className="users-empty-ring ring-two" />

              <div className="users-empty-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="7" r="4" />
                  <path d="M3 21v-2a4 4 0 0 1 4-4h4" />
                  <path d="M17 11v6" />
                  <path d="M14 14h6" />
                </svg>
              </div>
            </div>

            <div className="users-empty-content">
              <span className="badge badge-neutral">
                No Identities Enrolled
              </span>

              <h3>Your identity database is empty</h3>

              <p>
                Register a user's face to generate a biometric embedding
                and add the identity to the FAISS 1:N recognition index.
              </p>

              <Link
                to="/register"
                className="btn btn-primary"
                id="empty-register-user-btn"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="7" r="4" />
                  <path d="M17 11v6" />
                  <path d="M14 14h6" />
                  <path d="M3 21v-2a4 4 0 0 1 4-4h4" />
                </svg>
                Register First User
              </Link>
            </div>
          </div>
        )}

        {/* No Search Results */}
        {!loading &&
          !error &&
          users.length > 0 &&
          filteredUsers.length === 0 && (
            <div className="card users-state-card">
              <div className="users-state-icon">
                🔎
              </div>

              <h3>No Matching Users</h3>

              <p>
                No registered identity matches your current search or filter.
              </p>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('All')
                }}
              >
                Clear Filters
              </button>
            </div>
          )}

        {/* Users Table */}
        {!loading &&
          !error &&
          filteredUsers.length > 0 && (
            <div
              className="table-container animate-in animate-delay-2"
              id="users-table"
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>FAISS ID</th>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Enrolled Timestamp</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
  key={user.faiss_id || user.user_id}
  className="users-table-row"
  title={`View details for ${user.name}`}
  onClick={() => setSelectedUser(user)}
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelectedUser(user)
    }
  }}
>
<td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            color: 'var(--text-muted)',
                          }}
                        >
                          #{user.faiss_id}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: 'var(--primary)',
                          }}
                        >
                          {user.user_id}
                        </span>
                      </td>

                      <td
                        style={{
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                        }}
                      >
                        {user.name}
                      </td>

                      <td>
                        <span className="badge badge-success">
                          <span
                            className="status-dot online"
                            style={{
                              width: '6px',
                              height: '6px',
                            }}
                          />
                          Enrolled & Active
                        </span>
                      </td>

                      <td>
                        {formatDate(user.enrolled_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
        {!loading &&
          !error &&
          filteredUsers.length > 0 && (
            <div
              className="table-container animate-in animate-delay-2"
              id="users-table"
            >
              <table className="table">
                ...
              </table>
            </div>
          )}
                {/* Selected User Details */}
      {selectedUser && (
        <div className="user-details-overlay">
          <div className="user-details-panel">

            <div className="user-details-header">
              <div>
                <span className="badge badge-success">
                  <span className="status-dot online" />
                  Active Identity
                </span>

                <h2>{selectedUser.name}</h2>

                <p>
                  Registered biometric identity details
                </p>
              </div>

              <button
                type="button"
                className="users-search-clear"
                onClick={() => setSelectedUser(null)}
                aria-label="Close user details"
              >
                ×
              </button>
            </div>

            <div className="user-details-grid">

              <div className="user-detail-item">
                <span className="user-detail-label">User ID</span>
                <strong>{selectedUser.user_id || 'N/A'}</strong>
              </div>

              <div className="user-detail-item">
                <span className="user-detail-label">FAISS ID</span>
                <strong>
                  #{selectedUser.faiss_id ?? 'N/A'}
                </strong>
              </div>

              <div className="user-detail-item">
                <span className="user-detail-label">Enrollment Status</span>
                <strong className="user-detail-success">
                  Enrolled & Active
                </strong>
              </div>

              <div className="user-detail-item">
                <span className="user-detail-label">Embedding</span>
                <strong>512-D Vector</strong>
              </div>

              <div className="user-detail-item">
                <span className="user-detail-label">
                  Anti-Spoofing
                </span>
                <strong className="user-detail-success">
                  Protected
                </strong>
              </div>

              <div className="user-detail-item">
                <span className="user-detail-label">
                  Enrolled On
                </span>
                <strong>
                  {formatDate(selectedUser.enrolled_at)}
                </strong>
              </div>

            </div>

            <div className="user-details-footer">
              <span>
                Identity available for 1:N facial recognition.
              </span>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedUser(null)}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default Users