// Calls the schema's functions the way Supabase would: as the anon or
// authenticated role, with the logged-in user's id in request.jwt.claim.sub.
import pg from 'pg';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres@localhost:5433/timbro?host=/tmp' });

export async function call(who, fn, args = {}) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${who.role || 'anon'}`);
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who.sub || '']);
    const names = Object.keys(args);
    const name = fn.includes('.') ? fn : 'timbro.' + fn;   // everything lives in the timbro schema
    const sql = `select ${name}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
    const vals = names.map(n => (args[n] !== null && typeof args[n] === 'object') ? JSON.stringify(args[n]) : args[n]);
    const res = await client.query(sql, vals);
    await client.query('commit');
    return res.rows[0].r;
  } catch (e) { await client.query('rollback'); throw e; }
  finally { client.release(); }
}

export async function raw(who, sql) {
  const client = await pool.connect();
  try { await client.query('begin'); await client.query(`set local role ${who.role || 'anon'}`); const r = await client.query(sql); await client.query('commit'); return r.rows; }
  catch (e) { await client.query('rollback'); throw e; }
  finally { client.release(); }
}
