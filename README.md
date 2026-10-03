# QuickNote – Smart Browser Notes

**Task 2: Create a Chrome Extension Using AI**

| | |
|---|---|
| Student | _(your name)_ |
| Roll No. / Division | _(your roll number)_ |
| Course / Institute | _(course name)_, Walchand Institute of Technology, Solapur |
| Version | 1.0.0 |

---

## 1. Project Overview

QuickNote is a lightweight Chrome extension that lives in the browser toolbar. One click opens a popup where the user can create, edit, search, copy and delete notes. Notes are stored in the browser with the Chrome Storage API, so they remain after the popup is closed or the browser is restarted. The extension needs no internet connection, no account and no server.

## 2. Problem Statement

While browsing, people constantly need to jot something down: a reminder, a study point, a code snippet, a link, an idea. Switching to another app or a separate notes website breaks concentration, and sticky notes or loose text files get lost. There is a need for a **fast, always-available notepad inside the browser** that opens instantly, saves automatically and does not depend on any external service.

## 3. Objectives

- Build a working Chrome extension using **Manifest V3**.
- Allow users to create, edit, delete, search and copy notes from the toolbar popup.
- Store data permanently with `chrome.storage.local` and work fully offline.
- Provide auto-save so that no typing is lost.
- Provide a clean, accessible interface with light and dark themes.
- Use only HTML, CSS and vanilla JavaScript (no frameworks, no backend, no external APIs).
- Demonstrate how Generative AI can support the complete development cycle.

## 4. Features

- **Create** multiple notes (title is optional; empty title becomes "Untitled Note")
- **Edit** any note and see its **last updated date and time**
- **Auto-save** about 0.8 seconds after typing stops, with a "Saving..." / "Saved" indicator
- **Search** notes in real time by title or content (case-insensitive)
- **Copy** note content to the clipboard with a "Copied to clipboard!" message
- **Delete** with a confirmation dialog (only the selected note is removed)
- Notes sorted by **most recently updated** first
- **Light and dark mode**; the chosen theme is remembered
- Attractive **empty state** when there are no notes
- **Toast notifications** for success and error messages
- **Keyboard support:** `Ctrl + Enter` saves, `Esc` closes the editor or dialog, full Tab navigation, visible focus outlines
- **Error handling** for empty content, storage failures, clipboard failures, corrupted data and missing notes
- Works completely **offline**; requests only the `storage` permission

## 5. Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Structure of the popup (semantic elements, labels, ARIA roles) |
| CSS3 | Layout, light/dark design tokens, transitions, focus styles |
| JavaScript (vanilla, ES2020) | All application logic |
| Chrome Extension Manifest V3 | Extension configuration and packaging |
| Chrome Storage API (`chrome.storage.local`) | Permanent storage of notes and theme |

## 6. Project Structure

```
quicknote-extension/
├── manifest.json     Extension configuration (Manifest V3, "storage" permission only)
├── popup.html        Popup interface: header, search, note list, editor, toast, delete dialog
├── style.css         Styling, design tokens for light and dark themes, animations
├── script.js         Application logic (storage, note operations, theme, rendering, events)
├── README.md         Project documentation
└── icons/
    ├── icon16.png    Toolbar / favicon size
    ├── icon32.png    Windows scaling
    ├── icon48.png    Extensions management page
    └── icon128.png   Chrome Web Store / install size
```

**Organisation of `script.js`:** (1) constants and state, (2) storage layer: `getNotes()`, `saveNotes()`, (3) note operations: `createNote()`, `updateNote()`, `deleteNote()`, `copyNote()`, (4) theme handling, (5) UI helpers, (6) rendering: `renderNotes()`, (7) editor and auto-save, (8) delete dialog, (9) event handling, (10) start-up.

## 7. How It Works

1. Clicking the toolbar icon opens `popup.html`, which loads `style.css` and `script.js`.
2. On start-up, `script.js` reads the saved notes and theme from `chrome.storage.local`, validates the data, and calls `renderNotes()`.
3. **New Note** opens the editor. While typing, a timer waits about 0.8 s and then saves automatically. The first auto-save creates the note; later ones update the same note.
4. **Save Note** cancels any pending auto-save, saves immediately and returns to the list. **Cancel** closes the editor (anything already auto-saved is kept).
5. Every create, update or delete changes the in-memory list and writes it to `chrome.storage.local`, then the list is re-rendered, sorted by `updatedAt`.
6. Search filters the in-memory list on every keystroke, so results appear instantly.
7. Each note is stored as:

```json
{
  "id": "unique-id",
  "title": "Study plan",
  "content": "Revise DBMS chapter 4",
  "createdAt": "2026-10-03T12:30:00.000Z",
  "updatedAt": "2026-10-03T12:45:10.000Z"
}
```

## 8. Installation

1. Open **Google Chrome**.
2. Go to `chrome://extensions/`.
3. Turn on **Developer mode** (toggle at the top right).
4. Click **Load unpacked**.
5. Select the **`quicknote-extension`** folder (the folder that contains `manifest.json`).
6. Click the puzzle-piece icon in the toolbar and **pin** QuickNote.
7. Click the **QuickNote** icon to open the popup.
8. Test the features using the table in the next section.

> If Chrome shows an error, make sure you selected the folder that directly contains `manifest.json`, not a parent folder.

## 9. Testing

Run each test in Chrome and fill in the last two columns yourself.

| # | Test Case | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| 1 | Extension installation | Extension loads without errors; QuickNote icon appears in the toolbar and popup opens | | |
| 2 | Create note | Click **+ Create Note** / **+ New Note**, type text, click **Save Note**; the note appears in the list with date/time | | |
| 3 | Create note with empty title | Title shows "Untitled Note" | | |
| 4 | Empty content rejected | Saving with empty text shows "Write something before saving." | | |
| 5 | Edit note | Edit button loads the note; after saving, changes appear and "Updated" time changes; note moves to top | | |
| 6 | Delete note | Delete shows a confirmation; confirming removes only that note; Cancel keeps it | | |
| 7 | Search note | Typing filters notes by title and content, ignoring case; unmatched search shows "No notes found" | | |
| 8 | Copy note | Copy button shows "Copied to clipboard!"; pasting elsewhere gives the note text | | |
| 9 | Theme toggle | Whole UI switches between light and dark | | |
| 10 | Auto-save | Typing in the editor shows "Saving..." then "Saved"; the note exists in the list after pressing Cancel | | |
| 11 | Data persistence | Close the popup, reopen it (and restart Chrome); notes and theme are still there | | |
| 12 | Empty state | With no notes, "No notes yet" and the **+ Create Note** button are shown | | |
| 13 | Keyboard use | Tab reaches all controls with visible focus; `Ctrl+Enter` saves; `Esc` closes editor/dialog | | |

**Automated checks performed during development:** the extension's real `popup.html` and `script.js` were run in a simulated browser (jsdom) with a mock `chrome.storage.local`. This covered create, edit, auto-save, search, copy, delete with confirmation, theme persistence, re-opening the popup, corrupted stored data, storage and clipboard failures, and HTML-escaping of note text. It does **not** replace the manual tests above in real Chrome.

## 10. AI-Assisted Development

Generative AI was used throughout this project for:

- **UI design:** layout of the popup, colour palette, light and dark themes
- **HTML generation:** semantic structure, labels and ARIA attributes
- **CSS styling:** design tokens, transitions, hover and focus states
- **JavaScript functionality:** storage, CRUD operations, search, auto-save, clipboard, theme
- **Manifest configuration:** Manifest V3 setup with minimum permissions
- **Debugging:** reviewing the code for errors, broken references and edge cases
- **Feature improvement:** confirmation dialog, toast messages, keyboard shortcuts
- **Documentation:** this README and the project write-up

All AI output was reviewed, tested and verified by the student before submission.

## AI Prompts Used

These are the prompts that describe the development steps.

**Prompt 1 – Initial Development**
"Create a Chrome Extension using Manifest V3 for a Quick Notes application using HTML, CSS and vanilla JavaScript."

**Prompt 2 – UI**
"Design a modern professional popup interface for a Quick Notes Chrome Extension with light and dark themes."

**Prompt 3 – Storage**
"Implement Chrome Storage API using chrome.storage.local to persist notes."

**Prompt 4 – Debugging**
"Review the Chrome Extension code for Manifest V3 compatibility and identify possible JavaScript or storage errors."

**Prompt 5 – Improvements**
"Improve the UI with smooth animations, toast notifications, responsive layout, and accessible controls."

**Prompt 6 – Auto-save**
"Add an auto-save feature that saves the note about one second after the user stops typing, shows a Saving/Saved status, and does not conflict with the manual Save button."

**Prompt 7 – Search and sorting**
"Add real-time, case-insensitive search by title and content, show 'No notes found' when nothing matches, and sort notes by most recently updated."

**Prompt 8 – Error handling**
"Handle empty content, storage errors, clipboard errors, corrupted data and missing notes with friendly messages so the extension never crashes."

**Prompt 9 – Documentation**
"Write a professional README for a college submission with overview, objectives, features, installation steps, a testing table and future enhancements."

## Changes Made During Testing

The issues below were found while **reviewing and testing the generated code** (static CSS review and the simulated-browser test run described in section 9). The automated tests found no failures in the JavaScript logic.

| Issue Found | Change Made | Reason |
|---|---|---|
| Search icon sat about 8 px above the centre of the search box (its vertical offset was calculated from the wrong container height) | Positioned the icon at a fixed `top: 32px` (wrapper padding + half the input height) | Icon must be vertically centred inside the input for a polished look |
| The `.char-count` element in the editor had no CSS rule | Added a rule using tabular numbers | Keeps the character counter from jittering while typing and keeps every element styled |

> **Student note:** if you find any further issues while testing in Chrome, add them as new rows in this table. Only list changes that actually happened.

## 11. Future Enhancements

These are ideas only and are **not** implemented in version 1.0:

- Categories and tags for organising notes
- Export notes to a file (text/JSON) and import them back
- Customisable keyboard shortcut to open QuickNote
- Cloud synchronisation across devices (for example with `chrome.storage.sync`)
- Rich text editing (bold, lists, links)
- Pinned notes and note colours

## License

Created for educational purposes as part of a college assignment.
