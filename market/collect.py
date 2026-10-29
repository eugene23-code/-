"""귀띔 시장 데이터 수집기.

data.js 의 STOCKS 마스터를 읽어 국내(KR)는 네이버 금융, 해외(US)는 yfinance 로 시세를 받아
  sailog/market.js        ← 브라우저용 (window.SAILOG_MARKET = {...})   file:// 로도 동작
  sailog/market/market.json ← 다른 소비자용 (API 서버·분석 등)
두 파일을 생성한다. data.js 는 market.js 가 먼저 로드되어 있으면 price/chg/FX 를 자동 교체한다.

사용:
  python collect.py                 # 1회 수집
  python collect.py --watch 60      # 60초마다 갱신
  python collect.py --history 30    # 최근 30 영업일 종가 포함 (스파크라인용)
  python collect.py --symbols 005930,NVDA   # STOCKS 대신 직접 지정
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                      # sailog/
DATA_JS = ROOT / "data.js"
OUT_JS = ROOT / "market.js"
OUT_JSON = HERE / "market.json"
KST = timezone(timedelta(hours=9))

sys.path.insert(0, str(HERE))
from sources import naver, yahoo  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# data.js 의  key: { name: '...', code: '...', ..., mkt: 'KR', ... }  한 줄을 읽는다.
STOCK_RE = re.compile(
    r"^\s*(?P<key>[A-Za-z_]\w*)\s*:\s*\{[^}\n]*?name:\s*'(?P<name>[^']*)'[^}\n]*?code:\s*'(?P<code>[^']*)'"
    r"[^}\n]*?mkt:\s*'(?P<mkt>KR|US)'",
    re.M,
)


def load_master(path: Path = DATA_JS) -> list[dict]:
    """data.js 의 STOCKS 블록에서 [{key, name, code, mkt}] 추출."""
    text = path.read_text(encoding="utf-8")
    m = re.search(r"const STOCKS\s*=\s*\{(.*?)\n\s*\};", text, re.S)
    if not m:
        raise SystemExit(f"STOCKS 블록을 찾지 못했습니다: {path}")
    rows = [g.groupdict() for g in STOCK_RE.finditer(m.group(1))]
    if not rows:
        raise SystemExit("STOCKS 에서 종목을 하나도 읽지 못했습니다.")
    return rows


def collect(master: list[dict], history_days: int = 0) -> dict:
    t0 = time.time()
    errors: list[str] = []
    kr = [r for r in master if r["mkt"] == "KR"]
    us = [r for r in master if r["mkt"] == "US"]

    # 1) 국내 — 네이버 금융
    kr_quotes, e = naver.fetch_quotes([r["code"] for r in kr], history_days)
    errors += e
    indices: dict[str, dict] = {}
    for idx in ("KOSPI", "KOSDAQ"):
        try:
            indices[idx] = naver.fetch_index(idx)
        except Exception as ex:
            errors.append(f"naver index {idx}: {ex}")

    # 2) 해외 — yfinance
    us_quotes, e = yahoo.fetch_quotes([r["code"] for r in us], history_days)
    errors += e
    us_idx, e = yahoo.fetch_indices()
    errors += e
    indices.update(us_idx)
    fx = None
    try:
        fx = yahoo.fetch_fx()
    except Exception as ex:
        errors.append(f"yahoo fx: {ex}")

    # 3) STOCKS 키 기준으로 병합
    stocks: dict[str, dict] = {}
    for r in master:
        q = (kr_quotes if r["mkt"] == "KR" else us_quotes).get(r["code"])
        if not q:
            continue
        q = dict(q)
        q["key"] = r["key"]
        q["nameSrc"] = q.get("name")   # 데이터 소스가 준 종목명 (검증용)
        q["name"] = r["name"]          # 화면 표기는 data.js 의 이름 유지
        if q.get("price") is not None:
            q["price"] = round(q["price"], 4 if r["mkt"] == "US" else 0)
        if q.get("chg") is not None:
            q["chg"] = round(q["chg"], 2)
        stocks[r["key"]] = q

    now = datetime.now(KST)
    return {
        "asOf": now.isoformat(timespec="seconds"),
        "generatedBy": "sailog/market/collect.py",
        "sources": {"KR": "naver-finance", "US": "yfinance", "FX": "yfinance"},
        "fx": fx,
        "indices": indices,
        "stocks": stocks,
        "counts": {"requested": len(master), "ok": len(stocks), "failed": len(master) - len(stocks)},
        "elapsedSec": round(time.time() - t0, 1),
        "errors": errors,
        "notice": "시연용 가상 화면 — 실제 시세 데이터를 표시하지만 투자 권유가 아닙니다.",
    }


def write_outputs(payload: dict, out_js: Path = OUT_JS, out_json: Path = OUT_JSON) -> None:
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    out_json.write_text(body + "\n", encoding="utf-8")
    header = ("/* 자동 생성 — sailog/market/collect.py. 직접 수정하지 마세요.\n"
              f"   기준시각 {payload['asOf']} · KR: 네이버 금융 · US/FX: yfinance */\n")
    out_js.write_text(header + "window.SAILOG_MARKET = " + body + ";\n", encoding="utf-8")


def summarize(p: dict) -> str:
    lines = [f"[{p['asOf']}] 종목 {p['counts']['ok']}/{p['counts']['requested']} 수집 · {p['elapsedSec']}s"]
    if p.get("fx"):
        lines.append(f"  USD/KRW {p['fx']['usdkrw']:,}")
    for k, v in p["indices"].items():
        if v.get("price") is not None:
            lines.append(f"  {k:<7}{v['price']:>12,.2f}  {v['chg'] if v['chg'] is not None else 0:+.2f}%")
    for k, q in p["stocks"].items():
        unit = "$" if q["mkt"] == "US" else "₩"
        price = f"{q['price']:,.2f}" if q["mkt"] == "US" else f"{q['price']:,.0f}"
        chg = f"{q['chg']:+.2f}%" if q["chg"] is not None else "   n/a"
        lines.append(f"  {q['mkt']} {q['code']:<7}{q['name']:<16}{unit}{price:>12}  {chg:>8}  [{q['source']}]")
    for e in p["errors"]:
        lines.append(f"  ! {e}")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="귀띔 시장 데이터 수집기")
    ap.add_argument("--watch", type=int, metavar="SEC", help="지정 초마다 반복 수집")
    ap.add_argument("--history", type=int, default=0, metavar="DAYS", help="최근 N 영업일 종가 포함")
    ap.add_argument("--symbols", help="쉼표 구분 코드 목록 (data.js 대신 사용, 예: 005930,NVDA)")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()

    if a.symbols:
        master = [{"key": s, "name": s, "code": s, "mkt": "KR" if s.isdigit() else "US"}
                  for s in a.symbols.split(",") if s.strip()]
    else:
        master = load_master()

    while True:
        payload = collect(master, a.history)
        write_outputs(payload)
        if not a.quiet:
            print(summarize(payload))
            print(f"  → {OUT_JS}\n  → {OUT_JSON}")
        if not a.watch:
            return 0 if payload["counts"]["failed"] == 0 else 1
        time.sleep(a.watch)


if __name__ == "__main__":
    sys.exit(main())
