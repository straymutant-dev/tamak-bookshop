// STRAYMUTANT.DEV — Tamak Bookshop
'use server';

import { createClient } from '@/lib/supabase/server';

// Marks only the signed-in user's own notifications (the database function enforces that).

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_notifications_read', { p_ids: [id] });
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_notifications_read', {});
  if (error) throw new Error(error.message);
}