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

  // Force FullCalendar to respect container bounds
  useEffect(() => {
    const fixCalendarWidth = () => {
      const elements = document.querySelectorAll('.fc-scrollgrid-sync-inner');
      elements.forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.minWidth = '0';
          el.style.width = '100%';
        }
      });
    };

    // Initial fix
    fixCalendarWidth();

    // Fix on window resize
    window.addEventListener('resize', fixCalendarWidth);

    // Use MutationObserver to fix any dynamic changes
    const observer = new MutationObserver(fixCalendarWidth);
    const calendarEl = document.querySelector('.fc');
    if (calendarEl) {
      observer.observe(calendarEl, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
      });
    }

    return () => {
      window.removeEventListener('resize', fixCalendarWidth);
      observer.disconnect();
    };
  }, [view, events]);

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

  // Temporarily disable custom event content to fix the error
  // const customEventContent = (eventInfo: any) => {
  //   return <CalendarEventComponent event={eventInfo.event.extendedProps.originalEvent} />;
  // };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="h-full w-full p-4 overflow-hidden"
      style={{ 
        isolation: 'isolate',
        maxWidth: '100%',
        position: 'relative'
      }}
    >
      <style>{`
        /* Aggressive Reset of FullCalendar inline styles */
        .fc-scrollgrid-sync-inner {
          min-width: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          flex-shrink: 1 !important;
        }
        
        /* Ensure FullCalendar container doesn't expand */
        .fc-view-harness-active {
          width: 100% !important;
          max-width: 100% !important;
          overflow: hidden !important;
        }
        
        .fc-daygrid-body,
        .fc-scrollgrid-sync-table,
        .fc-col-header,
        .fc-daygrid-body-unbalanced,
        .fc-daygrid-body-natural {
          min-width: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        
        /* Override any inline styles */
        .fc [style*="min-width"] {
          min-width: 0 !important;
        }
        
        /* Target the specific structure causing overflow */
        .fc-scrollgrid-section > table,
        .fc-scrollgrid-section > div > table {
          min-width: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        
        /* Prevent horizontal scrolling */
        .fc-scroller {
          overflow-x: hidden !important;
          overflow-y: auto !important;
        }
        
        .fc-scroller-liquid,
        .fc-scroller-liquid-absolute {
          overflow-x: hidden !important;
        }
        
        /* FullCalendar Dark Theme Styles - Aggressive Containment */
        .fc {
          background: transparent;
          color: #f3f4f6;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
          width: 100% !important;
          max-width: 100% !important;
          overflow: hidden !important;
          position: relative !important;
          box-sizing: border-box !important;
        }
        
        .fc-media-screen {
          width: 100% !important;
          max-width: 100% !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        }
        
        /* Prevent any element from stretching beyond viewport */
        .fc * {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        .fc .fc-view-harness {
          background: rgba(17, 24, 39, 0.3);
          backdrop-filter: blur(8px);
          border-radius: 12px;
          border: 1px solid rgba(75, 85, 99, 0.3);
          overflow: hidden;
          width: 100% !important;
          max-width: 100% !important;
        }
        
        .fc-scrollgrid {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
        }
        
        .fc-scrollgrid-sync-table {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
        }
        
        .fc-daygrid-body {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
        }
        
        .fc-scrollgrid-section > * {
          width: 100% !important;
          max-width: 100% !important;
        }
        
        .fc table {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
        }
        
        /* Force day cells to have equal width */
        .fc-daygrid-day {
          width: calc(100% / 7) !important;
          max-width: calc(100% / 7) !important;
          min-width: 0 !important;
          overflow: hidden !important;
          position: relative !important;
        }
        
        /* Constrain day cell content */
        .fc-daygrid-day-events {
          min-width: 0 !important;
          max-width: 100% !important;
          overflow: hidden !important;
        }
        
        .fc-daygrid-day-frame {
          width: 100% !important;
          max-width: 100% !important;
          overflow: hidden !important;
        }
        
        .fc-col-header-cell {
          width: calc(100% / 7) !important;
          max-width: calc(100% / 7) !important;
        }
        
        /* Prevent content from expanding cells */
        .fc-daygrid-event-harness {
          overflow: hidden !important;
        }
        
        .fc-daygrid-more-link {
          max-width: 100% !important;
          overflow: hidden !important;
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
          max-width: 100% !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
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
        /* Viewport height constraints for calendar grid */
        .fc-daygrid {
          height: 100% !important;
        }
        
        .fc-daygrid-body {
          height: 100% !important;
        }
        
        /* Make week rows distribute evenly */
        .fc-daygrid-week {
          min-height: 0 !important;
          flex: 1 1 0 !important;
        }
        
        .fc-daygrid-day-frame {
          min-height: 0 !important;
          height: 100% !important;
        }
        
        /* Compact event display */
        .fc-daygrid-event {
          font-size: 0.75rem !important;
          line-height: 1.2 !important;
          padding: 1px 2px !important;
          margin: 1px 0 !important;
        }
        
        .fc-daygrid-event-harness {
          margin: 0 1px !important;
        }
        
        /* More link styling */
        .fc-daygrid-more-link {
          font-size: 0.7rem !important;
          padding: 0 2px !important;
          margin-top: 1px !important;
        }
        
        /* Hide event time in month view for space */
        .fc-daygrid-event-time {
          display: none !important;
        }
        
        /* Limit day cell height */
        .fc-daygrid-day {
          max-height: calc((100vh - 350px) / 6) !important;
          overflow: hidden !important;
        }
        
        .fc-daygrid-day-events {
          max-height: calc((100vh - 400px) / 6) !important;
          overflow: hidden !important;
        }
        
        /* Ensure scrollgrid fills container */
        .fc-scrollgrid {
          height: 100% !important;
        }
        
        .fc-scrollgrid-section-body > td {
          height: 100% !important;
        }
      `}</style>

      <div className="h-full w-full relative overflow-hidden" 
        style={{ 
          contain: 'layout', 
          minWidth: 0, 
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div className="flex-1 relative overflow-hidden" 
          style={{ 
            minWidth: 0, 
            maxWidth: '100%',
            height: '100%'
          }}
        >
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={view}
        views={{
          dayGridMonth: {
            titleFormat: { year: 'numeric', month: 'long' },
            fixedWeekCount: false
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
        contentHeight="100%"
        expandRows={false}
        stickyHeaderDates={false}
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
        dayMaxEvents={2}
        dayMaxEventRows={2}
        weekends={true}
        nowIndicator={true}
        // eventContent={view !== 'listWeek' ? customEventContent : undefined}
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
        </div>
      </div>
    </motion.div>
  );
};