export const DEFAULT_ACTIVE_SCHOOL_YEAR = '2026-2027';

export async function fetchActiveSchoolYear(supabase) {
  const { data, error } = await supabase.rpc('get_active_school_year');
  if (error) {
    console.error('Impossible de charger l’année scolaire active; utilisation de la valeur par défaut.', error);
    return DEFAULT_ACTIVE_SCHOOL_YEAR;
  }

  const schoolYear = typeof data === 'string' ? data.trim() : '';
  return /^\d{4}-\d{4}$/.test(schoolYear) ? schoolYear : DEFAULT_ACTIVE_SCHOOL_YEAR;
}
