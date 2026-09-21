(function () {
  function num(value) {
    if (value === null || value === undefined || value === "") {
      return 0;
    }

    const n = Number(value);

    return Number.isFinite(n) ? n : 0;
  }

  function sum(rows, field) {
    return rows.reduce((acc, row) => {
      return acc + num(row[field]);
    }, 0);
  }

  function feeRate() {
    if (typeof BUSINESS_RULES !== "undefined" && BUSINESS_RULES) {
      const rate = num(BUSINESS_RULES.agency_fee_rate);

      return rate >= 0 ? rate : 0.08;
    }

    return 0.08;
  }

  function actualSpend(spend, agencyActive) {
    const metaSpend = num(spend);

    if (!agencyActive) {
      return metaSpend;
    }

    return metaSpend * (1 + feeRate());
  }

  function aggregate(rows, agencyActive) {
    const safeRows = Array.isArray(rows) ? rows : [];

    /*
     * ==========================================
     * META SPEND
     * ==========================================
     */

    const spend = sum(safeRows, "spend");

    /*
     * ==========================================
     * META RESULTS
     * ==========================================
     */

    const metaResults = safeRows.reduce((acc, row) => {
      return (
        acc +
        num(row.meta_results !== undefined ? row.meta_results : row.results)
      );
    }, 0);

    /*
     * ==========================================
     * PAYABLE RESULTS
     * ==========================================
     */

    const payableResults = safeRows.reduce((acc, row) => {
      return (
        acc +
        num(row.payable_results !== undefined ? row.payable_results : row.leads)
      );
    }, 0);

    /*
     * ==========================================
     * UNPRICED RESULTS
     * ==========================================
     *
     * НИКОГДА не придумываем payout.
     */

    let unpricedResults = 0;

    safeRows.forEach((row) => {
      const configured =
        row.payout_configured !== false && row.payout_configured !== "false";

      if (!configured) {
        unpricedResults += num(
          row.payable_results !== undefined ? row.payable_results : row.leads,
        );
      }
    });

    /*
     * ==========================================
     * REVENUE
     * ==========================================
     */

    const revenueKnown = unpricedResults <= 0.0000001;

    let revenue = 0;

    if (revenueKnown) {
      safeRows.forEach((row) => {
        const results = num(
          row.payable_results !== undefined ? row.payable_results : row.leads,
        );

        revenue += results * num(row.payout);
      });
    } else {
      revenue = null;
    }

    /*
     * ==========================================
     * REAL SPEND
     * ==========================================
     */

    const realSpend = actualSpend(spend, agencyActive);

    const agencyFee = realSpend - spend;

    /*
     * ==========================================
     * PROFIT
     * ==========================================
     */

    const profit = revenueKnown ? revenue - realSpend : null;

    /*
     * ==========================================
     * ROI
     * ==========================================
     */

    const roi =
      revenueKnown && realSpend > 0 ? (profit / realSpend) * 100 : null;

    /*
     * ==========================================
     * TRAFFIC METRICS
     * ==========================================
     */

    const impressions = sum(safeRows, "impressions");

    const linkClicks = sum(safeRows, "link_clicks");

    const clicksAll = sum(safeRows, "clicks_all");

    const landingPageViews = sum(safeRows, "landing_page_views");

    const video3s = sum(safeRows, "video_3s");

    const thruplays = sum(safeRows, "thruplays");

    /*
     * ==========================================
     * CPA
     * ==========================================
     */

    const cpa = payableResults > 0 ? spend / payableResults : null;

    const actualCpa = payableResults > 0 ? realSpend / payableResults : null;

    /*
     * ==========================================
     * CPM
     * ==========================================
     */

    const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;

    /*
     * ==========================================
     * CPC
     * ==========================================
     */

    const cpc = linkClicks > 0 ? spend / linkClicks : null;

    /*
     * ==========================================
     * CTR
     * ==========================================
     */

    const ctr = impressions > 0 ? (linkClicks / impressions) * 100 : null;

    /*
     * ==========================================
     * CR
     * ==========================================
     */

    const cr = linkClicks > 0 ? (payableResults / linkClicks) * 100 : null;

    /*
     * ==========================================
     * LPV RATE
     * ==========================================
     */

    const lpvRate =
      linkClicks > 0 ? (landingPageViews / linkClicks) * 100 : null;

    /*
     * ==========================================
     * VIDEO HOOK
     * ==========================================
     */

    const hookRate = impressions > 0 ? (video3s / impressions) * 100 : null;

    /*
     * ==========================================
     * VIDEO HOLD
     * ==========================================
     */

    const holdRate = video3s > 0 ? (thruplays / video3s) * 100 : null;

    /*
     * ==========================================
     * DELIVERY
     * ==========================================
     */

    const deliveryAvailable = safeRows.some(
      (row) => String(row.delivery || "").trim() !== "",
    );

    const rejectedIds = new Set();

    if (deliveryAvailable) {
      safeRows.forEach((row) => {
        const delivery = String(row.delivery || "").toLowerCase();

        if (
          delivery.includes("reject") ||
          delivery.includes("disapprov") ||
          delivery.includes("отклон") ||
          delivery.includes("inactive") ||
          delivery.includes("not_delivering")
        ) {
          rejectedIds.add(String(row.campaign_id || row.campaign));
        }
      });
    }

    /*
     * ==========================================
     * DATES
     * ==========================================
     */

    const dates = Array.from(
      new Set(safeRows.map((row) => String(row.date || "")).filter(Boolean)),
    ).sort();

    /*
     * ==========================================
     * RETURN
     * ==========================================
     */

    return {
      rows: safeRows,

      spend,

      payableResults,

      metaResults,

      impressions,

      linkClicks,

      clicksAll,

      landingPageViews,

      video3s,

      thruplays,

      revenue,

      revenueKnown,

      unpricedResults,

      actualSpend: realSpend,

      agencyFee,

      profit,

      roi,

      cpa,

      actualCpa,

      cpm,

      cpc,

      ctr,

      cr,

      lpvRate,

      hookRate,

      holdRate,

      deliveryAvailable,

      rejectedCampaignCount: rejectedIds.size,

      dateStart: dates[0] || null,

      dateEnd: dates[dates.length - 1] || null,

      dateCount: dates.length,

      uniqueCampaignCount: new Set(
        safeRows.map((row) => String(row.campaign_id || row.campaign || "")),
      ).size,

      hasUnknownPayout: unpricedResults > 0,
    };
  }

  /*
   * ==========================================
   * GROUPS
   * ==========================================
   */

  function groupRows(rows, keyOrFn, agencyActive) {
    const map = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const rawKey =
        typeof keyOrFn === "function" ? keyOrFn(row) : row[keyOrFn];

      const key =
        rawKey === null || rawKey === undefined || rawKey === ""
          ? "Unknown"
          : String(rawKey);

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(row);
    });

    return Array.from(map.entries()).map(([name, group]) => {
      return {
        name,
        ...aggregate(group, agencyActive),
      };
    });
  }

  /*
   * ==========================================
   * FORMATTERS
   * ==========================================
   */

  function money(value, decimals = 2) {
    if (
      value === null ||
      value === undefined ||
      !Number.isFinite(Number(value))
    ) {
      return "N/A";
    }

    return "$" + Number(value).toFixed(decimals);
  }

  function pct(value, decimals = 1) {
    if (
      value === null ||
      value === undefined ||
      !Number.isFinite(Number(value))
    ) {
      return "N/A";
    }

    return Number(value).toFixed(decimals) + "%";
  }

  function integer(value) {
    return num(value).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });
  }

  /*
   * ==========================================
   * EXPORT
   * ==========================================
   */

  window.AnalyticsEngine = {
    num,

    sum,

    feeRate,

    actualSpend,

    aggregate,

    groupRows,

    money,

    pct,

    integer,
  };
})();
