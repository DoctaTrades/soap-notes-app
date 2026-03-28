// ================================================================
// GoHighLevel API Service Layer
// ================================================================
// Handles all communication with GHL's API.
// When GHL is not configured, falls back to localStorage.
//
// Required GHL setup:
//   1. Private Integration Token (Settings → Integrations → Private Integrations)
//   2. Location ID (sub-account ID)
//   3. Custom Objects created: "Patients", "SOAP Notes", "Barns"
//   4. Associations set up: Patient → Contact, SOAP Note → Patient, Barn → Patient
//
// The app detects GHL context by checking:
//   - URL params (contactId passed from GHL iframe)
//   - Stored GHL config (token + locationId in localStorage)
// ================================================================

const GHL_BASE = "https://services.leadconnectorhq.com";

// ── Config Management ──

export function getGHLConfig() {
  try {
    const raw = localStorage.getItem("ghl-config");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

export function saveGHLConfig(config) {
  localStorage.setItem("ghl-config", JSON.stringify(config));
}

export function isGHLConfigured() {
  const config = getGHLConfig();
  return !!(config?.token && config?.locationId);
}

// ── URL Param Detection (for iframe context) ──

export function getContactIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("contactId") || params.get("contact_id") || null;
}

// ── Core API Caller ──

async function ghlFetch(endpoint, options = {}) {
  const config = getGHLConfig();
  if (!config?.token) throw new Error("GHL not configured");

  const url = `${GHL_BASE}${endpoint}`;
  const headers = {
    "Authorization": `Bearer ${config.token}`,
    "Content-Type": "application/json",
    "Version": "2021-07-28",
  };

  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GHL API ${res.status}: ${body}`);
  }

  return res.json();
}

// ── Contact Operations ──

export async function getContact(contactId) {
  const data = await ghlFetch(`/contacts/${contactId}`);
  return data.contact || data;
}

export async function searchContacts(query, locationId) {
  const config = getGHLConfig();
  const locId = locationId || config?.locationId;
  const data = await ghlFetch(`/contacts/search`, {
    method: "POST",
    body: JSON.stringify({
      locationId: locId,
      query: query,
      limit: 20,
    }),
  });
  return data.contacts || [];
}

// ── Notes Operations ──

export async function getContactNotes(contactId) {
  const data = await ghlFetch(`/contacts/${contactId}/notes`);
  return data.notes || [];
}

export async function createContactNote(contactId, body) {
  return ghlFetch(`/contacts/${contactId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function updateContactNote(contactId, noteId, body) {
  return ghlFetch(`/contacts/${contactId}/notes/${noteId}`, {
    method: "PUT",
    body: JSON.stringify({ body }),
  });
}

// ── PDF Generation & Upload ──

export async function generateSOAPPdf(previewElement, patientName, noteDate) {
  // Dynamically import the libraries
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  // Render the preview element to canvas
  const canvas = await html2canvas(previewElement, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  // Calculate PDF dimensions (Letter size: 8.5 x 11 inches)
  const pageWidth = 8.5;
  const pageHeight = 11;
  const pdf = new jsPDF("p", "in", "letter");

  const imgWidth = pageWidth - 1; // 0.5in margins
  const imgHeight = (canvas.height / canvas.width) * imgWidth;

  // If the content is taller than one page, split across multiple pages
  const maxContentHeight = pageHeight - 1; // 0.5in top + bottom margins
  let yOffset = 0;
  let page = 0;

  while (yOffset < imgHeight) {
    if (page > 0) pdf.addPage();

    // Calculate the portion of the canvas for this page
    const sourceY = (yOffset / imgHeight) * canvas.height;
    const sourceHeight = Math.min(
      (maxContentHeight / imgHeight) * canvas.height,
      canvas.height - sourceY
    );
    const destHeight = (sourceHeight / canvas.height) * imgHeight;

    // Create a temp canvas for this page slice
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sourceHeight;
    const ctx = pageCanvas.getContext("2d");
    ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);

    const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(pageImgData, "JPEG", 0.5, 0.5, imgWidth, destHeight);

    yOffset += maxContentHeight;
    page++;
  }

  // Generate filename
  const safeName = (patientName || "note").replace(/[^a-zA-Z0-9]/g, "_");
  const safeDate = (noteDate || new Date().toISOString().split("T")[0]).replace(/-/g, "");
  const filename = `SOAP_${safeName}_${safeDate}.pdf`;

  return { pdf, filename, blob: pdf.output("blob") };
}

export async function uploadPdfToGHL(contactId, pdfBlob, filename) {
  const config = getGHLConfig();
  if (!config?.token || !config?.locationId) throw new Error("GHL not configured");

  // Upload file as attachment to contact via conversations endpoint
  // This places the file in the contact's documents/attachments section
  const formData = new FormData();
  formData.append("fileAttachment", pdfBlob, filename);
  formData.append("contactId", contactId);

  const uploadRes = await fetch(`${GHL_BASE}/conversations/messages/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.token}`,
      "Version": "2021-07-28",
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => "");
    console.error("Conversations upload response:", errText);
    throw new Error(`File upload failed ${uploadRes.status}: ${errText}`);
  }

  const uploadData = await uploadRes.json();
  
  // Response format: { uploadedFiles: { "filename.pdf": "https://url..." } }
  let fileUrl = "";
  if (uploadData.uploadedFiles) {
    const urls = Object.values(uploadData.uploadedFiles);
    fileUrl = urls[0] || "";
  } else {
    fileUrl = uploadData.urls?.[0] || uploadData.url || uploadData.data?.url || "";
  }

  // Add a note with the document link
  if (fileUrl) {
    await createContactNote(contactId, `📎 SOAP Note: ${filename}\n\nDocument: ${fileUrl}`);
  } else {
    await createContactNote(contactId, `📎 SOAP Note attached: ${filename}`);
  }

  return { fileUrl, filename, data: uploadData };
}

// ── Custom Object Operations ──
// These use the Objects API for Patients, SOAP Notes, and Barns

export async function getObjectSchema(locationId) {
  // Get all object schemas for this location
  const config = getGHLConfig();
  const locId = locationId || config?.locationId;
  const data = await ghlFetch(`/objects?locationId=${locId}`);
  return data.objects || data;
}

export async function getObjectRecords(schemaId, locationId, filters = {}) {
  const config = getGHLConfig();
  const locId = locationId || config?.locationId;
  let endpoint = `/objects/${schemaId}/records?locationId=${locId}`;
  if (filters.contactId) endpoint += `&contactId=${filters.contactId}`;
  if (filters.limit) endpoint += `&limit=${filters.limit}`;
  const data = await ghlFetch(endpoint);
  return data.records || data;
}

export async function createObjectRecord(schemaId, locationId, fields, associations = []) {
  const config = getGHLConfig();
  const locId = locationId || config?.locationId;
  return ghlFetch(`/objects/${schemaId}/records`, {
    method: "POST",
    body: JSON.stringify({
      locationId: locId,
      properties: fields,
      associations,
    }),
  });
}

export async function updateObjectRecord(schemaId, recordId, fields) {
  return ghlFetch(`/objects/${schemaId}/records/${recordId}`, {
    method: "PUT",
    body: JSON.stringify({ properties: fields }),
  });
}

// ── Formatted Note Builder ──
// Converts SOAP note data into rich text for GHL's Notes API

export function formatSOAPNoteForGHL(data, practice) {
  const { date, owner, patient, subj, obj, markers, assess, plan,
    referringVet, visitNumber, barnLocation, consentChecked, vitals } = data;

  const lines = [];

  // Header
  lines.push(`━━━ ${practice.name} — SOAP Note ━━━`);
  lines.push(`Date: ${date}${visitNumber ? ` | Visit #${visitNumber}` : ""}`);
  lines.push(`Patient: ${patient.name || "—"} | Species: ${patient.species} | Breed: ${patient.breed || "—"}`);
  lines.push(`Age: ${patient.age || "—"} | Sex: ${patient.sex || "—"} | Weight: ${patient.weight || "—"}`);
  if (patient.species !== "Human") {
    lines.push(`Owner: ${owner.name || "—"} | Tel: ${owner.phone || "—"}`);
    if (barnLocation) lines.push(`Location: ${barnLocation}`);
    if (referringVet) lines.push(`Referring Vet: ${referringVet}`);
  }
  lines.push("");

  // Subjective
  lines.push("━━ SUBJECTIVE ━━");
  if (subj.intake) lines.push(`Intake: ${subj.intake}`);
  if (subj.history) lines.push(`History: ${subj.history}`);
  if (subj.meds) lines.push(`Medications: ${subj.meds}`);
  if (subj.activity) lines.push(`Activity/Goals: ${subj.activity}`);
  if (subj.concerns) lines.push(`Concerns: ${subj.concerns}`);
  if (subj.symptoms?.length > 0) {
    lines.push("Symptoms: " + subj.symptoms.map(s => s.name + (s.desc ? ` — ${s.desc}` : "")).join("; "));
  }
  if (patient.species === "Human" && vitals) {
    const vParts = [];
    if (vitals.bp) vParts.push(`BP: ${vitals.bp}`);
    if (vitals.hr) vParts.push(`HR: ${vitals.hr}`);
    if (vitals.temp) vParts.push(`Temp: ${vitals.temp}`);
    if (vitals.resp) vParts.push(`Resp: ${vitals.resp}`);
    if (vParts.length) lines.push(`Vitals: ${vParts.join(" | ")}`);
  }
  lines.push("");

  // Objective
  lines.push("━━ OBJECTIVE ━━");
  if (obj.observations) lines.push(obj.observations);
  if (markers?.length > 0) {
    const findings = markers
      .filter(m => m.segment)
      .map((m, i) => `${i + 1}. ${m.segment}${m.direction ? ` (${m.direction})` : ""}${m.description ? ` — ${m.description}` : ""}`)
      .join("\n");
    if (findings) lines.push("Segmental Findings:\n" + findings);
  }
  if (obj.reactions?.length > 0) {
    lines.push("Reactions: " + obj.reactions.join(", "));
  }
  lines.push("");

  // Assessment
  lines.push("━━ ASSESSMENT ━━");
  if (assess.text) lines.push(assess.text);
  if (assess.adjNotes) lines.push(`Adjustment Notes: ${assess.adjNotes}`);
  if (assess.softTissue) lines.push(`Soft Tissue: ${assess.softTissue}`);
  if (assess.responding) lines.push(`Patient Responding: ${assess.responding}`);
  lines.push("");

  // Plan
  lines.push("━━ PLAN ━━");
  if (plan.tx) lines.push(plan.tx);
  if (plan.response?.length > 0) lines.push("Response to Care: " + plan.response.join(", "));
  if (plan.postTx?.length > 0) lines.push("Post-Tx Care: " + plan.postTx.join("; "));
  if (plan.nextAppt) lines.push(`Next Appointment: ${plan.nextAppt}`);
  if (plan.notes) lines.push(`Notes: ${plan.notes}`);
  lines.push("");

  // Consent
  if (consentChecked) {
    lines.push(patient.species === "Human"
      ? "☑ Patient consented to treatment. Informed consent on file."
      : "☑ Owner consented to treatment. Veterinary referral on file.");
  }

  // Signature
  lines.push(`\n— ${practice.doctor}`);
  lines.push(`Signed: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`);

  return lines.join("\n");
}

// ── Hybrid Storage Layer ──
// Uses GHL when configured, localStorage as fallback

export class HybridStorage {
  constructor() {
    this.ghlReady = isGHLConfigured();
  }

  // Check if we're in GHL context
  isGHL() {
    return isGHLConfigured();
  }

  // --- Notes ---
  async getNotes() {
    try {
      const raw = localStorage.getItem("soap-notes");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  async saveNotes(notes) {
    localStorage.setItem("soap-notes", JSON.stringify(notes));
  }

  async pushNoteToGHL(contactId, noteData, practice) {
    if (!this.isGHL() || !contactId) return null;
    try {
      const formatted = formatSOAPNoteForGHL(noteData, practice);
      const result = await createContactNote(contactId, formatted);
      return result;
    } catch (e) {
      console.error("GHL note push failed:", e);
      return null;
    }
  }

  // --- Patient Directory ---
  async getPatientDir() {
    try {
      const raw = localStorage.getItem("patient-dir");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  async savePatientDir(dir) {
    localStorage.setItem("patient-dir", JSON.stringify(dir));
  }

  // --- Barn Directory ---
  async getBarnDir() {
    try {
      const raw = localStorage.getItem("barn-dir");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  async saveBarnDir(dir) {
    localStorage.setItem("barn-dir", JSON.stringify(dir));
  }

  // --- Saved Vets ---
  async getVets() {
    try {
      const raw = localStorage.getItem("saved-vets");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  async saveVets(vets) {
    localStorage.setItem("saved-vets", JSON.stringify(vets));
  }

  // --- Settings (practice, groups, ortho, phrases, fields) ---
  async get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  async set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

// Singleton
export const storage = new HybridStorage();
