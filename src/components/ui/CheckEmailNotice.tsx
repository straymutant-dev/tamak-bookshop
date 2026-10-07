// STRAYMUTANT.DEV — Tamak Bookshop
export default function CheckEmailNotice({ email, vendor = false }: { email: string; vendor?: boolean }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-2 font-serif text-2xl text-ink">Check your email</h1>
      <p className="mb-1 text-sm text-ink-muted">
        We sent a confirmation link to <span className="font-medium text-ink">{email}</span>.
      </p>
      <p className="text-sm text-ink-muted">
        Click it to confirm your address{vendor ? ' — your account will then await admin approval before you can order on credit.' : ' and finish setting up your account.'}
      </p>
    </div>
  );
}