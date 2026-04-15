import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReveal, formatPrice } from '../hooks';
import ListingCard from '../components/ListingCard';
import { api } from '../services/api';
import './Landing.css';

function StatCard({ value, label, delay }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} className={`stat-card ${visible ? 'visible' : ''}`} style={{ transitionDelay: `${delay}s` }}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function TrustItem({ icon, title, desc, delay }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} className={`trust-item ${visible ? 'visible' : ''}`} style={{ transitionDelay: `${delay}s` }}>
      <div className="trust-icon">{icon}</div>
      <h4>{title}</h4>
      <p>{desc}</p>
    </div>
  );
}

function HowCard({ item, index }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} className={`how-card ${visible ? 'visible' : ''}`} style={{ transitionDelay: `${index * 0.15}s` }}>
      <div className="how-step">{item.step}</div>
      <div className="how-icon">{item.icon}</div>
      <h3>{item.title}</h3>
      <p>{item.desc}</p>
    </div>
  );
}

export default function Landing() {
  const [featuredListings, setFeaturedListings] = useState([]);
  const [stats, setStats] = useState({ users: 0, trades: 0, volume: 0 });
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [listingsData, statsData] = await Promise.all([
          api.getListings(),
          api.getPlatformStats()
        ]);
        if (listingsData && listingsData.listings) {
          setFeaturedListings(listingsData.listings.slice(0, 5));
        }
        if (statsData) {
          setStats({
            users: statsData.users || 0,
            trades: statsData.trades || 0,
            volume: statsData.volume || 0
          });
        }
      } catch (err) {
        console.error('Landing page data fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const howItems = [
    { step: '01', title: 'Browse & Select', desc: 'Explore our curated marketplace. Filter by rank, skins, price, and region.', icon: '🔍' },
    { step: '02', title: 'Rent or Buy', desc: 'Choose hourly rental or outright purchase. All prices in ₹ INR with instant delivery.', icon: '💳' },
    { step: '03', title: 'Play & Enjoy', desc: 'Access your account instantly. Real-time countdown, auto-return on rental end.', icon: '🎮' },
  ];

  return (
    <div className="landing">
      {/* Loading Overlay */}
      {loading && (
        <div className="landing-loading">
          <div className="spinner"></div>
          <p>Initializing VaultSkins India...</p>
        </div>
      )}

      {/* ═══ Hero Section ═══ */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-gradient-1" />
          <div className="hero-gradient-2" />
          <div className="hero-grid" />
        </div>

        <div className="hero-content container">
          <div className="hero-badge animate-fade-in-up">
            <span className="status-dot active" />
            India's #1 Valorant Marketplace
          </div>

          <h1 className="hero-title animate-fade-in-up stagger-1">
            Rent & Trade Valorant Accounts
            <br />
            <span className="text-gradient">Secure. Instant. Trusted.</span>
          </h1>

          <p className="hero-subtitle animate-fade-in-up stagger-2">
            Access premium Valorant accounts with rare skins, top ranks, and instant delivery.
            <br />Powered by trust. Priced in ₹ INR.
          </p>

          <div className="hero-actions animate-fade-in-up stagger-3">
            <Link to="/marketplace" className="btn btn-primary btn-lg" id="hero-cta-explore">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              Explore Marketplace
            </Link>
            <Link to="/seller" className="btn btn-secondary btn-lg" id="hero-cta-sell">
              Sell Your Account
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="hero-stats animate-fade-in-up stagger-4">
            <div className="hero-stat">
              <span className="hero-stat-val">{stats.users.toLocaleString()}</span>
              <span className="hero-stat-label">Active Users</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-val">{stats.trades.toLocaleString()}</span>
              <span className="hero-stat-label">Trades Done</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-val">98.7%</span>
              <span className="hero-stat-label">Trust Score</span>
            </div>
          </div>
        </div>

        <div className="hero-scroll-indicator animate-fade-in stagger-5">
          <div className="scroll-mouse">
            <div className="scroll-wheel" />
          </div>
          <span>Scroll to explore</span>
        </div>
      </section>

      {/* ═══ Featured Listings ═══ */}
      <section className="section featured-section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2 className="section-title">Featured Accounts</h2>
              <p className="section-subtitle">Hand-picked premium listings with verified sellers</p>
            </div>
            <Link to="/marketplace" className="btn btn-ghost btn-sm">
              View All
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="featured-scroll" ref={scrollRef}>
          <div className="featured-scroll-inner">
            {featuredListings.length === 0 ? (
              <div className="mp-empty" style={{ width: '100%' }}>
                <div className="mp-empty-icon">📁</div>
                <h3>No Listings Yet</h3>
                <p>Be the first to create a listing.</p>
              </div>
            ) : (
              featuredListings.map((listing, i) => (
                <div className="featured-card-wrapper" key={listing.id}>
                  <ListingCard listing={listing} index={i} featured />
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ═══ Platform Stats ═══ */}
      <section className="section stats-section">
        <div className="container">
          <div className="section-header section-header--center">
            <h2 className="section-title">The Numbers Speak</h2>
            <p className="section-subtitle">Trusted by thousands of Indian gamers</p>
          </div>

          <div className="stats-grid">
            <StatCard value={stats.users.toLocaleString()} label="Active Users" delay={0} />
            <StatCard value={stats.trades.toLocaleString()} label="Successful Trades" delay={0.1} />
            <StatCard value="98.7%" label="Trust Score" delay={0.2} />
            <StatCard value={formatPrice(stats.volume)} label="Total Volume" delay={0.3} />
          </div>
        </div>
      </section>

      {/* ═══ How It Works ═══ */}
      <section className="section how-section">
        <div className="container">
          <div className="section-header section-header--center">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">Three simple steps to get started</p>
          </div>

          <div className="how-grid">
            {howItems.map((item, i) => (
              <HowCard key={i} item={item} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Trust Indicators ═══ */}
      <section className="section trust-section">
        <div className="container">
          <div className="section-header section-header--center">
            <h2 className="section-title">Why VaultSkins?</h2>
            <p className="section-subtitle">Built for security, speed, and reliability</p>
          </div>

          <div className="trust-grid">
            <TrustItem icon="🔒" title="Escrow Protection" desc="Funds held securely until both parties confirm. Zero risk." delay={0} />
            <TrustItem icon="⚡" title="Instant Delivery" desc="Access credentials delivered in seconds. No waiting." delay={0.1} />
            <TrustItem icon="🛡️" title="Verified Sellers" desc="Multi-layer verification. Only trusted sellers on our platform." delay={0.2} />
            <TrustItem icon="💬" title="24/7 Support" desc="Round-the-clock moderation and dispute resolution." delay={0.3} />
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="section cta-section">
        <div className="container">
          <div className="cta-card">
            <div className="cta-bg" />
            <h2>Ready to level up?</h2>
            <p>Join thousands of Indian gamers trading securely on VaultSkins.</p>
            <div className="cta-actions">
              <Link to="/marketplace" className="btn btn-primary btn-lg">Start Trading</Link>
              <Link to="/seller" className="btn btn-secondary btn-lg">Become a Seller</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="navbar-logo">
                <div className="logo-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span className="logo-text">Vault<span className="logo-accent">Skins</span></span>
              </div>
              <p>India's premier Valorant account marketplace. Secure. Trusted. Instant.</p>
            </div>
            <div className="footer-links">
              <h4>Platform</h4>
              <Link to="/marketplace">Marketplace</Link>
              <Link to="/seller">Sell Account</Link>
              <Link to="/dashboard">Dashboard</Link>
            </div>
            <div className="footer-links">
              <h4>Support</h4>
              <a href="#">Help Center</a>
              <a href="#">Trust & Safety</a>
              <a href="#">Contact Us</a>
            </div>
            <div className="footer-links">
              <h4>Legal</h4>
              <a href="#">Terms of Service</a>
              <a href="#">Privacy Policy</a>
              <a href="#">Refund Policy</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2025 VaultSkins. All rights reserved.</span>
            <span>Made with ❤️ in India</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
