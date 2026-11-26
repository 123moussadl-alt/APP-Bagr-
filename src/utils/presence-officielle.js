/**
 * Fiches officielles de présence des agents (CEB de Bagré) — FICHE A (journalière) & FICHE B (mensuelle).
 */

import { esc } from './format.js';
import { signatureImageHTML } from './signature.js';

const GRAY = '#d9d9d9';

/**
 * Returns the regulatory work hours label for a given ISO date string (YYYY-MM-DD).
 * Mon/Tue/Thu/Fri → "07h30 à 17h00"
 * Wed             → "07h30 à 11h30"
 * Fallback        → "07h30 à 17h00"
 */
export function regulatoryHoursForDate(isoDate) {
  if (!isoDate) return '07h30 à 17h00';
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return '07h30 à 17h00';
  const day = d.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  return day === 3 ? '07h30 à 11h30' : '07h30 à 17h00';
}

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

function metaBox(label, value, isInput = false, inputProps = '') {
  return `
    <div style="display:flex;justify-content:center;align-items:center;gap:8px;margin:3px 0">
      <span style="font-weight:700;text-align:right;width:120px;min-width:120px">${esc(label)}</span>
      <div class="fiche-meta-box" style="border:1px solid #000;padding:3px 12px;width:340px;min-width:340px;max-width:340px;box-sizing:border-box;text-align:center;font-weight:700;display:inline-flex;align-items:center;justify-content:center;background:#fff;height:28px">
        ${isInput
          ? `<input type="text" value="${esc(value || '')}" ${inputProps} style="border:none;outline:none;background:transparent;text-align:center;font-weight:700;font-size:inherit;width:100%;font-family:inherit;padding:0;margin:0">`
          : `<span style="width:100%">${esc(value || '')}</span>`}
      </div>
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

/** Dash cell — centered em-dash, muted, for read-only "not applicable" cells */
const DASH_CELL = '<span style="color:#94a3b8;font-size:11pt;font-weight:400;letter-spacing:1px">—</span>';

export function renderFicheA({
  structure,
  date,
  heure,          // pre-computed regulatory hours string (passed from view)
  isoDate = '',   // ISO date (YYYY-MM-DD) used to auto-compute hours if heure is absent
  agents = [],
  signerLabel = 'Le Directeur',
  signatureUrl = '',
  actionName = 'data-action="agent-set-presence"',
  agentAttr = 'data-agent-id',
  editable = true
}) {
  // Determine the displayed heure_appel value
  const heureDisplay = heure || regulatoryHoursForDate(isoDate);

  const rows = (agents || []).map((agent, index) => {
    const isWoman = String(agent.gender || agent.sexe || '').toUpperCase() === 'F';
    const nameStyle = isWoman ? 'color:#dc2626;font-weight:600;' : '';
    const isPresent = agent.present !== false && !agent.absent;
    const agentId = esc(agent.id);

    // ── Présent column ──────────────────────────────────────────────────────
    const presentCell = isPresent
      ? '<span style="font-weight:800;color:#16a34a;font-size:10.5pt;letter-spacing:0.5px">OUI</span>'
      : '<span style="color:#94a3b8;font-weight:600;font-size:9.5pt">NON</span>';

    // ── Absent column ───────────────────────────────────────────────────────
    // When present → show a clean dash (not "NON")
    const absentCell = isPresent
      ? DASH_CELL
      : '<span style="font-weight:800;color:#dc2626;font-size:10.5pt;letter-spacing:0.5px">OUI</span>';

    // ── Heure / Jour columns ────────────────────────────────────────────────
    // When present → show dash, inputs disabled; when absent → editable inputs
    let heureCell, jourCell;
    if (isPresent) {
      // Always show a dash — no input, no value
      heureCell = DASH_CELL;
      jourCell  = DASH_CELL;
    } else {
      const heureVal = agent.heure != null && agent.heure !== '' ? agent.heure : 0;
      const jourVal  = agent.jour  != null && agent.jour  !== '' ? agent.jour  : 1;
      if (editable) {
        heureCell = `<input type="number" min="0" step="0.5" value="${esc(heureVal)}" class="fiche-heure" ${agentAttr}="${agentId}" style="width:64px;border:1px solid #94a3b8;border-radius:3px;outline:none;background:#fefce8;text-align:center;font-size:9.5pt;font-family:inherit;padding:1px 2px">`;
        jourCell  = `<input type="number" min="0" step="1"   value="${esc(jourVal)}"  class="fiche-jour"  ${agentAttr}="${agentId}" style="width:64px;border:1px solid #94a3b8;border-radius:3px;outline:none;background:#fefce8;text-align:center;font-size:9.5pt;font-family:inherit;padding:1px 2px">`;
      } else {
        heureCell = `<span>${esc(heureVal)}</span>`;
        jourCell  = `<span>${esc(jourVal)}</span>`;
      }
    }

    return `
      <tr>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${index + 1}</td>
        <td style="border:1px solid #000;padding:4px 6px;${nameStyle}">${esc(agent.full_name || '')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(agent.matricule || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(agent.emploi || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(agent.fonction || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;cursor:${editable ? 'pointer' : 'default'};user-select:none"
          ${editable ? `${actionName} ${agentAttr}="${agentId}" data-target-present="true" title="Cliquer pour marquer Présent"` : ''}>${presentCell}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;cursor:${editable ? 'pointer' : 'default'};user-select:none"
          ${editable ? `${actionName} ${agentAttr}="${agentId}" data-target-present="false" title="Cliquer pour marquer Absent"` : ''}>${absentCell}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${heureCell}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${jourCell}</td>
      </tr>`;
  }).join('') || '<tr><td colspan="9" style="border:1px solid #000;padding:6px;text-align:center">Aucun agent</td></tr>';

  return `
    <div class="presence-official-sheet" style="font-family:Arial,sans-serif;color:#111;background:#fff;padding:10px;box-sizing:border-box">
      ${officialHeader()}
      ${grayTitle('FICHE A : SITUATION JOURNALIERE DE PRESENCE DES AGENTS')}
      ${metaBox('STRUCTURE :', structure || 'CEB de Bagré / Boulgou')}
      ${metaBox('Date :', date)}
      ${metaBox('Heure :', heureDisplay, editable, 'class="fiche-heure-appel" placeholder="Ex: 07h30 à 17h00"')}
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
  structure, date, mois, annee, rows = [], signerLabel = 'Le Directeur', signatureUrl = '', editable = false,
  agentAttr = 'data-agent'
}) {
  const body = (rows || []).map((row, index) => {
    const isWoman = String(row.gender || row.sexe || '').toUpperCase() === 'F';
    const nameStyle = isWoman ? 'color:#dc2626;font-weight:600;' : '';
    const agentId = esc(row.id);
    const heureVal = (row.heure != null && Number(row.heure) !== 0 && row.heure !== '0') ? row.heure : '—';
    const jourVal  = (row.jour  != null && Number(row.jour)  !== 0 && row.jour  !== '0') ? row.jour  : '—';
    const mesuresVal = row.mesures != null ? row.mesures : (row.mesures_prises || '');
    const refsVal = row.references != null ? row.references : (row.references_pieces || '');
    return `
      <tr>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${index + 1}</td>
        <td style="border:1px solid #000;padding:4px 6px;${nameStyle}">${esc(row.full_name || '')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(row.matricule || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(row.emploi || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(row.fonction || '—')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">${esc(row.structure || '')}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;font-weight:${Number(row.heure) > 0 ? '700' : '400'};color:${Number(row.heure) > 0 ? '#dc2626' : '#94a3b8'}">${esc(heureVal === 0 || heureVal === '0' ? '—' : heureVal)}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;font-weight:${Number(row.jour) > 0 ? '700' : '400'};color:${Number(row.jour) > 0 ? '#dc2626' : '#94a3b8'}">${esc(jourVal === 0 || jourVal === '0' ? '—' : jourVal)}</td>
        <td style="border:1px solid #000;padding:4px 6px">${editable ? `<input type="text" value="${esc(mesuresVal)}" class="fiche-mesures" ${agentAttr}="${agentId}" style="width:100%;border:none;outline:none;background:transparent;font-family:inherit;font-size:inherit" placeholder="Mesures prises...">` : esc(mesuresVal)}</td>
        <td style="border:1px solid #000;padding:4px 6px">${editable ? `<input type="text" value="${esc(refsVal)}" class="fiche-references" ${agentAttr}="${agentId}" style="width:100%;border:none;outline:none;background:transparent;font-family:inherit;font-size:inherit" placeholder="Références...">` : esc(refsVal)}</td>
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
            <th colspan="2" style="border:1px solid #000;padding:4px;text-align:center">Absence</th>
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
