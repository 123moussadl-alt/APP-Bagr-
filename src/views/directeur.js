/**
 * Vue Directeur d'école — Lecture seule, effectifs centralisés
 * Pattern : render (HTML shell) + setup (logique + délégation d'événements)
 */

import { esc, formatClassName, normalizeNotes } from '../utils/format.js';
import { downloadCSV, printPage, wirePDFExportButton, wireWordExportButton } from '../utils/export.js';
import { renderBulletinsHTML } from '../utils/bulletin.js';
import { computeMonthlyRegister, monthlyRegisterCSVRows, renderMonthlyRegisterTable, computeFicheArretMensuel, renderFicheArretMensuelHTML, monthlyClosureCSVRows, schoolMonths, formatVisaStampDate, ANNUAL_SYNTHESIS_TITLE } from '../utils/registre.js';
import { openPreview } from '../utils/preview.js';
import { profileMatchesVisa, signatureBlockHTML, signatureUrlForProfile } from '../utils/signature.js';
import { computeSubjectRows } from '../utils/synthese.js';
import {
  computeExamRows,
  examLevelLabel,
  examSessionLabel,
  renderExamEntryTable,
  renderExamSyntheseHTML
} from '../utils/examens-blancs.js';
import { loadPaiRecord } from '../utils/pai.js';
import {
  computeSchoolTermSynthesis, loadSchoolTermData, renderSchoolTermSynthesisHTML,
  schoolTermSynthesisCSVRows
} from '../utils/synthese-ecole.js';
import {
  agentMonths, computeAgentMonthlyRows, formatISODate, getAgentEmployment, getAgentFunction, getAgentNameParts,
  getCurrentSchoolYearStart, getSchoolMonthPeriod, isWeekday, mergeAgentAttendanceRecords,
  monthNameForDate, previousWorkingDate, readDailyAgentBackup, readLocalAgentRecordsForPeriod,
  writeDailyAgentBackup
} from '../utils/agents.js';

export function renderDirecteur(state, render, supabase) {
  const profile = state.profile;
  if (!profile) return '<div>Chargement...</div>';

  return `
    <div class="role-layout">
      <aside class="role-sidebar">
        <div class="role-brand">
          <strong>Educ CEB</strong>
          <span>Directeur — ${esc(profile.full_name)}</span>
        </div>
        <nav class="role-nav">
          <button class="nav-item active" data-view="ecole">🏫 Mon école</button>
          <button class="nav-item" data-view="classes">📚 Toutes les classes</button>
          <button class="nav-item" data-view="effectifs">👥 Effectifs centralisés</button>
          <button class="nav-item" data-view="bilans">📈 Bilans & Synthèses</button>
          <button class="nav-item" data-view="school-synthese">📋 Synthèse trimestrielle de l'école</button>
          <button class="nav-item" data-view="registre">📅 Registre d'appel</button>
          <button class="nav-item" data-view="examens-blancs">🎓 Examens Blancs</button>
          <button class="nav-item" data-view="agents">👥 Présence des agents</button>
          <button class="nav-item" data-view="bulletins">📄 Bulletins</button>
        </nav>
        <div class="role-footer">
          <button class="btn-logout" onclick="window.logout()">Déconnexion</button>
        </div>
      </aside>

      <div class="role-content">
        ${state.isDualDirector ? `<div style="background:#0f3d23;color:#fff;padding:8px 16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong style="font-size:13px">Mode :</strong>
          <button class="btn" onclick="window.switchToClasseMode()" style="background:#2563eb">📚 Ma Classe (Titulaire)</button>
          <button class="btn secondary" onclick="window.switchToDirectionMode()">🏫 Direction de l'École</button>
        </div>` : ''}
        <header class="role-topbar">
          <div>
            <h1 id="pageTitle">Mon école</h1>
            <p id="pageSubtitle">Consultation lecture seule</p>
          </div>
          <div class="top-actions">
            <button class="btn" data-action="preview-current">👁 Aperçu</button>
            <button class="btn" data-action="export-csv">📥 Exporter Excel/CSV</button>
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

export function setupDirecteur(container, state, render, supabase) {
  const viewContainer = container.querySelector('#viewContainer');
  const navItems = Array.from(container.querySelectorAll('.nav-item'));
  const pageTitle = container.querySelector('#pageTitle');
  const pageSubtitle = container.querySelector('#pageSubtitle');
  const actualProfile = state.realProfile || state.profile || {};
  const directorSigners = actualProfile.role === 'directeur' ? [actualProfile] : [];
  wirePDFExportButton(
    container.querySelector('[data-action="export-pdf"]'),
    () => {
      const fiche = viewContainer.querySelector('#dirRegSheet .arret-mois');
      if (fiche) return viewContainer.querySelector('#dirRegSheet');
      return viewContainer.querySelector('#agentMonthlyDocument') || viewContainer;
    },
    () => `${container.querySelector('#pageTitle')?.textContent || 'Document'}_directeur.pdf`,
    { format: 'a4' }
  );
  let activeView = 'ecole';
  let bilansRows = [];
  let bilanClassesData = [];
  let selectedBilanClassId = 'all';
  let selectedBilanTerm = 1;
  let bilanSchoolName = '';
  let bilanLoadErrors = [];
  let schoolTermClassId = '';
  let schoolTermMode = 'school';
  let schoolTerm = 1;
  let schoolTermExport = null;
  let effectifsRows = [];
  let dirFicheMonthIdx = 0;
  let dirCurrentFiche = null;
  let dirMonthlyRows = [];
  let dirVisaDirecteurByMonth = {};
  let dirVisaEncadreurByMonth = {};
  let dirVisaDirectorStamps = {};
  let dirVisaEncadreurStamps = {};
  let agentAttendanceTab = 'daily';
  let agentProfiles = [];
  let agentAttendanceById = new Map();
  let agentSchool = null;
  let agentCurrentDate = previousWorkingDate();
  let agentCurrentMonth = agentMonths.includes(monthNameForDate(formatISODate(new Date())))
    ? monthNameForDate(formatISODate(new Date()))
    : 'Octobre';
  const agentSchoolYearStart = getCurrentSchoolYearStart();
  let agentMonthlyRecords = [];
  let agentMonthlyRows = [];
  let agentMonthlySubmission = null;

  function visaMonthPhrase(mois) {
    const m = String(mois || '').trim();
    if (!m) return '';
    return /^[aeiouyh]/i.test(m) ? `d'${m}` : `de ${m}`;
  }

  function exportCurrent() {
    if (activeView === 'bilans' && bilansRows.length) exportBilansCSV();
    else if (activeView === 'school-synthese') exportSchoolTermCSV();
    else if (activeView === 'agents' && agentAttendanceTab === 'monthly') exportAgentMonthlyCSV();
    else if (activeView === 'agents') exportAgentDailyCSV();
    else exportEffectifsCSV();
  }

  container.querySelector('[data-action="print-page"]')?.addEventListener('click', printPage);
  container.querySelector('[data-action="export-csv"]')?.addEventListener('click', exportCurrent);
  container.querySelector('[data-action="preview-current"]')?.addEventListener('click', () => {
    openPreview({ title: 'Aperçu — ' + activeView, html: viewContainer.innerHTML, onPrint: printPage, onCSV: exportCurrent });
  });

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      activeView = item.dataset.view;
      const titles = {
        ecole: 'Mon école',
        classes: 'Toutes les classes',
        effectifs: 'Effectifs centralisés',
        bilans: 'Bilans & Synthèses',
        'school-synthese': "Synthèse trimestrielle de l'école",
        registre: "Registre d'appel",
        agents: 'Présence des agents',
        bulletins: 'Bulletins'
      };
      if (pageTitle) pageTitle.textContent = titles[activeView] || 'Mon école';
      if (pageSubtitle) {
        pageSubtitle.textContent = activeView === 'agents'
          ? 'Appel journalier et bilan mensuel du personnel'
          : 'Consultation lecture seule';
      }
      renderSubView(item.dataset.view);
    });
  });

  viewContainer.addEventListener('click', async (e) => {
    if (e.target.closest('[data-action="school-term-preview"]') || e.target.closest('[data-action="school-term-print"]')) {
      const sheet = viewContainer.querySelector('#schoolTermSheet');
      if (sheet) openPreview({
        title: 'Synthèse Trimestrielle de l’École',
        html: sheet.innerHTML,
        onPrint: printPage,
        onCSV: exportSchoolTermCSV
      });
      return;
    }
    if (e.target.closest('[data-action="school-term-excel"]')) {
      exportSchoolTermCSV();
      return;
    }
    if (e.target.closest('[data-action="bilan-preview"]')) {
      const report = viewContainer.querySelector('#bilansReport');
      if (report) openPreview({
        title: 'Bilan et Synthèse des Trimestres',
        html: report.outerHTML,
        onPrint: printPage,
        onCSV: exportBilansCSV
      });
      return;
    }
    if (e.target.closest('[data-action="bilan-print"]')) {
      const report = viewContainer.querySelector('#bilansReport');
      if (report) openPreview({
        title: 'Bilan et Synthèse des Trimestres',
        html: report.outerHTML,
        onPrint: printPage,
        onCSV: exportBilansCSV
      });
      return;
    }
    if (e.target.closest('[data-action="bilan-excel"]')) {
      exportBilansCSV();
      return;
    }
    const agentTab = e.target.closest('[data-agent-tab]');
    if (agentTab) {
      agentAttendanceTab = agentTab.dataset.agentTab;
      renderAgentAttendanceTab();
      return;
    }
    const agentPresence = e.target.closest('[data-action="agent-set-presence"]');
    if (agentPresence) {
      agentAttendanceById.set(String(agentPresence.dataset.agentId), {
        ...(agentAttendanceById.get(String(agentPresence.dataset.agentId)) || {}),
        present: agentPresence.dataset.present === 'true'
      });
      persistAgentAttendanceLocally();
      renderAgentDailyRows();
      return;
    }
    if (e.target.closest('[data-action="agent-save-daily"]')) {
      await saveDailyAgentAttendance();
      return;
    }
    if (e.target.closest('[data-action="agent-monthly-preview"]')) {
      const sheet = viewContainer.querySelector('#agentMonthlyDocument');
      if (sheet) openPreview({
        title: `Bilan mensuel des agents — ${agentCurrentMonth}`,
        html: sheet.innerHTML,
        onPrint: printPage,
        onCSV: exportAgentMonthlyCSV
      });
      return;
    }
    if (e.target.closest('[data-action="agent-monthly-excel"]')) {
      exportAgentMonthlyCSV();
      return;
    }
    if (e.target.closest('[data-action="agent-monthly-print"]')) {
      printPage();
      return;
    }
    if (e.target.closest('[data-action="agent-monthly-submit"]')) {
      await submitMonthlyAgentReport();
      return;
    }
    if (e.target.closest('[data-action="dir-reg-preview"]')) {
      const sheet = viewContainer.querySelector('#dirRegSheet');
      if (sheet) openPreview({ title: 'Fiche d\'Arrêt Mensuel', html: sheet.innerHTML, onPrint: printPage, onCSV: exportDirRegistreCSV });
      return;
    }
    if (e.target.closest('[data-action="dir-reg-csv"]')) {
      exportDirRegistreCSV();
      return;
    }
    if (e.target.closest('[data-action="dir-reg-summary-preview"]')) {
      const summary = viewContainer.querySelector('#dirRegSummary')?.closest('.monthly-register-sheet');
      if (summary) openPreview({ title: 'Synthèse des Mois Arrêtés', html: summary.outerHTML, onPrint: printPage, onCSV: exportDirMonthlyCSV });
      return;
    }
    if (e.target.closest('[data-action="dir-reg-summary-pdf"]')) return;
    if (e.target.closest('[data-action="dir-reg-summary-csv"]')) {
      exportDirMonthlyCSV();
      return;
    }
    if (e.target.closest('[data-action="dir-reg-summary-print"]')) {
      const summary = viewContainer.querySelector('#dirRegSummary')?.closest('.monthly-register-sheet');
      if (summary) openPreview({ title: 'Synthèse des Mois Arrêtés', html: summary.outerHTML, onPrint: printPage, onCSV: exportDirMonthlyCSV });
      return;
    }
    const btn = e.target.closest('[data-action="visa-directeur"]');
    if (!btn) return;
    const classId = viewContainer.querySelector('#dirRegClass')?.value;
    const mois = (viewContainer.querySelector('#dirRegMonth')?.value && dirCurrentFiche) ? dirCurrentFiche.monthName : (btn.dataset.mois || (dirCurrentFiche && dirCurrentFiche.monthName));
    if (!classId || !mois) return;
    const stampDate = formatVisaStampDate();
    const directorName = state.profile ? state.profile.full_name : '';
    const directorSignature = signatureUrlForProfile(state.profile);
    const directorVisa = 'Visé par le Directeur : ' + directorName + ' le ' + stampDate;
    const { data: existing } = await supabase.from('registre_configs').select('*').eq('classe_id', classId).eq('mois', mois).limit(1);
    if (existing && existing[0]) await supabase.from('registre_configs').update({
      visa_directeur: directorVisa,
      visa_directeur_date: stampDate,
      visa_directeur_nom: directorName,
      visa_directeur_signature: directorSignature
    }).eq('id', existing[0].id);
    else await supabase.from('registre_configs').insert({
      classe_id: classId,
      mois,
      visa_directeur: directorVisa,
      visa_directeur_date: stampDate,
      visa_directeur_nom: directorName,
      visa_directeur_signature: directorSignature
    });
    dirVisaDirectorStamps[mois] = { date: stampDate, nom: directorName, signatureUrl: directorSignature };
    dirVisaDirecteurByMonth[mois] = directorVisa;
    const phrase = visaMonthPhrase(mois);
    const statusEl = viewContainer.querySelector('#dirRegStatus');
    if (statusEl) {
      statusEl.textContent = `✅ Arrêt du mois ${phrase} visé avec succès !`;
      statusEl.style.color = '#15803d';
      statusEl.style.fontWeight = '700';
      statusEl.style.background = '#dcfce7';
      statusEl.style.padding = '8px 12px';
      statusEl.style.borderRadius = '8px';
    }
    btn.textContent = `✅ Arrêt du mois ${phrase} visé`;
    btn.disabled = true;
    await renderDirRegSheet();
  });

  viewContainer.addEventListener('change', async (e) => {
    if (e.target.id === 'bilanClass') {
      selectedBilanClassId = e.target.value;
      renderBilanCards();
    } else if (e.target.id === 'bilanTerm') {
      selectedBilanTerm = parseInt(e.target.value, 10) || 1;
      renderBilanCards();
    } else if (e.target.id === 'schoolTerm') {
      schoolTerm = parseInt(e.target.value, 10) || 1;
      renderSchoolTermSynthesis();
    } else if (e.target.id === 'schoolTermMode') {
      schoolTermMode = e.target.value;
      renderSchoolTermSynthesis();
    } else if (e.target.id === 'schoolTermClass') {
      schoolTermClassId = e.target.value;
      renderSchoolTermSynthesis();
    } else if (e.target.id === 'agentAttendanceDate') {
      const selectedDate = e.target.value;
      if (!selectedDate) {
        agentCurrentDate = previousWorkingDate();
        e.target.value = agentCurrentDate;
        await loadDailyAgentAttendance();
        return;
      }
      if (!isWeekday(selectedDate)) {
        window.alert('L’appel des agents est limité aux jours ouvrés (lundi à vendredi).');
        agentCurrentDate = previousWorkingDate(new Date(`${selectedDate}T00:00:00`));
        e.target.value = agentCurrentDate;
      } else {
        agentCurrentDate = selectedDate;
      }
      await loadDailyAgentAttendance();
    } else if (e.target.id === 'agentReportMonth') {
      agentCurrentMonth = e.target.value;
      await loadMonthlyAgentReport();
    }
  });
  viewContainer.addEventListener('input', (e) => {
    if (e.target.matches('.agent-observation')) {
      const id = String(e.target.dataset.agentId);
      agentAttendanceById.set(id, {
        ...(agentAttendanceById.get(id) || {}),
        observation: e.target.value
      });
      persistAgentAttendanceLocally();
    }
  });

  function schoolId() {
    return state.profile && state.profile.school_id;
  }

  async function getClasses() {
    const sid = schoolId();
    if (!sid) return [];
    const { data: classes } = await supabase.from('classes').select('*').eq('school_id', sid).order('name');
    return classes || [];
  }

  async function getTitulaires() {
    const sid = schoolId();
    if (!sid) return [];
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('school_id', sid)
      .in('role', ['titulaire', 'directeur'])
      .order('full_name');
    return data || [];
  }

  async function getClassStats(classes) {
    const stats = [];
    let totalStudents = 0, totalBoys = 0, totalGirls = 0;
    for (const cls of classes) {
      const { data: students } = await supabase.from('students').select('*').eq('class_id', cls.id);
      const list = students || [];
      const boys = list.filter(s => s.gender === 'M').length;
      const girls = list.filter(s => s.gender === 'F').length;
      totalStudents += list.length;
      totalBoys += boys;
      totalGirls += girls;
      stats.push({ cls, boys, girls, total: list.length });
    }
    return { stats, totalStudents, totalBoys, totalGirls };
  }

  async function renderAgentAttendance() {
    const sid = schoolId();
    if (!sid) {
      viewContainer.innerHTML = '<div class="empty">Aucune école assignée.</div>';
      return;
    }
    viewContainer.innerHTML = `
      <div class="card">
        <h3>Présence des agents</h3>
        <div class="nav-tabs" style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn ${agentAttendanceTab === 'daily' ? '' : 'secondary'}" data-agent-tab="daily">Appel Journalier des Agents</button>
          <button type="button" class="btn ${agentAttendanceTab === 'monthly' ? '' : 'secondary'}" data-agent-tab="monthly">Bilan Mensuel des Agents</button>
        </div>
      </div>
      <div id="agentAttendancePanel"></div>
    `;
    const [schoolResult, agentsResult] = await Promise.all([
      supabase.from('schools').select('*').eq('id', sid).single(),
      supabase.from('profiles').select('*').eq('school_id', sid).order('full_name')
    ]);
    if (agentsResult.error) {
      viewContainer.querySelector('#agentAttendancePanel').innerHTML =
        `<div class="card" style="color:#dc2626">Impossible de charger la liste du personnel : ${esc(agentsResult.error.message)}</div>`;
      return;
    }
    agentSchool = schoolResult.data || null;
    const currentDirectorId = state.user && state.user.id ? state.user.id : (state.profile && state.profile.id);
    agentProfiles = (agentsResult.data || []).filter(agent =>
      agent.role !== 'directeur' &&
      (!currentDirectorId || String(agent.id) !== String(currentDirectorId))
    );
    renderAgentAttendanceTab();
  }

  function renderAgentAttendanceTab() {
    const panel = viewContainer.querySelector('#agentAttendancePanel');
    if (!panel) return;
    if (agentAttendanceTab === 'daily') {
      panel.innerHTML = `
        <div class="card">
          <div style="display:flex;gap:12px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap">
            <div class="form-group" style="margin:0;min-width:220px">
              <label for="agentAttendanceDate">Date ouvrée</label>
              <input id="agentAttendanceDate" type="date" value="${esc(agentCurrentDate)}" max="${formatISODate(new Date())}">
            </div>
            <button type="button" class="btn" data-action="agent-save-daily" style="background:linear-gradient(145deg,#15803d,#16a34a);box-shadow:0 4px 0 #166534;font-weight:700">Enregistrer l'appel des agents</button>
          </div>
          <p id="agentAttendanceStatus" role="status" style="margin:10px 0 0"></p>
        </div>
        <div class="card" style="margin-top:16px">
          <h3>Appel Journalier des Agents — ${esc((agentSchool && agentSchool.name) || 'École')}</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>N°</th><th>Matricule</th><th>Nom</th><th>Prénom</th><th>Emploi</th><th>Fonction</th><th>Présence</th><th>Observation</th></tr></thead>
              <tbody id="agentAttendanceRows"></tbody>
            </table>
          </div>
        </div>
      `;
      loadDailyAgentAttendance();
    } else {
      panel.innerHTML = `
        <div class="card">
          <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
            <div class="form-group" style="margin:0;min-width:220px">
              <label for="agentReportMonth">Mois</label>
              <select id="agentReportMonth">${agentMonths.map(month =>
                `<option value="${esc(month)}" ${month === agentCurrentMonth ? 'selected' : ''}>${esc(month)}</option>`
              ).join('')}</select>
            </div>
            <button type="button" class="btn secondary" data-action="agent-monthly-preview">Aperçu</button>
            <button type="button" class="btn" id="agent-monthly-pdf" data-action="agent-monthly-pdf">Exporter en PDF</button>
            <button type="button" class="btn secondary" data-action="agent-monthly-print">Imprimer</button>
            <button type="button" class="btn secondary" data-action="agent-monthly-excel">Exporter en Excel</button>
          </div>
          <p id="agentMonthlyStatus" role="status" style="margin:10px 0 0"></p>
        </div>
        <div id="agentMonthlyContent"></div>
      `;
      wirePDFExportButton(
        panel.querySelector('#agent-monthly-pdf'),
        () => panel.querySelector('#agentMonthlyDocument'),
        () => `Bilan_agents_${agentCurrentMonth}_${agentSchoolYearStart}-${agentSchoolYearStart + 1}.pdf`,
        { orientation: 'landscape', format: 'a4', margin: 10 }
      );
      loadMonthlyAgentReport();
    }
  }

  function dailyAgentRecords() {
    const sid = schoolId();
    return agentProfiles.map(agent => {
      const current = agentAttendanceById.get(String(agent.id)) || {};
      return {
        ecole_id: sid,
        ecole_nom: (agentSchool && agentSchool.name) || '',
        agent_id: String(agent.id),
        date_jour: agentCurrentDate,
        mois: monthNameForDate(agentCurrentDate),
        present: current.present !== false,
        observation: String(current.observation || '')
      };
    });
  }

  function persistAgentAttendanceLocally() {
    const status = viewContainer.querySelector('#agentAttendanceStatus');
    try {
      writeDailyAgentBackup(schoolId(), agentCurrentDate, dailyAgentRecords());
      if (status) {
        status.textContent = 'Modifications sauvegardées localement. Cliquez sur « Enregistrer l’appel des agents » pour synchroniser.';
        status.style.color = '#a16207';
      }
    } catch (error) {
      if (status) {
        status.textContent = `Erreur de sauvegarde locale : ${error.message || error}`;
        status.style.color = '#dc2626';
      }
    }
  }

  async function loadDailyAgentAttendance() {
    const sid = schoolId();
    const status = viewContainer.querySelector('#agentAttendanceStatus');
    if (!sid || !isWeekday(agentCurrentDate)) return;
    const localRecords = readDailyAgentBackup(sid, agentCurrentDate);
    const remoteResult = await supabase.from('presences_agents').select('*')
      .eq('ecole_id', sid).eq('date_jour', agentCurrentDate);
    const remoteRecords = remoteResult.data || [];
    const records = mergeAgentAttendanceRecords(remoteRecords, localRecords);
    agentAttendanceById = new Map(records.map(record => [String(record.agent_id), record]));
    renderAgentDailyRows();
    if (status) {
      if (remoteResult.error) {
        status.textContent = localRecords.length
          ? `Mode local : ${remoteResult.error.message}`
          : `Impossible de lire les présences enregistrées : ${remoteResult.error.message}`;
        status.style.color = localRecords.length ? '#a16207' : '#dc2626';
      } else {
        status.textContent = localRecords.length ? 'Sauvegarde locale chargée.' : '';
        status.style.color = '#64748b';
      }
    }
  }

  function renderAgentDailyRows() {
    const tbody = viewContainer.querySelector('#agentAttendanceRows');
    if (!tbody) return;
    tbody.innerHTML = agentProfiles.map((agent, index) => {
      const id = String(agent.id);
      const value = agentAttendanceById.get(id) || {};
      const { nom, prenom } = getAgentNameParts(agent);
      const present = value.present !== false;
      return `<tr>
        <td>${index + 1}</td>
        <td>${esc(agent.matricule || agent.identifiant || '—')}</td>
        <td>${esc(nom || '—')}</td>
        <td>${esc(prenom || '—')}</td>
        <td>${esc(getAgentEmployment(agent))}</td>
        <td>${esc(getAgentFunction(agent))}</td>
        <td style="white-space:nowrap">
          <button type="button" class="btn" data-action="agent-set-presence" data-agent-id="${esc(id)}" data-present="true"
            style="padding:5px 10px;${present ? 'background:#16a34a;color:#fff' : 'background:#e2e8f0;color:#334155'}">Oui</button>
          <button type="button" class="btn" data-action="agent-set-presence" data-agent-id="${esc(id)}" data-present="false"
            style="padding:5px 10px;${present ? 'background:#e2e8f0;color:#334155' : 'background:#dc2626;color:#fff'}">Non</button>
        </td>
        <td><input class="agent-observation" data-agent-id="${esc(id)}" value="${esc(value.observation || '')}" aria-label="Observation pour ${esc(nom)}"></td>
      </tr>`;
    }).join('') || '<tr><td colspan="8">Aucun agent inscrit dans cette école.</td></tr>';
  }

  async function saveDailyAgentAttendance() {
    const status = viewContainer.querySelector('#agentAttendanceStatus');
    if (!schoolId() || !isWeekday(agentCurrentDate)) {
      if (status) {
        status.textContent = 'Sélectionnez un jour ouvré et vérifiez que votre compte est associé à une école.';
        status.style.color = '#dc2626';
      }
      return;
    }
    if (!agentProfiles.length) {
      if (status) {
        status.textContent = 'Aucun agent à enregistrer.';
        status.style.color = '#dc2626';
      }
      return;
    }
    const records = dailyAgentRecords();
    try {
      writeDailyAgentBackup(schoolId(), agentCurrentDate, records);
    } catch (error) {
      if (status) {
        status.textContent = `Erreur de sauvegarde locale : ${error.message || error}`;
        status.style.color = '#dc2626';
      }
      return;
    }
    const result = await supabase.from('presences_agents')
      .upsert(records, { onConflict: 'agent_id,date_jour' });
    if (result.error) {
      if (status) {
        status.textContent = `Présences conservées localement, mais synchronisation impossible : ${result.error.message}`;
        status.style.color = '#dc2626';
      }
      return;
    }
    if (status) {
      status.textContent = 'Appel des agents enregistré avec succès.';
      status.style.color = '#16a34a';
    }
  }

  async function loadMonthlyAgentReport() {
    const content = viewContainer.querySelector('#agentMonthlyContent');
    const status = viewContainer.querySelector('#agentMonthlyStatus');
    if (!content || !schoolId()) return;
    const period = getSchoolMonthPeriod(agentSchoolYearStart, agentCurrentMonth);
    const localRecords = readLocalAgentRecordsForPeriod(schoolId(), period.start, period.end);
    const remoteResult = await supabase.from('presences_agents').select('*')
      .eq('ecole_id', schoolId()).gte('date_jour', period.start).lte('date_jour', period.end);
    agentMonthlyRecords = mergeAgentAttendanceRecords(remoteResult.data || [], localRecords);
    agentMonthlyRows = computeAgentMonthlyRows(agentProfiles, agentMonthlyRecords);
    const submissionResult = await supabase.from('bilans_agents_mensuels').select('*')
      .eq('ecole_id', schoolId()).eq('mois', agentCurrentMonth)
      .eq('annee_scolaire', `${agentSchoolYearStart}-${agentSchoolYearStart + 1}`).limit(1);
    agentMonthlySubmission = (submissionResult.data || [])[0] || null;
    if (status) {
      const errors = [remoteResult.error, submissionResult.error].filter(Boolean).map(error => error.message);
      status.textContent = errors.length
        ? `Données locales/partielles — ${errors.join(' ; ')}`
        : localRecords.length ? 'Les sauvegardes locales sont incluses dans ce bilan.' : '';
      status.style.color = errors.length
        ? (localRecords.length ? '#a16207' : '#dc2626')
        : '#64748b';
    }
    renderAgentMonthlyDocument();
  }

  function renderAgentMonthlyDocument() {
    const content = viewContainer.querySelector('#agentMonthlyContent');
    if (!content) return;
    const monthDates = new Set(agentMonthlyRecords.map(record => record.date_jour));
    const rows = agentMonthlyRows.map(row => {
      const { nom, prenom } = getAgentNameParts(row.agent);
      return `<tr>
        <td>${row.number}</td><td>${esc(row.agent.matricule || row.agent.identifiant || '—')}</td>
        <td>${esc(nom || '—')}</td><td>${esc(prenom || '—')}</td><td>${esc(getAgentEmployment(row.agent))}</td><td>${esc(getAgentFunction(row.agent))}</td>
        <td>${row.daysPointed}</td><td>${row.presences}</td><td>${row.absences}</td>
        <td>${row.rate.toFixed(1)}%</td><td>${esc(row.observations || '—')}</td>
      </tr>`;
    }).join('');
    const status = agentMonthlySubmission
      ? `Bilan déposé le ${new Date(agentMonthlySubmission.date_depot).toLocaleDateString('fr-FR')}`
      : 'Bilan non déposé';
    content.innerHTML = `
      <div id="agentMonthlyDocument" class="card landscape-sheet agent-monthly-sheet wide-sheet" style="margin-top:16px;background:#fff;color:#111">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:center">
          <div><strong>CEB de Bagré</strong><br><strong>École : ${esc((agentSchool && agentSchool.name) || '')}</strong><br><strong>Mois : ${esc(agentCurrentMonth)}</strong></div>
          <div class="official-motto" style="display:flex;flex-direction:column;align-items:center;text-align:center"><strong>Burkina Faso</strong><em>La Patrie ou la Mort, nous vaincrons</em></div>
        </div>
        <h2 style="text-align:center;margin:20px 0">BILAN MENSUEL DE PRÉSENCE DES AGENTS</h2>
        <p><strong>Année scolaire :</strong> ${agentSchoolYearStart}–${agentSchoolYearStart + 1}
          <span style="float:right">${monthDates.size} jour(s) ouvré(s) pointé(s)</span></p>
        <div class="table-wrap">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr>${['N°','Matricule','Nom','Prénom','Emploi','Fonction','Jours ouvrés pointés','Présences (jours)','Absences (jours)','Taux de présence (%)','Observations du mois']
              .map(title => `<th style="border:1px solid #334155;padding:6px">${title}</th>`).join('')}</tr></thead>
            <tbody>${rows || '<tr><td colspan="11">Aucun agent</td></tr>'}</tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:32px">
          ${signatureBlockHTML('Le Directeur / La Directrice', directorSigners, '')}
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <p id="agentMonthlySubmissionStatus" role="status">${esc(status)}</p>
        <button type="button" class="btn" data-action="agent-monthly-submit"
          style="background:linear-gradient(145deg,#15803d,#16a34a);box-shadow:0 4px 0 #166534;font-weight:700">
          Arrêter et déposer le bilan au Chef du Personnel
        </button>
      </div>
    `;
  }

  function exportAgentMonthlyCSV() {
    const rows = [[
      'N°', 'Matricule', 'Nom', 'Prénom', 'Emploi', 'Fonction', 'Jours ouvrés pointés',
      'Présences (jours)', 'Absences (jours)', 'Taux de présence (%)', 'Observations du mois'
    ]];
    agentMonthlyRows.forEach(row => {
      const { nom, prenom } = getAgentNameParts(row.agent);
      rows.push([
        row.number, row.agent.matricule || row.agent.identifiant || '', nom, prenom,
        getAgentEmployment(row.agent), getAgentFunction(row.agent), row.daysPointed, row.presences, row.absences,
        `${row.rate.toFixed(1)}%`, row.observations
      ]);
    });
    downloadCSV(`Bilan_agents_${agentCurrentMonth}_${agentSchoolYearStart}-${agentSchoolYearStart + 1}.csv`, rows);
  }

  function exportAgentDailyCSV() {
    const rows = [['N°', 'Matricule', 'Nom', 'Prénom', 'Emploi', 'Fonction', 'Présence', 'Observation']];
    dailyAgentRecords().forEach((record, index) => {
      const agent = agentProfiles[index];
      const { nom, prenom } = getAgentNameParts(agent);
      rows.push([
        index + 1, agent.matricule || agent.identifiant || '', nom, prenom,
        getAgentEmployment(agent), getAgentFunction(agent), record.present ? 'Oui' : 'Non', record.observation
      ]);
    });
    downloadCSV(`Appel_agents_${agentCurrentDate}.csv`, rows);
  }

  async function submitMonthlyAgentReport() {
    const status = viewContainer.querySelector('#agentMonthlySubmissionStatus');
    if (!schoolId()) return;
    const payload = {
      ecole_id: schoolId(),
      ecole_nom: (agentSchool && agentSchool.name) || '',
      mois: agentCurrentMonth,
      annee_scolaire: `${agentSchoolYearStart}-${agentSchoolYearStart + 1}`,
      jours_ouvrables: new Set(agentMonthlyRecords.map(record => record.date_jour)).size,
      statut_depot: 'Depose',
      directeur_nom: state.profile.full_name || '',
      date_depot: new Date().toISOString()
    };
    const existingResult = await supabase.from('bilans_agents_mensuels').select('id')
      .eq('ecole_id', payload.ecole_id).eq('mois', payload.mois)
      .eq('annee_scolaire', payload.annee_scolaire).limit(1);
    if (existingResult.error) {
      if (status) {
        status.textContent = `Impossible de vérifier le dépôt : ${existingResult.error.message}`;
        status.style.color = '#dc2626';
      }
      return;
    }
    const existing = (existingResult.data || [])[0];
    const result = existing
      ? await supabase.from('bilans_agents_mensuels').update(payload).eq('id', existing.id).select('id')
      : await supabase.from('bilans_agents_mensuels').insert(payload).select('id');
    if (result.error) {
      if (status) {
        status.textContent = `Erreur lors du dépôt : ${result.error.message}`;
        status.style.color = '#dc2626';
      }
      return;
    }
    agentMonthlySubmission = payload;
    if (status) {
      status.textContent = `Bilan déposé avec succès le ${new Date(payload.date_depot).toLocaleDateString('fr-FR')}.`;
      status.style.color = '#16a34a';
    }
  }

  async function renderSubView(view) {
    if (!viewContainer) return;
    switch (view) {
      case 'ecole': return renderEcole();
      case 'classes': return renderClasses();
      case 'effectifs': return renderEffectifs();
      case 'bilans': return renderBilans();
      case 'school-synthese': return renderSchoolTermSynthesis();
      case 'registre': return renderDirRegistre();
      case 'examens-blancs': return renderDirExamensBlancs();
      case 'agents': return renderAgentAttendance();
      case 'bulletins': return renderBulletinsDir();
      default: return renderEcole();
    }
  }

  async function renderDirExamensBlancs() {
    const classes = await getClasses();
    const cm2Classes = (classes || []).filter(cls => {
      const level = String(cls.level || cls.niveau || cls.name || '').toUpperCase();
      return level.includes('CM1') || level.includes('CM2');
    });
    viewContainer.innerHTML = `
      <div class="card">
        <h3 style="margin-top:0">🎓 Examens Blancs — CM1 / CM2</h3>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:260px">
            <label>Classe (CM1 / CM2)</label>
            <select id="dirExamClass">
              <option value="">-- Choisir une classe --</option>
              ${cm2Classes.map(cls => `<option value="${esc(cls.id)}">${esc(formatClassName(cls))}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div id="dirExamArea" style="margin-top:16px"></div>
    `;
    const select = viewContainer.querySelector('#dirExamClass');
    if (select) select.addEventListener('change', () => renderDirExamSheet(select.value));
    if (cm2Classes.length) {
      select.value = cm2Classes[0].id;
      await renderDirExamSheet(cm2Classes[0].id);
    }
  }

  async function renderDirExamSheet(classId) {
    const area = viewContainer.querySelector('#dirExamArea');
    if (!area) return;
    if (!classId) { area.innerHTML = ''; return; }
    const { data: examRows } = await supabase
      .from('exam_blancs')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(1);
    const exam = (examRows || [])[0];
    if (!exam) {
      area.innerHTML = '<div class="card"><p style="color:#64748b;margin:0">Aucun examen blanc enregistré pour cette classe.</p></div>';
      return;
    }
    const [studentsRes, subjectsRes, notesRes] = await Promise.all([
      supabase.from('students').select('*').eq('class_id', classId).order('full_name'),
      supabase.from('matieres').select('*').eq('class_id', classId).order('created_at'),
      supabase.from('notes_examens_blancs').select('*').eq('exam_blanc_id', exam.id)
    ]);
    const subjects = subjectsRes.data || [];
    const rows = computeExamRows(studentsRes.data || [], subjects, notesRes.data || []);
    const tables = renderExamEntryTable(rows, subjects, subjects[0] || null);
    const classe = (await getClasses()).find(cls => cls.id === classId) || {};
    const context = {
      rows,
      subjects,
      classeLabel: formatClassName(classe),
      niveau: exam.niveau,
      sessionLabel: examSessionLabel(exam),
      schoolName: state.profile ? (state.profile.ecole_nom || 'CEB de Bagré') : 'CEB de Bagré',
      titulaireName: classe.titulaire_nom || '',
      titulaireSignature: '',
      directeurName: state.profile ? state.profile.full_name : '',
      directeurSignature: state.profile ? (state.profile.signature_url || '') : ''
    };
    area.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <h3 style="margin:0">Examen blanc — ${esc(formatClassName(classe))} — ${esc(examLevelLabel(exam.niveau))}</h3>
          <div class="top-actions">
            <button type="button" class="btn" data-action="dir-exam-preview">👁 Aperçu</button>
            <button type="button" class="btn secondary" onclick="window.print()">🖨️ Imprimer / PDF</button>
          </div>
        </div>
        <h4 style="margin:16px 0 6px;font-size:15px">📊 Tableau récapitulatif des notes</h4>
        <div class="table-wrap">
          <table>${tables.overviewHead}<tbody>${tables.overviewBody}</tbody></table>
        </div>
        <div class="table-wrap" style="margin-top:16px">
          ${renderExamSyntheseHTML(context)}
        </div>
      </div>
    `;
    const previewBtn = viewContainer.querySelector('[data-action="dir-exam-preview"]');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        openPreview({ title: 'Fiche Synthèse — Examen Blanc', html: renderExamSyntheseHTML(context), onPrint: () => window.print() });
      });
    }
  }

  async function renderDirRegistre() {
    const classes = await getClasses();
    viewContainer.innerHTML = `
      <div class="card">
        <h3>Registre d'appel — Fiche d'Arrêt Mensuel</h3>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:240px">
            <label>Classe</label>
            <select id="dirRegClass">
              <option value="">-- Choisir une classe --</option>
              ${classes.map(c => `<option value="${esc(c.id)}">${esc(formatClassName(c))}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:200px">
            <label>Mois clôturé</label>
            <select id="dirRegMonth" style="width:100%"><option value="">-- Choisir --</option></select>
          </div>
          <button class="btn" data-action="dir-reg-preview">👁 Aperçu</button>
          <button class="btn" data-action="dir-reg-csv">📥 Excel/CSV</button>
          <button class="btn secondary" onclick="window.print()">🖨️ Imprimer / PDF</button>
          <button type="button" class="btn" data-action="visa-directeur">✍️ Viser</button>
        </div>
        <p id="dirRegStatus" role="status" aria-live="polite" style="margin:10px 0 0"></p>
      </div>
      <div class="card" style="margin-top:16px">
        <div id="dirRegSheet"><p style="color:#64748b">Sélectionnez une classe pour afficher sa Fiche d'Arrêt Mensuel.</p></div>
      </div>`;
    const sel = viewContainer.querySelector('#dirRegClass');
    if (sel) sel.addEventListener('change', renderDirRegSheet);
    const ms = viewContainer.querySelector('#dirRegMonth');
    if (ms) ms.addEventListener('change', () => { dirFicheMonthIdx = parseInt(ms.value, 10) || 0; renderDirRegSheet(); });
  }

  async function renderDirRegSheet() {
    const classId = viewContainer.querySelector('#dirRegClass')?.value;
    const monthSel = viewContainer.querySelector('#dirRegMonth');
    const sheetEl = viewContainer.querySelector('#dirRegSheet');
    if (!sheetEl) return;
    if (!classId) {
      if (monthSel) monthSel.innerHTML = '<option value="">-- Choisir --</option>';
      sheetEl.innerHTML = '<p style="color:#64748b">Sélectionnez une classe.</p>';
      viewContainer.querySelector('#dirRegSummary')?.closest('.monthly-register-sheet')?.remove();
      return;
    }
    const { data: cls } = await supabase.from('classes').select('*').eq('id', classId).single();
    if (!cls) {
      sheetEl.innerHTML = '';
      viewContainer.querySelector('#dirRegSummary')?.closest('.monthly-register-sheet')?.remove();
      return;
    }
    const { data: students } = await supabase.from('students').select('*').eq('class_id', classId);
    const { data: presences } = await supabase.from('presences').select('*').eq('classe_id', classId);
    const absences = (presences || []).filter(p => p.statut === 'A');
    const startYear = parseInt((cls.year || state.activeSchoolYear || '2026-2027').split('-')[0], 10) || 2026;
    const months = schoolMonths(startYear);
    const { data: configs } = await supabase.from('registre_configs').select('*').eq('classe_id', classId);
    const joursByMonth = {};
    const closed = [];
    const cfgMap = {};
    (configs || []).forEach(c => {
      joursByMonth[c.mois] = (c.jours_valides && c.jours_valides.length ? c.jours_valides : c.jours_pointes) || [];
      cfgMap[c.mois] = c;
      if (c.mois_cloture) closed.push(c.mois);
    });
    const closedMonths = months.filter(m => closed.includes(m.name));
    dirMonthlyRows = computeMonthlyRegister(students || [], absences, startYear, joursByMonth).filter(r => closed.includes(r.name));
    dirVisaDirecteurByMonth = {};
    dirVisaEncadreurByMonth = {};
    closedMonths.forEach(m => {
      dirVisaDirecteurByMonth[m.name] = (cfgMap[m.name] && cfgMap[m.name].visa_directeur) || '';
      dirVisaEncadreurByMonth[m.name] = (cfgMap[m.name] && cfgMap[m.name].visa_encadreur) || '';
      dirVisaDirectorStamps[m.name] = (cfgMap[m.name] && cfgMap[m.name].visa_directeur_nom)
        ? { date: (cfgMap[m.name] && cfgMap[m.name].visa_directeur_date) || '', nom: cfgMap[m.name].visa_directeur_nom, signatureUrl: (cfgMap[m.name] && cfgMap[m.name].visa_directeur_signature) || '' }
        : null;
      dirVisaEncadreurStamps[m.name] = (cfgMap[m.name] && cfgMap[m.name].visa_encadreur_nom)
        ? { date: (cfgMap[m.name] && cfgMap[m.name].visa_encadreur_date) || '', nom: cfgMap[m.name].visa_encadreur_nom, signatureUrl: (cfgMap[m.name] && cfgMap[m.name].visa_encadreur_signature) || '' }
        : null;
    });
    if (monthSel) {
      monthSel.innerHTML = closedMonths.length
        ? closedMonths.map((m, i) => `<option value="${i}" ${i === dirFicheMonthIdx ? 'selected' : ''}>${esc(m.name)}</option>`).join('')
        : '<option value="">Aucun mois clôturé</option>';
    }
    if (!closedMonths.length) {
      sheetEl.innerHTML = '<p style="color:#64748b">Aucun mois clôturé pour cette classe. La Fiche Synthèse Annuelle ci-dessous reste visible et se remplira au fil des mois arrêtés.</p>';
      dirCurrentFiche = null;
      dirMonthlyRows = [];
      dirVisaDirecteurByMonth = {};
      dirVisaEncadreurByMonth = {};
      dirVisaDirectorStamps = {};
      dirVisaEncadreurStamps = {};
      renderDirRegSummaryPanel(cls);
      return;
    }
    if (dirFicheMonthIdx >= closedMonths.length) dirFicheMonthIdx = 0;
    const active = closedMonths[dirFicheMonthIdx] || closedMonths[0];
    const data = computeFicheArretMensuel(students || [], absences, active, joursByMonth[active.name] || []);
    let schoolName = '';
    if (cls.school_id) {
      const { data: school } = await supabase.from('schools').select('name').eq('id', cls.school_id).single();
      schoolName = (school && school.name) || '';
    }
    let teacherNames = [];
    let teacherSigners = [];
    try {
      const { data: links } = await supabase.from('class_teachers').select('teacher_id, profiles(id,full_name,signature_url)').eq('class_id', classId);
      teacherSigners = (links || []).map(link => link.profiles).filter(person => person && person.full_name);
      teacherNames = teacherSigners.map(person => person.full_name);
    } catch (e) { /* ignore */ }
    if (!teacherNames.length && cls.titulaire_id) {
      try {
        const { data: prof } = await supabase.from('profiles').select('id,full_name,signature_url').eq('id', cls.titulaire_id).single();
        if (prof && prof.full_name) {
          teacherNames = [prof.full_name];
          teacherSigners = [prof];
        }
      } catch (e) { /* ignore */ }
    }
    const visa = (cfgMap[active.name] && cfgMap[active.name].visa_directeur) || '';
    dirCurrentFiche = { cls, schoolName, className: formatClassName(cls), monthName: active.name, data, teacherNames, teacherSigners, visaDirecteur: visa };
    sheetEl.innerHTML = renderFicheArretMensuelHTML({
      schoolName: dirCurrentFiche.schoolName,
      className: dirCurrentFiche.className,
      monthName: dirCurrentFiche.monthName,
      data: dirCurrentFiche.data,
      teacherNames: dirCurrentFiche.teacherNames,
      teacherSigners: dirCurrentFiche.teacherSigners,
      visaDirecteur: dirCurrentFiche.visaDirecteur,
      visaDirecteurSignatureProfile: directorSigners.length && profileMatchesVisa(dirCurrentFiche.visaDirecteur, actualProfile) ? actualProfile : null,
      showVisaButton: true,
      onVisaLabel: 'visa-directeur',
      directorStamp: dirVisaDirectorStamps[dirCurrentFiche.monthName] || null
    });
    renderDirRegSummaryPanel(cls);
  }

  function renderDirRegSummaryPanel(cls) {
    let summaryPanel = viewContainer.querySelector('#dirRegSummary')?.closest('.monthly-register-sheet');
    if (!summaryPanel) {
      summaryPanel = document.createElement('div');
      summaryPanel.className = 'card monthly-register-sheet';
      summaryPanel.style.marginTop = '16px';
      const ficheCard = viewContainer.querySelector('#dirRegSheet')?.closest('.card');
      if (ficheCard && ficheCard.parentElement) {
        ficheCard.parentElement.insertBefore(summaryPanel, ficheCard.nextSibling);
      } else {
        viewContainer.appendChild(summaryPanel);
      }
    }
    summaryPanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <h3 style="margin:0">${ANNUAL_SYNTHESIS_TITLE}${cls ? ' — ' + esc(formatClassName(cls)) : ''}</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn" data-action="dir-reg-summary-preview">👁 Aperçu</button>
          <button type="button" class="btn" data-action="dir-reg-summary-pdf">📄 PDF (A4 paysage)</button>
          <button type="button" class="btn secondary" data-action="dir-reg-summary-print">🖨️ Imprimer</button>
          <button type="button" class="btn" data-action="dir-reg-summary-csv">📥 Excel/CSV</button>
        </div>
      </div>
      <div id="dirRegSummary" style="margin-top:12px">${renderMonthlyRegisterTable(dirMonthlyRows, {
        visaDirecteurByMonth: dirVisaDirecteurByMonth,
        visaEncadreurByMonth: dirVisaEncadreurByMonth,
        visaDirectorStamps: dirVisaDirectorStamps,
        visaEncadreurStamps: dirVisaEncadreurStamps,
        visaAction: 'visa-directeur',
        visaDirecteurProfile: actualProfile.role === 'directeur' ? actualProfile : null
      })}</div>`;
    wirePDFExportButton(
      summaryPanel.querySelector('[data-action="dir-reg-summary-pdf"]'),
      () => summaryPanel,
      'synthese_mois_arretes.pdf',
      { orientation: 'landscape', format: 'a4', margin: 10 }
    );
  }

  function exportDirMonthlyCSV() {
    if (!dirMonthlyRows.length) { alert('Aucun mois clôturé à exporter.'); return; }
    downloadCSV('synthese_mois_arretes.csv', monthlyRegisterCSVRows(dirMonthlyRows, {
      visaDirecteurByMonth: dirVisaDirecteurByMonth,
      visaEncadreurByMonth: dirVisaEncadreurByMonth
    }));
  }

  function exportDirRegistreCSV() {
    if (!dirCurrentFiche) { alert('Sélectionnez une classe et un mois clôturé.'); return; }
    const r = dirCurrentFiche.data;
    const rows = [];
    rows.push(['CEB de Bagré', '', '', '']);
    rows.push(['École', dirCurrentFiche.schoolName || '', '', '']);
    rows.push(['Classe', dirCurrentFiche.className || '', '', '']);
    rows.push(['ARRÊT DU MOIS DE ' + String(dirCurrentFiche.monthName || '').toUpperCase(), '', '', '']);
    rows.push([]);
    rows.push(...monthlyClosureCSVRows(r));
    rows.push([]);
    rows.push(['Le(s) Titulaire(s)', dirCurrentFiche.teacherNames.join(', ')]);
    rows.push(['Visa du Directeur', dirCurrentFiche.visaDirecteur || '']);
    downloadCSV('arre_t_' + String(dirCurrentFiche.monthName || 'mois').toLowerCase() + '_' + String(dirCurrentFiche.className || 'classe').replace(/\s+/g, '_') + '.csv', rows);
  }

  async function renderBulletinsDir() {
    const classes = await getClasses();
    const sel = viewContainer.querySelector('#dirBulletinClass');
    const prevClass = sel ? sel.value : '';
    const termSel = viewContainer.querySelector('#dirBulletinTerm');
    const prevTerm = termSel ? termSel.value : '1';

    viewContainer.innerHTML = `
      <div class="card">
        <h3>Bulletins trimestriels</h3>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:240px">
            <label>Classe</label>
            <select id="dirBulletinClass">
              <option value="">-- Choisir une classe --</option>
              ${classes.map(c => `<option value="${esc(c.id)}" ${prevClass === c.id ? 'selected' : ''}>${esc(formatClassName(c))}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:150px">
            <label>Trimestre</label>
            <select id="dirBulletinTerm">
              <option value="1" ${prevTerm === '1' ? 'selected' : ''}>Trimestre 1</option>
              <option value="2" ${prevTerm === '2' ? 'selected' : ''}>Trimestre 2</option>
              <option value="3" ${prevTerm === '3' ? 'selected' : ''}>Trimestre 3</option>
            </select>
          </div>
          <button class="btn" onclick="window.print()" style="margin-bottom:2px">🖨️ Imprimer / PDF</button>
        </div>
        <div id="dirBulletinSheets" style="margin-top:12px">
          <p style="color:#64748b">Sélectionnez une classe pour générer les bulletins.</p>
        </div>
      </div>
    `;
    const cs = viewContainer.querySelector('#dirBulletinClass');
    const ts = viewContainer.querySelector('#dirBulletinTerm');
    if (cs) cs.addEventListener('change', () => renderDirBulletins(cs.value, ts ? ts.value : undefined));
    if (ts) ts.addEventListener('change', () => renderDirBulletins(cs ? cs.value : '', ts.value));
  }

  async function renderDirBulletins(classId, term) {
    const sel = viewContainer.querySelector('#dirBulletinClass');
    const tsel = viewContainer.querySelector('#dirBulletinTerm');
    const clsId = classId != null ? classId : (sel ? sel.value : '');
    const t = term != null ? parseInt(term, 10) : parseInt((tsel && tsel.value) || '1', 10);
    const sheetsEl = viewContainer.querySelector('#dirBulletinSheets');
    if (!sheetsEl) return;
    if (!clsId) { sheetsEl.innerHTML = '<p style="color:#64748b">Sélectionnez une classe pour générer les bulletins.</p>'; return; }
    const { data: cls } = await supabase.from('classes').select('*').eq('id', clsId).single();
    if (!cls) { sheetsEl.innerHTML = ''; return; }
    const { data: students } = await supabase.from('students').select('*').eq('class_id', clsId).order('full_name');
    const list = students || [];
    let subjects = (cls.subjects || []).map(s => ({ id: s.id, name: s.name, max: s.max, coef: s.coef || 1 }));
    const { data: matieres } = await supabase.from('matieres').select('*').eq('class_id', clsId);
    if (matieres && matieres.length) subjects = matieres.map(m => ({ id: m.id, name: m.nom, max: m.bareme, coef: m.coefficient != null ? m.coefficient : 1 }));
    const { data: notes } = await supabase.from('notes').select('*').eq('classe_id', clsId);
    let schoolName = '';
    if (cls.school_id) { const { data: school } = await supabase.from('schools').select('name').eq('id', cls.school_id).single(); schoolName = (school && school.name) || ''; }
    let teacherName = '';
    let teacherSigners = [];
    if (cls.titulaire_id) {
      const { data: tt } = await supabase.from('profiles').select('id,full_name,signature_url').eq('id', cls.titulaire_id).single();
      teacherName = (tt && tt.full_name) || '';
      if (tt) teacherSigners = [tt];
    }
    sheetsEl.innerHTML = renderBulletinsHTML({ students: list, subjects, notes: notes || [], term: t, className: formatClassName(cls), schoolName, teacherName, teacherSigners });
  }

  function exportEffectifsCSV() {
    const rows = [['Classe', 'Garçons', 'Filles', 'Total']];
    effectifsRows.forEach(c => rows.push([c.name, c.boys, c.girls, c.total]));
    downloadCSV('effectifs_cebe.csv', rows);
  }

  function exportBilansCSV() {
    const rows = [[
      'Classe', 'Trimestre', 'Indicateur',
      'Garçons - Nbre', 'Garçons - %',
      'Filles - Nbre', 'Filles - %',
      'Total - Nbre', 'Total - %'
    ]];
    bilansRows.forEach(bilan => {
      rows.push([
        bilan.clsName, bilan.termLabel, 'Effectif de la classe',
        bilan.enrollment.boys, '', bilan.enrollment.girls, '', bilan.enrollment.total, ''
      ]);
      rows.push([
        bilan.clsName, bilan.termLabel, 'Élèves ayant eu la moyenne (≥ 5/10)',
        bilan.classPass.boys.passed, bilan.classPass.boys.rate,
        bilan.classPass.girls.passed, bilan.classPass.girls.rate,
        bilan.classPass.total.passed, bilan.classPass.total.rate
      ]);
      bilan.subjectRows.forEach(subject => rows.push([
        bilan.clsName, bilan.termLabel, subject.name,
        subject.bPass, subject.pctG, subject.gPass, subject.pctF, subject.tPass, subject.pctT
      ]));
    });
    downloadCSV('bilans_cebe.csv', rows);
  }

  async function renderBilans() {
    const classes = await getClasses();
    bilanClassesData = [];
    bilanLoadErrors = [];
    const sid = schoolId();
    if (sid) {
      const schoolResult = await supabase.from('schools').select('name').eq('id', sid).maybeSingle();
      bilanSchoolName = (schoolResult.data && schoolResult.data.name) || '';
      if (schoolResult.error) bilanLoadErrors.push(schoolResult.error.message);
    } else {
      bilanSchoolName = '';
    }

    for (const cls of classes) {
      const [studentsResult, subjectsResult, notesResult] = await Promise.all([
        supabase.from('students').select('*').eq('class_id', cls.id),
        supabase.from('matieres').select('*').eq('class_id', cls.id),
        supabase.from('notes').select('*').eq('classe_id', cls.id)
      ]);
      [studentsResult, subjectsResult, notesResult].forEach(result => {
        if (result.error) bilanLoadErrors.push(`${formatClassName(cls)} : ${result.error.message}`);
      });
      let subjects = (cls.subjects || []).map(subject => ({
        id: subject.id,
        name: String(subject.name || subject.nom || '').trim(),
        max: subject.max,
        coef: subject.coef || 1
      }));
      if (subjectsResult.data && subjectsResult.data.length) {
        subjects = subjectsResult.data.map(subject => ({
          id: subject.id,
          name: String(subject.nom || subject.name || '').trim(),
          max: subject.bareme,
          coef: subject.coefficient != null ? subject.coefficient : 1
        }));
      }
      bilanClassesData.push({
        cls,
        students: studentsResult.data || [],
        subjects,
        notes: normalizeNotes(notesResult.data || [])
      });
    }
    if (!bilanClassesData.some(item => String(item.cls.id) === String(selectedBilanClassId))) {
      selectedBilanClassId = 'all';
    }
    viewContainer.innerHTML = `
      <div class="card">
        <h3>Bilan et Synthèse des Trimestres</h3>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:220px">
            <label for="bilanClass">Classe</label>
            <select id="bilanClass">
              <option value="all" ${selectedBilanClassId === 'all' ? 'selected' : ''}>Toutes les classes de l'école</option>
              ${classes.map(cls => `<option value="${esc(cls.id)}" ${String(selectedBilanClassId) === String(cls.id) ? 'selected' : ''}>${esc(formatClassName(cls))}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:200px">
            <label for="bilanTerm">Trimestre</label>
            <select id="bilanTerm">
              <option value="1" ${selectedBilanTerm === 1 ? 'selected' : ''}>1er Trimestre</option>
              <option value="2" ${selectedBilanTerm === 2 ? 'selected' : ''}>2e Trimestre</option>
              <option value="3" ${selectedBilanTerm === 3 ? 'selected' : ''}>3e Trimestre</option>
            </select>
          </div>
          <button type="button" class="btn" data-action="bilan-preview">👁 Aperçu</button>
          <button type="button" class="btn" id="bilanExportPdf">📄 Exporter en PDF</button>
          <button type="button" class="btn secondary" data-action="bilan-print">🖨️ Imprimer</button>
          <button type="button" class="btn secondary" data-action="bilan-excel">📥 Exporter en Excel</button>
        </div>
      </div>
      <div id="bilansReport" class="landscape-sheet wide-sheet" style="margin-top:16px;background:#fff;color:#111827;padding:18px"></div>
    `;
    wirePDFExportButton(
      viewContainer.querySelector('#bilanExportPdf'),
      () => viewContainer.querySelector('#bilansReport'),
      () => `Bilan_trimestriel_${selectedBilanTerm}_directeur.pdf`,
      { orientation: 'landscape', format: 'a4', margin: 10 }
    );
    renderBilanCards();
  }

  function calculateClassPassSummary(students, subjects, notes, term) {
    const counts = {
      boys: { passed: 0, evaluated: 0 },
      girls: { passed: 0, evaluated: 0 },
      total: { passed: 0, evaluated: 0 }
    };
    const normalizedNotes = normalizeNotes(notes);
    (students || []).filter(student => student.status !== 'A').forEach(student => {
      let weightedTotal = 0;
      let totalCoefficient = 0;
      let evaluatedSubjects = 0;
      (subjects || []).forEach(subject => {
        const note = normalizedNotes.find(row =>
          row.eleve_id === student.id &&
          row.matiere_id === subject.id &&
          row.trimestre === term
        );
        if (!note || note.note == null || note.note === '') return;
        const value = parseFloat(note.note);
        if (!Number.isFinite(value)) return;
        const max = parseFloat(subject.max) || 10;
        const coefficient = parseFloat(subject.coef) || 1;
        weightedTotal += (value / max) * coefficient;
        totalCoefficient += coefficient;
        evaluatedSubjects++;
      });
      if (!evaluatedSubjects || !totalCoefficient) return;
      const average = weightedTotal / totalCoefficient * 10;
      const groups = ['total'];
      if (student.gender === 'M') groups.push('boys');
      else if (student.gender === 'F') groups.push('girls');
      groups.forEach(group => {
        counts[group].evaluated++;
        if (average >= 5) counts[group].passed++;
      });
    });
    Object.keys(counts).forEach(group => {
      counts[group].rate = counts[group].evaluated
        ? Math.round(counts[group].passed / counts[group].evaluated * 1000) / 10
        : null;
    });
    return counts;
  }

  function renderBilanCards() {
    const report = viewContainer.querySelector('#bilansReport');
    if (!report) return;
    const term = selectedBilanTerm;
    const termLabel = term === 1 ? '1er Trimestre' : term === 2 ? '2e Trimestre' : '3e Trimestre';
    const selectedClasses = selectedBilanClassId === 'all'
      ? bilanClassesData
      : bilanClassesData.filter(item => String(item.cls.id) === String(selectedBilanClassId));
    bilansRows = selectedClasses.map(item => ({
      clsName: formatClassName(item.cls),
      termLabel,
      enrollment: {
        boys: item.students.filter(student => student.gender === 'M').length,
        girls: item.students.filter(student => student.gender === 'F').length,
        total: item.students.length
      },
      classPass: calculateClassPassSummary(item.students, item.subjects, item.notes, term),
      subjectRows: computeSubjectRows(item.students, item.subjects, item.notes, term)
        .filter(row => row.tComp > 0)
    }));
    const formatRate = value => value == null ? '—' : `${value.toFixed(1)}%`;
    const passMetric = group => `${group.passed} <span style="font-weight:400">(${formatRate(group.rate)})</span>`;
    const groups = [
      { key: 'boys', label: 'Garçons', color: '#111827' },
      { key: 'girls', label: 'Filles', color: '#dc2626' },
      { key: 'total', label: 'Total', color: '#16a34a' }
    ];
    const errorBlock = bilanLoadErrors.length
      ? `<p role="status" style="color:#b91c1c">${bilanLoadErrors.map(error => esc(error)).join('<br>')}</p>`
      : '';
    report.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #111827;padding-bottom:10px;margin-bottom:16px">
        <div style="font-size:14px;line-height:1.5">
          <strong>CEB de Bagré</strong><br>
          <strong>École : ${esc(bilanSchoolName)}</strong><br>
          <strong>${esc(termLabel)}</strong>
        </div>
        <div class="official-motto" style="display:flex;flex-direction:column;align-items:center;text-align:center">
          <strong>Burkina Faso</strong>
          <em>La Patrie ou la Mort, nous vaincrons</em>
        </div>
      </div>
      <h2 style="text-align:center;margin:0 0 16px;font-size:20px">BILAN ET SYNTHÈSE DES TRIMESTRES</h2>
      ${errorBlock}
      ${bilansRows.map(bilan => {
        const classPassRow = group => passMetric(bilan.classPass[group]);
        return `
          <section style="margin:0 0 22px;padding:14px;border:1px solid #cbd5e1;border-radius:8px;break-inside:avoid">
            <h3 style="margin:0 0 12px;color:#111827">Classe : ${esc(bilan.clsName)} — ${esc(termLabel)}</h3>
            <div style="font-weight:700;margin-bottom:6px">Effectif de la classe &amp; réussite globale</div>
            <div class="table-wrap">
              <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
                <thead><tr>
                  <th style="border:1px solid #cbd5e1;padding:8px;text-align:left">Indicateur</th>
                  ${groups.map(group => `<th style="border:1px solid #cbd5e1;padding:8px;color:${group.color}">${group.label}</th>`).join('')}
                </tr></thead>
                <tbody>
                  <tr>
                    <th style="border:1px solid #cbd5e1;padding:8px;text-align:left">Effectif de la classe</th>
                    ${groups.map(group => `<td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:${group.color};font-weight:700">${bilan.enrollment[group.key]}</td>`).join('')}
                  </tr>
                  <tr>
                    <th style="border:1px solid #cbd5e1;padding:8px;text-align:left">Élèves ayant eu la moyenne (≥ 5/10) — nbre et taux</th>
                    ${groups.map(group => `<td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:${group.color};font-weight:700">${classPassRow(group.key)}</td>`).join('')}
                  </tr>
                </tbody>
              </table>
            </div>
            <div style="font-weight:700;margin-bottom:6px">Taux de réussite par discipline</div>
            <div class="table-wrap">
              <table style="width:100%;border-collapse:collapse">
                <thead>
                  <tr>
                    <th rowspan="2" style="border:1px solid #cbd5e1;padding:8px;text-align:left;vertical-align:middle">Discipline</th>
                    ${groups.map(group => `<th colspan="2" style="border:1px solid #cbd5e1;padding:8px;color:${group.color}">${group.label} ayant la moyenne</th>`).join('')}
                  </tr>
                  <tr>${groups.map(group => `<th style="border:1px solid #cbd5e1;padding:6px;color:${group.color}">Nbre</th><th style="border:1px solid #cbd5e1;padding:6px;color:${group.color}">%</th>`).join('')}</tr>
                </thead>
                <tbody>
                  ${bilan.subjectRows.map(subject => `
                    <tr>
                      <td style="border:1px solid #cbd5e1;padding:8px">${esc(subject.name || '—')}</td>
                      <td style="border:1px solid #cbd5e1;padding:8px;text-align:center">${subject.bPass}</td>
                      <td style="border:1px solid #cbd5e1;padding:8px;text-align:center">${subject.pctG.toFixed(1)}%</td>
                      <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:#dc2626">${subject.gPass}</td>
                      <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:#dc2626">${subject.pctF.toFixed(1)}%</td>
                      <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:#16a34a;font-weight:700">${subject.tPass}</td>
                      <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:#16a34a;font-weight:700">${subject.pctT.toFixed(1)}%</td>
                    </tr>
                  `).join('') || '<tr><td colspan="7" style="border:1px solid #cbd5e1;padding:10px;text-align:center">Aucune discipline évaluée pour ce trimestre.</td></tr>'}
                </tbody>
              </table>
            </div>
          </section>
        `;
      }).join('') || '<p>Aucune classe dans votre école.</p>'}
      <div style="display:flex;justify-content:flex-end;margin-top:24px">
        ${signatureBlockHTML('Le Directeur / La Directrice', directorSigners, actualProfile.full_name || '')}
      </div>
    `;
  }

  async function renderSchoolTermSynthesis() {
    const sid = schoolId();
    if (!sid) {
      viewContainer.innerHTML = '<div class="empty">Aucune école assignée.</div>';
      return;
    }
    let schoolData;
    try {
      schoolData = await loadSchoolTermData(supabase, sid);
    } catch (error) {
      viewContainer.innerHTML = `<div class="card" role="alert" style="color:#b91c1c">Impossible de charger les données de l'école : ${esc(error.message || error)}</div>`;
      return;
    }
    const { school, classesData } = schoolData;
    if (!classesData.some(item => String(item.cls.id) === String(schoolTermClassId))) {
      schoolTermClassId = classesData.length ? classesData[0].cls.id : '';
    }
    const cebResult = await supabase.from('profiles').select('id,full_name,signature_url')
      .eq('role', 'chef_ceb').order('full_name').limit(1).maybeSingle();
    if (cebResult.error) {
      viewContainer.innerHTML = `<div class="card" role="alert" style="color:#b91c1c">Impossible de charger la signature du Chef de la CEB : ${esc(cebResult.error.message)}</div>`;
      return;
    }
    const cebSigners = cebResult.data ? [cebResult.data] : [];
    let summary = null;
    let classData = null;
    let reportHTML = '<div class="empty">Aucune classe enregistrée pour cette école.</div>';
    if (schoolTermMode === 'school') {
      summary = computeSchoolTermSynthesis(classesData, schoolTerm);
      reportHTML = renderSchoolTermSynthesisHTML({
        schoolName: school.name,
        term: schoolTerm,
        summary,
        directorSigners,
        cebSigners
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
        viewContainer.innerHTML = `<div class="card" role="alert" style="color:#b91c1c">Impossible de charger le visa : ${esc(visaResult.error.message)}</div>`;
        return;
      }
      const visaDirecteur = (visaResult.data || []).map(config => config.visa_directeur).find(Boolean) || '';
      const matchedDirector = profileMatchesVisa(visaDirecteur, actualProfile) ? actualProfile : null;
      reportHTML = renderSyntheseHTML({
        schoolName: school.name,
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
    schoolTermExport = { mode: schoolTermMode, school, summary, classData };
    viewContainer.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:190px">
            <label>École</label>
            <input type="text" value="${esc(school.name)}" readonly>
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
    const margin = schoolTermMode === 'class' ? 12 : 10;
    wirePDFExportButton(
      viewContainer.querySelector('#schoolTermPdf'),
      sheet,
      `synthese_ecole_${schoolTerm}_directeur.pdf`,
      { orientation, format: 'a4', margin }
    );
    wireWordExportButton(
      viewContainer.querySelector('#schoolTermWord'),
      sheet,
      `synthese_ecole_${schoolTerm}_directeur.doc`,
      'Synthèse Trimestrielle de l’École',
      { orientation }
    );
  }

  function exportSchoolTermCSV() {
    if (!schoolTermExport) return;
    if (schoolTermExport.mode === 'school' && schoolTermExport.summary) {
      downloadCSV(
        `synthese_ecole_${schoolTerm}_directeur.csv`,
        schoolTermSynthesisCSVRows(schoolTermExport.school.name, schoolTerm, schoolTermExport.summary)
      );
      return;
    }
    const classData = schoolTermExport.classData;
    if (!classData) return;
    const rows = [
      ['École', schoolTermExport.school.name],
      ['Classe', formatClassName(classData.cls)],
      ['Trimestre', schoolTerm],
      [],
      ['Discipline', 'Garçons ayant la moyenne', 'Garçons (%)', 'Filles ayant la moyenne', 'Filles (%)', 'Total ayant la moyenne', 'Total (%)']
    ];
    computeSubjectRows(classData.students, classData.subjects, classData.notes, schoolTerm)
      .filter(subject => subject.tComp > 0)
      .forEach(subject => rows.push([
        subject.name, subject.bPass, subject.pctG, subject.gPass, subject.pctF, subject.tPass, subject.pctT
      ]));
    downloadCSV(`fiche_synthese_${schoolTermClassId}_T${schoolTerm}.csv`, rows);
  }

  async function renderEcole() {
    const sid = schoolId();
    if (!sid) {
      viewContainer.innerHTML = '<div class="empty">Aucune école assignée.</div>';
      return;
    }
    const [schoolRes, classes, titulaires, studentsRes] = await Promise.all([
      supabase.from('schools').select('*').eq('id', sid).single(),
      getClasses(),
      getTitulaires(),
      supabase.from('students').select('*').eq('school_id', sid).order('full_name')
    ]);
    const school = schoolRes.data;
    const studentList = studentsRes.data || [];
    const boys = studentList.filter(s => s.gender === 'M').length;
    const girls = studentList.filter(s => s.gender === 'F').length;

    const tituName = {};
    (titulaires || []).forEach(t => { tituName[t.id] = t.full_name; });
    const className = {};
    classes.forEach(c => { className[c.id] = formatClassName(c); });
    const perClass = {};
    studentList.forEach(s => { perClass[s.class_id] = (perClass[s.class_id] || 0) + 1; });

    viewContainer.innerHTML = `
      <div class="card">
        <h3>${esc((school && school.name) || 'École')}</h3>
        <p>CEB : ${esc((school && school.ceb) || 'BAGRÉ')}</p>
        <div class="stat-row">
          <div class="stat-box"><strong>${studentList.length}</strong><span>Élèves total</span></div>
          <div class="stat-box"><strong>${boys}</strong><span>Garçons</span></div>
          <div class="stat-box"><strong>${girls}</strong><span>Filles</span></div>
          <div class="stat-box"><strong>${classes.length}</strong><span>Classes</span></div>
          <div class="stat-box"><strong>${(titulaires || []).length}</strong><span>Titulaires</span></div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>Titulaires de l'école (${(titulaires || []).length})</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Nom et Prénom</th><th>Sexe</th><th>Classe</th><th>Contact WhatsApp</th></tr></thead>
            <tbody>
              ${(titulaires || []).map((t, i) => {
                const cls = classes.find(c => c.titulaire_id === t.id);
                const phone = (t.whatsapp_phone || '').replace('+', '');
                return `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${esc(t.full_name)}</strong>${t.role === 'directeur' ? ` <span style="color:#1d4ed8;font-weight:700">— Directeur${t.classe_tenue && t.classe_tenue !== 'Aucune' ? ' (Titulaire ' + esc(t.classe_tenue) + ')' : ''}</span>` : ''}</td>
                    <td>${t.gender === 'M' ? 'Homme' : (t.gender === 'F' ? 'Femme' : '—')}</td>
                    <td>${cls ? esc(formatClassName(cls)) : '—'}</td>
                    <td>${phone ? `<a href="https://wa.me/${esc(phone)}" target="_blank" rel="noopener">${esc(t.whatsapp_phone)}</a>` : '—'}</td>
                  </tr>
                `;
              }).join('') || '<tr><td colspan="5">Aucun titulaire</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>Classes de l'école (${classes.length})</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Classe</th><th>Titulaire</th><th>Effectif</th></tr></thead>
            <tbody>
              ${classes.map((c, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><strong>${esc(formatClassName(c))}</strong></td>
                  <td>${c.titulaire_id ? esc(tituName[c.titulaire_id] || '—') : '—'}</td>
                  <td><strong>${perClass[c.id] || 0}</strong></td>
                </tr>
              `).join('') || '<tr><td colspan="5">Aucune classe</td></tr>'}
              <tr style="background:#f8fafc;font-weight:700">
                <td></td><td colspan="2">Total élèves</td><td>${studentList.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>Liste complète des élèves (${studentList.length})</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Nom et Prénom</th><th>Sexe</th><th>Classe</th><th>Statut</th></tr></thead>
            <tbody>
              ${studentList.map((s, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${s.gender === 'F' ? `<strong style="color:#dc2626">${esc(s.full_name)}</strong>` : `<strong>${esc(s.full_name)}</strong>`}</td>
                  <td>${s.gender === 'M' ? 'M' : `<span style="color:#dc2626">F</span>`}</td>
                  <td>${esc(className[s.class_id] || '—')}</td>
                  <td>${s.status === 'A' ? '<strong>A</strong>' : esc(s.status || 'Actif')}</td>
                </tr>
              `).join('') || '<tr><td colspan="5">Aucun élève</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function renderClasses() {
    const classes = await getClasses();
    const { stats } = await getClassStats(classes);

    viewContainer.innerHTML = `
      <div class="card">
        <h3>Toutes les classes de l'école</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Classe</th><th>Année</th><th>Garçons</th><th>Filles</th><th>Total</th></tr></thead>
            <tbody>
              ${stats.map((c, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><strong>${esc(formatClassName(c.cls))}</strong></td>
                  <td>${esc(c.cls.year || '')}</td>
                  <td>${c.boys}</td>
                  <td>${c.girls}</td>
                  <td><strong>${c.total}</strong></td>
                </tr>
              `).join('') || '<tr><td colspan="6">Aucune classe</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function renderEffectifs() {
    const classes = await getClasses();
    const { stats, totalStudents, totalBoys, totalGirls } = await getClassStats(classes);
    effectifsRows = stats.map(c => ({ name: formatClassName(c.cls), boys: c.boys, girls: c.girls, total: c.total }));

    viewContainer.innerHTML = `
      <div class="card">
        <h3>Effectifs centralisés</h3>
        <p>Données automatiquement agrégées depuis les classes des titulaires.</p>
        <div class="stat-row">
          <div class="stat-box"><strong>${totalStudents}</strong><span>Total élèves</span></div>
          <div class="stat-box"><strong>${totalBoys}</strong><span>Garçons</span></div>
          <div class="stat-box"><strong>${totalGirls}</strong><span>Filles</span></div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Classe</th><th>Garçons</th><th>Filles</th><th>Total</th></tr></thead>
            <tbody>
              ${stats.map((c, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><strong>${esc(formatClassName(c.cls))}</strong></td>
                  <td>${c.boys}</td>
                  <td>${c.girls}</td>
                  <td><strong>${c.total}</strong></td>
                </tr>
              `).join('') || '<tr><td colspan="5">Aucune donnée</td></tr>'}
              <tr style="background:#f8fafc;font-weight:700">
                <td></td><td>Total école</td>
                <td><strong>${totalBoys}</strong></td>
                <td><strong>${totalGirls}</strong></td>
                <td><strong>${totalStudents}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderSubView('ecole');
}