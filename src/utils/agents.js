export const agentMonths = [
  'Octobre', 'Novembre', 'Décembre', 'Janvier',
  'Février', 'Mars', 'Avril', 'Mai'
];

const monthIndexes = {
  Octobre: 9, Novembre: 10, Décembre: 11,
  Janvier: 0, Février: 1, Mars: 2, Avril: 3, Mai: 4
};

export function getCurrentSchoolYearStart(date = new Date()) {
  return date.getMonth() >= 9 ? date.getFullYear() : date.getFullYear() - 1;
}

export function getSchoolMonthPeriod(startYear, monthName) {
  const month = monthIndexes[monthName];
  if (month == null) throw new Error('Mois scolaire invalide : ' + monthName);
  const year = month >= 9 ? startYear : startYear + 1;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
    end: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    year
  };
}

export function formatISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function previousWorkingDate(date = new Date()) {
  const workingDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (workingDate.getDay() === 6) workingDate.setDate(workingDate.getDate() - 1);
  if (workingDate.getDay() === 0) workingDate.setDate(workingDate.getDate() - 2);
  return formatISODate(workingDate);
}

export function isWeekday(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function monthNameForDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return agentMonths.find(name => monthIndexes[name] === date.getMonth()) ||
    ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][date.getMonth()];
}

export function getAgentNameParts(profile) {
  let nom = String(profile.nom || '').trim();
  let prenom = String(profile.prenom || '').trim();
  if (!nom && !prenom && profile.full_name) {
    const parts = String(profile.full_name).trim().split(/\s+/);
    prenom = parts.shift() || '';
    nom = parts.join(' ');
  }
  return { nom, prenom };
}

const EMPLOYMENT_OPTIONS = [
  { value: 'PE', label: 'PE — Professeur des Écoles' },
  { value: 'PCE', label: 'PCE — Professeur Certifié des Écoles' },
  { value: 'IEPNF', label: "IEPNF — Inspecteur de l'Éducation Préscolaire et Non Formelle" }
];

const FUNCTION_BY_ROLE = {
  titulaire: 'Agent',
  directeur: 'Directeur',
  encadreur: 'Encadreur',
  chef_personnel: 'Chef du Personnel',
  'chef-personnel': 'Chef du Personnel',
  statisticien: 'Statisticien',
  chef_ceb: 'Chef de la CEB'
};

const LEGACY_FUNCTION_LABELS = new Map([
  ['agent', 'Agent'],
  ['titulaire', 'Agent'],
  ['directeur', 'Directeur'],
  ['encadreur', 'Encadreur'],
  ['chef du personnel', 'Chef du Personnel'],
  ['chef-personnel', 'Chef du Personnel'],
  ['statisticien', 'Statisticien'],
  ['chef de la ceb', 'Chef de la CEB'],
  ['chef ceb', 'Chef de la CEB']
]);

const EMPLOI_CODES = new Set(EMPLOYMENT_OPTIONS.map(option => option.value));

export function getRoleFunction(role) {
  return FUNCTION_BY_ROLE[String(role || '').trim()] || '';
}

export function getAgentFunction(profile = {}) {
  const roleFunction = getRoleFunction(profile.role);
  if (roleFunction) return roleFunction;
  const legacyFunction = String(profile.fonction || '').trim().toLowerCase();
  return LEGACY_FUNCTION_LABELS.get(legacyFunction) || '—';
}

export function getEmploymentOptions(role) {
  if (role === 'encadreur' || role === 'chef_ceb') {
    return EMPLOYMENT_OPTIONS.filter(option => option.value === 'IEPNF');
  }
  return EMPLOYMENT_OPTIONS.filter(option => option.value !== 'IEPNF');
}

export function normalizeEmployment(value, role) {
  const employment = String(value || '').trim().toUpperCase();
  return getEmploymentOptions(role).some(option => option.value === employment) ? employment : '';
}

export function getAgentEmployment(profile) {
  const normalize = value => String(value || '').trim().toUpperCase();
  const emploi = normalize(profile.emploi);
  if (EMPLOI_CODES.has(emploi)) return emploi;
  const legacyFonction = normalize(profile.fonction);
  return EMPLOI_CODES.has(legacyFonction) ? legacyFonction : '—';
}

function agentBackupKey(schoolId, date) {
  return `presences-agents-${schoolId}-${date}`;
}

export function readDailyAgentBackup(schoolId, date) {
  try {
    const value = localStorage.getItem(agentBackupKey(schoolId, date));
    if (!value) return [];
    const records = JSON.parse(value);
    return Array.isArray(records) ? records : [];
  } catch (error) {
    console.error('Impossible de lire la sauvegarde locale de présence des agents.', error);
    return [];
  }
}

export function writeDailyAgentBackup(schoolId, date, records) {
  localStorage.setItem(agentBackupKey(schoolId, date), JSON.stringify(records));
}

export function readLocalAgentRecordsForPeriod(schoolId, start, end) {
  const records = [];
  const current = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (current <= last) {
    const day = current.getDay();
    if (day >= 1 && day <= 5) {
      records.push(...readDailyAgentBackup(schoolId, formatISODate(current)));
    }
    current.setDate(current.getDate() + 1);
  }
  return records;
}

export function mergeAgentAttendanceRecords(remoteRecords, localRecords) {
  const merged = new Map();
  [...(remoteRecords || []), ...(localRecords || [])].forEach(record => {
    merged.set(`${record.agent_id}:${record.date_jour}`, record);
  });
  return Array.from(merged.values()).sort((a, b) =>
    String(a.date_jour).localeCompare(String(b.date_jour)) ||
    String(a.agent_id).localeCompare(String(b.agent_id))
  );
}

export function computeAgentMonthlyRows(profiles, records) {
  const byAgent = new Map();
  (records || []).forEach(record => {
    if (!byAgent.has(record.agent_id)) byAgent.set(record.agent_id, []);
    byAgent.get(record.agent_id).push(record);
  });
  return (profiles || []).map((agent, index) => {
    const rows = byAgent.get(agent.id) || [];
    const daysPointed = new Set(rows.map(row => row.date_jour)).size;
    const presences = rows.filter(row => row.present === true).length;
    const absences = rows.filter(row => row.present === false).length;
    const observations = Array.from(new Set(rows
      .map(row => String(row.observation || '').trim())
      .filter(Boolean))).join('; ');
    return {
      agent,
      number: index + 1,
      daysPointed,
      presences,
      absences,
      rate: daysPointed ? Math.round((presences / daysPointed) * 1000) / 10 : 0,
      observations
    };
  });
}
