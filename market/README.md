# 사이로그 시장 데이터 수집 (market/)

국내주식·ETF·지수는 **네이버 금융**, 해외주식·해외지수·환율은 **yfinance** 로 받아
`sailog/market.js` 를 생성합니다. `data.js` 는 이 파일이 먼저 로드되어 있으면
`STOCKS` 의 `price`/`chg` 와 환율 `FX` 를 자동으로 실제 값으로 교체합니다.

> 시연용 가상 화면입니다. 실제 시세를 표시하지만 투자 권유가 아닙니다.

## 실행

```powershell
cd C:\Users\user\sailog\market
.\collect.ps1                  # 1회 수집 → ..\market.js, .\market.json
.\collect.ps1 --history 30     # 최근 30 영업일 종가 포함 (스파크라인용)
.\collect.ps1 --watch 60       # 60초마다 갱신 (시연 중 켜두기)
.\collect.ps1 --symbols 005930,NVDA   # data.js 대신 직접 지정
```

`collect.ps1` 은 `.venv` 가 없으면 만들고 `requirements.txt` 를 설치합니다.
PATH 의 `python` 은 Microsoft Store 스텁이라 동작하지 않으므로 venv 의 python 을 직접 씁니다.

## HTML 에서 쓰는 법

`market.js` 를 `data.js` **앞에** 로드하면 끝입니다. 없어도 임시값으로 동작합니다.

```html
<script src="market.js"></script>   <!-- 없으면 404 → data.js 임시값 사용 -->
<script src="data.js"></script>
<script src="ui.js"></script>
```

`SAILOG.MARKET` 로 상태를 읽을 수 있습니다.

| 필드 | 내용 |
|---|---|
| `live` | 실제 시세가 하나라도 적용됐는지 |
| `asOf` | 수집 시각 (KST) |
| `fx` | `{ usdkrw, prevClose, chg, asOf }` |
| `indices` | `KOSPI`, `KOSDAQ`, `SPX`, `NASDAQ` 의 `{ price, chg, ... }` |
| `applied` / `errors` | 적용 종목 수 / 수집 오류 목록 |

종목별로는 `SAILOG.STOCKS[key]` 에 `prevClose`, `asOf`, `status`, `source`, `history`, `live` 가 추가됩니다.

## 파일 구조

```
market/
  collect.py          수집기 본체 (data.js 의 STOCKS 를 파싱 → 두 소스 호출 → market.js/json 생성)
  collect.ps1         Windows 실행 래퍼 (venv 자동 생성)
  sources/naver.py    네이버 금융: 현재가(basic → polling 대체), 지수, 일봉(api.stock → fchart 대체)
  sources/yahoo.py    yfinance: fast_info 현재가(실패 시 일봉 대체), 일봉, KRW=X 환율, ^GSPC/^IXIC
  market.json         최근 수집 결과 (API 서버 등 다른 소비자용)
  requirements.txt
```

## 종목 추가

`data.js` 의 `STOCKS` 에 한 줄 추가하면 됩니다. `mkt: 'KR'` 이면 6자리 코드, `mkt: 'US'` 면 야후 티커.
수집기는 `STOCKS` 블록을 정규식으로 읽으므로 **한 종목 = 한 줄** 형식을 유지하세요.

## 주의

- 네이버 금융 API 는 비공식 엔드포인트입니다. 요청 간 0.15초 간격을 두며, 응답 형식이 바뀌면 `naver.py` 만 수정하면 됩니다.
- yfinance 는 Yahoo 의 비공식 API 를 쓰며 미국 장중에는 15분 지연일 수 있습니다.
- `RAW` 의 가상 고객 평균단가는 임시 시세 기준으로 만들어져 있어, 실제 시세 적용 시 평가손익이 커 보일 수 있습니다. 시연 전에 평균단가를 현재가 근처로 재조정하는 것을 권장합니다.
