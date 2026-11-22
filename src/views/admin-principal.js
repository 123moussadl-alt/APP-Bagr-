import { getEmploymentOptions } from '../utils/agents.js';
import { esc } from '../utils/format.js';
import { DEFAULT_ACTIVE_SCHOOL_YEAR, fetchActiveSchoolYear } from '../utils/school-year.js';

const ADMIN_ROLES = [
  ['titulaire', 'Agent'],
  ['directeur', 'Directeur'],
  ['encadreur', 'Encadreur'],
  ['chef_personnel', 'Chef du Personnel'],
  ['statisticien', 'Statisticien'],
  ['chef_ceb', 'Chef de la CEB'],
  ['responsable_examens', 'Responsable des Examens et Concours']
];

export function renderAdminPrincipal(state) {
  if (state.authenticatedAppRole !== 'super_admin') {
    return '<div class="card" role="alert">Accès réservé à l’Administrateur Principal.</div>';
  }

  return `
    <div class="role-layout">
      <div class="role-content">
        <header class="role-topbar">
          <div>
            <h1>🛡️ Administrateur Principal</h1>
            <p>Gestion protégée des comptes et de l’année scolaire</p>
          </div>
          <div class="top-actions">
            <button type="button" class="btn secondary" data-action="admin-return">Retour à mon espace</button>
            <button type="button" class="btn-logout" onclick="window.logout()">Déconnexion</button>
          </div>
        </header>
        <main class="role-main">
          <section class="card">
            <h2>Gestion de l’année scolaire</h2>
            <form id="schoolYearForm" class="form-inline">
              <label for="activeSchoolYear">Année active</label>
              <input id="activeSchoolYear" name="year" type="text" inputmode="numeric" pattern="[0-9]{4}-[0-9]{4}" required>
              <button type="submit" class="btn">Enregistrer</button>
            </form>
            <p id="schoolYearStatus" role="status" aria-live="polite"></p>
          </section>
          <section class="card">
            <h2>Gestion des comptes utilisateurs</h2>
            <p>Les privilèges Administrateur Principal ne peuvent pas être attribués ici.</p>
            <p id="accountsStatus" role="status" aria-live="polite">Chargement des comptes…</p>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Compte</th><th>Fonction</th><th>Emploi</th><th>École / Structure</th><th>Actions</th></tr>
                </thead>
                <tbody id="adminAccounts"></tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  `;
}

export function setupAdminPrincipal(container, state, render, supabase) {
  if (state.authenticatedAppRole !== 'super_admin') return;

  const accountBody = container.querySelector('#adminAccounts');
  const accountStatus = container.querySelector('#accountsStatus');
  const schoolYearInput = container.querySelector('#activeSchoolYear');
  const schoolYearStatus = container.querySelector('#schoolYearStatus');
  let schools = [];

  container.querySelector('[data-action="admin-return"]')?.addEventListener('click', () => {
    if (state.profile) {
      state.view = state.profile.role === 'super_admin' ? 'dashboard' : state.profile.role.replace('_', '-');
    } else {
      state.view = 'dashboard';
    }
    render();
  });

  function employmentOptions(role, selected) {
    const options = getEmploymentOptions(role);
    return `<option value="">-- Emploi --</option>${options.map(option =>
      `<option value="${esc(option.value)}" ${option.value === selected ? 'selected' : ''}>${esc(option.value)}</option>`
    ).join('')}`;
  }

  function selectedFollowedSchools(profile) {
    const raw = profile.ecoles_encadrees || profile.followed_schools || [];
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function renderSchoolAssignment(role, profile = {}) {
    const schoolId = profile.school_id || profile.ecole_id || '';
    if (role === 'encadreur') {
      const selectedSchools = selectedFollowedSchools(profile);
      return `<select data-user-followed multiple aria-label="Écoles encadrées" size="3">${schools.map(school =>
        `<option value="${esc(school.id)}" ${selectedSchools.includes(String(school.id)) ? 'selected' : ''}>${esc(school.name)}</option>`
      ).join('')}</select>`;
    }
    if (['titulaire', 'directeur'].includes(role)) {
      return `<select data-user-school aria-label="École">
        <option value="">-- Choisir une école --</option>
        ${schools.map(school =>
          `<option value="${esc(school.id)}" ${String(school.id) === String(schoolId) ? 'selected' : ''}>${esc(school.name)}</option>`
        ).join('')}
      </select>`;
    }
    return '<span>CEB de Bagré</span>';
  }

  function renderAccounts(profiles) {
    accountBody.innerHTML = profiles.map(profile => {
      const profileRole = profile.role === 'chef-personnel' ? 'chef_personnel' : profile.role;
      const readOnly = profile.role === 'super_admin' || profile.id === state.user.id;
      const roleOptions = ADMIN_ROLES.map(([value, label]) =>
        `<option value="${value}" ${profileRole === value ? 'selected' : ''}>${label}</option>`
      ).join('');
      const accountName = profile.full_name || profile.identifiant || profile.id;
      return `
        <tr data-profile-id="${esc(profile.id)}">
          <td><strong>${esc(accountName)}</strong><br><small>${esc(profile.identifiant || profile.id)}</small></td>
          <td><select data-user-role aria-label="Fonction de ${esc(accountName)}" ${readOnly ? 'disabled' : ''}>${roleOptions}</select></td>
          <td><select data-user-employment aria-label="Emploi de ${esc(accountName)}" ${readOnly ? 'disabled' : ''}>${employmentOptions(profileRole, profile.emploi)}</select></td>
          <td data-user-school-cell>${renderSchoolAssignment(profileRole, profile)}</td>
          <td>
            ${readOnly ? '<span>Protégé</span>' : `
              <button type="button" class="btn" data-action="save-user">Enregistrer</button>
              <button type="button" class="btn secondary" data-action="delete-user">Supprimer</button>`}
          </td>
        </tr>`;
    }).join('') || '<tr><td colspan="5">Aucun compte trouvé.</td></tr>';

    accountBody.querySelectorAll('[data-user-role]').forEach(select => {
      select.addEventListener('change', () => {
        const row = select.closest('tr');
        const employment = row.querySelector('[data-user-employment]');
        employment.innerHTML = employmentOptions(select.value, '');
        row.querySelector('[data-user-school-cell]').innerHTML = renderSchoolAssignment(select.value);
      });
    });

    accountBody.querySelectorAll('[data-user-school-cell] select').forEach(select => {
      if (select.closest('tr').querySelector('[data-user-role]').disabled) select.disabled = true;
    });
  }

  async function loadAdminData() {
    const [profilesResult, schoolsResult, activeSchoolYear] = await Promise.all([
      supabase.from('profiles')
        .select('id,identifiant,full_name,role,emploi,fonction,school_id,ecole_id,ecole_nom,ecoles_encadrees,followed_schools')
        .order('full_name'),
      supabase.from('schools').select('id,name').order('name'),
      fetchActiveSchoolYear(supabase)
    ]);
    const error = profilesResult.error || schoolsResult.error;
    if (error) {
      accountStatus.textContent = `Impossible de charger le panneau : ${error.message}`;
      accountStatus.style.color = '#b91c1c';
      return;
    }
    schools = schoolsResult.data || [];
    schoolYearInput.value = activeSchoolYear || state.activeSchoolYear || DEFAULT_ACTIVE_SCHOOL_YEAR;
    renderAccounts(profilesResult.data || []);
    accountStatus.textContent = `${(profilesResult.data || []).length} compte(s).`;
  }

  accountBody.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const row = button.closest('tr');
    if (!row) return;
    const profileId = row.dataset.profileId;

    if (button.dataset.action === 'save-user') {
      button.disabled = true;
      const role = row.querySelector('[data-user-role]').value;
      const schoolSelect = row.querySelector('[data-user-school]');
      const followedSelect = row.querySelector('[data-user-followed]');
      const { error } = await supabase.rpc('admin_update_profile', {
        p_profile_id: profileId,
        p_role: role,
        p_emploi: row.querySelector('[data-user-employment]').value,
        p_school_id: schoolSelect ? schoolSelect.value || null : null,
        p_followed_schools: followedSelect
          ? Array.from(followedSelect.selectedOptions).map(option => option.value)
          : []
      });
      button.disabled = false;
      if (error) {
        accountStatus.textContent = `Échec de la mise à jour : ${error.message}`;
        accountStatus.style.color = '#b91c1c';
        return;
      }
      accountStatus.textContent = 'Profil mis à jour.';
      accountStatus.style.color = '#15803d';
      await loadAdminData();
    } else if (button.dataset.action === 'delete-user') {
      const name = row.querySelector('strong')?.textContent || profileId;
      if (!window.confirm(`Supprimer définitivement le compte « ${name} » et son profil ?`)) return;
      button.disabled = true;
      const { error } = await supabase.functions.invoke('admin-user-management', {
        body: { action: 'delete', userId: profileId }
      });
      button.disabled = false;
      if (error) {
        accountStatus.textContent = `Échec de la suppression : ${error.message}`;
        accountStatus.style.color = '#b91c1c';
        return;
      }
      accountStatus.textContent = 'Compte supprimé.';
      accountStatus.style.color = '#15803d';
      await loadAdminData();
    }
  });

  container.querySelector('#schoolYearForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const year = schoolYearInput.value.trim();
    const { data, error } = await supabase.rpc('admin_set_school_year', { p_year: year });
    if (error) {
      schoolYearStatus.textContent = `Échec : ${error.message}`;
      schoolYearStatus.style.color = '#b91c1c';
      return;
    }
    state.activeSchoolYear = data;
    schoolYearStatus.textContent = `Année active : ${data}`;
    schoolYearStatus.style.color = '#15803d';
  });

  loadAdminData();
}
