import React, { useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { motion } from 'framer-motion';
// Import types lazily to avoid runtime circular dependency issues
import type { CalendarEvent, CalendarViewType } from '@/pages/Calendar';
import { CalendarEvent as CalendarEventComponent } from './CalendarEvent';

interface CalendarViewProps {
  view: CalendarViewType;
  events: CalendarEvent[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  onEventDrop: (eventId: string, newStart: Date, newEnd?: Date) => void;
}

// Color mapping for different event categories
const categoryColors = {
  meeting: '#059669', // emerald-600
  call: '#3b82f6', // blue-500
  task: '#f59e0b', // amber-500
  deal: '#8b5cf6', // violet-500
  personal: '#ec4899', // pink-500
  'follow-up': '#06b6d4', // cyan-500
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  view,
  events,
  selectedDate,
  onDateSelect,
  onEventClick,
  onDateClick,
  onEventDrop,
}) => {
  const calendarRef = useRef<FullCalendar>(null);

  // Debug logging
  console.log('CalendarView received events:', events?.length || 0, events);

  // Convert our events to FullCalendar format
  const fullCalendarEvents = events.map(event => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    backgroundColor: event.color || categoryColors[event.category] || categoryColors.meeting,
    borderColor: event.color || categoryColors[event.category] || categoryColors.meeting,
    textColor: '#ffffff',
    extendedProps: {
      category: event.category,
      description: event.description,
      attendees: event.attendees,
      location: event.location,
      priority: event.priority,
      originalEvent: event,
    },
    classNames: [
      'calendar-event',
      `calendar-event-${event.category}`,
      event.priority ? `priority-${event.priority}` : '',
    ].filter(Boolean),
  }));
  
  console.log('FullCalendar events formatted:', fullCalendarEvents.length, fullCalendarEvents.slice(0, 3));

  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(view);
    }
  }, [view]);

  const handleEventClick = (clickInfo: any) => {
    const originalEvent = clickInfo.event.extendedProps.originalEvent;
    if (originalEvent) {
      onEventClick(originalEvent);
    }
  };

  const handleDateClick = (dateClickInfo: any) => {
    onDateClick(new Date(dateClickInfo.date));
  };

  const handleEventDrop = (eventDropInfo: any) => {
    const eventId = eventDropInfo.event.id;
    const newStart = new Date(eventDropInfo.event.start);
    const newEnd = eventDropInfo.event.end ? new Date(eventDropInfo.event.end) : undefined;
    
    onEventDrop(eventId, newStart, newEnd);
  };

  const customEventContent = (eventInfo: any) => {
    return <CalendarEventComponent event={eventInfo.event.extendedProps.originalEvent} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="h-full p-4"
    >
      <style jsx global>{`
        /* FullCalendar Dark Theme Styles */
        .fc {
          background: transparent;
          color: #f3f4f6;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
        }

        .fc .fc-view-harness {
          background: rgba(17, 24, 39, 0.3);
          backdrop-filter: blur(8px);
          border-radius: 12px;
          border: 1px solid rgba(75, 85, 99, 0.3);
          overflow: hidden;
        }

        .fc-theme-standard .fc-scrollgrid {
          border: none;
        }

        .fc-theme-standard td,
        .fc-theme-standard th {
          border: 1px solid rgba(75, 85, 99, 0.2);
          background: transparent;
        }

        .fc-theme-standard .fc-scrollgrid-section-header td {
          background: rgba(31, 41, 55, 0.5);
          backdrop-filter: blur(4px);
        }

        .fc .fc-col-header-cell-cushion {
          color: #d1d5db;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }

        .fc .fc-daygrid-day-number {
          color: #9ca3af;
          font-weight: 500;
        }

        .fc .fc-daygrid-day.fc-day-today {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
          color: #10b981;
          font-weight: 700;
        }

        .fc .fc-daygrid-day:hover {
          background: rgba(75, 85, 99, 0.1);
          transition: background-color 0.2s ease;
          cursor: pointer;
        }

        .fc-event {
          border: none !important;
          border-radius: 6px !important;
          font-size: 0.75rem !important;
          font-weight: 500 !important;
          padding: 2px 6px !important;
          margin: 1px !important;
          backdrop-filter: blur(4px);
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .fc-event:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .fc-event.priority-high {
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.5);
        }

        .fc-event.priority-medium {
          box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.5);
        }

        .fc-event-title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fc .fc-button {
          background: rgba(31, 41, 55, 0.7);
          border: 1px solid rgba(75, 85, 99, 0.5);
          color: #d1d5db;
          border-radius: 8px;
          font-weight: 500;
          backdrop-filter: blur(4px);
          transition: all 0.2s ease;
        }

        .fc .fc-button:hover {
          background: rgba(75, 85, 99, 0.7);
          border-color: rgba(156, 163, 175, 0.5);
          color: #f3f4f6;
          transform: translateY(-1px);
        }

        .fc .fc-button:active,
        .fc .fc-button-active {
          background: #10b981 !important;
          border-color: #059669 !important;
          color: white !important;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }

        .fc .fc-toolbar {
          margin-bottom: 1rem;
        }

        .fc .fc-toolbar-title {
          color: #f3f4f6;
          font-weight: 700;
          font-size: 1.5rem;
          margin: 0 1rem;
        }

        .fc .fc-more-link {
          color: #10b981;
          font-weight: 500;
        }

        .fc .fc-more-link:hover {
          color: #059669;
        }

        /* Time grid styles */
        .fc-timegrid-slot {
          border-top: 1px solid rgba(75, 85, 99, 0.2);
        }

        .fc-timegrid-slot-label {
          color: #9ca3af;
          font-size: 0.75rem;
        }

        .fc .fc-timegrid-col.fc-day-today {
          background: rgba(16, 185, 129, 0.05);
        }

        .fc-timegrid-now-indicator-line {
          border-color: #10b981;
          border-width: 2px;
        }

        .fc-timegrid-now-indicator-arrow {
          border-top-color: #10b981;
          border-bottom-color: #10b981;
        }

        /* List view styles */
        .fc-list-table {
          background: transparent;
        }

        .fc-list-day-cushion {
          background: rgba(31, 41, 55, 0.5);
          color: #d1d5db;
          font-weight: 600;
        }

        .fc-list-event:hover td {
          background: rgba(75, 85, 99, 0.1);
        }

        .fc-list-event-title {
          color: #f3f4f6;
        }

        .fc-list-event-time {
          color: #9ca3af;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .fc .fc-toolbar {
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .fc .fc-toolbar-chunk {
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .fc .fc-button {
            padding: 0.25rem 0.5rem;
            font-size: 0.875rem;
          }
        }

        /* Animation for event transitions */
        .calendar-event {
          animation: fadeIn 0.3s ease-in-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={view}
        views={{
          dayGridMonth: {
            titleFormat: { year: 'numeric', month: 'long' }
          },
          timeGridWeek: {
            titleFormat: { month: 'short', day: 'numeric' },
            slotMinTime: '06:00:00',
            slotMaxTime: '22:00:00',
          },
          timeGridDay: {
            titleFormat: { weekday: 'long', month: 'long', day: 'numeric' },
            slotMinTime: '06:00:00',
            slotMaxTime: '22:00:00',
          },
          listWeek: {
            titleFormat: { month: 'long', year: 'numeric' }
          }
        }}
        headerToolbar={false}
        height="100%"
        events={fullCalendarEvents}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        eventDrop={handleEventDrop}
        eventResize={(resizeInfo) => {
          const eventId = resizeInfo.event.id;
          const startDate = resizeInfo.event.start;
          if (!startDate) return;
          const newStart = new Date(startDate);
          const newEnd = resizeInfo.event.end ? new Date(resizeInfo.event.end) : undefined;
          onEventDrop(eventId, newStart, newEnd);
        }}
        editable={true}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        weekends={true}
        nowIndicator={true}
        eventContent={view !== 'listWeek' ? customEventContent : undefined}
        dayHeaderFormat={{ weekday: 'short' }}
        eventDisplay="block"
        displayEventTime={true}
        displayEventEnd={false}
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short'
        }}
        slotLabelFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short'
        }}
        allDaySlot={true}
        allDayText="All day"
        slotEventOverlap={false}
        eventMaxStack={3}
        moreLinkClick="day"
        navLinks={true}
        businessHours={{
          startTime: '09:00',
          endTime: '17:00',
          daysOfWeek: [1, 2, 3, 4, 5]
        }}
        select={(selectInfo) => {
          onDateClick(new Date(selectInfo.start));
        }}
        eventMouseEnter={(mouseEnterInfo) => {
          mouseEnterInfo.el.style.zIndex = '1000';
        }}
        eventMouseLeave={(mouseLeaveInfo) => {
          mouseLeaveInfo.el.style.zIndex = 'auto';
        }}
      />
    </motion.div>
  );
};