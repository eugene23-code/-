/* ============================================================
   사이로그 — 고객 경험 탭 (#view=cx)
   PB 워크스페이스 안에서 고객이 보는 화면(customer.html)과 서비스 소개(landing.html)를 띄운다.
   사용: index.html 에 nav 버튼(data-view="cx") + <section id="view-cx"> + show() 훅,
         CAL.init 뒤에 SAILOG_CX.init({ show }).
   진입 버튼 3곳(알림톡 미리보기 · 일정 사이드 · AI 펀드 매칭)은 MutationObserver 로 붙여서
   index.html 의 렌더 코드는 건드리지 않는다.
   2단계: 알림톡 화면에서 고른 고객·템플릿, 일정의 통화 약속(실시간 통화로 새로 잡힌 약속 포함)을 페르소나로 만들어
         postMessage { sailogPersona, flow } 로 customer.html 에 넘긴다. 페르소나가 없으면 이도윤 님 기본 시나리오.
   ============================================================ */
window.SAILOG_CX = (() => {
  const TABS = [
    { id: 'cma', name: '예수금 → CMA', src: 'customer.html?embed#cma', note: '알림톡을 받은 고객이 예수금을 확인하고 CMA로 옮기기까지' },
    { id: 'call', name: '상담 전날 알림', src: 'customer.html?embed#call', note: '통화에서 잡힌 약속이 전날 고객에게 알림톡으로 가고, 고객이 시간을 정하기까지' },
    { id: 'info', name: '안내 알림톡', src: 'customer.html?embed#info', note: '알림톡의 숫자를 확인하고 PB 상담을 예약하기까지', personaOnly: true },
    // '서비스 소개'(landing.html)는 플랫폼에 들어오기 전에 반드시 거치므로 탭에서 뺌. 사이드바 '소개 보기'로만 다시 볼 수 있음
  ];
  const DEFAULT_CUST = 125; // 이도윤 (customer.html 기본 시나리오)
  let cur = 'cma', anchor = '', show = null, persona = null, evMap = {}, calSig = '';

  const CSS = `
  .nav-group { font-size: 11.5px; font-weight: 700; color: var(--fg3); padding: 16px 12px 4px; margin-top: 8px; border-top: 1px solid var(--line); }
  @media (max-width: 760px) { .nav-group { display: none; } }
  .cx-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .cx-seg { display: flex; gap: 4px; background: var(--surface); padding: 4px; border-radius: 12px; box-shadow: var(--shadow); }
  .cx-seg button { height: 34px; padding: 0 14px; border-radius: 9px; font-weight: 700; font-size: 13px; color: var(--fg3); }
  .cx-seg button.on { background: var(--brand); color: #fff; }
  .cx-who { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 99px; background: var(--brand-tint); color: var(--brand); font-size: 12.5px; font-weight: 700; }
  .cx-who.def { background: var(--gray-tint); color: var(--fg2); }
  .cx-who[hidden] { display: none; }
  .cx-note { color: var(--fg2); font-size: 13px; flex: 1; min-width: 200px; }
  .cx-frame { display: block; width: 100%; border: 0; border-radius: var(--r); background: var(--bg); height: 900px; }
  .cx-frame.intro { height: max(640px, calc(100vh - 150px)); background: var(--surface); box-shadow: var(--shadow); }
  .cx-entry { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; padding: 12px 14px; border-radius: var(--r-sm); background: var(--brand-tint); font-size: 13px; color: var(--fg2); }
  .cx-entry b { color: var(--fg); }
  .cx-entry span { flex: 1; min-width: 180px; }
  .cx-entry .btn { background: var(--surface); color: var(--brand); }
  .cx-entry.card { flex-direction: column; align-items: stretch; margin: 0; padding: 18px; }
  .cx-entry.card .btn { align-self: flex-start; }
  .cx-evs { display: flex; flex-direction: column; gap: 6px; }
  .cx-ev { display: flex; gap: 10px; align-items: center; text-align: left; width: 100%; padding: 10px 12px; border-radius: 10px; background: var(--surface); font-size: 12.5px; color: var(--fg2); }
  .cx-ev:hover { box-shadow: inset 0 0 0 1.5px var(--brand); }
  .cx-ev time { flex: none; font-weight: 800; color: var(--brand); font-variant-numeric: tabular-nums; }
  .cx-ev span { min-width: 0; }
  .cx-ev b { display: block; color: var(--fg); font-size: 13px; }
  `;

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const tab = (id) => TABS.find(t => t.id === id) || TABS[0];
  const srcOf = (t) => t.src + (t.id === 'intro' && anchor ? '#' + anchor : '');

  /* ---------- 페르소나 만들기 ---------- */
  // 알림톡 템플릿 + 고객 → CMA·입금은 CMA 옮기기 흐름, 나머지는 '안내 → 상담 예약' 흐름
  function fromTemplate(c, k) {
    const T = SAILOG.TEMPLATES[k], m = T.build(c);
    const base = { custId: c.id, name: c.name, tpl: k, tplName: T.name, label: T.name,
      msg: { title: m.title, body: m.body, rows: m.info || [], buttons: m.buttons || ['자세히 보기'] } };
    if (k === 'cma' || k === 'deposit') return { ...base, flow: 'cma', cash: c.cash, idle: c.idle || 0, rCma: SAILOG.RATES.cma, rDep: SAILOG.RATES.deposit };
    return { ...base, flow: 'info' };
  }
  // 일정의 통화 약속(callback · visit) → 상담 전날 알림 흐름. 지난 통화의 고객 발화를 '하신 말씀'으로
  function fromEvent(ev) {
    const c = SAILOG.byId(ev.custId); if (!c || c.id === DEFAULT_CUST) return null;
    const r = ev.callId && SAILOG.CALLS.byId(ev.callId);
    const said = r ? r.lines.filter(l => l.who === '고객' && l.text.length >= 14).map(l => l.text).slice(0, 3) : [];
    const topic = ev.title.replace(/^.*? · /, '');
    const agenda = r && r.meta ? [r.meta.subtype, r.meta.product].filter(Boolean) : [topic];
    return { flow: 'call', custId: c.id, name: c.name, label: topic, cash: c.cash, idle: c.idle || 0,
      call: { date: ev.date, time: ev.time || '14:00', visit: ev.kind === 'visit', topic, fromCall: r ? r.date : null, said, agenda } };
  }
  const activeTpl = () => { const b = $('#tpl-list .tpl.active'); return b ? b.dataset.k : 'cma'; };
  const activeRecipient = () => { const el = $('#recip-list .recip-item.active') || $('#recip-list .recip-item'); return el ? Number(el.dataset.id) : null; };

  /* ---------- 탭 그리기 ---------- */
  function post() {
    const f = $('#view-cx .cx-frame');
    if (f && f.contentWindow && cur !== 'intro') f.contentWindow.postMessage({ sailogPersona: persona, flow: cur }, '*');
  }
  function render() {
    const sec = $('#view-cx'); if (!sec) return;
    const t = tab(cur);
    if (!$('.cx-frame', sec)) {
      sec.innerHTML = `<div class="cx-head"><div class="cx-seg" role="group" aria-label="고객 화면 종류"></div>
        <span class="cx-who"></span><span class="cx-note"></span><a class="btn sm cx-out" target="_blank" rel="noopener">새 창으로 열기 ↗</a></div>
        <iframe class="cx-frame" title="고객이 보는 화면 (시연용 가상)"></iframe>`;
    }
    $('.cx-seg', sec).innerHTML = TABS.filter(x => !x.personaOnly || cur === x.id).map(x => `<button type="button" data-cx="${x.id}" class="${x.id === cur ? 'on' : ''}">${x.name}</button>`).join('');
    const who = $('.cx-who', sec);
    who.hidden = cur === 'intro';
    who.classList.toggle('def', !persona);
    who.textContent = persona ? `${persona.name} 님 · ${persona.label}` : '기본 시나리오 · 이도윤 님';
    $('.cx-note', sec).textContent = t.note;
    $('.cx-out', sec).href = srcOf(t).replace('?embed', '');
    const f = $('.cx-frame', sec), src = srcOf(t);
    f.classList.toggle('intro', t.id === 'intro');
    // 새로 뜨면 sailogReady 를 받고 post(). 한 파일 버전(dist)에서는 SAILOG_SETFRAME 이 내장 페이지를 srcdoc 으로 띄움
    if (window.SAILOG_SETFRAME) SAILOG_SETFRAME(f, src); else if (f.getAttribute('src') !== src) f.setAttribute('src', src);
    post();
  }

  function open(id, a, p) {
    persona = p || null;
    cur = tab(id).id; if (tab(cur).personaOnly && !persona) cur = 'cma';
    anchor = a || '';
    show ? show('cx') : render();
  }

  /* ---------- 진입 버튼 (다시 그려져도 한 번만 붙음) ---------- */
  function calendarCard() {
    const side = $('.cal-side'); if (!side) return;
    // 1:1 상담 약속만 (세미나 참석은 시간 변경 대상이 아니라 제외)
    const evs = SAILOG.CALLS.upcoming(30).filter(e => e.custId && e.time && (e.kind === 'callback' || e.kind === 'visit') && !e.manual && !/세미나/.test(e.title)).slice(0, 4);   // 직접 추가·고객 요청 건 제외
    const sig = evs.map(e => e.id + e.date + e.time).join('|');
    let card = $('.cx-entry.card', side);
    if (card && sig === calSig) return;
    calSig = sig; evMap = {}; evs.forEach(e => { evMap[e.id] = e; });
    const when = (e) => { const [, m, d] = e.date.split('-'); return `${+m}/${+d} ${e.time}`; };
    const html = `<b>고객에게도 전날 알림이 가요</b><span>통화에서 잡힌 약속은 하루 전에 고객에게 알림톡으로 일정과 이야기할 내용을 보내요. 약속을 누르면 그 고객의 폰 화면이 열려요.</span>
      <div class="cx-evs">${evs.map(e => `<button type="button" class="cx-ev" data-cx-ev="${esc(e.id)}"><time>${when(e)}</time><span><b>${esc(e.title.split(' · ')[0])}</b>${esc(e.title.replace(/^.*? · /, ''))}</span></button>`).join('') || '<span>다가오는 통화 약속이 없어요.</span>'}</div>`;
    if (!card) side.insertAdjacentHTML('beforeend', `<div class="dt-card cx-entry card">${html}</div>`);
    else card.innerHTML = html;
  }
  function decorate() {
    const pv = $('#send-preview');
    if (pv && pv.children.length && !$('.cx-entry', pv)) {
      pv.insertAdjacentHTML('beforeend', `<div class="cx-entry"><span><b>고객은 이 알림톡을 받고 어떻게 움직일까요?</b><br>선택한 고객의 이름과 금액 그대로 보여드려요.</span><button type="button" class="btn sm" data-cx-tpl>이 고객의 폰에서 보기 →</button></div>`);
    }
    document.querySelectorAll('#view-detail .fd-note').forEach(n => {
      if (n.nextElementSibling && n.nextElementSibling.classList.contains('cx-entry')) return;
      n.insertAdjacentHTML('afterend', `<div class="cx-entry"><span>카카오 메시지로 안내하면 고객 폰에 <b>(광고) 펀드 정보</b>로 도착해요. 시연 모드를 켜고 보내 보세요.</span><button type="button" class="btn sm" data-cx-live>시연 모드 켜기 →</button></div>`);
    });
    calendarCard();
  }

  function init(opts) {
    show = opts.show;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    // 사이드바 '고객 경험' 라벨 옆: 소개 페이지(고객 편 → PB 편)로 돌아가는 링크
    const grp = $('.nav-group');
    // 소개는 워크스페이스 상단 '서비스 소개' 탭(#view-intro)에서 열린다
    if (grp && !$('.nav-intro', grp)) grp.insertAdjacentHTML('beforeend', ' <a class="nav-intro" href="#" style="float:right;font-weight:600;color:var(--fg3)">소개 보기</a>');
    const ni = $('.nav-intro'); if (ni) ni.onclick = (e) => { e.preventDefault(); if (show) show('intro'); };
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cx],[data-cx-tpl],[data-cx-ev],[data-cx-live]'); if (!b) return;
      if (b.hasAttribute('data-cx-live')) { if (window.SAILOG_LIVE) SAILOG_LIVE.set(true); return; }
      if (b.hasAttribute('data-cx-tpl')) {
        const c = SAILOG.byId(activeRecipient());
        if (!c) return open('cma');
        const p = fromTemplate(c, activeTpl());
        return open(p.flow, '', p);
      }
      if (b.dataset.cxEv) { const ev = evMap[b.dataset.cxEv]; return open('call', '', ev ? fromEvent(ev) : null); }
      open(b.dataset.cx, b.dataset.anchor, null);
    });
    window.addEventListener('message', (e) => {
      const d = e.data || {};
      const f = $('#view-cx .cx-frame');
      if (d.sailogReady) return f && e.source === f.contentWindow ? post() : null;   // 이 탭의 customer.html 이 새로 뜸 → 페르소나 전달 (시연 모드 폰은 live.js 몫)
      if (TABS.some(t => t.id === d.sailogCx)) open(d.sailogCx);               // landing.html(embed) 안의 '고객 화면' 링크
    });
    let q = 0;
    const mo = new MutationObserver(() => { if (!q) q = requestAnimationFrame(() => { q = 0; decorate(); }); });
    const root = $('.content'); if (root) mo.observe(root, { childList: true, subtree: true });
    decorate();
  }

  return { init, render, open, fromTemplate, fromEvent };
})();
