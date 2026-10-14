import React, { useState } from 'react';
import {
  Wrench,
  Building2,
  ArrowLeft,
  ChevronDown,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiService } from '../services/api';
import type { VenueCategory } from '../types';
import { cleanImageUrl, DEFAULT_SPACE_IMAGE, DEFAULT_SERVICE_IMAGE } from '../utils/imageUtils';

interface CreateListingPageProps {
  onBack: () => void;
  onSuccess: () => void;
  currentVendorId?: number;
  currentOwnerId?: number;
  currentUserId?: number;
  defaultMode?: 'service' | 'venue';
}

export const CreateListingPage: React.FC<CreateListingPageProps> = ({
  onBack,
  onSuccess,
  currentVendorId,
  currentOwnerId,
  currentUserId,
  defaultMode = 'service',
}) => {
  const [activeMode, setActiveMode] = useState<'service' | 'venue'>(defaultMode);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Service form fields
  const [serviceName, setServiceName] = useState('');
  const [servicePricingBasis, setServicePricingBasis] = useState('Per Event');
  const serviceCategory: VenueCategory = 'PHOTOGRAPHY';
  const [serviceDesc, setServiceDesc] = useState('');
  const [servicePrice, setServicePrice] = useState<number | ''>('');
  const [serviceCoverUrl, setServiceCoverUrl] = useState('');
  const [serviceInclusions, setServiceInclusions] = useState('');
  const [serviceEventTypes, setServiceEventTypes] = useState('Weddings, Birthdays, Corporate Events');
  const [serviceDuration, setServiceDuration] = useState('4 hours');
  const [serviceMaxGuests, setServiceMaxGuests] = useState<number | ''>('');
  const [serviceArea, setServiceArea] = useState('Nairobi & Surrounding Areas');
  const [serviceAvailability, setServiceAvailability] = useState('Weekdays & Weekends (Flexible)');
  const [serviceEquipment, setServiceEquipment] = useState('');

  // Venue form fields
  const [venueName, setVenueName] = useState('');
  const [venuePricingBasis, setVenuePricingBasis] = useState('Per Day');
  const [venueCategory, setVenueCategory] = useState<VenueCategory>('WEDDING');
  const [venueDesc, setVenueDesc] = useState('');
  const [venuePrice, setVenuePrice] = useState<number | ''>('');
  const [venueLocation, setVenueLocation] = useState('Nairobi, Kenya');
  const [venueCoverUrl, setVenueCoverUrl] = useState('');
  const [venueCapacity, setVenueCapacity] = useState<number | ''>('');
  const [venueLayout, setVenueLayout] = useState('');
  const [venueFacilities, setVenueFacilities] = useState('Parking, Wi-Fi, Restrooms, Standby Generator, Kitchen');
  const [venueEventTypes, setVenueEventTypes] = useState('Weddings, Corporate Conferences, Banquets, Private Celebrations');
  const [venueBookingDuration, setVenueBookingDuration] = useState('Full Day (8:00 AM - 11:00 PM) including setup');
  const [venueAvailability, setVenueAvailability] = useState('Available All Days (Subject to advance booking)');

  const resolveIds = async () => {
    let vendorId = currentVendorId;
    let ownerId = currentOwnerId;
    if (!vendorId && !ownerId && currentUserId) {
      try {
        const resp = await ApiService.requestRole(currentUserId, 'PROVIDER');
        if (resp) {
          vendorId = resp.vendor_profile?.id;
          ownerId = resp.venue_owner_profile?.id;
        }
      } catch (err) {
        console.error('Role resolution failed', err);
      }
    }
    return { vendorId, ownerId };
  };

  const handleSaveDraft = () => {
    toast.success(`${activeMode === 'service' ? 'Service' : 'Venue'} listing saved as draft!`);
    onSuccess();
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim()) {
      toast.error('Please enter a service name.');
      return;
    }
    if (!servicePrice || Number(servicePrice) <= 0) {
      toast.error('Please enter a valid starting price.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { vendorId, ownerId } = await resolveIds();
      
      const fullDescription = [
        serviceDesc.trim(),
        serviceInclusions ? `\n\nWhat's Included / Package Details:\n${serviceInclusions.trim()}` : '',
        serviceEquipment ? `\n\nSpecial Equipment & Capabilities:\n${serviceEquipment.trim()}` : '',
        `\n\nPricing Basis: ${servicePricingBasis}`,
        serviceDuration ? `\nDuration: ${serviceDuration}` : '',
        serviceMaxGuests ? `\nMax Guests Supported: ${serviceMaxGuests}` : '',
        serviceAvailability ? `\nAvailability: ${serviceAvailability}` : '',
      ].filter(Boolean).join('');

      await ApiService.addVenue({
        vendor: vendorId,
        owner: ownerId,
        title: serviceName.trim(),
        category: serviceCategory,
        location: serviceArea || 'Nairobi',
        capacity: serviceMaxGuests ? Number(serviceMaxGuests) : 0,
        price_per_day: Number(servicePrice),
        description: fullDescription,
        image_url: cleanImageUrl(serviceCoverUrl) || DEFAULT_SERVICE_IMAGE,
      });

      toast.success('Service listing created and submitted for review!');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit service listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVenueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venueName.trim()) {
      toast.error('Please enter a venue name.');
      return;
    }
    if (!venuePrice || Number(venuePrice) <= 0) {
      toast.error('Please enter a valid starting price.');
      return;
    }
    if (!venueCapacity || Number(venueCapacity) <= 0) {
      toast.error('Please specify the maximum guest capacity.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { vendorId, ownerId } = await resolveIds();

      const amenitiesList = venueFacilities
        ? venueFacilities.split(',').map((f) => f.trim()).filter(Boolean)
        : ['Parking', 'Restrooms', 'Security'];

      const fullDescription = [
        venueDesc.trim(),
        venueLayout ? `\n\nLayout & Spaces:\n${venueLayout.trim()}` : '',
        venueEventTypes ? `\n\nEvent Types Supported:\n${venueEventTypes.trim()}` : '',
        venueBookingDuration ? `\nBooking Duration / Setup: ${venueBookingDuration}` : '',
        `\nPricing Basis: ${venuePricingBasis}`,
        venueAvailability ? `\nAvailability: ${venueAvailability}` : '',
      ].filter(Boolean).join('');

      await ApiService.addVenue({
        owner: ownerId,
        vendor: vendorId,
        title: venueName.trim(),
        category: venueCategory,
        location: venueLocation || 'Nairobi',
        address: venueLocation,
        capacity: Number(venueCapacity),
        price_per_day: Number(venuePrice),
        price_per_hour: Math.round(Number(venuePrice) / 8),
        description: fullDescription,
        amenities: amenitiesList,
        image_url: cleanImageUrl(venueCoverUrl) || DEFAULT_SPACE_IMAGE,
      });

      toast.success('Venue listing created and submitted for review!');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit venue listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-listing-page-container">
      {/* Top Breadcrumb & Switcher Bar */}
      <div className="create-listing-header-row">
        <div>
          <button onClick={onBack} className="btn-back-link">
            <ArrowLeft size={16} /> Back to My Listings
          </button>
          <h1 className="create-listing-main-title">Create a New Listing</h1>
          <p className="create-listing-main-subtitle">
            Describe what you offer — add the details that fit your listing.
          </p>
        </div>

        {/* Switcher buttons matching screenshot */}
        <div className="listing-type-toggle-pill">
          <button
            type="button"
            className={`toggle-option-btn ${activeMode === 'service' ? 'active' : ''}`}
            onClick={() => setActiveMode('service')}
          >
            <Wrench size={16} /> Service
          </button>
          <button
            type="button"
            className={`toggle-option-btn ${activeMode === 'venue' ? 'active' : ''}`}
            onClick={() => setActiveMode('venue')}
          >
            <Building2 size={16} /> Venue
          </button>
        </div>
      </div>

      {/* Display Single Dedicated Form Card depending on selected mode (Service vs Venue) */}
      <div className="create-listing-single-container" style={{ maxWidth: '820px', width: '100%' }}>
        
        {/* ================= ADD A SERVICE ================= */}
        {activeMode === 'service' && (
          <div className="listing-form-card featured-card">
            <div className="listing-card-header">
              <div className="listing-card-icon-bubble mint">
                <Wrench size={22} />
              </div>
              <div>
                <h2 className="listing-card-title">Add a Service</h2>
                <p className="listing-card-subtitle">
                  Tell customers what service you provide and what to expect.
                </p>
              </div>
            </div>
            <form onSubmit={handleServiceSubmit} className="listing-form-body">
            {/* Service Name & Pricing Basis */}
            <div className="listing-field-row-split">
              <div className="listing-field-group">
                <label className="listing-field-label">Service Name *</label>
                <input
                  type="text"
                  required
                  className="listing-input"
                  placeholder="e.g. Event planning, Photography, Catering..."
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                />
              </div>

              <div className="listing-field-group">
                <label className="listing-field-label">Pricing Basis *</label>
                <div className="listing-select-wrapper">
                  <select
                    className="listing-select"
                    value={servicePricingBasis}
                    onChange={(e) => setServicePricingBasis(e.target.value)}
                  >
                    <option value="Per Event">Per Event</option>
                    <option value="Per Hour">Per Hour</option>
                    <option value="Per Guest">Per Guest / Plate</option>
                    <option value="Fixed Package">Fixed Package</option>
                  </select>
                  <ChevronDown className="select-chevron" size={16} />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="listing-field-group">
              <div className="field-label-with-counter">
                <label className="listing-field-label">Description *</label>
                <span className="field-char-count">{serviceDesc.length}/1000</span>
              </div>
              <textarea
                required
                rows={3}
                maxLength={1000}
                className="listing-textarea"
                placeholder="Describe your service, what it includes, and what makes it unique..."
                value={serviceDesc}
                onChange={(e) => setServiceDesc(e.target.value)}
              />
            </div>

            {/* Starting Price & Service Cover Image URL */}
            <div className="listing-field-row-split">
              <div className="listing-field-group">
                <label className="listing-field-label">Starting Price (KES) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="listing-input"
                  placeholder="e.g. 15000"
                  value={servicePrice}
                  onChange={(e) => setServicePrice(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="listing-field-group">
                <label className="listing-field-label">Service Cover Image URL (Optional)</label>
                <input
                  type="url"
                  className="listing-input"
                  placeholder="https://example.com/image.jpg"
                  value={serviceCoverUrl}
                  onChange={(e) => setServiceCoverUrl(e.target.value)}
                />
              </div>
            </div>

            {/* What's Included / Package Details */}
            <div className="listing-field-group">
              <div className="field-label-with-counter">
                <label className="listing-field-label">What's Included / Package Details *</label>
                <span className="field-char-count">{serviceInclusions.length}/500</span>
              </div>
              <textarea
                required
                rows={2}
                maxLength={500}
                className="listing-textarea"
                placeholder="List what's included in your service or package..."
                value={serviceInclusions}
                onChange={(e) => setServiceInclusions(e.target.value)}
              />
            </div>

            {/* Supported Event Types & Duration */}
            <div className="listing-field-row-split">
              <div className="listing-field-group">
                <label className="listing-field-label">Supported Event Types *</label>
                <input
                  type="text"
                  required
                  className="listing-input"
                  placeholder="e.g. Weddings, Birthdays, Corporate Events..."
                  value={serviceEventTypes}
                  onChange={(e) => setServiceEventTypes(e.target.value)}
                />
              </div>

              <div className="listing-field-group">
                <label className="listing-field-label">Service Duration / Hours</label>
                <input
                  type="text"
                  className="listing-input"
                  placeholder="e.g. 4 hours"
                  value={serviceDuration}
                  onChange={(e) => setServiceDuration(e.target.value)}
                />
              </div>
            </div>

            {/* Maximum Guests (Optional) & Service Area */}
            <div className="listing-field-row-split">
              <div className="listing-field-group">
                <label className="listing-field-label">Maximum Guests (Optional)</label>
                <input
                  type="number"
                  min="1"
                  className="listing-input"
                  placeholder="e.g. 200"
                  value={serviceMaxGuests}
                  onChange={(e) => setServiceMaxGuests(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="listing-field-group">
                <label className="listing-field-label">Service Area *</label>
                <div className="listing-select-wrapper">
                  <select
                    className="listing-select"
                    value={serviceArea}
                    onChange={(e) => setServiceArea(e.target.value)}
                  >
                    <option value="Nairobi & Surrounding Areas">Nairobi & Surrounding Areas</option>
                    <option value="Mombasa & Coastal Region">Mombasa & Coastal Region</option>
                    <option value="Nakuru & Rift Valley">Nakuru & Rift Valley</option>
                    <option value="Kisumu & Western Kenya">Kisumu & Western Kenya</option>
                    <option value="Nyeri & Mt Kenya Region">Nyeri & Mt Kenya Region</option>
                    <option value="Nationwide / Travel Anywhere">Nationwide / Travel Anywhere</option>
                  </select>
                  <ChevronDown className="select-chevron" size={16} />
                </div>
              </div>
            </div>

            {/* Availability & Equipment / Staff */}
            <div className="listing-field-row-split">
              <div className="listing-field-group">
                <label className="listing-field-label">Availability *</label>
                <div className="listing-select-wrapper">
                  <select
                    className="listing-select"
                    value={serviceAvailability}
                    onChange={(e) => setServiceAvailability(e.target.value)}
                  >
                    <option value="Weekdays & Weekends (Flexible)">Weekdays & Weekends (Flexible)</option>
                    <option value="Weekends Only">Weekends Only</option>
                    <option value="Weekdays Only">Weekdays Only</option>
                    <option value="Available on Request">Available on Request</option>
                  </select>
                  <ChevronDown className="select-chevron" size={16} />
                </div>
              </div>

              <div className="listing-field-group">
                <div className="field-label-with-counter">
                  <label className="listing-field-label">Equipment / Staff / Special Capabilities (Optional)</label>
                  <span className="field-char-count">{serviceEquipment.length}/300</span>
                </div>
                <input
                  type="text"
                  maxLength={300}
                  className="listing-input"
                  placeholder="e.g. Cameras, lighting, trained staff..."
                  value={serviceEquipment}
                  onChange={(e) => setServiceEquipment(e.target.value)}
                />
              </div>
            </div>

            {/* Info notice pill */}
            <div className="listing-info-pill">
              <Info size={16} className="info-icon" />
              <span>This is a general listing. You can add custom details that match your specific service.</span>
            </div>

            {/* Action buttons */}
            <div className="listing-card-actions">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="btn-listing-draft"
              >
                Save as Draft
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-listing-submit"
              >
                {isSubmitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </form>
        </div>
        )}

        {/* ================= ADD A VENUE ================= */}
        {activeMode === 'venue' && (
        <div className="listing-form-card featured-card">
          <div className="listing-card-header">
            <div className="listing-card-icon-bubble mint">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="listing-card-title">Add a Venue</h2>
              <p className="listing-card-subtitle">
                Showcase your space and help customers plan their events.
              </p>
            </div>
          </div>

          <form onSubmit={handleVenueSubmit} className="listing-form-body">
            {/* Venue Name & Pricing Basis */}
            <div className="listing-field-row-split">
              <div className="listing-field-group">
                <label className="listing-field-label">Venue Name *</label>
                <input
                  type="text"
                  required
                  className="listing-input"
                  placeholder="e.g. Garden View Hall, Riverside Gardens..."
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                />
              </div>

              <div className="listing-field-group">
                <label className="listing-field-label">Pricing Basis *</label>
                <div className="listing-select-wrapper">
                  <select
                    className="listing-select"
                    value={venuePricingBasis}
                    onChange={(e) => setVenuePricingBasis(e.target.value)}
                  >
                    <option value="Per Day">Per Day</option>
                    <option value="Per Hour">Per Hour</option>
                    <option value="Per Guest">Per Guest</option>
                    <option value="Weekend Rate">Weekend Rate</option>
                  </select>
                  <ChevronDown className="select-chevron" size={16} />
                </div>
              </div>
            </div>

            {/* Venue Category */}
            <div className="listing-field-group">
              <label className="listing-field-label">Venue Category *</label>
              <div className="listing-select-wrapper">
                <select
                  className="listing-select"
                  value={venueCategory}
                  onChange={(e) => setVenueCategory(e.target.value as VenueCategory)}
                >
                  <option value="WEDDING">Wedding Gardens & Halls</option>
                  <option value="CONFERENCE">Conference & Corporate Centers</option>
                  <option value="BIRTHDAY">Birthday & Private Party Venues</option>
                  <option value="OUTDOOR">Outdoor & Picnic Grounds</option>
                  <option value="PARTY">Nightlife & Celebration Spaces</option>
                  <option value="EXHIBITION">Exhibition & Trade Halls</option>
                </select>
                <ChevronDown className="select-chevron" size={16} />
              </div>
            </div>

            {/* Description */}
            <div className="listing-field-group">
              <div className="field-label-with-counter">
                <label className="listing-field-label">Description *</label>
                <span className="field-char-count">{venueDesc.length}/1000</span>
              </div>
              <textarea
                required
                rows={3}
                maxLength={1000}
                className="listing-textarea"
                placeholder="Describe your venue, space, and what makes it special..."
                value={venueDesc}
                onChange={(e) => setVenueDesc(e.target.value)}
              />
            </div>

            {/* Starting Price & Location / Address */}
            <div className="listing-field-row-split">
              <div className="listing-field-group">
                <label className="listing-field-label">Starting Price (KES) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="listing-input"
                  placeholder="e.g. 20000"
                  value={venuePrice}
                  onChange={(e) => setVenuePrice(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="listing-field-group">
                <label className="listing-field-label">Location / Address *</label>
                <input
                  type="text"
                  required
                  className="listing-input"
                  placeholder="e.g. Nyeri Town, Kenya"
                  value={venueLocation}
                  onChange={(e) => setVenueLocation(e.target.value)}
                />
              </div>
            </div>

            {/* Venue Cover Image URL */}
            <div className="listing-field-group">
              <label className="listing-field-label">Venue Cover Image URL (Optional)</label>
              <input
                type="url"
                className="listing-input"
                placeholder="https://example.com/venue-photo.jpg"
                value={venueCoverUrl}
                onChange={(e) => setVenueCoverUrl(e.target.value)}
              />
            </div>

            {/* Maximum Guest Capacity & Available Spaces / Layout Details */}
            <div className="listing-field-row-split">
              <div className="listing-field-group">
                <label className="listing-field-label">Maximum Guest Capacity *</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="listing-input"
                  placeholder="e.g. 200"
                  value={venueCapacity}
                  onChange={(e) => setVenueCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="listing-field-group">
                <label className="listing-field-label">Available Spaces / Layout Details</label>
                <input
                  type="text"
                  className="listing-input"
                  placeholder="e.g. Indoor hall, outdoor area, multiple rooms..."
                  value={venueLayout}
                  onChange={(e) => setVenueLayout(e.target.value)}
                />
              </div>
            </div>

            {/* Facilities & Amenities */}
            <div className="listing-field-group">
              <div className="field-label-with-counter">
                <label className="listing-field-label">Facilities & Amenities</label>
                <span className="field-char-count">{venueFacilities.length}/500</span>
              </div>
              <textarea
                rows={2}
                maxLength={500}
                className="listing-textarea"
                placeholder="e.g. Parking, Wi-Fi, kitchen, accessibility..."
                value={venueFacilities}
                onChange={(e) => setVenueFacilities(e.target.value)}
              />
            </div>

            {/* Event Types Supported & Booking Duration / Setup Time */}
            <div className="listing-field-row-split">
              <div className="listing-field-group">
                <label className="listing-field-label">Event Types Supported *</label>
                <input
                  type="text"
                  required
                  className="listing-input"
                  placeholder="e.g. Weddings, Birthdays, Corporate Events..."
                  value={venueEventTypes}
                  onChange={(e) => setVenueEventTypes(e.target.value)}
                />
              </div>

              <div className="listing-field-group">
                <label className="listing-field-label">Booking Duration / Setup Time</label>
                <input
                  type="text"
                  className="listing-input"
                  placeholder="e.g. 6 hours (includes setup)"
                  value={venueBookingDuration}
                  onChange={(e) => setVenueBookingDuration(e.target.value)}
                />
              </div>
            </div>

            {/* Availability */}
            <div className="listing-field-group">
              <label className="listing-field-label">Availability *</label>
              <div className="listing-select-wrapper">
                <select
                  className="listing-select"
                  value={venueAvailability}
                  onChange={(e) => setVenueAvailability(e.target.value)}
                >
                  <option value="Available All Days (Subject to advance booking)">Available All Days (Subject to advance booking)</option>
                  <option value="Weekends Only">Weekends Only</option>
                  <option value="Weekdays Only">Weekdays Only</option>
                  <option value="Seasonal / Select Dates">Seasonal / Select Dates</option>
                </select>
                <ChevronDown className="select-chevron" size={16} />
              </div>
            </div>

            {/* Info notice pill */}
            <div className="listing-info-pill">
              <Info size={16} className="info-icon" />
              <span>Provide accurate and complete details so customers can make the right choice.</span>
            </div>

            {/* Action buttons */}
            <div className="listing-card-actions">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="btn-listing-draft"
              >
                Save as Draft
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-listing-submit"
              >
                {isSubmitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </form>
        </div>
        )}

      </div>
    </div>
  );
};
