'use client';

import { useState, useTransition } from 'react';
import { CLASS_LEVELS, type ClassLevel } from '@/lib/types';
import { ghsToPesewas } from '@/lib/currency';
import { useToast } from '@/components/ui/ToastContext';
import ProcessingButton from '@/components/ui/ProcessingButton';
import {
  importBooks,
  uploadImportedBookCover,
  type InventoryImportRow,
  type InventoryImportResult,
} from './actions';

interface PreviewRow extends InventoryImportRow {
  errors: string[];
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(value.trim());
      value = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else {
      value += char;
    }
  }

  if (value !== '' || row.length > 0) {
    row.push(value.trim());
    if (row.some((cell) => cell !== '')) rows.push(row);
  }
  return rows;
}

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeCoverReference(value: string) {
  return normalizedKey(value.replace(/\.(jpg|jpeg|png)$/i, ''));
}

function findMatchingImage(files: File[], coverFilename: string | null) {
  if (!coverFilename) return undefined;
  const reference = normalizeCoverReference(coverFilename.split(/[\\/]/).pop() ?? '');
  if (!reference) return undefined;
  return files.find((file) => normalizeCoverReference(file.name) === reference);
}

function priceInPesewas(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '').replace(/,/g, '');
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? ghsToPesewas(amount) : -1;
}

function getMapped(row: Record<string, string>, aliases: string[]) {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const exact = keys.find((key) => normalizedKey(key) === normalizedKey(alias));
    if (exact) return row[exact]?.trim() ?? '';
  }
  return '';
}

function downloadTemplate() {
  const headers = 'title,author,category,subject,class_level,academic_year,buying_cost,retail_price,wholesale_price,stock_quantity,cover_filename\n';
  const example = 'Core Mathematics,John Doe,Textbook,Mathematics,SHS 1-3,2026/2027,25.00,35.00,28.00,20,core-mathematics.jpg\n';
  const blob = new Blob([headers + example], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tamak-books-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function InventoryImportModal({ onClose }: { onClose: () => void }) {
  const [csvName, setCsvName] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<InventoryImportResult[] | null>(null);
  const [progress, setProgress] = useState('');
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  function selectImageFiles(files: File[]) {
    Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
    const urls: Record<string, string> = {};
    files.forEach((file) => {
      urls[normalizeCoverReference(file.name)] = URL.createObjectURL(file);
    });
    setImageFiles(files);
    setImageUrls(urls);
  }

  async function readCsv(file: File) {
    setError(null);
    setResults(null);
    setCsvName(file.name);
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) throw new Error('The CSV has no data rows');

      const headers = parsed[0];
      const preview: PreviewRow[] = [];
      for (let index = 1; index < parsed.length && index <= 501; index++) {
        const values = parsed[index];
        const record: Record<string, string> = {};
        headers.forEach((header, headerIndex) => {
          record[header] = values[headerIndex] ?? '';
        });

        const classValue = getMapped(record, ['class_level', 'class', 'grade', 'level']);
        const classLevel = CLASS_LEVELS.includes(classValue as ClassLevel) ? classValue as ClassLevel : null;
        const title = getMapped(record, ['title', 'book_title', 'name']);
        const author = getMapped(record, ['author', 'author_name', 'writer']);
        const category = getMapped(record, ['category', 'type', 'book_type']);
        const coverFilename = getMapped(record, ['cover_filename', 'image_filename', 'cover', 'image']) || null;
        const errors: string[] = [];
        if (!title) errors.push('Missing title');
        if (!author) errors.push('Missing author');
        if (!category) errors.push('Missing category');
        if (classValue && !classLevel) errors.push('Unknown class level');

        const buying = priceInPesewas(getMapped(record, ['buying_cost', 'buying_cost_ghs', 'buy_cost', 'cost']));
        const retail = priceInPesewas(getMapped(record, ['retail_price', 'customer_price', 'selling_price', 'price']));
        const wholesale = priceInPesewas(getMapped(record, ['wholesale_price', 'vendor_price', 'bulk_price']));
        const stockRaw = getMapped(record, ['stock_quantity', 'stock', 'quantity', 'opening_stock']);
        const stock = stockRaw === '' ? 0 : Number(stockRaw);
        if ([buying, retail, wholesale].some((value) => value < 0)) errors.push('Invalid price');
        if (!Number.isInteger(stock) || stock < 0) errors.push('Invalid stock quantity');

        preview.push({
          rowNumber: index + 1,
          title,
          author,
          category,
          subject: getMapped(record, ['subject']) || null,
          class_level: classLevel,
          academic_year: getMapped(record, ['academic_year', 'year']) || null,
          buying_cost_pesewas: buying,
          customer_price_pesewas: retail,
          vendor_price_pesewas: wholesale,
          stock_quantity: stock,
          cover_filename: coverFilename,
          errors,
        });
      }
      if (parsed.length > 501) preview.pop();
      setRows(preview);
      if (parsed.length - 1 > 500) setError('This importer handles up to 500 books at a time');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read CSV');
      setRows([]);
    }
  }

  function importNow() {
    if (imageFiles.length > 0 && missingImageCount > 0) {
      setError(`${missingImageCount} book rows have cover filenames that do not match any selected image`);
      return;
    }
    const validRows = rows.filter((row) => row.errors.length === 0);
    if (validRows.length === 0) {
      setError('Fix the highlighted rows before importing');
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        const importResults = await importBooks(validRows);
        let coverUploads = 0;

        for (const result of importResults) {
          if (result.status !== 'created' || !result.bookId) continue;
          const originalRow = validRows.find((row) => row.rowNumber === result.rowNumber);
          if (!originalRow?.cover_filename) continue;

          const image = findMatchingImage(imageFiles, originalRow.cover_filename);
          if (!image) continue;

          setProgress(`Uploading cover ${++coverUploads} for ${result.title}…`);
          await uploadImportedBookCover(result.bookId, image, image.name);
        }

        setResults(importResults);
        const created = importResults.filter((item) => item.status === 'created').length;
        const duplicates = importResults.filter((item) => item.status === 'duplicate').length;
        showToast(`Imported ${created} books${duplicates ? `; skipped ${duplicates} duplicates` : ''}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Import failed');
      } finally {
        setProgress('');
      }
    });
  }

  const invalidCount = rows.filter((row) => row.errors.length > 0).length;
  const missingImageCount = rows.filter((row) =>
    !!row.cover_filename && !findMatchingImage(imageFiles, row.cover_filename)
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-surface-card p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Bulk import books</h2>
            <p className="text-sm text-ink-muted">Upload a CSV and matching cover images. Up to 500 books per import.</p>
          </div>
          <button type="button" onClick={downloadTemplate} className="rounded-md border border-brand-sage px-3 py-2 text-sm text-ink">
            Download CSV template
          </button>
        </div>

        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {!results ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-ink">
                Books CSV
                <input type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && readCsv(event.target.files[0])} className="rounded-md border border-brand-sage px-3 py-2" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Cover images (optional)
                <input type="file" accept="image/png,image/jpeg" multiple onChange={(event) => selectImageFiles(Array.from(event.target.files ?? []))} className="rounded-md border border-brand-sage px-3 py-2" />
                <span className="text-xs text-ink-muted">Select the image folder files or select several files at once.</span>
              </label>
            </div>

            {csvName && <p className="mt-3 text-xs text-ink-muted">Loaded {csvName}: {rows.length} rows</p>}

            {rows.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-md border border-border-beige">
                <table className="w-full text-xs">
                  <thead className="bg-surface-cream text-left text-ink-muted">
                    <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Cover</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Author</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Status</th></tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((row) => {
                      const matchedFilename = row.cover_filename?.split(/[\\/]/).pop()?.toLowerCase() ?? null;
                      const matchedImage = findMatchingImage(imageFiles, row.cover_filename);
                      const coverUrl = matchedImage ? imageUrls[normalizeCoverReference(matchedImage.name)] : undefined;
                      return (
                        <tr key={row.rowNumber} className="border-t border-border-beige">
                          <td className="px-3 py-2">{row.rowNumber}</td>
                          <td className="px-3 py-2">
                            {coverUrl ? (
                              <div className="space-y-1">
                                {/* Preview and confirm the exact image matched from cover_filename. */}
                                <img src={coverUrl} alt="" className="h-16 w-12 rounded border border-border-beige object-cover" />
                                <div className="max-w-28 truncate text-brand-green" title={matchedImage?.name}>{matchedImage?.name}</div>
                              </div>
                            ) : row.cover_filename ? (
                              <span className="text-accent-terracotta">Missing: {matchedFilename}</span>
                            ) : (
                              <span className="text-ink-muted">No image</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{row.title || '—'}</td><td className="px-3 py-2">{row.author || '—'}</td>
                          <td className="px-3 py-2">{row.customer_price_pesewas >= 0 ? `GHS ${(row.customer_price_pesewas / 100).toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2 text-red-700">{row.errors.length ? row.errors.join(', ') : coverUrl || !row.cover_filename ? 'Ready' : 'Image missing'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {progress && <p className="mt-3 text-sm text-brand-green">{progress}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="rounded-md border border-brand-sage px-4 py-2 text-sm text-ink">Cancel</button>
              <ProcessingButton type="button" isProcessing={isPending} onClick={importNow} processingText="Importing…" disabled={rows.length === 0 || invalidCount > 0 || (imageFiles.length > 0 && missingImageCount > 0)} className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white">
                Import {rows.filter((row) => row.errors.length === 0).length} books
              </ProcessingButton>
            </div>
          </>
        ) : (
          <>
            <div className="max-h-80 overflow-y-auto rounded-md border border-border-beige">
              {results.map((result) => (
                <div key={result.rowNumber} className="flex justify-between border-b border-border-beige px-3 py-2 text-sm last:border-b-0">
                  <span>{result.rowNumber}. {result.title}</span>
                  <span className={result.status === 'failed' ? 'text-red-700' : result.status === 'duplicate' ? 'text-ink-muted' : 'text-brand-green'}>
                    {result.status === 'created' ? 'Imported' : result.status === 'duplicate' ? 'Duplicate skipped' : result.error ?? 'Failed'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="rounded-md bg-brand-green px-4 py-2 text-sm font-medium text-white">Done</button></div>
          </>
        )}
      </div>
    </div>
  );
}
