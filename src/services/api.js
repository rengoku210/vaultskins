import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') 
    ? `${window.location.origin}/api` 
    : 'http://localhost:5000/api');

export const socket = io(import.meta.env.VITE_SOCKET_URL || 
  (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') 
    ? window.location.origin 
    : 'http://localhost:5000'));

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

const handleRequest = async (promise) => {
  try {
    const response = await promise;
    const data = await response.json();
    if (!response.ok) {
      return { error: data.error || 'Request failed', success: false };
    }
    // If data is an array, wrap it; if it has success, return it; otherwise spread and add success
    if (Array.isArray(data)) return { data, success: true };
    if (data && typeof data === 'object' && 'success' in data) return data;
    return { ...data, success: true };
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      return { error: 'Server unreachable. Please ensure the backend is running.', success: false, isServerDown: true };
    }
    return { error: err.message || 'An unexpected error occurred', success: false };
  }
};

export const api = {
  // Auth
  login: (email, password) => 
    handleRequest(fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })),

  loginFirebase: (token) =>
    handleRequest(fetch(`${API_URL}/auth/firebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })),

  requestEmailOtp: (email) =>
    handleRequest(fetch(`${API_URL}/auth/request-email-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })),

  verifyEmailOtp: (email, otp) =>
    handleRequest(fetch(`${API_URL}/auth/verify-email-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    })),

  register: (data) =>
    handleRequest(fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })),

  // Valorant Cache
  getValorantCache: () =>
    handleRequest(fetch(`${API_URL}/valorant/skins`)),

  // Listings
  getListings: () => 
    handleRequest(fetch(`${API_URL}/listings`)),

  getListingById: (id) =>
    handleRequest(fetch(`${API_URL}/listings/${id}`)),

  getUserListings: () =>
    handleRequest(fetch(`${API_URL}/user/listings`, { headers: getHeaders() })),

  submitListing: (data) =>
    handleRequest(fetch(`${API_URL}/listings/submit`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    })),

  approveListing: (id) =>
    handleRequest(fetch(`${API_URL}/admin/listings/${id}/approve`, {
      method: 'POST',
      headers: getHeaders()
    })),

  rejectListing: (id) =>
    handleRequest(fetch(`${API_URL}/admin/listings/${id}/reject`, {
      method: 'POST',
      headers: getHeaders()
    })),

  // Checkout
  checkout: (data) =>
    handleRequest(fetch(`${API_URL}/checkout`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    })),

  getPlatformStats: () =>
    handleRequest(fetch(`${API_URL}/stats`)),

  // Dashboards
  getUserDashboard: () =>
    handleRequest(fetch(`${API_URL}/user/dashboard`, {
      headers: getHeaders()
    })),

  getAdminDashboard: () =>
    handleRequest(fetch(`${API_URL}/admin/dashboard`, {
      headers: getHeaders()
    })),

  getAdminUsers: () =>
    handleRequest(fetch(`${API_URL}/admin/users`, {
      headers: getHeaders()
    })),

  toggleUserVerify: (id) =>
    handleRequest(fetch(`${API_URL}/admin/users/${id}/verify`, {
      method: 'POST',
      headers: getHeaders()
    })),

  // Notifications
  getNotifications: () =>
    handleRequest(fetch(`${API_URL}/notifications`, { headers: getHeaders() })),

  markNotificationRead: (id) =>
    handleRequest(fetch(`${API_URL}/notifications/read/${id}`, {
      method: 'POST',
      headers: getHeaders()
    })),

  // Profile
  getProfile: () =>
    handleRequest(fetch(`${API_URL}/user/profile`, { headers: getHeaders() })),

  verifyPhone: () =>
    handleRequest(fetch(`${API_URL}/user/verify-phone`, {
      method: 'POST',
      headers: getHeaders()
    })),

  acceptTerms: () =>
    handleRequest(fetch(`${API_URL}/user/accept-terms`, {
      method: 'POST',
      headers: getHeaders()
    })),
};
