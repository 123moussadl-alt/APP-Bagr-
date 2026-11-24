/**
 * Fiche Synthèse Trimestrielle officielle (Burkina Faso / CEB de Bagré).
 * Utilisée par le Titulaire, le Directeur, l'Encadreur et le Chef de la CEB.
 */

import { esc, formatClassName, normalizeNotes } from './format.js';
import { normalizePaiDiscipline } from './pai.js';
import { signatureImageHTML, signaturePeopleHTML, signatureUrlForProfile } from './signature.js';

function round1(v) { return Math.round(v * 10) / 10; }

export function computeSubjectRows(students, subjects, notes, term) {
  notes = normalizeNotes(notes);
  const list = students || [];
  return (subjects || []).map(sub => {
    const subNotes = (notes || []).filter(n => n.trimestre === term && (n.matiere_id === sub.id || n.subject_id === sub.id));
    const max = parseFloat(sub.max) || 10;
    const seuil = max / 2;
    let bComp = 0, bPass = 0, gComp = 0, gPass = 0;
    subNotes.forEach(n => {
      if (n.note == null) return;
      const eleve = list.find(s => s.id === (n.eleve_id || n.student_id));
      if (!eleve || eleve.status === 'A') return;
      const val = parseFloat(n.note);
      if (eleve.gender === 'M') { bComp++; if (val >= seuil) bPass++; }
      else if (eleve.gender === 'F') { gComp++; if (val >= seuil) gPass++; }
    });
    const tComp = bComp + gComp;
    const tPass = bPass + gPass;
    return {
      name: sub.name, max,
      bComp, bPass, gComp, gPass, tComp, tPass,
      pctG: bComp ? round1(bPass / bComp * 100) : 0,
      pctF: gComp ? round1(gPass / gComp * 100) : 0,
      pctT: tComp ? round1(tPass / tComp * 100) : 0
    };
  });
}

export function computeClassAverageSummary(students, subjects, notes, term) {
  const activeStudents = (students || []).filter(student => student.status !== 'A');
  const normalizedNotes = normalizeNotes(notes);
  const averages = [];

  activeStudents.forEach(student => {
    let weightedTotal = 0;
    let totalCoefficient = 0;
    let count = 0;

    (subjects || []).forEach(subject => {
      const note = normalizedNotes.find(row =>
        row.eleve_id === student.id &&
        row.matiere_id === subject.id &&
        row.trimestre === term
      );
      if (!note || note.note == null || note.note === '') return;
      const value = parseFloat(note.note);
      if (!Number.isFinite(value)) return;
      const max = parseFloat(subject.max) || 10;
      const coefficient = parseFloat(subject.coef) || 1;
      weightedTotal += (value / max) * coefficient;
      totalCoefficient += coefficient;
      count++;
    });

    if (count && totalCoefficient > 0) {
      const average = weightedTotal / totalCoefficient * 10;
      if (Number.isFinite(average)) averages.push(average);
    }
  });

  const round = value => Math.round(value * 100) / 100;
  return averages.length
    ? {
      highest: round(Math.max(...averages)),
      lowest: round(Math.min(...averages)),
      classAverage: round(averages.reduce((sum, average) => sum + average, 0) / averages.length)
    }
    : { highest: null, lowest: null, classAverage: null };
}

/**
 * Taux de présence du dernier mois clôturé du trimestre.
 * T1 : Décembre ? Novembre ? Octobre ; T2 : Mars ? Février ? Janvier ; T3 : Juin ? Mai ? Avril.
 */
export function latestClosedMonthAttendanceRate(registres, term) {
  const order = term === 1
    ? ['Décembre', 'Novembre', 'Octobre']
    : (term === 2 ? ['Mars', 'Février', 'Janvier'] : ['Juin', 'Mai', 'Avril']);
  const list = registres || [];
  for (const month of order) {
    const row = list.find(item => String(item.mois || item.month || '').trim().toLowerCase() === month.toLowerCase());
    if (!row) continue;
    const possible = Number(row.presences_possibles != null ? row.presences_possibles : (row.possT != null ? row.possT : 0));
    const effective = Number(row.presences_effectives != null ? row.presences_effectives : (row.effT != null ? row.effT : 0));
    if (possible > 0) return Math.round((effective * 100 / possible) * 100) / 100;
  }
  return null;
}

export function renderBilanTrimestrielHTML({
  schoolName, cls, students, subjects, notes, term, pai,
  teacherNames, teacherSigners, visaDirecteur, visaDirecteurSignatureUrl,
  editable, activeSchoolYear, conseilByClass, attendanceRate: attendanceRateProp, registres
}) {
  const list = students || [];
  const boys = list.filter(s => s.gender === 'M');
  const girls = list.filter(s => s.gender === 'F');
  const year = activeSchoolYear || '';
  const className = formatClassName(cls || {});
  const termLabel = term === 1 ? '1' : (term === 2 ? '2' : '3');

  // élèves ayant composé (au moins une note ce trimestre, hors abandon)
  const noteStudentIds = new Set();
  (notes || []).forEach(n => {
    if (n.trimestre === term && n.note != null) noteStudentIds.add(n.eleve_id || n.student_id);
  });
  const composed = list.filter(s => s.status !== 'A' && noteStudentIds.has(s.id));
  const compBoys = composed.filter(s => s.gender === 'M').length;
  const compGirls = composed.filter(s => s.gender === 'F').length;

  // Moyennes individuelles pondérées (élèves ayant composé uniquement)
  const studentAverages = [];
  list.filter(s => s.status !== 'A').forEach(student => {
    let weighted = 0;
    let coefs = 0;
    let count = 0;
    (subjects || []).forEach(sub => {
      const n = (notes || []).find(row =>
        (row.eleve_id || row.student_id) === student.id &&
        (row.matiere_id || row.subject_id) === sub.id &&
        row.trimestre === term && row.note != null && row.note !== ''
      );
      if (!n) return;
      const value = parseFloat(n.note);
      if (!Number.isFinite(value)) return;
      const max = parseFloat(sub.max) || 10;
      const coef = parseFloat(sub.coef) || 1;
      weighted += (value / max) * coef;
      coefs += coef;
      count++;
    });
    if (count && coefs > 0) {
      const avg = (weighted / coefs) * 10;
      if (Number.isFinite(avg)) studentAverages.push({ student, avg });
    }
  });

  const ayantMoyenne = studentAverages.filter(item => item.avg >= 5);
  const ayantBoys = ayantMoyenne.filter(item => item.student.gender === 'M').length;
  const ayantGirls = ayantMoyenne.filter(item => item.student.gender === 'F').length;
  const pctAyant = (n, total) => total ? Math.round((n / total) * 1000) / 10 : 0;

  const avgValues = studentAverages.map(item => item.avg);
  const forte = avgValues.length ? Math.max(...avgValues) : null;
  const faible = avgValues.length ? Math.min(...avgValues) : null;
  const moyenne = avgValues.length ? avgValues.reduce((a, b) => a + b, 0) / avgValues.length : null;
  const fmtAvg = value => value != null ? value.toFixed(2) : '0.00';

  // Taux de fréquentation : dernier mois clôturé du trimestre
  let attendanceRate = attendanceRateProp != null ? attendanceRateProp : null;
  if (attendanceRate == null && Array.isArray(registres)) {
    attendanceRate = latestClosedMonthAttendanceRate(registres, term);
  }
  if (attendanceRate == null && typeof window !== 'undefined' && window.__cebAttendanceRate != null) {
    attendanceRate = window.__cebAttendanceRate;
  }
  const attendanceText = attendanceRate != null ? attendanceRate.toFixed(2) + ' %' : '—';

  // Distribution par tranche entière (0 ? 10)
  const brackets = [];
  for (let i = 0; i <= 10; i++) brackets.push({ label: String(i), count: 0 });
  studentAverages.forEach(item => {
    const value = Math.max(0, Math.min(10, item.avg));
    const index = Math.min(10, Math.floor(value));
    brackets[index].count++;
  });

  // PAI
  const discipline = (pai && pai.discipline) ? pai.discipline : ((subjects && subjects[0]) ? subjects[0].name : '');
  const tauxDepart = (pai && pai.taux_depart != null && pai.taux_depart !== '') ? parseFloat(pai.taux_depart) : null;
  const normalizedDiscipline = normalizePaiDiscipline(discipline);
  const paiRow = computeSubjectRows(list, subjects, notes, term).find(r =>
    normalizePaiDiscipline(r.name) === normalizedDiscipline && r.tComp > 0
  );
  const tauxTrim = paiRow ? paiRow.pctT : null;
  const tauxTrimManual = (pai && pai.taux_trimestre != null && pai.taux_trimestre !== '') ? parseFloat(pai.taux_trimestre) : null;
  const tauxTrimFinal = paiRow ? tauxTrim : tauxTrimManual;
  const ecart = (tauxTrimFinal != null && tauxDepart != null) ? Math.round((tauxTrimFinal - tauxDepart) * 10) / 10 : null;
  const ecartText = ecart == null ? '—' : (ecart >= 0 ? '+' : '') + ecart.toFixed(1) + '%';

  const teacherStr = (teacherNames || []).filter(name => name && !String(name).includes('Aperçu')).join(', ') || 'Le(s) Titulaire(s)';
  const disciplineControl = editable
    ? `<input type="text" id="paiDiscipline" class="pai-disc" list="paiSubjectOptions" value="${esc(discipline)}" placeholder="Discipline"><datalist id="paiSubjectOptions">${(subjects || []).map(s => `<option value="${esc(s.name)}"></option>`).join('')}</datalist>`
    : `<strong>${esc(discipline || '—')}</strong>`;
  const tauxControl = editable
    ? `<div style="position:relative;display:inline-block"><input type="number" id="paiTaux" class="pai-taux" min="0" max="100" step="0.1" value="${tauxDepart != null ? tauxDepart : ''}" placeholder="Ex: 45" style="padding-right:24px"><span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);color:#64748b;font-weight:700">%</span></div>`
    : `<strong>${tauxDepart != null ? tauxDepart + '%' : '—'}</strong>`;
  const decisionControl = editable
    ? `<input type="text" id="paiDecision" class="pai-decision" value="${esc((pai && pai.decision) || 'Poursuivre')}" style="width:100%">`
    : `<strong>${esc((pai && pai.decision) || 'Poursuivre')}</strong>`;

  const subjectRows = computeSubjectRows(list, subjects, notes, term);

  const classColumn = String(className || '').toUpperCase();

  return `
    <div class="synthese-sheet">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #000;padding-bottom:6px">
        <div style="font-size:11pt;line-height:1.35;text-align:left;flex:1">
          <strong style="font-size:11pt">CIRCONSCRIPTION D'EDUCATION DE BASE DE BAGRE</strong><br>
          <span>*-*-*-*-*-*</span><br>
          <strong>ECOLE PRIMAIRE PUBLIQUE DE ${esc(schoolName || '—')}</strong><br>
          <strong>Classe : ${esc(className)}</strong>
        </div>
        <div style="font-size:11pt;line-height:1.35;flex:1;display:flex;flex-direction:column;align-items:center;text-align:center">
          <strong style="font-size:11pt">BURKINA FASO</strong>
          <span>*-*-*-*-*-*</span>
          <em>La Patrie ou la Mort nous Vaincrons</em>
          <strong style="color:#1d4ed8">Année Scolaire : ${esc(year)}</strong>
        </div>
      </div>

      <div style="width:100%;text-align:center;margin:10px 0 12px">
        <strong style="font-size:15pt;font-weight:800;letter-spacing:.3px;text-decoration:underline">BILAN Trimestriel n° ${esc(termLabel)}</strong>
      </div>

      <div style="display:grid;grid-template-columns:44% 56%;gap:10px;align-items:start">
        <div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <table style="width:100%;border-collapse:collapse;border:1px solid #000">
              <tbody>
                <tr><td colspan="2" style="border:1px solid #000;padding:4px 6px;font-weight:700;text-decoration:underline">Effectif début d'année</td></tr>
                <tr><td style="border:1px solid #000;padding:3px 6px">Garçons</td><td style="border:1px solid #000;padding:3px 6px;text-align:center">${boys.length}</td></tr>
                <tr><td style="border:1px solid #000;padding:3px 6px;color:#dc2626">Filles</td><td style="border:1px solid #000;padding:3px 6px;text-align:center;color:#dc2626">${girls.length}</td></tr>
                <tr><td style="border:1px solid #000;padding:3px 6px;color:#16a34a">Total</td><td style="border:1px solid #000;padding:3px 6px;text-align:center;color:#16a34a">${list.length}</td></tr>
              </tbody>
            </table>
            <table style="width:100%;border-collapse:collapse;border:1px solid #000">
              <tbody>
                <tr><td colspan="2" style="border:1px solid #000;padding:4px 6px;font-weight:700;text-decoration:underline">Effectif composé</td></tr>
                <tr><td style="border:1px solid #000;padding:3px 6px">Garçons</td><td style="border:1px solid #000;padding:3px 6px;text-align:center">${compBoys}</td></tr>
                <tr><td style="border:1px solid #000;padding:3px 6px;color:#dc2626">Filles</td><td style="border:1px solid #000;padding:3px 6px;text-align:center;color:#dc2626">${compGirls}</td></tr>
                <tr><td style="border:1px solid #000;padding:3px 6px;color:#16a34a">Total</td><td style="border:1px solid #000;padding:3px 6px;text-align:center;color:#16a34a">${composed.length}</td></tr>
              </tbody>
            </table>
          </div>

          <table style="width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:10px">
            <thead>
              <tr style="background:#f1f5f9">
                <th style="border:1px solid #000;padding:4px 6px;text-align:left">Ayant la moyenne</th>
                <th style="border:1px solid #000;padding:4px 6px">Nombre</th>
                <th style="border:1px solid #000;padding:4px 6px">Pourcentage (%)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="border:1px solid #000;padding:3px 6px">Garçons</td><td style="border:1px solid #000;padding:3px 6px;text-align:center">${ayantBoys}</td><td style="border:1px solid #000;padding:3px 6px;text-align:center">${pctAyant(ayantBoys, compBoys)} %</td></tr>
              <tr><td style="border:1px solid #000;padding:3px 6px;color:#dc2626">Filles</td><td style="border:1px solid #000;padding:3px 6px;text-align:center;color:#dc2626">${ayantGirls}</td><td style="border:1px solid #000;padding:3px 6px;text-align:center;color:#dc2626">${pctAyant(ayantGirls, compGirls)} %</td></tr>
              <tr><td style="border:1px solid #000;padding:3px 6px;color:#16a34a">Total</td><td style="border:1px solid #000;padding:3px 6px;text-align:center;color:#16a34a">${ayantMoyenne.length}</td><td style="border:1px solid #000;padding:3px 6px;text-align:center;color:#16a34a">${pctAyant(ayantMoyenne.length, composed.length)} %</td></tr>
            </tbody>
          </table>

          <div style="font-weight:700;text-decoration:underline;margin-bottom:4px">Nombre d'élèves par moyenne</div>
          <table style="width:100%;border-collapse:collapse;table-layout:auto;border:1px solid #000;margin-bottom:10px">
            <tbody>
              <tr>
                <td style="border:1px solid #000;padding:4px 8px;background:#f1f5f9;font-weight:700;white-space:nowrap;min-width:72px">Moyenne</td>
                ${brackets.map(b => `<td style="border:1px solid #000;padding:2px 3px;min-width:24px;text-align:center">${b.label}</td>`).join('')}
              </tr>
              <tr>
                <td style="border:1px solid #000;padding:4px 8px;font-weight:700;white-space:nowrap;min-width:72px">Nombre</td>
                ${brackets.map(b => `<td style="border:1px solid #000;padding:2px 3px;min-width:24px;text-align:center">${b.count}</td>`).join('')}
              </tr>
            </tbody>
          </table>

          <div style="margin-bottom:10px">
            <div style="text-decoration:underline;font-weight:700">PAI</div>
            <div>Discipline : ${disciplineControl}</div>
            <div>% de début : ${tauxControl}</div>
            <div>% du trimestre : ${tauxTrimFinal != null ? tauxTrimFinal + ' %' : '—'}</div>
            <div>Ecart : ${esc(ecartText)}</div>
            <div>Décision : ${decisionControl}</div>
          </div>
        </div>

        <div>
          <div style="font-weight:800;text-align:center;margin-bottom:6px;font-size:11pt">Pourcentage de réussite par Discipline</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #000">
            <thead>
              <tr style="background:#f1f5f9">
                <th rowspan="2" style="border:1px solid #000;padding:5px">Matière</th>
                <th colspan="2" style="border:1px solid #000;padding:5px">Garçons</th>
                <th colspan="2" style="border:1px solid #000;padding:5px;color:#dc2626">Filles</th>
                <th colspan="2" style="border:1px solid #000;padding:5px;color:#16a34a">Total</th>
              </tr>
              <tr style="background:#f1f5f9">
                <th style="border:1px solid #000;padding:4px">Nbre</th>
                <th style="border:1px solid #000;padding:4px">%</th>
                <th style="border:1px solid #000;padding:4px">Nbre</th>
                <th style="border:1px solid #000;padding:4px">%</th>
                <th style="border:1px solid #000;padding:4px">Nbre</th>
                <th style="border:1px solid #000;padding:4px">%</th>
              </tr>
            </thead>
            <tbody>
              ${subjectRows.map(r => `
                <tr>
                  <td style="border:1px solid #000;padding:5px">${esc(r.name)}</td>
                  <td style="border:1px solid #000;padding:5px;text-align:center">${r.bPass}</td>
                  <td style="border:1px solid #000;padding:5px;text-align:center">${r.pctG}%</td>
                  <td style="border:1px solid #000;padding:5px;text-align:center;color:#dc2626">${r.gPass}</td>
                  <td style="border:1px solid #000;padding:5px;text-align:center;color:#dc2626">${r.pctF}%</td>
                  <td style="border:1px solid #000;padding:5px;text-align:center;color:#16a34a">${r.tPass}</td>
                  <td style="border:1px solid #000;padding:5px;text-align:center;color:#16a34a"><strong>${r.pctT}%</strong></td>
                </tr>
              `).join('') || '<tr><td colspan="7" style="border:1px solid #000;padding:5px;text-align:center">Aucune matière</td></tr>'}
            </tbody>
          </table>

          <table style="width:100%;border-collapse:collapse;border:1px solid #000;margin-top:12px">
            <tbody>
              <tr><td style="border:1px solid #000;padding:4px 8px;font-weight:700;width:60%">Forte moyenne</td><td style="border:1px solid #000;padding:4px 8px;text-align:center">${fmtAvg(forte)}</td></tr>
              <tr><td style="border:1px solid #000;padding:4px 8px;font-weight:700">Faible moyenne</td><td style="border:1px solid #000;padding:4px 8px;text-align:center">${fmtAvg(faible)}</td></tr>
              <tr><td style="border:1px solid #000;padding:4px 8px;font-weight:700">Moyenne de la classe</td><td style="border:1px solid #000;padding:4px 8px;text-align:center"><strong>${fmtAvg(moyenne)}</strong></td></tr>
              <tr><td style="border:1px solid #000;padding:4px 8px;font-weight:700">Taux de fréquentation</td><td style="border:1px solid #000;padding:4px 8px;text-align:center">${esc(attendanceText)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style="margin:10px auto;width:80%;text-align:center">
        <div style="font-weight:700;text-decoration:underline;margin-bottom:4px">Difficultés rencontrées et suggestions</div>
        ${editable
          ? `<textarea id="syntheseDifficultes" rows="3" style="width:100%;padding:4px;border:1px dotted #333;resize:vertical">${esc((pai && pai.difficultes) || '')}</textarea>`
          : `<div style="border-bottom:1px dotted #333;min-height:22px">${esc((pai && pai.difficultes) || '')}</div><div style="border-bottom:1px dotted #333;min-height:22px"></div>`}
      </div>

      <div style="margin-top:16px">
        <div style="text-align:center;font-weight:800;text-decoration:underline;font-size:12pt">Le conseil des maîtres</div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:6px 0 12px;font-size:9pt;text-align:center">
          ${['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'].map(label => {
            const signers = (conseilByClass && conseilByClass[label])
              || (label === classColumn ? (teacherSigners || []) : []);
            const imgs = (signers || []).map(person => signatureImageHTML(signatureUrlForProfile(person), 'Signature de ' + (person.full_name || label))).join('<br>');
            const names = (signers || []).map(person => esc(person.full_name || '')).join('<br>');
            return `<div style="border:1px solid #000;padding:4px;min-height:48px">
              <div style="font-weight:700;text-decoration:underline">${esc(label)}</div>
              <div style="min-height:48px;margin-top:2px">${imgs}</div>
              <div>${names}</div>
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;gap:24px">
          <div style="flex:1;text-align:center">
            <div style="border-top:1px solid #333;padding-top:4px;font-weight:700">Le Maître chargé du cours</div>
            <div style="margin-top:4px">${signaturePeopleHTML(teacherSigners, teacherStr)}</div>
          </div>
          <div style="flex:1;text-align:center">
            <div style="border-top:1px solid #333;padding-top:4px;font-weight:700">Monsieur le Directeur de l'école</div>
            <div style="margin-top:4px">${signatureImageHTML(visaDirecteurSignatureUrl, 'Signature du Directeur')}${esc(visaDirecteur || '')}</div>
          </div>
        </div>
      </div>
    </div>`;
}

export function renderSyntheseHTML(props) {
  return renderBilanTrimestrielHTML(props);
}