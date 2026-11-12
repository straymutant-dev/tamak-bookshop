// STRAYMUTANT.DEV — Tamak Bookshop
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Tamak Bookshop collects, uses and protects customer and account information.',
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <section className="rounded-md border border-border-beige bg-surface-card p-6 sm:p-10">
        <p className="mb-4 rounded-md bg-surface-cream px-4 py-3 text-xs leading-5 text-ink-muted">
          Draft for Ghanaian legal review. It is not legal advice or a statement of certified compliance.
        </p>
        <h1 className="font-serif text-3xl text-ink">Privacy Policy</h1>
        <p className="mt-3 text-sm text-ink-muted">Last updated: 1 November 2026</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-ink-muted">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Who we are</h2>
            <p>Tamak Bookshop operates online at https://tamakbookshop.com and from Kasoa, Ghana, behind old ECG along the Nyanyanu road.</p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Information we collect</h2>
            <p>We may collect names, phone numbers, email addresses, delivery addresses, account and vendor details, order history, payment references and support communication needed to provide our services.</p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">How we use information</h2>
            <p>Information is used to create and administer accounts, process and deliver orders, verify payments, manage vendor credit, communicate service updates, prevent fraud, maintain records and comply with legal obligations.</p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Account and financial records</h2>
            <p>Some account and transaction records may need to be retained for accounting, tax, fraud prevention or legal purposes. A retention schedule must be confirmed before launch and reviewed periodically.</p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Access, correction and deletion</h2>
            <p>You may request access to, correction of, or deletion of your personal information where applicable. If deletion would conflict with required financial records or another lawful purpose, we will explain any required restriction or retention.</p>
            <p className="mt-2">Contact us by phone at <a className="text-brand-green hover:underline" href="tel:+233599118131">0599 118 131</a>. A self-service deletion control is not currently enabled.</p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Storage and sharing</h2>
            <p>We use service providers necessary to operate the website, authentication, database, storage, payment-record reporting and delivery communications. We do not sell personal information.</p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Cookies and browser storage</h2>
            <p>We use essential cookies and browser storage to keep users signed in, maintain session security, remember shopping-cart contents, and provide hCaptcha bot protection. These are necessary for website functionality; we do not set advertising cookies and currently use no optional analytics cookies.</p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Security</h2>
            <p>We restrict access to personal information according to account roles and use authentication and access controls. No online service can guarantee absolute security.</p>
          </section>
        </div>
      </section>
    </article>
  );
}
