# Remote Optometry QA Operations & Detractor Audit Analytics (ROC-QD)

An interactive visual intelligence dashboard designed for **Remote Optometry Quality Assurance (QA) Operations** and **ET NPS Detractor Audits**, integrated with Google Sheets.

---

## 🌟 Key Features

1. **Executive Metric Cards**:
   - Total Audits Completed (Pass/Fail)
   - All-Time Detractors
   - Audit Pass vs Fail Rates
   - Feedback Shared Counts
   - Ops Validation Sign-offs
2. **Complete ROC Summary View (Table View)**:
   - Tables for **Overall**, **ROC - KOL**, **ROC - Lucknow**, and **ROC - Delta Tower**.
   - Yellow header formatting with exact Detractor, Audit Completed, Feedback Shared, and Ops Validated metrics.
   - Presets for Screenshot View (20, 21, 22 Oct), Last 7 Days, Last 14 Days, and All Available Dates.
3. **QA Day-Wise Productivity Tracker**:
   - Interactive Heatmap Matrix tracking daily audit volume per analyst across all dates.
   - QA Leaderboard cards with individual Pass/Fail ratios, feedback delivery rates, and primary ROC hub.
4. **Day-Wise Audit Trends**:
   - Daily throughput volume with 7-day moving averages and peak indicators.
   - Cumulative audit trajectory and day-wise stacked Pass/Fail distribution.
5. **Detractor & Customer Sentiment**:
   - Customer L1 and L2 breakdown (Staff Assistance, Wrong Power Prescribed, Clinic Cleanliness, Duration).
   - Auditor correlation rate (% where auditor confirmed CX finding).
6. **Pass / Fail & Clinical SOP Compliance**:
   - Root-cause clinical gap analysis (Fogging/Sph Correction, Binocular Balancing, JCC, Walking Trial).
   - 14-point 9-steps clinical adherence rate.
7. **Feedback & Validation Tracking**:
   - Feedback shared vs pending, Ops validated vs not validated, video shown to RO.
8. **Interactive Audit Records Explorer**:
   - Search by RO Name, ID, QA, or comments.
   - Pagination, column sorting, and full clinical detail modal.
   - Instant CSV Export.
9. **Live Google Sheet Sync**:
   - Integrated live sync button connected to the Google Sheet.

---

## 🚀 How to Run Locally

### Option 1: Python Web Server (Recommended)
```bash
python server.py
```
Open your browser at:
`http://localhost:8080`

### Option 2: Open Directly
Open `index.html` in any modern web browser.

---

## 📁 Repository Structure

```text
├── index.html            # Main dashboard HTML (Light Mode)
├── style.css             # Light theme styling & layout
├── app.js                # Core dashboard logic & charts
├── data.js               # Embedded audit data for standalone use
├── data.json             # JSON dataset
├── chart.min.js          # Offline Chart.js bundle
├── server.py             # Local Python server with Google Sheet sync API
├── sheet_config.json     # Google Sheet integration config
└── .gitignore            # Git ignore rules
```
