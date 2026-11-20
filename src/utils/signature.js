import { esc } from './format.js';

const SIGNATURE_STORAGE_PREFIX = 'educ_ceb_signature_';
const SIGNATURE_DATA_URL_PATTERN = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

export function isSignatureDataUrl(value) {
  return typeof value === 'string' && SIGNATURE_DATA_URL_PATTERN.test(value);
}

export function signatureUrlForProfile(profile) {
  if (isSignatureDataUrl(profile && profile.signature_url)) return profile.signature_url;
  if (!profile || !profile.id || typeof localStorage === 'undefined') return '';
  try {
    const stored = localStorage.getItem(SIGNATURE_STORAGE_PREFIX + profile.id);
    return isSignatureDataUrl(stored) ? stored : '';
  } catch (error) {
    console.warn('Impossible de lire la signature locale.', error);
    return '';
  }
}

export function signatureStorageKey(userId) {
  return SIGNATURE_STORAGE_PREFIX + userId;
}

export function signatureImageHTML(signatureUrl, alt = 'Signature') {
  if (!isSignatureDataUrl(signatureUrl)) return '';
  return `<img class="digital-signature-stamp" src="${esc(signatureUrl)}" alt="${esc(alt)}">`;
}

function renderSignaturePerson(person) {
  const name = typeof person === 'string'
    ? person
    : (person && (person.full_name || person.nom_complet || person.name)) || '';
  if (!name) return '';
  const signatureUrl = typeof person === 'object' && person
    ? signatureUrlForProfile(person)
    : '';
  return `<span class="digital-signature-person">${signatureImageHTML(signatureUrl, `Signature de ${name}`)}<span>${esc(name)}</span></span>`;
}

export function signaturePeopleHTML(people, fallbackNames = '') {
  const profiles = Array.isArray(people) ? people : [];
  const rendered = profiles.map(renderSignaturePerson).filter(Boolean);
  if (rendered.length) return rendered.join('');
  const fallback = Array.isArray(fallbackNames)
    ? fallbackNames
    : String(fallbackNames || '').split(',').map(name => name.trim()).filter(Boolean);
  return fallback.map(renderSignaturePerson).filter(Boolean).join('');
}

export function signatureBlockHTML(label, people, fallbackNames = '') {
  const signatures = signaturePeopleHTML(people, fallbackNames);
  if (!signatures) return '';
  return `<div class="digital-signature-block"><strong>${esc(label)}</strong><div class="digital-signature-people">${signatures}</div></div>`;
}

export function profileMatchesVisa(visa, profile) {
  const name = String(profile && (profile.full_name || profile.nom_complet) || '').trim();
  return !!name && String(visa || '').includes(name);
}
