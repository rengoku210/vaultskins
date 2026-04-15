import { useState, useEffect } from 'react';
import { formatPrice } from '../hooks';
import { api } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import './Admin.css';

export default function Admin() {
  const { showToast } = useNotifications();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalListings: 0,
    activeRentals: 0,
    flaggedUsers: 0,
    revenue: 0,
  });
  const [listings, setListings] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [data, usersData] = await Promise.all([
        api.getAdminDashboard(),
        api.getAdminUsers()
      ]);
      if (data.listings) {
        setListings(data.listings);
        setUsers(usersData.users || []);
        setStats({
          totalUsers: usersData.users ? usersData.users.length : 0,
          totalListings: data.listings.length,
          activeRentals: data.listings.filter(l => l.status === 'pending').length,
          flaggedUsers: 0,
          revenue: data.earnings || 0,
        });
      }
    } catch (err) {
      console.error('Admin fetch failed', err);
      showToast('Error fetching admin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      setProcessingId(id);
      const res = await api.approveListing(id);
      if (res.success) {
        setListings(prev => prev.map(l => l.id === id ? { ...l, status: 'approved' } : l));
        showToast('Listing approved successfully', 'success');
        // Small delay before refetching or just update local state
        setTimeout(fetchData, 500); 
      }
    } catch (err) {
      showToast('Approval failed', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    try {
      setProcessingId(id);
      const res = await api.rejectListing(id);
      if (res.success) {
        setListings(prev => prev.map(l => l.id === id ? { ...l, status: 'rejected' } : l));
        showToast('Listing rejected', 'info');
        setTimeout(fetchData, 500);
      }
    } catch (err) {
      showToast('Rejection failed', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleVerify = async (id) => {
    try {
      setProcessingId(id);
      const res = await api.toggleUserVerify(id);
      if (res.success) {
        showToast(res.is_verified ? 'User verified' : 'Verification revoked', 'success');
        fetchData();
      }
    } catch (err) {
      showToast('Action failed', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingListings = listings.filter(l => l.status === 'pending');
  const recentActivity = [
    { id: 1, action: 'Platform synchronized', status: 'Healthy', time: 'Just now' },
    { id: 2, action: 'DB Backup completed', status: 'Success', time: '10 min ago' },
  ];

  return (
    <div className="admin-page">
      <div className="container">
        <div className="dash-header">
          <h1>Admin Panel</h1>
          <p className="dash-subtitle">Monitor platform activity and moderate content</p>
        </div>

        {loading ? (
          <div className="admin-loading">
            <div className="spinner"></div>
            <span>Loading platform data...</span>
          </div>
        ) : (
          <>
            {/* Admin Stats */}
            <div className="admin-stats">
              <div className="admin-stat">
                <div className="admin-stat-icon" style={{ background: 'var(--accent-blue-soft)', color: 'var(--accent-blue)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </div>
                <div className="admin-stat-info">
                  <span className="admin-stat-val">{stats.totalUsers.toLocaleString()}</span>
                  <span className="admin-stat-label">Total Users</span>
                </div>
              </div>

              <div className="admin-stat">
                <div className="admin-stat-icon" style={{ background: 'var(--accent-green-soft)', color: 'var(--accent-green)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  </svg>
                </div>
                <div className="admin-stat-info">
                  <span className="admin-stat-val">{stats.totalListings.toLocaleString()}</span>
                  <span className="admin-stat-label">Total Listings</span>
                </div>
              </div>

              <div className="admin-stat">
                <div className="admin-stat-icon" style={{ background: 'var(--accent-amber-soft)', color: 'var(--accent-amber)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="admin-stat-info">
                  <span className="admin-stat-val">{stats.activeRentals}</span>
                  <span className="admin-stat-label">Audit Queue</span>
                </div>
              </div>

              <div className="admin-stat admin-stat--revenue">
                <div className="admin-stat-icon" style={{ background: 'var(--accent-green-soft)', color: 'var(--accent-green)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                  </svg>
                </div>
                <div className="admin-stat-info">
                  <span className="admin-stat-val" style={{ color: 'var(--accent-green)' }}>{formatPrice(stats.revenue)}</span>
                  <span className="admin-stat-label">Total Volume</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="dash-tabs">
              {['overview', 'pending', 'users'].map(tab => (
                <button
                  key={tab}
                  className={`dash-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
              ))}
            </div>

            {/* Content */}
            <div className="admin-content">
              {activeTab === 'overview' && (
                <div className="admin-activity">
                  <h3>Platform Status</h3>
                   <div className="activity-list">
                    {recentActivity.map(item => (
                      <div key={item.id} className="activity-item">
                        <div className="activity-dot" />
                        <div className="activity-info">
                          <p className="activity-action">{item.action}</p>
                          <p className="activity-details">
                            <span className="activity-user">{item.status}</span>
                          </p>
                        </div>
                        <span className="activity-time">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'pending' && (
                <div className="pending-listings">
                  <h3>Pending Approval ({pendingListings.length})</h3>
                  <div className="pending-grid">
                    {pendingListings.map(listing => (
                      <div key={listing.id} className={`pending-card ${processingId === listing.id ? 'card-processing' : ''}`}>
                        <div className="pending-card__header">
                          <div>
                            <h4>{listing.title}</h4>
                            <div className="pending-card__meta">
                              <span className="badge badge-platinum">{listing.rank}</span>
                              <span className="tag">{listing.region}</span>
                            </div>
                          </div>
                        </div>

                        <div className="pending-card__pricing">
                          <span>Buy: {formatPrice(listing.price_buy || listing.priceBuy)}</span>
                          <span>Rent: {formatPrice(listing.price_rent_day || listing.priceRentDay)}/day</span>
                        </div>

                        <div className="pending-card__actions">
                          <button 
                            className="btn btn-primary btn-sm" 
                            style={{ background: 'var(--accent-green)', boxShadow: 'none' }}
                            onClick={() => handleApprove(listing.id)}
                            disabled={processingId !== null}
                          >
                            {processingId === listing.id ? '...' : '✓ Approve'}
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ color: 'var(--accent-red)', borderColor: 'rgba(200,60,74,0.3)' }}
                            onClick={() => handleReject(listing.id)}
                            disabled={processingId !== null}
                          >
                            {processingId === listing.id ? '...' : '✕ Reject'}
                          </button>
                        </div>
                      </div>
                    ))}
                    {pendingListings.length === 0 && <p className="empty-msg">No pending listings to review.</p>}
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div className="admin-users">
                  <h3>User Management</h3>
                  <div className="pending-grid" style={{ gridTemplateColumns: '1fr' }}>
                    {users.map(user => (
                      <div key={user.id} className="pending-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4>{user.username} {user.is_verified ? <span className="badge badge-platinum" style={{fontSize: 10, padding: '2px 6px' }}>Verified</span> : null}</h4>
                          <div className="pending-card__meta" style={{ marginTop: 4 }}>
                            <span className="tag">{user.email}</span>
                            <span className="tag">Role: {user.role}</span>
                            <span className="tag">Trades: {user.total_trades}</span>
                          </div>
                        </div>
                        <div className="pending-card__actions">
                           <button 
                             className={`btn btn-sm ${user.is_verified ? 'btn-secondary' : 'btn-primary'}`}
                             onClick={() => handleToggleVerify(user.id)}
                             disabled={processingId === user.id}
                           >
                             {processingId === user.id ? 'Processing...' : (user.is_verified ? '✕ Revoke Verification' : '✓ Verify User')}
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
