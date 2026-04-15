import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './TermsModal.css';

export default function TermsModal({ onAccept }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    try {
      setLoading(true);
      const res = await api.acceptTerms();
      if (res.success) {
        onAccept();
      }
    } catch (err) {
      console.error('Failed to accept terms', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    navigate('/goodbye');
  };

  return (
    <div className="terms-modal-overlay">
      <div className="terms-modal-content">
        <div className="terms-modal-header">
          <h2>VaultSkins Terms & Conditions</h2>
          <p>Please read and accept our terms to continue using the platform.</p>
        </div>
        <div className="terms-content">
          <section>
            <h3>1. Nature of Platform</h3>
            <p>VaultSkins operates as a digital marketplace that connects buyers and sellers of gaming accounts. VaultSkins does not own, create, or control any accounts listed on the platform.</p>
          </section>
          <section>
            <h3>2. User Responsibility</h3>
            <p>All users are solely responsible for the authenticity, ownership, and accuracy of the accounts they list or purchase. VaultSkins does not guarantee that any listing is fully legitimate or risk-free.</p>
          </section>
          <section>
            <h3>3. Verification Disclaimer</h3>
            <p>"Verified" badges or admin approvals indicate that a listing has undergone a basic review process. This does NOT guarantee complete safety, authenticity, or protection from fraud.</p>
          </section>
          <section>
            <h3>4. Risk Acknowledgment</h3>
            <p>By using VaultSkins, users acknowledge that trading digital accounts involves inherent risks. Users agree to proceed at their own discretion.</p>
          </section>
          <section>
            <h3>5. Account Security</h3>
            <p>Users must not misuse, resell, or share accessed credentials beyond permitted usage. Any violation may result in immediate suspension or permanent ban.</p>
          </section>
          <section>
            <h3>6. Payments</h3>
            <p>All transactions (including rentals or purchases) are considered final unless explicitly stated otherwise. Refund policies, if any, will be governed by platform rules.</p>
          </section>
          <section>
            <h3>7. Fraud & Abuse</h3>
            <p>Any attempt to scam, exploit, or abuse the platform will result in strict action including account suspension, permanent bans, and potential reporting.</p>
          </section>
          <section>
            <h3>8. Limitation of Liability</h3>
            <p>VaultSkins is not liable for account loss, scams between users, misuse of credentials, or unauthorized access after transactions.</p>
          </section>
          <section>
            <h3>9. Platform Rights</h3>
            <p>VaultSkins reserves the right to remove listings, suspend users, and modify platform rules at any time.</p>
          </section>
          <section>
            <h3>10. Acceptance</h3>
            <p>By using VaultSkins, you confirm that you understand and accept all risks and agree to comply with these Terms & Conditions.</p>
          </section>
        </div>
        <div className="terms-modal-footer">
          <button className="btn btn-ghost" onClick={handleReject}>Reject & Leave</button>
          <button className="btn btn-primary" onClick={handleAccept} disabled={loading}>
            {loading ? 'Processing...' : 'I Accept & Agree'}
          </button>
        </div>
      </div>
    </div>
  );
}
