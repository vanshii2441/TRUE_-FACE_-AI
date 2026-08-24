import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-area">
        <Navbar onMenuClick={() => setSidebarOpen((prev) => !prev)} />

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
