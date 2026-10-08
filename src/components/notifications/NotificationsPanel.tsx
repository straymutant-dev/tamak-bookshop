// STRAYMUTANT.DEV — Tamak Bookshop
import { createClient } from '@/lib/supabase/server';
import NotificationsList from './NotificationsList';

/** The signed-in user's unread notifications as a dropdown. Once one is read it drops out. */
export default async function NotificationsPanel() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: items, count: unread } = await supabase
    .from('notifications')
    .select('id, title, body, link, read_at, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <NotificationsList
      unread={unread ?? 0}
      items={(items ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        link: n.link,
        readAt: n.read_at,
        createdAt: n.created_at,
      }))}
    />
  );
}