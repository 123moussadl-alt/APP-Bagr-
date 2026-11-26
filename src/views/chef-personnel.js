/**
 * Vue Chef du Personnel — Lecture seule
 * Annuaire complet du personnel (CEB ou par école) + comptages H/F/Total.
 * Colonnes : identité, dates de service, niveau d'étude, emploi, fonction, école, classe et WhatsApp.
 * Pattern : render (HTML) + setup (logique + délégation d'événements)
 */

import { esc, formatClassName } from '../utils/format.js';
import { downloadCSV, printPage, wirePDFExportButton } from '../utils/export.js';
import { openPreview } from '../utils/preview.js';
import { signatureBlockHTML } from '../utils/signature.js';
import { mergeSchoolChoices } from '../utils/schools.js';
import {
  agentMonths, computeAgentMonthlyRows, getAgentEmployment, getAgentFunction, getAgentNameParts,
  getCurrentSchoolYearStart, getSchoolMonthPeriod, mergeAgentAttendanceRecords,
  readLocalAgentRecordsForPeriod
} from '../utils/agents.js';

export function renderChefPersonnel(state, render, supabase) {
  const profile = state.profile;
  if (!profile) return '<div>Chargement...</div>';

  return `
    <div class="role-layout">
      <aside class="role-sidebar">
        <div class="role-brand">
          <strong>Educ CEB</strong>
          <span>Chef du Personnel — ${esc(profile.full_name)}</span>
        </div>
        <nav class="role-nav">
          <button class="nav-item active" data-view="personnel">👥 Personnel de la CEB</button>
          <button class="nav-item" data-view="agent-reports">📊 Bilans mensuels des agents (par école)</button>
        </nav>
        <div class="role-footer">
          <button class="btn-logout" onclick="window.logout()">🚪 Quitter</button>
        </div>
      </aside>

      <div class="role-content">
        <header class="role-topbar">
          <div>
            <h1 id="pageTitle">Personnel de la CEB</h1>
            <p id="pageSubtitle">Annuaire du personnel (lecture seule)</p>
          </div>
          <div class="top-actions">
            <button class="btn" data-action="preview-current">👁 Aperçu</button>
            <button class="btn" data-action="export-personnel">📥 Exporter Excel/CSV</button>
            <button class="btn" data-action="export-pdf">📄 Exporter en PDF</button>
            <button class="btn secondary" data-action="print-personnel">🖨️ Imprimer / PDF</button>
          </div>
        </header>

        <main class="role-main">
          <div id="viewContainer"></div>
        </main>
      </div>
    </div>
  `;
}

function personNames(p) {
  let nom = p.nom || '';
  let prenom = p.prenom || '';
  if (!nom && !prenom && p.full_name) {
    const parts = String(p.full_name).trim().split(/\s+/);
    prenom = parts.shift() || '';
    nom = parts.join(' ');
  }
  return { nom, prenom };
}

function formatProfileDate(value) {
  if (!value) return '—';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
}

export function setupChefPersonnel(container, state, render, supabase) {
  const viewContainer = container.querySelector('#viewContainer');
  const navItems = Array.from(container.querySelectorAll('.nav-item'));
  const pageTitle = container.querySelector('#pageTitle');
  const pageSubtitle = container.querySelector('#pageSubtitle');
  const activeProfile = state.realProfile || state.profile || {};
  const personnelSigners = activeProfile.role === 'chef_personnel' ? [activeProfile] : [];
  let allProfiles = [];
  let allSchools = [];
  let allClasses = [];
  let currentFilter = 'all';
  let activeView = 'personnel';
  const currentFrenchMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date()).toLowerCase();
  let agentReportMonth = agentMonths.find(month => month.toLowerCase() === currentFrenchMonth) || 'Octobre';
  let agentReportSchool = 'all';
  let agentReportRecords = [];
  let agentReportSubmissions = [];
  let agentReportSheets = [];
  const agentSchoolYearStart = getCurrentSchoolYearStart();
  wirePDFExportButton(
    container.querySelector('[data-action="export-pdf"]'),
    () => viewContainer,
    () => `${container.querySelector('#pageTitle')?.textContent || 'Document'}_personnel.pdf`,
    { orientation: 'landscape', format: 'a4', margin: 10 }
  );

  function schoolName(id) {
    const s = allSchools.find(x => x.id === id);
    return s ? s.name : '';
  }

  function classeTenue(p) {
    if (p.role !== 'titulaire' && p.role !== 'directeur') return '—';
    const classRecord = allClasses.find(item => item.id === p.class_id);
    const level = p.classe_tenue || (classRecord && classRecord.level) || '';
    if (!level || level === 'Aucune') return level || '—';
    return formatClassName({ level, name: classRecord && classRecord.name });
  }

  function personnelFunctionLabel(profile) {
    const base = getAgentFunction(profile) || '—';
    if (profile.role === 'directeur') {
      const tenue = profile.classe_tenue || profile.classe_niveau || '';
      return tenue && tenue !== 'Aucune' ? `${base} (Titulaire ${tenue})` : base;
    }
    return base;
  }

  function personnelCounts(rows) {
    return {
      hommes: rows.filter(p => (p.sexe || p.gender) === 'M').length,
      femmes: rows.filter(p => (p.sexe || p.gender) === 'F').length,
      total: rows.length
    };
  }

  function personnelSummaryHTML(counts) {
    return `
      <div class="personnel-summary">
        <span class="hommes">Hommes : ${counts.hommes}</span>
        <span class="femmes">Femmes : ${counts.femmes}</span>
        <span class="total">Total : ${counts.total}</span>
      </div>`;
  }

  function personnelTableHTML(rows) {
    return `
      <div class="personnel-directory-wrap">
        <table class="personnel-directory-table">
          <thead>
            <tr>
              <th>N°</th><th>Matricule</th><th>Nom</th><th>Prénom</th><th>Sexe (M/F)</th>
              <th>Date de naissance</th><th>Niveau d'étude</th><th>Emploi</th><th>Fonction</th>
              <th>Date prise de service CEB</th><th>École</th><th>Classe tenue</th><th>Contact WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((p, i) => {
              const { nom, prenom } = personNames(p);
              const phone = (p.whatsapp || p.whatsapp_phone || '').replace('+', '');
              const link = phone ? `<a href="https://wa.me/${esc(phone)}" target="_blank" rel="noopener">${esc(p.whatsapp || p.whatsapp_phone)}</a>` : '—';
              return `
                <tr>
                  <td>${i + 1}</td>
                  <td>${esc(p.matricule || '—')}</td>
                  <td><strong>${esc(nom)}</strong></td>
                  <td>${esc(prenom)}</td>
                  <td>${(p.sexe || p.gender) === 'M' ? 'M' : ((p.sexe || p.gender) === 'F' ? 'F' : '—')}</td>
                  <td>${esc(formatProfileDate(p.date_naissance))}</td>
                  <td>${esc(p.niveau_etude || '—')}</td>
                  <td>${esc(getAgentEmployment(p))}</td>
                  <td>${personnelFunctionLabel(p)}</td>
                  <td>${esc(formatProfileDate(p.date_prise_service_ceb))}</td>
                  <td>${esc(schoolName(p.school_id) || '—')}</td>
                  <td>${esc(classeTenue(p))}</td>
                  <td>${link}</td>
                </tr>
              `;
            }).join('') || `<tr><td colspan="13">Aucun agent</td></tr>`}
          </tbody>
        </table>
      </div>`;
  }

  async function load() {
    const [p, s, c] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('schools').select('*').order('name'),
      supabase.from('classes').select('*')
    ]);
    allProfiles = p.data || [];
    allSchools = mergeSchoolChoices(s.data || []);
    allClasses = c.data || [];
    renderView('all');
  }

  function renderView(selectedSchool) {
    currentFilter = selectedSchool || 'all';
    const filtered = currentFilter === 'all'
      ? allProfiles
      : allProfiles.filter(p => p.school_id === currentFilter);

    const men = filtered.filter(p => (p.sexe || p.gender) === 'M').length;
    const women = filtered.filter(p => (p.sexe || p.gender) === 'F').length;
    const total = filtered.length;

    const lieuDeTravail = (profile) => {
      const raw = String(profile.lieu_travail || '').trim().toLowerCase();
      if (raw === 'ceb') return 'CEB';
      if (raw === 'ecole') return 'Ecole';
      return (profile.role === 'titulaire' || profile.role === 'directeur') ? 'Ecole' : 'CEB';
    };
    const enseignants = filtered.filter(p => lieuDeTravail(p) === 'Ecole');
    const agents = filtered.filter(p => lieuDeTravail(p) === 'CEB');

    viewContainer.innerHTML = `
      <div class="card">
        <h3>Statistiques du personnel</h3>
        <div class="stat-row">
          <div class="stat-box"><strong>${men}</strong><span>Hommes</span></div>
          <div class="stat-box"><strong>${women}</strong><span>Femmes</span></div>
          <div class="stat-box"><strong>${total}</strong><span>Total</span></div>
        </div>
      </div>

      <div class="card landscape-sheet personnel-directory-sheet wide-sheet" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <h3 style="margin:0">Annuaire du personnel</h3>
          <div class="form-group no-print" style="margin:0;min-width:240px">
            <label>École</label>
            <select id="schoolFilter">
              <option value="all">Toute la CEB</option>
              ${allSchools.map(s => `<option value="${esc(s.id)}" ${currentFilter === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <h4 style="margin:18px 0 6px;font-size:15px">🏢 Agents de bureau de la CEB</h4>
        ${personnelSummaryHTML(personnelCounts(agents))}
        ${personnelTableHTML(agents)}

        <h4 style="margin:24px 0 6px;font-size:15px">🏫 Enseignants &amp; Directeurs des Écoles</h4>
        ${personnelSummaryHTML(personnelCounts(enseignants))}
        ${personnelTableHTML(enseignants)}

        <div style="display:flex;justify-content:flex-end;margin-top:24px">${signatureBlockHTML('Le Chef du Personnel', personnelSigners)}</div>
      </div>
    `;
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      activeView = item.dataset.view;
      pageTitle.textContent = activeView === 'agent-reports'
        ? 'Bilans mensuels des agents (par école)'
        : 'Personnel de la CEB';
      pageSubtitle.textContent = activeView === 'agent-reports'
        ? 'Suivi des dépôts et présences mensuelles'
        : 'Annuaire du personnel (lecture seule)';
      if (activeView === 'agent-reports') renderAgentReports();
      else renderView(currentFilter);
    });
  });

  function exportPersonnelCSV() {
    const filtered = currentFilter === 'all'
      ? allProfiles
      : allProfiles.filter(p => p.school_id === currentFilter);
    const rows = [['N°', 'Matricule', 'Nom', 'Prénom', 'Sexe (M/F)', 'Date de naissance', "Niveau d'étude", 'Emploi', 'Fonction', 'Date prise de service CEB', 'École', 'Classe tenue', 'Contact WhatsApp']];
    filtered.forEach((p, i) => {
      const { nom, prenom } = personNames(p);
      rows.push([
        i + 1,
        p.matricule || '',
        nom,
        prenom,
        (p.sexe || p.gender) === 'M' ? 'M' : ((p.sexe || p.gender) === 'F' ? 'F' : ''),
        p.date_naissance ? formatProfileDate(p.date_naissance) : '',
        p.niveau_etude || '',
        getAgentEmployment(p),
        getAgentFunction(p),
        p.date_prise_service_ceb ? formatProfileDate(p.date_prise_service_ceb) : '',
        schoolName(p.school_id),
        classeTenue(p),
        p.whatsapp || p.whatsapp_phone || ''
      ]);
    });
    downloadCSV('personnel_ceb.csv', rows);
  }

  function renderAgentReports() {
    viewContainer.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:180px">
            <label for="agentReportMonth">Mois</label>
            <select id="agentReportMonth">${agentMonths.map(month =>
              `<option value="${esc(month)}" ${month === agentReportMonth ? 'selected' : ''}>${esc(month)}</option>`
            ).join('')}</select>
          </div>
          <div class="form-group" style="margin:0;min-width:240px">
            <label for="agentReportSchool">École</label>
            <select id="agentReportSchool">
              <option value="all" ${agentReportSchool === 'all' ? 'selected' : ''}>Toute la CEB</option>
              ${allSchools.map(school => `<option value="${esc(school.id)}" ${school.id === agentReportSchool ? 'selected' : ''}>${esc(school.name)}</option>`).join('')}
            </select>
          </div>
          <button type="button" class="btn secondary" data-action="agent-report-preview">Aperçu</button>
          <button type="button" class="btn" id="agent-report-pdf">Exporter en PDF</button>
          <button type="button" class="btn secondary" data-action="agent-report-print">Imprimer</button>
          <button type="button" class="btn secondary" data-action="agent-report-excel">Exporter en Excel</button>
        </div>
        <p id="agentReportLoadStatus" role="status" style="margin:10px 0 0"></p>
      </div>
      <div id="agentReportContent"></div>
    `;
    wirePDFExportButton(
      viewContainer.querySelector('#agent-report-pdf'),
      () => viewContainer.querySelector('#agentReportsDocument'),
      () => `Bilans_agents_CEB_${agentReportMonth}_${agentSchoolYearStart}-${agentSchoolYearStart + 1}.pdf`,
      { orientation: 'landscape', format: 'a4', margin: 10 }
    );
    loadAgentReportData();
  }

  async function loadAgentReportData() {
    const status = viewContainer.querySelector('#agentReportLoadStatus');
    const period = getSchoolMonthPeriod(agentSchoolYearStart, agentReportMonth);
    const selectedSchool = allSchools.find(school => String(school.id) === String(agentReportSchool));
    const selectedSchoolIsFallback = selectedSchool && selectedSchool.isFallback;
    const attendanceQuery = supabase.from('presences_agents').select('*')
      .gte('date_jour', period.start).lte('date_jour', period.end);
    if (agentReportSchool !== 'all' && !selectedSchoolIsFallback) attendanceQuery.eq('ecole_id', agentReportSchool);
    const submissionsQuery = supabase.from('bilans_agents_mensuels').select('*')
      .eq('mois', agentReportMonth)
      .eq('annee_scolaire', `${agentSchoolYearStart}-${agentSchoolYearStart + 1}`);
    if (agentReportSchool !== 'all' && !selectedSchoolIsFallback) submissionsQuery.eq('ecole_id', agentReportSchool);
    const [attendanceResult, submissionsResult] = selectedSchoolIsFallback
      ? [{ data: [], error: null }, { data: [], error: null }]
      : await Promise.all([attendanceQuery, submissionsQuery]);
    const selectedSchools = agentReportSchool === 'all'
      ? allSchools
      : allSchools.filter(school => school.id === agentReportSchool);
    const localRecords = selectedSchools.flatMap(school =>
      readLocalAgentRecordsForPeriod(school.id, period.start, period.end));
    agentReportRecords = mergeAgentAttendanceRecords(attendanceResult.data || [], localRecords);
    agentReportSubmissions = submissionsResult.data || [];
    agentReportSheets = selectedSchools.map(school => {
      const schoolProfiles = allProfiles.filter(profile => profile.school_id === school.id);
      const schoolRecords = agentReportRecords.filter(record => record.ecole_id === school.id);
      const rows = computeAgentMonthlyRows(schoolProfiles, schoolRecords);
      const presences = rows.reduce((total, row) => total + row.presences, 0);
      const absences = rows.reduce((total, row) => total + row.absences, 0);
      return {
        school,
        rows,
        presences,
        absences,
        rate: presences + absences ? Math.round((presences / (presences + absences)) * 1000) / 10 : 0,
        submission: agentReportSubmissions.find(record => record.ecole_id === school.id) || null
      };
    });
    if (status) {
      const errors = [attendanceResult.error, submissionsResult.error].filter(Boolean).map(error => error.message);
      const hasLocal = localRecords.length > 0;
      status.textContent = errors.length
        ? `${hasLocal ? 'Présences locales incluses. ' : ''}Erreur de lecture : ${errors.join(' ; ')}`
        : hasLocal ? 'Les sauvegardes locales sont incluses.' : '';
      status.style.color = errors.length ? (hasLocal ? '#a16207' : '#dc2626') : '#64748b';
    }
    renderAgentReportDocument();
  }

  function renderAgentReportDocument() {
    const target = viewContainer.querySelector('#agentReportContent');
    if (!target) return;
    const schoolSummary = agentReportSheets.map((sheet, index) => `
      <tr>
        <td>${index + 1}</td><td>${esc(sheet.school.name || 'École')}</td>
        <td>${sheet.rows.length}</td><td>${sheet.presences}</td><td>${sheet.absences}</td>
        <td>${sheet.rate.toFixed(1)}%</td>
      </tr>
    `).join('');
    const schoolDetails = agentReportSheets.map(sheet => {
      const submission = sheet.submission;
      const depositStatus = submission
        ? `Déposé par ${submission.directeur_nom || 'Directeur'} le ${new Date(submission.date_depot).toLocaleDateString('fr-FR')}`
        : 'En attente de dépôt';
      const rows = sheet.rows.map(row => {
        const { nom, prenom } = getAgentNameParts(row.agent);
        return `<tr>
          <td>${row.number}</td><td>${esc(row.agent.matricule || row.agent.identifiant || '—')}</td>
          <td>${esc(nom || '—')}</td><td>${esc(prenom || '—')}</td><td>${esc(getAgentEmployment(row.agent))}</td>
          <td>${row.presences}</td><td>${row.absences}</td><td>${row.rate.toFixed(1)}%</td>
          <td>${esc(row.observations || '—')}</td>
        </tr>`;
      }).join('');
      return `<section style="margin-top:24px;break-inside:avoid">
        <h3>${esc(sheet.school.name || 'École')}</h3>
        <p style="color:${submission ? '#16a34a' : '#a16207'};font-weight:700">${esc(depositStatus)}</p>
        <div class="table-wrap"><table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr>${['N°','Matricule','Nom','Prénom','Emploi','Présences','Absences','Taux de présence %','Observations']
            .map(title => `<th style="border:1px solid #334155;padding:6px">${title}</th>`).join('')}</tr></thead>
          <tbody>${rows || '<tr><td colspan="9">Aucun agent inscrit dans cette école.</td></tr>'}</tbody>
        </table></div>
      </section>`;
    }).join('');
    target.innerHTML = `
      <div id="agentReportsDocument" class="card landscape-sheet agent-reports-document wide-sheet" style="margin-top:16px;background:#fff;color:#111">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:center">
          <div><strong>CEB de Bagré</strong><br><strong>Mois : ${esc(agentReportMonth)}</strong></div>
          <div class="official-motto" style="display:flex;flex-direction:column;align-items:center;text-align:center"><strong>Burkina Faso</strong><em>La Patrie ou la Mort, nous vaincrons</em></div>
        </div>
        <h2 style="text-align:center;margin:20px 0">BILAN MENSUEL DE PRÉSENCE DES AGENTS PAR ÉCOLE</h2>
        <p><strong>Année scolaire :</strong> ${agentSchoolYearStart}–${agentSchoolYearStart + 1}</p>
        <h3>Synthèse de la CEB</h3>
        <div class="table-wrap"><table style="width:100%;border-collapse:collapse">
          <thead><tr>${['N°','École','Effectif agents','Présences totales','Absences totales','Taux de présence global %']
            .map(title => `<th style="border:1px solid #334155;padding:7px">${title}</th>`).join('')}</tr></thead>
          <tbody>${schoolSummary || '<tr><td colspan="6">Aucune école trouvée.</td></tr>'}</tbody>
        </table></div>
        ${schoolDetails || '<p>Aucune école disponible.</p>'}
        <div style="display:flex;justify-content:flex-end;margin-top:24px">${signatureBlockHTML('Le Chef du Personnel', personnelSigners)}</div>
      </div>
    `;
  }

  function exportAgentReportsCSV() {
    const rows = [
      ['SYNTHÈSE CEB', 'Mois', agentReportMonth, 'Année scolaire', `${agentSchoolYearStart}-${agentSchoolYearStart + 1}`],
      ['N°', 'École', 'Effectif agents', 'Présences totales', 'Absences totales', 'Taux de présence global %']
    ];
    agentReportSheets.forEach((sheet, index) => {
      rows.push([index + 1, sheet.school.name || '', sheet.rows.length, sheet.presences, sheet.absences, `${sheet.rate.toFixed(1)}%`]);
    });
    agentReportSheets.forEach(sheet => {
      rows.push([]);
      rows.push([sheet.school.name || 'École', sheet.submission
        ? `Déposé par ${sheet.submission.directeur_nom || 'Directeur'} le ${new Date(sheet.submission.date_depot).toLocaleDateString('fr-FR')}`
        : 'En attente de dépôt']);
      rows.push(['N°', 'Matricule', 'Nom', 'Prénom', 'Emploi', 'Présences', 'Absences', 'Taux de présence %', 'Observations']);
      sheet.rows.forEach(row => {
        const { nom, prenom } = getAgentNameParts(row.agent);
        rows.push([
          row.number, row.agent.matricule || row.agent.identifiant || '', nom, prenom,
          getAgentEmployment(row.agent), row.presences, row.absences, `${row.rate.toFixed(1)}%`, row.observations
        ]);
      });
    });
    downloadCSV(`Bilans_agents_CEB_${agentReportMonth}_${agentSchoolYearStart}-${agentSchoolYearStart + 1}.csv`, rows);
  }

  viewContainer.addEventListener('change', (e) => {
    if (e.target.id === 'schoolFilter') renderView(e.target.value);
    else if (e.target.id === 'agentReportMonth') {
      agentReportMonth = e.target.value;
      loadAgentReportData();
    } else if (e.target.id === 'agentReportSchool') {
      agentReportSchool = e.target.value;
      loadAgentReportData();
    }
  });

  viewContainer.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="agent-report-preview"]')) {
      const document = viewContainer.querySelector('#agentReportsDocument');
      if (document) openPreview({
        title: `Bilans mensuels des agents — ${agentReportMonth}`,
        html: document.outerHTML,
        onPrint: printPage,
        onCSV: exportAgentReportsCSV
      });
    } else if (e.target.closest('[data-action="agent-report-print"]')) {
      printPage();
    } else if (e.target.closest('[data-action="agent-report-excel"]')) {
      exportAgentReportsCSV();
    }
  });

  container.querySelector('[data-action="export-personnel"]')?.addEventListener('click', () => {
    if (activeView === 'agent-reports') exportAgentReportsCSV();
    else exportPersonnelCSV();
  });
  container.querySelector('[data-action="print-personnel"]')?.addEventListener('click', printPage);
  container.querySelector('[data-action="preview-current"]')?.addEventListener('click', () => {
    if (activeView === 'agent-reports') {
      const document = viewContainer.querySelector('#agentReportsDocument');
      if (document) openPreview({
        title: `Bilans mensuels des agents — ${agentReportMonth}`,
        html: document.outerHTML,
        onPrint: printPage,
        onCSV: exportAgentReportsCSV
      });
    } else {
      openPreview({ title: 'Liste du personnel', html: viewContainer.innerHTML, onPrint: printPage, onCSV: exportPersonnelCSV });
    }
  });

  load();
}