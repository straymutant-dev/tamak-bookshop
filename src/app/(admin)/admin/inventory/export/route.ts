// STRAYMUTANT.DEV — Tamak Bookshop
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';
import { CLASS_LEVELS } from '@/lib/types';

type BookRow = Database['public']['Tables']['books']['Row'];
export const runtime = 'nodejs';

// Same shop details as the sales receipt (pos/Receipt.tsx).
const SHOP = {
  name: 'TAMAK PUBLICATIONS AND CONSULTING SERVICES',
  address: 'Kasoa, behind old ECG along the Nyanyanu road',
  phone: '0599 118 131',
};

// Colours lifted from the receipt CSS in globals.css.
const hex = (h: string) => {
  const n = parseInt(h.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const C = {
  green: hex('#164a41'),
  ink: hex('#000000'),
  muted: hex('#666666'),
  headBg: hex('#f1ede4'),
  metaBg: hex('#faf8f3'),
  metaBorder: hex('#d6d0c4'),
  rowLine: hex('#e2ddd1'),
  outTint: hex('#fbe6de'),
  lowTint: hex('#fbf1dc'),
  amber: hex('#b45309'),
  red: hex('#b3261e'),
  white: hex('#ffffff'),
};

// A4 in points
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 58; // keep clear of the footer

// Table columns (title takes whatever is left)
const COL_IDX = 26;
const COL_CLASS = 92;
const COL_PRICE = 72;
const COL_QTY = 64;
const COL_TITLE = CONTENT_W - COL_IDX - COL_CLASS - COL_PRICE - COL_QTY;

/**
 * Admin or staff — same as who can view /admin/inventory (see ROUTE_RULES in
 * lib/supabase/middleware.ts). Downloads the current inventory view (same
 * filters as the page) as a presentable A4 PDF in the receipt style:
 * stock left in the system, nothing else.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Not authenticated', { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();
  if (!profile || !['admin', 'staff'].includes(profile.role)) {
    return new Response('Only staff and admins can export inventory', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') ?? '';
  const subject = searchParams.get('subject') ?? '';
  const requestedClassLevel = searchParams.get('class_level');
  const classLevel = CLASS_LEVELS.find((level) => level === requestedClassLevel);
  const academicYear = searchParams.get('academic_year') ?? '';
  const status = searchParams.get('status') ?? '';

  let query = supabase.from('books').select('*');
  if (status === 'archived') query = query.eq('is_active', false);
  else query = query.eq('is_active', true);
  if (category) query = query.eq('category', category);
  if (subject) query = query.eq('subject', subject);
  if (classLevel) query = query.eq('class_level', classLevel);
  if (academicYear) query = query.eq('academic_year', academicYear);

  const { data: books, error } = await query;
  if (error) return new Response(`Failed to load inventory: ${error.message}`, { status: 500 });

  const rows: BookRow[] = books ?? [];
  const sorted = [...rows].sort((a, b) => {
    const catDiff = (a.category ?? '').localeCompare(b.category ?? '');
    if (catDiff !== 0) return catDiff;
    return a.title.localeCompare(b.title);
  });

  const outCount = rows.filter((b) => b.stock_quantity <= 0).length;
  const lowCount = rows.filter((b) => b.stock_quantity > 0 && b.stock_quantity <= b.low_stock_threshold).length;
  const totalUnits = rows.reduce((sum, b) => sum + Math.max(0, b.stock_quantity), 0);

  const filterText = [
    status === 'archived' ? 'Archived books' : 'Active books',
    category || null,
    subject || null,
    classLevel || null,
    academicYear || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const generatedAt = new Date().toLocaleString('en-GH', {
    timeZone: 'Africa/Accra',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // ---- Build the PDF ---------------------------------------------------

  const pdf = await PDFDocument.create();
  pdf.setTitle('Tamak Bookshop — Inventory Stock Report');
  pdf.setAuthor('Tamak Bookshop');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Standard PDF fonts only cover Latin-1; swap anything else for "?" so a
  // stray symbol in a book title can never crash the export.
  const supported = new Set(font.getCharacterSet());
  const clean = (s: string) =>
    Array.from(s.replace(/\s+/g, ' ').trim())
      .map((ch) => (supported.has(ch.codePointAt(0) as number) ? ch : '?'))
      .join('');

  const money = (pesewas: number) =>
    `GHS ${(Math.round(pesewas) / 100).toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const fit = (text: string, f: PDFFont, size: number, maxW: number) => {
    let t = clean(text);
    if (f.widthOfTextAtSize(t, size) <= maxW) return t;
    while (t.length > 1 && f.widthOfTextAtSize(t + '...', size) > maxW) t = t.slice(0, -1);
    return t.trimEnd() + '...';
  };

  const wrap = (text: string, f: PDFFont, size: number, maxW: number, maxLines: number) => {
    const words = clean(text).split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) <= maxW) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const kept = lines.slice(0, maxLines);
      kept[maxLines - 1] = fit(lines.slice(maxLines - 1).join(' '), f, size, maxW);
      return kept;
    }
    return lines;
  };

  const rightText = (page: PDFPage, text: string, xRight: number, y: number, size: number, f: PDFFont, color = C.ink) => {
    page.drawText(text, { x: xRight - f.widthOfTextAtSize(text, size), y, size, font: f, color });
  };

  // Use a print-resolution JPEG logo on the white PDF page to keep exports compact.
  // If it can't be loaded the header simply falls back to text only.
  let logo: PDFImage | null = null;
  try {
    const res = await fetch(new URL('/images/logo-pdf.jpg', request.url));
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      logo = await pdf.embedJpg(bytes);
    }
  } catch {
    logo = null;
  }

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const drawTableHeader = () => {
    const h = 22;
    page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, color: C.headBg });
    page.drawLine({
      start: { x: MARGIN, y: y - h },
      end: { x: MARGIN + CONTENT_W, y: y - h },
      thickness: 1.2,
      color: C.green,
    });
    const ty = y - 15;
    page.drawText('#', { x: MARGIN + 8, y: ty, size: 9, font: bold, color: C.ink });
    page.drawText('DESCRIPTION', { x: MARGIN + COL_IDX + 4, y: ty, size: 9, font: bold, color: C.ink });
    page.drawText('CLASS LEVEL', { x: MARGIN + COL_IDX + COL_TITLE + 4, y: ty, size: 9, font: bold, color: C.ink });
    rightText(page, 'PRICE', MARGIN + CONTENT_W - COL_QTY - 8, ty, 9, bold);
    rightText(page, 'IN STOCK', MARGIN + CONTENT_W - 8, ty, 9, bold);
    y -= h;
  };

  // ---- Page 1 header (logo left, shop details right, green rule) ----
  const headTop = y;
  let logoW = 0;
  if (logo) {
    const targetH = 46;
    const scale = Math.min(targetH / logo.height, 175 / logo.width);
    logoW = logo.width * scale;
    page.drawImage(logo, { x: MARGIN, y: headTop - logo.height * scale, width: logoW, height: logo.height * scale });
  }
  const shopRight = MARGIN + CONTENT_W;
  const shopMaxW = CONTENT_W - logoW - 16;
  const nameLines = wrap(SHOP.name, bold, 11.5, shopMaxW, 2);
  let sy = headTop - 11;
  nameLines.forEach((l) => {
    rightText(page, l, shopRight, sy, 11.5, bold, C.green);
    sy -= 14;
  });
  rightText(page, clean(SHOP.address), shopRight, sy, 9, font);
  sy -= 12;
  rightText(page, `Tel: ${SHOP.phone}`, shopRight, sy, 9, font);
  sy -= 6;
  y = Math.min(sy, headTop - 48) - 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_W, y },
    thickness: 2.5,
    color: C.green,
  });

  // ---- Title ----
  y -= 28;
  page.drawText('INVENTORY STOCK REPORT', { x: MARGIN, y, size: 15, font: bold, color: C.green });

  // ---- Details box ----
  y -= 14;
  const metaRows: [string, string][] = [
    ['Report date', generatedAt],
    ['Prepared by', profile.full_name ?? user.email ?? 'Staff'],
    ['Showing', filterText],
    ['Low-stock rule', 'Per-book threshold (default 5)'],
  ];
  const metaRowH = 17;
  const metaH = metaRows.length * metaRowH + 8;
  page.drawRectangle({
    x: MARGIN,
    y: y - metaH,
    width: CONTENT_W,
    height: metaH,
    color: C.metaBg,
    borderColor: C.metaBorder,
    borderWidth: 0.8,
  });
  metaRows.forEach(([label, value], i) => {
    const ry = y - 4 - metaRowH * (i + 1) + 5;
    page.drawText(label, { x: MARGIN + 12, y: ry, size: 9.5, font, color: C.muted });
    rightText(page, fit(value, bold, 9.5, CONTENT_W - 140), MARGIN + CONTENT_W - 12, ry, 9.5, bold);
    if (i < metaRows.length - 1) {
      page.drawLine({
        start: { x: MARGIN + 12, y: ry - 5 },
        end: { x: MARGIN + CONTENT_W - 12, y: ry - 5 },
        thickness: 0.5,
        color: C.metaBorder,
        dashArray: [1, 2],
      });
    }
  });
  y -= metaH + 14;

  // ---- Summary boxes ----
  const stats: [string, string, typeof C.green][] = [
    ['TITLES', String(rows.length), C.green],
    ['UNITS IN STOCK', totalUnits.toLocaleString('en-GH'), C.green],
    ['LOW STOCK', String(lowCount), C.amber],
    ['OUT OF STOCK', String(outCount), C.red],
  ];
  const gap = 8;
  const boxW = (CONTENT_W - gap * (stats.length - 1)) / stats.length;
  const boxH = 44;
  stats.forEach(([label, value, color], i) => {
    const bx = MARGIN + i * (boxW + gap);
    page.drawRectangle({
      x: bx,
      y: y - boxH,
      width: boxW,
      height: boxH,
      color: C.white,
      borderColor: C.metaBorder,
      borderWidth: 0.8,
    });
    page.drawText(label, { x: bx + 10, y: y - 15, size: 7.5, font: bold, color: C.muted });
    page.drawText(value, { x: bx + 10, y: y - 35, size: 18, font: bold, color });
  });
  y -= boxH + 18;

  // ---- Table ----
  drawTableHeader();

  if (sorted.length === 0) {
    y -= 26;
    page.drawText('No books match these filters.', { x: MARGIN + 8, y, size: 10, font, color: C.muted });
    y -= 10;
  }

  sorted.forEach((book, i) => {
    const titleLines = wrap(book.title, font, 9.5, COL_TITLE - 10, 2);
    const rowH = titleLines.length > 1 ? 28 : 18;

    if (y - rowH < BOTTOM) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      page.drawText('Tamak Bookshop — Inventory Stock Report (continued)', {
        x: MARGIN,
        y: y - 10,
        size: 10,
        font: bold,
        color: C.green,
      });
      y -= 22;
      drawTableHeader();
    }

    const qty = book.stock_quantity;
    const isOut = qty <= 0;
    const isLow = !isOut && qty <= book.low_stock_threshold;
    if (isOut || isLow) {
      page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_W, height: rowH, color: isOut ? C.outTint : C.lowTint });
    }

    const firstBaseline = y - 12.5;
    page.drawText(String(i + 1), { x: MARGIN + 8, y: firstBaseline, size: 9, font, color: C.muted });
    titleLines.forEach((l, li) => {
      page.drawText(l, { x: MARGIN + COL_IDX + 4, y: firstBaseline - li * 11, size: 9.5, font, color: C.ink });
    });
    page.drawText(fit(book.class_level ?? '—', font, 9, COL_CLASS - 8), {
      x: MARGIN + COL_IDX + COL_TITLE + 4,
      y: firstBaseline,
      size: 9,
      font,
      color: C.ink,
    });
    rightText(page, money(book.customer_price_pesewas), MARGIN + CONTENT_W - COL_QTY - 8, firstBaseline, 9, font);

    const qtyRight = MARGIN + CONTENT_W - 8;
    const qtyText = String(Math.max(0, qty));
    rightText(page, qtyText, qtyRight, firstBaseline, 10, bold, isOut ? C.red : isLow ? C.amber : C.ink);
    if (isOut || isLow) {
      const tag = isOut ? 'OUT' : 'LOW';
      const tagX = qtyRight - bold.widthOfTextAtSize(qtyText, 10) - 6 - bold.widthOfTextAtSize(tag, 7);
      page.drawText(tag, { x: tagX, y: firstBaseline + 0.5, size: 7, font: bold, color: isOut ? C.red : C.amber });
    }

    page.drawLine({
      start: { x: MARGIN, y: y - rowH },
      end: { x: MARGIN + CONTENT_W, y: y - rowH },
      thickness: 0.6,
      color: C.rowLine,
    });
    y -= rowH;
  });

  // ---- Totals bar (like the receipt TOTAL) ----
  if (sorted.length > 0) {
    const barH = 26;
    if (y - barH - 20 < BOTTOM) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    y -= 14;
    const barW = CONTENT_W * 0.55;
    const barX = MARGIN + CONTENT_W - barW;
    page.drawRectangle({ x: barX, y: y - barH, width: barW, height: barH, color: C.green });
    page.drawText('TOTAL UNITS IN STOCK', { x: barX + 10, y: y - 17, size: 10, font: bold, color: C.white });
    rightText(page, totalUnits.toLocaleString('en-GH'), barX + barW - 10, y - 18, 13, bold, C.white);
    y -= barH;
  }

  // ---- Footer on every page ----
  const pages = pdf.getPages();
  pages.forEach((p, idx) => {
    p.drawLine({
      start: { x: MARGIN, y: 42 },
      end: { x: MARGIN + CONTENT_W, y: 42 },
      thickness: 0.6,
      color: hex('#bbbbbb'),
    });
    p.drawText(`Tamak Bookshop · For enquiries call ${SHOP.phone}`, {
      x: MARGIN,
      y: 28,
      size: 8,
      font,
      color: hex('#444444'),
    });
    rightText(p, `Page ${idx + 1} of ${pages.length}`, MARGIN + CONTENT_W, 28, 8, font, hex('#444444'));
  });

  const bytes = await pdf.save({ useObjectStreams: true });
  const filename = `tamak-inventory-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}