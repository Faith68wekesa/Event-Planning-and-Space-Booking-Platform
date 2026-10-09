import React, { useState } from 'react';
import toast from 'react-hot-toast';

export const VendorDashboardSettings: React.FC<{ email: string, phone: string }> = ({ email, phone }) => {
  const [notifications, setNotifications] = useState({
    bookingRequests: true,
    messages: true,
    reviews: true
  });
  const [isDeactivated, setIsDeactivated] = useState(false);

  const toggleNotification = (key: keyof typeof notifications) => {
    const newState = !notifications[key];
    setNotifications(prev => ({
      ...prev,
      [key]: newState
    }));
    
    const label = key === 'bookingRequests' ? 'Booking requests' : 
                  key === 'messages' ? 'Messages' : 'Reviews';
                  
    toast.success(`${label} notifications turned ${newState ? 'ON' : 'OFF'}`);
  };

  const handleToggleDeactivate = () => {
    if (isDeactivated) {
      setIsDeactivated(false);
      toast.success('Account reactivated successfully. Your profile is visible again.');
    } else {
      setIsDeactivated(true);
      toast.success('Account deactivated successfully. Your profile is hidden from customers.');
    }
  };

  const handleDelete = () => {
    toast.error('Account deletion requested. Support will contact you shortly.');
  };

  return (
    <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Account & Security */}
      <div className="dashboard-card" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '24px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          1. Account & Security
        </h3>
        
        <div style={{ display: 'grid', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>Email Address</div>
            <div style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 500 }}>{email || 'Not provided'}</div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>Phone Number</div>
            <div style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 500 }}>{phone || 'Not provided'}</div>
          </div>

        </div>
      </div>

      {/* Notifications */}
      <div className="dashboard-card" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '24px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          2. Notifications
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>Booking Requests</div>
            <button 
              onClick={() => toggleNotification('bookingRequests')}
              style={{ background: notifications.bookingRequests ? '#dcfce7' : '#f1f5f9', color: notifications.bookingRequests ? '#16a34a' : '#64748b', border: 'none', padding: '6px 16px', borderRadius: '999px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s ease' }}
            >
              {notifications.bookingRequests ? 'ON' : 'OFF'}
            </button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>Messages</div>
            <button 
              onClick={() => toggleNotification('messages')}
              style={{ background: notifications.messages ? '#dcfce7' : '#f1f5f9', color: notifications.messages ? '#16a34a' : '#64748b', border: 'none', padding: '6px 16px', borderRadius: '999px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s ease' }}
            >
              {notifications.messages ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>Reviews</div>
            <button 
              onClick={() => toggleNotification('reviews')}
              style={{ background: notifications.reviews ? '#dcfce7' : '#f1f5f9', color: notifications.reviews ? '#16a34a' : '#64748b', border: 'none', padding: '6px 16px', borderRadius: '999px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s ease' }}
            >
              {notifications.reviews ? 'ON' : 'OFF'}
            </button>
          </div>

        </div>
      </div>

      {/* Account Management */}
      <div className="dashboard-card" style={{ padding: '32px', border: '1px solid #fecaca', background: '#fffcfc' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#b91c1c', marginBottom: '24px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          3. Account Management
        </h3>
        
        <div style={{ display: 'grid', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                {isDeactivated ? 'Reactivate Account' : 'Deactivate Account'}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                {isDeactivated ? 'Re-enable your vendor account' : 'Temporarily disable your vendor account'}
              </div>
            </div>
            <button onClick={handleToggleDeactivate} style={{ background: isDeactivated ? '#0d8a73' : '#fff', border: isDeactivated ? 'none' : '1px solid #cbd5e1', color: isDeactivated ? '#fff' : '#475569', fontWeight: 600, fontSize: '0.85rem', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
              {isDeactivated ? 'Reactivate' : 'Deactivate'}
            </button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>Delete Account</div>
              <div style={{ fontSize: '0.85rem', color: '#991b1b' }}>Permanently delete your account</div>
            </div>
            <button onClick={handleDelete} style={{ background: '#ef4444', border: 'none', color: '#fff', fontWeight: 600, fontSize: '0.85rem', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
              Delete Account
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
