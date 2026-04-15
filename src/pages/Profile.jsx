import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { api } from '../services/api';
import { auth } from '../services/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import './Profile.css';

export default function Profile() {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Phone Verification State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await api.getProfile();
      setProfile(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: (response) => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        }
      });
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone) return;
    
    // Normalize Phone Number (E.164)
    let cleaned = phone.replace(/\D/g, ''); // Remove non-digits
    if (cleaned.length === 10) cleaned = '91' + cleaned; // Default to India if 10 digits
    const formattedPhone = '+' + cleaned;

    try {
      setIsVerifying(true);
      setupRecaptcha();
      const verifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmationResult(confirmation);
      setShowOtpInput(true);
      showToast('OTP sent to your phone!', 'success');
    } catch (err) {
      console.error(err);
      // Reset reCAPTCHA on error so it can be re-initialized
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
      showToast(err.message || 'Failed to send OTP', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || !confirmationResult) return;

    try {
      setIsVerifying(true);
      await confirmationResult.confirm(otp);
      
      // Update backend
      const res = await api.verifyPhone();
      if (res.success) {
        setProfile(prev => ({ ...prev, is_phone_verified: 1 }));
        setShowOtpInput(false);
        setPhone('');
        setOtp('');
        showToast('Phone verified successfully!', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Invalid OTP or verification failed', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  if (loading) return <div className="profile-loading"><div className="spinner"></div></div>;
  if (!user || !profile) return <div className="profile-error">Please login to view profile.</div>;

  return (
    <div className="profile-page">
      <div className="container">
        <div className="profile-header">
           <div className="profile-avatar-large">
             {profile.profile_picture ? (
               <img src={profile.profile_picture} alt={profile.username} />
             ) : (
               <span>{profile.username[0].toUpperCase()}</span>
             )}
           </div>
           <div className="profile-info-main">
             <h1>{profile.username}</h1>
             <p className="profile-email">{profile.email}</p>
             <div className="profile-badges">
               <span className={`trust-badge ${profile.vaultStatus === 'verified' ? 'verified' : 'unverified'}`}>
                 {profile.vaultStatus === 'verified' ? '✓ Vault Verified' : 'Unverified'}
               </span>
               <span className={`trust-badge ${profile.is_phone_verified ? 'phone-verified' : 'phone-unverified'}`}>
                 {profile.is_phone_verified ? '✓ Phone Verified' : 'Phone Unverified'}
               </span>
             </div>
           </div>
        </div>

        <div className="profile-grid">
           {/* Section 1: Verification */}
           <div className="profile-section verification-section">
             <h3>Trust & Safety</h3>
             
             {!profile.is_phone_verified ? (
               <div className="phone-verify-box">
                 <h4>Verify Phone Number</h4>
                 <p>Get a trust badge and unlock premium features by verifying your mobile.</p>
                 
                 {!showOtpInput ? (
                   <form onSubmit={handleSendOtp} className="verify-form">
                     <div className="input-wrap">
                       <span className="country-code">+</span>
                       <input 
                         type="tel" 
                         className="input" 
                         placeholder="919876543210" 
                         value={phone}
                         onChange={e => setPhone(e.target.value)}
                         required
                       />
                     </div>
                     <button type="submit" className="btn btn-primary" disabled={isVerifying}>
                       {isVerifying ? 'Sending...' : 'Send OTP'}
                     </button>
                   </form>
                 ) : (
                   <form onSubmit={handleVerifyOtp} className="verify-form">
                     <div className="input-wrap">
                       <input 
                         type="text" 
                         className="input" 
                         placeholder="Enter 6-digit OTP" 
                         value={otp}
                         onChange={e => setOtp(e.target.value)}
                         maxLength={6}
                         required
                       />
                     </div>
                     <button type="submit" className="btn btn-primary" disabled={isVerifying}>
                       {isVerifying ? 'Verifying...' : 'Verify OTP'}
                     </button>
                     <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowOtpInput(false)}>Back</button>
                   </form>
                 )}
                 <div id="recaptcha-container"></div>
               </div>
             ) : (
               <div className="verified-status-box">
                 <div className="v-icon">🛡️</div>
                 <div>
                   <h4>Account Secured</h4>
                   <p>Your phone number is verified. You have a higher trust ranking.</p>
                 </div>
               </div>
             )}
           </div>

           {/* Section 2: Stats */}
           <div className="profile-section stats-section">
             <h3>Account Statistics</h3>
             <div className="p-stats-grid">
               <div className="p-stat-card">
                 <span className="p-stat-val">{profile.total_trades}</span>
                 <span className="p-stat-label">Total Trades</span>
               </div>
               <div className="p-stat-card">
                 <span className="p-stat-val">{(profile.rating || 5.0).toFixed(1)}</span>
                 <span className="p-stat-label">Reputation</span>
               </div>
               <div className="p-stat-card">
                 <span className="p-stat-val">{(profile.uptime_score || 100).toFixed(0)}%</span>
                 <span className="p-stat-label">Delivery Rate</span>
               </div>
               <div className="p-stat-card">
                 <span className="p-stat-val">{new Date(profile.created_at).toLocaleDateString()}</span>
                 <span className="p-stat-label">Member Since</span>
               </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
