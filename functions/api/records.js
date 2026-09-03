/**
 * 网站访问监控 - 后台数据接口
 * 放到你 GitHub 仓库的 functions/api/records.js
 * 访问地址：https://你的网站域名/api/records
 * 需登录（Basic Auth：用户名 admin + ADMIN_PASS 密码）
 */

async function ensureTable(env) {
  try {
    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS visits (' +
      'id TEXT PRIMARY KEY,' +
      'ip TEXT,' +
      'ua TEXT,' +
      'loadSuccess INTEGER DEFAULT 1,' +
      'time TEXT' +
      ')'
    ).run();
  } catch (e) {
    console.error('建表失败:', e);
  }
}

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

  await ensureTable(env);

  const totalRow = await env.DB.prepare('SELECT COUNT(*) AS c FROM visits').first();
  const wechatRow = await env.DB.prepare("SELECT COUNT(*) AS c FROM visits WHERE ua LIKE '%MicroMessenger%'").first();
  const todayStart = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const todayRow = await env.DB.prepare('SELECT COUNT(*) AS c FROM visits WHERE time >= ?').bind(todayStart).first();
  const { results } = await env.DB.prepare('SELECT * FROM visits ORDER BY time DESC LIMIT 1000').all();

  const data = {
    total: totalRow.c || 0,
    wechat: wechatRow.c || 0,
    other: (totalRow.c || 0) - (wechatRow.c || 0),
    today: todayRow.c || 0,
    records: results
  };

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
