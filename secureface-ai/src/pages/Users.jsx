const dummyUsers = [
  {
    userId: 'USR001',
    name: 'Aarav Sharma',
    status: 'active',
    registeredAt: '2026-08-20T10:30:00',
  },
  {
    userId: 'USR002',
    name: 'Priya Patel',
    status: 'active',
    registeredAt: '2026-08-21T14:15:00',
  },
  {
    userId: 'USR003',
    name: 'Rahul Verma',
    status: 'active',
    registeredAt: '2026-08-22T09:45:00',
  },
  {
    userId: 'USR004',
    name: 'Ananya Gupta',
    status: 'pending',
    registeredAt: '2026-08-23T16:20:00',
  },
  {
    userId: 'USR005',
    name: 'Vikram Singh',
    status: 'active',
    registeredAt: '2026-08-24T08:00:00',
  },
]

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function Users() {
  const activeCount = dummyUsers.filter((u) => u.status === 'active').length
  const pendingCount = dummyUsers.filter((u) => u.status === 'pending').length

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Registered Users</h1>
        <p>
          View all enrolled identities in the True Face AI system. User data will be
          fetched from the backend API in Step 2.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid-3 mb-24">
        <div className="stat-card animate-in animate-delay-1">
          <div className="card-icon primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-label">Total Users</div>
            <div className="stat-value">{dummyUsers.length}</div>
          </div>
        </div>

        <div className="stat-card animate-in animate-delay-2">
          <div className="card-icon success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-label">Active</div>
            <div className="stat-value">{activeCount}</div>
          </div>
        </div>

        <div className="stat-card animate-in animate-delay-3">
          <div className="card-icon warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-label">Pending</div>
            <div className="stat-value">{pendingCount}</div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="section-title">Identity Database</div>
      <div className="table-container animate-in animate-delay-2" id="users-table">
        <table className="table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Name</th>
              <th>Status</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {dummyUsers.map((user) => (
              <tr key={user.userId}>
                <td>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                    {user.userId}
                  </span>
                </td>
                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {user.name}
                </td>
                <td>
                  <span className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                    <span className={`status-dot ${user.status === 'active' ? 'online' : 'pending'}`}
                      style={{ width: '6px', height: '6px' }}
                    />
                    {user.status === 'active' ? 'Active' : 'Pending'}
                  </span>
                </td>
                <td>{formatDate(user.registeredAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted mt-16" style={{ textAlign: 'center' }}>
        Showing dummy data. Live data from the backend API will be available in Step 2.
      </p>
    </div>
  )
}

export default Users
