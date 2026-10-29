/* ============================================================
   귀띔 — 시연 모드 (PB 작업 ↔ 고객 폰 실시간 연결)
   사이드바 '시연 모드'를 켜면 오른쪽에 고객 폰(customer.html?embed&mini)과 연결 기록이 붙는다.
   1차 흐름: PB 귀띔 발송 → 고객 폰 도착 → 고객이 CMA로 옮김 → PB 오늘 할 일 완료 + 알림.
   펀드 안내: fund.js 의 sailog:fundsent 이벤트 → 고객 폰에 (광고) 펀드 정보 메시지 → 고객이 PB 상담 예약 → 일정 반영.
   사용: index.html send() 안에 SAILOG_LIVE.onSend(ids, tpl) 한 줄,
         SAILOG_CX.init 뒤에 SAILOG_LIVE.init({ markDone, undo, isOpen, toast }).
   통화 종료: 고객에게는 보내지 않고 '전날 일정 알림 예정'만 기록 (SAILOG_LIVE.onCall(rec) 한 줄).
   고객 폰 → PB: postMessage { sailogLive: { type: open|check|cma-done|appt|ask, custId, name, ... } }
     ask(상담 요청) → 오늘 일정에 callback 등록(CALLS.addManual) + '전화하기' 알림
   ============================================================ */
window.SAILOG_LIVE = (() => {
  const KEY = 'sailog.live';
  let on = false, ready = false, pending = null, H = {}, frame = null;

  const CSS = `
  .lv-toggle .lv-sw { margin-left: auto; width: 30px; height: 18px; border-radius: 99px; background: var(--line); position: relative; transition: background .2s; }
  .lv-toggle .lv-sw::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .2s; }
  body.live .lv-toggle { background: var(--brand-tint); color: var(--brand); }
  body.live .lv-toggle .lv-sw { background: var(--brand); }
  body.live .lv-toggle .lv-sw::after { transform: translateX(12px); }
  @media (max-width: 760px) { .lv-toggle { display: none !important; } }
  .lv { position: fixed; top: 0; right: 0; bottom: 0; width: 380px; z-index: 24; background: var(--bg); border-left: 1px solid var(--line); display: flex; flex-direction: column; }
  .lv[hidden] { display: none; }   /* display:flex 가 hidden 속성을 덮지 않게 */
  body.live .app { padding-right: 380px; }
  body.live .drawer { right: 380px; }
  body.live .drawer:not(.open) { transform: translateX(calc(100% + 380px)); }   /* 닫힌 서랍이 고객 폰 패널을 덮지 않게 */
  @media (max-width: 1100px) { body.live .app { padding-right: 0; } .lv { box-shadow: -10px 0 30px rgba(25,31,40,.15); } }
  .lv-head { display: flex; align-items: center; gap: 8px; padding: 14px 16px 8px; }
  .lv-head b { font-size: 14px; }
  /* PB 화면 ↔ 고객 화면 경계: 진한 세로선 + 다른 바탕 + '고객이 보는 화면' 라벨 */
  .lv { border-left: 3px solid var(--fg); background: #E4E9F0; }
  .lv-side { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 99px; background: var(--fg); color: var(--surface); font-size: 13px; font-weight: 800; white-space: nowrap; }
  .lv-head .lv-who { margin-left: 2px; }
  .lv-who { font-size: 12px; font-weight: 700; color: var(--fg3); background: var(--gray-tint); border-radius: 99px; padding: 3px 10px; }
  .lv-who.on { color: var(--brand); background: var(--brand-tint); }
  .lv-x { margin-left: auto; width: 28px; height: 28px; border-radius: 8px; font-size: 18px; color: var(--fg3); }
  .lv-x:hover { background: var(--surface2); }
  .lv-frame { flex: 1; min-height: 0; width: 100%; border: 0; display: block; }
  .lv-log { flex: none; max-height: 26vh; overflow-y: auto; border-top: 1px solid var(--line); padding: 10px 16px 14px; background: var(--surface); }
  .lv-log-h { font-size: 12px; font-weight: 700; color: var(--fg3); margin-bottom: 6px; display: flex; justify-content: space-between; }
  .lv-log ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .lv-log li { display: grid; grid-template-columns: 40px 38px 1fr; gap: 6px; align-items: start; font-size: 12.5px; color: var(--fg2); line-height: 1.45; animation: lvin .35s ease both; }
  .lv-log li time { color: var(--fg3); font-variant-numeric: tabular-nums; padding-top: 1px; }
  .lv-log li .w { font-size: 11px; font-weight: 800; text-align: center; border-radius: 99px; padding: 1px 0; }
  .lv-log li .w.pb { background: var(--gray-tint); color: var(--fg2); }
  .lv-log li .w.cu { background: var(--brand-tint); color: var(--brand); }
  .lv-log li .w.sys { background: var(--green-tint); color: var(--green); }
  .lv-log li.empty { display: block; font-size: 12.5px; color: var(--fg3); }
  @keyframes lvin { from { transform: translateY(-6px); opacity: .3; } to { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .lv-log li { animation: none; } }
  `;

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const now = () => { const d = new Date(); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const man = (n) => `${Math.round(n / 10000).toLocaleString('ko-KR')}만원`;

  function log(who, text) {
    const ol = $('#lv-log'); if (!ol) return;
    const e = $('.empty', ol); if (e) e.remove();
    const label = { pb: 'PB', cu: '고객', sys: '귀띔' }[who];
    ol.insertAdjacentHTML('afterbegin', `<li><time>${now()}</time><span class="w ${who}">${label}</span><span>${text}</span></li>`);
  }
  function who(text) { const w = $('#lv-who'); if (w) { w.textContent = text; w.classList.add('on'); } }

  function post() {
    if (!pending || !ready || !frame) return;
    frame.contentWindow.postMessage(pending, '*'); pending = null;
  }

  function build() {
    document.body.insertAdjacentHTML('beforeend', `<aside class="lv" id="lv" hidden aria-label="고객 폰 (시연용 가상)">
      <div class="lv-head"><span class="lv-side"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>고객이 보는 화면</span><span class="lv-who" id="lv-who">대기 중</span><button type="button" class="lv-x" id="lv-x" aria-label="시연 모드 끄기">×</button></div>
      <iframe class="lv-frame" title="고객 폰 (시연용 가상)"></iframe>
      <div class="lv-log"><div class="lv-log-h"><span>PB ↔ 고객 연결 기록</span><span>시연용</span></div>
        <ol id="lv-log"><li class="empty">귀띔 화면에서 고객을 골라 발송해 보세요. 고객 폰에 바로 도착해요.</li></ol></div>
    </aside>`);
    frame = $('#lv .lv-frame');
    $('#lv-x').onclick = () => set(false);
  }

  function set(v) {
    on = v;
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
    document.body.classList.toggle('live', v);
    $('#lv').hidden = !v;
    if (v && !frame.dataset.loaded) {   // 한 파일 버전(dist)에서는 SAILOG_SETFRAME 이 내장 페이지를 srcdoc 으로 띄움
      ready = false; frame.dataset.loaded = '1';
      if (window.SAILOG_SETFRAME) SAILOG_SETFRAME(frame, 'customer.html?embed&mini'); else frame.setAttribute('src', 'customer.html?embed&mini');
    }
  }

  /* PB → 고객: 귀띔 발송 (index.html send) */
  function onSend(ids, tpl) {
    if (!on || !ids.length || !window.SAILOG_CX) return;
    const c = SAILOG.byId(ids[0]); if (!c) return;
    const p = SAILOG_CX.fromTemplate(c, tpl);
    log('pb', `<b>${esc(c.name)}</b> 님에게 '${esc(p.tplName)}' 귀띔 발송${ids.length > 1 ? ` <small>외 ${ids.length - 1}명</small>` : ''}`);
    log('sys', `${esc(c.name)} 님 계좌 숫자로 채워서 카카오톡 전달`);
    who(`${c.name} 님`);
    lastKind = '귀띔';
    pending = { sailogPersona: p, flow: p.flow, live: true };
    post();
  }

  /* PB → 고객: AI 펀드 매칭의 '카카오 메시지로 안내' (fund.js 가 보내는 sailog:fundsent 이벤트)
     문구는 fund.js fundMsg 와 같은 구성: (광고) 표기 · 개요 · PB 한마디 · 필수 고지 · 권유 버튼 없음 */
  let lastKind = '귀띔';
  function onFund(det) {
    if (!on || !window.SAILOG_FUND) return;
    const c = SAILOG.byId(det.id), f = SAILOG_FUND.byId(det.fid); if (!c || !f) return;
    const sent = SAILOG_FUND.sentLog(c.id)[0] || {};
    const G = SAILOG_FUND.GRADE || {};
    const p = { flow: 'info', custId: c.id, name: c.name, tpl: 'fund', tplName: '펀드 정보 안내', label: `펀드 안내 · ${f.name}`,
      msg: { tag: '친구톡 · 광고', title: `(광고) ${f.name} 상품 정보`,
        body: `${c.name} 고객님, 공모펀드 정보를 전해 드려요.\n\n${sent.memo ? sent.memo + '\n\n' : ''}가입을 생각하신다면 투자설명서와 위험 내용을 담당 PB와 함께 먼저 확인해 주세요. 궁금하신 점은 편하실 때 연락 주세요.`,
        rows: [['유형', `${f.type} · ${f.cls}클래스`], ['위험등급', `${f.grade}등급 ${G[f.grade] || ''}`], ['총보수', `연 ${f.fee.toFixed(2)}%`], ['과거 1년 수익률', `${f.r1 >= 0 ? '+' : ''}${f.r1.toFixed(1)}% (가상)`]],
        notice: '집합투자증권은 예금자보호법에 따라 보호되지 않으며, 운용 결과에 따라 원금 손실이 발생할 수 있습니다. 과거 수익률은 미래 수익을 보장하지 않습니다. 가입 전 투자설명서를 반드시 읽어 보시기 바랍니다. (시연용)',
        buttons: ['투자설명서 보기', 'PB 상담 요청'] } };
    log('pb', `<b>${esc(c.name)}</b> 님에게 '${esc(f.name)}' 펀드 정보 안내`);
    log('sys', '투자성향 적합 · 필수 고지 포함 확인 후 카카오 메시지 전달');
    who(`${c.name} 님`);
    lastKind = '펀드 안내 메시지';
    pending = { sailogPersona: p, flow: 'info', live: true };
    post();
  }

  /* 고객 → PB */
  function onCustomer(d) {
    const name = esc(d.name);
    if (d.type === 'open') log('cu', `<b>${name}</b> 님이 ${lastKind}를 열어 자세히 보고 있어요`);
    if (d.type === 'check') log('cu', `${name} 님이 CMA 상품 설명을 확인했어요`);
    if (d.type === 'cma-done') {
      log('cu', `<b>${name}</b> 님이 <b>${man(d.amt)}</b>을 CMA로 옮겼어요`);
      if (H.isOpen && H.isOpen(d.custId)) {
        H.markDone(d.custId);
        log('sys', `PB 오늘 할 일에서 ${name} 님 건을 완료로 바꿨어요`);
      }
      H.toast(`${d.name} 님이 ${man(d.amt)}을 CMA로 옮겼어요 · 오늘 할 일 완료`, H.undo ? '되돌리기' : undefined, H.undo ? () => H.undo(d.custId) : undefined);
    }
    if (d.type === 'appt') {
      log('cu', `<b>${name}</b> 님이 상담 시간을 <b>${esc(d.slot)}</b>로 정했어요`);
      log('sys', `PB 일정에 '고객 확정' ${d.visit ? '방문' : '전화'} 상담으로 등록`);   // 알림은 calendar.js(storage 이벤트)가 띄움 — 겹치지 않게 여기선 기록만
    }
    if (d.type === 'ask') {
      log('cu', `<b>${name}</b> 님이 ${esc(d.from || '귀띔')}에서 PB 상담을 요청했어요`);
      const t = new Date(), hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      SAILOG.CALLS.addManual({ date: SAILOG.CALLS.TODAY_ISO, time: hm, kind: 'callback', custId: d.custId,
        title: `${d.name} · 고객 상담 요청`, note: `고객이 ${d.from || '귀띔'}에서 상담을 요청 · 오늘 중 연락` });
      if (H.refreshCal) H.refreshCal();
      log('sys', 'PB 오늘 일정에 \'고객 상담 요청\' 연락으로 등록');
      H.toast(`${d.name} 님이 상담을 요청했어요 · 오늘 일정에 등록`, H.call ? '전화하기' : undefined, H.call ? () => H.call(d.custId) : undefined);
    }
  }

  /* 통화 종료 (index.html 통화 종료 · 요약 생성): 고객에게는 아무것도 보내지 않음.
     통화 요약은 PB 기록용 AI 초안이라 고객에게 보내지 않고, 잡힌 약속만 전날 일정 알림으로 나간다는 것을 기록에 남김 */
  function onCall(rec) {
    if (!on || !rec || !rec.customer) return;
    const c = rec.customer;
    log('pb', `<b>${esc(c.name)}</b> 님과 통화 종료 · 요약 저장`);
    const appt = (rec.schedule || []).find(s => (s.kind === 'callback' || s.kind === 'visit') && s.date > rec.date);
    if (appt) {
      const [, m, dd] = appt.date.split('-').map(Number);
      const prev = new Date(2026, m - 1, dd - 1);
      log('sys', `${m}/${dd}${appt.time ? ' ' + appt.time : ''} ${esc(appt.title)} 일정 등록 · ${prev.getMonth() + 1}/${prev.getDate()} 오후 6시에 고객에게 일정 알림 예정`);
    }
    log('sys', '통화 요약은 PB 기록용이라 고객에게 보내지 않아요');
  }

  function init(hooks) {
    H = hooks || {};
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    build();
    // 사이드바 '고객 경험' 그룹 아래 토글 (nav-item 클릭 바인딩이 끝난 뒤 붙이므로 show() 와 무관)
    const anchor = document.querySelector('.nav-item[data-view="cx"]');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'nav-item lv-toggle';
    btn.innerHTML = '<span class="ico">📡</span>시연 모드<span class="lv-sw" aria-hidden="true"></span>';
    btn.setAttribute('aria-label', '시연 모드: PB 작업과 고객 폰을 함께 보기');
    btn.onclick = () => set(!on);
    if (anchor) anchor.after(btn);
    window.addEventListener('message', (e) => {
      if (!frame || e.source !== frame.contentWindow) return;
      const d = e.data || {};
      if (d.sailogReady) { ready = true; post(); }
      if (d.sailogLive) onCustomer(d.sailogLive);
    });
    window.addEventListener('sailog:fundsent', (e) => onFund(e.detail || {}));
    // 기본값 켜짐: 시연에서 고객 폰이 처음부터 보이게. PB가 직접 끈 경우('0')만 꺼진 채로 시작
    let saved = true; try { saved = localStorage.getItem(KEY) !== '0'; } catch (e) {}
    if (saved && window.innerWidth > 760) set(true);
  }

  return { init, onSend, onCall, set };
})();
