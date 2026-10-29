/* ============================================================
   사이로그 — 통화 기록 · AI 요약 · 준법 감지 · 일정 엔진 (시연용)
   - 통화 전사(transcript)는 가상 고객과의 가상 대화입니다.
   - 요약 · 일정 추출 · 준법 감지는 규칙 기반(LLM/STT 연동 전 단계)으로 동작합니다.
   - 흐름: 통화 종료 → 요약 생성 → 후속 일정 캘린더 자동 등록 → 준법 위험 표현 감지 → PB 알림
   - 로드 순서: data.js → ui.js → calls.js → calendar.js
   ============================================================ */
SAILOG.CALLS = (() => {
  const { TODAY, byId, fmtDate, won, SEMINARS, CUSTOMERS } = SAILOG;
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateOf = (s) => new Date(s + 'T09:00:00+09:00');
  const addDays = (s, n) => { const x = dateOf(s); x.setDate(x.getDate() + n); return iso(x); };
  const lastDay = (y, m) => new Date(y, m + 1, 0).getDate(); // m: 0-based
  const TODAY_ISO = iso(TODAY);
  const WD = '일월화수목금토';

  /* ============================================================
     1. 준법 감지 규칙
        PB 발화만 검사. 각 규칙: 정규식(re) · 심각도(sev 3=위반 소지 높음, 2=주의) · 근거 · 권고 문구
        unless: 해당 표현이 있으면 '경고·설명' 맥락으로 보고 제외 (예: 신용 위험을 설명하는 문장)
     ============================================================ */
  const RULES = [
    { id: 'guarantee', sev: 3, label: '손실보전 · 수익보장', law: '자본시장법 제55조 (손실보전 등의 금지)',
      re: /원금\s*(은|을|이)?\s*(제가|저희가)?\s*(보장|지켜\s*드|책임)|손실\s*(은|이|을)?\s*(나면|나도|나더라도|생기면)?\s*(제가|저희가)?\s*(어떻게든\s*|다\s*)?(보전|메꿔|메워|채워|책임|막아)|수익\s*(은|을)?\s*(보장|약속)|보장\s*(해|돼|된|됩)|확정\s*수익|무조건\s*(이익|수익|먹)/,
      fix: '원금 손실 가능성과 상품 위험등급을 먼저 설명하고, 수익·손실은 어떤 경우에도 보장할 수 없다고 안내하세요.' },
    { id: 'assertive', sev: 3, label: '단정적 판단 제공', law: '자본시장법 제49조 제2호 (부당권유 금지)',
      re: /무조건\s*(더\s*)?(오|올|상승|갑니다|가요|간다)|확실(히|하게)\s*(더\s*)?(오|올|상승|수익|먹|갑니다|가요)|확실해요|확실합니다|틀림\s*없|백\s*퍼(센트)?|100\s*%\s*(오|올|확실|수익)|반드시\s*(오|올|상승)|떨어질\s*(일|리)\s*(은|이)?\s*없|절대\s*(안|못)\s*(떨어|빠)|바닥이에요|바닥입니다|지금이\s*기회/,
      fix: '"가능성이 있다", "시장 전망은 이렇다"처럼 불확실성을 전제로 표현하고, 근거 자료(리서치 리포트)를 함께 안내하세요.' },
    { id: 'insider', sev: 3, label: '미공개 정보 이용 암시', law: '자본시장법 제174조 (미공개중요정보 이용행위 금지)',
      re: /내부(에서|의)?\s*[^.!?]{0,8}?(정보|소식|들었)|아직\s*(공개|발표)\s*(안|되지|전)|여기서만\s*(말씀|알려|드리)|아는\s*사람(들)?\s*(만|한테|끼리)|찌라시|비공개\s*(정보|자료)/,
      fix: '공개된 공시·리서치 자료만 근거로 설명하고, 출처가 불분명한 정보는 언급하지 마세요.' },
    { id: 'discretion', sev: 3, label: '임의 · 일임매매 암시', law: '자본시장법 제71조 · 제98조 (일임매매 제한)',
      re: /제가\s*알아서\s*(사|팔|매매|굴려|넣|빼|해\s*드|할게)|알아서\s*(사고|팔고|매매)|맡겨\s*(만)?\s*주시면\s*(제가|저희가)|제\s*판단으로\s*(사|팔|매매)/,
      fix: '매매는 고객의 명시적 지시로만 실행됩니다. 종목·수량·가격을 고객이 확인한 뒤 주문하도록 안내하세요.' },
    { id: 'leverage', sev: 2, label: '과도한 신용 · 레버리지 권유', law: '자본시장법 제46조 (적합성 원칙) · 제49조',
      re: /신용\s*(을|으로|써서)\s*(더\s*)?(써|쓰|사|늘|들어가|넣)|신용\s*더\s*(써|쓰|사)|빚\s*내서|대출\s*받아서|몰빵|전부\s*(넣|사|들어가|태우)|올인|한\s*종목에\s*다/,
      unless: /반대매매|위험|줄어|주의|권하지|말리|않는\s*게|안\s*하시는|부담/,
      fix: '신용·레버리지는 고객의 투자성향과 담보 여력을 확인한 뒤, 반대매매 위험을 반드시 설명하세요.' },
    { id: 'suitability', sev: 2, label: '적합성 원칙 위반 소지', law: '자본시장법 제46조 (적합성 원칙)',
      re: /성향\s*(은|이)?\s*(상관|무시|신경\s*안)|성향\s*(은|을)?\s*바꾸(면|시면)|설문\s*(은|만)?\s*(대충|그냥|형식)/,
      fix: '투자성향 진단 결과에 맞는 상품만 권유하고, 부적합 상품은 고객 요청 시에도 부적합 확인서를 안내하세요.' },
    { id: 'disclosure', sev: 2, label: '설명의무 생략', law: '자본시장법 제47조 (설명의무)',
      re: /설명서\s*(는|은)?\s*(안|나중|생략|넘어)|서류\s*(는|은)?\s*(나중|대충|형식)|사인만\s*(해|하시)|읽어\s*보실\s*필요\s*(는|가)?\s*없/,
      fix: '핵심설명서·투자설명서의 주요 내용을 설명하고, 고객이 이해했음을 확인한 뒤 진행하세요.' },
    { id: 'gift', sev: 2, label: '부당한 재산상 이익 제공', law: '금융투자업규정 제4-18조',
      re: /현금\s*(으로)?\s*(챙겨|드릴|넣어)|상품권\s*(드릴|챙겨)|리베이트|접대\s*(해|하)|선물\s*(로|을)?\s*(챙겨|넣어)/,
      fix: '고객에게 금전·물품 등 재산상 이익을 제공하는 행위는 금지됩니다.' },
  ];
  const NEG_AFTER = /^\s*(은|는|이|가|을|를|도)?\s*(안|않|없|못|아니|불가|되지|하지|어렵|할\s*수\s*(는|가)?\s*없|해\s*드릴\s*수\s*(는|가)?\s*없|드릴\s*수\s*(는|가)?\s*없|되는\s*건\s*아니)/;
  const NEG_BEFORE = /(안|못|않)\s*$/;

  /** PB 한 문장에서 위험 표현 감지 → [{ rule, label, sev, law, fix, phrases[] }] */
  function checkLine(text) {
    const out = [];
    RULES.forEach(r => {
      if (r.unless && r.unless.test(text)) return;
      const re = new RegExp(r.re.source, 'g');
      const phrases = []; let m;
      while ((m = re.exec(text))) {
        if (!m[0]) { re.lastIndex++; continue; }
        const after = text.slice(m.index + m[0].length, m.index + m[0].length + 10);
        const before = text.slice(Math.max(0, m.index - 6), m.index);
        if (NEG_AFTER.test(after) || NEG_BEFORE.test(before)) continue; // "원금 보장은 안 됩니다" 류 제외
        phrases.push(m[0].trim());
      }
      if (phrases.length) out.push({ rule: r.id, label: r.label, sev: r.sev, law: r.law, fix: r.fix, phrases });
    });
    return out;
  }

  /* ============================================================
     2. 일정 추출 (한국어 날짜·시간 표현 → ISO 날짜)
        기준일(base)은 통화일. 통화일 이전 날짜·"지난 X요일"은 제외.
     ============================================================ */
  const TIME_RE = /(오전|오후|아침|저녁|낮|밤)?\s*(\d{1,2})\s*시\s*(반|(\d{1,2})\s*분)?/;
  function timeOf(s) {
    const m = s.match(TIME_RE); if (!m) return null;
    let h = +m[2]; const ap = m[1];
    if ((ap === '오후' || ap === '저녁' || ap === '밤') && h < 12) h += 12;
    if (!ap && h <= 6) h += 12; // 1~6시는 영업시간 기준 오후로 간주
    const mm = m[3] ? (m[3] === '반' ? 30 : +m[4]) : 0;
    return `${pad(h)}:${pad(mm)}`;
  }
  const clauses = (t) => t.split(/(?<=[.!?])\s+/);
  const clauseAt = (t, idx) => { let p = 0; for (const c of clauses(t)) { if (idx < p + c.length + 1) return c; p += c.length + 1; } return t; };

  function parseWhen(text, base) {
    const out = []; const bd = dateOf(base); const bw = bd.getDay(); const by = bd.getFullYear(), bm = bd.getMonth();
    const thisMon = addDays(base, -((bw + 6) % 7));
    const skipPast = (idx) => /(지난|저번|어제|그제|지지난|전에)\s*$/.test(text.slice(Math.max(0, idx - 5), idx));
    const push = (date, m, approx) => { if (skipPast(m.index)) return; const ctx = clauseAt(text, m.index); out.push({ date, time: timeOf(ctx), expr: m[0].trim(), ctx, approx: !!approx, idx: m.index }); };
    let m, re;
    // 다음 주 화요일 / 이번 주 금요일 / 금요일
    re = /(다다음\s*주|다음\s*주|이번\s*주|담주)?\s*([월화수목금토일])요일/g;
    while ((m = re.exec(text))) {
      if (!m[1] && /\d{1,2}\s*일\s*\(?$/.test(text.slice(Math.max(0, m.index - 8), m.index))) continue; // "11월 19일 목요일" → 날짜 쪽에서 처리
      const wd = WD.indexOf(m[2]); const wk = (m[1] || '').replace(/\s/g, '');
      let date;
      if (wk === '다음주' || wk === '담주') date = addDays(thisMon, 7 + (wd + 6) % 7);
      else if (wk === '다다음주') date = addDays(thisMon, 14 + (wd + 6) % 7);
      else if (wk === '이번주') date = addDays(thisMon, (wd + 6) % 7);
      else { let d = (wd - bw + 7) % 7; if (d === 0) d = 7; date = addDays(base, d); }
      push(date, m);
    }
    // 11월 3일 (연도는 통화일 기준, 연말→연초 넘김 처리)
    re = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
    while ((m = re.exec(text))) { const mo = +m[1] - 1, da = +m[2]; const y = (bm >= 9 && mo <= 2) ? by + 1 : by; push(`${y}-${pad(mo + 1)}-${pad(da)}`, m); }
    // 다음 달 9일 / 이달 31일
    re = /(다음\s*달|내달|이번\s*달|이달)\s*(\d{1,2})\s*일/g;
    while ((m = re.exec(text))) { const next = /다음|내달/.test(m[1]); const d = new Date(by, bm + (next ? 1 : 0), +m[2]); push(iso(d), m); }
    // 다음 달 초 / 11월 중순 (대략)
    re = /(다음\s*달|내달|이번\s*달|이달|(\d{1,2})\s*월)\s*(초|중순|말)(?!일)/g;
    while ((m = re.exec(text))) {
      const mo = m[2] ? +m[2] - 1 : bm + (/다음|내달/.test(m[1]) ? 1 : 0);
      const y = (bm >= 9 && mo <= 2 && !m[2]) ? by + 1 : by; const mm2 = ((mo % 12) + 12) % 12;
      const d = m[3] === '초' ? 5 : m[3] === '중순' ? 15 : lastDay(y, mm2);
      push(`${y}-${pad(mm2 + 1)}-${pad(d)}`, m, true);
    }
    // 오늘 / 내일 / 모레 / 글피 — '오늘'은 시각·마감 표현이 함께 있을 때만 일정으로 (단순 "오늘 ~했어요" 서술 제외)
    re = /(오늘|내일|모레|글피)/g;
    while ((m = re.exec(text))) {
      if (m[1] === '오늘') { const ctx = clauseAt(text, m.index); if (!timeOf(ctx) && !/까지|마감|변제/.test(ctx)) continue; }
      push(addDays(base, ['오늘', '내일', '모레', '글피'].indexOf(m[1])), m);
    }
    // 3일 뒤
    re = /(\d{1,2})\s*일\s*(뒤|후)/g;
    while ((m = re.exec(text))) push(addDays(base, +m[1]), m);
    // "다음 주" 단독 (요일 없음) → 다음 주 월요일, 대략
    re = /(다음\s*주|담주)(?!\s*[월화수목금토일]요일)/g;
    while ((m = re.exec(text))) push(addDays(thisMon, 7), m, true);
    return out.filter(w => w.date >= base || w.expr === '오늘');
  }

  const kindOf = (t) =>
    /생신|생일/.test(t) ? 'birthday'
    : /방문|오시|들르|센터|내방|뵐|뵙|찾아|갈게|가겠|올게/.test(t) ? 'visit'
    : /반대매매|자동\s*매도/.test(t) ? 'deadline'
    : /만기/.test(t) ? 'maturity'
    : /전화|연락|통화/.test(t) ? 'callback'
    : /보내|자료|서류|메일|문자|알림톡|정리해/.test(t) ? 'doc'
    : /까지|마감|변제|입금/.test(t) ? 'deadline'
    : 'followup';
  const titleOf = (kind, ctx) => kind === 'deadline' ? (/반대매매|자동\s*매도/.test(ctx) ? '반대매매 예정' : /입금|변제/.test(ctx) ? '입금 마감' : '마감')
    : ({ visit: '방문 상담', callback: '후속 통화', doc: '자료 발송', maturity: '만기 확인', birthday: '생신', followup: '후속 일정' })[kind];

  /* ============================================================
     3. 통화 분석 (주제 · 요청 · 조치 · 일정 · 준법) → 요약 문장 합성
     ============================================================ */
  const TOPICS = [
    ['신용·담보', /신용|담보|반대매매|만기\s*연장/], ['미수', /미수|변제|결제\s*대금/], ['만기 자금', /만기|ELS|국고채|재투자/],
    ['절세·양도세', /양도세|세금|절세|손익\s*통산|기본공제/], ['연금·세액공제', /연금|세액공제|연말정산/], ['ISA', /ISA/],
    ['예수금·CMA', /예수금|CMA|쉬고/], ['시장 변동', /급락|급등|빠졌|빠지|올랐|변동|조정/], ['분산·리밸런싱', /분산|비중|리밸런싱|포트폴리오|편중/],
    ['이탈 징후', /타사|다른\s*증권사|옮길|옮기|이탈/], ['증여·가족', /증여|자녀|손주|따님|가족/], ['레버리지', /레버리지|빚/],
    ['안부·관계', /안부|생신|생일|오랜만|축하/], ['방문 상담', /방문|오시면|센터|내방/], ['해외주식·환율', /해외|환율|달러|미국/], ['퇴직금·목돈', /퇴직금|목돈|매각\s*대금/],
  ];
  // PB 가 '앞으로 하겠다'고 약속한 표현만 (과거형 "연락드렸어요"는 제외)
  const ACTION_RE = /(드릴게요|드리겠|드릴게|드릴\s*테니|드릴\s*수\s*있어요|보내\s*드리고|잡아\s*둘게|잡아\s*드|준비해\s*둘게|준비할게|만들어\s*볼게|맞춰\s*볼게|확정할게|뵐까요|보여\s*드릴|도와\s*드릴|해\s*둘게)/;
  const REQ_RE = /(해\s*주세요|부탁|알려\s*주|보내\s*주|해\s*주실|주시겠|처리해\s*주|봐\s*주세요|상의하고\s*싶|궁금|어떻게\s*(하는|되는|두는))/;
  const CONCERN_RE = /걱정|불안|손실|손해|빠지는데|떨어|무서|힘들|고민|위험하지/;
  const pick = (t, re) => { const c = clauses(t).find(x => re.test(x)) || t; return c.replace(/^(네|아|그럼|그러면|일단|솔직히)[,，]?\s*/, '').trim(); };
  const short = (s, n = 70) => s.length > n ? s.slice(0, n - 1) + '…' : s;

  function analyze(lines, base, dir) {
    const all = lines.map(l => l.text).join(' ');
    const topics = TOPICS.filter(([, re]) => re.test(all)).map(([t]) => t).slice(0, 4);
    const flags = [];
    lines.forEach((l, i) => { if (l.who === 'PB') checkLine(l.text).forEach(f => flags.push({ ...f, line: i, text: l.text })); });

    // 일정: 날짜별 1건, 시간이 있는 표현 우선. 정확한 날짜가 있으면 '다음 달 초' 같은 대략 표현은 버림
    let found = [];
    lines.forEach((l, i) => parseWhen(l.text, base).forEach(w => found.push({ ...w, who: l.who, line: i })));
    if (found.some(w => !w.approx)) found = found.filter(w => !w.approx);
    const schedule = [];
    found.forEach(w => {
      const kind = kindOf(w.ctx); const item = { date: w.date, time: w.time, kind, title: titleOf(kind, w.ctx), expr: w.expr, ctx: w.ctx, line: w.line };
      const dup = schedule.findIndex(s => s.date === w.date);
      if (dup < 0) schedule.push(item);
      else if (!schedule[dup].time && w.time) schedule[dup] = item;
    });
    schedule.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

    const flaggedLines = new Set(flags.map(f => f.line));
    const actions = [...new Set(lines.filter((l, i) => l.who === 'PB' && !flaggedLines.has(i) && ACTION_RE.test(l.text)).map(l => short(pick(l.text, ACTION_RE))))].slice(0, 4);
    const requests = [...new Set(lines.filter(l => l.who === '고객' && REQ_RE.test(l.text)).map(l => short(pick(l.text, REQ_RE))))].slice(0, 3);
    const concerns = lines.filter(l => l.who === '고객' && CONCERN_RE.test(l.text)).map(l => short(pick(l.text, CONCERN_RE))).slice(0, 2);

    const parts = [];
    parts.push(`${topics.length ? topics.slice(0, 2).join(' · ') : '일반 상담'} 관련 ${dir || '발신'} 통화.`);
    if (concerns.length) parts.push(`고객 우려: ${concerns[0]}`);
    else if (requests.length) parts.push(`고객 요청: ${requests[0]}`);
    if (actions.length) parts.push(`PB 조치: ${actions.slice(0, 2).join(' / ')}`);
    const future = schedule.filter(s => s.date > base || (s.date === base && s.kind !== 'doc'));
    if (future.length) parts.push(`다음 일정: ${future.map(s => `${fmtDate(s.date)}${s.time ? ' ' + s.time : ''} ${s.title}`).join(', ')}.`);
    if (flags.length) parts.push(`⚠ 준법 주의 표현 ${flags.length}건 감지 — 검토 필요.`);
    const summary = parts.join(' ');
    const sev = flags.length ? Math.max(...flags.map(f => f.sev)) : 0;
    return { topics, flags, schedule, actions, requests, concerns, summary, sev };
  }

  /** 전사 줄을 HTML로 (감지된 표현은 <mark>) */
  function highlight(rec, i) {
    const esc = UI.esc; const l = rec.lines[i]; let html = esc(l.text);
    rec.flags.filter(f => f.line === i).forEach(f => f.phrases.forEach(p => { const e = esc(p); html = html.split(e).join(`<mark class="flag-mark sev${f.sev}" title="${esc(f.label)}">${e}</mark>`); }));
    return html;
  }

  /* ============================================================
     4. 통화 기록 — calldata.js (사이로그_PB통화데이터_30건, 시연용 가상 · 정정본)
        meta.record(사이로그 기록: 약속·후속조치) 와 meta.next(다음 연락 예정일)로 일정을 만든다.
     ============================================================ */
  const L = (who, text) => ({ who, text });
  const RAW_CALLS = (typeof window !== 'undefined' && window.SAILOG_CALLDATA && window.SAILOG_CALLDATA.calls) || [];

  /* 기록 문구 → 일정 종류. 약속(고객과 만나거나 연락하기로 한 것) / 할 일(PB가 처리할 것) */
  const kindOfTask = (t) => /미팅|방문|면담/.test(t) ? 'visit'
    : /송부|발송|문자|전달|자료|준비/.test(t) ? 'doc'
    : /연락|전화|통화|안내|리마인드|재확인/.test(t) ? 'callback'
    : 'followup';
  const stripWhen = (t) => t.replace(/^\s*(\d{4}년\s*)?\d{1,2}월\s*(\d{1,2}일|초|중순|말|첫\s*주)?\s*((오전|오후)?\s*\d{1,2}시(\s*반)?)?\s*/, '').trim();

  function fromMeta(r, a) {
    const m = r.meta; const base = r.date; const items = [];
    const note = `${m.subtype} · ${fmtDate(base)} 통화`;
    m.record.split(/\s+\/\s+/).forEach(part => {
      if (!part) return;
      const w = parseWhen(part, base).filter(x => !x.approx)[0];
      let date = w && w.date, time = w ? w.time : null;
      if (!date) {
        if (/(발생|공시|근접|결정)\s*시|시\s*즉시/.test(part)) return;          // 조건부 후속조치 → 날짜 미정
        if (/송부|발송/.test(part) && !/\d{1,2}월/.test(part)) date = base; // 통화 직후 처리
        else if (m.next) date = /전일/.test(part) ? addDays(m.next, -1) : m.next;
        else return;
      }
      items.push({ date, time, kind: kindOfTask(part), title: stripWhen(part) || part, expr: part, ctx: note, line: -1 });
    });
    // 통화 중 잡은 대면 약속(기록 칸에 없는 경우) 보충
    const agreedVisit = (x) => x.kind === 'visit' || (x.line >= 0 && r.lines[x.line + 1] && r.lines[x.line + 1].who === '고객' && /갈게|가서|뵐게|들를게/.test(r.lines[x.line + 1].text));
    a.schedule.filter(x => agreedVisit(x) && !items.some(y => y.date === x.date))
      .forEach(x => items.push({ ...x, kind: 'visit', title: /세미나/.test(x.ctx) ? '세미나 참석' : '방문 상담', ctx: note }));
    const seen = new Set();
    const schedule = items.filter(x => { const k = x.date + x.title; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((x, y) => (x.date + (x.time || '')).localeCompare(y.date + (y.time || '')));
    const summary = `${m.category} · ${m.subtype}${m.product && !/대면 미팅/.test(m.product) ? ` (${m.product})` : ''}. 결과: ${m.result}.`
      + (m.record ? ` 후속: ${m.record}.` : '') + (a.flags.length ? ` ⚠ 준법 주의 표현 ${a.flags.length}건 감지 — 검토 필요.` : '');
    return { schedule, summary, topics: [m.category, m.subtype] };
  }

  /* ============================================================
     5. 통화 중 실시간 전사 시연 (STT 대체) — 고객별 대본. 첫 줄은 오늘 신호의 AI 스크립트.
     ============================================================ */
  const DEMO = {
    2: () => [L('고객', '네, 엔솔이 오늘 많이 빠졌네요. 담보비율은 괜찮은 거죠?'),
      L('PB', '현재 비율은 기준 위지만, 추가로 10% 넘게 빠지면 반대매매 대상이 돼요. 추가 담보나 일부 상환 중 편하신 쪽을 미리 정해두면 좋겠어요.'),
      L('고객', '일단 500만원 정도 입금해 둘게요. 하이닉스 신용 만기 연장도 같이 처리해 주세요.'),
      L('PB', '네, 연장 서류는 제가 준비해 두고, 다음 주 월요일 오전 10시에 다시 전화드릴게요.'),
      L('고객', '좋아요.')],
    17: () => [L('고객', '분산은 알겠는데, AMD가 더 갈 것 같아서요. 지금 팔면 손해 아닐까요?'),
      L('PB', '이 종목은 무조건 더 올라요. 그래도 비중은 줄이는 게 맞아요.'),
      L('고객', '그럼 반만 정리할게요.'),
      L('PB', '분산안은 금요일 오후 4시에 센터에서 보여드릴게요.'),
      L('고객', '네, 그때 갈게요.')],
    25: () => [L('고객', '아, 오늘 오후에 바로 입금할게요.'),
      L('PB', '네, 오늘 3시 반까지 입금되면 정상 처리돼요. 확인되면 문자 드릴게요.'),
      L('고객', '감사합니다.')],
    6: () => [L('고객', '반은 1년 안에 쓸 수도 있고, 나머지는 길게 봐도 돼요.'),
      L('PB', '그럼 단기는 CMA·국공채, 장기는 지수 ETF로 나눈 설계안을 준비할게요. 다음 주 화요일 오후 2시에 센터로 오시면 보여드릴게요.'),
      L('고객', '네, 그날 갈게요.')],
    10: () => [L('고객', '사실 다른 증권사에서 수수료 조건을 제안받았어요. 그래서 일부 옮긴 거예요.'),
      L('PB', '말씀해 주셔서 감사해요. 수수료 비교표는 내일 보내드리고, 다음 주 화요일에 다시 통화해요.'),
      L('고객', '네, 알겠어요.')],
    16: () => [L('고객', '전화로는 잘 모르겠고, 직접 보면서 설명 듣고 싶어요.'),
      L('PB', '그럼 다음 주 수요일 오전 11시에 센터 방문으로 잡아드릴게요. CMA 비교 자료는 미리 준비해 둘게요.'),
      L('고객', '좋아요.')],
    27: () => [L('고객', '네, 퇴직금 오늘 들어왔어요. 내일 센터 가는 건 그대로죠?'),
      L('PB', '네, 내일 오후 2시 그대로예요. 설계안이랑 핵심설명서 준비해 둘게요.'),
      L('고객', '알겠어요.')],
  };
  const GENERIC = () => [L('고객', '네, 설명 감사해요. 자료 보내주시면 보고 결정할게요.'),
    L('PB', '네, 오늘 중으로 자료 보내드리고 다음 주 화요일 오후 2시에 다시 전화드릴게요.'),
    L('고객', '좋아요, 그때 통화해요.')];
  function demoFor(c) {
    const first = c.signals.length ? [L('PB', c.signals[0].script)] : [L('PB', `${c.title || c.name + ' 고객님'}, 안녕하세요. 유진투자증권 조은식 PB입니다. 안부 여쭙고 싶어서 연락드렸어요.`)];
    return first.concat((DEMO[c.id] || GENERIC)());
  }

  /* ============================================================
     6. 저장소 (세션 중 기록된 통화 · 준법 검토 확인 · 수동 일정) — localStorage
     ============================================================ */
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const session = load('sailog.calls', []);
  const acked = new Set(load('sailog.ack', []));
  const manual = load('sailog.events.manual', []);

  const build = (r) => { const c = byId(r.cust); const a = analyze(r.lines, r.date, r.dir); if (r.meta) Object.assign(a, fromMeta(r, a)); return { ...r, customer: c, ...a }; };
  let calls = [...RAW_CALLS, ...session].map(build).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const flagKey = (rec, f) => `${rec.id}:${f.line}:${f.rule}`;

  function record(c, lines, dur, dir = '발신') {
    const now = new Date();
    const r = { id: `c-${Date.now()}`, cust: c.id, date: TODAY_ISO, time: `${pad(now.getHours())}:${pad(now.getMinutes())}`, dur, dir, lines };
    session.push(r); save('sailog.calls', session);
    const rec = build(r); calls = [rec, ...calls]; eventCache = null;
    return rec;
  }

  /* ============================================================
     7. 캘린더 이벤트: 센터 세미나 + 원장(만기·생일·미수) + 통화 기록 + 통화에서 추출된 후속 일정 + 수동 일정
     ============================================================ */
  let eventCache = null;
  function events() {
    if (eventCache) return eventCache;
    const E = [];
    SEMINARS.forEach(s => E.push({ id: 'sem-' + s.id, date: s.date, time: s.time, kind: 'seminar', title: s.title, note: `${s.place} · 잔여 ${s.left}석`, custId: null, source: '센터 일정' }));
    CUSTOMERS.forEach(c => {
      c.events.forEach(e => {
        if (e.t === 'MATURITY') E.push({ id: `mat-${c.id}`, date: e.date, time: null, kind: 'maturity', title: `${c.name} · ${e.product} 만기 ${won(e.amount)}`, note: '만기 자금 예수금 입금 예정', custId: c.id, source: '원장' });
        if (e.t === 'ISA_MATURITY') E.push({ id: `isa-${c.id}`, date: e.date, time: null, kind: 'maturity', title: `${c.name} · ISA 만기`, note: '연장 / 해지 / 연금계좌 이전 선택', custId: c.id, source: '원장' });
        if (e.t === 'BIRTHDAY') E.push({ id: `bd-${c.id}`, date: e.date, time: null, kind: 'birthday', title: `${c.name} 고객 생신`, note: '축하 연락 · 가족 소개 다수', custId: c.id, source: '고객 정보' });
      });
      c.credit.maturities.forEach((m, i) => E.push({ id: `cr-${c.id}-${i}`, date: m.date, time: null, kind: 'maturity', title: `${c.name} · 신용 만기 ${m.name} ${won(m.amt)}`, note: '연장 또는 상환 확인', custId: c.id, source: '신용 원장' }));
      if (c.credit.receivable > 0 && c.credit.receivableDue) {
        const [md, hm] = c.credit.receivableDue.split(' '); const [mo, da] = md.split('.');
        E.push({ id: `rcv-${c.id}`, date: `${TODAY.getFullYear()}-${pad(mo)}-${pad(da)}`, time: hm || null, kind: 'deadline', title: `${c.name} · 미수 변제 마감 ${won(c.credit.receivable)}`, note: `미입금 시 ${c.credit.forced.date} 반대매매`, custId: c.id, source: '신용 원장' });
      }
    });
    calls.forEach(r => {
      const c = r.customer;
      E.push({ id: `call-${r.id}`, date: r.date, time: r.time, kind: 'call', title: `${c.name} 통화 (${r.dir}) · ${r.topics[0] || '상담'}`, note: r.summary, custId: c.id, callId: r.id, source: '통화 기록', sev: r.sev });
      r.schedule.forEach((s, i) => {
        if (s.date === r.date && s.kind === 'doc') return; // 통화 당일 자료 발송은 일정으로 띄우지 않음
        if (['maturity', 'birthday', 'deadline'].includes(s.kind) && E.some(e => e.custId === c.id && e.date === s.date && e.kind === s.kind && !e.callId)) return; // 원장 이벤트와 중복
        E.push({ id: `${r.id}-s${i}`, date: s.date, time: s.time, kind: s.kind, title: `${c.name} · ${s.title}`, note: s.ctx.replace(/^(네|아|그럼|그러면|일단)[,，]?\s*/, '').replace(/^(네|그럼)[,，]?\s*/, ''), custId: c.id, callId: r.id, source: '통화 요약', auto: true });
      });
    });
    manual.forEach(m => E.push({ ...m, kind: m.kind || 'manual', source: '직접 등록', manual: true }));
    // 고객 화면(customer.html)에서 고객이 확정한 상담 시간 → 통화에서 잡힌 원래 약속을 대체
    const cx = load('sailog.cx.appt', null); const cc = cx && byId(cx.custId);
    if (cc) {
      for (let i = E.length - 1; i >= 0; i--) { const e = E[i]; if (e.custId === cc.id && e.auto && (e.kind === 'callback' || e.kind === 'visit') && e.date >= TODAY_ISO) E.splice(i, 1); }
      E.push({ id: 'cx-appt', date: cx.date, time: cx.time, kind: cx.visit ? 'visit' : 'callback', custId: cc.id, source: '고객 확정', confirmed: true,
        title: `${cc.name} · ${cx.topic} ${cx.visit ? '방문 상담' : '전화 상담'}`,
        note: `고객이 알림톡에서 ${cx.changed ? '시간을 바꿔 ' : ''}확정 · ${cx.visit ? '서울WM센터 방문' : '전화 약 20분'} · 1시간 전 알림` });
    }
    E.sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
    return (eventCache = E);
  }
  const eventsOn = (date) => events().filter(e => e.date === date);
  const upcoming = (days = 7, from = TODAY_ISO) => { const to = addDays(from, days); return events().filter(e => e.date >= from && e.date < to && e.kind !== 'call'); };
  function addManual(ev) { const m = { id: `man-${Date.now()}`, ...ev }; manual.push(m); save('sailog.events.manual', manual); eventCache = null; return m; }
  function removeManual(id) { const i = manual.findIndex(m => m.id === id); if (i >= 0) { manual.splice(i, 1); save('sailog.events.manual', manual); eventCache = null; } }

  /* ---------- 준법 알림 (PB 확인 전 건) ---------- */
  function flags({ unackedOnly = false, custId = null } = {}) {
    const out = [];
    calls.forEach(r => { if (custId && r.cust !== custId) return; r.flags.forEach(f => { const key = flagKey(r, f); if (unackedOnly && acked.has(key)) return; out.push({ ...f, key, call: r, customer: r.customer, acked: acked.has(key) }); }); });
    return out;
  }
  function ack(key) { acked.add(key); save('sailog.ack', [...acked]); }

  const refresh = () => { eventCache = null; };            // 다른 화면(고객 화면 등)이 저장소를 바꿨을 때
  const customerAppt = () => load('sailog.cx.appt', null);
  return { TODAY_ISO, RULES, checkLine, analyze, parseWhen, highlight, demoFor, record, refresh, customerAppt,
    list: () => calls, byId: (id) => calls.find(r => r.id === id), forCustomer: (id) => calls.filter(r => r.cust === Number(id)),
    events, eventsOn, upcoming, addManual, removeManual, flags, ack, isAcked: (k) => acked.has(k), flagKey, addDays };
})();
