// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Keeps the page you're looking at up to date without a reload.
 * It listens for changes to the given tables and, when one happens, quietly
 * re-fetches the current page's data. What you've typed into forms stays put.
 * Renders nothing. Put it once in a layout.
 */
export default function LiveRefresh({ tables }: { tables: string[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = tables.join(',');

  useEffect(() => {
    const supabase = createClient();

    // Several changes often arrive together (an approval touches an order,
    // stock and a balance), so wait a moment and refresh once.
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };

    let channel = supabase.channel(`live-${key}-${Math.random().toString(36).slice(2)}`);
    for (const table of key.split(',')) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    }
    channel.subscribe();

    // Safety net: if the connection dropped while the tab was in the background,
    // catch up as soon as you come back to it.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [key, router]);

  return null;
}