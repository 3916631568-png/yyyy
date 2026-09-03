/**
 * 网站访问监控 - 后台管理页面
 * 放到你 GitHub 仓库的 functions/admin.js
 * 访问地址：https://你的网站域名/admin
 * 需登录（Basic Auth：用户名 admin + ADMIN_PASS 密码）
 */

function authorized(request, env) {
  const pass = env.ADMIN_PASS || 'admin123';
  const expected = 'Basic ' + btoa('admin:' + pass);
  const auth = request.headers.get('Authorization') || '';
  return auth === expected;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!authorized(request, env)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="monitor"' }
    });
  }

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>网站访问监控后台</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:system-ui,-apple-system,sans-serif; background:#0f1220; color:#e8e8f0; padding:24px 16px 60px; max-width:1080px; margin:0 auto; }
  h1 { font-size:22px; margin-bottom:6px; }
  .sub { color:#8a8fa8; font-size:13px; margin-bottom:22px; }
  .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:24px; }
  .card { background:#1a1e33; border:1px solid #2a2f4a; border-radius:12px; padding:18px 16px; }
  .card .num { font-size:30px; font-weight:700; color:#5b9dff; }
  .card .label { font-size:13px; color:#9aa0bb; margin-top:6px; }
  .toolbar { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
  .toolbar span { font-size:13px; color:#9aa0bb; }
  .switch { width:38px; height:20px; background:#3a3f5c; border-radius:10px; position:relative; cursor:pointer; transition:.2s; }
  .switch.on { background:#2e8b57; }
  .switch::after { content:""; position:absolute; top:2px; left:2px; width:16px; height:16px; background:#fff; border-radius:50%; transition:.2s; }
  .switch.on::after { left:20px; }
  button.refresh { background:#1f6feb; color:#fff; border:none; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:13px; }
  button.refresh:active { opacity:.8; }
  table { width:100%; border-collapse:collapse; background:#141829; border-radius:12px; overflow:hidden; font-size:13px; }
  th,td { padding:11px 12px; text-align:left; border-bottom:1px solid #222741; }
  th { background:#1a1e33; color:#9aa0bb; font-weight:600; white-space:nowrap; }
  tr:hover td { background:#191d33; }
  .badge { display:inline-block; padding:3px 9px; border-radius:20px; font-size:12px; }
  .b-wechat { background:#1e6f3f; color:#7ef0b0; }
  .b-other { background:#1f3a6f; color:#8ab6ff; }
  .ok { color:#4ade80; }
  .fail { color:#f87171; }
  .mono { font-family:ui-monospace,Menlo,monospace; font-size:12px; color:#c9cdf0; }
  .empty { text-align:center; color:#6b7191; padding:40px 0; }
  @media (max-width:640px){ .cards{grid-template-columns:repeat(2,1fr);} th:nth-child(4),td:nth-child(4){display:none;} }
</style>
</head>
<body>
  <h1>📊 网站访问监控</h1>
  <div class="sub">实时查看网站是否正常打开、访问来源（微信/其他）、浏览器、IP 与时间</div>

  <div class="cards">
    <div class="card"><div class="num" id="cTotal">0</div><div class="label">总访问次数</div></div>
    <div class="card"><div class="num" id="cWechat" style="color:#4ade80">0</div><div class="label">微信打开次数</div></div>
    <div class="card"><div class="num" id="cOther" style="color:#8ab6ff">0</div><div class="label">其他浏览器次数</div></div>
    <div class="card"><div class="num" id="cToday" style="color:#fbbf24">0</div><div class="label">今日访问次数</div></div>
  </div>

  <div class="toolbar">
    <span>自动刷新</span>
    <div class="switch on" id="autoSwitch" onclick="toggleAuto()"></div>
    <button class="refresh" onclick="load()">手动刷新</button>
    <span id="lastUpdate" style="color:#6b7191"></span>
  </div>

  <table>
    <thead>
      <tr><th>访问时间</th><th>来源</th><th>浏览器</th><th>操作系统</th><th>设备</th><th>IP 地址</th><th>打开状态</th></tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>
  <div id="emptyTip" class="empty" style="display:none">暂无访问记录，请先在网站页面中嵌入上报脚本</div>

<script>
var timer = null;
function fmtTime(t){
  try{
    var d = new Date(t);
    var p = function(n){return n<10?'0'+n:''+n;};
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
  }catch(e){return t;}
}
function parseUA(ua){
  ua = ua || '';
  var r = { browser:'未知', version:'', os:'未知', device:'其他' };
  if(/iPad/.test(ua) && /Mobile/.test(ua)) r.device='平板';
  else if(/iPhone/.test(ua)) r.device='手机';
  else if(/Android/.test(ua)){ r.device = /Mobile/.test(ua)?'手机':'平板'; }
  else if(/Windows Phone/.test(ua)) r.device='手机';
  else if(/Macintosh/.test(ua)) r.device='电脑';
  else if(/Windows/.test(ua)) r.device='电脑';
  else if(/Linux/.test(ua)) r.device='电脑';

  if(/Windows NT 10/.test(ua)) r.os='Windows 10/11';
  else if(/Windows NT 6\\.1/.test(ua)) r.os='Windows 7';
  else if(/Mac OS X/.test(ua)) r.os='macOS';
  else if(/Android/.test(ua)) r.os='Android';
  else if(/iPhone|iPad|iPod/.test(ua)) r.os='iOS';
  else if(/Linux/.test(ua)) r.os='Linux';
  else if(/Windows/.test(ua)) r.os='Windows';

  var m;
  if(/MicroMessenger/i.test(ua)){ r.browser='微信'; m=ua.match(/MicroMessenger\\/([\\d.]+)/i); if(m) r.version=m[1]; }
  else if(/AlipayClient/i.test(ua)) r.browser='支付宝';
  else if(/QQBrowser|\\bQQ\\//.test(ua)) r.browser='QQ浏览器';
  else if(/Weibo/i.test(ua)) r.browser='微博';
  else if(/UCBrowser|UCWEB/i.test(ua)) r.browser='UC浏览器';
  else if(/baiduboxapp|BaiduHD/i.test(ua)) r.browser='百度App';
  else if(/SogouMobileBrowser/i.test(ua)) r.browser='搜狗';
  else if(/EdgA?\\/?\\d/i.test(ua)){ r.browser='Edge'; m=ua.match(/Edg(?:A|iOS)?\\/([\\d.]+)/); if(m) r.version=m[1]; }
  else if(/OPR\\//.test(ua)||/Opera/i.test(ua)) r.browser='Opera';
  else if(/Firefox/i.test(ua)){ r.browser='Firefox'; m=ua.match(/Firefox\\/([\\d.]+)/); if(m) r.version=m[1]; }
  else if(/Chrome/i.test(ua)){ r.browser='Chrome'; m=ua.match(/Chrome\\/([\\d.]+)/); if(m) r.version=m[1]; }
  else if(/Safari/i.test(ua)){ r.browser='Safari'; m=ua.match(/Version\\/([\\d.]+)/); if(m) r.version=m[1]; }
  else if(/MSIE|Trident/i.test(ua)) r.browser='IE';

  if(r.version) r.browser = r.browser + ' ' + r.version;
  return r;
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function load(){
  fetch('/api/records').then(function(res){
    if(res.status===401){ alert('后台已退出或密码错误，请刷新重新登录'); location.reload(); }
    return res.json();
  }).then(function(d){
    document.getElementById('cTotal').textContent = d.total;
    document.getElementById('cWechat').textContent = d.wechat;
    document.getElementById('cOther').textContent = d.other;
    document.getElementById('cToday').textContent = d.today;
    var tb = document.getElementById('tbody');
    tb.innerHTML = '';
    document.getElementById('emptyTip').style.display = (d.records && d.records.length) ? 'none' : '';
    (d.records||[]).forEach(function(r){
      var u = parseUA(r.ua);
      var isW = /MicroMessenger/i.test(r.ua||'');
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="mono">'+fmtTime(r.time)+'</td>' +
        '<td><span class="badge '+(isW?'b-wechat':'b-other')+'">'+(isW?'微信':'其他')+'</span></td>' +
        '<td>'+esc(u.browser)+'</td>' +
        '<td>'+esc(u.os)+'</td>' +
        '<td>'+esc(u.device)+'</td>' +
        '<td class="mono">'+esc(r.ip)+'</td>' +
        '<td>'+(r.loadSuccess?'<span class="ok">✓ 正常</span>':'<span class="fail">✗ 失败</span>')+'</td>';
      tb.appendChild(tr);
    });
    var now = new Date();
    document.getElementById('lastUpdate').textContent = '上次刷新：'+now.getHours()+':'+now.getMinutes()+':'+now.getSeconds();
  }).catch(function(e){ console.error(e); });
}
function toggleAuto(){
  var s = document.getElementById('autoSwitch');
  s.classList.toggle('on');
  var on = s.classList.contains('on');
  if(timer){ clearInterval(timer); timer=null; }
  if(on){ timer = setInterval(load, 10000); load(); }
}
load();
toggleAuto();
</script>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
