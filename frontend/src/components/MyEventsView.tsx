import React, { useState, useEffect } from 'react';
import type { EventItem, EventServiceItem } from '../types';
import { ApiService } from '../services/api';
import {
  Calendar,
  MapPin,
  Users,
  Coins,
  Edit2,
  Trash2,
  ArrowRight,
  Plus,
  Search,
  ArrowLeft,
  Settings,
  FilePlus,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
} from 'lucide-react';
import { EventFormModal } from './EventFormModal';
import toast from 'react-hot-toast';

interface MyEventsViewProps {
  events: EventItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  currentUser?: any;
  onCreateEvent: (data: Partial<EventItem>) => Promise<boolean>;
  onUpdateEvent: (id: number, data: Partial<EventItem>) => Promise<boolean>;
  onDeleteEvent: (id: number) => Promise<boolean>;
  onNavigateTab?: (tab: string) => void;
}

export const MyEventsView: React.FC<MyEventsViewProps> = ({
  events,
  isLoading = false,
  error = null,
  onRetry,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onNavigateTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedDateFilter, setSelectedDateFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'date'>('newest');

  const [selectedEventDetails, setSelectedEventDetails] = useState<EventItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

  const confirmDeleteEvent = (eventToDelete: EventItem) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '240px' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
          Delete <strong>"{eventToDelete.name}"</strong>?
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          This will permanently remove the event and its saved services.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={() => toast.dismiss(t.id)}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              const ok = await onDeleteEvent(eventToDelete.id);
              if (ok) {
                if (selectedEventDetails?.id === eventToDelete.id) {
                  setSelectedEventDetails(null);
                }
              }
            }}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              background: '#ef4444',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    ), {
      duration: 6000,
      position: 'top-center',
      style: {
        background: '#ffffff',
        padding: '14px 18px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
      },
    });
  };

  const confirmDeleteService = (eventId: number, serviceToDelete: EventServiceItem) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '230px' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
          Remove <strong>"{serviceToDelete.name}"</strong>?
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={() => toast.dismiss(t.id)}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              setCustomServicesByEvent((prev) => ({
                ...prev,
                [eventId]: (prev[eventId] || []).filter((s) => s.id !== serviceToDelete.id),
              }));
              await ApiService.deleteEventService(serviceToDelete.id);
              toast.success(`Removed "${serviceToDelete.name}"`);
            }}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              background: '#ef4444',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Remove
          </button>
        </div>
      </div>
    ), {
      duration: 6000,
      position: 'top-center',
      style: {
        background: '#ffffff',
        padding: '14px 18px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
      },
    });
  };

  // Manual / Custom services state per event (keyed by event id)
  const [customServicesByEvent, setCustomServicesByEvent] = useState<Record<number, EventServiceItem[]>>({});
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [isSavingService, setIsSavingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('Photography');
  const [newServiceNotes, setNewServiceNotes] = useState('');
  const [newServiceCost, setNewServiceCost] = useState('');
  const [newServiceDueDate, setNewServiceDueDate] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'completed' | 'pending' | 'overdue'>('all');

  // Load services from event when selected or from API
  useEffect(() => {
    if (selectedEventDetails) {
      const evId = selectedEventDetails.id;
      if (selectedEventDetails.services && selectedEventDetails.services.length > 0) {
        setCustomServicesByEvent((prev) => ({ ...prev, [evId]: selectedEventDetails.services || [] }));
      } else {
        // Fetch from API
        ApiService.getEventServices(evId).then((services) => {
          if (services) {
            setCustomServicesByEvent((prev) => ({ ...prev, [evId]: services }));
          }
        });
      }
    }
  }, [selectedEventDetails?.id]);

  // Default images for event types
  const getEventImage = (event: EventItem) => {
    if (event.image_url) return event.image_url;
    const type = (event.event_type || '').toLowerCase();
    if (type.includes('grad')) {
      return 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&auto=format&fit=crop&q=80';
    }
    if (type.includes('birth')) {
      return 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=600&auto=format&fit=crop&q=80';
    }
    if (type.includes('meet') || type.includes('corp') || type.includes('conf')) {
      return 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=600&auto=format&fit=crop&q=80';
    }
    if (type.includes('wed')) {
      return 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&auto=format&fit=crop&q=80';
    }
    return 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=600&auto=format&fit=crop&q=80';
  };

  // Filter & sort logic
  const filteredEvents = events.filter((ev) => {
    const matchesSearch =
      ev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === 'All' || ev.event_type.toLowerCase() === selectedType.toLowerCase();

    return matchesSearch && matchesType;
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime();
    }
    if (sortBy === 'oldest') {
      return new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime();
    }
    if (sortBy === 'date') {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    return 0;
  });

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = Number(amount) || 0;
    return `KSh ${num.toLocaleString()}`;
  };

  // If viewing details of a specific event
  if (selectedEventDetails) {
    const ev = selectedEventDetails;
    return (
      <div style={{ padding: '24px 32px', maxWidth: '1240px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Top Back bar */}
        <button
          onClick={() => setSelectedEventDetails(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: '#0d8a73',
            fontWeight: 700,
            fontSize: '0.92rem',
            cursor: 'pointer',
            marginBottom: '20px',
            padding: 0,
          }}
        >
          <ArrowLeft size={18} /> Back to My Events
        </button>

        {/* Header Title with Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#e6f7f3',
              color: '#0d8a73',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Calendar size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {ev.name}
              </h1>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: ev.status === 'Completed' ? '#dcfce7' : ev.status === 'Planning' ? '#e0f2fe' : '#fce7f3',
                  color: ev.status === 'Completed' ? '#16a34a' : ev.status === 'Planning' ? '#0284c7' : '#db2777',
                }}
              >
                {ev.status || 'Upcoming'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
              {ev.description || 'A special celebration to mark a new chapter.'}
            </p>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
          {/* Left Column: Event details card, progress card, and checklist tasks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Event Details Card */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0d8a73', fontWeight: 700, fontSize: '1.05rem' }}>
                  <Calendar size={20} /> Event Details
                </div>
                <button
                  onClick={() => {
                    setEditingEvent(ev);
                    setIsModalOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: '#0d8a73',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  <Edit2 size={14} /> Edit Event
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px' }}>
                <img
                  src={getEventImage(ev)}
                  alt={ev.name}
                  style={{
                    width: '100%',
                    height: '210px',
                    borderRadius: '12px',
                    objectFit: 'cover',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#64748b', width: '130px', fontWeight: 600 }}>Event Name</span>
                    <span style={{ color: '#0f172a', fontWeight: 700 }}>{ev.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#64748b', width: '130px', fontWeight: 600 }}>Event Type</span>
                    <span style={{ color: '#0f172a' }}>{ev.event_type}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#64748b', width: '130px', fontWeight: 600 }}>Date</span>
                    <span style={{ color: '#0f172a' }}>{formatDateDisplay(ev.date)}</span>
                  </div>
                  {(ev.start_time || ev.end_time) && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <span style={{ color: '#64748b', width: '130px', fontWeight: 600 }}>Time</span>
                      <span style={{ color: '#0f172a' }}>
                        {ev.start_time || '--'} to {ev.end_time || '--'}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#64748b', width: '130px', fontWeight: 600 }}>Location</span>
                    <span style={{ color: '#0f172a' }}>{ev.location}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#64748b', width: '130px', fontWeight: 600 }}>Expected Guests</span>
                    <span style={{ color: '#0f172a' }}>{ev.expected_guest_count} guests</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#64748b', width: '130px', fontWeight: 600 }}>Estimated Budget</span>
                    <span style={{ color: '#0d8a73', fontWeight: 700 }}>{formatCurrency(ev.budget)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#64748b', width: '130px', fontWeight: 600 }}>Description</span>
                    <span style={{ color: '#475569', lineHeight: 1.5 }}>
                      {ev.description || 'No additional notes provided.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Checklist Progress Overview Card (Step 2 in Module 6) */}
            {(() => {
              const currentServices = customServicesByEvent[ev.id] || [];
              const totalItems = currentServices.length;
              const completedItems = currentServices.filter((s) => s.is_completed).length;
              const todayStr = new Date().toISOString().split('T')[0];
              const overdueItems = currentServices.filter(
                (s) => !s.is_completed && s.due_date && s.due_date < todayStr
              ).length;
              const pendingItems = totalItems - completedItems;
              const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

              return (
                <div
                  id="event-plan-checklist"
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        Checklist Progress
                      </h4>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0d8a73' }}>
                        {progressPercentage}%
                      </span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.86rem', marginBottom: '12px' }}>
                      {completedItems} of {totalItems} tasks completed
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '10px',
                        borderRadius: '999px',
                        background: '#e2e8f0',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${progressPercentage}%`,
                          height: '100%',
                          background: '#0d8a73',
                          borderRadius: '999px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* 3 Status Summary Chips */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: '#dcfce7',
                          color: '#16a34a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
                          Completed
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>
                          {completedItems}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                      }}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: '#fef3c7',
                          color: '#d97706',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Clock size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
                          Pending
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>
                          {pendingItems}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: overdueItems > 0 ? '#fef2f2' : '#f8fafc',
                        border: overdueItems > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0',
                      }}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: overdueItems > 0 ? '#fee2e2' : '#e2e8f0',
                          color: overdueItems > 0 ? '#dc2626' : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AlertCircle size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: overdueItems > 0 ? '#dc2626' : '#64748b', textTransform: 'uppercase' }}>
                          Overdue
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>
                          {overdueItems}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Event Checklist Tasks View (Step 3 & 7 in Module 6) */}
            {(() => {
              const currentServices = customServicesByEvent[ev.id] || [];
              const todayStr = new Date().toISOString().split('T')[0];

              const getTaskStatus = (svc: EventServiceItem): 'Completed' | 'Overdue' | 'Pending' => {
                if (svc.is_completed) return 'Completed';
                if (svc.due_date && svc.due_date < todayStr) return 'Overdue';
                return 'Pending';
              };

              const overdueCount = currentServices.filter((s) => !s.is_completed && s.due_date && s.due_date < todayStr).length;

              const filteredServices = currentServices.filter((svc) => {
                const status = getTaskStatus(svc);
                if (taskFilter === 'completed') return status === 'Completed';
                if (taskFilter === 'pending') return status === 'Pending';
                if (taskFilter === 'overdue') return status === 'Overdue';
                return true;
              });

              return (
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Overdue Banner Warning (Step 7) */}
                  {overdueCount > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 16px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '10px',
                        color: '#b91c1c',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        marginBottom: '20px',
                      }}
                    >
                      <AlertCircle size={18} />
                      <span>{overdueCount} {overdueCount === 1 ? 'task is' : 'tasks are'} overdue! Please review your schedule.</span>
                    </div>
                  )}

                  {/* Header with Title and Add Task button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                        Event Checklist
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b' }}>
                        See all tasks with due dates, status, and actions.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setNewServiceName('');
                        setNewServiceCategory('Photography');
                        setNewServiceNotes('');
                        setNewServiceCost('');
                        setNewServiceDueDate(ev.date || '');
                        setIsAddServiceModalOpen(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 18px',
                        borderRadius: '8px',
                        background: '#0d8a73',
                        border: 'none',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Plus size={16} strokeWidth={2.5} /> Add Task
                    </button>
                  </div>

                  {/* Filter Tabs: All, Completed, Pending, Overdue */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'all', label: `All (${currentServices.length})` },
                      { id: 'completed', label: `Completed (${currentServices.filter((s) => s.is_completed).length})` },
                      { id: 'pending', label: `Pending (${currentServices.filter((s) => !s.is_completed && (!s.due_date || s.due_date >= todayStr)).length})` },
                      { id: 'overdue', label: `Overdue (${overdueCount})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setTaskFilter(tab.id as any)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: taskFilter === tab.id ? '1.5px solid #0d8a73' : '1px solid #e2e8f0',
                          background: taskFilter === tab.id ? '#e6f7f3' : '#ffffff',
                          color: taskFilter === tab.id ? '#0d8a73' : '#64748b',
                          fontSize: '0.82rem',
                          fontWeight: taskFilter === tab.id ? 700 : 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tasks List */}
                  {filteredServices.length === 0 ? (
                    <div
                      style={{
                        border: '1px dashed #cbd5e1',
                        borderRadius: '14px',
                        padding: '40px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        background: '#f8fafc',
                      }}
                    >
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: '#e6f7f3',
                          color: '#0d8a73',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '12px',
                        }}
                      >
                        <FilePlus size={24} />
                      </div>
                      <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                        No tasks in this view
                      </div>
                      <p style={{ margin: '0 0 12px 0', fontSize: '0.84rem', color: '#64748b' }}>
                        {taskFilter === 'all'
                          ? 'Click "Add Task" above to start your checklist.'
                          : `No tasks currently marked as ${taskFilter}.`}
                      </p>
                      {onNavigateTab && (
                        <button
                          type="button"
                          onClick={() => onNavigateTab('vendors')}
                          style={{
                            background: 'none',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#0d8a73',
                            cursor: 'pointer',
                          }}
                        >
                          Explore Vendors & Services
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {filteredServices.map((svc) => {
                        const status = getTaskStatus(svc);
                        return (
                          <div
                            key={svc.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '14px 18px',
                              borderRadius: '12px',
                              border: '1px solid #e2e8f0',
                              background: status === 'Completed' ? '#f0fdf4' : status === 'Overdue' ? '#fef2f2' : '#ffffff',
                              transition: 'background 0.2s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <button
                                type="button"
                                onClick={async () => {
                                  const newStatus = !svc.is_completed;
                                  setCustomServicesByEvent((prev) => ({
                                    ...prev,
                                    [ev.id]: (prev[ev.id] || []).map((s) =>
                                      s.id === svc.id ? { ...s, is_completed: newStatus } : s
                                    ),
                                  }));
                                  await ApiService.updateEventService(svc.id, { is_completed: newStatus });
                                }}
                                title={svc.is_completed ? 'Reopen task' : 'Mark task complete'}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                  color: svc.is_completed ? '#16a34a' : status === 'Overdue' ? '#dc2626' : '#94a3b8',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <CheckCircle2 size={22} />
                              </button>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    style={{
                                      fontSize: '0.94rem',
                                      fontWeight: 700,
                                      color: '#0f172a',
                                      textDecoration: svc.is_completed ? 'line-through' : 'none',
                                    }}
                                  >
                                    {svc.name}
                                  </span>
                                  {svc.category && (
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        background: '#f1f5f9',
                                        color: '#475569',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      {svc.category}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                                  {svc.due_date && (
                                    <span style={{ fontSize: '0.78rem', color: status === 'Overdue' ? '#dc2626' : '#64748b', fontWeight: status === 'Overdue' ? 700 : 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <Clock size={12} /> Due: {formatDateDisplay(svc.due_date)}
                                    </span>
                                  )}
                                  {svc.notes && (
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                      {svc.notes}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              {/* Status Badge */}
                              <span
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  background: status === 'Completed' ? '#dcfce7' : status === 'Overdue' ? '#fee2e2' : '#fef3c7',
                                  color: status === 'Completed' ? '#16a34a' : status === 'Overdue' ? '#dc2626' : '#d97706',
                                }}
                              >
                                {status}
                              </span>

                              <button
                                type="button"
                                onClick={() => confirmDeleteService(ev.id, svc)}
                                title="Delete task"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.color = '#ef4444';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.color = '#94a3b8';
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Right Column: Actions & Quick Add Services */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Event Actions Card */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 14px 0' }}>
                Event Actions
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={() => {
                    const el = document.getElementById('event-plan-checklist');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '8px',
                    background: '#e6f7f3',
                    border: '1.5px solid #0d8a73',
                    color: '#0d8a73',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle2 size={16} /> View Event Checklist
                </button>
                <button
                  onClick={() => {
                    setEditingEvent(ev);
                    setIsModalOpen(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '8px',
                    background: '#0d8a73',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <Edit2 size={16} /> Edit Event
                </button>
                <button
                  onClick={() => confirmDeleteEvent(ev)}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '8px',
                    background: '#fff',
                    border: '1px solid #fee2e2',
                    color: '#ef4444',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <Trash2 size={16} /> Delete Event
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Modal */}
        <EventFormModal
          isOpen={isModalOpen}
          initialEvent={editingEvent}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEvent(null);
          }}
          onSubmit={async (data) => {
            if (editingEvent) {
              const ok = await onUpdateEvent(editingEvent.id, data);
              if (ok) {
                setSelectedEventDetails((prev) => (prev ? { ...prev, ...data } : null));
              }
              return ok;
            }
            return false;
          }}
        />

        {/* Add Service Manually Modal */}
        {isAddServiceModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1050,
              padding: '16px',
            }}
            onClick={() => setIsAddServiceModalOpen(false)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '460px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                overflow: 'hidden',
                animation: 'modalSlideUp 0.2s ease-out',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '18px 24px',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: '#e6f7f3',
                      color: '#0d8a73',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Settings size={18} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Add New Task
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddServiceModalOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newServiceName.trim() || isSavingService) return;
                  setIsSavingService(true);
                  try {
                    const payload = {
                      event: ev.id,
                      name: newServiceName.trim(),
                      category: newServiceCategory,
                      notes: newServiceNotes.trim(),
                      estimated_cost: newServiceCost ? Number(newServiceCost) : null,
                      due_date: newServiceDueDate ? newServiceDueDate : null,
                      is_completed: false,
                    };
                    const res = await ApiService.createEventService(payload);
                    if (res.success && res.data) {
                      setCustomServicesByEvent((prev) => ({
                        ...prev,
                        [ev.id]: [...(prev[ev.id] || []), res.data!],
                      }));
                      setIsAddServiceModalOpen(false);
                    } else {
                      // Fallback with optimistic update
                      const localItem: EventServiceItem = {
                        id: `local_${Date.now()}`,
                        event: ev.id,
                        name: newServiceName.trim(),
                        category: newServiceCategory,
                        notes: newServiceNotes.trim(),
                        estimated_cost: newServiceCost ? Number(newServiceCost) : null,
                        due_date: newServiceDueDate ? newServiceDueDate : null,
                        is_completed: false,
                      };
                      setCustomServicesByEvent((prev) => ({
                        ...prev,
                        [ev.id]: [...(prev[ev.id] || []), localItem],
                      }));
                      setIsAddServiceModalOpen(false);
                    }
                  } catch (err) {
                    console.error('Error saving manual service:', err);
                  } finally {
                    setIsSavingService(false);
                  }
                }}
                style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Book the venue, Confirm photographer"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Due Date *
                    </label>
                    <input
                      type="date"
                      value={newServiceDueDate}
                      onChange={(e) => setNewServiceDueDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.88rem',
                        boxSizing: 'border-box',
                        background: '#fff',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Category
                    </label>
                    <select
                      value={newServiceCategory}
                      onChange={(e) => setNewServiceCategory(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.88rem',
                        boxSizing: 'border-box',
                        background: '#fff',
                        outline: 'none',
                      }}
                    >
                      <option value="Venue">Venue</option>
                      <option value="Photography">Photography</option>
                      <option value="Catering">Catering</option>
                      <option value="Decoration">Decoration</option>
                      <option value="Entertainment">Entertainment / DJ</option>
                      <option value="MC Services">MC Services</option>
                      <option value="Transport">Transport</option>
                      <option value="Security">Security</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Description (optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Add more details about this task..."
                    value={newServiceNotes}
                    onChange={(e) => setNewServiceNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsAddServiceModalOpen(false)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#475569',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingService}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isSavingService ? '#94a3b8' : '#0d8a73',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: isSavingService ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isSavingService ? 'Adding...' : 'Add Service'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main Event List View (matches Screenshot 1)
  return (
    <div style={{ padding: '24px 32px', maxWidth: '1240px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Banner Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            My Events
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>
            Create and manage your events in one place.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingEvent(null);
            setIsModalOpen(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            borderRadius: '10px',
            background: '#0d8a73',
            border: 'none',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.92rem',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(13, 138, 115, 0.25)',
          }}
        >
          <Plus size={18} /> Create Event
        </button>
      </div>

      {/* Filter / Search Bar Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 180px 180px 180px',
          gap: '12px',
          marginBottom: '28px',
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '10px 14px',
          }}
        >
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search your events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              width: '100%',
              fontSize: '0.9rem',
              color: '#0f172a',
            }}
          />
        </div>

        {/* Event Type */}
        <div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '0.88rem',
              color: '#334155',
              outline: 'none',
            }}
          >
            <option value="All">All Types</option>
            <option value="Graduation">Graduation</option>
            <option value="Birthday">Birthday</option>
            <option value="Wedding">Wedding</option>
            <option value="Corporate / Meeting">Corporate / Meeting</option>
            <option value="Anniversary">Anniversary</option>
            <option value="Conference">Conference</option>
          </select>
        </div>

        {/* Date Filter */}
        <div>
          <select
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '0.88rem',
              color: '#334155',
              outline: 'none',
            }}
          >
            <option value="All">All Dates</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
        </div>

        {/* Sort By */}
        <div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '0.88rem',
              color: '#334155',
              outline: 'none',
            }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="date">Event Date</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: '3px solid #e2e8f0',
              borderTopColor: '#0d8a73',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite',
            }}
          />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
            Loading your events...
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
            Fetching your saved celebrations from LOCYFY.
          </p>
        </div>
      ) : error ? (
        /* Error State */
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #fee2e2',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: '#fef2f2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <X size={26} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#991b1b', margin: '0 0 6px 0' }}>
            Unable to Load Events
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 18px' }}>
            {error}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                background: '#0d8a73',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          )}
        </div>
      ) : filteredEvents.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {filteredEvents.map((ev) => (
            <div
              key={ev.id}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                display: 'grid',
                gridTemplateColumns: '220px 1fr 180px',
                gap: '24px',
                alignItems: 'center',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
            >
              {/* Event Image */}
              <img
                src={getEventImage(ev)}
                alt={ev.name}
                style={{
                  width: '100%',
                  height: '140px',
                  borderRadius: '12px',
                  objectFit: 'cover',
                }}
              />

              {/* Event Body Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {ev.name}
                  </h3>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: ev.status === 'Completed' ? '#dcfce7' : ev.status === 'Planning' ? '#e0f2fe' : '#fce7f3',
                      color: ev.status === 'Completed' ? '#16a34a' : ev.status === 'Planning' ? '#0284c7' : '#db2777',
                    }}
                  >
                    {ev.status || 'Upcoming'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.85rem' }}>
                  <Calendar size={14} color="#0d8a73" />
                  <span>{formatDateDisplay(ev.date)}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.85rem' }}>
                  <MapPin size={14} color="#0d8a73" />
                  <span>{ev.location}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.85rem' }}>
                  <Users size={14} color="#0d8a73" />
                  <span>{ev.expected_guest_count} guests</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0d8a73', fontSize: '0.88rem', fontWeight: 700 }}>
                  <Coins size={14} />
                  <span>{formatCurrency(ev.budget)}</span>
                </div>

                {ev.description && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>
                    {ev.description}
                  </p>
                )}
              </div>

              {/* Action Buttons Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => setSelectedEventDetails(ev)}
                  style={{
                    width: '100%',
                    padding: '9px',
                    borderRadius: '8px',
                    background: '#0d8a73',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  View Details <ArrowRight size={15} />
                </button>

                <button
                  onClick={() => {
                    setEditingEvent(ev);
                    setIsModalOpen(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Edit2 size={14} /> Edit
                </button>

                <button
                  onClick={() => confirmDeleteEvent(ev)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #fee2e2',
                    color: '#ef4444',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#e6f7f3',
              color: '#0d8a73',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Calendar size={28} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
            No Events Found
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '380px', margin: '0 auto 20px' }}>
            {searchQuery || selectedType !== 'All'
              ? 'No events match your search criteria. Try adjusting your filters.'
              : 'You have not created any events yet. Click below to start planning your first event.'}
          </p>
          <button
            onClick={() => {
              setEditingEvent(null);
              setIsModalOpen(true);
            }}
            style={{
              padding: '10px 22px',
              borderRadius: '10px',
              background: '#0d8a73',
              border: 'none',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Plus size={16} /> Create Your First Event
          </button>
        </div>
      )}

      {/* Modal for Creating or Editing */}
      <EventFormModal
        isOpen={isModalOpen}
        initialEvent={editingEvent}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEvent(null);
        }}
        onSubmit={async (data) => {
          if (editingEvent) {
            return await onUpdateEvent(editingEvent.id, data);
          } else {
            return await onCreateEvent(data);
          }
        }}
      />
    </div>
  );
};
