/**
 * EDUC CEB BAGRÉ — PLATEFORME OFFICIELLE DE GESTION SCOLAIRE
 * Circonscription d'Éducation de Base de Bagré (Burkina Faso)
 */

const STORAGE_KEY = "educ-ceb-bagre-v5";

// 3 MODÈLES DE CLASSES EXACTS SELON LES CLASSEURS OFFICIELS
const PRESETS = {
  CM: {
    name: "CM1",
    school: "Bagré Peul",
    ceb: "BAGRÉ",
    director: "GUEBRE Roland",
    titulaire: "Moussa DIALLO",
    titulaire2: "",
    year: "2026-2027",
    paiSubject: "Lecture",
    percentStart: 0.43,
    startEffectif: { g: 1, f: 1, t: 2 },
    subjects: [
      { id: "s1", name: "Rédaction", max: 10 },
      { id: "s2", name: "Dictée", max: 10 },
      { id: "s3", name: "Etude de texte", max: 20 },
      { id: "s4", name: "Présentation", max: 10 },
      { id: "s5", name: "Sciences", max: 20 },
      { id: "s6", name: "Hist-Géo", max: 20 },
      { id: "s7", name: "ECP", max: 10 },
      { id: "s8", name: "Opérations", max: 20 },
      { id: "s9", name: "Problème", max: 20 },
      { id: "s10", name: "Anglais", max: 10 },
      { id: "s11", name: "Lecture", max: 10 },
      { id: "s12", name: "Récit/Chant", max: 10 },
      { id: "s13", name: "Dessin", max: 10 }
    ],
    demoStudents: [
      { id: "cm-1", order: 1, fullName: "DIALLO Moussa", gender: "M", status: "Nouveau", edi: "", handicap: "", age: 11, scolarite: "" },
      { id: "cm-2", order: 2, fullName: "KABORE Fatou", gender: "F", status: "Nouveau", edi: "", handicap: "", age: 10, scolarite: "" }
    ],
    demoGrades: {
      "cm-1:s1:1": { value: 5, absent: false },
      "cm-1:s2:1": { value: 4, absent: false },
      "cm-1:s3:1": { value: 10, absent: false },
      "cm-1:s4:1": { value: 5, absent: false },
      "cm-1:s5:1": { value: 10, absent: false },
      "cm-1:s6:1": { value: 11, absent: false },
      "cm-1:s7:1": { value: 5, absent: false },
      "cm-1:s8:1": { value: 10, absent: false },
      "cm-1:s9:1": { value: 10, absent: false },
      "cm-1:s10:1": { value: 5, absent: false },
      "cm-1:s11:1": { value: 4, absent: false },
      "cm-1:s12:1": { value: 5, absent: false },
      "cm-1:s13:1": { value: 5, absent: false },
      "cm-2:s1:1": { value: 4, absent: false },
      "cm-2:s2:1": { value: 4, absent: false },
      "cm-2:s3:1": { value: 10, absent: false },
      "cm-2:s4:1": { value: 5, absent: false },
      "cm-2:s5:1": { value: 20, absent: false },
      "cm-2:s6:1": { value: 19.5, absent: false },
      "cm-2:s7:1": { value: 3, absent: false },
      "cm-2:s8:1": { value: 12, absent: false },
      "cm-2:s9:1": { value: 20, absent: false },
      "cm-2:s10:1": { value: 4, absent: false },
      "cm-2:s11:1": { value: 5, absent: false },
      "cm-2:s12:1": { value: 5, absent: false },
      "cm-2:s13:1": { value: 5, absent: false }
    },
    paiData: {
      1: { tauxTrimestre: 0.5526, suggestions: "Les élèves sont en progression satisfaisante.", decision: "Poursuite" },
      2: { tauxTrimestre: null, suggestions: "", decision: "" },
      3: { tauxTrimestre: null, suggestions: "", decision: "" }
    }
  },

  CE: {
    name: "CE2",
    school: "Bagré Peul",
    ceb: "BAGRÉ",
    director: "GUEBRE Roland",
    titulaire: "Moussa DIALLO",
    titulaire2: "",
    year: "2026-2027",
    paiSubject: "ECP",
    percentStart: 0.12,
    startEffectif: { g: 2, f: 1, t: 3 },
    subjects: [
      { id: "s1", name: "Lecture", max: 10 },
      { id: "s2", name: "Exp Orale", max: 10 },
      { id: "s3", name: "Récit/Chant", max: 10 },
      { id: "s4", name: "Observation", max: 10 },
      { id: "s5", name: "Ecriture", max: 10 },
      { id: "s6", name: "Copie", max: 10 },
      { id: "s7", name: "Calcul", max: 10 },
      { id: "s8", name: "Dictée", max: 10 },
      { id: "s9", name: "Dessin", max: 10 }
    ],
    demoStudents: [
      { id: "ce-1", order: 1, fullName: "SADA Mariam", gender: "F", status: "Nouveau", edi: "", handicap: "", age: 8, scolarite: "" },
      { id: "ce-2", order: 2, fullName: "FA Ibrahim", gender: "M", status: "Nouveau", edi: "", handicap: "", age: 9, scolarite: "" },
      { id: "ce-3", order: 3, fullName: "TOUGRI Adama", gender: "M", status: "Nouveau", edi: "", handicap: "", age: 8, scolarite: "" }
    ],
    demoGrades: {
      "ce-1:s1:1": { value: 4, absent: false },
      "ce-1:s2:1": { value: 8, absent: false },
      "ce-1:s3:1": { value: 7, absent: false },
      "ce-1:s4:1": { value: 5, absent: false },
      "ce-1:s5:1": { value: 6, absent: false },
      "ce-1:s6:1": { value: 7, absent: false },
      "ce-1:s7:1": { value: 5, absent: false },
      "ce-1:s8:1": { value: 6, absent: false },
      "ce-1:s9:1": { value: 8, absent: false },
      "ce-2:s1:1": { value: 4, absent: false },
      "ce-2:s2:1": { value: 8, absent: false },
      "ce-2:s3:1": { value: 7, absent: false },
      "ce-2:s4:1": { value: 5, absent: false },
      "ce-2:s5:1": { value: 4, absent: false },
      "ce-2:s6:1": { value: 5, absent: false },
      "ce-2:s7:1": { value: 6, absent: false },
      "ce-2:s8:1": { value: 4, absent: false },
      "ce-2:s9:1": { value: 5, absent: false },
      "ce-3:s1:1": { value: 2, absent: false },
      "ce-3:s2:1": { value: 5, absent: false },
      "ce-3:s3:1": { value: 4, absent: false },
      "ce-3:s4:1": { value: 4, absent: false },
      "ce-3:s5:1": { value: 3, absent: false },
      "ce-3:s6:1": { value: 4, absent: false },
      "ce-3:s7:1": { value: 3, absent: false },
      "ce-3:s8:1": { value: 2, absent: false },
      "ce-3:s9:1": { value: 4, absent: false }
    },
    paiData: {
      1: { tauxTrimestre: null, suggestions: "", decision: "" },
      2: { tauxTrimestre: null, suggestions: "", decision: "" },
      3: { tauxTrimestre: null, suggestions: "", decision: "" }
    }
  },

  CP: {
    name: "CP1",
    school: "Bagré Peul",
    ceb: "BAGRÉ",
    director: "GUEBRE Roland",
    titulaire: "Moussa DIALLO",
    titulaire2: "",
    year: "2026-2027",
    paiSubject: "Lecture",
    percentStart: 0.2345,
    startEffectif: { g: 24, f: 2, t: 26 },
    subjects: [
      { id: "s1", name: "Lecture", max: 10 },
      { id: "s2", name: "Exp orale", max: 10 },
      { id: "s3", name: "Récit/chant", max: 10 },
      { id: "s4", name: "Ex Sensoriels", max: 10 },
      { id: "s5", name: "Ecriture", max: 10 },
      { id: "s6", name: "Copie", max: 10 },
      { id: "s7", name: "Calcul", max: 10 },
      { id: "s8", name: "Dictée", max: 10 },
      { id: "s9", name: "Dessin", max: 10 }
    ],
    demoStudents: [
      { id: "cp-1", order: 1, fullName: "MALGOUBRI Abdoul Gafarou", gender: "F", status: "Nouveau", edi: "", handicap: "", age: 6, scolarite: "" },
      { id: "cp-2", order: 2, fullName: "RABO Youssouf", gender: "M", status: "Nouveau", edi: "", handicap: "", age: 6, scolarite: "" }
    ],
    demoGrades: {
      "cp-1:s1:1": { value: 4, absent: false },
      "cp-1:s2:1": { value: 5, absent: false },
      "cp-1:s3:1": { value: 9, absent: false },
      "cp-1:s4:1": { value: 5, absent: false },
      "cp-1:s5:1": { value: 5, absent: false },
      "cp-1:s6:1": { value: 5, absent: false },
      "cp-1:s7:1": { value: 5, absent: false },
      "cp-1:s8:1": { value: 5, absent: false },
      "cp-1:s9:1": { value: 5, absent: false },
      "cp-2:s1:1": { value: 5, absent: false },
      "cp-2:s2:1": { value: 5, absent: false },
      "cp-2:s3:1": { value: 5, absent: false },
      "cp-2:s4:1": { value: 5, absent: false },
      "cp-2:s5:1": { value: 5, absent: false },
      "cp-2:s6:1": { value: 3, absent: false },
      "cp-2:s7:1": { value: 5, absent: false },
      "cp-2:s8:1": { value: 5, absent: false },
      "cp-2:s9:1": { value: 5, absent: false }
    },
    paiData: {
      1: { tauxTrimestre: null, suggestions: "", decision: "" },
      2: { tauxTrimestre: null, suggestions: "", decision: "" },
      3: { tauxTrimestre: null, suggestions: "", decision: "" }
    }
  }
};

let state = loadInitialState();
let activeView = "maclasse";
let selectedTerm = 1;
let selectedBulletinStudentId = "all";
let gradeMode = "table"; // "table" ou "card"
let cardStudentIndex = 0;

// ============================================================================
// 1. GESTION DES DONNÉES
// ============================================================================

function loadInitialState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }
  const initialClass = createClassFromPreset("CP");
  return {
    activeClassId: initialClass.id,
    classes: [initialClass]
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentClass() {
  let c = state.classes.find(x => x.id === state.activeClassId);
  if (!c && state.classes.length > 0) {
    state.activeClassId = state.classes[0].id;
    c = state.classes[0];
  }
  if (c && !c.paiData) c.paiData = { 1: {}, 2: {}, 3: {} };
  if (c && !c.propositions) c.propositions = {};
  if (c && !c.decisionsCCEB) c.decisionsCCEB = {};
  return c;
}

function createClassFromPreset(type) {
  const p = PRESETS[type] || PRESETS.CP;
  return {
    id: "cls-" + type.toLowerCase() + "-" + Date.now(),
    type: type,
    name: p.name,
    school: p.school,
    ceb: p.ceb,
    director: p.director,
    titulaire: p.titulaire,
    titulaire2: p.titulaire2,
    year: p.year,
    paiSubject: p.paiSubject,
    percentStart: p.percentStart,
    startEffectif: { ...p.startEffectif },
    paiData: JSON.parse(JSON.stringify(p.paiData || { 1: {}, 2: {}, 3: {} })),
    subjects: JSON.parse(JSON.stringify(p.subjects)),
    students: JSON.parse(JSON.stringify(p.demoStudents)),
    grades: JSON.parse(JSON.stringify(p.demoGrades)),
    propositions: {},
    decisionsCCEB: {}
  };
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}

// ============================================================================
// 2. MOTEUR DE CALCUL CONFORME
// ============================================================================

function gradeKey(studentId, subjectId, term) {
  return `${studentId}:${subjectId}:${term}`;
}

function getGrade(studentId, subjectId, term) {
  const c = currentClass();
  return c.grades[gradeKey(studentId, subjectId, term)] || { value: "", absent: false };
}

/**
 * Calcul trimestriel : (Total Obtenu / Total Barème composé) * 10
 * Si absent 'A' : matière neutralisée au dénominateur
 */
function studentTermStats(studentId, term) {
  const c = currentClass();
  const subjects = c.subjects;

  let totalObtained = 0;
  let totalMax = 0;
  let composedCount = 0;
  let absentCount = 0;

  subjects.forEach(sub => {
    const g = getGrade(studentId, sub.id, term);
    const maxVal = Number(sub.max) || 10;

    if (g.absent) {
      absentCount++;
      return; // neutralisé au diviseur
    }

    if (g.value !== "" && g.value !== null && !isNaN(Number(g.value))) {
      composedCount++;
      totalObtained += Number(g.value);
      totalMax += maxVal;
    }
  });

  if (composedCount === 0) {
    return {
      average: absentCount > 0 ? "A" : null,
      totalObtained: 0,
      totalMax: 0,
      composedCount
    };
  }

  const avg = (totalObtained / totalMax) * 10;
  return {
    average: Math.round(avg * 100) / 100,
    totalObtained: Math.round(totalObtained * 100) / 100,
    totalMax,
    composedCount
  };
}

function rankedStudents(term) {
  const c = currentClass();
  const list = c.students.map(s => {
    const stats = studentTermStats(s.id, term);
    return {
      ...s,
      average: stats.average,
      totalObtained: stats.totalObtained,
      totalMax: stats.totalMax,
      composedCount: stats.composedCount
    };
  });

  list.sort((a, b) => {
    const avgA = typeof a.average === "number" ? a.average : -999;
    const avgB = typeof b.average === "number" ? b.average : -999;
    return avgB - avgA;
  });

  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (typeof s.average !== "number") {
      s.rankLabel = "";
      s.numericRank = 999;
      continue;
    }
    if (i > 0 && typeof list[i - 1].average === "number") {
      if (Math.abs(list[i - 1].average - s.average) < 0.001) {
        s.numericRank = list[i - 1].numericRank;
        s.isExAequo = true;
        list[i - 1].isExAequo = true;
      } else {
        s.numericRank = i + 1;
      }
    } else {
      s.numericRank = 1;
    }
  }

  list.forEach(s => {
    if (typeof s.average !== "number") return;
    const isGirl = s.gender === "F";
    const suffix = s.numericRank === 1 ? (isGirl ? "ère" : "er") : "e";
    const exStr = s.isExAequo ? " ex" : "";
    s.rankLabel = `${s.numericRank}${suffix}${exStr}`;
  });

  return list;
}

function rankedAnnualStudents() {
  const c = currentClass();
  const list = c.students.map(s => {
    const t1 = studentTermStats(s.id, 1);
    const t2 = studentTermStats(s.id, 2);
    const t3 = studentTermStats(s.id, 3);

    const vals = [t1.average, t2.average, t3.average].filter(v => typeof v === "number");
    const annualAvg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    return {
      ...s,
      t1: t1.average,
      t2: t2.average,
      t3: t3.average,
      annualAverage: annualAvg !== null ? Math.round(annualAvg * 100) / 100 : null,
      propConseil: c.propositions[s.id] || (annualAvg !== null && annualAvg >= 5 ? "Admis(e)" : (annualAvg !== null ? "Redouble" : "")),
      decCCEB: c.decisionsCCEB[s.id] || ""
    };
  });

  list.sort((a, b) => {
    const avgA = typeof a.annualAverage === "number" ? a.annualAverage : -999;
    const avgB = typeof b.annualAverage === "number" ? b.annualAverage : -999;
    return avgB - avgA;
  });

  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (typeof s.annualAverage !== "number") {
      s.rankLabel = "";
      s.numericRank = 999;
      continue;
    }
    if (i > 0 && typeof list[i - 1].annualAverage === "number") {
      if (Math.abs(list[i - 1].annualAverage - s.annualAverage) < 0.001) {
        s.numericRank = list[i - 1].numericRank;
        s.isExAequo = true;
        list[i - 1].isExAequo = true;
      } else {
        s.numericRank = i + 1;
      }
    } else {
      s.numericRank = 1;
    }
  }

  list.forEach(s => {
    if (typeof s.annualAverage !== "number") return;
    const isGirl = s.gender === "F";
    const suffix = s.numericRank === 1 ? (isGirl ? "ère" : "er") : "e";
    const exStr = s.isExAequo ? " ex" : "";
    s.rankLabel = `${s.numericRank}${suffix}${exStr}`;
  });

  return list;
}

// ============================================================================
// 3. INITIALISATION ET NAVIGATION
// ============================================================================

function init() {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.getElementById("menuBtn")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  document.getElementById("modalClose")?.addEventListener("click", closeModal);
  document.getElementById("modalBackdrop")?.addEventListener("click", e => {
    if (e.target.id === "modalBackdrop") closeModal();
  });

  document.getElementById("currentClassSelect")?.addEventListener("change", e => {
    state.activeClassId = e.target.value;
    saveState();
    renderAll();
  });

  updateClassSelector();
  renderAll();
}

function updateClassSelector() {
  const sel = document.getElementById("currentClassSelect");
  if (!sel) return;
  sel.innerHTML = state.classes.map(c => `
    <option value="${c.id}" ${c.id === state.activeClassId ? "selected" : ""}>
      ${esc(c.name)} — ${esc(c.school)}
    </option>
  `).join("");
}

function switchView(view) {
  activeView = view;
  document.querySelectorAll(".nav-item").forEach(x => {
    x.classList.toggle("active", x.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach(x => x.classList.remove("active"));

  const target = document.getElementById(view + "View");
  if (target) target.classList.add("active");
  document.getElementById("sidebar")?.classList.remove("open");

  const titles = {
    grades: ["Cahier de notes", "Saisie des notes — calcul automatique"],
    stats: ["Fiche de Synthèse (Bilan Trimestriel)", "Conforme CEB de Bagré — Burkina Faso"],
    bulletins: ["Bulletins Trimestriels", "Bulletins simples pour élèves et parents"],
    annual: ["Moyenne Générale & Fin d'Année", "Tableau récapitulatif annuel"],
    students: ["Liste des Élèves", "Gestion des élèves inscrits"],
    settings: ["Paramètres & Matières", "Paramètres de la classe, école et matières"]
  };

  if (titles[view]) {
    document.getElementById("pageTitle").textContent = titles[view][0];
    document.getElementById("pageSubtitle").textContent = titles[view][1];
  }

  renderAll();
}

function renderAll() {
  const c = currentClass();
  const chip = document.getElementById("schoolChip");
  if (chip) chip.textContent = `École : ${c.school} — ${c.name}`;

  if (activeView === "grades") renderGrades();
  else if (activeView === "stats") renderStats();
  else if (activeView === "bulletins") renderBulletins();
  else if (activeView === "annual") renderAnnual();
  else if (activeView === "students") renderStudents();
  else if (activeView === "settings") renderSettings();
}

// ============================================================================
// 4. ACTION RAPIDE : ÉVALUER UNE CLASSE
// ============================================================================

function openEvaluateModal() {
  const c = currentClass();
  openModal("Évaluer une classe", `
    <form id="evaluateClassForm" class="form-grid">
      <label class="full">
        Choisir la classe à évaluer :
        <select id="evalClassSelect" style="width:100%;padding:8px">
          ${state.classes.map(cl => `
            <option value="${cl.id}" ${cl.id === c.id ? "selected" : ""}>
              ${esc(cl.school)} — Classe de ${esc(cl.name)} (${cl.students.length} élèves)
            </option>
          `).join("")}
        </select>
      </label>
      <label class="full">
        Trimestre à évaluer :
        <select id="evalTermSelect" style="width:100%;padding:8px">
          <option value="1" ${selectedTerm===1?"selected":""}>1er Trimestre</option>
          <option value="2" ${selectedTerm===2?"selected":""}>2e Trimestre</option>
          <option value="3" ${selectedTerm===3?"selected":""}>3e Trimestre</option>
        </select>
      </label>
      <div class="modal-actions full">
        <button type="button" class="btn secondary" onclick="closeModal()">Fermer</button>
        <button type="submit" class="btn accent">Accéder aux notes →</button>
      </div>
    </form>
  `);

  document.getElementById("evaluateClassForm").addEventListener("submit", e => {
    e.preventDefault();
    state.activeClassId = document.getElementById("evalClassSelect").value;
    selectedTerm = Number(document.getElementById("evalTermSelect").value);
    saveState();
    closeModal();
    updateClassSelector();
    switchView("grades");
    toast(`Évaluation : ${currentClass().name} — Trimestre ${selectedTerm}`);
  });
}

// ============================================================================
// 5. VUE CAHIER DE NOTES (GRILLE DE SAISIE + AJOUT/SUPPRESSION MATIÈRES)
// ============================================================================

function renderGrades() {
  const c = currentClass();
  const subjects = c.subjects;
  const ranked = rankedStudents(selectedTerm);

  const displayList = [...ranked];
  while (displayList.length < 25) {
    displayList.push({
      id: "blank-" + displayList.length,
      order: displayList.length + 1,
      fullName: "",
      gender: "",
      totalObtained: "",
      average: null,
      rankLabel: ""
    });
  }

  document.getElementById("gradesView").innerHTML = `
    <div class="card panel">
      <div class="panel-header">
        <div>
          <h2>Cahier de notes — ${esc(c.name)} · Trimestre ${selectedTerm}</h2>
          <span style="font-size:12px;color:#64748b">École : ${esc(c.school)} · Titulaire : ${esc(c.titulaire)}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn ${selectedTerm===1?'':'secondary'} small" onclick="selectedTerm=1; renderGrades()">1er Trimestre</button>
          <button class="btn ${selectedTerm===2?'':'secondary'} small" onclick="selectedTerm=2; renderGrades()">2e Trimestre</button>
          <button class="btn ${selectedTerm===3?'':'secondary'} small" onclick="selectedTerm=3; renderGrades()">3e Trimestre</button>
        </div>
      </div>

      <div class="toolbar">
        <span style="font-size:12px;color:#64748b">
          💡 <em>Tapez la note. Appuyez sur <strong>[A]</strong> pour marquer absent (barème neutralisé).</em>
        </span>
        <button class="btn small" style="margin-left:auto" onclick="openAddSubjectModal()">+ Ajouter une matière</button>
        <button class="btn small secondary" onclick="openAddStudentQuickModal()">+ Ajouter un élève</button>
      </div>

      <!-- En-tête des matières avec bouton supprimer -->
      <div style="overflow-x:auto;margin-bottom:4px">
        <table style="border-collapse:collapse;font-size:11px">
          <tr>
            <th style="width:40px;border:1px solid #94a3b8;background:#e2e8f0;padding:3px 5px"></th>
            <th style="min-width:160px;border:1px solid #94a3b8;background:#e2e8f0;padding:3px 5px"></th>
            <th style="width:40px;border:1px solid #94a3b8;background:#e2e8f0;padding:3px 5px"></th>
            ${subjects.map(s => `
              <th style="text-align:center;border:1px solid #94a3b8;background:#e2e8f0;padding:2px 4px;min-width:72px">
                <div style="display:flex;flex-direction:column;align-items:center;gap:1px">
                  <span style="font-weight:900;font-size:11px">${esc(s.name)}</span>
                  <span style="color:#64748b;font-size:10px;font-weight:600">/ ${s.max}</span>
                  <button onclick="deleteSubject('${s.id}')" title="Supprimer cette matière"
                    style="background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;border-radius:3px;cursor:pointer;font-size:9px;padding:1px 4px;font-weight:700">✕ Suppr</button>
                </div>
              </th>
            `).join("")}
            <th style="text-align:center;border:1px solid #94a3b8;background:#e2e8f0;padding:3px 5px;width:55px">Total</th>
            <th style="text-align:center;border:1px solid #94a3b8;background:#e2e8f0;padding:3px 5px;width:65px">Moyenne</th>
            <th style="text-align:center;border:1px solid #fbbf24;background:#fef9c3;padding:3px 5px;width:55px">Rang</th>
          </tr>
        </table>
      </div>

      <div class="table-wrap">
        <table>
          <tbody>
            ${displayList.map((s, rowIdx) => {
              const isBlank = !s.fullName;
              return `
                <tr>
                  <td style="text-align:center;font-weight:700;width:40px">${s.order}</td>
                  <td style="min-width:160px">
                    ${isBlank ? `
                      <input type="text" placeholder="Ajouter nom..."
                        style="width:100%;border:none;background:transparent;font-size:12px"
                        onchange="addQuickStudent('${s.order}', this.value)">
                    ` : `<strong>${esc(s.fullName)}</strong>`}
                  </td>
                  <td style="text-align:center;width:40px">${esc(s.gender)}</td>
                  ${subjects.map((sub, colIdx) => {
                    if (isBlank) return `<td style="min-width:72px"></td>`;
                    const g = getGrade(s.id, sub.id, selectedTerm);
                    return `
                      <td style="min-width:72px">
                        <div class="grade-cell">
                          <input type="number" step="0.25" min="0" max="${sub.max}"
                            class="grade-input"
                            value="${g.value}"
                            ${g.absent ? "disabled" : ""}
                            data-row="${rowIdx}" data-col="${colIdx}"
                            onchange="updateGradeValue('${s.id}', '${sub.id}', this.value)"
                            onkeydown="navigateGradeTable(event, this, '${s.id}', '${sub.id}', ${rowIdx}, ${colIdx})">
                          <button type="button" class="absent-btn ${g.absent ? 'active' : ''}"
                            title="Absent (barème neutralisé)"
                            onclick="toggleGradeAbsent('${s.id}', '${sub.id}')">
                            ${g.absent ? "A" : "—"}
                          </button>
                        </div>
                      </td>
                    `;
                  }).join("")}
                  <td style="text-align:center;font-weight:700;width:55px">
                    ${isBlank || s.composedCount === 0 ? "" : s.totalObtained}
                  </td>
                  <td style="text-align:center;font-weight:700;width:65px">
                    ${isBlank || s.average === null ? "" : (s.average === "A" ? "A" : formatNumber(s.average))}
                  </td>
                  <td style="text-align:center;font-weight:800;color:#854d0e;width:55px;background:#fef9c3">
                    ${isBlank ? "" : esc(s.rankLabel || "")}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function updateGradeValue(studentId, subjectId, val) {
  const c = currentClass();
  const key = gradeKey(studentId, subjectId, selectedTerm);
  const numVal = val.trim() === "" ? "" : Number(val.trim());
  c.grades[key] = { value: numVal, absent: false };
  saveState();
  renderGrades();
}

function toggleGradeAbsent(studentId, subjectId) {
  const c = currentClass();
  const key = gradeKey(studentId, subjectId, selectedTerm);
  const existing = c.grades[key] || { value: "", absent: false };
  c.grades[key] = { value: "", absent: !existing.absent };
  saveState();
  renderGrades();
  toast(c.grades[key].absent ? "Absence marquée (A)" : "Absence retirée");
}

function navigateGradeTable(event, input, studentId, subjectId, row, col) {
  if (event.key === "a" || event.key === "A") {
    event.preventDefault();
    toggleGradeAbsent(studentId, subjectId);
    const nextInput = document.querySelector(`input[data-row="${row + 1}"][data-col="${col}"]`);
    if (nextInput) nextInput.focus();
    return;
  }
  if (event.key === "ArrowDown" || event.key === "Enter") {
    event.preventDefault();
    const nextInput = document.querySelector(`input[data-row="${row + 1}"][data-col="${col}"]`);
    if (nextInput) nextInput.focus();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    const prev = document.querySelector(`input[data-row="${row - 1}"][data-col="${col}"]`);
    if (prev) prev.focus();
  } else if (event.key === "ArrowRight") {
    if (input.selectionStart === input.value.length) {
      const next = document.querySelector(`input[data-row="${row}"][data-col="${col + 1}"]`);
      if (next) { event.preventDefault(); next.focus(); }
    }
  } else if (event.key === "ArrowLeft") {
    if (input.selectionStart === 0) {
      const prev = document.querySelector(`input[data-row="${row}"][data-col="${col - 1}"]`);
      if (prev) { event.preventDefault(); prev.focus(); }
    }
  }
}

function addQuickStudent(order, fullName) {
  if (!fullName || !fullName.trim()) return;
  const c = currentClass();
  c.students.push({
    id: "std-" + Date.now(),
    order: Number(order) || (c.students.length + 1),
    fullName: fullName.trim(),
    gender: "M",
    status: "Nouveau",
    edi: "",
    handicap: "",
    age: 10,
    scolarite: ""
  });
  saveState();
  renderAll();
  toast("Élève ajouté !");
}

// --- GESTION DYNAMIQUE DES MATIÈRES ---

function openAddSubjectModal() {
  openModal("Ajouter une matière", `
    <form id="addSubjectForm" class="form-grid">
      <label class="full">
        Nom de la matière
        <input name="subName" required placeholder="ex. Lecture, Calcul, Sciences...">
      </label>
      <label class="full">
        Barème (note sur combien ?)
        <input name="subMax" type="number" min="1" max="200" required value="10" placeholder="ex. 10, 20">
      </label>
      <div class="modal-actions full">
        <button type="button" class="btn secondary" onclick="closeModal()">Annuler</button>
        <button class="btn" type="submit">Ajouter</button>
      </div>
    </form>
  `);

  document.getElementById("addSubjectForm").addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const c = currentClass();
    const newId = "s" + Date.now();
    c.subjects.push({
      id: newId,
      name: fd.get("subName").trim(),
      max: Number(fd.get("subMax")) || 10
    });
    saveState();
    closeModal();
    renderAll();
    toast("Matière ajoutée !");
  });
}

function deleteSubject(subjectId) {
  const c = currentClass();
  const sub = c.subjects.find(s => s.id === subjectId);
  if (!sub) return;
  if (!confirm(`Supprimer la matière "${sub.name}" ? Toutes les notes de cette matière seront perdues.`)) return;
  c.subjects = c.subjects.filter(s => s.id !== subjectId);
  // Supprimer les notes correspondantes
  Object.keys(c.grades).forEach(k => {
    if (k.includes(":" + subjectId + ":")) delete c.grades[k];
  });
  saveState();
  renderAll();
  toast(`Matière "${sub.name}" supprimée`);
}

// ============================================================================
// 6. VUE FICHE DE SYNTHÈSE (BILAN TRIMESTRIEL — CONFORME AU PDF)
// ============================================================================

function renderStats() {
  const c = currentClass();
  const subjects = c.subjects;
  const ranked = rankedStudents(selectedTerm);
  const composedList = ranked.filter(s => typeof s.average === "number");

  const startEff = c.startEffectif || { g: 0, f: 0, t: 0 };
  const compG = composedList.filter(s => s.gender === "M").length;
  const compF = composedList.filter(s => s.gender === "F").length;
  const compT = composedList.length;

  const passedG = composedList.filter(s => s.gender === "M" && s.average >= 5).length;
  const passedF = composedList.filter(s => s.gender === "F" && s.average >= 5).length;
  const passedT = passedG + passedF;

  const pctPassedG = compG ? passedG / compG : 0;
  const pctPassedF = compF ? passedF / compF : 0;
  const pctPassedT = compT ? passedT / compT : 0;

  const forteMoy = compT ? Math.max(...composedList.map(s => s.average)) : 0;
  const faibleMoy = compT ? Math.min(...composedList.map(s => s.average)) : 0;
  const moyClasse = compT ? composedList.reduce((acc, s) => acc + s.average, 0) / compT : 0;

  // Statistiques par matière : pourcentage de réussite (nb ayant eu >= moitié du barème)
  const subjectStats = subjects.map(sub => {
    const minPass = Number(sub.max) / 2;
    const boys = c.students.filter(s => s.gender === "M");
    const girls = c.students.filter(s => s.gender === "F");

    const compBoys = boys.filter(s => { const g = getGrade(s.id, sub.id, selectedTerm); return !g.absent && g.value !== ""; }).length;
    const passBoys = boys.filter(s => { const g = getGrade(s.id, sub.id, selectedTerm); return !g.absent && g.value !== "" && Number(g.value) >= minPass; }).length;

    const compGirls = girls.filter(s => { const g = getGrade(s.id, sub.id, selectedTerm); return !g.absent && g.value !== ""; }).length;
    const passGirls = girls.filter(s => { const g = getGrade(s.id, sub.id, selectedTerm); return !g.absent && g.value !== "" && Number(g.value) >= minPass; }).length;

    const totalComp = compBoys + compGirls;
    const totalPass = passBoys + passGirls;

    return {
      name: sub.name,
      g: passBoys,
      pctG: compBoys ? passBoys / compBoys : 0,
      f: passGirls,
      pctF: compGirls ? passGirls / compGirls : 0,
      t: totalPass,
      pctT: totalComp ? totalPass / totalComp : 0
    };
  });

  // Élèves par moyenne (bins 9, 8, 7, 6, 5, 4, 3, 2, 1, 0)
  const bins = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  const binCounts = bins.map(val => {
    const count = composedList.filter(s => {
      const avg = s.average;
      if (val === 9) return avg >= 9 && avg <= 10;
      return avg >= val && avg < (val + 1);
    }).length;
    return { moyenne: val, count };
  });

  // PAI
  const termPai = (c.paiData && c.paiData[selectedTerm]) || {};
  const paiSub = c.paiSubject || (subjects[0] ? subjects[0].name : "Lecture");
  const paiStat = subjectStats.find(x => x.name.toLowerCase() === paiSub.toLowerCase()) || { pctT: 0 };

  let tauxTrimestre = termPai.tauxTrimestre;
  // Si non renseigné manuellement, calculer depuis la matière PAI
  if (tauxTrimestre === undefined || tauxTrimestre === null || tauxTrimestre === "") {
    tauxTrimestre = compT ? Math.round(paiStat.pctT * 10000) / 10000 : 0;
  }
  const tauxDebut = Number(c.percentStart) || 0;
  const numTauxTrim = Number(tauxTrimestre) || 0;
  const ecart = numTauxTrim - tauxDebut;

  document.getElementById("statsView").innerHTML = `
    <div class="card panel">
      <div class="panel-header">
        <h2>Fiche de Synthèse — Bilan Trimestriel</h2>
        <div style="display:flex;gap:6px">
          <button class="btn ${selectedTerm===1?'':'secondary'} small" onclick="selectedTerm=1; renderStats()">1er Trimestre</button>
          <button class="btn ${selectedTerm===2?'':'secondary'} small" onclick="selectedTerm=2; renderStats()">2e Trimestre</button>
          <button class="btn ${selectedTerm===3?'':'secondary'} small" onclick="selectedTerm=3; renderStats()">3e Trimestre</button>
          <button class="btn secondary small" onclick="window.print()">🖨️ Imprimer</button>
        </div>
      </div>

      <!-- FICHE OFFICIELLE EXACTE -->
      <div class="ceb-bilan-fiche" id="cebBilanSheet">

        <!-- EN-TÊTE : GAUCHE + DROITE -->
        <div class="fiche-header">
          <div class="fiche-header-left">
            <div class="bold-line">Circonscription d'Education de Base de ${esc(c.ceb || "BAGRÉ")}</div>
            <div>Ecole : <strong>${esc(c.school)}</strong></div>
            <div>Classe : <strong>${esc(c.name)}</strong></div>
          </div>
          <div class="fiche-header-right">
            <div class="bold-line">BURKINA FASO</div>
            <div class="motto-line">La Patrie ou la Mort nous Vaincrons</div>
          </div>
        </div>

        <!-- TITRE BILAN + ANNÉE -->
        <div class="fiche-title-row">
          <div class="fiche-title-main">BILAN TRIMESTRIEL &nbsp; ${selectedTerm}</div>
          <div class="fiche-year">Année : ${esc(c.year)}</div>
        </div>

        <!-- GRILLE 3 COLONNES CONFORMES AU PDF -->
        <div class="fiche-main-grid">

          <!-- COLONNE 1 : EFFECTIFS, MOYENNES, PAI -->
          <div>
            <!-- Effectif début d'année -->
            <table class="fiche-table">
              <thead>
                <tr>
                  <th colspan="3" class="table-caption">Effectif en début d'année</th>
                </tr>
                <tr>
                  <th>G</th><th>F</th><th>T</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${startEff.g}</td>
                  <td>${startEff.f}</td>
                  <td><strong>${startEff.t}</strong></td>
                </tr>
              </tbody>
            </table>

            <!-- Élèves ayant composé -->
            <table class="fiche-table">
              <thead>
                <tr>
                  <th colspan="3" class="table-caption">Elèves ayant composé</th>
                </tr>
                <tr>
                  <th>G</th><th>F</th><th>T</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${compG}</td>
                  <td>${compF}</td>
                  <td><strong>${compT}</strong></td>
                </tr>
              </tbody>
            </table>

            <!-- Élèves ayant eu la moyenne -->
            <table class="fiche-table">
              <thead>
                <tr>
                  <th colspan="3" class="table-caption">Elèves ayant eu la moyenne</th>
                </tr>
                <tr>
                  <th>G</th><th>F</th><th>T</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${passedG}</td>
                  <td>${passedF}</td>
                  <td><strong>${passedT}</strong></td>
                </tr>
                <tr>
                  <td style="font-size:10px">${formatPct(pctPassedG)}</td>
                  <td style="font-size:10px">${formatPct(pctPassedF)}</td>
                  <td style="font-size:10px"><strong>${formatPct(pctPassedT)}</strong></td>
                </tr>
              </tbody>
            </table>

            <!-- Forte, Faible, Moyenne de la classe -->
            <table class="stat-moy-table">
              <tbody>
                <tr>
                  <td class="label-cell">Forte moyenne</td>
                  <td class="val-forte">${compT ? formatNumber(forteMoy) : "—"}</td>
                </tr>
                <tr>
                  <td class="label-cell">Faible moyenne</td>
                  <td class="val-faible">${compT ? formatNumber(faibleMoy) : "—"}</td>
                </tr>
                <tr>
                  <td class="label-cell">Moyenne de la classe</td>
                  <td class="val-classe">${compT ? formatNumber(Math.round(moyClasse * 100) / 100) : "—"}</td>
                </tr>
              </tbody>
            </table>

            <!-- PAI dans la colonne gauche -->
            <table class="pai-table">
              <thead>
                <tr>
                  <th colspan="2" style="background:#e2e8f0;text-align:center;font-size:11px">PAI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="pai-label">Discipline</td>
                  <td class="pai-val">
                    <select onchange="updatePaiSubject(this.value)" style="font-size:10px;border:1px solid #94a3b8;border-radius:3px;width:100%">
                      ${subjects.map(s => `<option value="${esc(s.name)}" ${s.name === paiSub ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
                    </select>
                  </td>
                </tr>
                <tr>
                  <td class="pai-label">Taux début</td>
                  <td class="pai-val">${formatPct(tauxDebut)}</td>
                </tr>
                <tr>
                  <td class="pai-label">Taux Trimestre</td>
                  <td class="pai-val">
                    <input type="number" step="0.01" min="0" max="1"
                      value="${termPai.tauxTrimestre !== undefined && termPai.tauxTrimestre !== null && termPai.tauxTrimestre !== "" ? termPai.tauxTrimestre : ""}"
                      placeholder="${formatPct(paiStat.pctT)}"
                      onchange="updateTermPai('tauxTrimestre', this.value)"
                      style="width:70px;font-size:10px;border:1px solid #94a3b8;border-radius:3px;padding:2px 4px">
                    <small style="font-size:9px;color:#64748b">(${formatPct(numTauxTrim)})</small>
                  </td>
                </tr>
                <tr>
                  <td class="pai-label">Ecart</td>
                  <td class="pai-val ${ecart >= 0 ? 'pai-val-green' : ''}" style="${ecart < 0 ? 'color:#dc2626' : ''}">
                    ${(ecart >= 0 ? "+" : "") + formatPct(ecart)}
                  </td>
                </tr>
                <tr>
                  <td class="pai-label">Désision</td>
                  <td class="pai-val">
                    <input type="text" value="${esc(termPai.decision || "")}"
                      placeholder="Poursuite..."
                      onchange="updateTermPai('decision', this.value)"
                      style="width:100%;font-size:10px;border:1px solid #94a3b8;border-radius:3px;padding:2px 4px">
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- COLONNE 2 : TABLEAU DES MATIÈRES + DIFFICULTÉS -->
          <div>
            <table class="fiche-table">
              <thead>
                <tr>
                  <th style="text-align:left">Matières</th>
                  <th>G</th>
                  <th>% G</th>
                  <th class="col-f">F</th>
                  <th class="col-f">% F</th>
                  <th>T</th>
                  <th class="pct-val">% T</th>
                </tr>
              </thead>
              <tbody>
                ${subjectStats.map(s => `
                  <tr>
                    <td style="text-align:left"><strong>${esc(s.name)}</strong></td>
                    <td>${s.g}</td>
                    <td>${formatPct(s.pctG)}</td>
                    <td class="col-f">${s.f}</td>
                    <td class="col-f">${formatPct(s.pctF)}</td>
                    <td><strong>${s.t}</strong></td>
                    <td class="pct-val"><strong>${formatPct(s.pctT)}</strong></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <!-- Difficultés / Suggestions -->
            <div class="diff-sugg-box">
              <div class="diff-header-line">
                <span>Difficultés/suggestions</span>
              </div>
              <div style="font-size:11px;margin-bottom:4px">Les élèves sont…</div>
              <textarea rows="4" style="width:100%;font-size:11px;border:1px solid #94a3b8;border-radius:3px;padding:4px;resize:vertical"
                placeholder="Renseigner ici les difficultés observées et suggestions..."
                onchange="updateTermPai('suggestions', this.value)">${esc(termPai.suggestions || "")}</textarea>
            </div>
          </div>

          <!-- COLONNE 3 : ÉLÈVES PAR MOYENNE -->
          <div>
            <table class="fiche-table">
              <thead>
                <tr>
                  <th colspan="2" class="table-caption">Elèves par moyenne</th>
                </tr>
                <tr>
                  <th>Moyenne</th>
                  <th>Nombre</th>
                </tr>
              </thead>
              <tbody>
                ${binCounts.map(b => `
                  <tr>
                    <td><strong>${b.moyenne}</strong></td>
                    <td>${b.count || ""}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <!-- SIGNATURES : TITULAIRE (GAUCHE) + DIRECTEUR (DROITE) -->
        <div class="fiche-signatures">
          <div class="sig-block">
            <u>Le/la Titulaire de la classe</u>
            <p>${esc(c.titulaire || "")}${c.titulaire2 ? " / " + esc(c.titulaire2) : ""}</p>
          </div>
          <div class="sig-block">
            <u>Le/la Directeur/trice de l'école</u>
            <p>${esc(c.director || "")}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function updatePaiSubject(val) {
  const c = currentClass();
  c.paiSubject = val;
  saveState();
  renderStats();
}

function updateTermPai(field, val) {
  const c = currentClass();
  if (!c.paiData) c.paiData = { 1: {}, 2: {}, 3: {} };
  if (!c.paiData[selectedTerm]) c.paiData[selectedTerm] = {};

  if (field === "tauxTrimestre") {
    c.paiData[selectedTerm].tauxTrimestre = val.trim() === "" ? null : Number(val.trim());
  } else {
    c.paiData[selectedTerm][field] = val.trim();
  }

  saveState();
  renderStats();
}

// ============================================================================
// 7. VUE BULLETINS TRIMESTRIELS SIMPLES
// ============================================================================

function renderBulletins() {
  const c = currentClass();

  document.getElementById("bulletinsView").innerHTML = `
    <div class="card panel">
      <div class="panel-header">
        <div>
          <h2>Bulletins Trimestriels</h2>
          <span style="font-size:12px;color:#64748b">Disciplines · Points · Barème · Total · Moyenne · Rang</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn" onclick="window.print()">🖨️ Imprimer</button>
        </div>
      </div>

      <div class="toolbar">
        <label>
          <strong>Trimestre :</strong>
          <select onchange="selectedTerm=Number(this.value); renderBulletins()">
            <option value="1" ${selectedTerm===1?"selected":""}>1er Trimestre</option>
            <option value="2" ${selectedTerm===2?"selected":""}>2e Trimestre</option>
            <option value="3" ${selectedTerm===3?"selected":""}>3e Trimestre</option>
          </select>
        </label>
        <label>
          <strong>Élève :</strong>
          <select onchange="selectedBulletinStudentId=this.value; renderBulletins()">
            <option value="all" ${selectedBulletinStudentId==="all"?"selected":""}>📋 Tous</option>
            ${c.students.map(s => `
              <option value="${s.id}" ${s.id===selectedBulletinStudentId?"selected":""}>
                ${s.order}. ${esc(s.fullName)}
              </option>
            `).join("")}
          </select>
        </label>
      </div>

      <div id="bulletinsContainer">
        ${renderBulletinsSimpleList(selectedBulletinStudentId)}
      </div>
    </div>
  `;
}

function renderBulletinsSimpleList(filterId) {
  const c = currentClass();
  const subjects = c.subjects;
  const ranked = rankedStudents(selectedTerm);

  let targetList = ranked;
  if (filterId && filterId !== "all") {
    targetList = ranked.filter(s => s.id === filterId);
  }

  if (targetList.length === 0) {
    return `<div class="empty">Aucun élève trouvé.</div>`;
  }

  const fullMaxScore = subjects.reduce((sum, s) => sum + (Number(s.max) || 10), 0);

  return targetList.map(s => {
    const pointsList = subjects.map(sub => {
      const g = getGrade(s.id, sub.id, selectedTerm);
      return {
        name: sub.name,
        max: sub.max,
        point: g.absent ? "A" : (g.value !== "" ? g.value : "—")
      };
    });

    return `
      <div class="bulletin-sheet">
        <!-- En-tête élève -->
        <div class="bulletin-pupil-header">
          <div>
            <div>Nom et Prénoms : <strong>${esc(s.fullName)}</strong></div>
            <div>Classe : <strong>${esc(c.name)}</strong></div>
          </div>
          <div style="text-align:right">
            <div><strong>BULLETIN TRIMESTRIEL — Trimestre ${selectedTerm}</strong></div>
            <div>Année : <strong>${esc(c.year)}</strong></div>
          </div>
        </div>

        <!-- Tableau Disciplines / Points / Barème -->
        <table class="bulletin-table">
          <thead>
            <tr>
              <th style="text-align:left">Disciplines</th>
              <th style="text-align:center;width:90px">Points</th>
              <th style="text-align:center;width:90px">Barème</th>
            </tr>
          </thead>
          <tbody>
            ${pointsList.map(p => `
              <tr>
                <td><strong>${esc(p.name)}</strong></td>
                <td style="text-align:center;font-weight:700;color:${p.point==='A'?'#dc2626':'#0f172a'}">
                  ${p.point}
                </td>
                <td style="text-align:center">/ ${p.max}</td>
              </tr>
            `).join("")}
            <!-- Total -->
            <tr class="total-row">
              <td><strong>Total</strong></td>
              <td style="text-align:center;font-weight:800;font-size:13px">
                ${s.composedCount > 0 ? s.totalObtained : "—"}
              </td>
              <td style="text-align:center;font-weight:700">
                Total sur ${s.composedCount > 0 ? s.totalMax : fullMaxScore}
              </td>
            </tr>
            <!-- Moyenne -->
            <tr class="total-row">
              <td><strong>Moyenne</strong></td>
              <td style="text-align:center;font-weight:800;font-size:14px;color:#15803d">
                ${s.average === null ? "—" : (s.average === "A" ? "A" : formatNumber(s.average))}
              </td>
              <td style="text-align:center;font-weight:700">sur 10</td>
            </tr>
            <!-- Rang -->
            <tr class="rank-row">
              <td><strong>Rang</strong></td>
              <td colspan="2" style="text-align:center;font-weight:800;font-size:13px;color:#854d0e">
                ${esc(s.rankLabel || "—")}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Signatures -->
        <div class="bulletin-bottom-sigs">
          <div>
            <div>L'enseignant</div>
            <div style="margin-top:28px;font-size:12px">${esc(c.titulaire || "")}</div>
          </div>
          <div style="text-align:right">
            <div>Les parents</div>
            <div style="margin-top:28px;font-size:12px;color:#94a3b8">Signature</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ============================================================================
// 8. VUE MOYENNE GÉNÉRALE & FIN D'ANNÉE
// ============================================================================

function renderAnnual() {
  const c = currentClass();
  const ranked = rankedAnnualStudents();

  const gTotal = c.students.filter(s => s.gender === "M").length;
  const fTotal = c.students.filter(s => s.gender === "F").length;
  const tTotal = c.students.length;

  document.getElementById("annualView").innerHTML = `
    <div class="card panel">
      <div class="panel-header">
        <h2>Moyenne Générale</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:40px">N°</th>
              <th>Nom et prénoms</th>
              <th>Sexe</th>
              <th style="text-align:center">1er Trim.</th>
              <th style="text-align:center">2e Trim.</th>
              <th style="text-align:center">3e Trim.</th>
              <th style="text-align:center;background:#e2e8f0">Moy Annuelle</th>
              <th style="text-align:center;background:#fef9c3">Rang</th>
              <th>Proposition du Conseil</th>
            </tr>
          </thead>
          <tbody>
            ${ranked.map(s => `
              <tr>
                <td style="text-align:center;font-weight:700">${s.order}</td>
                <td><strong>${esc(s.fullName)}</strong></td>
                <td style="text-align:center">${s.gender}</td>
                <td style="text-align:center">${formatNumber(s.t1)}</td>
                <td style="text-align:center">${formatNumber(s.t2)}</td>
                <td style="text-align:center">${formatNumber(s.t3)}</td>
                <td style="text-align:center;font-weight:700;background:#f8fafc">${formatNumber(s.annualAverage)}</td>
                <td style="text-align:center;font-weight:800;color:#854d0e">${esc(s.rankLabel || "")}</td>
                <td>
                  <input type="text" value="${esc(s.propConseil)}"
                    style="border:1px solid #cbd5e1;border-radius:4px;padding:3px 6px;font-size:11.5px;width:100%"
                    onchange="updateStudentProp('${s.id}', this.value)">
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function updateStudentProp(studentId, val) {
  const c = currentClass();
  c.propositions[studentId] = val.trim();
  saveState();
}

// ============================================================================
// 9. VUE LISTE DES ÉLÈVES
// ============================================================================

function renderStudents() {
  const c = currentClass();
  const students = c.students;

  document.getElementById("studentsView").innerHTML = `
    <div class="card panel">
      <div class="panel-header">
        <h2>Registre des Élèves (${students.length})</h2>
        <button class="btn" onclick="openAddStudentQuickModal()">+ Inscrire un élève</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:40px">N°</th>
              <th>Nom et prénoms</th>
              <th>Sexe</th>
              <th>Statut</th>
              <th>Âge</th>
              <th>EDI</th>
              <th>Handicap</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => `
              <tr>
                <td style="text-align:center;font-weight:700">${s.order}</td>
                <td><strong>${esc(s.fullName)}</strong></td>
                <td style="text-align:center">${s.gender}</td>
                <td>${esc(s.status || "Nouveau")}</td>
                <td style="text-align:center">${esc(s.age || "—")}</td>
                <td style="text-align:center">${s.edi ? "Oui" : "—"}</td>
                <td>${esc(s.handicap || "—")}</td>
                <td>
                  <button class="btn small danger" onclick="deleteStudent('${s.id}')">🗑 Supprimer</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openAddStudentQuickModal() {
  const c = currentClass();
  const nextOrder = c.students.length + 1;
  openModal("Ajouter un élève", `
    <form id="addStudentForm" class="form-grid">
      <label>
        N° d'Ordre
        <input name="order" type="number" min="1" required value="${nextOrder}">
      </label>
      <label>
        Sexe
        <select name="gender" required>
          <option value="M">M (Garçon)</option>
          <option value="F">F (Fille)</option>
        </select>
      </label>
      <label class="full">
        Nom et Prénoms
        <input name="fullName" required placeholder="ex. KABORE Fatou">
      </label>
      <label>
        Statut
        <select name="status">
          <option value="Nouveau">Nouveau</option>
          <option value="Redoublant">Redoublant</option>
        </select>
      </label>
      <label>
        Âge
        <input name="age" type="number" value="10">
      </label>
      <label>
        Handicap (si applicable)
        <input name="handicap" placeholder="Laisser vide si aucun">
      </label>
      <label class="full" style="flex-direction:row;align-items:center;gap:8px">
        <input name="edi" type="checkbox" style="width:16px;height:16px">
        <span>Élève Déplacé Interne (EDI)</span>
      </label>
      <div class="modal-actions full">
        <button type="button" class="btn secondary" onclick="closeModal()">Annuler</button>
        <button class="btn" type="submit">Enregistrer</button>
      </div>
    </form>
  `);

  document.getElementById("addStudentForm").addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    c.students.push({
      id: "std-" + Date.now(),
      order: Number(fd.get("order")),
      fullName: fd.get("fullName").trim(),
      gender: fd.get("gender"),
      status: fd.get("status"),
      age: fd.get("age"),
      handicap: fd.get("handicap").trim(),
      edi: fd.has("edi"),
      scolarite: ""
    });
    saveState();
    closeModal();
    renderAll();
    toast("Élève enregistré !");
  });
}

function deleteStudent(id) {
  const c = currentClass();
  if (!confirm("Supprimer cet élève ?")) return;
  c.students = c.students.filter(x => x.id !== id);
  Object.keys(c.grades).forEach(k => {
    if (k.startsWith(id + ":")) delete c.grades[k];
  });
  saveState();
  renderAll();
  toast("Élève supprimé");
}

// ============================================================================
// 10. VUE PARAMÈTRES & MATIÈRES
// ============================================================================

function renderSettings() {
  const c = currentClass();
  const subjects = c.subjects;

  document.getElementById("settingsView").innerHTML = `
    <div class="card panel">
      <div class="panel-header">
        <h2>Paramètres de l'école et de la classe</h2>
      </div>

      <form id="classSettingsForm" class="form-grid">
        <label>
          CEB (Circonscription)
          <input name="ceb" value="${esc(c.ceb || "BAGRÉ")}">
        </label>
        <label>
          Nom de l'École
          <input name="school" value="${esc(c.school || "")}">
        </label>
        <label>
          Classe
          <input name="name" value="${esc(c.name || "")}">
        </label>
        <label>
          Année scolaire
          <input name="year" value="${esc(c.year || "2026-2027")}">
        </label>
        <label>
          Nom du Directeur / Directrice
          <input name="director" value="${esc(c.director || "")}">
        </label>
        <label>
          Nom du Titulaire 1
          <input name="titulaire" value="${esc(c.titulaire || "")}">
        </label>
        <label>
          Nom du Titulaire 2 (optionnel)
          <input name="titulaire2" value="${esc(c.titulaire2 || "")}">
        </label>
        <label>
          Effectif Début — Garçons (G)
          <input name="startG" type="number" value="${c.startEffectif?.g || 0}">
        </label>
        <label>
          Effectif Début — Filles (F)
          <input name="startF" type="number" value="${c.startEffectif?.f || 0}">
        </label>
        <label>
          PAI : Discipline ciblée
          <select name="paiSubject">
            ${subjects.map(s => `
              <option value="${esc(s.name)}" ${s.name === (c.paiSubject || "") ? "selected" : ""}>${esc(s.name)}</option>
            `).join("")}
          </select>
        </label>
        <label>
          PAI : Taux début (ex: 0.43 pour 43%)
          <input name="percentStart" type="number" step="0.0001" min="0" max="1" value="${c.percentStart || 0}">
        </label>
        <div class="modal-actions full">
          <button class="btn" type="submit">💾 Enregistrer les paramètres</button>
        </div>
      </form>
    </div>

    <!-- GESTION DES MATIÈRES -->
    <div class="card panel" style="margin-top:16px">
      <div class="panel-header">
        <h2>Matières de la classe (${subjects.length})</h2>
        <button class="btn" onclick="openAddSubjectModal()">+ Ajouter une matière</button>
      </div>
      <p style="font-size:12px;color:#64748b;margin-bottom:10px">
        Chaque matière a un nom et un barème (note sur combien). Vous pouvez en ajouter ou en supprimer.
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:40px">N°</th>
              <th>Nom de la matière</th>
              <th style="text-align:center;width:100px">Barème (sur)</th>
              <th style="width:120px">Action</th>
            </tr>
          </thead>
          <tbody>
            ${subjects.map((s, i) => `
              <tr>
                <td style="text-align:center;font-weight:700">${i + 1}</td>
                <td>
                  <input type="text" value="${esc(s.name)}"
                    style="border:1px solid #94a3b8;border-radius:4px;padding:4px 8px;font-size:12px;width:100%"
                    onchange="updateSubjectName('${s.id}', this.value)">
                </td>
                <td style="text-align:center">
                  <input type="number" min="1" max="200" value="${s.max}"
                    style="border:1px solid #94a3b8;border-radius:4px;padding:4px 8px;font-size:12px;width:70px;text-align:center"
                    onchange="updateSubjectMax('${s.id}', this.value)">
                </td>
                <td>
                  <button class="btn small danger" onclick="deleteSubject('${s.id}')">🗑 Supprimer</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- GESTION DES CLASSES -->
    <div class="card panel" style="margin-top:16px">
      <div class="panel-header">
        <h2>Ajouter une classe modèle</h2>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn secondary" onclick="loadClassPreset('CP')">📂 Charger modèle CP</button>
        <button class="btn secondary" onclick="loadClassPreset('CE')">📂 Charger modèle CE</button>
        <button class="btn secondary" onclick="loadClassPreset('CM')">📂 Charger modèle CM</button>
        <button class="btn secondary" onclick="createNewEmptyClass()">➕ Nouvelle classe vide</button>
      </div>
    </div>
  `;

  document.getElementById("classSettingsForm").addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    c.ceb = fd.get("ceb").trim();
    c.school = fd.get("school").trim();
    c.name = fd.get("name").trim();
    c.year = fd.get("year").trim();
    c.director = fd.get("director").trim();
    c.titulaire = fd.get("titulaire").trim();
    c.titulaire2 = fd.get("titulaire2").trim();
    c.paiSubject = fd.get("paiSubject");
    c.percentStart = Number(fd.get("percentStart")) || 0;
    const g = Number(fd.get("startG")) || 0;
    const f = Number(fd.get("startF")) || 0;
    c.startEffectif = { g, f, t: g + f };
    saveState();
    updateClassSelector();
    renderAll();
    toast("Paramètres enregistrés !");
  });
}

function updateSubjectName(subjectId, val) {
  const c = currentClass();
  const sub = c.subjects.find(s => s.id === subjectId);
  if (sub && val.trim()) {
    sub.name = val.trim();
    saveState();
    toast("Nom modifié");
  }
}

function updateSubjectMax(subjectId, val) {
  const c = currentClass();
  const sub = c.subjects.find(s => s.id === subjectId);
  if (sub && Number(val) > 0) {
    sub.max = Number(val);
    saveState();
    toast("Barème modifié");
  }
}

// ============================================================================
// 11. GESTION DES CLASSES
// ============================================================================

function loadClassPreset(type) {
  if (!confirm(`Voulez-vous charger le modèle officiel pour la classe de ${type} ?`)) return;
  const newClass = createClassFromPreset(type);
  state.classes.push(newClass);
  state.activeClassId = newClass.id;
  saveState();
  updateClassSelector();
  renderAll();
  toast(`Modèle ${type} chargé !`);
}

function createNewEmptyClass() {
  const newClass = {
    id: "cls-custom-" + Date.now(),
    type: "CUSTOM",
    name: "Nouvelle classe",
    school: currentClass().school || "Mon École",
    ceb: currentClass().ceb || "BAGRÉ",
    director: currentClass().director || "",
    titulaire: "",
    titulaire2: "",
    year: currentClass().year || "2026-2027",
    paiSubject: "",
    percentStart: 0,
    startEffectif: { g: 0, f: 0, t: 0 },
    paiData: { 1: {}, 2: {}, 3: {} },
    subjects: [
      { id: "s1", name: "Lecture", max: 10 },
      { id: "s2", name: "Calcul", max: 10 }
    ],
    students: [],
    grades: {},
    propositions: {},
    decisionsCCEB: {}
  };
  state.classes.push(newClass);
  state.activeClassId = newClass.id;
  saveState();
  updateClassSelector();
  switchView("settings");
  toast("Nouvelle classe créée ! Configurez les paramètres.");
}

// ============================================================================
// 12. EXPORT EXCEL
// ============================================================================

function exportCurrentExcel() {
  const c = currentClass();
  if (typeof XLSX === "undefined") {
    alert("Module Excel non chargé.");
    return;
  }

  const wb = XLSX.utils.book_new();
  const subjects = c.subjects;

  [1, 2, 3].forEach(term => {
    const rows = [
      ["Cahier de notes", c.name, "École :", c.school],
      ["Titulaire :", c.titulaire, "Année :", c.year],
      [],
      ["N°", "Nom et prénoms", "Sexe", ...subjects.map(s => `${s.name} /${s.max}`), "Total", "Moy/10", "Rang"]
    ];

    rankedStudents(term).forEach(s => {
      const vals = subjects.map(sub => {
        const g = getGrade(s.id, sub.id, term);
        return g.absent ? "A" : (g.value !== "" ? Number(g.value) : "");
      });
      rows.push([s.order, s.fullName, s.gender, ...vals, s.totalObtained || "", s.average !== null ? s.average : "", s.rankLabel || ""]);
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `Trimestre_${term}`);
  });

  XLSX.writeFile(wb, `Educ_CEB_Bagre_${c.name}_${c.school}.xlsx`);
  toast("Fichier Excel téléchargé !");
}

// ============================================================================
// 13. UTILITAIRES
// ============================================================================

function formatNumber(val) {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number") {
    return Number.isInteger(val) ? String(val) : String(Math.round(val * 100) / 100);
  }
  return String(val);
}

function formatPct(val) {
  if (val === null || val === undefined || isNaN(val)) return "0%";
  const pct = Math.round(val * 10000) / 100;
  return pct + "%";
}

function openModal(title, bodyHtml) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  document.getElementById("modalBackdrop").classList.add("open");
}

function closeModal() {
  document.getElementById("modalBackdrop").classList.remove("open");
}

document.addEventListener("DOMContentLoaded", init);
