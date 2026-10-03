"use strict";

/* ==========================================================
   QuickNote – script.js
   Sections:
   1. Constants & app state
   2. Storage layer (chrome.storage.local)
   3. Note operations (create / update / delete / copy)
   4. Theme handling
   5. UI helpers (toast, save status, dates)
   6. Rendering (note list, empty state)
   7. Editor (open, auto-save, save, cancel)
   8. Delete confirmation dialog
   9. Event handling
   10. Start-up
   ========================================================== */


/* ---------- 1. CONSTANTS & APP STATE ---------- */

const STORAGE_KEYS = { NOTES: "quicknote_notes", THEME: "quicknote_theme" };
const AUTOSAVE_DELAY_MS = 800;   // wait this long after typing stops before auto-saving
const PREVIEW_LENGTH = 130;      // characters shown in the card preview
const TOAST_DURATION_MS = 2200;
const DEFAULT_TITLE = "Untitled Note";

// The single source of truth for what the UI shows
const state = {
  notes: [],                 // all notes (kept in memory, mirrored to chrome.storage.local)
  searchQuery: "",
  theme: "light",
  editingId: null,           // id of the note open in the editor (null = brand-new note)
  lastSaved: { title: "", content: "" },  // editor values at the last successful save
  autosaveTimer: null,
  saveChain: Promise.resolve(), // queues saves so they never overlap
  pendingDeleteId: null,
  dialogReturnFocus: null,
  toastTimer: null,
};

const el = {};  // cached DOM elements, filled in by cacheElements()

// Small SVG icons used on the note cards
const ICONS = {
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
         '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
};


/* ---------- 2. STORAGE LAYER ---------- */

function hasChromeStorage() {
  return typeof chrome !== "undefined" && Boolean(chrome.storage && chrome.storage.local);
}

// Read all notes from chrome.storage.local (and clean up any invalid data)
async function getNotes() {
  if (!hasChromeStorage()) throw new Error("STORAGE_UNAVAILABLE");
  const result = await chrome.storage.local.get(STORAGE_KEYS.NOTES);
  return sanitizeNotes(result[STORAGE_KEYS.NOTES]);
}

// Write the full notes array to chrome.storage.local
async function saveNotes(notes) {
  if (!hasChromeStorage()) throw new Error("STORAGE_UNAVAILABLE");
  await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: notes });
}

function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

// Protects the app from corrupted or unexpected stored data
function sanitizeNotes(raw) {
  if (!Array.isArray(raw)) return [];
  const now = new Date().toISOString();
  return raw
    .filter((n) => n && typeof n === "object" && typeof n.id === "string" && n.id !== "")
    .map((n) => {
      const createdAt = isValidDate(n.createdAt) ? n.createdAt : now;
      return {
        id: n.id,
        title: typeof n.title === "string" && n.title.trim() ? n.title : DEFAULT_TITLE,
        content: typeof n.content === "string" ? n.content : "",
        createdAt,
        updatedAt: isValidDate(n.updatedAt) ? n.updatedAt : createdAt,
      };
    });
}


/* ---------- 3. NOTE OPERATIONS ---------- */

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function findNote(id) {
  return state.notes.find((note) => note.id === id) || null;
}

function normalizeTitle(title) {
  const trimmed = (title || "").trim();
  return trimmed || DEFAULT_TITLE;   // empty title -> "Untitled Note"
}

async function createNote(title, content) {
  const now = new Date().toISOString();
  const note = { id: generateId(), title: normalizeTitle(title), content, createdAt: now, updatedAt: now };
  state.notes.push(note);
  await saveNotes(state.notes);
  return note;
}

async function updateNote(id, title, content) {
  const note = findNote(id);
  if (!note) throw new Error("NOTE_NOT_FOUND");
  note.title = normalizeTitle(title);
  note.content = content;
  note.updatedAt = new Date().toISOString();
  await saveNotes(state.notes);
  return note;
}

async function deleteNote(id) {
  const index = state.notes.findIndex((note) => note.id === id);
  if (index === -1) throw new Error("NOTE_NOT_FOUND");
  state.notes.splice(index, 1);
  await saveNotes(state.notes);
}

// Copy the note content to the clipboard (with a fallback for older behaviour)
async function copyNote(id) {
  const note = findNote(id);
  if (!note) {
    showToast("That note could not be found.", "error");
    renderNotes();
    return;
  }
  try {
    await navigator.clipboard.writeText(note.content);
    showToast("Copied to clipboard!");
  } catch (error) {
    if (copyWithFallback(note.content)) {
      showToast("Copied to clipboard!");
    } else {
      console.error("Clipboard error:", error);
      showToast("Could not copy. Select the text and press Ctrl+C.", "error");
    }
  }
}

function copyWithFallback(text) {
  try {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.className = "visually-hidden";
    document.body.appendChild(helper);
    helper.select();
    const ok = document.execCommand("copy");
    helper.remove();
    return ok;
  } catch (error) {
    return false;
  }
}


/* ---------- 4. THEME HANDLING ---------- */

function applyTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = state.theme;
  const nextLabel = state.theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  el.themeToggle.title = nextLabel;
  el.themeToggle.setAttribute("aria-label", nextLabel);
  el.themeToggle.setAttribute("aria-pressed", String(state.theme === "dark"));
}

function systemPrefersDark() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

async function loadTheme() {
  if (!hasChromeStorage()) throw new Error("STORAGE_UNAVAILABLE");
  const result = await chrome.storage.local.get(STORAGE_KEYS.THEME);
  const saved = result[STORAGE_KEYS.THEME];
  return saved === "dark" || saved === "light" ? saved : (systemPrefersDark() ? "dark" : "light");
}

async function toggleTheme() {
  const next = state.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    if (!hasChromeStorage()) throw new Error("STORAGE_UNAVAILABLE");
    await chrome.storage.local.set({ [STORAGE_KEYS.THEME]: next });
  } catch (error) {
    console.error("Could not save theme:", error);
    showToast("Theme changed, but it could not be remembered.", "error");
  }
}


/* ---------- 5. UI HELPERS ---------- */

function showToast(message, type = "success") {
  clearTimeout(state.toastTimer);
  el.toast.textContent = message;
  el.toast.dataset.type = type;
  el.toast.classList.add("show");
  state.toastTimer = setTimeout(() => el.toast.classList.remove("show"), TOAST_DURATION_MS);
}

const SAVE_STATUS_TEXT = {
  idle: "Changes save automatically",
  empty: "Add some text to start saving",
  saving: "Saving...",
  saved: "Saved",
  error: "Not saved",
};

function setSaveStatus(status) {
  el.saveStatus.dataset.state = status;
  el.saveStatus.textContent = SAVE_STATUS_TEXT[status] || SAVE_STATUS_TEXT.idle;
}

function updateCharCount() {
  const count = el.contentInput.value.length;
  el.charCount.textContent = `${count} character${count === 1 ? "" : "s"}`;
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function makePreview(content) {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH).trimEnd()}…` : flat;
}

function focusPrimaryAction() {
  (state.notes.length > 0 ? el.newNoteBtn : el.emptyCreateBtn).focus();
}


/* ---------- 6. RENDERING ---------- */

// Notes that match the search box, newest update first
function getVisibleNotes() {
  const query = state.searchQuery.trim().toLowerCase();
  return state.notes
    .filter((note) => !query || note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function createIconButton(action, label, iconMarkup) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-btn";
  button.dataset.action = action;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML =
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconMarkup}</svg>`;
  return button;
}

// Builds one note card. User text is added with textContent (never innerHTML) so it is always safe.
function createNoteCard(note) {
  const item = document.createElement("li");

  const card = document.createElement("article");
  card.className = "note-card";
  card.dataset.id = note.id;

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "note-open";
  openButton.dataset.action = "edit";
  openButton.setAttribute("aria-label", `Edit note: ${note.title}`);

  const title = document.createElement("h3");
  title.className = "note-title";
  title.textContent = note.title;

  const preview = document.createElement("p");
  preview.className = "note-preview";
  preview.textContent = makePreview(note.content) || "No content";

  openButton.append(title, preview);

  const footer = document.createElement("div");
  footer.className = "note-footer";

  const date = document.createElement("time");
  date.className = "note-date";
  date.dateTime = note.updatedAt;
  date.textContent = `Updated ${formatDate(note.updatedAt)}`;

  const actions = document.createElement("div");
  actions.className = "note-actions";
  actions.append(
    createIconButton("edit", "Edit note", ICONS.edit),
    createIconButton("copy", "Copy note content", ICONS.copy),
    createIconButton("delete", "Delete note", ICONS.trash)
  );

  footer.append(date, actions);
  card.append(openButton, footer);
  item.appendChild(card);
  return item;
}

function renderNotes() {
  const total = state.notes.length;
  const visible = getVisibleNotes();
  const searching = state.searchQuery.trim() !== "";

  el.notesList.replaceChildren(...visible.map(createNoteCard));

  el.emptyState.hidden = total > 0;                       // no notes at all -> empty state
  el.noResults.hidden = total === 0 || visible.length > 0; // notes exist but none match
  el.listFooter.hidden = total === 0;                      // empty state has its own button

  if (total === 0) {
    el.noteCount.textContent = "";
  } else if (searching) {
    el.noteCount.textContent = `${visible.length} of ${total} note${total === 1 ? "" : "s"}`;
  } else {
    el.noteCount.textContent = `${total} note${total === 1 ? "" : "s"}`;
  }
}


/* ---------- 7. EDITOR ---------- */

function openEditor(id) {
  let note = null;
  if (id) {
    note = findNote(id);
    if (!note) {
      showToast("That note could not be found.", "error");
      renderNotes();
      return;
    }
  }

  state.editingId = note ? note.id : null;
  el.editorHeading.textContent = note ? "Edit note" : "New note";
  el.titleInput.value = note ? note.title : "";
  el.contentInput.value = note ? note.content : "";
  state.lastSaved = { title: el.titleInput.value, content: el.contentInput.value };

  setSaveStatus("idle");
  updateCharCount();
  el.listView.hidden = true;
  el.editorView.hidden = false;

  if (note) {
    el.contentInput.focus();
    const end = el.contentInput.value.length;
    el.contentInput.setSelectionRange(end, end);
  } else {
    el.titleInput.focus();
  }
}

function closeEditor() {
  clearTimeout(state.autosaveTimer);
  state.editingId = null;
  el.editorView.hidden = true;
  el.listView.hidden = false;
  renderNotes();
  focusPrimaryAction();
}

// Saves whatever is currently in the editor. Used by both auto-save and the Save button.
// Returns true when the note is saved (or already up to date), false otherwise.
async function saveEditorContents() {
  const title = el.titleInput.value;
  const content = el.contentInput.value;

  if (!content.trim()) return false; // never save an empty note

  const alreadyStored = state.editingId !== null && findNote(state.editingId) !== null;
  const unchanged = title === state.lastSaved.title && content === state.lastSaved.content;
  if (alreadyStored && unchanged) {
    setSaveStatus("saved");
    return true;
  }

  setSaveStatus("saving");
  try {
    if (alreadyStored) {
      await updateNote(state.editingId, title, content);
    } else {
      // First save of a new note (or the note vanished): create it and remember its id
      const note = await createNote(title, content);
      state.editingId = note.id;
    }
    state.lastSaved = { title, content };
    setSaveStatus("saved");
    renderNotes();
    return true;
  } catch (error) {
    console.error("Save failed:", error);
    setSaveStatus("error");
    showToast("Could not save your note. Please try again.", "error");
    return false;
  }
}

// Saves are queued one after another so auto-save and manual save can never overlap
function queueEditorSave() {
  const run = state.saveChain.then(saveEditorContents);
  state.saveChain = run.catch(() => false);
  return run;
}

function handleEditorInput() {
  updateCharCount();
  clearTimeout(state.autosaveTimer);

  if (!el.contentInput.value.trim()) {
    setSaveStatus("empty");
    return;
  }
  setSaveStatus("saving");
  state.autosaveTimer = setTimeout(queueEditorSave, AUTOSAVE_DELAY_MS);
}

async function handleSaveClick() {
  if (!el.contentInput.value.trim()) {
    showToast("Write something before saving.", "error");
    el.contentInput.focus();
    return;
  }
  clearTimeout(state.autosaveTimer);   // the manual save replaces any pending auto-save
  const saved = await queueEditorSave();
  if (saved) {
    closeEditor();
    showToast("Note saved");
  }
}

function handleCancelClick() {
  closeEditor();  // anything auto-saved earlier stays; unsaved typing is discarded
}


/* ---------- 8. DELETE CONFIRMATION DIALOG ---------- */

function requestDelete(id) {
  const note = findNote(id);
  if (!note) {
    showToast("That note could not be found.", "error");
    renderNotes();
    return;
  }
  state.pendingDeleteId = id;
  state.dialogReturnFocus = document.activeElement;
  el.confirmText.textContent = `“${note.title}” will be permanently deleted.`;
  el.confirmDialog.hidden = false;
  el.confirmCancelBtn.focus();
}

function closeConfirmDialog() {
  el.confirmDialog.hidden = true;
  state.pendingDeleteId = null;
  const target = state.dialogReturnFocus;
  state.dialogReturnFocus = null;
  if (target && document.body.contains(target)) target.focus();
}

async function confirmDelete() {
  const id = state.pendingDeleteId;
  if (!id) return;
  try {
    await deleteNote(id);
    closeConfirmDialog();
    renderNotes();
    focusPrimaryAction();
    showToast("Note deleted");
  } catch (error) {
    closeConfirmDialog();
    if (error.message === "NOTE_NOT_FOUND") {
      showToast("That note was already deleted.", "error");
    } else {
      console.error("Delete failed:", error);
      showToast("Could not delete the note. Please try again.", "error");
    }
    renderNotes();
  }
}


/* ---------- 9. EVENT HANDLING ---------- */

function cacheElements() {
  const ids = [
    "themeToggle", "listView", "searchInput", "noteCount", "notesList", "noResults", "emptyState",
    "emptyCreateBtn", "listFooter", "newNoteBtn", "editorView", "editorHeading", "titleInput",
    "contentInput", "saveStatus", "charCount", "saveNoteBtn", "cancelBtn", "toast",
    "confirmDialog", "confirmText", "confirmCancelBtn", "confirmDeleteBtn",
  ];
  // The two editor fields have different HTML ids, so map them explicitly
  const htmlIds = { titleInput: "noteTitle", contentInput: "noteContent" };
  ids.forEach((name) => { el[name] = document.getElementById(htmlIds[name] || name); });
}

// One click listener for every button inside the notes list (edit / copy / delete)
function handleListClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const card = button.closest("[data-id]");
  if (!card) return;

  const id = card.dataset.id;
  switch (button.dataset.action) {
    case "edit": openEditor(id); break;
    case "copy": copyNote(id); break;
    case "delete": requestDelete(id); break;
    default: break;
  }
}

function handleKeydown(event) {
  const dialogOpen = !el.confirmDialog.hidden;
  const editorOpen = !el.editorView.hidden;

  if (event.key === "Escape") {
    if (dialogOpen) closeConfirmDialog();
    else if (editorOpen) closeEditor();
    return;
  }

  // Keep keyboard focus inside the dialog while it is open
  if (event.key === "Tab" && dialogOpen) {
    const first = el.confirmCancelBtn;
    const last = el.confirmDeleteBtn;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }

  if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && editorOpen && !dialogOpen) {
    event.preventDefault();
    handleSaveClick();
  }
}

function bindEvents() {
  el.themeToggle.addEventListener("click", toggleTheme);

  el.searchInput.addEventListener("input", () => {
    state.searchQuery = el.searchInput.value;
    renderNotes();                       // filter in real time while typing
  });

  el.newNoteBtn.addEventListener("click", () => openEditor(null));
  el.emptyCreateBtn.addEventListener("click", () => openEditor(null));
  el.notesList.addEventListener("click", handleListClick);

  el.titleInput.addEventListener("input", handleEditorInput);
  el.contentInput.addEventListener("input", handleEditorInput);
  el.saveNoteBtn.addEventListener("click", handleSaveClick);
  el.cancelBtn.addEventListener("click", handleCancelClick);

  el.confirmCancelBtn.addEventListener("click", closeConfirmDialog);
  el.confirmDeleteBtn.addEventListener("click", confirmDelete);
  el.confirmDialog.addEventListener("click", (event) => {
    if (event.target === el.confirmDialog) closeConfirmDialog();  // click on the dark backdrop
  });

  document.addEventListener("keydown", handleKeydown);
}


/* ---------- 10. START-UP ---------- */

async function init() {
  cacheElements();
  bindEvents();
  applyTheme(systemPrefersDark() ? "dark" : "light");   // sensible default until the saved theme loads

  try {
    const [theme, notes] = await Promise.all([loadTheme(), getNotes()]);
    applyTheme(theme);
    state.notes = notes;
  } catch (error) {
    console.error("Start-up error:", error);
    state.notes = [];
    const message = error.message === "STORAGE_UNAVAILABLE"
      ? "Storage is unavailable. Open QuickNote from the Chrome toolbar."
      : "Could not load your notes. Try reopening QuickNote.";
    showToast(message, "error");
  }

  renderNotes();
  document.documentElement.classList.add("ready");   // turn on theme transitions after first paint
}

init();
