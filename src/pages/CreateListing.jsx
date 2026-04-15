import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { api } from '../services/api';
import SkinSelector from '../components/SkinSelector';
import { RANKS, REGIONS } from '../data';
import {
  ShieldCheck, ArrowLeft, AlertTriangle, ImageIcon, DollarSign, Lock
} from 'lucide-react';
import './CreateListing.css';
import CryptoJS from 'crypto-js';

const SECRET_KEY = "vaultskins-secret";

const LISTING_TYPES = [
  { value: 'both', label: 'Rent & Sell' },
  { value: 'rent', label: 'Rent Only' },
  { value: 'sale', label: 'Sell Only' },
];

export default function CreateListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    rank: 'Gold',
    region: 'Mumbai',
    listing_type: 'both',
    username: '',
    password: '',
    contactEmail: '',
    contactSocial: '',
    rent_price_hour: '',
    rent_price_day: '',
    buy_price: '',
    skins: [],
    imageUrl: '',
  });

  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const showRent = form.listing_type === 'rent' || form.listing_type === 'both';
  const showBuy  = form.listing_type === 'sale' || form.listing_type === 'both';

  const validate = () => {
    if (!form.title.trim())    { showToast('Title is required', 'error'); return false; }
    if (!form.username.trim()) { showToast('Riot ID is required', 'error'); return false; }
    if (!form.password.trim()) { showToast('Riot Password is required', 'error'); return false; }

    const rh = parseFloat(form.rent_price_hour) || 0;
    const rd = parseFloat(form.rent_price_day)  || 0;
    const bp = parseFloat(form.buy_price)        || 0;

    if (rh < 0 || rd < 0 || bp < 0) {
      showToast('Prices cannot be negative', 'error'); return false;
    }
    if (showRent && rh <= 0 && rd <= 0) {
      showToast('Set at least one rental price', 'error'); return false;
    }
    if (showBuy && bp <= 0) {
      showToast('Buy price is required', 'error'); return false;
    }
    if (!termsAccepted) {
      showToast('You must accept the Terms & Conditions', 'error'); return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Encrypt the password before sending
      const encryptedPassword = CryptoJS.AES.encrypt(form.password, SECRET_KEY).toString();

      const payload = {
        title:          form.title,
        description:    form.description,
        rank:           form.rank,
        region:         form.region,
        mode:           form.listing_type,
        username:       form.username,
        password:       encryptedPassword,
        contactEmail:   form.contactEmail,
        contactSocial:  form.contactSocial,
        priceRentHr:    parseFloat(form.rent_price_hour) || 0,
        priceRentDay:   parseFloat(form.rent_price_day)  || 0,
        priceBuy:       parseFloat(form.buy_price)       || 0,
        skins:          form.skins.map(s => s.uuid),
        imageUrl:       form.imageUrl,
        terms_accepted: true,
      };

      const res = await api.submitListing(payload);
      if (res.success || res.listing) {
        showToast('Listing submitted for review!', 'success');
        navigate('/seller');
      } else {
        showToast('Submission failed: ' + (res.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Server error. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-listing-page">
      <div className="container">
        <button className="btn btn-ghost cl-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="cl-header animate-fade-in-up">
          <h1>Create Listing</h1>
          <p className="cl-subtitle">List your Valorant account for rent or sale</p>
        </div>

        <form className="cl-form animate-fade-in-up stagger-1" onSubmit={handleSubmit}>

          {/* ── Section: Account Details ──────────────────── */}
          <section className="cl-section">
            <h3 className="cl-section-title">
              <ShieldCheck size={16} className="cl-section-icon" />
              Account Details
            </h3>

            <div className="cl-grid">
              <div className="form-group cl-full">
                <label className="input-label">Listing Title *</label>
                <input
                  id="cl-title"
                  className="input"
                  placeholder="e.g. Radiant Account with Phantom Collection"
                  value={form.title}
                  onChange={e => update('title', e.target.value)}
                  required
                />
              </div>

              <div className="form-group cl-full">
                <label className="input-label">Description</label>
                <textarea
                  id="cl-description"
                  className="input cl-textarea"
                  rows={3}
                  placeholder="Describe the account, featured skins, agents unlocked..."
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="input-label">Rank *</label>
                <select
                  id="cl-rank"
                  className="select"
                  value={form.rank}
                  onChange={e => update('rank', e.target.value)}
                >
                  {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="input-label">Region</label>
                <select
                  id="cl-region"
                  className="select"
                  value={form.region}
                  onChange={e => update('region', e.target.value)}
                >
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* ── Section: Credentials ─────────────────────── */}
          <section className="cl-section">
            <h3 className="cl-section-title">
              <Lock size={16} className="cl-section-icon" />
              Account Credentials
              <span className="cl-section-badge">Encrypted &amp; Secure</span>
            </h3>
            <div className="cl-grid">
              <div className="form-group">
                <label className="input-label">Riot ID / Username *</label>
                <input
                  id="cl-username"
                  className="input"
                  placeholder="Username#Tag"
                  value={form.username}
                  onChange={e => update('username', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="input-label">Riot Password *</label>
                <input
                  id="cl-password"
                  className="input"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="input-label">Contact Email</label>
                <input
                  id="cl-contact-email"
                  className="input"
                  type="email"
                  placeholder="email@example.com"
                  value={form.contactEmail}
                  onChange={e => update('contactEmail', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="input-label">Discord / Social (optional)</label>
                <input
                  id="cl-contact-social"
                  className="input"
                  placeholder="@username"
                  value={form.contactSocial}
                  onChange={e => update('contactSocial', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ── Section: Listing Type + Pricing ──────────── */}
          <section className="cl-section">
            <h3 className="cl-section-title">
              <DollarSign size={16} className="cl-section-icon" />
              Listing Type &amp; Pricing
            </h3>

            <div className="cl-type-toggle">
              {LISTING_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  id={`cl-type-${t.value}`}
                  className={`cl-type-btn ${form.listing_type === t.value ? 'cl-type-btn--active' : ''}`}
                  onClick={() => update('listing_type', t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="cl-grid cl-pricing-grid">
              {showRent && (
                <>
                  <div className="form-group">
                    <label className="input-label">Rent / Hour (₹)</label>
                    <input
                      id="cl-rent-hour"
                      className="input"
                      type="number"
                      placeholder="0"
                      value={form.rent_price_hour}
                      onChange={e => update('rent_price_hour', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="input-label">Rent / Day (₹)</label>
                    <input
                      id="cl-rent-day"
                      className="input"
                      type="number"
                      placeholder="0"
                      value={form.rent_price_day}
                      onChange={e => update('rent_price_day', e.target.value)}
                    />
                  </div>
                </>
              )}
              {showBuy && (
                <div className="form-group">
                  <label className="input-label">Buy Price (₹)</label>
                  <input
                    id="cl-buy-price"
                    className="input"
                    type="number"
                    placeholder="0"
                    value={form.buy_price}
                    onChange={e => update('buy_price', e.target.value)}
                  />
                </div>
              )}
            </div>
          </section>

          {/* ── Section: Skins ───────────────────────────── */}
          <section className="cl-section">
            <h3 className="cl-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="cl-section-icon">
                <path d="M12 2v20M2 12h20" />
              </svg>
              Featured Skins
            </h3>
            <p className="cl-section-desc">Search and select skins that showcase this account.</p>
            <SkinSelector
              selectedSkins={form.skins}
              onSkinsChange={skins => update('skins', skins)}
            />
          </section>

          {/* ── Section: Thumbnail ───────────────────────── */}
          <section className="cl-section">
            <h3 className="cl-section-title">
              <ImageIcon size={16} className="cl-section-icon" />
              Hero Image (optional)
            </h3>

            <div className="cl-thumbnail-wrap">
              <div className="form-group cl-full">
                <label className="input-label" htmlFor="cl-image-url">Image URL</label>
                <input
                  id="cl-image-url"
                  className="input"
                  placeholder="https://example.com/image.jpg"
                  value={form.imageUrl}
                  onChange={e => update('imageUrl', e.target.value)}
                />
              </div>

              {form.imageUrl && (
                <div className="cl-thumbnail-preview">
                  <p className="input-label" style={{ marginBottom: 8 }}>Preview</p>
                  <div className="cl-thumbnail-frame">
                    <img
                      src={form.imageUrl}
                      alt="Thumbnail preview"
                      className="cl-thumbnail-img"
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                    <div className="cl-thumbnail-error" style={{ display: 'none' }}>
                      <ImageIcon size={24} />
                      <span>Invalid image URL</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Section: Terms ───────────────────────────── */}
          <section className="cl-section cl-terms-section">
            <div className="cl-terms-box">
              <div className="cl-terms-header">
                <AlertTriangle size={18} className="cl-terms-icon" />
                <strong>Terms &amp; Conditions</strong>
              </div>
              <p className="cl-terms-text">
                By listing your account, you agree that VaultSkins is not responsible for any
                scams, disputes, or losses. Verification does not guarantee safety. You accept all
                risks associated with account trading. Providing false information may result in
                permanent ban from the platform.
              </p>
              <label className="cl-terms-check" htmlFor="cl-terms-checkbox">
                <input
                  type="checkbox"
                  id="cl-terms-checkbox"
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                />
                <span>I have read and accept the Terms &amp; Conditions</span>
              </label>
            </div>
          </section>

          {/* Submit */}
          <div className="cl-submit-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
            <button
              id="submit-listing-btn"
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !termsAccepted}
            >
              {submitting ? (
                <>
                  <div className="spinner spinner--sm" />
                  Submitting...
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  Submit for Review
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
