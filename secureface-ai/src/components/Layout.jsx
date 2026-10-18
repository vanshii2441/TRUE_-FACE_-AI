import { useEffect, useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { checkBackendHealth } from '../services/api'

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [backendStatus, setBackendStatus] = useState({
    checked: false,
    online: false,
    enrolled_faces: 0,
    version: null,
    service: null,
  })

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === 'light' ? 'dark' : 'light'
    )
  }

  const verifyBackend = useCallback(async () => {
    const res = await checkBackendHealth()
    setBackendStatus({
      checked: true,
      online: Boolean(res.online),
      enrolled_faces: res.enrolled_faces || 0,
      version: res.version || null,
      service: res.service || null,
      error: res.error || null,
    })
  }, [])

  useEffect(() => {
    verifyBackend()
    const timer = setInterval(verifyBackend, 30000)
    return () => clearInterval(timer)
  }, [verifyBackend])

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        backendStatus={backendStatus}
      />

      <div className="main-area">
        <Navbar
          onMenuClick={() => setSidebarOpen((prev) => !prev)}
          theme={theme}
          onThemeToggle={toggleTheme}
          backendStatus={backendStatus}
          onRefreshBackend={verifyBackend}
        />

        <main className="page-content" id="main-content">
          <Outlet context={{ backendStatus, onRefreshBackend: verifyBackend }} />
        </main>
      </div>
    </div>
  )
}

export default Layout