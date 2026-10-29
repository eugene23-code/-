"""귀띔 한 파일 버전 만들기 — dist/귀띔.html

원본(landing · pb · customer · index + js/css/logo)은 그대로 두고, 전부를 HTML 한 파일에 담는다.
  - 바깥 셸 하나가 전체 화면 iframe 에 지금 페이지를 srcdoc 으로 띄운다 (주소: 귀띔.html#pb, #app/view=cx …)
  - 페이지 안의 landing/pb/app/index/customer.html 링크는 셸 안 이동으로 바뀐다 (뒤로 가기 됨)
  - 고객 화면 탭 · 시연 모드 폰 같은 안쪽 iframe 은 window.SAILOG_SETFRAME 으로 내장 페이지를 띄운다 (cx.js · live.js)
  - ?embed&mini 같은 주소 옵션은 window.__SAILOG_QS, #cma · #view=cx 같은 처음 해시는 window.__SAILOG_HASH 로 넘긴다
    (srcdoc 페이지에서는 브라우저가 해시 변경을 막을 수 있어서. 읽는 쪽: customer.html · landing.html · index.html)

원본이 바뀌면 다시 실행:  market\\.venv\\Scripts\\python.exe build_single.py
"""
import base64
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / 'dist' / '귀띔.html'


def read(name):
    return (ROOT / name).read_text(encoding='utf-8')


def js_safe(src):
    # 인라인 <script> 안에서 문자열 속 '</script' 가 태그를 닫지 않게
    return re.sub(r'</(script)', r'<\\/\1', src, flags=re.I)


FONT_LINK = '<link rel="stylesheet" href="fonts.css">'   # 글꼴은 셸에 한 번만 넣고 각 페이지가 FontFace 로 가져다 씀


def app_page():
    """index.html 에 styles.css · logo.svg · 로컬 js 를 모두 인라인"""
    h = read('index.html').replace(FONT_LINK, '')
    h = h.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + read('styles.css') + '\n</style>')
    logo = 'data:image/svg+xml;base64,' + base64.b64encode((ROOT / 'logo.svg').read_bytes()).decode()
    h = h.replace('"logo.svg"', '"' + logo + '"')
    h = re.sub(r'<script src="([\w.-]+\.js)"></script>',
               lambda m: '<script>/* ' + m.group(1) + ' */\n' + js_safe(read(m.group(1))) + '\n</script>', h)
    left = re.findall(r'(?:src|href)="(?!https?:|data:|#)([^"]+\.(?:js|css|svg))"', h)
    if left:
        sys.exit('인라인 못 한 로컬 파일이 남았어요: ' + ', '.join(left))
    return h


PAGES = {
    'landing': read('landing.html').replace(FONT_LINK, ''),
    'pb': read('pb.html').replace(FONT_LINK, ''),
    'customer': read('customer.html').replace(FONT_LINK, ''),
    'app': app_page(),
}
FONT_B64 = base64.b64encode((ROOT / 'fonts' / 'PretendardVariable.woff2').read_bytes()).decode()
for name, html in PAGES.items():
    left = re.findall(r'(?:src)="(?!https?:|data:|#)([^"]+\.(?:js|css|svg|png))"', html)
    if left:
        sys.exit(f'{name}: 로컬 파일 참조가 남았어요: {left}')

# JSON 을 <script type="application/json"> 에 담을 때 '<' 를 전부 < 로 → </script>, <!-- 로 태그가 깨지지 않음
data = json.dumps(PAGES, ensure_ascii=False).replace('<', '\\u003c')

SHELL = r'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>귀띔</title>
<link rel="icon" type="image/svg+xml" href="__LOGO__">
<style>
html, body { margin: 0; height: 100%; background: #fff; }
#page { display: block; width: 100%; height: 100%; border: 0; }
</style>
</head>
<body>
<!-- 귀띔 한 파일 버전 (시연용 가상 화면). build_single.py 가 원본 폴더에서 만든 파일입니다. -->
<iframe id="page" title="귀띔"></iframe>
<script type="application/json" id="sailog-pages">__DATA__</script>
<script type="text/plain" id="sailog-font">__FONT__</script>
<script>
window.SAILOG_SHELL = (() => {
  const PAGES = JSON.parse(document.getElementById('sailog-pages').textContent);
  // Pretendard 가변 글꼴(woff2)을 한 번만 풀어 두고, 각 페이지가 FontFace 로 등록 (prelude)
  let font = null;
  try { const b = atob(document.getElementById('sailog-font').textContent.trim()); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); font = u.buffer; } catch (e) {}
  const frame = document.getElementById('page');
  const NAMES = ['landing', 'pb', 'app', 'customer'];

  // 각 페이지 맨 앞에 넣는 연결 코드: 셸 찾기 · 주소 옵션 · 처음 해시 · 링크 가로채기 · 안쪽 iframe 띄우기
  const prelude = (qs, hash) => '<script>(function(){'
    + 'var s=null;try{var w=window;for(var i=0;i<6&&w;i++){if(w.SAILOG_SHELL){s=w.SAILOG_SHELL;break}if(w===w.parent)break;w=w.parent}}catch(e){}'
    + 'window.__SAILOG_QS=' + JSON.stringify(qs) + ';window.__SAILOG_HASH=' + JSON.stringify(hash) + ';'
    + 'window.SAILOG_SETFRAME=s?function(f,u){if(f.dataset.u===u)return;f.dataset.u=u;f.srcdoc=s.build(u)}:null;'
    + 'try{if(s&&s.font){document.fonts.add(new FontFace("Pretendard",s.font,{weight:"45 920",display:"swap"}))}}catch(e){}'
    + (hash ? 'try{history.replaceState(null,"","#"+' + JSON.stringify(hash) + ')}catch(e){}' : '')
    + 'document.addEventListener("click",function(e){if(!s)return;var a=e.target.closest&&e.target.closest("a[href]");if(!a)return;'
    + 'var m=(a.getAttribute("href")||"").match(/^(landing|pb|app|index|customer)\\.html(\\?[^#]*)?(#.*)?$/);if(!m)return;'
    + 'e.preventDefault();e.stopPropagation();s.go(m[1]==="index"?"app":m[1],(m[3]||"").slice(1))},true);'
    + '})();<\/script>';

  // 'customer.html?embed&mini#cma' → 내장 페이지 HTML
  function build(url) {
    const m = String(url).match(/^(\w+)\.html(?:\?([^#]*))?(?:#(.*))?$/);
    if (!m) return '';
    const name = m[1] === 'index' ? 'app' : m[1];
    const html = PAGES[name] || '';
    const pre = prelude(m[2] || '', m[3] || '');
    if (/<head>/i.test(html)) return html.replace(/<head>/i, '<head>' + pre);
    if (/^<!doctype html>/i.test(html)) return html.replace(/^<!doctype html>/i, '<!doctype html>' + pre);
    return pre + html;
  }

  // 셸 주소 #pb · #customer/call · #app/view=cx
  const parse = () => { const h = location.hash.slice(1); const i = h.indexOf('/'); const name = i < 0 ? h : h.slice(0, i); return { name: NAMES.includes(name) ? name : 'landing', sub: i < 0 ? '' : h.slice(i + 1) }; };
  function render() {
    const { name, sub } = parse();
    frame.srcdoc = build(name + '.html' + (sub ? '#' + sub : ''));
  }
  function go(name, sub) {
    const h = '#' + name + (sub ? '/' + sub : '');
    if (location.hash === h) render(); else location.hash = h;
  }
  frame.addEventListener('load', () => { try { const t = frame.contentDocument.title; if (t) document.title = t; frame.contentWindow.focus(); } catch (e) {} });
  window.addEventListener('hashchange', render);
  return { build, go, render, font };
})();
SAILOG_SHELL.render();
</script>
</body>
</html>
'''

logo_uri = 'data:image/svg+xml;base64,' + base64.b64encode((ROOT / 'logo.svg').read_bytes()).decode()
out = SHELL.replace('__LOGO__', logo_uri).replace('__FONT__', FONT_B64).replace('__DATA__', data)
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(out, encoding='utf-8')
print(f'{OUT}  {OUT.stat().st_size / 1024:.0f} KB  pages={list(PAGES)}')
