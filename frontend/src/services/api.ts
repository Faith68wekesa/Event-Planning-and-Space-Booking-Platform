import type { Venue, Vendor, Booking, PlatformStats, FilterState, BookingStatus } from '../types';

const API_BASE = 'http://localhost:8000/api';

export const INITIAL_MOCK_VENUES: Venue[] = [
  {
    id: 1,
    title: 'Karen Oasis Grand Botanical Gardens',
    description: 'Sprawling 10-acre lush botanical gardens offering picturesque backdrop for weddings, galas, and outdoor receptions.',
    category: 'WEDDING',
    category_display: 'Wedding Gardens & Halls',
    location: 'Nairobi',
    address: 'Karen Road, Near Fairview Estate, Nairobi',
    capacity: 850,
    price_per_day: 120000,
    price_per_hour: 15000,
    amenities: ['Manicured Lawns', 'Ample Parking (300 Cars)', 'Generator Backup', 'Bridal Suite', 'High-Speed WiFi'],
    image_url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80',
    is_verified: true,
    is_available: true,
    rating: 4.95,
    review_count: 38,
  },
  {
    id: 2,
    title: 'Rift Valley Heights Corporate Conference Center',
    description: 'State-of-the-art conference venue with panoramic views of Lake Naivasha, perfect for executive retreats and symposiums.',
    category: 'CONFERENCE',
    category_display: 'Conference & Corporate Centers',
    location: 'Naivasha',
    address: 'Moi South Lake Road, Naivasha',
    capacity: 400,
    price_per_day: 85000,
    price_per_hour: 12000,
    amenities: ['Full AV Projection', 'Breakout Rooms', 'Air Conditioning', 'Executive Catering', 'Lake View Terrace'],
    image_url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
    is_verified: true,
    is_available: true,
    rating: 4.85,
    review_count: 24,
  },
  {
    id: 3,
    title: 'Coastal Pearl Palms Beachfront Lawn',
    description: 'Stunning beachfront outdoor venue featuring sway palms, ocean views, and ambient sea breeze for sunset events.',
    category: 'OUTDOOR',
    category_display: 'Outdoor & Picnic Grounds',
    location: 'Mombasa',
    address: 'Nyali Beachfront, Mombasa',
    capacity: 600,
    price_per_day: 95000,
    price_per_hour: 14000,
    amenities: ['Private Ocean Access', 'Coconut Grove Stage', 'Mood Lighting', 'Beachside Bar', 'Security Guarding'],
    image_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
    is_verified: true,
    is_available: true,
    rating: 4.9,
    review_count: 42,
  },
  {
    id: 4,
    title: 'Mount Kenya View Pavilion',
    description: 'Picturesque glass pavilion with unobstructed views of Mount Kenya peaks, designed for birthdays and evening celebrations.',
    category: 'PARTY',
    category_display: 'Nightlife & Celebration Spaces',
    location: 'Nyeri',
    address: 'Nyeri-Nanyuki Highway, Nyeri',
    capacity: 300,
    price_per_day: 55000,
    price_per_hour: 8000,
    amenities: ['Glass Wall Pavilion', 'Outdoor Bonfire Pit', 'Built-in Stage', 'PA System'],
    image_url: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=800&q=80',
    is_verified: false,
    is_available: true,
    rating: 4.6,
    review_count: 14,
  },
  {
    id: 5,
    title: 'Westlands Skyline VIP Loft & Terrace',
    description: 'Modern rooftop venue overlooking Nairobi city skyline, equipped for birthdays, product launches, and private dinners.',
    category: 'BIRTHDAY',
    category_display: 'Birthday & Private Party Venues',
    location: 'Nairobi',
    address: 'Muthangari Drive, Westlands, Nairobi',
    capacity: 150,
    price_per_day: 65000,
    price_per_hour: 9500,
    amenities: ['Rooftop Deck', 'Cocktail Bar', 'DJ Booth', 'VIP Lounge Seating', 'Valet Parking'],
    image_url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
    is_verified: true,
    is_available: true,
    rating: 4.75,
    review_count: 29,
  }
];

export const INITIAL_MOCK_VENDORS: Vendor[] = [
  {
    id: 1,
    user: 3,
    business_name: 'Serena Prestige Event Planners',
    vendor_type: 'PLANNER',
    vendor_type_display: 'Event Planner',
    description: 'Bespoke corporate conference & luxury wedding planning with over 10 years experience in East Africa.',
    location: 'Nairobi',
    starting_price: 45000,
    contact_email: 'contact@serenaevents.co.ke',
    contact_phone: '+254700112233',
    is_verified: true,
    portfolio_images: [
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=800&q=80'
    ],
    rating: 4.9,
    review_count: 56,
  },
  {
    id: 2,
    user: 4,
    business_name: 'Royal Feast Gourmet Caterers',
    vendor_type: 'CATERER',
    vendor_type_display: 'Catering Service',
    description: 'Multi-cuisine catering, cocktail service, and formal seated dining for events of up to 2,000 guests.',
    location: 'Nairobi',
    starting_price: 25000,
    contact_email: 'info@royalfeast.co.ke',
    contact_phone: '+254711223344',
    is_verified: true,
    portfolio_images: [
      'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80'
    ],
    rating: 4.8,
    review_count: 41,
  },
  {
    id: 3,
    user: 5,
    business_name: 'Prism Visuals Photography & Film',
    vendor_type: 'PHOTOGRAPHER',
    vendor_type_display: 'Photography & Video',
    description: 'Cinematic 4K video recording, drone coverage, and high-end event photography.',
    location: 'Nakuru',
    starting_price: 30000,
    contact_email: 'hello@prismvisuals.co.ke',
    contact_phone: '+254722334455',
    is_verified: true,
    portfolio_images: [
      'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=800&q=80'
    ],
    rating: 4.95,
    review_count: 67,
  },
  {
    id: 4,
    user: 6,
    business_name: 'Atmosphere Event Decorators',
    vendor_type: 'DECORATOR',
    vendor_type_display: 'Decoration & Styling',
    description: 'Tropical beach wedding setups, floral design, thematic lighting, and elegant lounge furniture rentals.',
    location: 'Mombasa',
    starting_price: 35000,
    contact_email: 'decor@atmosphere.co.ke',
    contact_phone: '+254733445566',
    is_verified: false,
    portfolio_images: [
      'https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=800&q=80'
    ],
    rating: 4.6,
    review_count: 19,
  },
  {
    id: 5,
    user: 7,
    business_name: 'Sonic Stage Sound & Lighting',
    vendor_type: 'SOUND_LIGHTING',
    vendor_type_display: 'Sound & Stage Lighting',
    description: 'Concert-grade sound systems, LED screens, intelligent stage lighting, and professional sound engineers.',
    location: 'Nyeri',
    starting_price: 20000,
    contact_email: 'booking@sonicstage.co.ke',
    contact_phone: '+254744556677',
    is_verified: true,
    portfolio_images: [
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80'
    ],
    rating: 4.7,
    review_count: 32,
  }
];

export const INITIAL_MOCK_BOOKINGS: Booking[] = [
  {
    id: 101,
    customer: 2,
    customer_name: 'John Maina',
    venue: 1,
    venue_details: INITIAL_MOCK_VENUES[0],
    event_title: 'Maina & Wambui Dream Wedding',
    event_type: 'Wedding Reception',
    event_date: '2026-09-15',
    guest_count: 450,
    total_price: 120000,
    status: 'APPROVED',
    notes: 'Requires setup starting 6:00 AM. Catering handled by Royal Feast.',
    created_at: '2026-08-01',
  },
  {
    id: 102,
    customer: 2,
    customer_name: 'John Maina',
    vendor: 1,
    vendor_details: INITIAL_MOCK_VENDORS[0],
    event_title: 'East Africa Tech Leadership Summit 2026',
    event_type: 'Corporate Conference',
    event_date: '2026-10-10',
    guest_count: 250,
    total_price: 45000,
    status: 'PENDING',
    notes: 'Need full itinerary planning and guest accommodation booking.',
    created_at: '2026-08-05',
  }
];

function filterVenuesLocal(venues: Venue[], filters: Partial<FilterState>): Venue[] {
  return venues.filter((v) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match = v.title.toLowerCase().includes(q) || 
                    v.description.toLowerCase().includes(q) || 
                    v.location.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filters.category && filters.category !== 'ALL' && v.category !== filters.category) {
      return false;
    }
    if (filters.location && filters.location !== 'ALL' && !v.location.toLowerCase().includes(filters.location.toLowerCase())) {
      return false;
    }
    if (filters.max_price && v.price_per_day > filters.max_price) {
      return false;
    }
    if (filters.min_capacity && v.capacity < filters.min_capacity) {
      return false;
    }
    if (filters.verified_only && !v.is_verified) {
      return false;
    }
    return true;
  });
}

function filterVendorsLocal(vendors: Vendor[], filters: Partial<FilterState>): Vendor[] {
  return vendors.filter((v) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match = v.business_name.toLowerCase().includes(q) || 
                    v.description.toLowerCase().includes(q) || 
                    v.location.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filters.vendor_type && filters.vendor_type !== 'ALL' && v.vendor_type !== filters.vendor_type) {
      return false;
    }
    if (filters.location && filters.location !== 'ALL' && !v.location.toLowerCase().includes(filters.location.toLowerCase())) {
      return false;
    }
    if (filters.verified_only && !v.is_verified) {
      return false;
    }
    return true;
  });
}

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
    } catch {
      // Fallback
    }
    return filterVenuesLocal(INITIAL_MOCK_VENUES, filters);
  },

  async getVendors(filters: Partial<FilterState> = {}): Promise<Vendor[]> {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.vendor_type && filters.vendor_type !== 'ALL') params.append('vendor_type', filters.vendor_type);
      if (filters.location && filters.location !== 'ALL') params.append('location', filters.location);
      if (filters.verified_only) params.append('verified', 'true');

      const res = await fetch(`${API_BASE}/vendors/?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.results || [];
      }
    } catch {
      // Fallback
    }
    return filterVendorsLocal(INITIAL_MOCK_VENDORS, filters);
  },

  async getBookings(): Promise<Booking[]> {
    try {
      const res = await fetch(`${API_BASE}/bookings/`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.results || [];
      }
    } catch {
      // Fallback
    }
    return INITIAL_MOCK_BOOKINGS;
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
    } catch {
      // Fallback
    }
    const newBooking: Booking = {
      id: Math.floor(Math.random() * 9000) + 1000,
      customer: 2,
      customer_name: 'John Maina',
      event_title: bookingData.event_title || 'Special Event',
      event_type: bookingData.event_type || 'Custom Event',
      event_date: bookingData.event_date || new Date().toISOString().split('T')[0],
      guest_count: bookingData.guest_count || 100,
      total_price: bookingData.total_price || 50000,
      status: 'PENDING',
      notes: bookingData.notes,
      created_at: new Date().toISOString().split('T')[0],
      venue: bookingData.venue,
      vendor: bookingData.vendor,
      venue_details: bookingData.venue_details,
      vendor_details: bookingData.vendor_details,
    };
    INITIAL_MOCK_BOOKINGS.unshift(newBooking);
    return newBooking;
  },

  async updateBookingStatus(id: number, status: BookingStatus): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/bookings/${id}/update_status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) return true;
    } catch {
      // Fallback
    }
    const b = INITIAL_MOCK_BOOKINGS.find((item) => item.id === id);
    if (b) {
      b.status = status;
      return true;
    }
    return false;
  },

  async toggleVerifyVenue(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/venues/${id}/toggle_verify/`, {
        method: 'POST',
      });
      if (res.ok) return true;
    } catch {
      // Fallback
    }
    const v = INITIAL_MOCK_VENUES.find((item) => item.id === id);
    if (v) {
      v.is_verified = !v.is_verified;
      return true;
    }
    return false;
  },

  async toggleVerifyVendor(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/vendors/${id}/toggle_verify/`, {
        method: 'POST',
      });
      if (res.ok) return true;
    } catch {
      // Fallback
    }
    const v = INITIAL_MOCK_VENDORS.find((item) => item.id === id);
    if (v) {
      v.is_verified = !v.is_verified;
      return true;
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
    } catch {
      // Fallback
    }
    const newV: Venue = {
      id: Math.floor(Math.random() * 9000) + 1000,
      title: venueData.title || 'New Venue',
      description: venueData.description || '',
      category: venueData.category || 'WEDDING',
      category_display: venueData.category || 'Event Venue',
      location: venueData.location || 'Nairobi',
      address: venueData.address || '',
      capacity: venueData.capacity || 200,
      price_per_day: venueData.price_per_day || 50000,
      price_per_hour: venueData.price_per_hour || 7500,
      amenities: venueData.amenities || ['Parking', 'Generator'],
      image_url: venueData.image_url || 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80',
      is_verified: false,
      is_available: true,
      rating: 5.0,
      review_count: 1,
    };
    INITIAL_MOCK_VENUES.unshift(newV);
    return newV;
  },

  async getStats(): Promise<PlatformStats> {
    try {
      const res = await fetch(`${API_BASE}/stats/`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return {
      total_venues: INITIAL_MOCK_VENUES.length,
      verified_venues: INITIAL_MOCK_VENUES.filter((v) => v.is_verified).length,
      total_vendors: INITIAL_MOCK_VENDORS.length,
      verified_vendors: INITIAL_MOCK_VENDORS.filter((v) => v.is_verified).length,
      total_bookings: INITIAL_MOCK_BOOKINGS.length,
      satisfied_clients: 340,
    };
  }
};
