import React, { useEffect, useRef, useState } from 'react';
import {
  Wrench,
  Building2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Info,
  ImagePlus,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiService } from '../services/api';
import type { Venue } from '../types';
import { cleanImageUrl } from '../utils/imageUtils';

interface PortfolioDraft {
  id?: number;
  image_url: string;
  caption: string;
  display_order: number;
  file?: File;
  preview_url: string;
}

interface CreateListingPageProps {
  onBack: () => void;
  onSuccess: () => void;
  currentVendorId?: number;
  currentOwnerId?: number;
  currentUserId?: number;
  defaultMode?: 'service' | 'venue';
  editingListing?: Venue | null;
}

export const CreateListingPage: React.FC<CreateListingPageProps> = ({
  onBack,
  onSuccess,
  currentVendorId,
  currentOwnerId,
  currentUserId,
  defaultMode = 'service',
  editingListing = null,
}) => {
  const nyeriCountyLocation = 'Nyeri County, Kenya';
  const serviceCategoryOptions = ['PHOTOGRAPHY', 'CATERING', 'DECORATION', 'ENTERTAINMENT', 'PLANNING', 'SOUND'];
  const venueCategoryOptions = ['WEDDING', 'CONFERENCE', 'BIRTHDAY', 'OUTDOOR', 'PARTY', 'EXHIBITION'];
  const existingCustomServiceCategory = editingListing?.listing_type === 'SERVICE'
    && !serviceCategoryOptions.includes(editingListing.category);
  const existingCustomVenueCategory = editingListing?.listing_type === 'VENUE'
    && !venueCategoryOptions.includes(editingListing.category);
  const [activeMode, setActiveMode] = useState<'service' | 'venue'>(
    editingListing
      ? editingListing.listing_type === 'SERVICE'
        ? 'service'
        : 'venue'
      : defaultMode
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [persistedListingId, setPersistedListingId] = useState<number | null>(editingListing?.id ?? null);
  const [portfolioImages, setPortfolioImages] = useState<PortfolioDraft[]>(() => (
    editingListing?.portfolio?.map(image => ({
      id: image.id,
      image_url: image.image_url,
      caption: image.caption || '',
      display_order: image.display_order,
      preview_url: cleanImageUrl(image.image_url),
    })) || []
  ));
  const [removedPortfolioIds, setRemovedPortfolioIds] = useState<number[]>([]);
  const portfolioObjectUrls = useRef<string[]>([]);

  useEffect(() => () => {
    portfolioObjectUrls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    setPersistedListingId(editingListing?.id ?? null);
    setPortfolioImages(editingListing?.portfolio?.map(image => ({
      id: image.id,
      image_url: image.image_url,
      caption: image.caption || '',
      display_order: image.display_order,
      preview_url: cleanImageUrl(image.image_url),
    })) || []);
    setRemovedPortfolioIds([]);
  }, [editingListing?.id]);

  const handlePortfolioFiles = (files: FileList | null) => {
    if (!files) return;
    const newImages: PortfolioDraft[] = [];

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 5 MB image limit.`);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      portfolioObjectUrls.current.push(previewUrl);
      newImages.push({
        image_url: '',
        caption: '',
        display_order: portfolioImages.length + newImages.length + 1,
        file,
        preview_url: previewUrl,
      });
    });

    if (newImages.length) {
      setPortfolioImages(previous => [...previous, ...newImages]);
    }
  };

  const removePortfolioImage = (index: number) => {
    const image = portfolioImages[index];
    if (image?.id) setRemovedPortfolioIds(ids => [...ids, image.id!]);
    setPortfolioImages(previous => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const movePortfolioImage = (index: number, direction: -1 | 1) => {
    setPortfolioImages(previous => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= previous.length) return previous;
      const reordered = [...previous];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      return reordered;
    });
  };

  const persistPortfolio = async (venueId: number) => {
    for (const id of removedPortfolioIds) {
      const deleted = await ApiService.deletePortfolioImage(id);
      if (!deleted) throw new Error('Failed to remove a portfolio image.');
      setRemovedPortfolioIds(previous => previous.filter(removedId => removedId !== id));
    }

    for (const [index, image] of portfolioImages.entries()) {
      const imageData = {
        caption: image.caption.trim(),
        display_order: index + 1,
      };

      if (image.id) {
        await ApiService.updatePortfolioImage(image.id, imageData);
        continue;
      }

      const imageUrl = image.file ? await ApiService.uploadImage(image.file) : image.image_url;
      if (!imageUrl) throw new Error('Failed to upload a portfolio image.');
      const createdImage = await ApiService.createPortfolioImage({
        venue: venueId,
        image_url: imageUrl,
        ...imageData,
      });
      setPortfolioImages(previous => previous.map((item, currentIndex) => (
        currentIndex === index
          ? { ...item, id: createdImage.id, image_url: createdImage.image_url, file: undefined, preview_url: createdImage.image_url }
          : item
      )));
    }
  };

  const portfolioSection = (
    <section style={{ margin: '8px 0 20px', padding: '18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <h3 style={{ margin: '0 0 5px', color: '#0f172a', fontSize: '1.05rem', fontWeight: 800 }}>Portfolio</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', lineHeight: 1.45 }}>
            Showcase your work with photos that help customers understand what they can expect.
          </p>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 13px', borderRadius: '8px', background: '#0d8a73', color: '#fff', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <ImagePlus size={16} /> Add Portfolio Image
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(event) => {
              handlePortfolioFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
      </div>

      {portfolioImages.length === 0 ? (
        <div style={{ padding: '24px 12px', textAlign: 'center', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '9px', color: '#64748b', fontSize: '0.88rem' }}>
          No portfolio images have been added yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
          {portfolioImages.map((image, index) => (
            <div key={image.id ?? image.preview_url} style={{ overflow: 'hidden', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <div style={{ height: '118px', position: 'relative', background: '#e2e8f0' }}>
                <img
                  src={image.preview_url}
                  alt={image.caption || `Portfolio image ${index + 1}`}
                  onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{ position: 'absolute', right: '6px', top: '6px', display: 'flex', gap: '4px' }}>
                  <button type="button" onClick={() => movePortfolioImage(index, -1)} disabled={index === 0} aria-label="Move image earlier" style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', border: 0, borderRadius: '6px', background: '#ffffffed', color: '#334155', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.5 : 1 }}>
                    <ChevronUp size={16} />
                  </button>
                  <button type="button" onClick={() => movePortfolioImage(index, 1)} disabled={index === portfolioImages.length - 1} aria-label="Move image later" style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', border: 0, borderRadius: '6px', background: '#ffffffed', color: '#334155', cursor: index === portfolioImages.length - 1 ? 'not-allowed' : 'pointer', opacity: index === portfolioImages.length - 1 ? 0.5 : 1 }}>
                    <ChevronDown size={16} />
                  </button>
                  <button type="button" onClick={() => removePortfolioImage(index)} aria-label="Remove portfolio image" style={{ width: '28px', height: '28px', display: 'grid', placeItems: 'center', border: 0, borderRadius: '6px', background: '#ffffffed', color: '#b91c1c', cursor: 'pointer' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div style={{ padding: '8px' }}>
                <input
                  type="text"
                  maxLength={240}
                  value={image.caption}
                  onChange={(event) => setPortfolioImages(previous => previous.map((item, currentIndex) => currentIndex === index ? { ...item, caption: event.target.value } : item))}
                  placeholder="Optional caption"
                  aria-label={`Caption for portfolio image ${index + 1}`}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#334155', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  // Service form fields
  const [serviceName, setServiceName] = useState(editingListing?.title || '');
  const [servicePricingBasis, setServicePricingBasis] = useState('Per Event');
  const [serviceCategory, setServiceCategory] = useState<string>(
    existingCustomServiceCategory ? 'OTHER' : editingListing?.category || 'PLANNING'
  );
  const [customServiceCategory, setCustomServiceCategory] = useState(
    existingCustomServiceCategory ? editingListing?.category || '' : ''
  );
  const [serviceDesc, setServiceDesc] = useState(editingListing?.description || '');
  const [servicePrice, setServicePrice] = useState<number | ''>(editingListing?.price_per_day ?? '');
  const [serviceCoverUrl, setServiceCoverUrl] = useState(editingListing?.image_url || '');
  const [serviceInclusions, setServiceInclusions] = useState('');
  const [serviceEventTypes, setServiceEventTypes] = useState('Weddings, Birthdays, Corporate Events');
  const [serviceDuration, setServiceDuration] = useState('4 hours');
  const [serviceMaxGuests, setServiceMaxGuests] = useState<number | ''>(
    editingListing?.listing_type === 'SERVICE' && editingListing.capacity > 0
      ? editingListing.capacity
      : ''
  );
  const [serviceArea, setServiceArea] = useState(
    editingListing?.location.trim().toLowerCase() === nyeriCountyLocation.toLowerCase()
      ? editingListing.location
      : editingListing ? '' : nyeriCountyLocation
  );
  const [serviceAvailability, setServiceAvailability] = useState('Weekdays & Weekends (Flexible)');
  const [serviceEquipment, setServiceEquipment] = useState('');

  // Venue form fields
  const [venueName, setVenueName] = useState(editingListing?.title || '');
  const [venuePricingBasis, setVenuePricingBasis] = useState('Per Day');
  const [venueCategory, setVenueCategory] = useState<string>(
    existingCustomVenueCategory ? 'OTHER' : editingListing?.category || 'WEDDING'
  );
  const [customVenueCategory, setCustomVenueCategory] = useState(
    existingCustomVenueCategory ? editingListing?.category || '' : ''
  );
  const [venueDesc, setVenueDesc] = useState(editingListing?.description || '');
  const [venuePrice, setVenuePrice] = useState<number | ''>(editingListing?.price_per_day ?? '');
  const [venueLocation, setVenueLocation] = useState(
    editingListing?.location.trim().toLowerCase() === nyeriCountyLocation.toLowerCase()
      ? editingListing.location
      : editingListing ? '' : nyeriCountyLocation
  );
  const [venueCoverUrl, setVenueCoverUrl] = useState(editingListing?.image_url || '');
  const [venueCapacity, setVenueCapacity] = useState<number | ''>(editingListing?.capacity || '');
  const [venueLayout, setVenueLayout] = useState('');
  const [venueFacilities, setVenueFacilities] = useState(editingListing?.amenities?.join(', ') || 'Parking, Wi-Fi, Restrooms, Standby Generator, Kitchen');
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

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const category = serviceCategory === 'OTHER'
      ? customServiceCategory.trim()
      : serviceCategory;
    if (!serviceName.trim()) {
      toast.error('Please enter a service name.');
      return;
    }
    if (!category) {
      toast.error('Please enter a service category.');
      return;
    }
    if (!serviceMaxGuests || Number(serviceMaxGuests) <= 0) {
      toast.error('Please enter the maximum number of guests this service can support.');
      return;
    }
    if (!servicePrice || Number(servicePrice) <= 0) {
      toast.error('Please enter a valid starting price.');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullDescription = editingListing ? serviceDesc.trim() : [
        serviceDesc.trim(),
        serviceInclusions ? `\n\nWhat's Included / Package Details:\n${serviceInclusions.trim()}` : '',
        serviceEquipment ? `\n\nSpecial Equipment & Capabilities:\n${serviceEquipment.trim()}` : '',
        `\n\nPricing Basis: ${servicePricingBasis}`,
        serviceDuration ? `\nDuration: ${serviceDuration}` : '',
        serviceMaxGuests ? `\nMax Guests Supported: ${serviceMaxGuests}` : '',
        serviceAvailability ? `\nAvailability: ${serviceAvailability}` : '',
      ].filter(Boolean).join('');

      const listingData = {
        listing_type: 'SERVICE' as const,
        title: serviceName.trim(),
        category,
        location: serviceArea,
        capacity: Number(serviceMaxGuests),
        price_per_day: Number(servicePrice),
        description: fullDescription,
        image_url: cleanImageUrl(serviceCoverUrl),
      };

      let listingId = persistedListingId;
      if (listingId) {
        await ApiService.updateVenue(listingId, listingData);
      } else {
        const { vendorId, ownerId } = await resolveIds();
        const createdListing = await ApiService.addVenue({ ...listingData, vendor: vendorId, owner: ownerId });
        listingId = createdListing.id;
        setPersistedListingId(createdListing.id);
      }

      await persistPortfolio(listingId);
      toast.success(editingListing || persistedListingId ? 'Service listing updated.' : 'Service listing created and submitted for review!');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit service listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVenueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const category = venueCategory === 'OTHER'
      ? customVenueCategory.trim()
      : venueCategory;
    if (!venueName.trim()) {
      toast.error('Please enter a venue name.');
      return;
    }
    if (!category) {
      toast.error('Please enter a venue category.');
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
      const amenitiesList = venueFacilities
        ? venueFacilities.split(',').map((f) => f.trim()).filter(Boolean)
        : ['Parking', 'Restrooms', 'Security'];

      const fullDescription = editingListing ? venueDesc.trim() : [
        venueDesc.trim(),
        venueLayout ? `\n\nLayout & Spaces:\n${venueLayout.trim()}` : '',
        venueEventTypes ? `\n\nEvent Types Supported:\n${venueEventTypes.trim()}` : '',
        venueBookingDuration ? `\nBooking Duration / Setup: ${venueBookingDuration}` : '',
        `\nPricing Basis: ${venuePricingBasis}`,
        venueAvailability ? `\nAvailability: ${venueAvailability}` : '',
      ].filter(Boolean).join('');

      const listingData = {
        listing_type: 'VENUE' as const,
        title: venueName.trim(),
        category,
        location: venueLocation,
        address: venueLocation,
        capacity: Number(venueCapacity),
        price_per_day: Number(venuePrice),
        price_per_hour: Math.round(Number(venuePrice) / 8),
        description: fullDescription,
        amenities: amenitiesList,
        image_url: cleanImageUrl(venueCoverUrl),
      };

      let listingId = persistedListingId;
      if (listingId) {
        await ApiService.updateVenue(listingId, listingData);
      } else {
        const { vendorId, ownerId } = await resolveIds();
        const createdListing = await ApiService.addVenue({ ...listingData, owner: ownerId, vendor: vendorId });
        listingId = createdListing.id;
        setPersistedListingId(createdListing.id);
      }

      await persistPortfolio(listingId);
      toast.success(editingListing || persistedListingId ? 'Venue listing updated.' : 'Venue listing created and submitted for review!');
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
        {!editingListing && (
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
        )}
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
                <h2 className="listing-card-title">{editingListing ? 'Edit Service Listing' : 'Add a Service'}</h2>
                <p className="listing-card-subtitle">
                  Tell customers what service you provide and what to expect.
                </p>
              </div>
            </div>
            <form onSubmit={handleServiceSubmit} className="listing-form-body">
            {/* Service Name, Category & Pricing Basis */}
            <div className="listing-field-row-split">
              <div className="listing-field-group">
                <label className="listing-field-label">Service Name *</label>
                <input
                  type="text"
                  required
                  className="listing-input"
                  placeholder="e.g. Event planning, Catering, Decoration..."
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                />
              </div>

              <div className="listing-field-group">
                <label className="listing-field-label">Service Category *</label>
                <div className="listing-select-wrapper">
                  <select
                    required
                    className="listing-select"
                    value={serviceCategory}
                    onChange={(e) => {
                      setServiceCategory(e.target.value);
                      if (e.target.value !== 'OTHER') setCustomServiceCategory('');
                    }}
                  >
                    <option value="PHOTOGRAPHY">Photography &amp; Videography</option>
                    <option value="CATERING">Catering &amp; Bar Service</option>
                    <option value="DECORATION">Event Decoration &amp; Styling</option>
                    <option value="ENTERTAINMENT">DJ &amp; Entertainment</option>
                    <option value="PLANNING">Event Planning &amp; Coordination</option>
                    <option value="SOUND">Sound &amp; Lighting Equipment</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <ChevronDown className="select-chevron" size={16} />
                </div>
                {serviceCategory === 'OTHER' && (
                  <input
                    type="text"
                    required
                    maxLength={100}
                    className="listing-input"
                    placeholder="Type your service category"
                    value={customServiceCategory}
                    onChange={(e) => setCustomServiceCategory(e.target.value)}
                    style={{ marginTop: '8px' }}
                  />
                )}
              </div>
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
                <label className="listing-field-label">Service Cover Image (Optional)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="url"
                    className="listing-input"
                    placeholder="https://example.com/image.jpg or upload file"
                    value={serviceCoverUrl}
                    onChange={(e) => setServiceCoverUrl(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <label style={{ background: '#f1f5f9', color: '#0d8a73', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                    Upload File
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          const url = await ApiService.uploadImage(e.target.files[0]);
                          if (url) {
                            setServiceCoverUrl(url);
                            toast.success('Service image uploaded successfully!');
                          } else {
                            toast.error('Failed to upload image.');
                          }
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {portfolioSection}

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

            {/* Maximum Guests & Service Area */}
            <div className="listing-field-row-split">
              <div className="listing-field-group">
                <label className="listing-field-label">Maximum Guests Supported *</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="listing-input"
                  placeholder="Enter maximum guests"
                  value={serviceMaxGuests}
                  onChange={(e) => setServiceMaxGuests(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>

              <div className="listing-field-group">
                <label className="listing-field-label">Service Area *</label>
                <div className="listing-select-wrapper">
                  <select
                    required
                    className="listing-select"
                    value={serviceArea}
                    onChange={(e) => setServiceArea(e.target.value)}
                  >
                    <option value="">Select a service area</option>
                    <option value={nyeriCountyLocation}>{nyeriCountyLocation}</option>
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
                    required
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
                type="submit"
                disabled={isSubmitting}
                className="btn-listing-submit"
              >
                {isSubmitting ? (editingListing ? 'Saving...' : 'Submitting...') : (editingListing ? 'Save Changes' : 'Submit for Review')}
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
              <h2 className="listing-card-title">{editingListing ? 'Edit Venue Listing' : 'Add a Venue'}</h2>
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
                    required
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
                  onChange={(e) => setVenueCategory(e.target.value)}
                >
                  <option value="WEDDING">Wedding Gardens & Halls</option>
                  <option value="CONFERENCE">Conference & Corporate Centers</option>
                  <option value="BIRTHDAY">Birthday & Private Party Venues</option>
                  <option value="OUTDOOR">Outdoor & Picnic Grounds</option>
                  <option value="PARTY">Nightlife & Celebration Spaces</option>
                  <option value="EXHIBITION">Exhibition & Trade Halls</option>
                  <option value="OTHER">Other</option>
                </select>
                <ChevronDown className="select-chevron" size={16} />
              </div>
              {venueCategory === 'OTHER' && (
                <input
                  type="text"
                  required
                  maxLength={100}
                  className="listing-input"
                  placeholder="Type your venue category"
                  value={customVenueCategory}
                  onChange={(e) => setCustomVenueCategory(e.target.value)}
                  style={{ marginTop: '8px' }}
                />
              )}
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
                <select
                  required
                  className="listing-input"
                  value={venueLocation}
                  onChange={(e) => setVenueLocation(e.target.value)}
                >
                  <option value="">Select a venue location</option>
                  <option value={nyeriCountyLocation}>{nyeriCountyLocation}</option>
                </select>
              </div>
            </div>

            {/* Venue Cover Image URL */}
            <div className="listing-field-group">
              <label className="listing-field-label">Venue Cover Image (Optional)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="url"
                  className="listing-input"
                  placeholder="https://example.com/venue-photo.jpg or upload file"
                  value={venueCoverUrl}
                  onChange={(e) => setVenueCoverUrl(e.target.value)}
                  style={{ flex: 1 }}
                />
                <label style={{ background: '#f1f5f9', color: '#0d8a73', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                  Upload File
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const url = await ApiService.uploadImage(e.target.files[0]);
                        if (url) {
                          setVenueCoverUrl(url);
                          toast.success('Venue image uploaded successfully!');
                        } else {
                          toast.error('Failed to upload image.');
                        }
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {portfolioSection}

            {/* Maximum Guest Capacity & Available Spaces / Layout Details */}
            <div className="listing-field-row-split">
              <div className="listing-field-group">
                <label className="listing-field-label">Maximum Guest Capacity *</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="listing-input"
                  placeholder="Enter maximum guests"
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
                  required
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
                type="submit"
                disabled={isSubmitting}
                className="btn-listing-submit"
              >
                {isSubmitting ? (editingListing ? 'Saving...' : 'Submitting...') : (editingListing ? 'Save Changes' : 'Submit for Review')}
              </button>
            </div>
          </form>
        </div>
        )}

      </div>
    </div>
  );
};
