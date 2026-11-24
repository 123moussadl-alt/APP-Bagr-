/**
 * Fiches officielles de présence des agents (CEB de Bagré).
 * FICHE A : situation journalière — FICHE B : situation mensuelle.
 */

import { esc } from './format.js';
import { signatureImageHTML } from './signature.js';

const HEADER_LEFT = `
  <div style="text-align:left;text-transform:uppercase;line-height:1.35">
    <div>MINISTERE DE L'ENSEIGNEMENT DE BASE,</div>
    <div>DE L'ALPHABETISATION ET DE LA PROMOTION</div>
      <div>DES LANGUES NATIONALES</div>
      <div style="margin-top:4px;font-weight:800">REGION DU NAKAMBE</div>
  </div>`;

const HEADER_RIGHT = `
  <div style="text-align:center;line-height:1.35">
    <div style="font-weight:800">BURKINA FASO</div>
    <div>--------</div>
    <div><em>La Patrie ou la Mort, nous Vaincrons</em></div>
  </div>`;

function officialHeader() {
  return `<div style="display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #000;padding-bottom:6px">${HEADER_LEFT}${HEADER_RIGHT}</div>`;
}

function titleBanner(text) {
  return `<div style="border:1.5px solid #000;padding:5px 10px;text-align:center;font-weight:bold;text-transform:uppercase;margin:10px 0">${esc(text)}</div>`;
}

function signatureFooter(structureLabel, date, signerLabel, signatureUrl) {
  const img = signatureImageHTML(signatureUrl, 'Signature', 'max-height:42px;width:auto;height:auto;object-fit:contain;margin:2px auto 0;display:block');
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-top:16px;font-size:10pt">
      <div style="flex:1;text-align:left">
        <div style="text-decoration:underline;font-weight:700">NB :</div>
        <div>la colonne Heure indique la situation où l'absence est inférieure à la journée du travail</div>
        <div>la colonne Jour renseigne la situation où l'absence est égale à la journée du travail</div>
      </div>
      <div style="flex:1;text-align:right">
        <div>Fait à ${esc(structureLabel || 'Bagré')}, le ${esc(date)}</div>
        <div style="margin-top:14px;font-weight:700;text-decoration:underline">${esc(signerLabel)}</div>
        ${img}
      </div>
    </div>`;
}

export function renderFicheAPresenceHTML({ structure, date, heure, agents, signerLabel = 'Le Directeur', signatureUrl = '', editable = false }) {
  const rows = (agents || []).map((agent, index) => {
    const isWoman = String(agent.gender || agent.sexe || '').toUpperCase() === 'F';
    const nameStyle = isWoman ? 'color:#dc2626;font-weight:600;' : '';
    const present = agent.present !== false;
    return `
      <tr data-agent-row="${esc(agent.id)}">
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${index + 1}</td>
        <td style="border:1px solid #000;padding:4px 6px;${nameStyle}">${esc(agent.full_name || '')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(agent.matricule || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(agent.emploi || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(agent.fonction || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;font-weight:700;${present ? 'color:#16a34a;' : ''}">${present ? 'X' : ''}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;font-weight:700;${present ? '' : 'color:#dc2626;'}" data-action="presence-toggle" data-agent-id="${esc(agent.id)}" data-date="${esc(date)}">${present ? '' : 'X'}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${editable ? `<input type="number" min="0" step="0.5" value="${esc(agent.heure != null ? agent.heure : '')}" class="presence-heure" data-agent="${esc(agent.id)}" style="width:60px;border:none;text-align:center">` : esc(agent.heure != null ? agent.heure : '')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${editable ? `<input type="number" min="0" step="1" value="${esc(agent.jour != null ? agent.jour : '')}" class="presence-jour" data-agent="${esc(agent.id)}" style="width:60px;border:none;text-align:center">` : esc(agent.jour != null ? agent.jour : '')}</td>
      </tr>`;
  }).join('') || '<tr><td colspan="9" style="border:1px solid #000;padding:6px;text-align:center">Aucun agent</td></tr>';

  return `
    <div class="presence-official-sheet" style="font-family:Arial,sans-serif;color:#111;background:#fff;padding:10px;box-sizing:border-box">
      ${officialHeader()}
      ${titleBanner('FICHE A : SITUATION JOURNALIERE DE PRESENCE DES AGENTS')}
      <div style="font-size:10pt;line-height:1.5;margin-bottom:8px">
        <div><strong>STRUCTURE :</strong> ${esc(structure || 'CEB de Bagré / Boulgou')}</div>
        <div><strong>Date :</strong> ${esc(date)}</div>
        <div><strong>Heure :</strong> ${esc(heure || '')}</div>
      </div>
      <table style="border:1px solid #000;border-collapse:collapse;width:100%;font-size:9pt">
        <thead>
          <tr>
            <th rowspan="2" style="border:1px solid #000;padding:4px">N° d'ordre</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Nom et Prénom(s)</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Matricule</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Emploi</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Fonction</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Présent</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Absent</th>
            <th colspan="2" style="border:1px solid #000;padding:4px">Durée de l'absence</th>
          </tr>
          <tr>
            <th style="border:1px solid #000;padding:3px">Heure</th>
            <th style="border:1px solid #000;padding:3px">Jour</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${signatureFooter(structure, date, signerLabel, signatureUrl)}
    </div>`;
}

export function renderFicheBPresenceHTML({ structure, date, mois, annee, rows, signerLabel = 'Le Directeur', signatureUrl = '' }) {
  const body = (rows || []).map((row, index) => {
    const isWoman = String(row.gender || row.sexe || '').toUpperCase() === 'F';
    const nameStyle = isWoman ? 'color:#dc2626;font-weight:600;' : '';
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
        <td style="border:1px solid #000;padding:4px 6px">${esc(row.mesures || '')}</td>
        <td style="border:1px solid #000;padding:4px 6px">${esc(row.references || '')}</td>
      </tr>`;
  }).join('') || '<tr><td colspan="10" style="border:1px solid #000;padding:6px;text-align:center">Aucun agent</td></tr>';

  return `
    <div class="presence-official-sheet" style="font-family:Arial,sans-serif;color:#111;background:#fff;padding:10px;box-sizing:border-box">
      ${officialHeader()}
      ${titleBanner('FICHE B : SITUATION MENSUELLE DE PRESENCE DES AGENTS')}
      <div style="font-size:10pt;line-height:1.5;margin-bottom:8px">
        <div><strong>STRUCTURE :</strong> ${esc(structure || 'CEB de Bagré / Boulgou')}</div>
        <div><strong>Date :</strong> ${esc(date)}</div>
        <div><strong>Mois :</strong> ${esc(mois || '')} &nbsp;&nbsp; <strong>Année :</strong> ${esc(annee || '')}</div>
      </div>
      <table style="border:1px solid #000;border-collapse:collapse;width:100%;font-size:9pt">
        <thead>
          <tr>
            <th rowspan="2" style="border:1px solid #000;padding:4px">N° d'ordre</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Nom et Prénom(s)</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Matricule</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Emploi</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Fonction</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Structure</th>
            <th colspan="2" style="border:1px solid #000;padding:4px">Absence</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Mesures prises</th>
            <th rowspan="2" style="border:1px solid #000;padding:4px">Références des pièces justificatives de la mesure prise s'il y a lieu</th>
          </tr>
          <tr>
            <th style="border:1px solid #000;padding:3px">Heure</th>
            <th style="border:1px solid #000;padding:3px">Jour</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-top:16px;font-size:9pt">
        <div style="flex:1;text-align:left;max-width:46%">
          <div style="text-decoration:underline;font-weight:700">NB :</div>
          <div>Il s'agit d'indiquer dans cette colonne Heure la sommation des absences inférieures à une journée du travail au cours du mois</div>
        </div>
        <div style="flex:1;text-align:right">
          <div>Fait à ${esc(structure || 'Bagré')}, le ${esc(date)}</div>
          <div style="margin-top:14px;font-weight:700;text-decoration:underline">${esc(signerLabel)}</div>
          ${signatureImageHTML(signatureUrl, 'Signature', 'max-height:42px;width:auto;height:auto;object-fit:contain;margin:2px auto 0;display:block')}
        </div>
      </div>
    </div>`;
}