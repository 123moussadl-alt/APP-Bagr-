/**
 * Vue Titulaire — Gestion de classe, saisie des notes, évaluation autre classe
 * Pattern : render (HTML shell) + setup (logique + délégation d'événements)
 */

import { esc, formatNumber, defaultSubjects, formatClassName } from '../utils/format.js';
import { renderBulletinsHTML, renderBulletinsAnnuelsHTML, annualBulletinCSVRows } from '../utils/bulletin.js';
import { getStudentAnnual, rankSuffix } from '../utils/stats.js';
import { openPreview } from '../utils/preview.js';
import { exportPDF, wirePDFExportButton, wireWordExportButton } from '../utils/export.js';
import { renderSyntheseHTML, computeSubjectRows, computeClassAverageSummary } from '../utils/synthese.js';
import { sumHalfDays, computeMonthlyRegister, monthlyRegisterCSVRows, computeFicheArretMensuel, renderFicheArretMensuelHTML, renderMonthlyRegisterTable, monthlyClosureCSVRows, schoolMonths, ANNUAL_SYNTHESIS_TITLE } from '../utils/registre.js';
import { loadPaiRecord, normalizePaiDiscipline, savePaiRecord, writePaiBackup } from '../utils/pai.js';
import { profileMatchesVisa, signatureBlockHTML, signaturePeopleHTML, signatureUrlForProfile } from '../utils/signature.js';

export function renderTitulaire(state, render, supabase) {
  const profile = state.profile;
  if (!profile) return '<div>Chargement...</div>';

  return `
    <div class="role-layout">
      <aside class="role-sidebar">
        <div class="role-brand">
          <strong>Educ CEB</strong>
          <span>Titulaire — ${esc(profile.full_name)}</span>
        </div>
        <nav class="role-nav">
          <button class="nav-item active" data-view="maclasse">🏠 Ma classe</button>
          <button class="nav-item" data-view="eleves">👥 Élèves</button>
          <button class="nav-item" data-view="registre">📅 Registre d'appel</button>
          <button class="nav-item" data-view="matieres">📚 Matières</button>
          <button class="nav-item" data-view="notes">✍️ Cahier de notes</button>
          <button class="nav-item" data-view="bulletins">📄 Bulletins trimestriels</button>
          <button class="nav-item" data-view="bulletins-annuels">📘 Bulletins annuels</button>
          <button class="nav-item" data-view="synthese">📋 Fiche Synthèse</button>
          <button class="nav-item" data-view="annuel">📊 Moyenne annuelle</button>
          <button class="nav-item" data-view="proposition">🎓 Proposition fin d'année</button>
          <button class="nav-item" data-view="evaluer">📝 Évaluer une classe</button>
          <button class="nav-item" data-view="examblanc" id="navExamBlanc">📊 Examen Blanc CM1/CM2</button>
          <button class="nav-item" data-view="export">📊 Exports</button>
        </nav>
        <div class="role-footer">
          ${state.isDualDirector ? '<button class="nav-item" onclick="window.switchToDirectionMode()" style="width:100%;margin-bottom:8px">🏫 Retour Direction</button>' : ''}
          <button class="btn-logout" onclick="window.logout()">Déconnexion</button>
        </div>
      </aside>

      <div class="role-content">
        <header class="role-topbar">
          <div>
            <h1 id="pageTitle">Ma classe</h1>
            <p id="pageSubtitle">Gestion de votre classe</p>
          </div>
          <div class="top-actions">
            <button class="btn" data-action="export-pdf">📄 Exporter en PDF</button>
            <button class="btn secondary" onclick="window.print()">🖨️ Imprimer</button>
          </div>
        </header>

        <main class="role-main">
          <div id="viewContainer"></div>
        </main>
      </div>
    </div>
  `;
}

export function setupTitulaire(container, state, render, supabase) {
  const viewContainer = container.querySelector('#viewContainer');
  const navItems = Array.from(container.querySelectorAll('.nav-item'));
  const pageTitle = container.querySelector('#pageTitle');
  const pageSubtitle = container.querySelector('#pageSubtitle');
  const actualProfile = state.realProfile || state.profile || {};
  const titularSigners = actualProfile.role === 'titulaire' ? [actualProfile] : [];
  wirePDFExportButton(
    container.querySelector('[data-action="export-pdf"]'),
    () => {
      if (registreMode === 'synthese' && viewContainer.querySelector('#ficheSheet')) {
        return viewContainer.querySelector('#ficheSheet');
      }
      return viewContainer.querySelector('#propSheet') || viewContainer;
    },
    () => `${pageTitle ? pageTitle.textContent : 'Document'}_titulaire.pdf`
  );
  let currentStudents = [];
  let editingId = null;
  let localClass = null;
  let myClassLevel = null;
  let currentSubjects = [];
  let currentClass = null;
  let notesNoteCol = null;
  let notesHasBareme = null;
  let notesCols = null;
  let currentAnnualRows = [];
  let currentAnnualBulletinRows = [];
  let currentAnnualBulletinClass = null;
  let currentAnnualBulletinTeacher = '';
  let currentAnnualBulletinSigners = [];
  let currentAnnualBulletinSchool = '';
  let currentPropRows = [];
  let currentPropSchoolName = '';
  let currentSynthese = null;
  let registreMode = 'appel';
  let currentMonthRows = [];
  let currentClosedMonthRows = [];
  let currentClosedVisaDirecteur = {};
  let currentClosedVisaEncadreur = {};
  let regMonthIdx = 0;
  let selectedDate = null;
  let pendingDayAttendance = null;
  let currentJoursValidesByMonth = {};
  let ficheMonthIdx = 0;
  let currentFicheData = null;
  let evalClass = null;
  let evalClassesList = [];
  let evalSchoolLabel = '';
  let evalSubjects = [];
  let evalStudents = [];
  let evalSubjectId = null;
  let evalTerm = 1;
  const REG_MONTHS = [
    { name: 'Octobre', yearOff: 0, month: 9 },
    { name: 'Novembre', yearOff: 0, month: 10 },
    { name: 'Décembre', yearOff: 0, month: 11 },
    { name: 'Janvier', yearOff: 1, month: 0 },
    { name: 'Février', yearOff: 1, month: 1 },
    { name: 'Mars', yearOff: 1, month: 2 },
    { name: 'Avril', yearOff: 1, month: 3 },
    { name: 'Mai', yearOff: 1, month: 4 }
  ];
  const DAY_ABBREV = { 1: 'L', 2: 'M', 3: 'ME', 4: 'J', 5: 'V' };
  const registreStorageKey = classId => `registre-configs-${classId}`;

  function getLocalRegistreConfigs(classId) {
    const saved = localStorage.getItem(registreStorageKey(classId));
    return saved ? JSON.parse(saved) : {};
  }

  function saveLocalRegistreConfig(classId, month, config) {
    const configs = getLocalRegistreConfigs(classId);
    configs[month] = { ...(configs[month] || {}), ...config };
    localStorage.setItem(registreStorageKey(classId), JSON.stringify(configs));
  }

  const titles = {
    maclasse: ["Ma classe", "Vue d'ensemble de votre classe"],
    eleves: ['Élèves', 'Gestion des inscrits'],
    registre: ["Registre d'appel", 'Appel journalier + synthèse mensuelle'],
    matieres: ['Matières', 'Gestion des matières et barèmes'],
    notes: ['Cahier de notes', 'Saisie des notes par trimestre'],
    bulletins: ['Bulletins trimestriels', 'Bulletins trimestriels imprimables'],
    'bulletins-annuels': ['Bulletins Annuels', 'Bulletins annuels imprimables par élève'],
    synthese: ['Fiche Synthèse Trimestrielle', 'Synthèse officielle + PAI'],
    annuel: ['Moyenne annuelle', 'Récapitulatif annuel (T1 · T2 · T3)'],
    proposition: ["Proposition de fin d'année", 'Classement et décision de passage'],
    evaluer: ['Évaluer une classe', 'Saisie de notes pour une autre classe'],
    examblanc: ['Examen Blanc CM1/CM2', 'Évaluation et résultats'],
    export: ['Exports', 'Télécharger les données (CSV)']
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const view = item.dataset.view;
      const t = titles[view] || ['', ''];
      if (pageTitle) pageTitle.textContent = t[0];
      if (pageSubtitle) pageSubtitle.textContent = t[1];
      renderSubView(view);
    });
  });

  async function getMyClass() {
    // Mode aperçu concepteur : classe ciblée dans la barre d'aperçu
    if (state.preview && state.preview.classId) {
      const { data: pcls } = await supabase.from('classes').select('*').eq('id', state.preview.classId).single();
      if (pcls) return pcls;
    }
    const userId = state.user && state.user.id;
    // The profile assignment is authoritative after changes made in Paramètres.
    const pcid = state.profile && state.profile.class_id;
    if (pcid) {
      const { data: cls } = await supabase.from('classes').select('*').eq('id', pcid).single();
      if (cls) return cls;
    }
    // 1) Via la table de co-titulaires (classes partagées)
    const { data: links } = await supabase
      .from('class_teachers')
      .select('class_id')
      .eq('teacher_id', userId);
    if (links && links.length > 0) {
      const { data: ccls } = await supabase.from('classes').select('*').eq('id', links[0].class_id).single();
      if (ccls) return ccls;
    }
    // 2) Via classes.titulaire_id (compat)
    const { data: classes } = await supabase
      .from('classes')
      .select('*')
      .eq('titulaire_id', userId)
      .order('name');
    if (classes && classes.length > 0) return classes[0];
    if (state.classe && (!pcid || String(state.classe.id) === String(pcid))) return state.classe;
    // Repli mode démo (classe créée localement dans la session)
    return localClass;
  }

  async function renderSubView(view) {
    if (!viewContainer) return;
    switch (view) {
      case 'maclasse': return renderMaClasse();
      case 'eleves': return renderEleves();
      case 'registre': return renderRegistre();
      case 'matieres': return renderMatieres();
      case 'notes': return renderNotes();
      case 'bulletins': return renderBulletins();
      case 'bulletins-annuels': return renderBulletinsAnnuels();
      case 'synthese': return renderSynthese();
      case 'annuel': return renderAnnuel();
      case 'proposition': return renderProposition();
      case 'evaluer': return renderEvaluer();
      case 'examblanc': return renderExamBlanc();
      case 'export': return renderExports();
      default: return renderMaClasse();
    }
  }

  function isLowerGrade(level) {
    return ['CP1', 'CP2', 'CE1', 'CE2'].includes(level);
  }

  function updateExamBlancNav() {
    const navExam = container.querySelector('#navExamBlanc');
    if (!navExam) return;
    // N'afficher que pour CM1 / CM2
    navExam.style.display = (myClassLevel === 'CM1' || myClassLevel === 'CM2') ? '' : 'none';
  }

  async function renderMaClasse() {
    const cls = await getMyClass();
    if (!cls) {
      return renderClassSetup();
    }
    myClassLevel = cls.level || null;
    updateExamBlancNav();
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', cls.id)
      .order('full_name');

    // Co-titulaires rattachés à cette classe
    const { data: links } = await supabase
      .from('class_teachers')
      .select('teacher_id, profiles(full_name)')
      .eq('class_id', cls.id);
    const coTeachers = (links || [])
      .map(l => (l.profiles && l.profiles.full_name) || null)
      .filter(Boolean);

    const list = students || [];
    const boys = list.filter(s => s.gender === 'M').length;
    const girls = list.filter(s => s.gender === 'F').length;

    viewContainer.innerHTML = `
      <div class="card">
        <h3>${esc(formatClassName(cls))}</h3>
        <p>Année : ${esc(cls.year || '')}</p>
        ${coTeachers.length > 0 ? `<p style="color:#0f3d23"><strong>👥 Équipe pédagogique :</strong> ${coTeachers.map(n => esc(n)).join(', ')}</p>` : ''}
        <div class="stat-row">
          <div class="stat-box"><strong>${list.length}</strong><span>Élèves</span></div>
          <div class="stat-box"><strong>${boys}</strong><span>Garçons</span></div>
          <div class="stat-box"><strong>${girls}</strong><span>Filles</span></div>
          <div class="stat-box"><strong>${boys + girls}</strong><span>Total</span></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Liste des élèves</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Nom et prénoms</th><th>Sexe</th><th>Statut</th><th>Action</th></tr></thead>
            <tbody>
              ${list.map((s, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${s.gender === 'F' ? `<strong style="color:#dc2626">${esc(s.full_name)}</strong>` : `<strong>${esc(s.full_name)}</strong>`}</td>
                  <td>${s.gender === 'M' ? 'M' : 'F'}</td>
                  <td>${s.status === 'A' ? '<strong>A</strong>' : esc(s.status || 'Actif')}</td>
                  <td><button class="btn small danger" data-action="delete-student" data-id="${esc(s.id)}">🗑</button></td>
                </tr>
              `).join('') || '<tr><td colspan="5">Aucun élève</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function renderClassSetup() {
    const schoolId = state.profile && state.profile.school_id;
    let available = [];
    if (schoolId) {
      const { data } = await supabase.from('classes').select('*').eq('school_id', schoolId);
      available = (data || []).filter(c => !c.titulaire_id);
    }
    viewContainer.innerHTML = `
      <div class="card">
        <h3>Créer / Choisir ma classe</h3>
        <p>Aucune classe ne vous est encore attribuée. Créez votre classe (rattachée à votre école) ou choisissez une classe existante non attribuée.</p>
        <div class="form-group">
          <label>Niveau de la classe</label>
          <select id="newClassLevel">
            <option value="CP1">CP1</option>
            <option value="CP2">CP2</option>
            <option value="CE1">CE1</option>
            <option value="CE2">CE2</option>
            <option value="CM1">CM1</option>
            <option value="CM2">CM2</option>
          </select>
        </div>
        <div class="form-group">
          <label>Nom de la classe (optionnel)</label>
          <input type="text" id="newClassName" placeholder="Ex: CM2 A">
        </div>
        <button class="btn" data-action="create-class" style="margin-top:8px">+ Créer ma classe</button>
        ${available.length > 0 ? `
          <hr style="margin:18px 0;border:none;border-top:1px solid #e2e8f0">
          <div class="form-group">
            <label>Ou choisir une classe existante (sans titulaire)</label>
            <select id="chooseClassSelect">
              <option value="">-- Sélectionner --</option>
              ${available.map(c => `<option value="${esc(c.id)}">${esc(formatClassName(c))}</option>`).join('')}
            </select>
          </div>
          <button class="btn secondary" data-action="choose-class">Choisir cette classe</button>
        ` : ''}
      </div>
    `;
  }

  async function createClass() {
    const schoolId = state.profile && state.profile.school_id;
    const level = (viewContainer.querySelector('#newClassLevel') && viewContainer.querySelector('#newClassLevel').value) || 'CP1';
    const name = ((viewContainer.querySelector('#newClassName') && viewContainer.querySelector('#newClassName').value) || '').trim() || level;
    if (!schoolId) { alert("Votre compte n'est rattaché à aucune école. Contactez le Chef CEB."); return; }
    const userId = state.user && state.user.id;

    // La classe existe-t-elle déjà dans l'école (même niveau + nom) ?
    const { data: existing } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', schoolId)
      .eq('level', level)
      .eq('name', name)
      .limit(1);

    if (existing && existing.length > 0) {
      const ex = existing[0];
      await supabase.from('class_teachers').upsert(
        { class_id: ex.id, teacher_id: userId },
        { onConflict: 'class_id,teacher_id', ignoreDuplicates: true }
      );
      await supabase.from('profiles').update({ class_id: ex.id }).eq('id', userId);
      if (state.profile) state.profile.class_id = ex.id;
      localClass = ex;
      alert('Cette classe existe déjà dans votre école : vous êtes ajouté en co-titulaire (mêmes élèves et matières).');
      renderSubView('maclasse');
      return;
    }

    const { data: newClass, error } = await supabase.from('classes').insert({
      name, level, school_id: schoolId, titulaire_id: userId, year: state.activeSchoolYear || '2026-2027', subjects: defaultSubjects(level)
    }).select().single();
    if (error) { alert('Erreur : ' + error.message); return; }
    if (newClass && newClass.id) {
      await supabase.from('class_teachers').upsert(
        { class_id: newClass.id, teacher_id: userId },
        { onConflict: 'class_id,teacher_id', ignoreDuplicates: true }
      );
      await supabase.from('profiles').update({ class_id: newClass.id }).eq('id', userId);
      if (state.profile) state.profile.class_id = newClass.id;
      localClass = newClass;
    } else {
      // Mode démo : pas d'id renvoyé par le mock
      localClass = { id: 'local-' + Date.now(), name, level, school_id: schoolId, titulaire_id: userId, year: state.activeSchoolYear || '2026-2027', subjects: defaultSubjects(level) };
    }
    renderSubView('maclasse');
  }

  async function chooseExistingClass() {
    const classId = (viewContainer.querySelector('#chooseClassSelect') && viewContainer.querySelector('#chooseClassSelect').value) || '';
    if (!classId) { alert('Sélectionnez une classe.'); return; }
    const userId = state.user && state.user.id;
    const { error } = await supabase.from('classes').update({ titulaire_id: userId }).eq('id', classId);
    if (error) { alert('Erreur : ' + error.message); return; }
    await supabase.from('class_teachers').upsert(
      { class_id: classId, teacher_id: userId },
      { onConflict: 'class_id,teacher_id', ignoreDuplicates: true }
    );
    await supabase.from('profiles').update({ class_id: classId }).eq('id', userId);
    if (state.profile) state.profile.class_id = classId;
    localClass = { id: classId };
    renderSubView('maclasse');
  }

  async function renderEleves() {
    const cls = await getMyClass();
    if (!cls) {
      return renderClassSetup();
    }
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', cls.id)
      .order('full_name');

    const list = students || [];
    currentStudents = list;

    viewContainer.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3>Gestion des élèves — ${esc(formatClassName(cls))}</h3>
          <button class="btn" data-action="add-student">+ Ajouter un élève</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Nom et prénoms</th><th>Sexe</th><th>Statut</th><th>EDF</th><th>Handicap</th><th>Actions</th></tr></thead>
            <tbody>
              ${list.map((s, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${s.gender === 'F' ? `<strong style="color:#dc2626">${esc(s.full_name)}</strong>` : `<strong>${esc(s.full_name)}</strong>`}</td>
                  <td>${s.gender === 'M' ? 'M' : 'F'}</td>
                  <td>${s.status === 'A' ? '<strong>A</strong>' : esc(s.status || 'Actif')}</td>
                  <td>${s.edi ? 'Oui' : '—'}</td>
                  <td>${s.handicap && String(s.handicap).trim() ? esc(s.handicap) : '—'}</td>
                  <td>
                    <button class="btn small" data-action="edit-student" data-id="${esc(s.id)}">✏️</button>
                    <button class="btn small danger" data-action="delete-student" data-id="${esc(s.id)}">🗑</button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="7">Aucun élève</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function renderNotes() {
    const cls = await getMyClass();
    if (!cls) {
      return renderClassSetup();
    }
    myClassLevel = cls.level || null;
    updateExamBlancNav();
    currentClass = cls;
    const subjects = await getSubjectsForClass(cls);
    currentSubjects = subjects;
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', cls.id)
      .order('full_name');

    const list = students || [];

    viewContainer.innerHTML = `
      <div class="card">
        <h3>Cahier de notes — ${esc(formatClassName(cls))}</h3>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:180px">
            <label>Trimestre</label>
            <select id="termSelect">
              <option value="1">1er Trimestre</option>
              <option value="2">2e Trimestre</option>
              <option value="3">3e Trimestre</option>
            </select>
          </div>
          <button class="btn secondary" data-action="go-matieres" style="margin-bottom:2px">📚 Gérer les matières</button>
          <button class="btn" data-action="save-all-notes" id="saveNotesBtn" style="margin-bottom:2px">💾 Enregistrer les notes</button>
        </div>
        <div class="table-wrap" style="margin-top:12px">
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Élève</th>
                <th>Sexe</th>
                ${subjects.map(s => `<th>${esc(s.name)} <span style="font-weight:400;color:#64748b">(/${esc(s.max)})</span></th>`).join('')}
                <th>Total</th>
                <th>Moyenne /10</th>
                <th>Rang</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((s, i) => `
                <tr data-student-row="${esc(s.id)}">
                  <td>${i + 1}</td>
                  <td>${s.gender === 'F' ? `<strong style="color:#dc2626">${esc(s.full_name)}</strong>` : `<strong>${esc(s.full_name)}</strong>`}${s.status === 'A' ? ' <span style="color:#64748b;font-weight:700">(A)</span>' : ''}</td>
                  <td>${s.gender === 'M' ? 'M' : 'F'}</td>
                  ${subjects.map(sub => `
                    <td>
                      <input type="number" step="0.01" min="0" max="${esc(sub.max)}" value=""
                        class="grade-input"
                        data-student="${esc(s.id)}" data-subject="${esc(sub.id)}">
                    </td>
                  `).join('')}
                  <td class="total-cell">—</td>
                  <td class="moyenne-cell">—</td>
                  <td class="rang-cell">—</td>
                </tr>
              `).join('') || `<tr><td colspan="${subjects.length + 6}">Aucun élève</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const termSelect = viewContainer.querySelector('#termSelect');
    if (termSelect) {
      await loadGradesIntoInputs(list, subjects, termSelect.value);
      termSelect.addEventListener('change', () => loadGradesIntoInputs(list, subjects, termSelect.value));
    }
    recomputeAverages();
  }

  async function loadGradesIntoInputs(students, subjects, term) {
    const inputs = viewContainer.querySelectorAll('.grade-input');
    inputs.forEach(i => { i.value = ''; });
    if (!currentClass || !students.length || !subjects.length) { recomputeAverages(); return; }
    const { data: notes } = await supabase
      .from('notes')
      .select('*')
      .eq('classe_id', currentClass.id)
      .eq('trimestre', parseInt(term, 10));
    const sample = (notes || [])[0] || {};
    const eleveKey = sample.eleve_id !== undefined ? 'eleve_id' : (sample.student_id !== undefined ? 'student_id' : 'eleve_id');
    const matKey = sample.matiere_id !== undefined ? 'matiere_id' : (sample.subject_id !== undefined ? 'subject_id' : 'matiere_id');
    const noteKey = sample.note !== undefined ? 'note' : (sample.valeur !== undefined ? 'valeur' : 'note');
    const map = {};
    (notes || []).forEach(n => { map[`${n[eleveKey]}:${n[matKey]}`] = n[noteKey]; });
    inputs.forEach(input => {
      const key = `${input.dataset.student}:${input.dataset.subject}`;
      const v = map[key];
      input.value = (v !== undefined && v !== null) ? v : '';
    });
    recomputeAverages();
  }

  function recomputeAverages() {
    const rows = Array.from(viewContainer.querySelectorAll('[data-student-row]'));
    const stats = [];
    rows.forEach(row => {
      let sumPoints = 0, sumPN = 0, sumCoef = 0, count = 0;
      row.querySelectorAll('.grade-input').forEach(inp => {
        const sub = currentSubjects.find(s => s.id === inp.dataset.subject);
        const raw = inp.value;
        if (raw !== '' && raw != null && sub) {
          const num = parseFloat(raw);
          if (!isNaN(num)) {
            const max = parseFloat(sub.max) || 10;
            const coef = parseFloat(sub.coef) || 1;
            sumPoints += num;
            sumPN += (num / max) * coef;
            sumCoef += coef;
            count++;
          }
        }
      });
      const moy = (count > 0 && sumCoef > 0) ? (sumPN / sumCoef * 10) : null;
      stats.push({ row, sumPoints, moy, count });
    });

    // Classement (rang) : rang de compétition, ex æquo gérés, vide si aucune note ; abandons exclus (A)
    const graded = stats.filter(x => x.moy != null && !(x.row.children[1] && x.row.children[1].textContent.includes('(A)')));
    const sorted = [...graded].sort((a, b) => b.moy - a.moy);
    const rankMap = {};
    const moyCount = {};
    graded.forEach(x => { const k = x.moy.toFixed(4); moyCount[k] = (moyCount[k] || 0) + 1; });
    let lastMoy = null, lastRank = 0;
    sorted.forEach((x, i) => {
      const k = x.moy.toFixed(4);
      if (lastMoy === null || k !== lastMoy) { lastRank = i + 1; lastMoy = k; }
      rankMap[x.row.dataset.studentRow] = { rank: lastRank, tie: (moyCount[k] || 0) > 1 };
    });

    const suffix = (rank, isGirl, tie) => {
      let s = rank === 1 ? (isGirl ? 'ère' : 'er') : 'e';
      if (tie) s += ' ex';
      return rank + s;
    };

    stats.forEach(x => {
      const sexCell = x.row.children[2];
      const isGirl = sexCell && sexCell.textContent.trim() === 'F';
      const abandon = (x.row.children[1] && x.row.children[1].textContent.includes('(A)'));
      const totalCell = x.row.querySelector('.total-cell');
      const moyCell = x.row.querySelector('.moyenne-cell');
      const rangCell = x.row.querySelector('.rang-cell');
      if (totalCell) totalCell.textContent = abandon ? '0.00' : (x.count > 0 ? x.sumPoints : '—');
      if (moyCell) moyCell.textContent = abandon ? '0.00' : (x.moy != null ? x.moy.toFixed(2) : '—');
      if (rangCell) {
        if (abandon) rangCell.textContent = 'A';
        else {
          const r = rankMap[x.row.dataset.studentRow];
          rangCell.textContent = r ? suffix(r.rank, isGirl, r.tie) : '';
        }
      }
    });
  }

  async function saveAllNotes() {
    const term = parseInt(viewContainer.querySelector('#termSelect')?.value || '1', 10);
    const rows = Array.from(viewContainer.querySelectorAll('[data-student-row]'));
    let ok = 0, fail = 0, firstErr = null;
    for (const row of rows) {
      const eleveId = row.dataset.studentRow;
      for (const inp of row.querySelectorAll('.grade-input')) {
        const raw = inp.value;
        if (raw === '' || raw == null) continue;
        const sub = currentSubjects.find(s => s.id === inp.dataset.subject);
        const res = await saveNoteRow(eleveId, inp.dataset.subject, term, parseFloat(raw), sub ? sub.max : null);
        if (res.ok) ok++;
        else { fail++; if (!firstErr && res.error) firstErr = res.error; }
      }
    }
    if (ok === 0 && fail === 0) { gradeToast('Aucune note à enregistrer.'); return; }
    if (fail > 0 && firstErr) {
      gradeErrorBanner(firstErr);
      alert(ok + ' note(s) enregistrée(s), ' + fail + ' échec(s).\nErreur Supabase : ' + (firstErr.message || '') + (firstErr.details ? ('\n' + firstErr.details) : ''));
    }
    gradeToast(ok + ' note(s) enregistrée(s), ' + fail + ' échec(s)');
  }

  function gradeErrorBanner(err) {
    let el = document.getElementById('gradeErrorBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gradeErrorBanner';
      el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:12000;background:#dc2626;color:#fff;padding:14px 18px;border-radius:8px;max-width:92vw;max-height:70vh;overflow:auto;box-shadow:0 6px 22px rgba(0,0,0,.4);font-size:13px;white-space:pre-wrap;word-break:break-word;cursor:pointer;font-family:inherit';
      document.body.appendChild(el);
    }
    const msg = (err && err.message) ? err.message : String(err);
    const details = (err && err.details) ? err.details : '';
    const code = (err && err.code) ? err.code : '';
    const hint = (err && err.hint) ? err.hint : '';
    const parts = [];
    parts.push('ERREUR SUPABASE — enregistrement des notes');
    parts.push('Message : ' + msg);
    if (code) parts.push('Code : ' + code);
    if (details) parts.push('Détails : ' + details);
    if (hint) parts.push('Hint : ' + hint);
    parts.push('(Cliquez pour fermer)');
    el.textContent = parts.join('\n');
    el.style.display = 'block';
    el.onclick = () => { el.style.display = 'none'; };
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.display = 'none'; }, 15000);
  }

  function gradeToast(msg) {
    let t = document.getElementById('gradeToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'gradeToast';
      t.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:10000;background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.3);opacity:0;transition:opacity .2s;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2500);
  }

  async function loadMatieres(classId) {
    const { data } = await supabase.from('matieres').select('*').eq('class_id', classId).order('created_at');
    return data || [];
  }

  async function getSubjectsForClass(cls) {
    const mat = await loadMatieres(cls.id);
    if (mat && mat.length > 0) {
      return mat.map(m => ({ id: m.id, name: m.nom, max: m.bareme, coef: m.coefficient != null ? m.coefficient : 1 }));
    }
    // Repli : matières stockées dans classes.subjects (jsonb)
    return (cls.subjects || []).map(s => ({ id: s.id, name: s.name, max: s.max, coef: s.coef || 1 }));
  }

  async function renderMatieres() {
    const cls = await getMyClass();
    if (!cls) return renderClassSetup();
    myClassLevel = cls.level || null;
    updateExamBlancNav();
    const matieres = await loadMatieres(cls.id);

    viewContainer.innerHTML = `
      <div class="card">
        <h3>Matières — ${esc(formatClassName(cls))}</h3>
        <p>Ajoutez vos matières, leur barème (note sur combien) et leur coefficient. Elles sont utilisées dans le cahier de notes et le calcul des moyennes.</p>
        <form id="matiereForm">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
            <div class="form-group" style="flex:2;min-width:200px;margin:0">
              <label>Nom de la matière</label>
              <input type="text" id="matiereName" required placeholder="Ex: Mathématiques">
            </div>
            <div class="form-group" style="flex:1;min-width:110px;margin:0">
              <label>Barème (note sur)</label>
              <input type="number" id="matiereMax" value="10" min="1" step="0.5" required>
            </div>
            <div class="form-group" style="flex:1;min-width:90px;margin:0">
              <label>Coefficient</label>
              <input type="number" id="matiereCoef" value="1" min="0.5" step="0.5">
            </div>
            <button type="submit" class="btn" style="margin-bottom:2px">+ Ajouter la matière</button>
          </div>
        </form>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>Liste des matières (${matieres.length})</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Matière</th><th>Barème</th><th>Coefficient</th><th>Actions</th></tr></thead>
            <tbody>
              ${matieres.map(m => `
                <tr>
                  <td><strong>${esc(m.nom)}</strong></td>
                  <td>${esc(m.bareme)}</td>
                  <td>${esc(m.coefficient != null ? m.coefficient : 1)}</td>
                  <td>
                    <button class="btn small" data-action="edit-matiere" data-id="${esc(m.id)}" data-name="${esc(m.nom)}" data-max="${esc(m.bareme)}" data-coef="${esc(m.coefficient != null ? m.coefficient : 1)}">✏️ Modifier</button>
                    <button class="btn small danger" data-action="delete-matiere" data-id="${esc(m.id)}">🗑 Supprimer</button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="4">Aucune matière. Ajoutez-en une ci-dessus.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const form = viewContainer.querySelector('#matiereForm');
    if (form) form.addEventListener('submit', addMatiere);
  }

  async function addMatiere(e) {
    e.preventDefault();
    const cls = await getMyClass();
    if (!cls) return renderClassSetup();
    const nom = (viewContainer.querySelector('#matiereName').value || '').trim();
    const bareme = parseFloat(viewContainer.querySelector('#matiereMax').value) || 10;
    const coefficient = parseFloat(viewContainer.querySelector('#matiereCoef').value) || 1;
    if (!nom) { alert('Le nom de la matière est requis.'); return; }
    const { error } = await supabase.from('matieres').insert({
      class_id: cls.id,
      ecole_id: cls.school_id || null,
      nom,
      bareme,
      coefficient
    });
    if (error) alert(error.message);
    else renderSubView('matieres');
  }

  async function editMatiere(btn) {
    const id = btn.dataset.id;
    const nom = prompt('Nom de la matière :', btn.dataset.name || '');
    if (nom === null) return;
    const baremeStr = prompt('Barème (note sur) :', btn.dataset.max || '10');
    if (baremeStr === null) return;
    const coefStr = prompt('Coefficient :', btn.dataset.coef || '1');
    const bareme = parseFloat(baremeStr) || 10;
    const coefficient = coefStr !== null ? (parseFloat(coefStr) || 1) : 1;
    const { error } = await supabase.from('matieres').update({
      nom: nom.trim() || btn.dataset.name,
      bareme,
      coefficient
    }).eq('id', id);
    if (error) alert(error.message);
    else renderSubView('matieres');
  }

  async function deleteMatiere(id) {
    if (!confirm('Supprimer cette matière ?')) return;
    const { error } = await supabase.from('matieres').delete().eq('id', id);
    if (error) alert(error.message);
    else renderSubView('matieres');
  }

  async function renderBulletins() {
    const cls = await getMyClass();
    if (!cls) return renderClassSetup();
    myClassLevel = cls.level || null;
    updateExamBlancNav();
    const subjects = await getSubjectsForClass(cls);
    const { data: students } = await supabase.from('students').select('*').eq('class_id', cls.id).order('full_name');
    const list = students || [];
    const { data: notes } = await supabase.from('notes').select('*').eq('classe_id', cls.id);
    const allNotes = notes || [];
    let schoolName = '';
    if (cls.school_id) {
      const { data: school } = await supabase.from('schools').select('name').eq('id', cls.school_id).single();
      schoolName = (school && school.name) || '';
    }
    let teacherName = (state.realProfile && state.realProfile.full_name) || (state.profile ? state.profile.full_name : '');
    let teacherSigners = [];
    if (teacherName.indexOf('Aperçu') !== -1) teacherName = '';
    try {
      const { data: links } = await supabase.from('class_teachers').select('teacher_id, profiles(id,full_name,signature_url)').eq('class_id', cls.id);
      teacherSigners = (links || []).map(link => link.profiles).filter(person => person && person.full_name && !String(person.full_name).includes('Aperçu'));
      const names = teacherSigners.map(person => person.full_name);
      if (names.length) teacherName = names.join(', ');
    } catch (e) { /* ignore */ }
    if (!teacherName && state.profile && state.profile.full_name && state.profile.full_name.indexOf('Aperçu') === -1) {
      teacherName = state.profile.full_name;
    }
    if (!teacherSigners.length && titularSigners.length && String(teacherName || '').includes(titularSigners[0].full_name)) teacherSigners = titularSigners;
    const prevTerm = viewContainer.querySelector('#bulletinTerm');
    const term = parseInt((prevTerm && prevTerm.value) || '1', 10);

    viewContainer.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:180px">
            <label>Trimestre</label>
            <select id="bulletinTerm">
              <option value="1" ${term === 1 ? 'selected' : ''}>Trimestre 1</option>
              <option value="2" ${term === 2 ? 'selected' : ''}>Trimestre 2</option>
              <option value="3" ${term === 3 ? 'selected' : ''}>Trimestre 3</option>
            </select>
          </div>
          <button class="btn" data-action="print-bulletins" style="margin-bottom:2px">🖨️ Imprimer / PDF (tous)</button>
        </div>
      </div>
      <div id="bulletinSheets">${renderBulletinsHTML({ students: list, subjects, notes: allNotes, term, className: classLabel(cls), schoolName, teacherName, teacherSigners })}</div>
    `;
    const sel = viewContainer.querySelector('#bulletinTerm');
    if (sel) sel.addEventListener('change', () => renderBulletins());
  }

  async function renderBulletinsAnnuels() {
    const cls = await getMyClass();
    if (!cls) return renderClassSetup();
    currentAnnualBulletinClass = cls;
    myClassLevel = cls.level || null;
    updateExamBlancNav();
    const previousStudentId = viewContainer.querySelector('#annualBulletinStudent')?.value || '';
    currentAnnualBulletinRows = await loadAnnualData(cls);

    let schoolName = '';
    if (cls.school_id) {
      const { data: school } = await supabase.from('schools').select('name').eq('id', cls.school_id).single();
      schoolName = (school && school.name) || '';
    }
    currentAnnualBulletinSchool = schoolName;

    let teacherNames = [];
    let teacherSigners = [];
    try {
      const { data: links } = await supabase.from('class_teachers').select('teacher_id, profiles(id,full_name,signature_url)').eq('class_id', cls.id);
      teacherSigners = (links || []).map(link => link.profiles).filter(person => person && person.full_name && !String(person.full_name).includes('Aperçu'));
      teacherNames = teacherSigners
        .map(person => person.full_name)
        .filter(name => name && !String(name).includes('Aperçu'));
    } catch (e) { /* ignore */ }
    if (!teacherNames.length && cls.titulaire_id) {
      const { data: teacher } = await supabase.from('profiles').select('id,full_name,signature_url').eq('id', cls.titulaire_id).single();
      if (teacher && teacher.full_name && !String(teacher.full_name).includes('Aperçu')) {
        teacherNames = [teacher.full_name];
        teacherSigners = [teacher];
      }
    }
    const profileName = (state.realProfile && state.realProfile.full_name) || (state.profile && state.profile.full_name);
    if (!teacherNames.length && profileName && !String(profileName).includes('Aperçu')) teacherNames = [profileName];
    currentAnnualBulletinTeacher = teacherNames.join(', ');
    if (!teacherSigners.length && titularSigners.length && currentAnnualBulletinTeacher.includes(titularSigners[0].full_name)) teacherSigners = titularSigners;
    currentAnnualBulletinSigners = teacherSigners;

    const selectedExists = currentAnnualBulletinRows.some(row => String(row.s.id) === String(previousStudentId));
    const selectedStudentId = selectedExists ? previousStudentId : '';
    viewContainer.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:240px">
            <label>Élève</label>
            <select id="annualBulletinStudent">
              <option value="">Tous les élèves</option>
              ${currentAnnualBulletinRows.map(row => `<option value="${esc(row.s.id)}" ${selectedStudentId === String(row.s.id) ? 'selected' : ''}>${esc(row.s.full_name || '')}</option>`).join('')}
            </select>
          </div>
          <button type="button" class="btn" data-action="annual-bulletins-pdf">📄 Imprimer / Exporter tous les bulletins annuels en PDF</button>
          <button type="button" class="btn" data-action="preview-annual-bulletins">👁 Aperçu</button>
          <button type="button" class="btn" data-action="csv-annual-bulletins">📥 Exporter en Excel</button>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div id="annualBulletinSheets"></div>
      </div>`;
    const renderSelected = () => {
      const sheet = viewContainer.querySelector('#annualBulletinSheets');
      const studentId = viewContainer.querySelector('#annualBulletinStudent')?.value || '';
      if (sheet) {
        sheet.innerHTML = renderBulletinsAnnuelsHTML({
          rows: currentAnnualBulletinRows,
          className: classLabel(cls),
          schoolName: currentAnnualBulletinSchool,
          teacherName: currentAnnualBulletinTeacher,
          teacherSigners: currentAnnualBulletinSigners,
          studentId
        }) || '<p style="color:#64748b">Aucun élève à afficher.</p>';
      }
    };
    viewContainer.querySelector('#annualBulletinStudent')?.addEventListener('change', renderSelected);
    renderSelected();
  }

  function exportAnnualBulletinsCSV() {
    if (!currentAnnualBulletinRows.length || !currentAnnualBulletinClass) {
      alert('Aucun bulletin annuel à exporter.');
      return;
    }
    downloadCSV(
      'bulletins_annuels.csv',
      annualBulletinCSVRows(currentAnnualBulletinRows, classLabel(currentAnnualBulletinClass))
    );
  }

  async function exportAllAnnualBulletinsPDF(button) {
    if (!currentAnnualBulletinRows.length || !currentAnnualBulletinClass) {
      alert('Aucun bulletin annuel à exporter.');
      return;
    }
    const sheet = viewContainer.querySelector('#annualBulletinSheets');
    if (!sheet) return;
    const previousHTML = sheet.innerHTML;
    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = 'Création des bulletins PDF…';
    sheet.innerHTML = renderBulletinsAnnuelsHTML({
      rows: currentAnnualBulletinRows,
      className: classLabel(currentAnnualBulletinClass),
      schoolName: currentAnnualBulletinSchool,
      teacherName: currentAnnualBulletinTeacher,
      teacherSigners: currentAnnualBulletinSigners
    });
    try {
      await exportPDF(sheet, 'bulletins_annuels.pdf', { orientation: 'portrait', format: 'a4', margin: 12 });
    } catch (error) {
      alert('Erreur lors de la création des bulletins PDF : ' + (error && error.message ? error.message : String(error)));
    } finally {
      sheet.innerHTML = previousHTML;
      button.disabled = false;
      button.textContent = previousText;
    }
  }

  function classLabel(cls) {
    return formatClassName(cls);
  }

  function annualSheetsHTML(rows, cls) {
    return `
      <div class="landscape-sheet">
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px">
        <strong style="font-size:16px">CEB DE BAGRÉ</strong><br>
        <strong>Récapitulatif annuel — ${esc(classLabel(cls))}</strong>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="border:1px solid #333;padding:6px">Rang</th>
          <th style="border:1px solid #333;padding:6px">Élève</th>
          <th style="border:1px solid #333;padding:6px">Sexe</th>
          <th style="border:1px solid #333;padding:6px">T1</th>
          <th style="border:1px solid #333;padding:6px">T2</th>
          <th style="border:1px solid #333;padding:6px">T3</th>
          <th style="border:1px solid #333;padding:6px">Moy. annuelle</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => {
            const rg = r.rankInfo ? rankSuffix(r.rankInfo.rank, r.isGirl, r.rankInfo.tie) : '—';
            const nameStyle = r.isGirl ? 'color:#dc2626;font-weight:700' : 'font-weight:700';
            return `<tr>
              <td style="border:1px solid #333;padding:6px;text-align:center">${rg}</td>
              <td style="border:1px solid #333;padding:6px;${nameStyle}">${esc(r.s.full_name)}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center">${r.s.gender === 'M' ? 'M' : 'F'}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center">${r.t1 != null ? r.t1 : '—'}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center">${r.t2 != null ? r.t2 : '—'}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center">${r.t3 != null ? r.t3 : '—'}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center"><strong>${r.annual != null ? r.annual : '—'}</strong></td>
            </tr>`;
          }).join('') || '<tr><td colspan="7" style="border:1px solid #333;padding:6px;text-align:center">Aucun élève</td></tr>'}
        </tbody>
      </table></div>`;
  }

  function propSheetsHTML(rows, cls, editable = false) {
    return `
      <div class="proposition-sheet landscape-sheet">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;border-bottom:2px solid #111827;padding-bottom:10px">
        <div style="font-weight:700;line-height:1.55">
          <strong>CEB de Bagré</strong><br>
          <strong>École : ${esc(currentPropSchoolName || '—')}</strong><br>
          <strong>Classe : ${esc(classLabel(cls))}</strong>
        </div>
        <div class="official-motto" style="display:flex;flex-direction:column;align-items:center;text-align:center;font-weight:700;line-height:1.55">
          <strong>Burkina Faso</strong>
          <em>La Patrie ou la Mort, nous vaincrons</em>
        </div>
      </div>
      <div style="width:100%;text-align:center;margin:14px 0;font-size:21px;font-weight:800;text-transform:uppercase">
        PROPOSITION DE FIN D'ANNÉE
      </div>
      <div class="table-wrap" style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <thead><tr>
          <th style="border:1px solid #333;padding:6px">N°</th>
          <th style="border:1px solid #333;padding:6px">Rang</th>
          <th style="border:1px solid #333;padding:6px">Nom et Prénom</th>
          <th style="border:1px solid #333;padding:6px">Sexe</th>
          <th style="border:1px solid #333;padding:6px">T1</th>
          <th style="border:1px solid #333;padding:6px">T2</th>
          <th style="border:1px solid #333;padding:6px">T3</th>
          <th style="border:1px solid #333;padding:6px">Moyenne Annuelle</th>
          <th style="border:1px solid #333;padding:6px">Statut (A = Abandon)</th>
          <th style="border:1px solid #333;padding:6px">Proposition du Conseil des Maîtres : Passe / Redouble / Abandon (A)</th>
          <th style="border:1px solid #333;padding:6px;min-width:110px">Décision du CCEB</th>
        </tr></thead>
        <tbody>
          ${rows.map((r, i) => {
            const rg = r.abandon ? 'A' : (r.rankInfo ? rankSuffix(r.rankInfo.rank, r.isGirl, r.rankInfo.tie) : '—');
            const nameStyle = r.isGirl ? 'color:#dc2626;font-weight:700' : 'font-weight:700';
            const annualTxt = r.abandon ? '0.00' : (r.annual != null ? r.annual : '—');
            const statutTxt = (r.abandon || r.s.status === 'A') ? 'A' : 'Actif';
            return `<tr>
              <td style="border:1px solid #333;padding:6px;text-align:center">${i + 1}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center">${rg}</td>
              <td style="border:1px solid #333;padding:6px;${nameStyle}">${esc(r.s.full_name)}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center">${r.s.gender === 'M' ? 'M' : 'F'}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center">${r.t1 != null ? r.t1 : '—'}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center">${r.t2 != null ? r.t2 : '—'}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center">${r.t3 != null ? r.t3 : '—'}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center"><strong>${annualTxt}</strong></td>
              <td style="border:1px solid #333;padding:6px;text-align:center">${statutTxt}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center;word-wrap:break-word;overflow-wrap:anywhere;white-space:normal">${editable
                ? `<input class="prop-conseil" data-id="${esc(r.s.id)}" value="${esc(r.decision)}" style="width:100%;min-width:0">`
                : esc(r.decision)}</td>
              <td style="border:1px solid #333;padding:6px">${editable
                ? `<input class="prop-cceb" data-id="${esc(r.s.id)}" placeholder="—" style="width:100%;min-width:0">`
                : ''}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="11" style="border:1px solid #333;padding:6px;text-align:center">Aucun élève</td></tr>'}
        </tbody>
      </table>
      </div>
      <div style="display:flex;justify-content:space-between;gap:18px;margin-top:30px;text-align:center">
        <div style="flex:1">${signatureBlockHTML('Le(s) Titulaire(s)', actualProfile.role === 'titulaire' ? [actualProfile] : []) || '<strong>Le(s) Titulaire(s)</strong>'}</div>
        <div style="flex:1">${signatureBlockHTML('Le Directeur / La Directrice', actualProfile.role === 'directeur' ? [actualProfile] : []) || '<strong>Le Directeur / La Directrice</strong>'}</div>
        <div style="flex:1">${signatureBlockHTML('Le Chef de la CEB', actualProfile.role === 'chef_ceb' ? [actualProfile] : []) || '<strong>Le Chef de la CEB</strong>'}</div>
      </div>
      </div>`;
  }

  function decisionFor(r) {
    if (r && (r.abandon || (r.s && r.s.status === 'A'))) return 'Abandon (A)';
    if (!r || r.annual == null) return 'Absent / Non évalué';
    return r.annual >= 5 ? 'Passe' : 'Redouble';
  }

  async function loadAnnualData(cls) {
    const { data: students } = await supabase.from('students').select('*').eq('class_id', cls.id).order('full_name');
    const list = students || [];
    return await getStudentAnnual(supabase, cls, list);
  }

  async function renderAnnuel() {
    const cls = await getMyClass();
    if (!cls) return renderClassSetup();
    currentClass = cls;
    const rows = await loadAnnualData(cls);
    currentAnnualRows = rows;
    viewContainer.innerHTML = `
      <div class="card landscape-sheet">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <h3 style="margin:0;flex:1">Moyenne annuelle — ${esc(classLabel(cls))}</h3>
          <button class="btn" data-action="preview-annuel">👁 Aperçu</button>
          <button class="btn" data-action="csv-annuel">📥 Excel/CSV</button>
          <button class="btn secondary" data-action="print-page">🖨️ Imprimer / PDF</button>
        </div>
        <div class="table-wrap" style="margin-top:12px">
          <table>
            <thead><tr><th>N°</th><th>Rang</th><th>Élève</th><th>Sexe</th><th>T1</th><th>T2</th><th>T3</th><th>Moy. annuelle</th><th>Statut</th></tr></thead>
            <tbody>
              ${rows.map((r, i) => {
                const rg = r.abandon ? 'A' : (r.rankInfo ? rankSuffix(r.rankInfo.rank, r.isGirl, r.rankInfo.tie) : '—');
                const annualTxt = r.abandon ? '0.00' : (r.annual != null ? r.annual : '—');
                const statutTxt = (r.abandon || r.s.status === 'A') ? 'A' : 'Actif';
                return `<tr>
                  <td>${i + 1}</td>
                  <td>${rg}</td>
                  <td>${r.isGirl ? `<strong style="color:#dc2626">${esc(r.s.full_name)}</strong>` : `<strong>${esc(r.s.full_name)}</strong>`}</td>
                  <td>${r.s.gender === 'M' ? 'M' : 'F'}</td>
                  <td>${r.t1 != null ? r.t1 : '—'}</td>
                  <td>${r.t2 != null ? r.t2 : '—'}</td>
                  <td>${r.t3 != null ? r.t3 : '—'}</td>
                  <td><strong>${annualTxt}</strong></td>
                  <td>${statutTxt}</td>
                </tr>`;
              }).join('') || '<tr><td colspan="9">Aucun élève</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function exportAnnuelCSV() {
    if (!currentAnnualRows.length || !currentClass) { alert('Ouvrez la Moyenne annuelle d\'abord.'); return; }
    const rows = [['N°', 'Rang', 'Élève', 'Sexe', 'T1', 'T2', 'T3', 'Moyenne annuelle', 'Statut']];
    currentAnnualRows.forEach((r, i) => {
      const rg = r.abandon ? 'A' : (r.rankInfo ? rankSuffix(r.rankInfo.rank, r.isGirl, r.rankInfo.tie) : '');
      const annualTxt = r.abandon ? '0.00' : (r.annual != null ? r.annual : '');
      const statutTxt = (r.abandon || r.s.status === 'A') ? 'A' : 'Actif';
      rows.push([i + 1, rg, r.s.full_name, r.s.gender === 'M' ? 'M' : 'F', r.t1, r.t2, r.t3, annualTxt, statutTxt]);
    });
    downloadCSV('moyenne_annuelle.csv', rows);
  }

  async function renderProposition() {
    const cls = await getMyClass();
    if (!cls) return renderClassSetup();
    currentClass = cls;
    currentPropSchoolName = '';
    if (cls.school_id) {
      const { data: school, error } = await supabase.from('schools').select('name').eq('id', cls.school_id).single();
      if (error) {
        console.error('Impossible de charger le nom de l’école pour la proposition.', error);
        alert('Impossible de charger le nom de l’école : ' + error.message);
      } else {
        currentPropSchoolName = (school && school.name) || '';
      }
    }
    const rows = (await loadAnnualData(cls)).map(r => ({ ...r, decision: decisionFor(r) }));
    rows.sort((a, b) => {
      // Élèves abandonnés (A) toujours en dernière position
      if (a.abandon && !b.abandon) return 1;
      if (!a.abandon && b.abandon) return -1;
      if (a.annual == null && b.annual == null) return 0;
      if (a.annual == null) return 1;
      if (b.annual == null) return -1;
      return b.annual - a.annual;
    });
    currentPropRows = rows;
    viewContainer.innerHTML = `
      <div class="card">
        <div class="no-print" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <h3 style="margin:0;flex:1">Proposition de fin d'année — ${esc(classLabel(cls))}</h3>
          <button class="btn" data-action="preview-prop">👁 Aperçu</button>
          <button class="btn" data-action="csv-prop">📥 Excel/CSV</button>
          <button class="btn secondary" data-action="print-page">🖨️ Imprimer / PDF</button>
        </div>
        <div id="propSheet" class="landscape-sheet" style="margin-top:12px">${propSheetsHTML(rows, cls, true)}</div>
      </div>`;
  }

  function exportPropCSV() {
    if (!currentPropRows.length || !currentClass) { alert('Ouvrez la Proposition d\'abord.'); return; }
    const rows = [['N°', 'Rang', 'Nom et Prénom', 'Sexe', 'T1', 'T2', 'T3', 'Moyenne Annuelle', 'Statut (A = Abandon)', 'Proposition du Conseil des Maîtres : Passe / Redouble / Abandon (A)', 'Décision du CCEB']];
    currentPropRows.forEach((r, i) => {
      const rg = r.abandon ? 'A' : (r.rankInfo ? rankSuffix(r.rankInfo.rank, r.isGirl, r.rankInfo.tie) : '');
      const annualTxt = r.abandon ? '0.00' : (r.annual != null ? r.annual : '');
      const statutTxt = (r.abandon || r.s.status === 'A') ? 'A' : 'Actif';
      const conseilEl = viewContainer.querySelector('.prop-conseil[data-id="' + r.s.id + '"]');
      const ccebEl = viewContainer.querySelector('.prop-cceb[data-id="' + r.s.id + '"]');
      const conseil = conseilEl ? conseilEl.value : r.decision;
      const cceb = ccebEl ? ccebEl.value : '';
      rows.push([i + 1, rg, r.s.full_name, r.s.gender === 'M' ? 'M' : 'F', r.t1, r.t2, r.t3, annualTxt, statutTxt, conseil, cceb]);
    });
    downloadCSV('proposition_fin_annee.csv', rows);
  }

  async function loadPai(classId, term) {
    return await loadPaiRecord(supabase, classId, term);
  }

  async function renderSynthese() {
    const cls = await getMyClass();
    if (!cls) return renderClassSetup();
    currentClass = cls;
    myClassLevel = cls.level || null;
    updateExamBlancNav();
    const subjects = await getSubjectsForClass(cls);
    const { data: students } = await supabase.from('students').select('*').eq('class_id', cls.id).order('full_name');
    const list = students || [];
    const { data: notes } = await supabase.from('notes').select('*').eq('classe_id', cls.id);
    const allNotes = notes || [];
    let schoolName = '';
    if (cls.school_id) {
      const { data: school } = await supabase.from('schools').select('name').eq('id', cls.school_id).single();
      schoolName = (school && school.name) || '';
    }
    let teacherNames = [];
    let teacherSigners = [];
    try {
      const { data: links } = await supabase.from('class_teachers').select('teacher_id, profiles(id,full_name,signature_url)').eq('class_id', cls.id);
      teacherSigners = (links || []).map(link => link.profiles).filter(person => person && person.full_name && !String(person.full_name).includes('Aperçu'));
      teacherNames = teacherSigners.map(person => person.full_name);
    } catch (e) { /* ignore */ }
    const profileName = (state.realProfile && state.realProfile.full_name) || (state.profile && state.profile.full_name);
    if (!teacherNames.length && profileName && !String(profileName).includes('Aperçu')) teacherNames = [profileName];

    const term = parseInt((viewContainer.querySelector('#synthTerm') && viewContainer.querySelector('#synthTerm').value) || '1', 10);
    let pai = null;
    try {
      pai = await loadPai(cls.id, term);
    } catch (error) {
      console.error('Impossible de charger le PAI depuis Supabase.', error);
      alert('Impossible de charger les données du PAI : ' + (error && error.message ? error.message : String(error)));
    }
    const { data: visaConfigs } = await supabase.from('registre_configs').select('visa_directeur').eq('classe_id', cls.id);
    const visaDirecteur = (visaConfigs || []).map(config => config.visa_directeur).find(Boolean) || '';
    if (!teacherSigners.length && titularSigners.length && teacherNames.join(', ').includes(titularSigners[0].full_name)) teacherSigners = titularSigners;
    const directorSignatureUrl = actualProfile.role === 'directeur' && profileMatchesVisa(visaDirecteur, actualProfile)
      ? signatureUrlForProfile(actualProfile)
      : '';
    currentSynthese = { schoolName, cls, list, subjects, allNotes, teacherNames, teacherSigners, term, pai, visaDirecteur, directorSignatureUrl };

    viewContainer.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:180px">
            <label>Trimestre</label>
            <select id="synthTerm">
              <option value="1" ${term === 1 ? 'selected' : ''}>1er Trimestre</option>
              <option value="2" ${term === 2 ? 'selected' : ''}>2e Trimestre</option>
              <option value="3" ${term === 3 ? 'selected' : ''}>3e Trimestre</option>
            </select>
          </div>
          <button class="btn" data-action="preview-synth">👁 Aperçu</button>
          <button class="btn" data-action="save-pai">💾 Enregistrer les modifications de la fiche synthèse</button>
          <button class="btn" data-action="csv-synth">📥 Excel/CSV</button>
          <button class="btn" data-action="synth-pdf">📄 Exporter en PDF</button>
          <button class="btn secondary" data-action="synth-word">📝 Exporter en Word (.doc)</button>
          <button class="btn secondary" data-action="print-page">🖨️ Imprimer / PDF</button>
        </div>
        <div id="paiSaveStatus" class="no-print" role="status" aria-live="polite" style="display:none;margin-top:10px;padding:10px 12px;border-radius:6px;font-weight:700"></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div id="syntheseSheet">${renderSyntheseHTML({ schoolName, cls, students: list, subjects, notes: allNotes, term, pai, teacherNames, teacherSigners, visaDirecteur, visaDirecteurSignatureUrl: directorSignatureUrl, editable: true })}</div>
      </div>`;

    wirePDFExportButton(
      viewContainer.querySelector('[data-action="synth-pdf"]'),
      () => viewContainer.querySelector('#syntheseSheet'),
      `fiche_synthese_T${term}.pdf`,
      { orientation: 'portrait', format: 'a4', margin: 12 }
    );
    wireWordExportButton(
      viewContainer.querySelector('[data-action="synth-word"]'),
      () => viewContainer.querySelector('#syntheseSheet'),
      `fiche_synthese_T${term}.doc`,
      `Fiche Synthèse Trimestrielle T${term}`
    );
    const sel = viewContainer.querySelector('#synthTerm');
    if (sel) sel.addEventListener('change', () => renderSynthese());
    wirePaiInputs(cls.id, cls.school_id, term, computeSubjectRows(list, subjects, allNotes, term), pai);
  }

  function wirePaiInputs(classId, schoolId, term, subjectRows, initialPai) {
    const disc = viewContainer.querySelector('#paiDiscipline');
    const tauxDepartInput = viewContainer.querySelector('#paiTaux');
    const tauxTrimInput = viewContainer.querySelector('#paiTauxTrim');
    const modeEl = viewContainer.querySelector('#paiTauxTrimMode');
    const statusEl = viewContainer.querySelector('#paiSaveStatus');
    const saveButton = viewContainer.querySelector('[data-action="save-pai"]');
    let manualTauxTrim = initialPai && initialPai.taux_trimestre != null
      ? String(initialPai.taux_trimestre)
      : '';

    const showStatus = (message, kind) => {
      if (!statusEl) return;
      const colors = kind === 'success'
        ? ['#dcfce7', '#166534']
        : (kind === 'pending' ? ['#fef3c7', '#92400e'] : ['#fee2e2', '#991b1b']);
      statusEl.textContent = message;
      statusEl.style.display = 'block';
      statusEl.style.background = colors[0];
      statusEl.style.color = colors[1];
    };

    const matchingSubject = () => {
      const normalized = normalizePaiDiscipline(disc ? disc.value : '');
      return normalized
        ? (subjectRows || []).find(row => row.tComp > 0 && normalizePaiDiscipline(row.name) === normalized) || null
        : null;
    };

    const parseRate = (input, label) => {
      if (!input || input.value.trim() === '') return null;
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new Error(`${label} doit être compris entre 0 et 100.`);
      }
      return Math.round(value * 10) / 10;
    };

    const updateEcart = () => {
      const ecartEl = viewContainer.querySelector('#paiEcart');
      if (!ecartEl) return;
      const tauxTrim = tauxTrimInput && tauxTrimInput.value !== '' ? Number(tauxTrimInput.value) : null;
      const tauxDepart = tauxDepartInput && tauxDepartInput.value !== '' ? Number(tauxDepartInput.value) : null;
      if (tauxTrim != null && tauxDepart != null && Number.isFinite(tauxDepart) && Number.isFinite(tauxTrim)) {
        const ec = Math.round((tauxTrim - tauxDepart) * 10) / 10;
        ecartEl.textContent = (ec >= 0 ? '+' : '') + ec.toFixed(1) + '%';
        ecartEl.style.color = ec >= 0 ? '#16a34a' : '#dc2626';
      } else { ecartEl.textContent = '—'; }
    };

    const updateRateMode = () => {
      if (!tauxTrimInput) return;
      const matched = matchingSubject();
      if (matched) {
        if (!tauxTrimInput.readOnly && tauxTrimInput.value !== '') manualTauxTrim = tauxTrimInput.value;
        tauxTrimInput.readOnly = true;
        tauxTrimInput.value = String(matched.pctT);
        if (modeEl) modeEl.textContent = 'Calculé automatiquement depuis les résultats.';
      } else {
        if (tauxTrimInput.readOnly) tauxTrimInput.value = manualTauxTrim;
        tauxTrimInput.readOnly = false;
        if (modeEl) modeEl.textContent = 'Saisie manuelle : discipline non évaluée.';
      }
      updateEcart();
    };

    const buildPaiRecord = () => {
      const match = matchingSubject();
      const discipline = disc ? disc.value.trim().replace(/\s+/g, ' ') : '';
      const tauxDepart = parseRate(tauxDepartInput, 'Le taux de début d’année');
      const tauxTrimestre = match
        ? match.pctT
        : parseRate(tauxTrimInput, 'Le taux du trimestre');
      const ecart = tauxDepart != null && tauxTrimestre != null
        ? Math.round((tauxTrimestre - tauxDepart) * 10) / 10
        : null;
      return {
        classe_id: classId,
        ecole_id: schoolId || null,
        trimestre: term,
        discipline,
        taux_depart: tauxDepart,
        taux_trimestre: tauxTrimestre,
        ecart,
        difficultes: viewContainer.querySelector('#syntheseDifficultes')?.value || '',
        suggestions: viewContainer.querySelector('#syntheseSuggestions')?.value || ''
      };
    };

    const saveDraftLocally = () => {
      try {
        writePaiBackup(buildPaiRecord());
        showStatus('Modifications enregistrées localement. Cliquez sur Enregistrer pour synchroniser avec Supabase.', 'pending');
      } catch (error) {
        console.error('Impossible de sauvegarder le brouillon local du PAI.', error);
        showStatus('La sauvegarde locale a échoué : ' + (error && error.message ? error.message : String(error)), 'error');
      }
    };

    const save = async () => {
      if (!saveButton) return;
      const oldText = saveButton.textContent;
      saveButton.disabled = true;
      saveButton.textContent = 'Enregistrement…';
      try {
        const record = buildPaiRecord();
        let localSaved = false;
        let localError = null;
        try {
          writePaiBackup(record);
          localSaved = true;
        } catch (error) {
          localError = error;
          console.error('Impossible de sauvegarder le PAI localement.', localError);
        }

        try {
          await savePaiRecord(supabase, record);
        } catch (remoteError) {
          console.error('Impossible de sauvegarder le PAI dans Supabase.', remoteError);
          const prefix = localSaved
            ? 'Sauvegarde locale conservée. '
            : 'Échec de la sauvegarde locale. ';
          showStatus(prefix + 'Échec de l’enregistrement Supabase : ' + (remoteError && remoteError.message ? remoteError.message : String(remoteError)), 'error');
          return;
        }

        currentSynthese.pai = record;
        if (localSaved) {
          showStatus('Fiche synthèse enregistrée avec succès', 'success');
        } else {
          showStatus('Fiche enregistrée dans Supabase, mais la sauvegarde locale a échoué : ' + (localError && localError.message ? localError.message : String(localError)), 'error');
        }
      } catch (error) {
        showStatus(error && error.message ? error.message : String(error), 'error');
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = oldText;
      }
    };

    updateRateMode();
    [disc, tauxDepartInput, tauxTrimInput].forEach(input => {
      if (!input) return;
      input.addEventListener('input', () => {
        if (input === disc) updateRateMode();
        else updateEcart();
        saveDraftLocally();
      });
    });
    ['#syntheseDifficultes', '#syntheseSuggestions'].forEach(selector => {
      viewContainer.querySelector(selector)?.addEventListener('input', saveDraftLocally);
    });
    if (saveButton) saveButton.addEventListener('click', save);
  }

  function exportSynthCSV() {
    if (!currentSynthese) { alert('Ouvrez la Fiche Synthèse d\'abord.'); return; }
    const { schoolName, cls, list, subjects, allNotes, term } = currentSynthese;
    const rows = [['Fiche Synthèse Trimestrielle — ' + classLabel(cls) + ' — T' + term, '', '', '', '', '', '']];
    rows.push(['École', schoolName]);
    const boys = list.filter(s => s.gender === 'M').length;
    const girls = list.filter(s => s.gender === 'F').length;
    rows.push(['Effectif début année (G/F/Total)', boys, girls, list.length]);
    rows.push([]);
    rows.push(['Matière', 'G ayant la moyenne', '% G', 'F ayant la moyenne', '% F', 'Total ayant la moyenne', '% Total']);
    computeSubjectRows(list, subjects, allNotes, term).forEach(r => {
      rows.push([r.name, r.bPass + '/' + r.bComp, r.pctG + '%', r.gPass + '/' + r.gComp, r.pctF + '%', r.tPass + '/' + r.tComp, r.pctT + '%']);
    });
    const averageSummary = computeClassAverageSummary(list, subjects, allNotes, term);
    rows.push([]);
    rows.push(['Plus forte moyenne', averageSummary.highest == null ? '' : averageSummary.highest.toFixed(2) + ' / 10']);
    rows.push(['Plus faible moyenne', averageSummary.lowest == null ? '' : averageSummary.lowest.toFixed(2) + ' / 10']);
    rows.push(['Moyenne de la classe', averageSummary.classAverage == null ? '' : averageSummary.classAverage.toFixed(2) + ' / 10']);
    const pai = currentSynthese.pai || {};
    rows.push([]);
    rows.push(['PAI — Discipline', pai.discipline || '']);
    rows.push(['PAI — Taux début année (%)', pai.taux_depart != null && pai.taux_depart !== '' ? pai.taux_depart : '']);
    rows.push(['PAI — Taux trimestre (%)', pai.taux_trimestre != null && pai.taux_trimestre !== '' ? pai.taux_trimestre : '']);
    rows.push(['PAI — Écart (%)', pai.ecart != null && pai.ecart !== '' ? pai.ecart : '']);
    rows.push(['Difficultés rencontrées', pai.difficultes || '']);
    rows.push(['Suggestions', pai.suggestions || '']);
    downloadCSV('fiche_synthese_T' + term + '.csv', rows);
  }

  const MOIS_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  function halfDaysForDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const wd = d.getDay();
    if (wd === 0 || wd === 6) return [];
    if (wd === 3) return ['M'];
    return ['M', 'S'];
  }

  function moisFromDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return MOIS_NAMES[d.getMonth()] || '';
  }

  function workingHalfDays(year, monthIndex) {
    const days = new Date(year, monthIndex + 1, 0).getDate();
    let count = 0;
    for (let day = 1; day <= days; day++) {
      const wd = new Date(year, monthIndex, day).getDay();
      if (wd === 0 || wd === 6) continue;
      count += (wd === 3) ? 1 : 2;
    }
    return count;
  }

  async function renderRegistre() {
    const cls = await getMyClass();
    if (!cls) return renderClassSetup();
    currentClass = cls;
    myClassLevel = cls.level || null;
    updateExamBlancNav();
    if (registreMode === 'synthese') return renderSyntheseMensuelle();
    return renderAppelJournalier();
  }

  async function renderAppelJournalier() {
    const cls = await getMyClass();
    if (!cls) return renderClassSetup();
    currentClass = cls;
    const startYear = parseInt((cls.year || state.activeSchoolYear || '2026-2027').split('-')[0], 10) || 2026;
    const months = REG_MONTHS.map(m => ({ name: m.name, year: startYear + m.yearOff, month: m.month }));
    const month = months[regMonthIdx] || months[0];
    const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
    const workingDays = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const wd = new Date(month.year, month.month, day).getDay();
      if (wd === 0 || wd === 6) continue;
      const dateStr = `${month.year}-${String(month.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      workingDays.push({ day, wd, date: dateStr, abbrev: DAY_ABBREV[wd] || '' });
    }

    const { data: config } = await supabase.from('registre_configs').select('*').eq('classe_id', cls.id).eq('mois', month.name).limit(1);
    const localConfig = getLocalRegistreConfigs(cls.id)[month.name] || {};
    const cfg = { ...localConfig, ...((config && config[0]) || {}) };
    const joursValides = cfg.jours_valides || cfg.jours_pointes || [];
    currentJoursValidesByMonth[month.name] = joursValides;
    const recordedSet = new Set(joursValides);
    const nbDemi = sumHalfDays(joursValides);

    const dayPanel = selectedDate ? await renderDayPanel(cls, selectedDate) : '';

    viewContainer.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div style="display:flex;gap:8px">
            <button class="btn ${registreMode === 'appel' ? '' : 'secondary'}" data-action="reg-mode" data-mode="appel">📅 Appel Journalier</button>
            <button class="btn ${registreMode === 'synthese' ? '' : 'secondary'}" data-action="reg-mode" data-mode="synthese">📄 Fiche d'Arrêt Mensuel</button>
          </div>
          <div style="flex:1"></div>
          <div class="form-group" style="margin:0;min-width:180px">
            <label>Mois</label>
            <select id="regMonth">
              ${months.map((mo, i) => `<option value="${i}" ${i === regMonthIdx ? 'selected' : ''}>${mo.name} ${mo.year}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <h3 style="margin:0">Jours ouvrables — ${month.name} ${month.year}</h3>
          <div style="font-size:13px;background:#f8fafc;border:1px solid #e2e8f0;padding:6px 10px;border-radius:6px">
            Jours validés : <strong>${recordedSet.size}</strong> · Demi-journées : <strong>${nbDemi}</strong>
          </div>
        </div>
        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-top:10px">
          ${workingDays.map(d => {
            const recorded = recordedSet.has(d.date);
            const isSel = selectedDate === d.date;
            const clsName = 'day-pill ' + (recorded ? 'validated' : '') + (isSel ? ' open-day' : '');
            return `<div class="${clsName}" data-action="select-day" data-date="${d.date}" title="${recorded ? 'Jour validé' : (isSel ? 'Jour ouvert' : 'Cliquer pour ouvrir')}" style="min-width:44px;text-align:center;padding:4px 5px;border-radius:7px;cursor:pointer;border:1px solid #cbd5e1;line-height:1.15">
              <div style="font-weight:800;font-size:12px">${d.abbrev}</div>
              <div style="font-size:12px">${d.day}</div>
              <div class="day-check">${recorded ? '✓' : '&nbsp;'}</div>
            </div>`;
          }).join('')}
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn danger" data-action="cloture-mois">🛑 Arrêter / Clôturer le mois</button>
        </div>
      </div>
      ${dayPanel}
    `;
    const monthSel = viewContainer.querySelector('#regMonth');
    if (monthSel) monthSel.addEventListener('change', () => { regMonthIdx = parseInt(monthSel.value, 10) || 0; selectedDate = null; pendingDayAttendance = null; renderAppelJournalier(); });
  }

  async function renderDayPanel(cls, dateStr) {
    const wd = new Date(dateStr + 'T00:00:00').getDay();
    const isFullDay = (wd !== 3);
    const { data: students } = await supabase.from('students').select('*').eq('class_id', cls.id).order('full_name');
    const all = students || [];
    const list = all.filter(s => s.status !== 'A');
    const excluded = all.filter(s => s.status === 'A').length;
    if (!pendingDayAttendance || pendingDayAttendance.date !== dateStr) {
      const map = {};
      const { data: presences } = await supabase.from('presences').select('*').eq('classe_id', cls.id).eq('date_jour', dateStr);
      (presences || []).forEach(p => {
        if (p.statut === 'A') {
          const eid = String(p.eleve_id);
          if (!map[eid]) map[eid] = { matin: 'P', soir: 'P' };
          if (p.demi_journee === 'M') map[eid].matin = 'A';
          if (p.demi_journee === 'S') map[eid].soir = 'A';
        }
      });
      pendingDayAttendance = { date: dateStr, map };
    }
    const paBtn = (eleveId, demi, value) => {
      const p = value === 'P';
      const a = value === 'A';
      const clsP = p ? 'pa-toggle selected-p' : 'pa-toggle';
      const clsA = a ? 'pa-toggle selected-a' : 'pa-toggle';
      return `<div style="display:inline-flex;gap:4px;align-items:center">
        <button type="button" class="${clsP}" data-action="pa-toggle" data-eleve="${esc(String(eleveId))}" data-date="${esc(dateStr)}" data-demi="${demi}" data-value="P" aria-label="Présent" aria-pressed="${p}">${p ? '✓ P' : 'P'}</button>
        <button type="button" class="${clsA}" data-action="pa-toggle" data-eleve="${esc(String(eleveId))}" data-date="${esc(dateStr)}" data-demi="${demi}" data-value="A" aria-label="Absent" aria-pressed="${a}">${a ? '✓ A' : 'A'}</button>
      </div>`;
    };
    const colCount = isFullDay ? 5 : 4;
    return `
      <div class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <h3 style="margin:0">Appel — ${esc(dateStr)} ${isFullDay ? '(Matin + Soir)' : '(Mercredi — Matin uniquement)'}</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" data-action="validate-day">💾 Valider l'appel du jour</button>
            <button class="btn secondary" data-action="print-page">🖨️ Imprimer / PDF</button>
          </div>
        </div>
        ${excluded > 0 ? `<p style="font-size:12px;color:#64748b;margin-top:6px">${excluded} élève(s) abandonné(s) (A) exclu(s) des effectifs actifs.</p>` : ''}
        <div class="table-wrap" style="margin-top:12px">
          <table>
            <thead><tr><th>#</th><th>Élève</th><th>Sexe</th><th>Matin</th>${isFullDay ? '<th>Soir</th>' : ''}</tr></thead>
            <tbody>
              ${list.map((s, i) => {
                const st = (pendingDayAttendance.map[String(s.id)] || { matin: 'P', soir: 'P' });
                const vM = st.matin;
                const vS = st.soir;
                return `<tr data-eleve-row="${esc(s.id)}">
                  <td>${i + 1}</td>
                  <td>${s.gender === 'F' ? `<strong style="color:#dc2626">${esc(s.full_name)}</strong>` : `<strong>${esc(s.full_name)}</strong>`}</td>
                  <td>${s.gender === 'M' ? 'M' : 'F'}</td>
                  <td>${paBtn(s.id, 'M', vM)}</td>
                  ${isFullDay ? `<td>${paBtn(s.id, 'S', vS)}</td>` : ''}
                </tr>`;
              }).join('') || `<tr><td colspan="${colCount}">Aucun élève actif</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function togglePendingAttendance(btn) {
    if (!selectedDate || !pendingDayAttendance) return;
    const eleveId = String(btn.dataset.eleve);
    const demi = String(btn.dataset.demi);
    const value = String(btn.dataset.value);
    if (demi === 'S' && new Date(selectedDate + 'T00:00:00').getDay() === 3) return;
    if (!pendingDayAttendance.map[eleveId]) {
      pendingDayAttendance.map[eleveId] = { matin: 'P', soir: 'P' };
    }
    if (demi === 'M') pendingDayAttendance.map[eleveId].matin = value;
    else if (demi === 'S') pendingDayAttendance.map[eleveId].soir = value;

    const row = btn.closest('tr[data-eleve-row]');
    if (row) {
      const btns = row.querySelectorAll('.pa-toggle');
      btns.forEach(b => {
        const v = String(b.dataset.value);
        const d = String(b.dataset.demi);
        const st = pendingDayAttendance.map[eleveId];
        const cur = (d === 'M') ? st.matin : st.soir;
        const sel = (v === cur);
        b.className = 'pa-toggle' + (sel ? (v === 'A' ? ' selected-a' : ' selected-p') : '');
        b.textContent = v === 'A' ? (sel ? 'A' : 'A') : (sel ? 'P' : 'P');
        b.setAttribute('aria-pressed', sel ? 'true' : 'false');
      });
    }
  }

  async function savePendingDayAbsences(dateStr) {
    const cls = currentClass;
    if (!cls || !pendingDayAttendance || !selectedDate) return;
    const mois = moisFromDate(dateStr);
    const { error: deleteError } = await supabase.from('presences').delete().eq('classe_id', cls.id).eq('date_jour', dateStr);
    if (deleteError) throw deleteError;
    const rows = [];
    const wd = new Date(dateStr + 'T00:00:00').getDay();
    const demis = (wd === 3) ? ['M'] : ['M', 'S'];
    const amap = pendingDayAttendance.map || {};
    Object.keys(amap).forEach(eid => {
      const st = amap[eid];
      demis.forEach(demi => {
        const absent = (demi === 'M') ? (st.matin === 'A') : (st.soir === 'A');
        if (absent) rows.push({ classe_id: cls.id, ecole_id: cls.school_id, eleve_id: eid, date_jour: dateStr, demi_journee: demi, statut: 'A', mois });
      });
    });
    if (rows.length) {
      const { error: insertError } = await supabase.from('presences').insert(rows);
      if (insertError) throw insertError;
    }
  }

  async function markDayRecorded(dateStr) {
    const cls = currentClass;
    if (!cls) return;
    const mois = moisFromDate(dateStr);
    const { data: existing, error: findErr } = await supabase.from('registre_configs').select('*').eq('classe_id', cls.id).eq('mois', mois).limit(1);
    if (findErr) throw findErr;
    const localConfig = getLocalRegistreConfigs(cls.id)[mois] || {};
    let jours = (existing && existing[0] && existing[0].jours_valides) || localConfig.jours_valides || [];
    jours = Array.isArray(jours) ? [...jours] : [];
    if (!jours.includes(dateStr)) jours.push(dateStr);
    const demi = sumHalfDays(jours);
    currentJoursValidesByMonth[mois] = jours;
    saveLocalRegistreConfig(cls.id, mois, { jours_valides: jours, nb_demi_journees: demi });
    if (existing && existing[0]) {
      const { error } = await supabase.from('registre_configs').update({ jours_valides: jours, nb_demi_journees: demi }).eq('id', existing[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('registre_configs').insert({ classe_id: cls.id, mois, jours_valides: jours, nb_demi_journees: demi, mois_cloture: false });
      if (error) throw error;
    }
  }

  async function clotureMois() {
    const cls = currentClass;
    if (!cls) return;
    const month = REG_MONTHS[regMonthIdx] || REG_MONTHS[0];
    if (!confirm('Clôturer ' + month.name + ' ? Les présences de ce mois seront figées pour la synthèse.')) return;
    try {
      const { data: existing, error: findError } = await supabase.from('registre_configs').select('*').eq('classe_id', cls.id).eq('mois', month.name).limit(1);
      if (findError) throw findError;
      const localConfig = getLocalRegistreConfigs(cls.id)[month.name] || {};
      const jours = (existing && existing[0] && existing[0].jours_valides) || localConfig.jours_valides || [];
      const demi = sumHalfDays(jours);
      saveLocalRegistreConfig(cls.id, month.name, { jours_valides: jours, nb_demi_journees: demi, mois_cloture: true });
      if (existing && existing[0]) {
        const { error } = await supabase.from('registre_configs').update({ mois_cloture: true }).eq('id', existing[0].id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('registre_configs').insert({ classe_id: cls.id, mois: month.name, mois_cloture: true, jours_valides: jours, nb_demi_journees: demi });
        if (error) throw error;
      }
    } catch (error) {
      alert('Erreur lors de la clôture : ' + (error && error.message ? error.message : String(error)));
      return;
    }
    alert(month.name + " clôturé. Il apparaît désormais dans la Fiche d'Arrêt Mensuel.");
    registreMode = 'synthese';
    renderSubView('registre');
  }

  async function validateDay() {
    if (!currentClass || !selectedDate) return;
    const btn = viewContainer.querySelector('[data-action="validate-day"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement...'; }
    try {
      await savePendingDayAbsences(selectedDate);
      await markDayRecorded(selectedDate);
      pendingDayAttendance = null;
      const msg = 'Appel du jour validé et enregistré';
      // mini toast vert
      let t = document.getElementById('regToast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'regToast';
        t.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:12000;background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.3);opacity:0;transition:opacity .2s;pointer-events:none';
        document.body.appendChild(t);
      }
      t.textContent = '✓ ' + msg;
      t.style.opacity = '1';
      clearTimeout(t._timer);
      t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2600);
      renderAppelJournalier();
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Valider l\'appel du jour'; }
      await renderAppelJournalier();
      alert('Erreur lors de la validation : ' + (e && e.message ? e.message : String(e)));
    }
  }

  async function renderSyntheseMensuelle() {
    const cls = await getMyClass();
    if (!cls) return renderClassSetup();
    currentClass = cls;
    const { data: students } = await supabase.from('students').select('*').eq('class_id', cls.id);
    const allStudents = students || [];

    const { data: presences } = await supabase.from('presences').select('*').eq('classe_id', cls.id);
    const absences = (presences || []).filter(p => p.statut === 'A');

    const startYear = parseInt((cls.year || state.activeSchoolYear || '2026-2027').split('-')[0], 10) || 2026;
    const months = schoolMonths(startYear);
    const joursValidesByMonth = {};
    const closedSet = new Set();
    const localConfigs = getLocalRegistreConfigs(cls.id);
    const configByMonth = { ...localConfigs };
    const { data: configs } = await supabase.from('registre_configs').select('*').eq('classe_id', cls.id);
    (configs || []).forEach(c => {
      configByMonth[c.mois] = { ...(configByMonth[c.mois] || {}), ...c };
      joursValidesByMonth[c.mois] = c.jours_valides || localConfigs[c.mois]?.jours_valides || [];
      if (c.mois_cloture) closedSet.add(c.mois);
    });
    Object.keys(localConfigs).forEach(monthName => {
      if (!joursValidesByMonth[monthName]) joursValidesByMonth[monthName] = localConfigs[monthName].jours_valides || [];
      if (localConfigs[monthName].mois_cloture) closedSet.add(monthName);
    });
    currentJoursValidesByMonth = joursValidesByMonth;

    const closedMonths = months.filter(m => closedSet.has(m.name));
    if (closedMonths.length && ficheMonthIdx >= closedMonths.length) ficheMonthIdx = 0;
    const activeMonth = closedMonths[ficheMonthIdx] || closedMonths[0] || null;
    currentClosedMonthRows = computeMonthlyRegister(allStudents, absences, startYear, joursValidesByMonth).filter(r => closedSet.has(r.name));
    currentClosedVisaDirecteur = {};
    currentClosedVisaEncadreur = {};
    closedMonths.forEach(m => {
      currentClosedVisaDirecteur[m.name] = configByMonth[m.name]?.visa_directeur || '';
      currentClosedVisaEncadreur[m.name] = configByMonth[m.name]?.visa_encadreur || '';
    });
    currentMonthRows = activeMonth ? [computeFicheArretMensuel(allStudents, absences, activeMonth, joursValidesByMonth[activeMonth.name] || [])] : [];

    let schoolName = '';
    if (cls.school_id) {
      const { data: school } = await supabase.from('schools').select('name').eq('id', cls.school_id).single();
      schoolName = (school && school.name) || '';
    }
    let teacherNames = [];
    let teacherSigners = [];
    try {
      const { data: links } = await supabase.from('class_teachers').select('teacher_id, profiles(id,full_name,signature_url)').eq('class_id', cls.id);
      teacherSigners = (links || []).map(link => link.profiles).filter(person => person && person.full_name && !String(person.full_name).includes('Aperçu'));
      teacherNames = teacherSigners.map(person => person.full_name);
    } catch (e) { /* ignore */ }
    if (!teacherNames.length && cls.titulaire_id) {
      const { data: teacher } = await supabase.from('profiles').select('id,full_name,signature_url').eq('id', cls.titulaire_id).single();
      if (teacher && teacher.full_name && !String(teacher.full_name).includes('Aperçu')) {
        teacherNames = [teacher.full_name];
        teacherSigners = [teacher];
      }
    }
    const actingTeacher = (state.realProfile && state.realProfile.full_name) || (state.profile && state.profile.full_name);
    if (!teacherNames.length && actingTeacher && !String(actingTeacher).includes('Aperçu')) teacherNames = [actingTeacher];
    if (!teacherSigners.length && titularSigners.length && teacherNames.join(', ').includes(titularSigners[0].full_name)) teacherSigners = titularSigners;

    const monthConfig = activeMonth ? ((configs || []).find(c => c.mois === activeMonth.name) || {}) : {};
    currentFicheData = activeMonth ? {
      cls, schoolName, className: classLabel(cls), monthName: activeMonth.name,
      data: currentMonthRows[0], teacherNames, teacherSigners,
      visaDirecteur: monthConfig.visa_directeur || ''
    } : null;

    const opts = closedMonths.map((m, i) => `<option value="${i}" ${i === ficheMonthIdx ? 'selected' : ''}>${m.name}</option>`).join('');

    const ficheCard = activeMonth
      ? `<div class="card" style="margin-top:16px">
          <div id="ficheSheet" class="portrait-sheet">${renderFicheArretMensuelHTML({
            schoolName: currentFicheData.schoolName,
            className: currentFicheData.className,
            monthName: currentFicheData.monthName,
            data: currentFicheData.data,
            teacherNames: currentFicheData.teacherNames,
            teacherSigners: currentFicheData.teacherSigners,
            visaDirecteur: currentFicheData.visaDirecteur,
            visaDirecteurSignatureProfile: actualProfile.role === 'directeur' && profileMatchesVisa(currentFicheData.visaDirecteur, actualProfile) ? actualProfile : null,
            showVisaButton: false,
            onVisaLabel: ''
          })}</div>
        </div>`
      : `<div class="card" style="margin-top:16px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" data-action="reg-mode" data-mode="appel">📅 Appel Journalier</button>
            <button class="btn secondary" data-action="reg-mode" data-mode="synthese">📄 Fiche d'Arrêt Mensuel</button>
          </div>
          <p style="color:#64748b;margin-top:14px">Aucun mois clôturé. Arrêtez le mois depuis l'Appel Journalier.</p>
        </div>`;

    viewContainer.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn ${registreMode === 'appel' ? '' : 'secondary'}" data-action="reg-mode" data-mode="appel">📅 Appel Journalier</button>
            <button class="btn ${registreMode === 'synthese' ? '' : 'secondary'}" data-action="reg-mode" data-mode="synthese">📄 Fiche d'Arrêt Mensuel</button>
          </div>
          <div style="flex:1"></div>
          ${activeMonth ? `
            <div class="form-group" style="margin:0;min-width:180px">
              <label>Mois clôturé</label>
              <select id="ficheMonth">${opts}</select>
            </div>
            <button class="btn" data-action="preview-reg">👁 Aperçu</button>
            <button class="btn" data-action="csv-reg">📥 Excel/CSV</button>
            <button class="btn secondary" data-action="print-page">🖨️ Imprimer / PDF</button>` : ''}
        </div>
      </div>
      ${ficheCard}`;

    viewContainer.insertAdjacentHTML('beforeend', `
      <div class="card monthly-register-sheet" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <h3 style="margin:0">${ANNUAL_SYNTHESIS_TITLE}</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" data-action="preview-closed-months">👁 Aperçu</button>
            <button class="btn" data-action="pdf-closed-months">📄 PDF (A4 paysage)</button>
            <button class="btn secondary" data-action="print-closed-months">🖨️ Imprimer</button>
            <button class="btn" data-action="csv-closed-months">📥 Excel/CSV</button>
          </div>
        </div>
        <div id="closedMonthsSummary" style="margin-top:12px">${renderMonthlyRegisterTable(currentClosedMonthRows, {
          visaDirecteurByMonth: currentClosedVisaDirecteur,
          visaEncadreurByMonth: currentClosedVisaEncadreur,
          visaDirecteurProfile: actualProfile.role === 'directeur' ? actualProfile : null,
          visaEncadreurProfile: actualProfile.role === 'encadreur' ? actualProfile : null
        })}${signatureBlockHTML('Le(s) Titulaire(s)', titularSigners, currentFicheData ? currentFicheData.teacherNames.join(', ') : (teacherNames || []).join(', '))}</div>
      </div>`);
    wirePDFExportButton(
      viewContainer.querySelector('[data-action="pdf-closed-months"]'),
      () => viewContainer.querySelector('#closedMonthsSummary')?.closest('.monthly-register-sheet'),
      'synthese_mois_arretes.pdf',
      { orientation: 'landscape', format: 'a4', margin: 10 }
    );
    const sel = viewContainer.querySelector('#ficheMonth');
    if (sel) sel.addEventListener('change', () => { ficheMonthIdx = parseInt(sel.value, 10) || 0; renderSyntheseMensuelle(); });
  }

  function exportClosedMonthsCSV() {
    if (!currentClosedMonthRows.length) { alert('Aucun mois clôturé à exporter.'); return; }
    const rows = monthlyRegisterCSVRows(currentClosedMonthRows, {
      visaDirecteurByMonth: currentClosedVisaDirecteur,
      visaEncadreurByMonth: currentClosedVisaEncadreur
    });
    downloadCSV('synthese_mois_arretes.csv', rows);
  }

  function exportRegistreCSV() {
    if (!currentFicheData || !currentFicheData.data) { alert('Ouvrez la Fiche d\'Arrêt Mensuel d\'abord.'); return; }
    const r = currentFicheData.data;
    const rows = [];
    rows.push(['CEB de Bagré', '', '', '']);
    rows.push(['École', currentFicheData.schoolName || '', '', '']);
    rows.push(['Classe', currentFicheData.className || '', '', '']);
    rows.push(['ARRÊT DU MOIS DE ' + String(currentFicheData.monthName || '').toUpperCase(), '', '', '']);
    rows.push([]);
    rows.push(...monthlyClosureCSVRows(r));
    rows.push([]);
    rows.push(['Le(s) Titulaire(s)', currentFicheData.teacherNames.join(', ')]);
    rows.push(['Visa du Directeur', currentFicheData.visaDirecteur || '']);
    downloadCSV('arre_t_' + String(currentFicheData.monthName || 'mois').toLowerCase() + '_' + String(currentFicheData.className || 'classe').replace(/\s+/g, '_') + '.csv', rows);
  }

  async function loadSchoolClasses() {
    const profile = state.profile || {};
    let schoolId = profile.school_id || profile.ecole_id || null;
    let schoolName = profile.ecole_nom || profile.school_name || '';
    let school = null;
    if (schoolId) {
      try {
        const { data: s } = await supabase.from('schools').select('*').eq('id', schoolId).maybeSingle();
        if (s) { school = s; schoolName = s.name || schoolName; }
      } catch (e) { /* ignore */ }
    }
    const queries = [];
    if (schoolId) {
      queries.push(supabase.from('classes').select('*').eq('school_id', schoolId));
      queries.push(supabase.from('classes').select('*').eq('ecole_id', schoolId));
    }
    if (schoolName) {
      queries.push(supabase.from('classes').select('*').eq('ecole_nom', schoolName));
    }
    const results = await Promise.all(queries);
    const byKey = new Map();
    results.forEach(res => {
      if (!res || res.error || !Array.isArray(res.data)) return;
      res.data.forEach(c => {
        if (!c) return;
        const key = String(formatClassName(c) || c.name || c.id || '').trim().toLowerCase();
        if (!key) return;
        if (!byKey.has(key)) byKey.set(key, c);
      });
    });
    const classes = Array.from(byKey.values())
      .sort((a, b) => formatClassName(a).localeCompare(formatClassName(b)));
    return { school, schoolName, classes };
  }

  async function renderEvaluer() {
    const { school, schoolName, classes } = await loadSchoolClasses();
    evalClassesList = classes;
    evalSchoolLabel = (school && school.name) || schoolName || '—';
    const selectedClassId = evalClass ? String(evalClass.id) : '';
    const opts = classes.map(c =>
      `<option value="${esc(c.id)}" ${selectedClassId === String(c.id) ? 'selected' : ''}>${esc(formatClassName(c))}</option>`
    ).join('');
    viewContainer.innerHTML = `
      <div class="card">
        <h3>Évaluer une classe</h3>
        <p>Évaluation inter-classes — l'école est <strong>verrouillée</strong> sur votre école : ${esc(evalSchoolLabel)}. Vous ne pouvez choisir qu'une classe de votre propre école.</p>
        <div class="form-group">
          <label>École (verrouillée)</label>
          <input type="text" value="${esc(evalSchoolLabel === '—' ? '' : evalSchoolLabel)}" disabled>
        </div>
        <div class="form-group">
          <label>Choisir la classe à évaluer</label>
          <select id="evalClassSelect">
            <option value="">-- Choisir la classe à évaluer --</option>
            ${opts || '<option value="">Aucune classe dans votre école</option>'}
          </select>
        </div>
      </div>
      <div id="evalPanel"></div>
    `;
    await renderEvalPanel();
  }

  async function renderEvalPanel() {
    const panel = viewContainer.querySelector('#evalPanel');
    if (!panel) return;
    if (!evalClass) {
      panel.innerHTML = '<div class="card"><p style="color:#64748b">Sélectionnez une classe pour afficher la fiche de saisie des notes.</p></div>';
      return;
    }
    if (!evalSubjectId || !evalSubjects.some(s => String(s.id) === String(evalSubjectId))) {
      evalSubjectId = evalSubjects[0] ? evalSubjects[0].id : null;
    }
    const subject = evalSubjects.find(s => String(s.id) === String(evalSubjectId)) || null;
    const term = evalTerm || 1;
    const max = subject ? subject.max : 10;
    const rows = evalStudents;
    panel.innerHTML = `
      <div class="card" style="margin-top:16px">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <h3 style="margin:0;flex:1">Saisie des notes — ${esc(formatClassName(evalClass))}</h3>
          <button class="btn" data-action="eval-save-notes" id="evalSaveNotesBtn" style="margin-bottom:2px">💾 Enregistrer les notes</button>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-top:12px">
          <div class="form-group" style="margin:0;min-width:220px">
            <label>Matière</label>
            <select id="evalSubjectSelect">
              ${evalSubjects.map(s => `<option value="${esc(s.id)}" ${subject && String(s.id) === String(evalSubjectId) ? 'selected' : ''}>${esc(s.name)} (/${esc(s.max)})</option>`).join('') || '<option value="">Aucune matière</option>'}
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:160px">
            <label>Trimestre</label>
            <select id="evalTermSelect">
              <option value="1" ${term === 1 ? 'selected' : ''}>1er Trimestre (T1)</option>
              <option value="2" ${term === 2 ? 'selected' : ''}>2e Trimestre (T2)</option>
              <option value="3" ${term === 3 ? 'selected' : ''}>3e Trimestre (T3)</option>
            </select>
          </div>
        </div>
        <div class="table-wrap" style="margin-top:12px">
          <table id="evalGradeTable">
            <thead>
              <tr>
                <th>N°</th>
                <th>Élève</th>
                <th>Sexe</th>
                <th>${subject ? esc(subject.name) + ` <span style="font-weight:400;color:#64748b">(/${esc(max)})</span>` : 'Note'}</th>
                <th>Note /10</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((s, i) => `
                <tr data-eval-row="${esc(s.id)}">
                  <td>${i + 1}</td>
                  <td>${s.gender === 'F' ? `<strong style="color:#dc2626">${esc(s.full_name)}</strong>` : `<strong>${esc(s.full_name)}</strong>`}${s.status === 'A' ? ' <span style="color:#64748b;font-weight:700">(A)</span>' : ''}</td>
                  <td>${s.gender === 'M' ? 'M' : 'F'}</td>
                  <td><input type="number" step="0.01" min="0" max="${esc(max)}" class="eval-grade-input" data-student="${esc(s.id)}" data-subject="${subject ? esc(subject.id) : ''}" value=""></td>
                  <td class="moyenne-cell">—</td>
                </tr>
              `).join('') || '<tr><td colspan="5">Aucun élève</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    await loadEvalGrades();
  }

  function recomputeEvalAverages() {
    const subject = (evalSubjects || []).find(s => String(s.id) === String(evalSubjectId)) || null;
    const max = subject ? (parseFloat(subject.max) || 10) : 10;
    viewContainer.querySelectorAll('#evalGradeTable [data-eval-row]').forEach(row => {
      const inp = row.querySelector('.eval-grade-input');
      const cell = row.querySelector('.moyenne-cell');
      if (!cell) return;
      if (!inp || inp.value === '' || inp.value == null) { cell.textContent = '—'; return; }
      const num = parseFloat(inp.value);
      if (isNaN(num)) { cell.textContent = '—'; return; }
      cell.textContent = ((num / max) * 10).toFixed(2);
    });
  }

  async function loadEvalGrades() {
    const inputs = viewContainer.querySelectorAll('.eval-grade-input');
    inputs.forEach(i => { i.value = ''; });
    recomputeEvalAverages();
    if (!evalClass || !evalSubjectId || !inputs.length) return;
    const term = evalTerm || 1;
    const { data: notes } = await supabase
      .from('notes')
      .select('*')
      .eq('classe_id', evalClass.id)
      .eq('trimestre', term);
    const subjectKey = String(evalSubjectId);
    const map = {};
    (notes || []).forEach(n => {
      const matKey = n.matiere_id !== undefined ? n.matiere_id : n.subject_id;
      if (String(matKey) !== subjectKey) return;
      const eleveKey = n.eleve_id !== undefined ? n.eleve_id : n.student_id;
      const noteKey = n.note !== undefined ? n.note : n.valeur;
      if (eleveKey !== undefined && noteKey !== undefined && noteKey !== null) map[String(eleveKey)] = noteKey;
    });
    inputs.forEach(input => {
      const v = map[String(input.dataset.student)];
      input.value = (v !== undefined) ? v : '';
    });
    recomputeEvalAverages();
  }

  async function onEvalClassChange(classId) {
    if (!classId) {
      evalClass = null;
      evalSubjects = [];
      evalStudents = [];
      evalSubjectId = null;
      renderEvalPanel();
      return;
    }
    const cls = (evalClassesList || []).find(c => String(c.id) === String(classId));
    if (cls) {
      evalClass = cls;
    } else {
      const { data } = await supabase.from('classes').select('*').eq('id', classId).single();
      if (!data) { alert('Classe introuvable.'); return; }
      evalClass = data;
    }
    evalSubjects = await getSubjectsForClass(evalClass);
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', evalClass.id)
      .order('full_name');
    evalStudents = students || [];
    if (!evalSubjectId || !evalSubjects.some(s => String(s.id) === String(evalSubjectId))) {
      evalSubjectId = evalSubjects[0] ? evalSubjects[0].id : null;
    }
    await renderEvalPanel();
  }

  async function saveEvalNotes() {
    if (!evalClass || !evalSubjectId) { alert('Sélectionnez une classe et une matière.'); return; }
    const term = evalTerm || 1;
    const sub = (evalSubjects || []).find(s => String(s.id) === String(evalSubjectId));
    const rows = Array.from(viewContainer.querySelectorAll('#evalGradeTable [data-eval-row]'));
    const btn = viewContainer.querySelector('#evalSaveNotesBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
    let ok = 0, fail = 0, firstErr = null;
    try {
      for (const row of rows) {
        const inp = row.querySelector('.eval-grade-input');
        if (!inp) continue;
        const raw = inp.value;
        if (raw === '' || raw == null) continue;
        const eleveId = inp.dataset.student;
        const res = await saveNoteRow(eleveId, evalSubjectId, term, parseFloat(raw), sub ? sub.max : null, evalClass.id);
        if (res && res.ok) ok++;
        else { fail++; if (!firstErr && res && res.error) firstErr = res.error; }
      }
      if (ok === 0 && fail === 0) { gradeToast('Aucune note à enregistrer.'); return; }
      if (fail > 0 && firstErr) gradeErrorBanner(firstErr);
      gradeToast(ok + ' note(s) enregistrée(s), ' + fail + ' échec(s)');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Enregistrer les notes'; }
    }
  }

  async function saveEvalGradeInput(input) {
    if (!evalClass || !evalSubjectId) return;
    const term = evalTerm || 1;
    const sub = (evalSubjects || []).find(s => String(s.id) === String(evalSubjectId));
    const raw = input.value;
    const res = await saveNoteRow(input.dataset.student, evalSubjectId, term, raw === '' ? null : parseFloat(raw), sub ? sub.max : null, evalClass.id);
    if (res && !res.ok && res.error) gradeErrorBanner(res.error);
    recomputeEvalAverages();
  }

  async function renderExamBlanc() {
    const cls = await getMyClass();
    if (!cls) return renderClassSetup();
    myClassLevel = cls.level || null;
    updateExamBlancNav();
    if (!['CM1', 'CM2'].includes(cls.level)) {
      viewContainer.innerHTML = '<div class="empty">Les examens blancs sont réservés aux classes CM1 et CM2.</div>';
      return;
    }
    viewContainer.innerHTML = `
      <div class="card">
        <h3>Examen Blanc CM1/CM2</h3>
        <p>Créez un examen blanc pour votre classe, puis gérez la case "A composé" et le taux de réussite.</p>
        <div class="form-group">
          <label>Nom de l'examen</label>
          <input type="text" id="examName" placeholder="Ex: Examen Blanc n°1">
        </div>
        <div class="form-group">
          <label>Trimestre</label>
          <select id="examTerm">
            <option value="1">1er Trimestre</option>
            <option value="2">2e Trimestre</option>
            <option value="3">3e Trimestre</option>
          </select>
        </div>
        <button class="btn" data-action="create-exam" style="margin-top:8px">Créer l'examen blanc</button>
      </div>
    `;
  }

  async function renderExports() {
    viewContainer.innerHTML = `
      <div class="card">
        <h3>Exports</h3>
        <p>Téléchargez les données de votre classe au format CSV (compatible Excel).</p>
        <button class="btn" data-action="export-students" style="margin-right:8px">📥 Élèves (CSV)</button>
        <button class="btn" data-action="export-grades" style="margin-right:8px">📥 Notes (CSV)</button>
      </div>
    `;
  }

  // ----- Actions (délégation d'événements) -----

  async function deleteStudent(id) {
    if (!confirm('Supprimer cet élève ?')) return;
    await supabase.from('students').delete().eq('id', id);
    renderSubView(navItems.find(n => n.classList.contains('active'))?.dataset.view || 'eleves');
  }

  async function openStudentForm(student) {
    const isEdit = !!student;
    editingId = isEdit ? student.id : null;
    const handicapChecked = isEdit && student.handicap && String(student.handicap).trim() !== '';

    viewContainer.innerHTML = `
      <div class="card">
        <h3>${isEdit ? "Modifier l'élève" : 'Ajouter un élève'}</h3>
        <form id="studentForm">
          <div class="form-group">
            <label>Nom et prénoms</label>
            <input type="text" id="stuName" value="${isEdit ? esc(student.full_name) : ''}" required>
          </div>
          <div class="form-group">
            <label>Sexe</label>
            <select id="stuGender">
              <option value="M" ${isEdit && student.gender === 'M' ? 'selected' : ''}>Garçon (M)</option>
              <option value="F" ${isEdit && student.gender === 'F' ? 'selected' : ''}>Fille (F)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Statut</label>
            <input type="text" id="stuStatus" value="${isEdit ? esc(student.status || 'Nouveau') : 'Nouveau'}">
          </div>
          <div class="form-group" style="flex-direction:row;align-items:center;gap:8px">
            <input type="checkbox" id="stuEdi" ${isEdit && student.edi ? 'checked' : ''} style="width:auto">
            <label for="stuEdi" style="margin:0">Élève Déplacé Forcé (EDF)</label>
          </div>
          <div class="form-group" style="flex-direction:row;align-items:center;gap:8px">
            <input type="checkbox" id="stuHandicap" ${handicapChecked ? 'checked' : ''} style="width:auto">
            <label for="stuHandicap" style="margin:0">Élève en situation de handicap</label>
          </div>
          <div class="form-group" id="handicapTypeGroup" style="display:${handicapChecked ? 'flex' : 'none'}">
            <label>Type de handicap (optionnel)</label>
            <input type="text" id="stuHandicapType" value="${isEdit && handicapChecked ? esc(student.handicap) : ''}" placeholder="Ex: Moteur, Visuel, Auditif...">
          </div>
          <div class="form-group" style="flex-direction:row;align-items:center;gap:8px">
            <input type="checkbox" id="stuAbandon" ${isEdit && student.status === 'A' ? 'checked' : ''} style="width:auto">
            <label for="stuAbandon" style="margin:0">Abandon (A)</label>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button type="submit" class="btn">Enregistrer</button>
            <button type="button" class="btn secondary" data-action="cancel-student">Annuler</button>
          </div>
        </form>
      </div>
    `;

    const form = viewContainer.querySelector('#studentForm');
    if (form) form.addEventListener('submit', saveStudentFromForm);
  }

  async function saveStudentFromForm(e) {
    e.preventDefault();
    const cls = await getMyClass();
    if (!cls) { alert('Aucune classe assignée.'); return; }

    const full_name = (viewContainer.querySelector('#stuName').value || '').trim();
    if (!full_name) { alert('Le nom est requis.'); return; }
    const gender = viewContainer.querySelector('#stuGender').value;
    const abandon = viewContainer.querySelector('#stuAbandon') ? viewContainer.querySelector('#stuAbandon').checked : false;
    const status = abandon ? 'A' : ((viewContainer.querySelector('#stuStatus').value || 'Nouveau').trim() || 'Nouveau');
    const edi = viewContainer.querySelector('#stuEdi').checked;
    const handicapChecked = viewContainer.querySelector('#stuHandicap').checked;
    const handicap = handicapChecked
      ? ((viewContainer.querySelector('#stuHandicapType').value || '').trim() || 'Oui')
      : '';

    if (editingId) {
      const { error } = await supabase.from('students').update({
        full_name, gender, status, edi, handicap
      }).eq('id', editingId);
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.from('students').insert({
        class_id: cls.id,
        school_id: cls.school_id,
        full_name, gender, status, edi, handicap
      });
      if (error) alert(error.message);
    }
    editingId = null;
    renderSubView('eleves');
  }

  async function detectNotesCols() {
    if (notesCols) return notesCols;
    try {
      const { data } = await supabase.from('notes').select('*').limit(1);
      if (data && data[0]) notesCols = Object.keys(data[0]);
    } catch (e) { notesCols = null; }
    return notesCols;
  }

  async function saveNoteRow(eleveId, matiereId, trimestre, note, bareme, classeIdOverride) {
    const classeId = classeIdOverride != null ? classeIdOverride : (currentClass ? currentClass.id : null);
    const cols = await detectNotesCols();
    const has = (name) => !cols || cols.includes(name);
    const eleveCol = (has('student_id') && !has('eleve_id')) ? 'student_id' : 'eleve_id';
    const matiereCol = (has('subject_id') && !has('matiere_id')) ? 'subject_id' : 'matiere_id';
    const noteCol = (has('valeur') && !has('note')) ? 'valeur' : 'note';

    // 1) Supprimer toute ligne existante (eleve/matiere/trimestre)
    try {
      const del = await supabase.from('notes').delete()
        .eq(eleveCol, eleveId)
        .eq(matiereCol, matiereId)
        .eq('trimestre', trimestre);
      if (del.error) {
        const m = (del.error.message || '').toLowerCase();
        if (m.includes('does not exist') && m.includes('notes')) return { ok: false, error: del.error };
      }
    } catch (e) { return { ok: false, error: e }; }

    const base = { trimestre };
    base[eleveCol] = eleveId;
    base[matiereCol] = matiereId;
    if (has('eleve_id') && has('student_id')) { base.eleve_id = eleveId; base.student_id = eleveId; }
    if (has('matiere_id') && has('subject_id')) { base.matiere_id = matiereId; base.subject_id = matiereId; }
    base[noteCol] = note;
    if (has('classe_id')) base.classe_id = classeId;
    if (has('bareme') && bareme != null) base.bareme = bareme;

    // 2) Schéma connu -> insert direct, sinon update de la ligne existante
    if (cols) {
      try {
        const { error } = await supabase.from('notes').insert(base);
        if (!error) {
          notesNoteCol = noteCol;
          notesHasBareme = has('bareme');
          return { ok: true };
        }
        const { error: upErr } = await supabase.from('notes')
          .update({ ...base, updated_at: new Date().toISOString() })
          .eq(eleveCol, eleveId)
          .eq(matiereCol, matiereId)
          .eq('trimestre', trimestre);
        if (!upErr) {
          notesNoteCol = noteCol;
          notesHasBareme = has('bareme');
          return { ok: true };
        }
        return { ok: false, error: upErr || error };
      } catch (e) {
        return { ok: false, error: e };
      }
    }

    // 3) Schéma inconnu (table vide) : essayer des variantes
    const variants = [];
    for (const eleve of ['eleve_id', 'student_id']) {
      for (const mat of ['matiere_id', 'subject_id']) {
        for (const nc of ['note', 'valeur']) {
          const v = { trimestre, classe_id: classeId };
          v[eleve] = eleveId; v[mat] = matiereId; v[nc] = note;
          variants.push(v);
          if (bareme != null) variants.push({ ...v, bareme });
        }
      }
    }
    let lastErr = null;
    for (const v of variants) {
      try {
        const { error } = await supabase.from('notes').insert(v);
        if (!error) { notesCols = Object.keys(v); notesNoteCol = v.note !== undefined ? 'note' : 'valeur'; notesHasBareme = v.bareme !== undefined; return { ok: true }; }
        lastErr = error;
      } catch (e) { lastErr = e; }
    }
    return { ok: false, error: lastErr };
  }

  async function saveGrade(input) {
    const eleveId = input.dataset.student;
    const matiereId = input.dataset.subject;
    const term = parseInt(viewContainer.querySelector('#termSelect')?.value || '1', 10);
    const raw = input.value;
    const sub = currentSubjects.find(s => s.id === matiereId);
    const res = await saveNoteRow(eleveId, matiereId, term, raw === '' ? null : parseFloat(raw), sub ? sub.max : null);
    if (res && !res.ok && res.error) gradeErrorBanner(res.error);
  }

  async function createExamBlanc() {
    const name = (viewContainer.querySelector('#examName')?.value || '').trim();
    const term = parseInt(viewContainer.querySelector('#examTerm')?.value || '1', 10);
    if (!name) { alert("Veuillez saisir un nom d'examen."); return; }
    const cls = await getMyClass();
    if (!cls) { alert('Aucune classe assignée.'); return; }
    if (!['CM1', 'CM2'].includes(cls.level)) {
      alert('Les examens blancs sont réservés aux classes CM1 et CM2.');
      return;
    }
    const { data: exam, error } = await supabase.from('exam_blancs').insert({
      name,
      class_id: cls.id,
      school_id: cls.school_id,
      term,
      year: cls.year,
      evaluator_id: state.user ? state.user.id : null,
      status: 'brouillon'
    }).select().single();
    if (error || !exam) { alert('Erreur : ' + (error ? error.message : 'création impossible')); return; }

    const { data: students } = await supabase.from('students').select('*').eq('class_id', cls.id);
    const rows = (students || []).map(s => ({
      exam_blanc_id: exam.id,
      student_id: s.id,
      composed: false
    }));
    if (rows.length) await supabase.from('exam_blanc_students').insert(rows);
    alert('Examen blanc créé !');
    renderSubView('examblanc');
  }

  async function exportStudentsCSV() {
    const cls = await getMyClass();
    if (!cls) { alert('Aucune classe assignée.'); return; }
    const { data: students } = await supabase.from('students').select('*').eq('class_id', cls.id).order('full_name');
    const rows = [['N°', 'Nom et prénoms', 'Sexe', 'Statut']];
    (students || []).forEach((s, i) => rows.push([i + 1, s.full_name, s.gender, s.status === 'A' ? 'A' : (s.status || 'Actif')]));
    downloadCSV(`eleves_${cls.name || 'classe'}.csv`, rows);
  }

  async function exportGradesCSV() {
    const cls = await getMyClass();
    if (!cls) { alert('Aucune classe assignée.'); return; }
    const subjects = await getSubjectsForClass(cls);
    const { data: students } = await supabase.from('students').select('*').eq('class_id', cls.id).order('full_name');
    const { data: notes } = await supabase.from('notes').select('*').eq('classe_id', cls.id).eq('trimestre', 1);
    const map = {};
    (notes || []).forEach(n => { map[`${n.eleve_id}:${n.matiere_id}`] = n.note; });

    const header = ['N°', 'Élève', 'Sexe', 'Statut', ...subjects.map(s => s.name)];
    const rows = [header];
    (students || []).forEach((s, i) => {
      const cells = [i + 1, s.full_name, s.gender, s.status === 'A' ? 'A' : 'Actif'];
      subjects.forEach(sub => {
        const v = map[`${s.id}:${sub.id}`];
        cells.push(v !== undefined && v !== null ? String(v) : '');
      });
      rows.push(cells);
    });
    downloadCSV(`notes_${cls.name || 'classe'}_T1.csv`, rows);
  }

  function downloadCSV(filename, rows) {
    const csv = rows.map(r => r.map(c => {
      const str = String(c == null ? '' : c);
      return /[",\n;]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
    }).join(';')).join('\n');
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

  // ----- Délégation d'événements -----

  viewContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'delete-student') deleteStudent(btn.dataset.id);
    else if (action === 'add-student') openStudentForm(null);
    else if (action === 'create-class') createClass();
    else if (action === 'choose-class') chooseExistingClass();
    else if (action === 'edit-matiere') editMatiere(btn);
    else if (action === 'delete-matiere') deleteMatiere(btn.dataset.id);
    else if (action === 'go-matieres') renderSubView('matieres');
    else if (action === 'save-all-notes') saveAllNotes();
    else if (action === 'print-bulletins') window.print();
    else if (action === 'print-page') window.print();
    else if (action === 'preview-bulletins') {
      const sheets = viewContainer.querySelector('#bulletinSheets');
      if (sheets) openPreview({ title: 'Bulletins trimestriels', html: sheets.innerHTML, onPrint: () => window.print() });
    }
    else if (action === 'preview-annuel') {
      if (currentClass) openPreview({ title: 'Moyenne annuelle', html: annualSheetsHTML(currentAnnualRows, currentClass), onPrint: () => window.print(), onCSV: exportAnnuelCSV });
    }
    else if (action === 'csv-annuel') exportAnnuelCSV();
    else if (action === 'annual-bulletins-pdf') exportAllAnnualBulletinsPDF(btn);
    else if (action === 'preview-annual-bulletins') {
      const sheets = viewContainer.querySelector('#annualBulletinSheets');
      if (sheets) openPreview({
        title: 'Bulletins Annuels',
        html: sheets.innerHTML,
        onPrint: () => window.print(),
        onCSV: exportAnnualBulletinsCSV
      });
    }
    else if (action === 'csv-annual-bulletins') exportAnnualBulletinsCSV();
    else if (action === 'preview-prop') {
      if (currentClass) openPreview({ title: "Proposition de fin d'année", html: propSheetsHTML(currentPropRows, currentClass), onPrint: () => window.print(), onCSV: exportPropCSV });
    }
    else if (action === 'csv-prop') exportPropCSV();
    else if (action === 'preview-synth') {
      const sheet = viewContainer.querySelector('#syntheseSheet');
      if (sheet && currentSynthese) {
        const previewSheet = sheet.cloneNode(true);
        previewSheet.querySelectorAll('.no-print, button').forEach(node => node.remove());
        openPreview({ title: 'Fiche Synthèse Trimestrielle', html: previewSheet.innerHTML, onPrint: () => window.print(), onCSV: exportSynthCSV });
      }
    }
    else if (action === 'csv-synth') exportSynthCSV();
    else if (action === 'reg-mode') { registreMode = btn.dataset.mode; renderSubView('registre'); }
    else if (action === 'select-day') { selectedDate = btn.dataset.date; renderAppelJournalier(); }
    else if (action === 'pa-toggle') {
      togglePendingAttendance(btn);
    }
    else if (action === 'validate-day') validateDay();
    else if (action === 'cloture-mois') clotureMois();
    else if (action === 'preview-reg') {
      const sheet = viewContainer.querySelector('#ficheSheet');
      if (sheet) openPreview({ title: "Fiche d'Arrêt Mensuel — " + (currentFicheData ? currentFicheData.monthName : ''), html: sheet.innerHTML, onPrint: () => window.print(), onCSV: exportRegistreCSV });
    }
    else if (action === 'preview-closed-months') {
      const summary = viewContainer.querySelector('#closedMonthsSummary')?.closest('.monthly-register-sheet');
      if (summary) openPreview({ title: 'Synthèse des Mois Arrêtés', html: summary.outerHTML, onPrint: () => window.print(), onCSV: exportClosedMonthsCSV });
    }
    else if (action === 'print-closed-months') {
      const summary = viewContainer.querySelector('#closedMonthsSummary')?.closest('.monthly-register-sheet');
      if (summary) openPreview({ title: 'Synthèse des Mois Arrêtés', html: summary.outerHTML, onPrint: () => window.print(), onCSV: exportClosedMonthsCSV });
    }
    else if (action === 'csv-closed-months') exportClosedMonthsCSV();
    else if (action === 'csv-reg') exportRegistreCSV();
    else if (action === 'edit-student') {
      const stu = currentStudents.find(s => s.id === btn.dataset.id);
      if (stu) openStudentForm(stu);
    }
    else if (action === 'cancel-student') renderSubView('eleves');
    else if (action === 'eval-save-notes') saveEvalNotes();
    else if (action === 'create-exam') createExamBlanc();
    else if (action === 'export-students') exportStudentsCSV();
    else if (action === 'export-grades') exportGradesCSV();
  });

  viewContainer.addEventListener('change', (e) => {
    if (e.target.classList.contains('eval-grade-input')) {
      saveEvalGradeInput(e.target);
      return;
    }
    if (e.target.id === 'evalClassSelect') {
      onEvalClassChange(e.target.value);
      return;
    }
    if (e.target.id === 'evalSubjectSelect') {
      evalSubjectId = e.target.value || null;
      renderEvalPanel();
      return;
    }
    if (e.target.id === 'evalTermSelect') {
      evalTerm = parseInt(e.target.value, 10) || 1;
      renderEvalPanel();
      return;
    }
    if (e.target.classList.contains('grade-input')) {
      saveGrade(e.target);
      recomputeAverages();
    } else if (e.target.id === 'stuHandicap') {
      const grp = viewContainer.querySelector('#handicapTypeGroup');
      if (grp) grp.style.display = e.target.checked ? 'flex' : 'none';
    }
  });

  renderSubView('maclasse');
}