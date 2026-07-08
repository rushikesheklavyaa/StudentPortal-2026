# Eklavyaa Academy — Coaching Attendance Portal

A complete, production-ready attendance, student and test-management portal built for
coaching classes. Teachers get a full dashboard; students get a no-login lookup
portal for their own attendance and marks.

**Stack:** HTML5, CSS3, Vanilla JavaScript (ES6 Modules), Google Apps Script, Google Sheets.
No frameworks, no build step — just static files + a Google Apps Script backend.

---

## 1. Project structure

```
AttendancePortal/
├── backend/
│   └── Code.gs                 # Entire backend (Apps Script)
├── frontend/
│   ├── index.html               # Teacher login
│   ├── dashboard.html           # Teacher dashboard (SPA)
│   ├── student.html             # Public student portal
│   └── assets/
│       ├── css/
│       │   ├── style.css        # Base tokens + login page
│       │   ├── components.css   # Shared UI components
│       │   ├── dashboard.css    # Dashboard layout
│       │   └── student.css      # Student portal styling
│       └── js/
│           ├── config.js        # API URL + shared constants
│           ├── api.js           # fetch() wrapper (GET/POST)
│           ├── utils.js         # Toasts, alerts, session, formatting
│           ├── login.js         # Teacher login page logic
│           ├── dashboard.js     # Dashboard orchestrator (nav, stats, chart)
│           ├── students.js      # Student CRUD, search, filters
│           ├── attendance.js    # Attendance marking grid
│           ├── tests.js         # Tests, marks entry, reports
│           └── student.js       # Public student portal logic
└── README.md
```

---

## 2. Backend setup (Google Sheets + Apps Script)

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
   Name it anything, e.g. **"Eklavyaa Academy DB"**.
2. Open **Extensions → Apps Script**. Delete any starter code in `Code.gs`.
3. Copy the entire contents of `backend/Code.gs` from this project and paste it in.
4. Save the project (Ctrl/Cmd + S).
5. In the function dropdown at the top, select **`setupERP`** and click **Run**.
   - The first run will ask for permissions — click **Review permissions**, choose your
     Google account, click **Advanced → Go to project (unsafe)**, then **Allow**.
     (This warning appears because it's your own unpublished script — it's expected.)
   - This creates all 6 sheets (Settings, Teachers, Students, Attendance, Tests, Marks)
     with headers, and seeds one default teacher login.
6. **Default teacher login** created by setup:
   - Name: `Admin`
   - PIN: `1234`
   - **Change or add real teachers** by editing the `Teachers` sheet directly (TeacherID,
     TeacherName, PIN, Email, Mobile, Status).
7. Deploy the backend as a web app:
   - Click **Deploy → New deployment**.
   - Click the gear icon next to "Select type" → choose **Web app**.
   - Description: `Eklavyaa Academy API` (optional).
   - Execute as: **Me**.
   - Who has access: **Anyone**.
   - Click **Deploy**, authorize again if prompted.
   - Copy the **Web app URL** shown (ends in `/exec`).

---

## 3. Frontend setup

1. Open `frontend/assets/js/config.js`.
2. Replace the placeholder in `API_URL` with the Web app URL you copied above:

   ```js
   API_URL: 'https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXX/exec',
   ```

3. That's it — no build step, no npm install. The app is plain static HTML/CSS/JS.

---

## 4. Running locally

Because the app uses ES6 modules (`type="module"`), open it through a local server
rather than double-clicking the HTML file (browsers block module imports on `file://`).

Options:
- VS Code "Live Server" extension → right-click `index.html` → **Open with Live Server**.
- Or from the `frontend` folder: `python3 -m http.server 8080`, then visit
  `http://localhost:8080`.

---

## 5. Deploying to GitHub Pages

1. Push the contents of the `frontend/` folder to a GitHub repository (it can be the
   repo root, or a `/frontend` folder if you enable Pages from that path).
2. In the repo, go to **Settings → Pages**.
3. Set **Source** to the branch and folder containing `index.html`.
4. Save — GitHub will give you a public URL such as
   `https://yourusername.github.io/your-repo/`.
5. Share that link with teachers, and `.../student.html` with students.

---

## 6. Using the portal

### Teacher
1. Go to `index.html`, sign in with your name + PIN.
2. **Dashboard** — live stats (total students, present/absent today, total tests),
   quick actions, a 7-day attendance trend chart, and recent activity.
3. **Students** — add, edit, delete, search and filter students. Student IDs are
   auto-generated (`STD000001`, `STD000002`, ...).
4. **Attendance** — pick a date, standard, board and batch, load the class, mark
   Present / Absent / Late / Leave per student (or use "Mark All"), then save.
   Re-saving the same date overwrites that day's records instead of duplicating them.
5. **Tests** — create a test (name, subject, standard, board, batch, date, max marks),
   optionally attaching a Test Paper PDF and Model Answer PDF (or add them later from
   the same table).
6. **Marks Entry** — pick a test, load its students, enter scores, optionally upload
   each student's scanned answer sheet, then save.
7. **Reports** — Daily attendance, Monthly attendance, a single Student's attendance
   history + average marks, and a Test summary table.
8. **Notices & Appreciation** — post a message targeted at a student, standard, batch,
   or (Admin only) everyone — with an optional image attached.
9. **Fees** *(Admin only)* — track total fee, amount paid, installments and balance per student.
10. **Settings** *(Admin only)* — upload/replace the academy logo shown across all pages.

### Student
1. Go to `student.html` (no login).
2. Enter the Student ID given by your teacher.
3. View your profile, attendance percentage (ring chart), attendance history, average /
   highest marks, and recent test scores.
4. **Practice** tab — download test papers and model answers for your class, and
   upload your own answer sheet for a test so your teacher can review it.

---

## 7. File uploads (logo, notices, test papers, answer sheets)

This version adds Google Drive-backed file uploads for:

- **Academy logo** — Admin → Settings. Shown on the login page, dashboard sidebar and student portal header.
- **Notice / Appreciation images** — optional image attached when a teacher posts a notice.
- **Test papers & model answers** — optional PDFs attached when creating a test (or added later from the Tests table).
- **Answer sheets** — teachers can upload a student's scanned answer sheet from Marks Entry; students can upload their own from the **Practice** tab on their portal.

**If you're upgrading an existing deployment:**
1. Paste the updated `Code.gs` over your old one and save.
2. Run **`migrateERP`** once (not `setupERP`, which would wipe your data) — it adds the new `AnswerSheets` sheet, the `ImageURL` / `TestPaperURL` / `ModelAnswerURL` columns, and a `LogoURL` setting, without touching existing rows.
3. Re-deploy (**Deploy → Manage deployments → Edit → New version**). Google will prompt you to re-authorize with an added **Google Drive** permission — accept it, or uploads will silently fail.
4. A folder called **"Eklavyaa Academy Uploads"** will appear in the Drive of whichever account the script is deployed as (**Execute as: Me**), with subfolders for Logo / Notices / TestPapers / ModelAnswers / AnswerSheets.

**Limits:** images (logo, notice photos) up to 4 MB (JPG/PNG/WEBP); PDFs (test papers, model answers, answer sheets) up to 10 MB. Uploaded files are shared as "anyone with the link can view" so they're downloadable from the portal without a Google login.

---

## 8. Notes on the data model

All data lives in the Google Sheet created during setup:

| Sheet       | Purpose                                                   |
|-------------|------------------------------------------------------------|
| Settings    | Academy name, contact info, academic year                  |
| Teachers    | Login credentials (name + PIN) for teacher accounts         |
| Students    | Master student list                                         |
| Attendance  | One row per student per date marked                          |
| Tests       | Test definitions (subject, class, max marks, date)            |
| Marks       | One row per student per test                                   |
| Fees        | Total fee, amount paid, installments, per student (Admin only) |
| Notices     | Notices & appreciation posts, optionally with an attached image |
| AnswerSheets| One row per student per test — links to their uploaded scan     |

Because everything is a Google Sheet, you can always open it directly for backups,
bulk edits, or exporting to Excel/CSV.

---

## 9. Security notes

- Teacher auth is a simple name + PIN check against the `Teachers` sheet. This is
  suitable for a small coaching institute but is **not** enterprise-grade security —
  do not store highly sensitive data in this system.
- The Apps Script Web App is deployed with "Anyone" access so both the teacher
  dashboard and the public student portal can call it. Student-facing endpoints
  intentionally only return that one student's own data, looked up by Student ID.
- Rotate the default `Admin` / `1234` credentials immediately after setup.
