// STRAYMUTANT.DEV — Tamak Bookshop
// Why this exists: when a server action THROWS, Next.js in production replaces the message with a generic
// one (React error 441: "An error occurred in the Server Components render..."), so people see a code instead
// of "Not enough stock" or "Enter the exact delivery location". Actions that people use directly (checkout)
// return their problem as a value instead, and the page shows it.
export type ActionResult<T extends object> = ({ ok: true } & T) | { ok: false; error: string };

export async function runAction<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    // Next's own control flow (redirect, not found) is thrown on purpose: let it through.
    if ((e as { digest?: string } | null)?.digest?.startsWith('NEXT_')) throw e;
    // Full detail goes to the server log (Vercel -> Logs); the person sees the message.
    console.error('[action failed]', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Something went wrong. Please try again.' };
  }
}