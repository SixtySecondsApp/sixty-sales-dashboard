import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/clientV2';
import { 
  Database, 
  RefreshCw, 
  Calendar,
  Clock,
  MapPin,
  Users,
  Link,
  ChevronDown,
  ChevronRight,
  Loader2
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  external_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  status: string;
  meeting_url: string | null;
  attendees_count: number;
  creator_email: string | null;
  organizer_email: string | null;
  sync_status: string;
  created_at: string;
  updated_at: string;
}

export function CalendarDatabaseViewer() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setError('Not authenticated');
        return;
      }

      // Fetch events directly from database
      const { data, error: fetchError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('start_time', { ascending: true })
        .limit(50);

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setEvents(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const toggleEvent = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-green-400';
      case 'tentative': return 'text-yellow-400';
      case 'cancelled': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <Card className="p-6 bg-gray-800 border-gray-700">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-400" />
              Database Events Viewer
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Direct view of calendar_events table ({events.length} events)
            </p>
          </div>
          <Button
            onClick={fetchEvents}
            disabled={isLoading}
            className="bg-purple-500 hover:bg-purple-600"
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {events.length === 0 && !isLoading && !error && (
          <div className="text-center py-8 text-gray-400">
            <Database className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p>No events found in database</p>
            <p className="text-sm mt-2">Run the sync test to populate events</p>
          </div>
        )}

        {events.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.map((event) => (
              <div 
                key={event.id}
                className="border border-gray-700 rounded-lg bg-gray-900 overflow-hidden"
              >
                <div 
                  className="p-3 cursor-pointer hover:bg-gray-800/50"
                  onClick={() => toggleEvent(event.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-gray-500 mt-1">
                      {expandedEvents.has(event.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-200">
                            {event.title}
                          </h4>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(event.start_time)}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {event.location.substring(0, 30)}
                              </span>
                            )}
                            {event.attendees_count > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {event.attendees_count}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${getStatusColor(event.status)}`}>
                            {event.status}
                          </span>
                          {event.meeting_url && (
                            <Link className="w-3 h-3 text-blue-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {expandedEvents.has(event.id) && (
                  <div className="border-t border-gray-700 p-3 bg-gray-950 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-gray-400">
                      <div>
                        <span className="text-gray-500">ID:</span> {event.id.substring(0, 8)}...
                      </div>
                      <div>
                        <span className="text-gray-500">External ID:</span> {event.external_id?.substring(0, 15)}...
                      </div>
                      <div>
                        <span className="text-gray-500">Start:</span> {new Date(event.start_time).toLocaleString()}
                      </div>
                      <div>
                        <span className="text-gray-500">End:</span> {new Date(event.end_time).toLocaleString()}
                      </div>
                      <div>
                        <span className="text-gray-500">All Day:</span> {event.all_day ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <span className="text-gray-500">Sync Status:</span> {event.sync_status}
                      </div>
                      {event.creator_email && (
                        <div>
                          <span className="text-gray-500">Creator:</span> {event.creator_email}
                        </div>
                      )}
                      {event.organizer_email && (
                        <div>
                          <span className="text-gray-500">Organizer:</span> {event.organizer_email}
                        </div>
                      )}
                    </div>
                    {event.description && (
                      <div className="mt-2 pt-2 border-t border-gray-800">
                        <span className="text-gray-500">Description:</span>
                        <p className="mt-1 text-gray-400">{event.description.substring(0, 200)}</p>
                      </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-gray-800 text-gray-500">
                      Created: {new Date(event.created_at).toLocaleString()} | 
                      Updated: {new Date(event.updated_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}