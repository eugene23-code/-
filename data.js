/* ============================================================
   귀띔 데이터 — 시연용
   - 고객: 가상 인물 32명 (실제 고객과 무관) · 31~32번은 대주주 양도세 사례
   - 종목: 실제 종목명 사용. 시세·등락률·환율은 market.js(실제 시장 데이터)가
     먼저 로드되어 있으면 자동 교체되고, 없으면 아래 임시값을 사용합니다.
     market.js 생성: sailog/market/collect.ps1  (KR: 네이버 금융, US·환율: yfinance)
   ============================================================ */
const SAILOG = (() => {
  const TODAY = new Date('2026-10-29T09:00:00+09:00');
  let FX = 1380; // 환율 (원/달러) — market.js 없을 때의 임시값
  const RATES = { cma: 2.75, deposit: 0.1 }; // 연 수익률 (%) — 유진투자증권 CMA 2.75% (사용자 확인 2026-10-29)
  const TAX = { overseasBasic: 2500000, overseasRate: 0.22,
    // 유진투자증권 취급 절세 계좌: ISA · 연금저축 (IRP 미취급). 현행 세법 기준 시연값.
    pension: { limit: 6000000, salaryCut: 55000000, rateLow: 0.165, rateHigh: 0.132 },        // 연금저축 세액공제: 연 600만원, 총급여 5,500만원 이하 16.5% / 초과 13.2%
    isa: { general: 2000000, low: 4000000, sepRate: 0.099, normalRate: 0.154, toPension: 0.10, toPensionMax: 3000000 }, // ISA 비과세(일반 200·서민형 400만원), 초과 9.9%, 만기 연금저축 이전 시 이전액 10%(최대 300만원) 추가 공제
    // 대주주 요건(상장주식 양도세): 직전 사업연도 말 종목당 보유금액 기준. 세법 개정 시 threshold 만 조정.
    major: { threshold: 5000000000, watch: 4000000000, baseDate: '2026-12-30', lastTradeDate: '2026-12-28', rateLow: 20, rateHigh: 25, rateCut: 300000000 } };
  const PB = { name: '조은식', title: 'PB', branch: '서울WM센터' };

  /* ---------- 종목 마스터 (시세는 임시값) ---------- */
  const STOCKS = {
    hanbit:    { name: 'SK하이닉스',       code: '000660', sector: '반도체',      mkt: 'KR', price: 1497000, chg: 0.67 },
    sejong:    { name: '알테오젠',         code: '196170', sector: '바이오',      mkt: 'KR', price: 218000, chg: -2.24 },
    daeyang:   { name: 'HD현대중공업',     code: '329180', sector: '조선',        mkt: 'KR', price: 275500, chg: -3.50 },
    nuri:      { name: 'LG에너지솔루션',   code: '373220', sector: '2차전지',     mkt: 'KR', price: 352000, chg: -9.63 },
    mirae:     { name: '두산로보틱스',     code: '454910', sector: '로봇',        mkt: 'KR', price: 57000,  chg: -5.79 },
    cheongdam: { name: 'CJ제일제당',       code: '097950', sector: '식품',        mkt: 'KR', price: 170300, chg: 0.29 },
    hangang:   { name: '현대건설',         code: '000720', sector: '건설',        mkt: 'KR', price: 86700,  chg: -9.21 },
    arirang:   { name: '크래프톤',         code: '259960', sector: '게임',        mkt: 'KR', price: 180000, chg: -1.75 },
    baekdu:    { name: 'POSCO홀딩스',      code: '005490', sector: '철강·소재',   mkt: 'KR', price: 273500, chg: -3.01 },
    seorabeol: { name: '삼성전자',         code: '005930', sector: '반도체',      mkt: 'KR', price: 230250, chg: -4.86 },
    geumgang:  { name: 'KB금융',           code: '105560', sector: '금융',        mkt: 'KR', price: 154900, chg: 0.58 },
    gaon:      { name: 'SK텔레콤',         code: '017670', sector: '통신',        mkt: 'KR', price: 75100,  chg: -3.72 },
    divETF:    { name: 'KODEX 배당성장',   code: '211900', sector: '배당 ETF',    mkt: 'KR', price: 25125,  chg: -0.28 },
    bondFund:  { name: 'KODEX 국고채10년', code: '152380', sector: '채권 ETF',    mkt: 'KR', price: 66690,  chg: 0.23 },
    usETF:     { name: 'TIGER 미국S&P500', code: '360750', sector: '미국지수 ETF', mkt: 'KR', price: 25470, chg: -0.49 },
    orbit:     { name: 'Rocket Lab',       code: 'RKLB',   sector: '우주항공',    mkt: 'US', price: 58.60,   chg: 0.09 },
    nimbus:    { name: 'Palantir',         code: 'PLTR',   sector: 'AI·소프트웨어', mkt: 'US', price: 196.81, chg: -1.10 },
    helio:     { name: 'Tesla',            code: 'TSLA',   sector: '전기차',      mkt: 'US', price: 404.22,  chg: -0.95 },
    atlas:     { name: 'NVIDIA',           code: 'NVDA',   sector: '반도체',      mkt: 'US', price: 215.38,  chg: -1.26 },
    pioneer:   { name: 'AMD',              code: 'AMD',    sector: '반도체',      mkt: 'US', price: 578.44,  chg: 2.58 },
    meadow:    { name: 'Eli Lilly',        code: 'LLY',    sector: '헬스케어',    mkt: 'US', price: 1288.30,  chg: 0.37 },
    // 통화 데이터 고객(calldata.js) 보유 종목 — 사건(공시)이 있는 종목은 2026년 실제 공시 기준
    sg:        { name: 'SG',               code: '255220', sector: '건설자재',    mkt: 'KR', price: 1004,    chg: -3.28 },
    humax:     { name: '휴맥스',           code: '115160', sector: '통신장비',    mkt: 'KR', price: 5150,    chg: 0.00 },
    daelim:    { name: '대림제지',         code: '017650', sector: '제지',        mkt: 'KR', price: 2015,    chg: -1.95 },
    kct:       { name: '케이씨티',         code: '089150', sector: 'IT 장비',     mkt: 'KR', price: 1499,    chg: 0.00 },
    dawon:     { name: '다원시스',         code: '068240', sector: '전력장비',    mkt: 'KR', price: 2530,    chg: 0.00 },
    kd:        { name: 'KD',               code: '044180', sector: '건설',        mkt: 'KR', price: 205,     chg: 0.00 },
    lnc:       { name: '엘앤씨바이오',     code: '290650', sector: '바이오',      mkt: 'KR', price: 25950,   chg: 4.01 },
    vessel:    { name: '베셀',             code: '177350', sector: '디스플레이장비', mkt: 'KR', price: 841,  chg: -6.14 },
    hanmi:     { name: '한미반도체',       code: '042700', sector: '반도체장비',  mkt: 'KR', price: 192200,  chg: -5.55 },
    hsteel:    { name: '현대제철',         code: '004020', sector: '철강·소재',   mkt: 'KR', price: 26000,   chg: -2.07 },
    netmarble: { name: '넷마블',           code: '251270', sector: '게임',        mkt: 'KR', price: 33300,   chg: -0.75 },
    soulbrain: { name: '솔브레인',         code: '357780', sector: '반도체소재',  mkt: 'KR', price: 313500,  chg: -1.42 },
    hanwhasol: { name: '한화솔루션',       code: '009830', sector: '태양광',      mkt: 'KR', price: 26275,   chg: -1.59 },
    classys:   { name: '클래시스',         code: '214150', sector: '의료기기',    mkt: 'KR', price: 25900,   chg: -4.07 },
    orion:     { name: '오리온',           code: '271560', sector: '식품',        mkt: 'KR', price: 112500,  chg: 0.90 },
    rainbow:   { name: '레인보우로보틱스', code: '277810', sector: '로봇',        mkt: 'KR', price: 374500,  chg: -7.42 },
    hlmando:   { name: 'HL만도',           code: '204320', sector: '자동차부품',  mkt: 'KR', price: 37650,   chg: -2.59 },
    jyp:       { name: 'JYP Ent.',         code: '035900', sector: '엔터',        mkt: 'KR', price: 38900,   chg: -2.87 },
    shinhan:   { name: '신한지주',         code: '055550', sector: '금융',        mkt: 'KR', price: 88200,   chg: 0.46 },
    kepco:     { name: '한국전력',         code: '015760', sector: '유틸리티',    mkt: 'KR', price: 28150,   chg: -1.75 },
    rivn:      { name: 'Rivian',           code: 'RIVN',   sector: '전기차',      mkt: 'US', price: 11.67,   chg: -1.27 },
    smh:       { name: 'VanEck 반도체 ETF', code: 'SMH',   sector: '반도체 ETF',  mkt: 'US', price: 567.67,  chg: 1.57 },
    schd:      { name: 'Schwab 미국배당 ETF', code: 'SCHD', sector: '배당 ETF',   mkt: 'US', price: 35.09,   chg: -0.09 },
  };

  /* ---------- 실제 시장 데이터 적용 (market.js → window.SAILOG_MARKET) ----------
     collect.py 가 생성한 market.js 가 data.js 보다 먼저 로드되면 STOCKS 의 price/chg 와 FX 를 교체.
     MARKET.live 가 false 면 화면에서 "임시 시세" 배지를 띄울 수 있도록 상태를 노출한다. */
  const RAW_MARKET = (typeof window !== 'undefined' && window.SAILOG_MARKET) || null;
  const MARKET = { live: false, asOf: null, fx: null, indices: {}, sources: null, applied: 0, errors: [], notice: '' };
  if (RAW_MARKET && RAW_MARKET.stocks) {
    Object.entries(RAW_MARKET.stocks).forEach(([k, q]) => {
      const s = STOCKS[k];
      if (!s || !Number.isFinite(q.price)) return;
      s.price = q.price;
      s.chg = Number.isFinite(q.chg) ? q.chg : 0;
      s.prevClose = q.prevClose; s.asOf = q.asOf; s.status = q.status; s.source = q.source;
      s.history = q.history || null; s.live = true;
      MARKET.applied++;
    });
    if (RAW_MARKET.fx && Number.isFinite(RAW_MARKET.fx.usdkrw)) { FX = RAW_MARKET.fx.usdkrw; MARKET.fx = RAW_MARKET.fx; }
    MARKET.live = MARKET.applied > 0;
    MARKET.asOf = RAW_MARKET.asOf; MARKET.indices = RAW_MARKET.indices || {};
    MARKET.sources = RAW_MARKET.sources; MARKET.errors = RAW_MARKET.errors || []; MARKET.notice = RAW_MARKET.notice || '';
  }

  /* ---------- 가상 고객 32명 ----------
     holdings: [종목키, 수량, 평균단가]
     events:   원장 로그에서 감지된 이벤트
     cash: 예수금(원), idle: 예수금 미운용 일수
  ------------------------------------------------ */
  const RAW = [
    { id: 1,  name: '김서연', age: 52, risk: '안정추구형', cash: 48000000, idle: 62,  last: '2026-09-12',
      holdings: [['divETF', 340, 24340], ['geumgang', 141, 147100], ['bondFund', 320, 65940]],
      tags: ['배당 선호', '월 1~2회 거래', '장기 보유'], events: [] },
    { id: 2,  name: '박준호', age: 44, risk: '공격투자형', cash: 3200000, idle: 4, last: '2026-10-20',
      holdings: [['hanbit', 39, 1593600], ['nuri', 116, 378500], ['seorabeol', 32, 222000], ['atlas', 30, 188.40]],
      tags: ['하락 시 추가매수', '주 3회 이상 거래', '반도체 집중'], events: [] },
    { id: 3,  name: '이지은', age: 37, risk: '적극투자형', cash: 1500000, idle: 9, last: '2026-10-02',
      holdings: [['pioneer', 29, 508.47], ['nimbus', 57, 212.05], ['usETF', 160, 24240]],
      tags: ['해외주식 중심', 'AI 테마 관심', '분할 매수'], events: [{ t: 'TAX', realized: 4800000 }] },
    { id: 4,  name: '최민수', age: 61, risk: '안정형',     cash: 9000000, idle: 20, last: '2026-10-15',
      holdings: [['bondFund', 1270, 65310], ['divETF', 680, 24420], ['geumgang', 108, 150700]],
      tags: ['원금 보존 중시', 'ELS 반복 투자', '분기 1회 방문'],
      events: [{ t: 'MATURITY', product: 'ELS 2401호', amount: 100000000, date: '2026-11-03' }] },
    { id: 5,  name: '정하늘', age: 29, risk: '적극투자형', cash: 8000000, idle: 45, last: '2026-08-28',
      holdings: [['seorabeol', 15, 223100]],
      tags: ['사회초년생', '적립식 관심', '앱 접속 잦음'], events: [{ t: 'ISA_OPEN' }] },
    { id: 6,  name: '강도윤', age: 48, risk: '위험중립형', cash: 230000000, idle: 1, last: '2026-10-10',
      holdings: [['usETF', 880, 23940], ['divETF', 400, 24510]],
      tags: ['지수 ETF 선호', '대형 자금 이동', '분기 리밸런싱'],
      events: [{ t: 'LARGE_IN', amount: 230000000, date: '2026-10-28', memo: '부동산 매각대금 추정' }] },
    { id: 7,  name: '윤서아', age: 55, risk: '안정추구형', cash: 12000000, idle: 15, last: '2026-10-22',
      holdings: [['bondFund', 800, 66250], ['divETF', 970, 24160], ['gaon', 196, 76080]],
      tags: ['연금 자산 관심', '세제 혜택 민감', '통화 선호'],
      events: [{ t: 'PENSION', product: '연금저축', paid: 2200000, limit: 6000000, bracket: 'over' }] },
    { id: 8,  name: '임태양', age: 40, risk: '공격투자형', cash: 2100000, idle: 3, last: '2026-10-25',
      holdings: [['sejong', 189, 195800], ['mirae', 151, 54530]],
      tags: ['바이오 테마', '단일 종목 집중', '급등 시 추가 매수'], events: [] },
    { id: 9,  name: '한예린', age: 33, risk: '위험중립형', cash: 2600000, idle: 11, last: '2026-09-30',
      holdings: [['usETF', 240, 22910], ['divETF', 230, 23990]],
      tags: ['ISA 활용', '적립식', '뉴스레터 구독'],
      events: [{ t: 'ISA_MATURITY', date: '2026-12-15', gain: 3100000, taxFree: 4000000, kind: '서민형', balance: 21000000, bracket: 'under' }] },
    { id: 10, name: '오승현', age: 58, risk: '적극투자형', cash: 4500000, idle: 2, last: '2026-10-27',
      holdings: [['daeyang', 172, 243400], ['hangang', 675, 89190], ['baekdu', 160, 256000], ['orbit', 217, 52.64]],
      tags: ['경기민감주 선호', '타사 계좌 보유', '출금 증가'],
      events: [{ t: 'LARGE_OUT', amount: 80000000, date: '2026-10-28', memo: '타 증권사 계좌로 이체' }] },
    { id: 11, name: '서민재', age: 46, risk: '안정추구형', cash: 21000000, idle: 190, last: '2026-04-21',
      holdings: [['geumgang', 33, 142200]],
      tags: ['장기 미접속', '예수금만 보유'], events: [{ t: 'DORMANT', days: 190 }] },
    { id: 12, name: '조은비', age: 31, risk: '공격투자형', cash: 600000, idle: 1, last: '2026-10-24',
      holdings: [['arirang', 149, 198100], ['sejong', 15, 190500]],
      tags: ['게임·콘텐츠 테마', '손절 빠름', '야간 거래'], events: [] },
    { id: 13, name: '배성우', age: 67, risk: '안정형',     cash: 15000000, idle: 8, last: '2026-10-19',
      holdings: [['bondFund', 3180, 64680], ['divETF', 1430, 23810]],
      tags: ['채권 중심', '이자 수령 목적', '자녀 증여 관심'],
      events: [{ t: 'MATURITY', product: '국고채 3년물', amount: 50000000, date: '2026-11-10' }] },
    { id: 14, name: '신유진', age: 42, risk: '위험중립형', cash: 4500000, idle: 12, last: '2026-10-08',
      holdings: [['usETF', 310, 24450], ['seorabeol', 24, 226100], ['cheongdam', 38, 174200]],
      tags: ['분산 투자', '월 적립', '리포트 열람 많음'], events: [] },
    { id: 15, name: '황지훈', age: 36, risk: '적극투자형', cash: 900000, idle: 5, last: '2026-10-11',
      holdings: [['nimbus', 98, 226.63], ['atlas', 38, 201.19]],
      tags: ['해외 테크 중심', '실적 시즌 거래', '환전 타이밍 문의'], events: [{ t: 'TAX', realized: 3100000 }] },
    { id: 16, name: '송다은', age: 50, risk: '안정추구형', cash: 120000000, idle: 95, last: '2026-07-25',
      holdings: [['geumgang', 274, 144700], ['divETF', 1200, 24340]],
      tags: ['고액 예수금', '결정 신중', '대면 상담 선호'], events: [] },
    { id: 17, name: '권현우', age: 39, risk: '공격투자형', cash: 1800000, idle: 6, last: '2026-10-17',
      holdings: [['pioneer', 54, 479.41], ['orbit', 130, 55.41], ['helio', 16, 383.87]],
      tags: ['AI 테마 집중', '급등주 추종', '레버리지 문의'], events: [] },
    { id: 18, name: '문소희', age: 45, risk: '위험중립형', cash: 3300000, idle: 14, last: '2026-09-18',
      holdings: [['usETF', 200, 23420], ['bondFund', 240, 65940]],
      tags: ['연금저축 보유', '연말정산 관심', '맞벌이'],
      events: [{ t: 'PENSION', product: '연금저축', paid: 3000000, limit: 6000000, bracket: 'under' }] },
    { id: 19, name: '안재민', age: 27, risk: '공격투자형', cash: 2000000, idle: 2, last: '2026-10-09',
      holdings: [['hanbit', 2, 1545300]],
      tags: ['신규 고객', '첫 투자', '커뮤니티 영향'], events: [{ t: 'ONBOARD', joined: '2026-10-08' }] },
    { id: 20, name: '유나영', age: 63, risk: '안정형',     cash: 7000000, idle: 18, last: '2026-10-21',
      holdings: [['bondFund', 1910, 65620], ['geumgang', 166, 148300]],
      tags: ['이자 생활', '정기 방문', '가족 소개 다수'], events: [{ t: 'BIRTHDAY', date: '2026-10-31' }] },
    { id: 21, name: '장민철', age: 49, risk: '적극투자형', cash: 5200000, idle: 7, last: '2026-10-23',
      holdings: [['nuri', 95, 406900], ['daeyang', 54, 260000], ['usETF', 160, 24550]],
      tags: ['2차전지 장기 보유', '물타기 2회', '뉴스 민감'], events: [] },
    { id: 22, name: '홍수빈', age: 34, risk: '위험중립형', cash: 1800000, idle: 10, last: '2026-10-05',
      holdings: [['divETF', 140, 24690], ['usETF', 80, 25060]],
      tags: ['소액 적립', '자동이체'], events: [] },
    { id: 23, name: '노경태', age: 57, risk: '안정추구형', cash: 65000000, idle: 48, last: '2026-09-05',
      holdings: [['bondFund', 960, 65940], ['gaon', 375, 73630], ['cheongdam', 77, 172200]],
      tags: ['만기 자금 대기 중', '예금 비교', '금리 민감'], events: [] },
    { id: 24, name: '백지원', age: 41, risk: '적극투자형', cash: 2400000, idle: 9, last: '2026-10-14',
      holdings: [['mirae', 179, 50170], ['helio', 21, 374.28], ['atlas', 28, 180.01]],
      tags: ['로봇·모빌리티 테마', '손실 종목 정리함', '세금 문의'], events: [{ t: 'TAX', realized: -1200000 }] },
    { id: 25, name: '류승민', age: 38, risk: '공격투자형', cash: 1100000, idle: 3, last: '2026-10-26',
      holdings: [['sejong', 57, 182500], ['arirang', 22, 188100], ['hanbit', 1, 1448700]],
      tags: ['테마 순환매', '단기 매매', '목표가 설정'], events: [] },
    { id: 26, name: '전미래', age: 30, risk: '적극투자형', cash: 3800000, idle: 13, last: '2026-09-27',
      holdings: [['usETF', 120, 24140], ['divETF', 100, 24510]],
      tags: ['ISA 보유', '연말 납입 패턴', '절세 관심'], events: [{ t: 'ISA_LIMIT', remain: 14000000, gain: 1250000, taxFree: 2000000, kind: '일반형' }] },
    { id: 27, name: '고석진', age: 54, risk: '위험중립형', cash: 50000000, idle: 0, last: '2026-10-16',
      holdings: [['usETF', 440, 24040], ['bondFund', 480, 66250]],
      tags: ['퇴직금 운용 상담', '보수적 분산'],
      events: [{ t: 'LARGE_IN', amount: 50000000, date: '2026-10-29', memo: '퇴직금 입금 추정' }] },
    { id: 28, name: '남지아', age: 47, risk: '안정추구형', cash: 7000000, idle: 22, last: '2026-10-13',
      holdings: [['divETF', 330, 24340], ['geumgang', 37, 151900]],
      tags: ['배당 재투자', '분기 점검'], events: [] },
    { id: 29, name: '차우진', age: 59, risk: '적극투자형', cash: 6800000, idle: 16, last: '2026-10-18',
      holdings: [['daeyang', 235, 265500], ['hangang', 217, 91260]],
      tags: ['조선업 확신', '단일 종목 집중', '배당 기대'], events: [] },
    { id: 30, name: '표하람', age: 35, risk: '위험중립형', cash: 1300000, idle: 150, last: '2026-05-30',
      holdings: [['usETF', 49, 23120]],
      tags: ['장기 미접속', '앱 알림 꺼짐'], events: [{ t: 'DORMANT', days: 150 }] },
    // 대주주 양도세 사례 (종목당 보유 50억 기준)
    { id: 31, name: '서정호', age: 66, risk: '적극투자형', cash: 320000000, idle: 40, last: '2026-10-06',
      holdings: [['seorabeol', 30000, 165000], ['geumgang', 2000, 141000], ['bondFund', 3000, 65500]],
      tags: ['장기 보유', '세무 상담 선호', '연말 매도 이력'], events: [] },
    { id: 32, name: '민경아', age: 54, risk: '위험중립형', cash: 150000000, idle: 10, last: '2026-10-21',
      holdings: [['daeyang', 16000, 150000], ['usETF', 2000, 23800]],
      tags: ['배당 수령', '분기 방문', '가족 명의 분산 문의'], events: [] },
  ];

  /* 통화 데이터 고객 24명(개인 19 · 법인 5)과 가상 종목 — calldata.js(SAILOG_CALLDATA)가 먼저 로드되면 합류 */
  const CALLDATA = (typeof window !== 'undefined' && window.SAILOG_CALLDATA) || null;
  if (CALLDATA) { Object.assign(STOCKS, CALLDATA.stocks); RAW.push(...CALLDATA.customers); }

  /* ---------- 유틸 ---------- */
  const won = (n) => {
    const neg = n < 0; n = Math.abs(Math.round(n));
    let s;
    if (n >= 100000000) {
      const eok = Math.floor(n / 100000000); const man = Math.round((n % 100000000) / 10000);
      s = man ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
    } else if (n >= 10000) s = `${Math.round(n / 10000).toLocaleString()}만원`;
    else s = `${n.toLocaleString()}원`;
    return (neg ? '-' : '') + s;
  };
  const wonFull = (n) => `${Math.round(n).toLocaleString()}원`;
  const pct = (n) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
  const dayDiff = (d) => Math.round((new Date(d + 'T09:00:00+09:00') - TODAY) / 86400000);
  const fmtDate = (d) => { const x = new Date(d); return `${x.getMonth() + 1}월 ${x.getDate()}일`; };
  const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const daysAgo = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

  /* ---------- 보유 종목 평가 ---------- */
  function valueHoldings(c) {
    return c.holdings.map(([k, qty, avg]) => {
      const s = STOCKS[k]; const fx = s.mkt === 'US' ? FX : 1;
      const value = s.price * qty * fx; const cost = avg * qty * fx;
      return { key: k, ...s, qty, avg, value, cost, pnl: value - cost, pnlPct: (s.price / avg - 1) * 100 };
    });
  }

  /* ---------- 신호 (오늘 할 일의 근거) ---------- */
  const CAT = { DROP: '시장변동', SURGE: '시장변동', CONC: '시장변동', TAX: '절세', ISA_OPEN: '절세', ISA_MATURITY: '절세', ISA_LIMIT: '절세', PENSION: '절세', CMA: '자금', LARGE_IN: '자금', LARGE_OUT: '자금', MATURITY: '자금', DORMANT: '관계', ONBOARD: '관계', BIRTHDAY: '관계', MARGIN: '자금', RECEIVABLE: '자금', MAJOR: '절세' };
  const LABEL = { DROP: '급락', SURGE: '급등', CONC: '종목 편중', TAX: '해외 양도세', ISA_OPEN: 'ISA 미보유', ISA_MATURITY: 'ISA 만기', ISA_LIMIT: 'ISA 납입한도', PENSION: '연금 세액공제', CMA: '예수금 미운용', LARGE_IN: '대규모 입금', LARGE_OUT: '대규모 출금', MATURITY: '만기 도래', DORMANT: '장기 미거래', ONBOARD: '신규 고객', BIRTHDAY: '생일', MARGIN: '담보비율 주의', RECEIVABLE: '미수 발생', MAJOR: '대주주 양도세' };

  /* ---------- 절세 계산 (계좌별 구체 금액 · 귀띔/신호 공용) ---------- */
  // 연금저축: 총급여 5,500만원 이하 16.5% / 초과 13.2%. bracket 미상이면 13.2%(보수적)
  function pensionCalc(e) {
    const P = TAX.pension; const rate = e.bracket === 'under' ? P.rateLow : P.rateHigh;
    const limit = Math.min(e.limit || P.limit, P.limit), paid = Math.min(e.paid, limit), room = Math.max(0, limit - paid);
    return { rate, pct: (rate * 100).toFixed(1) + '%', limit, room, now: paid * rate, extra: room * rate, max: limit * rate,
      bracketLabel: e.bracket === 'under' ? '총급여 5,500만원 이하' : e.bracket === 'over' ? '총급여 5,500만원 초과' : '소득 구간 미확인' };
  }
  // ISA: 운용수익 비과세(일반 200 · 서민형 400만원). saved = 일반계좌였다면 낼 세금(15.4%) 대비 절세액
  function isaCalc(e) {
    const I = TAX.isa; const free = e.taxFree || I.general; const gain = e.gain || 0;
    const saved = Math.min(gain, free) * I.normalRate + Math.max(0, gain - free) * (I.normalRate - I.sepRate);
    const moveBase = e.balance ? Math.min(e.balance * I.toPension, I.toPensionMax) : 0;
    const move = moveBase * (e.bracket === 'under' ? TAX.pension.rateLow : TAX.pension.rateHigh);
    return { saved, room: Math.max(0, free - gain), moveBase, move };
  }
  // 대주주 해당 시 양도세(지방세 포함): 과세표준 3억 이하 22%, 초과분 27.5%
  function majorTax(gain) { const g = Math.max(0, gain), cut = TAX.major.rateCut; return Math.min(g, cut) * 0.22 + Math.max(0, g - cut) * 0.275; }

  function buildSignals(c, H, CR) {
    const S = [];
    const total = H.reduce((a, h) => a + h.value, 0) + c.cash;

    // 신용·미수 (가상 신용 원장)
    if (CR && CR.loan > 0 && CR.ratio < CR.warnLine) {
      const drop = Math.max(0, (1 - CR.threshold / CR.ratio) * 100);
      S.push({ type: 'MARGIN', pri: CR.ratio < CR.threshold ? 3 : 2,
        title: `담보유지비율 ${CR.ratio}% · 반대매매 기준 ${CR.threshold}%까지 ${drop.toFixed(1)}% 여유`,
        why: `신용융자 ${won(CR.loan)}. 보유 주식이 ${drop.toFixed(1)}% 더 하락하면 반대매매 대상. 추가 담보 또는 일부 상환 여부 확인 필요.`,
        script: `${c.name} 고객님, 신용 담보비율이 ${CR.ratio}%로 기준(${CR.threshold}%)에 가까워졌어요. 추가 입금과 일부 상환 중 어느 쪽이 편하실까요?`,
        template: null });
    }
    if (CR && CR.receivable > 0) {
      S.push({ type: 'RECEIVABLE', pri: 3,
        title: `미수금 ${won(CR.receivable)} · 변제 마감 ${CR.receivableDue}`,
        why: `미입금 시 ${CR.forced.date} 장 시작 시 ${CR.forced.qty} 반대매매 자동 집행. 올해 미수 ${CR.history.filter(h => h.type === '미수 발생').length}회.`,
        script: `${c.name} 고객님, 결제대금이 ${won(CR.receivable)} 부족해요. 오늘 ${CR.receivableDue.split(' ')[1] || '15:30'}까지 입금이 안 되면 내일 아침 자동 매도되는데, 입금 가능하실까요?`,
        template: null });
    }

    // 자동 감지: 예수금 미운용
    if (c.cash >= 10000000 && c.idle >= 30) {
      const annual = c.cash * (RATES.cma - RATES.deposit) / 100;
      S.push({ type: 'CMA', pri: annual >= 500000 ? 2 : 1, benefit: annual, benefitLabel: `연 +${won(annual)}`,
        title: `예수금 ${won(c.cash)}이 ${c.idle}일째 쉬고 있어요`,
        why: `일반계좌 예탁금 이용료(연 ${RATES.deposit}%)로만 운용 중. CMA 전환 시 연 약 ${won(annual)} 차이.`,
        script: `${c.name} 고객님, 예수금 ${won(c.cash)}이 ${c.idle}일째 그대로예요. CMA로 옮겨두시면 연 ${won(annual)} 정도 이자 차이가 나서 안내드려요.`,
        template: 'cma' });
    }
    // 자동 감지: 급락 / 급등 / 편중
    // 급락 자체는 긴급 아님: 비중 20% 이상이면 '높음', 그 외 '보통'. 손실 확대 위험(담보비율·미수)은 MARGIN/RECEIVABLE 이 긴급으로 따로 잡는다.
    H.filter(h => h.chg <= -7).forEach(h => S.push({ type: 'DROP', pri: h.value / total >= 0.2 ? 2 : 1, stock: h,
      title: `${h.name} ${pct(h.chg)} · 평가손익 ${won(h.pnl)}`,
      why: `보유 비중 ${Math.round(h.value / total * 100)}%. 급락일에는 고객이 먼저 연락하기 전에 상황을 정리해 드리는 것이 신뢰에 유리.`,
      script: `${c.name} 고객님, 오늘 ${h.name}이 ${pct(h.chg)} 움직여 먼저 연락드렸어요. 평가손익은 ${won(h.pnl)}이고, 시장 상황은 정리해서 보내드릴게요.`,
      template: null }));
    H.filter(h => h.chg >= 10).forEach(h => S.push({ type: 'SURGE', pri: 2, stock: h,
      title: `${h.name} ${pct(h.chg)} · 평가손익 ${won(h.pnl)}`,
      why: `보유 비중 ${Math.round(h.value / total * 100)}%. 급등 후 비중 점검·목표 확인 상담 기회.`,
      script: `${c.name} 고객님, ${h.name}이 오늘 ${pct(h.chg)} 올랐어요. 처음 정하신 목표와 비중을 같이 점검해 보시면 어떨까요?`,
      template: null }));
    // 자동 감지: 대주주 양도세 요건 (국내 상장주식, 종목당 보유금액 기준 · ETF 제외)
    H.filter(h => h.mkt === 'KR' && !/ETF/.test(h.sector) && h.value >= TAX.major.watch).forEach(h => {
      const M = TAX.major; const over = h.value >= M.threshold; const gap = M.threshold - h.value; const d = dayDiff(M.lastTradeDate);
      const pctToLine = (M.threshold / h.value - 1) * 100;
      S.push({ type: 'MAJOR', pri: over ? (d <= 30 ? 3 : 2) : 1, stock: h, major: { over, gap, d, pctToLine },
        benefitLabel: over ? `기준 초과 ${won(h.value - M.threshold)}` : `기준까지 ${won(gap)}`,
        title: over ? `${h.name} 보유 ${won(h.value)} · 대주주 기준 ${won(M.threshold)} 초과` : `${h.name} 보유 ${won(h.value)} · 대주주 기준까지 ${won(gap)}`,
        why: over
          ? `연말 기준일(${fmtDate(M.baseDate)} 폐장일) 보유분이 종목당 ${won(M.threshold)} 이상이면 내년 양도차익에 ${M.rateLow}~${M.rateHigh}% 과세. 결제(T+2) 고려 시 ${fmtDate(M.lastTradeDate)} 거래분까지 반영(D-${d}). 기준일 전 보유 금액 점검 필요.`
          : `주가가 ${pctToLine.toFixed(1)}% 오르면 연말 기준일(${fmtDate(M.baseDate)})에 종목당 ${won(M.threshold)} 기준을 넘을 수 있음. 연말까지 보유 금액 모니터링 대상.`,
        script: over
          ? `${c.name} 고객님, ${h.name} 보유액이 ${won(h.value)}이라 대주주 기준(${won(M.threshold)})을 넘어, 내년 양도차익에 ${M.rateLow}~${M.rateHigh}% 과세될 수 있어요. ${fmtDate(M.lastTradeDate)} 거래분까지 반영되니 그 전에 같이 점검해 드릴게요.`
          : `${c.name} 고객님, ${h.name} 보유액이 대주주 기준까지 ${won(gap)} 남았어요. 연말까지 지켜보다가 가까워지면 다시 연락드릴게요.`,
        template: 'major' });
    });
    // 단일 종목 편중(CONC)은 알림/할 일로 띄우지 않음 (사용자 결정 2026-10-29). 분산 관심은 interestsOf 에서 보유 비중으로 직접 반영.

    // 이벤트 기반
    c.events.forEach(e => {
      if (e.t === 'TAX') {
        const us = H.filter(h => h.mkt === 'US');
        if (e.realized > 0) {
          const taxable = Math.max(e.realized - TAX.overseasBasic, 0);
          const unrealLoss = us.filter(h => h.pnl < 0).reduce((a, h) => a + -h.pnl, 0);
          const usable = Math.min(unrealLoss, taxable); const saving = usable * TAX.overseasRate;
          S.push({ type: 'TAX', pri: 2, benefit: saving, benefitLabel: `절세 약 ${won(saving)}`,
            title: `해외주식 실현이익 ${won(e.realized)} · 기본공제 초과 ${won(taxable)}`,
            why: `평가손실 종목(${us.filter(h => h.pnl < 0).map(h => h.name).join(', ')}) ${won(unrealLoss)} 보유. 연내 손익 통산 시 양도세 약 ${won(saving)} 차이.`,
            script: `${c.name} 고객님, 해외주식 실현이익이 기본공제를 ${won(taxable)} 넘었어요. 연내 손익 통산 시 세금이 약 ${won(saving)} 줄 수 있어 설명드리려고요.`,
            template: 'tax' });
        } else {
          const room = TAX.overseasBasic + Math.abs(e.realized);
          const unrealGain = us.filter(h => h.pnl > 0).reduce((a, h) => a + h.pnl, 0);
          const usable = Math.min(unrealGain, room); const saving = usable * TAX.overseasRate;
          S.push({ type: 'TAX', pri: 2, benefit: saving, benefitLabel: `비과세 여유 ${won(room)}`,
            title: `해외주식 실현손실 ${won(e.realized)} · 올해 비과세 여유 ${won(room)}`,
            why: `기본공제 250만원 + 실현손실 통산으로 ${won(room)}까지 이익 실현해도 양도세 없음. 평가이익 ${won(unrealGain)} 보유.`,
            script: `${c.name} 고객님, 올해 해외주식은 ${won(room)}까지 이익을 실현해도 양도세가 없어요. 연말 전에 같이 보시면 좋겠어요.`,
            template: 'tax' });
        }
      }
      if (e.t === 'MATURITY') { const d = dayDiff(e.date); S.push({ type: 'MATURITY', pri: d <= 7 ? 3 : 2, benefit: e.amount, benefitLabel: `${won(e.amount)} 재투자`,
        title: `${e.product} ${won(e.amount)} 만기 D-${d}`,
        why: `만기 자금이 예수금으로 돌아오면 미운용 상태가 됨. 만기 전 재투자 방향 확인 필요.`,
        script: `${c.name} 고객님, ${fmtDate(e.date)}에 ${e.product} ${won(e.amount)}이 만기예요. 만기 전에 다음 운용 방향을 상의드리고 싶어요.`,
        template: 'maturity', date: e.date }); }
      if (e.t === 'LARGE_IN') { const d = -dayDiff(e.date); S.push({ type: 'LARGE_IN', pri: d <= 1 ? 3 : 2, benefit: e.amount, benefitLabel: `${won(e.amount)} 입금`,
        title: `${d === 0 ? '오늘' : d === 1 ? '어제' : fmtDate(e.date)} ${won(e.amount)} 입금 (${e.memo})`,
        why: `평소 거래 규모 대비 이례적 입금. 자금 용도와 기간을 확인하면 적합한 운용 제안 가능.`,
        script: `${c.name} 고객님, ${d === 0 ? '오늘' : '어제'} 큰 금액이 입금되어 연락드렸어요. 쓰실 계획이나 운용 기간이 정해져 있으신가요?`,
        template: 'deposit', amount: e.amount }); }
      if (e.t === 'LARGE_OUT') S.push({ type: 'LARGE_OUT', pri: 3,
        title: `어제 ${won(e.amount)} 출금 (${e.memo})`,
        why: `이탈 징후. 보유 자산의 ${Math.round(e.amount / (total + e.amount) * 100)}%가 타사로 이동. 사유 확인 필요.`,
        script: `${c.name} 고객님, 최근 자금을 옮기신 걸 봤어요. 혹시 불편하셨던 점이 있으면 말씀해 주세요, 바로 챙기겠습니다.`,
        template: null });
      if (e.t === 'ISA_OPEN') S.push({ type: 'ISA_OPEN', pri: 1, benefit: TAX.isa.general * TAX.isa.normalRate, benefitLabel: `수익 200만원당 ${won(TAX.isa.general * TAX.isa.normalRate)} 절세`,
        title: 'ISA 계좌 미보유 · 예수금 ' + won(c.cash) + ' 대기 중',
        why: `ISA로 운용 시 운용수익 200만원까지 비과세(일반계좌라면 15.4% = ${won(TAX.isa.general * TAX.isa.normalRate)}), 초과분 9.9% 분리과세.`,
        script: `${c.name} 고객님, ISA 계좌가 아직 없으셔서요. 일반계좌와 세금 차이가 꽤 나서 안내드리고 싶었어요.`,
        template: 'isa' });
      if (e.t === 'ISA_MATURITY') { const d = dayDiff(e.date); const I = isaCalc(e); S.push({ type: 'ISA_MATURITY', pri: 2, benefit: I.saved + I.move, benefitLabel: `절세 ${won(I.saved)} · 이전 시 +${won(I.move)}`,
        title: `ISA 만기 D-${d} · 운용수익 ${won(e.gain)} 비과세 한도(${e.kind} ${won(e.taxFree)}) 내`,
        why: `일반계좌였다면 세금 ${won(I.saved)}. 만기 자금 ${won(e.balance)}을 연금저축으로 옮기면 ${won(I.moveBase)} 추가 공제로 세액공제 약 ${won(I.move)} 더.`,
        script: `${c.name} 고객님, ISA가 ${fmtDate(e.date)} 만기예요. 지금까지 ${won(I.saved)}을 절세하셨고, 만기 자금을 연금저축으로 옮기시면 세액공제를 약 ${won(I.move)} 더 받으실 수 있어 미리 설명드리려고요.`,
        template: 'isa', date: e.date }); }
      if (e.t === 'ISA_LIMIT') S.push({ type: 'ISA_LIMIT', pri: 1, benefit: isaCalc(e).saved, benefitLabel: `절세 ${won(isaCalc(e).saved)} · 한도 ${won(e.remain)}`,
        title: `ISA 올해 납입 한도 ${won(e.remain)} 남음 · 지금까지 절세 ${won(isaCalc(e).saved)}`,
        why: `누적 운용수익 ${won(e.gain)}(일반계좌라면 세금 ${won(isaCalc(e).saved)}). 비과세 여유 ${won(isaCalc(e).room)}. 연말 납입 패턴이 있어 미리 안내 시 일정 조율 가능.`,
        script: `${c.name} 고객님, ISA 올해 납입 한도가 ${won(e.remain)} 남았어요. 연말 납입 일정 미리 잡아드릴까요?`,
        template: 'isa' });
      if (e.t === 'PENSION') { const P = pensionCalc(e); const room = P.room, credit = P.extra; S.push({ type: 'PENSION', pri: 1, benefit: credit, benefitLabel: `세액공제 +${won(credit)}`,
        title: `${e.product} 올해 납입 ${won(e.paid)} / 공제 한도 ${won(e.limit)}`,
        why: `${P.bracketLabel} → 공제율 ${P.pct}. 지금까지 공제 ${won(P.now)}, 잔여 ${won(room)} 납입 시 ${won(credit)} 더 (최대 ${won(P.max)}). 연말까지 2개월.`,
        script: `${c.name} 고객님, ${e.product} 한도가 ${won(room)} 남았어요. 연말 전에 채우시면 세액공제를 최대 ${won(credit)} 받으실 수 있어요.`,
        template: 'pension' }); }
      if (e.t === 'DORMANT') S.push({ type: 'DORMANT', pri: 1,
        title: `${e.days}일째 거래·접속 없음`,
        why: `마지막 연락 ${fmtDate(c.last)}. 관계 유지 연락 필요. 예수금 ${won(c.cash)} 보유.`,
        script: `${c.name} 고객님, 오랜만에 안부 여쭙니다. 요즘 관심 있으신 부분이나 필요하신 게 있으실까요?`,
        template: null });
      if (e.t === 'ONBOARD') S.push({ type: 'ONBOARD', pri: 1,
        title: `가입 ${-dayDiff(e.joined)}일차 · 첫 매수 후 팔로업`,
        why: `신규 고객의 첫 손실 경험은 이탈로 이어지기 쉬움. 초기 3주 내 1회 이상 접점 권장.`,
        script: `${c.name} 고객님, 가입 3주째인데 불편한 점은 없으셨어요? 첫 투자 종목이 오늘 흔들려서 궁금한 점 여쭤보려고요.`,
        template: null });
      if (e.t === 'BIRTHDAY') S.push({ type: 'BIRTHDAY', pri: 1,
        title: `${fmtDate(e.date)} 생신 (D-${dayDiff(e.date)})`,
        why: `오래 거래해 온 고객. 가족 소개 다수. 짧은 축하 연락만으로도 관계 유지 효과.`,
        script: `${c.name} 고객님, 곧 생신이시죠? 미리 축하드려요.`,
        template: null });
    });
    return S.map(s => ({ ...s, label: LABEL[s.type], cat: CAT[s.type] }));
  }

  /* ---------- 최근 로그 (거래·입출금 기록, 가상) ---------- */
  function buildLogs(c, H) {
    const r = rng(c.id * 7919);
    const L = [];
    H.forEach((h, i) => {
      const d = 10 + Math.floor(r() * 120) + i * 9;
      L.push({ date: daysAgo(d), type: '매수', desc: `${h.name} ${h.qty.toLocaleString()}주 @ ${h.mkt === 'US' ? '$' + h.avg : h.avg.toLocaleString() + '원'}`, amount: -h.cost });
      if (r() > 0.55) L.push({ date: daysAgo(Math.floor(d / 2)), type: '매도', desc: `${h.name} ${Math.max(1, Math.floor(h.qty * 0.2)).toLocaleString()}주`, amount: h.value * 0.2 });
      if (['divETF', 'geumgang', 'bondFund'].includes(h.key) && r() > 0.3) L.push({ date: daysAgo(Math.floor(r() * 60)), type: '입금', desc: `${h.name} ${h.key === 'geumgang' ? '배당금' : '분배금'} 입금`, amount: Math.round(h.value * 0.008) });
    });
    L.push({ date: daysAgo(c.idle), type: '입금', desc: '예수금 입금', amount: Math.round(c.cash * 0.6) });
    c.events.forEach(e => {
      if (e.t === 'LARGE_IN') L.push({ date: e.date, type: '입금', desc: `입금 (${e.memo})`, amount: e.amount });
      if (e.t === 'LARGE_OUT') L.push({ date: e.date, type: '출금', desc: `출금 (${e.memo})`, amount: -e.amount });
      if (e.t === 'PENSION') L.push({ date: daysAgo(40 + Math.floor(r() * 90)), type: '입금', desc: `${e.product} 납입`, amount: e.paid });
    });
    /* 정기 적립 · 생활비 출금 (가상) — 잔고 흐름 그래프에 입출금이 드러나도록 */
    const unit = Math.max(500000, Math.round(c.cash * 0.05 / 100000) * 100000);
    if (r() > 0.4) [25, 55, 85, 115, 145].forEach(d => L.push({ date: daysAgo(d), type: '입금', desc: '정기 적립 입금', amount: unit }));
    if (r() > 0.6 || (c.tags || []).some(t => /출금/.test(t))) [38, 98, 158].forEach(d => L.push({ date: daysAgo(d), type: '출금', desc: '타행 이체 출금', amount: -unit * 2 }));
    return L.sort((a, b) => b.date.localeCompare(a.date));
  }

  /* ---------- 계좌 잔고 흐름 (가상, 최근 180일) ----------
     오늘 총자산에서 거꾸로 계산: 전날 잔고 = (오늘 잔고 − 오늘 입출금) ÷ (1 + 오늘 수익률).
     수익률은 투자성향별 변동성으로 만든 가상 값, 입출금은 거래 로그 그대로. */
  function buildBalance(c, total, invested, logsAll) {
    const r = rng(c.id * 4421);
    const DAYS = 180;
    const vol = { '공격투자형': 0.02, '적극투자형': 0.012, '위험중립형': 0.008 }[c.risk] || 0.004;
    const share = total ? invested / total : 0;
    const flows = {};
    logsAll.filter(l => l.type === '입금' || l.type === '출금').forEach(l => {
      (flows[l.date] = flows[l.date] || []).push({ desc: l.desc, amount: l.amount });
    });
    const pts = [];
    let B = total;
    for (let i = 0; i <= DAYS; i++) {
      const d = daysAgo(i), f = flows[d] || [];
      const net = f.reduce((a, x) => a + x.amount, 0);
      pts.push({ d, v: Math.round(B), flow: net, flows: f });
      const wd = new Date(d).getDay();
      const ret = wd === 0 || wd === 6 ? 0 : ((r() - 0.47) * 2 * vol) * share;
      B = Math.max(total * 0.05, (B - net) / (1 + ret));
    }
    return pts.reverse();
  }

  /* ---------- 귀띔 발송 이력 (가상) ---------- */
  function buildHistory(c) {
    const r = rng(c.id * 104729);
    const H = [];
    if (r() > 0.45) H.push({ date: daysAgo(20 + Math.floor(r() * 40)), template: 'tax', status: r() > 0.3 ? '읽음' : '미확인' });
    if (r() > 0.6) H.push({ date: daysAgo(60 + Math.floor(r() * 40)), template: 'isa', status: '읽음' });
    return H.sort((a, b) => b.date.localeCompare(a.date));
  }

  /* ---------- AI 분석 (규칙 기반 요약; LLM 연동 전 단계) ---------- */
  function buildProfile(c, H) {
    const r = rng(c.id * 31);
    const total = H.reduce((a, h) => a + h.value, 0) + c.cash;
    const bySector = {};
    H.forEach(h => { bySector[h.sector] = (bySector[h.sector] || 0) + h.value; });
    const sectors = Object.entries(bySector).sort((a, b) => b[1] - a[1]).map(([s, v]) => ({ sector: s, weight: v / total }));
    const freq = c.risk === '공격투자형' ? 8 + Math.floor(r() * 8) : c.risk === '적극투자형' ? 4 + Math.floor(r() * 4) : 1 + Math.floor(r() * 2);
    const hold = c.risk === '공격투자형' ? 12 + Math.floor(r() * 30) : c.risk === '적극투자형' ? 40 + Math.floor(r() * 60) : 120 + Math.floor(r() * 200);
    const us = H.filter(h => h.mkt === 'US').reduce((a, h) => a + h.value, 0) / total;
    const cashRatio = c.cash / total;
    const summary = [
      sectors.length ? `${sectors[0].sector}${sectors[1] ? '·' + sectors[1].sector : ''} 중심으로 운용 중인 ${c.risk} 고객.` : `${c.risk} 고객.`,
      `최근 3개월 월평균 ${freq}건 거래, 평균 보유 ${hold}일.`,
      us > 0.3 ? `해외 비중 ${Math.round(us * 100)}%로 환율 민감.` : cashRatio > 0.4 ? `현금 비중 ${Math.round(cashRatio * 100)}%로 투자 대기 자금이 큼.` : `포트폴리오 변동 적음.`,
      `행동 특징: ${c.tags.join(', ')}.`
    ].join(' ');
    return { sectors, freq, hold, usRatio: us, cashRatio, summary };
  }

  /* ---------- 신용·미수·반대매매 (가상 신용 원장) ----------
     loan: 신용융자 잔고, collateral: 담보 평가액(보유주식+예수금), ratio: 담보유지비율(%)
     threshold: 반대매매 기준(140%), warnLine: 주의선(150%)
     receivable: 미수금, forced: 반대매매 예정 내역 */
  const CREDIT_RAW = {
    2:  { loan: 75000000,  maturities: [['SK하이닉스', 45000000, '2026-11-03'], ['LG에너지솔루션', 30000000, '2026-11-18']],
          history: [['2026-10-24', '신용융자 신규', 'SK하이닉스', 45000000, '11.03 만기'], ['2026-09-17', '신용융자 신규', 'LG에너지솔루션', 30000000, '11.18 만기'], ['2026-09-02', '신용융자 상환', '삼성전자', 20000000, '정상 상환']] },
    8:  { loan: 20000000,  maturities: [['알테오젠', 20000000, '2026-12-01']],
          history: [['2026-10-02', '신용융자 신규', '알테오젠', 20000000, '12.01 만기']] },
    12: { loan: 12000000,  maturities: [['크래프톤', 12000000, '2026-11-25']],
          history: [['2026-10-26', '신용융자 신규', '크래프톤', 12000000, '11.25 만기'], ['2026-06-12', '미수 발생', '알테오젠', 1900000, '06.13 변제 완료']] },
    21: { loan: 20000000,  maturities: [['LG에너지솔루션', 20000000, '2026-12-12']],
          history: [['2026-10-13', '신용융자 신규', 'LG에너지솔루션', 20000000, '12.12 만기']] },
    25: { loan: 0, receivable: 2900000, receivableDue: '10.29 15:30', forced: { date: '10.30', qty: '크래프톤 17주 (예상)', est: 2900000 },
          history: [['2026-10-28', '미수 발생', '크래프톤', 2900000, '변제기한 10.29 15:30'], ['2026-07-15', '미수 발생', '알테오젠', 1200000, '07.16 변제 완료'], ['2026-03-04', '미수 발생', 'SK하이닉스', 1400000, '03.05 변제 완료']] },
    29: { loan: 40000000,  maturities: [['HD현대중공업', 40000000, '2026-11-28']],
          history: [['2026-09-29', '신용융자 신규', 'HD현대중공업', 40000000, '11.28 만기']] },
  };
  function buildCredit(c, H) {
    const raw = CREDIT_RAW[c.id] || { loan: 0, history: [] };
    const krStock = H.filter(h => h.mkt === 'KR').reduce((a, h) => a + h.value, 0);
    const collateral = krStock + c.cash;
    const loan = raw.loan || 0;
    const ratio = loan ? Math.round(collateral / loan * 100) : null;
    const threshold = 140, warnLine = 150;
    const maturities = (raw.maturities || []).map(([name, amt, date]) => ({ name, amt, date, d: dayDiff(date) }));
    const history = (raw.history || []).map(([date, type, name, amt, note]) => ({ date, type, name, amt, note }));
    const receivable = raw.receivable || 0;
    const status = receivable > 0 || (ratio != null && ratio < threshold) ? 'crit' : (ratio != null && ratio < warnLine) ? 'warn' : 'ok';
    return { loan, collateral, ratio, threshold, warnLine, maturities, history, receivable,
      receivableDue: raw.receivableDue || null, forced: raw.forced || { date: null, qty: null, est: 0 },
      room: loan ? collateral - loan * threshold / 100 : 0, status };
  }

  /* ---------- 고객 등록 정보 (가상) ----------
     [직업, 거래 시작 연도, 만난 경로(문장형), PB 메모]
     11·30번은 등록 정보 미입력 상태 시연용으로 비워 둠. */
  const INTAKE = {
    1:  ['중학교 교사', 2016, '지점 은퇴설계 세미나에서 만난', '남편과 함께 방문'],
    2:  ['IT기업 개발자', 2019, '직장 동료 소개로 만난', '점심시간에 통화 선호'],
    3:  ['스타트업 마케터', 2021, '앱 비대면 개설 후 PB 배정된', '미국 출장 잦음'],
    4:  ['전직 공무원', 2012, '지점 창구에서 처음 만난', '손주 교육자금 준비 중'],
    5:  ['간호사', 2024, '앱 비대면 개설 후 PB 배정된', '교대 근무, 오후 연락 선호'],
    6:  ['개인사업자 (건축)', 2018, '세무사 소개로 만난', '부동산 매각 후 자금 운용 고민'],
    7:  ['약사', 2015, '지점 연금 세미나에서 만난', '전화 상담 선호'],
    8:  ['제약사 연구원', 2020, '기존 고객 박준호님 소개로 만난', '바이오 임상 뉴스에 민감'],
    9:  ['대기업 사무직', 2022, '사내 재테크 설명회에서 만난', '뉴스레터 꼼꼼히 읽음'],
    10: ['제조업체 임원', 2013, '지점 개설 행사에서 만난', '타사 계좌 병행'],
    12: ['게임 회사 기획자', 2023, '앱 비대면 개설 후 PB 배정된', '야간에 주로 거래'],
    13: ['은퇴 (전 은행원)', 2010, '타사에서 계좌를 옮겨 온', '자녀 둘, 증여 계획'],
    14: ['회계법인 회계사', 2019, '지인 소개로 만난', '리포트 직접 분석'],
    15: ['IT기업 PM', 2020, '해외주식 세미나에서 만난', '실적 발표 시즌 문의 많음'],
    16: ['전업주부', 2017, '남편 계좌 관리로 인연이 닿은', '대면 상담만 선호'],
    17: ['프리랜서 개발자', 2022, '유튜브 투자 강연 후 찾아온', '레버리지 상품 관심'],
    18: ['초등학교 교사', 2018, '사내 연금 설명회에서 만난', '맞벌이, 연말정산 문의'],
    19: ['대학원생', 2026, '앱 비대면 개설 후 PB 배정된', '첫 투자, 커뮤니티 정보 참고'],
    20: ['은퇴 (전 자영업)', 2008, '지점 창구에서 처음 만난', '가족 3명 소개해 줌'],
    21: ['자동차 부품사 과장', 2017, '직장 동료 소개로 만난', '2차전지 장기 보유 고집'],
    22: ['어린이집 원장', 2021, '자녀 계좌 개설로 시작한', '소액 자동이체'],
    23: ['중견기업 부장', 2014, '예금 만기 상담으로 만난', '예금 금리와 늘 비교'],
    24: ['자동차 엔지니어', 2020, '지점 테마 세미나에서 만난', '세금 질문 많음'],
    25: ['전업 투자자', 2021, '타사에서 계좌를 옮겨 온', '목표가 정해두고 매매'],
    26: ['디자이너', 2023, 'ISA 개설 이벤트로 만난', '연말에 몰아서 납입'],
    27: ['퇴직 예정 (공기업)', 2016, '퇴직금 운용 상담으로 만난', '퇴직금 수령 예정'],
    28: ['치과 위생사', 2018, '지인 소개로 만난', '배당 재투자 원칙'],
    29: ['조선소 협력사 대표', 2014, '지역 상공회의소 모임에서 만난', '조선업 업황에 확신'],
    31: ['병원장', 2009, '세무사 소개로 만난', '연말 세무 상담 정례화'],
    32: ['임대업', 2015, '기존 고객 유나영님 소개로 만난', '가족 명의 분산 관심'],
  };
  function buildIntake(c) {
    const r = INTAKE[c.id];
    if (r) return { job: r[0], since: r[1], origin: r[2], memo: r[3] || null, src: '등록 정보' };
    if (c.job) return { job: c.job, since: c.years ? TODAY.getFullYear() - c.years + 1 : null, origin: null, memo: c.memo || null, src: '통화 기록' };
    return null;
  }

  /* ---------- 고객 객체 완성 ---------- */
  const CUSTOMERS = RAW.map(c => {
    const H = valueHoldings(c);
    const invested = H.reduce((a, h) => a + h.value, 0);
    const pnl = H.reduce((a, h) => a + h.pnl, 0);
    const credit = buildCredit(c, H);
    const signals = buildSignals(c, H, credit).sort((a, b) => b.pri - a.pri);
    const dayPnl = H.reduce((a, h) => a + h.value * (h.chg / 100) / (1 + h.chg / 100), 0);
    const logsAll = buildLogs(c, H);
    return { ...c, holdings: H, total: invested + c.cash, invested, pnl, dayPnl, signals, credit,
      pri: signals.length ? Math.max(...signals.map(s => s.pri)) : 0,
      balance: buildBalance(c, invested + c.cash, invested, logsAll), intake: buildIntake(c),
      logs: logsAll.slice(0, 8), history: buildHistory(c), profile: buildProfile(c, H),
      phone: `010-****-${String(1000 + c.id * 137 % 9000).padStart(4, '0')}`,
      initial: c.name[0] };
  });

  /* ---------- 관리 고객 평균 (상세 페이지 투자 스타일 비교용) ---------- */
  const avg = (f) => CUSTOMERS.reduce((a, c) => a + f(c), 0) / CUSTOMERS.length;
  const PEER = { freq: avg(c => c.profile.freq), hold: avg(c => c.profile.hold), usRatio: avg(c => c.profile.usRatio), cashRatio: avg(c => c.profile.cashRatio),
    leverage: avg(c => c.credit.loan / c.total) };

  /* ---------- 오늘 할 일 (고객 1명 = 카드 1장, 신호 여러 개 묶음) ---------- */
  const TODOS = CUSTOMERS.filter(c => c.signals.length)
    .map(c => ({ id: c.id, customer: c, pri: c.pri, main: c.signals[0], signals: c.signals,
      benefit: c.signals.find(s => s.benefitLabel)?.benefitLabel || null,
      cats: [...new Set(c.signals.map(s => s.cat))] }))
    .sort((a, b) => b.pri - a.pri || b.customer.total - a.customer.total);

  /* ---------- 귀띔 템플릿 (카카오톡 귀띔 형식) ----------
     절세 템플릿은 고객 계좌 기준 구체 금액(예상 세금 · 절세액 · 세액공제액)을 본문과 정보 행에 넣는다. */
  const TEMPLATES = {
    cma: { name: '예수금 CMA 전환 안내', emoji: '💤', cat: '자금',
      build: (c) => { const annual = c.cash * (RATES.cma - RATES.deposit) / 100; return {
        title: '쉬고 있는 예수금이 있어요',
        body: `${c.name} 고객님, 계좌의 예수금 ${won(c.cash)}이 ${c.idle}일째 그대로예요.\n\n같은 돈을 CMA 계좌에 두면 연 ${RATES.cma}% 기준으로 1년에 약 ${won(annual)}을 더 받을 수 있어요. 입출금은 지금처럼 자유롭습니다.\n\n담당 PB ${PB.name}이 전환 절차를 도와드릴게요.`,
        info: [['예수금', won(c.cash)], ['미운용 기간', `${c.idle}일`], ['CMA 전환 시 연 추가 이자', `약 ${won(annual)}`]],
        buttons: ['CMA 전환 신청', 'PB에게 문의하기'] }; } },
    tax: { name: '해외주식 양도세 안내', emoji: '🧾', cat: '절세',
      build: (c) => { const e = c.events.find(x => x.t === 'TAX') || { realized: 0 }; const us = c.holdings.filter(h => h.mkt === 'US');
        const loss = us.filter(h => h.pnl < 0).reduce((a, h) => a + -h.pnl, 0), gainU = us.filter(h => h.pnl > 0).reduce((a, h) => a + h.pnl, 0);
        if (e.realized > 0) { const taxable = Math.max(0, e.realized - TAX.overseasBasic); const now = taxable * TAX.overseasRate; const save = Math.min(loss, taxable) * TAX.overseasRate; return {
          title: `해외주식 양도세 약 ${won(now)} 예상돼요`,
          body: `${c.name} 고객님, 올해 해외주식 실현이익은 ${won(e.realized)}이에요.\n\n기본공제 250만원을 빼면 과세 대상이 ${won(taxable)}이라, 이대로면 내년 5월에 양도세 약 ${won(now)}(22%)을 신고·납부하셔야 해요.\n\n${save > 0 ? `현재 평가손실 ${won(loss)}이 있는 종목을 올해 안에 실현하면 손익이 합산되어 세금이 약 ${won(save)} 줄어들어요. 매도 여부는 고객님이 판단하실 부분이고, 12월 결제분까지 올해 기준입니다.` : '같은 해의 이익과 손실은 합산되며, 12월 결제분까지 올해 기준으로 계산돼요.'}`,
          info: [['올해 실현이익', won(e.realized)], ['과세 대상(공제 후)', won(taxable)], ['예상 양도세', won(now)], ['손익 통산 시 절세', save > 0 ? `약 ${won(save)}` : '-']],
          buttons: ['내 양도세 미리보기', 'PB 상담 예약'] }; }
        const room = TAX.overseasBasic + Math.abs(e.realized); const diff = Math.min(room, gainU) * TAX.overseasRate; return {
          title: `올해 ${won(room)}까지 양도세 없이 이익 실현 가능`,
          body: `${c.name} 고객님, 올해 해외주식 실현손익은 ${won(e.realized)}이에요.\n\n기본공제 250만원에 올해 손실까지 더해, ${won(room)}까지는 이익을 실현해도 양도세가 없어요. 이 여유는 올해가 지나면 사라집니다.\n\n현재 해외주식 평가이익 ${won(gainU)} 기준으로, 올해 안에 실현할 때와 내년에 실현할 때 세금이 최대 ${won(diff)}(22%) 차이 나요. 실현 여부는 고객님이 판단하실 부분이고, 12월 결제분까지 올해 기준입니다.`,
          info: [['올해 실현손익', won(e.realized)], ['비과세 여유', won(room)], ['올해 실현 시 세금 차이', `최대 ${won(diff)}`]],
          buttons: ['내 양도세 미리보기', 'PB 상담 예약'] }; } },
    isa: { name: 'ISA 비과세 혜택 안내', emoji: '🌱', cat: '절세',
      build: (c) => { const m = c.events.find(x => x.t === 'ISA_MATURITY'); const l = c.events.find(x => x.t === 'ISA_LIMIT');
        if (m) { const I = isaCalc(m); return {
          title: `ISA로 ${won(I.saved)} 절세하셨어요`,
          body: `${c.name} 고객님, ISA(${m.kind}) 계좌가 ${fmtDate(m.date)} 만기예요.\n\n운용수익 ${won(m.gain)}은 비과세 한도 ${won(m.taxFree)} 안이라 세금이 없어요. 일반계좌였다면 ${won(I.saved)}(15.4%)을 냈을 금액이에요.\n\n만기 자금 ${won(m.balance)}을 60일 안에 연금저축으로 옮기시면, 이전 금액의 10%인 ${won(I.moveBase)}이 추가로 공제되어 세액공제를 약 ${won(I.move)} 더 받으실 수 있어요.`,
          info: [['만기일', `${fmtDate(m.date)} (D-${dayDiff(m.date)})`], ['지금까지 절세', won(I.saved)], ['연금저축 이전 시 추가 공제', `약 ${won(I.move)}`]],
          buttons: ['만기 옵션 보기', 'PB에게 문의하기'] }; }
        if (l) { const I = isaCalc(l); return {
          title: `ISA로 지금까지 ${won(I.saved)} 아끼셨어요`,
          body: `${c.name} 고객님, ISA 누적 운용수익 ${won(l.gain)}에 대한 세금이 없어 일반계좌보다 ${won(I.saved)}을 아끼셨어요.\n\n비과세 한도(${l.kind} ${won(l.taxFree)})까지 ${won(I.room)}이 남아 있고, 올해 납입 한도도 ${won(l.remain)} 남았어요. 남은 한도는 내년으로 이월되지만, 올해 넣으면 비과세로 운용하는 기간이 그만큼 길어집니다.`,
          info: [['지금까지 절세', won(I.saved)], ['비과세 여유', won(I.room)], ['올해 잔여 납입 한도', won(l.remain)]],
          buttons: ['ISA 납입하기', 'PB에게 문의하기'] }; }
        const ex = TAX.isa.general * TAX.isa.normalRate; return {
          title: `같은 수익에 세금 ${won(ex)} 차이`,
          body: `${c.name} 고객님, 일반계좌에서 운용수익 200만원이 나면 세금 ${won(ex)}(15.4%)이 붙어요. ISA 계좌에서는 같은 200만원이 전액 비과세이고, 넘는 부분도 9.9%로 분리과세돼요.\n\n지금 예수금 ${won(c.cash)}이 쉬고 있어요. ISA는 유진투자증권에서 바로 개설할 수 있습니다.`,
          info: [['일반계좌 세금 (수익 200만원)', won(ex)], ['ISA 세금 (수익 200만원)', '0원'], ['대기 중인 예수금', won(c.cash)]],
          buttons: ['ISA 개설하기', 'PB에게 문의하기'] }; } },
    major: { name: '대주주 양도세 기준 안내', emoji: '🏛️', cat: '절세',
      build: (c) => { const s = c.signals.find(x => x.type === 'MAJOR'); const M = TAX.major; const h = s ? s.stock : c.holdings[0]; const over = s ? s.major.over : false; const tx = majorTax(h.pnl); return {
        title: over ? `대주주 해당 시 양도세 약 ${won(tx)}` : '대주주 기준에 가까워지고 있어요',
        body: `${c.name} 고객님, 상장주식은 연말 기준일(${fmtDate(M.baseDate)}) 보유분이 한 종목당 ${won(M.threshold)} 이상이면 다음 해 양도차익에 세금이 붙는 '대주주'가 됩니다. 소액주주는 장내 매도 차익이 비과세예요.\n\n현재 ${h.name} 보유금액은 ${won(h.value)}으로 ${over ? '기준을 넘고 있어요' : `기준까지 ${won(M.threshold - h.value)} 남았어요`}. 지금 평가이익 ${won(Math.max(0, h.pnl))} 기준으로 대주주가 된 뒤 매도하면 양도세가 약 ${won(tx)}(지방세 포함 22~27.5%)이에요. 결제일 기준이라 ${fmtDate(M.lastTradeDate)} 거래분까지 반영됩니다.\n\n보유 계획은 고객님께서 결정하시는 사항이며, 담당 PB ${PB.name}이 기준일 전 보유 금액 점검과 세무 상담 연결을 도와드립니다.`,
        info: [['종목', h.name], ['현재 보유금액', won(h.value)], ['대주주 기준', `종목당 ${won(M.threshold)}`], ['대주주 해당 시 예상 양도세', `약 ${won(tx)}`], ['기준일', `${fmtDate(M.baseDate)} (거래 ${fmtDate(M.lastTradeDate)}까지)`]],
        buttons: ['대주주 기준 자세히', 'PB 상담 예약'] }; } },
    maturity: { name: '만기 도래 안내', emoji: '📅', cat: '자금',
      build: (c) => { const e = c.events.find(x => x.t === 'MATURITY') || { product: '상품', amount: 0, date: '2026-11-30' }; return {
        title: '만기가 다가오고 있어요',
        body: `${c.name} 고객님, 보유하신 ${e.product}이 ${fmtDate(e.date)}에 만기됩니다.\n\n만기 금액 ${won(e.amount)}은 예수금으로 입금되며, 별도 지시가 없으면 그대로 대기하게 돼요.\n\n다음 운용 방향을 담당 PB와 미리 상의해 두시면 자금이 쉬는 기간을 줄일 수 있습니다.`,
        info: [['상품', e.product], ['만기일', `${fmtDate(e.date)} (D-${dayDiff(e.date)})`], ['만기 금액', won(e.amount)]],
        buttons: ['만기 안내 상세', 'PB 상담 예약'] }; } },
    pension: { name: '연금저축 세액공제 안내', emoji: '🏦', cat: '절세',
      build: (c) => { const e = c.events.find(x => x.t === 'PENSION') || { product: '연금저축', paid: 0, limit: 6000000 }; const P = pensionCalc(e); return {
        title: `연말정산에서 ${won(P.extra)} 더 돌려받을 수 있어요`,
        body: `${c.name} 고객님, 연금저축 올해 납입액은 ${won(P.limit - P.room)}이에요. 지금까지 받을 세액공제는 약 ${won(P.now)}입니다.\n\n세액공제 한도 ${won(P.limit)}까지 ${won(P.room)}이 남았어요. 12월 31일까지 채우시면 ${won(P.extra)}을 더 돌려받아, 올해 총 ${won(P.max)}의 세액공제를 받으실 수 있어요. (${P.bracketLabel} 기준 공제율 ${P.pct})`,
        info: [['올해 납입', won(P.limit - P.room)], ['추가 납입 가능', won(P.room)], ['추가 세액공제', `+${won(P.extra)}`], ['올해 최대 세액공제', won(P.max)]],
        buttons: ['추가 납입하기', 'PB에게 문의하기'] }; } },
    deposit: { name: '입금 확인 안내', emoji: '💳', cat: '자금',
      build: (c) => { const e = c.events.find(x => x.t === 'LARGE_IN') || { amount: c.cash, date: daysAgo(0) }; return {
        title: '입금이 확인되었어요',
        body: `${c.name} 고객님, ${fmtDate(e.date)} ${won(e.amount)} 입금이 확인되었습니다.\n\n입금된 자금은 현재 예수금으로 대기 중이에요. 운용 계획이 정해지기 전까지 CMA에 두시면 하루만 맡겨도 이자가 붙습니다.\n\n담당 PB ${PB.name}이 곧 연락드릴게요.`,
        info: [['입금액', won(e.amount)], ['입금일', fmtDate(e.date)], ['현재 상태', '예수금 대기']],
        buttons: ['CMA로 옮기기', 'PB에게 문의하기'] }; } },
  };

  /* ---------- 센터 세미나 · 상품 카탈로그 (시연용 가상) ----------
     개인화 제안의 재료. 실제 상품이 아니며, PB 검토용 후보를 고르는 용도.
     topics: 고객 관심 키워드와 매칭. level/risk: 투자성향 1(안정형)~5(공격투자형). ---------- */
  const RISK_LEVEL = { '안정형': 1, '안정추구형': 2, '위험중립형': 3, '적극투자형': 4, '공격투자형': 5 };
  const SEMINARS = [
    { id: 'sem1', title: '연말 절세 전략: ISA·연금·해외주식 양도세', date: '2026-11-06', time: '19:00', place: '서울WM센터 3층', seats: 24, left: 7, topics: ['절세', '연금', 'ISA', '해외주식', '세액공제'], level: [1, 5] },
    { id: 'sem2', title: 'AI·반도체 밸류체인 점검과 변동성 대응', date: '2026-11-12', time: '18:30', place: '서울WM센터 3층', seats: 30, left: 11, topics: ['반도체', 'AI·소프트웨어', '해외주식', '변동성', '테마'], level: [3, 5] },
    { id: 'sem3', title: '금리 하락기의 채권·배당 포트폴리오', date: '2026-11-14', time: '14:00', place: '서울WM센터 라운지', seats: 20, left: 4, topics: ['채권 ETF', '배당 ETF', '금융', '이자', '안정', '배당'], level: [1, 3] },
    { id: 'sem4', title: '퇴직금·목돈 운용 첫걸음: 분산과 현금흐름', date: '2026-11-19', time: '10:30', place: '서울WM센터 라운지', seats: 16, left: 9, topics: ['목돈', '퇴직', '분산', '현금', '이자', '만기'], level: [1, 3] },
    { id: 'sem5', title: '조선·방산·에너지: 산업 사이클 읽기', date: '2026-11-21', time: '18:30', place: '서울WM센터 3층', seats: 30, left: 18, topics: ['조선', '건설', '철강·소재', '2차전지', '경기민감', '테마'], level: [3, 5] },
    { id: 'sem6', title: '2030 첫 투자 클래스: ISA·적립식 ETF', date: '2026-11-26', time: '19:30', place: '온라인(줌)', seats: 100, left: 62, topics: ['ISA', '적립식', '미국지수 ETF', '첫 투자', '2030'], level: [2, 5] },
    { id: 'sem7', title: '자녀 증여와 가족 자산 설계', date: '2026-12-03', time: '14:00', place: '서울WM센터 라운지', seats: 16, left: 12, topics: ['증여', '가족', '절세'], level: [1, 4] },
  ];
  const PRODUCTS = [
    { id: 'p1', name: 'CMA (RP형)', type: 'CMA', risk: 1, topics: ['현금', '예수금', '이자', '목돈', '만기'], summary: '예수금을 하루만 맡겨도 이자. 입출금 자유.', fit: '예수금 대기 · 만기 자금 임시 보관' },
    { id: 'p2', name: '국내 국공채 ETF 랩', type: '채권', risk: 1, topics: ['채권 ETF', '이자', '안정', '퇴직', '만기'], summary: '국고채 중심, 분기 이자 지급 구조.', fit: '원금 보존 중시 · 이자 수령 목적' },
    { id: 'p3', name: '글로벌 하이일드 채권 펀드', type: '펀드', risk: 3, topics: ['채권 ETF', '이자', '해외주식', '현금'], summary: '월지급식, 환헤지형 선택 가능.', fit: '월 현금흐름 선호 · 해외 분산' },
    { id: 'p4', name: '배당성장 주식형 펀드', type: '펀드', risk: 3, topics: ['배당 ETF', '금융', '배당', '통신'], summary: '배당 성장 종목 중심, 연 2회 분배.', fit: '배당 선호 · 장기 보유' },
    { id: 'p5', name: '지수형 ELS (조기상환형)', type: 'ELS', risk: 3, topics: ['ELS', '만기', '지수'], summary: 'KOSPI200·S&P500 기초, 6개월 조기상환 조건.', fit: 'ELS 반복 투자 · 만기 자금 재투자' },
    { id: 'p6', name: '미국 대표지수 적립식 ETF 플랜', type: 'ETF', risk: 3, topics: ['미국지수 ETF', '적립식', '첫 투자', 'ISA', '2030'], summary: '매월 자동 매수, ISA 계좌 연계 가능.', fit: '적립식 선호 · 첫 투자 · ISA 활용' },
    { id: 'p7', name: 'AI·반도체 테마 ETF 포트폴리오', type: 'ETF', risk: 5, topics: ['반도체', 'AI·소프트웨어', '해외주식', '테마', '분산'], summary: '국내외 반도체·AI 밸류체인 분산 바스켓.', fit: '테마 집중 완화 · 단일 종목 편중 해소' },
    { id: 'p8', name: '조선·방산 산업 ETF', type: 'ETF', risk: 4, topics: ['조선', '건설', '철강·소재', '경기민감', '분산'], summary: '수주 사이클 산업 분산 바스켓.', fit: '산업 확신 고객의 종목 분산' },
    { id: 'p9', name: '연금저축 TDF 2045', type: '연금', risk: 3, topics: ['연금', '절세', '세액공제'], summary: '세액공제 + 생애주기 자동 배분.', fit: '세액공제 한도 미충족 · 연금 자산 관심' },
    { id: 'p10', name: 'ISA 중개형 계좌', type: 'ISA', risk: 2, topics: ['ISA', '절세', '첫 투자', '적립식', '2030'], summary: '운용수익 200만원 비과세, 초과분 9.9% 분리과세.', fit: 'ISA 미보유 · 절세 관심' },
    { id: 'p11', name: '달러 표시 미국 국채 ETF', type: 'ETF', risk: 2, topics: ['해외주식', '채권 ETF', '분산'], summary: '달러 자산 분산, 환율 변동 노출.', fit: '해외 비중 높음 · 환율 민감' },
    { id: 'p12', name: '가족 신탁·증여 설계 서비스', type: '서비스', risk: 1, topics: ['증여', '가족', '절세'], summary: '자녀 계좌 개설, 증여 신고 지원.', fit: '자녀 증여 관심 · 가족 소개 다수' },
  ];

  /* 고객 관심 키워드 추출: 보유 섹터 + 행동 태그 + 이벤트 + 오늘 신호 */
  function interestsOf(c) {
    const I = new Map();
    const add = (k, w, why) => { const cur = I.get(k) || { w: 0, why: [] }; cur.w += w; if (why && !cur.why.includes(why)) cur.why.push(why); I.set(k, cur); };
    c.profile.sectors.forEach(s => add(s.sector, s.weight * 3, `보유 비중 ${Math.round(s.weight * 100)}%`));
    const T = c.tags.join(' ');
    if (/배당/.test(T)) add('배당', 1.5, '행동 태그');
    if (/채권|이자|원금/.test(T)) { add('이자', 1.5, '행동 태그'); add('안정', 1, '행동 태그'); }
    if (/연금|세제|절세|세금|연말정산/.test(T)) { add('절세', 1.5, '행동 태그'); add('연금', 1, '행동 태그'); }
    if (/적립/.test(T)) add('적립식', 1.5, '행동 태그');
    if (/ISA/.test(T)) add('ISA', 1.5, '행동 태그');
    if (/해외|환전/.test(T)) add('해외주식', 1.5, '행동 태그');
    if (/증여|가족/.test(T)) { add('증여', 2, '행동 태그'); add('가족', 1, '행동 태그'); }
    if (/퇴직/.test(T)) { add('퇴직', 2, '행동 태그'); add('목돈', 1.5, '행동 태그'); }
    if (/ELS/.test(T)) add('ELS', 2, '행동 태그');
    if (/사회초년생|첫 투자|신규/.test(T) || c.age < 33) { add('첫 투자', 1, '연령·태그'); add('2030', 1, '연령'); }
    if (/집중|확신|테마/.test(T)) add('테마', 1, '행동 태그');
    if (/경기민감/.test(T)) add('경기민감', 1.5, '행동 태그');
    const big = c.holdings.find(h => c.holdings.length >= 2 && !/ETF/.test(h.sector) && h.value / c.total >= 0.6);
    if (big) { add('분산', 2, `${big.name} 비중 ${Math.round(big.value / c.total * 100)}%`); add('테마', 1, '편중'); }
    if (c.profile.usRatio > 0.3) add('해외주식', 1.5, `해외 비중 ${Math.round(c.profile.usRatio * 100)}%`);
    if (c.profile.cashRatio > 0.3) { add('현금', 2, `현금 비중 ${Math.round(c.profile.cashRatio * 100)}%`); add('목돈', 1, '예수금 규모'); }
    c.events.forEach(e => {
      if (e.t === 'MATURITY') { add('만기', 3, `${e.product} 만기`); add('ELS', 1, '만기 재투자'); }
      if (e.t === 'LARGE_IN') { add('목돈', 3, '대규모 입금'); add('현금', 1, '입금'); add('분산', 1, '입금 자금 운용'); }
      if (e.t === 'TAX') { add('절세', 2, '해외 양도세'); add('해외주식', 1, '해외 양도세'); }
      if (e.t === 'PENSION') { add('연금', 3, '세액공제 한도 미충족'); add('절세', 2, '세액공제'); add('세액공제', 2, '한도 미충족'); }
      if (e.t === 'ISA_OPEN' || e.t === 'ISA_LIMIT' || e.t === 'ISA_MATURITY') { add('ISA', 3, 'ISA 신호'); add('절세', 1, 'ISA'); }
      if (e.t === 'BIRTHDAY') add('가족', 1, '관계 관리');
    });
    c.signals.forEach(s => {
      if (s.type === 'CMA') { add('예수금', 3, `${c.idle}일 미운용`); add('현금', 1, '예수금'); }
      if (s.type === 'DROP') add('변동성', 2, '보유 종목 급락');
      if (s.type === 'MAJOR') { add('절세', 3, '대주주 양도세'); add('증여', 1.5, '지분 분산 상담'); add('분산', 1, '종목 집중'); }
    });
    return [...I.entries()].map(([k, v]) => ({ key: k, w: v.w, why: v.why })).sort((a, b) => b.w - a.w);
  }

  /* 세미나·상품 매칭: 관심 키워드 겹침 × 가중치, 투자성향 범위로 필터 */
  function recommend(c) {
    const interests = interestsOf(c); const lvl = RISK_LEVEL[c.risk];
    const score = (topics) => { const hit = []; let s = 0; topics.forEach(t => { const i = interests.find(x => x.key === t); if (i) { s += i.w; hit.push(i); } }); return { s, hit }; };
    const seminars = SEMINARS.map(sm => { const { s, hit } = score(sm.topics); const okLvl = lvl >= sm.level[0] && lvl <= sm.level[1]; return { ...sm, score: okLvl ? s : s * 0.3, hit, okLvl }; })
      .filter(x => x.score >= 2).sort((a, b) => b.score - a.score).slice(0, 3);   // 약한 매칭(키워드 1개 스침)은 제외
    const products = PRODUCTS.map(p => { const { s, hit } = score(p.topics); const okLvl = p.risk <= lvl; return { ...p, score: okLvl ? s : 0, hit, okLvl }; })
      .filter(x => x.score >= 2.5).sort((a, b) => b.score - a.score).slice(0, 4);
    const timing = [];
    c.events.forEach(e => {
      if (e.t === 'MATURITY') timing.push({ when: `${fmtDate(e.date)} · D-${dayDiff(e.date)}`, what: `${e.product} ${won(e.amount)} 만기`, hint: '만기 전 재투자 방향을 합의하면 자금이 쉬는 기간이 없음' });
      if (e.t === 'LARGE_IN') timing.push({ when: fmtDate(e.date), what: `${won(e.amount)} 입금`, hint: '용도·기간 확인 후 단기 CMA + 분산 제안' });
      if (e.t === 'ISA_MATURITY') timing.push({ when: `${fmtDate(e.date)} · D-${dayDiff(e.date)}`, what: 'ISA 만기', hint: '연장 / 연금계좌 이전 선택지 안내' });
      if (e.t === 'PENSION') timing.push({ when: '12월 말까지', what: `${e.product} 한도 ${won(e.limit - e.paid)} 남음`, hint: '연말정산 전 납입 안내' });
    });
    c.signals.forEach(s => { if (s.type === 'CMA') timing.push({ when: '지금', what: `예수금 ${won(c.cash)} ${c.idle}일 미운용`, hint: 'CMA 전환만으로 ' + s.benefitLabel }); });
    return { interests, seminars, products, timing, level: lvl };
  }

  return { TODAY, FX, MARKET, RATES, PB, STOCKS, CUSTOMERS, TODOS, TEMPLATES, LABEL, CAT, PEER, SEMINARS, PRODUCTS, RISK_LEVEL, recommend, interestsOf, won, wonFull, pct, fmtDate, dayDiff,
    byId: (id) => CUSTOMERS.find(c => c.id === Number(id)) };
})();
