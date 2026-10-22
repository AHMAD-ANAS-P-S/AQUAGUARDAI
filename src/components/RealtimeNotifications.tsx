import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';
import { sanitizeAlertTitle, sanitizeAlertMessage } from '@/utils/sanitizeLocation';

export const RealtimeNotifications = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element for alert sound
    audioRef.current = new Audio('/alert-sound.mp3');
    audioRef.current.volume = 0.7;

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Subscribe to real-time alerts
    const channel = supabase
      .channel('alerts-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
          filter: 'severity=in.(critical,high)'
        },
        async (payload) => {
          console.log('New critical alert:', payload);
          
          const alert = payload.new;
          
          // Play sound
          try {
            await audioRef.current?.play();
          } catch (error) {
            console.error('Error playing alert sound:', error);
          }

          const cleanTitle = sanitizeAlertTitle(alert.title);
          const cleanMessage = sanitizeAlertMessage(alert.message);

          // Show browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Critical Water Quality Alert', {
              body: `${cleanTitle} - ${cleanMessage}`,
              icon: '/icon-192x192.png',
              badge: '/icon-192x192.png',
              tag: alert.id,
              requireInteraction: true,
            });
          }

          // Show toast notification
          toast({
            title: `${t('critical')} Alert`,
            description: `${cleanTitle}: ${cleanMessage}`,
            variant: 'destructive',
            duration: 10000,
          });

          // Send push notification if service worker is registered
          if ('serviceWorker' in navigator && 'PushManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            if ((registration as any).pushManager) {
              try {
                await registration.showNotification('Critical Water Quality Alert', {
                  body: `${cleanTitle} - ${cleanMessage}`,
                  icon: '/icon-192x192.png',
                  badge: '/icon-192x192.png',
                  tag: alert.id,
                  requireInteraction: true,
                  data: {
                    url: `/alerts?id=${alert.id}`
                  }
                });
              } catch (error) {
                console.error('Error showing push notification:', error);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, t]);

  return null;
};