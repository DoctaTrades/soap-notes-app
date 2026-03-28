import { useState, useEffect, useRef, useCallback } from "react";
import { getGHLConfig, saveGHLConfig, isGHLConfigured, getContactIdFromURL, getContact, createContactNote, formatSOAPNoteForGHL, generateSOAPPdf, uploadPdfToGHL } from "./ghl.js";

/* ================================================================
   RESTORED CHIROPRACTIC — SOAP NOTE SYSTEM v2
   Interactive body charts with real anatomical images
   ================================================================ */


// ── Practice Defaults (overridden by user settings) ──
const DEFAULT_PRACTICE = {
  name: "Restored Chiropractic",
  tagline: "& Wellness",
  address: "472 Cleveland Crossing Dr, Ste. 101, Garner, NC, 27529",
  tel: "919-578-1990",
  email: "patrick.rebadow.dc@gmail.com",
  doctor: "Dr. Patrick Rebadow DC, MS, IVCA certified animal chiropractor",
};

// ── Body Chart Image Paths ──
// Place your images in /public/images/ and they'll be served by Vercel for free.
// Supported filenames listed below. If a file doesn't exist, the placeholder SVG shows instead.
const _PH = "/images/placeholder.svg";
const LOGO_SRC = "/images/logo.svg";
const EQ_LATERAL_SRC = "/images/equine-lateral.jpg";
const EQ_DORSAL_SRC = "/images/equine-dorsal.jpg";
const K9_LATERAL_SRC = "/images/canine-lateral.jpg";
const K9_DORSAL_SRC = "/images/canine-dorsal.jpg";
const FE_LATERAL_SRC = "/images/feline-lateral.jpg";
const SW_LATERAL_SRC = "/images/swine-lateral.jpg";
const AV_LATERAL_SRC = "/images/avian-lateral.jpg";
const CP_LATERAL_SRC = "/images/caprine-lateral.jpg";
const HU_CHART_SRC = "/images/human-chart.jpg";

// Image component with fallback to placeholder
const ChartImg = ({ src, alt, style }) => {
  const [imgSrc, setImgSrc] = useState(src);
  return <img src={imgSrc} alt={alt} style={style} onError={() => setImgSrc(_PH)} />;
};

// ── Species & Field Options ──
const SPECIES = ["Human", "Equine", "Canine", "Feline", "Swine", "Avian", "Caprine", "Other"];
const SEX_MAP = {
  Human: ["Male", "Female", "Other"],
  Equine: ["Stallion", "Gelding", "Mare"],
  Canine: ["Male Intact", "Male Neutered", "Female Intact", "Female Spayed"],
  Feline: ["Male Intact", "Male Neutered", "Female Intact", "Female Spayed"],
  Swine: ["Boar", "Barrow", "Gilt", "Sow"],
  Avian: ["Male", "Female", "Unknown"],
  Caprine: ["Buck", "Wether", "Doe"],
  Other: ["Male", "Female", "Unknown"],
};

const SYMPTOMS = [
  "Pain", "Gait change refusals", "Limping/Lameness", "Stiffness",
  "Decreased performance", "Behavioral changes", "Muscle atrophy",
  "Reluctance to move", "Difficulty rising", "Head tilt/carry",
];

const HUMAN_SYMPTOMS = [
  "Neck pain", "Mid-back pain", "Low back pain", "Headaches/Migraines",
  "Radiating pain", "Numbness/Tingling", "Stiffness", "Muscle spasm",
  "Sciatica", "Shoulder pain", "Hip pain", "Knee pain",
  "Jaw pain/TMJ", "Dizziness", "Fatigue", "Sleep disturbance",
];


const REACTIONS = [
  "Stoicism", "Lick/Chew", "Tail wag", "Yawning", "Vocalization",
  "Relaxation", "Flinching", "Guarding", "Muscle twitch", "Deep breath",
];

const RESPONSE_CARE = [
  "Lick & Chew", "Relaxation", "Improved tissue tone and joint motion",
  "Increased ROM", "Improved gait", "Reduced muscle tension",
  "Decreased pain response", "Improved posture",
];

const HUMAN_RESPONSE_CARE = [
  "Improved ROM", "Decreased pain", "Improved posture", "Reduced muscle tension",
  "Improved gait", "Decreased spasm", "Improved function", "Patient reports improvement",
  "Cavitation noted", "Joint motion restored", "Muscle relaxation",
];


const POST_TX = [
  "Reduced activity for 1-2 days", "Reduced activity for 2-3 days",
  "No jumping for 48 hours", "Leash walks only for 2 days",
  "Pasture rest for remainder of day", "Light work following day",
  "Warm compress on affected areas", "Ice if swelling noted",
];

const HUMAN_POST_TX = [
  "Ice 15-20 min on affected areas", "Heat 15-20 min on affected areas",
  "Gentle stretching as instructed", "Avoid heavy lifting for 24-48 hours",
  "Stay hydrated", "Ergonomic modifications discussed",
  "Home exercises prescribed", "Foam rolling as instructed",
  "Avoid prolonged sitting", "Sleep position modifications discussed",
];


const NEXT_APPT = ["1 week", "2 weeks", "3 weeks", "4 weeks", "6 weeks", "8 weeks", "As needed"];

const PT_RESPONDING = ["First assessment", "Improving", "Stable", "Declining", "Resolved"];

const LISTING_DIR = [
  "P - Posterior", "A - Anterior", "PL - Posterior Left", "PR - Posterior Right",
  "AL - Anterior Left", "AR - Anterior Right", "PI - Posterior Inferior",
  "AS - Anterior Superior", "S - Superior", "I - Inferior",
  "APL - Atlas Posterior Left", "APR - Atlas Posterior Right",
];

const HUMAN_LISTING_DIR = [
  "P - Posterior", "A - Anterior", "PL - Posterior Left", "PR - Posterior Right",
  "AL - Anterior Left", "AR - Anterior Right", "PI - Posterior Inferior",
  "AS - Anterior Superior", "S - Superior", "I - Inferior",
  "PLS - Posterior Left Superior", "PRS - Posterior Right Superior",
  "PLI - Posterior Left Inferior", "PRI - Posterior Right Inferior",
  "Body Right", "Body Left",
];


const HUMAN_REACTIONS = [
  "Relaxation", "Improved ROM", "Decreased pain", "Muscle release",
  "Increased mobility", "Postural improvement", "Deep breath",
  "Soreness noted", "No adverse reaction",
];

// ── Default Ortho Exam Groups ──
const DEFAULT_ORTHO_GROUPS = [
  { id: "ortho-cervical", name: "Cervical Spine", region: "Cervical", tests: [
    "Spurling's test", "Cervical distraction", "Cervical compression", "Jackson's compression",
    "Valsalva maneuver", "Soto-Hall test", "Shoulder depression test", "Bakody's sign",
  ]},
  { id: "ortho-lumbar", name: "Lumbar Spine", region: "Lumbar", tests: [
    "Straight leg raise (SLR)", "Well leg raise (contralateral SLR)", "Kemp's test",
    "Minor's sign", "Valsalva maneuver", "Milgram's test", "Thomas test",
    "SI compression / distraction", "FABER / Patrick's test", "Gaenslen's test",
  ]},
  { id: "ortho-shoulder", name: "Shoulder", region: "Shoulder", tests: [
    "Apley's scratch test", "Empty can / Jobe's test", "Speed's test", "Yergason's test",
    "Neer's impingement", "Hawkins-Kennedy test", "Drop arm test", "Apprehension test",
  ]},
  { id: "ortho-knee", name: "Knee", region: "Knee", tests: [
    "Anterior drawer test", "Posterior drawer test", "Lachman's test", "McMurray's test",
    "Apley's compression", "Valgus stress test", "Varus stress test",
  ]},
  { id: "ortho-hip", name: "Hip / Pelvis", region: "Hip", tests: [
    "FABER / Patrick's test", "Thomas test", "Trendelenburg test", "Ober's test", "Piriformis test",
  ]},
  { id: "ortho-neuro", name: "Neurological", region: "Neuro", tests: [
    "Deep tendon reflexes (biceps, triceps, patellar, Achilles)", "Dermatomal sensation",
    "Myotomal strength testing", "Romberg's test", "Babinski's sign",
  ]},
  { id: "ortho-wrist", name: "Wrist / Hand / Elbow", region: "Upper Extremity", tests: [
    "Phalen's test", "Reverse Phalen's test", "Tinel's sign (wrist)", "Finkelstein's test",
    "Grip strength", "Cozen's test (lateral epicondylitis)", "Reverse Cozen's (medial epicondylitis)",
    "Valgus / varus stress (elbow)", "Tinel's sign (elbow)",
  ]},
  { id: "ortho-ankle", name: "Ankle / Foot", region: "Lower Extremity", tests: [
    "Anterior drawer (ankle)", "Talar tilt test", "Thompson's test (Achilles)",
    "Homan's sign", "Dorsiflexion / plantarflexion ROM", "Morton's test",
  ]},
];

// ── Default Quick Phrases ──
const DEFAULT_PHRASES = {
  S: [
    "Patient reports improvement since last visit",
    "Patient reports no change since last visit",
    "Patient reports worsening since last visit",
    "Pain rated _/10 on numeric pain scale",
    "Symptoms aggravated by prolonged sitting",
    "Symptoms aggravated by prolonged standing",
    "Symptoms relieved with rest",
    "Symptoms relieved with movement",
    "No new complaints at this time",
    "Patient reports radiating pain into…",
    "Patient reports numbness/tingling in…",
    "Patient reports difficulty sleeping due to pain",
    "Onset was gradual / insidious",
    "Onset was sudden / acute",
    "Mechanism of injury: …",
  ],
  O: [
    "Tenderness to palpation noted at…",
    "Hypertonicity noted in paraspinal musculature",
    "Fixation noted at…",
    "ROM within functional limits",
    "Decreased ROM noted in…",
    "Antalgic posture observed",
    "Muscle spasm palpated at…",
    "Trigger point noted in…",
    "Edema noted at…",
    "Gait analysis: normal / antalgic",
    "Static palpation reveals…",
    "Motion palpation reveals restriction at…",
    "Bilateral comparison reveals asymmetry at…",
  ],
  A: [
    "Findings consistent with vertebral subluxation complex",
    "Presentation consistent with myofascial involvement",
    "Prognosis favorable with adherence to treatment plan",
    "Patient expected to respond favorably to chiropractic care",
    "Continued chiropractic care recommended",
    "Subluxation patterns noted in regions listed above",
    "Functional improvement noted since last visit",
    "Patient has reached maximum medical improvement",
    "Re-evaluation recommended in… weeks",
    "Referral recommended for…",
  ],
  P: [
    "Spinal adjustments delivered to areas of dysfunction as noted",
    "Diversified technique applied to…",
    "Instrument-assisted adjustment performed at…",
    "IASTM performed on…",
    "Myofascial release performed on…",
    "Therapeutic exercises prescribed",
    "Home care instructions reviewed with patient",
    "Ergonomic modifications discussed",
    "Patient tolerated treatment well",
    "No adverse reactions noted",
    "Follow-up in… weeks",
    "Refer to PCP / specialist for…",
  ],
};

// ── Default Custom Fill-in Fields ──
const DEFAULT_CUSTOM_FIELDS = [
  { id: "cf-pain-scale", label: "Pain Scale (0-10)", section: "S", type: "text", placeholder: "e.g., 7/10" },
  { id: "cf-onset", label: "Onset Date", section: "S", type: "text", placeholder: "e.g., 2 weeks ago" },
  { id: "cf-mechanism", label: "Mechanism of Injury", section: "S", type: "text", placeholder: "e.g., lifting, MVA, gradual" },
  { id: "cf-blood-pressure", label: "Blood Pressure", section: "O", type: "text", placeholder: "e.g., 120/80" },
  { id: "cf-heart-rate", label: "Heart Rate", section: "O", type: "text", placeholder: "e.g., 72 bpm" },
];

// ── Templates ──
const TEMPLATES = {
  "equine-initial": {
    label: "Equine — Initial Exam",
    species: "Equine",
    assessment: "The patient is in good health and expected to make good progress and recovery, adherence to home care recommendations and treatment recommendations may affect rate of healing/recovery. Progress will be tracked using owner's subjective report of behavior modification and symptom presentation.\n\nIt is my opinion that the presentation and findings of the animal seen today is consistent with joint dysfunction in the symptomatic areas as noted above. Should the presentation be inconsistent with joint dysfunction or if the patient is not progressing as expected with chiropractic care, the patient will be instructed to be evaluated by their veterinarian for further diagnosis and care.\n\nAdjustments received well and without complications. Areas adjusted were reassessed for improvement through their functional range of motion.",
    planTx: "Full chiropractic evaluation and specific adjustments performed as needed. Refer to objective section for more information of locations and findings.",
    responding: "First assessment",
  },
  "equine-followup": {
    label: "Equine — Follow Up",
    species: "Equine",
    assessment: "Patient returning for follow-up evaluation. Comparing current presentation to previous findings.\n\nIt is my opinion that the presentation and findings of the animal seen today is consistent with joint dysfunction in the symptomatic areas as noted above. Should the presentation be inconsistent with joint dysfunction or if the patient is not progressing as expected with chiropractic care, the patient will be instructed to be evaluated by their veterinarian for further diagnosis and care.\n\nAdjustments received well and without complications. Areas adjusted were reassessed for improvement through their functional range of motion.",
    planTx: "Follow-up chiropractic evaluation and specific adjustments performed as needed. Refer to objective section for more information of locations and findings.",
    responding: "Improving",
  },
  "canine-initial": {
    label: "Canine — Initial Exam",
    species: "Canine",
    assessment: "The patient is in good health and expected to make good progress and recovery, adherence to home care recommendations and treatment recommendations may affect rate of healing/recovery. Progress will be tracked using owner's subjective report of behavior modification and symptom presentation.\n\nIt is my opinion that the presentation and findings of the animal seen today is consistent with joint dysfunction in the symptomatic areas as noted above. Should the presentation be inconsistent with joint dysfunction or if the patient is not progressing as expected with chiropractic care, the patient will be instructed to be evaluated by their veterinarian for further diagnosis and care.\n\nAdjustments received well and without complications. Areas adjusted were reassessed for improvement through their functional range of motion.",
    planTx: "Full chiropractic evaluation and specific adjustments performed as needed. Refer to objective section for more information of locations and findings.",
    responding: "First assessment",
  },
  "canine-followup": {
    label: "Canine — Follow Up",
    species: "Canine",
    assessment: "Patient returning for follow-up evaluation. Comparing current presentation to previous findings.\n\nIt is my opinion that the presentation and findings of the animal seen today is consistent with joint dysfunction in the symptomatic areas as noted above. Should the presentation be inconsistent with joint dysfunction or if the patient is not progressing as expected with chiropractic care, the patient will be instructed to be evaluated by their veterinarian for further diagnosis and care.\n\nAdjustments received well and without complications. Areas adjusted were reassessed for improvement through their functional range of motion.",
    planTx: "Follow-up chiropractic evaluation and specific adjustments performed as needed. Refer to objective section for more information of locations and findings.",
    responding: "Improving",
  },
  "feline-initial": {
    label: "Feline — Initial Exam",
    species: "Feline",
    assessment: "The patient is in good health and expected to make good progress and recovery, adherence to home care recommendations and treatment recommendations may affect rate of healing/recovery. Progress will be tracked using owner's subjective report of behavior modification and symptom presentation.\n\nIt is my opinion that the presentation and findings of the animal seen today is consistent with joint dysfunction in the symptomatic areas as noted above. Should the presentation be inconsistent with joint dysfunction or if the patient is not progressing as expected with chiropractic care, the patient will be instructed to be evaluated by their veterinarian for further diagnosis and care.\n\nAdjustments received well and without complications. Areas adjusted were reassessed for improvement through their functional range of motion.",
    planTx: "Full chiropractic evaluation and specific adjustments performed as needed. Refer to objective section for more information of locations and findings.",
    responding: "First assessment",
  },
  "feline-followup": {
    label: "Feline — Follow Up",
    species: "Feline",
    assessment: "Patient returning for follow-up evaluation. Comparing current presentation to previous findings.\n\nIt is my opinion that the presentation and findings of the animal seen today is consistent with joint dysfunction in the symptomatic areas as noted above. Should the presentation be inconsistent with joint dysfunction or if the patient is not progressing as expected with chiropractic care, the patient will be instructed to be evaluated by their veterinarian for further diagnosis and care.\n\nAdjustments received well and without complications. Areas adjusted were reassessed for improvement through their functional range of motion.",
    planTx: "Follow-up chiropractic evaluation and specific adjustments performed as needed. Refer to objective section for more information of locations and findings.",
    responding: "Improving",
  },
  "swine-initial": {
    label: "Swine — Initial Exam",
    species: "Swine",
    assessment: "The patient is in good health and expected to make good progress and recovery, adherence to home care recommendations and treatment recommendations may affect rate of healing/recovery. Progress will be tracked using owner's subjective report of behavior modification and symptom presentation.\n\nIt is my opinion that the presentation and findings of the animal seen today is consistent with joint dysfunction in the symptomatic areas as noted above. Should the presentation be inconsistent with joint dysfunction or if the patient is not progressing as expected with chiropractic care, the patient will be instructed to be evaluated by their veterinarian for further diagnosis and care.\n\nAdjustments received well and without complications. Areas adjusted were reassessed for improvement through their functional range of motion.",
    planTx: "Full chiropractic evaluation and specific adjustments performed as needed. Refer to objective section for more information of locations and findings.",
    responding: "First assessment",
  },
  "swine-followup": {
    label: "Swine — Follow Up",
    species: "Swine",
    assessment: "Patient returning for follow-up evaluation. Comparing current presentation to previous findings.\n\nIt is my opinion that the presentation and findings of the animal seen today is consistent with joint dysfunction in the symptomatic areas as noted above. Should the presentation be inconsistent with joint dysfunction or if the patient is not progressing as expected with chiropractic care, the patient will be instructed to be evaluated by their veterinarian for further diagnosis and care.\n\nAdjustments received well and without complications. Areas adjusted were reassessed for improvement through their functional range of motion.",
    planTx: "Follow-up chiropractic evaluation and specific adjustments performed as needed. Refer to objective section for more information of locations and findings.",
    responding: "Improving",
  },
  "avian-initial": {
    label: "Avian — Initial Exam",
    species: "Avian",
    assessment: "The patient is in good health and expected to make good progress and recovery, adherence to home care recommendations and treatment recommendations may affect rate of healing/recovery. Progress will be tracked using owner's subjective report of behavior modification and symptom presentation.\n\nIt is my opinion that the presentation and findings of the animal seen today is consistent with joint dysfunction in the symptomatic areas as noted above. Should the presentation be inconsistent with joint dysfunction or if the patient is not progressing as expected with chiropractic care, the patient will be instructed to be evaluated by their veterinarian for further diagnosis and care.\n\nAdjustments received well and without complications. Areas adjusted were reassessed for improvement through their functional range of motion.",
    planTx: "Full chiropractic evaluation and specific adjustments performed as needed. Refer to objective section for more information of locations and findings.",
    responding: "First assessment",
  },
  "avian-followup": {
    label: "Avian — Follow Up",
    species: "Avian",
    assessment: "Patient returning for follow-up evaluation. Comparing current presentation to previous findings.\n\nIt is my opinion that the presentation and findings of the animal seen today is consistent with joint dysfunction in the symptomatic areas as noted above. Should the presentation be inconsistent with joint dysfunction or if the patient is not progressing as expected with chiropractic care, the patient will be instructed to be evaluated by their veterinarian for further diagnosis and care.\n\nAdjustments received well and without complications. Areas adjusted were reassessed for improvement through their functional range of motion.",
    planTx: "Follow-up chiropractic evaluation and specific adjustments performed as needed. Refer to objective section for more information of locations and findings.",
    responding: "Improving",
  },
  "caprine-initial": {
    label: "Caprine — Initial Exam",
    species: "Caprine",
    assessment: "The patient is in good health and expected to make good progress and recovery, adherence to home care recommendations and treatment recommendations may affect rate of healing/recovery. Progress will be tracked using owner's subjective report of behavior modification and symptom presentation.\n\nIt is my opinion that the presentation and findings of the animal seen today is consistent with joint dysfunction in the symptomatic areas as noted above. Should the presentation be inconsistent with joint dysfunction or if the patient is not progressing as expected with chiropractic care, the patient will be instructed to be evaluated by their veterinarian for further diagnosis and care.\n\nAdjustments received well and without complications. Areas adjusted were reassessed for improvement through their functional range of motion.",
    planTx: "Full chiropractic evaluation and specific adjustments performed as needed. Refer to objective section for more information of locations and findings.",
    responding: "First assessment",
  },
  "caprine-followup": {
    label: "Caprine — Follow Up",
    species: "Caprine",
    assessment: "Patient returning for follow-up evaluation. Comparing current presentation to previous findings.\n\nIt is my opinion that the presentation and findings of the animal seen today is consistent with joint dysfunction in the symptomatic areas as noted above. Should the presentation be inconsistent with joint dysfunction or if the patient is not progressing as expected with chiropractic care, the patient will be instructed to be evaluated by their veterinarian for further diagnosis and care.\n\nAdjustments received well and without complications. Areas adjusted were reassessed for improvement through their functional range of motion.",
    planTx: "Follow-up chiropractic evaluation and specific adjustments performed as needed. Refer to objective section for more information of locations and findings.",
    responding: "Improving",
  },
  "human-initial": {
    label: "Human — Initial Exam",
    species: "Human",
    assessment: "The patient presents with musculoskeletal complaints consistent with vertebral subluxation and associated myofascial involvement. Based on examination findings, chiropractic care is indicated. Prognosis is favorable with adherence to recommended treatment plan. Progress will be tracked using subjective pain scales, objective examination findings, and functional outcome measures.",
    planTx: "Full chiropractic evaluation and specific spinal adjustments performed as indicated. Refer to objective section for specific segmental findings and treatment rendered. Home care instructions provided.",
    responding: "First assessment",
  },
  "human-followup": {
    label: "Human — Follow Up",
    species: "Human",
    assessment: "Patient returning for follow-up evaluation. Comparing current presentation to previous findings. Subluxation patterns and associated myofascial findings reassessed.",
    planTx: "Follow-up chiropractic evaluation and specific spinal adjustments performed as indicated. Refer to objective section for specific segmental findings and treatment rendered.",
    responding: "Improving",
  },
  "human-reexam": {
    label: "Human — Re-Examination",
    species: "Human",
    assessment: "Comprehensive re-examination performed to assess progress and update treatment plan. Comparison of current findings to initial and interim examination findings. Functional outcome measures reassessed.",
    planTx: "Re-examination performed with updated findings. Treatment plan modified as indicated based on reassessment. Continued chiropractic care recommended. Refer to objective section for updated segmental findings.",
    responding: "Improving",
  },
  "human-maintenance": {
    label: "Human — Maintenance/Wellness",
    species: "Human",
    assessment: "Patient presenting for maintenance/wellness care. No acute complaints at this time. Subluxation patterns monitored for prevention and optimal function.",
    planTx: "Maintenance chiropractic adjustment performed. Patient to continue with current wellness schedule. Home care reinforced.",
    responding: "Stable",
  },
};

// ── Styles ──
const C = { teal: "#0f766e", tealLight: "#0d9488", tealBg: "#f0fdfa", bg: "#f8faf9", white: "#fff", dark: "#1e293b", mid: "#475569", light: "#94a3b8", border: "#e2e8f0", red: "#ef4444" };
const font = "'DM Sans', sans-serif";
const inp = { width:"100%", padding:"9px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:font, background:C.white, color:C.dark, outline:"none", boxSizing:"border-box" };
const ta = { ...inp, minHeight:80, resize:"vertical", lineHeight:1.6 };

// ── Tiny Components ──
const Ico = ({ d, size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
const IcoPlus = () => <Ico d="M12 5v14M5 12h14" />;
const IcoTrash = () => <Ico d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />;
const IcoChevDown = () => <Ico d="M6 9l6 6 6-6" />;
const IcoChevUp = () => <Ico d="M18 15l-6-6-6 6" />;

const SectionHead = ({ title, num, open, toggle }) => (
  <button onClick={toggle} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:`linear-gradient(135deg, ${C.teal}, ${C.tealLight})`, color:C.white, border:"none", borderRadius: open ? "10px 10px 0 0" : 10, cursor:"pointer", fontFamily:font, fontSize:15, fontWeight:600, letterSpacing:.5 }}>
    <span style={{ display:"flex", alignItems:"center", gap:10 }}>
      <span style={{ background:"rgba(255,255,255,.2)", borderRadius:"50%", width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700 }}>{num}</span>
      {title}
    </span>
    {open ? <IcoChevUp /> : <IcoChevDown />}
  </button>
);

const Field = ({ label, wide, children }) => (
  <div style={{ marginBottom:12, flex: wide ? "1 1 100%" : "1 1 calc(50% - 8px)", minWidth: wide ? "100%" : 200 }}>
    <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.mid, marginBottom:4, fontFamily:font, textTransform:"uppercase", letterSpacing:.8 }}>{label}</label>
    {children}
  </div>
);

const Chips = ({ options, selected, onChange, radio }) => (
  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
    {options.map(o => {
      const on = radio ? selected === o : (Array.isArray(selected) ? selected.includes(o) : false);
      return (
        <label key={o} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:8, border:`1.5px solid ${on ? C.tealLight : C.border}`, background: on ? C.tealBg : C.white, cursor:"pointer", fontSize:12.5, fontFamily:font, userSelect:"none", transition:"all .15s" }}>
          <input type={radio ? "radio" : "checkbox"} checked={on} onChange={() => onChange(o)} style={{ accentColor:C.tealLight, margin:0 }} />
          {o}
        </label>
      );
    })}
  </div>
);

// ── Text Area with Phrase Dropdown ──
const TextAreaWithPhrases = ({ value, onChange, placeholder, style: extraStyle, phrases, section, activePhraseField, setActivePhraseField, fieldId }) => {
  const fieldKey = fieldId || placeholder;
  const isOpen = activePhraseField === fieldKey;
  const sectionPhrases = phrases?.[section] || [];
  const doInsert = (phrase) => {
    const newVal = value ? value.trimEnd() + " " + phrase : phrase;
    onChange({ target: { value: newVal } });
    setActivePhraseField(null);
  };
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <textarea value={value} onChange={onChange} placeholder={placeholder} style={{ ...extraStyle, paddingRight: sectionPhrases.length > 0 ? 80 : 12 }} />
        {sectionPhrases.length > 0 && (
          <button onClick={(e) => { e.preventDefault(); setActivePhraseField(isOpen ? null : fieldKey); }}
            style={{ position:"absolute", top:7, right:7, background: isOpen ? C.teal : C.tealLight, color:C.white, border:"none", borderRadius:6, padding:"3px 8px", fontSize:10.5, fontWeight:600, cursor:"pointer", fontFamily:font, zIndex:2, letterSpacing:.3 }}>
            ⚡ Phrases
          </button>
        )}
      </div>
      {isOpen && sectionPhrases.length > 0 && (
        <div style={{ marginTop:4, background:C.tealBg, border:`1.5px solid ${C.tealLight}`, borderRadius:8, padding:8, maxHeight:140, overflowY:"auto", zIndex:5 }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
            {sectionPhrases.map((phrase, i) => (
              <button key={i} onClick={() => doInsert(phrase)}
                style={{ fontSize:11.5, padding:"4px 10px", borderRadius:6, border:`1px solid ${C.border}`, background:C.white, cursor:"pointer", fontFamily:font, color:C.dark, textAlign:"left" }}>
                {phrase}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Ortho Test Row ──
const OrthoTestRow = ({ test, result, note, onResult, onNote }) => {
  const colors = { "+": { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" }, "-": { bg: "#f0fdf4", border: "#86efac", text: "#166534" }, "NT": { bg: "#f8fafc", border: C.border, text: C.light } };
  return (
    <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:6, padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
      <span style={{ flex:"1 1 180px", fontSize:12.5, fontFamily:font, color:C.dark, fontWeight: result === "+" ? 600 : 400 }}>{test}</span>
      <div style={{ display:"flex", gap:4 }}>
        {[{ v: "+", l: "+" }, { v: "-", l: "−" }, { v: "NT", l: "NT" }].map(({ v, l }) => {
          const on = result === v;
          const c = colors[v];
          return (
            <button key={v} onClick={() => onResult(on ? "" : v)}
              style={{ width:32, height:26, borderRadius:6, border:`1.5px solid ${on ? c.border : C.border}`, background: on ? c.bg : C.white, color: on ? c.text : C.light, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:font }}>
              {l}
            </button>
          );
        })}
      </div>
      <input value={note || ""} onChange={e => onNote(e.target.value)} placeholder="Notes…" style={{ ...inp, flex:"1 1 120px", fontSize:11.5, padding:"4px 8px", minWidth:100 }} />
    </div>
  );
};

// ── Body Chart with Real Images ──
const BodyChart = ({ imgSrc, imgW, imgH, markers, onAdd, onRemove, onUpdate, interactive, viewKey, label, species }) => {
  const containerRef = useRef(null);

  const handleClick = (e) => {
    if (!interactive) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAdd({ xPct: x, yPct: y, view: viewKey, segment: "", description: "", direction: "" });
  };

  const viewMarkers = markers.filter(m => m.view === viewKey);

  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ fontSize:13, fontWeight:700, color:C.teal, margin:"16px 0 8px", fontFamily:font }}>{label}</h4>
      <div
        ref={containerRef}
        onClick={handleClick}
        style={{
          position: "relative",
          border: `1.5px solid ${C.border}`,
          borderRadius: 10,
          overflow: "hidden",
          cursor: interactive ? "crosshair" : "default",
          background: "#fefefe",
          maxWidth: imgW,
        }}
      >
        <ChartImg src={imgSrc} alt={label} style={{ width: "100%", display: "block", pointerEvents: "none" }} />
        {/* Markers overlay */}
        {viewMarkers.map((m, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${m.xPct}%`,
            top: `${m.yPct}%`,
            transform: "translate(-50%, -50%)",
            width: 26, height: 26,
            borderRadius: "50%",
            background: C.tealLight,
            color: C.white,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700,
            boxShadow: "0 2px 6px rgba(0,0,0,.3)",
            cursor: "pointer",
            zIndex: 10,
            fontFamily: font,
          }}
            title={m.segment || `Marker ${i + 1}`}
          >
            {i + 1}
          </div>
        ))}
        {interactive && (
          <div style={{ position:"absolute", bottom:8, left:"50%", transform:"translateX(-50%)", background:"rgba(0,0,0,.55)", color:"#fff", padding:"4px 14px", borderRadius:20, fontSize:11, fontFamily:font, pointerEvents:"none", whiteSpace:"nowrap" }}>
            Tap/click to place a marker
          </div>
        )}
      </div>

      {/* Marker descriptions */}
      {interactive && viewMarkers.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {viewMarkers.map((m, localIdx) => {
            const gi = markers.indexOf(m);
            return (
              <div key={localIdx} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:8, padding:10, borderRadius:8, border:`1px solid ${C.border}`, background:"#fafafa" }}>
                <div style={{ background:C.tealLight, color:C.white, borderRadius:"50%", minWidth:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, marginTop:2, fontFamily:font }}>{localIdx + 1}</div>
                <div style={{ flex:1 }}>
                  <input placeholder="e.g., T6 PR - Posterior Right" value={m.segment || ""} onChange={e => onUpdate(gi, "segment", e.target.value)} style={{ ...inp, marginBottom:5, fontSize:12.5 }} />
                  <select value={m.direction || ""} onChange={e => { onUpdate(gi, "direction", e.target.value); if (!m.segment && e.target.value) onUpdate(gi, "segment", e.target.value); }} style={{ ...inp, marginBottom:5, fontSize:11.5, color:C.light, padding:"5px 10px" }}>
                    <option value="">Quick-fill listing direction…</option>
                    {(species === "Human" ? HUMAN_LISTING_DIR : LISTING_DIR).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <textarea placeholder="Findings & treatment performed…" value={m.description || ""} onChange={e => onUpdate(gi, "description", e.target.value)} style={{ ...ta, minHeight:50, fontSize:12.5 }} />
                </div>
                <button onClick={() => onRemove(gi)} style={{ background:"none", border:"none", cursor:"pointer", color:C.red, padding:4, marginTop:2 }}><IcoTrash /></button>
              </div>
            );
          })}
        </div>
      )}
      {interactive && viewMarkers.length === 0 && (
        <p style={{ color:C.light, fontSize:12.5, fontStyle:"italic", marginTop:6, fontFamily:font }}>No markers yet — click on the image above to place treatment locations.</p>
      )}
    </div>
  );
};

// ── Canine placeholder SVG (until images provided) ──
const CanineLateralSVG = ({ w = 700 }) => (
  <svg viewBox="0 0 700 420" style={{ width: "100%", maxWidth: w, background: "#fefefe" }}>
    <g stroke="#8B7355" strokeWidth="1.8" fill="none" opacity=".65">
      <path d="M130,140 Q110,130 90,125 Q70,122 55,130 Q40,140 35,155 Q33,168 40,178 Q50,190 70,193 Q85,195 100,188 Q115,180 125,168 Q132,158 135,148" />
      <path d="M80,122 Q72,100 80,85 M90,120 Q86,98 92,85" strokeWidth="1.5"/>
      <circle cx="78" cy="148" r="4" fill="#8B7355" opacity=".5"/>
      <path d="M135,148 Q155,155 175,165 Q195,175 210,190"/>
      <path d="M130,140 Q160,130 190,128 Q220,128 240,140"/>
      <path d="M240,140 Q300,120 380,118 Q460,120 520,135 Q550,148 565,170 Q575,195 570,225 Q560,265 540,290 Q530,310 525,350 Q523,370 520,390 M540,290 Q550,310 555,350 Q557,370 560,390"/>
      <path d="M210,190 Q205,230 200,270 Q198,310 195,350 Q193,370 190,390"/>
      <path d="M240,190 Q235,230 230,270 Q228,310 225,350 Q223,370 220,390"/>
      <path d="M210,190 Q260,220 340,230 Q420,235 500,225 Q540,218 565,195" strokeWidth="1.5"/>
      <path d="M160,132 Q280,110 400,108 Q500,112 555,138" strokeDasharray="4,4" opacity=".3"/>
      <path d="M260,128 Q265,160 270,190 M300,122 Q305,154 310,186 M340,120 Q345,152 350,184 M380,119 Q385,151 390,183 M420,120 Q425,152 430,184 M460,124 Q465,156 470,188" strokeWidth=".8" opacity=".25"/>
      <path d="M570,170 Q590,150 610,140 Q630,135 645,145"/>
    </g>
    <text x="90" y="50" fontSize="9" fill="#bbb" fontFamily="monospace">CERVICAL</text>
    <text x="260" y="50" fontSize="9" fill="#bbb" fontFamily="monospace">THORACIC</text>
    <text x="440" y="50" fontSize="9" fill="#bbb" fontFamily="monospace">LUMBAR</text>
    <text x="540" y="50" fontSize="9" fill="#bbb" fontFamily="monospace">SACRAL</text>
  </svg>
);

const CanineDorsalSVG = ({ w = 350 }) => (
  <svg viewBox="0 0 350 600" style={{ width: "100%", maxWidth: w, background: "#fefefe" }}>
    <g stroke="#8B7355" strokeWidth="1.8" fill="none" opacity=".65">
      <ellipse cx="175" cy="55" rx="28" ry="35"/>
      <circle cx="163" cy="45" r="3.5" fill="#8B7355" opacity=".4"/>
      <circle cx="187" cy="45" r="3.5" fill="#8B7355" opacity=".4"/>
      <ellipse cx="147" cy="32" rx="12" ry="18" strokeWidth="1.5"/>
      <ellipse cx="203" cy="32" rx="12" ry="18" strokeWidth="1.5"/>
      <path d="M152,82 Q155,110 158,135 M198,82 Q195,110 192,135"/>
      <line x1="175" y1="90" x2="175" y2="500" strokeDasharray="4,4" opacity=".3"/>
      <path d="M158,135 Q140,180 135,250 Q132,320 138,380 Q145,430 158,460 Q165,475 170,510"/>
      <path d="M192,135 Q210,180 215,250 Q218,320 212,380 Q205,430 192,460 Q185,475 180,510"/>
      <path d="M158,460 Q165,472 175,475 Q185,472 192,460" strokeWidth="1.5"/>
      <ellipse cx="150" cy="165" rx="16" ry="30" strokeWidth="1" opacity=".35"/>
      <ellipse cx="200" cy="165" rx="16" ry="30" strokeWidth="1" opacity=".35"/>
      <circle cx="152" cy="450" r="10" strokeWidth="1" opacity=".35"/>
      <circle cx="198" cy="450" r="10" strokeWidth="1" opacity=".35"/>
      <path d="M175,510 Q175,540 173,570"/>
    </g>
    <text x="65" y="170" fontSize="9" fill="#bbb" fontFamily="monospace">L</text>
    <text x="270" y="170" fontSize="9" fill="#bbb" fontFamily="monospace">R</text>
  </svg>
);

// ── Note Preview (final output) ──
const NotePreview = ({ data, customGroups = [], orthoGroups = [], customFieldDefs = [], practice = {} }) => {
  const { owner, patient, subj, obj, markers, assess, plan, date } = data;
  const latMarkers = markers.filter(m => m.view === "lateral");
  const dorMarkers = markers.filter(m => m.view === "dorsal");
  const p = { margin:"5px 0", fontSize:13, lineHeight:1.6, color:"#334155", fontFamily:font };
  const h3 = { fontSize:13.5, fontWeight:700, color:C.teal, margin:"14px 0 5px", fontFamily:font };
  const secTitle = { fontSize:20, fontWeight:700, color:C.teal, margin:"20px 0 8px", borderBottom:`2px solid ${C.tealLight}`, paddingBottom:5, fontFamily:font };
  const check = "☑";

  return (
    <div style={{ fontFamily:font, color:C.dark, padding:32, background:C.white, maxWidth:800, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6, paddingBottom:14, borderBottom:`2px solid ${C.teal}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          {(practice.logo || LOGO_SRC) && <img src={practice.logo || LOGO_SRC} alt="Logo" style={{ width:64, height:64, objectFit:"contain", borderRadius:8 }} />}
          <div>
            <h1 style={{ fontSize:20, fontWeight:800, color:C.teal, margin:0 }}>{practice.name}</h1>
            <p style={{ fontSize:11, color:C.light, margin:"2px 0" }}>{practice.address}</p>
            <p style={{ fontSize:11, color:C.light, margin:0 }}>Tel: {practice.tel} | {practice.email}</p>
          </div>
        </div>
        <div style={{ textAlign:"right", fontSize:11, color:C.light }}>
          <strong style={{ fontSize:13, color:C.dark }}>Chart</strong><br />{date}
        </div>
      </div>

      {/* Owner */}
      <div style={{ padding:"10px 0 14px", borderBottom:`1px solid ${C.border}`, marginBottom:12 }}>
        <strong style={{ fontSize:14 }}>{owner.name || "—"}</strong>
        <span style={{ fontSize:12, color:C.light, marginLeft:12 }}>Patient #{owner.patientNumber || "—"}</span>
        <p style={{ fontSize:12, color:C.light, margin:"2px 0" }}>{owner.address}</p>
        <p style={{ fontSize:12, color:C.light, margin:0 }}>Tel: {owner.phone} | Email: {owner.email}</p>
      </div>
      <p style={{ fontSize:11.5, color:C.light, margin:"0 0 14px" }}>{patient.species === "Human" ? "Provider" : "Added by"}: {practice.doctor}</p>

      {/* SUBJECTIVE */}
      <h2 style={secTitle}>Subjective</h2>
      <h3 style={h3}>Signalment</h3>
      <div style={{ ...p, display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2px 20px" }}>
        <span>Name: {patient.name||"—"}</span><span>Species: {patient.species||"—"}</span>
        <span>Age/DOB: {patient.age||"—"}</span><span>Breed: {patient.breed||"—"}</span>
        <span>Sex: {patient.sex||"—"}</span><span>Color: {patient.color||"—"}</span>
        <span>Approx. weight: {patient.weight||"—"}</span>
      </div>
      <h3 style={h3}>Chief Complaint</h3>
      {subj.intake && <p style={p}><strong>Intake:</strong> {subj.intake}</p>}
      {subj.history && <p style={p}><strong>History:</strong> {subj.history}</p>}
      {subj.meds && <p style={p}><strong>Current medications and supplements:</strong> {subj.meds}</p>}
      {subj.activity && <p style={p}><strong>Activity levels and goals:</strong> {subj.activity}</p>}
      {subj.concerns && <p style={p}>{subj.concerns}</p>}
      {subj.symptoms?.length > 0 && <>
        <h3 style={h3}>Symptoms Noted</h3>
        {subj.symptoms.map((s,i) => <p key={i} style={p}>{check} <strong>{s.name}</strong>{s.desc ? ` — ${s.desc}` : ""}</p>)}
      </>}
      {data.customFieldValues && customFieldDefs.filter(f => f.section === "S" && data.customFieldValues[f.id]).length > 0 && (
        <div style={{ marginTop:8 }}>
          {customFieldDefs.filter(f => f.section === "S" && data.customFieldValues[f.id]).map(f => (
            <p key={f.id} style={p}><strong>{f.label}:</strong> {data.customFieldValues[f.id]}</p>
          ))}
        </div>
      )}
      {/* Human Vitals */}
      {patient.species === "Human" && data.vitals && (data.vitals.bp || data.vitals.hr || data.vitals.temp || data.vitals.resp) && <>
        <h3 style={h3}>Vitals</h3>
        <div style={{ ...p, display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2px 20px" }}>
          {data.vitals.bp && <span><strong>Blood Pressure:</strong> {data.vitals.bp}</span>}
          {data.vitals.hr && <span><strong>Heart Rate:</strong> {data.vitals.hr}</span>}
          {data.vitals.temp && <span><strong>Temperature:</strong> {data.vitals.temp}</span>}
          {data.vitals.resp && <span><strong>Respiration:</strong> {data.vitals.resp}</span>}
        </div>
      </>}

      {/* OBJECTIVE */}
      <h2 style={secTitle}>Objective</h2>
      <h3 style={h3}>Practitioner Observations</h3>
      {obj.observations && <p style={{ ...p, whiteSpace:"pre-wrap" }}>{obj.observations}</p>}

      {latMarkers.length > 0 && <>
        <h3 style={h3}>{patient.species||"Animal"} Lateral Body Chart</h3>
        <div style={{ border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden", marginBottom:8, position:"relative" }}>
          {patient.species === "Human" ? <ChartImg src={HU_CHART_SRC} alt="Human body chart" style={{ width:"100%", display:"block" }} /> : patient.species === "Equine" ? <ChartImg src={EQ_LATERAL_SRC} alt="Equine lateral" style={{ width:"100%", display:"block" }} /> : patient.species === "Feline" ? <ChartImg src={FE_LATERAL_SRC} alt="Feline lateral" style={{ width:"100%", display:"block" }} /> : patient.species === "Swine" ? <ChartImg src={SW_LATERAL_SRC} alt="Swine lateral" style={{ width:"100%", display:"block" }} /> : patient.species === "Avian" ? <ChartImg src={AV_LATERAL_SRC} alt="Avian lateral" style={{ width:"100%", display:"block" }} /> : patient.species === "Caprine" ? <ChartImg src={CP_LATERAL_SRC} alt="Caprine lateral" style={{ width:"100%", display:"block" }} /> : patient.species === "Canine" ? <ChartImg src={K9_LATERAL_SRC} alt="Canine lateral" style={{ width:"100%", display:"block" }} /> : <CanineLateralSVG />}
          {/* Overlay markers using percentage positioning */}
          {latMarkers.map((m,i) => (
            <div key={i} style={{ position:"absolute", left:`${m.xPct}%`, top:`${m.yPct}%`, transform:"translate(-50%,-50%)", width:24, height:24, borderRadius:"50%", background:C.tealLight, color:C.white, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, boxShadow:"0 2px 6px rgba(0,0,0,.3)", fontFamily:font, zIndex:2 }}>{i+1}</div>
          ))}
        </div>
        {latMarkers.map((m,i) => (
          <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:6 }}>
            <span style={{ background:C.tealLight, color:C.white, borderRadius:"50%", minWidth:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, fontFamily:font }}>{i+1}</span>
            <div style={{ fontSize:12.5, lineHeight:1.5 }}>{m.segment && <strong>{m.segment}</strong>}{m.segment && m.description && " — "}{m.description}</div>
          </div>
        ))}
      </>}

      {dorMarkers.length > 0 && <>
        <h3 style={h3}>Dorsal Body Chart</h3>
        <div style={{ border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden", marginBottom:8, display:"flex", justifyContent:"center", position:"relative" }}>
          {patient.species === "Equine" ? <ChartImg src={EQ_DORSAL_SRC} alt="Equine dorsal" style={{ maxWidth:350, width:"100%", display:"block" }} /> : (patient.species === "Canine" || patient.species === "Feline") ? <ChartImg src={K9_DORSAL_SRC} alt={`${patient.species} dorsal`} style={{ maxWidth:350, width:"100%", display:"block" }} /> : <CanineDorsalSVG />}
          {dorMarkers.map((m,i) => (
            <div key={i} style={{ position:"absolute", left:`${m.xPct}%`, top:`${m.yPct}%`, transform:"translate(-50%,-50%)", width:24, height:24, borderRadius:"50%", background:C.tealLight, color:C.white, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, boxShadow:"0 2px 6px rgba(0,0,0,.3)", fontFamily:font, zIndex:2 }}>{i+1}</div>
          ))}
        </div>
        {dorMarkers.map((m,i) => (
          <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:6 }}>
            <span style={{ background:C.tealLight, color:C.white, borderRadius:"50%", minWidth:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, fontFamily:font }}>{i+1}</span>
            <div style={{ fontSize:12.5, lineHeight:1.5 }}>{m.segment && <strong>{m.segment}</strong>}{m.segment && m.description && " — "}{m.description}</div>
          </div>
        ))}
      </>}

      {obj.reactions?.length > 0 && <>
        <h3 style={h3}>Symptoms/Reactions Noted Today</h3>
        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>{obj.reactions.map((r,i) => <span key={i} style={{ fontSize:12.5 }}>{check} {r}</span>)}</div>
      </>}

      {/* Ortho Exam Results */}
      {data.orthoResults && orthoGroups.length > 0 && (() => {
        const tested = orthoGroups.filter(g => g.tests.some(t => data.orthoResults[`${g.id}::${t}`]));
        if (tested.length === 0) return null;
        return <>
          <h3 style={h3}>Orthopedic / Neurological Examination</h3>
          {tested.map(g => (
            <div key={g.id} style={{ marginBottom:10 }}>
              <p style={{ ...p, fontWeight:700, color:C.teal, margin:"8px 0 4px" }}>{g.name}</p>
              {g.tests.filter(t => data.orthoResults[`${g.id}::${t}`]).map(t => {
                const key = `${g.id}::${t}`;
                const res = data.orthoResults[key];
                const note = data.orthoNotes?.[key];
                const label = res === "+" ? "POSITIVE" : res === "-" ? "Negative" : "Not tested";
                const color = res === "+" ? "#991b1b" : res === "-" ? "#166534" : C.light;
                return <p key={key} style={{ ...p, margin:"2px 0" }}>{t}: <strong style={{ color }}>{label}</strong>{note ? ` — ${note}` : ""}</p>;
              })}
            </div>
          ))}
        </>;
      })()}

      {/* Custom Fill-in Fields in Objective */}
      {data.customFieldValues && customFieldDefs.filter(f => f.section === "O" && data.customFieldValues[f.id]).length > 0 && (
        <div style={{ marginTop:8 }}>
          {customFieldDefs.filter(f => f.section === "O" && data.customFieldValues[f.id]).map(f => (
            <p key={f.id} style={p}><strong>{f.label}:</strong> {data.customFieldValues[f.id]}</p>
          ))}
        </div>
      )}

      {/* ASSESSMENT */}
      <h2 style={secTitle}>Assessment</h2>
      {assess.text && <p style={{ ...p, whiteSpace:"pre-wrap" }}>{assess.text}</p>}
      {assess.adjNotes && <p style={p}>{assess.adjNotes}</p>}
      {assess.softTissue && <p style={p}>{assess.softTissue}</p>}
      {assess.responding && <p style={{ ...p, fontWeight:600 }}>Patient is Responding: {check} {assess.responding}</p>}
      {data.customFieldValues && customFieldDefs.filter(f => f.section === "A" && data.customFieldValues[f.id]).length > 0 && (
        <div>{customFieldDefs.filter(f => f.section === "A" && data.customFieldValues[f.id]).map(f => (
          <p key={f.id} style={p}><strong>{f.label}:</strong> {data.customFieldValues[f.id]}</p>
        ))}</div>
      )}

      {/* PLAN */}
      <h2 style={secTitle}>Plan</h2>
      <h3 style={h3}>Treatment</h3>
      {plan.tx && <p style={{ ...p, whiteSpace:"pre-wrap" }}>{plan.tx}</p>}
      {plan.response?.length > 0 && <>
        <h3 style={h3}>Response to Care</h3>
        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>{plan.response.map((r,i) => <span key={i} style={{ fontSize:12.5 }}>{check} {r}</span>)}</div>
      </>}
      {plan.postTx?.length > 0 && <>
        <h3 style={h3}>Post Treatment Care</h3>
        {plan.postTx.map((pt,i) => <p key={i} style={p}>{check} {pt}</p>)}
      </>}
      {plan.nextAppt && <><h3 style={h3}>Next Appointment</h3><p style={p}>{check} {plan.nextAppt}</p></>}
      {plan.notes && <><h3 style={h3}>Note</h3><p style={p}>{plan.notes}</p></>}
      {data.customFieldValues && customFieldDefs.filter(f => f.section === "P" && data.customFieldValues[f.id]).length > 0 && (
        <div>{customFieldDefs.filter(f => f.section === "P" && data.customFieldValues[f.id]).map(f => (
          <p key={f.id} style={p}><strong>{f.label}:</strong> {data.customFieldValues[f.id]}</p>
        ))}</div>
      )}

      {/* Custom Checkbox Groups */}
      {customGroups.filter(g => g.items.length > 0 && data.customChecks?.[g.name]?.length > 0).map((g, gi) => (
        <div key={gi}>
          <h3 style={h3}>{g.name}</h3>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>{data.customChecks[g.name].map((item,i) => <span key={i} style={{ fontSize:12.5 }}>{check} {item}</span>)}</div>
        </div>
      ))}

      {/* Visit Number */}
      {data.visitNumber && <p style={{ ...p, marginTop:14 }}><strong>Visit #:</strong> {data.visitNumber}</p>}

      {/* Referring Veterinarian */}
      {data.referringVet && patient.species !== "Human" && <p style={p}><strong>Referring Veterinarian:</strong> {data.referringVet}</p>}

      {/* Barn / Patient Location */}
      {data.barnLocation && patient.species !== "Human" && <p style={p}><strong>Patient Location:</strong> {data.barnLocation}</p>}

      {/* Consent */}
      {data.consentChecked && (
        <div style={{ marginTop:16, padding:10, background:C.tealBg, borderRadius:8, border:`1px solid ${C.border}` }}>
          <p style={{ ...p, fontSize:12, fontStyle:"italic", margin:0 }}>
            {check} {patient.species === "Human"
              ? "Patient has been informed of the risks and benefits of chiropractic care and has consented to treatment. Informed consent on file."
              : "Owner has been informed of the risks and benefits of animal chiropractic care, consents to treatment, and confirms a current veterinary referral is on file."}
          </p>
        </div>
      )}

      {/* Signature */}
      <div style={{ marginTop:28, paddingTop:14, borderTop:`2px solid ${C.teal}` }}>
        <p style={{ fontSize:14, fontWeight:700, color:C.teal, margin:0 }}>{practice.doctor}</p>
        <p style={{ fontSize:11.5, color:C.light, margin:"4px 0 0" }}>Signed on {new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})} at {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
};


// ================================================================
// MAIN APP
// ================================================================
export default function App() {
  const [view, setView] = useState("form");
  const [sections, setSections] = useState({ S:true, O:false, A:false, P:false });
  const [savedNotes, setSavedNotes] = useState([]);
  const [noteId, setNoteId] = useState(null);

  // Practice info (configurable per user)
  const [practice, setPractice] = useState(DEFAULT_PRACTICE);
  const [practiceLoaded, setPracticeLoaded] = useState(false);

  // GHL integration
  const [ghlConfig, setGhlConfig] = useState({ token:"", locationId:"" });
  const [ghlContactId, setGhlContactId] = useState(null);
  const [ghlStatus, setGhlStatus] = useState(""); // "", "pushing", "success", "error"

  // Form state
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split("T")[0]);
  const [owner, setOwner] = useState({ name:"", patientNumber:"", address:"", phone:"", email:"" });
  const [patient, setPatient] = useState({ name:"", species:"Human", age:"", breed:"", sex:"", color:"", weight:"" });
  const [intake, setIntake] = useState("");
  const [history, setHistory] = useState("");
  const [meds, setMeds] = useState("");
  const [activity, setActivity] = useState("");
  const [concerns, setConcerns] = useState("");
  const [symptoms, setSymptoms] = useState([]);
  const [symptomDescs, setSymptomDescs] = useState({});
  const [observations, setObservations] = useState("");
  const [markers, setMarkers] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [assessText, setAssessText] = useState("");
  const [adjNotes, setAdjNotes] = useState("");
  const [softTissue, setSoftTissue] = useState("");
  const [responding, setResponding] = useState("");
  const [planTx, setPlanTx] = useState("");
  const [respCare, setRespCare] = useState([]);
  const [postTx, setPostTx] = useState([]);
  const [nextAppt, setNextAppt] = useState("");
  const [planNotes, setPlanNotes] = useState("");

  // Custom checkbox groups (persisted via Settings)
  const [customGroups, setCustomGroups] = useState([]);
  const [customChecks, setCustomChecks] = useState({});
  const [showSettings, setShowSettings] = useState(false);

  // Ortho exams
  const [orthoGroups, setOrthoGroups] = useState(DEFAULT_ORTHO_GROUPS);
  const [orthoResults, setOrthoResults] = useState({});
  const [orthoNotes, setOrthoNotes] = useState({});
  const [orthoExpanded, setOrthoExpanded] = useState({});

  // Quick phrases
  const [phrases, setPhrases] = useState(DEFAULT_PHRASES);
  const [activePhraseField, setActivePhraseField] = useState(null);

  // Custom fill-in fields
  const [customFieldDefs, setCustomFieldDefs] = useState(DEFAULT_CUSTOM_FIELDS);
  const [customFieldValues, setCustomFieldValues] = useState({});

  // Human vitals (initial intake only)
  const [vitals, setVitals] = useState({ bp:"", hr:"", temp:"", resp:"", height:"", weight:"", bmi:"" });

  // Referring vet (animal notes)
  const [referringVet, setReferringVet] = useState("");
  const [savedVets, setSavedVets] = useState([]);

  // Visit tracking
  const [visitNumber, setVisitNumber] = useState("");

  // Consent / disclaimer
  const [consentChecked, setConsentChecked] = useState(false);

  // Note status tracking
  const [noteStatus, setNoteStatus] = useState("draft"); // draft | finalized | sent

  // Patient & Barn directories
  const [patientDir, setPatientDir] = useState([]); // [{id, owner:{name,address,phone,email,patientNumber}, patients:[{name,species,breed,age,sex,color,weight,barnId,referringVet}], visitCount:N}]
  const [barnDir, setBarnDir] = useState([]); // [{id, name, address, contact, phone, notes}]
  const [barnLocation, setBarnLocation] = useState(""); // current note's barn/location

  // Settings sub-tab
  const [settingsTab, setSettingsTab] = useState("checkboxes");

  useEffect(() => {
    (async () => { try { const r = { value: localStorage.getItem("soap-notes") }; if (r?.value) setSavedNotes(JSON.parse(r.value)); } catch(e){} })();
    (async () => { try { const r = { value: localStorage.getItem("custom-groups") }; if (r?.value) setCustomGroups(JSON.parse(r.value)); } catch(e){} })();
    (async () => { try { const r = { value: localStorage.getItem("ortho-groups") }; if (r?.value) setOrthoGroups(JSON.parse(r.value)); } catch(e){} })();
    (async () => { try { const r = { value: localStorage.getItem("phrases") }; if (r?.value) setPhrases(JSON.parse(r.value)); } catch(e){} })();
    (async () => { try { const r = { value: localStorage.getItem("custom-field-defs") }; if (r?.value) setCustomFieldDefs(JSON.parse(r.value)); } catch(e){} })();
    (async () => { try { const r = { value: localStorage.getItem("saved-vets") }; if (r?.value) setSavedVets(JSON.parse(r.value)); } catch(e){} })();
    (async () => { try { const r = { value: localStorage.getItem("patient-dir") }; if (r?.value) setPatientDir(JSON.parse(r.value)); } catch(e){} })();
    (async () => { try { const r = { value: localStorage.getItem("barn-dir") }; if (r?.value) setBarnDir(JSON.parse(r.value)); } catch(e){} })();
    // Load practice info
    (async () => {
      try {
        const r = { value: localStorage.getItem("practice-info") };
        if (r?.value) { setPractice(JSON.parse(r.value)); }
        else { setView("settings"); setSettingsTab("practice"); }
      } catch(e){}
      setPracticeLoaded(true);
    })();
    // Load GHL config & detect iframe context
    const savedGHL = getGHLConfig();
    if (savedGHL) setGhlConfig(savedGHL);
    const urlContactId = getContactIdFromURL();
    if (urlContactId) {
      setGhlContactId(urlContactId);
      // Auto-fill owner from GHL contact if configured
      if (savedGHL?.token) {
        getContact(urlContactId).then(c => {
          if (c) {
            setOwner(prev => ({
              ...prev,
              name: [c.firstName, c.lastName].filter(Boolean).join(" ") || prev.name,
              phone: c.phone || prev.phone,
              email: c.email || prev.email,
              address: [c.address1, c.city, c.state, c.postalCode].filter(Boolean).join(", ") || prev.address,
            }));
          }
        }).catch(e => console.warn("GHL contact fetch failed:", e));
      }
    }
  }, []);

  const persist = async (notes) => { try { localStorage.setItem("soap-notes", JSON.stringify(notes)); } catch(e){} };
  const persistGroups = async (groups) => { try { localStorage.setItem("custom-groups", JSON.stringify(groups)); } catch(e){} };
  const persistOrtho = async (g) => { try { localStorage.setItem("ortho-groups", JSON.stringify(g)); } catch(e){} };
  const persistPhrases = async (p) => { try { localStorage.setItem("phrases", JSON.stringify(p)); } catch(e){} };
  const persistFieldDefs = async (f) => { try { localStorage.setItem("custom-field-defs", JSON.stringify(f)); } catch(e){} };
  const persistVets = async (v) => { try { localStorage.setItem("saved-vets", JSON.stringify(v)); } catch(e){} };
  const persistPractice = async (p) => { try { localStorage.setItem("practice-info", JSON.stringify(p)); } catch(e){} };
  const persistPatientDir = async (d) => { try { localStorage.setItem("patient-dir", JSON.stringify(d)); } catch(e){} };
  const persistBarnDir = async (d) => { try { localStorage.setItem("barn-dir", JSON.stringify(d)); } catch(e){} };

  // Ortho helpers
  const setOrthoResult = (testKey, val) => setOrthoResults(p => ({ ...p, [testKey]: val }));
  const setOrthoNote = (testKey, val) => setOrthoNotes(p => ({ ...p, [testKey]: val }));
  const toggleOrthoGroup = (gid) => setOrthoExpanded(p => ({ ...p, [gid]: !p[gid] }));



  const getData = () => ({
    date: noteDate, owner, patient,
    subj: { intake, history, meds, activity, concerns, symptoms: symptoms.map(s => ({ name:s, desc:symptomDescs[s]||"" })) },
    obj: { observations, reactions }, markers,
    assess: { text:assessText, adjNotes, softTissue, responding },
    plan: { tx:planTx, response:respCare, postTx, nextAppt, notes:planNotes },
    customChecks, orthoResults, orthoNotes, customFieldValues, vitals,
    referringVet, visitNumber, consentChecked, barnLocation, noteStatus,
  });

  const saveNote = async () => {
    const d = getData();
    const id = noteId || `n-${Date.now()}`;
    const rec = { id, savedAt:new Date().toISOString(), pName:patient.name, oName:owner.name, species:patient.species, date:noteDate, status:noteStatus, data:d };
    let upd;
    if (noteId) { upd = savedNotes.map(n => n.id===id ? rec : n); } else { upd = [rec, ...savedNotes]; setNoteId(id); }
    setSavedNotes(upd); await persist(upd);

    // Auto-save to patient directory
    if (patient.name && owner.name) {
      const dirKey = `${owner.name}::${patient.name}`.toLowerCase();
      const existing = patientDir.find(e => `${e.owner.name}::${e.patientName}`.toLowerCase() === dirKey);
      const entry = {
        id: existing?.id || `pd-${Date.now()}`,
        owner: { name:owner.name, patientNumber:owner.patientNumber, address:owner.address, phone:owner.phone, email:owner.email },
        patientName: patient.name, species:patient.species, breed:patient.breed, age:patient.age,
        sex:patient.sex, color:patient.color, weight:patient.weight,
        barnLocation: barnLocation, referringVet: referringVet,
        visitCount: existing ? (parseInt(existing.visitCount)||0) + (noteId ? 0 : 1) : 1,
        lastVisit: noteDate,
      };
      const updDir = existing ? patientDir.map(e => e.id === existing.id ? entry : e) : [entry, ...patientDir];
      setPatientDir(updDir); await persistPatientDir(updDir);
    }

    // Push to GHL if configured
    const contactId = ghlContactId || null;
    if (isGHLConfigured() && contactId) {
      setGhlStatus("pushing");
      try {
        const formatted = formatSOAPNoteForGHL(d, practice);
        await createContactNote(contactId, formatted);
        setGhlStatus("success");
        setNoteStatus("sent");
        // Update the saved note's status to "sent"
        const sentUpd = (upd || savedNotes).map(n => n.id === id ? {...n, status:"sent", data:{...n.data, noteStatus:"sent"}} : n);
        setSavedNotes(sentUpd); await persist(sentUpd);
        setTimeout(() => setGhlStatus(""), 3000);
      } catch (e) {
        console.error("GHL push failed:", e);
        setGhlStatus("error");
        setTimeout(() => setGhlStatus(""), 5000);
      }
      alert("Note saved!" + (ghlStatus !== "error" ? " Also pushed to GoHighLevel." : " (GHL push failed — saved locally)"));
    } else {
      alert("Note saved!" + (isGHLConfigured() ? " (No contact linked — saved locally only)" : ""));
    }
  };

  const loadNote = (n) => {
    const d = n.data; setNoteId(n.id); setNoteDate(d.date); setOwner(d.owner); setPatient(d.patient);
    setIntake(d.subj.intake); setHistory(d.subj.history); setMeds(d.subj.meds); setActivity(d.subj.activity); setConcerns(d.subj.concerns);
    setSymptoms(d.subj.symptoms.map(s=>s.name)); const ds={}; d.subj.symptoms.forEach(s=>{ds[s.name]=s.desc}); setSymptomDescs(ds);
    setObservations(d.obj.observations); setReactions(d.obj.reactions); setMarkers(d.markers);
    setAssessText(d.assess.text); setAdjNotes(d.assess.adjNotes); setSoftTissue(d.assess.softTissue); setResponding(d.assess.responding);
    setPlanTx(d.plan.tx); setRespCare(d.plan.response); setPostTx(d.plan.postTx); setNextAppt(d.plan.nextAppt); setPlanNotes(d.plan.notes);
    setCustomChecks(d.customChecks || {});
    setOrthoResults(d.orthoResults || {}); setOrthoNotes(d.orthoNotes || {}); setCustomFieldValues(d.customFieldValues || {});
    setVitals(d.vitals || { bp:"", hr:"", temp:"", resp:"", height:"", weight:"", bmi:"" });
    setReferringVet(d.referringVet || ""); setVisitNumber(d.visitNumber || ""); setConsentChecked(d.consentChecked || false);
    setBarnLocation(d.barnLocation || "");
    setNoteStatus(n.status || d.noteStatus || "draft");
    setView("form");
  };

  const newNote = () => {
    setNoteId(null); setNoteDate(new Date().toISOString().split("T")[0]);
    setOwner({name:"",patientNumber:"",address:"",phone:"",email:""});
    setPatient({name:"",species:"Equine",age:"",breed:"",sex:"",color:"",weight:""});
    setIntake(""); setHistory(""); setMeds(""); setActivity(""); setConcerns("");
    setSymptoms([]); setSymptomDescs({}); setObservations(""); setReactions([]); setMarkers([]);
    setAssessText(""); setAdjNotes(""); setSoftTissue(""); setResponding("");
    setPlanTx(""); setRespCare([]); setPostTx([]); setNextAppt(""); setPlanNotes("");
    setCustomChecks({}); setOrthoResults({}); setOrthoNotes({}); setOrthoExpanded({}); setCustomFieldValues({});
    setVitals({ bp:"", hr:"", temp:"", resp:"", height:"", weight:"", bmi:"" });
    setReferringVet(""); setVisitNumber(""); setConsentChecked(false);
    setBarnLocation("");
    setNoteStatus("draft");
    setSections({S:true,O:false,A:false,P:false}); setView("form");
  };

  const applyTemplate = (k) => {
    const t = TEMPLATES[k]; if (!t) return;
    setPatient(p => ({...p, species:t.species}));
    setAssessText(t.assessment); setPlanTx(t.planTx); setResponding(t.responding);
    setSections({S:true,O:true,A:true,P:true});
  };

  const deleteNote = async (id) => {
    const note = savedNotes.find(n => n.id === id);
    const label = note ? `${note.pName || "Unnamed"} (${note.species || "?"}) — ${note.date}` : "this note";
    if (!confirm(`Are you sure you want to permanently delete the note for:\n\n${label}\n\nThis cannot be undone.`)) return;
    const upd = savedNotes.filter(n => n.id !== id);
    setSavedNotes(upd); await persist(upd);
  };

  const duplicateNote = (n) => {
    const d = JSON.parse(JSON.stringify(n.data));
    d.date = new Date().toISOString().split("T")[0];
    // Clear clinical findings but keep patient/owner info
    d.markers = []; d.obj.observations = ""; d.obj.reactions = [];
    d.orthoResults = {}; d.orthoNotes = {};
    const newId = `n-${Date.now()}`;
    const rec = { id:newId, savedAt:new Date().toISOString(), createdAt:new Date().toISOString(), pName:d.patient.name, oName:d.owner.name, species:d.patient.species, date:d.date, data:d };
    const upd = [rec, ...savedNotes];
    setSavedNotes(upd); persist(upd);
    loadNote(rec);
  };

  // Load patient from directory into form
  const loadFromDirectory = (entry) => {
    setOwner({ name:entry.owner.name, patientNumber:entry.owner.patientNumber||"", address:entry.owner.address||"", phone:entry.owner.phone||"", email:entry.owner.email||"" });
    setPatient({ name:entry.patientName, species:entry.species||"Equine", age:entry.age||"", breed:entry.breed||"", sex:entry.sex||"", color:entry.color||"", weight:entry.weight||"" });
    setBarnLocation(entry.barnLocation||"");
    setReferringVet(entry.referringVet||"");
    setVisitNumber(String((parseInt(entry.visitCount)||0) + 1));
  };

  const toggleSec = s => setSections(p => ({...p,[s]:!p[s]}));
  const toggleSymp = n => setSymptoms(p => p.includes(n) ? p.filter(x=>x!==n) : [...p,n]);
  const addMarker = m => setMarkers(p => [...p, m]);
  const removeMarker = i => setMarkers(p => p.filter((_,idx)=>idx!==i));
  const updateMarker = (i, key, val) => setMarkers(p => p.map((m,idx) => idx===i ? {...m,[key]:val} : m));

  const btn = (primary, children, onClick, extra={}) => (
    <button onClick={onClick} style={{
      padding:"9px 20px", borderRadius:8, border: primary ? "none" : `1.5px solid ${C.tealLight}`,
      background: primary ? `linear-gradient(135deg,${C.teal},${C.tealLight})` : C.white,
      color: primary ? C.white : C.tealLight, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font,
      boxShadow: primary ? "0 3px 10px rgba(13,148,136,.25)" : "none", ...extra,
    }}>{children}</button>
  );

  // ── Render ──
  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(165deg,${C.tealBg} 0%,#f8fafc 40%,#ecfdf5 100%)`, fontFamily:font }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet" />
      <style>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print, nav, [class*="sticky"] { display: none !important; }
          #soap-printable { box-shadow: none !important; border-radius: 0 !important; }
          div[style*="sticky"] { position: static !important; display: none !important; }
          div[style*="linear-gradient(165deg"] { background: white !important; padding: 0 !important; }
          div[style*="maxWidth"] { max-width: 100% !important; padding: 0 !important; }
        }
        @media (max-width: 640px) {
          div[style*="gridTemplateColumns"] { grid-template-columns: 1fr !important; }
          div[style*="flex-wrap"] { gap: 6px !important; }
          input, select, textarea { font-size: 16px !important; }
        }
      `}</style>

      {/* ── Top Bar ── */}
      <div className="no-print" style={{ background:`linear-gradient(135deg,${C.teal},#065f46)`, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 12px rgba(0,0,0,.15)", flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <img src={practice.logo || LOGO_SRC} alt="Logo" style={{ width:32, height:32, borderRadius:"50%", background:"rgba(255,255,255,.1)", objectFit:"contain" }} />
          <div>
            <h1 style={{ margin:0, fontSize:14, fontWeight:800, color:C.white, letterSpacing:.5 }}>{practice.name}</h1>
            <p style={{ margin:0, fontSize:9, color:"rgba(255,255,255,.65)", letterSpacing:.5, textTransform:"uppercase" }}>SOAP Note System {isGHLConfigured() && <span style={{ color:"#86efac" }}>● GHL</span>}</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {[["form","✏️ Edit"],["preview","👁 Preview"],["notes","📋 Notes"],["settings","⚙️"]].map(([v,l]) => (
            <button key={v} onClick={()=>setView(v)} style={{ padding:"5px 10px", borderRadius:8, border:"none", background: view===v ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.07)", color:C.white, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:font }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"14px 14px 80px" }}>

        {/* ── NOTES LIST ── */}
        {/* —— SETTINGS: Custom Checkbox Groups —— */}
        {view === "settings" && (
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, color:C.teal, margin:"0 0 14px" }}>Settings</h2>
            {/* Settings sub-tabs */}
            <div style={{ display:"flex", gap:4, marginBottom:16, flexWrap:"wrap" }}>
              {[["practice","🏥 Practice Info"],["ghl","🔗 GHL Integration"],["checkboxes","☑ Checkbox Groups"],["ortho","🦴 Ortho Exams"],["phrases","⚡ Quick Phrases"],["fields","📝 Custom Fields"]].map(([k,l]) => (
                <button key={k} onClick={()=>setSettingsTab(k)} style={{ padding:"7px 14px", borderRadius:8, border: settingsTab===k ? "none" : `1.5px solid ${C.border}`, background: settingsTab===k ? C.teal : C.white, color: settingsTab===k ? C.white : C.mid, fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:font }}>{l}</button>
              ))}
            </div>

            {/* ── Practice Info ── */}
            {settingsTab === "practice" && (
              <div>
                <p style={{ fontSize:13, color:C.mid, marginBottom:14 }}>Configure your practice details. This information appears on note previews, printouts, and the header bar.</p>
                <div style={{ background:C.white, borderRadius:10, padding:14, border:`1px solid ${C.border}` }}>
                  {/* Logo Upload */}
                  <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:16, padding:12, background:C.tealBg, borderRadius:8 }}>
                    <div style={{ width:72, height:72, borderRadius:12, border:`2px dashed ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0, background:C.white }}>
                      {practice.logo ? (
                        <img src={practice.logo} alt="Logo" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
                      ) : (
                        <span style={{ fontSize:28, color:C.light }}>📷</span>
                      )}
                    </div>
                    <div>
                      <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.teal, marginBottom:6, fontFamily:font, textTransform:"uppercase", letterSpacing:.8 }}>Practice Logo</label>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        <label style={{ padding:"6px 14px", borderRadius:6, border:"none", background:C.tealLight, color:C.white, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:font }}>
                          Upload Image
                          <input type="file" accept="image/*" style={{ display:"none" }} onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              // Compress via canvas
                              const img = new Image();
                              img.onload = () => {
                                const canvas = document.createElement("canvas");
                                const maxW = 200;
                                const scale = Math.min(maxW / img.width, maxW / img.height, 1);
                                canvas.width = img.width * scale;
                                canvas.height = img.height * scale;
                                const ctx = canvas.getContext("2d");
                                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                const compressed = canvas.toDataURL("image/png", 0.85);
                                setPractice(p => ({ ...p, logo: compressed }));
                              };
                              img.src = reader.result;
                            };
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                        {practice.logo && (
                          <button onClick={() => setPractice(p => ({ ...p, logo: "" }))} style={{ padding:"6px 14px", borderRadius:6, border:`1px solid ${C.border}`, background:C.white, color:C.red, fontSize:12, cursor:"pointer", fontFamily:font }}>Remove</button>
                        )}
                      </div>
                      <p style={{ fontSize:10.5, color:C.light, margin:"6px 0 0" }}>Recommended: square PNG or JPG, at least 200×200px. Appears on printed notes and header.</p>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"0 14px" }}>
                    <Field label="Practice Name" wide><input value={practice.name} onChange={e=>setPractice(p=>({...p,name:e.target.value}))} style={{...inp, fontWeight:700, fontSize:15}} placeholder="e.g., Restored Chiropractic" /></Field>
                    <Field label="Tagline"><input value={practice.tagline} onChange={e=>setPractice(p=>({...p,tagline:e.target.value}))} style={inp} placeholder="e.g., & Wellness" /></Field>
                    <Field label="Doctor Name & Credentials" wide><input value={practice.doctor} onChange={e=>setPractice(p=>({...p,doctor:e.target.value}))} style={inp} placeholder="e.g., Dr. Jane Smith DC, DACBR" /></Field>
                    <Field label="Address" wide><input value={practice.address} onChange={e=>setPractice(p=>({...p,address:e.target.value}))} style={inp} placeholder="Full address" /></Field>
                    <Field label="Phone"><input value={practice.tel} onChange={e=>setPractice(p=>({...p,tel:e.target.value}))} style={inp} placeholder="e.g., 919-555-0123" /></Field>
                    <Field label="Email"><input value={practice.email} onChange={e=>setPractice(p=>({...p,email:e.target.value}))} style={inp} placeholder="e.g., doc@clinic.com" /></Field>
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:14 }}>
                    {btn(true, "💾 Save Practice Info", async () => { await persistPractice(practice); alert("Practice info saved!"); })}
                    <button onClick={()=>{ setPractice(DEFAULT_PRACTICE); persistPractice(DEFAULT_PRACTICE); }} style={{ padding:"9px 16px", borderRadius:8, border:`1px solid ${C.border}`, background:C.white, color:C.mid, fontSize:12, cursor:"pointer", fontFamily:font }}>Reset to Defaults</button>
                  </div>
                </div>
                {!localStorage.getItem("practice-info") && (
                  <div style={{ marginTop:16, padding:14, background:"#fef3c7", borderRadius:8, border:"1px solid #f59e0b" }}>
                    <p style={{ fontSize:13, color:"#92400e", margin:0, fontWeight:600 }}>👋 Welcome! Please fill in your practice information above and save before creating notes. This info will appear on all your SOAP note printouts.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── GHL Integration ── */}
            {settingsTab === "ghl" && (
              <div>
                <p style={{ fontSize:13, color:C.mid, marginBottom:14 }}>Connect to GoHighLevel to sync notes with contact records. When configured, saving a note will also push a formatted summary to the contact's Notes in GHL.</p>
                <div style={{ background:C.white, borderRadius:10, padding:14, border:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"0 14px" }}>
                    <Field label="Private Integration Token" wide>
                      <input value={ghlConfig.token} onChange={e=>setGhlConfig(p=>({...p,token:e.target.value}))} style={{...inp, fontFamily:"monospace", fontSize:12}} placeholder="Paste your GHL Private Integration Token" type="password" />
                    </Field>
                    <Field label="Location ID (Sub-Account)">
                      <input value={ghlConfig.locationId} onChange={e=>setGhlConfig(p=>({...p,locationId:e.target.value}))} style={{...inp, fontFamily:"monospace", fontSize:12}} placeholder="e.g., ve9EPM428h8vShlRW1KT" />
                    </Field>
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:14, alignItems:"center", flexWrap:"wrap" }}>
                    {btn(true, "💾 Save GHL Config", () => { saveGHLConfig(ghlConfig); alert("GHL configuration saved!"); })}
                    {isGHLConfigured() && <span style={{ fontSize:12, color:C.teal, fontWeight:600 }}>✓ Connected</span>}
                    {ghlConfig.token && !isGHLConfigured() && <span style={{ fontSize:12, color:C.red }}>Missing location ID</span>}
                  </div>
                  {ghlContactId && (
                    <div style={{ marginTop:12, padding:10, background:C.tealBg, borderRadius:8, fontSize:12, color:C.dark }}>
                      <strong>Active Contact:</strong> {ghlContactId} <span style={{ color:C.light }}>(loaded from iframe URL)</span>
                    </div>
                  )}
                </div>
                <div style={{ marginTop:16, background:C.white, borderRadius:10, padding:14, border:`1px solid ${C.border}` }}>
                  <h3 style={{ fontSize:13, fontWeight:700, color:C.teal, margin:"0 0 10px" }}>Setup Instructions</h3>
                  <ol style={{ fontSize:12.5, color:C.mid, lineHeight:1.8, paddingLeft:20, margin:0 }}>
                    <li>In GHL, go to <strong>Settings → Integrations → Private Integrations</strong></li>
                    <li>Click <strong>Create New</strong> and name it "SOAP Notes"</li>
                    <li>Enable scopes: <strong>contacts.readonly, contacts.write</strong></li>
                    <li>Copy the token and paste it above</li>
                    <li>Your Location ID is in <strong>Settings → Business Info</strong> or in the URL of your sub-account</li>
                    <li>To auto-link contacts, set up a <strong>Custom Menu Link</strong> with URL:<br/>
                      <code style={{ fontSize:11, background:"#f1f5f9", padding:"2px 6px", borderRadius:4, wordBreak:"break-all" }}>
                        {"https://your-app.vercel.app/?contactId={{contact.id}}"}
                      </code>
                    </li>
                  </ol>
                </div>
                {isGHLConfigured() && !ghlContactId && (
                  <div style={{ marginTop:12, padding:10, background:C.tealBg, borderRadius:8 }}>
                    <Field label="Manual Contact ID (for testing)">
                      <div style={{ display:"flex", gap:6 }}>
                        <input value={ghlContactId || ""} onChange={e=>setGhlContactId(e.target.value || null)} style={{...inp, flex:1, fontFamily:"monospace", fontSize:12}} placeholder="Paste a GHL contact ID to test" />
                      </div>
                    </Field>
                  </div>
                )}
              </div>
            )}

            {/* ── Checkbox Groups ── */}
            {settingsTab === "checkboxes" && (
              <div>
                <p style={{ fontSize:13, color:C.mid, marginBottom:14 }}>Create reusable checkbox groups that appear in your SOAP notes.</p>
                {customGroups.map((g, gi) => (
                  <div key={gi} style={{ background:C.white, borderRadius:10, padding:14, marginBottom:12, border:`1px solid ${C.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <input value={g.name} onChange={e => { const upd = [...customGroups]; upd[gi] = {...upd[gi], name:e.target.value}; setCustomGroups(upd); }} style={{...inp, fontWeight:700, fontSize:14, flex:1, marginRight:8}} placeholder="Group name (e.g., Cervical ROM)" />
                      <select value={g.section || "O"} onChange={e => { const upd = [...customGroups]; upd[gi] = {...upd[gi], section:e.target.value}; setCustomGroups(upd); }} style={{...inp, width:140, fontSize:12}}>
                        <option value="S">Subjective</option><option value="O">Objective</option><option value="A">Assessment</option><option value="P">Plan</option>
                      </select>
                      <button onClick={() => { const upd = customGroups.filter((_,i)=>i!==gi); setCustomGroups(upd); persistGroups(upd); }} style={{ background:"none", border:"none", cursor:"pointer", color:C.red, padding:4, marginLeft:8 }}><IcoTrash /></button>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                      {g.items.map((item, ii) => (
                        <div key={ii} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fafafa", fontSize:12.5 }}>
                          <span>{item}</span>
                          <button onClick={() => { const upd = [...customGroups]; upd[gi] = {...upd[gi], items: upd[gi].items.filter((_,i)=>i!==ii)}; setCustomGroups(upd); persistGroups(upd); }} style={{ background:"none", border:"none", cursor:"pointer", color:C.red, padding:0, fontSize:14, lineHeight:1 }}>&times;</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <input id={`new-item-${gi}`} style={{...inp, flex:1, fontSize:12.5}} placeholder="Add checkbox item..." onKeyDown={e => {
                        if (e.key === "Enter" && e.target.value.trim()) {
                          const upd = [...customGroups]; upd[gi] = {...upd[gi], items:[...upd[gi].items, e.target.value.trim()]}; setCustomGroups(upd); persistGroups(upd); e.target.value = "";
                        }
                      }} />
                      <button onClick={() => { const el = document.getElementById(`new-item-${gi}`); if (el?.value.trim()) { const upd = [...customGroups]; upd[gi] = {...upd[gi], items:[...upd[gi].items, el.value.trim()]}; setCustomGroups(upd); persistGroups(upd); el.value = ""; }}} style={{ padding:"6px 14px", borderRadius:8, border:"none", background:C.tealLight, color:C.white, fontSize:12, fontWeight:600, cursor:"pointer" }}>Add</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => { const upd = [...customGroups, { name:"", section:"O", items:[] }]; setCustomGroups(upd); persistGroups(upd); }} style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:8, border:`1.5px dashed ${C.tealLight}`, background:C.white, color:C.tealLight, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font, width:"100%", justifyContent:"center" }}>
                  <IcoPlus /> Add New Group
                </button>
              </div>
            )}

            {/* ── Ortho Exam Groups ── */}
            {settingsTab === "ortho" && (
              <div>
                <p style={{ fontSize:13, color:C.mid, marginBottom:14 }}>Manage orthopedic and neurological exam groups. These appear in the Objective section for Human patients. Add/remove tests or create new body region groups.</p>
                {orthoGroups.map((g, gi) => (
                  <div key={g.id} style={{ background:C.white, borderRadius:10, padding:14, marginBottom:12, border:`1px solid ${C.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <input value={g.name} onChange={e => { const upd = [...orthoGroups]; upd[gi] = {...upd[gi], name:e.target.value}; setOrthoGroups(upd); }} style={{...inp, fontWeight:700, fontSize:14, flex:1, marginRight:8}} placeholder="Group name (e.g., Cervical Spine)" />
                      <button onClick={() => { const upd = orthoGroups.filter((_,i)=>i!==gi); setOrthoGroups(upd); persistOrtho(upd); }} style={{ background:"none", border:"none", cursor:"pointer", color:C.red, padding:4 }}><IcoTrash /></button>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                      {g.tests.map((t, ti) => (
                        <div key={ti} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:"#fafafa", fontSize:12.5 }}>
                          <span>{t}</span>
                          <button onClick={() => { const upd = [...orthoGroups]; upd[gi] = {...upd[gi], tests: upd[gi].tests.filter((_,i)=>i!==ti)}; setOrthoGroups(upd); persistOrtho(upd); }} style={{ background:"none", border:"none", cursor:"pointer", color:C.red, padding:0, fontSize:14, lineHeight:1 }}>&times;</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <input id={`new-test-${gi}`} style={{...inp, flex:1, fontSize:12.5}} placeholder="Add test name..." onKeyDown={e => {
                        if (e.key === "Enter" && e.target.value.trim()) {
                          const upd = [...orthoGroups]; upd[gi] = {...upd[gi], tests:[...upd[gi].tests, e.target.value.trim()]}; setOrthoGroups(upd); persistOrtho(upd); e.target.value = "";
                        }
                      }} />
                      <button onClick={() => { const el = document.getElementById(`new-test-${gi}`); if (el?.value.trim()) { const upd = [...orthoGroups]; upd[gi] = {...upd[gi], tests:[...upd[gi].tests, el.value.trim()]}; setOrthoGroups(upd); persistOrtho(upd); el.value = ""; }}} style={{ padding:"6px 14px", borderRadius:8, border:"none", background:C.tealLight, color:C.white, fontSize:12, fontWeight:600, cursor:"pointer" }}>Add</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => { const upd = [...orthoGroups, { id:`ortho-${Date.now()}`, name:"", region:"Custom", tests:[] }]; setOrthoGroups(upd); persistOrtho(upd); }} style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:8, border:`1.5px dashed ${C.tealLight}`, background:C.white, color:C.tealLight, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font, width:"100%", justifyContent:"center" }}>
                  <IcoPlus /> Add New Exam Group
                </button>
                <button onClick={() => { setOrthoGroups(DEFAULT_ORTHO_GROUPS); persistOrtho(DEFAULT_ORTHO_GROUPS); }} style={{ display:"block", margin:"12px auto 0", padding:"8px 16px", borderRadius:8, border:`1px solid ${C.border}`, background:C.white, color:C.mid, fontSize:12, cursor:"pointer", fontFamily:font }}>
                  Reset to Defaults
                </button>
              </div>
            )}

            {/* ── Quick Phrases ── */}
            {settingsTab === "phrases" && (
              <div>
                <p style={{ fontSize:13, color:C.mid, marginBottom:14 }}>Manage quick-insert phrases organized by SOAP section. Click ⚡ Phrases on any text field during charting to insert these.</p>
                {["S","O","A","P"].map(sec => {
                  const secLabel = { S:"Subjective", O:"Objective", A:"Assessment", P:"Plan" }[sec];
                  const items = phrases[sec] || [];
                  return (
                    <div key={sec} style={{ background:C.white, borderRadius:10, padding:14, marginBottom:12, border:`1px solid ${C.border}` }}>
                      <h3 style={{ fontSize:13, fontWeight:700, color:C.teal, margin:"0 0 10px" }}>{secLabel}</h3>
                      <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:8 }}>
                        {items.map((p, pi) => (
                          <div key={pi} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:6, border:`1px solid ${C.border}`, background:"#fafafa", fontSize:12.5 }}>
                            <span style={{ flex:1 }}>{p}</span>
                            <button onClick={() => { const upd = {...phrases, [sec]: items.filter((_,i)=>i!==pi)}; setPhrases(upd); persistPhrases(upd); }} style={{ background:"none", border:"none", cursor:"pointer", color:C.red, padding:0, fontSize:14, lineHeight:1 }}>&times;</button>
                          </div>
                        ))}
                      </div>
                      <div style={{ display:"flex", gap:6 }}>
                        <input id={`new-phrase-${sec}`} style={{...inp, flex:1, fontSize:12.5}} placeholder={`Add ${secLabel.toLowerCase()} phrase...`} onKeyDown={e => {
                          if (e.key === "Enter" && e.target.value.trim()) {
                            const upd = {...phrases, [sec]: [...items, e.target.value.trim()]}; setPhrases(upd); persistPhrases(upd); e.target.value = "";
                          }
                        }} />
                        <button onClick={() => { const el = document.getElementById(`new-phrase-${sec}`); if (el?.value.trim()) { const upd = {...phrases, [sec]: [...items, el.value.trim()]}; setPhrases(upd); persistPhrases(upd); el.value = ""; }}} style={{ padding:"6px 14px", borderRadius:8, border:"none", background:C.tealLight, color:C.white, fontSize:12, fontWeight:600, cursor:"pointer" }}>Add</button>
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => { setPhrases(DEFAULT_PHRASES); persistPhrases(DEFAULT_PHRASES); }} style={{ display:"block", margin:"8px auto 0", padding:"8px 16px", borderRadius:8, border:`1px solid ${C.border}`, background:C.white, color:C.mid, fontSize:12, cursor:"pointer", fontFamily:font }}>
                  Reset to Defaults
                </button>
              </div>
            )}

            {/* ── Custom Fill-in Fields ── */}
            {settingsTab === "fields" && (
              <div>
                <p style={{ fontSize:13, color:C.mid, marginBottom:14 }}>Create custom text input fields that appear in your SOAP notes. Great for vitals, pain scales, onset dates, or any data point you chart regularly.</p>
                {customFieldDefs.map((f, fi) => (
                  <div key={fi} style={{ background:C.white, borderRadius:10, padding:14, marginBottom:12, border:`1px solid ${C.border}` }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                      <input value={f.label} onChange={e => { const upd = [...customFieldDefs]; upd[fi] = {...upd[fi], label:e.target.value}; setCustomFieldDefs(upd); }} style={{...inp, flex:"1 1 180px", fontWeight:600, fontSize:13}} placeholder="Field label (e.g., Pain Scale)" />
                      <input value={f.placeholder || ""} onChange={e => { const upd = [...customFieldDefs]; upd[fi] = {...upd[fi], placeholder:e.target.value}; setCustomFieldDefs(upd); }} style={{...inp, flex:"1 1 180px", fontSize:12, color:C.light}} placeholder="Placeholder text…" />
                      <select value={f.section} onChange={e => { const upd = [...customFieldDefs]; upd[fi] = {...upd[fi], section:e.target.value}; setCustomFieldDefs(upd); }} style={{...inp, width:130, fontSize:12}}>
                        <option value="S">Subjective</option><option value="O">Objective</option><option value="A">Assessment</option><option value="P">Plan</option>
                      </select>
                      <button onClick={() => { const upd = customFieldDefs.filter((_,i)=>i!==fi); setCustomFieldDefs(upd); persistFieldDefs(upd); }} style={{ background:"none", border:"none", cursor:"pointer", color:C.red, padding:4 }}><IcoTrash /></button>
                    </div>
                  </div>
                ))}
                <button onClick={() => { const upd = [...customFieldDefs, { id:`cf-${Date.now()}`, label:"", section:"O", type:"text", placeholder:"" }]; setCustomFieldDefs(upd); persistFieldDefs(upd); }} style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:8, border:`1.5px dashed ${C.tealLight}`, background:C.white, color:C.tealLight, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font, width:"100%", justifyContent:"center" }}>
                  <IcoPlus /> Add New Field
                </button>
                <button onClick={() => { setCustomFieldDefs(DEFAULT_CUSTOM_FIELDS); persistFieldDefs(DEFAULT_CUSTOM_FIELDS); }} style={{ display:"block", margin:"12px auto 0", padding:"8px 16px", borderRadius:8, border:`1px solid ${C.border}`, background:C.white, color:C.mid, fontSize:12, cursor:"pointer", fontFamily:font }}>
                  Reset to Defaults
                </button>
              </div>
            )}

            {/* Save Settings Button */}
            <div style={{ display:"flex", justifyContent:"center", marginTop:20 }}>
              {btn(true, "💾 Save All Settings", async () => {
                await persistGroups(customGroups);
                await persistOrtho(orthoGroups);
                await persistPhrases(phrases);
                await persistFieldDefs(customFieldDefs);
                alert("Settings saved!");
              }, { padding:"12px 32px", fontSize:14, borderRadius:10 })}
            </div>
          </div>
        )}

        {view === "notes" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <h2 style={{ fontSize:18, fontWeight:700, color:C.teal, margin:0 }}>Saved Notes</h2>
              {btn(true, <><IcoPlus /> New Note</>, newNote, { display:"flex", alignItems:"center", gap:6 })}
            </div>
            {savedNotes.length === 0 && (
              <div style={{ textAlign:"center", padding:48, color:C.light, background:C.white, borderRadius:12, border:`1px solid ${C.border}` }}>
                <p style={{ fontSize:36, margin:"0 0 8px" }}>📋</p>
                <p style={{ fontSize:14, fontWeight:500 }}>No saved notes yet</p>
              </div>
            )}
            {[...savedNotes].sort((a,b) => new Date(b.savedAt||b.date) - new Date(a.savedAt||a.date)).map(n => {
              const st = n.status || n.data?.noteStatus || "draft";
              const statusColor = st === "sent" ? "#3b82f6" : st === "finalized" ? "#22c55e" : "#f59e0b";
              const statusLabel = st === "sent" ? "Sent" : st === "finalized" ? "Signed" : "Draft";
              return (
              <div key={n.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", marginBottom:8, borderRadius:10, background:C.white, border:`1px solid ${st === "draft" ? "#fde68a" : C.border}`, cursor:"pointer" }}
                onClick={()=>loadNote(n)}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:statusColor, flexShrink:0 }} title={statusLabel}></span>
                    <strong style={{ fontSize:14, color:C.dark }}>{n.pName||"Unnamed"}</strong>
                    <span style={{ fontSize:12, color:C.light }}>({n.species}) — {n.oName||"No owner"}</span>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:statusColor+"20", color:statusColor, fontWeight:700, fontFamily:font }}>{statusLabel}</span>
                  </div>
                  <div style={{ fontSize:11, color:C.light, marginTop:3, marginLeft:16 }}>
                    {n.date}{n.savedAt ? ` · Saved ${new Date(n.savedAt).toLocaleString()}` : ""}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                  <button onClick={e=>{e.stopPropagation();duplicateNote(n)}} title="Copy as follow-up" style={{ background:"none",border:`1px solid ${C.border}`,cursor:"pointer",color:C.tealLight,padding:"4px 8px",borderRadius:6,fontSize:11,fontWeight:600,fontFamily:font }}>📋 Copy</button>
                  <button onClick={e=>{e.stopPropagation();deleteNote(n.id)}} style={{ background:"none",border:"none",cursor:"pointer",color:C.red,padding:4 }}><IcoTrash /></button>
                </div>
              </div>
              );
            })}
          </div>
        )}


        {/* ── PREVIEW ── */}
        {view === "preview" && (
          <div>
            {/* Draft warning banner */}
            {noteStatus === "draft" && (
              <div className="no-print" style={{ marginBottom:10, padding:"10px 16px", background:"#fef3c7", border:"1px solid #f59e0b", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                <span style={{ fontSize:13, color:"#92400e", fontWeight:600, fontFamily:font }}>⚠ This note is a draft and has not been finalized or signed.</span>
              </div>
            )}
            {noteStatus === "finalized" && (
              <div className="no-print" style={{ marginBottom:10, padding:"10px 16px", background:"#dcfce7", border:"1px solid #22c55e", borderRadius:8, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:13, color:"#166534", fontWeight:600, fontFamily:font }}>✓ Note finalized and signed</span>
              </div>
            )}
            {noteStatus === "sent" && (
              <div className="no-print" style={{ marginBottom:10, padding:"10px 16px", background:"#dbeafe", border:"1px solid #3b82f6", borderRadius:8, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:13, color:"#1e40af", fontWeight:600, fontFamily:font }}>✓ Note finalized, signed, and sent to GHL</span>
              </div>
            )}
            <div style={{ marginBottom:14, display:"flex", gap:8, flexWrap:"wrap" }} className="no-print">
              {btn(false, "← Back to Edit", ()=>{ if(noteStatus !== "draft") { if(confirm("This note has been finalized. Editing will revert it to Draft status. Continue?")) { setNoteStatus("draft"); setView("form"); } } else { setView("form"); } })}
              {btn(true, "💾 Save Note", saveNote)}
              {noteStatus === "draft" && btn(false, "✍ Finalize & Sign", async () => {
                setNoteStatus("finalized");
                const d = getData(); d.noteStatus = "finalized";
                const id = noteId || `n-${Date.now()}`;
                const rec = { id, savedAt:new Date().toISOString(), pName:patient.name, oName:owner.name, species:patient.species, date:noteDate, status:"finalized", data:d };
                let upd; if(noteId){upd=savedNotes.map(n=>n.id===id?rec:n)}else{upd=[rec,...savedNotes];setNoteId(id)}
                setSavedNotes(upd); await persist(upd);

                // Generate PDF
                const previewEl = document.getElementById("soap-printable");
                if (previewEl) {
                  try {
                    setGhlStatus("pushing");
                    const { pdf, filename, blob } = await generateSOAPPdf(previewEl, patient.name, noteDate);

                    // Auto-download the PDF locally
                    pdf.save(filename);

                    // Upload to GHL if configured
                    const contactId = ghlContactId || null;
                    if (isGHLConfigured() && contactId) {
                      try {
                        await uploadPdfToGHL(contactId, blob, filename);
                        // Also push the text note
                        const formatted = formatSOAPNoteForGHL(d, practice);
                        await createContactNote(contactId, formatted);
                        setNoteStatus("sent");
                        const sentUpd = (upd || savedNotes).map(n => n.id === id ? {...n, status:"sent", data:{...n.data, noteStatus:"sent"}} : n);
                        setSavedNotes(sentUpd); await persist(sentUpd);
                        setGhlStatus("success");
                        setTimeout(() => setGhlStatus(""), 3000);
                        alert("Note finalized! PDF saved locally and uploaded to GoHighLevel.");
                      } catch (e) {
                        console.error("GHL upload failed:", e);
                        setGhlStatus("error");
                        setTimeout(() => setGhlStatus(""), 5000);
                        alert("Note finalized and PDF saved locally! GHL upload failed — check console for details.");
                      }
                    } else {
                      setGhlStatus("");
                      alert("Note finalized! PDF downloaded." + (isGHLConfigured() ? " No contact linked — PDF not uploaded to GHL." : ""));
                    }
                  } catch (e) {
                    console.error("PDF generation failed:", e);
                    setGhlStatus("");
                    alert("Note finalized and saved! PDF generation failed — you can still use Print/PDF button.");
                  }
                } else {
                  alert("Note finalized and signed!");
                }
              }, { background:"#22c55e", color:"#fff", border:"none" })}
              {noteStatus !== "draft" && btn(false, "📄 Download PDF", async () => {
                const previewEl = document.getElementById("soap-printable");
                if (previewEl) {
                  try {
                    const { pdf, filename } = await generateSOAPPdf(previewEl, patient.name, noteDate);
                    pdf.save(filename);
                  } catch(e) { console.error("PDF error:", e); alert("PDF generation failed. Try Print/PDF instead."); }
                }
              }, { background:"#3b82f6", color:"#fff", border:"none" })}
              {btn(false, "🖨 Print", ()=>window.print(), { marginLeft:"auto" })}
            </div>
            <div id="soap-printable" style={{ background:C.white, borderRadius:12, boxShadow:"0 4px 20px rgba(0,0,0,.08)", overflow:"hidden" }}>
              <NotePreview data={getData()} customGroups={customGroups} orthoGroups={orthoGroups} customFieldDefs={customFieldDefs} practice={practice} />
            </div>
          </div>
        )}

        {/* ── FORM ── */}
        {view === "form" && (
          <div>
            {/* Date + Template bar */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:10, alignItems:"flex-end", marginBottom:14, padding:12, borderRadius:10, background:C.white, border:`1px solid ${C.border}` }}>
              <Field label="Date"><input type="date" value={noteDate} onChange={e=>setNoteDate(e.target.value)} style={inp} /></Field>
              <Field label="Visit #"><input value={visitNumber} onChange={e=>setVisitNumber(e.target.value)} style={{...inp, width:70}} placeholder="e.g., 3" /></Field>
              <Field label="Apply Template">
                <select onChange={e=>e.target.value&&applyTemplate(e.target.value)} style={inp} defaultValue="">
                  <option value="">Select template…</option>
                  {Object.entries(TEMPLATES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
              <div style={{ flex:1, display:"flex", justifyContent:"flex-end", gap:8 }}>
                {btn(true, "💾 Save", saveNote)}
                {btn(false, "👁 Preview", ()=>setView("preview"))}
              </div>
            </div>

            {/* Patient Directory Quick-Select */}
            {patientDir.length > 0 && (
              <div style={{ marginBottom:14, padding:12, borderRadius:10, background:C.tealBg, border:`1px solid ${C.border}` }}>
                <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.teal, marginBottom:6, fontFamily:font, textTransform:"uppercase", letterSpacing:.8 }}>Returning Patient — Quick Select</label>
                <select onChange={e => { if (e.target.value) { const entry = patientDir.find(p => p.id === e.target.value); if (entry) loadFromDirectory(entry); } e.target.value = ""; }} style={{...inp, background:C.white}} defaultValue="">
                  <option value="">Search saved patients…</option>
                  {patientDir.sort((a,b) => (a.patientName||"").localeCompare(b.patientName||"")).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.patientName} ({p.species}) — Owner: {p.owner?.name || "?"} {p.visitCount ? `· ${p.visitCount} visits` : ""} {p.lastVisit ? `· Last: ${p.lastVisit}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Owner */}
            <div style={{ background:C.white, borderRadius:10, padding:14, marginBottom:12, border:`1px solid ${C.border}` }}>
              <h3 style={{ fontSize:12, fontWeight:700, color:C.mid, marginBottom:10, textTransform:"uppercase", letterSpacing:1 }}>{patient.species === "Human" ? "Patient Information" : "Owner Information"}</h3>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"0 14px" }}>
                <Field label={patient.species === "Human" ? "Patient Name" : "Owner Name"}><input value={owner.name} onChange={e=>setOwner({...owner,name:e.target.value})} style={inp} placeholder="Full name" /></Field>
                <Field label="Patient #"><input value={owner.patientNumber} onChange={e=>setOwner({...owner,patientNumber:e.target.value})} style={inp} placeholder="e.g., 139" /></Field>
                <Field label="Address" wide><input value={owner.address} onChange={e=>setOwner({...owner,address:e.target.value})} style={inp} placeholder="Full address" /></Field>
                <Field label="Phone"><input value={owner.phone} onChange={e=>setOwner({...owner,phone:e.target.value})} style={inp} placeholder="Phone" /></Field>
                <Field label="Email"><input value={owner.email} onChange={e=>setOwner({...owner,email:e.target.value})} style={inp} placeholder="Email" /></Field>
              </div>
              {/* Referring Veterinarian & Barn Location (animal only) */}
              {patient.species !== "Human" && (
                <div style={{ marginTop:10, padding:10, background:C.tealBg, borderRadius:8 }}>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"0 14px" }}>
                    <Field label="Referring Veterinarian">
                      <div style={{ display:"flex", gap:6 }}>
                        <input value={referringVet} onChange={e=>setReferringVet(e.target.value)} style={{...inp, flex:1}} placeholder="e.g., Dr. Pasko — Summit Equine" list="vet-list" />
                        <datalist id="vet-list">{savedVets.map(v=><option key={v} value={v}/>)}</datalist>
                        {referringVet && !savedVets.includes(referringVet) && (
                          <button onClick={()=>{const upd=[...savedVets,referringVet];setSavedVets(upd);persistVets(upd);}} style={{ padding:"6px 10px", borderRadius:6, border:"none", background:C.tealLight, color:C.white, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:font, whiteSpace:"nowrap" }}>+ Save</button>
                        )}
                      </div>
                    </Field>
                    <Field label="Barn / Patient Location" wide>
                      <div style={{ display:"flex", gap:6 }}>
                        <input value={barnLocation} onChange={e=>setBarnLocation(e.target.value)} style={{...inp, flex:1}} placeholder="e.g., Oakwood Stables — 1234 Farm Rd, Apex, NC" list="barn-list" />
                        <datalist id="barn-list">{barnDir.map(b=><option key={b.id} value={`${b.name}${b.address ? ' — '+b.address : ''}`}/>)}</datalist>
                        {barnLocation && !barnDir.some(b => `${b.name}${b.address ? ' — '+b.address : ''}` === barnLocation) && (
                          <button onClick={()=>{const parts=barnLocation.split(' — ');const upd=[...barnDir,{id:`bn-${Date.now()}`,name:parts[0]||barnLocation,address:parts[1]||"",contact:"",phone:"",notes:""}];setBarnDir(upd);persistBarnDir(upd);}} style={{ padding:"6px 10px", borderRadius:6, border:"none", background:C.tealLight, color:C.white, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:font, whiteSpace:"nowrap" }}>+ Save</button>
                        )}
                      </div>
                    </Field>
                  </div>
                  {savedVets.length > 0 && (
                    <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:4 }}>
                      {savedVets.map(v=>(
                        <span key={v} onClick={()=>setReferringVet(v)} style={{ fontSize:11, padding:"3px 10px", borderRadius:6, border:`1px solid ${referringVet===v?C.tealLight:C.border}`, background:referringVet===v?C.tealBg:C.white, cursor:"pointer", fontFamily:font, color:C.dark }}>{v}
                          <button onClick={e=>{e.stopPropagation();const upd=savedVets.filter(x=>x!==v);setSavedVets(upd);persistVets(upd);}} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:12,marginLeft:4,padding:0 }}>&times;</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {barnDir.length > 0 && (
                    <div style={{ marginTop:6, display:"flex", flexWrap:"wrap", gap:4 }}>
                      <span style={{ fontSize:10, color:C.light, alignSelf:"center", marginRight:4 }}>Barns:</span>
                      {barnDir.map(b=>{
                        const val = `${b.name}${b.address ? ' — '+b.address : ''}`;
                        return (
                          <span key={b.id} onClick={()=>setBarnLocation(val)} style={{ fontSize:11, padding:"3px 10px", borderRadius:6, border:`1px solid ${barnLocation===val?C.tealLight:C.border}`, background:barnLocation===val?C.tealBg:C.white, cursor:"pointer", fontFamily:font, color:C.dark }}>{b.name}
                            <button onClick={e=>{e.stopPropagation();const upd=barnDir.filter(x=>x.id!==b.id);setBarnDir(upd);persistBarnDir(upd);}} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:12,marginLeft:4,padding:0 }}>&times;</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ═══ SUBJECTIVE ═══ */}
            <div style={{ marginBottom:12 }}>
              <SectionHead title="Subjective" num="S" open={sections.S} toggle={()=>toggleSec("S")} />
              {sections.S && (
                <div style={{ background:C.white, borderRadius:"0 0 10px 10px", padding:14, border:`1px solid ${C.border}`, borderTop:"none" }}>
                  <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, marginBottom:8 }}>{patient.species === "Human" ? "Patient Demographics" : "Signalment"}</h4>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"0 14px" }}>
                    <Field label={patient.species === "Human" ? "Patient Name" : "Animal Name"}><input value={patient.name} onChange={e=>setPatient({...patient,name:e.target.value})} style={inp} /></Field>
                    <Field label="Species">
                      <select value={patient.species} onChange={e=>setPatient({...patient,species:e.target.value,sex:""})} style={inp}>
                        {SPECIES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label="Age / DOB"><input value={patient.age} onChange={e=>setPatient({...patient,age:e.target.value})} style={inp} placeholder="e.g., 6/14/16" /></Field>
                    <Field label={patient.species === "Human" ? "Occupation" : "Breed"}><input value={patient.breed} onChange={e=>setPatient({...patient,breed:e.target.value})} style={inp} /></Field>
                    <Field label="Sex">
                      <select value={patient.sex} onChange={e=>setPatient({...patient,sex:e.target.value})} style={inp}>
                        <option value="">Select…</option>
                        {(SEX_MAP[patient.species]||SEX_MAP.Other).map(s=><option key={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label={patient.species === "Human" ? "Insurance" : "Color"}><input value={patient.color} onChange={e=>setPatient({...patient,color:e.target.value})} style={inp} /></Field>
                    <Field label={patient.species === "Human" ? "Height/Weight" : "Approx. Weight"}><input value={patient.weight} onChange={e=>setPatient({...patient,weight:e.target.value})} style={inp} placeholder={patient.species === "Human" ? "e.g., 5'10 / 180 lbs" : "e.g., 925#"} /></Field>
                  </div>
                  {/* Human Vitals — Initial Intake */}
                  {patient.species === "Human" && (
                    <div style={{ marginTop:8, padding:12, background:C.tealBg, borderRadius:8, border:`1px solid ${C.border}` }}>
                      <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"0 0 8px" }}>Vitals</h4>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"0 14px" }}>
                        <Field label="Blood Pressure"><input value={vitals.bp} onChange={e=>setVitals({...vitals,bp:e.target.value})} style={inp} placeholder="e.g., 120/80" /></Field>
                        <Field label="Heart Rate"><input value={vitals.hr} onChange={e=>setVitals({...vitals,hr:e.target.value})} style={inp} placeholder="e.g., 72 bpm" /></Field>
                        <Field label="Temperature"><input value={vitals.temp} onChange={e=>setVitals({...vitals,temp:e.target.value})} style={inp} placeholder="e.g., 98.6°F" /></Field>
                        <Field label="Respiration"><input value={vitals.resp} onChange={e=>setVitals({...vitals,resp:e.target.value})} style={inp} placeholder="e.g., 16 br/min" /></Field>
                      </div>
                    </div>
                  )}
                  <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"14px 0 8px" }}>Chief Complaint</h4>
                  <Field label="Intake" wide><TextAreaWithPhrases value={intake} onChange={e=>setIntake(e.target.value)} placeholder="Primary reason for visit…" style={ta} phrases={phrases} section="S" activePhraseField={activePhraseField} setActivePhraseField={setActivePhraseField} fieldId="intake" /></Field>
                  <Field label="History" wide><TextAreaWithPhrases value={history} onChange={e=>setHistory(e.target.value)} placeholder="Relevant medical history…" style={ta} phrases={phrases} section="S" activePhraseField={activePhraseField} setActivePhraseField={setActivePhraseField} fieldId="history" /></Field>
                  <Field label="Current Medications & Supplements" wide><textarea value={meds} onChange={e=>setMeds(e.target.value)} style={{...ta,minHeight:50}} placeholder="List all current meds…" /></Field>
                  <Field label="Activity Levels & Goals" wide><textarea value={activity} onChange={e=>setActivity(e.target.value)} style={{...ta,minHeight:50}} placeholder="Current activity & goals…" /></Field>
                  <Field label="Additional Owner Concerns" wide><TextAreaWithPhrases value={concerns} onChange={e=>setConcerns(e.target.value)} placeholder="Additional concerns…" style={ta} phrases={phrases} section="S" activePhraseField={activePhraseField} setActivePhraseField={setActivePhraseField} fieldId="concerns" /></Field>
                  <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"14px 0 8px" }}>Symptoms Noted</h4>
                  <Chips options={patient.species === "Human" ? HUMAN_SYMPTOMS : SYMPTOMS} selected={symptoms} onChange={toggleSymp} />
                  {symptoms.length > 0 && <div style={{ marginTop:8 }}>
                    {symptoms.map(s => (
                      <div key={s} style={{ marginBottom:6 }}>
                        <label style={{ fontSize:11, fontWeight:600, color:C.mid }}>{s}:</label>
                        <input value={symptomDescs[s]||""} onChange={e=>setSymptomDescs({...symptomDescs,[s]:e.target.value})} style={{...inp,marginTop:3}} placeholder={`Describe ${s.toLowerCase()}…`} />
                      </div>
                    ))}
                  </div>}
                  {/* Custom checkbox groups for Subjective */}
                  {customGroups.filter(g => g.section === "S" && g.items.length > 0).map((g, gi) => (
                    <div key={`cg-s-${gi}`} style={{ marginTop:12 }}>
                      <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"10px 0 8px" }}>{g.name}</h4>
                      <Chips options={g.items} selected={customChecks[g.name] || []} onChange={item => setCustomChecks(prev => {
                        const cur = prev[g.name] || [];
                        return {...prev, [g.name]: cur.includes(item) ? cur.filter(x=>x!==item) : [...cur, item]};
                      })} />
                    </div>
                  ))}
                  {/* Custom fill-in fields for Subjective */}
                  {customFieldDefs.filter(f => f.section === "S").length > 0 && (
                    <div style={{ marginTop:12 }}>
                      <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"10px 0 8px" }}>Additional Fields</h4>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"0 14px" }}>
                        {customFieldDefs.filter(f => f.section === "S").map(f => (
                          <Field key={f.id} label={f.label}><input value={customFieldValues[f.id] || ""} onChange={e => setCustomFieldValues(p => ({...p, [f.id]: e.target.value}))} style={inp} placeholder={f.placeholder || ""} /></Field>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ═══ OBJECTIVE ═══ */}
            <div style={{ marginBottom:12 }}>
              <SectionHead title="Objective" num="O" open={sections.O} toggle={()=>toggleSec("O")} />
              {sections.O && (
                <div style={{ background:C.white, borderRadius:"0 0 10px 10px", padding:14, border:`1px solid ${C.border}`, borderTop:"none" }}>
                  <Field label="Practitioner Observations" wide>
                    <TextAreaWithPhrases value={observations} onChange={e=>setObservations(e.target.value)} placeholder="Behavior, static/motion palpation, gait analysis, ROM…" style={{...ta,minHeight:110}} phrases={phrases} section="O" activePhraseField={activePhraseField} setActivePhraseField={setActivePhraseField} fieldId="observations" />
                  </Field>

                  {/* Body Charts */}
                  {(patient.species === "Human" || patient.species === "Equine" || patient.species === "Canine" || patient.species === "Feline" || patient.species === "Swine" || patient.species === "Avian" || patient.species === "Caprine") ? (
                    <>
                      <BodyChart imgSrc={patient.species === "Human" ? HU_CHART_SRC : patient.species === "Equine" ? EQ_LATERAL_SRC : patient.species === "Feline" ? FE_LATERAL_SRC : patient.species === "Swine" ? SW_LATERAL_SRC : patient.species === "Avian" ? AV_LATERAL_SRC : patient.species === "Caprine" ? CP_LATERAL_SRC : K9_LATERAL_SRC} imgW={700} imgH={542} markers={markers} onAdd={addMarker} onRemove={removeMarker} onUpdate={updateMarker} interactive viewKey="lateral" label={patient.species === "Human" ? "Body Chart — Posterior / Lateral Spine / Anterior" : `${patient.species} Lateral Body Chart`} species={patient.species} />
                      {(patient.species === "Equine" || patient.species === "Canine" || patient.species === "Feline") && patient.species !== "Human" && <BodyChart imgSrc={patient.species === "Equine" ? EQ_DORSAL_SRC : K9_DORSAL_SRC} imgW={350} imgH={857} markers={markers} onAdd={addMarker} onRemove={removeMarker} onUpdate={updateMarker} interactive viewKey="dorsal" label={`${patient.species} Dorsal Body Chart`} species={patient.species} />}
                    </>
                  ) : (
                    <>
                      <h4 style={{ fontSize:13, fontWeight:700, color:C.teal, margin:"16px 0 8px" }}>{patient.species} Lateral Body Chart</h4>
                      <div style={{ border:`1.5px solid ${C.border}`, borderRadius:10, overflow:"hidden", position:"relative", cursor:"crosshair" }}
                        onClick={e => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          addMarker({ xPct:((e.clientX-rect.left)/rect.width)*100, yPct:((e.clientY-rect.top)/rect.height)*100, view:"lateral", segment:"", description:"", direction:"" });
                        }}>
                        <CanineLateralSVG />
                        {markers.filter(m=>m.view==="lateral").map((m,i) => (
                          <div key={i} style={{ position:"absolute", left:`${m.xPct}%`, top:`${m.yPct}%`, transform:"translate(-50%,-50%)", width:26, height:26, borderRadius:"50%", background:C.tealLight, color:C.white, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, boxShadow:"0 2px 6px rgba(0,0,0,.3)", fontFamily:font, zIndex:10 }}>{i+1}</div>
                        ))}
                        <div style={{ position:"absolute", bottom:8, left:"50%", transform:"translateX(-50%)", background:"rgba(0,0,0,.55)", color:"#fff", padding:"4px 14px", borderRadius:20, fontSize:11, fontFamily:font, pointerEvents:"none" }}>Tap/click to place a marker</div>
                      </div>
                      {/* Lateral marker panel for canine */}
                      <div style={{ marginTop:10 }}>
                        {markers.filter(m=>m.view==="lateral").length === 0 && <p style={{ color:C.light, fontSize:12.5, fontStyle:"italic" }}>No markers yet.</p>}
                        {markers.filter(m=>m.view==="lateral").map((m,localIdx) => {
                          const gi = markers.indexOf(m);
                          return (
                            <div key={localIdx} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:8, padding:10, borderRadius:8, border:`1px solid ${C.border}`, background:"#fafafa" }}>
                              <div style={{ background:C.tealLight, color:C.white, borderRadius:"50%", minWidth:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, marginTop:2 }}>{localIdx+1}</div>
                              <div style={{ flex:1 }}>
                                <input placeholder="e.g., T6 PR" value={m.segment||""} onChange={e=>updateMarker(gi,"segment",e.target.value)} style={{...inp,marginBottom:5,fontSize:12.5}} />
                                <select value={m.direction||""} onChange={e=>{updateMarker(gi,"direction",e.target.value);if(!m.segment&&e.target.value)updateMarker(gi,"segment",e.target.value)}} style={{...inp,marginBottom:5,fontSize:11.5,color:C.light,padding:"5px 10px"}}>
                                  <option value="">Quick-fill…</option>
                                  {LISTING_DIR.map(d=><option key={d} value={d}>{d}</option>)}
                                </select>
                                <textarea placeholder="Findings…" value={m.description||""} onChange={e=>updateMarker(gi,"description",e.target.value)} style={{...ta,minHeight:50,fontSize:12.5}} />
                              </div>
                              <button onClick={()=>removeMarker(gi)} style={{ background:"none",border:"none",cursor:"pointer",color:C.red,padding:4,marginTop:2 }}><IcoTrash /></button>
                            </div>
                          );
                        })}
                      </div>

                      <h4 style={{ fontSize:13, fontWeight:700, color:C.teal, margin:"18px 0 8px" }}>Dorsal Body Chart</h4>
                      <div style={{ border:`1.5px solid ${C.border}`, borderRadius:10, overflow:"hidden", position:"relative", cursor:"crosshair", display:"flex", justifyContent:"center" }}
                        onClick={e => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          addMarker({ xPct:((e.clientX-rect.left)/rect.width)*100, yPct:((e.clientY-rect.top)/rect.height)*100, view:"dorsal", segment:"", description:"", direction:"" });
                        }}>
                        <CanineDorsalSVG />
                        {markers.filter(m=>m.view==="dorsal").map((m,i) => (
                          <div key={i} style={{ position:"absolute", left:`${m.xPct}%`, top:`${m.yPct}%`, transform:"translate(-50%,-50%)", width:26, height:26, borderRadius:"50%", background:C.tealLight, color:C.white, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, boxShadow:"0 2px 6px rgba(0,0,0,.3)", fontFamily:font, zIndex:10 }}>{i+1}</div>
                        ))}
                      </div>
                      <div style={{ marginTop:10 }}>
                        {markers.filter(m=>m.view==="dorsal").length === 0 && <p style={{ color:C.light, fontSize:12.5, fontStyle:"italic" }}>No markers yet.</p>}
                        {markers.filter(m=>m.view==="dorsal").map((m,localIdx) => {
                          const gi = markers.indexOf(m);
                          return (
                            <div key={localIdx} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:8, padding:10, borderRadius:8, border:`1px solid ${C.border}`, background:"#fafafa" }}>
                              <div style={{ background:C.tealLight, color:C.white, borderRadius:"50%", minWidth:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, marginTop:2 }}>{localIdx+1}</div>
                              <div style={{ flex:1 }}>
                                <input placeholder="e.g., APL - Atlas Posterior Left" value={m.segment||""} onChange={e=>updateMarker(gi,"segment",e.target.value)} style={{...inp,marginBottom:5,fontSize:12.5}} />
                                <select value={m.direction||""} onChange={e=>{updateMarker(gi,"direction",e.target.value);if(!m.segment&&e.target.value)updateMarker(gi,"segment",e.target.value)}} style={{...inp,marginBottom:5,fontSize:11.5,color:C.light,padding:"5px 10px"}}>
                                  <option value="">Quick-fill…</option>
                                  {LISTING_DIR.map(d=><option key={d} value={d}>{d}</option>)}
                                </select>
                                <textarea placeholder="Findings…" value={m.description||""} onChange={e=>updateMarker(gi,"description",e.target.value)} style={{...ta,minHeight:50,fontSize:12.5}} />
                              </div>
                              <button onClick={()=>removeMarker(gi)} style={{ background:"none",border:"none",cursor:"pointer",color:C.red,padding:4,marginTop:2 }}><IcoTrash /></button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"18px 0 8px" }}>Symptoms/Reactions Noted Today</h4>
                  <Chips options={patient.species === "Human" ? HUMAN_REACTIONS : REACTIONS} selected={reactions} onChange={r=>setReactions(p=>p.includes(r)?p.filter(x=>x!==r):[...p,r])} />
                  {/* Custom checkbox groups for Objective */}
                  {customGroups.filter(g => g.section === "O" && g.items.length > 0).map((g, gi) => (
                    <div key={`cg-o-${gi}`} style={{ marginTop:12 }}>
                      <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"10px 0 8px" }}>{g.name}</h4>
                      <Chips options={g.items} selected={customChecks[g.name] || []} onChange={item => setCustomChecks(prev => {
                        const cur = prev[g.name] || [];
                        return {...prev, [g.name]: cur.includes(item) ? cur.filter(x=>x!==item) : [...cur, item]};
                      })} />
                    </div>
                  ))}

                  {/* Orthopedic Exams (Human only) */}
                  {patient.species === "Human" && orthoGroups.length > 0 && (
                    <div style={{ marginTop:16 }}>
                      <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"10px 0 8px" }}>Orthopedic / Neurological Examination</h4>
                      {orthoGroups.map(g => {
                        const hasResults = g.tests.some(t => orthoResults[`${g.id}::${t}`]);
                        return (
                          <div key={g.id} style={{ marginBottom:8, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
                            <button onClick={() => toggleOrthoGroup(g.id)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", background: hasResults ? C.tealBg : "#fafafa", border:"none", cursor:"pointer", fontFamily:font, fontSize:12.5, fontWeight:600, color:C.dark }}>
                              <span>{g.name} {hasResults && <span style={{ fontSize:10, color:C.tealLight, marginLeft:6 }}>({g.tests.filter(t => orthoResults[`${g.id}::${t}`]).length} tested)</span>}</span>
                              {orthoExpanded[g.id] ? <IcoChevUp /> : <IcoChevDown />}
                            </button>
                            {orthoExpanded[g.id] && (
                              <div style={{ padding:"4px 12px 10px" }}>
                                {g.tests.map(t => {
                                  const key = `${g.id}::${t}`;
                                  return <OrthoTestRow key={key} test={t} result={orthoResults[key] || ""} note={orthoNotes[key] || ""} onResult={v => setOrthoResult(key, v)} onNote={v => setOrthoNote(key, v)} />;
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Custom fill-in fields for Objective */}
                  {customFieldDefs.filter(f => f.section === "O").length > 0 && (
                    <div style={{ marginTop:12 }}>
                      <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"10px 0 8px" }}>Additional Fields</h4>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"0 14px" }}>
                        {customFieldDefs.filter(f => f.section === "O").map(f => (
                          <Field key={f.id} label={f.label}><input value={customFieldValues[f.id] || ""} onChange={e => setCustomFieldValues(p => ({...p, [f.id]: e.target.value}))} style={inp} placeholder={f.placeholder || ""} /></Field>
                        ))}
                      </div>
                    </div>
                  )}

</div>
              )}
            </div>

            {/* ═══ ASSESSMENT ═══ */}
            <div style={{ marginBottom:12 }}>
              <SectionHead title="Assessment" num="A" open={sections.A} toggle={()=>toggleSec("A")} />
              {sections.A && (
                <div style={{ background:C.white, borderRadius:"0 0 10px 10px", padding:14, border:`1px solid ${C.border}`, borderTop:"none" }}>
                  <Field label="Assessment" wide><TextAreaWithPhrases value={assessText} onChange={e=>setAssessText(e.target.value)} placeholder="Overall assessment, prognosis…" style={{...ta,minHeight:130}} phrases={phrases} section="A" activePhraseField={activePhraseField} setActivePhraseField={setActivePhraseField} fieldId="assessment" /></Field>
                  <Field label="Adjustment Notes" wide><TextAreaWithPhrases value={adjNotes} onChange={e=>setAdjNotes(e.target.value)} placeholder="How adjustments were received, post-adjustment ROM…" style={{...ta,minHeight:55}} phrases={phrases} section="A" activePhraseField={activePhraseField} setActivePhraseField={setActivePhraseField} fieldId="adjNotes" /></Field>
                  <Field label="Soft Tissue Work" wide><textarea value={softTissue} onChange={e=>setSoftTissue(e.target.value)} style={{...ta,minHeight:55}} placeholder="IASTM, myofascial release, massage…" /></Field>
                  <Field label="Patient is Responding" wide><Chips options={PT_RESPONDING} selected={responding} onChange={setResponding} radio /></Field>
                  {/* Custom checkbox groups for Assessment */}
                  {customGroups.filter(g => g.section === "A" && g.items.length > 0).map((g, gi) => (
                    <div key={`cg-a-${gi}`} style={{ marginTop:12 }}>
                      <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"10px 0 8px" }}>{g.name}</h4>
                      <Chips options={g.items} selected={customChecks[g.name] || []} onChange={item => setCustomChecks(prev => {
                        const cur = prev[g.name] || [];
                        return {...prev, [g.name]: cur.includes(item) ? cur.filter(x=>x!==item) : [...cur, item]};
                      })} />
                    </div>
                  ))}
                  {/* Custom fill-in fields for Assessment */}
                  {customFieldDefs.filter(f => f.section === "A").length > 0 && (
                    <div style={{ marginTop:12 }}>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"0 14px" }}>
                        {customFieldDefs.filter(f => f.section === "A").map(f => (
                          <Field key={f.id} label={f.label}><input value={customFieldValues[f.id] || ""} onChange={e => setCustomFieldValues(p => ({...p, [f.id]: e.target.value}))} style={inp} placeholder={f.placeholder || ""} /></Field>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ═══ PLAN ═══ */}
            <div style={{ marginBottom:12 }}>
              <SectionHead title="Plan" num="P" open={sections.P} toggle={()=>toggleSec("P")} />
              {sections.P && (
                <div style={{ background:C.white, borderRadius:"0 0 10px 10px", padding:14, border:`1px solid ${C.border}`, borderTop:"none" }}>
                  <Field label="Treatment" wide><TextAreaWithPhrases value={planTx} onChange={e=>setPlanTx(e.target.value)} placeholder="Treatment, home care, follow-up…" style={{...ta,minHeight:110}} phrases={phrases} section="P" activePhraseField={activePhraseField} setActivePhraseField={setActivePhraseField} fieldId="planTx" /></Field>
                  <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"10px 0 8px" }}>Response to Care</h4>
                  <Chips options={patient.species === "Human" ? HUMAN_RESPONSE_CARE : RESPONSE_CARE} selected={respCare} onChange={r=>setRespCare(p=>p.includes(r)?p.filter(x=>x!==r):[...p,r])} />
                  <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"14px 0 8px" }}>Post Treatment Care</h4>
                  <Chips options={patient.species === "Human" ? HUMAN_POST_TX : POST_TX} selected={postTx} onChange={r=>setPostTx(p=>p.includes(r)?p.filter(x=>x!==r):[...p,r])} />
                  <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"14px 0 8px" }}>Next Appointment</h4>
                  <Chips options={NEXT_APPT} selected={nextAppt} onChange={setNextAppt} radio />
                  <Field label={patient.species === "Human" ? "Additional Notes" : "Additional Notes (e.g., Veterinarian info)"} wide>
                    <TextAreaWithPhrases value={planNotes} onChange={e=>setPlanNotes(e.target.value)} placeholder={patient.species === "Human" ? "Additional notes, referrals, follow-up instructions…" : "e.g., Veterinarian — Summit Equine. Dr. Pasko"} style={{...ta,minHeight:55,marginTop:10}} phrases={phrases} section="P" activePhraseField={activePhraseField} setActivePhraseField={setActivePhraseField} fieldId="planNotes" />
                  </Field>
                  {/* Custom checkbox groups for Plan */}
                  {customGroups.filter(g => g.section === "P" && g.items.length > 0).map((g, gi) => (
                    <div key={`cg-p-${gi}`} style={{ marginTop:12 }}>
                      <h4 style={{ fontSize:12, fontWeight:700, color:C.teal, margin:"10px 0 8px" }}>{g.name}</h4>
                      <Chips options={g.items} selected={customChecks[g.name] || []} onChange={item => setCustomChecks(prev => {
                        const cur = prev[g.name] || [];
                        return {...prev, [g.name]: cur.includes(item) ? cur.filter(x=>x!==item) : [...cur, item]};
                      })} />
                    </div>
                  ))}
                  {/* Custom fill-in fields for Plan */}
                  {customFieldDefs.filter(f => f.section === "P").length > 0 && (
                    <div style={{ marginTop:12 }}>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"0 14px" }}>
                        {customFieldDefs.filter(f => f.section === "P").map(f => (
                          <Field key={f.id} label={f.label}><input value={customFieldValues[f.id] || ""} onChange={e => setCustomFieldValues(p => ({...p, [f.id]: e.target.value}))} style={inp} placeholder={f.placeholder || ""} /></Field>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Consent / Disclaimer */}
            <div style={{ background:C.white, borderRadius:10, padding:14, marginBottom:12, border:`1px solid ${C.border}` }}>
              <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", userSelect:"none" }}>
                <input type="checkbox" checked={consentChecked} onChange={e=>setConsentChecked(e.target.checked)} style={{ accentColor:C.tealLight, marginTop:3, minWidth:18, minHeight:18 }} />
                <span style={{ fontSize:13, color:C.dark, fontFamily:font, lineHeight:1.5 }}>
                  {patient.species === "Human"
                    ? "Patient has been informed of the risks and benefits of chiropractic care and has consented to treatment. Informed consent on file."
                    : "Owner has been informed of the risks and benefits of animal chiropractic care, consents to treatment, and confirms a current veterinary referral is on file."}
                </span>
              </label>
            </div>

            {/* Bottom actions */}
            <div style={{ display:"flex", gap:10, justifyContent:"center", padding:14 }}>
              {btn(true, "💾 Save Note", saveNote, { padding:"12px 32px", fontSize:15, borderRadius:10 })}
              {btn(false, "👁 Preview & Finalize", ()=>setView("preview"), { padding:"12px 32px", fontSize:15, borderRadius:10 })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
