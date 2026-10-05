import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, FileText, AlertTriangle, Layers, Zap, X, Filter, ChevronDown, Check } from 'lucide-react';
import { searchAPI } from '../api/client';
import { useDebounce } from '../hooks/useDebounce';
import { normalizeSearchResult } from '../utils/searchNormalizer';
import './SearchPage.css';

const SEARCH_CATEGORIES = ['all', 'wells', 'documents', 'events', 'formations'];
const SEARCH_MODES = ['hybrid', 'keyword', 'semantic'];

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [category, setCategory] = useState('all');
  const [searchMode, setSearchMode] = useState('hybrid');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Advanced Filters
  const [filters, setFilters] = useState({
    well: '',
    formation: '',
    eventType: '',
    severity: '',
    depthFrom: '',
    depthTo: ''
  });

  // Autocomplete
  useEffect(() => {
    if (debouncedQuery.length > 2) {
      searchAPI.autocomplete(debouncedQuery).then(({ data }) => {
        setSuggestions(data.data || []);
      }).catch(() => setSuggestions([]));
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery]);

  async function handleSearch(e, specificQuery = query) {
    e?.preventDefault();
    if (!specificQuery.trim()) return;
    setLoading(true);
    setSearched(true);
    setShowSuggestions(false);
    
    try {
      const payload = {
        query: specificQuery,
        category,
        mode: searchMode,
        limit: 20,
        filters: Object.keys(filters).length > 0 ? filters : undefined
      };
      
      const { data } = searchMode === 'semantic' ? await searchAPI.vector(payload) : await searchAPI.search(payload);
      
      const rawResults = data.data?.results || data.data || [];
      const normalized = rawResults.map(normalizeSearchResult);
      
      setResults({
        results: normalized,
        total: data.data?.total || normalized.length,
        queryTime: data.data?.queryTime || 0,
      });
    } catch {
      setResults({ results: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'well': return <MapPin size={16} />;
      case 'document': return <FileText size={16} />;
      case 'event': return <AlertTriangle size={16} />;
      case 'formation': return <Layers size={16} />;
      default: return <Zap size={16} />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'well': return 'var(--color-accent-cyan)';
      case 'document': return 'var(--color-accent-indigo)';
      case 'event': return 'var(--color-accent-amber)';
      case 'formation': return 'var(--color-accent-emerald)';
      default: return 'var(--color-text-muted)';
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="search-page-header">
        <h1 className="page-title">
          <span className="text-gradient">Intelligent</span> Search
        </h1>
        <p className="page-subtitle">
          Search across wells, documents, drilling events, and formation data
        </p>
      </div>

      {/* Search Box */}
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-wrapper" style={{ position: 'relative' }}>
          <Search size={20} className="search-form-icon" />
          <input
            type="text"
            className="input search-main-input"
            placeholder="Search wells, documents, events, formations..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            id="main-search-input"
            autoFocus
            autoComplete="off"
          />
          {query && (
            <button type="button" className="search-clear" onClick={() => { setQuery(''); setResults(null); setSearched(false); setSuggestions([]); }}>
              <X size={16} />
            </button>
          )}
          
          {/* Autocomplete Dropdown */}
          <AnimatePresence>
            {showSuggestions && suggestions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="autocomplete-dropdown glass"
                style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '8px', borderRadius: '8px', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}
              >
                {suggestions.map((sug, i) => (
                  <div 
                    key={i} 
                    className="autocomplete-item" 
                    onClick={() => {
                      setQuery(sug.text || sug);
                      handleSearch(null, sug.text || sug);
                    }}
                    style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Search size={14} color="var(--color-text-muted)" />
                    <span>{sug.text || sug}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="search-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div className="search-categories">
            {SEARCH_CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                className={`search-cat-btn ${category === cat ? 'search-cat-active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="search-modes" style={{ display: 'flex', background: 'var(--color-bg-tertiary)', borderRadius: '20px', padding: '4px' }}>
              {SEARCH_MODES.map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSearchMode(mode)}
                  style={{
                    background: searchMode === mode ? 'var(--color-bg-primary)' : 'transparent',
                    border: 'none',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '0.8rem',
                    color: searchMode === mode ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textTransform: 'capitalize'
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
            
            <button type="button" className={`btn btn-secondary btn-sm ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
              <Filter size={14} /> Filters {showFilters ? <ChevronDown size={14} style={{transform: 'rotate(180deg)'}} /> : <ChevronDown size={14} />}
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!query.trim() || loading} id="btn-search">
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="card" style={{ marginTop: '16px', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label className="label">Well Name</label>
                <input type="text" className="input" value={filters.well} onChange={e => setFilters({...filters, well: e.target.value})} placeholder="e.g. WELL-NHK-014" />
              </div>
              <div>
                <label className="label">Formation</label>
                <input type="text" className="input" value={filters.formation} onChange={e => setFilters({...filters, formation: e.target.value})} placeholder="e.g. Barail" />
              </div>
              <div>
                <label className="label">Event Type</label>
                <select className="input" value={filters.eventType} onChange={e => setFilters({...filters, eventType: e.target.value})}>
                  <option value="">Any</option>
                  <option value="stuck_pipe">Stuck Pipe</option>
                  <option value="lost_circulation">Lost Circulation</option>
                  <option value="kick">Kick</option>
                </select>
              </div>
              <div>
                <label className="label">Severity</label>
                <select className="input" value={filters.severity} onChange={e => setFilters({...filters, severity: e.target.value})}>
                  <option value="">Any</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="label">Depth From (m)</label>
                <input type="number" className="input" value={filters.depthFrom} onChange={e => setFilters({...filters, depthFrom: e.target.value})} />
              </div>
              <div>
                <label className="label">Depth To (m)</label>
                <input type="number" className="input" value={filters.depthTo} onChange={e => setFilters({...filters, depthTo: e.target.value})} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {loading && <div className="spinner-overlay" style={{ marginTop: '40px' }}><div className="spinner"></div></div>}

      {results && !loading && (
        <div className="search-results">
          <div className="search-results-header">
            <span>{results.total} results found</span>
            {results.queryTime > 0 && <span className="search-time">in {results.queryTime}ms</span>}
          </div>

          {results.results.map((item, i) => (
            <motion.div
              key={`${item.type}-${item.id}-${i}`}
              className="search-result-item"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                if (item.type === 'well') navigate(`/wells/${item.id}`);
                if (item.type === 'document') navigate(`/documents`);
              }}
            >
              <div className="search-result-icon" style={{ color: getTypeColor(item.type) }}>
                {getTypeIcon(item.type)}
              </div>
              <div className="search-result-content">
                <div className="search-result-title">{item.title}</div>
                <div className="search-result-subtitle">{item.subtitle}</div>
                {item.highlight && (
                  <div className="search-result-highlight" dangerouslySetInnerHTML={{ __html: item.highlight }} style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }} />
                )}
              </div>
              <div className="search-result-meta">
                <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>{item.type}</span>
                {item.score && (
                  <span className="search-result-score">{(item.score * 100).toFixed(0)}%</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {searched && !loading && results?.results.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={28} /></div>
          <h3 className="empty-state-title">No results found</h3>
          <p>Try different keywords or broaden your search category</p>
        </div>
      )}
    </motion.div>
  );
}
