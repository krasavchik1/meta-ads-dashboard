let isAgencyFeeActive = true;
let currentFilteredRows = DATA.filter(hasActivity);
let expandedTreeKeys = new Set();
let expandedApproaches = new Set();
let currentStabilityFilter = "all";
let currentOfferFilter = "all";
let currentVideoQuality = "all";
let currentVideoSort = "spend";
let ageSortMode = "asc";
let demographicDrilldown = {
  gender: null,
  age: null,
};
let selectedDateRange = { from: null, to: null };
let isCalendarOpen = false;

function hasSpend(row) {
  const spend = Number(row?.spend);
  return Number.isFinite(spend) && spend > 0;
}

function hasLeads(row) {
  const leads = Number(row?.leads);
  return Number.isFinite(leads) && leads > 0;
}

function hasActivity(row) {
  return hasSpend(row) || hasLeads(row);
}

function toggleApproachRow(row) {
  const approachName = row.getAttribute("data-approach-name");

  if (!approachName) {
    return;
  }

  if (expandedApproaches.has(approachName)) {
    expandedApproaches.delete(approachName);
  } else {
    expandedApproaches.add(approachName);
  }

  render(currentFilteredRows, 0);
}

function compareOffers(a, b) {
  const priority = {
    418: 0,
    339: 1,
  };

  const pa = priority[String(a)] ?? 100;
  const pb = priority[String(b)] ?? 100;

  if (pa !== pb) {
    return pa - pb;
  }

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

const ALL_OFFERS = Array.from(
  new Set(
    DATA.filter(hasActivity)
      .map((r) => String(r.offer_type || "").trim())
      .filter(Boolean),
  ),
).sort(compareOffers);

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("fb_theme", theme);

  document
    .querySelectorAll(".theme-btn")
    .forEach((b) => b.classList.remove("active"));

  const activeBtn = document.getElementById("btn-" + theme);

  if (activeBtn) {
    activeBtn.classList.add("active");
  }
}

const savedTheme = localStorage.getItem("fb_theme") || "bloomberg";

setTheme(savedTheme);

function setFeeMode(active) {
  isAgencyFeeActive = active;

  document.getElementById("btn-fee-on").classList.toggle("active", active);

  document.getElementById("btn-fee-off").classList.toggle("active", !active);

  document.querySelectorAll(".th-spend-title").forEach((el) => {
    el.textContent = active ? "Расход (+8%)" : "Спенд (0%)";
  });

  document.getElementById("kpiRealSpendLabel").textContent = active
    ? "Расход (+8%)"
    : "Расход (0%)";

  render(currentFilteredRows, 0);
}

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

/*
 * ==========================================================
 * DATE NORMALIZER
 * ==========================================================
 *
 * Все даты внутри dashboard приводим к YYYY-MM-DD.
 *
 * Поддерживаем:
 *
 * 2026-09-18
 * 2026-09-18 00:00:00
 * 2026-09-18T00:00:00
 * 18/09/2026
 * 18.09.2026
 * 2026/09/18
 *
 * ==========================================================
 */

function normalizeReportDate(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const raw = String(value).trim();

  if (!raw) {
    return "";
  }

  /*
   * ISO:
   * 2026-09-18
   */

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  /*
   * ISO + time:
   *
   * 2026-09-18 00:00:00
   * 2026-09-18T00:00:00
   */

  let match = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[ T].*)?$/);

  if (match) {
    return match[1];
  }

  /*
   * 18/09/2026
   */

  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (match) {
    return (
      `${match[3]}-` +
      `${String(match[2]).padStart(2, "0")}-` +
      `${String(match[1]).padStart(2, "0")}`
    );
  }

  /*
   * 18.09.2026
   */

  match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

  if (match) {
    return (
      `${match[3]}-` +
      `${String(match[2]).padStart(2, "0")}-` +
      `${String(match[1]).padStart(2, "0")}`
    );
  }

  /*
   * 2026/09/18
   */

  match = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

  if (match) {
    return (
      `${match[1]}-` +
      `${String(match[2]).padStart(2, "0")}-` +
      `${String(match[3]).padStart(2, "0")}`
    );
  }

  /*
   * Последний fallback.
   */

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();

    const month = String(parsed.getMonth() + 1).padStart(2, "0");

    const day = String(parsed.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return "";
}

/*
 * ==========================================================
 * НОРМАЛИЗУЕМ DATA ОДИН РАЗ
 * ==========================================================
 */

DATA.forEach((row) => {
  row.date = normalizeReportDate(row.date);
});

/*
 * ==========================================================
 * AVAILABLE DATES
 * ==========================================================
 */

let allDates = DATA.filter(hasActivity)
  .map((d) => d.date)
  .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
  .sort();

allDates = Array.from(new Set(allDates));

let minDate = allDates.length ? allDates[0] : null;

let maxDate = allDates.length ? allDates[allDates.length - 1] : null;

const availableMonths = new Set(allDates.map((d) => d.slice(0, 7)));

let currentSelectedMonth = maxDate ? maxDate.slice(0, 7) : null;

/*
 * ==========================================================
 * HEADER / MONTH
 * ==========================================================
 */

function resetActiveButtons() {
  document
    .querySelectorAll(".header-center .btn:not(.week-btn)")
    .forEach((b) => b.classList.remove("active"));
}

function initMonthSelector() {
  const selector = document.getElementById("monthSelector");

  if (!selector) {
    return;
  }

  if (!minDate || !maxDate) {
    selector.innerHTML = '<option value="ALL">📅 Нет дат</option>';

    return;
  }

  const minYear = parseInt(minDate.slice(0, 4), 10);

  const maxYear = parseInt(maxDate.slice(0, 4), 10);

  const minMonth = minDate.slice(0, 7);

  const maxMonth = maxDate.slice(0, 7);

  let optionsHtml = '<option value="ALL">📅 Все месяцы</option>';

  for (let y = minYear; y <= maxYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const mStr = String(m).padStart(2, "0");

      const ymKey = `${y}-${mStr}`;

      if (ymKey < minMonth || ymKey > maxMonth) {
        continue;
      }

      const hasData = availableMonths.has(ymKey);

      const label = `${MONTH_NAMES[m - 1]} ${y}`;

      if (hasData) {
        const isSelected = ymKey === currentSelectedMonth ? "selected" : "";

        optionsHtml += `<option value="${ymKey}" ${isSelected}>${label}</option>`;
      } else {
        optionsHtml += `<option value="${ymKey}" disabled>${label} (нет данных)</option>`;
      }
    }
  }

  selector.innerHTML = optionsHtml;
}

function initOfferFilter() {
  const oldFilterIds = [
    "stabOfferFilters",
    "funnelOfferFilters",
    "videoOfferFilters",
  ];

  oldFilterIds.forEach((id) => {
    const el = document.getElementById(id);

    if (el) {
      el.style.display = "none";
    }
  });

  const headerCenter = document.querySelector(".header-center");

  if (!headerCenter) {
    return;
  }

  const existing = document.getElementById("globalOfferFilterWrap");

  if (existing) {
    return;
  }

  const wrap = document.createElement("div");

  wrap.id = "globalOfferFilterWrap";

  wrap.style.cssText = `
    display:flex;
    align-items:center;
    gap:8px;
    height:32px;
  `;

  const label = document.createElement("span");

  label.textContent = "Оффер:";

  label.style.cssText = `
    font-size:12px;
    font-weight:700;
    opacity:0.85;
  `;

  const select = document.createElement("select");

  select.id = "offerFilter";

  select.style.cssText = `
    height:32px;
    min-width:125px;
    padding:0 10px;
    border-radius:6px;
    border:1px solid rgba(255,255,255,0.15);
    background:var(--panel);
    color:var(--text);
    font-size:12px;
    font-weight:700;
    cursor:pointer;
    outline:none;
  `;

  select.onchange = () => {
    filterOffer(select.value);
  };

  select.innerHTML = `
    <option value="all">Все офферы</option>
    ${ALL_OFFERS.map((off) => `<option value="${off}">${off}</option>`).join(
      "",
    )}
  `;

  select.value = currentOfferFilter;

  wrap.appendChild(label);

  wrap.appendChild(select);

  const reorderButton = document.getElementById("btn-reorder-toggle");

  if (reorderButton) {
    headerCenter.insertBefore(wrap, reorderButton);
  } else {
    headerCenter.appendChild(wrap);
  }
}

function onMonthChange(ymVal) {
  resetActiveButtons();

  selectedDateRange = {
    from: null,
    to: null,
  };

  if (ymVal === "ALL") {
    const weekBtns = document.getElementById("calendarWeekBtns");

    if (weekBtns) {
      weekBtns.innerHTML = "";
    }

    applySlice(0, document.getElementById("btn-all"));
  } else {
    currentSelectedMonth = ymVal;

    currentFilteredRows = DATA.filter(
      (r) => hasActivity(r) && r.date.startsWith(ymVal),
    );

    render(currentFilteredRows, 30);
  }
}

/*
 * ==========================================================
 * ИНТЕРАКТИВНЫЙ КАЛЕНДАРЬ
 * ==========================================================
 */

let calendarDraftRange = {
  from: null,
  to: null,
};

let calendarHoverDate = null;

function getCalendarRangeLabel() {
  if (!calendarDraftRange.from) {
    return "Выберите даты";
  }

  const from = calendarDraftRange.from;

  const to = calendarDraftRange.to || from;

  return `${from} — ${to}`;
}

function getCalendarRangeDays() {
  if (!calendarDraftRange.from) {
    return 0;
  }

  const to = calendarDraftRange.to || calendarDraftRange.from;

  return (
    Math.round(
      (new Date(to + "T00:00:00") -
        new Date(calendarDraftRange.from + "T00:00:00")) /
        86400000,
    ) + 1
  );
}

function cloneDateRange(range) {
  return {
    from: range && range.from ? range.from : null,

    to: range && range.to ? range.to : null,
  };
}

function formatCalendarDate(dateStr) {
  if (!dateStr) {
    return "—";
  }

  const d = new Date(dateStr + "T00:00:00");

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPresetRange(type) {
  if (!minDate || !maxDate) {
    return {
      from: null,
      to: null,
    };
  }

  function localDateToString(date) {
    return (
      String(date.getFullYear()) +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0")
    );
  }

  const end = new Date(maxDate + "T00:00:00");

  let start = new Date(end);

  if (type === "today") {
    return {
      from: maxDate,
      to: maxDate,
    };
  }

  if (type === "yesterday") {
    start.setDate(start.getDate() - 1);

    const dateStr = localDateToString(start);

    const safeDate = dateStr < minDate ? minDate : dateStr;

    return {
      from: safeDate,
      to: safeDate,
    };
  }

  if (type === "last7") {
    start.setDate(start.getDate() - 6);
  } else if (type === "last14") {
    start.setDate(start.getDate() - 13);
  } else if (type === "last30") {
    start.setDate(start.getDate() - 29);
  } else if (type === "thisMonth") {
    start = new Date(end.getFullYear(), end.getMonth(), 1);
  } else if (type === "lastMonth") {
    start = new Date(end.getFullYear(), end.getMonth() - 1, 1);

    const last = new Date(end.getFullYear(), end.getMonth(), 0);

    let fromDate = localDateToString(start);

    let toDate = localDateToString(last);

    if (fromDate < minDate) {
      fromDate = minDate;
    }

    if (toDate > maxDate) {
      toDate = maxDate;
    }

    if (fromDate > toDate) {
      return {
        from: null,
        to: null,
      };
    }

    return {
      from: fromDate,
      to: toDate,
    };
  } else if (type === "all") {
    return {
      from: minDate,
      to: maxDate,
    };
  }

  let from = localDateToString(start);

  if (from < minDate) {
    from = minDate;
  }

  return {
    from: from,
    to: maxDate,
  };
}

function selectCalendarPreset(type) {
  const range = getPresetRange(type);

  if (!range.from) {
    return;
  }

  calendarDraftRange = cloneDateRange(range);

  calendarHoverDate = null;

  currentSelectedMonth = (calendarDraftRange.from || maxDate).slice(0, 7);

  renderCalendarGrid(currentSelectedMonth);
}

function toggleCalendarDropdown() {
  let dropdown = document.getElementById("calendarDropdownPopup");

  if (!dropdown) {
    dropdown = document.createElement("div");

    dropdown.id = "calendarDropdownPopup";

    dropdown.className = "calendar-popup-card";

    document.body.appendChild(dropdown);
  }

  if (!minDate || !maxDate) {
    dropdown.innerHTML = `
      <div class="cal-top">

        <div class="cal-top-main">

          <div class="cal-range">
            Нет дат
          </div>

          <div class="cal-range-days">
            Meta-экспорт не содержит
            распознаваемых дат.
          </div>

        </div>

        <button
          type="button"
          class="cal-close"
          onclick="closeCalendarDropdown()"
        >
          ×
        </button>

      </div>
      `;

    isCalendarOpen = true;

    positionCalendarPopup();

    return;
  }

  isCalendarOpen = !isCalendarOpen;

  if (isCalendarOpen) {
    calendarDraftRange = cloneDateRange(selectedDateRange);

    calendarHoverDate = null;

    if (calendarDraftRange.from) {
      currentSelectedMonth = calendarDraftRange.from.slice(0, 7);
    } else {
      currentSelectedMonth = maxDate.slice(0, 7);
    }

    renderCalendarGrid(currentSelectedMonth);

    positionCalendarPopup();

    setTimeout(() => {
      document.addEventListener("mousedown", handleCalendarOutsideClick);
    }, 0);
  } else {
    closeCalendarDropdown();
  }
}

function closeCalendarDropdown() {
  const dropdown = document.getElementById("calendarDropdownPopup");

  isCalendarOpen = false;

  calendarHoverDate = null;

  calendarDraftRange = cloneDateRange(selectedDateRange);

  if (dropdown) {
    dropdown.style.display = "none";
  }

  document.removeEventListener("mousedown", handleCalendarOutsideClick);
}

function cancelCalendarSelection() {
  closeCalendarDropdown();
}

function handleCalendarOutsideClick(event) {
  const dropdown = document.getElementById("calendarDropdownPopup");

  const badge = document.getElementById("actualDatesBadge");

  if (!isCalendarOpen || !dropdown) {
    return;
  }

  if (
    dropdown.contains(event.target) ||
    (badge && badge.contains(event.target))
  ) {
    return;
  }

  closeCalendarDropdown();
}

function positionCalendarPopup() {
  const badge = document.getElementById("actualDatesBadge");

  const dropdown = document.getElementById("calendarDropdownPopup");

  if (!badge || !dropdown) {
    return;
  }

  const rect = badge.getBoundingClientRect();

  const popupWidth = Math.min(720, window.innerWidth - 24);

  const preferredLeft = rect.left + window.scrollX;

  const maxLeft = window.scrollX + window.innerWidth - popupWidth - 12;

  dropdown.style.top = rect.bottom + 10 + window.scrollY + "px";

  dropdown.style.left =
    Math.max(
      window.scrollX + 12,

      Math.min(preferredLeft, maxLeft),
    ) + "px";

  dropdown.style.display = "block";
}

function changeCalendarMonth(delta) {
  if (!currentSelectedMonth || !minDate || !maxDate) {
    return;
  }

  let [year, month] = currentSelectedMonth.split("-").map(Number);

  month += delta;

  if (month < 1) {
    month = 12;
    year--;
  }

  if (month > 12) {
    month = 1;
    year++;
  }

  const nextMonth = `${year}-${String(month).padStart(2, "0")}`;

  const minMonth = minDate.slice(0, 7);

  const maxMonth = maxDate.slice(0, 7);

  if (nextMonth < minMonth || nextMonth > maxMonth) {
    return;
  }

  currentSelectedMonth = nextMonth;

  renderCalendarGrid(currentSelectedMonth);
}

function onCalendarDayHover(dateStr) {
  calendarHoverDate = dateStr;
}

function isDateInCalendarRange(dateStr) {
  const from = calendarDraftRange.from;

  const to = calendarDraftRange.to;

  if (!from) {
    return false;
  }

  if (to) {
    return dateStr >= from && dateStr <= to;
  }

  if (calendarHoverDate) {
    const start = from < calendarHoverDate ? from : calendarHoverDate;

    const end = from < calendarHoverDate ? calendarHoverDate : from;

    return dateStr >= start && dateStr <= end;
  }

  return dateStr === from;
}

function renderCalendarGrid(ym) {
  if (!minDate || !maxDate) {
    return;
  }

  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    ym = maxDate.slice(0, 7);
  }

  currentSelectedMonth = ym;

  const [year, month] = ym.split("-").map(Number);

  const firstDayIndexRaw = new Date(year, month - 1, 1).getDay();

  const firstDayIndex = firstDayIndexRaw === 0 ? 6 : firstDayIndexRaw - 1;

  const daysInMonth = new Date(year, month, 0).getDate();

  const dropdown = document.getElementById("calendarDropdownPopup");

  if (!dropdown) {
    return;
  }

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const prevMonth = (() => {
    let y = year;
    let m = month - 1;

    if (m < 1) {
      m = 12;
      y--;
    }

    return `${y}-${String(m).padStart(2, "0")}`;
  })();

  const nextMonth = (() => {
    let y = year;
    let m = month + 1;

    if (m > 12) {
      m = 1;
      y++;
    }

    return `${y}-${String(m).padStart(2, "0")}`;
  })();

  const canPrev = prevMonth >= minDate.slice(0, 7);

  const canNext = nextMonth <= maxDate.slice(0, 7);

  const rangeDays = getCalendarRangeDays();

  let emptyCells = "";

  for (let i = 0; i < firstDayIndex; i++) {
    emptyCells += `<div class="cal-day cal-empty"></div>`;
  }

  let filledCells = "";

  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = String(d).padStart(2, "0");

    const fullDate = `${ym}-${dStr}`;

    const isAvailable = fullDate >= minDate && fullDate <= maxDate;

    const isStart = calendarDraftRange.from === fullDate;

    const isEnd = calendarDraftRange.to === fullDate;

    const inRange = isDateInCalendarRange(fullDate);

    const isToday = fullDate === maxDate;

    const classes = [
      "cal-day",

      !isAvailable ? "disabled" : "",

      inRange ? "in-range" : "",

      isStart ? "range-start" : "",

      isEnd ? "range-end" : "",

      isToday ? "data-end" : "",
    ]
      .filter(Boolean)
      .join(" ");

    filledCells += `
      <button
        type="button"
        class="${classes}"
        ${
          isAvailable
            ? `onclick="onCalendarDayClick('${fullDate}')"`
            : "disabled"
        }
      >
        <span>${d}</span>
      </button>`;
  }

  const presetButton = (type, label) =>
    `<button type="button" class="cal-preset" onclick="selectCalendarPreset('${type}')">${label}</button>`;

  dropdown.innerHTML = `
    <div class="cal-top">

      <div class="cal-top-main">

        <div class="cal-range">

          ${formatCalendarDate(calendarDraftRange.from)}

          ${
            calendarDraftRange.to &&
            calendarDraftRange.to !== calendarDraftRange.from
              ? ` – ${formatCalendarDate(calendarDraftRange.to)}`
              : ""
          }

        </div>


        <div class="cal-range-days">

          Range:
          ${rangeDays || "—"}

          ${rangeDays ? (rangeDays === 1 ? " day" : " days") : ""}

        </div>

      </div>


      <button
        type="button"
        class="cal-close"
        onclick="cancelCalendarSelection()"
        aria-label="Close"
      >
        ×
      </button>

    </div>


    <div class="cal-main">

      <aside class="cal-presets">

        <div class="cal-presets-title">
          Presets
        </div>

        ${presetButton("today", "Today")}

        ${presetButton("yesterday", "Yesterday")}

        ${presetButton("last7", "Last 7 days")}

        ${presetButton("last14", "Last 14 days")}

        ${presetButton("last30", "Last 30 days")}

        ${presetButton("thisMonth", "This month")}

        ${presetButton("lastMonth", "Last month")}

        ${presetButton("all", "All time")}

      </aside>


      <section class="cal-calendar">

        <div class="cal-month-header">

          <button
            type="button"
            class="cal-nav"
            onclick="changeCalendarMonth(-1)"
            ${canPrev ? "" : "disabled"}
            aria-label="Previous month"
          >
            ‹
          </button>


          <div class="cal-month-title">

            ${MONTH_NAMES[month - 1]}
            ${year}

          </div>


          <button
            type="button"
            class="cal-nav"
            onclick="changeCalendarMonth(1)"
            ${canNext ? "" : "disabled"}
            aria-label="Next month"
          >
            ›
          </button>

        </div>


        <div class="cal-grid">

          ${dayNames
            .map((d) => `<div class="cal-day-name">${d}</div>`)
            .join("")}

          ${emptyCells}

          ${filledCells}

        </div>

      </section>

    </div>


    <div class="cal-bottom">

      <button
        type="button"
        class="cal-btn cal-cancel"
        onclick="cancelCalendarSelection()"
      >
        Cancel
      </button>


      <button
        type="button"
        class="cal-btn cal-apply"
        onclick="applyCustomDateRange()"
        ${calendarDraftRange.from ? "" : "disabled"}
      >
        Apply
      </button>

    </div>

  `;

  dropdown.style.display = "block";
}

function onCalendarDayClick(dateStr) {
  if (!minDate || !maxDate) {
    return;
  }

  if (dateStr < minDate || dateStr > maxDate) {
    return;
  }

  if (!calendarDraftRange.from || calendarDraftRange.to) {
    calendarDraftRange = {
      from: dateStr,
      to: null,
    };
  } else if (dateStr < calendarDraftRange.from) {
    calendarDraftRange = {
      from: dateStr,
      to: calendarDraftRange.from,
    };
  } else if (dateStr === calendarDraftRange.from) {
    calendarDraftRange = {
      from: dateStr,
      to: dateStr,
    };
  } else {
    calendarDraftRange.to = dateStr;
  }

  calendarHoverDate = null;

  if (calendarDraftRange.from) {
    currentSelectedMonth = calendarDraftRange.from.slice(0, 7);
  }

  renderCalendarGrid(currentSelectedMonth);
}

function applyCustomDateRange() {
  if (!calendarDraftRange.from) {
    return;
  }

  const from = calendarDraftRange.from;

  const to = calendarDraftRange.to || calendarDraftRange.from;

  selectedDateRange = {
    from: from <= to ? from : to,

    to: from <= to ? to : from,
  };

  currentFilteredRows = DATA.filter(
    (r) =>
      hasActivity(r) &&
      r.date >= selectedDateRange.from &&
      r.date <= selectedDateRange.to,
  );

  resetActiveButtons();

  render(currentFilteredRows, getCalendarRangeDays());

  closeCalendarDropdown();
}

function applySlice(days, btnElement) {
  selectedDateRange = {
    from: null,
    to: null,
  };

  resetActiveButtons();

  if (btnElement) {
    btnElement.classList.add("active");
  }

  if (days === 0) {
    currentFilteredRows = DATA.filter(hasActivity);
  } else {
    let toD = new Date(maxDate + "T00:00:00");

    let fromD = new Date(maxDate + "T00:00:00");

    fromD.setDate(toD.getDate() - (days - 1));

    let fromStr =
      String(fromD.getFullYear()) +
      "-" +
      String(fromD.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(fromD.getDate()).padStart(2, "0");

    currentFilteredRows = DATA.filter(
      (r) => r.date >= fromStr && r.date <= maxDate,
    );
  }

  render(currentFilteredRows, days);
}

/*
 * ==========================================================
 * MATRIX
 * ==========================================================
 */

function renderMatrix(subRows, tableId) {
  let feeMult = isAgencyFeeActive ? 1.08 : 1.0;

  let validRows = subRows.filter((r) => r.geo && r.geo !== "Unknown");

  let geos = Array.from(new Set(validRows.map((r) => r.geo))).sort();

  let prods = Array.from(new Set(validRows.map((r) => r.product_full))).sort();

  const thead = document.querySelector(`#${tableId} thead`);

  const tbody = document.querySelector(`#${tableId} tbody`);

  if (!thead || !tbody) {
    return;
  }

  if (geos.length === 0 || prods.length === 0) {
    thead.innerHTML = "<tr><th>Товар / GEO</th><th>Статус</th></tr>";

    tbody.innerHTML =
      "<tr><td colspan='2' style='text-align:center; padding: 16px; color: var(--text-muted);'>Нет данных</td></tr>";

    return;
  }

  thead.innerHTML =
    "<tr><th>Товар / GEO</th>" +
    geos.map((g) => `<th style="text-align:center;">${g}</th>`).join("") +
    "</tr>";

  tbody.innerHTML = prods
    .map((p) => {
      let rowCells = geos
        .map((g) => {
          let match = validRows.filter(
            (r) => r.product_full === p && r.geo === g,
          );

          if (!match.length) {
            return `
                      <td class="cell-none">
                        -
                      </td>
                    `;
          }

          let sp = match.reduce((acc, m) => acc + m.spend, 0);

          let realSp = sp * feeMult;

          let ld = match.reduce((acc, m) => acc + m.leads, 0);

          let rv = match.reduce((acc, m) => acc + m.leads * m.payout, 0);

          let pr = rv - realSp;

          let cp = ld > 0 ? sp / ld : 0;

          let isWin = pr >= 0;

          return `
                    <td>

                      <div
                        class="matrix-cell ${isWin ? "cell-win" : "cell-loss"}"
                      >

                        ${isWin ? "+" : ""}$${pr.toFixed(2)}

                        <br>

                        <span
                          style="
                            font-size:9px;
                            opacity:0.85;
                          "
                        >
                          ${ld}л /
                          $${cp.toFixed(2)}
                        </span>

                      </div>

                    </td>
                  `;
        })
        .join("");

      return `
            <tr>

              <td>
                <b>${p}</b>
              </td>

              ${rowCells}

            </tr>
          `;
    })
    .join("");
}

/*
 * ==========================================================
 * TREE
 * ==========================================================
 */

function toggleTreeRow(className) {
  const isExpanding = !expandedTreeKeys.has(className);

  if (isExpanding) {
    expandedTreeKeys.add(className);

    if (className.startsWith("to-")) {
      document
        .querySelectorAll("." + className + ".row-tree-prod")
        .forEach((r) => r.classList.remove("hidden"));
    } else if (className.startsWith("tp-")) {
      document
        .querySelectorAll("." + className + ".row-tree-geo")
        .forEach((r) => r.classList.remove("hidden"));

      document
        .querySelectorAll("." + className + ".row-tree-month")
        .forEach((r) => r.classList.add("hidden"));
    } else if (className.startsWith("tg-")) {
      document
        .querySelectorAll("." + className + ".row-tree-month")
        .forEach((r) => r.classList.remove("hidden"));
    }
  } else {
    expandedTreeKeys.delete(className);

    document.querySelectorAll("." + className).forEach((r) => {
      r.classList.add("hidden");

      Array.from(r.classList).forEach((c) => {
        if (c.startsWith("tg-") || c.startsWith("tp-")) {
          expandedTreeKeys.delete(c);
        }
      });
    });
  }
}

/*
 * ==========================================================
 * FILTERS
 * ==========================================================
 */

function filterStabilityStatus(status, btn) {
  currentStabilityFilter = status;

  applyTableVisibility(
    "tblStability",
    currentOfferFilter,
    currentStabilityFilter,
  );

  if (btn) {
    btn.parentElement
      .querySelectorAll("button")
      .forEach((b) => b.classList.remove("active"));

    btn.classList.add("active");
  }
}

function filterOffer(off) {
  currentOfferFilter = String(off || "all");

  demographicDrilldown = {
    gender: null,
    age: null,
  };

  expandedApproaches.clear();
  expandedTreeKeys.clear();

  const select = document.getElementById("offerFilter");

  if (select) {
    select.value = currentOfferFilter;
  }

  render(currentFilteredRows, 0);
}

function initVideoFilters() {
  const allButton = document.getElementById("btn-vid-all");

  if (!allButton) {
    return;
  }

  const oldQualityGroup = allButton.closest(".btn-group");

  if (oldQualityGroup) {
    oldQualityGroup.style.display = "none";
  }

  const controls = document.querySelector("#sec-video .widget-controls");

  if (!controls) {
    return;
  }

  if (document.getElementById("videoFiltersModern")) {
    return;
  }

  const wrap = document.createElement("div");

  wrap.id = "videoFiltersModern";

  wrap.style.cssText = `
    display:flex;
    align-items:center;
    gap:8px;
    flex-wrap:wrap;
  `;

  wrap.innerHTML = `
    <div style="
      display:flex;
      align-items:center;
      gap:5px;
    ">
      <span style="
        font-size:11px;
        font-weight:700;
        opacity:.8;
      ">
        Качество:
      </span>

      <select
        id="videoQualityFilter"
        style="
          height:30px;
          min-width:165px;
          padding:0 8px;
          border-radius:6px;
          border:1px solid var(--border-color);
          background:var(--panel);
          color:var(--text);
          font-size:11px;
          font-weight:700;
          cursor:pointer;
          outline:none;
        "
      >
        <option value="all">
          Все крео
        </option>

        <option value="strong_hook">
          🔥 Сильный Hook (≥28%)
        </option>

        <option value="strong_hold">
          🎯 Сильный Hold (≥30%)
        </option>

        <option value="strong_both">
          🔥 Hook + Hold
        </option>

        <option value="mislead">
          ⚠️ Мислид
        </option>

        <option value="weak_hook">
          ❌ Слабый Hook (&lt;18%)
        </option>
      </select>
    </div>

    <div style="
      display:flex;
      align-items:center;
      gap:5px;
    ">
      <span style="
        font-size:11px;
        font-weight:700;
        opacity:.8;
      ">
        Сортировка:
      </span>

      <select
        id="videoSortFilter"
        style="
          height:30px;
          min-width:125px;
          padding:0 8px;
          border-radius:6px;
          border:1px solid var(--border-color);
          background:var(--panel);
          color:var(--text);
          font-size:11px;
          font-weight:700;
          cursor:pointer;
          outline:none;
        "
      >
        <option value="spend">
          По спенду
        </option>

        <option value="leads">
          По лидам
        </option>

        <option value="hook">
          По Hook
        </option>

        <option value="hold">
          По Hold
        </option>
      </select>
    </div>
  `;

  const firstButton = controls.querySelector("button.btn-icon");

  if (firstButton) {
    controls.insertBefore(wrap, firstButton);
  } else {
    controls.appendChild(wrap);
  }

  const quality = document.getElementById("videoQualityFilter");

  const sort = document.getElementById("videoSortFilter");

  if (quality) {
    quality.value = currentVideoQuality;

    quality.onchange = () => {
      currentVideoQuality = quality.value;

      applyVideoTableFilter();
    };
  }

  if (sort) {
    sort.value = currentVideoSort;

    sort.onchange = () => {
      currentVideoSort = sort.value;

      applyVideoTableFilter();
    };
  }
}

function filterVideoQuality(mode, btn) {
  currentVideoQuality = mode;

  const select = document.getElementById("videoQualityFilter");

  if (select) {
    select.value = mode;
  }

  applyVideoTableFilter();
}

function filterVideoSort(mode) {
  currentVideoSort = mode || "spend";

  const select = document.getElementById("videoSortFilter");

  if (select) {
    select.value = currentVideoSort;
  }

  applyVideoTableFilter();
}

function applyVideoTableFilter() {
  const tbody = document.querySelector("#tblVideo tbody");

  if (!tbody) {
    return;
  }

  let rows = Array.from(tbody.querySelectorAll("tr"));

  rows.forEach((r) => {
    const hook = parseFloat(r.getAttribute("data-hook") || 0);

    const hold = parseFloat(r.getAttribute("data-hold") || 0);

    let matchQuality = true;

    if (currentVideoQuality === "strong_hook") {
      matchQuality = hook >= 28.0;
    } else if (currentVideoQuality === "strong_hold") {
      matchQuality = hold >= 30.0;
    } else if (currentVideoQuality === "strong_both") {
      matchQuality = hook >= 28.0 && hold >= 30.0;
    } else if (currentVideoQuality === "mislead") {
      matchQuality = hook >= 28.0 && hold < 20.0;
    } else if (currentVideoQuality === "weak_hook") {
      matchQuality = hook < 18.0;
    }

    r.style.display = matchQuality ? "" : "none";
  });

  const value = (row, key) => parseFloat(row.getAttribute(key) || 0);

  rows.sort((a, b) => {
    if (currentVideoSort === "leads") {
      return value(b, "data-leads") - value(a, "data-leads");
    }

    if (currentVideoSort === "hook") {
      return value(b, "data-hook") - value(a, "data-hook");
    }

    if (currentVideoSort === "hold") {
      return value(b, "data-hold") - value(a, "data-hold");
    }

    return value(b, "data-spend") - value(a, "data-spend");
  });

  rows.forEach((r) => tbody.appendChild(r));
}

function applyTableVisibility(tblId, offerVal, statusVal) {
  document.querySelectorAll(`#${tblId} tbody tr`).forEach((r) => {
    let matchOffer =
      offerVal === "all" || r.getAttribute("data-offer") === offerVal;

    let matchStatus =
      statusVal === "all" || r.getAttribute("data-status") === statusVal;

    r.style.display = matchOffer && matchStatus ? "" : "none";
  });
}

function toggleAgeSort() {
  ageSortMode = ageSortMode === "asc" ? "spend" : "asc";

  render(currentFilteredRows, 0);
}

/*
 * ==========================================================
 * MAIN RENDER
 * ==========================================================
 */

function render(rows, requestedDays = 0) {
  let feeMult = isAgencyFeeActive ? 1.08 : 1.0;

  // Глобальное правило:
  // РК без фактического spend вообще не участвует
  // ни в одном виджете / таблице / матрице.
  const sourceRows = (Array.isArray(rows) ? rows : []).filter(hasActivity);

  rows =
    currentOfferFilter === "all"
      ? sourceRows
      : sourceRows.filter(
          (r) => String(r.offer_type || "") === currentOfferFilter,
        );

  let datesInRows = Array.from(
    new Set(rows.map((r) => normalizeReportDate(r.date)).filter(Boolean)),
  ).sort();

  let factCount = datesInRows.length;

  let fStart = datesInRows[0] || "";

  let fEnd = datesInRows[datesInRows.length - 1] || "";

  let badgeEl = document.getElementById("actualDatesBadge");

  if (badgeEl) {
    if (factCount === 0) {
      const totalDataDates = DATA.map((r) =>
        normalizeReportDate(r.date),
      ).filter(Boolean);

      if (totalDataDates.length > 0) {
        badgeEl.innerText = "⚠️ Нет данных в текущем срезе";

        badgeEl.title =
          "В выбранном диапазоне нет строк. Нажми, чтобы открыть календарь.";

        badgeEl.onclick = toggleCalendarDropdown;

        badgeEl.style.cursor = "pointer";
      } else {
        badgeEl.innerText = "⚠️ Нет дат в данных";

        badgeEl.title = "Meta-экспорт не содержит распознаваемых дат.";

        badgeEl.onclick = null;

        badgeEl.style.cursor = "default";
      }

      badgeEl.className = "actual-dates-badge warning";
    } else {
      badgeEl.innerText = `📅 ${fStart} — ${fEnd} (${factCount} дн.)`;

      badgeEl.className = "actual-dates-badge";

      badgeEl.onclick = toggleCalendarDropdown;

      badgeEl.style.cursor = "pointer";

      badgeEl.title = "Открыть календарь";
    }
  }

  /*
   * ========================================================
   * KPI
   * ========================================================
   */

  let spend = 0;

  let totalLeads = 0;

  let rev = 0;

  let rejectIds = new Set();

  rows.forEach((r) => {
    spend += r.spend;

    totalLeads += r.leads;

    rev += r.leads * r.payout;

    let del = String(r.delivery || "").toLowerCase();

    if (
      del.includes("reject") ||
      del.includes("disapprov") ||
      del.includes("отклон") ||
      del.includes("inactive") ||
      del.includes("not_delivering")
    ) {
      rejectIds.add(String(r.campaign_id || r.campaign));
    }
  });

  let realSpend = spend * feeMult;

  let profit = rev - realSpend;

  let cpa = totalLeads > 0 ? spend / totalLeads : 0;

  let roi = realSpend > 0 ? (profit / realSpend) * 100 : 0;

  document.getElementById("kpiSpend").innerText = "$" + spend.toFixed(2);

  document.getElementById("kpiRealSpend").innerText =
    "$" + realSpend.toFixed(2);

  document.getElementById("kpiLeads").innerText =
    totalLeads.toLocaleString("en-US");

  document.getElementById("kpiCpa").innerText = "$" + cpa.toFixed(3);

  document.getElementById("kpiRejects").innerText = rejectIds.size + " шт.";

  let pEl = document.getElementById("kpiProfit");

  pEl.innerText = (profit >= 0 ? "+" : "") + "$" + profit.toFixed(2);

  pEl.className = "card-val " + (profit >= 0 ? "green" : "red");

  let rEl = document.getElementById("kpiRoi");

  rEl.innerText = roi.toFixed(1) + "%";

  rEl.className = "card-val " + (roi >= 0 ? "green" : "red");

  /*
   * ========================================================
   * GROUP HELPERS
   * ========================================================
   */

  function groupOffer(subRows, key, displayKey = key) {
    let map = {};

    subRows.forEach((r) => {
      let val = r[key] || "Unknown";

      if (!map[val]) {
        map[val] = {
          name: r[displayKey] || val,

          spend: 0,

          leads: 0,

          rev: 0,
        };
      }

      map[val].spend += Number(r.spend || 0);

      map[val].leads += Number(r.leads || 0);

      map[val].rev += Number(r.leads || 0) * Number(r.payout || 0);
    });

    return Object.values(map)
      .map((m) => {
        m.realSpend = m.spend * feeMult;

        m.profit = m.rev - m.realSpend;

        m.cpa = m.leads > 0 ? m.spend / m.leads : 0;

        m.roi = m.realSpend > 0 ? (m.profit / m.realSpend) * 100 : 0;

        return m;
      })
      .sort((a, b) => b.profit - a.profit);
  }

  function fillTable(tbodySelector, list) {
    const el = document.querySelector(tbodySelector);

    if (!el) {
      return;
    }

    if (!list || list.length === 0) {
      el.innerHTML =
        "<tr><td colspan='7' style='text-align:center; color:var(--text-muted); padding:14px;'>Нет данных</td></tr>";

      return;
    }

    el.innerHTML = list

      .map(
        (r) => `

      <tr>

        <td>
          <b>${r.name}</b>
        </td>

        <td>
          $${r.spend.toFixed(2)}
        </td>

        <td
          style="
            color:var(--yellow);
            font-weight:700;
          "
        >
          $${r.realSpend.toFixed(2)}
        </td>

        <td>
          ${r.leads}
        </td>

        <td>
          $${r.cpa.toFixed(3)}
        </td>

        <td
          class="${r.profit >= 0 ? "green" : "red"}"
        >

          <b>

            ${r.profit >= 0 ? "+" : ""}$${r.profit.toFixed(2)}

          </b>

        </td>

        <td
          class="${r.roi >= 0 ? "green" : "red"}"
        >

          ${r.roi.toFixed(1)}%

        </td>

      </tr>

    `,
      )

      .join("");
  }

  function renderApproachesTable(subRows) {
    const tbody = document.querySelector("#tblApproaches tbody");

    if (!tbody) {
      return;
    }

    const approachList = groupOffer(subRows, "approach");

    if (!approachList || approachList.length === 0) {
      tbody.innerHTML =
        "<tr>" +
        "<td colspan='7' " +
        "style='text-align:center; color:var(--text-muted); padding:14px;'>" +
        "Нет данных" +
        "</td>" +
        "</tr>";

      return;
    }

    let html = "";

    approachList.forEach((approachRow) => {
      const approachName = approachRow.name || "Unknown";

      const isExpanded = expandedApproaches.has(approachName);

      html += `
      <tr
        class="approach-parent-row"
        data-approach-name="${approachName}"
        onclick="toggleApproachRow(this)"
        style="cursor:pointer;"
      >
        <td>
          <span
            style="
              display:inline-block;
              width:20px;
              font-weight:700;
            "
          >
            ${isExpanded ? "▼" : "▶"}
          </span>

          <b>${approachName}</b>
        </td>

        <td>
          $${approachRow.spend.toFixed(2)}
        </td>

        <td
          style="
            color:var(--yellow);
            font-weight:700;
          "
        >
          $${approachRow.realSpend.toFixed(2)}
        </td>

        <td>
          ${approachRow.leads}
        </td>

        <td>
          $${approachRow.cpa.toFixed(3)}
        </td>

        <td
          class="${approachRow.profit >= 0 ? "green" : "red"}"
        >
          <b>
            ${
              approachRow.profit >= 0 ? "+" : ""
            }$${approachRow.profit.toFixed(2)}
          </b>
        </td>

        <td
          class="${approachRow.roi >= 0 ? "green" : "red"}"
        >
          ${approachRow.roi.toFixed(1)}%
        </td>
      </tr>
    `;

      if (isExpanded) {
        const approachRows = subRows.filter(
          (r) => (r.approach || "Unknown") === approachName,
        );

        const creativeList = groupOffer(approachRows, "product_full");

        creativeList.forEach((creativeRow) => {
          html += `
            <tr
              class="approach-child-row"
              style="
                background:rgba(255,255,255,0.025);
              "
            >
              <td
                style="
                  padding-left:42px;
                "
              >
                ↳ <b>${creativeRow.name}</b>
              </td>

              <td>
                $${creativeRow.spend.toFixed(2)}
              </td>

              <td
                style="
                  color:var(--yellow);
                  font-weight:700;
                "
              >
                $${creativeRow.realSpend.toFixed(2)}
              </td>

              <td>
                ${creativeRow.leads}
              </td>

              <td>
                $${creativeRow.cpa.toFixed(3)}
              </td>

              <td
                class="${creativeRow.profit >= 0 ? "green" : "red"}"
              >
                <b>
                  ${
                    creativeRow.profit >= 0 ? "+" : ""
                  }$${creativeRow.profit.toFixed(2)}
                </b>
              </td>

              <td
                class="${creativeRow.roi >= 0 ? "green" : "red"}"
              >
                ${creativeRow.roi.toFixed(1)}%
              </td>
            </tr>
          `;
        });
      }
    });

    tbody.innerHTML = html;
  }

  /*
   * ========================================================
   * 1. TREE
   * ========================================================
   */

  let treeMap = {};

  rows.forEach((r) => {
    let off = r.offer_type || "Other";

    let prod = r.product_full || "Other";

    let geo = r.geo || "Unknown";

    let mon = r.month || "Без месяца";

    if (!treeMap[off]) {
      treeMap[off] = {
        spend: 0,

        leads: 0,

        rev: 0,

        prods: {},
      };
    }

    if (!treeMap[off].prods[prod]) {
      treeMap[off].prods[prod] = {
        spend: 0,

        leads: 0,

        rev: 0,

        geos: {},
      };
    }

    if (!treeMap[off].prods[prod].geos[geo]) {
      treeMap[off].prods[prod].geos[geo] = {
        spend: 0,

        leads: 0,

        rev: 0,

        months: {},
      };
    }

    if (!treeMap[off].prods[prod].geos[geo].months[mon]) {
      treeMap[off].prods[prod].geos[geo].months[mon] = {
        spend: 0,

        leads: 0,

        rev: 0,
      };
    }

    treeMap[off].spend += r.spend;

    treeMap[off].leads += r.leads;

    treeMap[off].rev += r.leads * r.payout;

    treeMap[off].prods[prod].spend += r.spend;

    treeMap[off].prods[prod].leads += r.leads;

    treeMap[off].prods[prod].rev += r.leads * r.payout;

    treeMap[off].prods[prod].geos[geo].spend += r.spend;

    treeMap[off].prods[prod].geos[geo].leads += r.leads;

    treeMap[off].prods[prod].geos[geo].rev += r.leads * r.payout;

    treeMap[off].prods[prod].geos[geo].months[mon].spend += r.spend;

    treeMap[off].prods[prod].geos[geo].months[mon].leads += r.leads;

    treeMap[off].prods[prod].geos[geo].months[mon].rev += r.leads * r.payout;
  });

  let treeHtml = "";

  let oIdx = 0;

  Object.entries(treeMap)

    .sort((a, b) => b[1].spend - a[1].spend)

    .forEach(([off, odata]) => {
      let oRealSp = odata.spend * feeMult;

      let oProf = odata.rev - oRealSp;

      let oCpa = odata.leads > 0 ? odata.spend / odata.leads : 0;

      let oRoi = oRealSp > 0 ? (oProf / oRealSp) * 100 : 0;

      let oCls = oProf >= 0 ? "green" : "red";

      let oKey = `to-${oIdx}`;

      treeHtml += `

      <tr
        class="row-tree-offer"
        onclick="toggleTreeRow('${oKey}')"
      >

        <td>
          🏷️ ОФФЕР [${off}]
          (Клик для раскрытия)
        </td>

        <td>
          ${odata.leads}
        </td>

        <td>
          $${oCpa.toFixed(2)}
        </td>

        <td>
          $${odata.spend.toFixed(2)}
        </td>

        <td
          style="
            color:var(--yellow);
            font-weight:700;
          "
        >

          $${oRealSp.toFixed(2)}

        </td>

        <td
          class="${oCls}"
        >

          ${oProf >= 0 ? "+" : ""}$${oProf.toFixed(2)}

        </td>

        <td
          class="${oCls}"
        >

          ${oRoi.toFixed(1)}%

        </td>

      </tr>

    `;

      let pIdx = 0;

      let isOHidden = !expandedTreeKeys.has(oKey);

      Object.entries(odata.prods)

        .sort((a, b) => b[1].spend - a[1].spend)

        .forEach(([prod, pdata]) => {
          let pRealSp = pdata.spend * feeMult;

          let pProf = pdata.rev - pRealSp;

          let pCpa = pdata.leads > 0 ? pdata.spend / pdata.leads : 0;

          let pRoi = pRealSp > 0 ? (pProf / pRealSp) * 100 : 0;

          let pCls = pProf >= 0 ? "green" : "red";

          let pKey = `tp-${oIdx}-${pIdx}`;

          treeHtml += `

        <tr
          class="
            row-tree-prod
            ${oKey}
            ${isOHidden ? "hidden" : ""}
          "
          onclick="toggleTreeRow('${pKey}')"
        >

          <td
            style="
              padding-left:20px;
            "
          >

            📦 ▶ ${prod}

          </td>

          <td>
            ${pdata.leads}
          </td>

          <td>
            $${pCpa.toFixed(2)}
          </td>

          <td>
            $${pdata.spend.toFixed(2)}
          </td>

          <td
            style="
              color:var(--yellow);
              font-weight:700;
            "
          >

            $${pRealSp.toFixed(2)}

          </td>

          <td
            class="${pCls}"
          >

            ${pProf >= 0 ? "+" : ""}$${pProf.toFixed(2)}

          </td>

          <td
            class="${pCls}"
          >

            ${pRoi.toFixed(1)}%

          </td>

        </tr>

      `;

          let gIdx = 0;

          let isPHidden = isOHidden || !expandedTreeKeys.has(pKey);

          Object.entries(pdata.geos)

            .sort((a, b) => b[1].spend - a[1].spend)

            .forEach(([geo, gdata]) => {
              let gRealSp = gdata.spend * feeMult;

              let gProf = gdata.rev - gRealSp;

              let gCpa = gdata.leads > 0 ? pdata.spend / pdata.leads : 0;

              let gRoi = gRealSp > 0 ? (gProf / gRealSp) * 100 : 0;

              let gCls = gProf >= 0 ? "green" : "red";

              let gKey = `tg-${oIdx}-${pIdx}-${gIdx}`;

              treeHtml += `

          <tr
            class="
              row-tree-geo
              ${oKey}
              ${pKey}
              ${isPHidden ? "hidden" : ""}
            "
            onclick="toggleTreeRow('${gKey}')"
          >

            <td
              style="
                padding-left:40px;
              "
            >

              ↳ 🌍 ${geo}

            </td>

            <td>
              ${gdata.leads}
            </td>

            <td>
              $${gCpa.toFixed(2)}
            </td>

            <td>
              $${gdata.spend.toFixed(2)}
            </td>

            <td
              style="
                color:var(--yellow);
                font-weight:700;
              "
            >

              $${gRealSp.toFixed(2)}

            </td>

            <td
              class="${gCls}"
            >

              ${gProf >= 0 ? "+" : ""}$${gProf.toFixed(2)}

            </td>

            <td
              class="${gCls}"
            >

              ${gRoi.toFixed(1)}%

            </td>

          </tr>

        `;

              let isGHidden = isPHidden || !expandedTreeKeys.has(gKey);

              Object.entries(gdata.months).forEach(([mon, mdata]) => {
                let mRealSp = mdata.spend * feeMult;

                let mProf = mdata.rev - mRealSp;

                let mCpa = mdata.leads > 0 ? mdata.spend / mdata.leads : 0;

                let mRoi = mRealSp > 0 ? (mProf / mRealSp) * 100 : 0;

                let mCls = mProf >= 0 ? "green" : "red";

                treeHtml += `

            <tr
              class="
                row-tree-month
                ${oKey}
                ${pKey}
                ${gKey}
                ${isGHidden ? "hidden" : ""}
              "
            >

              <td
                style="
                  padding-left:60px;
                "
              >

                • ${mon.toUpperCase()}

              </td>

              <td>
                ${mdata.leads}
              </td>

              <td>
                $${mCpa.toFixed(2)}
              </td>

              <td>
                $${mdata.spend.toFixed(2)}
              </td>

              <td
                style="
                  color:var(--yellow);
                  font-weight:700;
                "
              >

                $${mRealSp.toFixed(2)}

              </td>

              <td
                class="${mCls}"
              >

                ${mProf >= 0 ? "+" : ""}$${mProf.toFixed(2)}

              </td>

              <td
                class="${mCls}"
              >

                ${mRoi.toFixed(1)}%

              </td>

            </tr>

          `;
              });

              gIdx++;
            });

          pIdx++;
        });

      oIdx++;
    });

  document.querySelector("#tblTree tbody").innerHTML =
    treeHtml ||
    "<tr><td colspan='7' style='text-align:center;'>Нет данных</td></tr>";

  /*
   * ========================================================
   * 2. STABILITY
   * ========================================================
   */

  let stabMap = {};

  rows.forEach((r) => {
    let key = r.campaign || `[${r.offer_type}] ${r.product_full} — ${r.geo}`;

    if (!stabMap[key]) {
      stabMap[key] = {
        offer: r.offer_type,

        spend: 0,

        leads: 0,

        rev: 0,
      };
    }

    stabMap[key].spend += r.spend;

    stabMap[key].leads += r.leads;

    stabMap[key].rev += r.leads * r.payout;
  });

  let stabList = Object.entries(stabMap)

    .map(([combo, d]) => {
      let realSp = d.spend * feeMult;

      let prof = d.rev - realSp;

      let cpa = d.leads > 0 ? d.spend / d.leads : 0;

      let roi = realSp > 0 ? (prof / realSp) * 100 : 0;

      let status = "noise";

      let badge = "⚪ Мало данных";

      let action = "Случайный шум";

      if (d.leads >= 50) {
        status = "stable";

        badge = "🟢 Стабильный";

        action =
          roi > 15
            ? "Масштабировать бюджет"
            : roi < 0
              ? "Стоп связки"
              : "Держать объем";
      } else if (d.leads >= 15) {
        status = "warning";

        badge = "🟡 Есть сигнал";

        action = `Докрутить тест (${d.leads}/50 лидов)`;
      }

      return {
        combo,

        offer: d.offer,

        status,

        badge,

        action,

        leads: d.leads,

        cpa,

        spend: d.spend,

        realSpend: realSp,

        profit: prof,

        roi,
      };
    })

    .sort(
      (a, b) =>
        compareOffers(a.offer, b.offer) ||
        (b.status === "stable") - (a.status === "stable") ||
        b.profit - a.profit,
    );

  document.querySelector("#tblStability tbody").innerHTML =
    stabList

      .map(
        (s) => `

    <tr
      data-status="${s.status}"
      data-offer="${s.offer}"
    >

      <td>
        <b>${s.combo}</b>
      </td>

      <td>
        <span
          class="
            sig-badge
            sig-${s.status}
          "
        >
          ${s.badge}
        </span>
      </td>

      <td
        style="
          font-size:11px;
        "
      >
        ${s.action}
      </td>

      <td>
        ${s.leads}
      </td>

      <td>
        $${s.cpa.toFixed(2)}
      </td>

      <td>
        $${s.spend.toFixed(2)}
      </td>

      <td
        style="
          color:var(--yellow);
          font-weight:700;
        "
      >
        $${s.realSpend.toFixed(2)}
      </td>

      <td
        class="${s.profit >= 0 ? "green" : "red"}"
      >

        <b>

          ${s.profit >= 0 ? "+" : ""}$${s.profit.toFixed(2)}

        </b>

      </td>

      <td
        class="${s.roi >= 0 ? "green" : "red"}"
      >

        ${s.roi.toFixed(1)}%

      </td>

    </tr>

  `,
      )
      .join("") ||
    "<tr><td colspan='9' style='text-align:center;'>Нет данных</td></tr>";

  applyTableVisibility(
    "tblStability",
    currentOfferFilter,
    currentStabilityFilter,
  );

  /*
   * ========================================================
   * 3. FUNNEL
   * ========================================================
   */

  let funnelMap = {};

  rows.forEach((r) => {
    let key = r.campaign || `[${r.offer_type}] ${r.product_full} [${r.geo}]`;

    if (!funnelMap[key]) {
      funnelMap[key] = {
        offer: r.offer_type,

        spend: 0,

        imp: 0,

        clk: 0,

        leads: 0,

        payout: r.payout,
      };
    }

    funnelMap[key].spend += r.spend;

    funnelMap[key].imp += r.impressions;

    funnelMap[key].clk += r.link_clicks;

    funnelMap[key].leads += r.leads;
  });

  let funnelList = Object.entries(funnelMap)

    .map(([target, d]) => {
      let cpm = d.imp > 0 ? (d.spend / d.imp) * 1000 : 0;

      let ctr = d.imp > 0 ? (d.clk / d.imp) * 100 : 0;

      let cpc = d.clk > 0 ? d.spend / d.clk : 0;

      let cr = d.clk > 0 ? (d.leads / d.clk) * 100 : 0;

      let cpa = d.leads > 0 ? d.spend / d.leads : 0;

      let diag = "Обычный ход открута";

      let diagCls = "d-norm";

      if (d.offer === "339") {
        if (d.clk >= 50 && cr < 0.6 && ctr >= 5.0) {
          diag = "⚠️ Мислид / Слив кликов (CR < 0.6%)";

          diagCls = "d-warn";
        } else if (d.imp >= 3000 && ctr < 3.5) {
          diag = "🎨 Слабый CTR для объема (< 3.5%)";

          diagCls = "d-creative";
        } else if (cpa > 0 && cpa <= 1.05 && cr >= 1.0) {
          diag = "🚀 Золотой объем (CR и CPA в норме)";

          diagCls = "d-good";
        } else if (cr >= 1.0 && cr <= 3.0) {
          diag = "✅ Нормальный ход связки";

          diagCls = "d-good";
        } else if (cr > 3.0) {
          diag = "🔥 Аномальный пробив (CR > 3%)";

          diagCls = "d-good";
        }
      } else {
        if (d.clk >= 40 && cr < 4.0 && ctr >= 1.8) {
          diag = "⚠️ Мислид / Слабый лендинг (CR < 4%)";

          diagCls = "d-warn";
        } else if (d.imp >= 1500 && ctr < 0.9 && cr >= 10.0) {
          diag = "🎨 Слабый креатив (лендинг держит)";

          diagCls = "d-creative";
        } else if (cpm > 8.0 && ctr >= 1.5 && cr >= 8.0) {
          diag = "📉 Дорогой аукцион";

          diagCls = "d-cpm";
        } else if (ctr >= 2.0 && cr >= 8.0 && cpa <= 0.2) {
          diag = "🚀 Золотая связка";

          diagCls = "d-good";
        }
      }

      return {
        target,

        offer: d.offer,

        imp: d.imp,

        clk: d.clk,

        leads: d.leads,

        cpm,

        ctr,

        cpc,

        cr,

        cpa,

        diag,

        diagCls,

        spend: d.spend,
      };
    })

    .sort((a, b) => compareOffers(a.offer, b.offer) || b.spend - a.spend);

  document.querySelector("#tblFunnel tbody").innerHTML =
    funnelList

      .map(
        (f) => `

    <tr
      data-offer="${f.offer}"
    >

      <td>
        <b>${f.target}</b>
      </td>

      <td>
        ${f.imp.toLocaleString("en-US")}
      </td>

      <td>
        ${f.clk.toLocaleString("en-US")}
      </td>

      <td>
        ${f.leads}
      </td>

      <td>
        $${f.cpm.toFixed(2)}
      </td>

      <td>
        ${f.ctr.toFixed(2)}%
      </td>

      <td>
        $${f.cpc.toFixed(3)}
      </td>

      <td>
        ${f.cr.toFixed(2)}%
      </td>

      <td>
        $${f.cpa.toFixed(2)}
      </td>

      <td>

        <span
          class="
            diag-pill
            ${f.diagCls}
          "
        >

          ${f.diag}

        </span>

      </td>

    </tr>

  `,
      )
      .join("") ||
    "<tr><td colspan='10' style='text-align:center;'>Нет данных</td></tr>";

  applyTableVisibility("tblFunnel", currentOfferFilter, "all");

  /*
   * ========================================================
   * 4. VIDEO FUNNEL
   * ========================================================
   */

  if (HAS_VIDEO) {
    let vidMap = {};

    rows.forEach((r) => {
      let key = r.campaign || `[${r.offer_type}] ${r.product_full} [${r.geo}]`;

      if (!vidMap[key]) {
        vidMap[key] = {
          offer: r.offer_type,

          imp: 0,

          v3s: 0,

          thru: 0,

          clk: 0,

          leads: 0,

          spend: 0,
        };
      }

      vidMap[key].imp += r.impressions;

      vidMap[key].v3s += r.video_3s;

      vidMap[key].thru += r.thruplays;

      vidMap[key].clk += r.link_clicks;

      vidMap[key].leads += r.leads;

      vidMap[key].spend += r.spend;
    });

    let vidList = Object.entries(vidMap)

      .map(([target, d]) => {
        let hookRate = d.imp > 0 ? (d.v3s / d.imp) * 100 : 0;

        let holdRate = d.v3s > 0 ? (d.thru / d.v3s) * 100 : 0;

        let ctr = d.imp > 0 ? (d.clk / d.imp) * 100 : 0;

        let vDiag = "Обычный ролик";

        let vCls = "d-norm";

        if (hookRate >= 28.0 && holdRate >= 30.0) {
          vDiag = "🔥 Топовый крео: держит от начала до конца";

          vCls = "d-good";
        } else if (hookRate >= 28.0 && holdRate < 20.0) {
          vDiag = "⚠️ Мислид: хук цепляет, тело слабое";

          vCls = "d-warn";
        } else if (hookRate < 18.0) {
          vDiag = "❌ Мертвый хук: менять первые 3 секунды";

          vCls = "d-warn";
        } else if (holdRate >= 35.0) {
          vDiag = "🎯 Сильное тело ролика";

          vCls = "d-good";
        }

        return {
          target,

          offer: d.offer,

          imp: d.imp,

          v3s: d.v3s,

          thru: d.thru,

          hookRate,

          holdRate,

          ctr,

          leads: d.leads,

          vDiag,

          vCls,

          spend: d.spend,
        };
      })

      .filter((v) => v.imp > 0)

      .sort((a, b) => compareOffers(a.offer, b.offer) || b.spend - a.spend);

    document.querySelector("#tblVideo tbody").innerHTML =
      vidList

        .map(
          (v) => `

      <tr
        data-offer="${v.offer}"
        data-hook="${v.hookRate}"
        data-hold="${v.holdRate}"
        data-leads="${v.leads}"
        data-spend="${v.spend}"
      >

        <td>
          <b>${v.target}</b>
        </td>

        <td>
          ${v.imp.toLocaleString("en-US")}
        </td>

        <td>
          ${v.v3s.toLocaleString("en-US")}
        </td>

        <td>
          ${v.thru.toLocaleString("en-US")}
        </td>

        <td
          style="
            font-weight:700;
            color:${
              v.hookRate >= 28
                ? "var(--green)"
                : v.hookRate < 18
                  ? "var(--red)"
                  : "var(--yellow)"
            }
          "
        >
          ${v.hookRate.toFixed(1)}%
        </td>

        <td
          style="
            font-weight:700;
            color:${
              v.holdRate >= 30
                ? "var(--green)"
                : v.holdRate < 18
                  ? "var(--red)"
                  : "var(--yellow)"
            }
          "
        >
          ${v.holdRate.toFixed(1)}%
        </td>

        <td>
          ${v.ctr.toFixed(2)}%
        </td>

        <td>
          ${v.leads}
        </td>

        <td>

          <span
            class="
              diag-pill
              ${v.vCls}
            "
          >

            ${v.vDiag}

          </span>

        </td>

      </tr>

    `,
        )

        .join("") ||
      "<tr><td colspan='9' style='text-align:center;'>Нет данных по видео</td></tr>";

    applyVideoTableFilter();
  }

  /*
   * ========================================================
   * 5. APPROACHES + CREATIVES
   * ========================================================
   */

  function renderApproachesTable(subRows) {
    const tbody = document.querySelector("#tblApproaches tbody");

    if (!tbody) {
      return;
    }

    const approachList = groupOffer(subRows, "approach");

    if (!approachList || approachList.length === 0) {
      tbody.innerHTML =
        "<tr>" +
        "<td colspan='7' " +
        "style='text-align:center; color:var(--text-muted); padding:14px;'>" +
        "Нет данных" +
        "</td>" +
        "</tr>";

      return;
    }

    let html = "";

    approachList.forEach((approachRow) => {
      const approachName = approachRow.name || "Unknown";

      const isExpanded = expandedApproaches.has(approachName);

      html += `
      <tr
        class="approach-parent-row"
        data-approach-name="${approachName}"
        onclick="toggleApproachRow(this)"
        style="cursor:pointer;"
      >
        <td>
          <span
            style="
              display:inline-block;
              width:20px;
              font-weight:700;
            "
          >
            ${isExpanded ? "▼" : "▶"}
          </span>

          <b>${approachName}</b>
        </td>

        <td>
          $${approachRow.spend.toFixed(2)}
        </td>

        <td
          style="
            color:var(--yellow);
            font-weight:700;
          "
        >
          $${approachRow.realSpend.toFixed(2)}
        </td>

        <td>
          ${approachRow.leads}
        </td>

        <td>
          $${approachRow.cpa.toFixed(3)}
        </td>

        <td
          class="${approachRow.profit >= 0 ? "green" : "red"}"
        >
          <b>
            ${
              approachRow.profit >= 0 ? "+" : ""
            }$${approachRow.profit.toFixed(2)}
          </b>
        </td>

        <td
          class="${approachRow.roi >= 0 ? "green" : "red"}"
        >
          ${approachRow.roi.toFixed(1)}%
        </td>
      </tr>
    `;

      if (isExpanded) {
        const approachRows = subRows.filter(
          (r) => (r.approach || "Unknown") === approachName,
        );

        const creativeList = groupOffer(approachRows, "product_full");

        creativeList.forEach((creativeRow) => {
          html += `
            <tr
              class="approach-child-row"
              style="
                background:rgba(255,255,255,0.025);
              "
            >
              <td
                style="
                  padding-left:42px;
                "
              >
                ↳ <b>${creativeRow.name}</b>
              </td>

              <td>
                $${creativeRow.spend.toFixed(2)}
              </td>

              <td
                style="
                  color:var(--yellow);
                  font-weight:700;
                "
              >
                $${creativeRow.realSpend.toFixed(2)}
              </td>

              <td>
                ${creativeRow.leads}
              </td>

              <td>
                $${creativeRow.cpa.toFixed(3)}
              </td>

              <td
                class="${creativeRow.profit >= 0 ? "green" : "red"}"
              >
                <b>
                  ${
                    creativeRow.profit >= 0 ? "+" : ""
                  }$${creativeRow.profit.toFixed(2)}
                </b>
              </td>

              <td
                class="${creativeRow.roi >= 0 ? "green" : "red"}"
              >
                ${creativeRow.roi.toFixed(1)}%
              </td>
            </tr>
          `;
        });
      }
    });

    tbody.innerHTML = html;
  }

  renderApproachesTable(rows);

  /*
   * ========================================================
   * 6. BID + MONTH
   * ========================================================
   */

  fillTable("#tblBid tbody", groupOffer(rows, "bid_marker"));

  fillTable("#tblMonth tbody", groupOffer(rows, "month"));

  /*
   * ========================================================
   * 7. DEMOGRAPHICS
   * ========================================================
   */

  if (HAS_DEMO) {
    let gMap = {};

    rows.forEach((r) => {
      let k = r.gender || "Unknown";

      if (!gMap[k]) {
        gMap[k] = {
          name: k,
          spend: 0,
          leads: 0,
          clicks: 0,
        };
      }

      gMap[k].spend += r.spend;
      gMap[k].leads += r.leads;
      gMap[k].clicks += r.link_clicks;
    });

    let gArr = Object.values(gMap).sort((a, b) => b.spend - a.spend);

    document.querySelector("#tblGender tbody").innerHTML = gArr
      .map(
        (m) => `
      <tr
        class="demo-click-row ${
          demographicDrilldown.gender === m.name ? "demo-selected" : ""
        }"
        data-demo-gender="${encodeURIComponent(m.name)}"
        style="cursor:pointer;"
        title="Нажми, чтобы раскрыть демографию"
      >
        <td><b>${escapeHtml(m.name)}</b></td>
        <td>$${m.spend.toFixed(2)}</td>
        <td>${m.leads}</td>
        <td>${m.leads > 0 ? (m.spend / m.leads).toFixed(3) : "0.000"}</td>
        <td>${
          m.clicks > 0 ? ((m.leads / m.clicks) * 100).toFixed(1) : "0.0"
        }%</td>
      </tr>
    `,
      )
      .join("");

    let aMap = {};

    rows.forEach((r) => {
      let k = r.age || "Unknown";

      if (!aMap[k]) {
        aMap[k] = {
          name: k,
          spend: 0,
          leads: 0,
          clicks: 0,
        };
      }

      aMap[k].spend += r.spend;
      aMap[k].leads += r.leads;
      aMap[k].clicks += r.link_clicks;
    });

    let aArr = Object.values(aMap);

    if (ageSortMode === "asc") {
      aArr.sort((a, b) => {
        let getNum = (s) => {
          let m = String(s).match(/\d+/);
          return m ? parseInt(m[0], 10) : 999;
        };

        return getNum(a.name) - getNum(b.name);
      });
    } else {
      aArr.sort((a, b) => b.spend - a.spend);
    }

    document.querySelector("#tblAge tbody").innerHTML = aArr
      .map(
        (m) => `
      <tr
        class="demo-click-row ${
          demographicDrilldown.age === m.name ? "demo-selected" : ""
        }"
        data-demo-age="${encodeURIComponent(m.name)}"
        style="cursor:pointer;"
        title="Нажми, чтобы раскрыть демографию"
      >
        <td><b>${escapeHtml(m.name)}</b></td>
        <td>$${m.spend.toFixed(2)}</td>
        <td>${m.leads}</td>
        <td>${m.leads > 0 ? (m.spend / m.leads).toFixed(3) : "0.000"}</td>
        <td>${
          m.clicks > 0 ? ((m.leads / m.clicks) * 100).toFixed(1) : "0.0"
        }%</td>
      </tr>
    `,
      )
      .join("");

    renderDemographyDrilldown(rows);
  }

  /*
   * ========================================================
   * 8. OFFER-SPECIFIC WIDGETS
   * ========================================================
   */

  renderOfferSpecificWidgets(sourceRows);
}

/*
 * ==========================================================
 * OFFER-SPECIFIC WIDGETS
 * ==========================================================
 */

function offerSafeKey(offer) {
  const raw = String(offer || "unknown");
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return cleaned || "unknown";
}

function getOfferWidgetIds(offer) {
  const key = offerSafeKey(offer);

  if (String(offer) === "418") {
    return {
      financeSection: "sec-offer-418",
      financeGeo: "tblGeo418",
      financeProduct: "tblProduct418",
      matrixSection: "sec-matrix-418",
      matrix: "tblMatrix418",
    };
  }

  if (String(offer) === "339") {
    return {
      financeSection: "sec-offer-339",
      financeGeo: "tblGeo339",
      financeProduct: "tblProduct339",
      matrixSection: "sec-matrix-339",
      matrix: "tblMatrix339",
    };
  }

  return {
    financeSection: `sec-offer-${key}`,
    financeGeo: `tblGeo-${key}`,
    financeProduct: `tblProduct-${key}`,
    matrixSection: `sec-matrix-${key}`,
    matrix: `tblMatrix-${key}`,
  };
}

function buildDynamicOfferWidgetSet(offer) {
  const ids = getOfferWidgetIds(offer);
  const widgetsContainer = document.getElementById("widgetsContainer");

  if (!widgetsContainer) {
    return;
  }

  if (document.getElementById(ids.financeSection)) {
    return;
  }

  const finance = document.createElement("div");

  finance.className = "dashboard-widget";
  finance.id = ids.financeSection;
  finance.dataset.dynamicOffer = "1";
  finance.dataset.offerType = String(offer);

  finance.innerHTML = `
    <div class="widget-header">
      <h3>
        <span
          class="section-tag"
          style="
            color:var(--green);
            border-color:var(--green);
          "
        >
          ОФФЕР ${escapeHtml(offer)}
        </span>
        Финансовый Срез
      </h3>

      <div class="widget-controls">
        <button
          class="btn-icon"
          onclick="moveWidget('${ids.financeSection}', -1)"
          title="Поднять выше"
        >
          ▲
        </button>

        <button
          class="btn-icon"
          onclick="moveWidget('${ids.financeSection}', 1)"
          title="Опустить ниже"
        >
          ▼
        </button>

        <button
          class="btn-icon"
          onclick="toggleWidgetBody('${ids.financeSection}')"
          title="Свернуть / Развернуть"
        >
          —
        </button>
      </div>
    </div>

    <div
      class="table-wrapper"
      style="
        padding:10px;
        background:transparent;
      "
    >
      <div class="widgets-row-2col">
        <div
          style="
            background:var(--bg-card);
            border:1px solid var(--border-color);
            border-radius:8px;
            overflow:hidden;
          "
        >
          <table id="${ids.financeGeo}">
            <thead>
              <tr>
                <th>GEO</th>
                <th>FB Спенд</th>
                <th class="th-spend-title">Расход (+8%)</th>
                <th>Лиды</th>
                <th>CPA</th>
                <th>Профит</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <div
          style="
            background:var(--bg-card);
            border:1px solid var(--border-color);
            border-radius:8px;
            overflow:hidden;
          "
        >
          <table id="${ids.financeProduct}">
            <thead>
              <tr>
                <th>Продукт</th>
                <th>FB Спенд</th>
                <th class="th-spend-title">Расход (+8%)</th>
                <th>Лиды</th>
                <th>CPA</th>
                <th>Профит</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const matrix = document.createElement("div");

  matrix.className = "dashboard-widget";
  matrix.id = ids.matrixSection;
  matrix.dataset.dynamicOffer = "1";
  matrix.dataset.offerType = String(offer);

  matrix.innerHTML = `
    <div class="widget-header">
      <h3>
        <span
          class="section-tag"
          style="
            color:var(--green);
            border-color:var(--green);
          "
        >
          ОФФЕР ${escapeHtml(offer)}
        </span>
        Матрица Связок (Товары × GEO)
      </h3>

      <div class="widget-controls">
        <button
          class="btn-icon"
          onclick="moveWidget('${ids.matrixSection}', -1)"
          title="Поднять выше"
        >
          ▲
        </button>

        <button
          class="btn-icon"
          onclick="moveWidget('${ids.matrixSection}', 1)"
          title="Опустить ниже"
        >
          ▼
        </button>

        <button
          class="btn-icon"
          onclick="toggleWidgetBody('${ids.matrixSection}')"
          title="Свернуть / Развернуть"
        >
          —
        </button>
      </div>
    </div>

    <div class="table-wrapper">
      <table id="${ids.matrix}">
        <thead></thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  widgetsContainer.appendChild(finance);
  widgetsContainer.appendChild(matrix);
}

function initDynamicOfferWidgets() {
  ALL_OFFERS.forEach((offer) => {
    if (offer !== "418" && offer !== "339") {
      buildDynamicOfferWidgetSet(offer);
    }
  });
}

function renderOfferSpecificWidgets(sourceRows) {
  const allOffers = Array.from(
    new Set(
      sourceRows.map((r) => String(r.offer_type || "").trim()).filter(Boolean),
    ),
  ).sort(compareOffers);

  ALL_OFFERS.forEach((offer) => {
    if (offer !== "418" && offer !== "339") {
      buildDynamicOfferWidgetSet(offer);
    }
  });

  const knownOffers = new Set(ALL_OFFERS);

  document
    .querySelectorAll('#widgetsContainer [data-dynamic-offer="1"]')
    .forEach((widget) => {
      const offer = String(widget.dataset.offerType || "");

      const existsInData = knownOffers.has(offer);

      if (!existsInData) {
        widget.style.display = "none";
        return;
      }

      const shouldShow =
        currentOfferFilter === "all" || currentOfferFilter === offer;

      widget.style.display = shouldShow ? "" : "none";
    });

  // 418 / 339 are already present in the HTML and are reused.
  ["418", "339"].forEach((offer) => {
    const ids = getOfferWidgetIds(offer);
    const section = document.getElementById(ids.financeSection);
    const matrixSection = document.getElementById(ids.matrixSection);

    const exists = allOffers.includes(offer);
    const shouldShow =
      currentOfferFilter === offer || (currentOfferFilter === "all" && exists);

    if (section) {
      section.style.display = shouldShow ? "" : "none";
    }

    if (matrixSection) {
      matrixSection.style.display = shouldShow ? "" : "none";
    }

    const offerRows = sourceRows.filter(
      (r) => String(r.offer_type || "") === offer,
    );

    renderOneOfferWidgetSet(offerRows, offer, ids);
  });

  allOffers
    .filter((offer) => offer !== "418" && offer !== "339")
    .forEach((offer) => {
      const ids = getOfferWidgetIds(offer);
      const offerRows = sourceRows.filter(
        (r) => String(r.offer_type || "") === offer,
      );

      renderOneOfferWidgetSet(offerRows, offer, ids);
    });

  // Защитный случай: выбран оффер, которого в текущем date-slice нет.
  if (currentOfferFilter !== "all" && !allOffers.includes(currentOfferFilter)) {
    const ids = getOfferWidgetIds(currentOfferFilter);

    if (currentOfferFilter !== "418" && currentOfferFilter !== "339") {
      buildDynamicOfferWidgetSet(currentOfferFilter);

      const section = document.getElementById(ids.financeSection);
      const matrixSection = document.getElementById(ids.matrixSection);

      if (section) section.style.display = "";
      if (matrixSection) matrixSection.style.display = "";

      renderOneOfferWidgetSet([], currentOfferFilter, ids);
    }
  }
}

function renderOneOfferWidgetSet(offerRows, offer, ids) {
  const geoTable = document.getElementById(ids.financeGeo);

  const productTable = document.getElementById(ids.financeProduct);

  const matrixTable = document.getElementById(ids.matrix);

  if (!geoTable || !productTable || !matrixTable) {
    return;
  }

  fillTableOutsideRender(
    geoTable.querySelector("tbody"),
    groupRowsForWidget(offerRows, "geo"),
  );

  fillTableOutsideRender(
    productTable.querySelector("tbody"),
    groupRowsForWidget(offerRows, "product_full"),
  );

  renderMatrix(offerRows, ids.matrix);

  const sectionTag = document.querySelector(
    `#${ids.financeSection} .section-tag`,
  );

  const matrixTag = document.querySelector(
    `#${ids.matrixSection} .section-tag`,
  );

  if (sectionTag) {
    sectionTag.textContent = `ОФФЕР ${offer}`;
  }

  if (matrixTag) {
    matrixTag.textContent = `ОФФЕР ${offer}`;
  }
}

function groupRowsForWidget(subRows, key) {
  const map = {};
  const feeMult = isAgencyFeeActive ? 1.08 : 1.0;

  subRows.forEach((r) => {
    const val = r[key] || "Unknown";

    if (!map[val]) {
      map[val] = {
        name: r[key] || val,
        spend: 0,
        leads: 0,
        rev: 0,
      };
    }

    map[val].spend += Number(r.spend || 0);
    map[val].leads += Number(r.leads || 0);
    map[val].rev += Number(r.leads || 0) * Number(r.payout || 0);
  });

  return Object.values(map)
    .map((m) => {
      m.realSpend = m.spend * feeMult;
      m.profit = m.rev - m.realSpend;

      m.cpa = m.leads > 0 ? m.spend / m.leads : 0;

      m.roi = m.realSpend > 0 ? (m.profit / m.realSpend) * 100 : 0;

      return m;
    })
    .sort((a, b) => b.profit - a.profit);
}

function fillTableOutsideRender(tbody, list) {
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML =
      "<tr><td colspan='7' style='text-align:center; color:var(--text-muted); padding:14px;'>Нет данных</td></tr>";

    return;
  }

  tbody.innerHTML = list
    .map(
      (r) => `
      <tr>
        <td><b>${escapeHtml(r.name)}</b></td>

        <td>
          $${r.spend.toFixed(2)}
        </td>

        <td style="color:var(--yellow);font-weight:700;">
          $${r.realSpend.toFixed(2)}
        </td>

        <td>
          ${r.leads}
        </td>

        <td>
          $${r.cpa.toFixed(3)}
        </td>

        <td class="${r.profit >= 0 ? "green" : "red"}">
          <b>
            ${r.profit >= 0 ? "+" : ""}$${r.profit.toFixed(2)}
          </b>
        </td>

        <td class="${r.roi >= 0 ? "green" : "red"}">
          ${r.roi.toFixed(1)}%
        </td>
      </tr>
    `,
    )
    .join("");
}

function renderOfferSpecificSet(rows, matrixId, geoId, productId, title) {
  renderMatrix(rows, matrixId);

  fillTableOutsideRender(
    document.querySelector(`#${geoId} tbody`),
    groupRowsForWidget(rows, "geo"),
  );

  fillTableOutsideRender(
    document.querySelector(`#${productId} tbody`),
    groupRowsForWidget(rows, "product_full"),
  );

  const matrixWidget = getWidgetByTableId(matrixId);

  const geoWidget = getWidgetByTableId(geoId);

  const productWidget = getWidgetByTableId(productId);

  setOfferWidgetTitle(matrixWidget, `${title} · Матрица`);

  setOfferWidgetTitle(geoWidget, `${title} · GEO`);

  setOfferWidgetTitle(productWidget, `${title} · Product`);
}

/*
 * ==========================================================
 * REORDER
 * ==========================================================
 */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function ensureDemographyDrilldown() {
  const body = document.querySelector("#sec-demo-row .table-wrapper");

  if (!body) return null;

  let panel = document.getElementById("demoDrilldown");

  if (!panel) {
    panel = document.createElement("div");

    panel.id = "demoDrilldown";

    panel.style.cssText = [
      "margin-top:10px",
      "padding:12px",
      "background:var(--bg-card)",
      "border:1px solid var(--border-color)",
      "border-radius:8px",
      "display:none",
    ].join(";");

    body.appendChild(panel);
  }

  return panel;
}

function groupDemoDimension(subRows, key) {
  const map = {};

  subRows.forEach((r) => {
    const name = r[key] || "Unknown";

    if (!map[name]) {
      map[name] = {
        name,
        spend: 0,
        leads: 0,
        clicks: 0,
      };
    }

    map[name].spend += r.spend;
    map[name].leads += r.leads;
    map[name].clicks += r.link_clicks;
  });

  return Object.values(map).sort((a, b) => b.spend - a.spend);
}

function groupDemoFinancial(subRows, key) {
  const map = {};

  subRows.forEach((r) => {
    const name = r[key] || "Unknown";

    if (!map[name]) {
      map[name] = {
        name,
        spend: 0,
        leads: 0,
        clicks: 0,
        rev: 0,
      };
    }

    map[name].spend += r.spend;
    map[name].leads += r.leads;
    map[name].clicks += r.link_clicks;
    map[name].rev += r.leads * r.payout;
  });

  return Object.values(map)
    .map((m) => {
      m.realSpend = m.spend * (isAgencyFeeActive ? 1.08 : 1.0);

      m.profit = m.rev - m.realSpend;

      m.cpa = m.leads > 0 ? m.spend / m.leads : 0;

      m.cr = m.clicks > 0 ? (m.leads / m.clicks) * 100 : 0;

      m.roi = m.realSpend > 0 ? (m.profit / m.realSpend) * 100 : 0;

      return m;
    })
    .sort((a, b) => b.profit - a.profit);
}

function demoDimensionTable(list, nextKey) {
  if (!list.length) {
    return `
      <div style="
        color:var(--text-muted);
        padding:10px 2px;
      ">
        Нет данных для следующего уровня
      </div>
    `;
  }

  return `
    <table style="width:100%;">
      <thead>
        <tr>
          <th>
            ${nextKey === "age" ? "Возраст" : "Пол"}
          </th>
          <th>Спенд</th>
          <th>Лиды</th>
          <th>CPA</th>
          <th>CR%</th>
        </tr>
      </thead>

      <tbody>
        ${list
          .map((m) => {
            const encoded = encodeURIComponent(m.name);

            const attr =
              nextKey === "age"
                ? `data-demo-next-age="${encoded}"`
                : `data-demo-next-gender="${encoded}"`;

            return `
              <tr
                class="demo-drill-click-row"
                ${attr}
                style="cursor:pointer;"
              >
                <td>
                  <b>${escapeHtml(m.name)}</b>
                </td>

                <td>
                  $${m.spend.toFixed(2)}
                </td>

                <td>
                  ${m.leads.toLocaleString("en-US")}
                </td>

                <td>
                  $${m.leads > 0 ? (m.spend / m.leads).toFixed(3) : "0.000"}
                </td>

                <td>
                  ${
                    m.clicks > 0
                      ? ((m.leads / m.clicks) * 100).toFixed(1)
                      : "0.0"
                  }%
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function demoFinancialTable(list, title) {
  if (!list.length) {
    return `
      <div style="
        margin-top:12px;
        color:var(--text-muted);
      ">
        ${title}: нет данных
      </div>
    `;
  }

  return `
    <div style="margin-top:14px;">
      <div style="
        font-size:11px;
        font-weight:800;
        text-transform:uppercase;
        letter-spacing:.06em;
        color:var(--text-muted);
        margin-bottom:6px;
      ">
        ${title}
      </div>

      <div style="overflow:auto;">
        <table
          style="
            width:100%;
            min-width:760px;
          "
        >
          <thead>
            <tr>
              <th>
                ${title === "Подходы" ? "Подход" : "Кампания"}
              </th>
              <th>Спенд</th>
              <th>Лиды</th>
              <th>CPA</th>
              <th>CR%</th>
              <th>Профит</th>
              <th>ROI</th>
            </tr>
          </thead>

          <tbody>
            ${list
              .map(
                (m) => `
                  <tr>
                    <td>
                      <b>
                        ${escapeHtml(m.name)}
                      </b>
                    </td>

                    <td>
                      $${m.spend.toFixed(2)}
                    </td>

                    <td>
                      ${m.leads.toLocaleString("en-US")}
                    </td>

                    <td>
                      $${m.cpa.toFixed(3)}
                    </td>

                    <td>
                      ${m.cr.toFixed(1)}%
                    </td>

                    <td
                      class="${m.profit >= 0 ? "green" : "red"}"
                    >
                      <b>
                        ${m.profit >= 0 ? "+" : ""}$${m.profit.toFixed(2)}
                      </b>
                    </td>

                    <td
                      class="${m.roi >= 0 ? "green" : "red"}"
                    >
                      ${m.roi.toFixed(1)}%
                    </td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderDemographyDrilldown(rows) {
  const panel = ensureDemographyDrilldown();

  if (!panel) return;

  const { gender, age } = demographicDrilldown;

  let filtered = rows;

  if (gender) {
    filtered = filtered.filter((r) => (r.gender || "Unknown") === gender);
  }

  if (age) {
    filtered = filtered.filter((r) => (r.age || "Unknown") === age);
  }

  const titleParts = [];

  if (gender) titleParts.push(gender);
  if (age) titleParts.push(age);

  if (!gender && !age) {
    panel.style.display = "block";

    panel.innerHTML = `
      <div style="
        font-size:11px;
        color:var(--text-muted);
      ">
        ↳ Нажми на
        <b>пол</b>
        или
        <b>возраст</b>
        выше — увидишь подходы и
        конкретные кампании внутри сегмента.
      </div>
    `;

    return;
  }

  const total = groupDemoDimension(filtered, "gender");

  const ages = groupDemoDimension(filtered, "age");

  const approaches = groupDemoFinancial(filtered, "approach");

  const campaigns = groupDemoFinancial(filtered, "campaign");

  let nextLevel = "";

  if (gender && !age) {
    nextLevel = demoDimensionTable(ages, "age");
  }

  if (age && !gender) {
    nextLevel = demoDimensionTable(total, "gender");
  }

  const summarySpend = filtered.reduce((acc, r) => acc + r.spend, 0);

  const summaryLeads = filtered.reduce((acc, r) => acc + r.leads, 0);

  const summaryRealSpend = summarySpend * (isAgencyFeeActive ? 1.08 : 1.0);

  const summaryRevenue = filtered.reduce(
    (acc, r) => acc + r.leads * r.payout,
    0,
  );

  const summaryProfit = summaryRevenue - summaryRealSpend;

  const summaryCpa = summaryLeads > 0 ? summarySpend / summaryLeads : 0;

  const summaryRoi =
    summaryRealSpend > 0 ? (summaryProfit / summaryRealSpend) * 100 : 0;

  panel.style.display = "block";

  panel.innerHTML = `
    <div style="
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      margin-bottom:10px;
    ">
      <div>
        <div style="
          font-size:13px;
          font-weight:800;
        ">
          Детализация:
          ${escapeHtml(titleParts.join(" · "))}
        </div>

        <div style="
          font-size:11px;
          color:var(--text-muted);
          margin-top:3px;
        ">
          ${
            gender && age
              ? "Смотрим, какие подходы и кампании работают именно внутри этого сегмента."
              : "Ниже сразу видны подходы и кампании; при необходимости можно сузить сегмент ещё на один уровень."
          }
        </div>
      </div>

      <button
        class="btn"
        type="button"
        data-demo-reset
      >
        × Сбросить
      </button>
    </div>

    <div style="
      display:grid;
      grid-template-columns:
        repeat(5,minmax(0,1fr));
      gap:8px;
      margin-bottom:10px;
    ">
      <div
        class="card"
        style="padding:8px;"
      >
        <div class="card-label">
          Спенд
        </div>
        <div
          class="card-val"
          style="font-size:18px;"
        >
          $${summarySpend.toFixed(2)}
        </div>
      </div>

      <div
        class="card"
        style="padding:8px;"
      >
        <div class="card-label">
          Лиды
        </div>
        <div
          class="card-val"
          style="font-size:18px;"
        >
          ${summaryLeads.toLocaleString("en-US")}
        </div>
      </div>

      <div
        class="card"
        style="padding:8px;"
      >
        <div class="card-label">
          CPA
        </div>
        <div
          class="card-val"
          style="font-size:18px;"
        >
          $${summaryCpa.toFixed(3)}
        </div>
      </div>

      <div
        class="card"
        style="padding:8px;"
      >
        <div class="card-label">
          Profit
        </div>
        <div
          class="card-val ${summaryProfit >= 0 ? "green" : "red"}"
          style="font-size:18px;"
        >
          ${summaryProfit >= 0 ? "+" : ""}$${summaryProfit.toFixed(2)}
        </div>
      </div>

      <div
        class="card"
        style="padding:8px;"
      >
        <div class="card-label">
          ROI
        </div>
        <div
          class="card-val ${summaryRoi >= 0 ? "green" : "red"}"
          style="font-size:18px;"
        >
          ${summaryRoi.toFixed(1)}%
        </div>
      </div>
    </div>

    ${demoFinancialTable(approaches, "Подходы")}

    ${demoFinancialTable(campaigns, "Кампании")}

    ${
      nextLevel
        ? `
      <div style="
        margin-top:14px;
        font-size:11px;
        font-weight:800;
        text-transform:uppercase;
        letter-spacing:.06em;
        color:var(--text-muted);
        margin-bottom:6px;
      ">
        ${
          gender && !age
            ? "Возраст внутри выбранного пола"
            : "Пол внутри выбранного возраста"
        }
      </div>

      ${nextLevel}
    `
        : ""
    }
  `;
}

function initDemographyInteractions() {
  if (document.body.dataset.demoClickBound === "1") {
    return;
  }

  document.body.dataset.demoClickBound = "1";

  document.addEventListener("click", (event) => {
    const genderRow = event.target.closest("tr[data-demo-gender]");

    if (genderRow) {
      demographicDrilldown = {
        gender: decodeURIComponent(genderRow.dataset.demoGender || ""),
        age: null,
      };

      render(currentFilteredRows, 0);
      return;
    }

    const ageRow = event.target.closest("tr[data-demo-age]");

    if (ageRow) {
      demographicDrilldown = {
        gender: null,
        age: decodeURIComponent(ageRow.dataset.demoAge || ""),
      };

      render(currentFilteredRows, 0);
      return;
    }

    const drillAgeRow = event.target.closest("tr[data-demo-next-age]");

    if (drillAgeRow) {
      demographicDrilldown.age = decodeURIComponent(
        drillAgeRow.dataset.demoNextAge || "",
      );

      render(currentFilteredRows, 0);
      return;
    }

    const drillGenderRow = event.target.closest("tr[data-demo-next-gender]");

    if (drillGenderRow) {
      demographicDrilldown.gender = decodeURIComponent(
        drillGenderRow.dataset.demoNextGender || "",
      );

      render(currentFilteredRows, 0);
      return;
    }

    const resetButton = event.target.closest("[data-demo-reset]");

    if (resetButton) {
      demographicDrilldown = {
        gender: null,
        age: null,
      };

      render(currentFilteredRows, 0);
    }
  });
}

function toggleReorderMode() {
  document.body.classList.toggle("reorder-mode");

  const btn = document.getElementById("btn-reorder-toggle");

  if (document.body.classList.contains("reorder-mode")) {
    btn.textContent = "✓ Завершить настройку";

    btn.classList.add("active");
  } else {
    btn.textContent = "⇄ Настроить порядок";

    btn.classList.remove("active");

    saveWidgetOrder();
  }
}

function toggleWidgetBody(widgetId) {
  const widget = document.getElementById(widgetId);

  if (!widget) {
    return;
  }

  const body = widget.querySelector(".table-wrapper");

  if (body) {
    body.style.display = body.style.display === "none" ? "" : "none";
  }
}

function moveWidget(widgetId, direction) {
  const widget = document.getElementById(widgetId);

  const container = document.getElementById("widgetsContainer");

  if (!widget || !container) {
    return;
  }

  if (direction === -1 && widget.previousElementSibling) {
    container.insertBefore(widget, widget.previousElementSibling);
  } else if (direction === 1 && widget.nextElementSibling) {
    container.insertBefore(widget.nextElementSibling, widget);
  }

  saveWidgetOrder();
}

function saveWidgetOrder() {
  const container = document.getElementById("widgetsContainer");

  const currentOrder = Array.from(container.children)

    .map((w) => w.id)

    .filter(Boolean);

  localStorage.setItem("fb_widget_order_v8", JSON.stringify(currentOrder));
}

function restoreWidgetOrder() {
  const container = document.getElementById("widgetsContainer");

  if (!container) {
    return;
  }

  const savedOrder = JSON.parse(
    localStorage.getItem("fb_widget_order_v8") || "[]",
  );

  if (savedOrder.length > 0) {
    savedOrder.forEach((id) => {
      const el = document.getElementById(id);

      if (el) {
        container.appendChild(el);
      }
    });
  }
}

/*
 * ==========================================================
 * INIT
 * ==========================================================
 */

window.addEventListener("DOMContentLoaded", () => {
  initMonthSelector();
  initOfferFilter();
  initVideoFilters();
  initDynamicOfferWidgets();
  initDemographyInteractions();
  restoreWidgetOrder();

  applySlice(0, document.getElementById("btn-all"));
});
