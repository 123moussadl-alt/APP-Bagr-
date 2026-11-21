/**
 * Vue Statisticien — rapports ESH et EDF par école ou pour toute la CEB.
 */

import { esc, formatClassName } from '../utils/format.js';
import { downloadCSV, printPage, wirePDFExportButton } from '../utils/export.js';
import { openPreview } from '../utils/preview.js';
import { signatureBlockHTML } from '../utils/signature.js';
import { mergeSchoolChoices } from '../utils/schools.js';

const ALL_SCHOOLS_VALUE = '';
const CLASS_LEVELS = new Set(['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2']);

export function renderStatisticien(state) {
  const profile = state.profile;
  if (!profile) return '<div>Chargement...</div>';

  return `
    <div class="role-layout">
      <aside class="role-sidebar">
        <div class="role-brand">
          <strong>Educ CEB</strong>
          <span>Statisticien — ${esc(profile.full_name)}</span>
        </div>
        <nav class="role-nav">
          <button class="nav-item active" data-view="stats">📊 Statistiques de la CEB</button>
        </nav>
        <div class="role-footer">
          <button class="btn-logout" onclick="window.logout()">Déconnexion</button>
        </div>
      </aside>

      <div class="role-content">
        <header class="role-topbar">
          <div>
            <h1 id="pageTitle">Statistiques de la CEB</h1>
            <p id="pageSubtitle">Élèves en Situation de Handicap (ESH) et Élèves Déplacés Forcés (EDF)</p>
          </div>
          <div class="top-actions">
            <button class="btn" data-action="preview-stats">👁 Aperçu</button>
            <button class="btn" data-action="export-stats">📥 Exporter en Excel</button>
            <button class="btn" data-action="export-pdf">📄 Exporter en PDF</button>
            <button class="btn secondary" data-action="print-stats">🖨️ Imprimer</button>
          </div>
        </header>

        <main class="role-main">
          <div id="viewContainer"></div>
        </main>
      </div>
    </div>
  `;
}

export function setupStatisticien(container, state, render, supabase) {
  const viewContainer = container.querySelector('#viewContainer');
  const activeProfile = state.realProfile || state.profile || {};
  const statisticienSigners = activeProfile.role === 'statisticien' ? [activeProfile] : [];
  let students = [];
  let schools = [];
  let classes = [];
  let activeCategory = 'esh';
  let selectedSchoolId = ALL_SCHOOLS_VALUE;

  const categoryInfo = () => activeCategory === 'edf'
    ? { key: 'edf', acronym: 'EDF', title: 'ÉLÈVES DÉPLACÉS FORCÉS (EDF)', label: 'Élèves déplacés forcés', description: 'Élèves Déplacés Forcés (EDF)' }
    : { key: 'esh', acronym: 'ESH', title: 'ÉLÈVES EN SITUATION DE HANDICAP (ESH)', label: 'Élèves en situation de handicap', description: 'Élèves en Situation de Handicap (ESH)' };

  wirePDFExportButton(
    container.querySelector('[data-action="export-pdf"]'),
    () => viewContainer.querySelector('#statDocument'),
    () => `Statistiques_${categoryInfo().acronym}_${selectedSchoolId || 'CEB_Bagre'}.pdf`,
    { orientation: 'landscape', format: 'a4', margin: 10 }
  );
  container.querySelector('[data-action="print-stats"]')?.addEventListener('click', printPage);
  container.querySelector('[data-action="export-stats"]')?.addEventListener('click', exportStatsCSV);
  container.querySelector('[data-action="preview-stats"]')?.addEventListener('click', previewStats);

  viewContainer.addEventListener('click', event => {
    const tab = event.target.closest('[data-category]');
    if (!tab) return;
    activeCategory = tab.dataset.category;
    renderView();
  });
  viewContainer.addEventListener('change', event => {
    if (event.target.id !== 'statSchoolFilter') return;
    selectedSchoolId = event.target.value;
    renderView();
  });

  function isSelectedCategory(student) {
    if (activeCategory === 'edf') return student.edi === true || student.edi === 1 || student.edi === 'true';
    return !!(student.handicap && String(student.handicap).trim());
  }

  function categoryCounts(rows) {
    const matched = (rows || []).filter(student => student.status !== 'A' && isSelectedCategory(student));
    const boys = matched.filter(student => student.gender === 'M').length;
    const girls = matched.filter(student => student.gender === 'F').length;
    return { boys, girls, total: boys + girls };
  }

  function schoolIdForStudent(student, classById) {
    if (student.school_id) return String(student.school_id);
    const studentClass = classById.get(String(student.class_id || ''));
    return studentClass && studentClass.school_id ? String(studentClass.school_id) : '';
  }

  function currentReport() {
    const classById = new Map(classes.map(cls => [String(cls.id), cls]));
    const selectedSchool = schools.find(school => String(school.id) === String(selectedSchoolId)) || null;
    if (!selectedSchool) {
      const rows = schools.map(school => ({
        id: school.id,
        label: school.name,
        stats: categoryCounts(students.filter(student => schoolIdForStudent(student, classById) === String(school.id)))
      }));
      const schoolIds = new Set(schools.map(school => String(school.id)));
      const totals = categoryCounts(students.filter(student => schoolIds.has(schoolIdForStudent(student, classById))));
      return { rows, totals, scope: 'Toute la CEB de Bagré', rowLabel: 'École', totalLabel: 'TOTAL CEB DE BAGRÉ' };
    }

    const schoolClasses = classes
      .filter(cls => String(cls.school_id) === String(selectedSchool.id) && CLASS_LEVELS.has(String(cls.level || '').toUpperCase()))
      .sort((a, b) => {
        const byLevel = String(a.level || '').localeCompare(String(b.level || ''), 'fr');
        return byLevel || String(a.name || '').localeCompare(String(b.name || ''), 'fr');
      });
    const rows = schoolClasses.map(cls => ({
      id: cls.id,
      label: formatClassName(cls),
      stats: categoryCounts(students.filter(student => String(student.class_id || '') === String(cls.id)))
    }));
    const schoolStudents = students.filter(student => schoolIdForStudent(student, classById) === String(selectedSchool.id));
    return {
      rows,
      totals: categoryCounts(schoolStudents),
      scope: selectedSchool.name,
      rowLabel: 'Classe',
      totalLabel: 'TOTAL ÉCOLE'
    };
  }

  function statCell(value, color, bold = false) {
    return `<td style="text-align:center;${color ? `color:${color};` : ''}${bold ? 'font-weight:700;' : ''}">${value}</td>`;
  }

  function renderView(errorMessage = '') {
    const info = categoryInfo();
    const selectedStillExists = schools.some(school => String(school.id) === String(selectedSchoolId));
    if (selectedSchoolId && !selectedStillExists) selectedSchoolId = ALL_SCHOOLS_VALUE;
    const report = currentReport();
    const tabStyle = isActive => `padding:10px 14px;border:1px solid ${isActive ? '#166534' : '#cbd5e1'};border-radius:7px;background:${isActive ? '#166534' : '#fff'};color:${isActive ? '#fff' : '#111827'};font-weight:700;cursor:pointer`;

    viewContainer.innerHTML = `
      <section class="card no-print" aria-label="Filtres du rapport statistique">
        <div role="tablist" aria-label="Catégorie d'élèves" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
          <button type="button" role="tab" aria-selected="${activeCategory === 'esh'}" class="stat-category-tab" data-category="esh" style="${tabStyle(activeCategory === 'esh')}">Élèves en Situation de Handicap (ESH)</button>
          <button type="button" role="tab" aria-selected="${activeCategory === 'edf'}" class="stat-category-tab" data-category="edf" style="${tabStyle(activeCategory === 'edf')}">Élèves Déplacés Forcés (EDF)</button>
        </div>
        <div class="form-group" style="margin:0;max-width:440px">
          <label for="statSchoolFilter">École</label>
          <select id="statSchoolFilter">
            <option value="${ALL_SCHOOLS_VALUE}" ${selectedSchoolId === ALL_SCHOOLS_VALUE ? 'selected' : ''}>Toute la CEB de Bagré</option>
            ${schools.map(school => `<option value="${esc(school.id)}" ${String(school.id) === String(selectedSchoolId) ? 'selected' : ''}>${esc(school.name)}</option>`).join('')}
          </select>
        </div>
      </section>
      ${errorMessage ? `<div class="card" role="alert" style="color:#b91c1c">${esc(errorMessage)}</div>` : ''}
      <article id="statDocument" class="card landscape-sheet statistician-wide-sheet wide-sheet" style="margin-top:16px;background:#fff;color:#111827">
        <style>@page statistician-landscape { size: A4 landscape; margin: 10mm; } .statistician-wide-sheet { page: statistician-landscape; }</style>
        <header style="display:grid;grid-template-columns:1fr 1fr;align-items:start;gap:16px;margin-bottom:16px">
          <div><strong>CEB de Bagré</strong><br><span>École : ${esc(report.scope)}</span></div>
          <div class="official-motto"><strong>Burkina Faso</strong><span>La Patrie ou la Mort, nous vaincrons</span></div>
        </header>
        <h2 style="margin:10px 0;text-align:center;font-size:20px">${info.title}</h2>
        <p style="margin:0 0 16px;text-align:center"><strong>${info.label}</strong> — ${esc(report.scope)}</p>
        <div class="stat-row" style="justify-content:center;margin:0 auto 16px">
          <div class="stat-box"><strong>${report.totals.boys}</strong><span>Garçons</span></div>
          <div class="stat-box"><strong style="color:#dc2626">${report.totals.girls}</strong><span style="color:#dc2626">Filles</span></div>
          <div class="stat-box"><strong style="color:#16a34a">${report.totals.total}</strong><span style="color:#16a34a">Total</span></div>
        </div>
        <div class="table-wrap">
          <table style="width:100%;border-collapse:collapse;table-layout:fixed">
            <thead><tr>
              <th style="width:8%;text-align:center">N°</th>
              <th>${report.rowLabel}</th>
              <th style="text-align:center">Garçons</th>
              <th style="text-align:center;color:#dc2626">Filles</th>
              <th style="text-align:center;color:#16a34a">Total</th>
            </tr></thead>
            <tbody>
              ${report.rows.map((row, index) => `<tr>
                <td style="text-align:center">${index + 1}</td>
                <td><strong>${esc(row.label)}</strong></td>
                ${statCell(row.stats.boys, '')}
                ${statCell(row.stats.girls, '#dc2626')}
                ${statCell(row.stats.total, '#16a34a', true)}
              </tr>`).join('') || `<tr><td colspan="5" style="text-align:center">Aucune donnée ${info.acronym} pour ce périmètre.</td></tr>`}
              <tr style="background:#f8fafc;font-weight:700">
                <td></td><td>${report.totalLabel}</td>
                ${statCell(report.totals.boys, '')}
                ${statCell(report.totals.girls, '#dc2626')}
                ${statCell(report.totals.total, '#16a34a', true)}
              </tr>
            </tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:24px">${signatureBlockHTML('Le Statisticien', statisticienSigners)}</div>
      </article>
    `;
  }

  function exportStatsCSV() {
    const info = categoryInfo();
    const report = currentReport();
    const rows = [
      ['CEB de Bagré'],
      ['Rapport', info.description],
      ['Périmètre', report.scope],
      [],
      ['N°', report.rowLabel, 'Garçons', 'Filles', 'Total']
    ];
    report.rows.forEach((row, index) => rows.push([
      index + 1, row.label, row.stats.boys, row.stats.girls, row.stats.total
    ]));
    rows.push(['', report.totalLabel, report.totals.boys, report.totals.girls, report.totals.total]);
    downloadCSV(`Statistiques_${info.acronym}_${selectedSchoolId || 'CEB_Bagre'}.csv`, rows);
  }

  function previewStats() {
    const documentElement = viewContainer.querySelector('#statDocument');
    if (!documentElement) return;
    openPreview({
      title: `Aperçu — ${categoryInfo().description}`,
      html: documentElement.outerHTML,
      onPrint: printPage,
      onCSV: exportStatsCSV
    });
  }

  async function load() {
    try {
      const [studentsResult, schoolsResult, classesResult] = await Promise.all([
        supabase.from('students').select('*'),
        supabase.from('schools').select('id,name,ceb').order('name'),
        supabase.from('classes').select('id,name,level,school_id').order('level').order('name')
      ]);
      const failedResult = [studentsResult, schoolsResult, classesResult].find(result => result.error);
      if (failedResult) throw failedResult.error;
      students = (studentsResult.data || []).filter(student => student.status !== 'A');
      schools = mergeSchoolChoices(schoolsResult.data || []);
      classes = classesResult.data || [];
      renderView();
    } catch (error) {
      console.error('Impossible de charger les statistiques ESH/EDF.', error);
      renderView(error && error.message ? error.message : String(error));
    }
  }

  load();
}
