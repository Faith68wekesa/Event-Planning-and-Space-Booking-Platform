export type UserRole = 'CUSTOMER' | 'VENDOR' | 'ADMIN';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  phone_number?: string;
  avatar_url?: string;
  bio?: string;
}

export type VendorType = 
  | 'PLANNER' 
  | 'CATERER' 
  | 'PHOTOGRAPHER' 
  | 'DECORATOR' 
  | 'SOUND_LIGHTING' 
  | 'ENTERTAINMENT';

export interface Vendor {
  id: number;
  user: number;
  business_name: string;
  vendor_type: VendorType;
  vendor_type_display: string;
  description: string;
  location: string;
  starting_price: number;
  contact_email?: string;
  contact_phone?: string;
  is_verified: boolean;
  portfolio_images: string[];
  rating: number;
  review_count: number;
  created_at?: string;
}

export type VenueCategory = 
  | 'WEDDING' 
  | 'CONFERENCE' 
  | 'BIRTHDAY' 
  | 'OUTDOOR' 
  | 'PARTY' 
  | 'EXHIBITION';

export interface Venue {
  id: number;
  vendor?: number;
  vendor_name?: string;
  title: string;
  description: string;
  category: VenueCategory;
  category_display: string;
  location: string;
  address?: string;
  capacity: number;
  price_per_day: number;
  price_per_hour?: number;
  amenities: string[];
  image_url: string;
  is_verified: boolean;
  is_available: boolean;
  rating: number;
  review_count: number;
  created_at?: string;
}

export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

export interface Booking {
  id: number;
  customer: number;
  customer_name?: string;
  venue?: number;
  venue_details?: Venue;
  vendor?: number;
  vendor_details?: Vendor;
  event_title: string;
  event_type: string;
  event_date: string;
  end_date?: string;
  guest_count: number;
  total_price: number;
  status: BookingStatus;
  notes?: string;
  created_at?: string;
}

export interface Review {
  id: number;
  user: number;
  user_name: string;
  venue?: number;
  vendor?: number;
  rating: number;
  comment: string;
  created_at: string;
}

export interface FilterState {
  search: string;
  category: string;
  vendor_type: string;
  location: string;
  max_price: number;
  min_capacity: number;
  verified_only: boolean;
}

export interface PlatformStats {
  total_venues: number;
  verified_venues: number;
  total_vendors: number;
  verified_vendors: number;
  total_bookings: number;
  satisfied_clients: number;
}
