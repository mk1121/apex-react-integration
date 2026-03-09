import { useState, useCallback, useRef, useEffect } from 'react'
import './OrgChart.css'

const EMP_API = 'https://ntsapps.informatixsystems.com:8443/ords/hrdev_ws/emp-designations'
const EMP_INFO_BASE = 'https://ntsapps.informatixsystems.com:8443/ords/r/hrdev_ws/hrms/employee-info222'

const DEFAULT_AVATAR = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none"><rect width="80" height="80" rx="40" fill="#e0e7ff"/><circle cx="40" cy="30" r="14" fill="#6366f1"/><ellipse cx="40" cy="68" rx="24" ry="18" fill="#6366f1"/></svg>'
)}`

// Get Oracle APEX session from global or URL
function getApexSession() {
  // Try APEX JS API
  if (typeof apex !== 'undefined' && apex?.env?.APP_SESSION) {
    return apex.env.APP_SESSION
  }
  // Try window-level variable
  if (typeof window !== 'undefined' && window.apex?.env?.APP_SESSION) {
    return window.apex.env.APP_SESSION
  }
  // Fallback: parse from current URL (?session= or &session=)
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('session')) return params.get('session')
    // APEX URL format: f?p=APP:PAGE:SESSION
    const match = window.location.href.match(/f\?p=\d+:\d+:([\d]+)/)
    if (match) return match[1]
  } catch (e) { /* ignore */ }
  return ''
}

// Build employee info redirect URL
function getEmpInfoUrl(emp) {
  const session = getApexSession()
  const params = new URLSearchParams({
    p6_emp_code: emp.emp_code,
    p6_company_code: emp.company_code || '0001',
  })
  if (session) params.set('session', session)
  return `${EMP_INFO_BASE}?${params.toString()}`
}

async function fetchPage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function getEmpImage(emp) {
  if (emp.emp_image) {
    if (emp.emp_image.startsWith('http') || emp.emp_image.startsWith('//')) {
      return emp.emp_image
    }
    return `data:image/jpeg;base64,${emp.emp_image}`
  }
  return DEFAULT_AVATAR
}

// Level colors palette
const LEVEL_COLORS = [
  { bg: '#4f46e5', light: '#eef2ff', border: '#6366f1', text: '#fff' },
  { bg: '#7c3aed', light: '#f5f3ff', border: '#8b5cf6', text: '#fff' },
  { bg: '#2563eb', light: '#eff6ff', border: '#3b82f6', text: '#fff' },
  { bg: '#0891b2', light: '#ecfeff', border: '#06b6d4', text: '#fff' },
  { bg: '#059669', light: '#ecfdf5', border: '#10b981', text: '#fff' },
  { bg: '#d97706', light: '#fffbeb', border: '#f59e0b', text: '#fff' },
  { bg: '#dc2626', light: '#fef2f2', border: '#ef4444', text: '#fff' },
  { bg: '#db2777', light: '#fdf2f8', border: '#ec4899', text: '#fff' },
]

function getColor(index) {
  return LEVEL_COLORS[index % LEVEL_COLORS.length]
}

// Designation card in the graph
function DesigCard({ desig, color, isSelected, onClick }) {
  return (
    <div
      className={`org-desig-card ${isSelected ? 'selected' : ''}`}
      style={{
        '--card-bg': color.bg,
        '--card-light': color.light,
        '--card-border': color.border,
      }}
      onClick={() => onClick(desig)}
    >
      <div className="org-desig-name">{desig.desig_name}</div>
      <div className="org-desig-count">{desig.emp_count} employees</div>
    </div>
  )
}

// Employee detail panel
function EmployeePanel({ desig, onClose }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [nextUrl, setNextUrl] = useState(null)
  const panelRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchPage(
          `${EMP_API}?desig_code=${encodeURIComponent(desig.desig_code)}`
        )
        if (!cancelled) {
          setEmployees(data.items || [])
          const next = data.links?.find((l) => l.rel === 'next')
          setHasMore(!!next)
          setNextUrl(next ? next.href : null)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [desig.desig_code])

  // Scroll panel into view when it appears
  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [])

  const handleLoadMore = useCallback(async () => {
    if (!nextUrl) return
    setLoading(true)
    try {
      const data = await fetchPage(nextUrl)
      setEmployees((prev) => [...prev, ...(data.items || [])])
      const next = data.links?.find((l) => l.rel === 'next')
      setHasMore(!!next)
      setNextUrl(next ? next.href : null)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [nextUrl])

  return (
    <div className="emp-panel" ref={panelRef}>
      <div className="emp-panel-header">
        <div className="emp-panel-title">
          <span className="emp-panel-icon">👥</span>
          <div>
            <h3>{desig.desig_name}</h3>
            <p>{desig.emp_count} employees</p>
          </div>
        </div>
        <button className="emp-panel-close" onClick={onClose}>✕</button>
      </div>

      <div className="emp-panel-body">
        {loading && employees.length === 0 && (
          <div className="emp-panel-status">
            <span className="spinner" />
            Loading employees...
          </div>
        )}
        {error && <div className="emp-panel-status error">⚠ {error}</div>}

        <div className="emp-grid">
          {employees.map((emp) => (
            <a
              key={emp.emp_code}
              className="emp-card emp-card-link"
              href={getEmpInfoUrl(emp)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img className="emp-card-avatar" src={getEmpImage(emp)} alt="" />
              <div className="emp-card-info">
                <div className="emp-card-name">{emp.emp_name}</div>
                <div className="emp-card-id">ID: {emp.emp_code}</div>
                {emp.company_name && (
                  <div className="emp-card-detail">🏢 {emp.company_name}</div>
                )}
                {emp.assign_unit && (
                  <div className="emp-card-detail">📍 {emp.assign_unit}</div>
                )}
              </div>
              <span className="emp-card-arrow">›</span>
            </a>
          ))}
        </div>

        {hasMore && (
          <button
            className="emp-panel-loadmore"
            onClick={handleLoadMore}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        )}
      </div>
    </div>
  )
}

// Main OrgChart component
export default function OrgChart({ tree, sortedLevels }) {
  const [selectedDesig, setSelectedDesig] = useState(null)

  const handleDesigClick = useCallback((desig) => {
    setSelectedDesig((prev) =>
      prev && prev.desig_code === desig.desig_code ? null : desig
    )
  }, [])

  return (
    <div className="org-chart-wrapper">
      {/* Hierarchy Graph */}
      <div className="org-chart-graph">
        <div className="org-chart-title">
          <span>🏛️</span> Organization Structure — Top to Bottom
        </div>

        <div className="org-levels-container">
          {sortedLevels.map((level, idx) => {
            const designations = tree[level]
            const color = getColor(idx)

            return (
              <div key={level} className="org-level-section">
                {/* Connector line from previous level */}
                {idx > 0 && (
                  <div className="org-connector">
                    <div className="org-connector-line" />
                    <div className="org-connector-arrow">▼</div>
                  </div>
                )}

                {/* Level header */}
                <div
                  className="org-level-header"
                  style={{ background: color.bg }}
                >
                  <span className="org-level-badge">Level {level}</span>
                  <span className="org-level-info">
                    {designations.length} designations • {designations.reduce((s, d) => s + d.emp_count, 0)} employees
                  </span>
                </div>

                {/* Designation cards */}
                <div className="org-desig-row">
                  {designations.map((desig) => (
                    <DesigCard
                      key={desig.desig_code}
                      desig={desig}
                      color={color}
                      isSelected={selectedDesig?.desig_code === desig.desig_code}
                      onClick={handleDesigClick}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Employee Details Panel */}
      {selectedDesig && (
        <EmployeePanel
          key={selectedDesig.desig_code}
          desig={selectedDesig}
          onClose={() => setSelectedDesig(null)}
        />
      )}
    </div>
  )
}
