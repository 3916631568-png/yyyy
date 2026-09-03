/**
 * 网站访问监控 - 上报接口
 * 放到你 GitHub 仓库的 functions/report.js
 * 访问地址：https://你的网站域名/report
 * 依赖：D1 数据库绑定（变量名 DB）+ 首次访问自动建表
 */

const GIF_1PX = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
  0x01, 0x00, 0x01, 0x00,             // 1x1
  0x80, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x00, 0x00, 0x00,
  0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0x02, 0x02, 0x44, 0x01, 0x00,
  0x3b
]);

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

export async function onRequestGet(context) {
  const { request, env } = context;
  await ensureTable(env);

  const url = new URL(request.url);
  const ua = request.headers.get('User-Agent') || '';
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const loadSuccess = url.searchParams.get('s') !== '0' ? 1 : 0;
  const time = new Date().toISOString();
  const id = crypto.randomUUID();

  await env.DB.prepare(
    'INSERT INTO visits (id, ip, ua, loadSuccess, time) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, ip, ua, loadSuccess, time).run();

  return new Response(GIF_1PX, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, max-age=0',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
