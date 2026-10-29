/* 사이로그 — AI 펀드 매칭 (고객 상세 페이지용)
   '분석하기' → 분석중 팝업 → 판매 공모펀드 유니버스에서 고객에게 맞는 상위 5개를 보여준다.
   사용: openDetail 안에서 SAILOG_FUND.html(c) 를 dt-grid 에 끼워 넣으면 끝. 버튼은 이벤트 위임.
   ※ 펀드 목록은 시연용 가상 데이터. 실제 판매 펀드 목록으로 바꾸려면 FUNDS 배열만 교체하면 된다.
   ※ 투자 권유가 아닌 PB 검토 후보. 실제 제안은 적합성·설명의무 이행 후. */
window.SAILOG_FUND = (() => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* 위험등급: 금융투자협회 6등급 체계 (1 매우높은위험 ~ 6 매우낮은위험)
     ex: 노출 자산(포트폴리오 보완도 계산용) KR_EQ 국내주식 · OS_EQ 해외주식 · BOND 채권 · CASH 현금성 · MIX 혼합
     tags: 단기(만기·대기자금), 월지급(현금흐름), 분산(편중 완화), 인덱스(저비용) */
  const GRADE = { 1: '매우높은위험', 2: '높은위험', 3: '다소높은위험', 4: '보통위험', 5: '낮은위험', 6: '매우낮은위험' };
  const FUNDS = [
    { id: 'f01', name: '스마트 머니마켓 펀드', cls: 'C-e', type: 'MMF', grade: 6, fee: 0.12, r1: 3.1, r3: 3.4, ex: 'CASH', pension: false, isa: true, tags: ['단기'], topics: ['현금', '예수금', '목돈', '만기'] },
    { id: 'f02', name: '초단기채 증권투자신탁', cls: 'C-e', type: '채권형', grade: 6, fee: 0.18, r1: 3.6, r3: 3.9, ex: 'BOND', pension: true, isa: true, tags: ['단기'], topics: ['현금', '예수금', '만기', '목돈', '안정'] },
    { id: 'f03', name: '국공채 인덱스 증권투자신탁', cls: 'C-e', type: '채권형', grade: 6, fee: 0.15, r1: 4.2, r3: 3.1, ex: 'BOND', pension: true, isa: true, tags: ['인덱스'], topics: ['채권 ETF', '이자', '안정', '퇴직'] },
    { id: 'f04', name: '단기 통안채 증권투자신탁', cls: 'A', type: '채권형', grade: 6, fee: 0.22, r1: 3.4, r3: 3.5, ex: 'BOND', pension: true, isa: true, tags: ['단기'], topics: ['만기', '현금', '안정'] },
    { id: 'f05', name: '월지급 국공채 증권투자신탁', cls: 'C-e', type: '채권형', grade: 6, fee: 0.25, r1: 4.0, r3: 3.0, ex: 'BOND', pension: true, isa: true, tags: ['월지급'], topics: ['이자', '안정', '퇴직', '채권 ETF'] },
    { id: 'f06', name: '우량 회사채 액티브 증권투자신탁', cls: 'C-e', type: '채권형', grade: 5, fee: 0.32, r1: 4.9, r3: 3.8, ex: 'BOND', pension: true, isa: true, tags: [], topics: ['이자', '채권 ETF', '안정', '금융'] },
    { id: 'f07', name: '글로벌 투자등급채권 (환헤지)', cls: 'C-e', type: '해외채권형', grade: 5, fee: 0.45, r1: 4.6, r3: 1.9, ex: 'BOND', pension: true, isa: true, tags: ['분산'], topics: ['해외주식', '채권 ETF', '이자', '분산'] },
    { id: 'f08', name: '미국 단기국채 (달러·환노출)', cls: 'C-e', type: '해외채권형', grade: 5, fee: 0.28, r1: 5.2, r3: 4.4, ex: 'BOND', pension: true, isa: true, tags: ['단기', '분산'], topics: ['해외주식', '현금', '분산', '만기'] },
    { id: 'f09', name: '채권혼합 배당인컴 증권투자신탁', cls: 'C-e', type: '채권혼합형', grade: 5, fee: 0.55, r1: 6.1, r3: 4.2, ex: 'MIX', pension: true, isa: true, tags: ['월지급'], topics: ['배당', '이자', '배당 ETF', '퇴직', '안정'] },
    { id: 'f10', name: '연금 인컴 TIF (은퇴소득형)', cls: 'C-P', type: '혼합자산', grade: 5, fee: 0.48, r1: 5.4, r3: 3.6, ex: 'MIX', pension: true, isa: false, tags: ['월지급'], topics: ['연금', '절세', '세액공제', '퇴직', '이자'] },
    { id: 'f11', name: 'TDF 2035 (생애주기 자동배분)', cls: 'C-P', type: '혼합자산', grade: 4, fee: 0.62, r1: 9.8, r3: 6.1, ex: 'MIX', pension: true, isa: true, tags: ['분산'], topics: ['연금', '절세', '세액공제', '분산', '퇴직'] },
    { id: 'f12', name: 'TDF 2050 (생애주기 자동배분)', cls: 'C-P', type: '혼합자산', grade: 4, fee: 0.66, r1: 14.2, r3: 8.3, ex: 'MIX', pension: true, isa: true, tags: ['분산'], topics: ['연금', '절세', '세액공제', '적립식', '2030', '분산'] },
    { id: 'f13', name: '글로벌 멀티인컴 월지급 (주식혼합)', cls: 'C-e', type: '주식혼합형', grade: 4, fee: 0.72, r1: 8.6, r3: 5.0, ex: 'MIX', pension: true, isa: true, tags: ['월지급', '분산'], topics: ['배당', '이자', '해외주식', '분산', '배당 ETF'] },
    { id: 'f14', name: '공모주 하이일드 채권혼합', cls: 'C-e', type: '채권혼합형', grade: 4, fee: 0.58, r1: 6.9, r3: 4.8, ex: 'MIX', pension: false, isa: true, tags: [], topics: ['이자', '테마', '목돈'] },
    { id: 'f15', name: '글로벌 하이일드 채권 (환헤지)', cls: 'C-e', type: '해외채권형', grade: 3, fee: 0.68, r1: 8.1, r3: 4.5, ex: 'BOND', pension: true, isa: true, tags: ['월지급'], topics: ['이자', '해외주식', '채권 ETF'] },
    { id: 'f16', name: '코리아 배당성장 증권투자신탁(주식)', cls: 'C-e', type: '국내주식형', grade: 3, fee: 0.78, r1: 18.4, r3: 9.2, ex: 'KR_EQ', pension: true, isa: true, tags: [], topics: ['배당', '배당 ETF', '금융', '통신', '식품'] },
    { id: 'f17', name: '미국 S&P500 인덱스 증권투자신탁', cls: 'C-e', type: '해외주식형', grade: 3, fee: 0.25, r1: 16.8, r3: 12.9, ex: 'OS_EQ', pension: true, isa: true, tags: ['인덱스', '분산'], topics: ['미국지수 ETF', '해외주식', '적립식', '첫 투자', 'ISA', '2030', '분산'] },
    { id: 'f18', name: '글로벌 분산 주식 인덱스 (MSCI ACWI)', cls: 'C-e', type: '해외주식형', grade: 3, fee: 0.30, r1: 14.1, r3: 10.2, ex: 'OS_EQ', pension: true, isa: true, tags: ['인덱스', '분산'], topics: ['분산', '해외주식', '적립식', '미국지수 ETF'] },
    { id: 'f19', name: '코리아 대표지수 인덱스 (KOSPI200)', cls: 'C-e', type: '국내주식형', grade: 3, fee: 0.20, r1: 21.5, r3: 7.4, ex: 'KR_EQ', pension: true, isa: true, tags: ['인덱스', '분산'], topics: ['분산', '적립식', '첫 투자', '금융'] },
    { id: 'f20', name: '미국 나스닥100 인덱스 증권투자신탁', cls: 'C-e', type: '해외주식형', grade: 2, fee: 0.28, r1: 22.7, r3: 16.0, ex: 'OS_EQ', pension: true, isa: true, tags: ['인덱스'], topics: ['AI·소프트웨어', '해외주식', '반도체', '전기차', '미국지수 ETF'] },
    { id: 'f21', name: '글로벌 헬스케어·바이오 증권투자신탁', cls: 'C-e', type: '해외주식형', grade: 2, fee: 0.85, r1: 6.2, r3: 3.9, ex: 'OS_EQ', pension: true, isa: true, tags: ['분산'], topics: ['바이오', '헬스케어', '분산'] },
    { id: 'f22', name: '글로벌 에너지전환·인프라', cls: 'C-e', type: '해외주식형', grade: 2, fee: 0.82, r1: 11.3, r3: 5.6, ex: 'OS_EQ', pension: true, isa: true, tags: ['분산'], topics: ['2차전지', '전기차', '경기민감', '건설', '분산'] },
    { id: 'f23', name: '코리아 조선·방산·기계 증권투자신탁', cls: 'C-e', type: '국내주식형', grade: 2, fee: 0.88, r1: 41.2, r3: 19.8, ex: 'KR_EQ', pension: true, isa: true, tags: ['분산'], topics: ['조선', '건설', '철강·소재', '경기민감', '우주항공', '분산'] },
    { id: 'f24', name: '글로벌 반도체 밸류체인 액티브', cls: 'C-e', type: '해외주식형', grade: 1, fee: 0.92, r1: 38.6, r3: 21.4, ex: 'OS_EQ', pension: true, isa: true, tags: ['분산'], topics: ['반도체', 'AI·소프트웨어', '해외주식', '테마', '분산'] },
    { id: 'f25', name: '글로벌 AI·로보틱스 증권투자신탁', cls: 'C-e', type: '해외주식형', grade: 1, fee: 0.95, r1: 27.9, r3: 14.6, ex: 'OS_EQ', pension: true, isa: true, tags: ['분산'], topics: ['AI·소프트웨어', '로봇', '우주항공', '테마', '해외주식'] },
    { id: 'f26', name: '2차전지 밸류체인 증권투자신탁', cls: 'C-e', type: '국내주식형', grade: 1, fee: 0.90, r1: -8.4, r3: -6.2, ex: 'KR_EQ', pension: true, isa: true, tags: [], topics: ['2차전지', '전기차', '철강·소재', '테마'] },
    { id: 'f27', name: '코리아 중소형 성장주 증권투자신탁', cls: 'C-e', type: '국내주식형', grade: 1, fee: 0.98, r1: 15.7, r3: 4.1, ex: 'KR_EQ', pension: true, isa: true, tags: [], topics: ['게임', '바이오', '로봇', '테마'] },
  ];
  const UNIVERSE = FUNDS;   // 매칭 대상: 판매 공모펀드
  /* 투자성향별 가입 가능 최고 위험등급 (적합성 원칙) */
  const MAX_GRADE = { 1: 6, 2: 5, 3: 4, 4: 2, 5: 1 };

  /* ---------- 매칭 엔진 ----------
     하드 필터: 투자성향 적합성(위험등급). 점수 = 관심 키워드 35 · 포트폴리오 보완 25 · 성향 적합도 15 · 지금 필요 15 · 비용 10 */
  function exposure(c) {
    const T = c.total || 1, E = { KR_EQ: 0, OS_EQ: 0, BOND: 0, CASH: c.cash / T, MIX: 0 };
    c.holdings.forEach(h => { const w = h.value / T; if (/채권/.test(h.sector)) E.BOND += w; else if (h.mkt === 'US' || /미국/.test(h.sector)) E.OS_EQ += w; else E.KR_EQ += w; });
    return E;
  }
  function analyze(c) {
    const S = SAILOG; const lvl = S.RISK_LEVEL[c.risk] || 3; const maxG = MAX_GRADE[lvl];
    const I = S.interestsOf(c); const iw = (k) => (I.find(x => x.key === k) || {}).w || 0;
    const E = exposure(c); const sig = (t) => c.signals.some(s => s.type === t); const ev = (t) => c.events.some(e => e.t === t);
    const topSector = c.profile.sectors[0];
    const needShort = ev('MATURITY') || ev('LARGE_IN') || sig('CMA');
    const needPension = ev('PENSION') || /연금|퇴직/.test(c.tags.join(' '));
    const needISA = ev('ISA_OPEN') || ev('ISA_LIMIT') || ev('ISA_MATURITY') || /ISA/.test(c.tags.join(' '));
    const needDiv = sig('MAJOR') || (topSector && topSector.weight >= 0.45);
    const needIncome = /배당|이자|채권|원금/.test(c.tags.join(' ')) || c.age >= 60;

    const eligible = UNIVERSE.filter(f => f.grade >= maxG);
    const raw = eligible.map(f => {
      const hits = f.topics.map(t => ({ key: t, w: iw(t) })).filter(h => h.w > 0).sort((a, b) => b.w - a.w);
      const kw = hits.reduce((a, h) => a + h.w, 0);
      const under = f.ex === 'MIX' ? 0.5 : Math.max(0, 1 - (E[f.ex] || 0) / 0.3);         // 지금 비중이 낮은 자산일수록 보완 효과
      let comp = under * 0.7 + (needDiv && f.tags.includes('분산') ? 0.3 : 0);
      if (needDiv && topSector && f.topics.includes(topSector.sector)) comp *= f.tags.includes('분산') ? 0.6 : 0.3; // 이미 몰린 섹터에 또 집중시키지 않음
      const fit = 1 - Math.abs((f.grade - maxG) - 1) / 5;                                 // 성향 상한보다 한 단계 아래가 가장 편안
      let need = 0; const why = [];
      if (needShort && f.tags.includes('단기')) { need += 0.6; why.push('만기·대기 자금의 단기 운용처'); }
      if (needPension && f.pension && /연금|TDF|TIF/.test(f.name + f.type + f.topics.join())) { need += 0.5; why.push('연금계좌 편입 가능 · 세액공제'); }
      if (needISA && f.isa) { need += 0.2; }
      if (needIncome && f.tags.includes('월지급')) { need += 0.4; why.push('월 분배로 현금흐름 확보'); }
      need = Math.min(1, need);
      const cost = Math.max(0, 1 - f.fee / 1.0);
      return { f, hits, kw, comp: Math.min(1, comp), fit: Math.max(0, fit), need, cost, needWhy: why };
    });
    const kmax = Math.max(1, ...raw.map(r => r.kw));
    raw.forEach(r => {
      r.kwN = Math.min(1, r.kw / kmax);
      r.score = 35 * r.kwN + 25 * r.comp + 15 * r.fit + 15 * r.need + 10 * r.cost;
    });
    raw.sort((a, b) => b.score - a.score);
    const picked = [], perType = {};
    for (const r of raw) {
      const ty = r.f.type;
      if ((perType[ty] || 0) >= 2) continue;   // 같은 유형(예: 해외채권형) 최대 2개
      perType[ty] = (perType[ty] || 0) + 1; picked.push(r); if (picked.length === 5) break;
    }
    for (const r of raw) { if (picked.length >= 5) break; if (!picked.includes(r)) picked.push(r); }   // 적합 펀드가 적으면 유형 제한 없이 채움
    picked.sort((a, b) => b.score - a.score);
    const top = picked.map((r, i) => {
      const reasons = [];
      if (r.hits.length) reasons.push(`관심 분야 일치: ${r.hits.slice(0, 3).map(h => h.key).join(' · ')}`);
      const sameSector = topSector && r.f.topics.includes(topSector.sector);
      if (r.comp >= 0.6) reasons.push(r.f.ex === 'BOND' ? `채권 비중 ${Math.round(E.BOND * 100)}% → 안정 자산 보완` : r.f.ex === 'OS_EQ' ? `해외 비중 ${Math.round(E.OS_EQ * 100)}% → 지역 분산` : r.f.ex === 'KR_EQ' ? `국내주식 비중 ${Math.round(E.KR_EQ * 100)}% → 자산 보완` : r.f.ex === 'CASH' ? '현금성 자산 보완' : '자산군 분산');
      if (needDiv && sameSector && r.f.tags.includes('분산')) reasons.push(`${topSector.sector} 관심은 유지하며 개별 종목 대신 바스켓으로 분산`);
      else if (needDiv && r.f.tags.includes('분산') || needDiv && r.comp >= 0.6) reasons.push(`${topSector ? topSector.sector + ' ' + Math.round(topSector.weight * 100) + '% ' : ''}편중 완화`);
      reasons.push(...r.needWhy);
      if (r.f.fee <= 0.3) reasons.push(`총보수 연 ${r.f.fee.toFixed(2)}% 저비용`);
      return { ...r, rank: i + 1, match: Math.round(Math.min(98, 55 + r.score * 0.45)), reasons: reasons.slice(0, 3) };
    });
    return { lvl, maxG, eligible: eligible.length, total: UNIVERSE.length, exposure: E, top, at: new Date(), keywords: I.slice(0, 5).map(i => i.key) };
  }

  /* ---------- 화면 ---------- */
  const CSS = `
  .fd-head-btn { margin-left: auto; }
  [id^="fd-block-"] { scroll-margin-top: 84px; }
  .fd-intro { display: flex; align-items: center; gap: 16px; padding: 18px; border-radius: 14px; background: var(--surface2); }
  .fd-intro .ic { flex: none; width: 44px; height: 44px; border-radius: 12px; background: var(--brand-tint); color: var(--brand); display: grid; place-items: center; font-size: 22px; }
  .fd-intro p { font-size: 13px; color: var(--fg2); line-height: 1.55; margin: 0; }
  .fd-intro b { color: var(--fg); }
  .fd-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; color: var(--fg3); margin-bottom: 12px; }
  .fd-meta b { color: var(--fg2); font-weight: 600; }
  .fd-when { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; font-size: 12px; color: var(--fg3); margin-bottom: 12px; }
  .fd-when b { color: var(--fg2); font-weight: 600; }
  .fd-when-t { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px; border-radius: 8px; background: var(--surface2); color: var(--fg2); font-size: 12.5px; }
  .fd-when-t b { color: var(--fg); font-weight: 700; }
  .fd-stale { font-size: 12.5px; font-weight: 600; color: var(--amber); background: var(--amber-tint); border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; }
  .fd-desc { font-size: 13px; color: var(--fg2); line-height: 1.5; }
  .fd-sent { font-size: 11.5px; font-weight: 600; color: var(--green); white-space: nowrap; }
  .fd-send { width: min(900px, 100%); max-height: calc(100vh - 32px); overflow: auto; background: var(--surface); border-radius: 22px; box-shadow: 0 24px 60px rgba(0,0,0,.25); display: grid; grid-template-columns: minmax(0, 1fr) 360px; text-align: left; }
  .fd-send-l { padding: 24px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .fd-send h4 { font-size: 19px; font-weight: 800; margin: 0; }
  .fd-send-s { font-size: 13px; color: var(--fg3); margin: 4px 0 0; }
  .fd-to { display: flex; gap: 10px; align-items: center; padding: 12px 14px; border-radius: 12px; background: var(--surface2); font-size: 14px; }
  .fd-to small { display: block; font-size: 12px; color: var(--fg3); margin-top: 1px; }
  .fd-to-f { border: 1px solid var(--line); background: var(--surface); }
  .fd-lbl { display: block; font-size: 12px; font-weight: 700; color: var(--fg3); margin-bottom: 8px; }
  .fd-lbl small { font-weight: 500; }
  .fd-chk { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; font-size: 13px; font-weight: 600; }
  .fd-chk li { display: grid; grid-template-columns: 20px 1fr; gap: 9px; }
  .fd-chk i { width: 20px; height: 20px; border-radius: 50%; background: var(--green-tint); color: var(--green); font-style: normal; font-size: 11px; font-weight: 800; display: grid; place-items: center; }
  .fd-chk li.bad i { background: var(--brand-tint); color: var(--brand); }
  .fd-chk small { display: block; font-weight: 400; font-size: 12px; color: var(--fg3); margin-top: 1px; }
  .fd-memo textarea { width: 100%; resize: vertical; border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px; font-size: 13px; line-height: 1.5; background: var(--surface); }
  .fd-memo textarea:focus { outline: 2px solid var(--brand); outline-offset: 1px; }
  .fd-prev { font-size: 12.5px; color: var(--amber); background: var(--amber-tint); border-radius: 10px; padding: 8px 12px; font-weight: 600; }
  .fd-send-act { display: flex; gap: 8px; margin-top: auto; }
  .fd-send-r { background: var(--surface2); padding: 18px; display: flex; flex-direction: column; align-items: center; gap: 10px; border-radius: 0 22px 22px 0; }
  .fd-prev-lbl { font-size: 12px; font-weight: 700; color: var(--fg3); }
  .fd-phone .phone { width: 300px; }
  @media (max-width: 820px) { .fd-send { grid-template-columns: 1fr; } .fd-send-r { border-radius: 0 0 22px 22px; } }
  .fd-list { display: flex; flex-direction: column; gap: 10px; }
  .fd-item { display: grid; grid-template-columns: 36px 1fr auto; gap: 14px; align-items: start; padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; opacity: 0; transform: translateY(8px); animation: fd-in .45s ease forwards; }
  .fd-item.added { border-color: var(--green); background: var(--green-tint); }
  .fd-rank { width: 36px; height: 36px; border-radius: 11px; background: var(--surface2); display: grid; place-items: center; font-weight: 800; font-size: 15px; color: var(--fg2); }
  .fd-item:first-child .fd-rank { background: var(--brand); color: #fff; }
  .fd-body { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .fd-name { font-weight: 700; font-size: 15px; line-height: 1.35; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .fd-name small { font-weight: 500; color: var(--fg3); font-size: 12px; }
  .fd-tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .fd-tags span { font-size: 11px; padding: 2px 7px; border-radius: 6px; background: var(--surface2); color: var(--fg2); }
  .fd-tags .g { background: var(--gray-tint); }
  .fd-tags .g1, .fd-tags .g2 { background: var(--brand-tint); color: var(--brand); }
  .fd-tags .g3, .fd-tags .g4 { background: var(--amber-tint); color: var(--amber); }
  .fd-tags .g5, .fd-tags .g6 { background: var(--green-tint); color: var(--green); }
  .fd-why { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 3px; font-size: 12.5px; color: var(--fg2); }
  .fd-why li::before { content: '✓'; color: var(--brand); font-weight: 700; margin-right: 6px; }
  .fd-nums { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--fg3); }
  .fd-nums b { color: var(--fg2); font-weight: 600; font-variant-numeric: tabular-nums; }
  .fd-side { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
  .fd-match { text-align: right; }
  .fd-match b { display: block; font-size: 22px; font-weight: 800; color: var(--brand); font-variant-numeric: tabular-nums; line-height: 1; }
  .fd-match span { font-size: 11px; color: var(--fg3); }
  .fd-bar { width: 84px; height: 5px; border-radius: 3px; background: var(--surface2); overflow: hidden; }
  .fd-bar i { display: block; height: 100%; background: var(--brand); border-radius: 3px; }
  .fd-note { font-size: 11.5px; color: var(--fg3); line-height: 1.5; margin-top: 12px; }
  @keyframes fd-in { to { opacity: 1; transform: none; } }

  .fd-ov { position: fixed; inset: 0; z-index: 200; background: rgba(15, 15, 20, .45); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 16px; animation: fd-fade .2s ease; }
  .fd-pop { width: min(420px, 100%); background: var(--surface); border-radius: 22px; box-shadow: 0 24px 60px rgba(0,0,0,.25); padding: 28px 26px 24px; text-align: center; }
  .fd-spin { width: 64px; height: 64px; margin: 0 auto 16px; position: relative; }
  .fd-spin::before, .fd-spin::after { content: ''; position: absolute; inset: 0; border-radius: 50%; border: 4px solid var(--brand-tint); }
  .fd-spin::after { border-color: var(--brand) transparent transparent transparent; animation: fd-rot .9s linear infinite; }
  .fd-spin span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 13px; font-weight: 800; color: var(--brand); }
  .fd-pop h4 { font-size: 18px; font-weight: 800; margin: 0 0 4px; }
  .fd-pop .s { font-size: 13px; color: var(--fg3); margin: 0 0 18px; }
  .fd-steps { text-align: left; display: flex; flex-direction: column; gap: 9px; margin-bottom: 18px; }
  .fd-step { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: var(--fg3); transition: color .2s; }
  .fd-step i { flex: none; width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--line); font-style: normal; font-size: 10px; display: grid; place-items: center; margin-top: 1px; }
  .fd-step.on { color: var(--fg); font-weight: 600; }
  .fd-step.on i { border-color: var(--brand); border-top-color: transparent; animation: fd-rot .8s linear infinite; }
  .fd-step.ok { color: var(--fg2); }
  .fd-step.ok i { border-color: var(--brand); background: var(--brand); color: #fff; }
  .fd-step small { display: block; font-weight: 400; color: var(--fg3); font-size: 12px; }
  .fd-prog { height: 6px; border-radius: 3px; background: var(--surface2); overflow: hidden; }
  .fd-prog i { display: block; height: 100%; width: 0; background: var(--brand); border-radius: 3px; transition: width .4s ease; }
  .fd-pop .demo { margin-top: 12px; font-size: 11px; color: var(--fg3); }
  @keyframes fd-rot { to { transform: rotate(360deg); } }
  @keyframes fd-fade { from { opacity: 0; } }
  @media (max-width: 640px) { .fd-item { grid-template-columns: 30px 1fr; } .fd-side { grid-column: 1 / -1; flex-direction: row; align-items: center; justify-content: space-between; } .fd-match { text-align: left; } }
  @media (prefers-reduced-motion: reduce) { .fd-item { animation: none; opacity: 1; transform: none; } }`;
  function ensureCSS() { if (document.getElementById('fd-css')) return; const s = document.createElement('style'); s.id = 'fd-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* ---------- 분석 기록 (고객별, 이 브라우저에 저장) ----------
     sailog.fundmatch.{고객id} = { latest: {at, risk, maxG, eligible, total, keywords, top:[{id, rank, match, reasons}]}, history: [{at, names}] }
     다시 들어오면 마지막 분석을 그대로 보여주고, 다시 분석하면 latest 를 바꾸고 이전 것은 history 로. */
  const KEY = (id) => 'sailog.fundmatch.' + id;
  const loadRec = (id) => { try { return JSON.parse(localStorage.getItem(KEY(id))); } catch (e) { return null; } };
  const saveRec = (id, rec) => { try { localStorage.setItem(KEY(id), JSON.stringify(rec)); } catch (e) {} };
  const byId = (pid) => UNIVERSE.find(f => f.id === pid);
  const pack = (c, R) => ({ at: R.at.toISOString(), risk: c.risk, maxG: R.maxG, eligible: R.eligible, total: R.total, keywords: R.keywords,
    top: R.top.map(r => ({ id: r.f.id, rank: r.rank, match: r.match, reasons: r.reasons })) });
  function store(c, R) {
    const old = loadRec(c.id);
    const history = old && old.latest ? [{ at: old.latest.at, names: old.latest.top.slice(0, 3).map(t => (byId(t.id) || {}).name).filter(Boolean) }, ...(old.history || [])].slice(0, 5) : [];
    saveRec(c.id, { latest: pack(c, R), history });
  }
  /* 시연용: 처음 여는 브라우저에서도 '예전에 분석해 둔 고객'을 볼 수 있도록 몇 명은 과거 분석 기록을 미리 둠 */
  const SEED_DAYS = { 2: 12, 4: 5, 6: 41, 13: 3 };
  function seed(c) {
    if (loadRec(c.id) || !(c.id in SEED_DAYS)) return;
    const R = analyze(c); const t = new Date(SAILOG.TODAY || Date.now()); t.setDate(t.getDate() - SEED_DAYS[c.id]); t.setHours(14, 20, 0, 0); R.at = t;
    saveRec(c.id, { latest: pack(c, R), history: [] });
  }

  const pct = (v) => `<b class="${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '+' : ''}${v.toFixed(1)}%</b>`;
  const overview = (f) => `${{ KR_EQ: '국내 주식', OS_EQ: '해외 주식', BOND: '채권', CASH: '단기 금융상품', MIX: '주식·채권 혼합 자산' }[f.ex] || '여러 자산'}에 투자하는 ${f.type} 펀드${f.tags.includes('인덱스') ? ', 지수 추종' : ''}${f.tags.includes('월지급') ? ', 매월 분배' : ''}`;
  const daysSince = (iso) => { const a = new Date(iso), b = new Date(SAILOG.TODAY || Date.now()); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 86400000); };

  function resultHTML(c, L, hist) {
    const t = new Date(L.at); const d = daysSince(L.at);
    const when = `${t.getMonth() + 1}월 ${t.getDate()}일 ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    const ago = d <= 0 ? '오늘' : `${d}일 전`;
    const stale = L.risk !== c.risk ? `분석 이후 투자성향이 ${L.risk} → ${c.risk}로 바뀌었어요. 다시 분석해 주세요.` : d > 30 ? '분석한 지 30일이 넘었어요. 고객 상황이 바뀌었을 수 있어요.' : '';
    const items = L.top.map(s => ({ ...s, f: byId(s.id) })).filter(s => s.f);
    return `<div class="fd-when"><span class="fd-when-t"><b>${when}</b> 분석 · ${ago}</span><span>투자성향 <b>${esc(L.risk)}</b> → <b>${L.maxG}등급 이하</b> · 공모펀드 ${L.total}개 중 적합 ${L.eligible}개</span>${hist.length ? `<span>이전 분석 ${hist.length}회</span>` : ''}</div>
      ${stale ? `<div class="fd-stale">${esc(stale)}</div>` : ''}
      <div class="fd-list">${items.map((r, i) => `<div class="fd-item" style="animation-delay:${i * 70}ms">
        <div class="fd-rank">${r.rank}</div>
        <div class="fd-body">
          <div class="fd-name">${esc(r.f.name)} <small>${esc(r.f.cls)}</small></div>
          <div class="fd-desc">${esc(overview(r.f))}</div>
          <div class="fd-tags"><span>${esc(r.f.type)}</span><span class="g${r.f.grade}">${r.f.grade}등급 ${GRADE[r.f.grade]}</span>${r.f.pension ? '<span>연금 가능</span>' : ''}${r.f.isa ? '<span>ISA 가능</span>' : ''}${r.f.tags.includes('월지급') ? '<span>월지급</span>' : ''}</div>
          <ul class="fd-why">${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          <div class="fd-nums"><span>총보수 <b>연 ${r.f.fee.toFixed(2)}%</b></span><span>1년 ${pct(r.f.r1)}</span><span>3년 연환산 ${pct(r.f.r3)}</span><span class="muted">가상 수익률 · 과거 성과는 미래를 보장하지 않음</span></div>
        </div>
        <div class="fd-side"><div class="fd-match"><b>${r.match}%</b><span>적합도</span><div class="fd-bar"><i style="width:${r.match}%"></i></div></div>
          ${(() => { const s = lastSent(c.id, r.f.id); return `${s ? `<span class="fd-sent">✓ ${fmtMD(s.at)} 안내함</span>` : ''}<button class="btn sm ${s ? '' : 'dark'}" data-fd-send="${r.f.id}" data-fd-cust="${c.id}">💬 ${s ? '다시 안내' : '카카오 메시지로 안내'}</button>`; })()}</div>
      </div>`).join('')}</div>`;
  }

  /* ---------- 카카오 메시지로 펀드 안내 (광고성 정보: 수신 동의 고객 대상 · (광고) 표기 · 수신거부 안내) ----------
     상품 '정보 안내' 메시지: 가입 권유·수익 보장 문구 없이 개요·위험등급·보수·필수 고지만. 발송 기록은 sailog.fundsent.{고객id} */
  const SENT_KEY = (id) => 'sailog.fundsent.' + id;
  const sentLog = (id) => { try { return JSON.parse(localStorage.getItem(SENT_KEY(id))) || []; } catch (e) { return []; } };
  const lastSent = (cid, fid) => sentLog(cid).find(s => s.fid === fid);
  const fmtMD = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
  const NOTICE = '집합투자증권은 예금자보호법에 따라 보호되지 않으며, 운용 결과에 따라 원금 손실이 발생할 수 있습니다. 과거 수익률은 미래 수익을 보장하지 않습니다. 가입 전 투자설명서를 반드시 읽어 보시기 바랍니다. 준법감시인 심의필 제2026-시연-000호 · 무료 수신거부 080-000-0000 (시연용)';
  function fundMsg(c, f, memo) {
    const NOT_AREA = ['만기', '현금', '예수금', '목돈', '안정', '분산', '적립식', '첫 투자', '2030', '변동성', '테마', '절세', '세액공제', '퇴직'];   // 이벤트·성향 단어는 '관심 분야'로 부르지 않음
    const hit = SAILOG.interestsOf(c).map(i => i.key).filter(k => f.topics.includes(k) && !NOT_AREA.includes(k)).slice(0, 2);
    return {
      tag: '친구톡 · 광고',
      title: `(광고) ${f.name} 상품 정보`,
      body: `${c.name} 고객님, ${hit.length ? `평소 관심 두신 ${hit.join('·')} 분야와 관련된 ` : ''}공모펀드 정보를 전해 드려요.\n\n상품 개요: ${overview(f)}\n\n${memo ? memo + '\n\n' : ''}가입을 생각하신다면 투자설명서와 위험 내용을 담당 PB와 함께 먼저 확인해 주세요. 궁금하신 점은 편하실 때 연락 주세요.`,
      info: [['유형', `${f.type} · ${f.cls}클래스`], ['위험등급', `${f.grade}등급 ${GRADE[f.grade]}`], ['총보수', `연 ${f.fee.toFixed(2)}%`], ['과거 1년 수익률', `${f.r1 >= 0 ? '+' : ''}${f.r1.toFixed(1)}% (가상)`]],
      notice: NOTICE,
      buttons: ['투자설명서 보기', 'PB 상담 요청'],
    };
  }
  function openSend(cid, fid) {
    const c = SAILOG.byId(cid), f = byId(fid); if (!c || !f || document.querySelector('.fd-ov')) return;
    ensureCSS();
    const maxG = MAX_GRADE[SAILOG.RISK_LEVEL[c.risk] || 3]; const fits = f.grade >= maxG;
    const prev = lastSent(cid, fid);
    const ov = document.createElement('div'); ov.className = 'fd-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', '카카오 메시지로 펀드 안내');
    ov.innerHTML = `<div class="fd-send">
      <div class="fd-send-l">
        <div><h4>카카오 메시지로 펀드 안내</h4><p class="fd-send-s">상품 정보를 카카오 메시지로 보내요. 가입 권유나 수익 보장 문구는 넣지 않아요.</p></div>
        <div class="fd-to"><div class="avatar">${esc(c.initial)}</div><div><b>${esc(c.name)}</b> 고객님<small>${esc(c.phone)} · ${esc(c.risk)}</small></div></div>
        <div class="fd-to fd-to-f"><div><b>${esc(f.name)}</b><small>${esc(f.type)} · ${f.grade}등급 ${GRADE[f.grade]} · 총보수 연 ${f.fee.toFixed(2)}%</small></div></div>
        <div><div class="fd-lbl">발송 전 확인</div><ul class="fd-chk">
          <li class="${fits ? '' : 'bad'}"><i>${fits ? '✓' : '!'}</i><div>투자성향 적합<small>${esc(c.risk)} → ${maxG}등급 이하 가능 · 이 펀드 ${f.grade}등급${fits ? '' : ' · 성향 범위를 넘어 보낼 수 없어요'}</small></div></li>
          <li><i>✓</i><div>필수 고지 포함<small>예금자보호 미적용 · 원금 손실 가능 · 과거 수익률 미보장 · 투자설명서 확인</small></div></li>
          <li><i>✓</i><div>권유 표현 없음<small>'가입하기' 버튼 대신 투자설명서 보기 · PB 상담 요청</small></div></li>
          <li><i>✓</i><div>메시지 수신 동의<small>시연용 가상 고객 · 동의 상태 가정 · 수신거부 번호 포함</small></div></li>
        </ul></div>
        <label class="fd-memo"><span class="fd-lbl">PB 한마디 <small>선택 · 메시지 본문에 들어가요</small></span><textarea rows="2" maxlength="120" placeholder="예: 지난번 통화에서 말씀하신 해외 분산 관련해 참고하실 만한 자료예요."></textarea></label>
        ${prev ? `<div class="fd-prev">${fmtMD(prev.at)}에 이 펀드를 이미 안내했어요.</div>` : ''}
        <div class="fd-send-act"><button class="btn lg block" type="button" data-x>취소</button><button class="btn lg block primary" type="button" data-go ${fits ? '' : 'disabled style="opacity:.5"'}>카카오 메시지 보내기 (시연)</button></div>
      </div>
      <div class="fd-send-r"><div class="fd-prev-lbl">고객이 받는 화면</div><div class="fd-phone"></div></div></div>`;
    document.body.appendChild(ov);
    const memo = ov.querySelector('textarea'), phone = ov.querySelector('.fd-phone');
    const draw = () => { phone.innerHTML = UI.phoneHTML(UI.messageHTML('펀드 정보 안내', fundMsg(c, f, memo.value.trim()))); };
    draw(); memo.oninput = draw;
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.onclick = (e) => { if (e.target === ov) close(); };
    ov.querySelector('[data-x]').onclick = close;
    ov.querySelector('[data-go]').onclick = () => {
      if (!fits) return;
      const now = new Date(SAILOG.TODAY || Date.now()); const t = new Date(); now.setHours(t.getHours(), t.getMinutes(), 0, 0);
      try { localStorage.setItem(SENT_KEY(cid), JSON.stringify([{ fid, name: f.name, at: now.toISOString(), memo: memo.value.trim() }, ...sentLog(cid)].slice(0, 30))); } catch (e) {}
      close(); rerender(cid);
      document.querySelectorAll(`#fd-block-${cid} .fd-item`).forEach(x => { x.style.animation = 'none'; x.style.opacity = 1; x.style.transform = 'none'; });
      if (window.UI) UI.toast(`${c.name} 고객에게 '${f.name}' 안내 카카오 메시지를 보냈어요 (시연)`);
      window.dispatchEvent(new CustomEvent('sailog:fundsent', { detail: { id: cid, fid } }));
    };
  }

  function html(c) {
    ensureCSS(); seed(c);
    const rec = loadRec(c.id); const L = rec && rec.latest;
    const body = L ? resultHTML(c, L, rec.history || []) : `<div class="fd-intro"><div class="ic">✦</div><p><b>분석하기</b>를 누르면 AI가 ${esc(c.name)} 고객의 거래 로그·보유 자산·투자성향을 읽고, 판매 중인 공모펀드 ${UNIVERSE.length}개 가운데 맞는 상품 <b>상위 5개</b>를 골라 드려요.<br>투자성향(${esc(c.risk)})을 넘는 위험등급 펀드는 처음부터 제외하고, 분석 결과는 저장돼 다음에 다시 볼 수 있어요.</p></div>`;
    return `<div class="dt-card span" id="fd-block-${c.id}"><h3 style="display:flex;align-items:center;gap:8px">AI 펀드 매칭 <span>공모펀드 · 고객 맞춤 상위 5 · 시연용 가상 펀드</span><button class="btn sm ${L ? '' : 'dark'} fd-head-btn" data-fd-run="${c.id}">${L ? '↻ 다시 분석' : '✦ 분석하기'}</button></h3>
      ${body}
      <p class="fd-note">시연용 가상 펀드·가상 수익률입니다. 투자성향과 계좌 데이터로 고른 PB 참고 자료이며 특정 상품의 매수를 권유하는 내용이 아닙니다. 펀드 안내는 카카오 메시지로 필수 고지와 함께 보내요. 실제 가입 전에는 적합성 확인과 투자설명서 설명 절차를 거칩니다.</p></div>`;
  }

  function rerender(id) {
    const c = SAILOG.byId(id); const el = document.getElementById('fd-block-' + id); if (!c || !el) return;
    el.outerHTML = html(c);
  }

  /* 분석중 팝업: 단계별 진행 후 결과 저장·표시 */
  function run(id) {
    const c = SAILOG.byId(id); if (!c || document.querySelector('.fd-ov')) return;
    ensureCSS();
    const lvl = SAILOG.RISK_LEVEL[c.risk] || 3; const maxG = MAX_GRADE[lvl];
    const steps = [
      ['거래·입출금 로그 읽는 중', `보유 ${c.holdings.length}종목 · 최근 기록 ${c.logs.length}건`],
      ['투자성향·관심 분야 추출', SAILOG.interestsOf(c).slice(0, 3).map(i => i.key).join(' · ') || '관심 분야 분석'],
      ['적합성 필터 적용', `${c.risk} → ${maxG}등급 이하 · 공모펀드 ${UNIVERSE.length}개 중 ${UNIVERSE.filter(f => f.grade >= maxG).length}개`],
      ['포트폴리오 보완도 계산', '자산군 비중 · 섹터 편중 · 현금흐름 필요'],
      ['상위 5개 선정', '관심 35 · 보완 25 · 성향 15 · 필요 15 · 비용 10 · 유형별 분산'],
    ];
    const ov = document.createElement('div'); ov.className = 'fd-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-live', 'polite');
    ov.innerHTML = `<div class="fd-pop"><div class="fd-spin"><span>AI</span></div><h4>분석 중이에요</h4><p class="s">${esc(c.name)} 고객에게 맞는 공모펀드를 찾고 있어요</p>
      <div class="fd-steps">${steps.map(([t, d]) => `<div class="fd-step"><i></i><div>${esc(t)}<small>${esc(d)}</small></div></div>`).join('')}</div>
      <div class="fd-prog"><i></i></div><div class="demo">시연용 가상 화면</div></div>`;
    document.body.appendChild(ov);
    const els = ov.querySelectorAll('.fd-step'); const bar = ov.querySelector('.fd-prog i');
    const result = analyze(c); const STEP = 620;
    els.forEach((el, i) => setTimeout(() => {
      if (i > 0) { els[i - 1].classList.remove('on'); els[i - 1].classList.add('ok'); els[i - 1].querySelector('i').textContent = '✓'; }
      el.classList.add('on'); bar.style.width = ((i + 1) / steps.length * 100) + '%';
    }, i * STEP + 150));
    setTimeout(() => {
      const last = els[els.length - 1]; last.classList.remove('on'); last.classList.add('ok'); last.querySelector('i').textContent = '✓';
      ov.querySelector('h4').textContent = '분석 완료'; ov.querySelector('.s').textContent = `상위 5개 펀드를 찾았어요 · 결과를 저장했어요`;
    }, steps.length * STEP + 150);
    setTimeout(() => {
      ov.remove(); store(c, result); rerender(id);
      const el = document.getElementById('fd-block-' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, steps.length * STEP + 750);
  }

  document.addEventListener('click', (e) => {
    const r = e.target.closest('[data-fd-run]'); if (r) { run(Number(r.dataset.fdRun)); return; }
    const s = e.target.closest('[data-fd-send]'); if (s) openSend(Number(s.dataset.fdCust), s.dataset.fdSend);
  });

  return { html, run, analyze, rerender, openSend, sentLog, FUNDS, GRADE, byId, latest: (id) => { const r = loadRec(id); return r && r.latest; } };
})();
