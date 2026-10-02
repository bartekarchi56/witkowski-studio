// A tiny stand-in for the parts of Supabase the website uses, for local
// end-to-end tests only: email/password login (/auth/v1) and calling the
// database functions (/rest/v1/rpc). The functions themselves are the real
// ones from schema.sql, running on a local Postgres.
//
//   PORT=54321 node fake-supabase.js
import http from 'node:http';
import crypto from 'node:crypto';
import { pool, call } from './db.js';

const SECRET = 'local-test-secret';
const b64 = x => Buffer.from(JSON.stringify(x)).toString('base64url');
const sign = data => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
const jwt = payload => { const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(payload); return `${h}.${p}.${sign(h + '.' + p)}`; };
function verify(token) {
  const [h, p, s] = (token || '').split('.');
  if (!s || sign(h + '.' + p) !== s) return null;
  const claims = JSON.parse(Buffer.from(p, 'base64url'));
  return claims.exp * 1000 > Date.now() ? claims : null;
}
const refreshTokens = new Map();

function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const refresh = crypto.randomBytes(16).toString('hex');
  refreshTokens.set(refresh, user);
  return {
    access_token: jwt({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp }),
    token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: refresh,
    user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() }
  };
}

const hash = pw => crypto.createHash('sha256').update(pw).digest('hex');
const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const body = req => new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d ? JSON.parse(d) : {})); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204);
  try {
    const claims = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
    const who = claims ? { role: 'authenticated', sub: claims.sub } : { role: 'anon' };

    if (req.method === 'POST' && url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.split('/').pop().replace(/[^a-z_]/g, '');
      const args = await body(req);
      try { return send(res, 200, await call(who, fn, args)); }
      catch (e) { return send(res, 400, { message: e.message, code: e.code, details: null, hint: null }); }
    }

    if (url.pathname === '/auth/v1/signup' && req.method === 'POST') {
      const { email, password } = await body(req);
      const exists = await pool.query('select id from auth.users where email = $1', [email]);
      if (exists.rowCount) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      const r = await pool.query('insert into auth.users (email, password) values ($1, $2) returning id, email', [email, hash(password)]);
      return send(res, 200, session(r.rows[0]));
    }
    if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
      const b = await body(req);
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        const user = refreshTokens.get(b.refresh_token);
        return user ? send(res, 200, session(user)) : send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
      }
      const r = await pool.query('select id, email from auth.users where email = $1 and password = $2', [b.email, hash(b.password || '')]);
      if (!r.rowCount) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return send(res, 200, session(r.rows[0]));
    }
    if (url.pathname === '/auth/v1/user' && req.method === 'GET') {
      if (!claims) return send(res, 401, { msg: 'invalid JWT' });
      return send(res, 200, { id: claims.sub, email: claims.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} });
    }
    if (url.pathname === '/auth/v1/logout') return send(res, 204);
    if (url.pathname === '/auth/v1/recover') return send(res, 200, {});
    send(res, 404, { message: 'not found: ' + url.pathname });
  } catch (e) { send(res, 500, { message: e.message }); }
}).listen(+(process.env.PORT || 54321), () => console.log('fake supabase on', process.env.PORT || 54321));
