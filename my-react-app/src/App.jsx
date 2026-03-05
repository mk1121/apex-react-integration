import { useState, useEffect, useCallback } from 'react'
import './App.css'

// Endpoint 1: lightweight — returns hchy_level, desig_code, desig_name, emp_count
const DESIG_HIERARCHY_API = 'https://ntsapps.informatixsystems.com:8443/ords/hrdev_ws/designation-hierarchy'
// Endpoint 2: returns employees, supports ?desig_code= and ?q= filters
const EMP_API = 'https://ntsapps.informatixsystems.com:8443/ords/hrdev_ws/emp-designations'

// Fetch one page from ORDS
async function fetchPage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Fetch ALL pages (used only for small datasets like designation list)
async function fetchAllPages(url) {
  let allItems = []
  let currentUrl = url
  while (currentUrl) {
    const data = await fetchPage(currentUrl)
    allItems = allItems.concat(data.items || [])
    const next = data.links?.find((l) => l.rel === 'next')
    currentUrl = next ? next.href : null
  }
  return allItems
}

// Build hierarchy structure from designation-hierarchy API
// Input: [{ hchy_level, desig_code, desig_name, emp_count }, ...]
// Output: { level: [{ desig_code, desig_name, emp_count }, ...], ... }
function buildDesigTree(items) {
  const tree = {}
  items.forEach((item) => {
    const level = item.hchy_level
    if (!tree[level]) tree[level] = []
    tree[level].push({
      desig_code: item.desig_code,
      desig_name: item.desig_name,
      emp_count: item.emp_count,
    })
  })
  // Sort designations within each level
  Object.values(tree).forEach((desigs) =>
    desigs.sort((a, b) => a.desig_name.localeCompare(b.desig_name))
  )
  return tree
}

// Employee leaf node
function EmployeeNode({ emp }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <li className="tree-node">
      <div className="tree-label leaf" onClick={() => setExpanded(!expanded)}>
        <span className={`arrow ${expanded ? 'open' : ''}`}>▶</span>
        <span className="node-icon">👤</span>
        <span className="node-name">{emp.emp_name}</span>
      </div>
      {expanded && (
        <ul className="tree-details">
          <li className="detail-item">
            <span className="detail-key">Employee ID:</span>
            <span className="detail-value">{emp.emp_code}</span>
          </li>
          <li className="detail-item">
            <span className="detail-key">Company:</span>
            <span className="detail-value">{emp.company_name}</span>
          </li>
          <li className="detail-item">
            <span className="detail-key">Unit:</span>
            <span className="detail-value">{emp.assign_unit}</span>
          </li>
        </ul>
      )}
    </li>
  )
}

// Designation node — fetches employees on expand (lazy loading)
function DesigNode({ desig }) {
  const [expanded, setExpanded] = useState(false)
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [nextUrl, setNextUrl] = useState(null)

  const handleToggle = async () => {
    const willExpand = !expanded
    setExpanded(willExpand)

    // Fetch employees only on first expand
    if (willExpand && employees.length === 0) {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchPage(
          `${EMP_API}?desig_code=${encodeURIComponent(desig.desig_code)}`
        )
        setEmployees(data.items || [])
        const next = data.links?.find((l) => l.rel === 'next')
        setHasMore(!!next)
        setNextUrl(next ? next.href : null)
      } catch (err) {
        setError(err.message)
      }
      setLoading(false)
    }
  }

  const loadMore = async () => {
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
  }

  return (
    <li className="tree-node">
      <div className="tree-label" onClick={handleToggle}>
        <span className={`arrow ${expanded ? 'open' : ''}`}>▶</span>
        <span className="node-icon">📋</span>
        <span className="node-name">{desig.desig_name}</span>
        <span className="badge count">{desig.emp_count}</span>
      </div>
      {expanded && (
        <ul className="tree-children">
          {loading && employees.length === 0 && (
            <li className="status" style={{ textAlign: 'left', padding: '12px 16px' }}>
              <span className="spinner" />Loading employees...
            </li>
          )}
          {error && <li className="status error">⚠ {error}</li>}
          {employees.map((emp) => (
            <EmployeeNode key={emp.emp_code} emp={emp} />
          ))}
          {hasMore && (
            <li>
              <button type="button" className="load-more" onClick={(e) => { e.preventDefault(); e.stopPropagation(); loadMore() }} disabled={loading}>
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

// Level group — expands to show designations
function LevelGroup({ level, designations }) {
  const [expanded, setExpanded] = useState(false)
  const totalEmps = designations.reduce((sum, d) => sum + d.emp_count, 0)
  return (
    <li className="tree-node">
      <div className="tree-label level-label" onClick={() => setExpanded(!expanded)}>
        <span className={`arrow ${expanded ? 'open' : ''}`}>▶</span>
        <span className="node-icon">🏷️</span>
        <span className="node-name">Level {level}</span>
        <span className="badge">{designations.length} designations</span>
        <span className="badge count">{totalEmps} employees</span>
      </div>
      {expanded && (
        <ul className="tree-children">
          {designations.map((d) => (
            <DesigNode key={d.desig_code} desig={d} />
          ))}
        </ul>
      )}
    </li>
  )
}

function App() {
  const [tree, setTree] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [nextUrl, setNextUrl] = useState(null)
  const [totalLoaded, setTotalLoaded] = useState(0)
  const [activeTab, setActiveTab] = useState('hierarchy')

  // Load ALL designation structure (lightweight, no employee rows)
  useEffect(() => {
    async function loadData() {
      try {
        const items = await fetchAllPages(DESIG_HIERARCHY_API)
        setTree(buildDesigTree(items))
        setLoading(false)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Server-side search with debounce
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([])
      setHasMore(false)
      setNextUrl(null)
      setTotalLoaded(0)
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      setSearchError(null)
      try {
        const q = encodeURIComponent(search.trim())
        const data = await fetchPage(`${EMP_API}?search_term=${q}`)
        setSearchResults(data.items || [])
        setTotalLoaded(data.items?.length || 0)
        const next = data.links?.find((l) => l.rel === 'next')
        setHasMore(!!next)
        setNextUrl(next ? next.href : null)
      } catch (err) {
        setSearchError(err.message)
      }
      setSearching(false)
    }, 400)

    return () => clearTimeout(timer)
  }, [search])

  // Load more search results
  const loadMore = useCallback(async () => {
    if (!nextUrl) return
    setSearching(true)
    try {
      const data = await fetchPage(nextUrl)
      const newItems = data.items || []
      setSearchResults((prev) => [...prev, ...newItems])
      setTotalLoaded((prev) => prev + newItems.length)
      const next = data.links?.find((l) => l.rel === 'next')
      setHasMore(!!next)
      setNextUrl(next ? next.href : null)
    } catch (err) {
      setSearchError(err.message)
    }
    setSearching(false)
  }, [nextUrl])

  const sortedLevels = Object.keys(tree)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="app">
      <div className="app-header">
        <h1>🏢 Organization Hierarchy</h1>
        <p>Browse levels & designations or search employees</p>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === 'hierarchy' ? 'active' : ''}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveTab('hierarchy') }}
        >
          📋 Hierarchy
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveTab('search') }}
        >
          🔍 Search
        </button>
      </div>

      {loading && (
        <div className="status">
          <span className="spinner" />
          Loading hierarchy...
        </div>
      )}
      {error && <p className="status error">⚠ {error}</p>}

      {!loading && !error && activeTab === 'hierarchy' && (
        <div className="card">
          <ul className="tree">
            {sortedLevels.map((level) => (
              <LevelGroup
                key={level}
                level={level}
                designations={tree[level]}
              />
            ))}
          </ul>
        </div>
      )}

      {!loading && !error && activeTab === 'search' && (
        <>
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              type="text"
              placeholder="Search by name, ID, or designation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation() } }}
            />
          </div>

          {searching && searchResults.length === 0 && (
            <div className="status">
              <span className="spinner" />
              Searching...
            </div>
          )}
          {searchError && <p className="status error">⚠ {searchError}</p>}

          {search && searchResults.length > 0 && (
            <>
              <p className="result-count">{totalLoaded} results loaded</p>
              <div className="card">
                <ul className="tree">
                  {searchResults.map((emp, i) => (
                    <li key={`${emp.emp_code}-${i}`} className="tree-node">
                      <div className="search-result">
                        <span className="node-icon">👤</span>
                        <div className="result-info">
                          <span className="node-name">{emp.emp_name}</span>
                          <span className="result-meta">
                            {emp.emp_code} · {emp.desig_name} · Level {emp.hchy_level}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {hasMore && (
                  <button
                    type="button"
                    className="load-more"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); loadMore() }}
                    disabled={searching}
                  >
                    {searching ? (
                      <><span className="spinner" /> Loading...</>
                    ) : (
                      'Load More'
                    )}
                  </button>
                )}
              </div>
            </>
          )}

          {search && !searching && searchResults.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">🔎</span>
              <p>No employees found for "{search}"</p>
            </div>
          )}

          {!search && (
            <div className="empty-state">
              <span className="empty-icon">👆</span>
              <p>Type a name, ID, or designation to search</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default App
