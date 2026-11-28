import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Booking, Venue, BookingStatus, Vendor, VenueOwner, User, Message, ConversationThread, Review, NotificationItem } from '../types';
import { ApiService } from '../services/api';
import { NotificationBell } from './NotificationBell';
import './vendor-dashboard.css';
import {
  Building2,
  Plus,
  Pencil,
  X,
  MapPin,
  Trash2,
  User as UserIcon,
  LayoutDashboard,
  CalendarCheck,
  Calendar,
  Star,
  Settings,
  LogOut,
  Search,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  AlertCircle,
  Users,
  MessageSquare,
  Check,
  Layers,
  Send,
  ShieldCheck,
  Clock,
  ImageOff,
  Mail,
  Phone,
  Menu
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cleanImageUrl } from '../utils/imageUtils';
import { CreateListingPage } from './CreateListingPage';
import { ProviderAvailabilityDashboard } from './ProviderAvailabilityDashboard';

const NYERI_COUNTY_LOCATION = 'Nyeri County, Kenya';

const getBookingListingTitle = (booking: Booking) =>
  booking.venue_details?.title || booking.vendor_details?.business_name || 'Booked listing';

const getBookingListingImage = (booking: Booking) => cleanImageUrl(
  booking.venue_details?.image_url
    || booking.vendor_details?.logo_url
    || booking.vendor_details?.portfolio_images?.[0]
);

const parseBookingSchedule = (notes?: string) => {
  const startTime = notes?.match(/\bStart Time:\s*(\d{1,2}:\d{2})/i)?.[1];
  const endTime = notes?.match(/\bEnd Time:\s*(\d{1,2}:\d{2})/i)?.[1];
  const customerNotes = (notes || '')
    .replace(/\bStart Time:\s*\d{1,2}:\d{2}/gi, '')
    .replace(/\bEnd Time:\s*\d{1,2}:\d{2}/gi, '')
    .trim();

  return { startTime, endTime, customerNotes };
};

interface ProviderDashboardProps {
  currentUser?: User | null;
  currentVendor?: Vendor | null;
  currentVenueOwner?: VenueOwner | null;
  onLogout: () => void;
}

export const ProviderDashboard: React.FC<ProviderDashboardProps> = ({
  currentUser,
  currentVendor,
  currentVenueOwner,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'listings' | 'spaces' | 'services' | 'availability' | 'bookings' | 'calendar' | 'reviews' | 'messages' | 'profile' | 'settings' | 'create_listing'>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [providerSearchQuery, setProviderSearchQuery] = useState('');
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [createListingDefaultMode, setCreateListingDefaultMode] = useState<'service' | 'venue'>('service');
  const [editingListing, setEditingListing] = useState<Venue | null>(null);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [activeTab]);

  // Inspiration UI Navigation and Filter States
  const [listingsCategoryFilter, setListingsCategoryFilter] = useState<string>('ALL');

  // Data states
  const [spaces, setSpaces] = useState<Venue[]>([]);
  const [services, setServices] = useState<Venue[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [, setLoading] = useState(true);

  // Business profile form & live verification state
  const [liveVendor, setLiveVendor] = useState<Vendor | null>(currentVendor || null);
  const [liveVenueOwner, setLiveVenueOwner] = useState<VenueOwner | null>(currentVenueOwner || null);

  useEffect(() => {
    if (!showAccountMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) {
        setShowAccountMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowAccountMenu(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAccountMenu]);

  useEffect(() => {
    if (currentVendor) setLiveVendor(currentVendor);
  }, [currentVendor]);

  useEffect(() => {
    if (currentVenueOwner) setLiveVenueOwner(currentVenueOwner);
  }, [currentVenueOwner]);

  const effectiveVendor = liveVendor || currentVendor;
  const effectiveVenueOwner = liveVenueOwner || currentVenueOwner;
  const hasApprovedBusinessAccount = [effectiveVendor, effectiveVenueOwner].some(
    profile => profile?.verification_status === 'APPROVED' && profile.is_verified
  );

  const businessName = effectiveVenueOwner?.business_name || effectiveVendor?.business_name || 'My Business';
  const location = effectiveVenueOwner?.location || effectiveVendor?.location || 'Nairobi';
  const email = effectiveVenueOwner?.contact_email || effectiveVendor?.contact_email || '';
  const phone = effectiveVenueOwner?.contact_phone || effectiveVendor?.contact_phone || '';

  const openCreateListing = (mode: 'service' | 'venue' = 'service') => {
    if (!hasApprovedBusinessAccount) {
      toast.error('Your business account must be approved before you can create listings.');
      return;
    }
    setEditingListing(null);
    setCreateListingDefaultMode(mode);
    setActiveTab('create_listing');
  };

  const [profileFormData, setProfileFormData] = useState({
    business_name: businessName,
    location: location,
    contact_email: email,
    contact_phone: phone,
    description: effectiveVenueOwner?.description || effectiveVendor?.description || '',
    website_url: effectiveVenueOwner?.website_url || effectiveVendor?.website_url || '',
  });

  useEffect(() => {
    setProfileFormData({
      business_name: businessName,
      location: location,
      contact_email: email,
      contact_phone: phone,
      description: effectiveVenueOwner?.description || effectiveVendor?.description || '',
      website_url: effectiveVenueOwner?.website_url || effectiveVendor?.website_url || '',
    });
  }, [businessName, location, email, phone, effectiveVenueOwner?.description, effectiveVendor?.description, effectiveVenueOwner?.website_url, effectiveVendor?.website_url]);

  const [isUploading, setIsUploading] = useState(false);

  // Modal states
  const [showAddSpaceModal, setShowAddSpaceModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [spaceErrorNotice, setSpaceErrorNotice] = useState<string | null>(null);
  const [serviceErrorNotice, setServiceErrorNotice] = useState<string | null>(null);

  // New Space Form
  const [newSpace, setNewSpace] = useState({
    title: '',
    category: 'WEDDING',
    custom_category: '',
    address: '',
    capacity: '' as number | '',
    price_per_day: 65000,
    price_per_hour: 8000,
    description: '',
    amenities: 'Parking, Sound System, Restrooms, Security',
    image_url: '',
  });

  // New Service Form
  const [newService, setNewService] = useState({
    title: '',
    category: 'PHOTOGRAPHY',
    custom_category: '',
    pricing_type: 'Per Event',
    capacity: '' as number | '',
    price_per_day: 25000,
    description: '',
    image_url: '',
  });

  // Filter states
  const [bookingFilter, setBookingFilter] = useState<'ALL' | 'SPACES' | 'SERVICES'>('ALL');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'CANCELLED'>('ALL');
  const [listingStatusFilter, setListingStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [listingTypeFilter, setListingTypeFilter] = useState<'ALL' | 'VENUE' | 'SERVICE'>('ALL');
  const [listingLoadError, setListingLoadError] = useState(false);
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [providerReviews, setProviderReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false);
  const [selectedBookingChatId, setSelectedBookingChatId] = useState<string | number | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [realChatMessages, setRealChatMessages] = useState<Message[]>([]);
  const [loadingChatMessages, setLoadingChatMessages] = useState(false);
  const [sendingChatMessage, setSendingChatMessage] = useState(false);

  const fetchProviderConversations = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      const threads = await ApiService.getConversations(currentUser.id);
      setConversations(threads);

      if (threads.length > 0) {
        setSelectedPartnerId(current =>
          current || threads[0].partner_id
        );
      }
    } catch (e) {
      console.error("Failed to load provider conversations", e);
    }
  }, [currentUser?.id]);

  const fetchThreadMessages = useCallback(async (partnerId: number) => {
    if (!currentUser?.id) return;
    try {
      setLoadingChatMessages(true);
      const msgs = await ApiService.getMessages({ user: currentUser.id, partner: partnerId });
      setRealChatMessages(msgs);
      await ApiService.markThreadRead(currentUser.id, partnerId);
    } catch (e) {
      console.error("Failed to load thread messages", e);
    } finally {
      setLoadingChatMessages(false);
    }
  }, [currentUser?.id]);

  const fetchChatMessages = useCallback(async (bookingId: number) => {
    try {
      setLoadingChatMessages(true);
      const msgs = await ApiService.getMessages({ booking: bookingId });
      setRealChatMessages(msgs);
    } catch (e) {
      console.error("Failed to load chat messages", e);
    } finally {
      setLoadingChatMessages(false);
    }
  }, []);

  const handleOpenNotification = (notification: NotificationItem) => {
    if (notification.message_sender_id) {
      setSelectedPartnerId(notification.message_sender_id);
      if (notification.booking) setSelectedBookingChatId(notification.booking);
      setActiveTab('messages');
      return;
    }

    switch (notification.target_tab) {
      case 'messages':
        setActiveTab('messages');
        break;
      case 'reviews':
        setActiveTab('reviews');
        break;
      case 'listings':
        setActiveTab('listings');
        break;
      case 'profile':
        setActiveTab('profile');
        break;
      case 'bookings':
      default:
        setActiveTab('bookings');
        break;
    }
    void fetchData();
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setListingLoadError(false);
    try {
      const userId = currentUser?.id;

      if (!userId) {
        setSpaces([]);
        setServices([]);
        setBookings([]);
        setLoading(false);
        return;
      }

      let fetchedBookings: Booking[] = [];

      if (userId) {
        try {
          const [userBookings, liveVendors, liveOwners] = await Promise.all([
            ApiService.getBookings({ user: userId }),
            ApiService.getVendors({ user: userId }),
            ApiService.getVenueOwners({ user: userId }),
          ]);
          if (liveVendors && liveVendors.length > 0) setLiveVendor(liveVendors[0]);
          if (liveOwners && liveOwners.length > 0) setLiveVenueOwner(liveOwners[0]);

          const existingIds = new Set(fetchedBookings.map(b => b.id));
          userBookings.forEach(b => {
            if (!existingIds.has(b.id)) fetchedBookings.push(b);
          });
        } catch (e) {
          console.error("Failed to load user bookings or live profiles", e);
        }
      }

      const providerVenues = await ApiService.getProviderVenues().catch((error: unknown) => {
        setListingLoadError(true);
        throw error;
      });

      const myOwnListings = providerVenues;

      const isServiceListing = (v: Venue) => v.listing_type === 'SERVICE';
      const mySpaces = myOwnListings.filter(v => !isServiceListing(v));
      const myServices = myOwnListings.filter(v => isServiceListing(v));

      setSpaces(mySpaces);
      setServices(myServices);
      setBookings(fetchedBookings);
    } catch (err) {
      console.error("Failed to load provider data", err);
    } finally {
      setLoading(false);
    }
  }, [currentVendor?.id, currentVenueOwner?.id, currentUser?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab !== 'messages' || !currentUser?.id) return;

    fetchProviderConversations();

    const currentPartner = selectedPartnerId;
    const activeId = selectedBookingChatId || bookings[0]?.id;

    if (currentPartner) {
      fetchThreadMessages(currentPartner);
    } else if (activeId) {
      fetchChatMessages(Number(activeId));
    }

    const interval = setInterval(() => {
      fetchProviderConversations();

      if (currentPartner) {
        fetchThreadMessages(currentPartner);
      } else if (activeId) {
        fetchChatMessages(Number(activeId));
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [
    activeTab,
    currentUser?.id,
    selectedPartnerId,
    selectedBookingChatId,
    bookings[0]?.id,
    fetchProviderConversations,
    fetchThreadMessages,
    fetchChatMessages
  ]);

  useEffect(() => {
    if (activeTab === 'reviews') {
      const loadReviews = async () => {
        setLoadingReviews(true);
        try {
          const listingReviews = await Promise.all(
            [...spaces, ...services].map(listing => ApiService.getReviews({ venue: listing.id }))
          );
          const vendorProfileReviews = effectiveVendor?.id
            ? await ApiService.getReviews({ vendor: effectiveVendor.id })
            : [];
          const uniqueReviews = new Map<number, Review>();
          [...listingReviews.flat(), ...vendorProfileReviews].forEach(review => {
            uniqueReviews.set(review.id, review);
          });
          setProviderReviews([...uniqueReviews.values()]);
        } catch (e) {
          console.error("Failed to load provider reviews", e);
        } finally {
          setLoadingReviews(false);
        }
      };
      loadReviews();
    }
  }, [activeTab, effectiveVendor?.id, spaces, services]);

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && currentUser?.id) {
      const file = e.target.files[0];
      setIsUploading(true);
      const newUrl = await ApiService.uploadProfilePicture(currentUser.id, file);
      if (newUrl) {
        if (currentVendor) currentVendor.logo_url = newUrl;
        toast.success('Business logo/photo updated successfully!');
      } else {
        toast.error('Failed to upload picture.');
      }
      setIsUploading(false);
    }
  };

  // Add Space Submit
  const handleAddSpaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const spaceCategory = newSpace.category === 'OTHER'
      ? newSpace.custom_category.trim()
      : newSpace.category;
    if (!spaceCategory) {
      setSpaceErrorNotice('Enter a category for your venue.');
      return;
    }
    if (!newSpace.capacity || Number(newSpace.capacity) <= 0) {
      setSpaceErrorNotice('Enter the maximum guest capacity for your venue.');
      return;
    }

    let ownerId = currentVenueOwner?.id;
    let vendorId = currentVendor?.id;
    if (!ownerId && !vendorId && currentUser?.id) {
      try {
        const resp = await ApiService.requestRole(currentUser.id, 'PROVIDER');
        if (resp) {
          ownerId = resp.venue_owner_profile?.id;
          vendorId = resp.vendor_profile?.id;
        }
      } catch (err) {
        console.error("Auto-provisioning failed", err);
      }
    }
    if (!ownerId && !vendorId) {
      toast.error("Profile not found.");
      return;
    }
    setSubmitting(true);
    setSpaceErrorNotice(null);
    try {
      const amenitiesList = newSpace.amenities
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

      await ApiService.addVenue({
        owner: ownerId,
        vendor: vendorId,
        title: newSpace.title,
        category: spaceCategory,
        location: NYERI_COUNTY_LOCATION,
        address: newSpace.address,
        capacity: Number(newSpace.capacity),
        price_per_day: Number(newSpace.price_per_day),
        price_per_hour: Number(newSpace.price_per_hour),
        description: newSpace.description,
        amenities: amenitiesList,
        image_url: cleanImageUrl(newSpace.image_url),
      });

      toast.success("Event space submitted! Awaiting verification.");
      setShowAddSpaceModal(false);
      setSpaceErrorNotice(null);
      setNewSpace({
        title: '',
        category: 'WEDDING',
        custom_category: '',
        address: '',
        capacity: '' as number | '',
        price_per_day: 65000,
        price_per_hour: 8000,
        description: '',
        amenities: 'Parking, Sound System, Restrooms, Security',
        image_url: '',
      });
      fetchData();
    } catch (err: any) {
      const msg = err?.message || "Failed to add space. Please verify all required fields.";
      setSpaceErrorNotice(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Add Service Submit
  const handleAddServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const serviceCategory = newService.category === 'OTHER'
      ? newService.custom_category.trim()
      : newService.category;
    if (!serviceCategory) {
      setServiceErrorNotice('Enter a category for your service.');
      return;
    }
    if (!newService.capacity || Number(newService.capacity) <= 0) {
      setServiceErrorNotice('Enter the maximum number of guests your service can support.');
      return;
    }

    let vendorId = currentVendor?.id;
    let ownerId = currentVenueOwner?.id;
    if (!vendorId && !ownerId && currentUser?.id) {
      try {
        const resp = await ApiService.requestRole(currentUser.id, 'PROVIDER');
        if (resp) {
          vendorId = resp.vendor_profile?.id;
          ownerId = resp.venue_owner_profile?.id;
        }
      } catch (err) {
        console.error("Auto-provisioning failed", err);
      }
    }
    if (!vendorId && !ownerId) {
      toast.error("Profile not found.");
      return;
    }
    setSubmitting(true);
    setServiceErrorNotice(null);
    try {
      await ApiService.addVenue({
        vendor: vendorId,
        owner: ownerId,
        listing_type: 'SERVICE',
        title: newService.title,
        category: serviceCategory,
        location: location || 'Nairobi',
        capacity: Number(newService.capacity),
        price_per_day: Number(newService.price_per_day),
        description: `${newService.description} (${newService.pricing_type})`,
        image_url: cleanImageUrl(newService.image_url),
      });

      if (currentVendor && (Number(currentVendor.starting_price || 0) <= 0 || Number(newService.price_per_day) < Number(currentVendor.starting_price))) {
        currentVendor.starting_price = Number(newService.price_per_day);
      }

      toast.success("Service created successfully!");
      setShowAddServiceModal(false);
      setServiceErrorNotice(null);
      setNewService({
        title: '',
        category: 'PHOTOGRAPHY',
        custom_category: '',
        pricing_type: 'Per Event',
        capacity: '' as number | '',
        price_per_day: 25000,
        description: '',
        image_url: '',
      });
      fetchData();
    } catch (err: any) {
      const msg = err?.message || "Failed to add service. Please verify all required fields.";
      setServiceErrorNotice(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteListing = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    const ok = await ApiService.deleteVenue(id);
    if (ok) {
      toast.success(`"${title}" deleted successfully`);
      fetchData();
    } else {
      toast.error("Failed to delete listing.");
    }
  };

  const handleUpdateBookingStatus = async (id: number, status: BookingStatus) => {
    const res = await ApiService.updateBookingStatus(id, status);
    if (res.success) {
      toast.success(`Booking ${status.toLowerCase()}!`);
      fetchData();
    } else {
      toast.error(res.error || "Failed to update status.");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentVenueOwner?.id) {
        const updatedOwner = await ApiService.updateVenueOwner(currentVenueOwner.id, profileFormData);
        setLiveVenueOwner(updatedOwner);
      }
      if (currentVendor?.id) {
        const updatedVendor = await ApiService.updateVendor(currentVendor.id, profileFormData);
        setLiveVendor(updatedVendor);
      }
      toast.success("Business profile updated!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile.");
    }
  };

  // Helper to determine accurate listing verification/approval status
  const isListingPublished = (item: Venue) => Boolean(item.is_verified && (item.approval_status === 'APPROVED' || !item.approval_status));
  const isListingRejected = (item: Venue) => item.approval_status === 'REJECTED';

  const renderStatusBadge = (item: Venue) => {
    if (isListingPublished(item)) {
      return (
        <span className="status-badge approved">
          <ShieldCheck size={12} /> Published
        </span>
      );
    }
    if (isListingRejected(item)) {
      return (
        <span className="status-badge rejected" title={item.rejection_reason || 'Rejected by Admin'}>
          <AlertCircle size={12} /> Rejected
        </span>
      );
    }
    return (
      <span className="status-badge pending">
        <Clock size={12} /> Pending Admin Verification
      </span>
    );
  };

  // Metrics
  const activeSpacesCount = spaces.filter(isListingPublished).length;
  const activeServicesCount = services.filter(isListingPublished).length;
  const pendingRequestsCount = bookings.filter(b => b.status === 'PENDING').length;
  const paymentBreakdowns = bookings.flatMap(booking => (
    booking.payment_breakdown ? [booking.payment_breakdown] : []
  ));
  const simulatedPayments = bookings.flatMap(booking => (
    booking.simulated_payment ? [booking.simulated_payment] : []
  ));
  const totalCustomerPaid = paymentBreakdowns.reduce(
    (sum, payment) => sum + Number(payment.customer_paid || 0),
    0,
  ) + simulatedPayments.reduce(
    (sum, payment) => sum + Number(payment.customer_paid || 0),
    0,
  );
  const totalCommissionDeducted = paymentBreakdowns.reduce(
    (sum, payment) => sum + Number(payment.commission_amount || 0),
    0,
  ) + simulatedPayments.reduce(
    (sum, payment) => sum + Number(payment.commission_estimate || 0),
    0,
  );
  const totalProviderNet = paymentBreakdowns.reduce(
    (sum, payment) => sum + Number(payment.provider_payout_amount || 0),
    0,
  ) + simulatedPayments.reduce(
    (sum, payment) => sum + Number(payment.provider_net_estimate || 0),
    0,
  );
  const totalRevenue = paymentBreakdowns
    .filter(payment => payment.payout_status === 'PAID')
    .reduce((sum, payment) => sum + Number(payment.provider_payout_amount || 0), 0);
  const pendingPayoutsCount = paymentBreakdowns.filter(
    payment => payment.payout_status === 'PENDING',
  ).length;
  const failedPayoutsCount = paymentBreakdowns.filter(
    payment => payment.payout_status === 'FAILED',
  ).length;
  const paidPayoutsCount = paymentBreakdowns.filter(
    payment => payment.payout_status === 'PAID',
  ).length;

  // Filtered views
  const allListings = [
    ...spaces.map(s => ({ ...s, listingType: 'VENUE' as const })),
    ...services.map(s => ({ ...s, listingType: 'SERVICE' as const }))
  ];

  const filteredListings = allListings.filter(item => {
    const matchesType =
      listingTypeFilter === 'ALL' ||
      item.listingType === listingTypeFilter;

    const approved = isListingPublished(item);
    const searchTerm = providerSearchQuery.trim().toLowerCase();
    const matchesSearch = !searchTerm || [item.title, item.category, item.location]
      .some(value => String(value || '').toLowerCase().includes(searchTerm));

    const matchesStatus =
      listingStatusFilter === 'ALL' ||
      (listingStatusFilter === 'APPROVED' && approved) ||
      (listingStatusFilter === 'PENDING' && !approved);

    return matchesType && matchesStatus && matchesSearch;
  });

  const filteredBookings = bookings.filter(b => {
    const listingType = b.venue_details?.listing_type;
    if (bookingFilter === 'SPACES' && listingType !== 'VENUE') return false;
    if (bookingFilter === 'SERVICES' && listingType !== 'SERVICE') return false;
    if (bookingStatusFilter !== 'ALL' && b.status !== bookingStatusFilter) return false;
    return true;
  });

  const getPageTitle = () => {
    switch (activeTab) {
      case 'overview': return 'Vendor Overview';
      case 'listings': return 'My Listings';
      case 'bookings': return 'Booking Requests';
      case 'calendar': return 'Event Calendar';
      case 'messages': return 'Client Messages';
      case 'reviews': return 'Client Reviews';
      case 'profile': return 'Vendor Profile';
      case 'settings': return 'Account Settings';
      default: return 'Vendor Dashboard';
    }
  };

  const getPageSubtitle = () => {
    switch (activeTab) {
      case 'overview': return 'Manage your venues and services, track bookings, and grow your business.';
      case 'listings': return 'Manage all your event venues and professional services in one place.';
      case 'bookings': return 'Review incoming customer booking inquiries and confirm schedules.';
      case 'calendar': return 'Track upcoming approved events and venue reservations.';
      case 'messages': return 'Communicate with clients regarding event bookings and custom packages.';
      case 'reviews': return 'See feedback and star ratings from clients who booked your spaces or services.';
      case 'profile': return 'Update your public vendor branding, logo, contact details, and location.';
      case 'settings': return 'Platform preferences and notification settings.';
      default: return 'Manage your vendor operations.';
    }
  };

  const greetingHour = new Date().getHours();
  const greetingTime = greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';
  const vendorFirstName = currentUser?.first_name || (currentUser?.username ? currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1) : 'Susan');

  return (
    <div className={`vendor-dashboard-layout ${isSidebarCollapsed ? 'vendor-sidebar-collapsed' : ''}`}>
      {isMobileSidebarOpen && (
        <div
          className="vendor-sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 1. Signature Vendor Green Sidebar */}
      <aside className={`vendor-sidebar ${isMobileSidebarOpen ? 'vendor-sidebar-open' : ''}`}>

        {/* Header Branding */}
        <div className="vendor-sidebar-header">
          <button
            type="button"
            className="vendor-sidebar-brand"
            onClick={() => setActiveTab('overview')}
            title="Go to Vendor Dashboard"
            aria-label="Go to Vendor Dashboard"
          >
            <div className="vendor-logo-mark">
              <Calendar size={21} color="#5eead4" />
            </div>
            <div className="vendor-brand-copy">
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#ffffff' }}>Locyfy</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a7f3d0' }}>Vendor Dashboard</div>
            </div>
          </button>
          <button
            type="button"
            className="vendor-sidebar-collapse-btn"
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <button
            type="button"
            className="vendor-sidebar-close-btn"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>



        {/* Nav List */}
        <nav
          className="vendor-sidebar-nav"
          style={{ paddingTop: '8px' }}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('button')) setIsMobileSidebarOpen(false);
          }}
        >
          {/* Overview */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            aria-label="Overview"
            title="Overview"
          >
            <LayoutDashboard size={18} /> Overview
          </button>

          {/* My Listings */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'listings' ? 'active' : ''}`}
            onClick={() => setActiveTab('listings')}
            aria-label="My Listings"
            title="My Listings"
          >
            <Layers size={18} /> My Listings
            <span
              style={{
                marginLeft: 'auto',
                background: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                fontSize: '0.72rem',
                padding: '1px 7px',
                borderRadius: '999px',
                fontWeight: 700
              }}
            >
              {spaces.length + services.length}
            </span>
          </button>

          {/* Availability */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'availability' ? 'active' : ''}`}
            onClick={() => setActiveTab('availability')}
            aria-label="Availability"
            title="Availability"
          >
            <Clock size={18} /> Availability
          </button>

          {/* Booking Requests */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
            aria-label="Booking Requests"
            title="Booking Requests"
          >
            <CalendarCheck size={18} /> Booking Requests
            {pendingRequestsCount > 0 && (
              <span className="vendor-nav-badge-red">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          {/* Calendar */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
            aria-label="Calendar"
            title="Calendar"
          >
            <Calendar size={18} /> Calendar
          </button>

          {/* Messages */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
            aria-label="Messages"
            title="Messages"
          >
            <MessageSquare size={18} /> Messages
            {(() => {
              const unreadMessagesCount = conversations.reduce(
                (total, conversation) => total + (conversation.unread_count || 0),
                0
              );

              return unreadMessagesCount > 0 ? (
                <span className="vendor-nav-badge-red">
                  {unreadMessagesCount}
                </span>
              ) : null;
            })()}
          </button>

          {/* Reviews */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
            aria-label="Reviews"
            title="Reviews"
          >
            <Star size={18} /> Reviews
          </button>

          {/* Profile */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
            aria-label="Vendor Profile"
            title="Vendor Profile"
          >
            <UserIcon size={18} /> Vendor Profile
          </button>

          {/* Settings */}
          <button
            className={`vendor-sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={18} /> Settings
          </button>

          <div style={{ flexGrow: 1 }} />

          {/* Footer Actions inside Sidebar */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', padding: '16px 12px 0', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={onLogout}
              className="vendor-sidebar-item"
              aria-label="Log out"
              title="Log out"
              style={{ color: '#fca5a5', justifyContent: 'center', fontSize: '0.85rem' }}
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </nav>
      </aside>

      {/* 2. Main Content Area */}
      <main className="vendor-main-content">
        <header className="vendor-app-topbar">
          <button
            type="button"
            className="vendor-mobile-menu-btn"
            onClick={() => {
              setIsSidebarCollapsed(false);
              setIsMobileSidebarOpen(true);
            }}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="vendor-search-box">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search your venues, services, or listings..."
              value={providerSearchQuery}
              onChange={(event) => setProviderSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && activeTab !== 'create_listing') {
                  setActiveTab('listings');
                }
              }}
            />
          </div>

          <div className="vendor-app-topbar-actions">
            <NotificationBell
              userId={currentUser?.id}
              onOpenNotification={handleOpenNotification}
            />
            <div ref={accountMenuRef} className="vendor-account-menu-wrap">
              <button
                type="button"
                className="vendor-profile-btn"
                onClick={() => setShowAccountMenu((showing) => !showing)}
                aria-label="Open account menu"
                aria-expanded={showAccountMenu}
                title="Account menu"
              >
                <span className="vendor-profile-avatar">
                  {currentUser?.avatar_url ? (
                    <img src={currentUser.avatar_url} alt="" />
                  ) : (
                    <UserIcon size={17} />
                  )}
                </span>
                <ChevronDown size={15} />
              </button>
              {showAccountMenu && (
                <div className="vendor-account-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountMenu(false);
                      setActiveTab('profile');
                    }}
                  >
                    <UserIcon size={16} /> My Profile
                  </button>
                  <button
                    type="button"
                    className="active"
                    onClick={() => {
                      setShowAccountMenu(false);
                      setActiveTab('overview');
                    }}
                  >
                    <Building2 size={16} /> Vendor Dashboard
                  </button>
                  <button
                    type="button"
                    className="vendor-account-logout"
                    onClick={() => {
                      setShowAccountMenu(false);
                      onLogout();
                    }}
                  >
                    <LogOut size={16} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Top Header Row for non-overview tabs */}
        {activeTab !== 'overview' && activeTab !== 'create_listing' && (
          <div className="vendor-topbar">
            <div>
              <h1>{getPageTitle()}</h1>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '4px 0 0 0' }}>{getPageSubtitle()}</p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {activeTab === 'listings' && (
                <button
                  onClick={() => openCreateListing('service')}
                  className="btn-primary-light"
                >
                  <Plus size={16} /> Add Listing
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB: CREATE A NEW LISTING (FULL PAGE VIEW MATCHING DESIGN) */}
        {activeTab === 'create_listing' && (editingListing || hasApprovedBusinessAccount) && (
          <CreateListingPage
            onBack={() => {
              setEditingListing(null);
              setActiveTab(editingListing ? 'listings' : 'overview');
            }}
            onSuccess={() => {
              fetchData();
              setEditingListing(null);
              setActiveTab(editingListing ? 'listings' : 'overview');
            }}
            defaultMode={createListingDefaultMode}
            currentVendorId={currentVendor?.id}
            currentOwnerId={currentVenueOwner?.id}
            currentUserId={currentUser?.id}
            editingListing={editingListing}
          />
        )}
        {activeTab === 'create_listing' && !editingListing && !hasApprovedBusinessAccount && (
          <div className="dashboard-card" style={{ maxWidth: '680px', margin: '40px auto', padding: '32px', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px', color: '#0f172a' }}>Business account approval required</h2>
            <p style={{ margin: '0 0 20px', color: '#64748b' }}>
              Your business account must be approved by an administrator before you can create a listing.
            </p>
            <button className="btn-primary-light" onClick={() => setActiveTab('overview')}>Back to Dashboard</button>
          </div>
        )}

        {/* TAB: AVAILABILITY & CAPACITY (MATCHING SPEC) */}
        {activeTab === 'availability' && (
          <ProviderAvailabilityDashboard
            bookings={bookings}
            venues={[...spaces, ...services]}
          />
        )}

        {/* 4. Tab: OVERVIEW (Inspiration Layout) */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Hero Greeting Banner matching inspiration */}
            <div className="vendor-hero-banner">
              <div className="vendor-hero-left">
                <h1 className="vendor-hero-title">
                  {greetingTime}, {vendorFirstName}
                </h1>
                <p className="vendor-hero-subtitle">
                  Manage your venues and services, track bookings, and grow your business.
                </p>
              </div>

            </div>

            {/* KPI Stat Cards with Real Data */}
            <div className="inspo-stat-grid">

              {/* Card 1: Total Listings */}
              <div className="inspo-stat-card" onClick={() => setActiveTab('listings')}>
                <div className="inspo-stat-icon-wrap mint">
                  <Building2 size={24} />
                </div>
                <div className="inspo-stat-info">
                  <span className="inspo-stat-label">Total Listings</span>
                  <span className="inspo-stat-value">{spaces.length + services.length}</span>
                  <div className="inspo-stat-delta">
                    <span className="delta-label">{spaces.length} venues · {services.length} services</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Pending Requests */}
              <div className="inspo-stat-card" onClick={() => setActiveTab('bookings')}>
                <div className="inspo-stat-icon-wrap amber">
                  <Calendar size={24} />
                </div>
                <div className="inspo-stat-info">
                  <span className="inspo-stat-label">Pending Requests</span>
                  <span className="inspo-stat-value">{pendingRequestsCount}</span>
                  <div className="inspo-stat-delta">
                    <span className={pendingRequestsCount > 0 ? "delta-up" : "delta-label"} style={pendingRequestsCount > 0 ? { color: '#d97706' } : {}}>
                      {pendingRequestsCount === 0 ? 'No pending requests' : `${pendingRequestsCount} awaiting review`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Confirmed Bookings */}
              <div className="inspo-stat-card" onClick={() => setActiveTab('bookings')}>
                <div className="inspo-stat-icon-wrap blue">
                  <CalendarCheck size={24} />
                </div>
                <div className="inspo-stat-info">
                  <span className="inspo-stat-label">Confirmed Bookings</span>
                  <span className="inspo-stat-value">
                    {bookings.filter(b => b.status === 'APPROVED' || b.status === 'COMPLETED').length}
                  </span>
                  <div className="inspo-stat-delta">
                    <span className="delta-label">
                      {bookings.filter(b => b.status === 'APPROVED' || b.status === 'COMPLETED').length === 0 ? 'No confirmed bookings' : 'Active and scheduled'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: Combined provider net */}
              <div className="inspo-stat-card">
                <div className="inspo-stat-icon-wrap purple">
                  <MessageSquare size={24} />
                </div>
                <div className="inspo-stat-info">
                  <span className="inspo-stat-label">Total Provider Net</span>
                  <span className="inspo-stat-value">
                    KES {totalProviderNet.toLocaleString()}
                  </span>
                </div>
              </div>

            </div>

            <div className="dashboard-card" style={{ padding: '18px 20px', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 14px', color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>
                Payment breakdown
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Customer payments</div>
                  <strong>KES {totalCustomerPaid.toLocaleString()}</strong>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Platform commission</div>
                  <strong>KES {totalCommissionDeducted.toLocaleString()}</strong>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Provider net</div>
                  <strong>KES {totalProviderNet.toLocaleString()}</strong>
                  <div style={{ color: '#64748b', fontSize: '0.74rem' }}>Confirmed payouts: KES {totalRevenue.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Payout status</div>
                  <strong>{paidPayoutsCount} paid · {pendingPayoutsCount} pending · {failedPayoutsCount} failed</strong>
                </div>
              </div>
            </div>

            {/* Split Lower Layout: Your Listings (Left) + Booking Requests (Right) */}
            <div className="inspo-overview-grid">

              {/* Left Column: Your Listings */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Your Listings
                  </h2>

                  {/* Category Pills */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {['ALL', 'VENUES', 'DECORATION', 'PHOTOGRAPHY', 'CATERING', 'MUSIC & DJ'].map(cat => (
                      <button
                        key={cat}
                        className={`filter-pill ${listingsCategoryFilter === cat ? 'active' : ''}`}
                        onClick={() => setListingsCategoryFilter(cat)}
                        style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                      >
                        {cat === 'ALL' ? 'All' : cat === 'VENUES' ? 'Venues' : cat === 'MUSIC & DJ' ? 'Music & DJ' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Listings Display Grid */}
                {(() => {
                  const allItems = [
                    ...spaces.map(s => ({ ...s, itemKind: 'VENUE' as const })),
                    ...services.map(s => ({ ...s, itemKind: 'SERVICE' as const }))
                  ];

                  const filtered = allItems.filter(item => {
                    if (listingsCategoryFilter === 'ALL') return true;
                    if (listingsCategoryFilter === 'VENUES') return item.itemKind === 'VENUE';
                    if (listingsCategoryFilter === 'DECORATION') return item.category?.toUpperCase().includes('DECOR');
                    if (listingsCategoryFilter === 'PHOTOGRAPHY') return item.category?.toUpperCase().includes('PHOTO');
                    if (listingsCategoryFilter === 'CATERING') return item.category?.toUpperCase().includes('CATER');
                    if (listingsCategoryFilter === 'MUSIC & DJ') return item.category?.toUpperCase().includes('DJ') || item.category?.toUpperCase().includes('MUSIC');
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="dashboard-card" style={{ padding: '36px 24px', textAlign: 'center', background: '#ffffff' }}>
                        <div style={{ width: '48px', height: '48px', background: '#ccfbf1', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0d8a73', marginBottom: '12px' }}>
                          <Building2 size={24} />
                        </div>
                        <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>No listings found in this category</h4>
                        <p style={{ margin: '0 0 18px', fontSize: '0.86rem', color: '#64748b' }}>
                          Click the button below to add your first listing in this category.
                        </p>
                        <button
                          className="btn-primary-light"
                          onClick={() => openCreateListing(listingsCategoryFilter === 'VENUES' ? 'venue' : 'service')}
                        >
                          <Plus size={16} /> Add Listing Now
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="vendor-overview-listings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '16px' }}>
                      {filtered.slice(0, 6).map(item => (
                        <div key={`${item.itemKind}-${item.id}`} className="listing-card" style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                          <div style={{ position: 'relative', height: '150px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {cleanImageUrl(item.image_url) ? (
                              <img
                                src={cleanImageUrl(item.image_url)}
                                alt={item.title}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const placeholder = e.currentTarget.nextElementSibling;
                                  if (placeholder instanceof HTMLElement) placeholder.style.display = 'flex';
                                }}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : null}
                            <div
                              style={{
                                display: cleanImageUrl(item.image_url) ? 'none' : 'flex',
                                position: 'absolute',
                                inset: 0,
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column',
                                gap: '6px',
                                color: '#94a3b8'
                              }}
                            >
                              <ImageOff size={28} />
                              <span style={{ fontSize: '0.75rem' }}>No image available</span>
                            </div>
                            <span
                              style={{
                                position: 'absolute',
                                top: '10px',
                                left: '10px',
                                background: item.itemKind === 'VENUE' ? '#0F8F7A' : '#0284c7',
                                color: '#ffffff',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                textTransform: 'uppercase'
                              }}
                            >
                              {item.itemKind === 'VENUE' ? 'Venue' : item.category || 'Service'}
                            </span>
                            <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                              {renderStatusBadge(item)}
                            </div>
                          </div>

                          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <span style={{ fontWeight: 800, color: '#0d8a73' }}>
                                KES {Number(item.price_per_day).toLocaleString()}
                                {item.itemKind === 'VENUE' ? '/day' : ''}
                              </span>
                              <span style={{ color: Number(item.capacity) > 0 ? '#64748b' : '#b45309', fontSize: '0.78rem' }}>
                                Max guests: {Number(item.capacity) > 0 ? item.capacity : 'Not set'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Booking Requests */}
              <div className="dashboard-card" style={{ padding: '20px 22px', height: 'fit-content' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                      Booking Requests
                    </h3>
                    {pendingRequestsCount > 0 && (
                      <span className="vendor-nav-badge-red" style={{ margin: 0 }}>
                        {pendingRequestsCount}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTab('bookings')}
                    style={{ background: 'none', border: 'none', color: '#0d8a73', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    View All <ChevronRight size={15} />
                  </button>
                </div>

                {/* Booking List */}
                {bookings.length === 0 ? (
                  <div style={{ padding: '36px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <div style={{ width: '44px', height: '44px', background: '#ccfbf1', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0d8a73', marginBottom: '10px' }}>
                      <CalendarCheck size={20} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '4px' }}>No booking requests yet</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, maxWidth: '240px', margin: '0 auto' }}>
                      When clients book your venues or services, real requests will appear here instantly.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {bookings.slice(0, 4).map((req: Booking) => (
                      <div
                        key={req.id}
                        style={{
                          padding: '12px',
                          background: '#f8fafc',
                          borderRadius: '12px',
                          border: '1px solid #f1f5f9',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{ width: '50px', height: '46px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {getBookingListingImage(req) ? (
                                <img src={getBookingListingImage(req)} alt={getBookingListingTitle(req)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <ImageOff size={17} color="#64748b" />
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{getBookingListingTitle(req)}</div>
                              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{req.event_title || req.event_type || 'Event Request'}</div>
                              <div style={{ fontSize: '0.76rem', color: '#475569' }}>{req.customer_full_name || 'Customer'}</div>
                            </div>
                          </div>
                          <span className={`status-badge ${(req.status || 'pending').toLowerCase()}`}>
                            {req.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: '#64748b', overflowWrap: 'anywhere' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={13} />{req.customer_email || 'Email not provided'}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={13} />{req.customer_phone || 'Phone not provided'}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px dashed #e2e8f0', fontSize: '0.78rem' }}>
                          <span style={{ color: '#64748b' }}>📅 {req.event_date || 'Date TBD'}</span>
                          <span style={{ fontWeight: 800, color: '#0d8a73' }}>KES {Number(req.total_price || 0).toLocaleString()}</span>
                        </div>

                        {req.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                            <button
                              onClick={() => handleUpdateBookingStatus(req.id, 'APPROVED')}
                              style={{ flex: 1, padding: '6px', background: '#0d8a73', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <Check size={13} /> Approve
                            </button>
                            <button
                              onClick={() => handleUpdateBookingStatus(req.id, 'REJECTED')}
                              style={{ flex: 1, padding: '6px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <X size={13} /> Decline
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* 5. Tab: MY LISTINGS */}
        {activeTab === 'listings' && (
          <div>
            {/* Listing filters */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: '24px'
              }}
            >
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className={`filter-pill ${listingTypeFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setListingTypeFilter('ALL')}
                >
                  All Listings ({spaces.length + services.length})
                </button>

                <button
                  className={`filter-pill ${listingTypeFilter === 'VENUE' ? 'active' : ''}`}
                  onClick={() => setListingTypeFilter('VENUE')}
                >
                  Venues ({spaces.length})
                </button>

                <button
                  className={`filter-pill ${listingTypeFilter === 'SERVICE' ? 'active' : ''}`}
                  onClick={() => setListingTypeFilter('SERVICE')}
                >
                  Services ({services.length})
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className={`filter-pill ${listingStatusFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setListingStatusFilter('ALL')}
                >
                  All Statuses
                </button>

                <button
                  className={`filter-pill ${listingStatusFilter === 'APPROVED' ? 'active' : ''}`}
                  onClick={() => setListingStatusFilter('APPROVED')}
                >
                  Verified ({activeSpacesCount + activeServicesCount})
                </button>

                <button
                  className={`filter-pill ${listingStatusFilter === 'PENDING' ? 'active' : ''}`}
                  onClick={() => setListingStatusFilter('PENDING')}
                >
                  Pending {
                    (spaces.length - activeSpacesCount) +
                    (services.length - activeServicesCount)
                  }
                </button>
              </div>
            </div>

            {/* Empty state */}
            {listingLoadError ? (
              <div className="dashboard-card" style={{ padding: '32px', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 8px', color: '#b91c1c' }}>
                  Unable to load your listings
                </h3>
                <p style={{ margin: '0 0 20px', color: '#64748b' }}>
                  Please try again. Your listings have not been changed.
                </p>
                <button className="btn-primary-light" onClick={() => fetchData()}>
                  Retry
                </button>
              </div>
            ) : filteredListings.length === 0 ? (
              <div
                className="dashboard-card"
                style={{
                  padding: '48px',
                  textAlign: 'center',
                  color: '#64748b'
                }}
              >
                <Layers
                  size={40}
                  color="#cbd5e1"
                  style={{ marginBottom: '12px' }}
                />

                <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>
                  No listings found
                </h3>

                <p style={{ margin: '0 0 20px', fontSize: '0.9rem' }}>
                  Add an event venue or professional service to start receiving bookings.
                </p>

                <button
                  onClick={() => openCreateListing('service')}
                  className="btn-primary-light"
                  style={{ background: '#0d8a73', color: '#fff' }}
                >
                  <Plus size={16} /> Add Your First Listing
                </button>
              </div>
            ) : (
              <div className="listing-grid">
                {filteredListings.map(item => {
                  const isVenue = item.listingType === 'VENUE';
                  const imageUrl = cleanImageUrl(item.image_url);

                  return (
                    <div
                      key={`${item.listingType}-${item.id}`}
                      className="listing-card"
                    >
                      <div
                        style={{
                          position: 'relative',
                          height: '180px',
                          background: '#f1f5f9'
                        }}
                      >
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.title}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const placeholder = e.currentTarget.nextElementSibling;
                              if (placeholder instanceof HTMLElement) {
                                placeholder.style.display = 'flex';
                              }
                            }}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                        ) : null}

                        <div
                          style={{
                            display: imageUrl ? 'none' : 'flex',
                            position: 'absolute',
                            inset: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            gap: '6px',
                            color: '#94a3b8'
                          }}
                        >
                          <ImageOff size={28} />
                          <span style={{ fontSize: '0.75rem' }}>No image available</span>
                        </div>

                        <div
                          style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px'
                          }}
                        >
                          {renderStatusBadge(item)}
                        </div>

                        <div
                          style={{
                            position: 'absolute',
                            top: '12px',
                            left: '12px',
                            background: isVenue ? '#14213D' : '#0d8a73',
                            color: '#fff',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: 700
                          }}
                        >
                          {isVenue ? 'VENUE' : 'SERVICE'}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          flexGrow: 1
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#0d8a73',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}
                        >
                          {item.category_display || item.category}
                        </div>

                        <h3
                          style={{
                            margin: '0 0 8px',
                            fontSize: '1.2rem',
                            fontWeight: 800,
                            color: '#0f172a'
                          }}
                        >
                          {item.title}
                        </h3>

                        <div
                          aria-label={`${Number(item.rating || 0).toFixed(1)} out of 5 from ${Number(item.review_count || 0)} reviews`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: Number(item.review_count || 0) > 0 ? '#b45309' : '#64748b',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            marginBottom: '12px'
                          }}
                        >
                          <Star
                            size={15}
                            fill={Number(item.review_count || 0) > 0 ? '#fbbf24' : 'none'}
                            color={Number(item.review_count || 0) > 0 ? '#f59e0b' : '#94a3b8'}
                          />
                          {Number(item.rating || 0).toFixed(1)} ({Number(item.review_count || 0)} {Number(item.review_count || 0) === 1 ? 'review' : 'reviews'})
                        </div>

                        {isVenue ? (
                          <>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                color: '#64748b',
                                fontSize: '0.85rem',
                                marginBottom: '12px'
                              }}
                            >
                              <MapPin size={14} color="#0d8a73" />
                              {item.location}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                gap: '12px',
                                marginBottom: '16px',
                                fontSize: '0.85rem',
                                color: '#475569'
                              }}
                            >
                              <span
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Users size={14} />
                                {item.capacity} Guests
                              </span>
                            </div>
                          </>
                        ) : (
                          <p
                            style={{
                              margin: '0 0 16px',
                              fontSize: '0.85rem',
                              color: '#64748b',
                              lineClamp: 2,
                              WebkitLineClamp: 2,
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {item.description}
                          </p>
                        )}

                        <div
                          style={{
                            marginTop: 'auto',
                            paddingTop: '16px',
                            borderTop: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: '#64748b',
                                display: 'block'
                              }}
                            >
                              {isVenue ? 'Daily Rate' : 'Starting Package Fee'}
                            </span>

                            <span
                              style={{
                                fontWeight: 800,
                                color: '#0d8a73',
                                fontSize: '1.1rem'
                              }}
                            >
                              KES {Number(item.price_per_day).toLocaleString()}
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setEditingListing(item);
                              setCreateListingDefaultMode(isVenue ? 'venue' : 'service');
                              setActiveTab('create_listing');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#0d8a73',
                              padding: '6px',
                              cursor: 'pointer',
                              borderRadius: '6px'
                            }}
                            title="Edit listing"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            onClick={() => handleDeleteListing(item.id, item.title)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              padding: '6px',
                              cursor: 'pointer',
                              borderRadius: '6px'
                            }}
                            title="Delete listing"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 7. Tab: BOOKINGS */}
        {activeTab === 'bookings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Filters Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`filter-pill ${bookingFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setBookingFilter('ALL')}
                >
                  All Inquiries ({bookings.length})
                </button>
                <button
                  className={`filter-pill ${bookingFilter === 'SPACES' ? 'active' : ''}`}
                  onClick={() => setBookingFilter('SPACES')}
                >
                  Spaces Only
                </button>
                <button
                  className={`filter-pill ${bookingFilter === 'SERVICES' ? 'active' : ''}`}
                  onClick={() => setBookingFilter('SERVICES')}
                >
                  Services Only
                </button>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {(['ALL', 'PENDING', 'APPROVED', 'CANCELLED'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setBookingStatusFilter(st)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: bookingStatusFilter === st ? '#1e293b' : '#fff',
                      color: bookingStatusFilter === st ? '#fff' : '#64748b',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="dashboard-card" style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                No bookings match your current filter selection.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredBookings.map(b => {
                  const schedule = parseBookingSchedule(b.notes);
                  return (
                  <div key={b.id} className="dashboard-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: '20px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        <div style={{ width: '72px', height: '62px', flexShrink: 0, borderRadius: '9px', overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {getBookingListingImage(b) ? (
                            <img src={getBookingListingImage(b)} alt={getBookingListingTitle(b)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <ImageOff size={20} color="#64748b" />
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{getBookingListingTitle(b)}</div>
                          <div style={{ fontSize: '0.9rem', color: '#334155', marginTop: '2px' }}>{b.event_title}</div>
                          <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#e0f2fe', color: '#0369a1' }}>
                            {b.event_type}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span>👤 Client: <strong>{b.customer_full_name || 'Customer'}</strong></span>
                        <span>📅 Date: <strong>{b.event_date}</strong></span>
                        <span>👥 Guests: <strong>{b.guest_count}</strong></span>
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#475569' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Mail size={14} />{b.customer_email || 'Email not provided'}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Phone size={14} />{b.customer_phone || 'Phone not provided'}</span>
                      </div>
                      {(schedule.startTime || schedule.endTime) && (
                        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {schedule.startTime && (
                            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '7px', padding: '7px 10px', fontSize: '0.82rem', color: '#334155' }}>
                              Start time: <strong>{schedule.startTime}</strong>
                            </div>
                          )}
                          {schedule.endTime && (
                            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '7px', padding: '7px 10px', fontSize: '0.82rem', color: '#334155' }}>
                              End time: <strong>{schedule.endTime}</strong>
                            </div>
                          )}
                        </div>
                      )}
                      {schedule.customerNotes && (
                        <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
                          💬 Notes: {schedule.customerNotes}
                        </div>
                      )}

                      {b.cancellation_reason && (
                        <div style={{ marginTop: '8px', padding: '6px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.8rem', color: '#991b1b' }}>
                          <strong>Cancelled:</strong> {b.cancellation_reason} {b.cancelled_by ? `(by ${b.cancelled_by})` : ''}
                        </div>
                      )}

                      {b.rejection_reason && (
                        <div style={{ marginTop: '8px', padding: '6px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.8rem', color: '#991b1b' }}>
                          <strong>Declined Reason:</strong> {b.rejection_reason}
                        </div>
                      )}

                      {(b.simulated_payment || b.payment_breakdown) && (
                        <div style={{ marginTop: '10px', padding: '10px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', fontSize: '0.8rem', color: '#334155' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                            <span>Customer paid: <strong>KES {Number(b.payment_breakdown?.customer_paid ?? b.simulated_payment?.customer_paid).toLocaleString()}</strong></span>
                            <span>Commission: <strong>KES {Number(b.payment_breakdown?.commission_amount ?? b.simulated_payment?.commission_estimate).toLocaleString()}</strong></span>
                            <span>Provider net: <strong>KES {Number(b.payment_breakdown?.provider_payout_amount ?? b.simulated_payment?.provider_net_estimate).toLocaleString()}</strong></span>
                            {b.payment_breakdown && (
                              <span>Payout: <strong>{b.payment_breakdown.payout_status}</strong></span>
                            )}
                          </div>
                          {b.payment_breakdown?.manual_reconciliation_required && (
                            <div style={{ marginTop: '5px', color: '#9a3412', fontWeight: 700 }}>
                              Manual reconciliation required.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Quote</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0d8a73' }}>
                          KES {Number(b.total_price).toLocaleString()}
                        </div>
                      </div>

                      <span className={`status-badge ${b.status.toLowerCase()}`}>
                        {b.status}
                      </span>

                      {b.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleUpdateBookingStatus(b.id, 'APPROVED')}
                            style={{ background: '#0d8a73', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleUpdateBookingStatus(b.id, 'REJECTED')}
                            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {b.status === 'APPROVED' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleUpdateBookingStatus(b.id, 'COMPLETED')}
                            style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                          >
                            Mark Completed
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 8. Tab: CALENDAR */}
        {activeTab === 'calendar' && (
          <div className="vendor-calendar-page">
            <div className="vendor-calendar-page-header">
              <div>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                  Scheduled Bookings
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.92rem' }}>
                  Confirmed events with complete client, schedule, and listing details.
                </p>
              </div>
              <span className="vendor-calendar-count">
                {bookings.filter(booking => booking.status === 'APPROVED').length} scheduled
              </span>
            </div>
            {bookings.filter(booking => booking.status === 'APPROVED').length === 0 ? (
              <div className="dashboard-card" style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
                No events currently scheduled. When you approve booking requests, they will appear here.
              </div>
            ) : (
              <div className="vendor-calendar-event-list">
                {bookings
                  .filter(booking => booking.status === 'APPROVED')
                  .sort((a, b) => a.event_date.localeCompare(b.event_date))
                  .map(booking => {
                    const schedule = parseBookingSchedule(booking.notes);
                    const startDate = new Date(`${String(booking.event_date).slice(0, 10)}T00:00:00`);
                    const formattedStartDate = Number.isNaN(startDate.getTime())
                      ? booking.event_date
                      : startDate.toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      });
                    const formattedEndDate = booking.end_date
                      ? new Date(`${String(booking.end_date).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                      : null;
                    const listingImage = getBookingListingImage(booking);

                    return (
                      <article key={booking.id} className="vendor-calendar-event-card">
                        <div className="vendor-calendar-event-top">
                          <div className="vendor-calendar-event-title">
                            <div className="vendor-calendar-event-image">
                              {listingImage ? (
                                <img src={listingImage} alt={getBookingListingTitle(booking)} />
                              ) : (
                                <ImageOff size={24} color="#94a3b8" />
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div className="vendor-calendar-listing-title">{getBookingListingTitle(booking)}</div>
                              <h4 className="vendor-calendar-event-name">{booking.event_title}</h4>
                              <span className="vendor-calendar-event-type">{booking.event_type}</span>
                            </div>
                          </div>
                          <div className="vendor-calendar-event-quote">
                            <span className="status-badge approved">Confirmed</span>
                            <strong>KES {Number(booking.total_price).toLocaleString()}</strong>
                            <span>Total quote</span>
                          </div>
                        </div>

                        <div className="vendor-calendar-event-details">
                          <div className="vendor-calendar-event-detail">
                            <span>Date</span>
                            <strong>{formattedStartDate}</strong>
                          </div>
                          {formattedEndDate && (
                            <div className="vendor-calendar-event-detail">
                              <span>End date</span>
                              <strong>{formattedEndDate}</strong>
                            </div>
                          )}
                          <div className="vendor-calendar-event-detail">
                            <span>Start time</span>
                            <strong>{schedule.startTime || 'Not specified'}</strong>
                          </div>
                          <div className="vendor-calendar-event-detail">
                            <span>End time</span>
                            <strong>{schedule.endTime || 'Not specified'}</strong>
                          </div>
                          <div className="vendor-calendar-event-detail">
                            <span>Client</span>
                            <strong>{booking.customer_full_name || booking.customer_name || 'Customer'}</strong>
                          </div>
                          <div className="vendor-calendar-event-detail">
                            <span>Email</span>
                            <strong>{booking.customer_email || 'Not provided'}</strong>
                          </div>
                          <div className="vendor-calendar-event-detail">
                            <span>Phone</span>
                            <strong>{booking.customer_phone || 'Not provided'}</strong>
                          </div>
                          <div className="vendor-calendar-event-detail">
                            <span>Guests</span>
                            <strong>{booking.guest_count}</strong>
                          </div>
                          <div className="vendor-calendar-event-detail">
                            <span>Location</span>
                            <strong>{booking.venue_details?.location || booking.venue_details?.address || booking.vendor_details?.location || 'Not specified'}</strong>
                          </div>
                        </div>

                        {schedule.customerNotes && (
                          <div className="vendor-calendar-event-notes">
                            <strong>Customer notes</strong>
                            <p>{schedule.customerNotes}</p>
                          </div>
                        )}
                      </article>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* 9. Tab: REVIEWS */}
        {activeTab === 'reviews' && (() => {
          const listingReviewCount = allListings.reduce((count, listing) => count + Number(listing.review_count || 0), 0);
          const listingRatingTotal = allListings.reduce(
            (total, listing) => total + Number(listing.rating || 0) * Number(listing.review_count || 0),
            0
          );
          const avgRatingVal = providerReviews.length > 0
            ? (providerReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / providerReviews.length)
            : listingReviewCount > 0
              ? listingRatingTotal / listingReviewCount
              : Number(effectiveVendor?.rating || 0);
          const hasRating = avgRatingVal > 0;
          const renderReview = (review: Review) => (
            <div key={review.id} style={{ padding: '18px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{review.user_name || 'Verified Client'}</div>
                <div style={{ display: 'flex', gap: '2px', color: '#fbbf24' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star key={star} size={16} fill={review.rating >= star ? '#fbbf24' : 'none'} color="#fbbf24" />
                  ))}
                </div>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>{review.comment}</p>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
              </div>
            </div>
          );

          return (
            <div className="dashboard-card" style={{ padding: '32px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Customer Reviews & Ratings</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '24px', background: '#f8fafc', borderRadius: '12px', marginBottom: '24px' }}>
                <div style={{ fontSize: '2.8rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                  {avgRatingVal.toFixed(1)}
                </div>
                <div>
                  <div style={{ display: 'flex', gap: '4px', color: '#fbbf24' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        fill={hasRating && avgRatingVal >= star ? "#fbbf24" : "none"}
                        color="#fbbf24"
                        size={20}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '6px' }}>
                    Based on {providerReviews.length || listingReviewCount} customer reviews across your listings
                  </div>
                </div>
              </div>

              {loadingReviews ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>Loading reviews...</div>
              ) : allListings.length === 0 && providerReviews.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '0.9rem', background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                  No customer reviews received yet. When clients complete bookings for your venues or services and leave ratings, their feedback will display here.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {allListings.map(listing => {
                    const listingReviews = providerReviews.filter(review => review.venue === listing.id);
                    const average = listingReviews.length > 0
                      ? listingReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / listingReviews.length
                      : Number(listing.rating || 0);
                    const reviewCount = listingReviews.length || Number(listing.review_count || 0);

                    return (
                      <section key={`${listing.listingType}-${listing.id}`} style={{ padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                          <div>
                            <span style={{ display: 'block', marginBottom: '4px', fontSize: '0.72rem', fontWeight: 800, color: '#0d8a73', textTransform: 'uppercase' }}>
                              {listing.listingType === 'SERVICE' ? 'Service' : 'Venue'}
                            </span>
                            <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem' }}>{listing.title}</h4>
                          </div>
                          <div style={{ color: '#b45309', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            <Star size={15} fill="#fbbf24" color="#f59e0b" style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} />
                            {average.toFixed(1)} ({reviewCount})
                          </div>
                        </div>
                        {listingReviews.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {listingReviews.map(renderReview)}
                          </div>
                        ) : (
                          <div style={{ padding: '16px', background: '#ffffff', borderRadius: '8px', color: '#64748b', fontSize: '0.88rem' }}>
                            No customer reviews for this listing yet.
                          </div>
                        )}
                      </section>
                    );
                  })}
                  {providerReviews
                    .filter(review => !review.venue || !allListings.some(listing => listing.id === review.venue))
                    .map(renderReview)}
                </div>
              )}
            </div>
          );
        })()}

        {/* 9. Tab: MESSAGES */}
        {activeTab === 'messages' && (() => {
          const hasAnyMessages = conversations.length > 0 || bookings.length > 0;

          if (!hasAnyMessages) {
            return (
              <div className="dashboard-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', background: '#ccfbf1', borderRadius: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0d8a73', marginBottom: '14px' }}>
                  <MessageSquare size={26} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>No Messages Yet</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '380px', margin: '0 auto 20px' }}>
                  When clients submit booking requests or direct inquiries for your listings, you can communicate and coordinate event details with them directly here.
                </p>
                <button onClick={() => setActiveTab('listings')} className="btn-primary-light" style={{ padding: '10px 20px', borderRadius: '10px' }}>
                  Manage Listings
                </button>
              </div>
            );
          }

          const allPartnerIds = new Set(conversations.map(c => c.partner_id));
          const orphanBookings = bookings.filter(b => b.customer && !allPartnerIds.has(b.customer));

          const activePartnerId = selectedPartnerId || (conversations[0]?.partner_id) || (bookings[0]?.customer) || null;
          const activeConversation = conversations.find(c => c.partner_id === activePartnerId);
          const activeBooking = bookings.find(b => b.id === (activeConversation?.booking_id || selectedBookingChatId)) || bookings.find(b => b.customer === activePartnerId);

          const clientName = activeConversation?.partner_name || activeBooking?.customer_name || 'Client';
          const clientInitial = clientName.charAt(0).toUpperCase();

          const handleSendReply = async () => {
            if (!messageInput.trim() || !currentUser?.id || !activePartnerId) return;
            const text = messageInput.trim();
            setMessageInput('');
            setSendingChatMessage(true);
            try {
              const sent = await ApiService.sendMessage({
                sender: currentUser.id,
                recipient: activePartnerId,
                booking: activeBooking?.id,
                venue: activeBooking?.venue,
                vendor: effectiveVendor?.id,
                content: text,
              });
              if (sent) {
                setRealChatMessages(prev => [...prev, sent]);
                fetchProviderConversations();
                toast.success(`Message sent to ${clientName}!`);
              } else {
                toast.error('Failed to send message.');
              }
            } catch (e) {
              toast.error('Error sending message.');
            } finally {
              setSendingChatMessage(false);
            }
          };

          return (
            <div className="dashboard-card vendor-messages-layout" style={{ padding: 0, overflow: 'hidden', minHeight: '520px', display: 'flex' }}>
              {/* Conversation List */}
              <div className="vendor-conversation-list" style={{ width: '320px', borderRight: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Messages</h3>
                  {conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0) > 0 && (
                    <span className="vendor-nav-badge-red" style={{ margin: 0 }}>
                      {conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)} new
                    </span>
                  )}
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {/* Direct Conversations */}
                  {conversations.map(c => {
                    const isSelected = (activePartnerId === c.partner_id);
                    return (
                      <div
                        key={c.partner_id}
                        onClick={() => {
                          setSelectedPartnerId(c.partner_id);
                          fetchThreadMessages(c.partner_id);
                          if (c.booking_id) setSelectedBookingChatId(c.booking_id);
                        }}
                        style={{
                          padding: '14px 18px',
                          borderBottom: '1px solid #f1f5f9',
                          background: isSelected ? '#ffffff' : 'transparent',
                          cursor: 'pointer',
                          borderLeft: isSelected ? '4px solid #0d8a73' : '4px solid transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                            {c.partner_name || 'Client'}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                            {c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#0d8a73', fontWeight: 600, marginBottom: '2px' }}>
                          {c.event_title || c.venue_title || c.vendor_name || 'Direct Inquiry'}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.last_message || 'Start coordinating event details'}
                        </div>
                      </div>
                    );
                  })}

                  {/* Orphan bookings if client hasn't chatted yet */}
                  {orphanBookings.map(b => {
                    const isSelected = (activePartnerId === b.customer);
                    return (
                      <div
                        key={b.id}
                        onClick={() => {
                          if (b.customer) {
                            setSelectedPartnerId(b.customer);
                            fetchThreadMessages(b.customer);
                          }
                          setSelectedBookingChatId(b.id);
                        }}
                        style={{
                          padding: '14px 18px',
                          borderBottom: '1px solid #f1f5f9',
                          background: isSelected ? '#ffffff' : 'transparent',
                          cursor: 'pointer',
                          borderLeft: isSelected ? '4px solid #0d8a73' : '4px solid transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                            {b.customer_name || 'Client'}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{b.event_date || ''}</span>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#0d8a73', fontWeight: 600, marginBottom: '2px' }}>
                          {b.event_title || b.event_type}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {b.notes ? `"${b.notes}"` : `Booking request · KES ${Number(b.total_price || 0).toLocaleString()}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chat Conversation View */}
              <div className="vendor-chat-pane" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
                <div className="vendor-chat-header" style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ccfbf1', color: '#0d8a73', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {clientInitial}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#0f172a' }}>{clientName}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {activeBooking ? `Event: ${activeBooking.event_title} · Date: ${activeBooking.event_date || 'TBD'}` : 'Direct Customer Inquiry'}
                      </div>
                    </div>
                  </div>
                  {activeBooking && (
                    <button
                      onClick={() => setActiveTab('bookings')}
                      className="btn-primary-light"
                      style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                    >
                      View Booking
                    </button>
                  )}
                </div>

                {/* Official In-Platform Policy Banner */}
                <div className="vendor-chat-policy" style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: '#166534', fontWeight: 600 }}>
                  <ShieldCheck size={14} color="#16a34a" /> In-Platform Official Communication: All inquiries & chats must stay strictly inside Locyfy. Off-platform communications are prohibited.
                </div>

                {/* Message Bubbles */}
                <div className="vendor-chat-history" style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {activeBooking?.notes && (
                    <div style={{ alignSelf: 'flex-start', maxWidth: '75%', background: '#f1f5f9', padding: '12px 16px', borderRadius: '14px 14px 14px 2px', fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.5 }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0d8a73', marginBottom: '4px' }}>
                        {clientName} (Booking Details)
                      </div>
                      {activeBooking.notes}
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>
                        {activeBooking.event_date || 'Recent'}
                      </div>
                    </div>
                  )}

                  {loadingChatMessages && realChatMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', padding: '12px' }}>
                      Loading conversation history...
                    </div>
                  ) : realChatMessages.length === 0 && !activeBooking?.notes ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 20px', margin: 'auto' }}>
                      <MessageSquare size={36} color="#cbd5e1" style={{ marginBottom: '10px' }} />
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                        No messages yet in this conversation. Send a message below to start communicating with {clientName}.
                      </p>
                    </div>
                  ) : null}

                  {/* Stored Real Messages */}
                  {realChatMessages.map(msg => {
                    const isMe = currentUser?.id && msg.sender === currentUser.id;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          background: isMe ? '#0d8a73' : '#f1f5f9',
                          color: isMe ? '#ffffff' : '#1e293b',
                          padding: '12px 16px',
                          borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          fontSize: '0.9rem',
                          lineHeight: 1.5,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                      >
                        {!isMe && (
                          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0d8a73', marginBottom: '4px' }}>
                            {msg.sender_name || clientName}
                          </div>
                        )}
                        <div style={{ wordBreak: 'break-word' }}>{msg.content}</div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: isMe ? '#a7f3d0' : '#94a3b8',
                            marginTop: '4px',
                            textAlign: 'right'
                          }}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Box */}
                <div className="vendor-chat-reply" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder={`Type your reply to ${clientName}...`}
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    style={{ flex: 1, padding: '12px 16px', borderRadius: '9999px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && messageInput.trim() && !sendingChatMessage) {
                        handleSendReply();
                      }
                    }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={sendingChatMessage || !messageInput.trim()}
                    className="btn-primary-light"
                    style={{ padding: '10px 20px', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Send size={16} /> Send
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 10. Tab: VENDOR PROFILE */}
        {activeTab === 'profile' && (
          <div className="dashboard-card" style={{ maxWidth: '720px', padding: '32px' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>Vendor Profile & Branding</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>Update public vendor credentials, branding logo, and contact info.</p>

            {/* Profile Avatar Upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {currentVendor?.logo_url ? (
                  <img src={currentVendor.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <UserIcon size={36} color="#94a3b8" />
                )}
              </div>
              <div>
                <label style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: isUploading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', display: 'inline-block' }}>
                  {isUploading ? 'Uploading...' : 'Change Vendor Logo'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePictureUpload} disabled={isUploading} />
                </label>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '6px' }}>JPG, PNG or GIF up to 5MB</div>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Vendor / Business Name</label>
                <input
                  type="text"
                  value={profileFormData.business_name}
                  onChange={e => setProfileFormData({ ...profileFormData, business_name: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Primary City / Location</label>
                  <input
                    type="text"
                    value={profileFormData.location}
                    onChange={e => setProfileFormData({ ...profileFormData, location: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Contact Phone</label>
                  <input
                    type="text"
                    value={profileFormData.contact_phone}
                    onChange={e => setProfileFormData({ ...profileFormData, contact_phone: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Public Contact Email</label>
                <input
                  type="email"
                  value={profileFormData.contact_email}
                  onChange={e => setProfileFormData({ ...profileFormData, contact_email: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Vendor Description & Overview</label>
                <textarea
                  rows={4}
                  value={profileFormData.description}
                  onChange={e => setProfileFormData({ ...profileFormData, description: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <button
                type="submit"
                className="btn-primary-light"
                style={{ background: '#0d8a73', color: '#fff', padding: '12px 20px', borderRadius: '8px', fontWeight: 700, width: 'fit-content' }}
              >
                Save Vendor Profile
              </button>
            </form>
          </div>
        )}

        {/* 11. Tab: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="dashboard-card" style={{ maxWidth: '640px', padding: '32px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Account & Platform Settings</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>Manage notification preferences and security for your business account.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Email Notifications for New Bookings</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Receive instant alerts when clients request your services</div>
                </div>
                <input type="checkbox" defaultChecked style={{ transform: 'scale(1.2)' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>SMS Alert Notifications</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Get urgent booking reminder messages on your phone</div>
                </div>
                <input type="checkbox" defaultChecked style={{ transform: 'scale(1.2)' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Public Discovery Listing</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Allow customers to find your spaces and services on the main explore feed</div>
                </div>
                <input type="checkbox" defaultChecked style={{ transform: 'scale(1.2)' }} />
              </div>
            </div>
          </div>
        )}

      </main>

      {/* MODAL: ADD SPACE */}
      {showAddSpaceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Add New Event Space</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>List an event hall, garden, or conference space.</p>
              </div>
              <button onClick={() => setShowAddSpaceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {spaceErrorNotice && (
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '12px 16px', color: '#991b1b', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AlertCircle size={18} />
                <span>{spaceErrorNotice}</span>
              </div>
            )}

            <form onSubmit={handleAddSpaceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Space Title / Venue Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Serena Grand Ballroom"
                  value={newSpace.title}
                  onChange={e => setNewSpace({ ...newSpace, title: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Category *</label>
                  <select
                    value={newSpace.category}
                    onChange={e => setNewSpace({ ...newSpace, category: e.target.value, custom_category: '' })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="WEDDING">Wedding Hall</option>
                    <option value="CONFERENCE">Conference Room</option>
                    <option value="PARTY">Party Venue</option>
                    <option value="BANQUET">Banquet Hall</option>
                    <option value="OUTDOOR">Outdoor / Garden</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {newSpace.category === 'OTHER' && (
                    <input
                      type="text"
                      required
                      maxLength={100}
                      placeholder="Type your venue category"
                      value={newSpace.custom_category}
                      onChange={e => setNewSpace({ ...newSpace, custom_category: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', marginTop: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Guest Capacity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Enter maximum guests"
                    value={newSpace.capacity}
                    onChange={e => setNewSpace({ ...newSpace, capacity: e.target.value === '' ? '' : Number(e.target.value) })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Location (County) *</label>
                  <input
                    type="text"
                    required
                    value={NYERI_COUNTY_LOCATION}
                    readOnly
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Daily Rate (KES) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 75000"
                    value={newSpace.price_per_day}
                    onChange={e => setNewSpace({ ...newSpace, price_per_day: Number(e.target.value) })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Amenities (comma-separated)</label>
                <input
                  type="text"
                  placeholder="Parking, Sound System, Restrooms, Security, Wi-Fi"
                  value={newSpace.amenities}
                  onChange={e => setNewSpace({ ...newSpace, amenities: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Image URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newSpace.image_url}
                  onChange={e => setNewSpace({ ...newSpace, image_url: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Description *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe your space, layout, lighting, and suitable event types..."
                  value={newSpace.description}
                  onChange={e => setNewSpace({ ...newSpace, description: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddSpaceModal(false)}
                  style={{ padding: '10px 18px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '10px 22px', background: '#0d8a73', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
                >
                  {submitting ? 'Saving Space...' : 'Create Event Space'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SERVICE */}
      {showAddServiceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Add Professional Service</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Offer catering, photography, DJ sound, or event decor.</p>
              </div>
              <button onClick={() => setShowAddServiceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            {serviceErrorNotice && (
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '12px 16px', color: '#991b1b', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AlertCircle size={18} />
                <span>{serviceErrorNotice}</span>
              </div>
            )}

            <form onSubmit={handleAddServiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Service Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Executive Wedding Photography Package"
                  value={newService.title}
                  onChange={e => setNewService({ ...newService, title: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Category *</label>
                  <select
                    value={newService.category}
                    onChange={e => setNewService({ ...newService, category: e.target.value, custom_category: '' })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="PHOTOGRAPHY">Photography & Video</option>
                    <option value="CATERING">Catering & Bar</option>
                    <option value="DECORATION">Decoration & Floral</option>
                    <option value="ENTERTAINMENT">DJ & Live Music</option>
                    <option value="PLANNING">Full Event Planning</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {newService.category === 'OTHER' && (
                    <input
                      type="text"
                      required
                      maxLength={100}
                      placeholder="Type your service category"
                      value={newService.custom_category}
                      onChange={e => setNewService({ ...newService, custom_category: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', marginTop: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Pricing Model *</label>
                  <select
                    value={newService.pricing_type}
                    onChange={e => setNewService({ ...newService, pricing_type: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="Per Event">Per Event / Flat Package</option>
                    <option value="Per Hour">Per Hour</option>
                    <option value="Per Person">Per Person / Guest</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Maximum Guests Supported *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Enter maximum guests"
                  value={newService.capacity}
                  onChange={e => setNewService({ ...newService, capacity: e.target.value === '' ? '' : Number(e.target.value) })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Starting Price (KES) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 25000"
                  value={newService.price_per_day}
                  onChange={e => setNewService({ ...newService, price_per_day: Number(e.target.value) })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Service Cover Image</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/... or upload file"
                    value={newService.image_url}
                    onChange={e => setNewService({ ...newService, image_url: e.target.value })}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                  <label style={{ background: '#f1f5f9', color: '#0d8a73', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Upload File
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          const url = await ApiService.uploadImage(e.target.files[0]);
                          if (url) {
                            setNewService(prev => ({ ...prev, image_url: url }));
                            toast.success('Image uploaded!');
                          }
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Package Details & Inclusions *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="What is included in this package? (e.g. 8 hours coverage, 2 photographers, edited digital album...)"
                  value={newService.description}
                  onChange={e => setNewService({ ...newService, description: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(false)}
                  style={{ padding: '10px 18px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '10px 22px', background: '#0d8a73', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
                >
                  {submitting ? 'Saving Service...' : 'Create Service Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
