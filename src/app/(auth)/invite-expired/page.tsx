// STRAYMUTANT.DEV — Tamak Bookshop
export default function InviteExpiredPage() {
  return (
    <div className="mx-auto my-12 w-full max-w-md px-6">
      <div className="auth-card rounded-2xl border border-border-beige px-7 py-9 text-center sm:px-8 sm:py-10">
        <h1 className="mb-2 font-serif text-3xl text-brand-green">This invite link has expired</h1>
        <p className="text-sm leading-6 text-ink-muted">
          Invite links work once and expire after a short time. Ask an administrator to send you a new invite.
        </p>
      </div>
    </div>
  );
}