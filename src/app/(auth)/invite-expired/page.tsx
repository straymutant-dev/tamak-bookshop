// STRAYMUTANT.DEV — Tamak Bookshop
export default function InviteExpiredPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col justify-center px-6 py-16 text-center">
      <h1 className="mb-2 text-2xl font-semibold text-ink">This invite link has expired</h1>
      <p className="text-sm text-ink-muted">
        Invite links work once and expire after a short time. Ask an administrator to send you a new invite.
      </p>
    </div>
  );
}