import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  MapPin,
  Briefcase,
  Calendar,
  Search,
  CheckCircle,
  DollarSign,
  Users,
  Sparkles,
  Star,
  Camera,
  Utensils,
  Music,
  Palette,
  ImageOff
} from 'lucide-react';
import type { FilterState, Venue, VenueCategory, User } from '../types';
import { ApiService } from '../services/api';
import { cleanImageUrl } from '../utils/imageUtils';

export interface LandingPageProps {
  onSearch: (filters: FilterState) => void;
  filters: FilterState;
  onExploreVenues?: () => void;
  onExploreServices?: () => void;
  onSelectVenue?: (venue: Venue) => void;
  onBookVenue?: (venue: Venue) => void;
  currentUser?: User | null;
}

const CATEGORY_TAGS: { label: string; cat: VenueCategory; icon: React.ReactNode }[] = [
  { label: 'Wedding Halls', cat: 'WEDDING', icon: <Sparkles size={14} /> },
  { label: 'Conference Centers', cat: 'CONFERENCE', icon: <Users size={14} /> },
  { label: 'Photography', cat: 'PHOTOGRAPHY', icon: <Camera size={14} /> },
  { label: 'Catering Services', cat: 'CATERING', icon: <Utensils size={14} /> },
  { label: 'Event Decoration', cat: 'DECORATION', icon: <Palette size={14} /> },
  { label: 'Entertainment & DJ', cat: 'ENTERTAINMENT', icon: <Music size={14} /> },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onSearch,
  filters,
  onExploreVenues,
  onExploreServices,
  onSelectVenue,
  onBookVenue,
  currentUser,
}) => {
  const [spaces, setSpaces] = useState<Venue[]>([]);
  const [services, setServices] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    ApiService.getVenues()
      .then((allListings) => {
        if (!isMounted) return;

        // Physical venues
        const rawSpaces = allListings.filter(
          (item) => item.listing_type === 'VENUE' && Number(item.capacity) > 0
        );

        const seenSpaceTitles = new Set<string>();
        const uniqueSpaces = rawSpaces.filter((space) => {
          const key = space.title.toLowerCase().trim();

          if (seenSpaceTitles.has(key)) return false;

          seenSpaceTitles.add(key);
          return true;
        });

        // Actual service listings created through Create Listings
        const actualServices = allListings.filter(
          (item) => item.listing_type === 'SERVICE'
        );

        setSpaces(uniqueSpaces.slice(0, 6));
        setServices(actualServices.slice(0, 6));
      })
      .catch((err) => {
        console.error("Failed to load listings for landing page:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCategoryClick = (cat: VenueCategory) => {
    ApiService.trackInteraction({
      event_type: 'CATEGORY_INTEREST',
      category: cat,
      source: 'landing_quick_tag',
      user: currentUser?.id,
    });
    onSearch({
      ...filters,
      category: cat,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', minHeight: '100vh' }}>
      {/* 1. Hero Section */}
      <section style={{
        background: 'linear-gradient(to bottom, #e6f7f3, #ffffff)',
        padding: '32px 24px 64px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }}>
        {/* Quick Links Row */}
        <div style={{
          display: 'flex',
          gap: '14px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: '40px',
          width: '100%',
          maxWidth: '1200px'
        }}>
          {onExploreVenues && (
            <button
              onClick={onExploreVenues}
              style={{
                padding: '10px 22px',
                borderRadius: '999px',
                background: '#ffffff',
                color: '#0F8F7A',
                border: '1px solid #0F8F7A',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(15,143,122,0.1)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#0F8F7A'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#0F8F7A'; }}
            >
              <MapPin size={18} /> Explore Venues ({spaces.length > 0 ? `${spaces.length}+ Listed` : 'All'})
            </button>
          )}
          {onExploreServices && (
            <button
              onClick={onExploreServices}
              style={{
                padding: '10px 22px',
                borderRadius: '999px',
                background: '#ffffff',
                color: '#0F8F7A',
                border: '1px solid #0F8F7A',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(15,143,122,0.1)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#0F8F7A'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#0F8F7A'; }}
            >
              <Briefcase size={18} /> Event Services ({services.length > 0 ? `${services.length}+ Listed` : 'All'})
            </button>
          )}
        </div>

        <div style={{ maxWidth: '1200px', width: '100%', display: 'flex', flexWrap: 'wrap', gap: '48px', alignItems: 'center' }}>
          <div style={{ flex: '1 1 400px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: '#ffffff', padding: '6px 14px', borderRadius: '999px',
              fontSize: '0.85rem', fontWeight: 700, color: '#0F8F7A', marginBottom: '24px',
              border: '1px solid #c9ede4', boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
            }}>
              <CheckCircle size={14} /> Verified Event Spaces & Service Providers Across Nyeri County
            </div>

            <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, color: '#0f172a', lineHeight: 1.1, marginBottom: '24px' }}>
              Everything You Need <br />
              <span style={{ color: '#0F8F7A' }}>for Your Next Event</span>
            </h1>

            <p style={{ fontSize: '1.1rem', color: '#475569', lineHeight: 1.6, marginBottom: '28px', maxWidth: '520px' }}>
              Discover real event spaces, photographers, caterers, and decorators listed by local business providers — all in one unified platform.
            </p>

            {/* Category Quick Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {CATEGORY_TAGS.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCategoryClick(t.cat)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0F8F7A'; e.currentTarget.style.color = '#0F8F7A'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#334155'; }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center' }}>
            <img
              src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80"
              alt="Event Celebration"
              style={{ width: '100%', maxWidth: '520px', borderRadius: '24px', boxShadow: '0 24px 48px rgba(15, 143, 122, 0.15)', objectFit: 'cover' }}
            />
          </div>
        </div>
      </section>

      {/* 2. Featured Venues & Spaces Section */}
      <section style={{ padding: '80px 24px', background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F8F7A', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '6px' }}>
                <MapPin size={16} /> Physical Event Spaces
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>Featured Venues</h2>
              <p style={{ color: '#64748b', fontSize: '1.05rem', margin: 0 }}>Explore verified event halls, gardens, and conference centers.</p>
            </div>
            {onExploreVenues && (
              <button
                onClick={onExploreVenues}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0F8F7A',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px'
                }}
              >
                View All Venues <ArrowRight size={18} />
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading verified venues...</div>
            </div>
          ) : spaces.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '28px' }}>
              {spaces.map((venue) => (
                <div
                  key={venue.id}
                  onClick={() => onSelectVenue && onSelectVenue(venue)}
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: onSelectVenue ? 'pointer' : 'default',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.04)';
                  }}
                >
                  <div style={{
                    height: '210px',
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {cleanImageUrl(venue.image_url) ? (
                      <img
                        src={cleanImageUrl(venue.image_url)}
                        alt={venue.title}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#94a3b8'
                      }}>
                        <ImageOff size={32} />
                        <span style={{ fontSize: '0.8rem' }}>No image available</span>
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '6px' }}>
                      <span style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '999px' }}>
                        {venue.category_display || venue.category}
                      </span>
                      {venue.is_verified && (
                        <span style={{ background: '#16a34a', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> Verified
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                      {venue.title}
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.88rem', marginBottom: '14px' }}>
                      <MapPin size={15} color="#0F8F7A" /> {venue.location}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', marginBottom: '16px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857', fontWeight: 700 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                        <Users size={16} color="#0F8F7A" /> Capacity: {venue.capacity} guests
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: (venue.review_count || 0) > 0 ? '#d97706' : '#64748b', fontWeight: 700 }}>
                        <Star size={14} fill="#fbbf24" stroke="#d97706" /> {Number(venue.rating || 0).toFixed(1)} ({Number(venue.review_count || 0)} {Number(venue.review_count || 0) === 1 ? 'review' : 'reviews'})
                      </div>
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Daily Rental</span>
                        <span style={{ color: '#0F8F7A', fontWeight: 800, fontSize: '1.15rem' }}>
                          KES {Number(venue.price_per_day).toLocaleString()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectVenue) onSelectVenue(venue);
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            color: '#334155',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Details
                        </button>
                        {onBookVenue && (
                          <button
                            disabled={Number(venue.capacity) <= 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onBookVenue(venue);
                            }}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              background: '#0F8F7A',
                              border: 'none',
                              color: '#fff',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: Number(venue.capacity) > 0 ? 'pointer' : 'not-allowed',
                              opacity: Number(venue.capacity) > 0 ? 1 : 0.6
                            }}
                            title={Number(venue.capacity) > 0 ? 'Book this venue' : 'Provider must set a guest limit before this listing can be booked'}
                          >
                            {Number(venue.capacity) > 0 ? 'Book Space' : 'Capacity Needed'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              No event spaces listed yet.
            </div>
          )}
        </div>
      </section>

      {/* 3. Featured Services Section */}
      <section style={{ padding: '80px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F8F7A', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '6px' }}>
                <Sparkles size={16} /> Professional Event Services
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>Top Services & Packages</h2>
              <p style={{ color: '#64748b', fontSize: '1.05rem', margin: 0 }}>Hire verified photographers, caterers, decorators, and planners.</p>
            </div>
            {onExploreServices && (
              <button
                onClick={onExploreServices}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0F8F7A',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px'
                }}
              >
                View All Services <ArrowRight size={18} />
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading verified services...</div>
            </div>
          ) : services.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '28px' }}>
              {services.map((service) => {
                const coverImg = cleanImageUrl(service.image_url);

                return (
                  <div
                    key={service.id}
                    onClick={() => onSelectVenue && onSelectVenue(service)}
                    style={{
                      background: '#ffffff',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: onSelectVenue ? 'pointer' : 'default',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.04)';
                    }}
                  >
                    <div style={{
                      height: '210px',
                      position: 'relative',
                      overflow: 'hidden',
                      background: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {coverImg ? (
                        <img
                          src={coverImg}
                          alt={service.title}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '8px',
                          color: '#94a3b8'
                        }}>
                          <ImageOff size={32} />
                          <span style={{ fontSize: '0.8rem' }}>No image available</span>
                        </div>
                      )}

                      <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '6px' }}>
                        <span style={{ background: '#0F8F7A', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '999px' }}>
                          {service.category_display || service.category}
                        </span>

                        {service.is_verified && (
                          <span style={{ background: '#16a34a', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={12} /> Verified
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                        {service.title}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.88rem', marginBottom: '12px' }}>
                        <MapPin size={15} color="#0F8F7A" /> Location: {service.location}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: Number(service.capacity) > 0 ? '#047857' : '#b45309', fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>
                        <Users size={15} color={Number(service.capacity) > 0 ? '#0F8F7A' : '#b45309'} />
                        {Number(service.capacity) > 0 ? `Maximum guests: ${service.capacity}` : 'Guest limit not provided'}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', marginBottom: '16px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: 600 }}>
                          <Briefcase size={15} color="#0F8F7A" /> {service.category_display || service.category}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: (service.review_count || 0) > 0 ? '#d97706' : '#64748b', fontWeight: 700 }}>
                          <Star size={14} fill="#fbbf24" stroke="#d97706" />
                          {Number(service.rating || 0).toFixed(1)} ({Number(service.review_count || 0)} {Number(service.review_count || 0) === 1 ? 'review' : 'reviews'})
                        </div>
                      </div>

                      <p style={{
                        margin: '0 0 16px',
                        color: '#64748b',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {service.description}
                      </p>

                      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Starting Rate / Event</span>
                          <span style={{ color: '#0F8F7A', fontWeight: 800, fontSize: '1.15rem' }}>
                            KES {Number(service.price_per_day || 0).toLocaleString()}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectVenue) onSelectVenue(service);
                            }}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '8px',
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              color: '#334155',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Details
                          </button>

                          {onBookVenue && (
                            <button
                              disabled={Number(service.capacity) <= 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                onBookVenue(service);
                              }}
                              style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                background: '#0d8a73',
                                border: 'none',
                                color: '#fff',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: Number(service.capacity) > 0 ? 'pointer' : 'not-allowed',
                                opacity: Number(service.capacity) > 0 ? 1 : 0.6
                              }}
                              title={Number(service.capacity) > 0 ? 'Book this service' : 'Provider must set a guest limit before this listing can be booked'}
                            >
                              {Number(service.capacity) > 0 ? 'Book Service' : 'Capacity Needed'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              No event services listed yet.
            </div>
          )}
        </div>
      </section>

      {/* 4. Why Choose Platform Section */}
      <section style={{ padding: '80px 24px', background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '48px' }}>
            Why Plan & Book With Us?
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '32px' }}>
            <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e6f7f3', color: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <CheckCircle size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Verified Listings</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Every venue and service provider is screened to ensure dependable event execution.</p>
            </div>

            <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e6f7f3', color: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <Search size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Instant Discovery</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Find venues and packages by location, capacity, or budget with instant live previews.</p>
            </div>

            <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e6f7f3', color: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <DollarSign size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Direct Pricing</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Clear, transparent daily and event rates set directly by venue owners and providers.</p>
            </div>

            <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e6f7f3', color: '#0F8F7A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <Calendar size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Seamless Booking</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Send booking requests in seconds and manage communications from your dashboard.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};