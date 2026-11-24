import { ADMIN_MASTER_EMAIL } from '../supabaseClient.js';

/**
 * Vue de connexion — Identifiant simple sans Gmail
 */

export function renderLogin({ adminAccess = false } = {}) {
  return `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-flag">
            <div class="flag-stripe red"></div>
            <div class="flag-stripe green"></div>
            <div class="flag-star">★</div>
          </div>
          <h1>${adminAccess ? "Espace Administrateur Principal — Educ'CEB Bagré" : 'Educ CEB Bagré'}</h1>
          <p>${adminAccess ? 'Connectez-vous avec votre compte administrateur vérifié.' : "Connexion — Circonscription d'Éducation de Base"}</p>
        </div>

        <form id="${adminAccess ? 'adminLoginForm' : 'loginForm'}" class="auth-form">
          ${adminAccess
            ? `
              <div class="form-group">
                <label for="adminCode">Code Maître Administrateur</label>
                <input id="adminCode" type="password" name="adminCode" autocomplete="current-password" required>
              </div>
            `
            : `
              <div class="form-group">
                <label>Identifiant (téléphone ou nom d'utilisateur)</label>
                <input type="text" name="identifiant" placeholder="Ex: 0701234567 ou m.diallo" required>
              </div>
              <div class="form-group">
                <label>Mot de passe</label>
                <input type="password" name="password" required>
              </div>
              <button type="button" class="auth-link forgot-btn" style="display:block;margin:-4px 0 10px;font-size:13px">Mot de passe oublié ?</button>
            `}
          <button type="submit" class="btn-primary">${adminAccess ? 'Accéder au panneau Admin' : 'Se connecter'}</button>
        </form>

        ${adminAccess
          ? '<p class="auth-footer"><a class="auth-link" href="/">Retour à la connexion</a></p>'
          : `
            <button type="button" class="btn-install" data-action="install-app">📲 Installer / Télécharger l'application</button>
            <p class="auth-footer">
              Pas encore de compte ? <button type="button" class="auth-link register-btn">Créer un compte</button>
            </p>
          `}
      </div>
    </div>
  `;
}

export function renderAdminLogin() {
  return renderLogin({ adminAccess: true });
}

export function renderLanding() {
  const features = [
    ['📋', 'Registres d\'appel à jour', 'Appel journalier, demi-journées et mois clôturés, calculés automatiquement.'],
    ['📊', 'Bulletins trimestriels & annuels', 'Bulletins 3 par page A4 paysage, prêts à imprimer ou exporter en PDF.'],
    ['📈', 'Bilans trimestriels & Statistiques CEB', 'Synthèses par classe, par école et bilan global de la circonscription.'],
    ['🎓', 'Examens Blancs & Candidats CEP', 'Examens blancs CM1/CM2 (École, CEB, Provincial) et liste officielle des candidats.'],
    ['☁️', 'Sauvegarde sécurisée Google Drive', 'Export de vos données en classeur Excel, partage direct vers Google Drive.']
  ];
  return `
    <div class="landing-page">
      <header class="landing-header">
        <div class="landing-brand">
          <span class="landing-logo">🎓</span>
          <strong>Educ'CEB Bagré</strong>
        </div>
        <div class="landing-actions">
          <button type="button" class="btn landing-btn" data-action="go-login">🔐 Se connecter</button>
          <button type="button" class="btn landing-btn secondary" data-action="go-register">✨ Créer un compte</button>
        </div>
      </header>

      <section class="landing-hero">
        <h1>Educ'CEB Bagré</h1>
        <p class="landing-slogan">🎓 La rigueur pédagogique et l'innovation numérique au cœur de chaque classe de Bagré.</p>
        <p class="landing-sub">Plateforme officielle de gestion scolaire de la Circonscription d'Éducation de Base de Bagré (Burkina Faso).</p>
        <button type="button" class="btn landing-cta" data-action="go-login">Commencer / Se connecter</button>
      </section>

      <section class="landing-features">
        ${features.map(([icon, title, text]) => `
          <article class="landing-card">
            <div class="landing-card-icon">${icon}</div>
            <h2>${esc(title)}</h2>
            <p>${esc(text)}</p>
          </article>`).join('')}
      </section>

      <footer class="landing-footer">© ${new Date().getFullYear()} Educ'CEB Bagré — Circonscription d'Éducation de Base de Bagré</footer>
    </div>
  `;
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function setupLogin(container, { onRegister, onLogin, onInstall, onForgot, onGoLogin, onGoRegister }) {
  const form = container.querySelector('#loginForm, #adminLoginForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      try {
        const masterCodeInput = (formData.get('adminCode') || '').toString().trim();
        const credentials = form.id === 'adminLoginForm'
          ? { identifiant: ADMIN_MASTER_EMAIL, password: masterCodeInput }
          : {
            identifiant: formData.get('identifiant'),
            password: formData.get('password')
          };
        await onLogin(credentials);
      } catch (err) {
        // Erreur affichée par onLogin via showToast
      }
    });
  }

  const registerBtn = container.querySelector('.register-btn');
  if (registerBtn && onRegister) {
    registerBtn.addEventListener('click', () => onRegister());
  }

  const installBtn = container.querySelector('[data-action="install-app"]');
  if (installBtn && onInstall) {
    installBtn.addEventListener('click', onInstall);
  }

  const forgotBtn = container.querySelector('.forgot-btn');
  if (forgotBtn && onForgot) {
    forgotBtn.addEventListener('click', () => onForgot());
  }

  const goLogin = container.querySelector('[data-action="go-login"]');
  if (goLogin && onGoLogin) goLogin.addEventListener('click', () => onGoLogin());
  const goRegister = container.querySelector('[data-action="go-register"]');
  if (goRegister && onGoRegister) goRegister.addEventListener('click', () => onGoRegister());
}

export function renderForgotPassword() {
  return `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-flag">
            <div class="flag-stripe red"></div>
            <div class="flag-stripe green"></div>
            <div class="flag-star">★</div>
          </div>
          <h1>Mot de passe oublié</h1>
          <p>Vérifiez votre identité pour réinitialiser votre mot de passe.</p>
        </div>
        <form id="forgotForm" class="auth-form">
          <div class="form-group">
            <label>Identifiant (Nom d'utilisateur / Email)</label>
            <input type="text" name="identifiant" required>
          </div>
          <div class="form-group">
            <label>Matricule officiel</label>
            <input type="text" name="matricule" required>
          </div>
          <div class="form-group">
            <label>Numéro de téléphone enregistré dans votre profil</label>
            <input type="tel" name="telephone" required>
          </div>
          <div class="form-group">
            <label>Nouveau mot de passe</label>
            <input type="password" name="newPassword" minlength="6" required>
          </div>
          <div class="form-group">
            <label>Confirmer le nouveau mot de passe</label>
            <input type="password" name="confirmPassword" minlength="6" required>
          </div>
          <p id="forgotStatus" role="status" aria-live="polite"></p>
          <button type="submit" class="btn-primary">Réinitialiser mon mot de passe</button>
        </form>
        <p class="auth-footer"><button type="button" class="auth-link" data-action="go-login">Retour à la connexion</button></p>
      </div>
    </div>
  `;
}

export function setupForgotPassword(container, { onDone, supabase }) {
  const form = container.querySelector('#forgotForm');
  const status = container.querySelector('#forgotStatus');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const identifiant = (data.get('identifiant') || '').toString().trim();
      const matricule = (data.get('matricule') || '').toString().trim();
      const telephone = (data.get('telephone') || '').toString().trim();
      const newPassword = (data.get('newPassword') || '').toString();
      const confirmPassword = (data.get('confirmPassword') || '').toString();
      if (newPassword.length < 6) {
        status.textContent = '❌ Le mot de passe doit contenir au moins 6 caractères.';
        status.style.color = '#dc2626';
        return;
      }
      if (newPassword !== confirmPassword) {
        status.textContent = '❌ Les deux mots de passe ne correspondent pas.';
        status.style.color = '#dc2626';
        return;
      }
      try {
        const { data: ok, error } = await supabase.rpc('self_reset_password', {
          p_identifiant: identifiant,
          p_matricule: matricule,
          p_telephone: telephone,
          p_new_password: newPassword
        });
        if (error) throw error;
        if (ok === true) {
          status.textContent = '✅ Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.';
          status.style.color = '#15803d';
          setTimeout(() => { if (onDone) onDone(); }, 1800);
        } else {
          status.textContent = "❌ Les informations saisies (Identifiant, Matricule ou Téléphone) ne correspondent à aucun compte. Vérifiez vos données ou contactez l'Administrateur Principal.";
          status.style.color = '#dc2626';
        }
      } catch (err) {
        status.textContent = '❌ ' + (err && err.message ? err.message : 'Erreur lors de la réinitialisation.');
        status.style.color = '#dc2626';
      }
    });
  }
  const back = container.querySelector('[data-action="go-login"]');
  if (back && onDone) back.addEventListener('click', () => onDone());
}
