/**
 * Fiches officielles de présence des agents (CEB de Bagré) — FICHE A (journalière) & FICHE B (mensuelle).
 */

import { esc } from './format.js';
import { signatureImageHTML } from './signature.js';

const GRAY = '#d9d9d9';

function officialHeader() {
  return `
    <div style="display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #000;padding-bottom:6px">
      <div style="text-align:left;text-transform:uppercase;line-height:1.35;font-size:10pt">
        <div>MINISTERE DE L'ENSEIGNEMENT DE BASE,</div>
        <div>DE L'ALPHABETISATION ET DE LA PROMOTION</div>
        <div>DES LANGUES NATIONALES</div>
        <div style="margin-top:4px">REGION DU <span style="text-decoration:underline;font-weight:700">NAKAMBE</span></div>
      </div>
      <div style="text-align:center;line-height:1.35;font-size:10pt">
        <div style="font-weight:800">BURKINA FASO</div>
        <div>----------</div>
        <div><em>La Patrie ou la Mort, nous Vaincrons</em></div>
      </div>
    </div>`;
}

function grayTitle(text) {
  return `<div style="background:${GRAY};border:1.5px solid #000;padding:5px;text-align:center;font-weight:bold;text-transform:uppercase;margin:10px 0">${esc(text)}</div>`;
}

function metaBox(label, value) {
  return `
    <div style="display:flex;justify-content:center;align-items:center;gap:8px;margin:3px 0">
      <span style="font-weight:700;text-align:right;min-width:110px">${esc(label)}</span>
      <span style="border:1px solid #000;padding:3px 12px;min-width:340px;text-align:center;font-weight:700">${esc(value)}</span>
    </div>`;
}

function footer(structureLabel, date, signerLabel, signatureUrl, leftNote) {
  const img = signatureImageHTML(signatureUrl, 'Signature', 'max-height:42px;width:auto;height:auto;object-fit:contain;margin:2px auto 0;display:block');
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-top:16px;font-size:9pt">
      <div style="flex:1;text-align:left">
        ${leftNote}
      </div>
      <div style="flex:1;text-align:right">
        <div>Fait à ${esc(structureLabel || 'Bagré')}, le ${esc(date)}</div>
        <div style="margin-top:14px;font-weight:700;text-decoration:underline">${esc(signerLabel)}</div>
        ${img}
      </div>
    </div>`;
}

export function renderFicheA({
  structure, date, heure, agents, signerLabel = 'Le Directeur', signatureUrl = '',
  actionName = 'agent-set-presence', agentAttr = 'data-agent-id', editable = true
}) {
  const rows = (agents || []).map((agent, index) => {
    const isWoman = String(agent.gender || agent.sexe || '').toUpperCase() === 'F';
    const nameStyle = isWoman ? 'color:#dc2626;font-weight:600;' : '';
    const present = agent.present !== false;
    const agentId = esc(agent.id);
    const heure = agent.heure != null ? agent.heure : '';
    const jour = agent.jour != null ? agent.jour : '';
    const presentCell = present ? 'X' : '';
    const absentCell = present ? '' : 'X';
    return `
      <tr>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${index + 1}</td>
        <td style="border:1px solid #000;padding:4px 6px;${nameStyle}">${esc(agent.full_name || '')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(agent.matricule || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(agent.emploi || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(agent.fonction || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;font-weight:700;color:#16a34a;cursor:pointer"
          ${editable ? `${actionName} ${agentAttr}="${agentId}" data-present="true"` : ''}>${presentCell}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;font-weight:700;color:#dc2626;cursor:pointer"
          ${editable ? `${actionName} ${agentAttr}="${agentId}" data-present="false"` : ''}>${absentCell}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">
          ${editable ? `<input type="number" min="0" step="0.5" value="${esc(heure)}" class="fiche-heure" ${agentAttr}="${agentId}" style="width:64px;border:none;text-align:center">` : esc(heure)}
        </td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">
          ${editable ? `<input type="number" min="0" step="1" value="${esc(jour)}" class="fiche-jour" ${agentAttr}="${agentId}" style="width:64px;border:none;text-align:center">` : esc(jour)}
        </td>
      </tr>`;
  }).join('') || '<tr><td colspan="9" style="border:1px solid #000;padding:6px;text-align:center">Aucun agent</td></tr>';

  return `
    <div class="presence-official-sheet" style="font-family:Arial,sans-serif;color:#111;background:#fff;padding:10px;box-sizing:border-box">
      ${officialHeader()}
      ${grayTitle('FICHE A : SITUATION JOURNALIERE DE PRESENCE DES AGENTS')}
      ${metaBox('STRUCTURE :', structure || 'CEB de Bagré / Boulgou')}
      ${metaBox('Date :', date)}
      ${metaBox('Heure :', heure || '')}
      <table style="border:1px solid #000;border-collapse:collapse;width:100%;font-size:9pt;margin-top:8px">
        <thead>
          <tr style="background:${GRAY}">
            <th rowspan="2" style="border:1px solid #000;padding:4px">N° d'ordre</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Nom et Prénom (s)</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Matricule</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Emploi</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Fonction</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Présent</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Absent</th>
            <th colspan="2" style="border:1px solid #000;padding:4px">Durée de l'absence</th>
          </tr>
          <tr style="background:${GRAY}">
            <th style="border:1px solid #000;padding:3px">Heure</th>
            <th style="border:1px solid #000;padding:3px">Jour</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${footer(structure, date, signerLabel, signatureUrl, `
        <div style="text-decoration:underline;font-weight:700">NB :</div>
        <div>la colonne <span style="text-decoration:underline">Heure</span> indique la situation où l'absence est inférieure à la journée du travail</div>
        <div>la colonne <span style="text-decoration:underline">Jour</span> renseigne la situation où l'absence est égale à la journée du travail</div>`)}
    </div>`;
}

export function renderFicheB({
  structure, date, mois, annee, rows, signerLabel = 'Le Directeur', signatureUrl = '', editable = false
}) {
  const body = (rows || []).map((row, index) => {
    const isWoman = String(row.gender || row.sexe || '').toUpperCase() === 'F';
    const nameStyle = isWoman ? 'color:#dc2626;font-weight:600;' : '';
    const agentId = esc(row.id);
    return `
      <tr>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${index + 1}</td>
        <td style="border:1px solid #000;padding:4px 6px;${nameStyle}">${esc(row.full_name || '')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(row.matricule || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(row.emploi || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(row.fonction || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(row.structure || '')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(row.heure != null ? row.heure : '')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(row.jour != null ? row.jour : '')}</td>
        <td style="border:1px solid #000;padding:4px 6px">${editable ? `<input type="text" value="${esc(row.mesures || '')}" class="fiche-mesures" data-agent="${agentId}" style="width:100%;border:none">` : esc(row.mesures || '')}</td>
        <td style="border:1px solid #000;padding:4px 6px">${editable ? `<input type="text" value="${esc(row.references || '')}" class="fiche-references" data-agent="${agentId}" style="width:100%;border:none">` : esc(row.references || '')}</td>
      </tr>`;
  }).join('') || '<tr><td colspan="10" style="border:1px solid #000;padding:6px;text-align:center">Aucun agent</td></tr>';

  return `
    <div class="presence-official-sheet" style="font-family:Arial,sans-serif;color:#111;background:#fff;padding:10px;box-sizing:border-box">
      ${officialHeader()}
      ${grayTitle('FICHE B : SITUATION MENSUELLE DE PRESENCE DES AGENTS')}
      <div style="font-size:10pt;line-height:1.5;margin-bottom:8px">
        <div><span style="text-decoration:underline;font-weight:700">STRUCTURE :</span> ${esc(structure || 'CEB de Bagré / Boulgou')}</div>
        <div><strong>Date :</strong> ${esc(date)}</div>
        <div><strong>Mois :</strong> ${esc(mois || '')} &nbsp;&nbsp; <strong>Année :</strong> ${esc(annee || '')}</div>
      </div>
      <table style="border:1px solid #000;border-collapse:collapse;width:100%;font-size:9pt">
        <thead>
          <tr style="background:${GRAY}">
            <th rowspan="2" style="border:1px solid #000;padding:4px">N° d'ordre</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Nom et Prénom (s)</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Matricule</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Emploi</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Fonction</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Structure</th>
            <th colspan="2" style="border:1px solid #000;padding:4px">Absence</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Mesures prises</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Références des pièces justificatives de la mesure prise s'il y a lieu</th>
          </tr>
          <tr style="background:${GRAY}">
            <th style="border:1px solid #000;padding:3px">Heure</th>
            <th style="border:1px solid #000;padding:3px">Jour</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      ${footer(structure, date, signerLabel, signatureUrl, `
        <div style="text-decoration:underline;font-weight:700">NB :</div>
        <div>Il s'agit d'indiquer dans cette colonne <span style="text-decoration:underline">Heure</span> la sommation des absences inférieures à une journée du travail au cours du mois</div>`)}
    </div>`;
}