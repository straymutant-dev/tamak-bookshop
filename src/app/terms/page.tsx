// STRAYMUTANT.DEV — Tamak Bookshop
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Sale',
  description: 'Terms governing orders, prices, pickup, delivery and vendor credit at Tamak Bookshop.',
  robots: { index: true, follow: true },
};

export default function TermsOfSalePage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <section className="rounded-md border border-border-beige bg-surface-card p-6 sm:p-10">
        <p className="mb-4 rounded-md bg-surface-cream px-4 py-3 text-xs leading-5 text-ink-muted">
          Draft for Ghanaian legal review. It is not legal advice or a statement of certified compliance.
        </p>
        <h1 className="font-serif text-3xl text-ink">Terms of Sale</h1>
        <p className="mt-3 text-sm text-ink-muted">Last updated: 1 November 2026</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-ink-muted">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Business details</h2>
            <p>Tamak Bookshop operates at https://tamakbookshop.com and in Kasoa, Ghana, behind old ECG along the Nyanyanu road. These terms apply to retail orders, pickup, delivery and approved vendor accounts.</p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Prices and payment</h2>
            <p>Prices are displayed in Ghana cedis. Orders are confirmed only after the applicable payment or credit approval process is completed. Customers may be asked to provide a payment reference and transaction evidence.</p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Stock and order acceptance</h2>
            <p>An online order is not confirmed as fulfilled simply because it was submitted. Availability, payment status and fulfillment are checked before approval or dispatch.</p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Pickup and delivery</h2>
            <p>Pickup and delivery options are selected during checkout. Delivery locations and fees, where shown, must be confirmed before dispatch. Risk and collection responsibility begin according to the confirmed fulfillment method.</p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Returns and damaged goods</h2>
            <p>There is no blanket right of return stated in these draft terms. Damaged, missing or incorrect items should be reported promptly so the order can be reviewed case by case.</p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Vendor credit</h2>
            <p>Vendor credit is available only to approved accounts, within the approved limit. Outstanding balances, repayments, approved credit orders and account status are subject to Tamak Bookshop records and review.</p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-ink">Questions</h2>
            <p>Call <a className="text-brand-green hover:underline" href="tel:+233599118131">0599 118 131</a> or visit the shop at the address above for help with an order or these terms.</p>
          </section>
        </div>
      </section>
    </article>
  );
}
