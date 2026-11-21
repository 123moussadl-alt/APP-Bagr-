export const DEFAULT_SCHOOL_NAMES = [
  'Bagré Périmètre "A"',
  'Bagré Périmètre "B"',
  'Bagré Périmètre "C"',
  'Bagré Périmètre "D"',
  'Bagré Peulh',
  'Bagré Village',
  'Bagré V2',
  'Bagré V4',
  'Bagré V5',
  'Bagré V11',
  'Bagré V12',
  'Bégassé',
  'Bouakla',
  'Douka',
  'Goudayéré',
  'Guingalé',
  'Hihoudé',
  'Ounvin',
  'Patta Publique',
  'Poussouwaka',
  'Kalakoudi',
  'Saint Bénoît Abbé',
  'Sangaboulé',
  'Sabiloul Falah',
  'Sabiloul Houda',
  'Sabiloul Raçad'
];

function normalizeSchoolName(name) {
  return String(name || '').trim().normalize('NFC').toLocaleLowerCase('fr-FR');
}

const SCHOOL_NAME_ALIASES = new Map([
  ['Bagré Centre A', 'Bagré Périmètre "A"'],
  ['Bagré Centre B', 'Bagré Périmètre "B"'],
  ['École A de Bagré', 'Bagré Périmètre "A"'],
  ['École B de Bagré', 'Bagré Périmètre "B"'],
  ['École C de Bagré', 'Bagré Peulh'],
  ['École de Goudayéré', 'Goudayéré'],
  ['École de Dirlakou', 'Sangaboulé'],
  ['École de Dirlakoula', 'Sangaboulé'],
  ['Dirlakou', 'Sangaboulé'],
  ['Dirlakoula', 'Sangaboulé'],
  ['Sangabouli', 'Sangaboulé'],
  ['Sanga Boulé', 'Sangaboulé'],
  ['Boakla', 'Bouakla']
].map(([alias, official]) => [normalizeSchoolName(alias), official]));

export function mergeSchoolChoices(databaseSchools = []) {
  const rows = (Array.isArray(databaseSchools) ? databaseSchools : [])
    .filter(school => String(school && school.ceb || '').toUpperCase() !== 'ARCHIVE');
  const officialNames = new Set(DEFAULT_SCHOOL_NAMES.map(normalizeSchoolName));
  const officialRows = new Map();

  rows.forEach(school => {
    const rawName = String(school && school.name || '').trim();
    if (!rawName) return;
    const normalizedName = normalizeSchoolName(rawName);
    const officialName = SCHOOL_NAME_ALIASES.get(normalizedName) || rawName;
    const key = normalizeSchoolName(officialName);
    if (!officialNames.has(key)) return;

    const existing = officialRows.get(key);
    const isExactName = normalizedName === key;
    if (!existing || (isExactName && existing.isAlias)) {
      officialRows.set(key, {
        ...school,
        name: officialName,
        isFallback: false,
        isAlias: !isExactName
      });
    }
  });

  const choices = DEFAULT_SCHOOL_NAMES.map(name => {
    const key = normalizeSchoolName(name);
    return officialRows.get(key) || { id: name, name, isFallback: true };
  });
  const seen = new Set(officialNames);

  rows.forEach(school => {
    const name = String(school && school.name || '').trim();
    const key = normalizeSchoolName(name);
    if (!name || seen.has(key) || SCHOOL_NAME_ALIASES.has(key)) return;
    seen.add(key);
    choices.push({ ...school, isFallback: false });
  });

  return choices;
}
