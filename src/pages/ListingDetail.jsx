import { useState, useEffect, useMemo } from 'react';
import CryptoJS from 'crypto-js';

const SECRET_KEY = "vaultskins-secret";
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { formatPrice } from '../hooks';
import SkinPreviewModal from '../components/SkinPreviewModal';
import {
  ArrowLeft, Shield, ShieldCheck, Clock, DollarSign,
  Play, ShoppingCart, Timer, CheckCircle, User, Mail, Flame
} from 'lucide-react';
import './ListingDetail.css';

const RANK_BADGE = {
  Radiant:   'badge-radiant',
  Immortal:  'badge-immortal',
  Ascendant: 'badge-ascendant',
  Diamond:   'badge-diamond',
  Platinum:  'badge-platinum',
  Gold:      'badge-gold',
};

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [listing, setListing]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [selectedSkin, setSelectedSkin] = useState(null); // for preview modal
  const [purchasing, setPurchasing]     = useState(false);
  const [rentalType, setRentalType]     = useState('day');
  const [duration, setDuration]         = useState(1);
  const [resolvedSkins, setResolvedSkins] = useState([]);
  const [paid, setPaid] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [checkoutType, setCheckoutType] = useState(null);
  const [decryptedPassword, setDecryptedPassword] = useState('');

  // Fetch listing
  useEffect(() => {
    const fetchListing = async () => {
      try {
        setLoading(true);
        const data = await api.getListingById(id);
        const l = data?.listing || data;
        setListing(l);
      } catch (err) {
        console.error('Listing fetch error:', err);
        showToast('Failed to load listing', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [id]);

  // Resolve skin UUIDs → objects using local cache
  useEffect(() => {
    if (!listing?.skins) return;

    const resolve = () => {
      const cached = localStorage.getItem('valorant_skins_cache');
      let allSkins = [];
      if (cached) {
        try { allSkins = JSON.parse(cached).skins || []; } catch {}
      }

      const resolved = listing.skins.map(s => {
        if (typeof s === 'object' && s !== null) return s;
        if (typeof s === 'string') {
          const match = allSkins.find(as => as.uuid === s || as.displayName?.toLowerCase() === s.toLowerCase());
          return match || { displayName: s, displayIcon: null, uuid: s };
        }
        return s;
      });
      setResolvedSkins(resolved);
    };

    resolve();
    window.addEventListener('valorant_cache_ready', resolve);
    return () => window.removeEventListener('valorant_cache_ready', resolve);
  }, [listing]);

  const rentalPrice = useMemo(() => {
    if (!listing) return 0;
    const rateHr  = listing.price_rent_hr  || listing.priceRentHour || 0;
    const rateDay = listing.price_rent_day || listing.priceRentDay  || 0;
    const rate = rentalType === 'hour' ? rateHr : rateDay;
    return rate * duration;
  }, [listing, rentalType, duration]);

  const handleCheckout = (type) => {
    if (!user) {
      showToast('Please login to continue', 'error');
      return;
    }
    setCheckoutType(type);
    setShowPaymentModal(true);
  };

  const handleFakePayment = async (e) => {
    e.preventDefault();
    if (!paymentId.trim()) {
      showToast('Please enter a fake payment ID', 'error');
      return;
    }

    setPurchasing(true);
    // Simulate API delay
    await new Promise(r => setTimeout(r, 2000));

    try {
      // Logic for "Simulated Purchase"
      setPaid(true);
      setShowPaymentModal(false);
      showToast(checkoutType === 'buy' ? 'Successfully Purchased! 🎉' : 'Rental Confirmed! ⚡', 'success');

      // Decrypt the password for display
      if (listing.password) {
        try {
          const bytes = CryptoJS.AES.decrypt(listing.password, SECRET_KEY);
          const decrypted = bytes.toString(CryptoJS.enc.Utf8);
          setDecryptedPassword(decrypted);
        } catch (err) {
          console.error("Decryption failed", err);
          setDecryptedPassword("Decryption Error");
        }
      }
    } catch (err) {
      showToast('Payment verification failed', 'error');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="ld-page">
        <div className="container ld-loading">
          <div className="ld-skeleton ld-skeleton--hero" />
          <div className="ld-skeleton-row">
            <div className="ld-skeleton ld-skeleton--main" />
            <div className="ld-skeleton ld-skeleton--side" />
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="ld-page ld-not-found">
        <Shield size={56} className="ld-not-found__icon" />
        <h2>Listing not found</h2>
        <Link to="/marketplace" className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to Marketplace
        </Link>
      </div>
    );
  }

  const {
    title, rank = 'Unranked', rankTier = 0,
    skins = [], skinCount,
    price_buy, price_rent_hr, price_rent_day,
    priceBuy, priceRentHour, priceRentDay,
    description, region, level = 100, status: propStatus
  } = listing;

  const status = propStatus || (listing.is_active === 0 ? 'rented' : 'available');
  const isAvailable = status === 'available';
  const seller = listing.seller || { name: 'VaultSeller', rating: 4.8, trades: 12, vaultStatus: 'unverified', avatar: '🛡️' };

  const thumbnail =
    listing.image_url ||
    listing.imageUrl  ||
    (skins.length > 0 && typeof skins[0] === 'object' ? skins[0].displayIcon : null) ||
    'https://via.placeholder.com/1200x400/15151e/34d399?text=VaultSkins+Valorant';

  const pRentHr  = price_rent_hr  || priceRentHour  || 0;
  const pRentDay = price_rent_day || priceRentDay   || 0;
  const pBuy     = price_buy      || priceBuy        || 0;
  const isRentable = listing.is_rentable !== 0 || pRentHr > 0 || pRentDay > 0;
  const isSellable = listing.is_sellable !== 0 || pBuy > 0;

  const totalSkins = skinCount || resolvedSkins.length || skins.length;

  return (
    <div className="ld-page">
      <div className="container">
        <nav className="ld-breadcrumb">
          <Link to="/marketplace">Marketplace</Link>
          <span>/</span>
          <span className="ld-breadcrumb__current">{title}</span>
        </nav>

        {/* Hero */}
        <div className="ld-hero animate-fade-in">
          <img
            src={thumbnail}
            alt={title}
            className="ld-hero__img"
            onError={e => { e.target.src = 'https://via.placeholder.com/1200x400/15151e/34d399?text=VaultSkins+Valorant'; }}
          />
          <div className="ld-hero__overlay" />
          <div className="ld-hero__badges">
            <span className={`badge ${RANK_BADGE[rank] || ''}`}>{rank} {rankTier > 0 ? rankTier : ''}</span>
            <span className={`badge ${isAvailable ? 'badge-available' : 'badge-rented'}`}>
              {isAvailable ? '● Available' : '◐ Rented'}
            </span>
            <span className="tag verified-tag">
              <ShieldCheck size={13} style={{ marginRight: 4 }} />
              {seller.vaultStatus === 'verified' ? 'Admin Verified' : 'Unverified'}
            </span>
          </div>
        </div>

        <div className="ld-layout animate-fade-in-up stagger-1">
          {/* ── Left — Main Content ─────────────────────── */}
          <div className="ld-left">
            <h1 className="ld-title">{title}</h1>

            {description && (
              description.startsWith('http') && description.length < 200 ? (
                <img src={description} alt="Preview" className="ld-desc-img" />
              ) : (
                <p className="ld-desc">{description}</p>
              )
            )}

            <div className="ld-quick-stats">
              <div className="ld-stat">
                <span className="ld-stat__val">{totalSkins}</span>
                <span className="ld-stat__label">Skins</span>
              </div>
              <div className="ld-stat">
                <span className="ld-stat__val">{level}</span>
                <span className="ld-stat__label">Level</span>
              </div>
              <div className="ld-stat">
                <span className="ld-stat__val">{region || '—'}</span>
                <span className="ld-stat__label">Region</span>
              </div>
            </div>

            {/* Skins Grid */}
            {resolvedSkins.length > 0 && (
              <div className="ld-skins-section">
                <h3 className="ld-skins-title">
                  Skins ({resolvedSkins.length})
                </h3>
                <div className="ld-skins-grid">
                  {resolvedSkins.map((skin, i) => {
                    const hasVideo = skin.video || skin.streamedVideo || skin.levels?.[0]?.streamedVideo;
                    return (
                      <button
                        key={skin.uuid || i}
                        id={`skin-preview-${i}`}
                        className="ld-skin-card"
                        onClick={() => setSelectedSkin(skin)}
                        title={`Preview: ${skin.displayName}`}
                      >
                        <div className="ld-skin-card__img-wrap">
                          {skin.displayIcon ? (
                            <img
                              src={skin.displayIcon}
                              alt={skin.displayName}
                              className="ld-skin-card__img"
                              onError={e => { e.target.style.opacity = 0; }}
                            />
                          ) : (
                            <Shield size={20} className="ld-skin-card__placeholder" />
                          )}
                          {hasVideo && (
                            <div className="ld-skin-card__play-overlay">
                              <Play size={18} />
                            </div>
                          )}
                        </div>
                        <p className="ld-skin-card__name">{skin.displayName}</p>
                        {skin.weapon && <p className="ld-skin-card__weapon">{skin.weapon}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Seller */}
            <div className="ld-seller-block">
              <div className="ld-seller-avatar">{seller.avatar}</div>
              <div className="ld-seller-info">
                <div className="ld-seller-name-row">
                  <span className="ld-seller-name">{seller.name}</span>
                  {seller.vaultStatus === 'verified' ? (
                    <span className="verified-badge">✓ Verified</span>
                  ) : (
                    <span className="verified-badge" style={{ background: 'var(--accent-red-soft)', color: 'var(--accent-red)' }}>Unverified</span>
                  )}
                </div>
                <span className="ld-seller-meta">★ {seller.rating} · {seller.trades} trades</span>
              </div>
            </div>
          </div>

          {/* ── Right — Pricing Sidebar ─────────────────── */}
          <div className="ld-right">
            <div className="ld-pricing-panel">
              <h3 className="ld-pricing-title">Instant Access</h3>

              {/* Rent Section */}
              {isRentable && (
                <div className="ld-price-section">
                  <div className="ld-price-section__header">
                    <span className="ld-price-badge ld-price-badge--rent">Rent</span>
                    <span className="ld-price-rates">
                      {pRentHr > 0 && <span>{formatPrice(pRentHr)}/hr</span>}
                      {pRentDay > 0 && <span>{formatPrice(pRentDay)}/day</span>}
                    </span>
                  </div>

                  <div className="ld-rental-toggle">
                    <button
                      className={`ld-toggle-btn ${rentalType === 'hour' ? 'active' : ''}`}
                      onClick={() => { setRentalType('hour'); setDuration(1); }}
                    >Hourly</button>
                    <button
                      className={`ld-toggle-btn ${rentalType === 'day' ? 'active' : ''}`}
                      onClick={() => { setRentalType('day'); setDuration(1); }}
                    >Daily</button>
                  </div>

                  <div className="ld-duration">
                    <label className="input-label">Duration ({rentalType === 'hour' ? 'hours' : 'days'})</label>
                    <div className="ld-duration-controls">
                      <button className="ld-dur-btn" onClick={() => setDuration(d => Math.max(1, d - 1))}>−</button>
                      <span className="ld-dur-val">{duration}</span>
                      <button className="ld-dur-btn" onClick={() => setDuration(d => d + 1)}>+</button>
                    </div>
                  </div>

                  <div className="ld-total-row">
                    <span>Total</span>
                    <span className="ld-total-price">{formatPrice(rentalPrice)}</span>
                  </div>

                  <button
                    id="rent-btn"
                    className="btn btn-blue btn-lg"
                    style={{ width: '100%' }}
                    onClick={() => handleCheckout('rent')}
                    disabled={!isAvailable || purchasing}
                  >
                    {purchasing ? <div className="spinner spinner--sm" /> : isAvailable ? 'Proceed to Rent' : 'Currently Rented'}
                  </button>
                </div>
              )}

              {isRentable && isSellable && (
                <div className="ld-divider"><span>or</span></div>
              )}

              {/* Buy Section */}
              {isSellable && (
                <div className="ld-price-section">
                  <div className="ld-price-section__header">
                    <span className="ld-price-badge ld-price-badge--buy">Ownership</span>
                  </div>
                  <div className="ld-buy-price">{formatPrice(pBuy)}</div>
                  <button
                    id="buy-btn"
                    className="btn btn-primary btn-lg"
                    style={{ width: '100%' }}
                    onClick={() => handleCheckout('buy')}
                    disabled={purchasing || !isAvailable}
                  >
                    {purchasing ? <div className="spinner spinner--sm" /> : <><ShoppingCart size={16} />Buy Now</>}
                  </button>
                </div>
              )}

              {!isRentable && !isSellable && (
                <div className="ld-price-section" style={{ textAlign: 'center', opacity: 0.6 }}>
                  <p>This listing is currently inactive.</p>
                </div>
              )}

              <div className="ld-trust-row">
                <div className="ld-trust-item">
                  {seller.vaultStatus === 'verified' ? (
                    <>
                      <CheckCircle size={14} className="ld-trust-icon ld-trust-icon--green" />
                      <span>Admin Verified Listing</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} style={{ color: 'var(--accent-red)' }} />
                      <span>Unverified Listing</span>
                    </>
                  )}
                </div>
                <div className="ld-trust-item">
                  <ShieldCheck size={14} className="ld-trust-icon ld-trust-icon--blue" />
                  <span>Encrypted Credentials</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="spm-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="spm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="spm-header">
              <h3 className="spm-title">Complete Payment</h3>
              <button className="spm-icon-btn" onClick={() => setShowPaymentModal(false)}>×</button>
            </div>
            <form className="spm-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', aspectRatio: 'auto' }} onSubmit={handleFakePayment}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Enter any ID to simulate a {checkoutType} payment.
              </p>
              <div className="form-group">
                <label className="input-label">Payment ID</label>
                <input
                  className="input"
                  placeholder="e.g. TXN_123456"
                  value={paymentId}
                  onChange={e => setPaymentId(e.target.value)}
                  required
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={purchasing} style={{ width: '100%', marginTop: '8px' }}>
                {purchasing ? <div className="spinner spinner--sm" /> : 'Confirm Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Revealed Credentials */}
      {paid && (
        <div className="spm-overlay" onClick={() => setPaid(false)}>
          <div className="spm-modal animate-fade-in-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', border: '1px solid var(--accent-green)' }}>
            <div className="spm-header" style={{ borderBottom: '1px solid rgba(52, 211, 153, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck className="text-green-500" size={20} />
                <h3 className="spm-title">Account Credentials</h3>
              </div>
              <button className="spm-icon-btn" onClick={() => setPaid(false)}>×</button>
            </div>
            <div className="spm-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', aspectRatio: 'auto' }}>
              <div className="form-group">
                <label className="input-label" style={{ color: 'var(--accent-green)' }}>Username / Riot ID</label>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <code style={{ fontSize: '1.1rem' }}>{listing.username || 'Loading...'}</code>
                  <button className="btn btn-sm btn-ghost" onClick={() => { navigator.clipboard.writeText(listing.username); showToast('Copied!', 'success'); }}>Copy</button>
                </div>
              </div>
              <div className="form-group">
                <label className="input-label" style={{ color: 'var(--accent-green)' }}>Password</label>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <code style={{ fontSize: '1.1rem' }}>{decryptedPassword}</code>
                  <button className="btn btn-sm btn-ghost" onClick={() => { navigator.clipboard.writeText(decryptedPassword); showToast('Copied!', 'success'); }}>Copy</button>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                ⚠️ Do not share these credentials. Change them after logging in if possible.
              </p>
            </div>
            <div className="spm-footer">
               <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => setPaid(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Skin Preview Modal */}
      {selectedSkin && (
        <SkinPreviewModal skin={selectedSkin} onClose={() => setSelectedSkin(null)} />
      )}
    </div>
  );
}
