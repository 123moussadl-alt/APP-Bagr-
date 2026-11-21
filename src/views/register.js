/**
 * Vue d'inscription — Champs : Matricule, Nom, Prénom, Sexe, Rôle, École,
 * Classe tenue (titulaire et directeur), Contact WhatsApp + identifiant / mot de passe.
 */

import { isDemoMode, supabase } from '../supabaseClient.js';
import { DEFAULT_SCHOOL_NAMES, mergeSchoolChoices } from '../utils/schools.js';
import { getEmploymentOptions } from '../utils/agents.js';
import { esc } from '../utils/format.js';

export function renderRegister({ onLogin, onRegister }) {
  return `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-flag">
            <div class="flag-stripe red"></div>
            <div class="flag-stripe green"></div>
            <div class="flag-star">★</div>
          </div>
          <h1>Créer un compte</h1>
          <p>Inscription — Educ CEB Bagré</p>
        </div>

        <form id="registerForm" class="auth-form">
          <div class="form-group">
            <label>Matricule (optionnel)</label>
            <input type="text" name="matricule" placeholder="Ex: MAT-001">
          </div>
          <div class="form-group">
            <label>Nom</label>
            <input type="text" name="nom" placeholder="Ex: DIALLO" required>
          </div>
          <div class="form-group">
            <label>Prénom</label>
            <input type="text" name="prenom" placeholder="Ex: Moussa" required>
          </div>
          <div class="form-group">
            <label>Sexe</label>
            <select name="sexe" required>
              <option value="">-- Choisir --</option>
              <option value="M">Homme</option>
              <option value="F">Femme</option>
            </select>
          </div>
          <div class="form-group">
            <label>Fonction</label>
            <select name="role" id="roleSelect" required>
              <option value="">-- Choisir une fonction --</option>
              <option value="titulaire">Agent</option>
              <option value="directeur">Directeur</option>
              <option value="encadreur">Encadreur</option>
              <option value="chef_ceb">Chef de la CEB</option>
              <option value="chef_personnel">Chef du Personnel</option>
              <option value="statisticien">Statisticien</option>
            </select>
          </div>
          <div class="form-group">
            <label>Emploi</label>
            <select name="emploi" id="employmentSelect" required disabled>
              <option value="">-- Choisir un emploi --</option>
              <option value="PE">PE — Professeur des Écoles</option>
              <option value="PCE">PCE — Professeur Certifié des Écoles</option>
              <option value="IEPNF">IEPNF — Inspecteur de l'Éducation Préscolaire et Non Formelle</option>
            </select>
          </div>

          <div id="roleFields" style="display:none;margin-top:12px;padding:12px;background:#f1f5f9;border-radius:6px">
            <div id="schoolClassFields">
            <div class="form-group">
              <label>École</label>
              <select name="schoolName" id="schoolSelect">
                <option value="">-- Choisir une école --</option>
                ${DEFAULT_SCHOOL_NAMES.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}
              </select>
            </div>
            <div id="titulaireClassGroup" style="display:none;margin-top:10px">
              <div class="form-group">
                <label for="classLevelSelect" id="classLevelLabel">Classe tenue — Niveau</label>
                <select name="classLevel" id="classLevelSelect">
                  <option value="">-- Choisir le niveau --</option>
                  <option value="CP1">CP1</option>
                  <option value="CP2">CP2</option>
                  <option value="CE1">CE1</option>
                  <option value="CE2">CE2</option>
                  <option value="CM1">CM1</option>
                  <option value="CM2">CM2</option>
                </select>
              </div>
              <div class="form-group" id="classNameGroup">
                <label for="classNameInput" id="classNameLabel">Classe tenue — Nom (optionnel)</label>
                <input type="text" name="className" id="classNameInput" placeholder="Ex: CM2 A">
              </div>
            </div>
            </div>
            <div id="encadreurSchoolsGroup" class="form-group" style="display:none">
              <label>Écoles encadrées / Zone d'encadrement</label>
              <div id="encadreurSchoolsList" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px"></div>
            </div>
            <div id="districtStructureGroup" class="form-group" style="display:none">
              <label for="districtStructure">Structure</label>
              <input id="districtStructure" value="CEB de Bagré" readonly>
              <small>Votre fonction est rattachée à la circonscription.</small>
            </div>
            <p id="schoolLoadStatus" role="status" aria-live="polite"></p>
          </div>

          <div class="form-group">
            <label>Contact WhatsApp (indicatif +226)</label>
            <input type="tel" name="whatsapp" placeholder="Ex: 07 01 23 45 67" required>
          </div>
          <div class="form-group">
            <label>Identifiant (téléphone ou nom d'utilisateur)</label>
            <input type="text" name="identifiant" placeholder="Ex: 0701234567 ou m.diallo" required>
          </div>
          <div class="form-group">
            <label>Mot de passe</label>
            <input type="password" name="password" placeholder="Min. 6 caractères" minlength="6" required>
          </div>

          <button type="submit" class="btn-primary" id="registerSubmit" style="width:100%;margin-top:8px">
            ✓ Valider l'inscription
          </button>
        </form>

        <p class="auth-footer">
          Déjà un compte ? <button type="button" class="auth-link" id="goLoginBtn">Se connecter</button>
        </p>
      </div>
    </div>
  `;
}

export function setupRegister(container, { onLogin, onRegister }) {
  const form = container.querySelector('#registerForm');
  const roleSelect = container.querySelector('#roleSelect');
  const employmentSelect = container.querySelector('#employmentSelect');
  const roleFields = container.querySelector('#roleFields');
  const schoolClassFields = container.querySelector('#schoolClassFields');
  const encadreurSchoolsGroup = container.querySelector('#encadreurSchoolsGroup');
  const encadreurSchoolsList = container.querySelector('#encadreurSchoolsList');
  const schoolLoadStatus = container.querySelector('#schoolLoadStatus');
  const districtStructureGroup = container.querySelector('#districtStructureGroup');
  const schoolSelect = container.querySelector('#schoolSelect');
  const titulaireClassGroup = container.querySelector('#titulaireClassGroup');
  const classLevelSelect = container.querySelector('#classLevelSelect');
  const classLevelLabel = container.querySelector('#classLevelLabel');
  const classNameGroup = container.querySelector('#classNameGroup');
  const classNameLabel = container.querySelector('#classNameLabel');
  const classNameInput = container.querySelector('#classNameInput');
  let schools = mergeSchoolChoices();
  let schoolChoicesReady = isDemoMode;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderSchoolChoices() {
    if (schoolSelect) {
      const current = schoolSelect.value;
      schoolSelect.innerHTML = '<option value="">-- Choisir une école --</option>' +
        schools.map(school => `<option value="${escapeHtml(school.id)}" data-name="${escapeHtml(school.name)}">${escapeHtml(school.name)}</option>`).join('');
      if (current && Array.from(schoolSelect.options).some(option => option.value === current)) schoolSelect.value = current;
    }
    if (encadreurSchoolsList) {
      encadreurSchoolsList.innerHTML = schools.map(school => `
        <label style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff">
          <input type="checkbox" name="encadreeSchool" value="${escapeHtml(school.id)}">
          <span>${escapeHtml(school.name)}</span>
        </label>`).join('');
    }
  }

  function refreshRoleFields() {
    const role = roleSelect ? roleSelect.value : '';
    const needsSchool = role === 'titulaire' || role === 'directeur';
    const isEncadreur = role === 'encadreur';
    const isDistrictRole = ['chef_ceb', 'chef_personnel', 'statisticien'].includes(role);
    const canAssignClass = role === 'titulaire' || role === 'directeur';
    const hasClassLevel = classLevelSelect && classLevelSelect.value && classLevelSelect.value !== 'Aucune';

    if (employmentSelect) {
      const currentEmployment = employmentSelect.value;
      const employmentOptions = getEmploymentOptions(role);
      employmentSelect.innerHTML = '<option value="">-- Choisir un emploi --</option>' +
        employmentOptions.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('');
      employmentSelect.disabled = !role;
      employmentSelect.required = !!role;
      employmentSelect.value = employmentOptions.length === 1
        ? employmentOptions[0].value
        : (employmentOptions.some(option => option.value === currentEmployment) ? currentEmployment : '');
    }

    if (roleFields) roleFields.style.display = role ? 'block' : 'none';
    if (schoolClassFields) schoolClassFields.style.display = needsSchool ? 'block' : 'none';
    if (encadreurSchoolsGroup) encadreurSchoolsGroup.style.display = isEncadreur ? 'block' : 'none';
    if (districtStructureGroup) districtStructureGroup.style.display = isDistrictRole ? 'block' : 'none';
    if (schoolSelect) {
      schoolSelect.required = needsSchool;
      schoolSelect.disabled = !needsSchool;
    }
    if (titulaireClassGroup) titulaireClassGroup.style.display = canAssignClass ? 'block' : 'none';
    if (classLevelSelect) {
      classLevelSelect.disabled = !canAssignClass;
      classLevelSelect.required = canAssignClass;
    }
    if (classLevelLabel) classLevelLabel.textContent = 'Classe tenue — Niveau';
    if (classNameGroup) classNameGroup.style.display = canAssignClass && hasClassLevel ? 'block' : 'none';
    if (classNameInput) {
      classNameInput.disabled = !canAssignClass || !hasClassLevel;
      if (classNameLabel) classNameLabel.textContent = 'Classe tenue — Nom (optionnel)';
    }
  }

  if (roleSelect) roleSelect.addEventListener('change', refreshRoleFields);
  if (classLevelSelect) classLevelSelect.addEventListener('change', refreshRoleFields);

  const goLoginBtn = container.querySelector('#goLoginBtn');
  if (goLoginBtn && onLogin) goLoginBtn.addEventListener('click', () => onLogin());

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const role = roleSelect ? roleSelect.value : '';
      let schoolName = null;
      const selectedSchools = Array.from(container.querySelectorAll('input[name="encadreeSchool"]:checked'))
        .map(input => input.value);

      if ((role === 'titulaire' || role === 'directeur') && !schoolChoicesReady) {
        alert('Attendez le chargement de la liste des écoles avant de continuer.');
        return;
      }
      if (role === 'encadreur' && !schoolChoicesReady) {
        alert('Attendez le chargement de la liste des écoles avant de continuer.');
        return;
      }
      if (role === 'encadreur' && !selectedSchools.length) {
        alert('Sélectionnez au moins une école à encadrer.');
        return;
      }

      if (role === 'titulaire' || role === 'directeur') {
        if (schoolSelect && schoolSelect.value) {
          schoolName = schoolSelect.selectedOptions[0]?.dataset.name || schoolSelect.value;
        }
      }

      const submitBtn = container.querySelector('#registerSubmit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Création en cours...';
      }

      const formData = new FormData(form);
      const classLevel = ((role === 'titulaire' || role === 'directeur') && classLevelSelect) ? (classLevelSelect.value || null) : null;
      const className = (role === 'titulaire' || role === 'directeur') && classLevel && classLevel !== 'Aucune'
        ? ((formData.get('className') || '').trim() || null)
        : null;

      try {
        await onRegister({
          matricule: (formData.get('matricule') || '').trim() || null,
          nom: (formData.get('nom') || '').trim(),
          prenom: (formData.get('prenom') || '').trim(),
          sexe: formData.get('sexe') || null,
          role,
          emploi: (formData.get('emploi') || '').trim() || null,
          schoolName,
          schoolId: role === 'titulaire' || role === 'directeur' ? (schoolSelect && schoolSelect.value) : null,
          followedSchools: role === 'encadreur' ? selectedSchools : [],
          structure: role === 'encadreur' || ['chef_ceb', 'chef_personnel', 'statisticien'].includes(role)
            ? 'CEB de Bagré'
            : schoolName,
          classLevel,
          className,
          whatsapp: (formData.get('whatsapp') || '').trim(),
          identifiant: formData.get('identifiant'),
          password: formData.get('password')
        });
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "✓ Valider l'inscription";
        }
      }
    });
  }

  if (!isDemoMode) {
    if (schoolLoadStatus) schoolLoadStatus.textContent = 'Chargement des écoles…';
    supabase.from('schools').select('id,name,ceb').order('name').then(({ data, error }) => {
      if (error) {
        schoolChoicesReady = false;
        schools = mergeSchoolChoices();
        renderSchoolChoices();
        if (schoolLoadStatus) {
          schoolLoadStatus.textContent = 'Impossible de charger les écoles : ' + error.message;
          schoolLoadStatus.style.color = '#dc2626';
        }
        return;
      }
      schools = mergeSchoolChoices(data || []);
      schoolChoicesReady = true;
      renderSchoolChoices();
      if (!schools.length && schoolLoadStatus) {
        schoolLoadStatus.textContent = 'Aucune école n’est enregistrée dans la CEB.';
        schoolLoadStatus.style.color = '#b45309';
      } else if (schoolLoadStatus) {
        schoolLoadStatus.textContent = '';
      }
    }).catch(error => {
      schoolChoicesReady = false;
      schools = mergeSchoolChoices();
      renderSchoolChoices();
      if (schoolLoadStatus) {
        schoolLoadStatus.textContent = 'Impossible de charger les écoles : ' + (error.message || error);
        schoolLoadStatus.style.color = '#dc2626';
      }
    });
  } else {
    renderSchoolChoices();
  }

  refreshRoleFields();
}