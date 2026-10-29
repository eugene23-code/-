/* 귀띔 — 개인화 제안 블록 (고객 상세 페이지용)
   data.js 의 SAILOG.recommend(c) 결과(관심 키워드 × 투자성향 매칭)를 카드로 렌더한다.
   사용: openDetail 안에서  SAILOG_RECO.html(c)  를 dt-grid 에 끼워 넣으면 끝. 버튼은 이벤트 위임으로 동작.
   시연용 가상 세미나·상품이며 투자 권유가 아닌 PB 검토 후보. */
window.SAILOG_RECO = (() => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const CSS = `
  .rc-wrap { display: flex; flex-direction: column; gap: 14px; }
  .rc-sub { font-size: 12px; font-weight: 700; color: var(--fg3); letter-spacing: .02em; display: flex; align-items: center; gap: 8px; }
  .rc-sub small { font-weight: 500; }
  .rc-timing { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px; }
  .rc-timing > div { display: grid; grid-template-columns: 112px 1fr; gap: 10px; padding: 10px 12px; border-radius: 10px; background: var(--brand-tint); font-size: 13px; }
  .rc-timing b { color: var(--brand); }
  .rc-timing small { display: block; color: var(--fg2); font-size: 12px; margin-top: 2px; }
  .rc-keys { display: flex; flex-wrap: wrap; gap: 6px; }
  .rc-key { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 9px; background: var(--surface2); border: 1px solid var(--line); font-size: 13px; font-weight: 600; cursor: default; }
  .rc-key i { font-style: normal; font-size: 11px; color: var(--fg3); font-weight: 500; }
  .rc-key.top { background: var(--brand-tint); border-color: transparent; color: var(--brand); }
  .rc-key.top i { color: var(--brand); opacity: .8; }
  .rc-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .rc-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .rc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  .rc-item { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .rc-item .t { font-weight: 700; font-size: 14px; line-height: 1.3; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .rc-item .m { font-size: 12px; color: var(--fg2); line-height: 1.5; }
  .rc-why { display: flex; flex-wrap: wrap; gap: 4px; }
  .rc-why span { font-size: 11px; padding: 2px 7px; border-radius: 6px; background: var(--surface2); color: var(--fg2); }
  .rc-foot { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
  .rc-foot .left { font-size: 11px; color: var(--fg3); margin-right: auto; }
  .rc-note { font-size: 11.5px; color: var(--fg3); line-height: 1.5; }
  @media (max-width: 900px) { .rc-cols { grid-template-columns: 1fr; } }`;

  function ensureCSS() { if (document.getElementById('rc-css')) return; const s = document.createElement('style'); s.id = 'rc-css'; s.textContent = CSS; document.head.appendChild(s); }

  function html(c) {
    ensureCSS();
    const R = SAILOG.recommend(c); const { fmtDate } = SAILOG;

    return `<div class="dt-card span" id="rc-block-${c.id}"><h3>개인화 제안 <span>관심 분야 × 투자성향(${esc(c.risk)}) 매칭 · PB 검토용 후보</span></h3>
      <div class="rc-wrap">
        ${R.timing.length ? `<div><div class="rc-sub">지금 제안할 이유</div><div class="rc-timing" style="margin-top:8px">${R.timing.map(t => `<div><b>${esc(t.when)}</b><div>${esc(t.what)}<small>${esc(t.hint)}</small></div></div>`).join('')}</div></div>` : ''}
        <div><div class="rc-sub">제안 키워드 <small>보유 섹터 + 행동 태그 + 이벤트 + 오늘 신호에서 추출</small></div>
          <div class="rc-keys" style="margin-top:8px">${R.interests.slice(0, 9).map((i, idx) => `<span class="rc-key ${idx < 3 ? 'top' : ''}" title="${esc(i.why.join(' · '))}">${esc(i.key)}<i>${esc(i.why[0] || '')}</i></span>`).join('')}</div></div>
        <div>
          <div><div class="rc-sub">센터 세미나 <small>전화·대면 상담에서 PB가 직접 안내</small></div><div class="rc-list rc-grid">${R.seminars.length ? R.seminars.map(s => `<div class="rc-item"><div class="t">${esc(s.title)}</div><div class="m">${fmtDate(s.date)} ${s.time} · ${esc(s.place)} · 잔여 ${s.left}석</div><div class="rc-why">${s.hit.slice(0, 3).map(h => `<span>${esc(h.key)}</span>`).join('')}${s.okLvl ? '' : '<span>성향 범위 밖</span>'}</div><div class="rc-foot"><span class="left">매칭 ${Math.round(s.score * 10) / 10}</span></div></div>`).join('') : '<div class="muted" style="font-size:13px">맞는 세미나가 없어요.</div>'}</div></div>
        </div>
        <p class="rc-note">시연용 가상 세미나입니다. 고객 관심 분야와 투자성향 범위로 고른 PB 검토 후보이며, 특정 상품의 매매를 권유하는 내용이 아닙니다. 실제 제안은 적합성 확인 후 진행합니다.</p>
      </div></div>`;
  }

  function rerender(id) {
    const c = SAILOG.byId(id); const el = document.getElementById('rc-block-' + id); if (!c || !el) return;
    const y = window.scrollY; el.outerHTML = html(c); window.scrollTo({ top: y });
  }

  return { html, rerender };
})();
