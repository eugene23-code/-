"""네이버 금융 — 국내주식 / ETF / 지수 시세 및 일봉.

사용 엔드포인트 (비공식, 로그인 불필요):
  현재가   https://m.stock.naver.com/api/stock/{code}/basic
  현재가2  https://polling.finance.naver.com/api/realtime/domestic/stock/{code}   (basic 실패 시 대체)
  지수     https://m.stock.naver.com/api/index/{KOSPI|KOSDAQ}/basic
  일봉     https://api.stock.naver.com/chart/domestic/item/{code}/day?startDateTime=&endDateTime=
  일봉2    https://fchart.stock.naver.com/sise.nhn?symbol=&timeframe=day&count=&requestType=0 (EUC-KR XML, 대체)

반환 형식은 collect.py 의 공통 스키마(Quote dict)를 따른다.
"""
from __future__ import annotations

import re
import time
from datetime import date, timedelta
from typing import Any

import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://m.stock.naver.com/",
}
TIMEOUT = 8
RETRY = 2
PAUSE = 0.15  # 요청 간 간격 (초) — 과도한 호출 방지

_session = requests.Session()
_session.headers.update(HEADERS)


def _num(v: Any) -> float | None:
    """'232,500' / '-9,500' / '+1.2' / 232500.0 → float. 파싱 불가 시 None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace(",", "").replace("+", "").strip()
    if s in ("", "-", "N/A"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _get(url: str, **kw) -> requests.Response:
    last: Exception | None = None
    for i in range(RETRY + 1):
        try:
            r = _session.get(url, timeout=TIMEOUT, **kw)
            if r.status_code == 200:
                return r
            last = RuntimeError(f"HTTP {r.status_code} {url}")
        except requests.RequestException as e:  # 네트워크 오류
            last = e
        time.sleep(0.4 * (i + 1))
    raise last  # type: ignore[misc]


def _basic_to_quote(d: dict, code: str) -> dict:
    price = _num(d.get("closePrice"))
    diff = _num(d.get("compareToPreviousClosePrice"))
    chg = _num(d.get("fluctuationsRatio"))
    prev = (price - diff) if (price is not None and diff is not None) else None
    return {
        "code": code,
        "mkt": "KR",
        "name": d.get("stockName"),
        "price": price,
        "prevClose": prev,
        "change": diff,
        "chg": chg,
        "currency": "KRW",
        "status": d.get("marketStatus"),
        "asOf": d.get("localTradedAt"),
        "kind": d.get("stockEndType"),  # stock | etf | index
        "source": "naver",
    }


def fetch_quote(code: str) -> dict:
    """종목·ETF 현재가. basic API 우선, 실패 시 polling API."""
    try:
        d = _get(f"https://m.stock.naver.com/api/stock/{code}/basic").json()
        if _num(d.get("closePrice")) is not None:
            return _basic_to_quote(d, code)
    except Exception:
        pass
    d = _get(f"https://polling.finance.naver.com/api/realtime/domestic/stock/{code}").json()
    datas = d.get("datas") or []
    if not datas:
        raise RuntimeError(f"naver: no data for {code}")
    q = _basic_to_quote(datas[0], code)
    q["kind"] = q["kind"] or "stock"
    return q


def fetch_index(symbol: str = "KOSPI") -> dict:
    d = _get(f"https://m.stock.naver.com/api/index/{symbol}/basic").json()
    q = _basic_to_quote(d, symbol)
    q["kind"] = "index"
    return q


def fetch_history(code: str, days: int = 30) -> list[list]:
    """일봉 [[YYYY-MM-DD, close], ...] 오름차순. days 는 달력일 기준 조회 범위."""
    end = date.today()
    start = end - timedelta(days=days * 2)  # 휴장일 감안해 넉넉히
    url = (f"https://api.stock.naver.com/chart/domestic/item/{code}/day"
           f"?startDateTime={start:%Y%m%d}&endDateTime={end:%Y%m%d}")
    try:
        rows = _get(url).json()
        out = [[f"{r['localDate'][:4]}-{r['localDate'][4:6]}-{r['localDate'][6:]}", float(r["closePrice"])]
               for r in rows if r.get("closePrice") is not None]
        if out:
            return out[-days:]
    except Exception:
        pass
    # 대체: fchart (EUC-KR XML)
    r = _get(f"https://fchart.stock.naver.com/sise.nhn?symbol={code}&timeframe=day&count={days}&requestType=0")
    r.encoding = "euc-kr"
    out = []
    for m in re.finditer(r'<item data="([^"]+)"', r.text):
        d, _o, _h, _l, c, _v = m.group(1).split("|")
        out.append([f"{d[:4]}-{d[4:6]}-{d[6:]}", float(c)])
    return out[-days:]


def fetch_quotes(codes: list[str], history_days: int = 0) -> tuple[dict[str, dict], list[str]]:
    """여러 종목 일괄 조회. 반환: ({code: quote}, [오류 메시지])."""
    quotes: dict[str, dict] = {}
    errors: list[str] = []
    for code in codes:
        try:
            q = fetch_quote(code)
            if history_days:
                try:
                    q["history"] = fetch_history(code, history_days)
                except Exception as e:
                    errors.append(f"naver history {code}: {e}")
            quotes[code] = q
        except Exception as e:
            errors.append(f"naver quote {code}: {e}")
        time.sleep(PAUSE)
    return quotes, errors
