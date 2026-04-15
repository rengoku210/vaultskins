import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RANKS, REGIONS } from '../data';
import { formatPrice } from '../hooks';
import { api } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import CryptoJS from 'crypto-js';
import './Seller.css';

const SECRET_KEY = "vaultskins-secret";

export default function Seller() {
  const navigate = useNavigate();
  const { showToast } = useNotifications();
  const [activeSection, setActiveSection] = useState('listings');
  const [showAddForm, setShowAddForm] = useState(false);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [formData, setFormData] = useState({
    title: '', rank: 'Unranked', mode: 'both',
    buyPrice: '', rentHour: '', rentDay: '', region: 'AP',
    description: '', username: '', password: '', 
    contactEmail: '', contactSocial: '',
    skins: [], // Will hold simple objects or string UUIDs
    imageUrl: ''
  });
  
  // Skin Selector State
  const [availableSkins, setAvailableSkins] = useState([]);
  const [skinSearch, setSkinSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearchingSkins, setIsSearchingSkins] = useState(false);
  const [skinFetchError, setSkinFetchError] = useState(false);

  const loadSkins = () => {
    if (availableSkins.length > 0) return;
    setSkinFetchError(false);
    api.getValorantCache().then((data) => {
      if (data && data.skins && data.skins.length > 0) {
        setAvailableSkins(data.skins);
        localStorage.setItem('valorant_skins_cache', JSON.stringify(data));
        window.dispatchEvent(new Event('valorant_cache_ready'));
      } else {
        setSkinFetchError(true);
      }
    }).catch(err => {
      console.error(err);
      setSkinFetchError(true);
    });
  };

  useEffect(() => {
    fetchMyListings();
    loadSkins();
  }, []);

  // Debounce search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(skinSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [skinSearch]);

  const fetchMyListings = async () => {
    try {
      setLoading(true);
      const data = await api.getUserListings();
      setListings(data.listings || []);
    } catch (err) {
      console.error('Failed to fetch user listings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Frontend validation for negative prices
    if (formData.buyPrice < 0 || formData.rentHour < 0 || formData.rentDay < 0) {
      showToast('Price cannot be negative', 'error');
      return;
    }

    // Encrypt the password before sending
    const encryptedPassword = CryptoJS.AES.encrypt(formData.password, SECRET_KEY).toString();

    const payload = {
      title: formData.title,
      rank: formData.rank,
      mode: formData.mode,
      priceRentHr: parseFloat(formData.rentHour) || 0,
      priceRentDay: parseFloat(formData.rentDay) || 0,
      priceBuy: parseFloat(formData.buyPrice) || 0,
      region: formData.region,
      description: formData.description,
      username: formData.username,
      password: encryptedPassword,
      skins: formData.skins.map(s => s.uuid), // Save UUID arrays
      imageUrl: formData.imageUrl
    };

    const res = await api.submitListing(payload);
    if (res.success) {
      showToast('Listing submitted for review!', 'success');
      setShowAddForm(false);
      fetchMyListings();
    } else {
      showToast('Failed to submit: ' + res.error, 'error');
    }
  };

  // Computed stats with safety
  const totalEarnings = Array.isArray(listings) ? listings.reduce((s, l) => s + (l.earnings || 0), 0) : 0;
  const totalRentals = Array.isArray(listings) ? listings.reduce((s, l) => s + (l.rentals || 0), 0) : 0;
  const totalViews = Array.isArray(listings) ? listings.reduce((s, l) => s + (l.views || 0), 0) : 0;

  return (
    <div className="seller-page">
      <div className="container">
        <div className="dash-header">
          <div className="seller-header-row">
            <div>
              <h1>Seller Dashboard</h1>
              <p className="dash-subtitle">Manage your listings and track earnings</p>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/create-listing')} id="add-listing-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create Listing
            </button>
          </div>
        </div>

        {/* Earnings Overview */}
        <div className="seller-stats">
          <div className="seller-stat-card seller-stat-card--earnings">
            <div className="seller-stat-top">
              <span className="seller-stat-label">Total Earnings</span>
              <span className="seller-stat-trend">+0.0%</span>
            </div>
            <div className="seller-stat-val">{formatPrice(totalEarnings)}</div>
            <div className="seller-stat-chart">
               <div style={{ height: 40, borderBottom: '1px solid rgba(255,255,255,0.1)' }}></div>
            </div>
          </div>

          <div className="seller-stat-card">
            <span className="seller-stat-label">Your Listings</span>
            <div className="seller-stat-val">{listings.length}</div>
          </div>

          <div className="seller-stat-card">
            <span className="seller-stat-label">Pending Approval</span>
            <div className="seller-stat-val">{listings.filter(l => l.is_active === 0).length}</div>
          </div>

          <div className="seller-stat-card">
            <span className="seller-stat-label">Total Views</span>
            <div className="seller-stat-val">{totalViews.toLocaleString()}</div>
          </div>
        </div>

        {/* Add Listing Form */}
        {showAddForm && (
          <form className="add-listing-form" onSubmit={handleSubmit}>
            <h3>Account Details</h3>
            <div className="form-grid">
              <div className="form-group">
                <label className="input-label">Account Title</label>
                <input className="input" placeholder="e.g., Radiant — Champions Collection" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="input-label">Rank</label>
                <select className="select" value={formData.rank} onChange={e => setFormData({...formData, rank: e.target.value})}>
                  {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="input-label">Listing Type</label>
                <select className="select" value={formData.mode} onChange={e => setFormData({...formData, mode: e.target.value})}>
                  <option value="both">Both (Rent & Sell)</option>
                  <option value="rent">Rent Only</option>
                  <option value="sale">Sell Only</option>
                </select>
              </div>
              <div className="form-group">
                <label className="input-label">Region</label>
                <select className="select" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})}>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="input-label">Buy Price (₹)</label>
                <input className="input" type="number" required={formData.mode !== 'rent'} disabled={formData.mode === 'rent'} value={formData.buyPrice} onChange={e => setFormData({...formData, buyPrice: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="input-label">Rent Price (₹/hour)</label>
                <input className="input" type="number" required={formData.mode !== 'sale'} disabled={formData.mode === 'sale'} value={formData.rentHour} onChange={e => setFormData({...formData, rentHour: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="input-label">Rent Price (₹/day)</label>
                <input className="input" type="number" required={formData.mode !== 'sale'} disabled={formData.mode === 'sale'} value={formData.rentDay} onChange={e => setFormData({...formData, rentDay: e.target.value})} />
              </div>
              <div className="form-group form-group--full" style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
                <h4 style={{ color: 'var(--text-secondary)' }}>Account Credentials (Encrypted & Secure)</h4>
              </div>
              <div className="form-group">
                <label className="input-label">Riot ID / Username</label>
                <input className="input" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="e.g., TenZ#001" />
              </div>
              <div className="form-group">
                <label className="input-label">Riot Password</label>
                <input className="input" type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>

              <div className="form-group form-group--full" style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
                <h4 style={{ color: 'var(--text-secondary)' }}>Seller Contact Information</h4>
              </div>
              <div className="form-group">
                <label className="input-label">Contact Email</label>
                <input className="input" type="email" required value={formData.contactEmail} onChange={e => setFormData({...formData, contactEmail: e.target.value})} placeholder="email@example.com" />
              </div>
              <div className="form-group">
                <label className="input-label">Instagram / Discord (Optional)</label>
                <input className="input" value={formData.contactSocial} onChange={e => setFormData({...formData, contactSocial: e.target.value})} placeholder="@username" />
              </div>
              <div className="form-group form-group--full">
                <label className="input-label">Account Hero Image URL (Optional)</label>
                <input className="input" placeholder="https://..." value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} />
              </div>
              <div className="form-group form-group--full">
                <label className="input-label">Description</label>
                <textarea className="input" rows="2" placeholder="Describe the account..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="form-group form-group--full">
                <label className="input-label">Select Key Skins</label>
                
                <div className="skin-selector-container">
                  <div className="skin-search-wrap">
                     <div className="input-with-icon">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="search-icon">
                         <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                       </svg>
                       <input 
                         className="input input--search" 
                         placeholder="Search all Valorant skins..." 
                         value={skinSearch}
                         onChange={e => {
                           setSkinSearch(e.target.value);
                           setIsSearchingSkins(true);
                           loadSkins();
                         }}
                         onFocus={() => {
                            setIsSearchingSkins(true);
                            loadSkins();
                         }}
                         onBlur={() => setTimeout(() => setIsSearchingSkins(false), 250)}
                       />
                     </div>

                     {isSearchingSkins && (
                       <div className="skin-dropdown">
                         {availableSkins.length === 0 ? (
                           <div className="skin-dropdown-hint">
                             {skinFetchError ? (
                               <>
                                 <div style={{ color: 'var(--accent-red)', marginBottom: 8 }}>Failed to connect to backend securely.</div>
                                 <button type="button" className="btn btn-sm btn-secondary" onClick={loadSkins}>Retry Fetch</button>
                               </>
                             ) : (
                               <>
                                 <div className="spinner spinner--sm" style={{ marginBottom: 12 }}></div>
                                 Fetching skin database...
                               </>
                             )}
                           </div>
                         ) : debouncedSearch.trim().length === 0 ? (
                           <div className="skin-dropdown-hint">Type to search thousands of skins...</div>
                         ) : (() => {
                           const query = debouncedSearch.trim().toLowerCase();
                           
                           // Scoring and Ranking Logic
                           const scoredResults = availableSkins
                             .map(skin => {
                               let score = 0;
                               const name = (skin.displayName || '').toLowerCase();
                               const weapon = (skin.weapon || '').toLowerCase();

                               // Exact Match
                               if (name === query) score = 100;
                               else if (weapon === query) score = 80;
                               // Starts With
                               else if (name.startsWith(query)) score = 50;
                               else if (weapon.startsWith(query)) score = 40;
                               // Includes
                               else if (name.includes(query)) score = 10;
                               else if (weapon.includes(query)) score = 5;

                               if (score > 0) {
                                 // Boost shorter/cleaner matches
                                 score += 1 / (skin.displayName?.length || 1);
                               }

                               return { ...skin, score };
                             })
                             .filter(s => s.score > 0)
                             .sort((a, b) => b.score - a.score)
                             .slice(0, 15);

                           if (scoredResults.length === 0) {
                             return <div className="skin-dropdown-empty">No skins found for "{debouncedSearch}"</div>;
                           }

                           return scoredResults.map(skin => (
                             <div 
                               key={skin.uuid} 
                               className="skin-dropdown-item"
                               onClick={() => {
                                 if (!formData.skins.find(s => s.uuid === skin.uuid)) {
                                   setFormData({...formData, skins: [...formData.skins, skin]});
                                 }
                                 setSkinSearch('');
                                 setIsSearchingSkins(false);
                               }}
                             >
                                <div className="skin-dropdown-img">
                                  <img 
                                    src={skin.displayIcon} 
                                    alt="" 
                                    onError={(e) => { e.target.src = 'https://via.placeholder.com/40x40/15151e/34d399?text=Skin'; }}
                                  />
                                </div>
                                <div className="skin-dropdown-info">
                                  <span className="skin-dropdown-name">{skin.displayName}</span>
                                  <span className="skin-dropdown-weapon">{skin.weapon}</span>
                                </div>
                             </div>
                           ));
                         })()}
                       </div>
                     )}
                  </div>

                  {/* Selected Skins Panel */}
                  <div className="selected-skins-panel">
                    {formData.skins.map(skin => (
                      <div key={skin.uuid} className="selected-skin-chip">
                        <div className="skin-chip-img">
                          <img 
                            src={skin.displayIcon} 
                            alt="" 
                            onError={(e) => { e.target.src = 'https://via.placeholder.com/40x40/15151e/34d399?text=Skin'; }}
                          />
                        </div>
                        <span className="skin-chip-name">{skin.displayName}</span>
                        <button 
                          className="skin-chip-remove"
                          type="button" 
                          onClick={() => setFormData({...formData, skins: formData.skins.filter(s => s.uuid !== skin.uuid)})}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ))}
                    {formData.skins.length === 0 && (
                      <div className="empty-skins-msg">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" style={{ marginBottom: 8, opacity: 0.5 }}>
                          <path d="M12 2v20M2 12h20" />
                        </svg>
                        <span>No skins added yet. Search or use quick-add below.</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Quick Filters */}
                  <div className="quick-skins">
                     <span className="quick-skins-label">Quick Suggestions:</span>
                     {['Reaver', 'Prime', 'RGX', 'Kuronami', 'Champions', 'Araxys'].map(q => (
                       <button
                         key={q}
                         type="button" 
                         className="btn btn-ghost btn-sm skin-tag-btn"
                         onClick={() => {
                           setSkinSearch(q);
                           setIsSearchingSkins(true);
                         }}
                       >
                         {q}
                       </button>
                     ))}
                  </div>

                </div>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" id="submit-listing">Submit for Review</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </form>
        )}

        {/* Listings Table */}
        <div className="seller-section">
          <h3>Your Account Inventory</h3>
          {loading ? <p>Loading inventory...</p> : (
            <div className="seller-listings">
              {listings.map(listing => (
                <div key={listing.id} className="seller-listing-row">
                  <div className="seller-listing-info">
                    <h4>{listing.title}</h4>
                    <div className="seller-listing-meta">
                      <span className="badge badge-platinum">{listing.rank}</span>
                      <span className={`badge ${listing.is_active ? 'badge-available' : 'badge-sold'}`}>
                        {listing.is_active ? '✓ Active' : '⌛ Pending Review'}
                      </span>
                      <span className="tag">{listing.region}</span>
                    </div>
                  </div>

                  <div className="seller-listing-stats">
                    <div className="sls-item">
                      <span className="sls-val">{formatPrice(listing.price_buy || listing.priceBuy)}</span>
                      <span className="sls-label">Buy Price</span>
                    </div>
                    <div className="sls-item">
                      <span className="sls-val" style={{ color: 'var(--accent-green)' }}>{formatPrice(listing.earnings || 0)}</span>
                      <span className="sls-label">Earned</span>
                    </div>
                  </div>

                  <div className="seller-listing-actions">
                    <button className="btn btn-ghost btn-sm">Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)' }}>Remove</button>
                  </div>
                </div>
              ))}
              {listings.length === 0 && <p className="empty-msg">You haven't added any accounts yet.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
