import { useState, useEffect, useCallback } from 'react'
import './App.css'
import OrgChart from './components/OrgChart'

// Endpoint 1: lightweight — returns hchy_level, desig_code, desig_name, emp_count
const DESIG_HIERARCHY_API = 'https://ntsapps.informatixsystems.com:8443/ords/hrdev_ws/designation-hierarchy'
// Endpoint 2: returns employees, supports ?desig_code= and ?search_term= filters
const EMP_API = 'https://ntsapps.informatixsystems.com:8443/ords/hrdev_ws/emp-designations'

// Default avatar SVG as data URI
const DEFAULT_AVATAR = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none"><rect width="80" height="80" rx="40" fill="#e0e7ff"/><circle cx="40" cy="30" r="14" fill="#6366f1"/><ellipse cx="40" cy="68" rx="24" ry="18" fill="#6366f1"/></svg>'
)}`

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
  Object.values(tree).forEach((desigs) =>
    desigs.sort((a, b) => a.desig_name.localeCompare(b.desig_name))
  )
  return tree
}

// Get employee image URL or default avatar
function getEmpImage(emp) {
  if (emp.emp_image) {
    if (emp.emp_image.startsWith('http') || emp.emp_image.startsWith('//')) {
      return emp.emp_image
    }
    return `data:image/jpeg;base64,${emp.emp_image}`
  }
  return DEFAULT_AVATAR
}

// Employee leaf node
function EmployeeNode({ emp }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <li className="tree-node">
      <div className="tree-label leaf" onClick={() => setExpanded(!expanded)}>
        <span className={`arrow ${expanded ? 'open' : ''}`}>&#9654;</span>
        <img className="emp-avatar" src={getEmpImage(emp)} alt="" />
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

  const handleLoadMore = async (e) => {
    e.preventDefault()
    e.stopPropagation()
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
        <span className={`arrow ${expanded ? 'open' : ''}`}>&#9654;</span>
        <span className="node-icon">&#128203;</span>
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
          {error && <li className="status error">&#9888; {error}</li>}
          {employees.map((emp) => (
            <EmployeeNode key={emp.emp_code} emp={emp} />
          ))}
          {hasMore && (
            <li>
              <button type="button" className="load-more" onClick={handleLoadMore} disabled={loading}>
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

// Level group — open by default
function LevelGroup({ level, designations }) {
  const [expanded, setExpanded] = useState(true)
  const totalEmps = designations.reduce((sum, d) => sum + d.emp_count, 0)
  return (
    <li className="tree-node">
      <div className="tree-label level-label" onClick={() => setExpanded(!expanded)}>
        <span className={`arrow ${expanded ? 'open' : ''}`}>&#9654;</span>
        <span className="node-icon">&#127991;&#65039;</span>
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

// Build tree from search results: group by level → designation
function buildSearchTree(employees) {
  const tree = {}
  employees.forEach((emp) => {
    const level = emp.hchy_level
    if (!tree[level]) tree[level] = {}
    const dc = emp.desig_code
    if (!tree[level][dc]) {
      tree[level][dc] = { desig_code: dc, desig_name: emp.desig_name, employees: [] }
    }
    tree[level][dc].employees.push(emp)
  })
  return tree
}

// Search result: designation node (employees already loaded)
function SearchDesigNode({ desig }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <li className="tree-node">
      <div className="tree-label" onClick={() => setExpanded(!expanded)}>
        <span className={`arrow ${expanded ? 'open' : ''}`}>&#9654;</span>
        <span className="node-icon">&#128203;</span>
        <span className="node-name">{desig.desig_name}</span>
        <span className="badge count">{desig.employees.length}</span>
      </div>
      {expanded && (
        <ul className="tree-children">
          {desig.employees.map((emp) => (
            <EmployeeNode key={emp.emp_code} emp={emp} />
          ))}
        </ul>
      )}
    </li>
  )
}

// Search result: level group
function SearchLevelGroup({ level, designations }) {
  const [expanded, setExpanded] = useState(true)
  const totalEmps = designations.reduce((sum, d) => sum + d.employees.length, 0)
  return (
    <li className="tree-node">
      <div className="tree-label level-label" onClick={() => setExpanded(!expanded)}>
        <span className={`arrow ${expanded ? 'open' : ''}`}>&#9654;</span>
        <span className="node-icon">&#127991;&#65039;</span>
        <span className="node-name">Level {level}</span>
        <span className="badge">{designations.length} designations</span>
        <span className="badge count">{totalEmps} employees</span>
      </div>
      {expanded && (
        <ul className="tree-children">
          {designations.map((d) => (
            <SearchDesigNode key={d.desig_code} desig={d} />
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
  const [viewMode, setViewMode] = useState('tree') // 'tree' | 'chart'
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [nextUrl, setNextUrl] = useState(null)
  const [totalLoaded, setTotalLoaded] = useState(0)

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
  const loadMoreSearch = useCallback(async (e) => {
    e.preventDefault()
    e.stopPropagation()
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

  const isSearching = search.trim().length > 0

  // Calculate stats
  const totalDesigs = sortedLevels.reduce((sum, l) => sum + (tree[l]?.length || 0), 0)
  const totalEmps = sortedLevels.reduce(
    (sum, l) => sum + (tree[l]?.reduce((s, d) => s + d.emp_count, 0) || 0), 0
  )

  return (
    <div className="app">
      <div className="app-topbar">
        <div className="app-header">
          <div>
            <h1>Organization Hierarchy</h1>
            <p>Browse levels &amp; designations or search employees</p>
          </div>
          {!loading && !error && (
            <div className="header-stats">
              <div className="stat-chip">
                <span className="stat-val">{sortedLevels.length}</span>
                <span className="stat-lbl">Levels</span>
              </div>
              <div className="stat-chip">
                <span className="stat-val">{totalDesigs}</span>
                <span className="stat-lbl">Designations</span>
              </div>
              <div className="stat-chip">
                <span className="stat-val">{totalEmps}</span>
                <span className="stat-lbl">Employees</span>
              </div>
            </div>
          )}
        </div>

        {/* View Toggle Tabs */}
        {!loading && !error && (
          <div className="view-tabs">
            <button
              className={`view-tab ${viewMode === 'tree' ? 'active' : ''}`}
              onClick={() => setViewMode('tree')}
            >
              <span className="view-tab-icon">🌳</span>
              Tree View
            </button>
            <button
              className={`view-tab ${viewMode === 'chart' ? 'active' : ''}`}
              onClick={() => setViewMode('chart')}
            >
              <span className="view-tab-icon">📊</span>
              Hierarchy Chart
            </button>
          </div>
        )}

        <div className="search-wrapper">
          <span className="search-icon">&#128269;</span>
          <input
            className="search-input"
            type="text"
            placeholder="Search by name, ID, designation, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation() } }}
          />
          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSearch('') }}
            >
              &#10005;
            </button>
          )}
        </div>
      </div>

      <div className="app-content">
        {loading && (
          <div className="status">
            <span className="spinner" />
            Loading hierarchy...
          </div>
        )}
        {error && <p className="status error">&#9888; {error}</p>}

        {!loading && !error && isSearching && (
          <>
            {searching && searchResults.length === 0 && (
              <div className="status">
                <span className="spinner" />
                Searching...
              </div>
            )}
            {searchError && <p className="status error">&#9888; {searchError}</p>}

            {searchResults.length > 0 && (() => {
              const searchTree = buildSearchTree(searchResults)
              const searchLevels = Object.keys(searchTree).map(Number).sort((a, b) => a - b)
              return (
                <>
                  <p className="result-count">{totalLoaded} results loaded</p>
                  <div className="card">
                    <ul className="tree">
                      {searchLevels.map((level) => {
                        const desigs = Object.values(searchTree[level]).sort((a, b) =>
                          a.desig_name.localeCompare(b.desig_name)
                        )
                        return (
                          <SearchLevelGroup
                            key={level}
                            level={level}
                            designations={desigs}
                          />
                        )
                      })}
                    </ul>
                    {hasMore && (
                      <button
                        type="button"
                        className="load-more"
                        onClick={loadMoreSearch}
                        disabled={searching}
                      >
                        {searching ? 'Loading...' : 'Load More'}
                      </button>
                    )}
                  </div>
                </>
              )
            })()}

            {!searching && searchResults.length === 0 && (
              <div className="empty-state">
                <span className="empty-icon">&#128270;</span>
                <p>No employees found for &quot;{search}&quot;</p>
              </div>
            )}
          </>
        )}

        {!loading && !error && !isSearching && viewMode === 'tree' && (
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

        {!loading && !error && !isSearching && viewMode === 'chart' && (
          <OrgChart tree={tree} sortedLevels={sortedLevels} />
        )}
      </div>
    </div>
  )
}

export default App
