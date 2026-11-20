/**
 * Modale d'aperçu universelle (A4) avant téléchargement / impression.
 * Affiche le contenu HTML dans une fenêtre scrollable avec boutons
 * "Imprimer / PDF" et "Exporter Excel/CSV".
 */

export function openPreview({ title, html, onPrint, onCSV }) {
  closePreview();

  const overlay = document.createElement('div');
  overlay.id = 'previewOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:11000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:20px';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:8px;width:100%;max-width:920px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.35)';

  const header = document.createElement('div');
  header.className = 'preview-header';
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #e2e8f0;gap:8px;flex-wrap:wrap';
  header.innerHTML = '<strong style="font-size:15px">' + (title || 'Aperçu') + '</strong>';

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';

  const printBtn = document.createElement('button');
  printBtn.className = 'btn';
  printBtn.textContent = '🖨️ Imprimer / PDF';
  printBtn.onclick = () => { if (onPrint) onPrint(); else window.print(); };

  const csvBtn = document.createElement('button');
  csvBtn.className = 'btn secondary';
  csvBtn.textContent = '📥 Excel/CSV';
  csvBtn.onclick = () => { if (onCSV) onCSV(); };

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn';
  closeBtn.textContent = '✕ Fermer';
  closeBtn.onclick = closePreview;

  actions.appendChild(printBtn);
  actions.appendChild(csvBtn);
  actions.appendChild(closeBtn);
  header.appendChild(actions);

  const body = document.createElement('div');
  body.style.cssText = 'overflow:auto;padding:20px;background:#f1f5f9';

  const paper = document.createElement('div');
  paper.id = 'previewPaper';
  paper.style.cssText = 'background:#fff;padding:24px;box-shadow:0 1px 5px rgba(0,0,0,.12);margin:0 auto;max-width:800px;min-height:500px';
  paper.innerHTML = html;

  body.appendChild(paper);
  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.classList.add('preview-open');

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePreview(); });
}

export function closePreview() {
  const el = document.getElementById('previewOverlay');
  if (el) el.remove();
  document.body.classList.remove('preview-open');
}