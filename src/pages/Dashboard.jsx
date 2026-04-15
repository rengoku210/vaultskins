import { useState, useEffect } from 'react';
import { formatPrice } from '../hooks';
import { api, socket } from '../services/api';
import './Dashboard.css';

export default function Dashboard() {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    fetchDashboard();

    socket.on('rentals_expired', () => {
      fetchDashboard();
    });

    return () => socket.off('rentals_expired');
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const data = await api.getUserDashboard();
      if (data.rentals) {
        setRentals(data.rentals);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  const activeRentals = rentals.filter(r => r.status === 'active');
  const pastRentals = rentals.filter(r => r.status !== 'active');

  return (
    <div className="dashboard-page">
      <div className="container">
        <div className="dash-header">
          <h1>My Gaming Vault</h1>
          <p className="dash-subtitle">Access your active rentals and view purchase history</p>
        </div>

        {loading ? <p>Syncing with ledger...</p> : (
          <>
            {/* Stats */}
            <div className="dash-stats">
              <div className="dash-stat">
                <span className="dash-stat-label">Active Rentals</span>
                <span className="dash-stat-val">{activeRentals.length}</span>
              </div>
              <div className="dash-stat">
                <span className="dash-stat-label">Total Earnings</span>
                <span className="dash-stat-val">{rentals.length}</span>
              </div>
              <div className="dash-stat">
                <span className="dash-stat-label">Vault Status</span>
                <span className="dash-stat-val" style={{ color: 'var(--accent-green)' }}>Verified</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="dash-tabs">
              <button 
                className={`dash-tab ${activeTab === 'active' ? 'active' : ''}`}
                onClick={() => setActiveTab('active')}
              >Active Access ({activeRentals.length})</button>
              <button 
                className={`dash-tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >History</button>
            </div>

            {/* Content */}
            <div className="dash-content">
              {activeTab === 'active' && (
                <div className="active-rentals">
                  {activeRentals.length > 0 ? (
                    activeRentals.map(rental => (
                      <div key={rental.id} className="active-rental-card">
                        <div className="arc-header">
                          <div className="arc-info">
                            <h3>{rental.title}</h3>
                            <span className="badge badge-platinum">{rental.rank}</span>
                          </div>
                          <div className="arc-timer">
                            <span className="timer-label">Expires in:</span>
                            <span className="timer-val">
                              {Math.max(0, Math.ceil((new Date(rental.endTime) - new Date()) / (1000 * 60 * 60)))}h
                            </span>
                          </div>
                        </div>

                        {rental.credentials ? (
                          <div className="arc-creds">
                            <div className="cred-field">
                              <label>Username</label>
                              <div className="cred-input-wrap">
                                <input readOnly value={rental.credentials.username} className="input" />
                                <button className="btn-copy" onClick={() => navigator.clipboard.writeText(rental.credentials.username)}>Copy</button>
                              </div>
                            </div>
                            <div className="cred-field">
                              <label>Password</label>
                              <div className="cred-input-wrap">
                                <input readOnly type="text" value={rental.credentials.password} className="input" />
                                <button className="btn-copy" onClick={() => navigator.clipboard.writeText(rental.credentials.password)}>Copy</button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="arc-creds-locked">
                            Credentials unavailable for this status.
                          </div>
                        )}

                        <div className="arc-footer">
                          <button className="btn btn-primary btn-full">Launch Client</button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <p>No active rentals. Visit the marketplace to get started.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="history-table-wrap">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Listing</th>
                        <th>Type</th>
                        <th>Started</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastRentals.map(item => (
                        <tr key={item.id}>
                          <td>{item.title}</td>
                          <td><span className="tag">Rent</span></td>
                          <td>{new Date(item.startTime).toLocaleDateString()}</td>
                          <td><span className="badge badge-sold">{item.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pastRentals.length === 0 && <p className="empty-msg">No history found.</p>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
