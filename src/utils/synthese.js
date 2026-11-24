/**
 * Fiche SynthÃ¨se Trimestrielle officielle (Burkina Faso / CEB de BagrÃ©).
 * UtilisÃ©e par le Titulaire et l'Encadreur.
 */

import { esc, formatClassName, normalizeNotes } from './format.js';
import { normalizePaiDiscipline } from './pai.js';
import { signatureImageHTML, signaturePeopleHTML } from './signature.js';

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

export function renderSyntheseHTML({ schoolName, cls, students, subjects, notes, term, pai, teacherNames, teacherSigners, visaDirecteur, visaDirecteurSignatureUrl, editable }) {
  notes = normalizeNotes(notes);
  const list = students || [];
  const boys = list.filter(s => s.gender === 'M');
  const girls = list.filter(s => s.gender === 'F');

  // Ã‰lÃ¨ves ayant composÃ© (au moins une note ce trimestre, hors abandon)
  const noteStudentIds = new Set();
  (notes || []).forEach(n => {
    if (n.trimestre === term && n.note != null) noteStudentIds.add(n.eleve_id || n.student_id);
  });
  const composed = list.filter(s => s.status !== 'A' && noteStudentIds.has(s.id));
  const compBoys = composed.filter(s => s.gender === 'M').length;
  const compGirls = composed.filter(s => s.gender === 'F').length;

  const subjectRows = computeSubjectRows(list, subjects, notes, term);
  const averageSummary = computeClassAverageSummary(list, subjects, notes, term);
  const formatAverage = value => value == null ? 'â€”' : `${value.toFixed(2)} / 10`;

  // PAI
  const discipline = (pai && pai.discipline) ? pai.discipline : (subjects[0] ? subjects[0].name : '');
  const tauxDepart = (pai && pai.taux_depart != null && pai.taux_depart !== '') ? parseFloat(pai.taux_depart) : null;
  const normalizedDiscipline = normalizePaiDiscipline(discipline);
  const paiRow = subjectRows.find(r =>
    normalizePaiDiscipline(r.name) === normalizedDiscipline && r.tComp > 0
  );
  const hasPaiRow = !!paiRow;
  const tauxTrim = paiRow ? paiRow.pctT : null;
  const tauxTrimManual = (pai && pai.taux_trimestre != null && pai.taux_trimestre !== '') ? parseFloat(pai.taux_trimestre) : null;
  const tauxTrimFinal = hasPaiRow ? tauxTrim : tauxTrimManual;
  const ecart = (tauxTrimFinal != null && tauxDepart != null) ? round1(tauxTrimFinal - tauxDepart) : null;
  const ecartColor = ecart == null ? '#64748b' : (ecart >= 0 ? '#16a34a' : '#dc2626');
  const ecartText = ecart == null ? 'â€”' : (ecart >= 0 ? '+' : '') + ecart.toFixed(1) + '%';

  const teacherStr = (teacherNames || []).filter(name => name && !String(name).includes('AperÃ§u')).join(', ') || 'Le(s) Titulaire(s)';
  const termOrd = term === 1 ? '1er' : (term === 2 ? '2e' : '3e');
  const bilanTitle = 'BILAN DU ' + termOrd + ' TRIMESTRE';
  const disciplineControl = editable
    ? `<input type="text" id="paiDiscipline" class="pai-disc" list="paiSubjectOptions" value="${esc(discipline)}" placeholder="Saisir ou choisir une discipline"><datalist id="paiSubjectOptions">${(subjects || []).map(s => `<option value="${esc(s.name)}"></option>`).join('')}</datalist>`
    : `<strong>${esc(discipline || 'â€”')}</strong>`;

  const tauxControl = editable
    ? `<div style="position:relative;display:inline-block"><input type="number" id="paiTaux" class="pai-taux" min="0" max="100" step="0.1" value="${tauxDepart != null ? tauxDepart : ''}" placeholder="Ex: 45" style="padding-right:24px"><span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);color:#64748b;font-weight:700">%</span></div>`
    : `<strong>${tauxDepart != null ? tauxDepart + '%' : 'â€”'}</strong>`;

  return `
    <div class="synthese-sheet">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:0">
        <div style="font-size:14px;line-height:1.45;text-align:left">
          <strong style="font-size:15px;font-weight:800">CEB de BagrÃ©</strong><br>
          <strong style="font-weight:800">Ã‰cole : ${esc(schoolName || '')}</strong><br>
          <strong style="font-weight:800">Classe : ${esc(formatClassName(cls))}</strong>
        </div>
        <div class="official-motto" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:13px;line-height:1.45;padding-right:24px;margin-right:10px;min-width:220px;flex:1">
          <strong style="font-size:14px;font-weight:800">Burkina Faso</strong>
          <em>La Patrie ou la Mort, nous vaincrons</em>
        </div>
      </div>
      <div style="width:100%;text-align:center;background:#f1f5f9;border:1px solid #333;border-top:none;padding:8px 0;margin-bottom:12px">
        <strong style="font-size:16px;font-weight:800;letter-spacing:.2px">${esc(bilanTitle)}</strong>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
        <thead>
          <tr>
            <th style="border:1px solid #333;padding:6px">Effectif</th>
            <th style="border:1px solid #333;padding:6px">GarÃ§ons</th>
            <th style="border:1px solid #333;padding:6px">Filles</th>
            <th style="border:1px solid #333;padding:6px">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #333;padding:6px">Inscrits dÃ©but d'annÃ©e</td>
            <td style="border:1px solid #333;padding:6px;text-align:center">${boys.length}</td>
            <td style="border:1px solid #333;padding:6px;text-align:center;color:#dc2626">${girls.length}</td>
            <td style="border:1px solid #333;padding:6px;text-align:center;color:#16a34a"><strong>${list.length}</strong></td>
          </tr>
          <tr>
            <td style="border:1px solid #333;padding:6px">Ayant composÃ©</td>
            <td style="border:1px solid #333;padding:6px;text-align:center">${compBoys}</td>
            <td style="border:1px solid #333;padding:6px;text-align:center;color:#dc2626">${compGirls}</td>
            <td style="border:1px solid #333;padding:6px;text-align:center;color:#16a34a"><strong>${composed.length}</strong></td>
          </tr>
        </tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
        <thead>
          <tr>
            <th style="border:1px solid #333;padding:6px">MatiÃ¨re</th>
            <th style="border:1px solid #333;padding:6px">G ayant la moyenne</th>
            <th style="border:1px solid #333;padding:6px">% G</th>
            <th style="border:1px solid #333;padding:6px">F ayant la moyenne</th>
            <th style="border:1px solid #333;padding:6px">% F</th>
            <th style="border:1px solid #333;padding:6px">Total ayant la moyenne</th>
            <th style="border:1px solid #333;padding:6px">% Total</th>
          </tr>
        </thead>
        <tbody>
          ${subjectRows.map(r => `
            <tr>
              <td style="border:1px solid #333;padding:6px">${esc(r.name)}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center">${r.bPass}/${r.bComp}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center">${r.pctG}%</td>
              <td style="border:1px solid #333;padding:6px;text-align:center;color:#dc2626">${r.gPass}/${r.gComp}</td>
                  <td style="border:1px solid #333;padding:6px;text-align:center;color:#dc2626">${r.pctF}%</td>
              <td style="border:1px solid #333;padding:6px;text-align:center;color:#16a34a">${r.tPass}/${r.tComp}</td>
              <td style="border:1px solid #333;padding:6px;text-align:center;color:#16a34a"><strong>${r.pctT}%</strong></td>
            </tr>
          `).join('') || '<tr><td colspan="7" style="border:1px solid #333;padding:6px;text-align:center">Aucune matiÃ¨re</td></tr>'}
        </tbody>
      </table>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:0 0 16px">
        <table style="width:100%;border-collapse:collapse;border:1px solid #333;align-self:start">
          <thead>
            <tr><th colspan="2" style="border:1px solid #333;padding:6px;background:#f1f5f9;font-size:13px">Moyennes de la Classe</th></tr>
          </thead>
          <tbody>
            <tr>
              <th style="border:1px solid #333;padding:6px;text-align:left;width:52%">Forte moyenne</th>
              <td style="border:1px solid #333;padding:6px;text-align:center">${formatAverage(averageSummary.highest)}</td>
            </tr>
            <tr>
              <th style="border:1px solid #333;padding:6px;text-align:left">Faible moyenne</th>
              <td style="border:1px solid #333;padding:6px;text-align:center">${formatAverage(averageSummary.lowest)}</td>
            </tr>
            <tr>
              <th style="border:1px solid #333;padding:6px;text-align:left">Moyenne de la classe</th>
              <td style="border:1px solid #333;padding:6px;text-align:center"><strong>${formatAverage(averageSummary.classAverage)}</strong></td>
            </tr>
          </tbody>
        </table>

        <table style="width:100%;border-collapse:collapse;border:1px solid #333;align-self:start">
          <thead>
            <tr><th colspan="2" style="border:1px solid #333;padding:6px;background:#f1f5f9;font-size:13px">PAI</th></tr>
          </thead>
          <tbody>
            <tr>
              <th style="border:1px solid #333;padding:6px;text-align:left;width:42%">Discipline PAI</th>
              <td style="border:1px solid #333;padding:6px">${disciplineControl}</td>
            </tr>
            <tr>
              <th style="border:1px solid #333;padding:6px;text-align:left">Taux du dÃ©but (%)</th>
              <td style="border:1px solid #333;padding:6px">${tauxControl}</td>
            </tr>
            <tr>
              <th style="border:1px solid #333;padding:6px;text-align:left">Taux du trimestre (%)</th>
              <td style="border:1px solid #333;padding:6px">
                ${editable
                  ? `<div style="position:relative;display:inline-block"><input type="number" id="paiTauxTrim" min="0" max="100" step="0.1" value="${tauxTrimFinal != null ? tauxTrimFinal : ''}" ${hasPaiRow ? 'readonly' : ''} placeholder="Ex: 45" style="padding-right:24px"><span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);color:#64748b;font-weight:700">%</span></div><small id="paiTauxTrimMode" style="display:block;color:#64748b;font-size:10px">${hasPaiRow ? 'CalculÃ© automatiquement depuis les rÃ©sultats.' : 'Saisie manuelle : discipline non Ã©valuÃ©e.'}</small>`
                  : `<strong data-pai-trim="${tauxTrimFinal != null ? tauxTrimFinal : ''}">${tauxTrimFinal != null ? tauxTrimFinal + '%' : 'â€”'}</strong>`}
              </td>
            </tr>
            <tr>
              <th style="border:1px solid #333;padding:6px;text-align:left">Ã‰cart (%)</th>
              <td style="border:1px solid #333;padding:6px;text-align:center"><strong id="paiEcart" style="color:${ecartColor}">${ecartText}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      ${pai && (pai.savedAt || pai.enregistre) ? '<p style="margin:-6px 0 12px;color:#15803d;font-weight:700">âœ… PAI enregistrÃ©</p>' : ''}

      <div style="border:1px solid #333;padding:10px;margin-bottom:12px">
        <strong>DifficultÃ©s rencontrÃ©es et Suggestions</strong>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px">
          <div style="flex:1;min-width:240px">
            <label style="display:block;font-size:12px">DifficultÃ©s</label>
            ${editable
              ? `<textarea id="syntheseDifficultes" rows="3" style="width:100%;padding:8px;border:1px solid #333;border-radius:4px">${esc((pai && pai.difficultes) || '')}</textarea>`
              : `<div style="border:1px solid #333;padding:8px;min-height:40px">${esc((pai && pai.difficultes) || 'â€”')}</div>`}
          </div>
          <div style="flex:1;min-width:240px">
            <label style="display:block;font-size:12px">Suggestions</label>
            ${editable
              ? `<textarea id="syntheseSuggestions" rows="3" style="width:100%;padding:8px;border:1px solid #333;border-radius:4px">${esc((pai && pai.suggestions) || '')}</textarea>`
              : `<div style="border:1px solid #333;padding:8px;min-height:40px">${esc((pai && pai.suggestions) || 'â€”')}</div>`}
          </div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:26px">
        <div style="text-align:center;flex:1">
          <div style="border-top:1px solid #333;padding-top:4px;margin:0 24px">Le(s) Titulaire(s)</div>
          <div style="margin:0 24px">${signaturePeopleHTML(teacherSigners, teacherStr)}</div>
        </div>
        <div style="text-align:center;flex:1">
          <div style="font-weight:700">Visa du Directeur / de la Directrice</div>
          <div style="border-top:1px solid #333;padding-top:4px;margin:6px 24px 0">${signatureImageHTML(visaDirecteurSignatureUrl, 'Signature du Directeur')}${esc(visaDirecteur || 'En attente de visa')}</div>
        </div>
      </div>
    </div>`;
}
/**
 * BILAN TRIMESTRIEL OFFICIEL — mise en page réglementaire (CEB de Bagré).
 * En-tête deux colonnes, corps scindé (gauche 45 % / droite 55 %), pied de page signatures.
 */
export function renderBilanTrimestrielHTML({ schoolName, cls, students, subjects, notes, term, pai, teacherNames, teacherSigners, visaDirecteur, visaDirecteurSignatureUrl, editable, activeSchoolYear }) {
  const list = students || [];
  const boys = list.filter(s => s.gender === 'M');
  const girls = list.filter(s => s.gender === 'F');
  const year = activeSchoolYear || '';
  const className = formatClassName(cls || {});
  const termLabel = term === 1 ? '1' : (term === 2 ? '2' : '3');

  // Élèves ayant composé (au moins une note ce trimestre, hors abandon)
  const noteStudentIds = new Set();
  (notes || []).forEach(n => {
    if (n.trimestre === term && n.note != null) noteStudentIds.add(n.eleve_id || n.student_id);
  });
  const composed = list.filter(s => s.status !== 'A' && noteStudentIds.has(s.id));
  const compBoys = composed.filter(s => s.gender === 'M').length;
  const compGirls = composed.filter(s => s.gender === 'F').length;

  // Moyennes individuelles pondérées
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

  // Taux de fréquentation (présences / possibles)
  let attendanceRate = null;
  try {
    if (typeof window !== 'undefined' && window.__cebAttendanceRate != null) attendanceRate = window.__cebAttendanceRate;
  } catch (error) { attendanceRate = null; }

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

  return `
    <div class="synthese-sheet">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #000;padding-bottom:6px">
        <div style="font-size:11pt;line-height:1.35;text-align:left;flex:1">
          <strong style="font-size:11pt">CIRCONSCRIPTION D'EDUCATION DE BASE DE BAGRE</strong><br>
          <span>*-*-*-*-*-*</span><br>
          <strong>ECOLE PRIMAIRE PUBLIQUE DE ${esc(schoolName || '—')}</strong>
        </div>
        <div style="font-size:11pt;line-height:1.35;text-align:right;flex:1">
          <strong style="font-size:11pt">BURKINA FASO</strong><br>
          <span>*-*-*-*-*-*</span><br>
          <em>La Patrie ou la Mort nous Vaincrons</em><br>
          <strong>Année Scolaire : ${esc(year)}</strong><br>
          <strong>Classe : ${esc(className)}</strong>
        </div>
      </div>

      <div style="width:100%;text-align:center;margin:10px 0 12px">
        <strong style="font-size:15pt;font-weight:800;letter-spacing:.3px">BILAN Trimestriel n° ${esc(termLabel)}</strong>
      </div>

      <div style="display:grid;grid-template-columns:45% 55%;gap:10px;align-items:start">
        <div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
            <tbody>
              <tr>
                <td style="border:1px solid #333;padding:5px 6px;font-weight:700;width:50%">Effectif début d'année</td>
                <td style="border:1px solid #333;padding:5px 6px;text-align:center;font-weight:700">Garçons : ${boys.length}<br>Filles : <span style="color:#dc2626">${girls.length}</span><br>Total : <span style="color:#16a34a">${list.length}</span></td>
              </tr>
              <tr>
                <td style="border:1px solid #333;padding:5px 6px;font-weight:700">Effectif composé</td>
                <td style="border:1px solid #333;padding:5px 6px;text-align:center;font-weight:700">Garçons : ${compBoys}<br>Filles : <span style="color:#dc2626">${compGirls}</span><br>Total : <span style="color:#16a34a">${composed.length}</span></td>
              </tr>
            </tbody>
          </table>

          <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
            <thead><tr><th colspan="1" style="border:1px solid #333;padding:5px;background:#f1f5f9;text-align:left">Ayant la moyenne</th></tr></thead>
            <tbody>
              <tr><td style="border:1px solid #333;padding:5px">Garçons : ${ayantBoys} &nbsp; soit ${pctAyant(ayantBoys, compBoys)} %</td></tr>
              <tr><td style="border:1px solid #333;padding:5px;color:#dc2626">Filles : ${ayantGirls} &nbsp; soit ${pctAyant(ayantGirls, compGirls)} %</td></tr>
              <tr><td style="border:1px solid #333;padding:5px;color:#16a34a">Total : ${ayantMoyenne.length} &nbsp; soit ${pctAyant(ayantMoyenne.length, composed.length)} %</td></tr>
            </tbody>
          </table>

          <table style="width:100%;border-collapse:collapse;margin-bottom:10px;table-layout:fixed">
            <tbody>
              <tr><td style="border:1px solid #333;padding:4px 6px;background:#f1f5f9;font-weight:700;text-align:center">Moyen</td>
                ${brackets.map(b => `<td style="border:1px solid #333;padding:3px;font-size:9pt;text-align:center">${b.label}</td>`).join('')}
              </tr>
              <tr><td style="border:1px solid #333;padding:4px 6px;font-weight:700;text-align:center">Nbre</td>
                ${brackets.map(b => `<td style="border:1px solid #333;padding:3px;font-size:9pt;text-align:center">${b.count}</td>`).join('')}
              </tr>
            </tbody>
          </table>

          <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
            <tbody>
              <tr><td style="border:1px solid #333;padding:5px 6px;font-weight:700">Forte moyenne</td><td style="border:1px solid #333;padding:5px 6px;text-align:center">${forte != null ? forte.toFixed(2) : '—'}</td></tr>
              <tr><td style="border:1px solid #333;padding:5px 6px;font-weight:700">Faible moyenne</td><td style="border:1px solid #333;padding:5px 6px;text-align:center">${faible != null ? faible.toFixed(2) : '—'}</td></tr>
              <tr><td style="border:1px solid #333;padding:5px 6px;font-weight:700">Moyenne de la classe</td><td style="border:1px solid #333;padding:5px 6px;text-align:center"><strong>${moyenne != null ? moyenne.toFixed(2) : '—'}</strong></td></tr>
              <tr><td style="border:1px solid #333;padding:5px 6px;font-weight:700">Taux de fréquentation</td><td style="border:1px solid #333;padding:5px 6px;text-align:center">${attendanceRate != null ? attendanceRate.toFixed(2) + ' %' : '—'}</td></tr>
            </tbody>
          </table>

          <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
            <thead><tr><th colspan="2" style="border:1px solid #333;padding:5px;background:#f1f5f9">PAI</th></tr></thead>
            <tbody>
              <tr><td style="border:1px solid #333;padding:5px;font-weight:700;width:42%">Discipline</td><td style="border:1px solid #333;padding:5px">${disciplineControl}</td></tr>
              <tr><td style="border:1px solid #333;padding:5px;font-weight:700">% de début</td><td style="border:1px solid #333;padding:5px">${tauxControl}</td></tr>
              <tr><td style="border:1px solid #333;padding:5px;font-weight:700">% du trimestre</td><td style="border:1px solid #333;padding:5px">${tauxTrimFinal != null ? tauxTrimFinal + '%' : '—'}</td></tr>
              <tr><td style="border:1px solid #333;padding:5px;font-weight:700">Écart</td><td style="border:1px solid #333;padding:5px;text-align:center"><strong>${esc(ecartText)}</strong></td></tr>
              <tr><td style="border:1px solid #333;padding:5px;font-weight:700">Décision</td><td style="border:1px solid #333;padding:5px">${decisionControl}</td></tr>
            </tbody>
          </table>

          <div style="border:1px solid #333;padding:8px">
            <strong>Difficultés rencontrées et suggestions</strong>
            <div style="margin-top:6px">
              ${editable
                ? `<textarea id="syntheseDifficultes" rows="3" style="width:100%;padding:6px;border:1px solid #333">${esc((pai && pai.difficultes) || '')}</textarea>`
                : `<div style="border:1px solid #333;padding:6px;min-height:44px">${esc((pai && pai.difficultes) || '—')}</div>`}
            </div>
          </div>
        </div>

        <div>
          <div style="font-weight:800;text-align:center;margin-bottom:6px;font-size:11pt">Pourcentage de réussite par Discipline</div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f1f5f9">
                <th rowspan="2" style="border:1px solid #333;padding:5px">Matière</th>
                <th colspan="2" style="border:1px solid #333;padding:5px">Garçons</th>
                <th colspan="2" style="border:1px solid #333;padding:5px;color:#dc2626">Filles</th>
                <th colspan="2" style="border:1px solid #333;padding:5px;color:#16a34a">Total</th>
              </tr>
              <tr style="background:#f1f5f9">
                <th style="border:1px solid #333;padding:4px">Nbre</th>
                <th style="border:1px solid #333;padding:4px">%</th>
                <th style="border:1px solid #333;padding:4px">Nbre</th>
                <th style="border:1px solid #333;padding:4px">%</th>
                <th style="border:1px solid #333;padding:4px">Nbre</th>
                <th style="border:1px solid #333;padding:4px">%</th>
              </tr>
            </thead>
            <tbody>
              ${subjectRows.map(r => `
                <tr>
                  <td style="border:1px solid #333;padding:5px">${esc(r.name)}</td>
                  <td style="border:1px solid #333;padding:5px;text-align:center">${r.bPass}</td>
                  <td style="border:1px solid #333;padding:5px;text-align:center">${r.pctG}%</td>
                  <td style="border:1px solid #333;padding:5px;text-align:center;color:#dc2626">${r.gPass}</td>
                  <td style="border:1px solid #333;padding:5px;text-align:center;color:#dc2626">${r.pctF}%</td>
                  <td style="border:1px solid #333;padding:5px;text-align:center;color:#16a34a">${r.tPass}</td>
                  <td style="border:1px solid #333;padding:5px;text-align:center;color:#16a34a"><strong>${r.pctT}%</strong></td>
                </tr>
              `).join('') || '<tr><td colspan="7" style="border:1px solid #333;padding:5px;text-align:center">Aucune matière</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div style="margin-top:16px">
        <div style="text-align:center;font-weight:800;text-decoration:underline;font-size:12pt">Le conseil des maîtres</div>
        <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:6px 0 12px;font-size:9pt">
          <span>CP1</span><span>CP2</span><span>CE1</span><span>CE2</span><span>CM1</span><span>CM2</span>
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
