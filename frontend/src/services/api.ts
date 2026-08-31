import type { Venue, Vendor, Booking, PlatformStats, FilterState, BookingStatus } from '../types';

const API_BASE = 'http://localhost:8000/api';

export const ApiService = {
  async getVenues(filters: Partial<FilterState> = {}): Promise<Venue[]> {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
      if (filters.location && filters.location !== 'ALL') params.append('location', filters.location);
      if (filters.max_price) params.append('max_price', filters.max_price.toString());
      if (filters.min_capacity) params.append('min_capacity', filters.min_capacity.toString());
      if (filters.verified_only) params.append('verified', 'true');

      const res = await fetch(`${API_BASE}/venues/?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.results || [];
      }
    } catch (e) {
      console.error("Failed to fetch venues", e);
    }
    return [];
  },

  async getVendors(filters: Partial<FilterState> = {}): Promise<Vendor[]> {
    try {
      const q = new URLSearchParams();
      if (filters.search) q.append('search', filters.search);
      if (filters.vendor_type && filters.vendor_type !== 'ALL') q.append('vendor_type', filters.vendor_type);
      if (filters.location && filters.location !== 'ALL') q.append('location', filters.location);
      if (filters.verified_only) q.append('verified', 'true');

      const res = await fetch(`${API_BASE}/vendors/?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return data.results || data;
      }
    } catch (e) {
      console.error("Failed to fetch vendors", e);
    }
    return [];
  },

  async registerVendor(data: any): Promise<Vendor | null> {
    try {
      const res = await fetch(`${API_BASE}/vendors/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return await res.json();
      }
      const errorData = await res.json();
      console.error('Registration failed:', errorData);
    } catch (e) {
      console.error('Failed to register vendor:', e);
    }
    return null;
  },

  async loginVendor(credentials: any): Promise<Vendor | null> {
    try {
      const res = await fetch(`${API_BASE}/vendors/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (res.ok) {
        return await res.json();
      }
      const errorData = await res.json();
      console.error('Login failed:', errorData);
    } catch (e) {
      console.error('Failed to login vendor:', e);
    }
    return null;
  },

  async getBookings(): Promise<Booking[]> {
    try {
      const res = await fetch(`${API_BASE}/bookings/`);
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
    try {
      const res = await fetch(`${API_BASE}/bookings/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });
      if (res.ok) {
        return await res.json();
      }
      throw new Error(await res.text());
    } catch (e) {
      console.error("Failed to create booking", e);
      throw e;
    }
  },

  async updateBookingStatus(id: number, status: BookingStatus): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/bookings/${id}/update_status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) return true;
    } catch (e) {
      console.error("Failed to update status", e);
    }
    return false;
  },

  async toggleVerifyVenue(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/venues/${id}/toggle_verify/`, {
        method: 'POST',
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
      });
      if (res.ok) return true;
    } catch (e) {
      console.error("Failed to toggle verify vendor", e);
    }
    return false;
  },

  async addVenue(venueData: Partial<Venue>): Promise<Venue> {
    try {
      const res = await fetch(`${API_BASE}/venues/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(venueData),
      });
      if (res.ok) return await res.json();
      throw new Error(await res.text());
    } catch (e) {
      console.error("Failed to add venue", e);
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
  }
};
