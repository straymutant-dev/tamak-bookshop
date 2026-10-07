// STRAYMUTANT.DEV — Tamak Bookshop
import TeamPhoto from '@/components/store/TeamPhoto';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-6 font-serif text-3xl text-ink">About Tamak Bookshop</h1>

      <div className="flex flex-col gap-4 text-sm leading-7 text-ink-muted">
        <p>
          Tamak Bookshop is a retail and wholesale bookshop based in Kasoa, Ghana, supplying
          textbooks, workbooks, and past-questions materials to students, parents, and partner
          schools across every level from KG through Senior High.
        </p>
        <p>
          Alongside our retail storefront, we work directly with schools and vendors through
          wholesale pricing and credit accounts, helping partner institutions stock what their
          students need each term.
        </p>
        <p>
          Have a question about an order, a book you can&rsquo;t find, or setting up a wholesale
          account?{' '}
          <a href="/auth/register?type=vendor" className="text-brand-green hover:underline">
            Apply for a wholesale account
          </a>{' '}
          or{' '}
          <a href="/store/track" className="text-brand-green hover:underline">
            track an existing order
          </a>
          .
        </p>
      </div>

      <div className="mt-12">
        <p className="mb-6 text-sm leading-7 text-ink-muted">
          Behind every order is a small team making sure it gets to you right, on time, and in
          good condition — from the person approving what goes on our shelves, to the ones
          making sure it reaches your door.
        </p>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            { name: 'Selorm Ocean Tamakloe', role: 'Head of Operations', photo: '/images/team/admin.jpg' },
            { name: 'Kwame Antwi', role: 'Logistics & Delivery', photo: '/images/team/logistics.jpg' },
            { name: 'Ama Serwaa', role: 'Customer Service', photo: '/images/team/sales.jpg' },
            { name: 'Maxwell Nyarko', role: 'Store Manager', photo: '/images/team/manager.jpg' },
            
          ].map((member) => (
            <div key={member.name}>
              <TeamPhoto src={member.photo} name={member.name} />
              <p className="mt-2 text-sm font-medium text-ink">{member.name}</p>
              <p className="text-xs text-ink-muted">{member.role}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}