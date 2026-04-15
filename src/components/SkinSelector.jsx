import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import './SkinSelector.css';

/**
 * SkinSelector — Searchable multi-select skin picker
 * Props:
 *   selectedSkins  : array of skin objects { uuid, displayName, weapon, displayIcon }
 *   onSkinsChange  : (newArray) => void
 *   maxVisible     : number (optional, default 50)
 */
export default function SkinSelector({ selectedSkins = [], onSkinsChange, maxVisible = 50 }) {
  const [allSkins, setAllSkins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Load skins from cache or API
  useEffect(() => {
    const loadSkins = () => {
      const cached = localStorage.getItem('valorant_skins_cache');
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (data.skins?.length > 0) {
            setAllSkins(data.skins);
            setLoading(false);
            return;
          }
        } catch {}
      }

      api.getValorantCache()
        .then(data => {
          if (data?.skins?.length > 0) {
            setAllSkins(data.skins);
            localStorage.setItem('valorant_skins_cache', JSON.stringify(data));
          } else {
            setFetchError(true);
          }
        })
        .catch(() => setFetchError(true))
        .finally(() => setLoading(false));
    };

    loadSkins();

    const handler = () => {
      const cached = localStorage.getItem('valorant_skins_cache');
      if (cached) {
        try { setAllSkins(JSON.parse(cached).skins || []); } catch {}
      }
    };
    window.addEventListener('valorant_cache_ready', handler);
    return () => window.removeEventListener('valorant_cache_ready', handler);
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return allSkins.slice(0, maxVisible);
    const q = debouncedSearch.trim().toLowerCase();
    const scored = allSkins
      .map(s => {
        const name = (s.displayName || '').toLowerCase();
        const weapon = (s.weapon || '').toLowerCase();
        let score = 0;
        if (name === q || weapon === q) score = 100;
        else if (name.startsWith(q)) score = 50;
        else if (weapon.startsWith(q)) score = 40;
        else if (name.includes(q)) score = 10;
        else if (weapon.includes(q)) score = 5;
        if (score > 0) score += 1 / (s.displayName?.length || 1);
        return { ...s, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxVisible);
    return scored;
  }, [allSkins, debouncedSearch, maxVisible]);

  const toggleSkin = (skin) => {
    const exists = selectedSkins.find(s => s.uuid === skin.uuid);
    if (exists) {
      onSkinsChange(selectedSkins.filter(s => s.uuid !== skin.uuid));
    } else {
      onSkinsChange([...selectedSkins, skin]);
    }
  };

  const removeSkin = (uuid) => {
    onSkinsChange(selectedSkins.filter(s => s.uuid !== uuid));
  };

  return (
    <div className="vs-skin-selector">
      {/* Selected Chips */}
      {selectedSkins.length > 0 && (
        <div className="vs-skin-chips">
          {selectedSkins.map(skin => (
            <div key={skin.uuid} className="vs-skin-chip">
              {skin.displayIcon && (
                <img
                  src={skin.displayIcon}
                  alt=""
                  className="vs-skin-chip__img"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              <span className="vs-skin-chip__name">{skin.displayName}</span>
              <button
                type="button"
                className="vs-skin-chip__remove"
                onClick={() => removeSkin(skin.uuid)}
                aria-label={`Remove ${skin.displayName}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="vs-skin-search-wrap">
        <div className="vs-skin-search-inner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="vs-skin-search-icon">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            className="input vs-skin-search-input"
            placeholder="Search skins by name or weapon..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            id="skin-selector-search"
          />
        </div>

        {/* Quick Filter Buttons */}
        <div className="vs-skin-quick-filters">
          <span className="vs-quick-label">Quick:</span>
          {['Reaver', 'Prime', 'Champions', 'Glitchpop', 'Araxys', 'RGX'].map(tag => (
            <button
              key={tag}
              type="button"
              className="vs-quick-tag"
              onMouseDown={e => {
                e.preventDefault();
                setSearch(tag);
                setIsOpen(true);
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div className="vs-skin-dropdown">
          {loading ? (
            <div className="vs-skin-dropdown__status">
              <div className="spinner spinner--sm" />
              <span>Loading skin database...</span>
            </div>
          ) : fetchError ? (
            <div className="vs-skin-dropdown__status vs-skin-dropdown__status--error">
              <span>⚠️ Failed to load skins.</span>
              <button className="btn btn-sm btn-secondary" onClick={() => {
                setFetchError(false);
                setLoading(true);
                api.getValorantCache()
                  .then(d => { setAllSkins(d.skins || []); setFetchError(false); })
                  .catch(() => setFetchError(true))
                  .finally(() => setLoading(false));
              }}>Retry</button>
            </div>
          ) : !debouncedSearch.trim() && allSkins.length === 0 ? (
            <div className="vs-skin-dropdown__status">Type to search</div>
          ) : filtered.length === 0 ? (
            <div className="vs-skin-dropdown__status">No skins found for "{debouncedSearch}"</div>
          ) : (
            <div className="vs-skin-dropdown__list">
              {filtered.map(skin => {
                const isSelected = selectedSkins.some(s => s.uuid === skin.uuid);
                return (
                  <button
                    key={skin.uuid}
                    type="button"
                    className={`vs-skin-option ${isSelected ? 'vs-skin-option--selected' : ''}`}
                    onMouseDown={e => { e.preventDefault(); toggleSkin(skin); }}
                  >
                    <div className="vs-skin-option__img-wrap">
                      <img
                        src={skin.displayIcon}
                        alt=""
                        className="vs-skin-option__img"
                        onError={e => { e.target.src = 'https://via.placeholder.com/40x40/15151e/34d399?text=?'; }}
                      />
                    </div>
                    <div className="vs-skin-option__info">
                      <span className="vs-skin-option__name">{skin.displayName}</span>
                      <span className="vs-skin-option__weapon">{skin.weapon}</span>
                    </div>
                    {isSelected && (
                      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" className="vs-skin-option__check">
                        <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.5" fill="none" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedSkins.length > 0 && (
        <p className="vs-skin-count">
          {selectedSkins.length} skin{selectedSkins.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
}
