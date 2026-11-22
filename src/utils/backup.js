/**
 * Sauvegarde personnelle — génère un classeur .xlsx (sans macros) contenant
 * uniquement les données du rôle et du périmètre de l'utilisateur connecté.
 */

import * as XLSX from 'xlsx';

const ROLE_LABELS = {
  titulaire: 'Titulaire',
  directeur: 'Directeur',
  encadreur: 'Encadreur',
  chef_ceb: 'Chef_CEB',
  chef_personnel: 'Chef_du_Personnel',
  statisticien: 'Statisticien',
  responsable_examens: 'Responsable_Examens',
  super_admin: 'Administrateur'
};

function isoDate(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

function addSheet(workbook, name, rows) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Information: 'Aucune donnée' }]);
  const safeName = String(name).replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'Feuille';
  XLSX.utils.book_append_sheet(workbook, sheet, safeName);
}

async function fetchAll(supabase, build) {
  const { data, error } = await build();
  if (error) throw error;
  return data || [];
}

export async function buildBackupPack(state, supabase) {
  const profile = state.profile || {};
  const role = profile.role || 'titulaire';
  const roleLabel = ROLE_LABELS[role] || role || 'Utilisateur';
  const workbook = XLSX.utils.book_new();

  addSheet(workbook, 'Profil', [{
    Nom: profile.full_name || '',
    Identifiant: profile.identifiant || '',
    Role: roleLabel,
    Ecole: profile.ecole_nom || profile.schoolName || '',
    Classe: profile.classe_niveau || profile.classe_tenue || '',
    Date_sauvegarde: new Date().toLocaleString('fr-FR')
  }]);

  try {
    if (role === 'titulaire' && profile.class_id) {
      const students = await fetchAll(supabase, () => supabase.from('students').select('*').eq('class_id', profile.class_id).order('full_name'));
      addSheet(workbook, 'Eleves', students);

      const { data: subjects } = await supabase.from('matieres').select('*').eq('class_id', profile.class_id);
      addSheet(workbook, 'Matieres', subjects || []);

      const studentIds = students.map(student => student.id);
      if (studentIds.length) {
        const grades = await fetchAll(supabase, () => supabase.from('notes').select('*').in('eleve_id', studentIds));
        addSheet(workbook, 'Notes', grades);
      }
    } else if (role === 'directeur') {
      const schoolId = profile.school_id || profile.ecole_id || '';
      const classes = schoolId
        ? await fetchAll(supabase, () => supabase.from('classes').select('*').eq('school_id', schoolId))
        : await fetchAll(supabase, () => supabase.from('classes').select('*'));
      addSheet(workbook, 'Classes', classes);

      const classIds = classes.map(item => item.id);
      const students = classIds.length
        ? await fetchAll(supabase, () => supabase.from('students').select('*').in('class_id', classIds))
        : [];
      addSheet(workbook, 'Eleves', students);
    } else if (role === 'encadreur') {
      const followed = profile.ecoles_encadrees || profile.followed_schools || [];
      const ids = Array.isArray(followed) ? followed.map(String) : [];
      const schools = ids.length
        ? await fetchAll(supabase, () => supabase.from('schools').select('*').in('id', ids))
        : await fetchAll(supabase, () => supabase.from('schools').select('*'));
      addSheet(workbook, 'Ecoles_encadrees', schools);
    }

    const exams = await fetchAll(supabase, () => supabase.from('exam_blancs').select('*').order('created_at', { ascending: false }).limit(100));
    addSheet(workbook, 'Examens_blancs', exams);

    const examIds = exams.map(exam => exam.id);
    if (examIds.length) {
      const examNotes = await fetchAll(supabase, () => supabase.from('notes_examens_blancs').select('*').in('exam_blanc_id', examIds));
      addSheet(workbook, 'Notes_examens_blancs', examNotes);
    }

    const registers = await fetchAll(supabase, () => supabase.from('registre_configs').select('*').limit(500));
    addSheet(workbook, 'Registres_appel', registers);
  } catch (error) {
    addSheet(workbook, 'Erreur', [{ Message: error && error.message ? error.message : String(error) }]);
  }

  const filename = `Sauvegarde_CEB_Bagre_${roleLabel}_${isoDate()}.xlsx`;
  return { workbook, filename };
}

export function workbookToBlob(workbook) {
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Sauvegarde Educ CEB Bagré' });
      return 'shared';
    } catch (error) {
      if (error && error.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export function backupStorageKey(userId) {
  return `educ_ceb_last_backup_${userId || 'anonyme'}`;
}

export function lastBackupDate(userId) {
  try {
    return localStorage.getItem(backupStorageKey(userId)) || '';
  } catch (error) {
    return '';
  }
}

export function rememberBackupDate(userId, date = new Date()) {
  try {
    localStorage.setItem(backupStorageKey(userId), date.toISOString());
  } catch (error) {
    console.warn('Sauvegarde de la date impossible.', error);
  }
}