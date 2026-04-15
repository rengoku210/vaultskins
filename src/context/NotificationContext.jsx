import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { api, socket } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await api.getNotifications();
      const notifs = data.notifications || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications();

      const handleNewNotif = (notif) => {
        if (notif.userId === user.id || (user.id && parseInt(notif.userId) === parseInt(user.id))) {
          setNotifications(prev => [notif, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show Toast
          if (notif.type === 'success') toast.success(notif.message);
          else if (notif.type === 'error') toast.error(notif.message);
          else if (notif.type === 'warning') toast(notif.message, { icon: '⚠️' });
          else toast.info ? toast.info(notif.message) : toast(notif.message, { icon: 'ℹ️' });
        }
      };

      socket.on('new_notification', handleNewNotif);
      return () => socket.off('new_notification', handleNewNotif);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    // Backend doesn't have mark all read yet, but we can do it locally for now
    // and ideally the backend should have an endpoint for this.
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    for (const id of unreadIds) {
      await markAsRead(id);
    }
  };

  // Helper for manual toasts
  const showToast = (message, type = 'info') => {
    if (type === 'success') toast.success(message);
    else if (type === 'error') toast.error(message);
    else toast(message);
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      loading, 
      fetchNotifications, 
      markAsRead, 
      markAllRead,
      showToast 
    }}>
      {children}
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#15151e',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontSize: '14px',
            backdropFilter: 'blur(10px)'
          },
          success: {
            iconTheme: {
              primary: '#34d399',
              secondary: '#15151e',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#15151e',
            },
          }
        }}
      />
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
