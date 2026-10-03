import React, { useState, useEffect, useRef } from 'react';
import { Search, X, User, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

/**
 * TreeSearch
 * Backend-driven network tree member search (Prompt 13).
 *
 * Requirements:
 * - Search box above the tree
 * - Placeholder: "Search by name or Distributor ID"
 * - Examples: Rahul, KV-1001
 * - Call backend API: GET /api/v1/network-tree/search?q=...
 * - Do NOT search only currently loaded frontend tree
 * - Return matching authorized distributors
 * - When user selects a result:
 *   - Open that distributor's tree
 *   - Update: /network-tree?member=KV-1001
 *   - Center the selected distributor
 * - If no result: "No distributor found."
 */
function TreeSearch({ onSelectMember }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const containerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Call backend API with debounce whenever searchQuery changes
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setIsOpen(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const data = await api.searchNetworkTree(trimmed);
        setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn('Backend tree search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
        setHasSearched(true);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelect = (distributor) => {
    if (onSelectMember) {
      onSelectMember(distributor);
    }
    setSearchQuery('');
    setIsOpen(false);
    setResults([]);
    setHasSearched(false);
  };

  const handleExampleClick = (example) => {
    setSearchQuery(example);
  };

  const handleClear = () => {
    setSearchQuery('');
    setResults([]);
    setIsOpen(false);
    setHasSearched(false);
  };

  return (
    <div className="tree-search-container" ref={containerRef}>
      <div className="tree-search-input-wrap">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Search by Name or Distributor ID"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (searchQuery.trim().length > 0) setIsOpen(true);
          }}
          className="tree-search-input-field"
          aria-label="Search by Name or Distributor ID"
        />
        {loading ? (
          <Loader2 size={16} className="tree-search-spinner" />
        ) : (
          searchQuery && (
            <button
              type="button"
              className="clear-search-button"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )
        )}
      </div>

      <div className="tree-search-examples">
        <span className="tree-search-examples-label">Examples:</span>
        <button
          type="button"
          className="example-chip"
          onClick={() => handleExampleClick('Rahul')}
        >
          Rahul
        </button>
        <button
          type="button"
          className="example-chip"
          onClick={() => handleExampleClick('KV-1001')}
        >
          KV-1001
        </button>
      </div>

      {isOpen && searchQuery.trim().length > 0 && (
        <div className="tree-search-dropdown-results">
          {loading && (
            <div className="search-dropdown-header">
              <span>Searching backend network...</span>
            </div>
          )}

          {!loading && results.length > 0 && (
            <>
              <div className="search-dropdown-header">
                <span>Matching Authorized Distributors ({results.length})</span>
              </div>
              {results.map((distributor) => {
                const code = distributor.distributorId || distributor.id;
                const name = distributor.name || 'Distributor';
                const rank = distributor.rank || 'Distributor';
                return (
                  <button
                    key={distributor.id || code}
                    type="button"
                    className="search-result-item"
                    onClick={() => handleSelect(distributor)}
                  >
                    <div className="result-avatar">
                      <User size={14} />
                    </div>
                    <div className="result-info">
                      <span className="result-name">{name}</span>
                      <span className="result-id">
                        {code}
                        {rank && <span className="result-rank-badge">{rank}</span>}
                      </span>
                    </div>
                    <span className="result-action">Open Tree →</span>
                  </button>
                );
              })}
            </>
          )}

          {!loading && hasSearched && results.length === 0 && (
            <div className="search-empty-state">
              <p className="no-result-text">No distributor found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TreeSearch;
