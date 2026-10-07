// STRAYMUTANT.DEV — Tamak Bookshop
'use client';

import { signOutAction } from './actions';

export default function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button type="submit" className="text-sm text-accent-terracotta hover:underline">
        Log out
      </button>
    </form>
  );
}