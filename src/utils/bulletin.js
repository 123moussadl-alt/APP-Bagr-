/**
 * Générateur de bulletins trimestriels imprimables (A4).
 * Utilisé par Titulaire, Encadreur et Directeur.
 */

import { esc } from './format.js';
import { signaturePeopleHTML } from './signature.js';

function findNote(notes, eleveId, matiereId, term) {
  if (!notes) return null;
  return notes.find(n => {
    const ne = (n.eleve_id != null && n.eleve_id !== '') ? n.eleve_id : n.student_id;
    const nm = (n.matiere_id != null && n.matiere_id !== '') ? n.matiere_id : n.subject_id;
    const nt = (n.trimestre != null && n.trimestre !== '') ? n.trimestre : n.term;
    return ne === eleveId && nm === matiereId && parseInt(nt, 10) === term;
  }) || null;
}

function noteVal(n) {
  if (!n) return null;
  if (n.note != null && n.note !== '') return n.note;
  if (n.valeur != null && n.valeur !== '') return n.valeur;
  if (n.score != null && n.score !== '') return n.score;
  return null;
}

function rankSuffix(rank, isGirl, tie) {
  let s = rank === 1 ? (isGirl ? 'ère' : 'er') : 'e';
  if (tie) s += ' ex';
  return rank + s;
}

export function renderBulletinsHTML({ students, subjects, notes, term, className, schoolName, teacherName, teacherSigners }) {
  const stats = students.map(s => {
    let sumPoints = 0, sumPN = 0, sumCoef = 0, count = 0;
    const rows = subjects.map(sub => {
      const n = findNote(notes, s.id, sub.id, term);
      const note = noteVal(n);
      if (note != null && !isNaN(note)) {
        const max = parseFloat(sub.max) || 10;
        const coef = parseFloat(sub.coef) || 1;
        sumPoints += note;
        sumPN += (note / max) * coef;
        sumCoef += coef;
        count++;
      }
      return { sub, note };
    });
    const moy = (count > 0 && sumCoef > 0) ? (sumPN / sumCoef * 10) : null;
    return { s, rows, sumPoints, moy, count, isGirl: s.gender === 'F' };
  });

  const graded = stats.filter(x => x.moy != null);
  const sorted = [...graded].sort((a, b) => b.moy - a.moy);
  const rankMap = {};
  const moyCount = {};
  graded.forEach(x => { const k = x.moy.toFixed(4); moyCount[k] = (moyCount[k] || 0) + 1; });
  let lastMoy = null, lastRank = 0;
  sorted.forEach((x, i) => {
    const k = x.moy.toFixed(4);
    if (lastMoy === null || k !== lastMoy) { lastRank = i + 1; lastMoy = k; }
    rankMap[x.s.id] = { rank: lastRank, tie: (moyCount[k] || 0) > 1 };
  });

  const termLabel = term === 1 ? 'Trimestre 1' : (term === 2 ? 'Trimestre 2' : 'Trimestre 3');

return stats.map(x => {
    const r = rankMap[x.s.id];
    const rang = x.s.status === 'A' ? 'A' : (r ? rankSuffix(r.rank, x.isGirl, r.tie) : '—');
    const abandon = x.s.status === 'A';
    const nameStyle = x.isGirl ? 'color:#dc2626;font-weight:700' : 'font-weight:700';
    const totalStudents = students.length;
    const sumMax = subjects.reduce((a, s) => a + (parseFloat(s.max) || 10), 0);
    const rowsHtml = x.rows.map(row => {
      const noteTxt = row.note != null ? (esc(row.note) + ' / ' + esc(row.sub.max)) : '—';
      return '<tr>' +
        '<td style="border:1px solid #333;padding:6px">' + esc(row.sub.name) + '</td>' +
        '<td style="border:1px solid #333;padding:6px;text-align:center">' + noteTxt + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="2" style="border:1px solid #333;padding:6px;text-align:center">Aucune matière</td></tr>';
    const printExact = '-webkit-print-color-adjust:exact;print-color-adjust:exact';
    const totalRow = '<tr style="' + printExact + '">' +
      '<td style="border:1px solid #333;padding:6px;color:#047857;font-weight:700">TOTAL</td>' +
      '<td style="border:1px solid #333;padding:6px;text-align:center;color:#047857;font-weight:700">' + (x.count > 0 ? x.sumPoints + ' / ' + sumMax : '—') + '</td>' +
      '</tr>';
    const moyRow = '<tr style="' + printExact + '">' +
      '<td style="border:1px solid #333;padding:6px;color:#1d4ed8;font-weight:700">MOYENNE</td>' +
      '<td style="border:1px solid #333;padding:6px;text-align:center;color:#1d4ed8;font-weight:700">' + (x.moy != null ? x.moy.toFixed(2) + ' / 10' : '—') + '</td>' +
      '</tr>';
    const rangRow = '<tr style="' + printExact + '">' +
      '<td style="border:1px solid #333;padding:6px;color:#9f1239;font-weight:700">RANG</td>' +
      '<td style="border:1px solid #333;padding:6px;text-align:center;color:#9f1239;font-weight:700">' + (rang !== '—' ? rang + ' / ' + totalStudents + ' élèves' : '—') + '</td>' +
      '</tr>';
    const tbodyHtml = abandon
      ? '<tr><td colspan="2" style="border:1px solid #333;padding:6px;text-align:center;color:#dc2626;font-weight:700">ABANDON (A)</td></tr>'
      : (rowsHtml + totalRow + moyRow + rangRow);
    return `
      <div class="bulletin-sheet">
        <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px">
          <strong style="font-size:16px;letter-spacing:.5px">CEB DE BAGRÉ</strong><br>
          <span>${esc(schoolName || '')}</span><br>
          <strong>${esc(termLabel)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;gap:12px">
          <div><strong>Élève :</strong> <span style="${nameStyle}">${esc(x.s.full_name)}</span>${abandon ? ' <strong style="color:#dc2626">[ABANDON (A)]</strong>' : ''}</div>
          <div><strong>Classe :</strong> ${esc(className || '')}</div>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="border:1px solid #333;padding:6px;text-align:left">Matière</th>
              <th style="border:1px solid #333;padding:6px;width:150px">Note obtenue</th>
            </tr>
          </thead>
          <tbody>${tbodyHtml}</tbody>
        </table>
        <div style="display:flex;justify-content:space-between;margin-top:34px">
          <div style="text-align:center;flex:1">
            <div style="border-top:1px solid #333;padding-top:4px;margin:0 24px">Le(s) Titulaire(s)</div>
            <div style="margin:0 24px">${signaturePeopleHTML(teacherSigners, teacherName || '')}</div>
          </div>
          <div style="text-align:center;flex:1">
            <div style="border-top:1px solid #333;padding-top:4px;margin:0 24px">Les Parents / Tuteur</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function rankRows(rows, field) {
  const graded = rows.filter(row => !row.abandon && row[field] != null);
  const sorted = [...graded].sort((a, b) => b[field] - a[field]);
  const counts = {};
  graded.forEach(row => {
    const key = row[field].toFixed(4);
    counts[key] = (counts[key] || 0) + 1;
  });
  const result = {};
  let previous = null;
  let rank = 0;
  sorted.forEach((row, index) => {
    const key = row[field].toFixed(4);
    if (previous !== key) {
      rank = index + 1;
      previous = key;
    }
    result[row.s.id] = { rank, tie: counts[key] > 1 };
  });
  return result;
}

function decisionMarkup(row) {
  const raw = String(row.decision || '').trim();
  if (row.abandon || raw === 'Abandon (A)') {
    return '<span style="color:#64748b;font-weight:700">Abandon (A)</span>';
  }
  if (raw === 'Redouble') {
    return '<span style="color:#dc2626;font-weight:800">Redouble</span>';
  }
  return '<span style="color:#16a34a;font-weight:800">Passe en classe supérieure</span>';
}

export function renderBulletinsAnnuelsHTML({ rows, className, schoolName, teacherName, teacherSigners, studentId }) {
  const list = rows || [];
  const ranks = {
    t1: rankRows(list, 't1'),
    t2: rankRows(list, 't2'),
    t3: rankRows(list, 't3'),
    annual: rankRows(list, 'annual')
  };
  const totalStudents = list.length;
  const selected = studentId ? list.filter(row => String(row.s.id) === String(studentId)) : list;
  const periodRow = (row, label, field, rankMap) => {
    const rank = rankMap[row.s.id];
    const average = row[field] == null ? '—' : `${row[field].toFixed(2)} / 10`;
    const rankText = row.abandon
      ? 'Abandon (A)'
      : (rank ? `${rankSuffix(rank.rank, row.isGirl, rank.tie)} / ${totalStudents} élèves` : '—');
    return `<tr>
      <th style="border:1px solid #333;padding:10px 14px;text-align:left">${label}</th>
      <td style="border:1px solid #333;padding:10px 14px;text-align:center">${average}</td>
      <td style="border:1px solid #333;padding:10px 14px;text-align:center">${rankText}</td>
    </tr>`;
  };

  return selected.map(row => {
    const nameStyle = row.isGirl ? 'color:#dc2626;font-weight:700' : 'color:#111;font-weight:700';
    const annualRank = row.abandon
      ? `Abandon (A) — ${rankSuffix(totalStudents, row.isGirl, false)} / ${totalStudents} élèves`
      : (ranks.annual[row.s.id]
        ? `${rankSuffix(ranks.annual[row.s.id].rank, row.isGirl, ranks.annual[row.s.id].tie)} / ${totalStudents} élèves`
        : '—');
    return `<div class="bulletin-sheet bulletin-annuel-sheet" style="font-family:Arial,sans-serif;width:100%;max-width:100%;margin:0 auto 22px;background:#fff;color:#111;padding:12px;box-sizing:border-box">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;border-bottom:2px solid #111;padding-bottom:8px">
        <div style="font-size:14px;line-height:1.45">
          <strong style="font-size:16px">CEB de Bagré</strong><br>
          <strong>École : ${esc(schoolName || '—')}</strong><br>
          <strong>Classe : ${esc(className || '—')}</strong>
        </div>
        <div class="official-motto" style="display:flex;flex-direction:column;align-items:center;flex:1;text-align:center;font-size:14px;line-height:1.5;padding-top:4px">
          <strong>Burkina Faso</strong>
          <em>La Patrie ou la Mort, nous vaincrons</em>
        </div>
      </div>
      <h2 style="margin:12px 0;text-align:center;font-size:19px;letter-spacing:.3px">BULLETIN ANNUEL</h2>
      <div style="display:flex;justify-content:space-between;gap:12px;border:1px solid #333;padding:10px 14px;margin-bottom:12px;font-size:15px">
        <div><strong>Décision :</strong> ${decisionMarkup(row)}</div>
        <div><strong>Effectif :</strong> ${totalStudents} élèves</div>
      </div>
      <div style="display:flex;justify-content:space-between;gap:12px;border:1px solid #333;padding:10px 14px;margin-bottom:12px;font-size:15px">
        <div><strong>Nom et Prénom :</strong> <span style="${nameStyle}">${esc(row.s.full_name || '')}</span></div>
        <div><strong>Sexe :</strong> ${row.s.gender === 'F' ? 'F' : 'M'}</div>
      </div>
      <table style="width:100%;max-width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px">
        <thead>
          <tr>
            <th style="border:1px solid #333;padding:10px 14px;text-align:left">Période</th>
            <th style="border:1px solid #333;padding:10px 14px">Moyenne</th>
            <th style="border:1px solid #333;padding:10px 14px">Rang</th>
          </tr>
        </thead>
        <tbody>
          ${periodRow(row, '1er Trimestre', 't1', ranks.t1)}
          ${periodRow(row, '2e Trimestre', 't2', ranks.t2)}
          ${periodRow(row, '3e Trimestre', 't3', ranks.t3)}
          <tr style="-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <th style="border:1px solid #333;padding:10px 14px;text-align:left">Bilan Annuel</th>
            <td style="border:1px solid #333;padding:10px 14px;text-align:center;color:#16a34a;font-weight:800">${row.annual == null ? '—' : `${row.annual.toFixed(2)} / 10`}</td>
            <td style="border:1px solid #333;padding:10px 14px;text-align:center">${annualRank}</td>
          </tr>
        </tbody>
      </table>
      <div style="display:flex;justify-content:space-between;gap:24px;margin-top:42px;font-size:14px">
        <div style="flex:1;text-align:center">
          <div style="font-weight:700">Le(s) Titulaire(s)</div>
          <div style="border-top:1px solid #333;padding-top:5px;margin:12px 18px 0;font-weight:700">${signaturePeopleHTML(teacherSigners, teacherName || '')}</div>
        </div>
        <div style="flex:1;text-align:center">
          <div style="font-weight:700">Le Directeur / La Directrice</div>
          <div style="border-top:1px solid #333;padding-top:5px;margin:12px 18px 0">&nbsp;</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

export function annualBulletinCSVRows(rows, className) {
  const list = rows || [];
  const ranks = {
    t1: rankRows(list, 't1'),
    t2: rankRows(list, 't2'),
    t3: rankRows(list, 't3'),
    annual: rankRows(list, 'annual')
  };
  const totalStudents = list.length;
  const rankText = (row, rank) => row.abandon
    ? 'Abandon (A)'
    : (rank ? `${rankSuffix(rank.rank, row.isGirl, rank.tie)} / ${totalStudents} élèves` : '—');
  const decisionText = row => {
    const raw = String(row.decision || '').trim();
    if (row.abandon || raw === 'Abandon (A)') return 'Abandon (A)';
    if (raw === 'Redouble') return 'Redouble';
    return 'Passe en classe supérieure';
  };
  return [
    ['Nom et Prénom', 'Sexe', 'Classe', 'Moyenne T1', 'Rang T1', 'Moyenne T2', 'Rang T2', 'Moyenne T3', 'Rang T3', 'Moyenne annuelle', 'Rang annuel', 'Décision'],
    ...list.map(row => [
      row.s.full_name || '',
      row.s.gender === 'F' ? 'F' : 'M',
      className || '',
      row.t1 == null ? '' : row.t1.toFixed(2),
      rankText(row, ranks.t1[row.s.id]),
      row.t2 == null ? '' : row.t2.toFixed(2),
      rankText(row, ranks.t2[row.s.id]),
      row.t3 == null ? '' : row.t3.toFixed(2),
      rankText(row, ranks.t3[row.s.id]),
      row.annual == null ? '' : row.annual.toFixed(2),
      row.abandon
        ? `Abandon (A) — ${rankSuffix(totalStudents, row.isGirl, false)} / ${totalStudents} élèves`
        : rankText(row, ranks.annual[row.s.id]),
      decisionText(row)
    ])
  ];
}