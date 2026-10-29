/* 고객 목록 필터 — 빠른 보기 칩 + 기능별 상세 필터(그룹 안 OR, 그룹끼리 AND) + 결과 고객 일괄 귀띔.
   신호(data.js) · 귀띔 이력 · 통화/일정(calls.js) · 펀드 매칭(fund.js) 을 읽어 고객을 나눈다.
   index.html renderCustomers 가 SAILOG_CF.match(c) 로 거르고 SAILOG_CF.render(rows) 로 칩 숫자·일괄 발송 바를 갱신. */
window.SAILOG_CF = (() => {
  const { CUSTOMERS, TEMPLATES, dayDiff } = SAILOG;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = UI.esc;
  const KEY = 'sailog.custfilter';
  let hooks = { sent: () => [], done: () => new Set(), onChange: () => {}, sendBulk: () => {} };

  const has = (c, ...types) => c.signals.some(s => types.includes(s.type));
  const since = (c) => -dayDiff(c.last);
  const CALLS = () => SAILOG.CALLS;
  const todayISO = () => CALLS().TODAY_ISO;
  const upcoming = (c, pred, days = 14) => { const from = todayISO(), to = CALLS().addDays(from, days); return CALLS().events().some(e => e.custId === c.id && e.date >= from && e.date < to && pred(e)); };
  const APPT = ['callback', 'visit', 'manual'];
  const sentTpl = (c) => hooks.sent().filter(s => s.id === c.id);

  /* ---------- 빠른 보기 (하나만 선택) ---------- */
  const QUICK = [
    ['all', '전체', () => true],
    ['urgent', '긴급', c => c.pri === 3 && !hooks.done().has(c.id)],
    ['send', '귀띔 보낼 수 있음', c => c.signals.some(s => s.template && !sentTpl(c).some(x => x.tpl === s.template))],
    ['tax', '절세 기회', c => c.signals.some(s => s.cat === '절세')],
    ['cash', '자금 이동', c => has(c, 'CMA', 'MATURITY', 'LARGE_IN', 'LARGE_OUT')],
    ['risk', '위험 관리', c => has(c, 'MARGIN', 'RECEIVABLE', 'DROP', 'SURGE')],
    ['stale', '30일+ 연락 없음', c => since(c) > 30],
  ];

  /* ---------- 상세 필터 그룹 ---------- */
  const tplOpts = Object.keys(TEMPLATES).map(k => [`tpl:${k}`, TEMPLATES[k].name.replace(/ 안내$/, ''), c => c.signals.some(s => s.template === k)]);
  const GROUPS = [
    { id: 'base', label: '고객 구분', opts: [
      ['indiv', '개인', c => !c.corp], ['corp', '법인', c => !!c.corp],
      ['aum1', '자산 1억 미만', c => c.total < 1e8], ['aum2', '1억~5억', c => c.total >= 1e8 && c.total < 5e8], ['aum3', '5억 이상', c => c.total >= 5e8]] },
    { id: 'tax', label: '절세 기회', opts: [
      ['TAX', '해외 양도세', c => has(c, 'TAX')], ['ISA', 'ISA (개설·만기·한도)', c => has(c, 'ISA_OPEN', 'ISA_MATURITY', 'ISA_LIMIT')],
      ['PENSION', '연금 세액공제', c => has(c, 'PENSION')],
      ['MAJOR_OVER', '대주주 기준 초과', c => c.signals.some(s => s.type === 'MAJOR' && s.major.over)],
      ['MAJOR_WATCH', '대주주 기준 임박', c => c.signals.some(s => s.type === 'MAJOR' && !s.major.over)]] },
    { id: 'cash', label: '자금 흐름', opts: [
      ['CMA', '예수금 미운용', c => has(c, 'CMA')], ['MATURITY', '만기 도래', c => has(c, 'MATURITY')],
      ['LARGE_IN', '대규모 입금', c => has(c, 'LARGE_IN')], ['LARGE_OUT', '대규모 출금', c => has(c, 'LARGE_OUT')]] },
    { id: 'risk', label: '위험 관리', opts: [
      ['MARGIN', '담보비율 주의', c => has(c, 'MARGIN')], ['RECEIVABLE', '미수 발생', c => has(c, 'RECEIVABLE')],
      ['DROP', '보유종목 급락', c => has(c, 'DROP')], ['SURGE', '보유종목 급등', c => has(c, 'SURGE')]] },
    { id: 'tpl', label: '귀띔 대상', opts: tplOpts },
    { id: 'msg', label: '귀띔 이력', opts: [
      ['sentToday', '오늘 발송함', c => sentTpl(c).length > 0],
      ['unread', '미확인 메시지 있음', c => c.history.some(h => h.status === '미확인')],
      ['noMsg30', '30일간 발송 없음', c => !sentTpl(c).length && !c.history.some(h => -dayDiff(h.date) <= 30)]] },
    { id: 'contact', label: '상담 · 일정', opts: [
      ['appt', '14일 내 상담 약속', c => upcoming(c, e => APPT.includes(e.kind) || e.confirmed)],
      ['followup', '통화 후속 할 일', c => upcoming(c, e => e.auto && !APPT.includes(e.kind), 30)],
      ['called', '통화 기록 있음', c => CALLS().forCustomer(c.id).length > 0],
      ['flag', '준법 확인 필요', c => CALLS().flags({ unackedOnly: true, custId: c.id }).length > 0],
      ['last60', '60일+ 연락 없음', c => since(c) > 60]] },
    { id: 'offer', label: '펀드 매칭', opts: [
      ['fundDone', '분석 완료', c => !!(window.SAILOG_FUND && SAILOG_FUND.latest(c.id))],
      ['fundTodo', '아직 분석 안 함', c => !(window.SAILOG_FUND && SAILOG_FUND.latest(c.id))],
      ['fundSent', '펀드 정보 보냄', c => !!(window.SAILOG_FUND && SAILOG_FUND.sentLog(c.id).length)]] },
    { id: 'rel', label: '관계', opts: [
      ['DORMANT', '장기 미거래', c => has(c, 'DORMANT')], ['ONBOARD', '신규 고객', c => has(c, 'ONBOARD')], ['BIRTHDAY', '생일 임박', c => has(c, 'BIRTHDAY')]] },
  ];
  const OPT = {}; GROUPS.forEach(g => g.opts.forEach(([k, l, f]) => { OPT[k] = { g: g.id, l, f }; }));
  const QF = Object.fromEntries(QUICK.map(([k, l, f]) => [k, { l, f }]));

  /* ---------- 상태 (브라우저에만 저장) ---------- */
  const st = { quick: 'all', sel: new Set(), open: false };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) { st.quick = QF[s.quick] ? s.quick : 'all'; (s.sel || []).filter(k => OPT[k]).forEach(k => st.sel.add(k)); } } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ quick: st.quick, sel: [...st.sel] })); } catch (e) {} };
  const change = () => { save(); hooks.onChange(); };

  // 그룹 안은 OR, 그룹끼리는 AND. skip 그룹은 칩 숫자(패싯) 계산용으로 제외
  function passGroups(c, skip) {
    const by = {}; st.sel.forEach(k => { const o = OPT[k]; if (o.g !== skip) (by[o.g] = by[o.g] || []).push(o.f); });
    return Object.values(by).every(fs => fs.some(f => f(c)));
  }
  const match = (c) => QF[st.quick].f(c) && passGroups(c);

  /* ---------- 렌더 ---------- */
  function mount() {
    if ($('#cf-quick')) return;
    const css = document.createElement('style');
    css.textContent = `
.cf-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.cf-chip { height: 32px; padding: 0 13px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); font-weight: 600; font-size: 13px; color: var(--fg2); white-space: nowrap; }
.cf-chip .n { margin-left: 4px; color: var(--fg3); font-weight: 500; }
.cf-chip.on { background: var(--fg); color: #fff; border-color: var(--fg); }
.cf-chip.on .n { color: #c8ccd2; }
.cf-chip.zero { opacity: .45; }
.cf-more { height: 36px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); font-weight: 600; font-size: 13px; color: var(--fg2); display: inline-flex; align-items: center; gap: 6px; }
.cf-more.on { border-color: var(--fg); color: var(--fg); }
.cf-more b { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--brand); color: #fff; font-size: 11px; display: grid; place-items: center; }
.cf-panel { background: var(--surface); border-radius: 14px; box-shadow: var(--shadow); padding: 6px 16px; margin-bottom: 12px; }
.cf-row { display: grid; grid-template-columns: 92px 1fr; gap: 10px; padding: 10px 0; border-top: 1px solid var(--line); align-items: start; }
.cf-row:first-child { border-top: 0; }
.cf-row > span { font-size: 12px; font-weight: 700; color: var(--fg3); padding-top: 7px; }
.cf-row .cf-bar { margin: 0; }
.cf-row .cf-chip { height: 28px; font-size: 12px; padding: 0 11px; }
.cf-applied { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; font-size: 12px; color: var(--fg3); }
.cf-tag { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 6px 0 10px; border-radius: 999px; background: var(--brand-tint); color: var(--brand); font-weight: 600; }
.cf-tag button { width: 18px; height: 18px; border-radius: 50%; color: inherit; font-size: 13px; line-height: 1; }
.cf-tag button:hover { background: rgba(0,0,0,.06); }
.cf-clear { color: var(--fg3); text-decoration: underline; font-size: 12px; }
.cf-bulk { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; margin-bottom: 12px; border-radius: 12px; background: var(--brand-tint); font-size: 13px; }
.cf-bulk select { height: 32px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface); padding: 0 8px; font-size: 13px; }
.cf-bulk .btn { margin-left: auto; }
@media (max-width: 640px) { .cf-row { grid-template-columns: 1fr; gap: 4px; } .cf-row > span { padding-top: 0; } }`;
    document.head.appendChild(css);
    const tb = $('#view-customers .toolbar');
    const more = document.createElement('button'); more.id = 'cf-more'; more.className = 'cf-more'; tb.insertBefore(more, $('#sort-filter'));
    tb.insertAdjacentHTML('afterend', '<div class="cf-bar" id="cf-quick"></div><div class="cf-panel" id="cf-panel" hidden></div><div class="cf-applied" id="cf-applied" hidden></div><div class="cf-bulk" id="cf-bulk" hidden></div>');
    more.onclick = () => { st.open = !st.open; hooks.onChange(); };
  }

  // base: 검색어·투자성향을 통과한 고객 (index.html 이 넘김). rows: 최종 결과
  function render(base, rows) {
    mount();
    const nQuick = (f) => base.filter(c => f(c) && passGroups(c)).length;
    $('#cf-quick').innerHTML = QUICK.map(([k, l, f]) => `<button class="cf-chip ${st.quick === k ? 'on' : ''}" data-q="${k}">${l}<span class="n">${nQuick(f)}</span></button>`).join('');
    $('#cf-quick').querySelectorAll('[data-q]').forEach(b => b.onclick = () => { st.quick = b.dataset.q; change(); });

    const more = $('#cf-more');
    more.className = 'cf-more' + (st.open || st.sel.size ? ' on' : '');
    more.innerHTML = `필터 ${st.open ? '접기' : '더보기'}${st.sel.size ? `<b>${st.sel.size}</b>` : ''}`;

    const panel = $('#cf-panel'); panel.hidden = !st.open;
    if (st.open) {
      const pool = base.filter(QF[st.quick].f);
      panel.innerHTML = GROUPS.map(g => {
        const opts = g.opts.filter(([, , f]) => CUSTOMERS.some(f));   // 아무도 해당 없는 항목은 숨김
        if (!opts.length) return '';
        const inGroup = pool.filter(c => passGroups(c, g.id));
        return `<div class="cf-row"><span>${g.label}</span><div class="cf-bar">${opts.map(([k, l, f]) => { const n = inGroup.filter(f).length; return `<button class="cf-chip ${st.sel.has(k) ? 'on' : ''} ${n ? '' : 'zero'}" data-o="${k}">${esc(l)}<span class="n">${n}</span></button>`; }).join('')}</div></div>`;
      }).join('');
      panel.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { const k = b.dataset.o; st.sel.has(k) ? st.sel.delete(k) : st.sel.add(k); change(); });
    }

    const ap = $('#cf-applied'); ap.hidden = !st.sel.size;
    ap.innerHTML = st.sel.size ? '적용된 필터' + [...st.sel].map(k => `<span class="cf-tag">${esc(OPT[k].l)}<button data-x="${k}" aria-label="해제">×</button></span>`).join('') + '<button class="cf-clear" data-clear>모두 지우기</button>' : '';
    ap.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { st.sel.delete(b.dataset.x); change(); });
    const clr = ap.querySelector('[data-clear]'); if (clr) clr.onclick = () => { st.sel.clear(); change(); };

    renderBulk(rows);
  }

  // 결과 고객 중 같은 귀띔 신호가 있는 사람을 모아 발송 화면으로 넘김 (선택한 '귀띔 대상' 템플릿 우선)
  function renderBulk(rows) {
    const box = $('#cf-bulk');
    const filtered = st.quick !== 'all' || st.sel.size;
    const cnt = {}; rows.forEach(c => new Set(c.signals.filter(s => s.template).map(s => s.template)).forEach(t => { cnt[t] = (cnt[t] || 0) + 1; }));
    const tpls = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
    if (!filtered || !tpls.length) { box.hidden = true; box.innerHTML = ''; return; }
    const picked = [...st.sel].filter(k => k.startsWith('tpl:')).map(k => k.slice(4)).find(t => cnt[t]);
    const cur = box.dataset.tpl && cnt[box.dataset.tpl] ? box.dataset.tpl : picked || tpls[0];
    box.dataset.tpl = cur;
    box.hidden = false;
    box.innerHTML = `<span>이 목록 중 <b>${cnt[cur]}명</b>에게</span>
      <select>${tpls.map(t => `<option value="${t}" ${t === cur ? 'selected' : ''}>${esc(TEMPLATES[t].name)} (${cnt[t]}명)</option>`).join('')}</select>
      <span class="muted">귀띔을 보낼 수 있어요</span>
      <button class="btn primary sm">발송 화면으로</button>`;
    box.querySelector('select').onchange = (e) => { box.dataset.tpl = e.target.value; renderBulk(rows); };
    box.querySelector('.btn').onclick = () => hooks.sendBulk(rows.filter(c => c.signals.some(s => s.template === cur)).map(c => c.id), cur);
  }

  function init(h) { hooks = { ...hooks, ...h }; }
  return { init, match, render, QUICK, GROUPS };
})();
