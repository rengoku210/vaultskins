import { useState, useMemo, useEffect } from 'react';
import { RANKS, REGIONS } from '../data';
import { useDebounce, formatPrice } from '../hooks';
import { api, socket } from '../services/api';
import ListingCard from '../components/ListingCard';
import './Marketplace.css';

export default function Marketplace() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priceRange, setPriceRange] = useState(30000);
  const [sortBy, setSortBy] = useState('featured');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    fetchListings();
    
    // Ensure skin cache is populated
    api.getValorantCache().then(data => {
      if (data && data.skins) {
        localStorage.setItem('valorant_skins_cache', JSON.stringify(data));
        window.dispatchEvent(new Event('valorant_cache_ready'));
      }
    });

    // Real-time Updates
    socket.on('rental_started', (data) => {
      setListings(prev => prev.map(l => l.id === data.listingId ? { ...l, is_active: 0 } : l));
    });

    return () => {
      socket.off('rental_started');
    };
  }, []);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const data = await api.getListings();
      setListings(data.listings || []);
    } catch (err) {
      console.error('Failed to fetch listings', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...listings];

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(l =>
        (l.title?.toLowerCase().includes(q) || false) ||
        (l.rank?.toLowerCase().includes(q) || false) ||
        (l.skins && l.skins.some(s => s?.toLowerCase().includes(q)))
      );
    }

    if (rankFilter) result = result.filter(l => l.rank === rankFilter);
    if (regionFilter) result = result.filter(l => l.region === regionFilter);
    if (statusFilter) {
      const isActive = statusFilter === 'available' ? 1 : 0;
      result = result.filter(l => l.is_active === isActive);
    }
    result = result.filter(l => (l.price_buy || l.priceBuy) <= priceRange);

    switch (sortBy) {
      case 'price-low': result.sort((a, b) => (a.price_buy || a.priceBuy) - (b.price_buy || b.priceBuy)); break;
      case 'price-high': result.sort((a, b) => (b.price_buy || b.priceBuy) - (a.price_buy || a.priceBuy)); break;
      case 'featured': result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); break;
      default: break;
    }

    return result;
  }, [listings, debouncedSearch, rankFilter, regionFilter, statusFilter, priceRange, sortBy]);

  const clearFilters = () => {
    setSearch('');
    setRankFilter('');
    setRegionFilter('');
    setStatusFilter('');
    setPriceRange(30000);
    setSortBy('featured');
  };

  return (
    <div className="marketplace-page">
      {/* ── Sidebar ──────────────────────────── */}
      <aside className={`mp-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="mp-sidebar-header">
          <h3>Filters</h3>
          <button className="btn btn-ghost btn-sm" onClick={clearFilters} id="clear-filters">Clear All</button>
        </div>

        {/* Search */}
        <div className="filter-group">
          <label className="input-label">Search</label>
          <div className="search-input-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="input"
              placeholder="Search accounts, skins..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="marketplace-search"
            />
          </div>
        </div>

        {/* Rank */}
        <div className="filter-group">
          <label className="input-label">Rank</label>
          <select className="select" value={rankFilter} onChange={e => setRankFilter(e.target.value)} id="filter-rank">
            <option value="">All Ranks</option>
            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Region */}
        <div className="filter-group">
          <label className="input-label">Region</label>
          <select className="select" value={regionFilter} onChange={e => setRegionFilter(e.target.value)} id="filter-region">
            <option value="">All Regions</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Status */}
        <div className="filter-group">
          <label className="input-label">Status</label>
          <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} id="filter-status">
            <option value="">All</option>
            <option value="available">Available</option>
          </select>
        </div>

        {/* Price Range */}
        <div className="filter-group">
          <label className="input-label">Max Buy Price: {formatPrice(priceRange)}</label>
          <input
            type="range"
            className="range-slider"
            min="1000"
            max="30000"
            step="500"
            value={priceRange}
            onChange={e => setPriceRange(Number(e.target.value))}
            id="filter-price"
          />
          <div className="range-labels">
            <span>₹1,000</span>
            <span>₹30,000</span>
          </div>
        </div>

        {/* Skin Collections */}
        <div className="filter-group">
          <label className="input-label">Popular Skins</label>
          <div className="skin-tags">
            {['Reaver', 'Prime', 'Elderflame', 'Glitchpop', 'Champions', 'Oni'].map(s => (
              <button
                key={s}
                className={`tag ${search === s ? 'tag--active' : ''}`}
                onClick={() => setSearch(search === s ? '' : s)}
              >{s}</button>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────── */}
      <main className="mp-main">
        {/* Toolbar */}
        <div className="mp-toolbar">
          <div className="mp-toolbar-left">
            <button className="btn btn-ghost btn-sm mp-sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} id="toggle-sidebar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <span className="mp-result-count">{filtered.length} accounts found</span>
          </div>
          <div className="mp-toolbar-right">
            <select className="select" value={sortBy} onChange={e => setSortBy(e.target.value)} id="sort-by" style={{ width: 'auto', minWidth: 160 }}>
              <option value="featured">Featured First</option>
              <option value="price-low">Price: Low → High</option>
              <option value="price-high">Price: High → Low</option>
              <option value="rating">Rating: Highest</option>
            </select>
          </div>
        </div>

        {/* Listings Grid */}
        <div className="mp-grid">
          {loading ? (
            <div className="mp-loading">
              <div className="spinner"></div>
              <p>Fetching premium accounts...</p>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((listing, i) => (
              <ListingCard key={listing.id} listing={listing} index={i} featured={listing.featured} />
            ))
          ) : (
            <div className="mp-empty">
              <div className="mp-empty-icon">🔍</div>
              <h3>No accounts found</h3>
              <p>Try adjusting your filters or search query.</p>
              <button className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear Filters</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
