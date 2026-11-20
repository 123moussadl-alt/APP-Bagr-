export function normalizePaiDiscipline(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function paiBackupKey(classId, term) {
  return `pai-${classId}-T${term}`;
}

export function readPaiBackup(classId, term) {
  try {
    const saved = localStorage.getItem(paiBackupKey(classId, term));
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (error) {
    console.error('Impossible de lire la sauvegarde locale du PAI.', error);
    return null;
  }
}

export function writePaiBackup(record) {
  const backup = { ...record, local_saved_at: new Date().toISOString() };
  localStorage.setItem(paiBackupKey(record.classe_id, record.trimestre), JSON.stringify(backup));
  return backup;
}

export async function loadPaiRecord(supabase, classId, term) {
  const backup = readPaiBackup(classId, term);
  const { data, error } = await supabase
    .from('pai')
    .select('*')
    .eq('classe_id', classId)
    .eq('trimestre', term)
    .limit(1);
  if (error) {
    if (backup) {
      console.warn('Lecture Supabase du PAI impossible; utilisation de la sauvegarde locale.', error);
      return backup;
    }
    throw error;
  }
  return backup ? { ...(data && data[0] ? data[0] : {}), ...backup } : (data && data[0]) || null;
}

export async function savePaiRecord(supabase, record) {
  const { data: existing, error: lookupError } = await supabase
    .from('pai')
    .select('classe_id,trimestre')
    .eq('classe_id', record.classe_id)
    .eq('trimestre', record.trimestre)
    .limit(1);
  if (lookupError) throw lookupError;

  if (existing && existing.length) {
    const { data: updated, error } = await supabase
      .from('pai')
      .update(record)
      .eq('classe_id', record.classe_id)
      .eq('trimestre', record.trimestre)
      .select('classe_id,trimestre');
    if (error) throw error;
    if (!updated || !updated.length) throw new Error('Aucune fiche PAI n’a été mise à jour dans Supabase.');
    return;
  }

  const { data: inserted, error } = await supabase
    .from('pai')
    .insert(record)
    .select('classe_id,trimestre');
  if (error) throw error;
  if (!inserted || !inserted.length) throw new Error('La fiche PAI n’a pas été insérée dans Supabase.');
}
