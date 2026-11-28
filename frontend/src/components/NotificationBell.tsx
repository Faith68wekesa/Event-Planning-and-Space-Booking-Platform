import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiService } from '../services/api';
import type { NotificationItem } from '../types';

interface NotificationBellProps {
  userId?: number | string | null;
  onOpenNotification: (notification: NotificationItem) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  userId,
  onOpenNotification,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(notification => !notification.is_read).length;

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    let cancelled = false;
    const syncNotifications = async () => {
      try {
        const items = await ApiService.getNotifications(userId);
        if (!cancelled) {
          setNotifications(items);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    };

    void syncNotifications();
    const interval = window.setInterval(() => void syncNotifications(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [userId]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const openNotification = async (notification: NotificationItem) => {
    if (!notification.is_read && userId) {
      const markedRead = await ApiService.markNotificationRead(notification.id, userId);
      if (markedRead) {
        setNotifications(current => current.map(item => (
          item.id === notification.id ? { ...item, is_read: true } : item
        )));
      } else {
        toast.error('Could not mark this notification as read.');
      }
    }

    setIsOpen(false);
    onOpenNotification(notification);
  };

  const markAllRead = async () => {
    if (!userId) return;
    const markedRead = await ApiService.markAllNotificationsRead(userId);
    if (!markedRead) {
      toast.error('Could not mark notifications as read.');
      return;
    }
    setNotifications(current => current.map(item => ({ ...item, is_read: true })));
    toast.success('All notifications marked as read.');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        title="Notifications"
        style={{
          position: 'relative',
          width: '42px',
          height: '42px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#fff',
          color: '#334155',
          cursor: 'pointer',
        }}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: '999px',
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.68rem',
              fontWeight: 800,
              lineHeight: '18px',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute',
            top: '50px',
            right: 0,
            zIndex: 300,
            width: 'min(360px, calc(100vw - 32px))',
            maxHeight: '440px',
            display: 'flex',
            flexDirection: 'column',
            padding: '14px',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            background: '#fff',
            boxShadow: '0 18px 36px rgba(15, 23, 42, 0.18)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <strong style={{ color: '#0f172a' }}>Notifications</strong>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                style={{ padding: 0, border: 0, background: 'none', color: '#0d8a73', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', overflowY: 'auto' }}>
            {loadError ? (
              <p style={{ margin: 0, padding: '24px 8px', color: '#b91c1c', fontSize: '0.84rem', textAlign: 'center' }}>
                Notifications could not be loaded.
              </p>
            ) : notifications.length > 0 ? notifications.map(notification => (
              <button
                key={notification.id}
                type="button"
                onClick={() => void openNotification(notification)}
                style={{
                  width: '100%',
                  padding: '10px 11px',
                  border: `1px solid ${notification.is_read ? '#e2e8f0' : '#a7f3d0'}`,
                  borderRadius: '10px',
                  background: notification.is_read ? '#f8fafc' : '#f0fdf4',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'block', marginBottom: '3px', color: '#0f172a', fontSize: '0.82rem', fontWeight: 750 }}>
                  {notification.title}
                </span>
                <span style={{ display: 'block', color: '#475569', fontSize: '0.78rem', lineHeight: 1.4 }}>
                  {notification.message}
                </span>
                <span style={{ display: 'block', marginTop: '5px', color: '#94a3b8', fontSize: '0.68rem' }}>
                  {new Date(notification.created_at).toLocaleString()}
                </span>
              </button>
            )) : (
              <p style={{ margin: 0, padding: '24px 8px', color: '#64748b', fontSize: '0.84rem', textAlign: 'center' }}>
                You're all caught up.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
