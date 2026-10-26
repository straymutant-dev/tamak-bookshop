// STRAYMUTANT.DEV — Tamak Bookshop
// Path: src/lib/orderEmail.ts
// Builds and sends the order emails (server only):
//   'placed'          "We received your order"       (right after checkout)
//   'paid'            "Payment confirmed — receipt"  (when staff confirm the payment)
//   'credit_approved' "Your credit order is approved" (vendor credit orders)
// Each email is sent at most once per order, and a failure here never breaks the order.
import { createServiceRoleClient } from '@/lib/supabase/server';
import { formatGHS } from '@/lib/currency';
import { sendEmail } from '@/lib/email';

export type OrderEmailKind = 'placed' | 'paid' | 'credit_approved';

const SHOP = {
  name: 'TAMAK PUBLICATIONS AND CONSULTING SERVICES',
  address: 'Kasoa, behind old ECG along the Nyanyanu road',
  phone: '0599 118 131',
};

const GREEN = '#164a41';

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile money',
  bank_transfer: 'Bank transfer',
  credit: 'Credit account',
  cheque: 'Cheque',
};

interface EmailItem {
  quantity: number;
  unit_price_pesewas: number;
  books: { title: string } | null;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Never throws: an email problem must not fail checkout or a payment approval. */
export async function sendOrderEmail(orderId: string, kind: OrderEmailKind): Promise<void> {
  try {
    await send(orderId, kind);
  } catch (e) {
    console.error('[order email] failed', kind, orderId, e);
  }
}

async function send(orderId: string, kind: OrderEmailKind) {
  const service = createServiceRoleClient();

  const { data: order } = await service
    .from('orders')
    .select(
      'order_number, order_type, user_id, contact_name, contact_email, payment_method, payment_status, payment_reference, fulfillment_type, delivery_address, discount_pesewas, total_pesewas, created_at, placed_email_sent_at, paid_email_sent_at, order_items(quantity, unit_price_pesewas, books(title))'
    )
    .eq('id', orderId)
    .single();
  if (!order) return;

  // Send each email only once.
  const alreadySent = kind === 'placed' ? order.placed_email_sent_at : order.paid_email_sent_at;
  if (alreadySent) return;

  // Who gets it: the email typed on the order, else the account's receipt email, else the account email.
  let to = order.contact_email;
  let name = order.contact_name ?? '';
  if (!to && order.user_id) {
    const { data: profile } = await service
      .from('profiles')
      .select('contact_email, full_name')
      .eq('id', order.user_id)
      .single();
    to = profile?.contact_email ?? null;
    name = name || profile?.full_name || '';
    if (!to) {
      const { data } = await service.auth.admin.getUserById(order.user_id);
      to = data.user?.email || null;
    }
  }
  if (!to) return; // no email on file: nothing to send

  const items = (order.order_items ?? []) as unknown as EmailItem[];
  const { subject, html, text } = render(kind, {
    orderNumber: order.order_number,
    name,
    createdAt: order.created_at,
    method: order.payment_method,
    paymentStatus: order.payment_status,
    reference: order.payment_reference,
    fulfillment: order.fulfillment_type,
    address: order.delivery_address,
    discountPesewas: order.discount_pesewas ?? 0,
    totalPesewas: order.total_pesewas,
    items,
  });

  const result = await sendEmail({ to, toName: name, subject, html, text });
  if (result.ok) {
    const stamp = new Date().toISOString();
    await service
      .from('orders')
      .update(kind === 'placed' ? { placed_email_sent_at: stamp } : { paid_email_sent_at: stamp })
      .eq('id', orderId);
  }
}

interface RenderInput {
  orderNumber: string;
  name: string;
  createdAt: string;
  method: string;
  paymentStatus: string;
  reference: string | null;
  fulfillment: string;
  address: string | null;
  discountPesewas: number;
  totalPesewas: number;
  items: EmailItem[];
}

function render(kind: OrderEmailKind, o: RenderInput): { subject: string; html: string; text: string } {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  const trackUrl = siteUrl ? `${siteUrl}/store/track` : '';
  const when = new Date(o.createdAt).toLocaleString('en-GH', {
    timeZone: 'Africa/Accra',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const total = formatGHS(o.totalPesewas);
  const methodLabel = METHOD_LABEL[o.method] ?? o.method;

  let subject: string;
  let heading: string;
  let intro: string;
  let badge = '';
  const notes: string[] = [];

  if (kind === 'paid') {
    subject = `Payment confirmed: receipt for order ${o.orderNumber}`;
    heading = 'Payment confirmed';
    intro = 'Thank you. We have confirmed your payment. This email is your receipt.';
    badge = 'PAID';
  } else if (kind === 'credit_approved') {
    subject = `Your credit order ${o.orderNumber} is approved`;
    heading = 'Your credit order is approved';
    intro = 'Your credit order has been approved and added to your account balance.';
    badge = 'ON CREDIT';
    notes.push('This order is not paid yet. It is part of the balance on your credit account.');
  } else {
    subject = `We received your order ${o.orderNumber}`;
    heading = 'We received your order';
    intro = 'Thank you for ordering from Tamak Bookshop.';
    if (o.paymentStatus === 'credit_pending') {
      notes.push('Your credit order is waiting for approval. We will email you when it is approved.');
    } else if (o.method === 'mobile_money' || o.method === 'bank_transfer') {
      notes.push(
        `To complete your order, pay ${total} and use your order number ${o.orderNumber} as the payment reference.` +
          (trackUrl ? ` Then report your payment at ${trackUrl} so we can confirm it quickly.` : '')
      );
      notes.push('We will email your receipt once your payment is confirmed.');
    } else if (o.method === 'cash') {
      notes.push(
        `Pay ${total} in cash when you ${o.fulfillment === 'delivery' ? 'receive' : 'collect'} your order. We will email your receipt once payment is confirmed.`
      );
    } else {
      notes.push('We will email your receipt once your payment is confirmed.');
    }
  }

  const fulfilment =
    o.fulfillment === 'delivery'
      ? `Delivery to: ${o.address ?? 'the address you gave us'}`
      : `Pickup at: ${SHOP.address}`;

  const reference = kind === 'paid' && o.reference ? o.reference : null;

  // ---- HTML ----
  const rows = o.items
    .map((item) => {
      const title = esc(item.books?.title ?? 'Book');
      return `<tr>
  <td style="padding:8px 0;border-bottom:1px solid #e2ddd1;font-size:14px;">${title}</td>
  <td style="padding:8px 8px;border-bottom:1px solid #e2ddd1;font-size:14px;text-align:center;">${item.quantity}</td>
  <td style="padding:8px 0;border-bottom:1px solid #e2ddd1;font-size:14px;text-align:right;">${esc(formatGHS(item.unit_price_pesewas * item.quantity))}</td>
</tr>`;
    })
    .join('\n');

  const discountRow =
    o.discountPesewas > 0
      ? `<tr><td colspan="2" style="padding:6px 0;font-size:14px;color:#666666;">Discount</td><td style="padding:6px 0;font-size:14px;text-align:right;color:#666666;">-${esc(formatGHS(o.discountPesewas))}</td></tr>`
      : '';

  const noteHtml = notes
    .map((n) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.55;">${esc(n)}</p>`)
    .join('');

  const html = `<div style="margin:0;padding:24px 12px;background:#f5f2ea;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2ddd1;border-radius:10px;overflow:hidden;">
    <div style="background:${GREEN};padding:18px 24px;">
      <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#ffffff;">Tamak Bookshop</span>
    </div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 8px;font-size:20px;color:${GREEN};">${esc(heading)}${badge ? ` <span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:4px;background:${GREEN};color:#ffffff;font-size:11px;vertical-align:middle;">${badge}</span>` : ''}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.55;">${o.name ? `Hello ${esc(o.name)}, ` : ''}${esc(intro)}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#666666;">Order <strong style="color:#1a1a1a;">${esc(o.orderNumber)}</strong> · ${esc(when)}</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0 0;">
        <tr>
          <th style="text-align:left;padding:6px 0;font-size:12px;color:#666666;border-bottom:2px solid ${GREEN};">Item</th>
          <th style="text-align:center;padding:6px 8px;font-size:12px;color:#666666;border-bottom:2px solid ${GREEN};">Qty</th>
          <th style="text-align:right;padding:6px 0;font-size:12px;color:#666666;border-bottom:2px solid ${GREEN};">Amount</th>
        </tr>
        ${rows}
        ${discountRow}
        <tr>
          <td colspan="2" style="padding:10px 0 0;font-size:15px;font-weight:bold;">Total</td>
          <td style="padding:10px 0 0;font-size:15px;font-weight:bold;text-align:right;">${esc(total)}</td>
        </tr>
      </table>
      <p style="margin:16px 0 4px;font-size:13px;color:#666666;">Payment: <span style="color:#1a1a1a;">${esc(methodLabel)}</span>${reference ? ` · Ref: <span style="color:#1a1a1a;">${esc(reference)}</span>` : ''}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#666666;">${esc(fulfilment)}</p>
      ${noteHtml}
    </div>
    <div style="padding:14px 24px;background:#faf8f3;border-top:1px solid #e2ddd1;font-size:12px;color:#888888;line-height:1.5;">
      ${esc(SHOP.name)}<br>${esc(SHOP.address)} · Tel: ${esc(SHOP.phone)}
    </div>
  </div>
</div>`;

  // ---- plain text (for mail apps that do not show HTML) ----
  const lines = [
    heading.toUpperCase(),
    `${o.name ? `Hello ${o.name}, ` : ''}${intro}`,
    '',
    `Order ${o.orderNumber} (${when})`,
    '',
    ...o.items.map(
      (item) => `${item.quantity} x ${item.books?.title ?? 'Book'}  ${formatGHS(item.unit_price_pesewas * item.quantity)}`
    ),
    ...(o.discountPesewas > 0 ? [`Discount  -${formatGHS(o.discountPesewas)}`] : []),
    `TOTAL  ${total}`,
    '',
    `Payment: ${methodLabel}${reference ? ` (ref ${reference})` : ''}`,
    fulfilment,
    ...(notes.length ? ['', ...notes] : []),
    '',
    `${SHOP.name}, ${SHOP.address}. Tel: ${SHOP.phone}`,
  ];

  return { subject, html, text: lines.join('\n') };
}