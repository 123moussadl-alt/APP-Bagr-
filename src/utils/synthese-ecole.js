import { esc, normalizeNotes } from './format.js';
import { computeSubjectRows } from './synthese.js';
import { signatureBlockHTML } from './signature.js';

export const SCHOOL_LEVELS = ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'];

export async function loadSchoolTermData(supabase, schoolId) {
  const [schoolResult, classesResult] = await Promise.all([
    supabase.from('schools').select('id,name').eq('id', schoolId).single(),
    supabase.from('classes').select('*').eq('school_id', schoolId).order('level').order('name')
  ]);
  if (schoolResult.error) throw schoolResult.error;
  if (classesResult.error) throw classesResult.error;

  const classesData = await Promise.all((classesResult.data || []).map(async cls => {
    const [studentsResult, subjectsResult, notesResult] = await Promise.all([
      supabase.from('students').select('*').eq('class_id', cls.id),
      supabase.from('matieres').select('*').eq('class_id', cls.id),
      supabase.from('notes').select('*').eq('classe_id', cls.id)
    ]);
    if (studentsResult.error) throw studentsResult.error;
    if (subjectsResult.error) throw subjectsResult.error;
    if (notesResult.error) throw notesResult.error;

    const subjects = subjectsResult.data && subjectsResult.data.length
      ? subjectsResult.data.map(subject => ({
        id: subject.id,
        name: String(subject.nom || subject.name || '').trim(),
        max: subject.bareme,
        coef: subject.coefficient != null ? subject.coefficient : 1
      }))
      : (cls.subjects || []).map(subject => ({
        id: subject.id,
        name: String(subject.name || subject.nom || '').trim(),
        max: subject.max,
        coef: subject.coef || 1
      }));

    return {
      cls,
      students: studentsResult.data || [],
      subjects,
      notes: normalizeNotes(notesResult.data || [])
    };
  }));
  return { school: schoolResult.data, classesData };
}

function termStudentAverages(classData, term) {
  const notes = normalizeNotes(classData.notes);
  return classData.students.map(student => {
    if (student.status === 'A') return { student, composed: false, average: null };
    const subjectNotes = notes.filter(note => note.eleve_id === student.id && note.trimestre === term);
    const composed = subjectNotes.some(note => note.note != null && note.note !== '');
    let weightedTotal = 0;
    let totalCoefficient = 0;
    classData.subjects.forEach(subject => {
      const note = subjectNotes.find(row => row.matiere_id === subject.id);
      if (!note || note.note == null || note.note === '') return;
      const value = Number.parseFloat(note.note);
      if (!Number.isFinite(value)) return;
      weightedTotal += (value / (Number.parseFloat(subject.max) || 10)) * (Number.parseFloat(subject.coef) || 1);
      totalCoefficient += Number.parseFloat(subject.coef) || 1;
    });
    const average = totalCoefficient
      ? weightedTotal / totalCoefficient * 10
      : null;
    return { student, composed, average };
  });
}

function blankGroup() {
  return { boys: 0, girls: 0, total: 0 };
}

export function computeSchoolTermSynthesis(classesData, term) {
  const rows = SCHOOL_LEVELS.map(level => {
    const levelClasses = (classesData || []).filter(item =>
      String(item.cls.level || '').trim().toUpperCase() === level
    );
    const row = {
      level,
      enrollment: blankGroup(),
      composed: blankGroup(),
      passed: blankGroup(),
      rate: { boys: null, girls: null, total: null },
      subjects: []
    };
    const subjectByName = new Map();

    levelClasses.forEach(classData => {
      classData.students.forEach(student => {
        row.enrollment.total++;
        if (student.gender === 'M') row.enrollment.boys++;
        if (student.gender === 'F') row.enrollment.girls++;
      });

      termStudentAverages(classData, term).forEach(({ student, composed, average }) => {
        if (!composed) return;
        const groups = ['total'];
        if (student.gender === 'M') groups.push('boys');
        if (student.gender === 'F') groups.push('girls');
        groups.forEach(group => {
          row.composed[group]++;
          if (average != null && average >= 5) row.passed[group]++;
        });
      });

      computeSubjectRows(classData.students, classData.subjects, classData.notes, term)
        .filter(subject => subject.tComp > 0)
        .forEach(subject => {
          const key = String(subject.name || '').trim().toLocaleLowerCase();
          const aggregate = subjectByName.get(key) || {
            name: String(subject.name || '').trim(),
            boysPassed: 0, boysComposed: 0,
            girlsPassed: 0, girlsComposed: 0,
            totalPassed: 0, totalComposed: 0
          };
          aggregate.boysPassed += subject.bPass;
          aggregate.boysComposed += subject.bComp;
          aggregate.girlsPassed += subject.gPass;
          aggregate.girlsComposed += subject.gComp;
          aggregate.totalPassed += subject.tPass;
          aggregate.totalComposed += subject.tComp;
          subjectByName.set(key, aggregate);
        });
    });

    ['boys', 'girls', 'total'].forEach(group => {
      row.rate[group] = row.composed[group]
        ? Math.round(row.passed[group] / row.composed[group] * 1000) / 10
        : null;
    });
    row.subjects = [...subjectByName.values()].map(subject => ({
      ...subject,
      boysRate: subject.boysComposed ? Math.round(subject.boysPassed / subject.boysComposed * 1000) / 10 : 0,
      girlsRate: subject.girlsComposed ? Math.round(subject.girlsPassed / subject.girlsComposed * 1000) / 10 : 0,
      totalRate: subject.totalComposed ? Math.round(subject.totalPassed / subject.totalComposed * 1000) / 10 : 0
    }));
    return row;
  });

  const totals = {
    enrollment: blankGroup(),
    composed: blankGroup(),
    passed: blankGroup(),
    rate: { boys: null, girls: null, total: null }
  };
  rows.forEach(row => ['boys', 'girls', 'total'].forEach(group => {
    totals.enrollment[group] += row.enrollment[group];
    totals.composed[group] += row.composed[group];
    totals.passed[group] += row.passed[group];
  }));
  ['boys', 'girls', 'total'].forEach(group => {
    totals.rate[group] = totals.composed[group]
      ? Math.round(totals.passed[group] / totals.composed[group] * 1000) / 10
      : null;
  });
  return { rows, totals };
}

export function renderSchoolTermSynthesisHTML({ schoolName, term, summary, directorSigners, cebSigners }) {
  const termLabel = term === 1 ? '1er Trimestre' : term === 2 ? '2e Trimestre' : '3e Trimestre';
  const groups = [
    { key: 'boys', label: 'G', color: '#111827' },
    { key: 'girls', label: 'F', color: '#dc2626' },
    { key: 'total', label: 'T', color: '#16a34a' }
  ];
  const border = 'border:1px solid #cbd5e1;padding:6px 8px';
  const rate = value => value == null ? '—' : `${value.toFixed(1)}%`;
  const renderOverviewCells = (values, isRate = false) => groups.map(group =>
    `<td style="${border};text-align:center;color:${group.color};${group.key === 'total' ? 'font-weight:700' : ''}">${isRate ? rate(values[group.key]) : values[group.key]}</td>`
  ).join('');
  const directorBlock = signatureBlockHTML('Le Directeur / La Directrice', directorSigners) ||
    '<div class="school-synthesis-signature"><strong>Le Directeur / La Directrice</strong></div>';
  const cebBlock = signatureBlockHTML('Le Chef de la CEB', cebSigners) ||
    '<div class="school-synthesis-signature"><strong>Le Chef de la CEB</strong></div>';

  return `
    <div class="landscape-sheet wide-sheet school-synthesis-sheet" style="background:#fff;color:#111827;padding:18px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;align-items:start;border-bottom:2px solid #111827;padding-bottom:10px">
        <div style="font-size:14px;line-height:1.5"><strong>CEB de Bagré</strong><br><strong>École : ${esc(schoolName || '')}</strong><br><strong>Trimestre : ${esc(termLabel)}</strong></div>
        <div class="official-motto" style="display:flex;flex-direction:column;align-items:center;text-align:center;line-height:1.5"><strong>Burkina Faso</strong><em>La Patrie ou la Mort, nous vaincrons</em></div>
        <div></div>
      </div>
      <h2 style="margin:14px 0;text-align:center;font-size:19px">SYNTHÈSE TRIMESTRIELLE DE L'ÉCOLE — ${esc(termLabel.toUpperCase())}</h2>
      <h3 style="margin:12px 0 6px">Tableau 1 — Résultats de l'ensemble des classes</h3>
      <div class="table-wrap">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr>
              <th rowspan="2" style="${border};vertical-align:middle">Classe</th>
              <th colspan="3" style="${border}">Effectif inscrit</th>
              <th colspan="3" style="${border}">Ayant composé</th>
              <th colspan="3" style="${border}">Ayant eu la moyenne (≥ 5/10)</th>
              <th colspan="3" style="${border}">Taux de réussite (%)</th>
            </tr>
            <tr>${Array.from({ length: 4 }, () => groups.map(group => `<th style="${border};color:${group.color}">${group.label}</th>`).join('')).join('')}</tr>
          </thead>
          <tbody>
            ${summary.rows.map(row => `<tr><th style="${border};text-align:left">${row.level}</th>${renderOverviewCells(row.enrollment)}${renderOverviewCells(row.composed)}${renderOverviewCells(row.passed)}${renderOverviewCells(row.rate, true)}</tr>`).join('')}
            <tr style="font-weight:800;background:#f8fafc"><th style="${border};text-align:left">TOTAL ÉCOLE</th>${renderOverviewCells(summary.totals.enrollment)}${renderOverviewCells(summary.totals.composed)}${renderOverviewCells(summary.totals.passed)}${renderOverviewCells(summary.totals.rate, true)}</tr>
          </tbody>
        </table>
      </div>
      <h3 style="margin:18px 0 6px">Tableau 2 — Réussite par discipline et par classe</h3>
      <div class="table-wrap">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr>
            <th style="${border};text-align:left">Classe</th>
            <th style="${border};text-align:left">Discipline</th>
            <th colspan="2" style="${border}">Garçons ayant la moyenne</th>
            <th colspan="2" style="${border};color:#dc2626">Filles ayant la moyenne</th>
            <th colspan="2" style="${border};color:#16a34a">Total ayant la moyenne</th>
          </tr><tr>
            <th colspan="2" style="${border}"></th>
            <th style="${border}">Nbre</th><th style="${border}">%</th>
            <th style="${border};color:#dc2626">Nbre</th><th style="${border};color:#dc2626">%</th>
            <th style="${border};color:#16a34a">Nbre</th><th style="${border};color:#16a34a">%</th>
          </tr></thead>
          <tbody>
            ${summary.rows.map(row => row.subjects.length
              ? row.subjects.map((subject, index) => `<tr>
                  ${index === 0 ? `<th rowspan="${row.subjects.length}" style="${border};text-align:left;vertical-align:top">${row.level}</th>` : ''}
                  <td style="${border}">${esc(subject.name || '—')}</td>
                  <td style="${border};text-align:center">${subject.boysPassed}</td><td style="${border};text-align:center">${subject.boysRate.toFixed(1)}%</td>
                  <td style="${border};text-align:center;color:#dc2626">${subject.girlsPassed}</td><td style="${border};text-align:center;color:#dc2626">${subject.girlsRate.toFixed(1)}%</td>
                  <td style="${border};text-align:center;color:#16a34a;font-weight:700">${subject.totalPassed}</td><td style="${border};text-align:center;color:#16a34a;font-weight:700">${subject.totalRate.toFixed(1)}%</td>
                </tr>`).join('')
              : `<tr><th style="${border};text-align:left">${row.level}</th><td colspan="7" style="${border};text-align:center">Aucune discipline évaluée</td></tr>`
            ).join('')}
          </tbody>
        </table>
      </div>
      <div class="school-synthesis-signatures" style="display:flex;justify-content:space-between;align-items:flex-start;gap:32px;margin-top:30px">
        <div style="width:45%;text-align:center">${directorBlock}</div>
        <div style="width:45%;text-align:center">${cebBlock}</div>
      </div>
    </div>
  `;
}

export function schoolTermSynthesisCSVRows(schoolName, term, summary) {
  const termLabel = term === 1 ? '1er Trimestre' : term === 2 ? '2e Trimestre' : '3e Trimestre';
  const rows = [
    ['Synthèse Trimestrielle de l’École', schoolName, termLabel],
    [],
    ['Classe', 'Effectif inscrit G', 'Effectif inscrit F', 'Effectif inscrit T', 'Ayant composé G', 'Ayant composé F', 'Ayant composé T', 'Ayant eu la moyenne G', 'Ayant eu la moyenne F', 'Ayant eu la moyenne T', 'Réussite G (%)', 'Réussite F (%)', 'Réussite T (%)']
  ];
  summary.rows.forEach(row => rows.push([
    row.level, row.enrollment.boys, row.enrollment.girls, row.enrollment.total,
    row.composed.boys, row.composed.girls, row.composed.total,
    row.passed.boys, row.passed.girls, row.passed.total,
    row.rate.boys == null ? '' : row.rate.boys,
    row.rate.girls == null ? '' : row.rate.girls,
    row.rate.total == null ? '' : row.rate.total
  ]));
  rows.push([
    'TOTAL ÉCOLE',
    summary.totals.enrollment.boys, summary.totals.enrollment.girls, summary.totals.enrollment.total,
    summary.totals.composed.boys, summary.totals.composed.girls, summary.totals.composed.total,
    summary.totals.passed.boys, summary.totals.passed.girls, summary.totals.passed.total,
    summary.totals.rate.boys == null ? '' : summary.totals.rate.boys,
    summary.totals.rate.girls == null ? '' : summary.totals.rate.girls,
    summary.totals.rate.total == null ? '' : summary.totals.rate.total
  ]);
  rows.push([]);
  rows.push(['Classe', 'Discipline', 'Garçons ayant la moyenne', 'Garçons (%)', 'Filles ayant la moyenne', 'Filles (%)', 'Total ayant la moyenne', 'Total (%)']);
  summary.rows.forEach(row => {
    row.subjects.forEach(subject => rows.push([
      row.level, subject.name, subject.boysPassed, subject.boysRate,
      subject.girlsPassed, subject.girlsRate, subject.totalPassed, subject.totalRate
    ]));
  });
  return rows;
}
