from __future__ import annotations

import json
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Optional
from datetime import datetime

import pandas as pd


# ============================================================
# BASE
# ============================================================

BASE_COLUMNS = [
    "date",
    "campaign",
    "campaign_id",
    "spend",
    "results",
    "impressions",
    "reach",
    "frequency",
    "link_clicks",
    "clicks_all",
    "landing_page_views",
    "video_3s",
    "thruplays",
    "shop_clicks",
    "age",
    "gender",
    "delivery",
    "bid_strategy",
    "adset_budget",
    "adset_budget_type",
    "campaign_spending_limit",
    "result_indicator",
    "results_initial",
    "results_initial_indicator",
]


NUMBER_COLUMNS = {
    "spend",
    "results",
    "impressions",
    "reach",
    "frequency",
    "link_clicks",
    "clicks_all",
    "landing_page_views",
    "video_3s",
    "thruplays",
    "shop_clicks",
    "adset_budget",
    "campaign_spending_limit",
    "results_initial",
}


SUPPORTED_GEOS = [
"AR",
    "BD",
    "BG",
    "BR",
    "CL",
    "CI",
    "CO",
    "GH",
    "ID",
    "KE",
    "MZ",
    "MX",
    "NG",
    "PE",
    "PH",
    "PK",
    "RO",
    "HU",
    "TH",
    "US",
    "UY",
    "VN",
    "ZA",
    "ZM",
    "ZW",
    "MY",
    "MM",
    "MW",
    "NA",
    "PE",
    "DO",
    "PA",
    "EC",
    "DE",
    "TZ"
]


# ============================================================
# COLUMN ALIASES
# ============================================================

ALIASES = {
    "date": [
        "reporting starts",
        "reporting start",
        "date",
        "day",
    ],

    "campaign": [
        "campaign name",
        "campaign",
    ],

    "campaign_id": [
        "campaign id",
        "campaign_id",
    ],

    "spend": [
        "amount spent usd",
        "amount spent",
        "spend",
    ],

    "results": [
        "results",
        "result",
        "website leads",
        "leads",
    ],

    "results_initial": [
        "results initial",
        "initial results",
    ],

    "impressions": [
        "impressions",
    ],

    "reach": [
        "reach",
    ],

    "frequency": [
        "frequency",
    ],

    "link_clicks": [
        "link clicks",
        "clicks link",
    ],

    "clicks_all": [
        "clicks all",
        "all clicks",
    ],

    "landing_page_views": [
        "landing page views",
    ],

    "video_3s": [
        "3-second video plays",
        "3 second video plays",
        "3-second video play",
    ],

    "thruplays": [
        "thruplays",
        "thru play",
    ],

    "shop_clicks": [
        "shop clicks",
        "shop_clicks",
    ],

    "age": [
        "age",
    ],

    "gender": [
        "gender",
    ],

    "delivery": [
        "campaign delivery",
        "delivery",
    ],

    "bid_strategy": [
        "bid strategy",
    ],

    "adset_budget": [
        "ad set budget",
        "adset budget",
    ],

    "adset_budget_type": [
        "ad set budget type",
        "adset budget type",
    ],

    "campaign_spending_limit": [
        "campaign spending limit",
    ],

    "result_indicator": [
        "result indicator",
        "results indicator",
    ],

    "results_initial_indicator": [
        "results initial indicator",
        "initial result indicator",
    ],
}


def normalize_label(value: Any) -> str:
    text = str(value or "").strip().lower()

    text = (
        text
        .replace("—", "-")
        .replace("–", "-")
    )

    text = text.replace(
        "_",
        " ",
    )

    text = re.sub(
        r"[\[\]\(\)%$]",
        " ",
        text,
    )

    text = re.sub(
        r"[^\w\s.\-]+",
        " ",
        text,
        flags=re.UNICODE,
    )

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    return text.strip()


ALIAS_INDEX = {
    key: {
        normalize_label(value)
        for value in values
    }
    for key, values in ALIASES.items()
}


# ============================================================
# NUMBER
# ============================================================

def parse_number(value: Any) -> float:

    if value is None:
        return 0.0

    if (
        isinstance(value, float)
        and pd.isna(value)
    ):
        return 0.0

    text = str(value).strip()

    if not text:
        return 0.0

    if text.lower() in {
        "nan",
        "none",
        "null",
        "-",
        "—",
    }:
        return 0.0

    text = (
        text
        .replace("\u00a0", "")
        .replace(" ", "")
    )

    text = re.sub(
        r"[^0-9,\.\-]",
        "",
        text,
    )

    if not text:
        return 0.0

    if "," in text and "." in text:

        if text.rfind(",") > text.rfind("."):

            text = text.replace(
                ".",
                "",
            )

            text = text.replace(
                ",",
                ".",
            )

        else:

            text = text.replace(
                ",",
                "",
            )

    elif "," in text:

        tail = text.rsplit(
            ",",
            1,
        )[-1]

        if (
            len(tail) == 3
            and text.count(",") == 1
        ):

            text = text.replace(
                ",",
                "",
            )

        else:

            text = text.replace(
                ",",
                ".",
            )

    try:
        return float(text)

    except ValueError:
        return 0.0


# ============================================================
# DATE
# ============================================================

def parse_date(value: Any) -> str:

    if value is None:
        return ""

    # pandas NaN
    try:
        if pd.isna(value):
            return ""
    except Exception:
        pass

    # --------------------------------------------------------
    # Уже datetime / Timestamp
    # --------------------------------------------------------

    if isinstance(
        value,
        (
            pd.Timestamp,
            datetime,
        ),
    ):
        try:
            return value.strftime(
                "%Y-%m-%d"
            )
        except Exception:
            return ""

    # --------------------------------------------------------
    # Приводим к строке
    # --------------------------------------------------------

    raw = str(value).strip()

    if not raw:
        return ""

    # --------------------------------------------------------
    # Excel serial date
    #
    # Например:
    # 46283
    # --------------------------------------------------------

    if re.fullmatch(
        r"\d{4,6}(?:\.\d+)?",
        raw,
    ):

        try:

            number = float(raw)

            # Нормальный диапазон Excel dates
            if 1 <= number <= 100000:

                dt = pd.Timestamp(
                    "1899-12-30"
                ) + pd.to_timedelta(
                    number,
                    unit="D",
                )

                return dt.strftime(
                    "%Y-%m-%d"
                )

        except Exception:
            pass

    # --------------------------------------------------------
    # YYYY-MM-DD
    #
    # 2026-09-18
    # 2026-09-18 00:00:00
    # 2026-09-18T00:00:00
    # --------------------------------------------------------

    match = re.match(
        r"^(\d{4})-(\d{1,2})-(\d{1,2})",
        raw,
    )

    if match:

        try:

            return pd.Timestamp(
                year=int(match.group(1)),
                month=int(match.group(2)),
                day=int(match.group(3)),
            ).strftime(
                "%Y-%m-%d"
            )

        except Exception:
            return ""

    # --------------------------------------------------------
    # DD/MM/YYYY
    #
    # 18/09/2026
    # 18/09/2026 00:00:00
    # --------------------------------------------------------

    match = re.match(
        r"^(\d{1,2})/(\d{1,2})/(\d{4})",
        raw,
    )

    if match:

        try:

            return pd.Timestamp(
                year=int(match.group(3)),
                month=int(match.group(2)),
                day=int(match.group(1)),
            ).strftime(
                "%Y-%m-%d"
            )

        except Exception:
            return ""

    # --------------------------------------------------------
    # DD.MM.YYYY
    # --------------------------------------------------------

    match = re.match(
        r"^(\d{1,2})\.(\d{1,2})\.(\d{4})",
        raw,
    )

    if match:

        try:

            return pd.Timestamp(
                year=int(match.group(3)),
                month=int(match.group(2)),
                day=int(match.group(1)),
            ).strftime(
                "%Y-%m-%d"
            )

        except Exception:
            return ""

    # --------------------------------------------------------
    # YYYY/MM/DD
    # --------------------------------------------------------

    match = re.match(
        r"^(\d{4})/(\d{1,2})/(\d{1,2})",
        raw,
    )

    if match:

        try:

            return pd.Timestamp(
                year=int(match.group(1)),
                month=int(match.group(2)),
                day=int(match.group(3)),
            ).strftime(
                "%Y-%m-%d"
            )

        except Exception:
            return ""

    # --------------------------------------------------------
    # Последний fallback
    # --------------------------------------------------------

    try:

        dt = pd.to_datetime(
            raw,
            errors="coerce",
            dayfirst=True,
        )

        if pd.isna(dt):
            return ""

        return dt.strftime(
            "%Y-%m-%d"
        )

    except Exception:

        return ""

# ============================================================
# CAMPAIGN ID
# ============================================================

def normalize_campaign_id(
    value: Any,
) -> str:

    if value is None:
        return ""

    try:
        if pd.isna(value):
            return ""
    except Exception:
        pass

    text = str(value).strip()

    if not text:
        return ""

    # Excel / pandas могут отдавать ID в виде:
    # 1.2025E+17

    if re.fullmatch(
        r"[+-]?\d+(?:\.\d+)?[eE][+-]?\d+",
        text,
    ):

        try:

            return (
                format(
                    Decimal(text),
                    "f",
                )
                .split(".")[0]
            )

        except (
            InvalidOperation,
            ValueError,
        ):

            return text

    # Например:
    # 123456789.0

    if re.fullmatch(
        r"\d+\.0+",
        text,
    ):

        return text.split(
            ".",
            1,
        )[0]

    return text

# ============================================================
# READ SOURCE
# ============================================================

def read_source_file(
    path: str | Path,
) -> pd.DataFrame:

    path = Path(path)

    if (
        path.suffix.lower()
        == ".xlsx"
    ):

        return pd.read_excel(
            path,
            dtype=str,
        )

    if (
        path.suffix.lower()
        != ".csv"
    ):

        raise ValueError(
            f"Неподдерживаемый формат: {path.suffix}"
        )

    last_error = None

    for encoding in (
        "utf-8-sig",
        "utf-8",
        "utf-16",
        "cp1251",
    ):

        for separator in (
            ",",
            ";",
            "\t",
        ):

            try:

                df = pd.read_csv(
                    path,
                    encoding=encoding,
                    sep=separator,
                    dtype=str,
                )

                if len(df.columns) >= 3:
                    return df

            except Exception as exc:

                last_error = exc

    raise RuntimeError(
        f"Не удалось прочитать CSV: {path}. "
        f"{last_error}"
    )


# ============================================================
# RESOLVE COLUMNS
# ============================================================

def resolve_columns(
    df: pd.DataFrame,
) -> tuple[
    pd.DataFrame,
    dict[str, str],
]:

    out = df.copy()

    # --------------------------------------------------------
    # Чистим названия колонок
    # --------------------------------------------------------

    cleaned_columns = {}

    for column in out.columns:

        original = str(column)

        cleaned = (
            original
            .replace("\ufeff", "")
            .replace("\u200b", "")
            .replace("\u200c", "")
            .replace("\u200d", "")
            .strip()
        )

        cleaned_columns[original] = cleaned


    out = out.rename(
        columns=cleaned_columns
    )


    # --------------------------------------------------------
    # Нормализованные названия
    # --------------------------------------------------------

    normalized_sources = {
        column: normalize_label(column)
        for column in out.columns
    }


    resolved = {}

    used = set()


    # --------------------------------------------------------
    # 1. Точные совпадения aliases
    # --------------------------------------------------------

    for canonical, aliases in ALIAS_INDEX.items():

        for source, normalized in normalized_sources.items():

            if source in used:
                continue

            if normalized in aliases:

                resolved[canonical] = source

                used.add(source)

                break


    # --------------------------------------------------------
    # 2. Специально ищем Reporting starts
    # --------------------------------------------------------

    if "date" not in resolved:

        for source in out.columns:

            normalized = normalize_label(source)

            if normalized.startswith(
                "reporting starts"
            ):

                resolved["date"] = source

                used.add(source)

                break


    # --------------------------------------------------------
    # 3. Запасной поиск по значениям
    # --------------------------------------------------------

    if "date" not in resolved:

        for source in out.columns:

            if source in used:
                continue

            series = out[source]

            sample = (
                series
                .dropna()
                .astype(str)
                .head(20)
            )

            if len(sample) == 0:
                continue

            valid_dates = 0


            for value in sample:

                value = value.strip()


                if (
                    re.match(
                        r"^\d{4}-\d{2}-\d{2}",
                        value,
                    )
                    or
                    re.match(
                        r"^\d{1,2}/\d{1,2}/\d{4}",
                        value,
                    )
                    or
                    re.match(
                        r"^\d{1,2}\.\d{1,2}\.\d{4}",
                        value,
                    )
                ):

                    valid_dates += 1


            if valid_dates >= 3:

                resolved["date"] = source

                used.add(source)

                break


    # --------------------------------------------------------
    # Переименовываем найденные колонки
    # --------------------------------------------------------

    rename_map = {
        source: canonical
        for canonical, source
        in resolved.items()
    }


    out = out.rename(
        columns=rename_map
    )


    # --------------------------------------------------------
    # Удаляем дубликаты названий
    # --------------------------------------------------------

    out = out.loc[
        :,
        ~out.columns.duplicated(
            keep="first"
        ),
    ]


    return (
        out,
        resolved,
    )


# ============================================================
# ENSURE COLUMNS
# ============================================================

def ensure_columns(
    df: pd.DataFrame,
) -> pd.DataFrame:

    out = df.copy()

    for column in BASE_COLUMNS:

        if column in out.columns:
            continue

        if column in NUMBER_COLUMNS:

            out[column] = 0.0

        elif column in {
            "age",
            "gender",
        }:

            out[column] = "All"

        else:

            out[column] = ""

    return out


# ============================================================
# CAMPAIGN PARSING
# ============================================================

def extract_offer(
    campaign: str,
) -> str:

    text = str(
        campaign or ""
    )

    match = re.search(
        r"(?:^|[-_\s\[])(339|418)(?=[-_\s\]\(]|$)",
        text,
        flags=re.IGNORECASE,
    )

    if match:
        return match.group(1)

    return "UNKNOWN"


def extract_geo(
    campaign: str,
) -> str:

    text = str(
        campaign or ""
    )

    for geo in SUPPORTED_GEOS:

        pattern = (
            rf"(?:^|[-_\s\[]){geo}"
            rf"(?=[-_\s\]\(]|$)"
        )

        if re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        ):

            return geo

    return "Unknown"


def extract_month(
    campaign: str,
) -> str:

    text = str(
        campaign or ""
    ).lower()

    for month in (
        "jan",
        "feb",
        "mar",
        "apr",
        "may",
        "jun",
        "jul",
        "aug",
        "sep",
        "oct",
        "nov",
        "dec",
    ):

        if re.search(
            rf"(?:^|[-_\s\[]){month}(?=[-_\s\]\(]|$)",
            text,
        ):

            return month

    return "Без месяца"


def extract_buyer(
    campaign: str,
) -> str:

    text = str(
        campaign or ""
    )

    match = re.match(
        r"^\[?([^\s\-_\.]+)",
        text,
        flags=re.IGNORECASE,
    )

    if not match:
        return "Unknown"

    value = match.group(1)

    if value.lower() in {
        "vitaliy",
        "vitaly",
        "vetal",
        "vit",
        "vet",
    }:

        return "Vitaliy"

    return value.title()


def extract_bid_marker(
    campaign: str,
) -> str:

    text = str(
        campaign or ""
    ).lower()

    if re.search(r"\(\s*min\s*\)", text):
        return "Min Bid"

    if (
        "bid cap" in text
        or "bidcap" in text
        or re.search(
            r"\(\s*b\s*\)",
            text,
        )
    ):
        return "Bid Cap"

    if (
        "cost cap" in text
        or "costcap" in text
        or "cost control" in text
        or re.search(
            r"\(\s*c\s*\)",
            text,
        )
    ):
        return "Cost Cap"

    return "Cost Cap"


def extract_approach(
    campaign: str,
    month: str,
) -> str:

    text = str(
        campaign or ""
    ).lower()

    rules = [
        (
            "Refurbished",
            [
                "_ref",
                "refurb",
                "refab",
                "-ref",
            ],
        ),

        (
            "Damaged Boxes",
            [
                "dam_box",
                "dambox",
                "damaged",
                "_dam",
            ],
        ),

        (
            "Demo Units",
            [
                "_demo",
                "demo_units",
                "sample",
            ],
        ),

        (
            "Product Test",
            [
                "_test",
                "product_test",
            ],
        ),

        (
            "Review",
            [
                "_rev",
                "review",
            ],
        ),

        (
            "Company Birthday",
            [
                "comp_bday",
                "company_bday",
                "shop_bday",
            ],
        ),

        (
            "News",
            [
                "_news",
                "news_",
            ],
        ),

        (
            "Store Giveaway",
            [
                "giveaway",
                "store_giveaway",
                "_promo",
            ],
        ),

        (
            "Age Targeted",
            [
                "_age",
                "18plus",
                "50plus",
            ],
        ),

        (
            "Holiday/Event",
            [
                "holiday",
                "event",
                "xmas",
                "easter",
                "blackfriday",
            ],
        ),
    ]

    for name, needles in rules:

        if any(
            needle in text
            for needle in needles
        ):

            return name

    if month != "Без месяца":
        return "Birthday"

    return "Unknown"


def clean_product(
    campaign: str,
    offer: str,
    geo: str,
    month: str,
) -> tuple[
    str,
    str,
    str,
    str,
    str,
    int,
]:

    text = str(
        campaign or ""
    ).strip()

    # --------------------------------------------------------
    # Убираем buyer
    # --------------------------------------------------------

    text = re.sub(
        r"^\[?(vitaliy|vitaly|vetal|vit|vet)[\-_ \t\.]+",
        "",
        text,
        flags=re.IGNORECASE,
    )

    # --------------------------------------------------------
    # Убираем offer и всё после него
    # --------------------------------------------------------

    if offer != "UNKNOWN":

        text = re.sub(
            rf"[-_]{re.escape(offer)}.*$",
            "",
            text,
            flags=re.IGNORECASE,
        )

    # --------------------------------------------------------
    # Убираем payout + schedule + всё после
    # --------------------------------------------------------

    text = re.sub(
        r"-\d+(?:\.\d+)?\$\d{2}-\d{2}.*$",
        "",
        text,
        flags=re.IGNORECASE,
    )

    # --------------------------------------------------------
    # Убираем GEO
    # --------------------------------------------------------

    if geo != "Unknown":

        text = re.sub(
            rf"(?:^|[-_\s]){re.escape(geo)}(?=[-_\s]|$)",
            "-",
            text,
            flags=re.IGNORECASE,
        )

    # --------------------------------------------------------
    # Убираем месяц
    # --------------------------------------------------------

    if month != "Без месяца":

        text = re.sub(
            rf"(?:^|[-_\s]){re.escape(month)}(?=[-_\s]|$)",
            "-",
            text,
            flags=re.IGNORECASE,
        )

    # --------------------------------------------------------
    # Убираем schedule, если вдруг остался
    # --------------------------------------------------------

    text = re.sub(
        r"(?:^|[-_\s])\d{2}-\d{2}(?=[-_\s]|$)",
        "-",
        text,
    )

    text = re.sub(
        r"-{2,}",
        "-",
        text,
    )

    text = text.strip(
        "-_. "
    )

    if not text:
        text = "Other"

    # --------------------------------------------------------
    # APPROACH
    # --------------------------------------------------------

    approach = extract_approach(
        text,
        month,
    )

    # --------------------------------------------------------
    # Убираем ТОЛЬКО suffix подхода
    #
    # Примеры:
    # s26_ult_dam  -> s26_ult
    # fbank_v2_dam -> fbank_v2
    # fbank_3      -> fbank_3
    # --------------------------------------------------------

    approach_suffix_pattern = (
        r"(?i)"
        r"(?:[_-]"
        r"(?:"
        r"dam_box|"
        r"dambox|"
        r"dam|"
        r"damaged|"
        r"refurbished|"
        r"refurb|"
        r"refab|"
        r"ref|"
        r"demo_units|"
        r"demo|"
        r"sample|"
        r"product_test|"
        r"test|"
        r"review|"
        r"rev|"
        r"company_bday|"
        r"comp_bday|"
        r"shop_bday|"
        r"news|"
        r"promo|"
        r"store_giveaway|"
        r"giveaway|"
        r"age|"
        r"holiday|"
        r"event|"
        r"xmas|"
        r"easter|"
        r"blackfriday|"
        r"18plus|"
        r"50plus"
        r"))$"
    )

    product_name = re.sub(
        approach_suffix_pattern,
        "",
        text,
    ).strip(
        "-_. "
    )

    if not product_name:
        product_name = "Other"

    # --------------------------------------------------------
    # CREATIVE
    #
    # fbank       -> creative fbank,     number 1
    # fbank_v2    -> creative fbank_v2,  number 2
    # fbank_3     -> creative fbank_3,   number 3
    # --------------------------------------------------------

    creative_match = re.search(
        r"_(v\d+|\d+)$",
        product_name,
        flags=re.IGNORECASE,
    )

    if creative_match:

        raw_number = creative_match.group(1)

        creative_number = int(
            re.sub(
                r"^v",
                "",
                raw_number,
                flags=re.IGNORECASE,
            )
        )

        creative = product_name

        version = (
            f"v{creative_number}"
        )

        product_core = (
            product_name[
                :creative_match.start()
            ]
            .strip("-_. ")
        )

    else:

        creative = product_name

        creative_number = 1

        # У первого креатива версии в названии нет
        version = ""

        product_core = product_name

    if not product_core:
        product_core = "Other"

    return (
        product_core,
        text,
        version,
        approach,
        creative,
        creative_number,
    )

# ============================================================
# PAYOUT
# ============================================================

def get_payout(
    offer: str,
    geo: str,
    rules: dict,
) -> tuple[
    Optional[float],
    bool,
]:

    offer_rules = (
        rules.get(
            "offers"
        ) or {}
    ).get(
        str(offer)
    )

    if not offer_rules:

        return (
            None,
            False,
        )

    # 418
    if str(offer) == "418":

        overrides = (
            offer_rules.get(
                "geo_payout_overrides"
            ) or {}
        )

        if geo in overrides:

            return (
                float(
                    overrides[geo]
                ),
                True,
            )

        default = (
            offer_rules.get(
                "default_payout"
            )
        )

        if default is not None:

            return (
                float(default),
                True,
            )

        return (
            None,
            False,
        )

    # 339
    if str(offer) == "339":

        payouts = (
            offer_rules.get(
                "geo_payouts"
            ) or {}
        )

        if geo in payouts:

            return (
                float(
                    payouts[geo]
                ),
                True,
            )

        # Никакого fallback.
        return (
            None,
            False,
        )

    return (
        None,
        False,
    )


# ============================================================
# MAIN NORMALIZATION
# ============================================================

def normalize_meta_export(
    df: pd.DataFrame,
    rules: dict,
) -> tuple[
    pd.DataFrame,
    dict,
]:

    source = df.copy()

    source.columns = [
        str(c).strip()
        for c in source.columns
    ]

    out, resolved = (
        resolve_columns(
            source
        )
    )

    print(
        "🔎 Найденные колонки:",
        resolved
    )

    out = ensure_columns(
        out
    )

    # --------------------------------------------------------
    # DATE
    # --------------------------------------------------------

    out["date"] = (
        out["date"].apply(
            parse_date
        )
    )

    # --------------------------------------------------------
    # DATE
    # --------------------------------------------------------

    out["date"] = (
        out["date"].apply(
            parse_date
        )
    )

    # --------------------------------------------------------
    # CAMPAIGN
    # --------------------------------------------------------

    out["campaign"] = (
        out["campaign"]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    # --------------------------------------------------------
    # ID
    # --------------------------------------------------------

    out["campaign_id"] = (
        out["campaign_id"]
        .apply(
            normalize_campaign_id
        )
    )

    # --------------------------------------------------------
    # NUMBERS
    # --------------------------------------------------------

    for column in NUMBER_COLUMNS:

        out[column] = (
            out[column]
            .apply(
                parse_number
            )
        )

    # --------------------------------------------------------
    # AGE / GENDER
    # --------------------------------------------------------

    out["age"] = (
        out["age"]
        .fillna("All")
        .astype(str)
        .replace(
            {
                "nan": "All",
                "": "All",
            }
        )
    )

    out["gender"] = (
        out["gender"]
        .fillna("All")
        .astype(str)
        .replace(
            {
                "nan": "All",
                "": "All",
            }
        )
    )

    # --------------------------------------------------------
    # Убираем Aggregate All / All,
    # если одновременно есть Age/Gender breakdown.
    # --------------------------------------------------------

    demo_detail = (
        (
            out["age"]
            .str.lower()
            != "all"
        )
        |
        (
            out["gender"]
            .str.lower()
            != "all"
        )
    )

    detail_keys = set(
        zip(
            out.loc[
                demo_detail,
                "date",
            ],
            out.loc[
                demo_detail,
                "campaign_id",
            ],
            out.loc[
                demo_detail,
                "campaign",
            ],
        )
    )

    total_rows = (
        (
            out["age"]
            .str.lower()
            == "all"
        )
        &
        (
            out["gender"]
            .str.lower()
            == "all"
        )
    )

    drop_total = (
        total_rows
        &
        out.apply(
            lambda row:
                (
                    row["date"],
                    row["campaign_id"],
                    row["campaign"],
                )
                in detail_keys,
            axis=1,
        )
    )

    aggregate_demo_rows_removed = int(
        drop_total.sum()
    )

    out = out.loc[
        ~drop_total
    ].copy()

    # --------------------------------------------------------
    # BUSINESS FIELDS
    # --------------------------------------------------------

    derived_rows = []

    for _, row in out.iterrows():

        campaign = row[
            "campaign"
        ]

        offer = extract_offer(
            campaign
        )

        geo = extract_geo(
            campaign
        )

        month = extract_month(
            campaign
        )

        buyer = extract_buyer(
            campaign
        )

        (
            product_core,
            product_full,
            version,
            approach,
            creative,
            creative_number,
        ) = clean_product(
            campaign,
            offer,
            geo,
            month,
        )

        payout, configured = (
            get_payout(
                offer,
                geo,
                rules,
            )
        )

        derived_rows.append(
            {
                "offer_type": offer,
                "buyer": buyer,
                "month": month,
                "geo": geo,
                "product_core": product_core,
                "product_full": product_full,
                "version": version,
                "creative": creative,
                "creative_number": creative_number,
                "approach": approach,
                "bid_marker": extract_bid_marker(
                    campaign
                ),
                "payout": payout,
                "payout_configured": configured,
            }
        )

    derived_df = pd.DataFrame(
        derived_rows,
        index=out.index,
    )

    out = pd.concat(
        [
            out,
            derived_df,
        ],
        axis=1,
    )

    # --------------------------------------------------------
    # RESULTS
    # --------------------------------------------------------

    out["meta_results"] = (
        out["results"]
    )

    out["payable_results"] = (
        out["results"]
    )

    out["leads"] = (
        out["payable_results"]
    )

    # --------------------------------------------------------
    # PAYOUT / REVENUE
    # --------------------------------------------------------

    out["payout"] = pd.to_numeric(
        out["payout"],
        errors="coerce",
    )

    out["revenue"] = (
        out["payable_results"]
        *
        out["payout"]
    )

    out["unpriced_results"] = (
        out["payable_results"]
        .where(
            ~out["payout_configured"],
            0.0,
        )
    )

    # --------------------------------------------------------
    # DEDUPE
    # --------------------------------------------------------

    dedupe_columns = [
        "date",
        "campaign_id",
        "campaign",
        "age",
        "gender",
        "spend",
        "results",
        "impressions",
        "link_clicks",
        "landing_page_views",
        "video_3s",
        "thruplays",
        "shop_clicks",
        "offer_type",
        "geo",
    ]

    before = len(out)

    out = out.drop_duplicates(
        subset=dedupe_columns,
        keep="first",
    )

    duplicates_removed = (
        before -
        len(out)
    )

    out = out.reset_index(
        drop=True
    )

    # --------------------------------------------------------
    # VALIDATION
    # --------------------------------------------------------

    valid_dates = out.loc[
        out["date"] != "",
        "date",
    ]

    min_date = (
        valid_dates.min()
        if len(valid_dates)
        else None
    )

    max_date = (
        valid_dates.max()
        if len(valid_dates)
        else None
    )

    valid_date_rows = int(
        out["date"]
        .astype(str)
        .str.match(
            r"^\d{4}-\d{2}-\d{2}$"
        )
        .sum()
    )

    has_demo = bool(
        (
            (
                out["age"]
                .str.lower()
                != "all"
            )
            |
            (
                out["gender"]
                .str.lower()
                != "all"
            )
        ).any()
    )

    has_video = bool(
        (
            out["video_3s"].sum()
            > 0
        )
        or
        (
            out["thruplays"].sum()
            > 0
        )
    )

    delivery_available = bool(
        out["delivery"]
        .astype(str)
        .str.strip()
        .ne("")
        .any()
    )

    approach_counts = (
    out["approach"]
    .fillna("Unknown")
    .astype(str)
    .value_counts()
    .to_dict()
    )

    bid_marker_counts = (
        out["bid_marker"]
        .fillna("Cost Cap")
        .astype(str)
        .value_counts()
        .to_dict()
    )

    version_counts = (
        out["version"]
        .fillna("v1")
        .astype(str)
        .value_counts()
        .to_dict()
    )

    product_counts = (
        out["product_core"]
        .fillna("Other")
        .astype(str)
        .value_counts()
        .to_dict()
    )

    validation = {

        "source_rows":
            int(len(source)),

        "normalized_rows":
            int(len(out)),

        "duplicates_removed":
            int(
                duplicates_removed
            ),

        "aggregate_demo_rows_removed":
            int(
                aggregate_demo_rows_removed
            ),

        "total_spend":
            float(
                out["spend"].sum()
            ),

        "total_meta_results":
            float(
                out["meta_results"].sum()
            ),

        "total_payable_results":
            float(
                out["payable_results"].sum()
            ),

        "unpriced_result_count":
            float(
                out["unpriced_results"].sum()
            ),

        "unknown_offers":
            sorted(
                [
                    x
                    for x
                    in out["offer_type"]
                    .dropna()
                    .unique()
                    if x == "UNKNOWN"
                ]
            ),

        "unknown_geo":
            sorted(
                [
                    x
                    for x
                    in out["geo"]
                    .dropna()
                    .unique()
                    if x == "Unknown"
                ]
            ),

        "has_demo":
            has_demo,

        "has_video":
            has_video,

        "delivery_available":
            delivery_available,

        "min_date":
            min_date,

        "max_date":
            max_date,

        "valid_date_rows":
            valid_date_rows,

        "resolved_columns":
            resolved,

        "missing_expected": [
            x
            for x in [
                "date",
                "campaign",
                "spend",
                "results",
                "impressions",
            ]
            if x not in resolved
        ],

        "business_rules":
            rules,

        "business_rules_loaded":
            bool(rules),

        "business_rules_version":
            rules.get(
                "version"
            ),

        "agency_fee_rate":
            rules.get(
                "agency_fee_rate",
                0.08,
            ),
        "approach_counts": approach_counts,
        "bid_marker_counts": bid_marker_counts,
        "version_counts": version_counts,
        "product_counts": product_counts,
    }

    return (
        out,
        validation,
    )


# ============================================================
# PUBLIC LOADER
# ============================================================

def load_and_normalize_file(
    path: str | Path,
    rules_path: str | Path = "business_rules.json",
) -> tuple[
    pd.DataFrame,
    dict,
]:

    rules_path = Path(
        rules_path
    )

    with open(
        rules_path,
        "r",
        encoding="utf-8",
    ) as file:

        rules = json.load(
            file
        )

    raw_df = read_source_file(
        path
    )

    return normalize_meta_export(
        raw_df,
        rules,
    )


# ============================================================
# DATAFRAME -> JSON
# ============================================================

def dataframe_to_records(
    df: pd.DataFrame,
) -> list[
    dict[str, Any]
]:

    temp = df.astype(
        object
    )

    temp = temp.where(
        pd.notna(temp),
        None,
    )

    records = temp.to_dict(
        orient="records"
    )

    clean_records = []

    for row in records:

        clean_row = {}

        for key, value in row.items():

            if value is not None:

                if hasattr(
                    value,
                    "item",
                ):

                    try:

                        value = value.item()

                    except Exception:
                        pass

            if (
                isinstance(
                    value,
                    float,
                )
                and
                pd.isna(value)
            ):

                value = None

            clean_row[key] = value

        clean_records.append(
            clean_row
        )

    return clean_records