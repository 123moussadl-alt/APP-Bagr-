/**
 * Registre d'appel — calcul et rendu de la Synthèse Mensuelle (Octobre à Mai).
 * Partagé entre Titulaire, Directeur et Encadreur.
 */

import { esc } from './format.js';
import { profileMatchesVisa, signatureImageHTML, signaturePeopleHTML, signatureUrlForProfile } from './signature.js';

const MOIS_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export function workingHalfDays(year, monthIndex) {
  const days = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= days; day++) {
    const wd = new Date(year, monthIndex, day).getDay();
    if (wd === 0 || wd === 6) continue;
    count += (wd === 3) ? 1 : 2;
  }
  return count;
}

function halfDaysForDateStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const wd = d.getDay();
  if (wd === 0 || wd === 6) return 0;
  return (wd === 3) ? 1 : 2;
}

export function sumHalfDays(jours) {
  return (jours || []).reduce((a, ds) => a + halfDaysForDateStr(ds), 0);
}

export function formatVisaStampDate(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function schoolMonths(startYear) {
  const y = startYear || 2026;
  return [
    { name: 'Octobre', year: y, month: 9 },
    { name: 'Novembre', year: y, month: 10 },
    { name: 'Décembre', year: y, month: 11 },
    { name: 'Janvier', year: y + 1, month: 0 },
    { name: 'Février', year: y + 1, month: 1 },
    { name: 'Mars', year: y + 1, month: 2 },
    { name: 'Avril', year: y + 1, month: 3 },
    { name: 'Mai', year: y + 1, month: 4 }
  ];
}

export function computeMonthlyRegister(students, absences, startYear, joursPointesByMonth) {
  const list = (students || []).filter(s => s.status !== 'A');
  const boys = list.filter(s => s.gender === 'M').length;
  const girls = list.filter(s => s.gender === 'F').length;
  const total = list.length;
  const gender = {};
  list.forEach(s => {
    gender[String(s.id)] = s.gender;
  });
  const abs = (absences || []).filter(p => p.statut === 'A');

  return schoolMonths(startYear).map(m => {
    const jours = (joursPointesByMonth && joursPointesByMonth[m.name]) || [];
    const demi = sumHalfDays(jours);
    const inMonth = abs.filter(p => {
      const d = new Date(p.date_jour + 'T00:00:00');
      return d.getMonth() === m.month && d.getFullYear() === m.year;
    });
    const byStudent = {};
    list.forEach(s => { byStudent[String(s.id)] = 0; });
    inMonth.forEach(p => {
      const studentId = String(p.eleve_id);
      if (Object.prototype.hasOwnProperty.call(byStudent, studentId)) byStudent[studentId]++;
    });
    const activeAbsences = inMonth.filter(p => Object.prototype.hasOwnProperty.call(byStudent, String(p.eleve_id)));
    const absG = activeAbsences.filter(p => gender[String(p.eleve_id)] === 'M').length;
    const absF = activeAbsences.filter(p => gender[String(p.eleve_id)] === 'F').length;
    const absT = absG + absF;
    const possG = boys * demi, possF = girls * demi, possT = total * demi;
    const effG = possG - absG, effF = possF - absF, effT = possT - absT;
    const counts = Object.entries(byStudent);
    const upTo3 = counts.filter(([, count]) => count <= 3);
    const over3 = counts.filter(([, count]) => count > 3);
    const countByGender = (entries, sex) => entries.filter(([sid]) => gender[sid] === sex).length;
    const absByGender = sex => over3.filter(([sid]) => gender[sid] === sex).reduce((sum, [, count]) => sum + count, 0);
    const pct = (n, d) => d ? Math.round((n / d) * 1000) / 10 : 0;
    return {
      name: m.name, demi, boys, girls, total,
      possG, possF, possT, effG, effF, effT, absG, absF, absT,
      upTo3G: countByGender(upTo3, 'M'), upTo3F: countByGender(upTo3, 'F'),
      over3G: countByGender(over3, 'M'), over3F: countByGender(over3, 'F'),
      over3AbsG: absByGender('M'), over3AbsF: absByGender('F'),
      pctPresG: pct(effG, possG), pctPresF: pct(effF, possF), pctPresT: pct(effT, possT),
      pctAbsG: pct(absG, possG), pctAbsF: pct(absF, possF), pctAbsT: pct(absT, possT)
    };
  });
}

export function renderMonthlyRegisterTable(rows, options = {}) {
  const visaDirecteurByMonth = options.visaDirecteurByMonth || {};
  const visaEncadreurByMonth = options.visaEncadreurByMonth || {};
  const visaDirecteurProfile = options.visaDirecteurProfile || null;
  const visaEncadreurProfile = options.visaEncadreurProfile || null;
  const visaAction = options.visaAction || '';
  const cell = (value, gender) => {
    const color = gender === 'F' ? 'color:#dc2626' : (gender === 'T' ? 'color:#16a34a;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact' : '');
    return `<td style="border:1px solid #333;padding:4px;text-align:center;${color}">${value}</td>`;
  };
  const group = (g, f, t) => cell(g, 'M') + cell(f, 'F') + cell(t, 'T');
  const directorStampHTML = (month) => {
    const stamp = visaDirectorStamps[month] || null;
    const signatureUrl = (stamp && stamp.signatureUrl) || signatureUrlForProfile(visaDirecteurProfile);
    const img = signatureImageHTML(signatureUrl, 'Signature du Directeur', 'max-height:36px;width:auto;height:auto;object-fit:contain;margin:0 auto 4px;display:block');
    if (!stamp) return `<div><span style="color:#64748b">En attente de visa</span></div>`;
    const value = visaDirecteurByMonth[month] || stamp.nom || '';
    const name = stamp.nom || value;
    return `<div>${img}${esc('Vu ce jour ' + (stamp.date || ''))}<br/>${esc('Visé par ' + name)}</div>`;
  };
  const encadreurStampHTML = (month) => {
    const stamp = visaEncadreurStamps[month] || null;
    const signatureUrl = (stamp && stamp.signatureUrl) || signatureUrlForProfile(visaEncadreurProfile);
    const img = signatureImageHTML(signatureUrl, 'Signature de l\'Encadreur', 'max-height:36px;width:auto;height:auto;object-fit:contain;margin:0 auto 4px;display:block');
    if (!stamp) return `<div><span style="color:#64748b">En attente de visa</span></div>`;
    const value = visaEncadreurByMonth[month] || stamp.nom || '';
    const name = stamp.nom || value;
    return `<div>${img}${esc('Vu ce jour ' + (stamp.date || ''))}<br/>${esc('Visé par ' + name)}</div>`;
  };
  const visaDirectorCell = (month) => {
    const stamp = visaDirectorStamps[month] || null;
    const signed = !!stamp;
    if (signed) return `<td style="border:1px solid #333;padding:4px;text-align:center;min-width:120px">${directorStampHTML(month)}</td>`;
    const value = visaDirecteurByMonth[month] || '';
    return `<td style="border:1px solid #333;padding:4px;text-align:center;min-width:120px"><div>${value ? esc(value) : '<span style="color:#64748b">En attente de visa</span>'}</div></td>`;
  };
  const visaEncadreurCell = (month) => {
    const stamp = visaEncadreurStamps[month] || null;
    const signed = !!stamp;
    if (signed) return `<td style="border:1px solid #333;padding:4px;text-align:center;min-width:120px">${encadreurStampHTML(month)}</td>`;
    const value = visaEncadreurByMonth[month] || '';
    return `<td style="border:1px solid #333;padding:4px;text-align:center;min-width:120px"><div>${value ? esc(value) : '<span style="color:#64748b">En attente de visa</span>'}</div></td>`;
  };
  return `
    <div class="table-wrap monthly-register-wrap monthly-register-sheet">
      <table class="monthly-register-table" style="border-collapse:collapse;min-width:1600px;width:100%">
        <thead>
          <tr>
            <th rowspan="2">Mois</th>
            <th rowspan="2">Nombre de demi-journées</th>
            <th colspan="3" style="writing-mode:vertical-rl;transform:rotate(180deg);height:112px">Effectif</th>
            <th colspan="3" style="writing-mode:vertical-rl;transform:rotate(180deg);height:112px">Présences possibles</th>
            <th colspan="3" style="writing-mode:vertical-rl;transform:rotate(180deg);height:112px">Absences</th>
            <th colspan="3" style="writing-mode:vertical-rl;transform:rotate(180deg);height:112px">Présences effectives</th>
            <th colspan="3" style="writing-mode:vertical-rl;transform:rotate(180deg);height:112px">Élèves ≤ 3 absences</th>
            <th colspan="3" style="writing-mode:vertical-rl;transform:rotate(180deg);height:112px">Élèves &gt; 3 absences</th>
            <th colspan="3" style="writing-mode:vertical-rl;transform:rotate(180deg);height:112px">Absences imputables (&gt; 3 abs.)</th>
            <th colspan="3" style="writing-mode:vertical-rl;transform:rotate(180deg);height:112px">Taux présence (%)</th>
            <th colspan="3" style="writing-mode:vertical-rl;transform:rotate(180deg);height:112px">Taux absence (%)</th>
            <th rowspan="2">Visa du Directeur</th>
            <th rowspan="2">Visa de l'Encadreur</th>
          </tr>
          <tr>${'<th>G</th><th style="color:#dc2626">F</th><th style="color:#16a34a">T</th>'.repeat(9)}</tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              ${cell(`<strong>${esc(r.name)}</strong>`, '')}
              ${cell(r.demi, '')}
              ${group(r.boys, r.girls, r.total)}
              ${group(r.possG, r.possF, r.possT)}
              ${group(r.absG, r.absF, r.absT)}
              ${group(r.effG, r.effF, r.effT)}
              ${group(r.upTo3G, r.upTo3F, r.upTo3G + r.upTo3F)}
              ${group(r.over3G, r.over3F, r.over3G + r.over3F)}
              ${group(r.over3AbsG, r.over3AbsF, r.over3AbsG + r.over3AbsF)}
              ${group(r.pctPresG + '%', r.pctPresF + '%', r.pctPresT + '%')}
              ${group(r.pctAbsG + '%', r.pctAbsF + '%', r.pctAbsT + '%')}
              ${visaCell(visaDirecteurByMonth[r.name], r.name, 'visa-directeur', visaDirecteurProfile)}
              ${visaCell(visaEncadreurByMonth[r.name], r.name, 'visa-encadreur', visaEncadreurProfile)}
            </tr>
          `).join('') || '<tr><td colspan="31" style="padding:10px;text-align:center">Aucun mois clôturé.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

export function monthlyRegisterCSVRows(rows, options = {}) {
  const visaDirecteurByMonth = options.visaDirecteurByMonth || {};
  const visaEncadreurByMonth = options.visaEncadreurByMonth || {};
  const header = [
    'Mois', 'Nombre de demi-journées',
    'Effectif inscrit - Garçons', 'Effectif inscrit - Filles', 'Effectif inscrit - Total',
    'Présences possibles - Garçons', 'Présences possibles - Filles', 'Présences possibles - Total',
    'Absences - Garçons', 'Absences - Filles', 'Absences - Total',
    'Présences effectives - Garçons', 'Présences effectives - Filles', 'Présences effectives - Total',
    'Élèves ayant 3 absences ou moins (≤ 3 absences) - Garçons', 'Élèves ayant 3 absences ou moins (≤ 3 absences) - Filles', 'Élèves ayant 3 absences ou moins (≤ 3 absences) - Total',
    'Élèves ayant plus de 3 absences - Garçons', 'Élèves ayant plus de 3 absences - Filles', 'Élèves ayant plus de 3 absences - Total',
    'Absences imputables > 3 - Garçons', 'Absences imputables > 3 - Filles', 'Absences imputables > 3 - Total',
    'Taux de présence (%) - Garçons', 'Taux de présence (%) - Filles', 'Taux de présence (%) - Total',
    'Taux d’absence (%) - Garçons', 'Taux d’absence (%) - Filles', 'Taux d’absence (%) - Total',
    'Visa du Directeur', 'Visa de l’Encadreur'
  ];
  return [
    header,
    ...rows.map(r => [
      r.name, r.demi,
      r.boys, r.girls, r.total,
      r.possG, r.possF, r.possT,
      r.absG, r.absF, r.absT,
      r.effG, r.effF, r.effT,
      r.upTo3G, r.upTo3F, r.upTo3G + r.upTo3F,
      r.over3G, r.over3F, r.over3G + r.over3F,
      r.over3AbsG, r.over3AbsF, r.over3AbsG + r.over3AbsF,
      r.pctPresG, r.pctPresF, r.pctPresT,
      r.pctAbsG, r.pctAbsF, r.pctAbsT,
      visaDirecteurByMonth[r.name] || 'Non visé',
      visaEncadreurByMonth[r.name] || 'Non visé'
    ])
  ];
}
export function halfDaysForMonthLabel(startYear, monthName) {
  const months = schoolMonths(startYear);
  const idx = months.findIndex(m => m.name === monthName);
  if (idx === -1) return null;
  const m = months[idx];
  return { month: m.month, year: m.year, monthName };
}

export function computeFicheArretMensuel(students, absences, monthInfo, joursValides) {
  const list = (students || []).filter(s => s.status !== 'A');
  const boys = list.filter(s => s.gender === 'M').length;
  const girls = list.filter(s => s.gender === 'F').length;
  const total = list.length;
  const gender = {};
  list.forEach(s => { gender[s.id] = s.gender; });
  const activeIds = new Set(list.map(s => s.id));
  const demi = sumHalfDays(joursValides || []);
  const inMonth = (absences || []).filter(p => {
    const d = new Date(p.date_jour + 'T00:00:00');
    return p.statut === 'A' && activeIds.has(p.eleve_id) && d.getMonth() === monthInfo.month && d.getFullYear() === monthInfo.year;
  });
  const absG = inMonth.filter(p => gender[p.eleve_id] === 'M').length;
  const absF = inMonth.filter(p => gender[p.eleve_id] === 'F').length;
  const absT = absG + absF;
  const possG = boys * demi, possF = girls * demi, possT = total * demi;
  const effG = possG - absG, effF = possF - absF, effT = possT - absT;
  const pct = (n, d) => d ? Math.round((n / d) * 1000) / 10 : 0;
  return {
    monthName: monthInfo.monthName,
    boys, girls, total, demi,
    possG, possF, possT, absG, absF, absT, effG, effF, effT,
    pctPresG: pct(effG, possG), pctPresF: pct(effF, possF), pctPresT: pct(effT, possT),
    pctAbsG: pct(absG, possG), pctAbsF: pct(absF, possF), pctAbsT: pct(absT, possT)
  };
}

export function renderFicheArretMensuelHTML({ schoolName, className, monthName, data, teacherNames, teacherSigners, visaDirecteur, visaDirecteurSignatureProfile, showVisaButton, onVisaLabel }) {
  const r = data;
  const fmt = (v) => v == null ? '0' : String(v);
  const teacherTxt = (teacherNames && teacherNames.length) ? teacherNames.join(', ') : 'Le(s) Titulaire(s)';
  return `
    <div class="arret-mois" style="font-family:inherit;width:100%;max-width:100%;background:#ffffff;color:#111827;padding:8px;box-sizing:border-box;font-size:14px;line-height:1.6">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px">
        <div style="font-size:14px;line-height:1.6">
          <div style="font-weight:900;font-size:15px">CEB de Bagré</div>
          <div><strong>École : ${esc(schoolName || '—')}</strong></div>
          <div><strong>Classe : ${esc(className || '—')}</strong></div>
        </div>
        <div class="official-motto" style="display:flex;flex-direction:column;align-items:center;text-align:center;font-size:14px;line-height:1.6;flex:1">
          <strong style="font-size:15px">Burkina Faso</strong>
          <span>La Patrie ou la Mort, nous vaincrons</span>
        </div>
      </div>
      <h2 style="text-align:center;margin:12px 0;font-size:18px;letter-spacing:.2px"><u>ARRÊT DU MOIS DE ${esc(String(monthName || '').toUpperCase())}</u></h2>

      <div class="arret-table-wrap" style="width:92%;max-width:680px;margin:16px auto;overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table style="width:100%;max-width:100%;min-width:0;table-layout:fixed;border-collapse:collapse;background:#ffffff;color:#111827;font-size:14px;line-height:1.6">
        <colgroup><col style="width:26%"><col style="width:23%"><col style="width:17%"><col style="width:17%"><col style="width:17%"></colgroup>
        <thead><tr>
          <th style="border:1px solid #cbd5e1;padding:12px 16px;text-align:left;background:#ffffff">Rubrique</th>
          <th style="border:1px solid #cbd5e1;padding:12px 16px;text-align:left;background:#ffffff">Formule / Procédure</th>
          <th style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;background:#ffffff">Garçons</th>
          <th style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;background:#ffffff;color:#dc2626;font-weight:700">Filles</th>
          <th style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;background:#ffffff;color:#16a34a;font-weight:700">Total</th>
        </tr></thead>
        <tbody>
          <tr>
            <th style="border:1px solid #cbd5e1;padding:12px 16px;text-align:left">Effectif</th>
            <td style="border:1px solid #cbd5e1;padding:12px 16px">Élèves inscrits</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center">${fmt(r.boys)}</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#dc2626;font-weight:700">${fmt(r.girls)}</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#16a34a;font-weight:700">${fmt(r.total)}</td>
          </tr>
          <tr>
            <th style="border:1px solid #cbd5e1;padding:12px 16px;text-align:left">Nombre de demi-journées</th>
            <td style="border:1px solid #cbd5e1;padding:12px 16px">Jours retenus</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center">${fmt(r.demi)}</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#dc2626;font-weight:700">${fmt(r.demi)}</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#16a34a;font-weight:700">${fmt(r.demi)}</td>
          </tr>
          <tr>
            <th style="border:1px solid #cbd5e1;padding:12px 16px;text-align:left">Présences possibles</th>
            <td style="border:1px solid #cbd5e1;padding:12px 16px">Effectif × Demi-journées</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center">${fmt(r.possG)}</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#dc2626;font-weight:700">${fmt(r.possF)}</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#16a34a;font-weight:700">${fmt(r.possT)}</td>
          </tr>
          <tr>
            <th style="border:1px solid #cbd5e1;padding:12px 16px;text-align:left">Absences</th>
            <td style="border:1px solid #cbd5e1;padding:12px 16px">Demi-journées d'absence</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center">${fmt(r.absG)}</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#dc2626;font-weight:700">${fmt(r.absF)}</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#16a34a;font-weight:700">${fmt(r.absT)}</td>
          </tr>
          <tr>
            <th style="border:1px solid #cbd5e1;padding:12px 16px;text-align:left">Présences effectives</th>
            <td style="border:1px solid #cbd5e1;padding:12px 16px">Présences possibles − Absences</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center">${fmt(r.effG)}</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#dc2626;font-weight:700">${fmt(r.effF)}</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#16a34a;font-weight:700">${fmt(r.effT)}</td>
          </tr>
          <tr>
            <th style="border:1px solid #cbd5e1;padding:12px 16px;text-align:left">Taux de présence (%)</th>
            <td style="border:1px solid #cbd5e1;padding:12px 16px">Présences effectives ÷ Présences possibles × 100</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center">${r.pctPresG}%</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#dc2626;font-weight:700">${r.pctPresF}%</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#16a34a;font-weight:700">${r.pctPresT}%</td>
          </tr>
          <tr>
            <th style="border:1px solid #cbd5e1;padding:12px 16px;text-align:left">Taux d'absence (%)</th>
            <td style="border:1px solid #cbd5e1;padding:12px 16px">Absences ÷ Présences possibles × 100</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center">${r.pctAbsG}%</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#dc2626;font-weight:700">${r.pctAbsF}%</td>
            <td style="border:1px solid #cbd5e1;padding:12px 16px;text-align:center;color:#16a34a;font-weight:700">${r.pctAbsT}%</td>
          </tr>
        </tbody>
      </table>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-top:20px;font-size:14px">
        <div style="min-width:220px;text-align:center">
          <div style="font-weight:800;margin-bottom:6px">Le(s) Titulaire(s)</div>
          <div style="border-top:1px solid #cbd5e1;padding-top:6px;font-weight:700">${signaturePeopleHTML(teacherSigners, teacherTxt)}</div>
        </div>
        <div style="min-width:220px;text-align:center">
          <div style="font-weight:800;margin-bottom:6px">Visa du Directeur / de la Directrice</div>
          ${visaDirecteur ? `<div style="border-top:1px solid #cbd5e1;padding-top:6px;font-weight:700">${profileMatchesVisa(visaDirecteur, visaDirecteurSignatureProfile) ? signatureImageHTML(signatureUrlForProfile(visaDirecteurSignatureProfile), 'Signature du Directeur') : ''}${esc(visaDirecteur)}</div>` : (showVisaButton ? `<div style="border-top:1px dashed #cbd5e1;padding-top:6px;color:#64748b">Zone de visa</div>` : `<div style="border-top:1px solid #cbd5e1;padding-top:6px;color:#64748b">Zone de visa</div>`)}
        </div>
      </div>
    </div>`;
}

export function monthlyClosureCSVRows(data) {
  const r = data;
  return [
    ['Rubrique', 'Formule / Procédure', 'Garçons', 'Filles', 'Total'],
    ['Effectif', 'Élèves inscrits', r.boys, r.girls, r.total],
    ['Nombre de demi-journées', 'Jours retenus', r.demi, r.demi, r.demi],
    ['Présences possibles', 'Effectif × Demi-journées', r.possG, r.possF, r.possT],
    ['Absences', "Demi-journées d'absence", r.absG, r.absF, r.absT],
    ['Présences effectives', 'Présences possibles − Absences', r.effG, r.effF, r.effT],
    ['Taux de présence (%)', 'Présences effectives ÷ Présences possibles × 100', r.pctPresG + '%', r.pctPresF + '%', r.pctPresT + '%'],
    ["Taux d'absence (%)", 'Absences ÷ Présences possibles × 100', r.pctAbsG + '%', r.pctAbsF + '%', r.pctAbsT + '%']
  ];
}
