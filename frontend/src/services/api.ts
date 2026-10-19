import type { User, Venue, Vendor, VenueOwner, Booking, PlatformStats, FilterState, BookingStatus, Review, Message, ConversationThread, EventItem, EventServiceItem, NotificationItem, ReminderPreference } from '../types';

const API_BASE = 'http://localhost:8000/api';

export function formatApiError(resData: any, fallback: string): string {
  if (!resData) return fallback;
  if (typeof resData === 'string') return resData;
  if (resData.error) return resData.error;
  if (resData.detail) return resData.detail;
  if (resData.message) return resData.message;
  if (typeof resData === 'object') {
    const messages: string[] = [];
    for (const [key, val] of Object.entries(resData)) {
      const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      if (Array.isArray(val)) {
        messages.push(`${fieldName}: ${val.join(', ')}`);
      } else if (typeof val === 'string') {
        messages.push(`${fieldName}: ${val}`);
      }
    }
    if (messages.length > 0) return messages.join('; ');
  }
  return fallback;
}

let currentUserId: number | null = null;

export const setApiCurrentUserId = (id: number | null) => {
  currentUserId = id;
};

export const getApiCurrentUserId = (): number | null => {
  return currentUserId;
};

const getAuthHeaders = (extraHeaders: Record<string, string> = {}): Record<string, string> => {
  const headers: Record<string, string> = { ...extraHeaders };
  if (currentUserId) {
    headers['X-User-Id'] = currentUserId.toString();
  }
  return headers;
};

export const ApiService = {
  async getVenues(filters: Partial<FilterState> & { owner?: number; vendor?: number; user?: number; all_status?: boolean } = {}): Promise<Venue[]> {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
      if (filters.location && filters.location !== 'ALL') params.append('location', filters.location);
      if (filters.max_price) params.append('max_price', filters.max_price.toString());
      if (filters.min_capacity) params.append('min_capacity', filters.min_capacity.toString());
      if (filters.verified_only) params.append('verified', 'true');
      if (filters.owner) params.append('owner', filters.owner.toString());
      if (filters.vendor) params.append('vendor', filters.vendor.toString());
      if (filters.user) params.append('user', filters.user.toString());
      if (filters.all_status) params.append('all_status', 'true');

      const res = await fetch(`${API_BASE}/venues/?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.results || [];
      }
    } catch (e) {
      console.error("Failed to fetch venues", e);
    }
    return [];
  },

  async getVendors(filters: Partial<FilterState> & { user?: number; all_status?: boolean } = {}): Promise<Vendor[]> {
    try {
      const q = new URLSearchParams();
      if (filters.search) q.append('search', filters.search);
      if (filters.vendor_type && filters.vendor_type !== 'ALL') q.append('vendor_type', filters.vendor_type);
      if (filters.location && filters.location !== 'ALL') q.append('location', filters.location);
      if (filters.verified_only) q.append('verified', 'true');
      if (filters.user) q.append('user', filters.user.toString());
      if (filters.all_status) q.append('all_status', 'true');

      const res = await fetch(`${API_BASE}/vendors/?${q.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.results || data;
      }
    } catch (e) {
      console.error("Failed to fetch vendors", e);
    }
    return [];
  },

  async registerUser(data: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (res.ok) {
        return resData;
      }
      return { error: resData.error || resData.detail || 'Registration failed' };
    } catch (e: any) {
      console.error('Failed to register:', e);
      return { error: e.message || 'Network error during registration' };
    }
  },

  async loginUser(credentials: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const resData = await res.json();
      if (res.ok) {
        return resData;
      }
      return { error: resData.error || resData.detail || 'Invalid credentials' };
    } catch (e: any) {
      console.error('Failed to login:', e);
      return { error: e.message || 'Network error during login' };
    }
  },

  async requestRole(userId: number, role: 'CUSTOMER' | 'PROVIDER' | 'VENDOR' | 'VENUE_OWNER' | 'ADMIN'): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/auth/request-role/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role }),
      });
      const resData = await res.json();
      if (res.ok) {
        return resData;
      }
      return { error: resData.error || resData.detail || 'Failed to select role' };
    } catch (e: any) {
      console.error('Failed to request role:', e);
      return { error: e.message || 'Network error during role selection' };
    }
  },

  async sendOTP(email: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/otp/send/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to send OTP:', e);
      return false;
    }
  },

  async verifyOTP(email: string, otp: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/otp/verify/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to verify OTP:', e);
      return false;
    }
  },

  async resetPassword(email: string, otp: string, newPassword: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/otp/reset-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, new_password: newPassword }),
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to reset password:', e);
      return false;
    }
  },

  async getBookings(params?: number | { customer?: number; vendor?: number; owner?: number; user?: number; status?: string }): Promise<Booking[]> {
    try {
      let url = `${API_BASE}/bookings/`;
      if (typeof params === 'number') {
        url = `${API_BASE}/bookings/?customer=${params}`;
      } else if (params) {
        const sp = new URLSearchParams();
        if (params.customer) sp.append('customer', params.customer.toString());
        if (params.vendor) sp.append('vendor', params.vendor.toString());
        if (params.owner) sp.append('owner', params.owner.toString());
        if (params.user) sp.append('user', params.user.toString());
        if (params.status) sp.append('status', params.status);
        url = `${API_BASE}/bookings/?${sp.toString()}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.results || [];
      }
    } catch (e) {
      console.error("Failed to fetch bookings", e);
    }
    return [];
  },

  async createBooking(bookingData: Partial<Booking>): Promise<Booking> {
    const res = await fetch(`${API_BASE}/bookings/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData),
    });
    if (res.ok) {
      return await res.json();
    }
    const errText = await res.text();
    let parsedErr = errText;
    try {
      parsedErr = formatApiError(JSON.parse(errText), 'Failed to create booking.');
    } catch {
      parsedErr = errText || 'Failed to create booking.';
    }
    throw new Error(parsedErr);
  },

  async updateBookingStatus(id: number, status: BookingStatus, extra: { reason?: string } = {}): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/bookings/${id}/update_status/`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status, ...extra }),
      });
      const data = await res.json();
      if (res.ok) return { success: true, data };
      return { success: false, error: data.error || formatApiError(data, 'Failed to update status.') };
    } catch (e: any) {
      console.error("Failed to update status", e);
      return { success: false, error: e.message || 'Network error occurred.' };
    }
  },

  async approveVenue(id: number): Promise<{ success: boolean; data?: Venue; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/venues/${id}/approve/`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json();
      if (res.ok) return { success: true, data };
      return { success: false, error: data.error || 'Failed to approve listing.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error occurred.' };
    }
  },

  async rejectVenue(id: number, reason: string): Promise<{ success: boolean; data?: Venue; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/venues/${id}/reject/`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.ok) return { success: true, data };
      return { success: false, error: data.error || 'Failed to reject listing.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error occurred.' };
    }
  },

  async toggleVerifyVenue(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/venues/${id}/toggle_verify/`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) return true;
    } catch (e) {
      console.error("Failed to toggle verify venue", e);
    }
    return false;
  },

  async toggleVerifyVendor(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/vendors/${id}/toggle_verify/`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) return true;
    } catch (e) {
      console.error("Failed to toggle verify vendor", e);
    }
    return false;
  },

  async setVendorVerificationStatus(id: number, status: 'APPROVED' | 'REJECTED' | 'PENDING'): Promise<Vendor | null> {
    try {
      const res = await fetch(`${API_BASE}/vendors/${id}/set_verification/`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ verification_status: status, admin_user_id: currentUserId }),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.error("Failed to set vendor verification status", e);
    }
    return null;
  },

  async updateVendor(id: number, vendorData: Partial<Vendor>): Promise<Vendor> {
    try {
      const res = await fetch(`${API_BASE}/vendors/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorData),
      });
      if (res.ok) return await res.json();
      throw new Error(await res.text());
    } catch (e) {
      console.error("Failed to update vendor", e);
      throw e;
    }
  },

  async getVenueOwners(params?: { user?: number; search?: string }): Promise<VenueOwner[]> {
    try {
      const sp = new URLSearchParams();
      if (params?.user) sp.append('user', params.user.toString());
      if (params?.search) sp.append('search', params.search);
      const res = await fetch(`${API_BASE}/venue-owners/?${sp.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.results || [];
      }
    } catch (e) {
      console.error("Failed to fetch venue owners", e);
    }
    return [];
  },

  async toggleVerifyVenueOwner(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/venue-owners/${id}/toggle_verify/`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) return true;
    } catch (e) {
      console.error("Failed to toggle verify venue owner", e);
    }
    return false;
  },

  async setVenueOwnerVerificationStatus(id: number, status: 'APPROVED' | 'REJECTED' | 'PENDING'): Promise<VenueOwner | null> {
    try {
      const res = await fetch(`${API_BASE}/venue-owners/${id}/set_verification/`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ verification_status: status, admin_user_id: currentUserId }),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.error("Failed to set venue owner verification status", e);
    }
    return null;
  },

  async updateVenueOwner(id: number, ownerData: Partial<VenueOwner>): Promise<VenueOwner> {
    try {
      const res = await fetch(`${API_BASE}/venue-owners/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ownerData),
      });
      if (res.ok) return await res.json();
      throw new Error(await res.text());
    } catch (e) {
      console.error("Failed to update venue owner", e);
      throw e;
    }
  },

  async addVenue(venueData: Partial<Venue>): Promise<Venue> {
    try {
      const res = await fetch(`${API_BASE}/venues/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(venueData),
      });
      if (res.ok) return await res.json();
      
      let errorData: any;
      try {
        errorData = await res.json();
      } catch {
        errorData = await res.text();
      }
      const message = formatApiError(errorData, "Failed to create listing.");
      throw new Error(message);
    } catch (e: any) {
      console.error("Failed to add venue:", e);
      throw e;
    }
  },

  async getVendorDashboard(vendorId: number): Promise<{
    total_revenue: number;
    pending_bookings: number;
    upcoming_bookings: number;
    total_venues: number;
    venues: Venue[];
  }> {
    const res = await fetch(`${API_BASE}/vendors/${vendorId}/dashboard/`);
    if (!res.ok) throw new Error("Failed to fetch dashboard");
    return await res.json();
  },

  async getVendorBookings(vendorId: number): Promise<Booking[]> {
    const res = await fetch(`${API_BASE}/vendors/${vendorId}/bookings/`);
    if (!res.ok) throw new Error("Failed to fetch vendor bookings");
    return await res.json();
  },



  async getVenueOwnerDashboard(ownerId: number): Promise<{
    total_revenue: number;
    pending_bookings: number;
    upcoming_bookings: number;
    total_venues: number;
    verified_venues: number;
    venues: Venue[];
  }> {
    const res = await fetch(`${API_BASE}/venue-owners/${ownerId}/dashboard/`);
    if (!res.ok) throw new Error("Failed to fetch venue owner dashboard");
    return await res.json();
  },

  async getVenueOwnerBookings(ownerId: number): Promise<Booking[]> {
    const res = await fetch(`${API_BASE}/venue-owners/${ownerId}/bookings/`);
    if (!res.ok) throw new Error("Failed to fetch venue owner bookings");
    return await res.json();
  },

  async updateVenue(id: number, venueData: Partial<Venue>): Promise<Venue> {
    try {
      const res = await fetch(`${API_BASE}/venues/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(venueData),
      });
      if (res.ok) return await res.json();
      throw new Error(await res.text());
    } catch (e) {
      console.error("Failed to update venue", e);
      throw e;
    }
  },

  async deleteVenue(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/venues/${id}/`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch (e) {
      console.error("Failed to delete venue", e);
      return false;
    }
  },

  async getStats(): Promise<PlatformStats> {
    try {
      const res = await fetch(`${API_BASE}/stats/`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
    return {
      total_venues: 0,
      verified_venues: 0,
      total_vendors: 0,
      verified_vendors: 0,
      total_bookings: 0,
      satisfied_clients: 0,
    };
  },

  async uploadProfilePicture(userId: number, file: File): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/users/${userId}/upload-avatar/`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        return data.profile_picture;
      }
      const errorData = await res.json();
      console.error('Failed to upload profile picture:', errorData);
    } catch (e) {
      console.error('Error uploading profile picture:', e);
    }
    return null;
  },

  async getReviews(params?: { venue?: number; vendor?: number; user?: number; booking?: number }): Promise<Review[]> {
    try {
      const sp = new URLSearchParams();
      if (params?.venue) sp.append('venue', params.venue.toString());
      if (params?.vendor) sp.append('vendor', params.vendor.toString());
      if (params?.user) sp.append('user', params.user.toString());
      if (params?.booking) sp.append('booking', params.booking.toString());
      const res = await fetch(`${API_BASE}/reviews/?${sp.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.results || [];
      }
    } catch (e) {
      console.error('Failed to fetch reviews:', e);
    }
    return [];
  },

  async submitReview(reviewData: { booking: number; rating: number; comment?: string; user?: number; venue?: number; vendor?: number }): Promise<{ success: boolean; data?: Review; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/reviews/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, data };
      }
      return { success: false, error: data.error || 'Failed to submit review' };
    } catch (e: any) {
      console.error('Error submitting review:', e);
      return { success: false, error: e.message || 'Network error' };
    }
  },

  async getReviewSummary(params?: { venue?: number; vendor?: number }): Promise<{ average_rating: number; review_count: number; rating_breakdown: Record<string, number> } | null> {
    try {
      const sp = new URLSearchParams();
      if (params?.venue) sp.append('venue', params.venue.toString());
      if (params?.vendor) sp.append('vendor', params.vendor.toString());
      const res = await fetch(`${API_BASE}/reviews/summary/?${sp.toString()}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch review summary:', e);
    }
    return null;
  },

  async deleteReview(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/reviews/${id}/`, {
        method: 'DELETE',
      });
      return res.ok || res.status === 204;
    } catch (e) {
      console.error('Failed to delete review:', e);
      return false;
    }
  },

  async getUsers(params?: { search?: string; role?: string }, adminUserId?: number): Promise<User[]> {
    try {
      const sp = new URLSearchParams();
      if (params?.search) sp.append('search', params.search);
      if (params?.role && params.role !== 'ALL') sp.append('role', params.role);
      const uid = adminUserId || currentUserId;
      if (uid) sp.append('admin_user_id', uid.toString());
      const res = await fetch(`${API_BASE}/users/?${sp.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.results || [];
      }
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
    return [];
  },

  async toggleUserActive(userId: number): Promise<User | null> {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/toggle_active/`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to toggle user active status:', e);
    }
    return null;
  },

  async updateUserRole(userId: number, role: string): Promise<User | null> {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/update_role/`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ role, admin_user_id: currentUserId }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to update user role:', e);
    }
    return null;
  },

  async deleteUser(userId: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok || res.status === 204;
    } catch (e) {
      console.error('Failed to delete user:', e);
      return false;
    }
  },

  async deleteBooking(bookingId: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      return res.ok || res.status === 204;
    } catch (e) {
      console.error('Failed to delete booking:', e);
      return false;
    }
  },

  async toggleVenueAvailability(venueId: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/venues/${venueId}/toggle_availability/`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ user_id: currentUserId, admin_user_id: currentUserId }),
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to toggle venue availability:', e);
      return false;
    }
  },

  async refreshAllRatings(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/admin/refresh-ratings/`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to refresh ratings:', e);
      return false;
    }
  },

  async getConversations(userId: number): Promise<ConversationThread[]> {
    try {
      const res = await fetch(`${API_BASE}/messages/conversations/?user=${userId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch conversations:', e);
    }
    return [];
  },

  async getMessages(params: { user?: number; partner?: number; booking?: number; venue?: number; vendor?: number }): Promise<Message[]> {
    try {
      const sp = new URLSearchParams();
      if (params.user) sp.append('user', params.user.toString());
      if (params.partner) sp.append('partner', params.partner.toString());
      if (params.booking) sp.append('booking', params.booking.toString());
      if (params.venue) sp.append('venue', params.venue.toString());
      if (params.vendor) sp.append('vendor', params.vendor.toString());
      const res = await fetch(`${API_BASE}/messages/?${sp.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.results || [];
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
    return [];
  },

  async sendMessage(msgData: { sender: number; recipient?: number; content: string; booking?: number; venue?: number; vendor?: number }): Promise<Message | null> {
    try {
      const res = await fetch(`${API_BASE}/messages/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgData),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    }
    return null;
  },

  async markThreadRead(userId: number, partnerId: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/messages/mark_read/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: userId, partner: partnerId }),
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to mark thread read:', e);
    }
    return false;
  },

  async getEvents(userId?: number): Promise<EventItem[]> {
    try {
      const url = userId ? `${API_BASE}/events/?user=${userId}` : `${API_BASE}/events/`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.results || [];
      }
    } catch (e) {
      console.error('Failed to fetch events:', e);
    }
    return [];
  },

  async createEvent(eventData: Partial<EventItem> & { owner?: number }): Promise<{ success: boolean; data?: EventItem; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/events/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, data };
      }
      return { success: false, error: formatApiError(data, 'Failed to create event.') };
    } catch (e: any) {
      console.error('Failed to create event:', e);
      return { success: false, error: e?.message || 'Network error creating event.' };
    }
  },

  async updateEvent(id: number, eventData: Partial<EventItem>): Promise<{ success: boolean; data?: EventItem; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/events/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, data };
      }
      return { success: false, error: formatApiError(data, 'Failed to update event.') };
    } catch (e: any) {
      console.error('Failed to update event:', e);
      return { success: false, error: e?.message || 'Network error updating event.' };
    }
  },

  async deleteEvent(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/events/${id}/`, {
        method: 'DELETE',
      });
      return res.ok || res.status === 204;
    } catch (e) {
      console.error('Failed to delete event:', e);
      return false;
    }
  },

  async getEventServices(eventId: number): Promise<EventServiceItem[]> {
    try {
      const res = await fetch(`${API_BASE}/event-services/?event=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.results || [];
      }
    } catch (e) {
      console.error('Failed to fetch event services:', e);
    }
    return [];
  },

  async createEventService(serviceData: Partial<EventServiceItem> & { event: number }): Promise<{ success: boolean; data?: EventServiceItem; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/event-services/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, data };
      }
      return { success: false, error: formatApiError(data, 'Failed to add event service.') };
    } catch (e: any) {
      console.error('Failed to add event service:', e);
      return { success: false, error: e?.message || 'Network error adding event service.' };
    }
  },

  async updateEventService(id: number | string, serviceData: Partial<EventServiceItem>): Promise<{ success: boolean; data?: EventServiceItem; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/event-services/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, data };
      }
      return { success: false, error: formatApiError(data, 'Failed to update event service.') };
    } catch (e: any) {
      console.error('Failed to update event service:', e);
      return { success: false, error: e?.message || 'Network error updating event service.' };
    }
  },

  async deleteEventService(id: number | string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/event-services/${id}/`, {
        method: 'DELETE',
      });
      return res.ok || res.status === 204;
    } catch (e) {
      console.error('Failed to delete event service:', e);
      return false;
    }
  },

  async getNotifications(userId: number | string): Promise<NotificationItem[]> {
    try {
      const res = await fetch(`${API_BASE}/notifications/?user_id=${userId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
    return [];
  },

  async markNotificationRead(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/notifications/${id}/mark_read/`, {
        method: 'POST',
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to mark notification read:', e);
      return false;
    }
  },

  async markAllNotificationsRead(userId: number | string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/notifications/mark_all_read/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to mark all notifications read:', e);
      return false;
    }
  },

  async getReminderPreferences(userId: number | string): Promise<ReminderPreference> {
    try {
      const res = await fetch(`${API_BASE}/reminder-preferences/?user_id=${userId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch reminder preferences:', e);
    }
    return {
      in_app_enabled: true,
      email_enabled: false,
      remind_7_days: true,
      remind_1_day: true,
      remind_due_today: true,
      remind_overdue: true,
    };
  },

  async updateReminderPreferences(userId: number | string, prefs: Partial<ReminderPreference>): Promise<{ success: boolean; data?: ReminderPreference; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/reminder-preferences/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ...prefs }),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, data };
      }
      return { success: false, error: formatApiError(data, 'Failed to update reminder preferences.') };
    } catch (e: any) {
      console.error('Failed to update reminder preferences:', e);
      return { success: false, error: e?.message || 'Network error updating reminder preferences.' };
    }
  }
};


