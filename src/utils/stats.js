/**
 * Calculs de résultats (moyennes, taux de réussite) partagés.
 * Utilise la table public.notes (eleve_id, matiere_id, trimestre, note)
 * et les barèmes de public.matieres (ou classes.subjects à défaut).
 */

import { normalizeNotes } from './format.js';

function summarize(avgs) {
  if (!avgs.length) return { avg: null, passRate: 0, high: null, low: null, count: 0 };
  const avg = avgs.reduce((a, b) => a + b, 0) / avgs.length;
  const passRate = Math.round((avgs.filter(v => v >= 5).length / avgs.length) * 1000) / 10;
  return {
    avg: Math.round(avg * 100) / 100,
    passRate,
    high: Math.round(Math.max(...avgs) * 100) / 100,
    low: Math.round(Math.min(...avgs) * 100) / 100,
    count: avgs.length
  };
}

export async function getClassResult(supabase, cls, students) {
  let subjects = (cls.subjects || []).map(s => ({ id: s.id, max: s.max, coef: s.coef || 1 }));
  try {
    const { data: matieres } = await supabase.from('matieres').select('*').eq('class_id', cls.id);
    if (matieres && matieres.length > 0) {
      subjects = matieres.map(m => ({ id: m.id, max: m.bareme, coef: m.coefficient != null ? m.coefficient : 1 }));
    }
  } catch (e) { /* ignore */ }

  let notes = [];
  if (students.length) {
    try {
      const { data } = await supabase.from('notes').select('*').eq('classe_id', cls.id);
      notes = normalizeNotes(data || []);
    } catch (e) { notes = []; }
  }

  const terms = {};
  for (const term of [1, 2, 3]) {
    const avgs = [];
    students.forEach(s => {
      if (s.status === 'A') return; // abandons exclus des moyennes/taux actifs
      let sumPN = 0, sumCoef = 0, count = 0;
      notes.filter(n => n.eleve_id === s.id && n.trimestre === term && n.note != null).forEach(n => {
        const sub = subjects.find(x => x.id === n.matiere_id);
        const max = sub ? (parseFloat(sub.max) || 10) : 10;
        const coef = sub ? (parseFloat(sub.coef) || 1) : 1;
        sumPN += (parseFloat(n.note) / max) * coef;
        sumCoef += coef;
        count++;
      });
      if (count > 0 && sumCoef > 0) avgs.push((sumPN / sumCoef) * 10);
    });
    terms[term] = summarize(avgs);
  }

  const annualAvgs = [1, 2, 3].map(t => terms[t].avg).filter(v => v != null);
  const annualAvg = annualAvgs.length ? Math.round((annualAvgs.reduce((a, b) => a + b, 0) / annualAvgs.length) * 100) / 100 : null;

  return {
    cls,
    boys: students.filter(s => s.gender === 'M').length,
    girls: students.filter(s => s.gender === 'F').length,
    total: students.length,
    terms,
    annualAvg
  };
}

export function rankSuffix(rank, isGirl, tie) {
  let s = rank === 1 ? (isGirl ? 'ère' : 'er') : 'e';
  if (tie) s += ' ex';
  return rank + s;
}

export async function getStudentAnnual(supabase, cls, students) {
  let subjects = (cls.subjects || []).map(s => ({ id: s.id, max: s.max, coef: s.coef || 1 }));
  try {
    const { data: matieres } = await supabase.from('matieres').select('*').eq('class_id', cls.id);
    if (matieres && matieres.length) {
      subjects = matieres.map(m => ({ id: m.id, max: m.bareme, coef: m.coefficient != null ? m.coefficient : 1 }));
    }
  } catch (e) { /* ignore */ }

  let notes = [];
  try {
    const { data } = await supabase.from('notes').select('*').eq('classe_id', cls.id);
    notes = normalizeNotes(data || []);
  } catch (e) { notes = []; }

  const list = students || [];
  const result = list.map(s => {
    const termAvg = (term) => {
      let sumPN = 0, sumCoef = 0, count = 0;
      notes.filter(n => n.eleve_id === s.id && n.trimestre === term && n.note != null).forEach(n => {
        const sub = subjects.find(x => x.id === n.matiere_id);
        const max = sub ? (parseFloat(sub.max) || 10) : 10;
        const coef = sub ? (parseFloat(sub.coef) || 1) : 1;
        sumPN += (parseFloat(n.note) / max) * coef;
        sumCoef += coef;
        count++;
      });
      return (count > 0 && sumCoef > 0) ? (sumPN / sumCoef * 10) : null;
    };
const t1 = termAvg(1), t2 = termAvg(2), t3 = termAvg(3);
    const abandon = s.status === 'A';
    const avail = abandon ? [] : [t1, t2, t3].filter(v => v != null);
    const annual = abandon ? 0 : (avail.length ? avail.reduce((a, b) => a + b, 0) / avail.length : null);
    const round = (v) => v != null ? Math.round(v * 100) / 100 : null;
    return { s, t1: round(t1), t2: round(t2), t3: round(t3), annual: round(annual), abandon, isGirl: s.gender === 'F' };
  });

  const graded = result.filter(x => x.annual != null && !x.abandon);
  const sorted = [...graded].sort((a, b) => b.annual - a.annual);
  const rankMap = {};
  const cnt = {};
  graded.forEach(x => { const k = x.annual.toFixed(4); cnt[k] = (cnt[k] || 0) + 1; });
  let last = null, rank = 0;
  sorted.forEach((x, i) => {
    const k = x.annual.toFixed(4);
    if (last === null || k !== last) { rank = i + 1; last = k; }
    rankMap[x.s.id] = { rank, tie: (cnt[k] || 0) > 1 };
  });

  return result.map(x => ({ ...x, rankInfo: x.abandon ? null : (rankMap[x.s.id] || null) }));
}