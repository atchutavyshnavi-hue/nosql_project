const { Connection } = require('monetdb');

// MonetDB (column-store analytical database) powers SmartServe's analytics:
// revenue trends, peak hours, top dishes, zone breakdowns. Columnar storage
// makes these scan-and-aggregate queries fast compared with row stores.
// MongoDB stays the source of truth; every order is also copied into the
// `order_facts` / `order_item_facts` tables here (see analytics.service.js).
//
// It is OPTIONAL: without MONETDB_DATABASE (or if the server is down) the
// app keeps working and analytics endpoints report "unavailable".

let conn = null;
let ready = false;
let chain = Promise.resolve(); // MonetDB's connection handles one request at a time

async function connectMonetDB() {
  if (!process.env.MONETDB_DATABASE) {
    console.log('[MonetDB] MONETDB_DATABASE not set — analytics disabled');
    return false;
  }
  try {
    conn = new Connection({
      host: process.env.MONETDB_HOST || '127.0.0.1',
      port: Number(process.env.MONETDB_PORT || 50000),
      database: process.env.MONETDB_DATABASE,
      username: process.env.MONETDB_USER || 'monetdb',
      password: process.env.MONETDB_PASSWORD || 'monetdb',
    });
    await conn.connect();
    ready = true;
    console.log('[MonetDB] Connected');
    return true;
  } catch (err) {
    console.warn(`[MonetDB] Not available (${err.message}) — analytics disabled`);
    ready = false;
    conn = null;
    return false;
  }
}

const isReady = () => ready;

// Runs SQL and returns an array of row objects ({column: value}).
// Calls are queued so concurrent requests never interleave on the socket.
function query(sql) {
  const run = async () => {
    if (!conn) throw new Error('MonetDB not connected');
    const res = await conn.execute(sql);
    if (!res || !res.columns || !res.data) return [];
    return res.data.map((row) => {
      const obj = {};
      res.columns.forEach((c, i) => { obj[c.name] = row[i]; });
      return obj;
    });
  };
  const next = chain.then(run, run);
  chain = next.catch(() => {});
  return next;
}

// Safe SQL literals (MonetDB's node driver only supports prepared statements
// for typed params, so we escape explicitly).
const str = (v) => `'${String(v ?? '').replace(/'/g, "''")}'`;
const numLit = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const ts = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  const x = new Date(d);
  return `TIMESTAMP '${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}'`;
};

module.exports = { connectMonetDB, isReady, query, str, numLit, ts };
