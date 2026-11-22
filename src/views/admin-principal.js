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
          <section class="card" id="schoolYearCard">
            <h2>Gestion de l’année scolaire</h2>
            <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
              <div class="form-group" style="margin:0;min-width:240px">
                <label for="schoolYearSelect">Année scolaire</label>
                <select id="schoolYearSelect">
                  <option value="2025-2026">2025-2026</option>
                  <option value="2026-2027">2026-2027</option>
                  <option value="2027-2028">2027-2028</option>
                  <option value="2028-2029">2028-2029</option>
                  <option value="2029-2030">2029-2030</option>
                  <option value="__custom__">Autre / Saisir une nouvelle année...</option>
                </select>
              </div>
              <div class="form-group" style="margin:0;min-width:220px">
                <label for="schoolYearCustom">Nouvelle année (AAAA-AAAA)</label>
                <input id="schoolYearCustom" type="text" inputmode="numeric" placeholder="Ex: 2026-2027">
              </div>
              <button type="button" class="btn" id="schoolYearSave">💾 Enregistrer et activer l'année</button>
            </div>
            <p id="schoolYearStatus" role="status" aria-live="polite"></p>
          </section>
          <section class="card" id="accountsCard">
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
          <section class="card" id="closureCard">
            <h2>🔒 Clôturer l'année scolaire</h2>
            <p style="color:#475569">Cette opération efface les données transactionnelles de l'année (notes, examens blancs, présences, registres mensuels, élèves, présences des agents). Les comptes (<code>profiles</code>), écoles, classes et matières sont conservés. Tapez <strong>CLOTURER</strong> pour confirmer.</p>
            <div class="form-group" style="max-width:280px">
              <label for="closureConfirm">Confirmation</label>
              <input id="closureConfirm" type="text" placeholder="CLOTURER" autocomplete="off">
            </div>
            <button type="button" class="btn" id="closureBtn" style="background:#b91c1c">🔒 Clôturer l'année scolaire</button>
            <p id="closureStatus" role="status" aria-live="polite"></p>
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
  const schoolYearSelect = container.querySelector('#schoolYearSelect');
  const schoolYearCustom = container.querySelector('#schoolYearCustom');
  const schoolYearSave = container.querySelector('#schoolYearSave');
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
    accountBody.innerHTML = (profiles || []).map(profile => {
      const profileRole = profile.role === 'chef-personnel' ? 'chef_personnel' : profile.role;
      const readOnly = profile.role === 'super_admin' || (state.user && state.user.id ? profile.id === state.user.id : false);
      const roleOptions = ADMIN_ROLES.map(([value, label]) =>
        `<option value="${value}" ${profileRole === value ? 'selected' : ''}>${label}</option>`
      ).join('');
      const accountName = profile.full_name || profile.identifiant || profile.id;
      const lastSeen = profile.derniere_activite ? new Date(profile.derniere_activite) : null;
      const hasValidLastSeen = lastSeen && !isNaN(lastSeen.getTime());
      const isOnline = hasValidLastSeen && (Date.now() - lastSeen.getTime()) < 3 * 60 * 1000;
      const presenceLabel = isOnline
        ? '🟢 En ligne'
        : (hasValidLastSeen
          ? `⚪ Hors ligne (vu le ${lastSeen.toLocaleDateString('fr-FR')} à ${lastSeen.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})`
          : '⚪ Hors ligne');
      return `
        <tr data-profile-id="${esc(profile.id)}" data-est-actif="${profile.est_actif === false ? '0' : '1'}">
          <td><strong>${esc(accountName)}</strong><br><small>${esc(profile.identifiant || profile.id)}</small><br><span data-user-presence>${presenceLabel}</span><br><span data-user-status style="font-weight:700;color:${profile.est_actif === false ? '#b45309' : '#15803d'}">${profile.est_actif === false ? '⏳ En attente' : '✅ Accès autorisé'}</span></td>
          <td><select data-user-role aria-label="Fonction de ${esc(accountName)}" ${readOnly ? 'disabled' : ''}>${roleOptions}</select></td>
          <td><select data-user-employment aria-label="Emploi de ${esc(accountName)}" ${readOnly ? 'disabled' : ''}>${employmentOptions(profileRole, profile.emploi)}</select></td>
          <td data-user-school-cell>${renderSchoolAssignment(profileRole, profile)}</td>
          <td>
            ${readOnly ? '<span>Protégé</span>' : `
              <button type="button" class="btn" data-action="save-user">💾 Enregistrer</button>
              <button type="button" class="btn" data-action="toggle-access">${profile.est_actif === false ? '✅ Donner accès' : '⛔ Suspendre'}</button>
              <button type="button" class="btn secondary" data-action="delete-user">🗑️ Supprimer</button>`}
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
        .select('id,identifiant,full_name,role,emploi,fonction,school_id,ecole_id,ecole_nom,ecoles_encadrees,followed_schools,est_actif,derniere_activite')
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
    if (schoolYearSelect) {
      const activeYear = activeSchoolYear || state.activeSchoolYear || DEFAULT_ACTIVE_SCHOOL_YEAR;
      const exists = Array.from(schoolYearSelect.options).some(option => option.value === activeYear);
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = activeYear;
        opt.textContent = activeYear;
        schoolYearSelect.insertBefore(opt, schoolYearSelect.querySelector('option[value="__custom__"]'));
      }
      schoolYearSelect.value = activeYear;
    }
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
    } else if (button.dataset.action === 'toggle-access') {
      const isActive = row.dataset.estActif === '1';
      const nextActive = !isActive;
      button.disabled = true;
      const { error } = await supabase.from('profiles').update({ est_actif: nextActive }).eq('id', profileId);
      if (error) {
        button.disabled = false;
        accountStatus.textContent = `Échec de la mise à jour de l'accès : ${error.message}`;
        accountStatus.style.color = '#b91c1c';
        return;
      }
      row.dataset.estActif = nextActive ? '1' : '0';
      const toggleBtn = row.querySelector('[data-action="toggle-access"]');
      if (toggleBtn) toggleBtn.textContent = nextActive ? '⛔ Suspendre' : '✅ Donner accès';
      const statusEl = row.querySelector('[data-user-status]');
      if (statusEl) {
        statusEl.textContent = nextActive ? '✅ Accès autorisé' : '⏳ En attente';
        statusEl.style.color = nextActive ? '#15803d' : '#b45309';
      }
      accountStatus.textContent = nextActive ? 'Accès accordé à l’utilisateur.' : 'Accès suspendu pour l’utilisateur.';
      accountStatus.style.color = '#15803d';
    } else if (button.dataset.action === 'delete-user') {
      const name = row.querySelector('strong')?.textContent || profileId;
      if (!window.confirm(`Supprimer définitivement le compte « ${name} » et son profil ?`)) return;
      button.disabled = true;
      const { error } = await supabase.rpc('admin_delete_user', { target_user_id: profileId });
      if (error) {
        button.disabled = false;
        accountStatus.textContent = `Échec de la suppression : ${error.message}`;
        accountStatus.style.color = '#b91c1c';
        return;
      }
      row.remove();
      accountStatus.textContent = 'Compte supprimé.';
      accountStatus.style.color = '#15803d';
    }
  });

  function syncSchoolYearCustom() {
    const isCustom = schoolYearSelect && schoolYearSelect.value === '__custom__';
    if (schoolYearCustom) {
      schoolYearCustom.style.display = isCustom ? '' : 'none';
      schoolYearCustom.required = !!isCustom;
    }
  }
  if (schoolYearSelect) schoolYearSelect.addEventListener('change', syncSchoolYearCustom);
  syncSchoolYearCustom();

  async function saveActiveSchoolYear() {
    const year = schoolYearSelect && schoolYearSelect.value === '__custom__'
      ? (schoolYearCustom ? schoolYearCustom.value.trim() : '')
      : (schoolYearSelect ? schoolYearSelect.value : '');
    if (!/^\d{4}-\d{4}$/.test(year)) {
      schoolYearStatus.textContent = 'Format attendu : AAAA-AAAA (ex. 2026-2027).';
      schoolYearStatus.style.color = '#b91c1c';
      return;
    }
    if (schoolYearSave) schoolYearSave.disabled = true;
    const { data, error } = await supabase.rpc('admin_set_school_year', { p_year: year });
    if (error) {
      schoolYearStatus.textContent = `Échec : ${error.message}`;
      schoolYearStatus.style.color = '#b91c1c';
      if (schoolYearSave) schoolYearSave.disabled = false;
      return;
    }
    const activeYear = data || year;
    state.activeSchoolYear = activeYear;
    try { localStorage.setItem('educ_ceb_active_school_year', activeYear); } catch (e) {}
    try {
      const { error: anneesError } = await supabase.from('annees_scolaires').upsert({ year: activeYear, is_active: true }, { onConflict: 'year' });
      if (anneesError) console.warn('annees_scolaires indisponible :', anneesError.message);
    } catch (e) { console.warn(e); }
    schoolYearStatus.textContent = `Année active : ${activeYear}`;
    schoolYearStatus.style.color = '#15803d';
    if (schoolYearSave) schoolYearSave.disabled = false;
    if (schoolYearSelect) {
      const exists = Array.from(schoolYearSelect.options).some(option => option.value === activeYear);
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = activeYear;
        opt.textContent = activeYear;
        schoolYearSelect.insertBefore(opt, schoolYearSelect.querySelector('option[value="__custom__"]'));
      }
      schoolYearSelect.value = activeYear;
      syncSchoolYearCustom();
    }
  }
  if (schoolYearSave) schoolYearSave.addEventListener('click', saveActiveSchoolYear);

  container.querySelector('#closureBtn')?.addEventListener('click', async (event) => {
    const input = container.querySelector('#closureConfirm');
    const status = container.querySelector('#closureStatus');
    const confirmation = (input && input.value ? input.value : '').trim();
    if (confirmation !== 'CLOTURER') {
      status.textContent = 'Tapez CLOTURER pour confirmer la clôture.';
      status.style.color = '#b91c1c';
      return;
    }
    if (!window.confirm('Confirmez-vous la clôture de l’année scolaire ? Cette action est irréversible.')) return;
    event.currentTarget.disabled = true;
    const tables = ['notes', 'notes_examens_blancs', 'examens_blancs', 'presences', 'registres_mensuels', 'eleves', 'presences_agents'];
    const errors = [];
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) errors.push(`${table} : ${error.message}`);
    }
    event.currentTarget.disabled = false;
    if (errors.length) {
      status.textContent = 'Clôture partielle — ' + errors.join(' | ');
      status.style.color = '#b91c1c';
      return;
    }
    status.textContent = 'Année scolaire clôturée.';
    status.style.color = '#15803d';
    await loadAdminData();
  });

  loadAdminData();
}
