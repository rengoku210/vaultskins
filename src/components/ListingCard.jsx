import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../hooks';
import { api } from '../services/api';
import './ListingCard.css';

const rankBadgeClass = {
  'Radiant': 'badge-radiant',
  'Immortal': 'badge-immortal',
  'Ascendant': 'badge-ascendant',
  'Diamond': 'badge-diamond',
  'Platinum': 'badge-platinum',
  'Gold': 'badge-gold',
};

const statusBadgeClass = {
  'available': 'badge-available',
  'rented': 'badge-rented',
  'sold': 'badge-sold',
};

export default function ListingCard({ listing, index = 0, featured = false }) {
  const {
    id, title, rank, rankTier = 0, skins = [], skinCount = 0,
    price_rent_hr, price_rent_day, price_buy,
    priceRentHour, priceRentDay, priceBuy,
    seller, is_active, status: propStatus, region,
    image_url, imageUrl
  } = listing;

  const [resolvedSkins, setResolvedSkins] = useState([]);
  
  // Thumbnail Fallback Logic
  const getDisplayImage = () => {
    // 1. Explicit Hero Image
    if (image_url || imageUrl) return image_url || imageUrl;
    
    // 2. Fallback to skin icon if available
    const firstSkinIcon = resolvedSkins.find(s => typeof s === 'object' && s.displayIcon)?.displayIcon;
    
    // 3. Fallback to URL in description if present
    const descUrl = (listing.description && listing.description.startsWith('http')) ? listing.description : null;
    
    // Logic: If there's a description URL, use it UNLESS we have a skin icon that is NOT a placeholder?
    // Actually, if the user puts a URL in description, they probably want it as the preview.
    if (descUrl) return descUrl;
    if (firstSkinIcon) return firstSkinIcon;

    return 'https://via.placeholder.com/600x400/15151e/34d399?text=VaultSkins+Valorant';
  };

  const displayImage = getDisplayImage();
  const [imgSrc, setImgSrc] = useState(displayImage);

  useEffect(() => {
    setImgSrc(getDisplayImage());
  }, [listing, resolvedSkins]);

  const handleImgError = () => {
    const fallback = resolvedSkins.find(s => typeof s === 'object' && s.displayIcon)?.displayIcon || 'https://via.placeholder.com/600x400/15151e/34d399?text=VaultSkins+Valorant';
    if (imgSrc !== fallback) {
      setImgSrc(fallback);
    }
  };

  useEffect(() => {
    const resolveTags = () => {
      const cacheData = localStorage.getItem('valorant_skins_cache');
      let allSkins = [];
      if (cacheData) {
        try {
          allSkins = JSON.parse(cacheData).skins || [];
        } catch (e) {
          console.error("Failed to parse skin cache", e);
        }
      }

      const resolved = skins.map(s => {
        // Case 1: Backend already resolved it to an object {uuid, displayName, displayIcon}
        if (typeof s === 'object' && s !== null) return s;
        
        // Case 2: It's a UUID string, try to resolve from local cache
        if (typeof s === 'string' && s.length > 20) {
          const match = allSkins.find(as => as.uuid === s);
          return match || s;
        }
        
        // Case 3: It's a display name string, try to resolve from local cache
        if (typeof s === 'string') {
          const match = allSkins.find(as => as.displayName.toLowerCase() === s.toLowerCase());
          return match || s;
        }
        return s;
      });
      setResolvedSkins(resolved);
    };

    resolveTags();
    window.addEventListener('valorant_cache_ready', resolveTags);
    return () => window.removeEventListener('valorant_cache_ready', resolveTags);
  }, [skins]);

  // Use backend names or fallback to props
  const pRentHr = price_rent_hr || priceRentHour || 0;
  const pRentDay = price_rent_day || priceRentDay || 0;
  const pBuy = price_buy || priceBuy || 0;
  const isRentable = listing.is_rentable === 0 ? false : (listing.is_rentable || pRentHr > 0);
  const isSellable = listing.is_sellable === 0 ? false : (listing.is_sellable || pBuy > 0);
  const status = propStatus || (listing.is_active === 0 ? 'rented' : 'available');

  // Default seller if missing
  const displaySeller = seller || { name: 'VaultSeller', rating: 4.8, trades: 12, verified: true, avatar: '🛡️' };

  return (
    <Link
      to={`/account/${id}`}
      className={`listing-card ${featured ? 'listing-card--featured' : ''} listing-card--has-image`}
      style={{ animationDelay: `${index * 0.08}s` }}
      id={`listing-${id}`}
    >
      {/* Hero Image Section */}
      <div className="listing-card__hero">
        <img src={imgSrc} alt={title} loading="lazy" onError={handleImgError} />
        <div className="hero-overlay" />
      </div>

      {/* Top section — rank + skins preview */}
      <div className="listing-card__header">
        <div className="listing-card__rank-area">
          <span className={`badge ${rankBadgeClass[rank] || ''}`}>
            {rank} {rankTier > 0 ? rankTier : ''}
          </span>
          <span className={`badge ${statusBadgeClass[status]}`}>
            {status === 'available' ? '● Available' : status === 'rented' ? '◐ Rented' : '✕ Sold'}
          </span>
        </div>
        <div className="listing-card__region">{region}</div>
      </div>

      {/* Skin strip */}
      <div className="listing-card__skin-strip">
        {resolvedSkins.slice(0, 4).map((skin, i) => (
          <div key={i} className="skin-chip skin-chip--iconic">
            {typeof skin === 'object' ? (
              <img src={skin.displayIcon} alt={skin.displayName} title={skin.displayName} />
            ) : (
              <span>{skin}</span>
            )}
          </div>
        ))}
        {(skinCount || skins.length) > 4 && <div className="skin-chip skin-chip--more">+{(skinCount || skins.length) - 4} more</div>}
      </div>

      {/* Title + description */}
      <div className="listing-card__body">
        <h3 className="listing-card__title">{title}</h3>
        <p className="listing-card__meta">{(skinCount || skins.length)} skins · Level {listing.level || 100}</p>
      </div>

      <div className="listing-card__pricing">
        {isRentable && (
          <div className="price-block">
            <span className="price-label">Rent</span>
            <div className="price-values">
              <span className="price-tag">{formatPrice(pRentHr)}<small>/hr</small></span>
              <span className="price-divider">·</span>
              <span className="price-tag">{formatPrice(pRentDay)}<small>/day</small></span>
            </div>
          </div>
        )}
        {isSellable && (
          <div className="price-block price-block--buy">
            <span className="price-label">Buy</span>
            <span className="price-tag price-tag--buy">{formatPrice(pBuy)}</span>
          </div>
        )}
        {!isRentable && !isSellable && (
          <div className="price-block">
            <span className="price-label">Status</span>
            <span className="price-tag" style={{ color: 'var(--text-muted)' }}>Inactive</span>
          </div>
        )}
      </div>

      {/* Footer — seller info */}
      <div className="listing-card__footer">
        <div className="seller-info">
          <span className="seller-avatar">{displaySeller.avatar}</span>
          <span className="seller-name">{displaySeller.name}</span>
          {displaySeller.verified && <span className="verified-badge" title="Verified Seller">✓</span>}
        </div>
        <div className="seller-rating">
          <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span>{displaySeller.rating}</span>
          <span className="seller-trades">({displaySeller.trades})</span>
        </div>
      </div>

      {/* Hover glow border */}
      <div className="listing-card__glow" />
    </Link>
  );
}
