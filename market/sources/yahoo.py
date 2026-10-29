"""yfinance — 해외주식 / 해외지수 / 환율.

- 현재가:  Ticker.fast_info (last_price, previous_close). 실패 시 download() 의 최근 2개 종가로 계산.
- 일봉:    yf.download(period=..., interval='1d') 종가.
- 환율:    'KRW=X' (USD/KRW).

반환 형식은 collect.py 의 공통 스키마(Quote dict)를 따른다.
"""
from __future__ import annotations

import logging
import warnings
from datetime import datetime, timezone
from typing import Any

import yfinance as yf  # noqa: E402

# pandas 는 import 시 자체 경고 필터를 앞에 끼워 넣으므로, import 이후에 ignore 를 맨 앞에 둔다.
warnings.simplefilter("ignore")
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

FX_TICKER = "KRW=X"
INDEX_TICKERS = {"SPX": "^GSPC", "NASDAQ": "^IXIC"}


def _f(v: Any) -> float | None:
    try:
        x = float(v)
        return None if x != x else x  # NaN → None
    except (TypeError, ValueError):
        return None


def _quote_from_fast_info(ticker: str) -> dict:
    fi = yf.Ticker(ticker).fast_info
    price = _f(getattr(fi, "last_price", None))
    prev = _f(getattr(fi, "previous_close", None))
    if price is None:
        raise RuntimeError(f"yahoo: no price for {ticker}")
    chg = ((price / prev - 1) * 100) if prev else None
    return {
        "code": ticker,
        "mkt": "US",
        "name": None,
        "price": price,
        "prevClose": prev,
        "change": (price - prev) if prev is not None else None,
        "chg": chg,
        "currency": getattr(fi, "currency", None) or "USD",
        "status": None,
        "asOf": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "kind": "stock",
        "source": "yahoo",
    }


def _history_map(tickers: list[str], days: int) -> dict[str, list[list]]:
    """{ticker: [[YYYY-MM-DD, close], ...]} — 한 번의 download 로 일괄 조회."""
    if not tickers:
        return {}
    period = "1mo" if days <= 22 else "3mo" if days <= 65 else "6mo"
    df = yf.download(tickers, period=period, interval="1d", auto_adjust=True,
                     progress=False, group_by="ticker", threads=True)
    out: dict[str, list[list]] = {}
    for t in tickers:
        try:
            closes = df[t]["Close"] if len(tickers) > 1 else df["Close"]
            closes = closes.dropna()
            out[t] = [[idx.strftime("%Y-%m-%d"), float(v)] for idx, v in closes.items()][-days:]
        except Exception:
            out[t] = []
    return out


def fetch_quotes(tickers: list[str], history_days: int = 0) -> tuple[dict[str, dict], list[str]]:
    """여러 티커 일괄 조회. 반환: ({ticker: quote}, [오류 메시지])."""
    quotes: dict[str, dict] = {}
    errors: list[str] = []
    hist = _history_map(tickers, max(history_days, 2)) if tickers else {}

    for t in tickers:
        try:
            q = _quote_from_fast_info(t)
        except Exception as e:
            # 대체: 일봉 마지막 2개로 계산
            h = hist.get(t) or []
            if len(h) >= 2:
                price, prev = h[-1][1], h[-2][1]
                q = {"code": t, "mkt": "US", "name": None, "price": price, "prevClose": prev,
                     "change": price - prev, "chg": (price / prev - 1) * 100, "currency": "USD",
                     "status": None, "asOf": h[-1][0], "kind": "stock", "source": "yahoo"}
                errors.append(f"yahoo fast_info {t}: {e} (일봉으로 대체)")
            else:
                errors.append(f"yahoo quote {t}: {e}")
                continue
        if history_days:
            q["history"] = hist.get(t, [])[-history_days:]
        quotes[t] = q
    return quotes, errors


def fetch_fx() -> dict:
    """USD/KRW 환율. {usdkrw, prevClose, chg, asOf, source}"""
    q = _quote_from_fast_info(FX_TICKER)
    return {"usdkrw": round(q["price"], 2), "prevClose": q["prevClose"], "chg": q["chg"],
            "asOf": q["asOf"], "source": "yahoo"}


def fetch_indices() -> tuple[dict[str, dict], list[str]]:
    out: dict[str, dict] = {}
    errors: list[str] = []
    for name, t in INDEX_TICKERS.items():
        try:
            q = _quote_from_fast_info(t)
            q["kind"] = "index"
            q["name"] = name
            out[name] = q
        except Exception as e:
            errors.append(f"yahoo index {name}: {e}")
    return out, errors
