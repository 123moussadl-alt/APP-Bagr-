/**
 * Vue Chef CEB — Écoles, personnel et synthèses
 * Pattern : render (HTML shell) + setup (logique + délégation d'événements)
 */

import { esc, formatClassName } from '../utils/format.js';
import { downloadCSV, printPage, wirePDFExportButton, wireWordExportButton } from '../utils/export.js';
import * as XLSX from 'xlsx';
import { getAgentEmployment, getAgentFunction, getAgentNameParts } from '../utils/agents.js';
import { getClassResult } from '../utils/stats.js';
import { openPreview } from '../utils/preview.js';
import { profileMatchesVisa, signatureBlockHTML, signatureUrlForProfile } from '../utils/signature.js';
import { computeSubjectRows, renderSyntheseHTML } from '../utils/synthese.js';
import { loadPaiRecord } from '../utils/pai.js';
import { mergeSchoolChoices } from '../utils/schools.js';
import {
  computeSchoolTermSynthesis, loadSchoolTermData, renderSchoolTermSynthesisHTML,
  schoolTermSynthesisCSVRows
} from '../utils/synthese-ecole.js';

export function renderChefCEB(state, render, supabase) {
  const profile = state.profile;
  if (!profile) return '<div>Chargement...</div>';

  return `
    <div class="role-layout">
      <aside class="role-sidebar">
        <div class="role-brand">
          <strong>Educ CEB</strong>
          <span>Chef CEB — ${esc(profile.full_name)}</span>
        </div>
        <nav class="role-nav">
          <button class="nav-item active" data-view="ecoles">🏫 Toutes les écoles</button>
          <button class="nav-item" data-view="personnel">👥 Personnel des écoles et de la CEB</button>
          <button class="nav-item" data-view="synthese">📊 Synthèse CEB</button>
          <button class="nav-item" data-view="synthese-trim">📈 Synthèse trimestrielle</button>
          <button class="nav-item" data-view="synthese-ecole">📋 Synthèse trimestrielle d'école</button>
        </nav>
        <div class="role-footer">
          <button class="btn-logout" onclick="window.logout()">Déconnexion</button>
        </div>
      </aside>

      <div class="role-content">
        <header class="role-topbar">
          <div>
            <h1 id="pageTitle">Toutes les écoles</h1>
            <p id="pageSubtitle">Gestion des écoles et synthèses de la CEB de Bagré</p>
          </div>
          <div class="top-actions">
            <button class="btn" data-action="preview-current">👁 Aperçu</button>
            <button class="btn" data-action="export-synthese">📥 Exporter Excel/CSV</button>
            <button class="btn" data-action="export-pdf">📄 Exporter en PDF</button>
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

export function setupChefCEB(container, state, render, supabase) {
  const viewContainer = container.querySelector('#viewContainer');
  const navItems = Array.from(container.querySelectorAll('.nav-item'));
  const activeProfile = state.realProfile || state.profile || {};
  const chefCebSigners = activeProfile.role === 'chef_ceb' ? [activeProfile] : [];
  let activeSubView = 'ecoles';
  let activeStaffTab = 'schools';
  let staffProfiles = [];
  let staffSchools = [];
  let staffClasses = [];
  let staffDirectoryLoaded = false;
  let syntheseRows = [];
  let syntheseTotals = null;
  let syntheseMode = 'ecole';
  let trimRows = [];
  let schoolTermSchoolId = '';
  let schoolTermClassId = '';
  let schoolTermMode = 'school';
  let schoolTerm = 1;
  let schoolTermExport = null;
  wirePDFExportButton(
    container.querySelector('[data-action="export-pdf"]'),
    () => viewContainer,
    () => `${container.querySelector('#pageTitle')?.textContent || 'Document'}_chef_ceb.pdf`,
    { orientation: 'landscape', format: 'a4', margin: 10 }
  );

  function exportTrimCSV() {
    const rows = [['École', 'Classe', 'Moyenne annuelle', 'T1', 'T2', 'T3', '% Réussite']];
    trimRows.forEach(r => {
      const passRates = [1, 2, 3].map(t => r.res.terms[t].passRate).filter(v => v != null);
      const avgPass = passRates.length ? Math.round((passRates.reduce((a, b) => a + b, 0) / passRates.length) * 10) / 10 : 0;
      rows.push([r.school.name, formatClassName(r.res.cls), r.res.annualAvg != null ? r.res.annualAvg : '', r.res.terms[1].avg, r.res.terms[2].avg, r.res.terms[3].avg, avgPass + '%']);
    });
    downloadCSV('synthese_trimestrielle_ceb.csv', rows);
  }

  container.querySelector('[data-action="export-trim"]')?.addEventListener('click', exportTrimCSV);

  function exportSyntheseCSV() {
    const rows = [['N°', 'École', 'Classe', 'Examen', 'G composent', 'F composent', 'Total composé', 'Total']];
    syntheseRows.forEach((r, i) => rows.push([i + 1, r.school.name, formatClassName(r.cls), r.exam.name, r.composedG, r.composedF, r.composed, r.total]));
    if (syntheseTotals) {
      rows.push(['', 'TOTAL CEB', '', '', syntheseTotals.composedG, syntheseTotals.composedF, syntheseTotals.composed, syntheseTotals.total]);
    }
    downloadCSV('synthese_ceb.csv', rows);
  }

  container.querySelector('[data-action="export-synthese"]')?.addEventListener('click', () => {
    if (activeSubView === 'personnel') exportStaffExcel();
    else exportSyntheseCSV();
  });
  container.querySelector('[data-action="print-page"]')?.addEventListener('click', printPage);
  container.querySelector('[data-action="preview-current"]')?.addEventListener('click', () => {
    if (activeSubView === 'personnel') {
      previewStaffDirectory();
      return;
    }
    openPreview({ title: 'Synthèse CEB', html: viewContainer.innerHTML, onPrint: printPage, onCSV: exportSyntheseCSV });
  });

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      renderSubView(item.dataset.view);
    });
  });

  async function renderSubView(view) {
    if (!viewContainer) return;
    activeSubView = view;
    const headings = {
      ecoles: ['Toutes les écoles', 'Gestion des écoles et synthèses de la CEB de Bagré'],
      personnel: ['Personnel des écoles et de la CEB', 'Répertoire séparé par affectation'],
      synthese: ['Synthèse CEB', 'Examens blancs par école et synthèse globale'],
      'synthese-trim': ['Synthèse trimestrielle', 'Résultats annuels et par trimestre'],
      'synthese-ecole': ["Synthèse trimestrielle d'école", 'Bilan détaillé par école ou par classe'],
    };
    const [title, subtitle] = headings[view] || headings.ecoles;
    container.querySelector('#pageTitle').textContent = title;
    container.querySelector('#pageSubtitle').textContent = subtitle;
    const exportButton = container.querySelector('[data-action="export-synthese"]');
    if (exportButton) exportButton.textContent = view === 'personnel' ? '📥 Exporter en Excel' : '📥 Exporter Excel/CSV';
    switch (view) {
      case 'ecoles': return renderEcoles();
      case 'personnel': return renderStaffDirectory();
      case 'synthese': return renderSynthese();
      case 'synthese-trim': return renderSyntheseTrim();
      case 'synthese-ecole': return renderSchoolTermSynthesis();
      default: return renderEcoles();
    }
  }

  function staffProfilesForTab() {
    if (activeStaffTab === 'schools') {
      return staffProfiles.filter(profile => {
        const hasSchoolAssignment = [profile.ecole_id, profile.school_id, profile.ecole_nom]
          .some(value => String(value || '').trim());
        return ['titulaire', 'directeur'].includes(profile.role) &&
          profile.structure !== 'CEB' &&
          hasSchoolAssignment;
      });
    }

    const cebRoles = ['encadreur', 'chef-personnel', 'chef_personnel', 'statisticien'];
    return staffProfiles.filter(profile => {
      const isCurrentChef = activeProfile.id && String(profile.id) === String(activeProfile.id);
      return !isCurrentChef && (
        profile.structure === 'CEB de Bagré' ||
        cebRoles.includes(profile.role)
      );
    });
  }

  function staffClassName(profile) {
    const classId = profile.classe_id || profile.class_id;
    const classRecord = staffClasses.find(item => String(item.id) === String(classId));
    return profile.classe_tenue || profile.classe_niveau ||
      (classRecord ? formatClassName(classRecord) : '') || '—';
  }

  function staffSchoolName(profile) {
    if (profile.ecole_nom) return profile.ecole_nom;
    const schoolId = profile.ecole_id || profile.school_id;
    const school = staffSchools.find(item => String(item.id) === String(schoolId));
    return (school && school.name) || schoolId || '—';
  }

  function staffRoleLabel(profile) {
    const label = getAgentFunction(profile);
    return label === '—' ? 'Agent de la CEB' : label;
  }

  function staffGender(profile) {
    const gender = String(profile.sexe || profile.gender || '').trim().toUpperCase();
    return gender === 'M' || gender === 'F' ? gender : '—';
  }

  function currentStaffRows() {
    const schoolTab = activeStaffTab === 'schools';
    const headers = schoolTab
      ? ['N°', 'Matricule', 'Nom', 'Prénom', 'Sexe (M/F)', 'Emploi', 'Fonction', 'École', 'Classe tenue', 'Contact WhatsApp']
      : ['N°', 'Matricule', 'Nom', 'Prénom', 'Sexe (M/F)', 'Emploi', 'Fonction', 'Contact WhatsApp'];
    const rows = staffProfilesForTab().map((profile, index) => {
      const { nom, prenom } = getAgentNameParts(profile);
      const phone = profile.whatsapp || profile.whatsapp_phone || profile.telephone || '';
      const number = String(phone).replace(/\D/g, '');
      const values = schoolTab
        ? [
          index + 1,
          profile.matricule || '—',
          nom || '—',
          prenom || '—',
          staffGender(profile),
          getAgentEmployment(profile),
          getAgentFunction(profile),
          staffSchoolName(profile),
          staffClassName(profile),
          phone || '—'
        ]
        : [
          index + 1,
          profile.matricule || '—',
          nom || '—',
          prenom || '—',
          staffGender(profile),
          getAgentEmployment(profile),
          staffRoleLabel(profile),
          phone || '—'
        ];
      return {
        values,
        phoneLink: number ? `https://wa.me/${encodeURIComponent(number)}` : ''
      };
    });
    return { headers, rows, schoolTab };
  }

  function updateStaffTabHeading(schoolTab, count) {
    const title = schoolTab ? 'Enseignants des Écoles' : 'Agents de la CEB';
    container.querySelector('#pageTitle').textContent = title;
    container.querySelector('#pageSubtitle').textContent = `${count} profil(s) dans cette liste`;
  }

  async function renderStaffDirectory() {
    staffDirectoryLoaded = false;
    const [profilesResult, schoolsResult, classesResult] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('schools').select('id,name,ceb').order('name'),
      supabase.from('classes').select('id,name,level,school_id')
    ]);
    if (activeSubView !== 'personnel') return;
    const queryError = profilesResult.error || schoolsResult.error || classesResult.error;
    if (queryError) {
      staffProfiles = [];
      staffSchools = [];
      staffClasses = [];
      viewContainer.innerHTML = `<div class="card" role="alert" style="color:#b91c1c">Impossible de charger le répertoire du personnel : ${esc(queryError.message)}</div>`;
      return;
    }
    staffProfiles = profilesResult.data || [];
    staffSchools = mergeSchoolChoices(schoolsResult.data || []);
    staffClasses = classesResult.data || [];
    staffDirectoryLoaded = true;
    renderStaffTable();
  }

  function renderStaffTable() {
    const { headers, rows, schoolTab } = currentStaffRows();
    const shortColumnIndexes = [0, 1, 4, 5];
    const tabTitle = schoolTab ? 'Enseignants des Écoles' : 'Agents de la CEB';
    updateStaffTabHeading(schoolTab, rows.length);
    viewContainer.innerHTML = `
      <section id="staffDirectorySheet" class="card landscape-sheet wide-sheet ceb-staff-directory">
        <div class="ceb-staff-directory-heading">
          <h3>${tabTitle}</h3>
          <span class="ceb-staff-role-badge">Chef CEB connecté : ${esc(activeProfile.full_name || 'profil actuel')} — hors de la liste des agents</span>
        </div>
        <div class="ceb-staff-tabs no-print" role="tablist" aria-label="Catégorie du personnel">
          <button type="button" class="btn ${schoolTab ? '' : 'secondary'}" role="tab" aria-selected="${schoolTab}" aria-controls="staffDirectoryTable" data-action="staff-tab" data-staff-tab="schools">Enseignants &amp; Directeurs des Écoles</button>
          <button type="button" class="btn ${schoolTab ? 'secondary' : ''}" role="tab" aria-selected="${!schoolTab}" aria-controls="staffDirectoryTable" data-action="staff-tab" data-staff-tab="office">Agents du Bureau de la CEB</button>
        </div>
        <div class="table-wrap ceb-staff-scroll" tabindex="0" role="region" aria-label="${tabTitle}, tableau défilant horizontalement">
          <table id="staffDirectoryTable" class="ceb-staff-table">
            <thead><tr>${headers.map((header, index) => `<th class="${shortColumnIndexes.includes(index) ? 'staff-nowrap' : ''}" scope="col">${esc(header)}</th>`).join('')}</tr></thead>
            <tbody>
              ${rows.map(({ values, phoneLink }) => `
                <tr>${values.map((value, index) => {
                  const content = index === values.length - 1 && phoneLink
                    ? `<a href="${esc(phoneLink)}" target="_blank" rel="noopener">${esc(value)}</a>`
                    : esc(value);
                  return `<td class="${shortColumnIndexes.includes(index) ? 'staff-nowrap' : ''}">${content}</td>`;
                }).join('')}</tr>
              `).join('') || `<tr><td colspan="${headers.length}">Aucun profil correspondant à cette catégorie.</td></tr>`}
            </tbody>
          </table>
        </div>
        <p class="ceb-staff-count">${rows.length} profil(s) affiché(s)</p>
      </section>
    `;
  }

  function exportStaffExcel() {
    if (!staffDirectoryLoaded) {
      alert('Le répertoire du personnel n’a pas pu être chargé.');
      return;
    }
    try {
      const { headers, rows, schoolTab } = currentStaffRows();
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows.map(row => row.values)]);
      worksheet['!cols'] = headers.map(header => ({ wch: Math.min(Math.max(header.length + 3, 12), 30) }));
      if (worksheet['!ref']) worksheet['!autofilter'] = { ref: worksheet['!ref'] };
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, schoolTab ? 'Enseignants' : 'Agents CEB');
      XLSX.writeFile(workbook, schoolTab ? 'enseignants_ecoles_ceb.xlsx' : 'agents_bureau_ceb.xlsx', {
        bookType: 'xlsx',
        compression: true
      });
    } catch (error) {
      alert('Erreur lors de la création du fichier Excel : ' + (error && error.message ? error.message : String(error)));
    }
  }

  function previewStaffDirectory() {
    const sheet = viewContainer.querySelector('#staffDirectorySheet');
    if (!sheet) return;
    const previewSheet = sheet.cloneNode(true);
    previewSheet.querySelectorAll('.no-print, button').forEach(node => node.remove());
    const title = activeStaffTab === 'schools' ? 'Enseignants des Écoles' : 'Agents de la CEB';
    openPreview({
      title: `Aperçu — ${title}`,
      html: previewSheet.outerHTML,
      onPrint: printPage,
      onCSV: exportStaffExcel,
      exportLabel: '📥 Exporter en Excel'
    });
  }

  async function renderSyntheseTrim() {
    const prevSel = viewContainer.querySelector('#trimSchool')?.value || '';
    const { data: schools } = await supabase.from('schools').select('*').order('name');
    const schoolList = mergeSchoolChoices(schools || []);
    const selected = prevSel || '';
    const targetSchools = selected ? schoolList.filter(s => s.id === selected) : schoolList;

    trimRows = [];
    for (const school of targetSchools) {
      if (school.isFallback) continue;
      const { data: classes } = await supabase.from('classes').select('*').eq('school_id', school.id);
      for (const cls of (classes || [])) {
        const { data: students } = await supabase.from('students').select('*').eq('class_id', cls.id);
        const res = await getClassResult(supabase, cls, students || []);
        trimRows.push({ school, res });
      }
    }

    viewContainer.innerHTML = `
      <div class="card landscape-sheet wide-sheet">
        <h3>Synthèse trimestrielle — ${selected ? 'École sélectionnée' : 'Toute la CEB'}</h3>
        <div class="form-group" style="max-width:280px;margin-bottom:12px">
          <label>École</label>
          <select id="trimSchool">
            <option value="">Toute la CEB</option>
            ${schoolList.map(s => `<option value="${esc(s.id)}" ${selected === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>École</th><th>Classe</th><th>Moy. annuelle /10</th><th>T1</th><th>T2</th><th>T3</th><th>% Réussite</th></tr></thead>
            <tbody>
              ${trimRows.map((r, i) => {
                const passRates = [1, 2, 3].map(t => r.res.terms[t].passRate).filter(v => v != null);
                const avgPass = passRates.length ? Math.round((passRates.reduce((a, b) => a + b, 0) / passRates.length) * 10) / 10 : 0;
                return `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${esc(r.school.name)}</td>
                    <td><strong>${esc(formatClassName(r.res.cls))}</strong></td>
                    <td><strong>${r.res.annualAvg != null ? r.res.annualAvg : '—'}</strong></td>
                    <td>${r.res.terms[1].avg != null ? r.res.terms[1].avg : '—'}</td>
                    <td>${r.res.terms[2].avg != null ? r.res.terms[2].avg : '—'}</td>
                    <td>${r.res.terms[3].avg != null ? r.res.terms[3].avg : '—'}</td>
                    <td>${avgPass}%</td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="8">Aucune donnée</td></tr>'}
            </tbody>
          </table>
        </div>
        <div style="margin-top:12px">
          <button class="btn" data-action="export-trim">📥 Exporter Excel/CSV</button>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:24px">${signatureBlockHTML('Le Chef de la CEB', chefCebSigners)}</div>
      </div>
    `;

    const sel = viewContainer.querySelector('#trimSchool');
    if (sel) sel.addEventListener('change', () => renderSyntheseTrim());
  }

  async function renderSchoolTermSynthesis() {
    const schoolsResult = await supabase.from('schools').select('id,name,ceb').order('name');
    if (schoolsResult.error) {
      viewContainer.innerHTML = `<div class="card" role="alert" style="color:#b91c1c">Impossible de charger les écoles : ${esc(schoolsResult.error.message)}</div>`;
      return;
    }
    const schools = mergeSchoolChoices(schoolsResult.data || []);
    const selectedSchool = schools.find(school => String(school.id) === String(schoolTermSchoolId));
    if (!selectedSchool) {
      schoolTermSchoolId = (schools.find(school => !school.isFallback) || schools[0]).id;
    }
    const persistedSchool = schools.find(school => String(school.id) === String(schoolTermSchoolId));
    if (persistedSchool && persistedSchool.isFallback) {
      viewContainer.innerHTML = `
        <div class="card">
          <div class="form-group" style="max-width:320px">
            <label for="schoolTermSchool">École</label>
            <select id="schoolTermSchool">
              ${schools.map(school => `<option value="${esc(school.id)}" ${String(school.id) === String(schoolTermSchoolId) ? 'selected' : ''}>${esc(school.name)}</option>`).join('')}
            </select>
          </div>
          <p class="empty">Cette école officielle n’est pas encore enregistrée dans la base. Exécutez le seed de <code>supabase_setup.sql</code> pour activer ses données.</p>
        </div>`;
      viewContainer.querySelector('#schoolTermSchool')?.addEventListener('change', event => {
        schoolTermSchoolId = event.target.value;
        renderSchoolTermSynthesis();
      });
      return;
    }
    let schoolData;
    try {
      schoolData = await loadSchoolTermData(supabase, schoolTermSchoolId);
    } catch (error) {
      viewContainer.innerHTML = `<div class="card" role="alert" style="color:#b91c1c">Impossible de charger les données de l'école : ${esc(error.message || error)}</div>`;
      return;
    }
    const classesData = schoolData.classesData;
    if (!classesData.some(item => String(item.cls.id) === String(schoolTermClassId))) {
      schoolTermClassId = classesData.length ? classesData[0].cls.id : '';
    }
    const directorResult = await supabase.from('profiles')
      .select('id,full_name,signature_url').eq('school_id', schoolTermSchoolId)
      .eq('role', 'directeur').order('full_name').limit(1).maybeSingle();
    if (directorResult.error) {
      viewContainer.innerHTML = `<div class="card" role="alert" style="color:#b91c1c">Impossible de charger la signature de la Direction : ${esc(directorResult.error.message)}</div>`;
      return;
    }
    const directorSigners = directorResult.data ? [directorResult.data] : [];
    let reportHTML = '<div class="empty">Aucune classe enregistrée pour cette école.</div>';
    let summary = null;
    let classData = null;
    if (schoolTermMode === 'school') {
      summary = computeSchoolTermSynthesis(classesData, schoolTerm);
      reportHTML = renderSchoolTermSynthesisHTML({
        schoolName: schoolData.school.name,
        term: schoolTerm,
        summary,
        directorSigners,
        cebSigners: chefCebSigners
      });
    } else if (schoolTermClassId) {
      classData = classesData.find(item => String(item.cls.id) === String(schoolTermClassId));
      const linksResult = await supabase.from('class_teachers')
        .select('teacher_id, profiles(id,full_name,signature_url)')
        .eq('class_id', schoolTermClassId);
      if (linksResult.error) {
        viewContainer.innerHTML = `<div class="card" role="alert" style="color:#b91c1c">Impossible de charger les titulaires : ${esc(linksResult.error.message)}</div>`;
        return;
      }
      let teacherSigners = (linksResult.data || []).map(link => link.profiles)
        .filter(person => person && person.full_name);
      if (!teacherSigners.length && classData.cls.titulaire_id) {
        const teacherResult = await supabase.from('profiles')
          .select('id,full_name,signature_url').eq('id', classData.cls.titulaire_id).maybeSingle();
        if (teacherResult.error) {
          viewContainer.innerHTML = `<div class="card" role="alert" style="color:#b91c1c">Impossible de charger le titulaire : ${esc(teacherResult.error.message)}</div>`;
          return;
        }
        if (teacherResult.data) teacherSigners = [teacherResult.data];
      }
      let pai = null;
      try {
        pai = await loadPaiRecord(supabase, schoolTermClassId, schoolTerm);
      } catch (error) {
        viewContainer.innerHTML = `<div class="card" role="alert" style="color:#b91c1c">Impossible de charger le PAI : ${esc(error.message || error)}</div>`;
        return;
      }
      const visaResult = await supabase.from('registre_configs').select('visa_directeur')
        .eq('classe_id', schoolTermClassId);
      if (visaResult.error) {
        viewContainer.innerHTML = `<div class="card" role="alert" style="color:#b91c1c">Impossible de charger le visa de la Direction : ${esc(visaResult.error.message)}</div>`;
        return;
      }
      const visaDirecteur = (visaResult.data || []).map(config => config.visa_directeur).find(Boolean) || '';
      const matchedDirector = directorSigners.find(person => profileMatchesVisa(visaDirecteur, person));
      reportHTML = renderSyntheseHTML({
        schoolName: schoolData.school.name,
        cls: classData.cls,
        students: classData.students,
        subjects: classData.subjects,
        notes: classData.notes,
        term: schoolTerm,
        pai,
        teacherNames: teacherSigners.map(person => person.full_name),
        teacherSigners,
        visaDirecteur,
        visaDirecteurSignatureUrl: matchedDirector ? signatureUrlForProfile(matchedDirector) : '',
        editable: false
      });
    }

    schoolTermExport = { mode: schoolTermMode, school: schoolData.school, summary, classData };
    viewContainer.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:220px">
            <label for="schoolTermSchool">École</label>
            <select id="schoolTermSchool">${schools.map(school => `<option value="${esc(school.id)}" ${String(school.id) === String(schoolTermSchoolId) ? 'selected' : ''}>${esc(school.name)}</option>`).join('')}</select>
          </div>
          <div class="form-group" style="margin:0;min-width:190px">
            <label for="schoolTerm">Trimestre</label>
            <select id="schoolTerm">
              <option value="1" ${schoolTerm === 1 ? 'selected' : ''}>1er Trimestre</option>
              <option value="2" ${schoolTerm === 2 ? 'selected' : ''}>2e Trimestre</option>
              <option value="3" ${schoolTerm === 3 ? 'selected' : ''}>3e Trimestre</option>
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:220px">
            <label for="schoolTermMode">Document</label>
            <select id="schoolTermMode">
              <option value="school" ${schoolTermMode === 'school' ? 'selected' : ''}>Synthèse de toute l'école</option>
              <option value="class" ${schoolTermMode === 'class' ? 'selected' : ''}>Fiche d'une classe</option>
            </select>
          </div>
          ${schoolTermMode === 'class' ? `<div class="form-group" style="margin:0;min-width:190px">
            <label for="schoolTermClass">Classe</label>
            <select id="schoolTermClass">
              ${classesData.map(item => `<option value="${esc(item.cls.id)}" ${String(item.cls.id) === String(schoolTermClassId) ? 'selected' : ''}>${esc(formatClassName(item.cls))}</option>`).join('')}
            </select>
          </div>` : ''}
          <button type="button" class="btn" data-action="school-term-preview">👁 Aperçu</button>
          <button type="button" class="btn" id="schoolTermPdf">📄 Exporter en PDF</button>
          <button type="button" class="btn secondary" id="schoolTermWord">📝 Exporter en Word (.doc)</button>
          <button type="button" class="btn secondary" data-action="school-term-print">🖨️ Imprimer</button>
          <button type="button" class="btn secondary" data-action="school-term-excel">📥 Exporter en Excel</button>
        </div>
      </div>
      <div id="schoolTermSheet" style="margin-top:16px">${reportHTML}</div>
    `;
    const sheet = viewContainer.querySelector('#schoolTermSheet');
    const orientation = schoolTermMode === 'class' ? 'portrait' : 'landscape';
    const pdfMargins = schoolTermMode === 'class' ? 12 : 10;
    wirePDFExportButton(
      viewContainer.querySelector('#schoolTermPdf'),
      sheet,
      `synthese_ecole_${schoolTerm}_T${schoolTerm}.pdf`,
      { orientation, format: 'a4', margin: pdfMargins }
    );
    wireWordExportButton(
      viewContainer.querySelector('#schoolTermWord'),
      sheet,
      `synthese_ecole_${schoolTerm}.doc`,
      'Synthèse Trimestrielle de l’École',
      { orientation }
    );
  }

  function exportSchoolTermCSV() {
    if (!schoolTermExport) return;
    if (schoolTermExport.mode === 'school' && schoolTermExport.summary) {
      downloadCSV(
        `synthese_ecole_${schoolTerm}_T${schoolTerm}.csv`,
        schoolTermSynthesisCSVRows(schoolTermExport.school.name, schoolTerm, schoolTermExport.summary)
      );
      return;
    }
    const classData = schoolTermExport.classData;
    if (!classData) return;
    const rows = [['École', schoolTermExport.school.name], ['Classe', formatClassName(classData.cls)], ['Trimestre', schoolTerm]];
    rows.push(['Discipline', 'Garçons ayant la moyenne', 'Garçons (%)', 'Filles ayant la moyenne', 'Filles (%)', 'Total ayant la moyenne', 'Total (%)']);
    computeSubjectRows(classData.students, classData.subjects, classData.notes, schoolTerm).forEach(subject => {
      if (subject.tComp) rows.push([subject.name, subject.bPass, subject.pctG, subject.gPass, subject.pctF, subject.tPass, subject.pctT]);
    });
    downloadCSV(`fiche_synthese_${schoolTermClassId}_T${schoolTerm}.csv`, rows);
  }

  async function renderEcoles() {
    const [schoolsResult, directorsResult] = await Promise.all([
      supabase.from('schools').select('*').order('name'),
      supabase.from('profiles')
        .select('id,role,school_id,ecole_id,ecole_nom,full_name,nom,prenom,whatsapp,whatsapp_phone,telephone')
        .eq('role', 'directeur')
        .order('full_name')
    ]);
    const error = schoolsResult.error || directorsResult.error;
    if (error) {
      viewContainer.innerHTML = `<div class="card" role="alert" style="color:#b91c1c">Impossible de charger les écoles et leurs directeurs : ${esc(error.message)}</div>`;
      return;
    }
    const schoolList = mergeSchoolChoices(schoolsResult.data || []);
    const directorsBySchoolId = new Map();
    const directorsBySchoolName = new Map();
    (directorsResult.data || []).forEach(director => {
      const schoolId = director.school_id || director.ecole_id;
      if (schoolId && !directorsBySchoolId.has(String(schoolId))) {
        directorsBySchoolId.set(String(schoolId), director);
      }
      const schoolName = String(director.ecole_nom || '').trim().normalize('NFC').toLocaleLowerCase('fr-FR');
      if (schoolName && !directorsBySchoolName.has(schoolName)) directorsBySchoolName.set(schoolName, director);
    });
    viewContainer.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <h3 style="margin:0">Toutes les écoles de la circonscription</h3>
          <button type="button" class="btn" data-action="school-edit-toggle">➕ Ajouter / Modifier une école de la CEB</button>
        </div>
        <div id="schoolEditor" hidden style="margin:16px 0;padding:14px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px">
          <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
            <div class="form-group" style="margin:0;min-width:220px">
              <label for="schoolEditSelect">École à modifier</label>
              <select id="schoolEditSelect">
                <option value="__new__">Ajouter une nouvelle école</option>
                ${schoolList.map(school => `<option value="${esc(school.id)}" data-name="${esc(school.name)}" data-fallback="${school.isFallback ? 'true' : 'false'}">${esc(school.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin:0;min-width:240px;flex:1">
              <label for="schoolEditName">Nom officiel de l'école</label>
              <input id="schoolEditName" type="text" maxlength="160" placeholder='Ex. Bagré Périmètre "A"'>
            </div>
            <button type="button" class="btn" data-action="school-save">Enregistrer l'école</button>
          </div>
          <p id="schoolEditStatus" role="status" aria-live="polite"></p>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>École</th><th>Directeur / Directrice</th><th>Contact / Téléphone</th></tr></thead>
            <tbody>
              ${schoolList.map((s, i) => {
                const director = directorsBySchoolId.get(String(s.id)) ||
                  directorsBySchoolName.get(String(s.name || '').trim().normalize('NFC').toLocaleLowerCase('fr-FR'));
                const directorName = director
                  ? [director.nom, director.prenom].filter(Boolean).join(' ') || director.full_name || '—'
                  : '—';
                const contact = director
                  ? director.whatsapp || director.whatsapp_phone || director.telephone || ''
                  : '';
                return `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${esc(s.name)}</strong></td>
                    <td>${esc(directorName)}</td>
                    <td>${esc(contact || '—')}</td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="4">Aucune école</td></tr>'}
            </tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:24px">${signatureBlockHTML('Le Chef de la CEB', chefCebSigners)}</div>
      </div>
    `;
  }

  async function saveSchool() {
    const select = viewContainer.querySelector('#schoolEditSelect');
    const input = viewContainer.querySelector('#schoolEditName');
    const status = viewContainer.querySelector('#schoolEditStatus');
    const name = input ? input.value.trim() : '';
    if (!name) {
      if (status) {
        status.textContent = 'Saisissez le nom officiel de l’école.';
        status.style.color = '#b91c1c';
      }
      return;
    }
    const selectedOption = select && select.selectedOptions[0];
    const schoolId = select && select.value !== '__new__' && selectedOption?.dataset.fallback !== 'true'
      ? select.value
      : '';
    try {
      const result = schoolId
        ? await supabase.from('schools').update({ name, ceb: 'BAGRÉ' }).eq('id', schoolId).select('id').single()
        : await supabase.from('schools').insert({ name, ceb: 'BAGRÉ' }).select('id').single();
      if (result.error) throw result.error;
      schoolTermSchoolId = result.data.id;
      schoolTermClassId = '';
      await renderEcoles();
    } catch (error) {
      if (status) {
        status.textContent = `Impossible d’enregistrer l’école : ${error.message || error}`;
        status.style.color = '#b91c1c';
      }
    }
  }

  async function renderSynthese() {
    const { data: databaseSchools } = await supabase.from('schools').select('*').order('name');
    const schools = mergeSchoolChoices(databaseSchools || []).filter(school => !school.isFallback);
    const rows = [];
    let totalComposed = 0, totalStudents = 0, totalG = 0, totalF = 0;

    for (const school of (schools || [])) {
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
          totalComposed += composed; totalG += composedG; totalF += composedF;
          totalStudents += list.length;
          rows.push({ school, cls, exam, composedG, composedF, composed, total: list.length });
        }
      }
    }
    syntheseRows = rows;
    syntheseTotals = { composedG: totalG, composedF: totalF, composed: totalComposed, total: totalStudents };

    const perSchool = {};
    rows.forEach(r => {
      if (!perSchool[r.school.id]) perSchool[r.school.id] = { school: r.school, composedG: 0, composedF: 0, composed: 0, total: 0 };
      const ps = perSchool[r.school.id];
      ps.composedG += r.composedG; ps.composedF += r.composedF; ps.composed += r.composed; ps.total += r.total;
    });

    const toggle = `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn ${syntheseMode === 'ecole' ? '' : 'secondary'}" data-action="synth-ecole">🏫 Par école</button>
        <button class="btn ${syntheseMode === 'globale' ? '' : 'secondary'}" data-action="synth-globale">🌍 Synthèse globale CEB</button>
      </div>`;

    if (syntheseMode === 'globale') {
      viewContainer.innerHTML = `
        <div class="card">
          <h3>Synthèse globale CEB — Examens Blancs</h3>
          <p>Récapitulatif district-wide (CM1/CM2).</p>
          ${toggle}
          <div class="stat-row">
            <div class="stat-box"><strong>${totalComposed}</strong><span>Ont composé</span></div>
            <div class="stat-box"><strong>${totalStudents}</strong><span>Élèves évalués</span></div>
            <div class="stat-box"><strong>${totalG}</strong><span>Garçons</span></div>
            <div class="stat-box"><strong>${totalF}</strong><span>Filles</span></div>
            <div class="stat-box"><strong>${totalStudents ? Math.round((totalComposed / totalStudents) * 1000) / 10 : 0}%</strong><span>Taux de composition</span></div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:24px">${signatureBlockHTML('Le Chef de la CEB', chefCebSigners)}</div>
        </div>`;
    } else {
      viewContainer.innerHTML = `
        <div class="card landscape-sheet wide-sheet">
          <h3>Synthèse par école — Examens Blancs</h3>
          <p>Détail par école (CM1/CM2).</p>
          ${toggle}
          <div class="table-wrap">
            <table>
              <thead><tr><th>N°</th><th>École</th><th>G composent</th><th>F composent</th><th>Total composé</th><th>Évalués</th></tr></thead>
              <tbody>
                ${Object.values(perSchool).map((ps, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${esc(ps.school.name)}</strong></td>
                    <td>${ps.composedG}</td>
                    <td>${ps.composedF}</td>
                    <td>${ps.composed}</td>
                    <td>${ps.total}</td>
                  </tr>
                `).join('') || '<tr><td colspan="6">Aucune donnée</td></tr>'}
                <tr style="background:#f8fafc;font-weight:700">
                  <td></td>
                  <td>Total CEB</td><td>${totalG}</td><td>${totalF}</td><td>${totalComposed}</td><td>${totalStudents}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="card landscape-sheet wide-sheet" style="margin-top:16px">
          <h3>Détail par classe et examen</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>N°</th><th>École</th><th>Classe</th><th>Examen</th><th>G</th><th>F</th><th>Composé</th></tr></thead>
              <tbody>
                ${rows.map((r, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${esc(r.school.name)}</td>
                    <td>${esc(formatClassName(r.cls))}</td>
                    <td>${esc(r.exam.name)}</td>
                    <td>${r.composedG}</td>
                    <td style="color:#dc2626">${r.composedF}</td>
                    <td style="color:#16a34a;font-weight:700"><strong>${r.composed}/${r.total}</strong></td>
                  </tr>
                `).join('') || '<tr><td colspan="7">Aucun examen blanc enregistré.</td></tr>'}
              </tbody>
            </table>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:24px">${signatureBlockHTML('Le Chef de la CEB', chefCebSigners)}</div>
        </div>`;
    }
  }

  viewContainer.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'staff-tab') {
      activeStaffTab = btn.dataset.staffTab === 'office' ? 'office' : 'schools';
      renderStaffTable();
    } else if (a === 'synth-ecole') { syntheseMode = 'ecole'; renderSubView('synthese'); }
    else if (a === 'synth-globale') { syntheseMode = 'globale'; renderSubView('synthese'); }
    else if (a === 'export-trim') exportTrimCSV();
    else if (a === 'school-term-preview') {
      const sheet = viewContainer.querySelector('#schoolTermSheet');
      if (sheet) openPreview({
        title: 'Synthèse Trimestrielle de l’École',
        html: sheet.innerHTML,
        onPrint: printPage,
        onCSV: exportSchoolTermCSV
      });
    } else if (a === 'school-term-print') {
      const sheet = viewContainer.querySelector('#schoolTermSheet');
      if (sheet) openPreview({
        title: 'Synthèse Trimestrielle de l’École',
        html: sheet.innerHTML,
        onPrint: printPage,
        onCSV: exportSchoolTermCSV
      });
    } else if (a === 'school-term-excel') {
      exportSchoolTermCSV();
    } else if (a === 'school-edit-toggle') {
      const editor = viewContainer.querySelector('#schoolEditor');
      if (editor) editor.hidden = !editor.hidden;
    } else if (a === 'school-save') {
      await saveSchool();
    }
  });

  viewContainer.addEventListener('change', (event) => {
    if (event.target.id === 'schoolTermSchool') {
      schoolTermSchoolId = event.target.value;
      schoolTermClassId = '';
      renderSchoolTermSynthesis();
    } else if (event.target.id === 'schoolTerm') {
      schoolTerm = parseInt(event.target.value, 10) || 1;
      renderSchoolTermSynthesis();
    } else if (event.target.id === 'schoolTermMode') {
      schoolTermMode = event.target.value;
      renderSchoolTermSynthesis();
    } else if (event.target.id === 'schoolTermClass') {
      schoolTermClassId = event.target.value;
      renderSchoolTermSynthesis();
    } else if (event.target.id === 'schoolEditSelect') {
      const select = event.target;
      const input = viewContainer.querySelector('#schoolEditName');
      if (input) input.value = select.value === '__new__' ? '' : select.selectedOptions[0].dataset.name || '';
    }
  });

  renderSubView('ecoles');
}