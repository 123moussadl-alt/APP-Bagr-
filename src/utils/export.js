/**
 * Utilitaires d'export universels (sans macros VBA).
 * - downloadCSV : CSV compatible Excel / WPS Office / Excel Mobile.
 * - exportPDF   : téléchargement PDF côté client.
 * - downloadWord: document Word compatible au format HTML .doc.
 * - printPage   : impression via le navigateur.
 */

import html2pdf from 'html2pdf.js';

export function downloadCSV(filename, rows, sep = ';') {
  const csv = rows.map(r => r.map(c => {
    const str = String(c == null ? '' : c);
    return (str.includes(sep) || /["\n\r]/.test(str)) ? '"' + str.replace(/"/g, '""') + '"' : str;
  }).join(sep)).join('\r\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeFilename(filename, extension) {
  const base = String(filename || 'document').replace(/\.[^.]+$/, '');
  const clean = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'document';
  return `${clean}.${extension}`;
}

function cloneForExport(element) {
  if (!element) throw new Error('Aucun document à exporter.');
  const clone = element.cloneNode(true);
  const controls = ['select', 'input', 'textarea'];
  controls.forEach(selector => {
    const sources = element.querySelectorAll(selector);
    const copies = clone.querySelectorAll(selector);
    sources.forEach((source, index) => {
      const copy = copies[index];
      if (!copy) return;
      const value = selector === 'select'
        ? source.options[source.selectedIndex]?.text || ''
        : source.value || '';
      const replacement = document.createElement('span');
      replacement.textContent = value;
      copy.replaceWith(replacement);
    });
  });
  clone.querySelectorAll('button, .no-print, script').forEach(node => node.remove());
  clone.querySelectorAll('.table-wrap').forEach(node => {
    node.style.overflow = 'visible';
    node.style.maxWidth = 'none';
  });
  clone.querySelectorAll('.arret-table-wrap').forEach(node => {
    node.style.overflow = 'visible';
    node.style.maxWidth = 'none';
  });
  return clone;
}

export async function exportPDF(element, filename, options = {}) {
  const clone = cloneForExport(element);
  const hasPortraitSheet = element.matches('.portrait-sheet, .arret-mois, .synthese-sheet, .bulletin-sheet') ||
    element.querySelector('.portrait-sheet, .arret-mois, .synthese-sheet, .bulletin-sheet');
  const hasLandscapeSheet = element.matches('.landscape-sheet, .monthly-register-sheet, .monthly-register-table') ||
    element.querySelector('.landscape-sheet, .monthly-register-sheet, .monthly-register-table');
  const orientation = options.orientation || (hasPortraitSheet ? 'portrait' : hasLandscapeSheet ? 'landscape' : 'portrait');
  const format = options.format || 'a4';
  const margin = typeof options.margin === 'number' ? options.margin : orientation === 'landscape' ? 10 : 12;
  const contentWidth = orientation === 'landscape'
    ? `${297 - margin * 2}mm`
    : `${210 - margin * 2}mm`;
  clone.style.width = contentWidth;
  clone.style.maxWidth = 'none';
  clone.style.margin = '0 auto';
  clone.style.padding = '0';
  clone.style.background = '#fff';

  const exportStyles = document.createElement('style');
  exportStyles.textContent = `
    * { box-sizing: border-box; }
    .table-wrap { overflow: visible !important; max-width: none !important; }
    .monthly-register-table { width: 100% !important; min-width: 0 !important; table-layout: fixed !important; font-size: 5pt !important; }
    .monthly-register-table th, .monthly-register-table td { padding: 1px !important; white-space: normal !important; overflow-wrap: anywhere !important; }
    .monthly-register-table td[style*="min-width"] { min-width: 0 !important; }
    .arret-mois, .synthese-sheet { max-width: 100% !important; break-inside: avoid; }
    .arret-table-wrap { width: 92% !important; max-width: 680px !important; margin: 16px auto !important; overflow: visible !important; }
    .arret-mois { padding: 6px !important; font-size: 13px !important; line-height: 1.3 !important; break-inside: avoid !important; page-break-inside: avoid !important; }
    .arret-mois table { width: 100% !important; max-width: 100% !important; min-width: 0 !important; table-layout: fixed !important; font-size: 13px !important; line-height: 1.3 !important; }
    .arret-mois th, .arret-mois td { padding: 8px 12px !important; font-size: 13px !important; line-height: 1.3 !important; word-wrap: break-word !important; overflow-wrap: break-word !important; white-space: normal !important; }
    .arret-mois h2 { margin: 8px 0 !important; font-size: 16px !important; line-height: 1.25 !important; }
    .proposition-sheet table, .personnel-directory-table { width: 100% !important; min-width: 0 !important; table-layout: fixed !important; }
    .proposition-sheet th, .proposition-sheet td, .personnel-directory-table th, .personnel-directory-table td { overflow-wrap: anywhere !important; white-space: normal !important; }
    .landscape-sheet .proposition-sheet th, .landscape-sheet .proposition-sheet td, .personnel-directory-table th, .personnel-directory-table td { padding: 3px !important; font-size: 8pt !important; line-height: 1.2 !important; }
    .agent-monthly-sheet table, .statistician-wide-sheet table, .wide-sheet table { width: 100% !important; table-layout: fixed !important; font-size: 8pt !important; }
    .agent-monthly-sheet th, .agent-monthly-sheet td, .statistician-wide-sheet th, .statistician-wide-sheet td, .wide-sheet th, .wide-sheet td { padding: 3px !important; font-size: 8pt !important; line-height: 1.2 !important; overflow-wrap: anywhere !important; white-space: normal !important; }
    .ceb-staff-scroll { overflow: visible !important; max-width: none !important; }
    .ceb-staff-table { width: 100% !important; min-width: 0 !important; table-layout: fixed !important; font-size: 7pt !important; background: #fff !important; color: #111827 !important; }
    .ceb-staff-table th, .ceb-staff-table td { padding: 4px 5px !important; font-size: 7pt !important; line-height: 1.15 !important; overflow-wrap: anywhere !important; word-wrap: break-word !important; white-space: normal !important; }
    .ceb-staff-table th:nth-child(1), .ceb-staff-table td:nth-child(1) { width: 5% !important; }
    .ceb-staff-table th:nth-child(2), .ceb-staff-table td:nth-child(2) { width: 13% !important; }
    .ceb-staff-table th:nth-child(5), .ceb-staff-table td:nth-child(5) { width: 6% !important; }
    .ceb-staff-table th:nth-child(6), .ceb-staff-table td:nth-child(6) { width: 9% !important; }
    .ceb-staff-table .staff-nowrap { white-space: nowrap !important; overflow-wrap: normal !important; }
    .official-motto { display: flex !important; flex-direction: column !important; align-items: center !important; text-align: center !important; }
    .digital-signature-stamp { display: block !important; max-width: 100% !important; max-height: 48px !important; width: auto !important; height: auto !important; object-fit: contain !important; margin: 0 auto 4px !important; }
    .digital-signature-person { display: inline-flex !important; flex-direction: column !important; align-items: center !important; vertical-align: bottom !important; text-align: center !important; }
    .digital-signature-people { display: flex !important; justify-content: center !important; align-items: flex-end !important; flex-wrap: wrap !important; gap: 12px !important; }
    .bulletin-sheet { width: 100% !important; max-width: 100% !important; break-inside: avoid; page-break-after: always; }
    .bulletin-sheet:last-child { break-after: auto; page-break-after: auto; }
  `;
  clone.prepend(exportStyles);

  const {
    orientation: requestedOrientation,
    format: requestedFormat,
    margin: requestedMargin,
    jsPDF: jsPdfOptions,
    ...extraOptions
  } = options;
  const exportMargin = typeof requestedMargin === 'number' ? requestedMargin : margin;
  const pdfOptions = {
    ...extraOptions,
    margin: exportMargin,
    filename: safeFilename(filename, 'pdf'),
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
    jsPDF: { unit: 'mm', format: requestedFormat || format, orientation: requestedOrientation || orientation, ...(jsPdfOptions || {}) },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['.arret-mois', '.synthese-sheet', '.bulletin-sheet'] },
  };
  await html2pdf().set(pdfOptions).from(clone).save();
}

export function wirePDFExportButton(button, getElement, getFilename, options = {}) {
  if (!button) return;
  button.addEventListener('click', async () => {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Création du PDF…';
    try {
      const element = typeof getElement === 'function' ? getElement() : getElement;
      const filename = typeof getFilename === 'function' ? getFilename() : getFilename;
      await exportPDF(element, filename, options);
    } catch (error) {
      alert('Erreur lors de la création du PDF : ' + (error && error.message ? error.message : String(error)));
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

export function downloadWord(element, filename, title = 'Document', options = {}) {
  const clone = cloneForExport(element);
  const orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
  const pageSize = orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait';
  const pageMargin = orientation === 'landscape' ? '10mm' : '12mm';
  const styles = `
    @page { size: ${pageSize}; margin: ${pageMargin}; }
    body { font-family: Arial, sans-serif; color: #111; font-size: 11pt; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #333; padding: 5px; }
    .synthese-sheet { width: 100%; }
    .arret-mois { background: #ffffff; color: #111827; padding: 6px !important; font-size: 13px !important; line-height: 1.3 !important; }
    .arret-table-wrap { width: 92% !important; max-width: 680px !important; margin: 16px auto !important; overflow: visible !important; }
    .arret-mois table { width: 100% !important; max-width: 100% !important; min-width: 0 !important; table-layout: fixed; font-size: 13px !important; line-height: 1.3 !important; }
    .arret-mois th, .arret-mois td { border: 1px solid #cbd5e1 !important; padding: 8px 12px !important; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; }
    .arret-mois h2 { margin: 8px 0 !important; font-size: 16px !important; line-height: 1.25 !important; }
    .arret-mois > div:first-child > div { font-size: 13px !important; line-height: 1.3 !important; }
    .official-motto { display: flex !important; flex-direction: column !important; align-items: center !important; text-align: center !important; }
    .digital-signature-stamp { display: block !important; max-width: 100% !important; max-height: 48px !important; width: auto !important; height: auto !important; object-fit: contain !important; margin: 0 auto 4px !important; }
    .digital-signature-person { display: inline-block !important; text-align: center !important; vertical-align: bottom !important; }
    .digital-signature-person img { display: block !important; margin: 0 auto 4px !important; }
    .digital-signature-people { text-align: center !important; }
    .arret-mois > div:last-child { margin-top: 12px !important; gap: 12px !important; font-size: 12px !important; }
    .arret-mois > div:last-child > div { min-width: 0 !important; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${String(title).replace(/[<&>]/g, '')}</title><style>${styles}</style></head><body>${clone.outerHTML}</body></html>`;
  const blob = new Blob(['\uFEFF', html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename(filename, 'doc');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function wireWordExportButton(button, getElement, getFilename, getTitle, options = {}) {
  if (!button) return;
  button.addEventListener('click', () => {
    try {
      const element = typeof getElement === 'function' ? getElement() : getElement;
      const filename = typeof getFilename === 'function' ? getFilename() : getFilename;
      const title = typeof getTitle === 'function' ? getTitle() : getTitle;
      downloadWord(element, filename, title, options);
    } catch (error) {
      alert('Erreur lors de la création du document Word : ' + (error && error.message ? error.message : String(error)));
    }
  });
}

export function printPage() {
  window.print();
}