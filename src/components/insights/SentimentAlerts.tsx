import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SentimentAlert {
  id: string;
  meeting_id?: string;
  contact_id?: string;
  alert_type: 'negative_meeting' | 'declining_trend' | 'at_risk';
  severity: 'info' | 'warning' | 'critical';
  sentiment_score: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function SentimentAlerts() {
  const { user } = useUser();
  const [alerts, setAlerts] = useState<SentimentAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAlerts();
      // Subscribe to real-time updates
      const subscription = supabase
        .channel('sentiment_alerts')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sentiment_alerts',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadAlerts();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const loadAlerts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sentiment_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error loading sentiment alerts:', error);
      toast.error('Failed to load sentiment alerts');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('sentiment_alerts')
        .update({ is_read: true })
        .eq('id', alertId)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, is_read: true } : alert
      ));
    } catch (error) {
      console.error('Error marking alert as read:', error);
      toast.error('Failed to mark alert as read');
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('sentiment_alerts')
        .update({ is_read: true })
        .in('id', unreadIds)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setAlerts(prev => prev.map(alert => ({ ...alert, is_read: true })));
      toast.success('All alerts marked as read');
    } catch (error) {
      console.error('Error marking all alerts as read:', error);
      toast.error('Failed to mark all alerts as read');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Sentiment Alerts
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} new
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Notifications for negative sentiment patterns
            </CardDescription>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
            <CheckCircle2 className="w-12 h-12 mb-2 text-green-500" />
            <p>No sentiment alerts</p>
            <p className="text-sm mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)} ${
                  !alert.is_read ? 'ring-2 ring-offset-2 ring-opacity-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {alert.alert_type.replace('_', ' ')}
                          </Badge>
                          {!alert.is_read && (
                            <Badge variant="default" className="text-xs">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {alert.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Sentiment: {alert.sentiment_score.toFixed(2)} • {format(new Date(alert.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      {!alert.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(alert.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

