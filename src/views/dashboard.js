/**
 * Tableau de bord de landing — Redirection selon le rôle
 */

export function renderDashboard(state, render) {
  const LT = '<';
  const role = state.profile?.role;
  const label = {
    titulaire: 'Titulaire de classe',
    directeur: 'Directeur d\'école',
    encadreur: 'Encadreur',
    chef_ceb: 'Chef CEB',
    chef_personnel: 'Chef du Personnel',
    statisticien: 'Statisticien'
  }[role] || 'Utilisateur';

  return `
    <div class="dashboard">
      <div class="topbar">
        <div class="topbar-left">
          <button class="btn secondary" onclick="window.logout()">🚪 Déconnexion</button>
        </div>
        <div class="topbar-right">
          <span class="user-badge">${label}</span>
        </div>
      </div>

      <div class="dashboard-content">
        <h1>Tableau de bord — ${label}</h1>
        <p>Bienvenue, <strong>${state.profile?.full_name || 'Utilisateur'}</strong>.</p>

        <div class="role-cards">
          ${role === 'titulaire' ? `
            \<div class="role-card">
              \<h3>📚 Ma classe\</h3>
              \<p>Gérez les élèves et les notes de votre classe.\</p>
              \<button class="btn" onclick="window.navigateTo('titulaire')">Accéder à ma classe\</button>
            \</div>
          ` : ''}
          ${role === 'directeur' ? `
            \<div class="role-card">
              \<h3>���� Mon école\</h3>
              \<p>Consultez les effectifs et résultats de votre école.\</p>
              \<button class="btn" onclick="window.navigateTo('directeur')">Voir mon école\</button>
            \</div>
          ` : ''}
          ${role === 'encadreur' ? `
            \<div class="role-card">
              \<h3>🏫 Mes écoles suivies\</h3>
              \<p>Consultez les écoles que vous encadrez.\</p>
              \<button class="btn" onclick="window.navigateTo('encadreur')">Voir mes écoles\</button>
            \</div>
          ` : ''}
          ${role === 'chef_ceb' ? `
            \<div class="role-card">
              \<h3>🏛️ Circonscription CEB\</h3>
              \<p>Vue d'ensemble de toute la circonscription.\</p>
              \<button class="btn" onclick="window.navigateTo('chef-ceb')">Accéder au CEB\</button>
            \</div>
          ` : ''}
          ${role === 'chef_personnel' ? `
            \<div class="role-card">
              \<h3>👥 Personnel de la CEB\</h3>
              \<p>Statistiques et liste nominative du personnel.\</p>
              \<button class="btn" onclick="window.navigateTo('chef-personnel')">Voir le personnel\</button>
            \</div>
          ` : ''}
          ${role === 'statisticien' ? `
            \<div class="role-card">
              \<h3>📊 Statistiques de la CEB\</h3>
              \<p>Effectifs, EDF et élèves en situation de handicap.\</p>
              \<button class="btn" onclick="window.navigateTo('statisticien')">Voir les statistiques\</button>
            \</div>
          ` : ''}
        </div>
      </div>
    </div>

    <style>
      .dashboard { padding: 24px; max-width: 1000px; margin: 0 auto; }
      .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
      .topbar-left { display: flex; gap: 12px; }
      .topbar-right { display: flex; align-items: center; gap: 12px; }
      .user-badge { background: #0f3d23; color: white; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
      .dashboard-content h1 { margin: 0 0 8px 0; color: #0f3d23; }
      .dashboard-content p { color: #64748b; margin-bottom: 24px; }
      .role-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
      .role-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; background: white; }
      .role-card h3 { margin: 0 0 8px 0; color: #0f3d23; }
      .role-card p { color: #64748b; font-size: 13px; margin-bottom: 16px; }
      .auth-container { display: flex; justify-content: center; align-items: center; min-height: 60vh; }
      .auth-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 32px; width: 100%; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
      .auth-header { text-align: center; margin-bottom: 24px; }
      .auth-flag { display: flex; justify-content: center; gap: 2px; margin-bottom: 12px; }
      .flag-stripe { width: 24px; height: 16px; }
      .flag-stripe.red { background: #dc2626; }
      .flag-stripe.green { background: #16a34a; }
      .flag-star { color: #fbbf24; font-size: 14px; line-height: 1; }
      .auth-header h1 { margin: 0 0 8px 0; color: #0f3d23; font-size: 20px; }
      .auth-header p { color: #64748b; font-size: 13px; margin: 0; }
      .auth-form { display: flex; flex-direction: column; gap: 12px; }
      .form-group { display: flex; flex-direction: column; gap: 4px; }
      .form-group label { font-size: 12px; font-weight: 600; color: #334155; }
      .form-group input, .form-group select { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; }
      .form-group small { font-size: 11px; color: #64748b; }
      .btn-primary { background: #0f3d23; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 8px; }
      .btn-primary:hover { background: #15803d; }
      .auth-footer { text-align: center; margin-top: 20px; font-size: 13px; color: #64748b; }
      .auth-footer .auth-link { background: none; border: none; color: #0f3d23; cursor: pointer; font-weight: 600; padding: 0; }
      .toast { position: fixed; right: 20px; bottom: 20px; background: #0f172a; color: white; border-radius: 5px; padding: 9px 14px; font-size: 12.5px; opacity: 0; transform: translateY(10px); transition: all 0.2s; z-index: 100; pointer-events: none; }
      .toast.show { opacity: 1; transform: translateY(0); }
    </style>
  `;
}
