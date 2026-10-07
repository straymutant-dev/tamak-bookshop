// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/ToastContext';

/** Pops up a small message the moment a new notification arrives for you. Renders nothing. */
export default function NotificationToasts() {
  const { showToast } = useToast();
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const userId = data.user.id;
      channel = supabase
        .channel(`notification-toasts-${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const n = payload.new as { title?: string };
            toastRef.current(n.title ?? 'New notification');
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}