import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useScrollProgress } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { auth } from '../services/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const progress = useScrollProgress();
  const { user, logout, login, loginWithFirebase, register, isAdmin } = useAuth();
  const { notifications, unreadCount, markAsRead, showToast } = useNotifications();
  
  const [scrolled, setScrolled] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [signupStep, setSignupStep] = useState('email'); // 'email', 'otp', 'details'
  
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [countdown, setCountdown] = useState(0);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const isActive = (path) => location.pathname === path;

  const resetModal = () => {
    setShowLoginModal(false);
    setAuthMode('login');
    setSignupStep('email');
    setEmail('');
    setPassword('');
    setOtp('');
    setUsername('');
    setCountdown(0);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        resetModal();
        showToast('Welcome back!', 'success');
        navigate('/dashboard');
      } else {
        showToast(result.error, 'error');
      }
    } catch (err) {
      showToast('Login failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.requestEmailOtp(email);
      if (res.success) {
        setSignupStep('otp');
        setCountdown(30);
        showToast('Verification code sent!', 'success');
      } else {
        showToast(res.error, 'error');
      }
    } catch (err) {
      showToast('Failed to connect to server', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.verifyEmailOtp(email, otp);
      if (res.success) {
        setSignupStep('details');
        showToast('Email verified!', 'success');
      } else {
        showToast(res.error, 'error');
      }
    } catch (err) {
      showToast('Verification failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await register({ username, email, password });
      if (res.success) {
        resetModal();
        showToast('Account created! Welcome 🎮', 'success');
        navigate('/dashboard');
      } else {
        showToast(res.error, 'error');
      }
    } catch (err) {
      showToast('Registration failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsFirebaseLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();
      const res = await loginWithFirebase(token);
      if (res.success) {
         resetModal();
         showToast('Login successful', 'success');
         navigate('/dashboard');
      } else {
         showToast(res.error, 'error');
      }
    } catch (err) {
      console.error("Google Sign-In Error:", err);
      if (err.code !== 'auth/popup-closed-by-user') {
         showToast(`Google Sign-In failed: ${err.message}`, 'error');
      }
    } finally {
      setIsFirebaseLoading(false);
    }
  };

  return (
    <>
      <div className="scroll-progress" style={{ width: `${progress}%` }} />

      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-inner">
          <Link to="/" className="navbar-logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="logo-text">Vault<span className="logo-accent">Skins</span></span>
          </Link>

          <div className="navbar-links">
            <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>Home</Link>
            <Link to="/marketplace" className={`nav-link ${isActive('/marketplace') ? 'active' : ''}`}>Marketplace</Link>
            {user && <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>Dashboard</Link>}
            {user && <Link to="/seller" className={`nav-link ${isActive('/seller') ? 'active' : ''}`}>Seller</Link>}
            {isAdmin && <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>Admin</Link>}
          </div>

          <div className="navbar-actions">
            <div className="nav-dropdown-wrap" ref={notifRef}>
              <button className="nav-icon-btn" onClick={() => setNotifOpen(!notifOpen)} id="notif-toggle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>
              
              <AnimatePresence>
                {notifOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="nav-dropdown notif-dropdown"
                  >
                    <div className="dropdown-header">
                      <h3>Notifications</h3>
                      {unreadCount > 0 && <span className="unread-count">{unreadCount} new</span>}
                    </div>
                    <div className="dropdown-body">
                      {notifications.length === 0 ? (
                        <div className="empty-state">No notifications yet</div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                            onClick={() => !n.is_read && markAsRead(n.id)}
                          >
                            <div className={`notif-type-icon ${n.type}`}></div>
                            <div className="notif-content">
                              <p className="notif-title">{n.title}</p>
                              <p className="notif-msg">{n.message}</p>
                              <span className="notif-time">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {user ? (
              <div className="nav-user-wrap" ref={profileRef}>
                <button className="nav-avatar" onClick={() => setProfileOpen(!profileOpen)} id="avatar-toggle">
                  {user.profile_picture ? (
                     <img 
                       src={user.profile_picture} 
                       alt={user.username} 
                       style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                     />
                  ) : null}
                  <span style={{ display: user.profile_picture ? 'none' : 'flex' }}>
                    {user.username ? user.username[0].toUpperCase() : 'U'}
                  </span>
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="nav-dropdown profile-dropdown"
                    >
                      <div className="dropdown-user-info">
                        <p className="d-username">{user.username}</p>
                        <p className="d-role">{user.role}</p>
                      </div>
                      <div className="dropdown-divider"></div>
                      <Link to="/profile" className="d-item" onClick={() => setProfileOpen(false)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        Profile
                      </Link>
                      <Link to="/dashboard" className="d-item" onClick={() => setProfileOpen(false)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h18"/></svg>
                        Dashboard
                      </Link>
                      <div className="dropdown-divider"></div>
                      <button className="d-item d-logout" onClick={() => { logout(); setProfileOpen(false); showToast('Logged out'); navigate('/'); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setShowLoginModal(true)} id="login-nav-btn">
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Unified Login / Signup Modal */}
      {showLoginModal && (
        <div className="modal-overlay">
          <div className="modal-content login-modal">
            <div className="modal-header">
              <div className="modal-header-text">
                <h3>{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h3>
                <p>{authMode === 'login' ? 'Enter your credentials to access the marketplace' : 'Join the elite community of skin traders'}</p>
              </div>
              <button className="btn-close" onClick={resetModal}>✕</button>
            </div>
            
            <div className="modal-body">
              {authMode === 'login' && (
                <button 
                  type="button" 
                  className="google-login-btn"
                  onClick={handleGoogleLogin}
                  disabled={isFirebaseLoading}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91a8.78 8.78 0 0 0 2.69-6.62z" fill="#4285F4"/>
                    <path d="M9 18c2.37 0 4.37-.79 5.82-2.13l-2.91-2.26c-.8.54-1.83.86-2.91.86-2.24 0-4.14-1.51-4.81-3.54H1.17v2.33A8.99 8.99 0 0 0 9 18z" fill="#34A853"/>
                    <path d="M4.19 10.93a5.41 5.41 0 0 1 0-3.46V5.14H1.17a8.99 8.99 0 0 0 0 7.72l3.02-2.33z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.3 0 2.45.44 3.37 1.32l2.53-2.53A8.94 8.94 0 0 0 9 0 8.99 8.99 0 0 0 1.17 5.14l3.02 2.33c.67-2.03 2.57-3.54 4.81-3.54z" fill="#EA4335"/>
                  </svg>
                  <span>{isFirebaseLoading ? 'Connecting...' : 'Continue with Google'}</span>
                </button>
              )}

              {authMode === 'login' && (
                <div className="divider">
                  <span>OR</span>
                </div>
              )}

              {authMode === 'login' ? (
                <form onSubmit={handleLogin}>
                  <div className="form-group">
                    <label>Email Address</label>
                    <div className="input-wrap">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      <input 
                        type="email"
                        className="input" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        placeholder="name@email.com"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <div className="input-wrap">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input 
                        className="input" 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </button>
                  <p className="auth-footer">
                    Don't have an account? <button type="button" onClick={() => setAuthMode('signup')}>Sign Up</button>
                  </p>
                </form>
              ) : (
                <div className="signup-flow">
                  {signupStep === 'email' && (
                    <form onSubmit={handleRequestOtp}>
                      <div className="form-group">
                        <label>Email Address</label>
                        <div className="input-wrap">
                          <input 
                            type="email" 
                            className="input" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            placeholder="name@email.com" 
                            required 
                          />
                        </div>
                      </div>
                      <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
                        {isLoading ? 'Sending Code...' : 'Send Verification Code'}
                      </button>
                    </form>
                  )}

                  {signupStep === 'otp' && (
                    <form onSubmit={handleVerifyOtp}>
                      <div className="form-group">
                        <label>Verification Code</label>
                        <p className="input-hint">Enter the 6-digit code sent to {email}</p>
                        <div className="input-wrap">
                          <input 
                            type="text" 
                            className="input otp-input" 
                            value={otp} 
                            onChange={e => setOtp(e.target.value)} 
                            placeholder="••••••" 
                            maxLength={6}
                            required 
                          />
                        </div>
                      </div>
                      <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
                        {isLoading ? 'Verifying...' : 'Verify Code'}
                      </button>
                      <div className="resend-wrap">
                        {countdown > 0 ? (
                          <span>Resend in {countdown}s</span>
                        ) : (
                          <button type="button" onClick={handleRequestOtp} disabled={isLoading}>Resend Code</button>
                        )}
                      </div>
                    </form>
                  )}

                  {signupStep === 'details' && (
                    <form onSubmit={handleRegister}>
                      <div className="form-group">
                        <label>Username</label>
                        <div className="input-wrap">
                          <input 
                            type="text" 
                            className="input" 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            placeholder="johndoe" 
                            required 
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Set Password</label>
                        <div className="input-wrap">
                          <input 
                            type="password" 
                            className="input" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            placeholder="••••••••" 
                            required 
                          />
                        </div>
                      </div>
                      <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
                        {isLoading ? 'Creating Account...' : 'Complete Registration'}
                      </button>
                    </form>
                  )}
                  
                  <p className="auth-footer">
                    Already have an account? <button type="button" onClick={() => setAuthMode('login')}>Login</button>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

