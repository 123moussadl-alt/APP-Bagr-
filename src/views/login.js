/**
 * Vue de connexion — Identifiant simple sans Gmail
 */

export function renderLogin({ onRegister, onLogin }) {
  return `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-flag">
            <div class="flag-stripe red"></div>
            <div class="flag-stripe green"></div>
            <div class="flag-star">★</div>
          </div>
          <h1>Educ CEB Bagré</h1>
          <p>Connexion — Circonscription d'Éducation de Base</p>
        </div>

        <form id="loginForm" class="auth-form">
          <div class="form-group">
            <label>Identifiant (téléphone ou nom d'utilisateur)</label>
            <input type="text" name="identifiant" placeholder="Ex: 0701234567 ou m.diallo" required>
          </div>
          <div class="form-group">
            <label>Mot de passe</label>
            <input type="password" name="password" required>
          </div>
          <button type="submit" class="btn-primary">Se connecter</button>
        </form>

        <button type="button" class="btn-install" data-action="install-app">📲 Installer / Télécharger l'application</button>
        <p class="auth-footer">
          Pas encore de compte ? <button type="button" class="auth-link register-btn">Créer un compte</button>
        </p>
        <div class="auth-admin-access">
          <button type="button" class="auth-admin-link">🛡️ Admin</button>
        </div>
      </div>
    </div>
  `;
}

export function setupLogin(container, { onRegister, onLogin, onInstall }) {
  const form = container.querySelector('#loginForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      try {
        await onLogin({
          identifiant: formData.get('identifiant'),
          password: formData.get('password')
        });
      } catch (err) {
        // Erreur affichée par onLogin via showToast
      }
    });
  }

  const registerBtn = container.querySelector('.register-btn');
  if (registerBtn && onRegister) {
    registerBtn.addEventListener('click', () => onRegister());
  }

  const adminBtn = container.querySelector('.auth-admin-link');
  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      const identifier = form && form.querySelector('[name="identifiant"]');
      if (identifier) {
        identifier.placeholder = 'Identifiant Administrateur Principal';
        identifier.focus();
      }
    });
  }

  const installBtn = container.querySelector('[data-action="install-app"]');
  if (installBtn && onInstall) {
    installBtn.addEventListener('click', onInstall);
  }
}
