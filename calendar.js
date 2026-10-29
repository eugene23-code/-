/* ============================================================
   귀띔 — 일정(캘린더) · 통화 요약 · 고객 상세 통화 기록(준법 포함)
   - 일정 화면: 고객과의 약속·할 일만 표시 (통화 기록·세미나·준법 내용은 표시하지 않음)
   - 준법 점검: 고객 상세페이지의 '통화 기록' 카드와 통화 요약 모달에서만 표시
   index.html 의 앱 스크립트가 CAL.init(hooks) 로 연결. 데이터·분석은 calls.js(SAILOG.CALLS).
   ============================================================ */
const CAL = (() => {
  const { esc } = UI;
  const C = SAILOG.CALLS;
  const { byId, fmtDate, TODAY } = SAILOG;
  const $ = (s, el = document) => el.querySelector(s);
  const KIND = {
    callback: { l: '전화',     c: '#D8201F' },
    visit:    { l: '방문',     c: '#7C3AED' },
    doc:      { l: '자료 발송', c: '#0E9F8E' },
    followup: { l: '할 일',    c: '#E8930C' },
    maturity: { l: '만기',     c: '#2563EB' },
    deadline: { l: '마감',     c: '#B5151A' },
    birthday: { l: '생신',     c: '#EC4899' },
    manual:   { l: '일정',     c: '#4E5968' },
    seminar:  { l: '세미나',   c: '#14A36B' },
    call:     { l: '통화',     c: '#8B95A1' },
  };
  const K = (k) => KIND[k] || KIND.manual;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const TODAY_ISO = C.TODAY_ISO;
  const dateOf = (s) => new Date(s + 'T09:00:00+09:00');
  const longDate = (s) => { const d = dateOf(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일`; };
  const dur = (sec) => `${Math.floor(sec / 60)}분 ${sec % 60}초`;
  const relDay = (s) => { const n = Math.round((dateOf(s) - dateOf(TODAY_ISO)) / 86400000); return n === 0 ? '오늘' : n === 1 ? '내일' : n === -1 ? '어제' : n > 0 ? `D-${n}` : `${-n}일 전`; };
  const noFlagText = (s) => s.replace(/\s*⚠\s*준법[^.]*\.?\s*/g, ' ').trim();

  /* 캘린더에 올리는 것 = 고객과의 약속 · PB 할 일 (지난 통화 기록, 센터 세미나 제외) */
  /* 상단 '고객 이름 검색' 입력값으로 일정 거르기: 일정 화면에서는 고객 탭으로 넘어가지 않고 해당 고객 일정만 남김 */
  const qv = () => { const el = document.getElementById('q'); return el ? el.value.trim() : ''; };
  const matchQ = (e, q = qv()) => { if (!q) return true; const c = e.custId ? byId(e.custId) : null; return c ? c.name.includes(q) : e.title.includes(q); };
  const isTodo = (e) => e.kind !== 'call' && e.kind !== 'seminar';
  const todosOn = (date) => C.eventsOn(date).filter(e => isTodo(e) && matchQ(e));
  const searchHits = () => C.events().filter(e => isTodo(e) && matchQ(e)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const whatOf = (e) => { const c = e.custId ? byId(e.custId) : null; return c ? e.title.replace(new RegExp(`^${c.name}( 고객)?( · )?`), '') || K(e.kind).l : e.title; };

  let hooks = {}; let cur = { y: TODAY.getFullYear(), m: TODAY.getMonth() }; let sel = TODAY_ISO; let lastModal = null;

  /* ---------- 일정 화면 ---------- */
  function render() { renderGrid(); renderAgenda(); refreshBadges(); }
  function renderGrid() {
    $('#cal-title').textContent = `${cur.y}년 ${cur.m + 1}월`;
    const first = new Date(cur.y, cur.m, 1); const start = new Date(first); start.setDate(1 - first.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const isoD = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const ev = todosOn(isoD); const out = d.getMonth() !== cur.m;
      cells.push(`<div class="cal-cell ${out ? 'out' : ''} ${isoD === TODAY_ISO ? 'today' : ''} ${isoD === sel ? 'sel' : ''} ${d.getDay() === 0 ? 'sun' : ''}" data-day="${isoD}">
        <div class="cal-d"><span>${d.getDate()}</span></div>
        ${ev.slice(0, 3).map(e => { const c = e.custId ? byId(e.custId) : null; return `<div class="cal-ev" data-ev="${esc(e.id)}" style="--k:${K(e.kind).c}" title="${esc((e.time ? e.time + ' ' : '') + e.title)}">${esc(c ? c.name : whatOf(e))}</div>`; }).join('')}
        ${ev.length > 3 ? `<div class="cal-more">+${ev.length - 3}</div>` : ''}</div>`);
    }
    $('#cal-grid').innerHTML = WD.map(w => `<div class="cal-wd">${w}</div>`).join('') + cells.join('');
  }
  /* 약속 = 고객과 만나거나 연락하기로 한 것 / 할 일 = PB가 처리할 것 */
  const isPromise = (e) => e.kind === 'visit' || e.kind === 'callback';
  function renderAgenda() {
    const q = qv();
    if (q) {   // 검색 중: 선택한 날짜 대신 해당 고객의 전체 일정을 날짜 순으로
      const hits = searchHits(); const names = [...new Set(hits.map(e => e.custId && byId(e.custId)).filter(Boolean).map(c => c.name))];
      $('#agenda-title').innerHTML = `‘${esc(q)}’ 일정 <span>${hits.length}건${names.length ? ' · ' + esc(names.join(', ')) : ''}</span> <button class="btn sm" data-q-clear style="margin-left:auto">검색 지우기</button>`;
      $('#agenda').innerHTML = hits.length
        ? hits.map(e => `<div class="ag-date${e.date === sel ? ' on' : ''}" data-day="${e.date}" style="font-size:12px;font-weight:700;color:var(--fg3);margin:10px 0 2px;cursor:pointer">${e.date.slice(0, 4) !== TODAY_ISO.slice(0, 4) ? e.date.slice(0, 4) + '년 ' : ''}${longDate(e.date)} · ${relDay(e.date)}</div>${agRowHTML(e)}`).join('')
        : '<div class="dt-empty" style="padding:10px 0">이 고객의 약속·할 일이 없어요.</div>';
      return;
    }
    const ev = todosOn(sel);
    const P = ev.filter(isPromise), T = ev.filter(e => !isPromise(e));
    const group = (label, list) => list.length ? `<div class="ag-group"><div class="ag-gl">${label} <span>${list.length}</span></div>${list.map(agRowHTML).join('')}</div>` : '';
    $('#agenda-title').innerHTML = `${longDate(sel)} <span>${relDay(sel)}</span>`;
    $('#agenda').innerHTML = ev.length ? group('약속', P) + group('할 일', T) : '<div class="dt-empty" style="padding:10px 0">일정이 없어요.</div>';
  }
  function agRowHTML(e) {
    const c = e.custId ? byId(e.custId) : null;
    return `<div class="ag ${e.date < TODAY_ISO ? 'done' : ''}" data-ev="${esc(e.id)}">
      <div class="ag-t num">${e.time || '종일'}</div>
      <div class="ag-b">
        <div class="ag-title">${c ? `<b>${esc(c.name)}</b> ` : ''}<span class="ag-k" style="--k:${K(e.kind).c}">${esc(whatOf(e))}</span>${e.confirmed ? '<span class="pill ok">고객 확정</span>' : ''}${e.manual ? `<button class="ag-del" data-ev-del="${e.id}" aria-label="삭제">×</button>` : ''}</div>
        ${e.note ? `<div class="ag-note">${esc(e.note)}</div>` : ''}
      </div></div>`;
  }

  /* ---------- 일정 요약 팝업 ----------
     일정을 누르면 고객 상세로 바로 넘어가지 않고, 이 일정의 핵심(언제·무엇·누구·왜 잡혔는지·준비할 것)을 먼저 보여준다. */
  const EV_CSS = `
  .evp { display: flex; flex-direction: column; gap: 14px; }
  .evp-top { display: flex; gap: 14px; align-items: flex-start; }
  .evp-when { flex: none; width: 64px; text-align: center; border-radius: 14px; background: var(--surface2); padding: 8px 0 9px; }
  .evp-when small { display: block; font-size: 11px; font-weight: 700; color: var(--brand); }
  .evp-when b { display: block; font-size: 24px; font-weight: 800; line-height: 1.15; letter-spacing: -.03em; }
  .evp-when span { font-size: 11px; color: var(--fg3); }
  .evp-h { flex: 1; min-width: 0; }
  .evp-h .tags { margin: 0 0 6px; display: flex; gap: 6px; flex-wrap: wrap; }
  .evp-h h4 { font-size: 18px; font-weight: 800; line-height: 1.35; margin: 0; }
  .evp-h p { font-size: 13px; color: var(--fg2); margin: 4px 0 0; }
  .evp-sec { background: var(--surface2); border-radius: 12px; padding: 12px 14px; }
  .evp-sec h5 { font-size: 12px; font-weight: 700; color: var(--fg3); margin: 0 0 8px; display: flex; justify-content: space-between; gap: 8px; }
  .evp-sec h5 span { font-weight: 500; }
  .evp-sec p { font-size: 13.5px; line-height: 1.55; margin: 0; }
  .evp-sec ul { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.65; }
  .evp-cust { display: flex; align-items: center; gap: 12px; }
  .evp-cust .meta { font-size: 12px; color: var(--fg3); }
  .evp-other { display: grid; grid-template-columns: 92px 1fr; gap: 8px; font-size: 13px; padding: 4px 0; cursor: pointer; }
  .evp-other:hover span { color: var(--brand); }
  .evp-other i { font-style: normal; color: var(--fg3); }
  .evp-acts { display: flex; gap: 8px; flex-wrap: wrap; }
  .evp-acts .btn { flex: 1; }
  .cal-ev { cursor: pointer; }`;
  function eventHTML(e) {
    const c = e.custId ? byId(e.custId) : null;
    const rec = e.callId ? C.byId(e.callId) : null; const m = rec && rec.meta;
    const d = dateOf(e.date);
    const past = e.date < TODAY_ISO;
    const kindTag = `<span class="pill" style="background:color-mix(in srgb, ${K(e.kind).c} 12%, #fff);color:${K(e.kind).c}">${isPromise(e) ? '약속' : '할 일'} · ${K(e.kind).l}</span>`;
    const status = e.confirmed ? '<span class="pill ok">고객 확정</span>' : past ? '<span class="pill">지난 일정</span>' : '';
    const why = e.confirmed ? `고객이 귀띔에서 직접 ${e.note && e.note.includes('바꿔') ? '시간을 바꿔 ' : ''}확정한 상담이에요.`
      : rec ? `${fmtDate(rec.date)} ${rec.time} ${rec.dir} 통화에서 잡힌 ${isPromise(e) ? '약속' : '할 일'}이에요.`
      : e.source === '직접 등록' ? 'PB가 직접 추가한 일정이에요.'
      : `${e.source || '원장'}에서 자동으로 올라온 일정이에요.`;
    // 통화에서 이 날짜를 언급한 PB 발화 (약속을 실제로 어떻게 말했는지)
    const md = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    const said = rec ? rec.lines.find(l => l.who === 'PB' && l.text.includes(md)) || null : null;
    const brief = m && m.briefing ? m.briefing.split(/\s+\/\s+/).slice(0, 5) : [];
    const others = c ? C.events().filter(x => x.custId === c.id && x.id !== e.id && isTodo(x) && x.date >= TODAY_ISO).slice(0, 3) : [];
    return `<div class="evp">
      <div class="evp-top">
        <div class="evp-when"><small>${d.getMonth() + 1}월</small><b>${d.getDate()}</b><span>${WD[d.getDay()]}요일</span></div>
        <div class="evp-h"><div class="tags">${kindTag}${status}<span class="pill">${relDay(e.date)}</span></div>
          <h4>${c ? esc(c.name) + ' · ' : ''}${esc(whatOf(e))}</h4>
          <p>${e.time ? `${e.time} · ` : '종일 · '}${esc(why)}</p></div>
      </div>
      ${e.note && !e.auto ? `<div class="evp-sec"><h5>${isPromise(e) ? '약속 내용' : '할 일 내용'}</h5><p>${esc(e.note)}</p></div>` : ''}
      ${m ? `<div class="evp-sec"><h5>이 일정이 나온 통화 <span>${fmtDate(rec.date)} ${rec.time} · ${rec.dir}</span></h5>
          <p><b>${esc(m.subtype)}</b>${m.product && !/대면 미팅/.test(m.product) ? ` · ${esc(m.product)}` : ''}</p>
          <p style="margin-top:4px">결과: ${esc(m.result)}</p>
          ${said ? `<p style="margin-top:8px;color:var(--fg2)">“${esc(said.text.length > 120 ? said.text.slice(0, 118) + '…' : said.text)}”</p>` : ''}</div>` : ''}
      ${brief.length && !past ? `<div class="evp-sec"><h5>챙겨갈 내용 <span>통화 전 브리핑</span></h5><ul>${brief.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>` : ''}
      ${c ? `<div class="evp-sec"><h5>고객</h5><div class="evp-cust"><div class="avatar">${c.initial}</div><div><b>${esc(c.name)}</b>${c.title && c.title !== c.name + ' 고객님' ? ` <span class="muted" style="font-size:12px">${esc(c.title)}</span>` : ''}<div class="meta">${c.corp ? '법인 · ' : `${c.age}세 · `}${esc(c.risk)} · ${c.phone}${c.memo ? ` · ${esc(c.memo)}` : ''}</div></div></div></div>` : ''}
      ${others.length ? `<div class="evp-sec"><h5>이 고객의 다음 일정</h5>${others.map(x => `<div class="evp-other" data-ev="${esc(x.id)}"><i>${x.date.slice(0, 4) !== TODAY_ISO.slice(0, 4) ? x.date.slice(2, 4) + '년 ' : ''}${fmtDate(x.date)}${x.time ? ' ' + x.time : ''}</i><span>${esc(whatOf(x))}</span></div>`).join('')}</div>` : ''}
      <div class="evp-acts">
        ${rec ? `<button class="btn" data-call="${rec.id}">통화 내용 보기</button>` : ''}
        ${c ? `<button class="btn dark" data-detail="${c.id}">고객 상세 보기</button>` : ''}
        <button class="btn" data-close>닫기</button>
      </div></div>`;
  }
  function openEvent(id) {
    const e = C.events().find(x => x.id === id); if (!e) return;
    lastModal = { type: 'event', id };
    hooks.openModal(eventHTML(e), '일정 요약', 'narrow');
  }

  /* ---------- 통화 요약 (모달) — 준법 점검 포함 ---------- */
  function flagsHTML(F) {
    return F.map(f => `<div class="flag sev${f.sev} ${f.acked ? 'acked' : ''}">
      <div class="flag-top"><b>⚠ ${esc(f.label)}</b><span class="pill ${f.sev === 3 ? 'pri-3' : 'pri-2'}">${f.sev === 3 ? '위반 소지' : '주의'}</span>${f.acked ? '<span class="pill ok">검토 완료</span>' : `<button class="btn sm dark flag-ack" data-ack="${f.key}">검토 완료</button>`}</div>
      <div class="flag-q">“${f.phrases.map(esc).join('”, “')}” <span class="muted flag-law">${esc(f.law)}</span></div>
      <div class="flag-fix">${esc(f.fix)}</div></div>`).join('');
  }
  function callHTML(rec, { fresh = false } = {}) {
    const c = rec.customer; const future = rec.schedule.filter(s => !(s.date === rec.date && s.kind === 'doc'));
    const F = C.flags({ custId: c.id }).filter(f => f.call.id === rec.id);
    return `<div class="cs">
      <div class="cs-head"><div class="avatar">${c.initial}</div><div><b>${esc(c.name)}</b> <span class="muted" style="font-size:12px">${c.age}세 · ${esc(c.risk)}</span><div class="muted" style="font-size:12px">${fmtDate(rec.date)} ${rec.time} · ${rec.dir} · ${dur(rec.dur)}</div></div>
        <span class="pill ${rec.flags.length ? 'pri-3' : 'ok'}" style="margin-left:auto">${rec.flags.length ? `준법 주의 ${rec.flags.length}건` : '준법 이상 없음'}</span></div>
      <div class="ai"><div class="lbl">◆ 통화 요약 (AI 초안)</div>${esc(noFlagText(rec.summary))}</div>
      ${F.length ? `<div class="cs-sec"><h4>준법 점검</h4>${flagsHTML(F)}</div>` : ''}
      ${future.length ? `<div class="cs-sec"><h4>캘린더 ${fresh ? '자동 ' : ''}등록 <span>${future.length}건</span></h4>${future.map(s => `<div class="cs-ev"><i style="background:${K(s.kind).c}"></i><b class="num">${fmtDate(s.date)}${s.time ? ' ' + s.time : ''}</b><span>${esc(s.title)}</span></div>`).join('')}</div>` : ''}
      <details class="cs-tr" ${rec.flags.length ? 'open' : ''}><summary>전체 대화 ${rec.lines.length}문장</summary>
        <div class="stt-lines static">${rec.lines.map((l, i) => `<div class="stt-line ${l.who === 'PB' ? 'pb' : 'cu'} ${rec.flags.some(f => f.line === i) ? 'flagged' : ''}"><span class="who">${l.who}</span><span>${C.highlight(rec, i)}</span></div>`).join('')}</div></details>
    </div>`;
  }
  function openCall(id, opts = {}) {
    const rec = C.byId(id); if (!rec) return;
    lastModal = { type: 'call', id, opts };
    hooks.openModal(callHTML(rec, opts) + (opts.fresh ? `<div class="call-actions"><button class="btn lg block" data-close>닫기</button><button class="btn lg block primary" data-complete="${rec.cust}">할 일 완료 처리</button></div>` : ''), opts.fresh ? '통화 종료 · 요약 저장' : '통화 요약');
  }

  /* ---------- 고객 상세페이지: 통화 기록 카드 (요약 + 준법 점검) ---------- */
  function callCardInner(custId) {
    const list = C.forCustomer(custId);
    const F = C.flags({ custId }); const open = F.filter(f => !f.acked).length;
    const head = `<h3>통화 기록 <span>${list.length}건${F.length ? ` · ${open ? `<b style="color:var(--brand)">준법 검토 대기 ${open}건</b>` : '준법 검토 완료'}` : ''}</span></h3>`;
    if (!list.length) return head + '<div class="dt-empty">아직 통화 기록이 없어요. 전화 버튼으로 통화하면 요약이 자동으로 남아요.</div>';
    return head + list.map(r => {
      const RF = F.filter(f => f.call.id === r.id);
      return `<div class="cl ${RF.some(f => !f.acked) ? 'has-flag' : ''}">
        <div class="cl-top" data-call="${r.id}"><b class="num">${fmtDate(r.date)} ${r.time}</b><span class="muted">${r.dir} · ${dur(r.dur)}</span>${RF.length ? `<span class="pill ${RF.some(f => !f.acked) ? 'pri-3' : 'ok'}">준법 ${RF.some(f => !f.acked) ? '주의' : '검토 완료'}</span>` : ''}<span class="cl-more">전체 대화 →</span></div>
        <div class="cl-sum" data-call="${r.id}">${esc(noFlagText(r.summary))}</div>
        ${RF.length ? `<div class="cl-flags">${flagsHTML(RF)}</div>` : ''}</div>`;
    }).join('');
  }
  function drawerCallsHTML(custId) {
    const list = C.forCustomer(custId).slice(0, 2);
    if (!list.length) return '<div class="muted" style="font-size:13px">통화 기록이 없어요.</div>';
    return list.map(r => `<div class="cl sm" data-call="${r.id}"><div class="cl-top"><b class="num">${fmtDate(r.date)}</b><span class="muted">${r.dir} · ${dur(r.dur)}</span></div><div class="cl-sum">${esc(noFlagText(r.summary))}</div></div>`).join('');
  }

  /* 검색어 변경 시: 해당 고객의 가장 가까운 다가올 일정(없으면 가장 최근 일정) 달로 이동 */
  function setQuery() {
    const hits = searchHits();
    if (qv() && hits.length) { const next = hits.find(e => e.date >= TODAY_ISO) || hits[hits.length - 1]; sel = next.date; const d = dateOf(sel); cur = { y: d.getFullYear(), m: d.getMonth() }; }
    render();
  }

  /* ---------- 공통 ---------- */
  function refreshBadges() {   // 배지는 검색과 무관하게 오늘 전체 일정 수
    const b = $('#badge-cal'); if (b) { const n = C.eventsOn(TODAY_ISO).filter(isTodo).length; b.textContent = n; b.hidden = !n; }
  }
  function refreshAfterAck() {
    const card = $('#dt-callcard'); if (card) card.innerHTML = callCardInner(Number(card.dataset.cust));
    if (lastModal && lastModal.type === 'call') openCall(lastModal.id, lastModal.opts);
  }

  function init(h) {
    hooks = h;
    const st = document.createElement('style'); st.textContent = EV_CSS; document.head.appendChild(st);
    const navN = $('#nav-cust-n'); if (navN) navN.textContent = SAILOG.CUSTOMERS.length;
    $('#cal-prev').onclick = () => { cur.m--; if (cur.m < 0) { cur.m = 11; cur.y--; } renderGrid(); };
    $('#cal-next').onclick = () => { cur.m++; if (cur.m > 11) { cur.m = 0; cur.y++; } renderGrid(); };
    $('#cal-today').onclick = () => { cur = { y: TODAY.getFullYear(), m: TODAY.getMonth() }; sel = TODAY_ISO; render(); };
    $('#agenda-add').onsubmit = (e) => {
      e.preventDefault();
      const title = $('#agenda-input').value.trim(); if (!title) return;
      const time = $('#agenda-time').value || null;
      const cust = SAILOG.CUSTOMERS.find(c => title.includes(c.name));
      C.addManual({ date: sel, time, title, custId: cust ? cust.id : null, note: null });
      $('#agenda-input').value = ''; $('#agenda-time').value = '';
      render(); hooks.toast(`${fmtDate(sel)}에 일정을 추가했어요`);
    };
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-q-clear]')) { const el = document.getElementById('q'); if (el) el.value = ''; render(); return; }
      const t = e.target.closest('[data-call],[data-day],[data-detail],[data-ack],[data-ev-del],[data-ev],[data-close],[data-complete]');
      if (!t) return;
      if (t.dataset.evDel) { e.stopPropagation(); C.removeManual(t.dataset.evDel); render(); return; }
      if (t.dataset.ev) {   // 일정 → 요약 팝업 (캘린더 칸의 일정이면 그 날짜도 선택)
        e.stopPropagation();
        const ev = C.events().find(x => x.id === t.dataset.ev);
        if (ev && t.classList.contains('cal-ev')) { sel = ev.date; renderGrid(); renderAgenda(); }
        openEvent(t.dataset.ev); return;
      }
      if (t.dataset.ack) { e.stopPropagation(); C.ack(t.dataset.ack); refreshAfterAck(); hooks.toast('검토 완료로 표시했어요'); return; }
      if (t.hasAttribute('data-close')) { hooks.closeModal(); return; }
      if (t.dataset.complete) { hooks.closeModal(); hooks.complete(Number(t.dataset.complete)); return; }
      if (t.dataset.day) { sel = t.dataset.day; const d = dateOf(sel); if (d.getMonth() !== cur.m) cur = { y: d.getFullYear(), m: d.getMonth() }; renderGrid(); renderAgenda(); return; }
      if (t.dataset.detail) { hooks.openDetail(Number(t.dataset.detail)); return; }
      if (t.dataset.call) { e.stopPropagation(); openCall(t.dataset.call); }
    });
    // 고객 화면(customer.html, 같은 브라우저의 다른 탭·iframe)에서 상담 시간을 확정하면 바로 반영
    window.addEventListener('storage', (e) => {
      if (e.key !== 'sailog.cx.appt') return;
      C.refresh();
      const a = C.customerAppt(); const c = a && byId(a.custId);
      if (a && c) { sel = a.date; cur = { y: +a.date.slice(0, 4), m: +a.date.slice(5, 7) - 1 }; }
      if ($('#view-calendar') && !$('#view-calendar').hidden) render(); else refreshBadges();
      if (a && c) hooks.toast(`${c.name} 고객이 ${fmtDate(a.date)} ${a.time} 상담을 확정했어요 · 일정에 반영`);
    });
    refreshBadges();
  }

  return { init, render, setQuery, refreshBadges, openCall, openEvent, callHTML, callCardInner, drawerCallsHTML, KIND, clearModal: () => { lastModal = null; } };
})();
