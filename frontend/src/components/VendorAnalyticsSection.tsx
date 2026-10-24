import React, { useState, useEffect } from 'react';
import type { VendorAnalyticsData, Vendor } from '../types';
import { ApiService } from '../services/api';
import { TrendLineChart, PeakDaysBarChart } from './AnalyticsCharts';
import { Eye, MousePointerClick, CalendarCheck, CheckCircle2, XCircle, RefreshCw, Download, Clock, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';

interface VendorAnalyticsSectionProps {
  currentVendor: Vendor;
}

export const VendorAnalyticsSection: React.FC<VendorAnalyticsSectionProps> = ({ currentVendor }) => {
  const [data, setData] = useState<VendorAnalyticsData | null>(null);
  const [preset, setPreset] = useState<string>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('ALL');

  const fetchAnalytics = async (p = preset, s = customStart, e = customEnd) => {
    setLoading(true);
    try {
      const res = await ApiService.getVendorAnalytics(currentVendor.id, {
        preset: p,
        start_date: s || undefined,
        end_date: e || undefined,
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load vendor analytics', err);
      toast.error('Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(preset, customStart, customEnd);
  }, [preset]);

  // Filter service performance if a specific service is selected
  const displayedServices = data?.service_performance.filter((s) => {
    if (selectedServiceId === 'ALL') return true;
    return s.id.toString() === selectedServiceId;
  }) || [];

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Top Filter and Actions Bar */}
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px 24px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: '#ecfdf5', color: '#0d8a73' }}>
              <BarChart3 size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Service Engagement & Demand Analytics</h2>
              <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                Track real customer views, clicks, and reservation demand for {currentVendor.business_name}.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Preset buttons */}
          <div style={{ display: 'flex', background: '#f8fafc', padding: '3px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            {[
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
              { id: '90d', label: '90D' },
              { id: 'all', label: 'All' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPreset(p.id);
                  setCustomStart('');
                  setCustomEnd('');
                  fetchAnalytics(p.id, '', '');
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: preset === p.id && !customStart ? '#0d8a73' : 'transparent',
                  color: preset === p.id && !customStart ? '#ffffff' : '#64748b',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
            />
            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>-</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
            />
            <button
              onClick={() => {
                if (customStart && customEnd) {
                  setPreset('custom');
                  fetchAnalytics('custom', customStart, customEnd);
                } else {
                  toast.error('Please choose both start and end dates.');
                }
              }}
              style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', background: '#334155', color: '#fff', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              Filter
            </button>
          </div>

          {/* CSV Export */}
          <a
            href={ApiService.getVendorAnalyticsExportUrl(currentVendor.id, {
              preset,
              start_date: customStart || undefined,
              end_date: customEnd || undefined,
            })}
            download
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#0d8a73',
              fontSize: '0.78rem',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <Download size={14} /> Export CSV
          </a>

          <button
            onClick={() => fetchAnalytics(preset, customStart, customEnd)}
            disabled={loading}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: 'none',
              background: '#0d8a73',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Verified Notice Banner */}
      {data && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '6px 12px', fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>
          <Clock size={14} /> Period: <strong>{data.date_range.label} ({data.date_range.start} to {data.date_range.end})</strong>
        </div>
      )}

      {/* SUMMARY STAT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Service Views</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: '#ecfdf5', color: '#0d8a73' }}><Eye size={16} /></div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{data?.summary.service_views?.toLocaleString() || 0}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Unique viewers: {data?.summary.unique_viewers || 0}</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Catalog Clicks</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb' }}><MousePointerClick size={16} /></div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{data?.summary.service_clicks?.toLocaleString() || 0}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Search & grid selection clicks</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Booking Requests</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: '#f5f3ff', color: '#7c3aed' }}><CalendarCheck size={16} /></div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7c3aed' }}>{data?.summary.booking_requests?.toLocaleString() || 0}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Inquiries & reservation bids</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Confirmed Bookings</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a' }}><CheckCircle2 size={16} /></div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a' }}>{data?.summary.confirmed_bookings?.toLocaleString() || 0}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Completed: {data?.summary.completed_bookings || 0}</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Conversion Rate</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: '#fffbeb', color: '#d97706' }}><BarChart3 size={16} /></div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706' }}>{data?.summary.conversion_rate || 0}%</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Views converting to requests</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cancellation Rate</span>
            <div style={{ padding: '6px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626' }}><XCircle size={16} /></div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#dc2626' }}>{data?.summary.cancellation_rate || 0}%</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Cancelled: {data?.summary.cancelled_bookings || 0}</div>
        </div>
      </div>

      {/* TRENDS OVER TIME */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 16px' }}>Views & Clicks Over Time</h3>
          {data && (
            <TrendLineChart
              data={data.trends}
              series={[
                { key: 'views', label: 'Service Views', color: '#0d8a73' },
                { key: 'clicks', label: 'Listing Clicks', color: '#2563eb' },
              ]}
            />
          )}
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 16px' }}>Booking Requests Over Time</h3>
          {data && (
            <TrendLineChart
              data={data.trends}
              series={[
                { key: 'booking_requests', label: 'Requests Received', color: '#7c3aed' },
                { key: 'confirmed_bookings', label: 'Confirmed', color: '#16a34a' },
              ]}
            />
          )}
        </div>
      </div>

      {/* SERVICE LEVEL INSPECTION & PEAK DAYS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Service-Level Performance</h3>
            {data && data.service_performance.length > 1 && (
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
              >
                <option value="ALL">All Services</option>
                {data.service_performance.map((s) => (
                  <option key={s.id} value={s.id.toString()}>{s.title}</option>
                ))}
              </select>
            )}
          </div>

          {displayedServices.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '8px 10px' }}>Service Name</th>
                  <th style={{ padding: '8px 10px' }}>Category</th>
                  <th style={{ padding: '8px 10px' }}>Views</th>
                  <th style={{ padding: '8px 10px' }}>Requests</th>
                  <th style={{ padding: '8px 10px' }}>Conversion</th>
                </tr>
              </thead>
              <tbody>
                {displayedServices.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1e293b' }}>{s.title}</td>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{s.category}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0d8a73' }}>{s.views.toLocaleString()}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#7c3aed' }}>{s.requests}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#d97706' }}>{s.conversion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '0.88rem', padding: '16px 0' }}>
              Analytics will appear as customers interact with your listings.
            </div>
          )}
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 6px' }}>Peak Days for Booking Requests</h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.78rem', color: '#64748b' }}>Identifies days of the week when clients most actively request your services.</p>
          {data && <PeakDaysBarChart peakDays={data.peak_days} />}
        </div>
      </div>
    </div>
  );
};
