/* 사이로그 공용 UI 헬퍼 — 알림톡 렌더, 토스트 */
const UI = (() => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function alimtalkHTML(c, key, time = '오전 9:12') {
    const t = SAILOG.TEMPLATES[key];
    return messageHTML(t.name, t.build(c), time);
  }

  /* 이미 만들어진 메시지 {title, body, info, buttons, notice?} 를 알림톡 말풍선으로 (템플릿 목록에 없는 개별 안내용: 펀드 안내 등) */
  function messageHTML(name, m, time = '오전 9:12') {
    const t = { name };
    return `
      <div class="ktalk">
        <div class="ktalk-avatar">유</div>
        <div class="ktalk-col">
          <div class="ktalk-name">유진투자증권</div>
          <div class="ktalk-row">
            <div class="ktalk-bubble">
              <div class="ktalk-tag">${esc(m.tag || '알림톡')}</div>
              <div class="ktalk-head-img"><small>사이로그 · ${esc(t.name)}</small><div class="ktalk-title">${esc(m.title)}</div></div>
              <div class="ktalk-body">${esc(m.body)}</div>
              <div class="ktalk-info">${m.info.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
              ${m.notice ? `<div class="ktalk-foot" style="color:#4e5968">${esc(m.notice)}</div>` : ''}
              <div class="ktalk-foot">본 메시지는 고객님의 계좌 로그를 바탕으로 자동 생성된 시연용 가상 안내이며, 특정 상품의 매매를 권유하지 않습니다. 담당 PB ${esc(SAILOG.PB.name)} · ${esc(SAILOG.PB.branch)}</div>
              ${m.buttons.map((b) => `<button class="ktalk-btn" type="button">${esc(b)}</button>`).join('')}
            </div>
            <div class="ktalk-time">${esc(time)}</div>
          </div>
        </div>
      </div>`;
  }

  function phoneHTML(inner, dateLabel = '2026년 10월 29일 목요일') {
    return `
      <div class="phone"><div class="phone-screen">
        <div class="phone-status"><span>9:12</span><span class="notch"></span><span>●●● ▮</span></div>
        <div class="phone-head"><span class="back">‹</span> 유진투자증권 <span style="font-size:11px;font-weight:600;background:#fff;color:#333;padding:1px 6px;border-radius:6px">채널</span></div>
        <div class="phone-body"><div class="phone-date"><span>${esc(dateLabel)}</span></div>${inner}</div>
      </div></div>`;
  }

  let toastTimer;
  function toast(msg, actionLabel, onAction) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.innerHTML = `<span>${esc(msg)}</span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ''}`;
    if (actionLabel) el.querySelector('button').onclick = () => { onAction && onAction(); el.classList.remove('show'); };
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => toast('클립보드에 복사했어요')).catch(() => toast('복사할 수 없는 환경이에요'));
    }
    toast('복사할 수 없는 환경이에요');
  }

  return { esc, alimtalkHTML, messageHTML, phoneHTML, toast, copy };
})();
