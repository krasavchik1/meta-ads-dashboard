import os
import glob
import json
import webbrowser
import warnings

from data_engine import load_and_normalize_file, dataframe_to_records

warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

OUTPUT_HTML = "REPORT.html"


# ============================================================
# 1. ИЩЕМ САМЫЙ СВЕЖИЙ META-ЭКСПОРТ
# ============================================================

files = glob.glob("*.csv") + glob.glob("*.xlsx")

files = [
    f
    for f in files
    if not os.path.basename(f).startswith("~$")
    and os.path.abspath(f) != os.path.abspath(OUTPUT_HTML)
]

if not files:
    print("❌ В папке нет файлов .csv или .xlsx!")
    raise SystemExit(1)

latest_file = max(files, key=os.path.getmtime)

file_base = os.path.basename(latest_file)

account_name = (
    file_base
    .split("-Campaigns")[0]
    .split(".")[0]
)

print(
    f"📂 Обрабатываем: {file_base} | "
    f"Кабинет: {account_name}"
)


# ============================================================
# 2. ЗАГРУЖАЕМ БИЗНЕС-ПРАВИЛА
# ============================================================

RULES_FILE = "business_rules.json"

if not os.path.exists(RULES_FILE):
    print(
        f"❌ Не найден {RULES_FILE}.\n"
        f"Он должен лежать рядом с analyzer.py."
    )
    raise SystemExit(1)


# ============================================================
# 3. ЕДИНЫЙ СЛОЙ НОРМАЛИЗАЦИИ
# ============================================================

try:
    df, validation = load_and_normalize_file(
        latest_file,
        RULES_FILE,
    )

except Exception as exc:
    print(
        f"❌ Ошибка нормализации файла "
        f"{latest_file}: {exc}"
    )
    raise

print(
    f"📅 Даты: "
    f"{validation.get('min_date') or 'нет'}"
    f" — "
    f"{validation.get('max_date') or 'нет'}"
)

print(
    f"📅 Валидных строк с датой: "
    f"{validation.get('valid_date_rows', 0)}"
)

# ============================================================
# 4. ПРОВЕРЯЕМ ОБЯЗАТЕЛЬНЫЕ ПОЛЯ
# ============================================================

required_fields = {
    "campaign",
    "spend",
    "results",
    "impressions",
}

missing = [
    field
    for field in required_fields
    if field in validation.get(
        "missing_expected",
        [],
    )
]

if missing:
    print(
        "⚠️ Не найдены обязательные поля: "
        + ", ".join(missing)
    )


# ============================================================
# 5. ФРОНТЕНД-НАБОР ДАННЫХ
# ============================================================

frontend_columns = [
    # Основная идентификация
    "date",
    "campaign",
    "campaign_id",

    # Разбор кампании
    "offer_type",
    "buyer",
    "month",
    "geo",
    "product_core",
    "product_full",
    "version",
    "creative",
    "creative_number",
    "approach",
    "bid_marker",
    "schedule",

    # Демография
    "age",
    "gender",

    # Meta delivery / budget
    "delivery",
    "bid_strategy",
    "adset_budget",
    "adset_budget_type",
    "campaign_spending_limit",

    # Финансы
    "spend",
    "results",
    "meta_results",
    "payable_results",
    "leads",
    "payout",
    "payout_configured",
    "revenue",
    "unpriced_results",

    # Meta performance
    "impressions",
    "reach",
    "frequency",
    "link_clicks",
    "clicks_all",
    "landing_page_views",
    "video_3s",
    "thruplays",
    "shop_clicks",

    # Опциональные поля будущего API / экспортов
    "result_indicator",
    "results_initial",
    "results_initial_indicator",
]


frontend_columns = [
    column
    for column in frontend_columns
    if column in df.columns
]


# ============================================================
# 6. DATAFRAME -> JSON
# ============================================================

raw_records = dataframe_to_records(
    df[frontend_columns]
)

raw_json = json.dumps(
    raw_records,
    ensure_ascii=False,
    allow_nan=False,
    default=str,
)

validation_json = json.dumps(
    validation,
    ensure_ascii=False,
    allow_nan=False,
    default=str,
)


# ============================================================
# 7. ЧИТАЕМ CSS / ANALYTICS ENGINE / APP ENGINE
# ============================================================

required_files = [
    "styles.css",
    "analytics_engine.js",
    "app.js",
]

for required_file in required_files:
    if not os.path.exists(required_file):
        print(
            f"❌ Не найден файл: {required_file}\n"
            f"Он должен лежать рядом с analyzer.py."
        )
        raise SystemExit(1)


with open(
    "styles.css",
    "r",
    encoding="utf-8",
) as f:
    css_content = f.read()


with open(
    "analytics_engine.js",
    "r",
    encoding="utf-8",
) as f:
    analytics_js = f.read()


with open(
    "app.js",
    "r",
    encoding="utf-8",
) as f:
    js_content = f.read()


# ============================================================
# 8. НАЛИЧИЕ DEMOGRAPHIC / VIDEO DATA
# ============================================================

has_demo = bool(
    validation.get("has_demo")
)

has_video = bool(
    validation.get("has_video")
)

demo_display = (
    "block"
    if has_demo
    else "none"
)

video_display = (
    "block"
    if has_video
    else "none"
)


# ============================================================
# 9. ГЕНЕРИРУЕМ REPORT.HTML
# ============================================================

html = f"""<!DOCTYPE html>
<html lang="ru" data-theme="bloomberg">

<head>

<meta charset="UTF-8">

<title>
Performance Dashboard: {account_name}
</title>

<style>
{css_content}
</style>

</head>

<body>


<!-- ========================================================
     HEADER
========================================================= -->

<div class="sticky-header">

    <!-- LEFT -->
    <div class="header-left">

        <h2 class="header-title">
            ⚡ Сводка
        </h2>

        <div class="account-pill">
            {account_name}
        </div>

    </div>


    <!-- CENTER -->
    <div class="header-center">

        <div class="fee-switch-container">

            <button
                id="btn-fee-on"
                class="fee-btn active"
                onclick="setFeeMode(true)"
            >
                Agency (+8%)
            </button>

            <button
                id="btn-fee-off"
                class="fee-btn"
                onclick="setFeeMode(false)"
            >
                FB Direct (0%)
            </button>

        </div>


        <button
            id="btn-reorder-toggle"
            class="btn"
            onclick="toggleReorderMode()"
        >
            ⇄ Настроить порядок
        </button>

    </div>


    <!-- RIGHT -->
    <div
        class="actual-dates-badge"
        id="actualDatesBadge"
    >
        📅 Загрузка...
    </div>


    <div
        id="dataQualityBadge"
        class="actual-dates-badge"
        style="
            display:none;
            cursor:default;
        "
    ></div>

</div>

<div class="main-container">


<!-- ========================================================
     KPI
========================================================= -->

<div class="grid">


    <div class="card">

        <div class="card-label">
            FB Спенд (Биллинг)
        </div>

        <div
            class="card-val"
            id="kpiSpend"
        >
            $0.00
        </div>

    </div>


    <div class="card">

        <div
            class="card-label"
            id="kpiRealSpendLabel"
        >
            Расход (+8%)
        </div>

        <div
            class="card-val yellow"
            id="kpiRealSpend"
        >
            $0.00
        </div>

    </div>


    <div class="card">

        <div class="card-label">
            Лиды (Суммарно)
        </div>

        <div
            class="card-val"
            id="kpiLeads"
        >
            0
        </div>

    </div>


    <div class="card">

        <div class="card-label">
            FB CPA (Кабинет)
        </div>

        <div
            class="card-val"
            id="kpiCpa"
        >
            $0.000
        </div>

    </div>


    <div class="card">

        <div class="card-label">
            Профит (Касса)
        </div>

        <div
            class="card-val"
            id="kpiProfit"
        >
            $0.00
        </div>

    </div>


    <div class="card">

        <div class="card-label">
            ROI (Фактический)
        </div>

        <div
            class="card-val"
            id="kpiRoi"
        >
            0.0%
        </div>

    </div>


    <div class="card">

        <div class="card-label">
            Реджектов FB
        </div>

        <div
            class="card-val yellow"
            id="kpiRejects"
        >
            0 шт.
        </div>

    </div>


</div>


<!-- ========================================================
     WIDGET CONTAINER
========================================================= -->

<div id="widgetsContainer">


<!-- ========================================================
     1. DEMOGRAPHICS
========================================================= -->

<div
    class="dashboard-widget"
    id="sec-demo-row"
    style="display: {demo_display};"
>

    <div class="widget-header">

        <h3>
            👥 Демография Таргета:
            Пол и Возраст
        </h3>

        <div class="widget-controls">

            <button
                class="btn-icon"
                onclick="moveWidget(
                    'sec-demo-row',
                    -1
                )"
                title="Поднять выше"
            >
                ▲
            </button>

            <button
                class="btn-icon"
                onclick="moveWidget(
                    'sec-demo-row',
                    1
                )"
                title="Опустить ниже"
            >
                ▼
            </button>

            <button
                class="btn-icon"
                onclick="toggleWidgetBody(
                    'sec-demo-row'
                )"
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

                <table id="tblGender">

                    <thead>

                        <tr>

                            <th>
                                Пол
                            </th>

                            <th>
                                Спенд
                            </th>

                            <th>
                                Лиды
                            </th>

                            <th>
                                CPA
                            </th>

                            <th>
                                CR%
                            </th>

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

                <table id="tblAge">

                    <thead>

                        <tr>

                            <th
                                onclick="toggleAgeSort()"
                                style="cursor:pointer;"
                                title="
                                    Кликните для
                                    переключения сортировки
                                "
                            >
                                Возраст ⇕
                            </th>

                            <th>
                                Спенд
                            </th>

                            <th>
                                Лиды
                            </th>

                            <th>
                                CPA
                            </th>

                            <th>
                                CR%
                            </th>

                        </tr>

                    </thead>

                    <tbody></tbody>

                </table>

            </div>

        </div>

    </div>

</div>


<!-- ========================================================
     2. APPROACHES
========================================================= -->

<div
    class="dashboard-widget"
    id="sec-approaches"
>

    <div class="widget-header">

        <h3>

            💡 Эффективность
            10 Подходов к Связкам

            <div class="tooltip-wrap">

                <span class="tooltip-icon">
                    i
                </span>

                <div class="tooltip-content">

                    Анализ подходов:

                    Refurbished,

                    Damaged Boxes,

                    Demo Units,

                    Review,

                    Birthday

                    и др.

                </div>

            </div>

        </h3>


        <div class="widget-controls">

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-approaches',
                        -1
                    )
                "
                title="Поднять выше"
            >
                ▲
            </button>

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-approaches',
                        1
                    )
                "
                title="Опустить ниже"
            >
                ▼
            </button>

            <button
                class="btn-icon"
                onclick="
                    toggleWidgetBody(
                        'sec-approaches'
                    )
                "
                title="
                    Свернуть / Развернуть
                "
            >
                —
            </button>

        </div>

    </div>


    <div class="table-wrapper">

        <table id="tblApproaches">

            <thead>

                <tr>

                    <th>
                        Подход/Креатив

                    </th>

                    <th>
                        FB Спенд
                    </th>

                    <th class="th-spend-title">
                        Расход (+8%)
                    </th>

                    <th>
                        Лиды
                    </th>

                    <th>
                        FB CPA
                    </th>

                    <th>
                        Профит
                    </th>

                    <th>
                        ROI
                    </th>

                </tr>

            </thead>

            <tbody></tbody>

        </table>

    </div>

</div>

<!-- ========================================================
     3. BID + MONTH
========================================================= -->

<div
    class="dashboard-widget"
    id="sec-bid-month-row"
>

    <div class="widget-header">

        <h3>
            🎯 Стратегии Ставок
            и Месяцы Таргета
        </h3>


        <div class="widget-controls">

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-bid-month-row',
                        -1
                    )
                "
                title="Поднять выше"
            >
                ▲
            </button>

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-bid-month-row',
                        1
                    )
                "
                title="Опустить ниже"
            >
                ▼
            </button>

            <button
                class="btn-icon"
                onclick="
                    toggleWidgetBody(
                        'sec-bid-month-row'
                    )
                "
                title="
                    Свернуть / Развернуть
                "
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

                <table id="tblBid">

                    <thead>

                        <tr>

                            <th>
                                Strategy
                            </th>

                            <th>
                                FB Спенд
                            </th>

                            <th class="th-spend-title">
                                Расход (+8%)
                            </th>

                            <th>
                                Leads
                            </th>

                            <th>
                                CPA
                            </th>

                            <th>
                                Profit
                            </th>

                            <th>
                                ROI
                            </th>

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

                <table id="tblMonth">

                    <thead>

                        <tr>

                            <th>
                                Месяц
                            </th>

                            <th>
                                FB Спенд
                            </th>

                            <th class="th-spend-title">
                                Расход (+8%)
                            </th>

                            <th>
                                Лиды
                            </th>

                            <th>
                                CPA
                            </th>

                            <th>
                                Профит
                            </th>

                            <th>
                                ROI
                            </th>

                        </tr>

                    </thead>

                    <tbody></tbody>

                </table>

            </div>

        </div>

    </div>

</div>


<!-- ========================================================
     4. OFFER 418
========================================================= -->

<div
    class="dashboard-widget"
    id="sec-offer-418"
>

    <div class="widget-header">

        <h3>

            <span
                class="section-tag"
                style="
                    color:var(--green);
                    border-color:var(--green);
                "
            >
                ОФФЕР 418
            </span>

            Финансовый Срез

        </h3>


        <div class="widget-controls">

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-offer-418',
                        -1
                    )
                "
            >
                ▲
            </button>

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-offer-418',
                        1
                    )
                "
            >
                ▼
            </button>

            <button
                class="btn-icon"
                onclick="
                    toggleWidgetBody(
                        'sec-offer-418'
                    )
                "
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

                <table id="tblGeo418">

                    <thead>

                        <tr>

                            <th>
                                GEO
                            </th>

                            <th>
                                FB Спенд
                            </th>

                            <th class="th-spend-title">
                                Расход (+8%)
                            </th>

                            <th>
                                Лиды
                            </th>

                            <th>
                                CPA
                            </th>

                            <th>
                                Профит
                            </th>

                            <th>
                                ROI
                            </th>

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

                <table id="tblProduct418">

                    <thead>

                        <tr>

                            <th>
                                Продукт
                            </th>

                            <th>
                                FB Спенд
                            </th>

                            <th class="th-spend-title">
                                Расход (+8%)
                            </th>

                            <th>
                                Лиды
                            </th>

                            <th>
                                CPA
                            </th>

                            <th>
                                Профит
                            </th>

                            <th>
                                ROI
                            </th>

                        </tr>

                    </thead>

                    <tbody></tbody>

                </table>

            </div>

        </div>

    </div>

</div>


<!-- ========================================================
     5. OFFER 418 MATRIX
========================================================= -->

<div
    class="dashboard-widget"
    id="sec-matrix-418"
>

    <div class="widget-header">

        <h3>

            <span
                class="section-tag"
                style="
                    color:var(--green);
                    border-color:var(--green);
                "
            >
                ОФФЕР 418
            </span>

            Матрица Связок
            (Товары × GEO)

        </h3>


        <div class="widget-controls">

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-matrix-418',
                        -1
                    )
                "
                title="Поднять выше"
            >
                ▲
            </button>

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-matrix-418',
                        1
                    )
                "
                title="Опустить ниже"
            >
                ▼
            </button>

            <button
                class="btn-icon"
                onclick="
                    toggleWidgetBody(
                        'sec-matrix-418'
                    )
                "
                title="
                    Свернуть / Развернуть
                "
            >
                —
            </button>

        </div>

    </div>


    <div class="table-wrapper">

        <table id="tblMatrix418">

            <thead></thead>

            <tbody></tbody>

        </table>

    </div>

</div>


<!-- ========================================================
     6. OFFER 339
========================================================= -->

<div
    class="dashboard-widget"
    id="sec-offer-339"
>

    <div class="widget-header">

        <h3>

            <span
                class="section-tag"
                style="
                    color:var(--green);
                    border-color:var(--green);
                "
            >
                ОФФЕР 339
            </span>

            Финансовый Срез

        </h3>


        <div class="widget-controls">

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-offer-339',
                        -1
                    )
                "
            >
                ▲
            </button>

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-offer-339',
                        1
                    )
                "
            >
                ▼
            </button>

            <button
                class="btn-icon"
                onclick="
                    toggleWidgetBody(
                        'sec-offer-339'
                    )
                "
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

                <table id="tblGeo339">

                    <thead>

                        <tr>

                            <th>
                                GEO
                            </th>

                            <th>
                                FB Спенд
                            </th>

                            <th class="th-spend-title">
                                Расход (+8%)
                            </th>

                            <th>
                                Лиды
                            </th>

                            <th>
                                CPA
                            </th>

                            <th>
                                Профит
                            </th>

                            <th>
                                ROI
                            </th>

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

                <table id="tblProduct339">

                    <thead>

                        <tr>

                            <th>
                                Продукт
                            </th>

                            <th>
                                FB Спенд
                            </th>

                            <th class="th-spend-title">
                                Расход (+8%)
                            </th>

                            <th>
                                Лиды
                            </th>

                            <th>
                                CPA
                            </th>

                            <th>
                                Профит
                            </th>

                            <th>
                                ROI
                            </th>

                        </tr>

                    </thead>

                    <tbody></tbody>

                </table>

            </div>

        </div>

    </div>

</div>


<!-- ========================================================
     7. OFFER 339 MATRIX
========================================================= -->

<div
    class="dashboard-widget"
    id="sec-matrix-339"
>

    <div class="widget-header">

        <h3>

            <span
                class="section-tag"
                style="
                    color:var(--green);
                    border-color:var(--green);
                "
            >
                ОФФЕР 339
            </span>

            Матрица Связок
            (Товары × GEO)

        </h3>


        <div class="widget-controls">

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-matrix-339',
                        -1
                    )
                "
            >
                ▲
            </button>

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-matrix-339',
                        1
                    )
                "
            >
                ▼
            </button>

            <button
                class="btn-icon"
                onclick="
                    toggleWidgetBody(
                        'sec-matrix-339'
                    )
                "
            >
                —
            </button>

        </div>

    </div>


    <div class="table-wrapper">

        <table id="tblMatrix339">

            <thead></thead>

            <tbody></tbody>

        </table>

    </div>

</div>


<!-- ========================================================
     8. TREE
========================================================= -->

<div
    class="dashboard-widget"
    id="sec-tree"
>

    <div class="widget-header">

        <h3>

            📁 Срез Связок:
            Оффер → Продукт → GEO → Месяц

            <div class="tooltip-wrap">

                <span class="tooltip-icon">
                    i
                </span>

                <div class="tooltip-content">

                    Иерархия 4 уровней:

                    Офферы (418, 339 и др.)

                    разделены на самом верху.

                    Клик раскрывает товары,

                    страны и месяцы.

                </div>

            </div>

        </h3>


        <div class="widget-controls">

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-tree',
                        -1
                    )
                "
            >
                ▲
            </button>

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-tree',
                        1
                    )
                "
            >
                ▼
            </button>

            <button
                class="btn-icon"
                onclick="
                    toggleWidgetBody(
                        'sec-tree'
                    )
                "
            >
                —
            </button>

        </div>

    </div>


    <div class="table-wrapper">

        <table id="tblTree">

            <thead>

                <tr>

                    <th>
                        Структура
                        (Оффер / Товар / ГЕО / Месяц)
                    </th>

                    <th>
                        Лиды
                    </th>

                    <th>
                        FB CPA
                    </th>

                    <th>
                        FB Спенд
                    </th>

                    <th class="th-spend-title">
                        Расход (+8%)
                    </th>

                    <th>
                        Профит
                    </th>

                    <th>
                        ROI
                    </th>

                </tr>

            </thead>

            <tbody></tbody>

        </table>

    </div>

</div>


<!-- ========================================================
     9. STABILITY
========================================================= -->

<div
    class="dashboard-widget"
    id="sec-stability"
>

    <div class="widget-header">

        <h3>

            🚦 Анализ Стабильности
            и Достоверности Сигналов

            <div class="tooltip-wrap">

                <span class="tooltip-icon">
                    i
                </span>

                <div class="tooltip-content">

                    <b>Валидность по лидам:</b><br>

                    • 🟢 Стабильный:
                    от 50 лидов.<br>

                    • 🟡 Есть сигнал:
                    15–49 лидов.<br>

                    • ⚪ Мало данных:
                    до 15 лидов.

                </div>

            </div>

        </h3>


        <div class="widget-controls">

            <div
                class="btn-group"
                id="stabOfferFilters"
            ></div>

            <div class="btn-group">

                <button
                    class="btn active"
                    id="btn-stab-all"
                    onclick="
                        filterStabilityStatus(
                            'all',
                            this
                        )
                    "
                >
                    Все статусы
                </button>

                <button
                    class="btn"
                    onclick="
                        filterStabilityStatus(
                            'stable',
                            this
                        )
                    "
                >
                    🟢 Стабильные
                </button>

                <button
                    class="btn"
                    onclick="
                        filterStabilityStatus(
                            'warning',
                            this
                        )
                    "
                >
                    🟡 Сигнал
                </button>

                <button
                    class="btn"
                    onclick="
                        filterStabilityStatus(
                            'noise',
                            this
                        )
                    "
                >
                    ⚪ Шум
                </button>

            </div>

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-stability',
                        -1
                    )
                "
            >
                ▲
            </button>

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-stability',
                        1
                    )
                "
            >
                ▼
            </button>

            <button
                class="btn-icon"
                onclick="
                    toggleWidgetBody(
                        'sec-stability'
                    )
                "
            >
                —
            </button>

        </div>

    </div>


    <div class="table-wrapper">

        <table id="tblStability">

            <thead>

                <tr>

                    <th>
                        Оффер и Связка
                    </th>

                    <th>
                        Статус сигнала
                    </th>

                    <th>
                        Действие
                    </th>

                    <th>
                        Лиды
                    </th>

                    <th>
                        FB CPA
                    </th>

                    <th>
                        FB Спенд
                    </th>

                    <th class="th-spend-title">
                        Расход (+8%)
                    </th>

                    <th>
                        Профит
                    </th>

                    <th>
                        ROI
                    </th>

                </tr>

            </thead>

            <tbody></tbody>

        </table>

    </div>

</div>


<!-- ========================================================
     10. FUNNEL
========================================================= -->

<div
    class="dashboard-widget"
    id="sec-funnel"
>

    <div class="widget-header">

        <h3>

            📊 Маркетинговая Воронка
            и Диагностика

            <div class="tooltip-wrap">

                <span class="tooltip-icon">
                    i
                </span>

                <div class="tooltip-content">

                    CPM (аукцион),

                    Link CTR (креатив),

                    Link CPC (клик),

                    CR (лендинг).

                </div>

            </div>

        </h3>


        <div class="widget-controls">

            <div
                class="btn-group"
                id="funnelOfferFilters"
            ></div>

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-funnel',
                        -1
                    )
                "
            >
                ▲
            </button>

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-funnel',
                        1
                    )
                "
            >
                ▼
            </button>

            <button
                class="btn-icon"
                onclick="
                    toggleWidgetBody(
                        'sec-funnel'
                    )
                "
            >
                —
            </button>

        </div>

    </div>


    <div class="table-wrapper">

        <table id="tblFunnel">

            <thead>

                <tr>

                    <th>
                        Оффер / Связка [GEO]
                    </th>

                    <th>
                        Показы
                    </th>

                    <th>
                        Клики (Link)
                    </th>

                    <th>
                        Лиды
                    </th>

                    <th>
                        CPM
                    </th>

                    <th>
                        Link CTR
                    </th>

                    <th>
                        Link CPC
                    </th>

                    <th>
                        CR ленда
                    </th>

                    <th>
                        FB CPA
                    </th>

                    <th>
                        Диагностика воронки
                    </th>

                </tr>

            </thead>

            <tbody></tbody>

        </table>

    </div>

</div>


<!-- ========================================================
     11. VIDEO
========================================================= -->

<div
    class="dashboard-widget"
    id="sec-video"
    style="
        display:{video_display};
    "
>

    <div class="widget-header">

        <h3>

            🎬 Видео Воронка:
            Hook Rate & Hold Rate

            <div class="tooltip-wrap">

                <span class="tooltip-icon">
                    i
                </span>

                <div class="tooltip-content">

                    <b>Hook Rate:</b>
                    % зрителей первых 3 сек.<br>

                    <b>Hold Rate:</b>
                    % зрителей ThruPlay
                    от зацепившихся.

                </div>

            </div>

        </h3>


        <div class="widget-controls">

            <div
                class="btn-group"
                id="videoOfferFilters"
            ></div>


            <div class="btn-group">

                <button
                    class="btn active"
                    id="btn-vid-all"
                    onclick="
                        filterVideoQuality(
                            'all',
                            this
                        )
                    "
                >
                    Все крео
                </button>

                <button
                    class="btn"
                    onclick="
                        filterVideoQuality(
                            'top_hook',
                            this
                        )
                    "
                >
                    🔥 Топ Hook (≥28%)
                </button>

                <button
                    class="btn"
                    onclick="
                        filterVideoQuality(
                            'bad_hook',
                            this
                        )
                    "
                >
                    ❌ Слабый Hook (&lt;18%)
                </button>

                <button
                    class="btn"
                    onclick="
                        filterVideoQuality(
                            'top_hold',
                            this
                        )
                    "
                >
                    🎯 Топ Hold (≥30%)
                </button>

                <button
                    class="btn"
                    onclick="
                        filterVideoQuality(
                            'leads',
                            this
                        )
                    "
                >
                    🏆 По Лидам
                </button>

            </div>


            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-video',
                        -1
                    )
                "
            >
                ▲
            </button>

            <button
                class="btn-icon"
                onclick="
                    moveWidget(
                        'sec-video',
                        1
                    )
                "
            >
                ▼
            </button>

            <button
                class="btn-icon"
                onclick="
                    toggleWidgetBody(
                        'sec-video'
                    )
                "
            >
                —
            </button>

        </div>

    </div>


    <div class="table-wrapper">

        <table id="tblVideo">

            <thead>

                <tr>

                    <th>
                        Оффер / Связка [GEO]
                    </th>

                    <th>
                        Показы
                    </th>

                    <th>
                        3-сек просмотры
                    </th>

                    <th>
                        ThruPlays
                    </th>

                    <th>
                        Hook Rate %
                    </th>

                    <th>
                        Hold Rate %
                    </th>

                    <th>
                        Link CTR
                    </th>

                    <th>
                        Лиды
                    </th>

                    <th>
                        Диагностика видео
                    </th>

                </tr>

            </thead>

            <tbody></tbody>

        </table>

    </div>

</div>


</div>


<!-- ========================================================
     FOOTER
========================================================= -->

<div class="footer-bar">

    <div>
        Performance Matrix Dashboard |
        Zero Dependencies Engine
    </div>


    <div
        style="
            display:flex;
            align-items:center;
            gap:8px;
        "
    >

        <span>
            Тема оформления:
        </span>


        <div class="theme-switcher">

            <button
                class="theme-btn active"
                id="btn-bloomberg"
                onclick="setTheme('bloomberg')"
            >
                Bloomberg
            </button>

            <button
                class="theme-btn"
                id="btn-matrix"
                onclick="setTheme('matrix')"
            >
                Matrix
            </button>

            <button
                class="theme-btn"
                id="btn-notion"
                onclick="setTheme('notion')"
            >
                Notion
            </button>

        </div>

    </div>

</div>


</div>


<!-- ========================================================
     DATA
========================================================= -->

<script>

const DATA = {raw_json};

const DATA_VALIDATION = {validation_json};

const HAS_DEMO = {'true' if has_demo else 'false'};

const HAS_VIDEO = {'true' if has_video else 'false'};

const BUSINESS_RULES = {json.dumps(validation.get("business_rules", {}), ensure_ascii=False)};

</script>


<!-- ========================================================
     ANALYTICS ENGINE
========================================================= -->

<script>
{analytics_js}
</script>


<!-- ========================================================
     UI ENGINE
========================================================= -->

<script>
{js_content}
</script>


</body>
</html>
"""


# ============================================================
# 10. СОХРАНЯЕМ REPORT.HTML
# ============================================================

with open(
    OUTPUT_HTML,
    "w",
    encoding="utf-8",
) as f:

    f.write(html)


# ============================================================
# 11. ОТКРЫВАЕМ ОТЧЁТ
# ============================================================

output_path = os.path.abspath(
    OUTPUT_HTML
)

print("")
print(
    "=================================================="
)
print(
    "✅ REPORT ГОТОВ"
)
print(
    "=================================================="
)
print(
    f"📄 {output_path}"
)
print(
    f"📂 Источник: {file_base}"
)
print(
    f"📊 Строк после нормализации: {len(df):,}"
)
print(
    f"💰 FB Spend: ${df['spend'].sum():,.2f}"
)

if "payable_results" in df.columns:
    print(
        "🎯 Payable Results: "
        f"{df['payable_results'].sum():,.0f}"
    )

if "revenue" in df.columns:
    revenue_sum = df["revenue"].sum()
    print(
        f"💵 Revenue: ${revenue_sum:,.2f}"
    )

if validation.get("duplicates_removed"):
    print(
        "🧹 Дубликатов удалено: "
        f"{validation['duplicates_removed']}"
    )

if validation.get("aggregate_demo_rows_removed"):
    print(
        "👥 Meta total-строк удалено: "
        f"{validation['aggregate_demo_rows_removed']}"
    )

if validation.get("unknown_offers"):
    print(
        "⚠️ UNKNOWN offers: "
        + ", ".join(
            validation["unknown_offers"]
        )
    )

if validation.get("unknown_geo"):
    print(
        "⚠️ UNKNOWN GEO: "
        + ", ".join(
            validation["unknown_geo"]
        )
    )

if validation.get("unpriced_results", 0):
    print(
        "⚠️ Results без настроенного payout: "
        f"{validation['unpriced_results']:,.0f}"
    )

print(
    "=================================================="
)

webbrowser.open(
    f"file://{output_path}"
)