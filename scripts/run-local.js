// Local service supervisor for avalon-online:
// - Loads optional .env file (not committed to git)
// - Defaults HOST=127.0.0.1 and PORT=8814 for Cloudflare Tunnel
// - Writes stdout + stderr into daily rotating logs/serve-YYYY-MM-DD.log (retains 14 days)
// - Auto-restarts server.js 5s after unexpected exit
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile();
if (!process.env.HOST) process.env.HOST = '127.0.0.1';
if (!process.env.PORT) process.env.PORT = '8814';

let curDay = '';
let logStream = null;

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function cleanOldLogs() {
  const cutoff = Date.now() - 14 * 86400 * 1000;
  try {
    for (const f of fs.readdirSync(LOG_DIR)) {
      if (!/^serve-\d{4}-\d{2}-\d{2}\.log$/.test(f)) continue;
      const full = path.join(LOG_DIR, f);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
  } catch {}
}

function writeLog(chunk) {
  const day = todayStr();
  if (day !== curDay || !logStream) {
    if (logStream) logStream.end();
    curDay = day;
    cleanOldLogs();
    logStream = fs.createWriteStream(path.join(LOG_DIR, `serve-${day}.log`), { flags: 'a' });
  }
  logStream.write(chunk);
}

let stopping = false;
let child = null;

function startChild() {
  if (stopping) return;
  writeLog(`[supervisor ${new Date().toISOString()}] starting server.js on ${process.env.HOST}:${process.env.PORT}\n`);
  child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', writeLog);
  child.stderr.on('data', writeLog);
  child.on('exit', (code, sig) => {
    child = null;
    if (stopping) {
      writeLog(`[supervisor ${new Date().toISOString()}] stopped cleanly (${sig || code})\n`);
      if (logStream) logStream.end(() => process.exit(0));
      else process.exit(0);
      return;
    }
    writeLog(`[supervisor ${new Date().toISOString()}] server exited (code=${code}, sig=${sig}), restarting in 5s\n`);
    setTimeout(startChild, 5000);
  });
}

function shutdown(sig) {
  if (stopping) return;
  stopping = true;
  if (child) child.kill(sig);
  else process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startChild();
