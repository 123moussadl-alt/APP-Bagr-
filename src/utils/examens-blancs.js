/**
 * Module Examens Blancs (CM1 / CM2) — utilitaires partagés.
 * Niveaux officiels : Niveau École / Niveau CEB / Niveau Provincial.
 * Notes stockées exclusivement dans `notes_examens_blancs` (jamais les notes trimestrielles).
 */

import { esc } from './format.js';
import { signatureImageHTML, signatureUrlForProfile } from './signature.js';

export const EXAM_LEVELS = ['Niveau École', 'Niveau CEB', 'Niveau Provincial'];

export const EXAM_GIRL_STYLE = 'color:#dc2626;font-weight:600;';
export const EXAM_TOTAL_STYLE = 'color:#15803d;background-color:#f0fdf4;font-weight:700;';
export const EXAM_MOYENNE_STYLE = 'color:#1d4ed8;background-color:#eff6ff;font-weight:700;';
export const EXAM_RANG_STYLE = 'color:#7e22ce;background-color:#faf5ff;font-weight:700;';

export function examLevelLabel(niveau) {
  return EXAM_LEVELS.includes(niveau) ? niveau : (niveau || 'Niveau École');
}

export function examSessionLabel(exam) {
  if (!exam) return '';
  return exam.session_label || exam.name || '';
}

export function splitStudentName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  return { nom: parts[0] || '', prenom: parts.slice(1).join(' ') };
}

export function normalizeExamNotes(notes) {
  const map = {};
  (notes || []).forEach(note => {
    const eleveKey = note.eleve_id !== undefined ? 'eleve_id' : (note.student_id !== undefined ? 'student_id' : 'eleve_id');
    const matKey = note.matiere_id !== undefined ? 'matiere_id' : (note.subject_id !== undefined ? 'subject_id' : 'matiere_id');
    const noteKey = note.note !== undefined ? 'note' : (note.valeur !== undefined ? 'valeur' : 'note');
    map[`${note[eleveKey]}:${note[matKey]}`] = note[noteKey];
  });
  return map;
}

export function computeExamRows(students, subjects, notes) {
  const noteMap = normalizeExamNotes(notes);
  const rows = (students || []).map(student => {
    let sumPoints = 0;
    let sumPN = 0;
    let sumCoef = 0;
    let count = 0;
    subjects.forEach(subject => {
      const raw = noteMap[`${student.id}:${subject.id}`];
      if (raw === '' || raw == null) return;
      const value = parseFloat(raw);
      if (isNaN(value)) return;
      const max = parseFloat(subject.max) || 10;
      const coef = parseFloat(subject.coef) || 1;
      sumPoints += value;
      sumPN += (value / max) * coef;
      sumCoef += coef;
      count += 1;
    });
    const moyenne = (count > 0 && sumCoef > 0) ? (sumPN / sumCoef) * 10 : null;
    return {
      id: student.id,
      full_name: student.full_name || '',
      gender: student.gender || '',
      status: student.status || '',
      abandon: student.status === 'A',
      values: subjects.reduce((acc, subject) => {
        const raw = noteMap[`${student.id}:${subject.id}`];
        acc[subject.id] = (raw === '' || raw == null) ? '' : raw;
        return acc;
      }, {}),
      total: count > 0 ? sumPoints : null,
      moyenne,
      count
    };
  });

  const graded = rows.filter(row => row.moyenne != null && !row.abandon);
  const sorted = [...graded].sort((a, b) => b.moyenne - a.moyenne);
  const ties = {};
  graded.forEach(row => {
    const key = row.moyenne.toFixed(4);
    ties[key] = (ties[key] || 0) + 1;
  });
  const rankMap = {};
  let lastMoyenne = null;
  let lastRank = 0;
  sorted.forEach((row, index) => {
    const key = row.moyenne.toFixed(4);
    if (lastMoyenne === null || key !== lastMoyenne) {
      lastRank = index + 1;
      lastMoyenne = key;
    }
    rankMap[row.id] = { rank: lastRank, tie: (ties[key] || 0) > 1 };
  });

  rows.forEach(row => {
    const info = rankMap[row.id];
    row.rang = row.abandon ? 'A' : (info ? info.rank : '');
    row.rangTie = info ? info.tie : false;
  });

  return rows;
}

export function rangLabel(row) {
  if (row.abandon) return 'A';
  if (!row.rang) return '';
  const suffix = row.rang === 1 ? 'er' : 'e';
  return row.rang + suffix + (row.rangTie ? ' ex' : '');
}

function rate(part, total) {
  if (!total) return '—';
  return ((part / total) * 100).toFixed(1) + '%';
}

export function computeExamStats(rows, subjects) {
  const boys = rows.filter(row => row.gender === 'M');
  const girls = rows.filter(row => row.gender === 'F');
  const count = rows.length;
  const graded = rows.filter(row => row.moyenne != null && !row.abandon);
  const moyenneValues = graded.map(row => row.moyenne);
  return {
    boys: boys.length,
    girls: girls.length,
    total: count,
    graded: graded.length,
    average: moyenneValues.length ? (moyenneValues.reduce((a, b) => a + b, 0) / moyenneValues.length) : null,
    highest: moyenneValues.length ? Math.max(...moyenneValues) : null,
    lowest: moyenneValues.length ? Math.min(...moyenneValues) : null,
    bySubject: subjects.map(subject => {
      const max = parseFloat(subject.max) || 10;
      const seuil = max * 0.5;
      const g = boys.filter(row => row.values[subject.id] !== '' && parseFloat(row.values[subject.id]) >= seuil).length;
      const f = girls.filter(row => row.values[subject.id] !== '' && parseFloat(row.values[subject.id]) >= seuil).length;
      const t = g + f;
      return { subject, g, f, t, boysTotal: boys.length, girlsTotal: girls.length, total: count };
    })
  };
}

export function renderExamEntryTable(rows, subjects, selectedSubject, options = {}) {
  const subject = selectedSubject || subjects[0] || null;
  const head = `
    <thead>
      <tr>
        <th>N°</th>
        <th>Nom</th>
        <th>Prénom</th>
        <th>Sexe</th>
        <th id="examEntryNoteHeader">Note${subject ? ' — ' + esc(subject.name) + ' (/ ' + esc(subject.max) + ')' : ''}</th>
      </tr>
    </thead>`;
  const body = rows.map((row, index) => {
    const st = row.gender === 'F' ? EXAM_GIRL_STYLE : '';
    const { nom, prenom } = splitStudentName(row.full_name);
    return `
      <tr data-exam-row="${esc(row.id)}" data-gender="${esc(row.gender)}">
        <td style="${st}">${index + 1}</td>
        <td style="${st}">${esc(nom)}</td>
        <td style="${st}">${esc(prenom)}</td>
        <td style="${st}">${row.gender === 'M' ? 'M' : (row.gender === 'F' ? 'F' : '')}</td>
        <td style="${st}"><input type="number" step="0.01" min="0" max="${esc(subject ? subject.max : '')}" value="${esc(subject ? (row.values[subject.id] ?? '') : '')}" class="exam-grade-input" data-student="${esc(row.id)}" data-subject="${esc(subject ? subject.id : '')}"></td>
      </tr>`;
  }).join('') || '<tr><td colspan="5">Aucun élève</td></tr>';

  const overviewHead = `
    <thead>
      <tr>
        <th>N°</th>
        <th>Élève</th>
        <th>Sexe</th>
        ${subjects.map(item => `<th>${esc(item.name)} <span style="font-weight:400;color:#64748b">(/${esc(item.max)})</span></th>`).join('')}
        <th style="color:#15803d;background-color:#f0fdf4">Total</th>
        <th style="color:#1d4ed8;background-color:#eff6ff">Moyenne /10</th>
        <th style="color:#7e22ce;background-color:#faf5ff">Rang</th>
      </tr>
    </thead>`;
  const overviewBody = rows.map((row, index) => {
    const st = row.gender === 'F' ? EXAM_GIRL_STYLE : '';
    return `
      <tr data-exam-overview-row="${esc(row.id)}">
        <td style="${st}">${index + 1}</td>
        <td style="${st}"><strong>${esc(row.full_name)}</strong>${row.abandon ? ' <span style="color:#64748b;font-weight:700">(A)</span>' : ''}</td>
        <td style="${st}">${row.gender === 'M' ? 'M' : (row.gender === 'F' ? 'F' : '')}</td>
        ${subjects.map(item => `<td style="${st}">${esc(row.values[item.id] ?? '')}</td>`).join('')}
        <td data-exam-total="${esc(row.id)}" style="${EXAM_TOTAL_STYLE}${st}">${row.total != null ? row.total : '—'}</td>
        <td data-exam-moyenne="${esc(row.id)}" style="${EXAM_MOYENNE_STYLE}${st}">${row.moyenne != null ? row.moyenne.toFixed(2) : '—'}</td>
        <td data-exam-rang="${esc(row.id)}" style="${EXAM_RANG_STYLE}${st}">${esc(rangLabel(row))}</td>
      </tr>`;
  }).join('') || `<tr><td colspan="${subjects.length + 6}">Aucun élève</td></tr>`;

  return { head, body, overviewHead, overviewBody };
}

export function renderExamSyntheseHTML(context) {
  const {
    rows,
    subjects,
    classeLabel,
    niveau,
    sessionLabel,
    schoolName,
    titulaireName,
    titulaireSignature,
    directeurName,
    directeurSignature
  } = context;
  const stats = computeExamStats(rows, subjects);
  const titre = `FICHE SYNTHÈSE — EXAMEN BLANC (${examLevelLabel(niveau)})`;

  const effectifRow = `
    <tr>
      <td style="border:1px solid #333;padding:6px;font-weight:700">Effectif</td>
      <td style="border:1px solid #333;padding:6px;text-align:center">${stats.boys}</td>
      <td style="border:1px solid #333;padding:6px;text-align:center;color:#dc2626">${stats.girls}</td>
      <td style="border:1px solid #333;padding:6px;text-align:center;color:#16a34a;font-weight:700">${stats.total}</td>
    </tr>`;

  const disciplineRows = stats.bySubject.map(item => `
    <tr>
      <td style="border:1px solid #333;padding:6px">${esc(item.subject.name)}</td>
      <td style="border:1px solid #333;padding:6px;text-align:center">${item.g} <span style="color:#64748b">(${rate(item.g, item.boysTotal)})</span></td>
      <td style="border:1px solid #333;padding:6px;text-align:center;color:#dc2626">${item.f} <span style="color:#64748b">(${rate(item.f, item.girlsTotal)})</span></td>
      <td style="border:1px solid #333;padding:6px;text-align:center;color:#16a34a;font-weight:700">${item.t} <span style="color:#64748b">(${rate(item.t, item.total)})</span></td>
    </tr>`).join('') || '<tr><td colspan="4" style="border:1px solid #333;padding:6px;text-align:center">Aucune discipline</td></tr>';

  const titulaireImg = signatureImageHTML(signatureUrlForProfile({ signature_url: titulaireSignature }), 'Signature du titulaire');
  const directeurImg = signatureImageHTML(signatureUrlForProfile({ signature_url: directeurSignature }), 'Signature du directeur');

  return `
    <div style="font-family:Arial,sans-serif;color:#111827">
      <div style="text-align:center;margin-bottom:8px">
        <div style="font-weight:800;font-size:15px">BURKINA FASO</div>
        <div style="font-weight:700">La Patrie ou la Mort, nous Vaincrons</div>
        <div style="font-weight:700">${esc(schoolName || 'CEB de Bagré')}</div>
        <div style="font-weight:800;font-size:15px;margin-top:4px">${esc(titre)}</div>
        <div style="font-weight:700">Classe : ${esc(classeLabel || '')}${sessionLabel ? ' — ' + esc(sessionLabel) : ''}</div>
      </div>

      <table style="border-collapse:collapse;width:100%;margin-bottom:12px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="border:1px solid #333;padding:6px">Bilan général</th>
            <th style="border:1px solid #333;padding:6px">Garçons</th>
            <th style="border:1px solid #333;padding:6px;color:#dc2626">Filles</th>
            <th style="border:1px solid #333;padding:6px;color:#16a34a">Total</th>
          </tr>
        </thead>
        <tbody>
          ${effectifRow}
          <tr>
            <td style="border:1px solid #333;padding:6px;font-weight:700">Moyenne de la classe</td>
            <td colspan="3" style="border:1px solid #333;padding:6px;text-align:center">${stats.average != null ? stats.average.toFixed(2) + ' / 10' : '—'}</td>
          </tr>
          <tr>
            <td style="border:1px solid #333;padding:6px;font-weight:700">Plus forte / plus faible moyenne</td>
            <td colspan="3" style="border:1px solid #333;padding:6px;text-align:center">${stats.highest != null ? stats.highest.toFixed(2) : '—'} / ${stats.lowest != null ? stats.lowest.toFixed(2) : '—'}</td>
          </tr>
        </tbody>
      </table>

      <table style="border-collapse:collapse;width:100%;margin-bottom:12px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="border:1px solid #333;padding:6px">Taux de réussite par discipline</th>
            <th style="border:1px solid #333;padding:6px">Garçons</th>
            <th style="border:1px solid #333;padding:6px;color:#dc2626">Filles</th>
            <th style="border:1px solid #333;padding:6px;color:#16a34a">Total</th>
          </tr>
        </thead>
        <tbody>${disciplineRows}</tbody>
      </table>

      <div style="border:1px solid #333;padding:8px;margin-bottom:14px;min-height:70px">
        <div style="font-weight:700;margin-bottom:4px">PAI / Difficultés et Suggestions</div>
        <div style="color:#64748b;font-size:12px">Zone réservée aux observations du titulaire et du directeur.</div>
      </div>

      <table style="border-collapse:collapse;width:100%">
        <tbody>
          <tr>
            <td style="width:50%;border:1px solid #333;padding:8px;text-align:center;vertical-align:top">
              <div style="font-weight:700">Le(s) Titulaire(s)</div>
              ${titulaireImg}
              <div>${esc(titulaireName || '')}</div>
            </td>
            <td style="width:50%;border:1px solid #333;padding:8px;text-align:center;vertical-align:top">
              <div style="font-weight:700">Le Directeur / La Directrice</div>
              ${directeurImg}
              <div>${esc(directeurName || '')}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

export function examSyntheseCSVRows(rows, subjects, classeLabel, niveau, sessionLabel) {
  const stats = computeExamStats(rows, subjects);
  const lines = [
    ['BURKINA FASO', '', '', '', ''],
    ['La Patrie ou la Mort, nous Vaincrons', '', '', '', ''],
    ['CEB de Bagré', '', '', '', ''],
    [`FICHE SYNTHÈSE — EXAMEN BLANC (${examLevelLabel(niveau)})`, '', '', '', ''],
    [`Classe : ${classeLabel || ''}${sessionLabel ? ' — ' + sessionLabel : ''}`, '', '', '', ''],
    [],
    ['Bilan général', 'Garçons', 'Filles', 'Total'],
    ['Effectif', stats.boys, stats.girls, stats.total],
    ['Moyenne de la classe', stats.average != null ? stats.average.toFixed(2) : '', '', ''],
    ['Plus forte moyenne', stats.highest != null ? stats.highest.toFixed(2) : '', '', ''],
    ['Plus faible moyenne', stats.lowest != null ? stats.lowest.toFixed(2) : '', '', ''],
    [],
    ['Taux de réussite par discipline', 'Garçons', 'Filles', 'Total'],
    ...stats.bySubject.map(item => [
      item.subject.name,
      `${item.g} (${rate(item.g, item.boysTotal)})`,
      `${item.f} (${rate(item.f, item.girlsTotal)})`,
      `${item.t} (${rate(item.t, item.total)})`
    ]),
    [],
    ['Le(s) Titulaire(s)', 'Le Directeur / La Directrice']
  ];
  return lines;
}