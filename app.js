/**
 * Remote Optometry QA Operations & Detractor Audit Analytics
 * Light Theme Only • Resilient Tab Switching • Complete ROC Summary View
 */

(function () {
  'use strict';

  // Global State
  const state = {
    allData: [],
    filteredData: [],
    filters: {
      dateFrom: '',
      dateTo: '',
      qa: 'ALL',
      roc: 'ALL',
      passFail: 'ALL',
      search: ''
    },
    table: {
      page: 1,
      pageSize: 25,
      sortCol: 'responseDate',
      sortAsc: false
    },
    completeViewPreset: 'screenshot', // 'screenshot', 'last7', 'last14', 'all'
    charts: {},
    activeTab: 'tab-overview' // Default active tab
  };

  // Light Mode Chart Colors
  const colors = {
    cyan: '#0284c7',
    blue: '#2563eb',
    indigo: '#4f46e5',
    purple: '#7c3aed',
    emerald: '#059669',
    rose: '#e11d48',
    amber: '#d97706',
    teal: '#0d9488',
    slate: '#94a3b8',
    text: '#334155',
    grid: '#e2e8f0'
  };

  const qaPalette = [
    '#0284c7', '#7c3aed', '#059669', '#d97706', '#e11d48', '#4f46e5', '#0d9488', '#db2777'
  ];

  // Configure Chart.js global defaults for Light Mode if Chart is loaded
  if (typeof Chart !== 'undefined' && Chart.defaults) {
    try {
      Chart.defaults.color = colors.text;
      Chart.defaults.borderColor = colors.grid;
      if (Chart.defaults.font) {
        Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
      }
    } catch (e) {}
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    loadDataset();
    setupEventListeners();
  });

  // 1. Data Loading
  function loadDataset() {
    if (window.AUDIT_DATA && Array.isArray(window.AUDIT_DATA) && window.AUDIT_DATA.length > 0) {
      state.allData = window.AUDIT_DATA;
      onDataReady();
    } else {
      fetch('data.json')
        .then(res => res.json())
        .then(data => {
          state.allData = data;
          onDataReady();
        })
        .catch(err => {
          console.error("Failed to load data.json:", err);
        });
    }
  }

  function onDataReady() {
    populateFilterDropdowns();
    applyFilters();
  }

  // 2. Filter Dropdowns
  function populateFilterDropdowns() {
    const qas = new Set();
    const rocs = new Set();
    let minDate = '9999-99-99';
    let maxDate = '0000-00-00';

    state.allData.forEach(r => {
      if (r.qa && r.qa !== 'Unassigned') qas.add(r.qa);
      if (r.roc && r.roc !== 'Unassigned' && r.roc !== '#N/A') rocs.add(r.roc);
      const d = r.responseDate || r.auditDate;
      if (d) {
        if (d < minDate) minDate = d;
        if (d > maxDate) maxDate = d;
      }
    });

    const qaSelect = document.getElementById('filterQA');
    if (qaSelect) {
      qaSelect.innerHTML = '<option value="ALL">All QAs (7 Analysts)</option>';
      Array.from(qas).sort().forEach(qa => {
        const opt = document.createElement('option');
        opt.value = qa;
        opt.textContent = qa;
        qaSelect.appendChild(opt);
      });
    }

    const rocSelect = document.getElementById('filterROC');
    if (rocSelect) {
      rocSelect.innerHTML = '<option value="ALL">All ROC Centers</option>';
      Array.from(rocs).sort().forEach(roc => {
        const opt = document.createElement('option');
        opt.value = roc;
        opt.textContent = roc;
        rocSelect.appendChild(opt);
      });
    }

    const fromInput = document.getElementById('filterDateFrom');
    const toInput = document.getElementById('filterDateTo');
    if (minDate !== '9999-99-99' && fromInput) fromInput.value = minDate;
    if (maxDate !== '0000-00-00' && toInput) toInput.value = maxDate;
    if (fromInput) state.filters.dateFrom = fromInput.value;
    if (toInput) state.filters.dateTo = toInput.value;
  }

  // 3. Apply Filters
  function applyFilters() {
    const { dateFrom, dateTo, qa, roc, passFail, search } = state.filters;

    state.filteredData = state.allData.filter(r => {
      const d = r.responseDate || r.auditDate;
      if (d) {
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }

      if (qa !== 'ALL' && r.qa !== qa) return false;
      if (roc !== 'ALL' && r.roc !== roc) return false;

      if (passFail !== 'ALL') {
        if (passFail === 'Pending') {
          if (r.passFailStatus !== 'Pending / Unassigned' && r.passFailStatus !== 'Not Performed') return false;
        } else if (r.passFailStatus !== passFail) {
          return false;
        }
      }

      if (search) {
        const q = search.toLowerCase();
        const str = `${r.roName} ${r.roId} ${r.qa} ${r.roc} ${r.cxL1} ${r.cxL2} ${r.cxComment} ${r.auditorBucket} ${r.auditorComment} ${r.responseId}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });

    updateDashboard();
  }

  // 4. Update Entire Dashboard UI
  function updateDashboard() {
    try { updateKPIs(); } catch (e) { console.error('updateKPIs error:', e); }
    try { renderCompleteView(); } catch (e) { console.error('renderCompleteView error:', e); }
    try { renderActiveTabCharts(); } catch (e) { console.error('renderActiveTabCharts error:', e); }
    try { renderQAMatrix(); } catch (e) { console.error('renderQAMatrix error:', e); }
    try { renderQALeaderboard(); } catch (e) { console.error('renderQALeaderboard error:', e); }
    try { renderTable(); } catch (e) { console.error('renderTable error:', e); }
    try { updateBadges(); } catch (e) { console.error('updateBadges error:', e); }
  }

  function updateBadges() {
    const bTotal = document.getElementById('badgeTotalAudits');
    if (bTotal) bTotal.textContent = state.allData.length;

    const bFiltered = document.getElementById('badgeFilteredRows');
    if (bFiltered) bFiltered.textContent = state.filteredData.length;

    const bDays = document.getElementById('badgeDaysCount');
    if (bDays) {
      const dates = new Set(state.filteredData.map(r => r.responseDate || r.auditDate).filter(Boolean));
      bDays.textContent = `${dates.size} Days`;
    }
  }

  // 5. Update KPI Cards
  function updateKPIs() {
    const data = state.filteredData;
    const totalSampled = data.length;

    const passList = data.filter(r => r.passFailStatus === 'Pass');
    const failList = data.filter(r => r.passFailStatus === 'Fail');
    const completedCount = passList.length + failList.length;

    const passCount = passList.length;
    const failCount = failList.length;
    const passRate = completedCount > 0 ? ((passCount / completedCount) * 100).toFixed(1) : '0.0';
    const failRate = completedCount > 0 ? ((failCount / completedCount) * 100).toFixed(1) : '0.0';

    const fbShared = data.filter(r => (r.feedbackRaw || '').trim().toLowerCase() === 'yes').length;
    const valDone = data.filter(r => r.validationStatus === 'Validated').length;
    const valNotDone = data.filter(r => r.validationStatus === 'Not Validated').length;

    const compRate = totalSampled > 0 ? ((completedCount / totalSampled) * 100).toFixed(1) : '0.0';

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setTxt('kpiPassCountPlusFail', completedCount);
    setTxt('kpiTotalSampled', `${totalSampled} Sampled`);
    setTxt('kpiCompletionRate', `${compRate}% Evaluated`);
    setTxt('kpiDetractorCount', totalSampled);
    setTxt('kpiPassCount', passCount);
    setTxt('kpiPassRate', `${passRate}% Pass Rate`);
    setTxt('kpiFailCount', failCount);
    setTxt('kpiFailRate', `${failRate}% Fail Rate`);
    setTxt('kpiFeedbackClosed', fbShared);
    setTxt('kpiFeedbackRate', `${fbShared} Shared`);
    setTxt('kpiValidatedCount', valDone);
    setTxt('kpiValidationRate', `${valDone} Validated`);
    setTxt('kpiNotValidated', `${valNotDone} Not Validated`);
  }

  // ========================================================
  // 6. RENDER COMPLETE ROC SUMMARY TABLES (EXACT USER VIEW)
  // ========================================================
  function renderCompleteView() {
    const data = state.allData;

    function normalizeDisplayDate(dStr, rawStr) {
      if (rawStr && (rawStr.includes('Oct') || rawStr.includes('Sep'))) {
        let s = rawStr.trim();
        return s.replace('2.26', '2026').replace('-26', '-2026');
      }
      if (dStr) {
        const parts = dStr.split('-');
        if (parts.length === 3) {
          const monNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const mIdx = parseInt(parts[1], 10) - 1;
          return `${parseInt(parts[2], 10)}-${monNames[mIdx]}-${parts[0]}`;
        }
      }
      return rawStr || dStr || '';
    }

    let targetDates = [];
    if (state.completeViewPreset === 'screenshot') {
      targetDates = ['20-Oct-2026', '21-Oct-2026', '22-Oct-2026'];
    } else {
      const dateSet = new Set();
      data.forEach(r => {
        const d = normalizeDisplayDate(r.responseDate, r.responseDateRaw);
        if (d && (d.includes('Oct') || d.includes('Sep'))) dateSet.add(d);
      });
      const sorted = Array.from(dateSet).sort((a, b) => b.localeCompare(a));
      if (state.completeViewPreset === 'last7') targetDates = sorted.slice(0, 7);
      else if (state.completeViewPreset === 'last14') targetDates = sorted.slice(0, 14);
      else targetDates = sorted;
    }

    function calcMetrics(rowList) {
      const detractor = rowList.length;
      const completed = rowList.filter(r => r.passFailStatus === 'Pass' || r.passFailStatus === 'Fail').length;
      const fbShared = rowList.filter(r => (r.feedbackRaw || '').trim().toLowerCase() === 'yes').length;
      const valOps = rowList.filter(r => (r.validationRaw || '').trim().toLowerCase() === 'validated').length;
      return { detractor, completed, fbShared, valOps };
    }

    function getRowsFor(rocKey, dateStr) {
      return data.filter(r => {
        if (rocKey === 'KOL' && r.roc !== 'ROC KOLKATA') return false;
        if (rocKey === 'Lucknow' && r.roc !== 'ROC-Lucknow') return false;
        if (rocKey === 'Delta' && r.roc !== 'Delta Tower') return false;

        if (dateStr) {
          const d = normalizeDisplayDate(r.responseDate, r.responseDateRaw);
          if (!d.toLowerCase().includes(dateStr.toLowerCase().slice(0, 6))) return false;
        }
        return true;
      });
    }

    function buildTbody(rocKey) {
      const allRows = getRowsFor(rocKey, null);
      const allMetrics = calcMetrics(allRows);

      let html = `
        <tr class="row-all-time">
          <td><strong>${rocKey === 'Overall' ? 'All time' : 'All Time'}</strong></td>
          <td>${allMetrics.detractor}</td>
          <td>${allMetrics.completed}</td>
          <td>${allMetrics.fbShared}</td>
          <td>${allMetrics.valOps}</td>
        </tr>
      `;

      targetDates.forEach(dt => {
        const dtRows = getRowsFor(rocKey, dt);
        const m = calcMetrics(dtRows);
        html += `
          <tr>
            <td>${dt}</td>
            <td>${m.detractor}</td>
            <td>${m.completed}</td>
            <td>${m.fbShared}</td>
            <td>${m.valOps}</td>
          </tr>
        `;
      });

      return html;
    }

    const setBody = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    setBody('tbodyOverall', buildTbody('Overall'));
    setBody('tbodyRocKol', buildTbody('KOL'));
    setBody('tbodyRocLucknow', buildTbody('Lucknow'));
    setBody('tbodyRocDelta', buildTbody('Delta'));
  }

  // 7. QA Productivity Matrix / Heatmap
  function renderQAMatrix() {
    const container = document.getElementById('qaMatrixContainer');
    if (!container) return;

    const data = state.filteredData;
    const qasSet = new Set();
    const datesSet = new Set();

    data.forEach(r => {
      if (r.qa && r.qa !== 'Unassigned') qasSet.add(r.qa);
      if (r.auditDate) datesSet.add(r.auditDate);
    });

    const qas = Array.from(qasSet).sort();
    const dates = Array.from(datesSet).sort();

    if (dates.length === 0 || qas.length === 0) {
      container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">No records found matching filters.</div>`;
      return;
    }

    const counts = {};
    const colTotals = {};
    const rowTotals = {};

    dates.forEach(d => { colTotals[d] = 0; });

    qas.forEach(qa => {
      counts[qa] = {};
      rowTotals[qa] = 0;
      dates.forEach(d => { counts[qa][d] = 0; });
    });

    data.forEach(r => {
      if (r.qa && counts[r.qa] && r.auditDate && counts[r.qa][r.auditDate] !== undefined) {
        counts[r.qa][r.auditDate]++;
        rowTotals[r.qa]++;
        colTotals[r.auditDate]++;
      }
    });

    function formatDateHeader(dStr) {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        const monNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const mIdx = parseInt(parts[1], 10) - 1;
        return `${parseInt(parts[2], 10)} ${monNames[mIdx] || parts[1]}`;
      }
      return dStr;
    }

    let html = `<table class="qa-matrix-table">
      <thead>
        <tr>
          <th class="qa-col-header">Quality Analyst</th>`;

    dates.forEach(d => {
      html += `<th title="${d}">${formatDateHeader(d)}</th>`;
    });

    html += `<th>Total</th><th>Avg/Day</th></tr></thead><tbody>`;

    let grandTotal = 0;

    qas.forEach(qa => {
      const initial = qa.charAt(0);
      const total = rowTotals[qa];
      grandTotal += total;
      const activeDays = dates.filter(d => counts[qa][d] > 0).length;
      const avg = activeDays > 0 ? (total / activeDays).toFixed(1) : '0.0';

      html += `<tr>
        <td class="qa-name-cell" title="Filter by ${qa}" onclick="window.filterByQA('${qa}')">
          <span class="qa-avatar-sm">${initial}</span>
          <span>${qa}</span>
        </td>`;

      dates.forEach(d => {
        const c = counts[qa][d];
        let heatClass = 'heat-0';
        if (c >= 15) heatClass = 'heat-peak';
        else if (c >= 8) heatClass = 'heat-high';
        else if (c >= 4) heatClass = 'heat-med';
        else if (c >= 1) heatClass = 'heat-low';

        html += `<td class="heat-cell ${heatClass}" title="${qa} on ${d}: ${c} audits" onclick="window.filterByQADate('${qa}', '${d}')">
          ${c > 0 ? c : '-'}
        </td>`;
      });

      html += `<td style="font-weight: 800; color: var(--accent-blue);">${total}</td>
        <td style="color: var(--text-muted); font-weight: 600;">${avg}</td>
      </tr>`;
    });

    html += `<tr class="total-row">
      <td class="qa-name-cell" style="font-weight: 800; color: var(--accent-blue);">Daily Output Total</td>`;

    dates.forEach(d => {
      const c = colTotals[d];
      html += `<td>${c > 0 ? c : '-'}</td>`;
    });

    const overallAvg = dates.length > 0 ? (grandTotal / dates.length).toFixed(1) : '0.0';
    html += `<td>${grandTotal}</td><td>${overallAvg}</td></tr>`;

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  // 8. QA Leaderboard
  function renderQALeaderboard() {
    const container = document.getElementById('qaLeaderboardGrid');
    if (!container) return;

    const data = state.filteredData;
    const qaStats = {};

    data.forEach(r => {
      if (!r.qa || r.qa === 'Unassigned') return;
      if (!qaStats[r.qa]) {
        qaStats[r.qa] = {
          name: r.qa,
          total: 0,
          pass: 0,
          fail: 0,
          feedbackClosed: 0,
          validated: 0,
          rocs: {}
        };
      }
      const st = qaStats[r.qa];
      st.total++;
      if (r.passFailStatus === 'Pass') st.pass++;
      if (r.passFailStatus === 'Fail') st.fail++;
      if (r.feedbackStatus === 'Closed (Given)') st.feedbackClosed++;
      if (r.validationStatus === 'Validated') st.validated++;
      if (r.roc) st.rocs[r.roc] = (st.rocs[r.roc] || 0) + 1;
    });

    const sortedQAs = Object.values(qaStats).sort((a, b) => b.total - a.total);

    if (sortedQAs.length === 0) {
      container.innerHTML = `<div style="padding: 20px; color: var(--text-muted);">No QA data available.</div>`;
      return;
    }

    let html = '';
    sortedQAs.forEach(st => {
      const evaluated = st.pass + st.fail;
      const passPct = evaluated > 0 ? ((st.pass / evaluated) * 100).toFixed(0) : 0;
      const failPct = evaluated > 0 ? ((st.fail / evaluated) * 100).toFixed(0) : 0;
      const fbPct = st.total > 0 ? ((st.feedbackClosed / st.total) * 100).toFixed(0) : 0;
      const topROC = Object.entries(st.rocs).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
      const isActive = state.filters.qa === st.name ? 'active' : '';

      html += `
        <div class="qa-card glass-panel ${isActive}" onclick="window.filterByQA('${st.name}')">
          <div class="qa-card-header">
            <div class="qa-avatar-lg">${st.name.charAt(0)}</div>
            <div>
              <div class="qa-card-name">${st.name}</div>
              <div class="qa-card-role">Primary ROC: ${topROC}</div>
            </div>
          </div>
          <div class="qa-card-stats">
            <div class="qa-stat-item">
              <div class="val">${st.total}</div>
              <div class="lbl">Audits</div>
            </div>
            <div class="qa-stat-item">
              <div class="val" style="color: #059669;">${passPct}%</div>
              <div class="lbl">Pass Rate</div>
            </div>
            <div class="qa-stat-item">
              <div class="val" style="color: #7c3aed;">${fbPct}%</div>
              <div class="lbl">Feedback</div>
            </div>
          </div>
          <div class="qa-card-progress">
            <div class="progress-labels">
              <span>Pass: ${st.pass} (${passPct}%)</span>
              <span>Fail: ${st.fail} (${failPct}%)</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-fill fill-pass" style="width: ${passPct}%;"></div>
              <div class="progress-fill fill-fail" style="width: ${failPct}%;"></div>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // 9. Charts Manager (Safe Execution)
  function renderActiveTabCharts() {
    if (typeof Chart === 'undefined') return;

    try {
      switch (state.activeTab) {
        case 'tab-overview':
          renderOverviewCharts();
          break;
        case 'tab-productivity':
          renderProductivityCharts();
          break;
        case 'tab-trends':
          renderTrendsCharts();
          break;
        case 'tab-detractors':
          renderDetractorCharts();
          break;
        case 'tab-passfail':
          renderPassFailCharts();
          break;
        case 'tab-feedback':
          renderFeedbackCharts();
          break;
      }
    } catch (e) {
      console.warn("Chart render skipped for hidden/unmounted tab:", e);
    }
  }

  function destroyChart(id) {
    if (state.charts[id]) {
      try { state.charts[id].destroy(); } catch (e) {}
      delete state.charts[id];
    }
  }

  function renderOverviewCharts() {
    const data = state.filteredData;
    const dayMap = {};
    data.forEach(r => {
      const d = r.responseDate || r.auditDate;
      if (d) {
        if (!dayMap[d]) dayMap[d] = { pass: 0, fail: 0, total: 0 };
        if (r.passFailStatus === 'Pass') dayMap[d].pass++;
        else if (r.passFailStatus === 'Fail') dayMap[d].fail++;
        dayMap[d].total++;
      }
    });

    const sortedDates = Object.keys(dayMap).sort();
    const passArr = sortedDates.map(d => dayMap[d].pass);
    const failArr = sortedDates.map(d => dayMap[d].fail);
    const totalArr = sortedDates.map(d => dayMap[d].total);

    let peakDate = '', peakCount = 0;
    sortedDates.forEach(d => {
      if (dayMap[d].total > peakCount) {
        peakCount = dayMap[d].total;
        peakDate = d;
      }
    });
    const peakEl = document.getElementById('overviewPeakBadge');
    if (peakEl && peakCount > 0) {
      peakEl.textContent = `Peak: ${peakCount} on ${peakDate}`;
    }

    destroyChart('overviewDayChart');
    const canvasDay = document.getElementById('overviewDayChart');
    if (canvasDay && canvasDay.offsetParent !== null) {
      const ctxDay = canvasDay.getContext('2d');
      state.charts['overviewDayChart'] = new Chart(ctxDay, {
        type: 'bar',
        data: {
          labels: sortedDates.map(d => d.slice(5)),
          datasets: [
            { label: 'Passed', data: passArr, backgroundColor: colors.emerald, stack: 's1', borderRadius: 4 },
            { label: 'Failed', data: failArr, backgroundColor: colors.rose, stack: 's1', borderRadius: 4 },
            { label: 'Total Trend', data: totalArr, type: 'line', borderColor: colors.blue, backgroundColor: 'rgba(37,99,235,0.1)', tension: 0.35, borderWidth: 2, pointRadius: 3 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { color: colors.text } } },
          scales: {
            x: { ticks: { color: colors.text, maxRotation: 45 }, grid: { color: colors.grid } },
            y: { ticks: { color: colors.text }, grid: { color: colors.grid } }
          }
        }
      });
    }

    const passCount = data.filter(r => r.passFailStatus === 'Pass').length;
    const failCount = data.filter(r => r.passFailStatus === 'Fail').length;
    const pendingCount = data.filter(r => r.passFailStatus !== 'Pass' && r.passFailStatus !== 'Fail').length;

    destroyChart('overviewPassFailChart');
    const canvasPF = document.getElementById('overviewPassFailChart');
    if (canvasPF && canvasPF.offsetParent !== null) {
      const ctxPF = canvasPF.getContext('2d');
      state.charts['overviewPassFailChart'] = new Chart(ctxPF, {
        type: 'doughnut',
        data: {
          labels: ['Pass', 'Fail', 'Pending / Other'],
          datasets: [{ data: [passCount, failCount, pendingCount], backgroundColor: [colors.emerald, colors.rose, colors.slate], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: colors.text } } } }
      });
    }

    const qaMap = {};
    data.forEach(r => { if (r.qa && r.qa !== 'Unassigned') qaMap[r.qa] = (qaMap[r.qa] || 0) + 1; });
    const sortedQAs = Object.entries(qaMap).sort((a, b) => b[1] - a[1]);

    destroyChart('overviewQAChart');
    const canvasQA = document.getElementById('overviewQAChart');
    if (canvasQA && canvasQA.offsetParent !== null) {
      const ctxQA = canvasQA.getContext('2d');
      state.charts['overviewQAChart'] = new Chart(ctxQA, {
        type: 'bar',
        data: { labels: sortedQAs.map(q => q[0]), datasets: [{ label: 'Audits Completed', data: sortedQAs.map(q => q[1]), backgroundColor: qaPalette, borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { color: colors.text }, grid: { color: colors.grid } }, y: { ticks: { color: colors.text }, grid: { display: false } } } }
      });
    }

    const l1Map = {};
    data.forEach(r => { if (r.cxL1 && r.cxL1.length < 50) l1Map[r.cxL1] = (l1Map[r.cxL1] || 0) + 1; });
    const sortedL1 = Object.entries(l1Map).sort((a, b) => b[1] - a[1]).slice(0, 5);

    destroyChart('overviewCxL1Chart');
    const canvasL1 = document.getElementById('overviewCxL1Chart');
    if (canvasL1 && canvasL1.offsetParent !== null) {
      const ctxL1 = canvasL1.getContext('2d');
      state.charts['overviewCxL1Chart'] = new Chart(ctxL1, {
        type: 'bar',
        data: { labels: sortedL1.map(l => l[0].length > 22 ? l[0].slice(0, 20) + '...' : l[0]), datasets: [{ label: 'Detractors', data: sortedL1.map(l => l[1]), backgroundColor: colors.amber, borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { color: colors.text }, grid: { color: colors.grid } }, y: { ticks: { color: colors.text }, grid: { display: false } } } }
      });
    }

    const rocMap = {};
    data.forEach(r => { if (r.roc && r.roc !== 'Unassigned' && r.roc !== '#N/A') rocMap[r.roc] = (rocMap[r.roc] || 0) + 1; });
    const sortedROC = Object.entries(rocMap).sort((a, b) => b[1] - a[1]);

    destroyChart('overviewROCChart');
    const canvasROC = document.getElementById('overviewROCChart');
    if (canvasROC && canvasROC.offsetParent !== null) {
      const ctxROC = canvasROC.getContext('2d');
      state.charts['overviewROCChart'] = new Chart(ctxROC, {
        type: 'doughnut',
        data: { labels: sortedROC.map(r => r[0]), datasets: [{ data: sortedROC.map(r => r[1]), backgroundColor: [colors.blue, colors.indigo, colors.cyan, colors.purple], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: colors.text } } } }
      });
    }
  }

  function renderProductivityCharts() {
    const data = state.filteredData;
    const datesSet = new Set();
    const qasSet = new Set();

    data.forEach(r => {
      if (r.auditDate) datesSet.add(r.auditDate);
      if (r.qa && r.qa !== 'Unassigned') qasSet.add(r.qa);
    });

    const dates = Array.from(datesSet).sort();
    const qas = Array.from(qasSet).sort();

    const datasets = qas.map((qa, idx) => {
      const counts = dates.map(d => data.filter(r => r.qa === qa && r.auditDate === d).length);
      return {
        label: qa,
        data: counts,
        backgroundColor: qaPalette[idx % qaPalette.length],
        stack: 'qaStack',
        borderRadius: 2
      };
    });

    destroyChart('qaDayStackedChart');
    const canvas = document.getElementById('qaDayStackedChart');
    if (canvas && canvas.offsetParent !== null) {
      const ctx = canvas.getContext('2d');
      state.charts['qaDayStackedChart'] = new Chart(ctx, {
        type: 'bar',
        data: { labels: dates.map(d => d.slice(5)), datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { color: colors.text } } },
          scales: {
            x: { ticks: { color: colors.text, maxRotation: 45 }, grid: { color: colors.grid } },
            y: { ticks: { color: colors.text }, grid: { color: colors.grid } }
          }
        }
      });
    }
  }

  function renderTrendsCharts() {
    const data = state.filteredData;
    const dayMap = {};

    data.forEach(r => {
      const d = r.responseDate || r.auditDate;
      if (d) {
        if (!dayMap[d]) dayMap[d] = { pass: 0, fail: 0, total: 0 };
        if (r.passFailStatus === 'Pass') dayMap[d].pass++;
        else if (r.passFailStatus === 'Fail') dayMap[d].fail++;
        dayMap[d].total++;
      }
    });

    const dates = Object.keys(dayMap).sort();
    const totals = dates.map(d => dayMap[d].total);
    const passes = dates.map(d => dayMap[d].pass);
    const fails = dates.map(d => dayMap[d].fail);

    const rollingAvg = totals.map((val, idx, arr) => {
      const start = Math.max(0, idx - 6);
      const sub = arr.slice(start, idx + 1);
      const sum = sub.reduce((a, b) => a + b, 0);
      return (sum / sub.length).toFixed(1);
    });

    let cum = 0;
    const cumulative = totals.map(v => { cum += v; return cum; });

    destroyChart('trendsDailyChart');
    const canvasDaily = document.getElementById('trendsDailyChart');
    if (canvasDaily && canvasDaily.offsetParent !== null) {
      const ctxDaily = canvasDaily.getContext('2d');
      state.charts['trendsDailyChart'] = new Chart(ctxDaily, {
        type: 'bar',
        data: {
          labels: dates.map(d => d.slice(5)),
          datasets: [
            { label: 'Daily Volume', data: totals, backgroundColor: 'rgba(2, 132, 199, 0.4)', borderColor: colors.cyan, borderWidth: 1, borderRadius: 4 },
            { label: '7-Day Moving Avg', data: rollingAvg, type: 'line', borderColor: colors.amber, borderWidth: 2, tension: 0.3, pointRadius: 2 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: colors.text } } },
          scales: { x: { ticks: { color: colors.text }, grid: { color: colors.grid } }, y: { ticks: { color: colors.text }, grid: { color: colors.grid } } }
        }
      });
    }

    destroyChart('trendsCumulativeChart');
    const canvasCum = document.getElementById('trendsCumulativeChart');
    if (canvasCum && canvasCum.offsetParent !== null) {
      const ctxCum = canvasCum.getContext('2d');
      state.charts['trendsCumulativeChart'] = new Chart(ctxCum, {
        type: 'line',
        data: {
          labels: dates.map(d => d.slice(5)),
          datasets: [{ label: 'Cumulative Trajectory', data: cumulative, borderColor: colors.indigo, backgroundColor: 'rgba(79, 70, 229, 0.1)', fill: true, tension: 0.3, borderWidth: 3, pointRadius: 2 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: colors.text } } },
          scales: { x: { ticks: { color: colors.text }, grid: { color: colors.grid } }, y: { ticks: { color: colors.text }, grid: { color: colors.grid } } }
        }
      });
    }

    destroyChart('trendsPassFailStackedChart');
    const canvasPF = document.getElementById('trendsPassFailStackedChart');
    if (canvasPF && canvasPF.offsetParent !== null) {
      const ctxPF = canvasPF.getContext('2d');
      state.charts['trendsPassFailStackedChart'] = new Chart(ctxPF, {
        type: 'bar',
        data: {
          labels: dates.map(d => d.slice(5)),
          datasets: [
            { label: 'Pass', data: passes, backgroundColor: colors.emerald, stack: 'pfs' },
            { label: 'Fail', data: fails, backgroundColor: colors.rose, stack: 'pfs' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: colors.text } } },
          scales: { x: { ticks: { color: colors.text }, grid: { color: colors.grid } }, y: { ticks: { color: colors.text }, grid: { color: colors.grid } } }
        }
      });
    }
  }

  function renderDetractorCharts() {
    const data = state.filteredData;
    const l1Map = {};
    data.forEach(r => { if (r.cxL1 && r.cxL1.length < 60) l1Map[r.cxL1] = (l1Map[r.cxL1] || 0) + 1; });
    const sortedL1 = Object.entries(l1Map).sort((a, b) => b[1] - a[1]).slice(0, 8);

    destroyChart('detractorL1Chart');
    const canvasL1 = document.getElementById('detractorL1Chart');
    if (canvasL1 && canvasL1.offsetParent !== null) {
      const ctxL1 = canvasL1.getContext('2d');
      state.charts['detractorL1Chart'] = new Chart(ctxL1, {
        type: 'bar',
        data: { labels: sortedL1.map(l => l[0]), datasets: [{ label: 'Detractors', data: sortedL1.map(l => l[1]), backgroundColor: colors.rose, borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { color: colors.text }, grid: { color: colors.grid } }, y: { ticks: { color: colors.text }, grid: { display: false } } } }
      });
    }

    const l2Map = {};
    data.forEach(r => { if (r.cxL2 && r.cxL2 !== 'Yes' && r.cxL2 !== 'No') l2Map[r.cxL2] = (l2Map[r.cxL2] || 0) + 1; });
    const sortedL2 = Object.entries(l2Map).sort((a, b) => b[1] - a[1]).slice(0, 8);

    destroyChart('detractorL2Chart');
    const canvasL2 = document.getElementById('detractorL2Chart');
    if (canvasL2 && canvasL2.offsetParent !== null) {
      const ctxL2 = canvasL2.getContext('2d');
      state.charts['detractorL2Chart'] = new Chart(ctxL2, {
        type: 'bar',
        data: { labels: sortedL2.map(l => l[0]), datasets: [{ label: 'Sub-issues', data: sortedL2.map(l => l[1]), backgroundColor: colors.amber, borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { color: colors.text }, grid: { color: colors.grid } }, y: { ticks: { color: colors.text }, grid: { display: false } } } }
      });
    }

    let corYes = 0, corNo = 0, corOther = 0;
    data.forEach(r => {
      const c = (r.correlation || '').toLowerCase();
      if (c.includes('yes')) corYes++;
      else if (c.includes('no')) corNo++;
      else if (c) corOther++;
    });

    destroyChart('correlationChart');
    const canvasCor = document.getElementById('correlationChart');
    if (canvasCor && canvasCor.offsetParent !== null) {
      const ctxCor = canvasCor.getContext('2d');
      state.charts['correlationChart'] = new Chart(ctxCor, {
        type: 'doughnut',
        data: { labels: ['CX Issue Confirmed', 'Does Not Correlate', 'Other'], datasets: [{ data: [corYes, corNo, corOther], backgroundColor: [colors.rose, colors.emerald, colors.slate], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: colors.text } } } }
      });
    }

    const rocMap = {};
    data.forEach(r => { if (r.roc && r.roc !== 'Unassigned' && r.roc !== '#N/A') rocMap[r.roc] = (rocMap[r.roc] || 0) + 1; });

    destroyChart('rocDetractorChart');
    const canvasRoc = document.getElementById('rocDetractorChart');
    if (canvasRoc && canvasRoc.offsetParent !== null) {
      const ctxRoc = canvasRoc.getContext('2d');
      state.charts['rocDetractorChart'] = new Chart(ctxRoc, {
        type: 'bar',
        data: { labels: Object.keys(rocMap), datasets: [{ label: 'Detractors by ROC Hub', data: Object.values(rocMap), backgroundColor: [colors.blue, colors.purple, colors.teal], borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: colors.text }, grid: { color: colors.grid } }, y: { ticks: { color: colors.text }, grid: { color: colors.grid } } } }
      });
    }
  }

  function renderPassFailCharts() {
    const data = state.filteredData;
    const gapMap = {};
    data.filter(r => r.passFailStatus === 'Fail').forEach(r => {
      const b = r.auditorBucket || '';
      const parts = b.split(/[,;\n]/).map(p => p.trim()).filter(Boolean);
      parts.forEach(p => {
        if (!p.toLowerCase().includes('no gaps found')) gapMap[p] = (gapMap[p] || 0) + 1;
      });
    });

    const sortedGaps = Object.entries(gapMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

    destroyChart('gapBucketsChart');
    const canvasGap = document.getElementById('gapBucketsChart');
    if (canvasGap && canvasGap.offsetParent !== null) {
      const ctxGap = canvasGap.getContext('2d');
      state.charts['gapBucketsChart'] = new Chart(ctxGap, {
        type: 'bar',
        data: { labels: sortedGaps.map(g => g[0].length > 28 ? g[0].slice(0, 26) + '...' : g[0]), datasets: [{ label: 'Gap Frequency in Failed Audits', data: sortedGaps.map(g => g[1]), backgroundColor: colors.rose, borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { color: colors.text }, grid: { color: colors.grid } }, y: { ticks: { color: colors.text }, grid: { display: false } } } }
      });
    }

    const stepKeys = [
      { key: 'history', label: 'History' },
      { key: 'ar', label: 'AR Taken' },
      { key: 'pgp', label: 'PGP Verification' },
      { key: 'pdAdjustment', label: 'PD & Phoropter' },
      { key: 'distanceVision', label: 'Distance Vision' },
      { key: 'subjectiveRefraction', label: 'Subj Refraction' },
      { key: 'fogging', label: 'Fogging/Sph Corr' },
      { key: 'duochrome', label: 'Duochrome' },
      { key: 'jcc', label: 'JCC Performed' },
      { key: 'binocularBalancing', label: 'Binoc Balancing' },
      { key: 'nearVision', label: 'Near Vision' },
      { key: 'walkingTrial', label: 'Walking Trial' },
      { key: 'prescriptionExplanation', label: 'Rx Explanation' },
      { key: 'handover', label: 'Store Handover' }
    ];

    const adherence = stepKeys.map(st => {
      let yesCount = 0, evaluated = 0;
      data.forEach(r => {
        const val = (r[st.key] || '').toLowerCase().trim();
        if (val === 'yes' || val === 'p') { yesCount++; evaluated++; }
        else if (val === 'no' || val === 'f') { evaluated++; }
      });
      const pct = evaluated > 0 ? ((yesCount / evaluated) * 100).toFixed(1) : 0;
      return { label: st.label, pct: parseFloat(pct) };
    });

    destroyChart('sopAdherenceChart');
    const canvasSOP = document.getElementById('sopAdherenceChart');
    if (canvasSOP && canvasSOP.offsetParent !== null) {
      const ctxSOP = canvasSOP.getContext('2d');
      state.charts['sopAdherenceChart'] = new Chart(ctxSOP, {
        type: 'bar',
        data: {
          labels: adherence.map(a => a.label),
          datasets: [{ label: 'Adherence %', data: adherence.map(a => a.pct), backgroundColor: adherence.map(a => a.pct >= 80 ? colors.emerald : a.pct >= 60 ? colors.amber : colors.rose), borderRadius: 6 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { max: 100, ticks: { callback: v => v + '%', color: colors.text }, grid: { color: colors.grid } }, y: { ticks: { color: colors.text }, grid: { display: false } } }
        }
      });
    }
  }

  function renderFeedbackCharts() {
    const data = state.filteredData;
    const fbClosed = data.filter(r => r.feedbackStatus === 'Closed (Given)').length;
    const fbPending = data.filter(r => r.feedbackStatus === 'Pending / Not Closed').length;
    const fbNA = data.filter(r => r.feedbackStatus === 'N/A').length;

    destroyChart('feedbackStatusChart');
    const canvasFb = document.getElementById('feedbackStatusChart');
    if (canvasFb && canvasFb.offsetParent !== null) {
      const ctxFb = canvasFb.getContext('2d');
      state.charts['feedbackStatusChart'] = new Chart(ctxFb, {
        type: 'doughnut',
        data: { labels: ['Closed / Given', 'Pending', 'N/A'], datasets: [{ data: [fbClosed, fbPending, fbNA], backgroundColor: [colors.purple, colors.amber, colors.slate], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: colors.text } } } }
      });
    }

    const valDone = data.filter(r => r.validationStatus === 'Validated').length;
    const valNotDone = data.filter(r => r.validationStatus === 'Not Validated').length;
    const valPending = data.filter(r => r.validationStatus === 'Pending Validation').length;

    destroyChart('validationStatusChart');
    const canvasVal = document.getElementById('validationStatusChart');
    if (canvasVal && canvasVal.offsetParent !== null) {
      const ctxVal = canvasVal.getContext('2d');
      state.charts['validationStatusChart'] = new Chart(ctxVal, {
        type: 'doughnut',
        data: { labels: ['Validated', 'Not Validated', 'Pending Review'], datasets: [{ data: [valDone, valNotDone, valPending], backgroundColor: [colors.teal, colors.rose, colors.slate], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: colors.text } } } }
      });
    }

    let vidYes = 0, vidNo = 0, vidPending = 0;
    data.forEach(r => {
      const v = (r.videoShown || '').toLowerCase();
      if (v.includes('yes')) vidYes++;
      else if (v.includes('no')) vidNo++;
      else vidPending++;
    });

    destroyChart('videoShownChart');
    const canvasVid = document.getElementById('videoShownChart');
    if (canvasVid && canvasVid.offsetParent !== null) {
      const ctxVid = canvasVid.getContext('2d');
      state.charts['videoShownChart'] = new Chart(ctxVid, {
        type: 'doughnut',
        data: { labels: ['Video Shown', 'Video Not Shown', 'Pending'], datasets: [{ data: [vidYes, vidNo, vidPending], backgroundColor: [colors.cyan, colors.rose, colors.slate], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: colors.text } } } }
      });
    }

    const qaFb = {};
    data.forEach(r => {
      if (r.qa && r.qa !== 'Unassigned') {
        if (!qaFb[r.qa]) qaFb[r.qa] = { closed: 0, pending: 0 };
        if (r.feedbackStatus === 'Closed (Given)') qaFb[r.qa].closed++;
        else if (r.feedbackStatus === 'Pending / Not Closed') qaFb[r.qa].pending++;
      }
    });

    const qas = Object.keys(qaFb).sort();

    destroyChart('feedbackByQAChart');
    const canvasFbQA = document.getElementById('feedbackByQAChart');
    if (canvasFbQA && canvasFbQA.offsetParent !== null) {
      const ctxFbQA = canvasFbQA.getContext('2d');
      state.charts['feedbackByQAChart'] = new Chart(ctxFbQA, {
        type: 'bar',
        data: {
          labels: qas,
          datasets: [
            { label: 'Feedback Closed', data: qas.map(q => qaFb[q].closed), backgroundColor: colors.purple },
            { label: 'Feedback Pending', data: qas.map(q => qaFb[q].pending), backgroundColor: colors.amber }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { color: colors.text } } },
          scales: { x: { ticks: { color: colors.text }, grid: { color: colors.grid } }, y: { ticks: { color: colors.text }, grid: { color: colors.grid } } }
        }
      });
    }
  }

  // 10. Records Table
  function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    const data = [...state.filteredData];
    const { sortCol, sortAsc, page, pageSize } = state.table;

    data.sort((a, b) => {
      let va = a[sortCol] || '';
      let vb = b[sortCol] || '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    const total = data.length;
    const startIdx = (page - 1) * pageSize;
    const paged = data.slice(startIdx, startIdx + pageSize);

    if (paged.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 32px; color: var(--text-muted);">No records found matching filters.</td></tr>`;
      renderPagination(0, 0, 0);
      return;
    }

    let html = '';
    paged.forEach(r => {
      let pfBadge = 'badge-pending';
      if (r.passFailStatus === 'Pass') pfBadge = 'badge-pass';
      else if (r.passFailStatus === 'Fail') pfBadge = 'badge-fail';

      let fbBadge = 'badge-pending';
      if (r.feedbackStatus === 'Closed (Given)') fbBadge = 'badge-closed';

      let valBadge = 'badge-pending';
      if (r.validationStatus === 'Validated') valBadge = 'badge-validated';
      else if (r.validationStatus === 'Not Validated') valBadge = 'badge-fail';

      const shortL1 = (r.cxL1 || '-').length > 30 ? (r.cxL1 || '').slice(0, 28) + '...' : (r.cxL1 || '-');
      const shortGap = (r.auditorBucket || '-').length > 30 ? (r.auditorBucket || '').slice(0, 28) + '...' : (r.auditorBucket || '-');

      html += `
        <tr>
          <td><strong>${r.responseDateRaw || r.responseDate || '-'}</strong></td>
          <td><span style="font-weight: 700; color: var(--text-primary);">${r.qa}</span></td>
          <td>
            <div>${r.roName}</div>
            <div style="font-size: 0.7rem; color: var(--text-muted);">ID: ${r.roId || 'N/A'}</div>
          </td>
          <td>${r.roc || '-'}</td>
          <td><span class="badge ${pfBadge}">${r.passFailStatus}</span></td>
          <td><span class="badge ${fbBadge}">${r.feedbackStatus}</span></td>
          <td><span class="badge ${valBadge}">${r.validationStatus}</span></td>
          <td title="${r.cxL1 || ''}">${shortL1}</td>
          <td title="${r.auditorBucket || ''}">${shortGap}</td>
          <td>
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="window.viewRecordDetails(${r.id})">
              Details
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    const endIdx = Math.min(startIdx + pageSize, total);
    const tableInfo = document.getElementById('tableInfo');
    if (tableInfo) tableInfo.textContent = `Showing ${startIdx + 1} to ${endIdx} of ${total} records`;
    renderPagination(total, page, pageSize);
  }

  function renderPagination(total, page, pageSize) {
    const container = document.getElementById('tablePagination');
    if (!container) return;

    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button class="page-btn" ${page === 1 ? 'disabled' : ''} onclick="window.changePage(${page - 1})">Prev</button>`;

    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, page + 2);

    for (let p = startPage; p <= endPage; p++) {
      html += `<button class="page-btn ${p === page ? 'active' : ''}" onclick="window.changePage(${p})">${p}</button>`;
    }

    html += `<button class="page-btn ${page === totalPages ? 'disabled' : ''} onclick="window.changePage(${page + 1})">Next</button>`;
    container.innerHTML = html;
  }

  // 11. Record Details Modal
  window.viewRecordDetails = function (recordId) {
    const r = state.allData.find(item => item.id === recordId);
    if (!r) return;

    const titleEl = document.getElementById('modalTitle');
    if (titleEl) titleEl.textContent = `Audit Record #${r.responseId || r.id} - ${r.roName}`;

    let pfBadge = r.passFailStatus === 'Pass' ? 'badge-pass' : r.passFailStatus === 'Fail' ? 'badge-fail' : 'badge-pending';
    let fbBadge = r.feedbackStatus === 'Closed (Given)' ? 'badge-closed' : 'badge-pending';
    let valBadge = r.validationStatus === 'Validated' ? 'badge-validated' : r.validationStatus === 'Not Validated' ? 'badge-fail' : 'badge-pending';

    const modalBody = document.getElementById('modalBody');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="detail-section">
          <div class="detail-section-title">Evaluation Summary & Metadata</div>
          <div class="detail-grid">
            <div class="detail-item">
              <div class="lbl">Quality Analyst</div>
              <div class="val">${r.qa}</div>
            </div>
            <div class="detail-item">
              <div class="lbl">Response Date & Audit Date</div>
              <div class="val">${r.responseDateRaw || r.responseDate || 'N/A'} (Audit: ${r.auditDateRaw || r.auditDate || 'Pending'})</div>
            </div>
            <div class="detail-item">
              <div class="lbl">Audit Result</div>
              <div class="val"><span class="badge ${pfBadge}">${r.passFailStatus}</span></div>
            </div>
            <div class="detail-item">
              <div class="lbl">Feedback Closed</div>
              <div class="val"><span class="badge ${fbBadge}">${r.feedbackStatus}</span> (${r.feedbackRaw || 'None'})</div>
            </div>
            <div class="detail-item">
              <div class="lbl">Audit Validation</div>
              <div class="val"><span class="badge ${valBadge}">${r.validationStatus}</span></div>
            </div>
            <div class="detail-item">
              <div class="lbl">Video Shown to RO</div>
              <div class="val">${r.videoShown || 'Pending'}</div>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Optometrist & Facility Information</div>
          <div class="detail-grid">
            <div class="detail-item">
              <div class="lbl">Remote Optometrist (RO)</div>
              <div class="val">${r.roName} (ID: ${r.roId || 'N/A'})</div>
            </div>
            <div class="detail-item">
              <div class="lbl">ROC Hub & Facility Code</div>
              <div class="val">${r.roc} • ${r.facilityCode || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="lbl">RO Experience Category</div>
              <div class="val">${r.category}</div>
            </div>
            <div class="detail-item">
              <div class="lbl">SME Assigned</div>
              <div class="val">${r.sme || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Customer Detractor Feedback & Correlation</div>
          <div class="detail-grid" style="margin-bottom: 8px;">
            <div class="detail-item">
              <div class="lbl">Customer L1 Bucket</div>
              <div class="val" style="color: #e11d48;">${r.cxL1 || 'Not Specified'}</div>
            </div>
            <div class="detail-item">
              <div class="lbl">Customer L2 Sub-Bucket</div>
              <div class="val">${r.cxL2 || 'Not Specified'}</div>
            </div>
          </div>
          ${r.cxComment ? `
            <div class="detail-item" style="margin-bottom: 8px;">
              <div class="lbl">Customer Verbatim Comment</div>
              <div class="val" style="font-style: italic; font-weight: normal; margin-top: 4px;">"${r.cxComment}"</div>
            </div>
          ` : ''}
          <div class="detail-item">
            <div class="lbl">Auditor Correlation with CX Feedback</div>
            <div class="val">${r.correlation || 'N/A'} • ${r.remarksCorrelation || ''}</div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Auditor Observations & Quality Gaps</div>
          <div class="detail-item" style="margin-bottom: 8px;">
            <div class="lbl">Auditor Gap Bucket(s)</div>
            <div class="val" style="color: #d97706;">${r.auditorBucket || 'No gaps identified'}</div>
          </div>
          <div class="detail-item">
            <div class="lbl">Detailed Auditor Remarks & Clinical Findings</div>
            <div class="detail-comment-box">${r.auditorComment || 'No comments recorded.'}</div>
          </div>
        </div>
      `;
    }

    const modal = document.getElementById('auditDetailModal');
    if (modal) modal.classList.add('active');
  };

  // 12. Helpers
  window.changePage = function (newPage) {
    state.table.page = newPage;
    renderTable();
  };

  window.filterByQA = function (qaName) {
    const el = document.getElementById('filterQA');
    if (el) el.value = qaName;
    state.filters.qa = qaName;
    applyFilters();
  };

  window.filterByQADate = function (qaName, dateStr) {
    const elQA = document.getElementById('filterQA');
    const elFrom = document.getElementById('filterDateFrom');
    const elTo = document.getElementById('filterDateTo');
    if (elQA) elQA.value = qaName;
    if (elFrom) elFrom.value = dateStr;
    if (elTo) elTo.value = dateStr;
    state.filters.qa = qaName;
    state.filters.dateFrom = dateStr;
    state.filters.dateTo = dateStr;
    applyFilters();
  };

  // 13. Google Sheet Sync Handler
  async function triggerGoogleSheetSync() {
    const btn = document.getElementById('btnSyncGoogleSheet');
    const textSpan = document.getElementById('syncBtnText');
    if (btn) btn.classList.add('syncing');
    if (textSpan) textSpan.textContent = 'Syncing...';

    try {
      const response = await fetch('/api/sync', { method: 'GET' });
      const res = await response.json();

      if (res.success) {
        if (textSpan) textSpan.textContent = 'Updated!';
        const badge = document.getElementById('liveDataBadge');
        if (badge) badge.textContent = `Synced (${res.recordsCount} rows)`;
        setTimeout(() => {
          if (textSpan) textSpan.textContent = 'Sync Google Sheet';
          if (btn) btn.classList.remove('syncing');
        }, 2000);

        const dataRes = await fetch('data.json?t=' + Date.now());
        const freshData = await dataRes.json();
        state.allData = freshData;
        window.AUDIT_DATA = freshData;
        onDataReady();
        alert(res.message || "Google Sheet data successfully refreshed!");
      } else {
        alert("Sync issue: " + (res.error || "Unable to sync directly."));
        if (btn) btn.classList.remove('syncing');
        if (textSpan) textSpan.textContent = 'Sync Google Sheet';
      }
    } catch (err) {
      console.warn("Local sync API error or running as static file:", err);
      location.reload();
    }
  }

  // 14. Export Complete Summary View to CSV
  function exportCompleteViewCSV() {
    const tables = [
      { id: 'tbodyOverall', title: 'Overall' },
      { id: 'tbodyRocKol', title: 'ROC - KOL' },
      { id: 'tbodyRocLucknow', title: 'ROC - Lucknow' },
      { id: 'tbodyRocDelta', title: 'ROC - Delta Tower' }
    ];

    let csvContent = "data:text/csv;charset=utf-8,";

    tables.forEach(t => {
      csvContent += `"${t.title}"\n`;
      csvContent += `"Date","Detractor","Audit Completed","Feedback Shared","Ops Validated"\n`;
      const tbody = document.getElementById(t.id);
      if (tbody) {
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td')).map(td => `"${td.innerText.trim()}"`);
          csvContent += cells.join(',') + '\n';
        });
      }
      csvContent += '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ROC_Detractor_Audit_Summary_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 15. Export All Filtered Records CSV
  function exportCSV() {
    const data = state.filteredData;
    if (data.length === 0) {
      alert("No records to export.");
      return;
    }

    const headers = [
      'ID', 'Response ID', 'Response Date', 'Audit Date', 'QA Analyst', 'RO Name', 'RO Optom ID',
      'ROC', 'Facility Code', 'Pass/Fail Status', 'Customer L1 Bucket', 'Customer L2 Bucket',
      'Auditor Gap Bucket', 'Feedback Status', 'Audit Validation', 'Video Shown'
    ];

    const rows = data.map(r => [
      r.id,
      r.responseId,
      r.responseDateRaw || r.responseDate || '',
      r.auditDate || r.auditDateRaw || '',
      `"${r.qa}"`,
      `"${r.roName}"`,
      r.roId,
      `"${r.roc}"`,
      r.facilityCode,
      `"${r.passFailStatus}"`,
      `"${(r.cxL1 || '').replace(/"/g, '""')}"`,
      `"${(r.cxL2 || '').replace(/"/g, '""')}"`,
      `"${(r.auditorBucket || '').replace(/"/g, '""')}"`,
      `"${r.feedbackStatus}"`,
      `"${r.validationStatus}"`,
      `"${r.videoShown || ''}"`
    ]);

    let csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Remote_Optometry_QA_Audits_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 16. Event Listeners Setup
  function setupEventListeners() {
    // Tab switching (Resilient implementation)
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = btn.getAttribute('data-tab');
        if (!targetTab) return;

        // Deactivate all buttons and panes
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        // Activate clicked button and target pane
        btn.classList.add('active');
        const targetPane = document.getElementById(targetTab);
        if (targetPane) {
          targetPane.classList.add('active');
        }

        state.activeTab = targetTab;

        // Render content for this tab safely
        if (targetTab === 'tab-complete-view') {
          renderCompleteView();
        } else {
          // Slight delay to allow tab-pane display:block to calculate layout for canvas
          setTimeout(() => {
            renderActiveTabCharts();
          }, 50);
        }
      });
    });

    // Complete View Preset Dropdown
    const datePresetEl = document.getElementById('completeViewDatePreset');
    if (datePresetEl) {
      datePresetEl.addEventListener('change', (e) => {
        state.completeViewPreset = e.target.value;
        renderCompleteView();
      });
    }

    // Export Complete View
    const expCompleteBtn = document.getElementById('btnExportCompleteViewCSV');
    if (expCompleteBtn) {
      expCompleteBtn.addEventListener('click', exportCompleteViewCSV);
    }

    // Google Sheet Sync
    const syncBtn = document.getElementById('btnSyncGoogleSheet');
    if (syncBtn) {
      syncBtn.addEventListener('click', triggerGoogleSheetSync);
    }

    // Sheet Config Modal
    const cfgBtn = document.getElementById('btnSheetConfigModal');
    if (cfgBtn) {
      cfgBtn.addEventListener('click', () => {
        const modal = document.getElementById('sheetConfigModal');
        if (modal) modal.classList.add('active');
      });
    }

    const cfgClose = document.getElementById('sheetConfigModalClose');
    if (cfgClose) {
      cfgClose.addEventListener('click', () => {
        const modal = document.getElementById('sheetConfigModal');
        if (modal) modal.classList.remove('active');
      });
    }

    const cfgModal = document.getElementById('sheetConfigModal');
    if (cfgModal) {
      cfgModal.addEventListener('click', (e) => {
        if (e.target === cfgModal) cfgModal.classList.remove('active');
      });
    }

    const saveCfgBtn = document.getElementById('btnSaveSheetConfig');
    if (saveCfgBtn) {
      saveCfgBtn.addEventListener('click', async () => {
        const urlInput = document.getElementById('sheetUrlInput');
        const url = urlInput ? urlInput.value.trim() : '';
        if (url) {
          try {
            await fetch('/api/update-config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sheetUrl: url })
            });
          } catch (e) {}
        }
        if (cfgModal) cfgModal.classList.remove('active');
        triggerGoogleSheetSync();
      });
    }

    // Date filters
    const dateFromEl = document.getElementById('filterDateFrom');
    if (dateFromEl) {
      dateFromEl.addEventListener('change', (e) => {
        state.filters.dateFrom = e.target.value;
        applyFilters();
      });
    }

    const dateToEl = document.getElementById('filterDateTo');
    if (dateToEl) {
      dateToEl.addEventListener('change', (e) => {
        state.filters.dateTo = e.target.value;
        applyFilters();
      });
    }

    // QA filter
    const qaEl = document.getElementById('filterQA');
    if (qaEl) {
      qaEl.addEventListener('change', (e) => {
        state.filters.qa = e.target.value;
        applyFilters();
      });
    }

    // ROC filter
    const rocEl = document.getElementById('filterROC');
    if (rocEl) {
      rocEl.addEventListener('change', (e) => {
        state.filters.roc = e.target.value;
        applyFilters();
      });
    }

    // Pass/Fail status pills
    document.querySelectorAll('.filter-status-pills .status-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-status-pills .status-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.filters.passFail = btn.getAttribute('data-pf');
        applyFilters();
      });
    });

    // Reset filters
    const resetBtn = document.getElementById('btnResetFilters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        populateFilterDropdowns();
        state.filters.qa = 'ALL';
        state.filters.roc = 'ALL';
        state.filters.passFail = 'ALL';
        state.filters.search = '';
        const fQA = document.getElementById('filterQA');
        const fROC = document.getElementById('filterROC');
        const fSearch = document.getElementById('tableSearch');
        if (fQA) fQA.value = 'ALL';
        if (fROC) fROC.value = 'ALL';
        if (fSearch) fSearch.value = '';
        document.querySelectorAll('.filter-status-pills .status-pill').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-pf') === 'ALL');
        });
        applyFilters();
      });
    }

    // Table Search
    const searchEl = document.getElementById('tableSearch');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        state.filters.search = e.target.value;
        state.table.page = 1;
        applyFilters();
      });
    }

    // Table Page Size
    const pageSizeEl = document.getElementById('tablePageSize');
    if (pageSizeEl) {
      pageSizeEl.addEventListener('change', (e) => {
        state.table.pageSize = parseInt(e.target.value, 10);
        state.table.page = 1;
        renderTable();
      });
    }

    // Table Sort Headers
    document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (state.table.sortCol === col) {
          state.table.sortAsc = !state.table.sortAsc;
        } else {
          state.table.sortCol = col;
          state.table.sortAsc = true;
        }
        renderTable();
      });
    });

    // Modal Close
    const modalClose = document.getElementById('modalCloseBtn');
    if (modalClose) {
      modalClose.addEventListener('click', () => {
        const m = document.getElementById('auditDetailModal');
        if (m) m.classList.remove('active');
      });
    }

    const detailModal = document.getElementById('auditDetailModal');
    if (detailModal) {
      detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) detailModal.classList.remove('active');
      });
    }

    // CSV Export
    const expBtn = document.getElementById('btnExportCSV');
    if (expBtn) expBtn.addEventListener('click', exportCSV);
  }

})();
