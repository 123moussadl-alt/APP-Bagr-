/**
 * EDUC CEB BAGRÉ v2 — Point d'entrée principal
 */

import { supabase, isDemoMode, ADMIN_MASTER_EMAIL } from './supabaseClient.js';
import { setupOnlineSync } from './db.js';
import { toInternalEmail } from './supabaseClient.js';
import { defaultSubjects, esc, formatClassName } from './utils/format.js';
import { getAgentFunction, getEmploymentOptions, getRoleFunction, normalizeEmployment } from './utils/agents.js';
import { DEFAULT_SCHOOL_NAMES, mergeSchoolChoices } from './utils/schools.js';
import { DEFAULT_ACTIVE_SCHOOL_YEAR, fetchActiveSchoolYear } from './utils/school-year.js';
import { isSignatureDataUrl, signatureImageHTML, signatureStorageKey, signatureUrlForProfile } from './utils/signature.js';
import {
  buildBackupPack,
  workbookToBlob,
  shareOrDownload,
  lastBackupDate,
  rememberBackupDate
} from './utils/backup.js';

const viewModules = {
  login: () => import('./views/login.js'),
  'admin-login': () => import('./views/login.js'),
  register: () => import('./views/register.js'),
  dashboard: () => import('./views/dashboard.js'),
  titulaire: () => import('./views/titulaire.js'),
  directeur: () => import('./views/directeur.js'),
  encadreur: () => import('./views/encadreur.js'),
  'chef-ceb': () => import('./views/chef-ceb.js'),
  'chef-personnel': () => import('./views/chef-personnel.js'),
  statisticien: () => import('./views/statisticien.js'),
  'responsable-examens': () => import('./views/responsable-examens.js'),
  'admin-principal': () => import('./views/admin-principal.js')
};

const state = {
  user: null,
  profile: null,
  authenticatedAppRole: null,
  activeSchoolYear: DEFAULT_ACTIVE_SCHOOL_YEAR,
  view: 'login',
  schools: [],
  classes: [],
  ecole: null,
  classe: null,
  students: [],
  grades: [],
  examBlancs: []
};

const appRoot = document.getElementById('app');
const toastEl = document.getElementById('toast');

// ---------------------------------------------------------------------------
// Mode démonstration : stockage local des comptes et de la session
// ---------------------------------------------------------------------------
const DEMO_ACCOUNTS_KEY = 'educ_ceb_accounts';
const DEMO_SESSION_KEY = 'educ_ceb_session';

function demoGetAccounts() {
  try {
    const raw = localStorage.getItem(DEMO_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function demoSaveAccounts(list) {
  localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(list));
}

function demoSetSession(userId) {
  localStorage.setItem(DEMO_SESSION_KEY, userId);
}

function demoClearSession() {
  localStorage.removeItem(DEMO_SESSION_KEY);
}

function demoGetSessionUserId() {
  return localStorage.getItem(DEMO_SESSION_KEY);
}

function applyDemoUser(account) {
  const role = 'titulaire';
  state.user = { id: account.id, email: account.email };
  state.authenticatedRole = role;
  state.profile = {
    id: account.id,
    identifiant: account.identifiant,
    full_name: account.fullName,
    nom: account.nom || null,
    prenom: account.prenom || null,
    gender: account.sexe || account.gender || null,
    sexe: account.sexe || account.gender || null,
    matricule: account.matricule || null,
    date_naissance: account.date_naissance || null,
    niveau_etude: account.niveau_etude || null,
    date_prise_service_ceb: account.date_prise_service_ceb || null,
    classe_tenue: account.classeTenue || null,
    classe_niveau: account.classeNiveau || null,
    classe_id: account.classId || null,
    emploi: normalizeEmployment(account.emploi || account.fonction, role) || null,
    fonction: getRoleFunction(role) || null,
    ecole_id: account.schoolId || null,
    ecole_nom: account.schoolName || account.schoolId || null,
    school_id: account.schoolId || null,
    class_id: account.classId || null,
    ecole_id: account.schoolId || null,
    ecole_nom: account.schoolName || null,
    classe_id: account.classId || null,
    ecoles_encadrees: account.ecolesEncadrees || account.followedSchools || [],
    structure: account.structure || (account.schoolName || 'CEB de Bagré'),
    whatsapp_phone: account.whatsapp || account.whatsappPhone,
    whatsapp: account.whatsapp || account.whatsappPhone,
    role,
    school_id: account.schoolId,
    followed_schools: account.ecolesEncadrees || account.followedSchools || []
  };
  state.ecole = account.schoolId ? { id: account.schoolId, name: account.schoolName || account.schoolId } : null;
  state.classe = account.classRecord || null;
  routeToDashboard();
}

async function init() {
  try {
    if (isDemoMode) {
      showToast('Mode démonstration : fonctionnement local sans Supabase');
      const uid = demoGetSessionUserId();
      if (uid) {
        const account = demoGetAccounts().find(a => a.id === uid);
        if (account) {
          applyDemoUser(account);
          return;
        }
        demoClearSession();
      }
      renderLoginView();
      return;
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        state.user = session.user;
        try {
          await loadProfile();
          setupOnlineSync(() => {
            showToast('Modifications hors-ligne synchronisées');
          });
          routeToDashboard();
        } catch (error) {
          console.error('Impossible de charger le compte authentifié :', error);
          showToast('Impossible de charger votre compte. Vérifiez votre connexion ou contactez l’administrateur.');
          renderLoginView();
        }
      } else {
        state.user = null;
        state.profile = null;
        state.authenticatedAppRole = null;
        state.authenticatedRole = null;
        state.activeSchoolYear = DEFAULT_ACTIVE_SCHOOL_YEAR;
        renderLoginView();
      }
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      state.user = session.user;
      await loadProfile();
      setupOnlineSync();
      routeToDashboard();
    } else {
      renderLoginView();
    }
  } catch (err) {
    console.error('Erreur d\'initialisation :', err);
    showToast('Erreur d’initialisation. Vérifiez la connexion et la configuration de la base.');
    try {
      renderLoginView();
    } catch (e) {
      console.error('Erreur rendu login :', e);
      appRoot.innerHTML = '<div style="padding:2rem;color:#dc2626">Erreur de chargement de l\'application. Vérifiez la console.</div>';
    }
  }
}

let presenceInterval = null;

async function touchPresence() {
  if (!state.user || !state.user.id || isDemoMode) return;
  try {
    await supabase.from('profiles').update({ derniere_activite: new Date().toISOString() }).eq('id', state.user.id);
  } catch (error) {
    console.warn('Présence non enregistrée :', error);
  }
}

function startPresenceTracking() {
  if (presenceInterval) return;
  touchPresence();
  presenceInterval = setInterval(touchPresence, 60000);
}

async function loadProfile() {
  if (!state.user) return;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError || new Error('Authenticated user not found.');
  state.user = authData.user;
  state.authenticatedAppRole = authData.user.app_metadata?.role || null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', state.user.id)
    .single();
  if (error) throw error;
  if (data) {
    state.profile = data;
    state.authenticatedRole = data.role;
  }
  state.activeSchoolYear = await fetchActiveSchoolYear(supabase);
  startPresenceTracking();
}

function routeToDashboard() {
  if (!state.profile) return;
  if (isAdminEntryRequested()) {
    state.view = isPrincipalAdmin() ? 'admin-principal' : 'admin-login';
    render();
    return;
  }
  if (state.isDualDirector === undefined) {
    state.isDualDirector = (state.profile.role === 'directeur' && !!(state.profile.class_id || state.profile.classe_id));
  }
  switch (state.profile.role) {
    case 'titulaire': state.view = 'titulaire'; break;
    case 'directeur': state.view = 'directeur'; break;
    case 'encadreur': state.view = 'encadreur'; break;
    case 'chef_ceb': state.view = 'chef-ceb'; break;
    case 'chef_personnel': state.view = 'chef-personnel'; break;
    case 'statisticien': state.view = 'statisticien'; break;
    case 'responsable_examens': state.view = 'responsable-examens'; break;
    default: state.view = 'dashboard';
  }
  render();
}

window.switchToClasseMode = () => {
  if (!state.profile || (state.authenticatedRole !== 'directeur' && !state.preview)) return;
  state.profile = { ...state.profile, role: 'titulaire' };
  state.view = 'titulaire';
  render();
};

window.switchToDirectionMode = () => {
  if (!state.profile || (state.authenticatedRole !== 'directeur' && !state.preview)) return;
  state.profile = { ...state.profile, role: 'directeur' };
  state.view = 'directeur';
  render();
};

function showToast(msg, duration = 3000) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

function friendlyError(err, fallback) {
  const msg = (err && err.message) || '';
  if (/failed to fetch|networkerror|network error|load failed|err_internet|fetch/i.test(msg)) {
    return 'Impossible de joindre le serveur Supabase. Vérifiez que le projet est actif et que l\'URL (.supabase.co) est correcte.';
  }
  return msg || fallback;
}

const viewExports = {
  titulaire: 'Titulaire',
  directeur: 'Directeur',
  encadreur: 'Encadreur',
  'chef-ceb': 'ChefCEB',
  'chef-personnel': 'ChefPersonnel',
  statisticien: 'Statisticien',
  'responsable-examens': 'ResponsableExamens',
  'admin-principal': 'AdminPrincipal'
};

function render() {
  if (!appRoot) return;
  if (state.profile && state.profile.est_actif === false && state.authenticatedAppRole !== 'super_admin' && !state.preview) {
    appRoot.innerHTML = `
      <div style="max-width:640px;margin:60px auto;padding:32px;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.12);text-align:center;font-family:inherit">
        <div style="font-size:42px;margin-bottom:10px">⏳</div>
        <h2 style="margin:0 0 10px">Compte en attente d'autorisation</h2>
        <p style="color:#475569;margin:0 0 22px">Compte en attente d'autorisation par l'Administrateur Principal de la CEB de Bagré</p>
        <button type="button" class="btn" onclick="window.logout()">Se déconnecter</button>
      </div>`;
    return;
  }
  if (isPrincipalAdmin()) initPreviewBar();
  else removePreviewBar();
  initSettings();
  appRoot.innerHTML = '';

  if (state.view === 'admin-principal' && !isPrincipalAdmin()) {
    state.view = 'dashboard';
    showToast('Accès réservé à l’Administrateur Principal.');
  }

  const view = state.view;
  const loader = viewModules[view];
  if (!loader) return;

  loader().then(module => {
    if (view === 'login' || view === 'admin-login' || view === 'register') {
      const isLoginView = view === 'login' || view === 'admin-login';
      const renderFn = view === 'register'
        ? module.renderRegister
        : view === 'admin-login'
          ? module.renderAdminLogin
          : module.renderLogin;
      const setupFn = isLoginView ? module.setupLogin : module.setupRegister;
      if (!renderFn) return;
      if (isLoginView) {
        const handlers = {
          onRegister: () => { state.view = 'register'; render(); },
          onLogin: handleLogin,
          onInstall: installPWA
        };
        appRoot.innerHTML = renderFn(handlers);
        if (setupFn) setupFn(appRoot, handlers);
      } else {
        const handlers = {
          onLogin: () => { state.view = 'login'; render(); },
          onRegister: handleRegister
        };
        appRoot.innerHTML = renderFn(handlers);
        if (setupFn) setupFn(appRoot, handlers);
      }
      return;
    }

    if (view === 'dashboard') {
      appRoot.innerHTML = module.renderDashboard(state, render);
      mountSettingsButton();
      return;
    }

    const suffix = viewExports[view] || '';
    const renderFn = module[`render${suffix}`] || module.default;
    if (!renderFn) return;
    appRoot.innerHTML = renderFn(state, render, supabase);
    mountSettingsButton();

    const setupFn = module[`setup${suffix}`];
    if (setupFn) setupFn(appRoot, state, render, supabase);
  }).catch(err => {
    console.error('Erreur de rendu de la vue :', err);
    appRoot.innerHTML = '<div style="padding:2rem;color:#dc2626">Erreur de chargement de la vue. Vérifiez la console.</div>';
  });
}

// ---------------------------------------------------------------------------
// Paramètres d'affichage (thème, arrière-plan, confort)
// ---------------------------------------------------------------------------
const SETTINGS_KEY = 'educ_ceb_settings';
const ENCADREUR_SCHOOLS_STORAGE_PREFIX = 'educ_ceb_ecoles_encadrees_';

function parseSchoolIdList(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (error) {
    console.warn('Liste des écoles encadrées invalide.', error);
    return [];
  }
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next || {}));
}

function applySettings() {
  const s = loadSettings();
  document.body.classList.remove('bg-white', 'bg-sky', 'bg-mint', 'bg-dark', 'comfortable');
  const bg = s.bg || '';
  if (bg) document.body.classList.add('bg-' + bg);
  if (s.size === 'comfortable') document.body.classList.add('comfortable');
}

async function openBackupModal() {
  const existing = document.getElementById('backupOverlay');
  if (existing) { existing.remove(); return; }
  const overlay = document.createElement('div');
  overlay.id = 'backupOverlay';
  overlay.innerHTML = `
    <div id="backupModal">
      <h3>☁️ Sauvegarder mes données</h3>
      <p style="color:#475569">Générez un classeur Excel (.xlsx) de vos données, puis enregistrez-le dans Google Drive.</p>
      <p id="backupModalStatus" role="status" aria-live="polite"></p>
      <div class="settings-actions">
        <button type="button" class="btn" id="backupModalBtn">☁️ Générer et sauvegarder mon pack sur Google Drive</button>
        <a class="btn secondary" href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener">📂 Ouvrir Google Drive</a>
        <button type="button" class="btn secondary" id="backupModalClose">Fermer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const status = overlay.querySelector('#backupModalStatus');
  const userId = state.user && state.user.id ? state.user.id : ((state.profile || {}).id || '');
  const last = lastBackupDate(userId);
  status.textContent = last
    ? `Dernière sauvegarde : ${new Date(last).toLocaleString('fr-FR')}`
    : 'Aucune sauvegarde enregistrée.';
  overlay.querySelector('#backupModalClose')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove(); });
  overlay.querySelector('#backupModalBtn')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    status.textContent = 'Génération du pack…';
    status.style.color = '#475569';
    try {
      const { workbook, filename } = await buildBackupPack(state, supabase);
      const blob = workbookToBlob(workbook);
      const outcome = await shareOrDownload(blob, filename);
      rememberBackupDate(userId);
      status.textContent = outcome === 'shared'
        ? 'Pack généré — choisissez « Enregistrer dans Drive ».'
        : (outcome === 'cancelled' ? 'Partage annulé.' : `Sauvegarde téléchargée : ${filename}`);
      status.style.color = '#15803d';
    } catch (error) {
      status.textContent = 'Erreur : ' + (error && error.message ? error.message : String(error));
      status.style.color = '#dc2626';
    } finally {
      button.disabled = false;
    }
  });
}

async function openSettings() {
  const existing = document.getElementById('settingsOverlay');
  if (existing) { existing.remove(); return; }
  const s = loadSettings();
  const profile = state.realProfile || state.profile || {};
  const nameParts = String(profile.full_name || '').trim().split(/\s+/);
  const nom = profile.nom || nameParts.slice(1).join(' ');
  const prenom = profile.prenom || nameParts[0] || '';
  const levelOptions = ['BEPC', 'BAC', 'Licence', 'Master', 'Doctorat', 'Autre'];
  const profileRole = state.isDualDirector && profile.role === 'titulaire' ? 'directeur' : profile.role;
  const emploiOptions = getEmploymentOptions(profileRole);
  const classOptions = ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'];
  const isSchoolRole = profileRole === 'titulaire' || profileRole === 'directeur';
  const isEncadreur = profileRole === 'encadreur';
  const isDistrictRole = ['chef_ceb', 'chef_personnel', 'chef-personnel', 'statisticien'].includes(profileRole);
  const canAssignClass = isSchoolRole;
  const isSuperAdminSettings = state.authenticatedAppRole === 'super_admin' || profile.role === 'super_admin';
  let schools = mergeSchoolChoices();
  let schoolsError = null;
  if (isDemoMode) {
    const demoSchoolNames = [...new Set([
      ...DEFAULT_SCHOOL_NAMES,
      ...demoGetAccounts().map(account => account.schoolId).filter(Boolean)
    ])];
    schools = mergeSchoolChoices(demoSchoolNames.map(name => ({ id: name, name })));
  } else {
    try {
      const result = await supabase.from('schools').select('id,name,ceb').order('name');
      schools = mergeSchoolChoices(result.data || []);
      schoolsError = result.error;
    } catch (error) {
      schoolsError = error;
    }
  }
  const profileSchoolId = profile.ecole_id || profile.school_id || '';
  let savedSignature = signatureUrlForProfile(profile);
  const currentClass = profile.classe_niveau || profile.classe_tenue || '';
  let savedEncadreeIds = parseSchoolIdList(profile.ecoles_encadrees);
  if (!savedEncadreeIds.length) savedEncadreeIds = parseSchoolIdList(profile.followed_schools);
  if (!savedEncadreeIds.length && profile.id) {
    try {
      savedEncadreeIds = parseSchoolIdList(localStorage.getItem(ENCADREUR_SCHOOLS_STORAGE_PREFIX + profile.id));
    } catch (error) {
      console.warn('Impossible de lire les écoles encadrées en local.', error);
    }
  }
  const currentLevelMissing = profile.niveau_etude && !levelOptions.includes(profile.niveau_etude);
  const currentEmploi = normalizeEmployment(profile.emploi || profile.fonction, profileRole) ||
    (emploiOptions.length === 1 ? emploiOptions[0].value : '');
  const currentFonction = getAgentFunction({ ...profile, role: profileRole });
  const overlay = document.createElement('div');
  overlay.id = 'settingsOverlay';
  overlay.innerHTML = `
    <div id="settingsModal">
      <h3>⚙️ Paramètres</h3>
      ${isSuperAdminSettings ? `
      <section class="settings-section">
        <h4>Gestion de l'Année Scolaire</h4>
        <div class="settings-profile-grid">
          <div class="form-group">
            <label for="settingsSchoolYearSelect">Année scolaire</label>
            <select id="settingsSchoolYearSelect">
              <option value="2025-2026">2025-2026</option>
              <option value="2026-2027">2026-2027</option>
              <option value="2027-2028">2027-2028</option>
              <option value="2028-2029">2028-2029</option>
              <option value="2029-2030">2029-2030</option>
              <option value="__custom__">Autre / Saisir une nouvelle année...</option>
            </select>
          </div>
          <div class="form-group">
            <label for="settingsSchoolYearCustom">Nouvelle année (AAAA-AAAA)</label>
            <input id="settingsSchoolYearCustom" type="text" inputmode="numeric" placeholder="Ex: 2026-2027">
          </div>
        </div>
        <div class="settings-actions"><button type="button" class="btn" id="settingsSchoolYearSave">💾 Enregistrer et activer l'année</button></div>
        <p id="settingsSchoolYearStatus" role="status" aria-live="polite"></p>
      </section>
      <section class="settings-section">
        <h4>Gestion & Autorisation des Comptes Utilisateurs</h4>
        <p style="color:#475569">Donnez l'accès (« ✅ Donner accès ») ou bloquez (« ⛔ Bloquer ») un compte utilisateur depuis le panneau Administrateur Principal.</p>
        <div class="settings-actions"><button type="button" class="btn" id="settingsOpenAdminAccounts">👥 Gérer les comptes utilisateurs</button></div>
      </section>` : `
      <section class="settings-section">
        <h4>Mes paramètres</h4>
        <div class="settings-profile-grid">
          <div class="form-group"><label for="settingsMatricule">Matricule</label><input id="settingsMatricule" value="${esc(profile.matricule || '')}"></div>
          <div class="form-group"><label for="settingsNom">Nom</label><input id="settingsNom" required value="${esc(nom)}"></div>
          <div class="form-group"><label for="settingsPrenom">Prénom</label><input id="settingsPrenom" required value="${esc(prenom)}"></div>
          <div class="form-group"><label for="settingsSexe">Sexe</label><select id="settingsSexe"><option value="">-- Choisir --</option><option value="M">M</option><option value="F">F</option></select></div>
          <div class="form-group"><label for="settingsBirth">Date de naissance</label><input id="settingsBirth" type="date" value="${esc(profile.date_naissance || '')}"></div>
          <div class="form-group"><label for="settingsStudy">Niveau d'étude</label><select id="settingsStudy"><option value="">-- Choisir --</option>${currentLevelMissing ? `<option value="${esc(profile.niveau_etude)}">${esc(profile.niveau_etude)}</option>` : ''}${levelOptions.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></div>
          <div class="form-group"><label for="settingsEmploi">Emploi</label><select id="settingsEmploi" required><option value="">-- Choisir --</option>${emploiOptions.map(option => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join('')}</select></div>
          <div class="form-group"><label for="settingsFunction">Fonction</label><input id="settingsFunction" value="${esc(currentFonction)}" readonly aria-readonly="true"><small>La fonction détermine les accès et ne peut pas être modifiée depuis ce profil.</small></div>
          <div class="form-group"><label for="settingsServiceDate">Date de prise de service à la CEB</label><input id="settingsServiceDate" type="date" value="${esc(profile.date_prise_service_ceb || '')}"></div>
          ${isSchoolRole ? `<div class="form-group"><label for="settingsSchool">École</label><select id="settingsSchool"><option value="">-- Choisir --</option>${schools.map(school => `<option value="${esc(school.id)}">${esc(school.name)}</option>`).join('')}</select></div>` : ''}
          ${canAssignClass ? `<div class="form-group"><label for="settingsClass">Classe tenue</label><select id="settingsClass" required><option value="">-- Choisir --</option>${classOptions.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></div>` : ''}
          ${isEncadreur ? `<div class="form-group" style="grid-column:1/-1"><label>Écoles encadrées / Zone d'encadrement</label><div id="settingsEncadreeSchools" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px">${schools.map(school => `<label style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff"><input type="checkbox" name="settingsEncadreeSchool" value="${esc(school.id)}" ${savedEncadreeIds.includes(String(school.id)) ? 'checked' : ''}><span>${esc(school.name)}</span></label>`).join('')}</div></div>` : ''}
          ${isDistrictRole ? `<div class="form-group"><label for="settingsStructure">Structure</label><input id="settingsStructure" value="CEB de Bagré" readonly></div>` : ''}
          <div class="form-group"><label for="settingsWhatsApp">Contact WhatsApp</label><input id="settingsWhatsApp" type="tel" value="${esc(profile.whatsapp || profile.whatsapp_phone || '')}"></div>
          <div class="form-group settings-signature-field">
            <label>Signature</label>
            <div id="settingsSignaturePreview">${savedSignature ? signatureImageHTML(savedSignature, 'Signature enregistrée') : '<span class="signature-empty">Aucune signature enregistrée</span>'}</div>
            <button type="button" class="btn secondary" id="settingsSignatureOpen">Signer / Modifier ma signature</button>
          </div>
        </div>
        <p id="settingsProfileStatus" role="status" aria-live="polite"></p>
        <div class="settings-actions"><button class="btn" id="settingsProfileSave">Enregistrer mes paramètres</button></div>
      </section>`}
      <section class="settings-section">
        <h4>Options</h4>
        <div class="settings-profile-grid">
          <div class="form-group">
            <label for="setBg">Arrière-plan</label>
            <select id="setBg">
              <option value="">Dégradé vert-bleu (défaut)</option>
              <option value="white">Blanc</option>
              <option value="sky">Bleu ciel</option>
              <option value="mint">Vert menthe</option>
              <option value="dark">Sombre</option>
            </select>
          </div>
          <div class="form-group">
            <label for="setSize">Confort d'affichage</label>
            <select id="setSize">
              <option value="">Standard</option>
              <option value="comfortable">Confortable (texte plus grand)</option>
            </select>
          </div>
        </div>
        <div class="settings-actions"><button class="btn" id="setSave">Enregistrer l'apparence</button><button type="button" class="btn secondary" id="settingsInstallApp">📲 Installer l'application</button></div>
      </section>
      <section class="settings-section">
        <h4>☁️ Sauvegarde de mes données</h4>
        <p style="color:#475569">Générez un classeur Excel (.xlsx) de vos données puis enregistrez-le dans Google Drive.</p>
        <div class="settings-actions">
          <button type="button" class="btn" id="settingsBackupBtn">☁️ Générer et sauvegarder mon pack sur Google Drive</button>
          <a class="btn secondary" href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener">📂 Ouvrir Google Drive</a>
        </div>
        <p id="settingsBackupStatus" role="status" aria-live="polite"></p>
      </section>
      <div class="settings-actions">
        <button class="btn secondary" id="setClose">Fermer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const bgSel = overlay.querySelector('#setBg');
  const sizeSel = overlay.querySelector('#setSize');
  const sexeSel = overlay.querySelector('#settingsSexe');
  const studySel = overlay.querySelector('#settingsStudy');
  const emploiSel = overlay.querySelector('#settingsEmploi');
  const schoolSel = overlay.querySelector('#settingsSchool');
  const classSel = overlay.querySelector('#settingsClass');
  if (bgSel) bgSel.value = s.bg || '';
  if (sizeSel) sizeSel.value = s.size || '';
  if (sexeSel) sexeSel.value = profile.sexe || profile.gender || '';
  if (studySel) studySel.value = profile.niveau_etude || '';
  if (emploiSel) emploiSel.value = currentEmploi;
  if (schoolSel) schoolSel.value = profileSchoolId;
  if (classSel) classSel.value = currentClass;
  const status = overlay.querySelector('#settingsProfileStatus');
  if (schoolsError && status) {
    status.textContent = 'Impossible de charger la liste des écoles : ' + schoolsError.message;
    status.style.color = '#dc2626';
  }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#setClose')?.addEventListener('click', () => overlay.remove());
  const openAccountsPanel = () => {
    overlay.remove();
    if (!isPrincipalAdmin()) { showToast('Accès réservé à l’Administrateur Principal.'); return; }
    openAdminPrincipal();
    setTimeout(() => {
      const card = document.getElementById('accountsCard') || document.getElementById('adminAccounts');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  };
  overlay.querySelector('#settingsOpenAdmin')?.addEventListener('click', openAccountsPanel);
  overlay.querySelector('#settingsOpenAdminAccounts')?.addEventListener('click', openAccountsPanel);

  const settingsSchoolYearSelect = overlay.querySelector('#settingsSchoolYearSelect');
  const settingsSchoolYearCustom = overlay.querySelector('#settingsSchoolYearCustom');
  const settingsSchoolYearSave = overlay.querySelector('#settingsSchoolYearSave');
  const settingsSchoolYearStatus = overlay.querySelector('#settingsSchoolYearStatus');
  const syncSettingsSchoolYearCustom = () => {
    const isCustom = settingsSchoolYearSelect && settingsSchoolYearSelect.value === '__custom__';
    if (settingsSchoolYearCustom) {
      settingsSchoolYearCustom.style.display = isCustom ? '' : 'none';
      settingsSchoolYearCustom.required = !!isCustom;
    }
  };
  if (settingsSchoolYearSelect) {
    const activeYear = state.activeSchoolYear || DEFAULT_ACTIVE_SCHOOL_YEAR;
    const exists = Array.from(settingsSchoolYearSelect.options).some(option => option.value === activeYear);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = activeYear;
      opt.textContent = activeYear;
      settingsSchoolYearSelect.insertBefore(opt, settingsSchoolYearSelect.querySelector('option[value="__custom__"]'));
    }
    settingsSchoolYearSelect.value = activeYear;
    settingsSchoolYearSelect.addEventListener('change', syncSettingsSchoolYearCustom);
  }
  syncSettingsSchoolYearCustom();
  if (settingsSchoolYearSave) {
    settingsSchoolYearSave.addEventListener('click', async () => {
      const year = settingsSchoolYearSelect && settingsSchoolYearSelect.value === '__custom__'
        ? (settingsSchoolYearCustom ? settingsSchoolYearCustom.value.trim() : '')
        : (settingsSchoolYearSelect ? settingsSchoolYearSelect.value : '');
      if (!/^\d{4}-\d{4}$/.test(year)) {
        if (settingsSchoolYearStatus) { settingsSchoolYearStatus.textContent = 'Format attendu : AAAA-AAAA (ex. 2026-2027).'; settingsSchoolYearStatus.style.color = '#b91c1c'; }
        return;
      }
      settingsSchoolYearSave.disabled = true;
      const { data, error } = await supabase.rpc('admin_set_school_year', { p_year: year });
      if (error) {
        if (settingsSchoolYearStatus) { settingsSchoolYearStatus.textContent = `Échec : ${error.message}`; settingsSchoolYearStatus.style.color = '#b91c1c'; }
        settingsSchoolYearSave.disabled = false;
        return;
      }
      const activeYear = data || year;
      state.activeSchoolYear = activeYear;
      try { localStorage.setItem('educ_ceb_active_school_year', activeYear); } catch (e) {}
      try {
        const { error: anneesError } = await supabase.from('annees_scolaires').upsert({ year: activeYear, is_active: true }, { onConflict: 'year' });
        if (anneesError) console.warn('annees_scolaires indisponible :', anneesError.message);
      } catch (e) { console.warn(e); }
      if (settingsSchoolYearStatus) { settingsSchoolYearStatus.textContent = `Année active : ${activeYear}`; settingsSchoolYearStatus.style.color = '#15803d'; }
      settingsSchoolYearSave.disabled = false;
      if (settingsSchoolYearSelect) {
        const exists2 = Array.from(settingsSchoolYearSelect.options).some(option => option.value === activeYear);
        if (!exists2) {
          const opt = document.createElement('option');
          opt.value = activeYear;
          opt.textContent = activeYear;
          settingsSchoolYearSelect.insertBefore(opt, settingsSchoolYearSelect.querySelector('option[value="__custom__"]'));
        }
        settingsSchoolYearSelect.value = activeYear;
        syncSettingsSchoolYearCustom();
      }
      showToast('Année scolaire activée : ' + activeYear);
    });
  }

  overlay.querySelector('#settingsSignatureOpen')?.addEventListener('click', () => {
    const signatureOverlay = document.createElement('div');
    signatureOverlay.id = 'signatureModalOverlay';
    signatureOverlay.innerHTML = `
      <section id="signatureModal" role="dialog" aria-modal="true" aria-labelledby="signatureModalTitle">
        <div class="signature-modal-heading">
          <div>
            <h4 id="signatureModalTitle">Ma signature</h4>
            <p>Signez dans la zone blanche avec votre doigt ou votre souris.</p>
          </div>
          <button type="button" class="signature-close" aria-label="Fermer">×</button>
        </div>
        <div class="signature-pad-shell">
          <canvas id="signatureCanvas" class="signature-canvas" aria-label="Zone de signature tactile"></canvas>
        </div>
        <p id="signatureSaveStatus" role="status" aria-live="polite"></p>
        <div class="signature-modal-actions">
          <button type="button" class="btn secondary" id="signatureClear">Effacer</button>
          <button type="button" class="btn" id="signatureValidate">Valider la signature</button>
        </div>
      </section>`;
    overlay.appendChild(signatureOverlay);
    const canvas = signatureOverlay.querySelector('#signatureCanvas');
    const context = canvas.getContext('2d');
    const canvasRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * canvasRatio);
    canvas.height = Math.round(rect.height * canvasRatio);
    context.scale(canvasRatio, canvasRatio);
    context.lineWidth = 2.4;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#111827';
    let drawing = false;
    let hasInk = false;
    const pointFrom = (x, y) => {
      const bounds = canvas.getBoundingClientRect();
      return { x: x - bounds.left, y: y - bounds.top };
    };
    const beginAt = (point) => {
      drawing = true;
      context.beginPath();
      context.moveTo(point.x, point.y);
    };
    const drawAt = (point) => {
      if (!drawing) return;
      context.lineTo(point.x, point.y);
      context.stroke();
      hasInk = true;
    };
    const endDrawing = () => { drawing = false; };
    canvas.addEventListener('mousedown', event => beginAt(pointFrom(event.clientX, event.clientY)));
    canvas.addEventListener('mousemove', event => drawAt(pointFrom(event.clientX, event.clientY)));
    canvas.addEventListener('mouseup', endDrawing);
    canvas.addEventListener('mouseleave', endDrawing);
    canvas.addEventListener('touchstart', event => {
      event.preventDefault();
      const touch = event.changedTouches[0];
      beginAt(pointFrom(touch.clientX, touch.clientY));
    }, { passive: false });
    canvas.addEventListener('touchmove', event => {
      event.preventDefault();
      const touch = event.changedTouches[0];
      drawAt(pointFrom(touch.clientX, touch.clientY));
    }, { passive: false });
    canvas.addEventListener('touchend', event => {
      event.preventDefault();
      endDrawing();
    }, { passive: false });
    canvas.addEventListener('touchcancel', endDrawing);

    signatureOverlay.querySelector('.signature-close').addEventListener('click', () => signatureOverlay.remove());
    signatureOverlay.addEventListener('click', event => {
      if (event.target === signatureOverlay) signatureOverlay.remove();
    });
    signatureOverlay.querySelector('#signatureClear').addEventListener('click', () => {
      context.clearRect(0, 0, rect.width, rect.height);
      hasInk = false;
    });
    signatureOverlay.querySelector('#signatureValidate').addEventListener('click', async event => {
      const validateButton = event.currentTarget;
      const signatureStatus = signatureOverlay.querySelector('#signatureSaveStatus');
      if (!hasInk) {
        signatureStatus.textContent = 'Veuillez signer avant de valider.';
        signatureStatus.style.color = '#dc2626';
        return;
      }
      const userId = state.user && state.user.id ? state.user.id : profile.id;
      if (!userId) {
        signatureStatus.textContent = 'Identifiant utilisateur introuvable.';
        signatureStatus.style.color = '#dc2626';
        return;
      }
      validateButton.disabled = true;
      signatureStatus.textContent = 'Enregistrement de la signature…';
      signatureStatus.style.color = '#475569';
      try {
        const signatureUrl = canvas.toDataURL('image/png');
        if (!isSignatureDataUrl(signatureUrl)) throw new Error('La signature générée est invalide.');
        if (isDemoMode) {
          const accounts = demoGetAccounts();
          const accountIndex = accounts.findIndex(item => item.id === userId);
          if (accountIndex < 0) throw new Error('Profil local introuvable.');
          accounts[accountIndex] = { ...accounts[accountIndex], signature_url: signatureUrl };
          demoSaveAccounts(accounts);
        } else {
          const { data: existingProfile, error: lookupError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();
          if (lookupError) throw lookupError;
          if (existingProfile) {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ signature_url: signatureUrl })
              .eq('id', userId);
            if (updateError) throw updateError;
          } else {
            if (!profile.role) throw new Error('Le rôle du profil est manquant.');
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                role: profile.role,
                identifiant: profile.identifiant || (state.user && state.user.email) || userId,
                signature_url: signatureUrl
              });
            if (insertError) throw insertError;
          }
        }
        localStorage.setItem(signatureStorageKey(userId), signatureUrl);
        savedSignature = signatureUrl;
        if (state.realProfile && state.realProfile.id === userId) {
          state.realProfile = { ...state.realProfile, signature_url: signatureUrl };
        }
        if (state.profile && state.profile.id === userId) {
          state.profile = { ...state.profile, signature_url: signatureUrl };
        }
        if (state.preview && state.profile) state.preview = { ...state.preview, signature_url: signatureUrl };
        const preview = overlay.querySelector('#settingsSignaturePreview');
        preview.innerHTML = signatureImageHTML(signatureUrl, 'Signature enregistrée');
        signatureStatus.textContent = 'Signature enregistrée.';
        signatureStatus.style.color = '#15803d';
        showToast('Signature enregistrée.');
        signatureOverlay.remove();
        render();
      } catch (error) {
        console.error('Impossible d’enregistrer la signature.', error);
        signatureStatus.textContent = error && error.message ? error.message : String(error);
        signatureStatus.style.color = '#dc2626';
      } finally {
        validateButton.disabled = false;
      }
    });
  });
  overlay.querySelector('#settingsProfileSave')?.addEventListener('click', async (event) => {
    const saveButton = event.currentTarget;
    if (isEncadreur && schoolsError) {
      status.textContent = 'Impossible d’enregistrer les écoles encadrées car la liste est indisponible : ' + (schoolsError.message || schoolsError);
      status.style.color = '#dc2626';
      return;
    }
    const nomValue = overlay.querySelector('#settingsNom').value.trim();
    const prenomValue = overlay.querySelector('#settingsPrenom').value.trim();
    const sexeValue = sexeSel.value;
    const emploiValue = normalizeEmployment(emploiSel.value, profileRole);
    if (!nomValue || !prenomValue || !['M', 'F'].includes(sexeValue) || !emploiValue || (canAssignClass && !classSel.value)) {
      status.textContent = 'Veuillez renseigner le nom, le prénom, le sexe, un emploi valide et la classe tenue si nécessaire.';
      status.style.color = '#dc2626';
      return;
    }
    const userId = state.user && state.user.id ? state.user.id : profile.id;
    if (!userId) {
      status.textContent = 'Identifiant utilisateur introuvable.';
      status.style.color = '#dc2626';
      return;
    }
    const whatsappValue = overlay.querySelector('#settingsWhatsApp').value.trim();
    let schoolId = isSchoolRole && schoolSel ? (schoolSel.value || null) : null;
    let school = schools.find(item => String(item.id) === String(schoolId)) || null;
    const classLevel = classSel ? (classSel.value || null) : null;
    const shouldLinkClass = canAssignClass && !!classLevel && classLevel !== 'Aucune';
    const directorProfile = profile.role === 'directeur' || !!state.isDualDirector;
    let ecolesEncadrees = isEncadreur
      ? Array.from(overlay.querySelectorAll('input[name="settingsEncadreeSchool"]:checked')).map(input => input.value)
      : [];
    saveButton.disabled = true;
    status.textContent = 'Enregistrement de vos paramètres…';
    status.style.color = '#475569';
    try {
      if (!isDemoMode) {
        if (school && school.isFallback) schoolId = await ensureSchoolId(school.name);
        if (isEncadreur) {
          ecolesEncadrees = await Promise.all(ecolesEncadrees.map(async value => {
            const selectedSchool = schools.find(item => String(item.id) === String(value));
            return selectedSchool && selectedSchool.isFallback
              ? ensureSchoolId(selectedSchool.name)
              : value;
          }));
        }
      }
      school = schools.find(item => String(item.id) === String(schoolId)) || school;
      const structure = isDistrictRole || isEncadreur
        ? 'CEB de Bagré'
        : (school ? school.name : null);
      if (shouldLinkClass && !schoolId) {
        throw new Error('Choisissez une école avant d’affecter une classe.');
      }

      let linkedClass = null;
      let classId = null;
      if (shouldLinkClass) {
        if (isDemoMode) {
          const accounts = demoGetAccounts();
          const account = accounts.find(item => item.id === userId);
          const previousClass = account && account.classRecord;
          linkedClass = previousClass && previousClass.school_id === schoolId && previousClass.level === classLevel
            ? previousClass
            : {
              id: `demo-class-${schoolId}-${classLevel}`,
              name: classLevel,
              level: classLevel,
              school_id: schoolId,
              titulaire_id: userId,
              titulaire_nom: `${nomValue} ${prenomValue}`.trim(),
              co_titulaires: [userId],
              subjects: defaultSubjects(classLevel)
            };
        } else {
          const { data: existingClass, error: classLookupError } = await supabase
            .from('classes')
            .select('*')
            .eq('school_id', schoolId)
            .eq('level', classLevel)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (classLookupError) throw classLookupError;

          if (existingClass) {
            const coTeachers = Array.isArray(existingClass.co_titulaires) ? existingClass.co_titulaires : [];
            const updatedCoTeachers = coTeachers.includes(userId) ? coTeachers : [...coTeachers, userId];
            const { error: classUpdateError } = await supabase
              .from('classes')
              .update({ co_titulaires: updatedCoTeachers })
              .eq('id', existingClass.id);
            if (classUpdateError) throw classUpdateError;
            linkedClass = { ...existingClass, co_titulaires: updatedCoTeachers };
          } else {
            const { data: createdClass, error: classInsertError } = await supabase
              .from('classes')
              .insert({
                name: classLevel,
                level: classLevel,
                school_id: schoolId,
                titulaire_id: userId,
                titulaire_nom: `${nomValue} ${prenomValue}`.trim(),
                co_titulaires: [userId],
                year: state.activeSchoolYear || '2026-2027',
                subjects: defaultSubjects(classLevel)
              })
              .select('*')
              .single();
            if (classInsertError) throw classInsertError;
            linkedClass = createdClass;
          }

        }
        classId = linkedClass.id;
      }

      const fullName = `${prenomValue} ${nomValue}`.trim();
      const nomComplet = `${nomValue} ${prenomValue}`.trim();
      const classTenue = canAssignClass ? classLevel : null;
      const classNiveau = canAssignClass && classLevel ? classLevel : null;
      const legacyPhone = whatsappValue || profile.whatsapp_phone || '';
      const profilePayload = {
        matricule: overlay.querySelector('#settingsMatricule').value.trim() || null,
        nom: nomValue,
        prenom: prenomValue,
        nom_complet: nomComplet,
        sexe: sexeValue,
        date_naissance: overlay.querySelector('#settingsBirth').value || null,
        niveau_etude: studySel.value || null,
        emploi: emploiValue,
        fonction: currentFonction,
        date_prise_service_ceb: overlay.querySelector('#settingsServiceDate').value || null,
        ecole_id: schoolId,
        ecole_nom: school ? school.name : (schoolId ? profile.ecole_nom || null : null),
        classe_id: classId,
        classe_niveau: classNiveau,
        classe_tenue: classTenue,
        ecoles_encadrees: ecolesEncadrees,
        followed_schools: ecolesEncadrees,
        structure,
        whatsapp: whatsappValue || null,
        telephone: whatsappValue || null,
        signature_url: savedSignature || null,
        full_name: fullName,
        gender: sexeValue,
        school_id: schoolId,
        class_id: classId,
        whatsapp_phone: legacyPhone
      };

      if (isDemoMode) {
        const accounts = demoGetAccounts();
        const accountIndex = accounts.findIndex(item => item.id === userId);
        if (accountIndex < 0) throw new Error('Profil local introuvable.');
        accounts[accountIndex] = {
          ...accounts[accountIndex],
          ...profilePayload,
          fullName,
          schoolId,
          schoolName: school ? school.name : '',
          ecolesEncadrees,
          followedSchools: ecolesEncadrees,
          structure,
          classId,
          classLevel: classNiveau,
          classRecord: linkedClass,
          classeTenue: classTenue,
          classeNiveau: classNiveau,
          whatsappPhone: legacyPhone
        };
        demoSaveAccounts(accounts);
      } else {
        const { data: existingProfile, error: lookupError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (existingProfile) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update(profilePayload)
            .eq('id', userId);
          if (updateError) throw updateError;
        } else {
          if (!profile.role) throw new Error('Le rôle du profil est manquant.');
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              ...profilePayload,
              id: userId,
              role: profile.role,
              identifiant: profile.identifiant || (state.user && state.user.email) || userId
            });
          if (insertError) throw insertError;
        }
      }

      if (linkedClass && !isDemoMode) {
        const { error: teacherLinkError } = await supabase
          .from('class_teachers')
          .upsert(
            { class_id: linkedClass.id, teacher_id: userId },
            { onConflict: 'class_id,teacher_id', ignoreDuplicates: true }
          );
        if (teacherLinkError) throw teacherLinkError;
      }

      try {
        localStorage.setItem(ENCADREUR_SCHOOLS_STORAGE_PREFIX + userId, JSON.stringify(ecolesEncadrees));
      } catch (storageError) {
        console.warn('Impossible de sauvegarder localement les écoles encadrées.', storageError);
      }

      const updatedProfile = { ...profile, id: userId, ...profilePayload };
      if (state.realProfile && state.realProfile.id === userId) state.realProfile = updatedProfile;
      if (state.preview && state.realProfile) {
        const previewName = state.profile.full_name;
        state.profile = {
          ...state.profile,
          ...updatedProfile,
          role: state.preview.role,
          full_name: previewName
        };
        state.preview = { ...state.preview, schoolId, classId };
      } else {
        state.profile = updatedProfile;
      }
      const wasDirectorClassMode = directorProfile && state.profile.role === 'titulaire';
      state.isDualDirector = directorProfile && !!classId;
      if (wasDirectorClassMode && !classId) {
        state.profile = { ...state.profile, role: 'directeur' };
        state.view = 'directeur';
      }
      state.ecole = school;
      state.classe = linkedClass;
      if (school && !state.schools.some(item => item.id === school.id)) state.schools = [...state.schools, school];
      if (linkedClass && !state.classes.some(item => item.id === linkedClass.id)) state.classes = [...state.classes, linkedClass];
      const brand = document.querySelector('.role-brand span');
      if (brand) {
        const roleNames = { titulaire: 'Titulaire', directeur: 'Directeur', encadreur: 'Encadreur', chef_ceb: 'Chef CEB', chef_personnel: 'Chef du Personnel', statisticien: 'Statisticien', responsable_examens: 'Responsable des Examens et Concours' };
        brand.textContent = `${roleNames[state.profile.role] || 'Utilisateur'} — ${state.profile.full_name}`;
      }
      status.textContent = 'Paramètres enregistrés.';
      status.style.color = '#15803d';
      render();
      showToast('Paramètres enregistrés.');
    } catch (error) {
      console.error('Impossible d’enregistrer le profil.', error);
      status.textContent = error && error.message ? error.message : String(error);
      status.style.color = '#dc2626';
    } finally {
      saveButton.disabled = false;
    }
  });
  overlay.querySelector('#setSave').addEventListener('click', () => {
    const next = { bg: (bgSel && bgSel.value) || '', size: (sizeSel && sizeSel.value) || '' };
    saveSettings(next);
    applySettings();
    overlay.remove();
    showToast('Paramètres enregistrés.');
  });
  overlay.querySelector('#settingsInstallApp')?.addEventListener('click', () => installPWA());
  overlay.querySelector('#settingsBackupBtn')?.addEventListener('click', () => openBackupModal());
}

function initSettings() {
  applySettings();
  const oldButton = document.getElementById('settingsBtn');
  if (oldButton) oldButton.remove();
}

function mountSettingsButton() {
  const roleHeader = document.querySelector('.role-topbar');
  const header = roleHeader || document.querySelector('.topbar');
  if (!header) return;
  const roleLayout = header.closest('.role-layout');
  const roleBrand = roleLayout && roleLayout.querySelector('.role-brand');
  if (roleBrand) roleBrand.remove();

  if (roleHeader) {
    const heading = roleHeader.querySelector('h1');
    const subtitle = roleHeader.querySelector('p');
    const profile = state.realProfile || state.profile || {};
    const roleLabels = {
      titulaire: 'Titulaire',
      directeur: 'Directeur',
      encadreur: 'Encadreur',
      chef_ceb: 'Chef de la CEB',
      chef_personnel: 'Chef du Personnel',
      statisticien: 'Statisticien',
      responsable_examens: 'Responsable des Examens et Concours',
      super_admin: 'Administrateur Principal'
    };
    if (heading && subtitle) {
      const headingContainer = heading.parentElement;
      let brand = roleHeader.querySelector('.role-header-brand');
      if (!brand) {
        brand = document.createElement('div');
        brand.className = 'role-header-brand';
        const brandTitle = document.createElement('strong');
        const identity = document.createElement('span');
        brandTitle.textContent = "Educ'CEB Bagré";
        identity.textContent = `${profile.full_name || 'Utilisateur'} — ${profile.fonction || profile.emploi || roleLabels[profile.role] || 'Utilisateur'}`;
        brand.append(brandTitle, identity);
        roleHeader.insertBefore(brand, headingContainer);
      }
      if (headingContainer) headingContainer.classList.add('role-page-heading');
    }

    const pageActions = roleHeader.querySelector('.top-actions');
    const roleMain = roleLayout && roleLayout.querySelector('.role-main');
    if (pageActions && roleMain) {
      pageActions.classList.add('role-page-actions');
      roleMain.insertBefore(pageActions, roleMain.firstChild);
    }
  }

  let actions = roleHeader
    ? header.querySelector('.account-header-actions')
    : header.querySelector('.topbar-right');
  if (!actions) {
    actions = document.createElement('div');
    header.appendChild(actions);
  }
  actions.classList.add('account-header-actions');

  const oldBadge = header.querySelector('.user-badge');
  if (oldBadge) oldBadge.remove();

  let settingsButton = actions.querySelector('[data-action="open-settings"]');
  if (!settingsButton) {
    settingsButton = document.createElement('button');
    settingsButton.type = 'button';
    settingsButton.className = 'btn-settings';
    settingsButton.dataset.action = 'open-settings';
    settingsButton.addEventListener('click', openSettings);
  }
  settingsButton.textContent = '⚙️ Paramètres';

  let backupButton = actions.querySelector('[data-action="quick-backup"]');
  if (!backupButton) {
    backupButton = document.createElement('button');
    backupButton.type = 'button';
    backupButton.className = 'btn-settings';
    backupButton.dataset.action = 'quick-backup';
    backupButton.textContent = '☁️ Sauvegarder';
    backupButton.addEventListener('click', () => openBackupModal());
    actions.insertBefore(backupButton, settingsButton);
  }

  const logoutButton = document.querySelector('.btn-logout') ||
    header.querySelector('.topbar-left button[onclick*="logout"]');
  if (logoutButton) {
    logoutButton.className = 'btn-logout';
    logoutButton.textContent = 'Déconnexion';
    actions.appendChild(logoutButton);
    const footer = logoutButton.closest('.role-footer');
    if (footer) footer.remove();
    const oldLeftActions = logoutButton.closest('.topbar-left');
    if (oldLeftActions && !oldLeftActions.children.length) oldLeftActions.remove();
  }
  actions.insertBefore(settingsButton, logoutButton || null);
}

function isPrincipalAdmin() {
  return !isDemoMode && state.authenticatedAppRole === 'super_admin';
}

function openAdminPrincipal() {
  if (!isPrincipalAdmin()) return;
  if (state.preview) {
    state.preview = null;
    state.profile = state.realProfile;
    state.realProfile = null;
  }
  state.view = 'admin-principal';
  render();
}

// ---------------------------------------------------------------------------
// Mode Aperçu Concepteur (super-admin) : basculer instantanément entre les vues
// de tous les rôles, avec un sélecteur d'école / classe, sans se déconnecter.
// ---------------------------------------------------------------------------
const PREVIEW_ROLES = [
  ['titulaire', '👨‍🏫 Titulaire'],
  ['directeur', '🏫 Directeur'],
  ['encadreur', '🧭 Encadreur'],
  ['chef_ceb', '🏛️ Chef CEB'],
  ['chef_personnel', '👥 Chef du Personnel'],
  ['statisticien', '📊 Statisticien'],
  ['responsable_examens', '🎓 Responsable Examens']
];

let previewBarEl = null;

function removePreviewBar() {
  if (previewBarEl) {
    previewBarEl.remove();
    previewBarEl = null;
  }
}

function viewForRole(role) {
  return {
    titulaire: 'titulaire',
    directeur: 'directeur',
    encadreur: 'encadreur',
    chef_ceb: 'chef-ceb',
    chef_personnel: 'chef-personnel',
    statisticien: 'statisticien',
    responsable_examens: 'responsable-examens'
  }[role] || 'dashboard';
}

function initPreviewBar() {
  if (previewBarEl || !isPrincipalAdmin()) return;
  previewBarEl = document.createElement('div');
  previewBarEl.id = 'previewBar';
  previewBarEl.setAttribute('aria-label', 'Outils de l’Administrateur Principal');
  document.body.prepend(previewBarEl);
  renderPreviewBar();
}

async function renderPreviewBar() {
  if (!previewBarEl) return;
  let schools = mergeSchoolChoices();
  try {
    const r = await supabase.from('schools').select('id,name,ceb').order('name');
    schools = mergeSchoolChoices(r.data || []);
  } catch (e) {
    schools = mergeSchoolChoices();
  }

  previewBarEl.innerHTML = `
    <strong style="color:#a78bfa;white-space:nowrap">🛡️ ADMIN PRINCIPAL</strong>
    ${PREVIEW_ROLES.map(([r, l]) => `<button class="pv-role" data-role="${r}" style="background:#1f2937;color:#fff;border:1px solid #374151;border-radius:6px;padding:6px 10px;font-weight:600;cursor:pointer">${l}</button>`).join('')}
    <span style="flex:1"></span>
    <select id="pvSchool" style="background:#1f2937;color:#fff;border:1px solid #374151;border-radius:6px;padding:6px">
      <option value="">Toutes les écoles</option>
      ${schools.map(s => `<option value="${esc(s.id)}" data-fallback="${s.isFallback ? 'true' : 'false'}" ${s.isFallback ? 'disabled' : ''}>${esc(s.name)}</option>`).join('')}
    </select>
    <select id="pvClass" style="background:#1f2937;color:#fff;border:1px solid #374151;border-radius:6px;padding:6px">
      <option value="">Toutes les classes</option>
    </select>
    <button id="pvAccounts" style="background:#7c2d12;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-weight:700;cursor:pointer">Gestion des comptes</button>
    <button id="pvExit" style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-weight:700;cursor:pointer">↩ Mon espace</button>
  `;
  previewBarEl.querySelectorAll('.pv-role').forEach(btn => {
    btn.addEventListener('click', () => enterPreview(btn.dataset.role));
  });
  const schoolSel = previewBarEl.querySelector('#pvSchool');
  schoolSel.addEventListener('change', () => loadPreviewClasses(schoolSel.value));
  previewBarEl.querySelector('#pvAccounts').addEventListener('click', openAdminPrincipal);
  previewBarEl.querySelector('#pvExit').addEventListener('click', exitPreview);
}

async function loadPreviewClasses(schoolId) {
  const sel = previewBarEl && previewBarEl.querySelector('#pvClass');
  if (!sel) return;
  if (!schoolId) {
    sel.innerHTML = '<option value="">Toutes les classes</option>';
    return;
  }
  const schoolSelect = previewBarEl.querySelector('#pvSchool');
  if (schoolSelect && schoolSelect.selectedOptions[0]?.dataset.fallback === 'true') {
    sel.innerHTML = '<option value="">Aucune classe enregistrée</option>';
    return;
  }
  let classes = [];
  try {
    const r = await supabase.from('classes').select('id,name,level').eq('school_id', schoolId).order('name');
    classes = r.data || [];
  } catch (e) { classes = []; }
  sel.innerHTML = '<option value="">Toutes les classes</option>' +
    classes.map(c => `<option value="${esc(c.id)}">${esc(formatClassName(c))}</option>`).join('');
}

function enterPreview(role) {
  if (!isPrincipalAdmin()) return;
  if (!state.realProfile) state.realProfile = state.profile;
  const schoolId = (previewBarEl && previewBarEl.querySelector('#pvSchool') && previewBarEl.querySelector('#pvSchool').value) || null;
  const classId = (previewBarEl && previewBarEl.querySelector('#pvClass') && previewBarEl.querySelector('#pvClass').value) || null;
  state.preview = { role, schoolId, classId };
  state.profile = {
    id: state.user.id,
    identifiant: state.realProfile.identifiant,
    full_name: '👁 Aperçu',
    role,
    school_id: schoolId,
    class_id: classId,
    followed_schools: schoolId ? [schoolId] : []
  };
  if (previewBarEl) {
    previewBarEl.querySelectorAll('.pv-role').forEach(b => {
      b.style.background = (b.dataset.role === role) ? '#7c3aed' : '#1f2937';
    });
  }
  state.view = viewForRole(role);
  render();
}

function exitPreview() {
  if (!isPrincipalAdmin()) return;
  state.preview = null;
  if (state.realProfile) {
    state.profile = state.realProfile;
    state.realProfile = null;
  }
  if (state.profile) {
    state.view = viewForRole(state.profile.role);
    render();
  }
}

function renderLoginView() {
  state.view = isAdminEntryRequested() ? 'admin-login' : 'login';
  render();
}

function isAdminEntryRequested() {
  return new URLSearchParams(window.location.search).get('admin') === '1' ||
    window.location.hash.toLowerCase() === '#admin';
}

let deferredInstallPrompt = null;

async function installPWA() {
  if (!deferredInstallPrompt) {
    showToast('Pour installer l’application, utilisez le menu du navigateur puis « Ajouter à l’écran d’accueil ».');
    return;
  }

  const installPrompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  try {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    showToast(choice.outcome === 'accepted' ? 'Installation lancée.' : 'Installation annulée.');
  } catch (error) {
    console.error('Impossible de lancer l’installation de l’application :', error);
    showToast('Impossible de lancer l’installation. Réessayez depuis le menu du navigateur.');
  }
}

async function handleLogin({ identifiant, password } = {}) {
  const cleanId = (identifiant || '').trim();
  const cleanPassword = (password || '').trim();
  const isAdminLogin = cleanId.toLowerCase() === ADMIN_MASTER_EMAIL;

  if (isDemoMode && !isAdminLogin) {
    const account = demoGetAccounts().find(
      a => a.identifiant === cleanId && a.password === cleanPassword
    );
    if (!account) {
      showToast('Identifiant ou mot de passe incorrect.');
      throw new Error('invalid_credentials');
    }
    demoSetSession(account.id);
    applyDemoUser(account);
    showToast('Connexion réussie.');
    return;
  }

  const email = toInternalEmail(cleanId);
  const { error } = await supabase.auth.signInWithPassword({ email, password: cleanPassword });
  if (error) {
    showToast(friendlyError(error, 'Erreur de connexion'));
    throw error;
  }

  if (isAdminLogin) {
    const isSuperAdmin = await verifyPrincipalAdminAccess();
    if (isSuperAdmin) {
      state.view = 'admin-principal';
      render();
      showToast('Accès Administrateur Principal vérifié.');
      return;
    }
    showToast('Accès réservé à l’Administrateur Principal.');
    return;
  }
}

async function verifyPrincipalAdminAccess() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return false;
  const normalizedEmail = String(user.email || '').trim().toLowerCase();
  const emailIsMasterAdmin = normalizedEmail === ADMIN_MASTER_EMAIL;
  let profile = null;
  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  profile = profileData;
  const isSuperAdmin = emailIsMasterAdmin || user.app_metadata?.role === 'super_admin' || profile?.role === 'super_admin';
  if (isSuperAdmin) {
    state.user = user;
    state.authenticatedAppRole = 'super_admin';
    state.authenticatedRole = 'super_admin';
    state.profile = { ...(profile || {}), id: user.id, role: 'super_admin', email: user.email };
  }
  return isSuperAdmin;
}

async function ensureSchoolId(schoolName) {
  const name = (schoolName || '').trim();
  if (!name) return null;
  const { data: existing, error: findError } = await supabase
    .from('schools')
    .select('id')
    .eq('name', name)
    .limit(1);
  if (findError) throw findError;
  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error: createError } = await supabase
    .from('schools')
    .insert({ name, ceb: 'BAGRÉ' })
    .select('id')
    .single();
  if (createError) throw createError;
  return created.id;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function resolveSchoolId(selection) {
  const value = String(selection || '').trim();
  if (!value) return null;
  if (isUuid(value)) return value;
  return ensureSchoolId(value);
}

async function handleRegister({ identifiant, password, matricule, nom, prenom, sexe, role, emploi, schoolName, schoolId: selectedSchoolId, classLevel, className, whatsapp, classId, followedSchools, structure }) {
  if (role !== 'titulaire') {
    showToast('Les autres fonctions sont attribuées par un administrateur après vérification.');
    throw new Error('role_registration_requires_admin');
  }
  const cleanId = (identifiant || '').trim();
  const email = toInternalEmail(cleanId);
  const isSchoolRole = role === 'titulaire' || role === 'directeur';
  const isEncadreur = role === 'encadreur';
  const cleanSchoolName = isSchoolRole ? ((schoolName || '').trim() || null) : null;
  const finalFollowed = isEncadreur && Array.isArray(followedSchools) ? [...new Set(followedSchools.map(String))] : [];
  const cleanNom = (nom || '').trim();
  const cleanPrenom = (prenom || '').trim();
  const fullName = (cleanPrenom + ' ' + cleanNom).trim();
  const cleanWhatsapp = (whatsapp || '').trim();
  const cleanSexe = sexe || null;
  const cleanMatricule = (matricule || '').trim() || null;
  const cleanEmploi = normalizeEmployment(emploi, role);
  const cleanFonction = getRoleFunction(role);
  if (!cleanFonction || !cleanEmploi) {
    showToast('Choisissez une fonction et un emploi correspondant.');
    throw new Error('invalid_function_or_employment');
  }
  const classeTenue = isSchoolRole ? classLevel || null : null;
  const profileStructure = isSchoolRole ? cleanSchoolName : (structure || 'CEB de Bagré');

  if (isDemoMode) {
    const accounts = demoGetAccounts();
    if (accounts.some(a => a.identifiant === cleanId)) {
      showToast('Cet identifiant est déjà utilisé. Choisissez-en un autre.');
      throw new Error('duplicate_identifiant');
    }

    const demoUserId = 'user-' + Date.now();
    const demoClass = isSchoolRole && classLevel
      ? {
        id: `demo-class-${cleanSchoolName || 'sans-ecole'}-${classLevel}`,
        name: (className || '').trim() || classLevel,
        level: classLevel,
        school_id: cleanSchoolName,
        titulaire_id: demoUserId,
        titulaire_nom: `${cleanNom} ${cleanPrenom}`.trim(),
        co_titulaires: [demoUserId],
        subjects: defaultSubjects(classLevel)
      }
      : null;
    const account = {
      id: demoUserId,
      email,
      identifiant: cleanId,
      password,
      fullName,
      nom: cleanNom,
      prenom: cleanPrenom,
      sexe: cleanSexe,
      matricule: cleanMatricule,
      classeTenue,
      emploi: cleanEmploi,
      fonction: cleanFonction,
      whatsapp: cleanWhatsapp,
      whatsappPhone: cleanWhatsapp,
      role,
      schoolId: cleanSchoolName,
      schoolName: cleanSchoolName,
      ecolesEncadrees: finalFollowed,
      followedSchools: finalFollowed,
      structure: profileStructure,
      classId: demoClass ? demoClass.id : (classId || null),
      classRecord: demoClass,
      classLevel: isSchoolRole ? classLevel || null : null,
      className: isSchoolRole ? (className || '').trim() || null : null,
      ecole_id: cleanSchoolName,
      ecole_nom: cleanSchoolName,
      createdAt: new Date().toISOString()
    };
    accounts.push(account);
    demoSaveAccounts(accounts);
    try {
      localStorage.setItem(ENCADREUR_SCHOOLS_STORAGE_PREFIX + account.id, JSON.stringify(finalFollowed));
    } catch (storageError) {
      console.warn('Impossible de sauvegarder localement les écoles encadrées.', storageError);
    }
    demoSetSession(account.id);
    showToast('Compte créé avec succès !');
    applyDemoUser(account);
    return;
  }

  // --- Mode Supabase ---
  let followedSchoolIds = [];
  if (isEncadreur) {
    try {
      followedSchoolIds = await Promise.all(finalFollowed.map(resolveSchoolId));
    } catch (schoolError) {
      showToast('Impossible de résoudre les écoles encadrées : ' + schoolError.message);
      throw schoolError;
    }
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    showToast(friendlyError(error, 'Erreur d\'inscription'));
    throw error;
  }

  if (!data.user) {
    showToast('Inscription impossible. Réessayez.');
    throw new Error('no_user');
  }

  if (!data.session) {
    showToast('Compte créé. Vérifiez votre e-mail pour activer votre compte, puis connectez-vous.');
    state.view = 'login';
    render();
    return;
  }

  let schoolId = null;
  if (cleanSchoolName) {
    try {
      schoolId = isUuid(selectedSchoolId) ? selectedSchoolId : await ensureSchoolId(cleanSchoolName);
    } catch (schoolError) {
      showToast('Impossible d’affecter l’école : ' + schoolError.message);
      throw schoolError;
    }
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    identifiant: cleanId,
    full_name: fullName,
    nom: cleanNom,
    prenom: cleanPrenom,
    gender: cleanSexe,
    sexe: cleanSexe,
    matricule: cleanMatricule,
    classe_tenue: classeTenue,
    classe_niveau: isSchoolRole ? classLevel || null : null,
    emploi: cleanEmploi,
    fonction: cleanFonction,
    whatsapp_phone: cleanWhatsapp,
    whatsapp: cleanWhatsapp,
    ecole_id: schoolId,
    ecole_nom: cleanSchoolName,
    classe_id: classId || null,
    ecoles_encadrees: followedSchoolIds,
    followed_schools: followedSchoolIds,
    structure: profileStructure,
    role,
    school_id: schoolId,
    class_id: classId || null,
    est_actif: false
  });
  if (profileError) {
    showToast(profileError.message);
    throw profileError;
  }

  let createdClassId = classId || null;
  if (isSchoolRole && classLevel && !createdClassId) {
    const name = (className && className.trim()) || classLevel;
    const { data: newClass, error: classError } = await supabase.from('classes').insert({
      name,
      level: classLevel,
      school_id: schoolId,
      titulaire_id: data.user.id,
      titulaire_nom: `${cleanNom} ${cleanPrenom}`.trim(),
      co_titulaires: [data.user.id],
      year: state.activeSchoolYear || '2026-2027',
      subjects: defaultSubjects(classLevel)
    }).select('id').single();
    if (classError) throw classError;
    if (newClass && newClass.id) {
      createdClassId = newClass.id;
      const { error: classProfileError } = await supabase.from('profiles')
        .update({ class_id: newClass.id, classe_id: newClass.id })
        .eq('id', data.user.id);
      if (classProfileError) throw classProfileError;
      const { error: teacherLinkError } = await supabase.from('class_teachers').upsert(
        { class_id: newClass.id, teacher_id: data.user.id },
        { onConflict: 'class_id,teacher_id', ignoreDuplicates: true }
      );
      if (teacherLinkError) throw teacherLinkError;
    }
  }

  try {
    localStorage.setItem(ENCADREUR_SCHOOLS_STORAGE_PREFIX + data.user.id, JSON.stringify(followedSchoolIds));
  } catch (storageError) {
    console.warn('Impossible de sauvegarder localement les écoles encadrées.', storageError);
  }

  state.user = data.user;
  state.authenticatedAppRole = null;
  state.authenticatedRole = role;
  state.profile = {
    id: data.user.id,
    identifiant: cleanId,
    full_name: fullName,
    nom: cleanNom,
    prenom: cleanPrenom,
    gender: cleanSexe,
    sexe: cleanSexe,
    matricule: cleanMatricule,
    classe_tenue: classeTenue,
    classe_niveau: isSchoolRole ? classLevel || null : null,
    classe_id: createdClassId,
    emploi: cleanEmploi,
    fonction: cleanFonction,
    whatsapp_phone: cleanWhatsapp,
    whatsapp: cleanWhatsapp,
    role,
    ecole_id: schoolId,
    ecole_nom: cleanSchoolName,
    school_id: schoolId,
    class_id: createdClassId,
    ecoles_encadrees: followedSchoolIds,
    followed_schools: followedSchoolIds,
    structure: profileStructure
  };
  state.ecole = schoolId ? { id: schoolId, name: cleanSchoolName } : null;
  state.classe = createdClassId ? { id: createdClassId, name: className || classLevel, level: classLevel, school_id: schoolId } : null;
  showToast('Compte créé avec succès !');
  routeToDashboard();
}

window.navigateTo = (view) => {
  state.view = view;
  render();
};

window.logout = async () => {
  if (isDemoMode) {
    demoClearSession();
  } else {
    await supabase.auth.signOut();
  }
  state.user = null;
  state.profile = null;
  state.authenticatedAppRole = null;
  state.authenticatedRole = null;
  state.preview = null;
  state.realProfile = null;
  state.isDualDirector = undefined;
  state.activeSchoolYear = DEFAULT_ACTIVE_SCHOOL_YEAR;
  if (previewBarEl) { previewBarEl.remove(); previewBarEl = null; }
  renderLoginView();
};

function preventClipboardInteraction(event) {
  event.preventDefault();
}

if (typeof document !== 'undefined') {
  ['copy', 'cut', 'contextmenu'].forEach(eventName => {
    document.addEventListener(eventName, preventClipboardInteraction, true);
  });
}

if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('/sw.js').then(registration => {
      registration.update().catch(() => {});
    }).catch(error => {
      console.error('Impossible d’enregistrer le service worker :', error);
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) { hadController = true; return; }
      const active = document.activeElement;
      const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
      if (typing) {
        showToast('Mise à jour disponible — rechargez la page pour l’appliquer.');
        return;
      }
      window.location.reload();
    });
    window.addEventListener('online', () => {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration) registration.update().catch(() => {});
      }).catch(() => {});
    });
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    showToast('Application installée.');
  });
  window.addEventListener('hashchange', () => {
    if (!isAdminEntryRequested() && state.view !== 'admin-login' && state.view !== 'admin-principal') return;
    if (state.profile) routeToDashboard();
    else renderLoginView();
  });
  window.addEventListener('DOMContentLoaded', init);
}