import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Marketplace from './pages/Marketplace';
import AccountDetail from './pages/AccountDetail';
import Dashboard from './pages/Dashboard';
import Seller from './pages/Seller';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Goodbye from './pages/Goodbye';
import TermsModal from './components/TermsModal';
import CreateListing from './pages/CreateListing';
import ListingDetail from './pages/ListingDetail';
import { api } from './services/api';
import { useAuth } from './context/AuthContext';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// Protected Route Wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, isTermsAccepted, setTermsAccepted, loading } = useAuth();

  useEffect(() => {
    // Warm up skin cache
    const existing = localStorage.getItem('valorant_skins_cache');
    if (!existing) {
      api.getValorantCache().then(data => {
        if (data && data.skins) {
          localStorage.setItem('valorant_skins_cache', JSON.stringify(data));
          window.dispatchEvent(new Event('valorant_cache_ready'));
        }
      }).catch(err => console.error("Skin cache failure", err));
    }
  }, []);

  if (loading) return null;

  return (
    <>
      <ScrollToTop />
      <Navbar />
      
      {/* Forced Terms Modal */}
      {user && !isTermsAccepted && (
        <TermsModal onAccept={setTermsAccepted} />
      )}

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/account/:id" element={<AccountDetail />} />
        <Route path="/listing/:id" element={<ListingDetail />} />
        <Route path="/goodbye" element={<Goodbye />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/seller" element={<ProtectedRoute><Seller /></ProtectedRoute>} />
        <Route path="/create-listing" element={<ProtectedRoute><CreateListing /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      </Routes>
    </>
  );
}
