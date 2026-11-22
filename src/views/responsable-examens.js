/**
 * Vue Responsable des Examens et Concours — Candidats au CEP (CM2) de la CEB de Bagré.
 * Lecture seule : filtres École / Option CEP, KPI, tableau officiel, exports PDF / Excel / Word.
 */

import { esc } from '../utils/format.js';
import { downloadCSV, printPage, wirePDFExportButton, downloadWord } from '../utils/export.js';

const CEP_OPTIONS = ['CEP seul', 'CEP + EG', 'CEP + BP'];

export function renderResponsableExamens(state, render, supabase) {
  const profile = state.profile;
  if (!profile) return '<div>Chargement...</div>';

  return `
    <div class="role-layout">
      <div class="role-content">
        <header class="role-topbar">
          <div>
            <h1>🎓 Responsable des Examens et Concours</h1>
            <p>Candidats au CEP — CEB de Bagré</p>
          </div>
          <div class="top-actions">
            <button class="btn" data-action="re-export-pdf">📄 PDF</button>
            <button class="btn" data-action="re-export-csv">📥 Excel (sans macros)</button>
            <button class="btn secondary" data-action="re-export-word">📝 Word</button>
            <button class="btn secondary" data-action="re-print">🖨️ Imprimer</button>
          </div>
        </header>

        <main class="role-main">
          <div class="card">
            <h3 style="margin-top:0">🎓 Espace Responsable des Examens et Concours — Candidats au CEP</h3>
            <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
              <div class="form-group" style="margin:0;min-width:300px">
                <label>École</label>
                <select id="reSchoolFilter">
                  <option value="">Toutes les écoles de la CEB (Liste globale)</option>
                </select>
              </div>
              <div class="form-group" style="margin:0;min-width:220px">
                <label>Option CEP</label>
                <select id="reOptionFilter">
                  <option value="">Toutes les options</option>
                  <option value="CEP seul">CEP seul</option>
                  <option value="CEP + EG">CEP + EG</option>
                  <option value="CEP + BP">CEP + BP</option>
                </select>
              </div>
            </div>

            <div id="reKpis" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px"></div>

            <div class="table-wrap" style="margin-top:16px">
              <div id="reSheet"></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `;
}

export function setupResponsableExamens(container, state, render, supabase) {
  const sheetEl = container.querySelector('#reSheet');
  const kpiEl = container.querySelector('#reKpis');
  const schoolFilter = container.querySelector('#reSchoolFilter');
  const optionFilter = container.querySelector('#reOptionFilter');
  const session = state.activeSchoolYear || '';

  let schools = [];
  let candidates = [];
  let filtered = [];

  wirePDFExportButton(
    container.querySelector('[data-action="re-export-pdf"]'),
    () => sheetEl,
    () => 'liste_candidats_cep.pdf',
    { orientation: 'landscape', format: 'a4', margin: 10 }
  );
  container.querySelector('[data-action="re-export-csv"]')?.addEventListener('click', exportCSV);
  container.querySelector('[data-action="re-export-word"]')?.addEventListener('click', exportWord);
  container.querySelector('[data-action="re-print"]')?.addEventListener('click', printPage);

  schoolFilter?.addEventListener('change', applyFilters);
  optionFilter?.addEventListener('change', applyFilters);

  function formatDob(iso) {
    if (!iso) return '';
    const d = new Date(String(iso) + 'T00:00:00');
    if (isNaN(d.getTime())) return String(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  function splitName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/);
    return { nom: parts[0] || '', prenom: parts.slice(1).join(' ') };
  }

  function applyFilters() {
    const schoolId = schoolFilter ? schoolFilter.value : '';
    const option = optionFilter ? optionFilter.value : '';
    filtered = candidates.filter(c =>
      (!schoolId || String(c.schoolId) === String(schoolId)) &&
      (!option || String(c.option_cep || '').trim() === option)
    );
    renderKpis();
    renderTable();
  }

  function renderKpis() {
    const boys = filtered.filter(c => c.gender === 'M').length;
    const girls = filtered.filter(c => c.gender === 'F').length;
    const total = filtered.length;
    const card = (label, g, f, t) => `
      <div style="flex:1;min-width:190px;border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.05)">
        <div style="font-size:13px;color:#64748b;font-weight:700;margin-bottom:6px">${esc(label)}</div>
        <div style="display:flex;gap:16px;font-weight:700;font-size:16px">
          <span style="color:#0f172a">G: ${g}</span>
          <span style="color:#dc2626">F: ${f}</span>
          <span style="color:#16a34a">T: ${t}</span>
        </div>
      </div>`;
    kpiEl.innerHTML =
      card('Total Candidats au CEP', boys, girls, total) +
      CEP_OPTIONS.map(o => {
        const g = filtered.filter(c => c.gender === 'M' && String(c.option_cep || '').trim() === o).length;
        const f = filtered.filter(c => c.gender === 'F' && String(c.option_cep || '').trim() === o).length;
        return card(`Option ${o}`, g, f, g + f);
      }).join('');
  }

  function renderTable() {
    const headerRows = [
      '<div style="text-align:center;margin-bottom:8px">',
      '<div style="font-weight:800;font-size:15px">BURKINA FASO</div>',
      '<div style="font-weight:700">La Patrie ou la Mort, nous vaincrons</div>',
      '<div style="font-weight:700">CEB de Bagré</div>',
      `<div style="font-weight:800;font-size:15px;margin-top:4px">Liste des Candidats au CEP — Session ${esc(session)}</div>`,
      '</div>'
    ].join('');
    sheetEl.innerHTML = headerRows + `
      <table style="border-collapse:collapse;width:100%;min-width:900px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="border:1px solid #333;padding:6px">N°</th>
            <th style="border:1px solid #333;padding:6px">École</th>
            <th style="border:1px solid #333;padding:6px">Nom</th>
            <th style="border:1px solid #333;padding:6px">Prénom</th>
            <th style="border:1px solid #333;padding:6px">Sexe</th>
            <th style="border:1px solid #333;padding:6px">Date de naissance</th>
            <th style="border:1px solid #333;padding:6px">Lieu de naissance</th>
            <th style="border:1px solid #333;padding:6px">Option CEP</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((c, i) => {
            const { nom, prenom } = splitName(c.full_name);
            const st = c.gender === 'F' ? 'color:#dc2626;font-weight:600;' : '';
            const dob = c.date_naissance ? formatDob(c.date_naissance) : '—';
            return `
              <tr>
                <td style="border:1px solid #333;padding:6px;text-align:center;${st}">${i + 1}</td>
                <td style="border:1px solid #333;padding:6px;${st}">${esc(c.schoolName || '—')}</td>
                <td style="border:1px solid #333;padding:6px;${st}">${esc(nom)}</td>
                <td style="border:1px solid #333;padding:6px;${st}">${esc(prenom)}</td>
                <td style="border:1px solid #333;padding:6px;text-align:center;${st}">${c.gender === 'M' ? 'M' : (c.gender === 'F' ? 'F' : '')}</td>
                <td style="border:1px solid #333;padding:6px;text-align:center;${st}">${esc(dob)}</td>
                <td style="border:1px solid #333;padding:6px;${st}">${esc(c.lieu_naissance || '—')}</td>
                <td style="border:1px solid #333;padding:6px;${st}">${esc(c.option_cep || '—')}</td>
              </tr>`;
          }).join('') || '<tr><td colspan="8" style="border:1px solid #333;padding:6px;text-align:center">Aucun candidat</td></tr>'}
        </tbody>
      </table>`;
  }

  function currentRows() {
    return [
      ['BURKINA FASO', '', '', '', '', '', '', ''],
      ['La Patrie ou la Mort, nous vaincrons', '', '', '', '', '', '', ''],
      ['CEB de Bagré', '', '', '', '', '', '', ''],
      [`Liste des Candidats au CEP — Session ${session}`, '', '', '', '', '', '', ''],
      ['N°', 'École', 'Nom', 'Prénom', 'Sexe', 'Date de naissance', 'Lieu de naissance', 'Option CEP'],
      ...filtered.map((c, i) => {
        const { nom, prenom } = splitName(c.full_name);
        return [i + 1, c.schoolName || '', nom, prenom, c.gender || '', formatDob(c.date_naissance), c.lieu_naissance || '', c.option_cep || ''];
      })
    ];
  }

  function exportCSV() {
    downloadCSV('liste_candidats_cep.csv', currentRows());
  }

  function exportWord() {
    if (!sheetEl) return;
    downloadWord(sheetEl, 'liste_candidats_cep.doc', 'Liste des Candidats au CEP — Session ' + session);
  }

  async function loadData() {
    const { data: schoolsData } = await supabase.from('schools').select('id,name').order('name');
    schools = schoolsData || [];
    if (schoolFilter) {
      schoolFilter.innerHTML = '<option value="">Toutes les écoles de la CEB (Liste globale)</option>' +
        schools.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    }

    const { data: classesData } = await supabase.from('classes').select('id,name,level,school_id').order('name');
    const cm2Classes = (classesData || []).filter(c => String(c.level || c.niveau || c.name || '').toUpperCase().includes('CM2'));
    const classIds = cm2Classes.map(c => c.id);
    let students = [];
    if (classIds.length) {
      const { data: studentsData } = await supabase.from('students').select('*').in('class_id', classIds).order('full_name');
      students = studentsData || [];
    }
    const classById = {};
    cm2Classes.forEach(c => { classById[c.id] = c; });
    const schoolById = {};
    schools.forEach(s => { schoolById[s.id] = s; });

    candidates = students.map(s => {
      const cls = classById[s.class_id] || {};
      const schoolId = cls.school_id || s.school_id || '';
      const school = schoolById[schoolId] || {};
      return {
        id: s.id,
        schoolId,
        schoolName: school.name || s.ecole_nom || '',
        full_name: s.full_name || '',
        gender: s.gender || '',
        date_naissance: s.date_naissance || '',
        lieu_naissance: s.lieu_naissance || '',
        option_cep: s.option_cep || ''
      };
    });
    applyFilters();
  }

  loadData().catch(error => {
    if (sheetEl) sheetEl.innerHTML = `<p style="color:#dc2626">Erreur de chargement : ${esc(error && error.message ? error.message : String(error))}</p>`;
  });
}