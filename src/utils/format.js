/**
 * Utilitaires de formatage — Educ CEB Bagré
 */

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatNumber(val) {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    return Number.isInteger(val) ? String(val) : String(Math.round(val * 100) / 100);
  }
  return String(val);
}

export function formatClassName(classe) {
  const division = String((classe && classe.division) || '').trim();
  const parts = [classe && classe.level, classe && classe.name, division && division.toLowerCase() !== 'unique' ? division : '']
    .map(value => String(value || '').trim())
    .filter(Boolean);
  const seen = new Set();
  return parts.join(' ').split(/\s+/).filter(token => {
    const key = token.toLocaleUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(' ');
}

export function formatPct(val) {
  if (val === null || val === undefined || isNaN(val)) return '0%';
  const pct = Math.round(val * 10000) / 100;
  return pct + '%';
}

export function formatPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('226')) return '+' + digits;
  if (digits.startsWith('0') && digits.length === 9) return '+226' + digits.substring(1);
  if (digits.length === 8) return '+226' + digits;
  return phone;
}

export function formatDateFr(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function roleLabel(role) {
  const labels = {
    titulaire: 'Titulaire de classe',
    directeur: 'Directeur d\'école',
    encadreur: 'Encadreur',
    chef_ceb: 'Chef CEB',
    chef_personnel: 'Chef du Personnel',
    statisticien: 'Statisticien',
    responsable_examens: 'Responsable des Examens et Concours'
  };
  return labels[role] || role;
}

export function levelLabel(level) {
  const labels = { CP1: 'CP1', CP2: 'CP2', CE1: 'CE1', CE2: 'CE2', CM1: 'CM1', CM2: 'CM2' };
  return labels[level] || level;
}

export function defaultSubjects(_level) {
  return [
    { id: 'francais', name: 'Français', max: 10 },
    { id: 'math', name: 'Mathématiques', max: 10 },
    { id: 'eveil', name: 'Éveil / Sciences', max: 10 },
    { id: 'eps', name: 'Éducation Physique', max: 10 }
  ];
}

/**
 * Normalise les lignes de notes (tolère eleve_id/student_id,
 * matiere_id/subject_id, note/valeur, trimestre/term) vers un format
 * standard { eleve_id, matiere_id, trimestre, note }.
 */
export function normalizeNotes(notes) {
  if (!notes || !notes.length) return [];
  const s = notes[0];
  const eleveKey = s.eleve_id !== undefined ? 'eleve_id' : (s.student_id !== undefined ? 'student_id' : 'eleve_id');
  const matKey = s.matiere_id !== undefined ? 'matiere_id' : (s.subject_id !== undefined ? 'subject_id' : 'matiere_id');
  const noteKey = s.note !== undefined ? 'note' : (s.valeur !== undefined ? 'valeur' : 'note');
  const termKey = s.trimestre !== undefined ? 'trimestre' : (s.term !== undefined ? 'term' : 'trimestre');
  return notes.map(n => ({
    eleve_id: n[eleveKey],
    matiere_id: n[matKey],
    trimestre: parseInt(n[termKey], 10),
    note: n[noteKey]
  }));
}