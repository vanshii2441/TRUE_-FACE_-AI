import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Register from './pages/Register'
import Authenticate from './pages/Authenticate'
import Users from './pages/Users'
import ThreatMonitor from './pages/ThreatMonitor'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/authenticate" element={<Authenticate />} />
        <Route path="/users" element={<Users />} />
        <Route path="/threat-monitor" element={<ThreatMonitor />} />
      </Route>
    </Routes>
  )
}

export default App
