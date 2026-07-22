import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Push notification service worker registration & alert watcher
export const PushNotificationService = () => {
  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator && 'Notification' in window) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silent fail — SW may not be configured yet
      });
    }

    // Request notification permission
    const requestPermission = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    };
    requestPermission();

    // Watch for critical alerts in real-time
    const channel = supabase
      .channel('push_notifications_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          const alert = payload.new as any;
          if (alert.severity === 'critical' || alert.severity === 'high') {
            // Browser push notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('🚨 AquaGuard ALERT', {
                body: `${alert.title} — ${(alert.severity || 'low').toUpperCase()} severity detected`,
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                tag: 'aquaguard-alert',
              });
            }

            // Toast notification
            toast.error(`🚨 ${alert.title}`, {
              description: alert.message?.slice(0, 100),
              duration: 10000,
              action: {
                label: 'View Alerts',
                onClick: () => window.location.href = '/alerts'
              }
            });

            // Play alert sound
            try {
              const audio = new Audio('/alert-sound.mp3');
              audio.volume = 0.5;
              audio.play().catch(() => {});
            } catch {}
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'water_quality_readings' },
        (payload) => {
          const reading = payload.new as any;
          if (reading.status === 'critical') {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('⚠️ Critical Water Quality Detected', {
                body: `Sensor ${reading.sensor_id}: Critical water quality — pH ${reading.ph?.toFixed(1)}, TDS ${reading.tds}`,
                icon: '/icon-192x192.png',
                tag: 'aquaguard-water',
              });
            }
            toast.warning(`⚠️ Critical Water Quality Alert`, {
              description: `Sensor ${reading.sensor_id || 'Unknown'} detected unsafe water levels`,
              duration: 8000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
};
