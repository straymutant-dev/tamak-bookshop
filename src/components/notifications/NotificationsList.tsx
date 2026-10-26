// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, Check, CreditCard, User } from 'lucide-react';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notifications';
import { createClient } from '@/lib/supabase/client';

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

// The icon is picked from where the notification leads, so no new data is needed.
function iconFor(link: string | null) {
  const to = link ?? '';
  if (to.includes('vendor')) return <User size={16} aria-hidden="true" />;
  if (to.includes('inventory')) return <AlertTriangle size={16} aria-hidden="true" />;
  if (to.includes('order') || to.includes('repayment')) return <CreditCard size={16} aria-hidden="true" />;
  return <Bell size={16} aria-hidden="true" />;
}

// Only shown once the dropdown is open, so it never differs between server and browser.
function ago(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
}

// Only unread notifications are ever passed in (see NotificationsPanel), so
// once one is marked read it simply won't be in the list on the next fetch
// — that's what makes it "disappear" after it's been attended to.
export default function NotificationsList({ items: serverItems, unread: serverUnread }: { items: NotificationItem[]; unread: number }) {
  const router = useRouter();
  // Notifications that arrived live since the page was last loaded from the server.
  const [live, setLive] = useState<NotificationItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Once the server's copy contains a live notification, the server copy wins (no double counting).
  const serverIds = new Set(serverItems.map((n) => n.id));
  const liveOnly = live.filter((n) => !serverIds.has(n.id));
  const items = [...liveOnly, ...serverItems];
  const unread = serverUnread + liveOnly.length;

  // Listen for this person's notifications, so the bell and its count update at once, with no reload.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const userId = data.user.id;
      const filter = `user_id=eq.${userId}`;

      channel = supabase
        .channel(`notification-bell-${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter }, (payload) => {
          const n = payload.new as {
            id: string;
            title: string;
            body: string | null;
            link: string | null;
            created_at: string;
          };
          setLive((current) =>
            current.some((x) => x.id === n.id)
              ? current
              : [{ id: n.id, title: n.title, body: n.body, link: n.link, readAt: null, createdAt: n.created_at }, ...current]
          );
          router.refresh();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter }, (payload) => {
          const n = payload.new as { id: string; read_at: string | null };
          if (n.read_at) {
            setLive((current) => current.filter((x) => x.id !== n.id));
            router.refresh();
          }
        })
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function openItem(item: NotificationItem) {
    setOpen(false);
    setLive((current) => current.filter((x) => x.id !== item.id));
    startTransition(async () => {
      try {
        await markNotificationRead(item.id);
      } finally {
        if (item.link) router.push(item.link);
        router.refresh();
      }
    });
  }

  function markAll() {
    setLive([]);
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-ink hover:bg-surface-cream"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-terracotta px-1 text-[10px] font-medium leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-96 max-w-[92vw] overflow-hidden rounded-2xl border border-border-beige bg-surface-card shadow-lg">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="font-serif text-xl text-brand-green">Notifications</span>
            {unread > 0 && (
              <span className="rounded-full bg-brand-green px-3 py-1 text-xs font-medium text-white">{unread} new</span>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto border-t border-border-beige">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openItem(item)}
                className="flex w-full items-start gap-3 border-b border-border-beige px-5 py-3.5 text-left last:border-b-0 hover:bg-surface-cream/60"
              >
                <span className="mt-4 h-2 w-2 shrink-0 rounded-full bg-accent-terracotta" aria-hidden />
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-beige text-brand-green">
                  {iconFor(item.link)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{item.title}</span>
                  {item.body && <span className="block text-xs text-ink-muted">{item.body}</span>}
                </span>
                <span className="shrink-0 pt-0.5 text-xs text-ink-muted">{ago(item.createdAt)}</span>
              </button>
            ))}
            {items.length === 0 && (
              <div className="flex flex-col items-center px-5 py-8 text-center">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-green/10 text-brand-green">
                  <Check size={18} aria-hidden="true" />
                </span>
                <p className="text-sm text-ink-muted">Nothing new. You&rsquo;re all caught up.</p>
              </div>
            )}
          </div>

          {unread > 0 && (
            <div className="border-t border-border-beige px-5 py-3 text-center">
              <button
                type="button"
                onClick={markAll}
                disabled={isPending}
                className="text-sm font-medium text-brand-green hover:underline disabled:opacity-50"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}