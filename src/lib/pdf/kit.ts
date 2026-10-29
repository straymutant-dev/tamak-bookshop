// STRAYMUTANT.DEV — Tamak Bookshop
// Small drawing kit for the A4 "receipt style" PDFs (logo, shop details, green rule, footer, page numbers).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

const hex = (h: string) => {
  const n = parseInt(h.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

export const C = {
  green: hex('#164a41'),
  ink: hex('#000000'),
  muted: hex('#666666'),
  headBg: hex('#f1ede4'),
  metaBg: hex('#faf8f3'),
  line: hex('#d6d0c4'),
  rowLine: hex('#e2ddd1'),
  red: hex('#b3261e'),
  redTint: hex('#fbe6de'),
  amber: hex('#b45309'),
  amberTint: hex('#fbf1dc'),
  white: hex('#ffffff'),
};

export const SHOP = {
  name: 'TAMAK PUBLICATIONS AND CONSULTING SERVICES',
  address: 'Kasoa, behind old ECG along the Nyanyanu road',
  phone: '0599 118 131',
};

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const MARGIN = 40;
export const CONTENT_W = PAGE_W - MARGIN * 2;
export const BOTTOM = 58;

export class PdfKit {
  pdf!: PDFDocument;
  font!: PDFFont;
  bold!: PDFFont;
  page!: PDFPage;
  y = 0;
  private logo: PDFImage | null = null;
  private supported = new Set<number>();

  static async create(title: string, logoBytes?: Uint8Array | null): Promise<PdfKit> {
    const k = new PdfKit();
    k.pdf = await PDFDocument.create();
    k.pdf.setTitle(title);
    k.pdf.setAuthor('Tamak Bookshop');
    k.font = await k.pdf.embedFont(StandardFonts.Helvetica);
    k.bold = await k.pdf.embedFont(StandardFonts.HelveticaBold);
    k.supported = new Set(k.font.getCharacterSet());
    if (logoBytes) {
      try {
        k.logo = await k.pdf.embedPng(logoBytes);
      } catch {
        try {
          k.logo = await k.pdf.embedJpg(logoBytes);
        } catch {
          k.logo = null;
        }
      }
    }
    k.page = k.pdf.addPage([PAGE_W, PAGE_H]);
    k.y = PAGE_H - MARGIN;
    return k;
  }

  /** Standard PDF fonts only cover Latin-1; anything else becomes "?" so odd characters never crash a download. */
  clean(s: string) {
    return Array.from(s.replace(/\s+/g, ' ').trim())
      .map((ch) => (this.supported.has(ch.codePointAt(0) as number) ? ch : '?'))
      .join('');
  }

  money(pesewas: number) {
    return `GHS ${(Math.round(pesewas) / 100).toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  fit(text: string, f: PDFFont, size: number, maxW: number) {
    let t = this.clean(text);
    if (f.widthOfTextAtSize(t, size) <= maxW) return t;
    while (t.length > 1 && f.widthOfTextAtSize(t + '...', size) > maxW) t = t.slice(0, -1);
    return t.trimEnd() + '...';
  }

  wrap(text: string, f: PDFFont, size: number, maxW: number, maxLines: number) {
    const words = this.clean(text).split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) <= maxW) line = test;
      else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const kept = lines.slice(0, maxLines);
      kept[maxLines - 1] = this.fit(lines.slice(maxLines - 1).join(' '), f, size, maxW);
      return kept;
    }
    return lines;
  }

  text(s: string, x: number, y: number, size: number, f: PDFFont = this.font, color = C.ink) {
    this.page.drawText(this.clean(s), { x, y, size, font: f, color });
  }

  right(s: string, xRight: number, y: number, size: number, f: PDFFont = this.font, color = C.ink) {
    const t = this.clean(s);
    this.page.drawText(t, { x: xRight - f.widthOfTextAtSize(t, size), y, size, font: f, color });
  }

  rect(x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>, border?: ReturnType<typeof rgb>) {
    this.page.drawRectangle({ x, y, width: w, height: h, color, ...(border ? { borderColor: border, borderWidth: 0.8 } : {}) });
  }

  hline(y: number, thickness: number, color: ReturnType<typeof rgb>, x1 = MARGIN, x2 = MARGIN + CONTENT_W) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  }

  /** Logo left, shop details right, green rule. Call once at the top of the first page. */
  header() {
    const top = this.y;
    let logoW = 0;
    if (this.logo) {
      const targetH = 46;
      const scale = Math.min(targetH / this.logo.height, 175 / this.logo.width);
      logoW = this.logo.width * scale;
      this.page.drawImage(this.logo, { x: MARGIN, y: top - this.logo.height * scale, width: logoW, height: this.logo.height * scale });
    }
    const maxW = CONTENT_W - logoW - 16;
    let sy = top - 11;
    for (const l of this.wrap(SHOP.name, this.bold, 11.5, maxW, 2)) {
      this.right(l, MARGIN + CONTENT_W, sy, 11.5, this.bold, C.green);
      sy -= 14;
    }
    this.right(SHOP.address, MARGIN + CONTENT_W, sy, 9);
    sy -= 12;
    this.right(`Tel: ${SHOP.phone}`, MARGIN + CONTENT_W, sy, 9);
    sy -= 6;
    this.y = Math.min(sy, top - 48) - 6;
    this.hline(this.y, 2.5, C.green);
  }

  /** Start a new page; the optional label is printed small at the top ("... (continued)"). */
  newPage(label?: string) {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
    if (label) {
      this.text(label, MARGIN, this.y - 10, 10, this.bold, C.green);
      this.y -= 24;
    }
  }

  /** Make sure `height` points fit on this page; otherwise move to a new one. Returns true if it did. */
  ensure(height: number, label?: string) {
    if (this.y - height < BOTTOM) {
      this.newPage(label);
      return true;
    }
    return false;
  }

  /** Stat boxes in a row, like the stock report. */
  statBoxes(stats: { label: string; value: string; color?: ReturnType<typeof rgb> }[]) {
    const gap = 8;
    const w = (CONTENT_W - gap * (stats.length - 1)) / stats.length;
    const h = 44;
    stats.forEach((s, i) => {
      const x = MARGIN + i * (w + gap);
      this.rect(x, this.y - h, w, h, C.white, C.line);
      this.text(s.label, x + 10, this.y - 15, 7.5, this.bold, C.muted);
      this.text(this.fit(s.value, this.bold, 15, w - 16), x + 10, this.y - 35, 15, this.bold, s.color ?? C.green);
    });
    this.y -= h + 16;
  }

  /** Page numbers and the shop line on every page, then the finished file. */
  async finish(footerLeft: string): Promise<Uint8Array> {
    const pages = this.pdf.getPages();
    pages.forEach((p, i) => {
      p.drawLine({ start: { x: MARGIN, y: 42 }, end: { x: MARGIN + CONTENT_W, y: 42 }, thickness: 0.6, color: hex('#bbbbbb') });
      p.drawText(this.clean(footerLeft), { x: MARGIN, y: 28, size: 8, font: this.font, color: hex('#444444') });
      const t = `Page ${i + 1} of ${pages.length}`;
      p.drawText(t, { x: MARGIN + CONTENT_W - this.font.widthOfTextAtSize(t, 8), y: 28, size: 8, font: this.font, color: hex('#444444') });
    });
    return this.pdf.save();
  }
}