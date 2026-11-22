/**
 * Vue Encadreur — Lecture seule des écoles suivies + Synthèse Examens Blancs
 * Pattern : render (HTML shell) + setup (logique + délégation d'événements)
 */

import { esc, formatClassName } from '../utils/format.js';
import { downloadCSV, printPage, wirePDFExportButton, wireWordExportButton } from '../utils/export.js';
import { openPreview } from '../utils/preview.js';
import { renderSyntheseHTML, computeSubjectRows, computeClassAverageSummary } from '../utils/synthese.js';
import { computeMonthlyRegister, monthlyRegisterCSVRows, renderMonthlyRegisterTable, formatVisaStampDate, computeFicheArretMensuel, renderFicheArretMensuelHTML, schoolMonths, ANNUAL_SYNTHESIS_TITLE } from '../utils/registre.js';
import { profileMatchesVisa, signatureUrlForProfile } from '../utils/signature.js';
import { loadPaiRecord, normalizePaiDiscipline } from '../utils/pai.js';
import { mergeSchoolChoices } from '../utils/schools.js';

export function renderEncadreur(state, render, supabase) {
  const profile = state.profile;
  if (!profile) return '<div>Chargement...</div>';

  return `
    <div class="role-layout">
      <aside class="role-sidebar">
        <div class="role-brand">
          <strong>Educ CEB</strong>
          <span>Encadreur — ${esc(profile.full_name)}</span>
        </div>
        <nav class="role-nav">
          <button class="nav-item active" data-view="ecoles">🏫 Mes écoles</button>
          <button class="nav-item" data-view="registre">📅 Registre d'appel</button>
          <button class="nav-item" data-view="fiche-synthese">📋 Fiche Synthèse</button>
          <button class="nav-item" data-view="synthese">📊 Synthèse Examens Blancs</button>
        </nav>
        <div class="role-footer">
          <button class="btn-logout" onclick="window.logout()">Déconnexion</button>
        </div>
      </aside>

      <div class="role-content">
        <header class="role-topbar">
          <div>
            <h1 id="pageTitle">Mes écoles suivies</h1>
            <p id="pageSubtitle">Consultation lecture seule</p>
          </div>
          <div class="top-actions">
            <button class="btn" data-action="export-pdf">📄 Exporter en PDF</button>
            <button class="btn" data-action="export-synthese">📥 Exporter Excel/CSV</button>
            <button class="btn secondary" data-action="print-page">🖨️ Imprimer / PDF</button>
          </div>
        </header>

        <main class="role-main">
          <div id="viewContainer"></div>
        </main>
      </div>
    </div>
  `;
}

export function setupEncadreur(container, state, render, supabase) {
  const viewContainer = container.querySelector('#viewContainer');
  const navItems = Array.from(container.querySelectorAll('.nav-item'));
  const actualProfile = state.realProfile || state.profile || {};
  const encadreurSigners = actualProfile.role === 'encadreur' ? [actualProfile] : [];
  let encadreurSchools = [];
  let selectedSchoolId = null;
  let encMonthlyRows = [];
  let encVisaDirecteurByMonth = {};
  let encVisaEncadreurByMonth = {};
  let encVisaDirectorStamps = {};
  let encVisaEncadreurStamps = {};
  let encSelectedMonth = null;
  let currentEncQuarterly = null;
  let currentEncQuarterlySheetId = null;

  wirePDFExportButton(
    container.querySelector('[data-action="export-pdf"]'),
    () => {
      const synthese = viewContainer.querySelector('#fsSheet .synthese-sheet, #encSynthSheet .synthese-sheet');
      return synthese || viewContainer.querySelector('.wide-sheet') || viewContainer;
    },
    () => `${container.querySelector('#pageTitle')?.textContent || 'Document'}_encadreur.pdf`
  );
  container.querySelector('[data-action="print-page"]')?.addEventListener('click', printPage);

  viewContainer.addEventListener('change', (e) => {
    if (e.target.id === 'encSchool') {
      selectedSchoolId = e.target.value;
      renderSubView('ecoles');
    } else if (e.target.id === 'encSynthClass' || e.target.id === 'encSynthTerm') {
      renderEncSynthese();
    } else if (e.target.id === 'encRegMonth') {
      encSelectedMonth = e.target.value || null;
      renderEncRegSheet();
    }
  });

  viewContainer.addEventListener('click', async (e) => {
    if (e.target.closest('[data-action="preview-quarterly-synth"]')) {
      previewCurrentEncQuarterly();
      return;
    }
    if (e.target.closest('[data-action="csv-quarterly-synth"]')) {
      exportCurrentEncQuarterlyCSV();
      return;
    }
    if (e.target.closest('[data-action="enc-reg-summary-preview"]')) {
      const summary = viewContainer.querySelector('#encRegSummary');
      if (summary) openPreview({ title: 'Synthèse des Mois Arrêtés', html: summary.innerHTML, onPrint: printPage, onCSV: exportEncMonthlyCSV });
      return;
    }
    if (e.target.closest('[data-action="enc-reg-summary-csv"]')) {
      exportEncMonthlyCSV();
      return;
    }
    if (e.target.closest('[data-action="enc-reg-summary-print"]')) {
      const summary = viewContainer.querySelector('#encRegSummary');
      if (summary) openPreview({ title: 'Synthèse des Mois Arrêtés', html: summary.innerHTML, onPrint: printPage, onCSV: exportEncMonthlyCSV });
      return;
    }
    const btn = e.target.closest('[data-action="visa-encadreur"]');
    if (!btn) return;
    const classId = viewContainer.querySelector('#encRegClass')?.value;
    const mois = btn.dataset.mois || encSelectedMonth;
    if (!classId || !mois) return;
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const stampDate = formatVisaStampDate();
    const encadreurVisa = "Visé par l'Encadreur : " + (state.profile ? state.profile.full_name : '') + ' le ' + stampDate;
    const { data: existing } = await supabase.from('registre_configs').select('*').eq('classe_id', classId).eq('mois', mois).limit(1);
    if (existing && existing[0]) await supabase.from('registre_configs').update({
      visa_encadreur: encadreurVisa,
      visa_encadreur_date: stampDate,
      visa_encadreur_nom: state.profile ? state.profile.full_name : '',
      visa_encadreur_signature: signatureUrlForProfile(state.profile)
    }).eq('id', existing[0].id);
    else await supabase.from('registre_configs').insert({
      classe_id: classId,
      mois,
      visa_encadreur: encadreurVisa,
      visa_encadreur_date: stampDate,
      visa_encadreur_nom: state.profile ? state.profile.full_name : '',
      visa_encadreur_signature: signatureUrlForProfile(state.profile)
    });
    renderEncRegSheet();
  });

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      renderSubView(item.dataset.view);
    });
  });

  async function getFollowedSchools() {
    const profile = state.profile || {};
    let followed = Array.isArray(profile.ecoles_encadrees) ? profile.ecoles_encadrees : [];
    if (!followed.length && Array.isArray(profile.followed_schools)) followed = profile.followed_schools;
    if (!followed.length && profile.id && typeof localStorage !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('educ_ceb_ecoles_encadrees_' + profile.id) || '[]');
        if (Array.isArray(stored)) followed = stored;
      } catch (error) {
        console.warn('Liste locale des écoles encadrées invalide.', error);
      }
    }
    const schoolIds = [...new Set(followed.map(String))];
    if (!schoolIds.length) return [];
    const { data: schools, error } = await supabase.from('schools').select('*').in('id', schoolIds).order('name');
    if (error) throw error;
    return mergeSchoolChoices(schools || [])
      .filter(school => !school.isFallback && schoolIds.includes(String(school.id)));
  }

  async function renderSubView(view) {
    if (!viewContainer) return;
    try {
      switch (view) {
        case 'ecoles': return await renderEcoles();
        case 'registre': return await renderEncRegistre();
        case 'fiche-synthese': return await renderEncFicheSynthese();
        case 'synthese': return await renderSynthese();
        default: return await renderEcoles();
      }
    } catch (error) {
      console.error('Impossible de charger les données de l’Encadreur.', error);
      viewContainer.innerHTML = `<div class="empty" role="alert">Impossible de charger les données : ${esc(error && error.message ? error.message : error)}</div>`;
    }
  }

  async function renderEncRegistre() {
    const schools = await getFollowedSchools();
    const schoolIds = schools.map(school => school.id);
    if (!schoolIds.length) {
      viewContainer.innerHTML = '<div class="empty">Aucune école n’est assignée à votre zone d’encadrement. Modifiez vos écoles dans ⚙️ Paramètres → Mon Profil.</div>';
      return;
    }
    const { data: classes, error } = await supabase.from('classes').select('*').in('school_id', schoolIds).order('name');
    if (error) throw error;
    const list = classes || [];
    viewContainer.innerHTML = `
      <div class="card">
        <h3>Registre d'appel — Fiche d'Arrêt Mensuel &amp; Synthèse Annuelle</h3>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:240px">
            <label>Classe</label>
            <select id="encRegClass">
              <option value="">-- Choisir une classe --</option>
              ${list.map(c => `<option value="${esc(c.id)}">${esc(formatClassName(c))}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:200px">
            <label>Mois clôturé</label>
            <select id="encRegMonth" style="width:100%"><option value="">-- Choisir --</option></select>
          </div>
          <button class="btn" onclick="window.print()">🖨️ Imprimer / PDF</button>
          <button type="button" class="btn" data-action="visa-encadreur">✍️ Viser le mois</button>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div id="encRegSheet" class="portrait-sheet"><p style="color:#64748b">Sélectionnez une classe pour afficher sa Fiche d'Arrêt Mensuel.</p></div>
      </div>
      <div class="card monthly-register-sheet" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <h3 style="margin:0">${ANNUAL_SYNTHESIS_TITLE}</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn" data-action="enc-reg-summary-preview">👁 Aperçu</button>
            <button type="button" class="btn" data-action="enc-reg-summary-pdf">📄 PDF (A4 paysage)</button>
            <button type="button" class="btn secondary" data-action="enc-reg-summary-print">🖨️ Imprimer</button>
            <button type="button" class="btn" data-action="enc-reg-summary-csv">📥 Excel/CSV</button>
          </div>
        </div>
        <div id="encRegSummary" style="margin-top:12px"><p style="color:#64748b">Sélectionnez une classe pour afficher la synthèse annuelle.</p></div>
      </div>`;
    const sel = viewContainer.querySelector('#encRegClass');
    if (sel) sel.addEventListener('change', renderEncRegSheet);
    wirePDFExportButton(
      viewContainer.querySelector('[data-action="enc-reg-summary-pdf"]'),
      () => viewContainer.querySelector('#encRegSummary')?.closest('.monthly-register-sheet'),
      'synthese_mois_arretes.pdf',
      { orientation: 'landscape', format: 'a4', margin: 10 }
    );
  }

  async function renderEncRegSheet() {
    const classId = viewContainer.querySelector('#encRegClass')?.value;
    const sheetEl = viewContainer.querySelector('#encRegSheet');
    const summaryEl = viewContainer.querySelector('#encRegSummary');
    const monthSel = viewContainer.querySelector('#encRegMonth');
    if (!sheetEl) return;
    if (!classId) {
      if (monthSel) monthSel.innerHTML = '<option value="">-- Choisir --</option>';
      sheetEl.innerHTML = '<p style="color:#64748b">Sélectionnez une classe.</p>';
      if (summaryEl) summaryEl.innerHTML = '<p style="color:#64748b">Sélectionnez une classe pour afficher la synthèse annuelle.</p>';
      encMonthlyRows = [];
      encSelectedMonth = null;
      return;
    }
    const { data: cls } = await supabase.from('classes').select('*').eq('id', classId).single();
    if (!cls) {
      sheetEl.innerHTML = '';
      if (summaryEl) summaryEl.innerHTML = '';
      encMonthlyRows = [];
      return;
    }
    const { data: students } = await supabase.from('students').select('*').eq('class_id', classId);
    const { data: presences } = await supabase.from('presences').select('*').eq('classe_id', classId);
    const absences = (presences || []).filter(p => p.statut === 'A');
    const startYear = parseInt((cls.year || state.activeSchoolYear || '2026-2027').split('-')[0], 10) || 2026;
    const months = schoolMonths(startYear);
    const { data: configs } = await supabase.from('registre_configs').select('*').eq('classe_id', classId);
    const joursPointesByMonth = {};
    const closedSet = new Set();
    const configByMonth = {};
    (configs || []).forEach(c => {
      joursPointesByMonth[c.mois] = (c.jours_valides && c.jours_valides.length ? c.jours_valides : c.jours_pointes) || [];
      if (c.mois_cloture) closedSet.add(c.mois);
      configByMonth[c.mois] = c;
    });
    const closedMonths = months.filter(m => closedSet.has(m.name));
    encMonthlyRows = computeMonthlyRegister(students || [], absences, startYear, joursPointesByMonth).filter(r => closedSet.has(r.name));
    encVisaDirecteurByMonth = {};
    encVisaEncadreurByMonth = {};
    encVisaDirectorStamps = {};
    encVisaEncadreurStamps = {};
    closedMonths.forEach(month => {
      encVisaDirecteurByMonth[month] = (configByMonth[month] && configByMonth[month].visa_directeur) || '';
      encVisaEncadreurByMonth[month] = (configByMonth[month] && configByMonth[month].visa_encadreur) || '';
      encVisaDirectorStamps[month] = (configByMonth[month] && configByMonth[month].visa_directeur_nom)
        ? { date: (configByMonth[month] && configByMonth[month].visa_directeur_date) || '', nom: configByMonth[month].visa_directeur_nom, signatureUrl: (configByMonth[month] && configByMonth[month].visa_directeur_signature) || '' }
        : null;
      encVisaEncadreurStamps[month] = (configByMonth[month] && configByMonth[month].visa_encadreur_nom)
        ? { date: (configByMonth[month] && configByMonth[month].visa_encadreur_date) || '', nom: configByMonth[month].visa_encadreur_nom, signatureUrl: (configByMonth[month] && configByMonth[month].visa_encadreur_signature) || '' }
        : null;
    });
    const active = closedMonths.find(m => m.name === encSelectedMonth) || closedMonths[0] || null;
    encSelectedMonth = active ? active.name : null;
    if (monthSel) {
      monthSel.innerHTML = closedMonths.length
        ? closedMonths.map(m => `<option value="${esc(m.name)}" ${encSelectedMonth === m.name ? 'selected' : ''}>${esc(m.name)}</option>`).join('')
        : '<option value="">Aucun mois clôturé</option>';
    }
    let schoolName = '';
    if (cls.school_id) { const { data: school } = await supabase.from('schools').select('name').eq('id', cls.school_id).single(); schoolName = (school && school.name) || ''; }
    let teacherNames = [];
    let teacherSigners = [];
    try {
      const { data: links } = await supabase.from('class_teachers').select('teacher_id, profiles(id,full_name,signature_url)').eq('class_id', classId);
      teacherSigners = (links || []).map(link => link.profiles).filter(person => person && person.full_name && !String(person.full_name).includes('Aperçu'));
      teacherNames = teacherSigners.map(person => person.full_name);
    } catch (e) { /* ignore */ }
    if (!teacherNames.length && cls.titulaire_id) {
      const { data: t } = await supabase.from('profiles').select('id,full_name,signature_url').eq('id', cls.titulaire_id).single();
      if (t) { teacherNames = [t.full_name]; teacherSigners = [t]; }
    }
    if (active) {
      const data = computeFicheArretMensuel(students || [], absences, active, joursPointesByMonth[active.name] || []);
      const visa = (configByMonth[active.name] && configByMonth[active.name].visa_directeur) || '';
      sheetEl.innerHTML = renderFicheArretMensuelHTML({
        schoolName,
        className: formatClassName(cls),
        monthName: active.name,
        data,
        teacherNames,
        teacherSigners,
        visaDirecteur: visa,
        visaDirecteurSignatureProfile: actualProfile.role === 'directeur' && profileMatchesVisa(visa, actualProfile) ? actualProfile : null,
        showVisaButton: false,
        onVisaLabel: ''
      });
    } else {
      sheetEl.innerHTML = '<p style="color:#64748b">Aucun mois clôturé pour cette classe. La Fiche Synthèse Annuelle ci-dessous reste visible et se remplira au fil des mois arrêtés.</p>';
    }
    if (summaryEl) {
      summaryEl.innerHTML = renderMonthlyRegisterTable(encMonthlyRows, {
        visaDirecteurByMonth: encVisaDirecteurByMonth,
        visaEncadreurByMonth: encVisaEncadreurByMonth,
        visaDirectorStamps: encVisaDirectorStamps,
        visaEncadreurStamps: encVisaEncadreurStamps,
        visaAction: 'visa-encadreur',
        visaDirecteurProfile: actualProfile.role === 'directeur' ? actualProfile : null,
        visaEncadreurProfile: actualProfile.role === 'encadreur' ? actualProfile : null
      });
    }
  }

  function exportEncMonthlyCSV() {
    if (!encMonthlyRows.length) { alert('Aucun mois clôturé à exporter.'); return; }
    downloadCSV('synthese_mois_arretes.csv', monthlyRegisterCSVRows(encMonthlyRows, {
      visaDirecteurByMonth: encVisaDirecteurByMonth,
      visaEncadreurByMonth: encVisaEncadreurByMonth
    }));
  }

  async function loadPaiForEncadreur(classId, term) {
    try {
      return await loadPaiRecord(supabase, classId, term);
    } catch (error) {
      console.error('Impossible de charger le PAI pour l’Encadreur.', error);
      alert('Impossible de charger les données du PAI : ' + (error && error.message ? error.message : String(error)));
      return null;
    }
  }

  function previewCurrentEncQuarterly() {
    if (!currentEncQuarterly || !currentEncQuarterlySheetId) {
      alert('Ouvrez une fiche synthèse trimestrielle avant l’aperçu.');
      return;
    }
    const sheet = viewContainer.querySelector('#' + currentEncQuarterlySheetId);
    if (!sheet) return;
    const previewSheet = sheet.cloneNode(true);
    previewSheet.querySelectorAll('.no-print, button').forEach(node => node.remove());
    const term = currentEncQuarterly.term;
    openPreview({
      title: 'Fiche Synthèse Trimestrielle — T' + term,
      html: previewSheet.innerHTML,
      onPrint: printPage,
      onCSV: exportCurrentEncQuarterlyCSV
    });
  }

  function exportCurrentEncQuarterlyCSV() {
    if (!currentEncQuarterly) {
      alert('Ouvrez une fiche synthèse trimestrielle avant l’export Excel.');
      return;
    }
    const { cls, schoolName, students, subjects, notes, term, pai } = currentEncQuarterly;
    const list = students || [];
    const subjectRows = computeSubjectRows(list, subjects, notes, term);
    const averageSummary = computeClassAverageSummary(list, subjects, notes, term);
    const boys = list.filter(student => student.gender === 'M').length;
    const girls = list.filter(student => student.gender === 'F').length;
    const matched = subjectRows.find(row =>
      row.tComp > 0 &&
      normalizePaiDiscipline(row.name) === normalizePaiDiscipline(pai && pai.discipline)
    );
    const tauxDepart = pai && pai.taux_depart != null && pai.taux_depart !== '' ? Number(pai.taux_depart) : null;
    const tauxTrim = matched
      ? matched.pctT
      : (pai && pai.taux_trimestre != null && pai.taux_trimestre !== '' ? Number(pai.taux_trimestre) : null);
    const ecart = tauxDepart != null && tauxTrim != null ? Math.round((tauxTrim - tauxDepart) * 10) / 10 : null;
    const rows = [
      ['Fiche Synthèse Trimestrielle', 'T' + term],
      ['École', schoolName || ''],
      ['Classe', formatClassName(cls)],
      ['Effectif inscrit — Garçons / Filles / Total', boys, girls, list.length],
      [],
      ['Matière', 'G ayant la moyenne', '% G', 'F ayant la moyenne', '% F', 'Total ayant la moyenne', '% Total'],
      ...subjectRows.map(row => [
        row.name,
        row.bPass + '/' + row.bComp,
        row.pctG + '%',
        row.gPass + '/' + row.gComp,
        row.pctF + '%',
        row.tPass + '/' + row.tComp,
        row.pctT + '%'
      ]),
      [],
      ['Plus forte moyenne', averageSummary.highest == null ? '' : averageSummary.highest.toFixed(2) + ' / 10'],
      ['Plus faible moyenne', averageSummary.lowest == null ? '' : averageSummary.lowest.toFixed(2) + ' / 10'],
      ['Moyenne de la classe', averageSummary.classAverage == null ? '' : averageSummary.classAverage.toFixed(2) + ' / 10'],
      [],
      ['PAI — Discipline', pai && pai.discipline || ''],
      ['PAI — Taux de début d’année (%)', tauxDepart == null ? '' : tauxDepart],
      ['PAI — Taux du trimestre (%)', tauxTrim == null ? '' : tauxTrim],
      ['PAI — Écart (%)', ecart == null ? '' : ecart],
      ['Difficultés', pai && pai.difficultes || ''],
      ['Suggestions', pai && pai.suggestions || '']
    ];
    downloadCSV('fiche_synthese_T' + term + '.csv', rows);
  }

  async function renderEncFicheSynthese() {
    currentEncQuarterly = null;
    currentEncQuarterlySheetId = null;
    const previousSchool = viewContainer.querySelector('#fsSchool')?.value || '';
    const previousClass = viewContainer.querySelector('#fsClass')?.value || '';
    const previousTerm = viewContainer.querySelector('#fsTerm')?.value || '1';
    let schools;
    let classes;
    try {
      schools = await getFollowedSchools();
      const schoolIds = schools.map(school => school.id);
      const result = schoolIds.length
        ? await supabase.from('classes').select('*').in('school_id', schoolIds).order('name')
        : { data: [], error: null };
      if (result.error) throw result.error;
      classes = result.data || [];
    } catch (error) {
      console.error('Impossible de charger les écoles assignées.', error);
      viewContainer.innerHTML = `<div class="empty" role="alert">Impossible de charger les écoles assignées : ${esc(error && error.message ? error.message : error)}</div>`;
      return;
    }
    const selectedSchool = schools.some(s => s.id === previousSchool) ? previousSchool : '';
    const schoolClasses = (classes || []).filter(c => !selectedSchool || c.school_id === selectedSchool);
    const selectedClass = schoolClasses.some(c => c.id === previousClass) ? previousClass : '';
    viewContainer.innerHTML = `
      <div class="card">
        <h3>Fiche Synthèse Trimestrielle</h3>
        <p>Sélectionnez une école, une classe et un trimestre pour afficher la fiche officielle.</p>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:240px">
            <label>École</label>
            <select id="fsSchool">
              <option value="" ${selectedSchool ? '' : 'selected'}>-- Choisir une école --</option>
              ${schools.map(s => `<option value="${esc(s.id)}" ${selectedSchool === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:220px">
            <label>Classe</label>
            <select id="fsClass">
              <option value="">-- Choisir une classe --</option>
              ${schoolClasses.map(c => `<option value="${esc(c.id)}" ${selectedClass === c.id ? 'selected' : ''}>${esc(formatClassName(c))}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:150px">
            <label>Trimestre</label>
            <select id="fsTerm">
              <option value="1" ${previousTerm === '1' ? 'selected' : ''}>1er Trimestre</option>
              <option value="2" ${previousTerm === '2' ? 'selected' : ''}>2e Trimestre</option>
              <option value="3" ${previousTerm === '3' ? 'selected' : ''}>3e Trimestre</option>
            </select>
          </div>
          <button class="btn" data-action="preview-quarterly-synth" style="margin-bottom:2px">👁 Aperçu</button>
          <button class="btn" data-action="csv-quarterly-synth" style="margin-bottom:2px">📥 Exporter en Excel</button>
          <button class="btn" data-action="fs-synth-pdf" style="margin-bottom:2px">📄 Exporter en PDF</button>
          <button class="btn secondary" data-action="fs-synth-word" style="margin-bottom:2px">📝 Exporter en Word (.doc)</button>
          <button class="btn secondary" onclick="window.print()" style="margin-bottom:2px">🖨️ Imprimer</button>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div id="fsSheet"><p style="color:#64748b">Sélectionnez une classe pour afficher la fiche.</p></div>
      </div>`;
    const fsSchool = viewContainer.querySelector('#fsSchool');
    const fsClass = viewContainer.querySelector('#fsClass');
    const fsTerm = viewContainer.querySelector('#fsTerm');
    if (fsSchool) fsSchool.addEventListener('change', renderEncFicheSynthese);
    if (fsClass) fsClass.addEventListener('change', renderFsSheet);
    if (fsTerm) fsTerm.addEventListener('change', renderFsSheet);
    wirePDFExportButton(
      viewContainer.querySelector('[data-action="fs-synth-pdf"]'),
      () => viewContainer.querySelector('#fsSheet'),
      () => `fiche_synthese_T${viewContainer.querySelector('#fsTerm')?.value || '1'}.pdf`,
      { orientation: 'portrait', format: 'a4', margin: 12 }
    );
    wireWordExportButton(
      viewContainer.querySelector('[data-action="fs-synth-word"]'),
      () => viewContainer.querySelector('#fsSheet'),
      () => `fiche_synthese_T${viewContainer.querySelector('#fsTerm')?.value || '1'}.doc`,
      'Fiche Synthèse Trimestrielle'
    );
    if (selectedClass) await renderFsSheet();
  }

  async function renderFsSheet() {
    const classId = viewContainer.querySelector('#fsClass')?.value;
    const term = parseInt(viewContainer.querySelector('#fsTerm')?.value || '1', 10);
    const sheetEl = viewContainer.querySelector('#fsSheet');
    if (!sheetEl) return;
    if (!classId) { currentEncQuarterly = null; currentEncQuarterlySheetId = null; sheetEl.innerHTML = '<p style="color:#64748b">Sélectionnez une classe.</p>'; return; }
    const { data: cls } = await supabase.from('classes').select('*').eq('id', classId).single();
    if (!cls) { currentEncQuarterly = null; currentEncQuarterlySheetId = null; sheetEl.innerHTML = ''; return; }
    const { data: students } = await supabase.from('students').select('*').eq('class_id', classId).order('full_name');
    const list = students || [];
    let subjects = (cls.subjects || []).map(s => ({ id: s.id, name: s.name, max: s.max, coef: s.coef || 1 }));
    const { data: matieres } = await supabase.from('matieres').select('*').eq('class_id', classId);
    if (matieres && matieres.length) subjects = matieres.map(m => ({ id: m.id, name: m.nom, max: m.bareme, coef: m.coefficient != null ? m.coefficient : 1 }));
    const { data: notes } = await supabase.from('notes').select('*').eq('classe_id', classId);
    let schoolName = '';
    if (cls.school_id) { const { data: school } = await supabase.from('schools').select('name').eq('id', cls.school_id).single(); schoolName = (school && school.name) || ''; }
    let teacherNames = [];
    let teacherSigners = [];
    try {
      const { data: links } = await supabase.from('class_teachers').select('teacher_id, profiles(id,full_name,signature_url)').eq('class_id', classId);
      teacherSigners = (links || []).map(link => link.profiles).filter(person => person && person.full_name && !String(person.full_name).includes('Aperçu'));
      teacherNames = teacherSigners.map(person => person.full_name);
    } catch (e) { /* ignore */ }
    if (!teacherNames.length && cls.titulaire_id) {
      const { data: t } = await supabase.from('profiles').select('id,full_name,signature_url').eq('id', cls.titulaire_id).single();
      if (t) {
        teacherNames = [t.full_name];
        teacherSigners = [t];
      }
    }
    const pai = await loadPaiForEncadreur(classId, term);
    const { data: visaConfigs } = await supabase.from('registre_configs').select('visa_directeur').eq('classe_id', classId);
    const visaDirecteur = (visaConfigs || []).map(config => config.visa_directeur).find(Boolean) || '';
    const visaDirecteurSignatureUrl = actualProfile.role === 'directeur' && profileMatchesVisa(visaDirecteur, actualProfile)
      ? signatureUrlForProfile(actualProfile)
      : '';
    currentEncQuarterly = { cls, schoolName, students: list, subjects, notes: notes || [], term, pai };
    currentEncQuarterlySheetId = 'fsSheet';
    sheetEl.innerHTML = renderSyntheseHTML({ schoolName, cls, students: list, subjects, notes: notes || [], term, pai, teacherNames, teacherSigners, visaDirecteur, visaDirecteurSignatureUrl, editable: false });
  }

  async function renderEcoles() {
    currentEncQuarterly = null;
    currentEncQuarterlySheetId = null;
    encadreurSchools = await getFollowedSchools();
    if (!encadreurSchools.length) {
      viewContainer.innerHTML = '<div class="empty">Aucune école n’est assignée à votre zone d’encadrement. Modifiez vos écoles dans ⚙️ Paramètres → Mon Profil.</div>';
      return;
    }
    if (!selectedSchoolId) selectedSchoolId = encadreurSchools[0].id;
    const school = encadreurSchools.find(s => s.id === selectedSchoolId) || encadreurSchools[0];

    const [tituRes, classRes, stuRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('school_id', school.id).eq('role', 'titulaire').order('full_name'),
      supabase.from('classes').select('*').eq('school_id', school.id).order('name'),
      supabase.from('students').select('*').eq('school_id', school.id)
    ]);
    const titulaires = tituRes.data || [];
    const classes = classRes.data || [];
    const students = stuRes.data || [];
    const boys = students.filter(s => s.gender === 'M').length;
    const girls = students.filter(s => s.gender === 'F').length;

    const perClass = {};
    students.forEach(s => {
      perClass[s.class_id] = perClass[s.class_id] || { boys: 0, girls: 0, total: 0 };
      perClass[s.class_id].total++;
      if (s.gender === 'M') perClass[s.class_id].boys++;
      else if (s.gender === 'F') perClass[s.class_id].girls++;
    });
    const tituName = {};
    titulaires.forEach(t => { tituName[t.id] = t.full_name; });
    const classOfTeacher = {};
    classes.forEach(c => {
      if (c.titulaire_id) classOfTeacher[c.titulaire_id] = formatClassName(c);
    });

    viewContainer.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <h3 style="margin:0">Écoles de la CEB (${encadreurSchools.length})</h3>
          <div class="form-group" style="margin:0;min-width:240px">
            <label>École</label>
            <select id="encSchool">
              ${encadreurSchools.map(s => `<option value="${esc(s.id)}" ${s.id === school.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="stat-row">
          <div class="stat-box"><strong>${students.length}</strong><span>Élèves</span></div>
          <div class="stat-box"><strong>${boys}</strong><span>Garçons</span></div>
          <div class="stat-box"><strong>${girls}</strong><span>Filles</span></div>
          <div class="stat-box"><strong>${classes.length}</strong><span>Classes</span></div>
          <div class="stat-box"><strong>${titulaires.length}</strong><span>Titulaires</span></div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>Titulaires de ${esc(school.name)}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Nom et Prénom</th><th>Classe tenue</th><th>WhatsApp</th></tr></thead>
            <tbody>
              ${titulaires.map((t, i) => {
                const phone = (t.whatsapp || t.whatsapp_phone || '').replace('+', '');
                return `<tr><td>${i + 1}</td><td><strong>${esc(t.full_name)}</strong></td><td>${esc(classOfTeacher[t.id] || '—')}</td><td>${phone ? `<a href="https://wa.me/${esc(phone)}" target="_blank" rel="noopener">${esc(t.whatsapp || t.whatsapp_phone)}</a>` : '—'}</td></tr>`;
              }).join('') || '<tr><td colspan="4">Aucun titulaire</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card landscape-sheet wide-sheet" style="margin-top:16px">
        <h3>Classes & effectifs — ${esc(school.name)}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Classe</th><th>Titulaire</th><th>G</th><th>F</th><th>Total</th></tr></thead>
            <tbody>
              ${classes.map((c, i) => {
                const p = perClass[c.id] || { boys: 0, girls: 0, total: 0 };
                return `<tr><td>${i + 1}</td><td><strong>${esc(formatClassName(c))}</strong></td><td>${c.titulaire_id ? esc(tituName[c.titulaire_id] || '—') : '—'}</td><td>${p.boys}</td><td>${p.girls}</td><td><strong>${p.total}</strong></td></tr>`;
              }).join('') || '<tr><td colspan="6">Aucune classe</td></tr>'}
              <tr style="background:#f8fafc;font-weight:700">
                <td></td><td>Total</td><td></td><td>${boys}</td><td>${girls}</td><td>${students.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>Fiche Synthèse Trimestrielle — ${esc(school.name)}</h3>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:240px">
            <label>Classe</label>
            <select id="encSynthClass">
              <option value="">-- Choisir une classe --</option>
              ${classes.map(c => `<option value="${esc(c.id)}">${esc(formatClassName(c))}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:150px">
            <label>Trimestre</label>
            <select id="encSynthTerm">
              <option value="1">1er Trimestre</option>
              <option value="2">2e Trimestre</option>
              <option value="3">3e Trimestre</option>
            </select>
          </div>
          <button class="btn" data-action="preview-quarterly-synth" style="margin-bottom:2px">👁 Aperçu</button>
          <button class="btn" data-action="csv-quarterly-synth" style="margin-bottom:2px">📥 Exporter en Excel</button>
          <button class="btn" data-action="enc-school-synth-pdf" style="margin-bottom:2px">📄 Exporter en PDF</button>
          <button class="btn secondary" data-action="enc-school-synth-word" style="margin-bottom:2px">📝 Exporter en Word (.doc)</button>
          <button class="btn secondary" onclick="window.print()" style="margin-bottom:2px">🖨️ Imprimer</button>
        </div>
        <div id="encSynthSheet" style="margin-top:12px">
          <p style="color:#64748b">Sélectionnez une classe pour afficher la fiche de synthèse.</p>
        </div>
      </div>

      </div>
    `;
    wirePDFExportButton(
      viewContainer.querySelector('[data-action="enc-school-synth-pdf"]'),
      () => viewContainer.querySelector('#encSynthSheet'),
      () => `fiche_synthese_${selectedSchoolId || 'ecole'}_T${viewContainer.querySelector('#encSynthTerm')?.value || '1'}.pdf`,
      { orientation: 'portrait', format: 'a4', margin: 12 }
    );
    wireWordExportButton(
      viewContainer.querySelector('[data-action="enc-school-synth-word"]'),
      () => viewContainer.querySelector('#encSynthSheet'),
      () => `fiche_synthese_${selectedSchoolId || 'ecole'}_T${viewContainer.querySelector('#encSynthTerm')?.value || '1'}.doc`,
      'Fiche Synthèse Trimestrielle'
    );
  }

  async function renderEncSynthese() {
    const classId = viewContainer.querySelector('#encSynthClass')?.value;
    const term = parseInt(viewContainer.querySelector('#encSynthTerm')?.value || '1', 10);
    const sheetEl = viewContainer.querySelector('#encSynthSheet');
    if (!sheetEl) return;
    if (!classId) { currentEncQuarterly = null; currentEncQuarterlySheetId = null; sheetEl.innerHTML = '<p style="color:#64748b">Sélectionnez une classe.</p>'; return; }
    const { data: cls } = await supabase.from('classes').select('*').eq('id', classId).single();
    if (!cls) { currentEncQuarterly = null; currentEncQuarterlySheetId = null; sheetEl.innerHTML = ''; return; }
    const { data: students } = await supabase.from('students').select('*').eq('class_id', classId).order('full_name');
    const list = students || [];
    let subjects = (cls.subjects || []).map(s => ({ id: s.id, name: s.name, max: s.max, coef: s.coef || 1 }));
    const { data: matieres } = await supabase.from('matieres').select('*').eq('class_id', classId);
    if (matieres && matieres.length) subjects = matieres.map(m => ({ id: m.id, name: m.nom, max: m.bareme, coef: m.coefficient != null ? m.coefficient : 1 }));
    const { data: notes } = await supabase.from('notes').select('*').eq('classe_id', classId);
    let schoolName = '';
    if (cls.school_id) { const { data: school } = await supabase.from('schools').select('name').eq('id', cls.school_id).single(); schoolName = (school && school.name) || ''; }
    let teacherNames = [];
    let teacherSigners = [];
    try {
      const { data: links } = await supabase.from('class_teachers').select('teacher_id, profiles(id,full_name,signature_url)').eq('class_id', classId);
      teacherSigners = (links || []).map(link => link.profiles).filter(person => person && person.full_name && !String(person.full_name).includes('Aperçu'));
      teacherNames = teacherSigners.map(person => person.full_name);
    } catch (e) { /* ignore */ }
    if (!teacherNames.length && cls.titulaire_id) {
      const { data: t } = await supabase.from('profiles').select('id,full_name,signature_url').eq('id', cls.titulaire_id).single();
      if (t) {
        teacherNames = [t.full_name];
        teacherSigners = [t];
      }
    }
    const pai = await loadPaiForEncadreur(classId, term);
    const { data: visaConfigs } = await supabase.from('registre_configs').select('visa_directeur').eq('classe_id', classId);
    const visaDirecteur = (visaConfigs || []).map(config => config.visa_directeur).find(Boolean) || '';
    currentEncQuarterly = { cls, schoolName, students: list, subjects, notes: notes || [], term, pai };
    currentEncQuarterlySheetId = 'encSynthSheet';
    const visaDirecteurSignatureUrl = actualProfile.role === 'directeur' && profileMatchesVisa(visaDirecteur, actualProfile)
      ? signatureUrlForProfile(actualProfile)
      : '';
    sheetEl.innerHTML = renderSyntheseHTML({ schoolName, cls, students: list, subjects, notes: notes || [], term, pai, teacherNames, teacherSigners, visaDirecteur, visaDirecteurSignatureUrl, editable: false });
  }

  async function renderSynthese() {
    const schools = await getFollowedSchools();

    const rows = [];
    let totalComposed = 0, totalStudents = 0;

    for (const school of schools) {
      const { data: classes } = await supabase.from('classes').select('*').eq('school_id', school.id);
      for (const cls of (classes || [])) {
        if (!['CM1', 'CM2'].includes(cls.level)) continue;
        const { data: exams } = await supabase.from('exam_blancs').select('*').eq('class_id', cls.id);
        for (const exam of (exams || [])) {
          const { data: ebStudents } = await supabase
            .from('exam_blanc_students')
            .select('composed, students(gender)')
            .eq('exam_blanc_id', exam.id);
          const list = ebStudents || [];
          const composedG = list.filter(x => x.composed && x.students && x.students.gender === 'M').length;
          const composedF = list.filter(x => x.composed && x.students && x.students.gender === 'F').length;
          const composed = composedG + composedF;
          totalComposed += composed;
          totalStudents += list.length;
          rows.push({ school, cls, exam, composedG, composedF, composed, total: list.length });
        }
      }
    }

    viewContainer.innerHTML = `
      <div class="card">
        <h3>Examens Blancs (CM1/CM2) & Synthèse</h3>
        <p>Récapitulatif automatique pour vos écoles suivies.</p>
        <div class="stat-row">
          <div class="stat-box"><strong>${totalComposed}</strong><span>Ont composé</span></div>
          <div class="stat-box"><strong>${totalStudents}</strong><span>Élèves évalués</span></div>
          <div class="stat-box"><strong>${totalStudents ? Math.round((totalComposed / totalStudents) * 1000) / 10 : 0}%</strong><span>Taux de composition</span></div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>École</th><th>Classe</th><th>Examen</th><th>G composent</th><th>F composent</th><th>Total composé</th></tr></thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${esc(r.school.name)}</td>
                  <td>${esc(formatClassName(r.cls))}</td>
                  <td>${esc(r.exam.name)}</td>
                  <td>${r.composedG}</td>
                  <td>${r.composedF}</td>
                  <td><strong>${r.composed}/${r.total}</strong></td>
                </tr>
              `).join('') || '<tr><td colspan="6">Aucun examen blanc enregistré.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Stocker pour l'export
    viewContainer._syntheseRows = rows;
  }

  function exportSyntheseCSV() {
    const rows = viewContainer._syntheseRows || [];
    if (!rows.length) { alert('Aucune donnée à exporter. Ouvrez la synthèse.'); return; }
    const csv = [['École', 'Classe', 'Examen', 'G composent', 'F composent', 'Total composé', 'Total']];
    rows.forEach(r => csv.push([r.school.name, formatClassName(r.cls), r.exam.name, r.composedG, r.composedF, r.composed, r.total]));
    const content = csv.map(r => r.map(c => {
      const str = String(c == null ? '' : c);
      return /[",\n;]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
    }).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'synthese_examens_blancs.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  container.querySelector('[data-action="export-synthese"]')?.addEventListener('click', exportSyntheseCSV);

  renderSubView('ecoles');
}