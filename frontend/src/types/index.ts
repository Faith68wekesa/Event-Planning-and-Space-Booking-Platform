export type UserRole = 'CUSTOMER' | 'PROVIDER' | 'VENDOR' | 'VENUE_OWNER' | 'ADMIN';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  is_customer?: boolean;
  is_vendor?: boolean;
  is_venue_owner?: boolean;
  is_provider?: boolean;
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  date_joined?: string;
  phone_number?: string;
  avatar_url?: string;
  bio?: string;
}

export interface AuthResponse {
  user: User;
  roles: {
    is_customer: boolean;
    is_vendor: boolean;
    is_venue_owner: boolean;
    is_provider?: boolean;
    is_admin?: boolean;
  };
  vendor_profile?: Vendor;
  venue_owner_profile?: VenueOwner;
}

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type VendorType = 
  | 'Catering'
  | 'Photography'
  | 'Videography'
  | 'Event Decoration'
  | 'Entertainment'
  | 'DJ Services'
  | 'MC Services'
  | 'Event Planning'
  | 'Transport'
  | 'Florist'
  | 'Makeup & Beauty'
  | 'Security'
  | 'Equipment Rental'
  | 'Other'
  | string;

export interface Vendor {
  id: number;
  user: number;
  user_details?: User;
  business_name: string;
  vendor_type: VendorType;
  vendor_type_display: string;
  description: string;
  location: string;
  address?: string;
  starting_price: number;
  contact_email?: string;
  contact_phone?: string;
  years_in_business?: number;
  website_url?: string;
  logo_url?: string;
  verification_status?: VerificationStatus;
  is_verified: boolean;
  portfolio_images: string[];
  rating: number;
  review_count: number;
  created_at?: string;
}

export type VenueOwnerBusinessType =
  | 'Hotel'
  | 'Conference Centre'
  | 'Event Hall'
  | 'Wedding Venue'
  | 'Garden'
  | 'Restaurant'
  | 'Outdoor Space'
  | 'Community Centre'
  | 'Beach Venue'
  | 'Resort'
  | 'Private Estate'
  | 'Other'
  | string;

export interface VenueOwner {
  id: number;
  user: number;
  user_details?: User;
  business_name: string;
  business_type?: VenueOwnerBusinessType;
  contact_email?: string;
  contact_phone?: string;
  location?: string;
  address?: string;
  description?: string;
  years_in_business?: number;
  website_url?: string;
  logo_url?: string;
  verification_status?: VerificationStatus;
  is_verified: boolean;
  created_at?: string;
}

export type VenueCategory = 
  | 'WEDDING' 
  | 'CONFERENCE' 
  | 'BIRTHDAY' 
  | 'OUTDOOR' 
  | 'PARTY' 
  | 'EXHIBITION'
  | 'PHOTOGRAPHY'
  | 'CATERING'
  | 'DECORATION'
  | 'ENTERTAINMENT'
  | 'PLANNING'
  | 'SOUND';

export interface Venue {
  id: number;
  vendor?: number;
  vendor_name?: string;
  owner?: number;
  owner_name?: string;
  owner_user_id?: number;
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
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
  cancellation_policy?: 'FLEXIBLE' | 'MODERATE' | 'STRICT';
  verification_status?: VerificationStatus | 'DRAFT' | 'CHANGES_REQUIRED';
  is_available: boolean;
  rating: number;
  review_count: number;
  created_at?: string;
  updated_at?: string;
}

export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

export interface Booking {
  id: number;
  customer: number;
  customer_name?: string;
  customer_email?: string;
  venue?: number;
  venue_details?: Venue;
  vendor?: number;
  vendor_details?: Vendor;
  provider_user_id?: number;
  event_title: string;
  event_type: string;
  event_date: string;
  end_date?: string;
  guest_count: number;
  total_price: number;
  status: BookingStatus;
  notes?: string;
  rejection_reason?: string;
  cancelled_at?: string;
  cancelled_by?: 'CUSTOMER' | 'PROVIDER' | 'ADMIN' | 'SYSTEM';
  cancellation_reason?: string;
  has_reviewed?: boolean;
  review?: Review;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id: number;
  sender: number;
  sender_name: string;
  sender_avatar?: string;
  recipient: number;
  recipient_name: string;
  recipient_avatar?: string;
  booking?: number;
  event_title?: string;
  venue?: number;
  venue_title?: string;
  vendor?: number;
  vendor_name?: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ConversationThread {
  partner_id: number;
  partner_name: string;
  partner_username: string;
  partner_avatar?: string;
  partner_role?: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  booking_id?: number;
  event_title?: string;
  venue_id?: number;
  venue_title?: string;
  vendor_id?: number;
  vendor_name?: string;
}

export interface Review {
  id: number;
  user: number;
  user_name: string;
  booking?: number;
  venue?: number;
  vendor?: number;
  target_name?: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at?: string;
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
  total_users?: number;
  total_customers?: number;
  total_providers?: number;
  pending_verifications?: number;
  pending_bookings?: number;
  approved_bookings?: number;
  completed_bookings?: number;
  cancelled_bookings?: number;
  total_revenue?: number;
  total_reviews?: number;
  avg_rating?: number;
}

export type EventStatus = 'Upcoming' | 'Planning' | 'Completed' | 'Cancelled';

export interface EventServiceItem {
  id: number | string;
  event: number;
  name: string;
  category?: string;
  notes?: string;
  estimated_cost?: number | string | null;
  is_completed: boolean;
  due_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EventItem {
  id: number;
  owner?: number;
  owner_name?: string;
  name: string;
  event_type: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  location: string;
  expected_guest_count: number;
  budget: number | string;
  description?: string;
  status?: EventStatus;
  image_url?: string | null;
  services?: EventServiceItem[];
  created_at?: string;
  updated_at?: string;
}

export interface NotificationItem {
  id: number;
  user: number;
  event?: number | null;
  event_name?: string | null;
  task?: number | null;
  task_name?: string | null;
  title: string;
  message: string;
  notification_type: 'CHECKLIST_REMINDER' | 'BOOKING_UPDATE' | 'SYSTEM';
  is_read: boolean;
  created_at: string;
}

export interface ReminderPreference {
  id?: number;
  user?: number;
  in_app_enabled: boolean;
  email_enabled: boolean;
  remind_7_days: boolean;
  remind_1_day: boolean;
  remind_due_today: boolean;
  remind_overdue: boolean;
  updated_at?: string;
}


