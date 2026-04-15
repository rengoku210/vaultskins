import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Flame, AlertCircle } from 'lucide-react';
import { formatPrice } from '../hooks';
import { api, socket } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import SkinViewer from '../components/SkinViewer';
import { analytics } from '../services/firebase';
import { logEvent } from 'firebase/analytics';
import './AccountDetail.css';

const rankBadgeClass = {
  'Radiant': 'badge-radiant',
  'Immortal': 'badge-immortal',
  'Ascendant': 'badge-ascendant',
  'Diamond': 'badge-diamond',
  'Platinum': 'badge-platinum',
  'Gold': 'badge-gold',
};

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotifications();
  
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rentalType, setRentalType] = useState('day');
  const [rentalDuration, setRentalDuration] = useState(1);
  const [activeTab, setActiveTab] = useState('skins');
  const [viewers, setViewers] = useState(1);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [heroImgSrc, setHeroImgSrc] = useState(null);
  const [descImgSrc, setDescImgSrc] = useState(null);

  useEffect(() => {
    fetchListing();
    setViewers(Math.floor(Math.random() * 10) + 3);

    socket.on('rental_started', (data) => {
      setListing(prev => {
        if (prev && prev.id === data.listingId) {
           return { ...prev, is_active: 0 };
        }
        return prev;
      });
    });

    return () => socket.off('rental_started');
  }, [id]);

  const fetchListing = async () => {
    try {
      setLoading(true);
      const data = await api.getListingById(id);
      const l = data.listing || data;
      setListing(l);
      setHeroImgSrc(l.image_url || l.imageUrl || (l.skins && l.skins.length > 0 ? `https://media.valorant-api.com/weaponskinlevels/${l.skins[0]}/displayicon.png` : 'https://via.placeholder.com/1200x400/15151e/34d399?text=VaultSkins+Valorant'));
      if (l.description && l.description.startsWith('http')) {
        setDescImgSrc(l.description);
      }
      if (analytics && data) {
         logEvent(analytics, 'view_item', {
           currency: 'INR',
           value: data.price_buy || data.priceBuy,
           items: [{ item_id: data.id, item_name: data.title }]
         });
      }
    } catch (err) {
      console.error('Failed to fetch listing', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (type) => {
    if (!user) {
      showToast('Please login to continue.', 'error');
      // Trigger login modal effectively by navigating to a place that might show it 
      // or just expect the user to click login in the navbar.
      return;
    }

    const amount = type === 'buy' 
      ? (listing.price_buy || listing.priceBuy)
      : rentalPrice;

    setIsProcessingPayment(true);

    // Simulate Fake Payment Flow
    setTimeout(async () => {
      const payload = {
        listingId: listing.id,
        type,
        durationHours: type === 'rent' ? (rentalType === 'hour' ? rentalDuration : rentalDuration * 24) : 0,
        amount
      };

      try {
        const res = await api.checkout(payload);
        if (res.success) {
          if (analytics) {
            logEvent(analytics, type === 'buy' ? 'purchase' : 'rental_checkout', {
               currency: 'INR',
               value: amount,
               transaction_id: res.txId || payload.listingId,
               items: [{ item_id: listing.id, item_name: listing.title }]
            });
          }
          showToast(type === 'buy' ? 'Payment Verified! Purchase Successful!' : 'Payment Verified! Rental Started!', 'success');
          navigate('/dashboard');
        } else {
          showToast('Checkout failed: ' + res.error, 'error');
        }
      } catch (err) {
        showToast('Server error during checkout.', 'error');
      } finally {
        setIsProcessingPayment(false);
      }
    }, 2000); 
  };

  const rentalPrice = useMemo(() => {
    if (!listing) return 0;
    const rate = rentalType === 'hour' 
      ? (listing.price_rent_hr || listing.priceRentHour) 
      : (listing.price_rent_day || listing.priceRentDay);
    return rate * rentalDuration;
  }, [rentalType, rentalDuration, listing]);

  if (loading) return <div className="detail-page container" style={{paddingTop: 100}}>Syncing with secure server...</div>;
  if (!listing) return <div className="detail-page container">Account not found</div>;

  const {
    title, rank, rankTier = 0, skins = [], skinCount, 
    price_buy, price_rent_hr, price_rent_day,
    priceBuy, priceRentHour, priceRentDay,
    status: propStatus, region, description, level = 100
  } = listing;

  const status = propStatus || (listing.is_active === 0 ? 'rented' : 'available');
  const seller = listing.seller || { name: 'VaultSeller', rating: 4.8, trades: 12, verified: true, avatar: '🛡️' };

  return (
    <div className="detail-page">
      <div className="container">
        <nav className="detail-breadcrumb">
          <Link to="/marketplace">Marketplace</Link>
          <span>/</span>
          <span>{title}</span>
        </nav>

        {/* Hero Section */}
        <div className="detail-hero">
          <img 
            src={heroImgSrc} 
            alt={title} 
            className="detail-hero-img" 
            onError={() => setHeroImgSrc('https://via.placeholder.com/1200x400/15151e/34d399?text=VaultSkins+Valorant')}
          />
          <div className="detail-hero-overlay"></div>
        </div>

        <div className="detail-layout">
          <div className="detail-left">
            <div className="detail-header-badges">
              <span className={`badge ${rankBadgeClass[rank] || ''}`}>
                {rank} {rankTier > 0 ? rankTier : ''}
              </span>
              <span className={`badge ${status === 'available' ? 'badge-available' : 'badge-rented'}`}>
                {status === 'available' ? '● Available' : '◐ Rented'}
              </span>
              <span className="tag verified-tag">
                <ShieldCheck size={14} style={{ marginRight: 4 }}/> Admin Verified
              </span>
              <span className="tag hot-tag">
                <Flame size={14} style={{ marginRight: 4 }}/> {viewers} viewing
              </span>
            </div>

            <h1 className="detail-title">{title}</h1>
            {description && (description.startsWith('http') && description.length < 200) ? (
              <div className="detail-desc-image">
                <img 
                  src={descImgSrc} 
                  alt="Preview" 
                  style={{ maxWidth: '100%', borderRadius: 8, marginTop: 12 }} 
                  onError={() => {
                    setDescImgSrc(null); // Fallback to hidden if bad URL in desc
                  }}
                />
              </div>
            ) : (
              <p className="detail-desc">{description}</p>
            )}

            <div className="detail-quick-stats">
              <div className="quick-stat">
                <span className="quick-stat-val">{skinCount || skins.length}</span>
                <span className="quick-stat-label">Skins</span>
              </div>
              <div className="quick-stat">
                <span className="quick-stat-val">{level}</span>
                <span className="quick-stat-label">Level</span>
              </div>
            </div>

            <div className="detail-tabs">
              <button className={`detail-tab ${activeTab === 'skins' ? 'active' : ''}`} onClick={() => setActiveTab('skins')}>Skins Preview</button>
            </div>

            {activeTab === 'skins' && (
              <SkinViewer skinNames={skins} />
            )}
          </div>

          <div className="detail-right">
            <div className="pricing-panel">
              <h3 className="pricing-title">Instant Access</h3>

              {listing.is_rentable !== 0 && (
                <div className="pricing-section">
                  <div className="pricing-section-header">
                    <span className="pricing-badge rent">Rent</span>
                    <span className="pricing-rates">
                      {formatPrice(price_rent_hr || priceRentHour)}/hr
                    </span>
                  </div>

                  <div className="rental-selector">
                    <div className="rental-type-toggle">
                      <button className={`toggle-opt ${rentalType === 'hour' ? 'active' : ''}`} onClick={() => { setRentalType('hour'); setRentalDuration(1); }}>Hourly</button>
                      <button className={`toggle-opt ${rentalType === 'day' ? 'active' : ''}`} onClick={() => { setRentalType('day'); setRentalDuration(1); }}>Daily</button>
                    </div>

                    <div className="duration-picker">
                      <label className="input-label">Duration ({rentalType === 'hour' ? 'hours' : 'days'})</label>
                      <div className="duration-controls">
                        <button className="dur-btn" onClick={() => setRentalDuration(Math.max(1, rentalDuration - 1))}>−</button>
                        <span className="dur-value">{rentalDuration}</span>
                        <button className="dur-btn" onClick={() => setRentalDuration(rentalDuration + 1)}>+</button>
                      </div>
                    </div>

                    <div className="rental-total">
                      <span>Total</span>
                      <span className="rental-total-price">{formatPrice(rentalPrice)}</span>
                    </div>

                    <button 
                      className="btn btn-blue btn-lg" 
                      style={{ width: '100%', position: 'relative' }} 
                      onClick={() => handleCheckout('rent')}
                      disabled={status !== 'available' || isProcessingPayment}
                    >
                      {isProcessingPayment ? <div className="spinner spinner--sm"></div> : status === 'available' ? 'Proceed to Pay' : 'Currently Rented'}
                    </button>
                  </div>
                </div>
              )}

              {listing.is_rentable !== 0 && listing.is_sellable !== 0 && (
                <div className="pricing-divider"><span>or</span></div>
              )}

              {listing.is_sellable !== 0 && (
                <div className="pricing-section">
                  <div className="pricing-section-header">
                    <span className="pricing-badge buy">Ownership</span>
                  </div>
                  <div className="buy-price">{formatPrice(price_buy || priceBuy)}</div>
                  <button className="btn btn-primary btn-lg" style={{ width: '100%', position: 'relative' }} onClick={() => handleCheckout('buy')} disabled={isProcessingPayment || status !== 'available'}>
                    {isProcessingPayment ? <div className="spinner spinner--sm"></div> : 'Proceed to Pay (Buy)'}
                  </button>
                </div>
              )}

              {listing.is_rentable === 0 && listing.is_sellable === 0 && (
                <div className="pricing-section" style={{ textAlign: 'center', opacity: 0.6 }}>
                   <p>This listing is currently inactive.</p>
                </div>
              )}
            </div>

            {/* Seller Info */}
            <div className="seller-panel">
              <h4>Seller Information</h4>
              <div className="seller-profile">
                <div className="seller-avatar-large">{seller.avatar}</div>
                <div className="seller-details">
                  <div className="seller-name-row">
                    <span className="seller-name-lg">{seller.name}</span>
                    {seller.verified && <span className="verified-badge">✓ Verified</span>}
                  </div>
                  <div className="seller-meta">
                    <span className="seller-rating-lg">★ {seller.rating}</span>
                    <span>{seller.trades} trades</span>
                  </div>
                  <div className="seller-trust-metrics" style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: '0.8rem', color: 'var(--border-strong)' }}>
                    <span title="Seller Uptime Score">🔼 {seller.uptime_score || 99.8}% Uptime</span>
                    <span title="Account Rental History">🔄 {listing.total_rentals || 0} Auto-Rentals</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
