// ── shared.js — common data, helpers, session guard ──────────────────────────
"use strict";

const EMPLOYEES = {

  "CH6": {
    name: "Jehanzaib Akbar",
    desig: "Manager Finance",
    dept: "Citi Homes",
    email: "jehanzaib@citihomes.ae",
    status: "Active"
  },

  "CH3": {
    name: "Mohammed Irfan",
    desig: "Manager Business Excellence & Finance",
    dept: "Citi Homes",
    email: "irfan@citihomes.ae",
    status: "Active"
  },

  "CH5": {
    name: "Umer Raza",
    desig: "P&C Admin/Executive",
    dept: "Citi Homes",
    email: "umer@citihomes.ae",
    status: "Active"
  },

  "CH2": {
    name: "Nadeem Anwar",
    desig: "Procurement Associate",
    dept: "Citi Homes",
    email: "nadeem@citihomes.ae",
    status: "Active"
  },

  "CH4": {
    name: "Shabbir Hussain",
    desig: "Guard cum Cleaner",
    dept: "Citi Homes",
    email: "abc@citihomes.ae",
    status: "Active"
  },

  "CH7": {
    name: "Sajid Ali",
    desig: "Stores and Warehouse Associate",
    dept: "Citi Homes",
    email: "sajidali.shouketali@gmail.com",
    status: "Active"
  }
};

// ── Routes & auth ────────────────────────────────────────────────────────────
const ROUTE_FILES = {
  login: "index.html",
  employee: "employee.html",
  admin: "admin.html"
};

function isLocalDevHost() {
  const h = location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "";
}

function getAppBaseUrl() {
  const cfg = getConfig();
  if (cfg && cfg.appUrl) {
    return String(cfg.appUrl).replace(/\/?$/, "/");
  }
  const path = location.pathname || "/";
  const marker = "/Attendance.Portal";
  const i = path.indexOf(marker);
  if (i >= 0) return location.origin + path.slice(0, i + marker.length) + "/";
  return location.origin + (path.endsWith("/") ? path : path.replace(/\/[^/]*$/, "/"));
}

function routeFor(key) {
  const file = ROUTE_FILES[key] || key;
  if (isLocalDevHost()) return file;
  return getAppBaseUrl() + file;
}

const ROUTES = ROUTE_FILES;

const SESSION_KEY = "att_session_v4";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_ATTEMPTS_KEY = "att_login_attempts";
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

function getConfig() {
  const prod = typeof window !== "undefined" && window.ATT_CONFIG_PRODUCTION ? window.ATT_CONFIG_PRODUCTION : {};
  const auth = typeof window !== "undefined" && window.ATT_CONFIG_AUTH ? window.ATT_CONFIG_AUTH : {};
  const cfg = typeof window !== "undefined" && window.ATT_CONFIG ? window.ATT_CONFIG : {};
  if (!Object.keys(prod).length && !Object.keys(auth).length && !Object.keys(cfg).length) return null;
  return Object.assign({}, prod, auth, cfg);
}

function isLoginConfigured() {
  const cfg = getConfig();
  return !!(cfg && cfg.sessionSecret && cfg.employeePassHashes && cfg.admins && cfg.admins.length);
}

function ensureLoginConfig() {
  const cfg = getConfig();
  if (!cfg || !cfg.sessionSecret) {
    throw new Error("Login is not configured on the server.");
  }
  return cfg;
}

function ensureConfig() {
  const cfg = getConfig();
  if (!cfg || !cfg.sessionSecret) {
    throw new Error("App not configured for login. Use the GitHub Pages URL after deploy secrets are set.");
  }
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error("Supabase is required. All attendance is stored in the cloud only.");
  }
  return cfg;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeEmp(emp) {
  if (!emp) return null;
  const { pass, passHash, ...safe } = emp;
  return safe;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function sessionFingerprint(payload, secret) {
  const str = JSON.stringify(payload);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  for (let i = 0; i < secret.length; i++) h = ((h << 5) + h + secret.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function getLoginAttempts() {
  try {
    const raw = sessionStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (!raw) return { count: 0, lockedUntil: 0 };
    return JSON.parse(raw);
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function recordFailedLogin() {
  const state = getLoginAttempts();
  const now = Date.now();
  if (state.lockedUntil && now < state.lockedUntil) return state;
  state.count = (state.count || 0) + 1;
  if (state.count >= MAX_LOGIN_ATTEMPTS) {
    state.lockedUntil = now + LOGIN_LOCKOUT_MS;
    state.count = 0;
  }
  sessionStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(state));
  return state;
}

function clearLoginAttempts() {
  sessionStorage.removeItem(LOGIN_ATTEMPTS_KEY);
}

function loginLockoutMessage() {
  const state = getLoginAttempts();
  if (!state.lockedUntil || Date.now() >= state.lockedUntil) return null;
  const mins = Math.ceil((state.lockedUntil - Date.now()) / 60000);
  return `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}

async function verifyEmployeePassword(code, password) {
  const cfg = ensureLoginConfig();
  const hash = cfg.employeePassHashes && cfg.employeePassHashes[code];
  if (!hash) return false;
  return (await sha256(password)) === hash;
}

async function verifyAdminCredentials(user, password) {
  const cfg = ensureLoginConfig();
  const admins = cfg.admins || (cfg.admin ? [cfg.admin] : []);
  if (!admins.length) return null;
  const normalizedUser = String(user || "").trim().toLowerCase();
  if (!normalizedUser || !password) return null;
  const inputHash = await sha256(password);
  const match = admins.find(a => a.user && a.passHash && String(a.user).trim().toLowerCase() === normalizedUser && inputHash === a.passHash);
  if (!match) return null;
  return { mode: match.mode === "readonly" ? "readonly" : "full" };
}

function navigateTo(route) {
  window.location.href = routeFor(route);
}

function navigateReplace(route) {
  window.location.replace(routeFor(route));
}

function getCurrentRouteKey() {
  const file = (location.pathname || "").split("/").pop() || "index.html";
  if (file === "employee.html") return "employee";
  if (file === "admin.html") return "admin";
  return "login";
}

function parseSession(raw) {
  if (!raw) return null;
  try {
    const cfg = getConfig();
    if (!cfg || !cfg.sessionSecret) return null;

    const envelope = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!envelope || envelope.v !== 4 || !envelope.payload || !envelope.fp) return null;

    const { payload, fp } = envelope;
    if (fp !== sessionFingerprint(payload, cfg.sessionSecret)) return null;
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!payload.role) return null;

    if (payload.role === "employee" || payload.role === "team member") {
      const empCode = payload.empCode || payload.employeeCode;
      const emp = empCode ? EMPLOYEES[empCode] : null;
      if (!empCode || !emp) return null;
      return { role: "employee", empCode, emp: sanitizeEmp(emp) };
    }

    if (payload.role === "admin") {
      return { role: "admin", adminMode: payload.adminMode === "readonly" ? "readonly" : "full" };
    }
    return null;
  } catch {
    return null;
  }
}

function getSession() {
  return parseSession(sessionStorage.getItem(SESSION_KEY));
}

function setSession(data) {
  const cfg = ensureLoginConfig();
  const payload = {
    role: data.role,
    empCode: data.empCode || null,
    adminMode: data.role === "admin" ? (data.adminMode || "full") : null,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS
  };
  const fp = sessionFingerprint(payload, cfg.sessionSecret);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ v: 4, payload, fp }));
  sessionStorage.removeItem("att_session");
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem("att_session");
}

function requireEmployee() {
  const s = getSession();
  if (!s || s.role !== "employee" || !s.empCode) {
    navigateReplace("login");
    throw 0;
  }
  const fresh = EMPLOYEES[s.empCode];
  if (!fresh || fresh.status !== "Active") {
    clearSession();
    navigateReplace("login");
    throw 0;
  }
  const session = { role: "employee", empCode: s.empCode, emp: fresh };
  setTimeout(() => initAppUpdateNotice("employee"), 0);
  setTimeout(() => initEmployeeProfilePhoto(session), 0);
  return session;
}

function requireAdmin() {
  const s = getSession();
  if (!s || s.role !== "admin") {
    navigateReplace("login");
    throw 0;
  }
  setTimeout(() => initAppUpdateNotice("admin"), 0);
  return s;
}

function canAdminWrite() {
  const s = getSession();
  return !!(s && s.role === "admin" && s.adminMode !== "readonly");
}

function requireAdminWrite(actionLabel) {
  if (canAdminWrite()) return true;
  alert(`Your account is read-only. You cannot ${actionLabel || "modify records"}.`);
  return false;
}

function logout() {
  clearSession();
  navigateReplace("login");
}

function redirectIfLoggedIn() {
  const s = getSession();
  if (!s) return false;
  if (s.role === "admin") { navigateReplace("admin"); return true; }
  if (s.role === "employee") { navigateReplace("employee"); return true; }
  clearSession();
  return false;
}

function initHashRouting(sections, showFn, defaultId) {
  function go(id, el) {
    if (!sections.includes(id)) return;
    showFn(id, el || document.querySelector(`.nav-item[data-section="${id}"]`));
  }

  const hash = location.hash.slice(1);
  const id = sections.includes(hash) ? hash : defaultId;
  if (location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
  go(id);

  window.addEventListener("hashchange", () => {
    const next = location.hash.slice(1);
    if (sections.includes(next)) go(next);
  });
}

// ── Date/Time helpers ────────────────────────────────────────────────────────
const p2=n=>String(n).padStart(2,'0');
const MONTH_SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtTime(d){return p2(d.getHours())+':'+p2(d.getMinutes())+':'+p2(d.getSeconds());}
function fmtDate(d){return DAY_SHORT[d.getDay()]+', '+p2(d.getDate())+' '+MONTH_SHORT[d.getMonth()]+' '+d.getFullYear();}
function fmtDT(d){return fmtDate(d)+' · '+fmtTime(d);}
function todayISO(){const d=new Date();return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;}
function todayDisplayKey(){const d=new Date();return `${p2(d.getDate())} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;}
function isRecordToday(rec){
  if(!rec) return false;
  const iso=extractRecordDateISO(rec);
  if(iso) return iso===todayISO();
  if(!rec.punchIn) return false;
  const punchIn=rec.punchIn;
  if(punchIn.includes(todayISO())) return true;
  return punchIn.includes(todayDisplayKey());
}
function nowDTLocal(){const d=new Date();return `${todayISO()}T${p2(d.getHours())}:${p2(d.getMinutes())}`;}

// ── Hours calculation ────────────────────────────────────────────────────────
const WEEKLY_OFF_DAY=0; // Sunday

function isWeeklyOffDateISO(dateISO){
  if(!dateISO) return false;
  const [y,m,d]=dateISO.split('-').map(Number);
  return new Date(y,m-1,d).getDay()===WEEKLY_OFF_DAY;
}

function isWeeklyOffRecord(rec){
  return isWeeklyOffDateISO(extractRecordDateISO(rec));
}

function isSundayToday(){
  return new Date().getDay()===WEEKLY_OFF_DAY;
}

function calcHours(punchIn, punchOut){
  if(!punchIn||!punchOut) return null;
  if(isWeeklyOffDateISO(extractRecordDateISO({punchIn}))) return null;
  // Extract time part "HH:MM:SS" from "Day, DD Mon YYYY · HH:MM:SS" or ISO
  function toMins(str){
    const t=str.includes('·')?str.split('·')[1].trim():str;
    const parts=t.split(':');
    return parseInt(parts[0])*60+parseInt(parts[1]||0);
  }
  const diff=toMins(punchOut)-toMins(punchIn);
  return diff>0?diff:null;
}
function fmtHours(mins){
  if(mins===null||mins===undefined) return '—';
  const h=Math.floor(mins/60), m=mins%60;
  return `${h}h ${p2(m)}m`;
}
function decimalHours(mins){
  if(!mins) return '0.00';
  return (mins/60).toFixed(2);
}

// ── Records storage (Supabase only — no local drive / localStorage) ───────────
const REC_TABLE = 'attendance_records';
const PROFILE_TABLE = 'employee_profiles';
let _recordsCache = null;
let _recordDateColumn = null;
let _employeeProfilesCache = null;

function purgeLegacyLocalRecords() {
  try { localStorage.removeItem('att_v3_records'); } catch (_) {}
  try { localStorage.removeItem('att_session'); } catch (_) {}
}
purgeLegacyLocalRecords();

function supabaseConfig() {
  const cfg = getConfig();
  if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
  return { url: cfg.supabaseUrl.replace(/\/$/, ''), key: cfg.supabaseAnonKey };
}

function sbHeaders(extra) {
  const sb = supabaseConfig();
  if (!sb) throw new Error('Supabase not configured in config.js');
  return Object.assign({
    'Content-Type': 'application/json',
    'apikey': sb.key,
    'Authorization': 'Bearer ' + sb.key
  }, extra || {});
}

function recordToRow(rec) {
  ensureRecordDates(rec);
  const row = {
    id: rec.id,
    emp_code: rec.empCode,
    emp_name: rec.empName,
    designation: rec.designation || '',
    department: rec.department || '',
    category: rec.category,
    punch_in: rec.punchIn,
    punch_out: rec.punchOut || '',
    remarks: rec.remarks || '',
    loc_in: rec.locIn || null,
    loc_out: rec.locOut || null,
    status: rec.status,
    extra: rec.extra || {},
    source: rec.source || 'portal'
  };
  if (_recordDateColumn !== false) {
    row.record_date = rec.recordDate || extractRecordDateISO(rec) || todayISO();
  }
  return row;
}

function rowToRecord(row) {
  const rec = {
    id: Number(row.id),
    empCode: row.emp_code,
    empName: row.emp_name,
    designation: row.designation || '',
    department: row.department || '',
    category: row.category,
    punchIn: row.punch_in,
    punchOut: row.punch_out || '',
    remarks: row.remarks || '',
    locIn: row.loc_in || null,
    locOut: row.loc_out || null,
    status: row.status,
    extra: row.extra || {},
    source: row.source || 'portal',
    recordDate: row.record_date || null
  };
  ensureRecordDates(rec);
  return rec;
}

function loadRecords() {
  return _recordsCache ? _recordsCache.slice() : [];
}

function isRemoteStorageEnabled() {
  return !!supabaseConfig();
}

function requireSupabaseStorage() {
  if (!supabaseConfig()) {
    throw new Error('Supabase is required. Open https://citi-homes.github.io/Attendance.Portal/ — data is not saved on this device.');
  }
}

async function loadRecordsAsync() {
  requireSupabaseStorage();
  await probeRecordDateColumn();
  const sb = supabaseConfig();
  const res = await fetch(sb.url + '/rest/v1/' + REC_TABLE + '?select=*&order=id.desc', {
    headers: sbHeaders()
  });
  if (!res.ok) throw new Error('Failed to load records: ' + (await res.text()));
  _recordsCache = (await res.json()).map(rowToRecord);
  return _recordsCache.slice();
}

async function upsertRecordAsync(rec) {
  requireSupabaseStorage();
  await probeRecordDateColumn();
  const sb = supabaseConfig();
  const res = await fetch(sb.url + '/rest/v1/' + REC_TABLE, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(recordToRow(rec))
  });
  if (!res.ok) throw new Error('Failed to save record: ' + (await res.text()));
  const saved = rowToRecord((await res.json())[0]);
  if (_recordsCache) {
    const idx = _recordsCache.findIndex(r => r.id === saved.id);
    if (idx >= 0) _recordsCache[idx] = saved; else _recordsCache.unshift(saved);
  }
  return saved;
}

async function upsertRecordsBulkAsync(recs) {
  if (!recs.length) return;
  requireSupabaseStorage();
  await probeRecordDateColumn();
  const sb = supabaseConfig();
  const res = await fetch(sb.url + '/rest/v1/' + REC_TABLE, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(recs.map(recordToRow))
  });
  if (!res.ok) throw new Error('Failed to save records: ' + (await res.text()));
  _recordsCache = null;
}

async function deleteRecordAsync(id) {
  requireSupabaseStorage();
  const sb = supabaseConfig();
  const res = await fetch(sb.url + '/rest/v1/' + REC_TABLE + '?id=eq.' + id, {
    method: 'DELETE',
    headers: sbHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete record: ' + (await res.text()));
  if (_recordsCache) _recordsCache = _recordsCache.filter(r => r.id !== id);
}

async function loadEmployeeProfilesAsync(force) {
  if (_employeeProfilesCache && !force) return Object.assign({}, _employeeProfilesCache);
  const sb = supabaseConfig();
  if (!sb) {
    _employeeProfilesCache = {};
    return {};
  }
  try {
    const res = await fetch(sb.url + '/rest/v1/' + PROFILE_TABLE + '?select=emp_code,photo_data,updated_at', {
      headers: sbHeaders()
    });
    if (!res.ok) {
      const body = await res.text();
      if (body.includes('does not exist') || body.includes('PGRST205') || res.status === 404) {
        _employeeProfilesCache = {};
        return {};
      }
      throw new Error('Failed to load employee profiles: ' + body);
    }
    const rows = await res.json();
    _employeeProfilesCache = rows.reduce((acc, row) => {
      acc[row.emp_code] = {
        photoData: row.photo_data || '',
        updatedAt: row.updated_at || ''
      };
      return acc;
    }, {});
    return Object.assign({}, _employeeProfilesCache);
  } catch (_) {
    _employeeProfilesCache = _employeeProfilesCache || {};
    return Object.assign({}, _employeeProfilesCache);
  }
}

function getEmployeeProfilePhoto(empCode) {
  const cloud = _employeeProfilesCache && _employeeProfilesCache[empCode] && _employeeProfilesCache[empCode].photoData;
  if (cloud) return cloud;
  try {
    return localStorage.getItem(employeeProfilePhotoKey(empCode)) || '';
  } catch (_) {
    return '';
  }
}

async function saveEmployeeProfilePhotoAsync(empCode, photoData) {
  requireSupabaseStorage();
  const sb = supabaseConfig();
  const row = {
    emp_code: empCode,
    photo_data: photoData || '',
    updated_at: new Date().toISOString()
  };
  const res = await fetch(sb.url + '/rest/v1/' + PROFILE_TABLE, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(row)
  });
  if (!res.ok) {
    const body = await res.text();
    if (body.includes('employee_profiles') && (body.includes('does not exist') || body.includes('PGRST205') || res.status === 404)) {
      throw new Error('Profile photo table is not ready. Run supabase-setup.sql in Supabase SQL Editor, then try again.');
    }
    throw new Error('Failed to save profile photo: ' + body);
  }
  const saved = (await res.json())[0] || row;
  _employeeProfilesCache = _employeeProfilesCache || {};
  _employeeProfilesCache[empCode] = {
    photoData: saved.photo_data || '',
    updatedAt: saved.updated_at || row.updated_at
  };
  try {
    if (photoData) localStorage.setItem(employeeProfilePhotoKey(empCode), photoData);
    else localStorage.removeItem(employeeProfilePhotoKey(empCode));
  } catch (_) {}
  return _employeeProfilesCache[empCode];
}

async function persistRecord(rec) {
  ensureRecordDates(rec);
  await upsertRecordAsync(rec);
  if (_recordsCache) {
    const idx = _recordsCache.findIndex(r => r.id === rec.id);
    if (idx >= 0) _recordsCache[idx] = rec;
    else _recordsCache.unshift(rec);
  }
}

function notifySaveError(err) {
  console.error(err);
  const msg = String(err && err.message ? err.message : err);
  if (msg.includes('42501') || msg.includes('permission denied')) {
    alert('Database permissions missing.\n\nRun supabase-fix-permissions.sql in Supabase SQL Editor\n(or click "Copy permissions fix SQL" on setup.html).');
    return;
  }
  if (msg.includes('attendance_records') && (msg.includes('does not exist') || msg.includes('PGRST205') || msg.includes('404'))) {
    alert('Cloud database is not set up yet.\n\nAsk your administrator to run:\n  npm run setup:db\n\nOr paste supabase-setup.sql into Supabase → SQL Editor.');
    return;
  }
  if (msg.includes('employee_profiles') || msg.includes('Profile photo table')) {
    alert('Profile photo storage is not set up yet.\n\nRun the latest supabase-setup.sql in Supabase SQL Editor, then try again.');
    return;
  }
  alert('Could not save to the server. Check your internet connection and try again.\n\n' + msg);
}

async function probeRecordDateColumn() {
  if (_recordDateColumn !== null) return _recordDateColumn;
  const sb = supabaseConfig();
  if (!sb) {
    _recordDateColumn = false;
    return false;
  }
  try {
    const res = await fetch(sb.url + '/rest/v1/' + REC_TABLE + '?select=record_date&limit=1', {
      headers: sbHeaders()
    });
    _recordDateColumn = res.ok;
  } catch (_) {
    _recordDateColumn = false;
  }
  return _recordDateColumn;
}

async function checkRemoteStorageHealth() {
  const sb = supabaseConfig();
  if (!sb) return { ok: false, reason: 'not_configured' };
  try {
    const res = await fetch(sb.url + '/rest/v1/' + REC_TABLE + '?select=id&limit=1', { headers: sbHeaders() });
    if (res.ok) {
      const hasRecordDate = await probeRecordDateColumn();
      return { ok: true, recordDateColumn: hasRecordDate };
    }
    const body = await res.text();
    if (body.includes('does not exist') || body.includes('PGRST205') || res.status === 404) {
      return { ok: false, reason: 'table_missing' };
    }
    if (body.includes('42501') || body.includes('permission denied')) {
      return { ok: false, reason: 'permissions_missing' };
    }
    return { ok: false, reason: 'error', detail: body };
  } catch (e) {
    return { ok: false, reason: 'network', detail: e.message };
  }
}

async function migrateLocalRecordsToCloud() {
  purgeLegacyLocalRecords();
  return { migrated: 0, skipped: true, reason: 'cloud_only' };
}

function setAppLoading(on, message) {
  const el = document.getElementById('app-loading');
  if (!el) return;
  const msg = el.querySelector('.app-loading-msg');
  if (msg && message) msg.textContent = message;
  el.classList.toggle('open', !!on);
}

function showStorageBanner(health) {
  const el = document.getElementById('storage-banner');
  if (!el || !health) return;
  if (health.ok && health.recordDateColumn === false) {
    el.innerHTML = '<span>For reliable monthly reports, run <code>supabase-add-record-date.sql</code> in Supabase SQL Editor (see setup page).</span>';
    el.className = 'storage-banner storage-banner-warn open';
    return;
  }
  if (health.ok) return;
  if (health.reason === 'table_missing') {
    el.innerHTML = '<span>Cloud database not ready — run <code>npm run setup:db</code> or execute <code>supabase-setup.sql</code> in Supabase SQL Editor.</span>';
    el.className = 'storage-banner storage-banner-warn open';
  } else if (health.reason === 'permissions_missing') {
    el.innerHTML = '<span>Database permissions missing — run <code>supabase-fix-permissions.sql</code> in Supabase SQL Editor (see setup.html).</span>';
    el.className = 'storage-banner storage-banner-warn open';
  } else if (health.reason === 'not_configured') {
    el.innerHTML = '<span>Cloud storage not configured — use the GitHub Pages app URL after deploy.</span>';
    el.className = 'storage-banner storage-banner-warn open';
  } else {
    el.innerHTML = '<span>Could not reach cloud storage. Check internet connection and refresh.</span>';
    el.className = 'storage-banner storage-banner-warn open';
  }
}

// ── Manual timesheet (admin Excel import) ────────────────────────────────────
const MANUAL_TS_RANGE={start:'2026-06-01',end:'2026-06-30'};

function isoToDDMMYYYY(iso){
  if(!iso||!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso||'';
  const [y,m,d]=iso.split('-');
  return `${d}-${m}-${y}`;
}

function manualTsRangeLabel(){
  return isoToDDMMYYYY(MANUAL_TS_RANGE.start)+' – '+isoToDDMMYYYY(MANUAL_TS_RANGE.end);
}

function nextRecordId(recs){
  if(!recs.length) return Date.now();
  return Math.max(...recs.map(r=>Number(r.id)||0))+1;
}

function dateISOFromParts(y,m,d){return `${y}-${p2(m)}-${p2(d)}`;}

function parseFlexibleDate(str){
  if(!str) return null;
  if(str instanceof Date&&!isNaN(str)) return dateISOFromParts(str.getFullYear(),str.getMonth()+1,str.getDate());
  if(typeof str==='number'&&str>0){
    const epoch=new Date(Date.UTC(1899,11,30));
    const d=new Date(epoch.getTime()+str*86400000);
    return dateISOFromParts(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate());
  }
  const s=String(str).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(dmy){
    const day=parseInt(dmy[1],10), m=parseInt(dmy[2],10), y=parseInt(dmy[3],10);
    if(m>=1&&m<=12&&day>=1&&day<=31) return dateISOFromParts(y,m,day);
  }
  const named=s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if(named){
    const mon=named[2].slice(0,3).toLowerCase();
    const idx=MONTH_SHORT.findIndex(m=>m.toLowerCase()===mon);
    if(idx>=0) return dateISOFromParts(parseInt(named[3],10),idx+1,parseInt(named[1],10));
  }
  if(!isNaN(Date.parse(s))){
    const d=new Date(s);
    return dateISOFromParts(d.getFullYear(),d.getMonth()+1,d.getDate());
  }
  return null;
}

function normalizeTime(str){
  if(!str) return '';
  const s=String(str).trim();
  if(!s) return '';
  const ampm=s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if(ampm){
    let h=parseInt(ampm[1],10),m=ampm[2],sec=ampm[3]||'00';
    const ap=ampm[4].toUpperCase();
    if(ap==='PM'&&h<12) h+=12;
    if(ap==='AM'&&h===12) h=0;
    return `${p2(h)}:${m}:${sec}`;
  }
  const parts=s.split(':');
  if(parts.length>=2){
    const h=p2(parseInt(parts[0],10)||0);
    const m=p2(parseInt(parts[1],10)||0);
    const sec=p2(parseInt(parts[2]||'0',10)||0);
    return `${h}:${m}:${sec}`;
  }
  return s;
}

function buildPunchFromDateAndTime(dateISO,timeStr){
  const [y,m,d]=dateISO.split('-').map(Number);
  const dt=new Date(y,m-1,d);
  return fmtDate(dt)+' · '+normalizeTime(timeStr);
}

function extractRecordDateISO(rec){
  if(!rec) return null;
  if(rec.recordDate && /^\d{4}-\d{2}-\d{2}$/.test(rec.recordDate)) return rec.recordDate;
  if(!rec.punchIn) return null;
  const punchIn=rec.punchIn;
  const iso=punchIn.match(/\d{4}-\d{2}-\d{2}/);
  if(iso) return iso[0];
  const named=punchIn.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if(named){
    const idx=MONTH_SHORT.indexOf(named[2]);
    if(idx>=0) return dateISOFromParts(parseInt(named[3],10),idx+1,parseInt(named[1],10));
  }
  return null;
}

function ensureRecordDates(rec){
  if(!rec) return rec;
  rec.recordDate=extractRecordDateISO(rec)||todayISO();
  return rec;
}

function recordMonthKey(rec){
  const iso=extractRecordDateISO(rec);
  if(!iso) return null;
  const [y,m]=iso.split('-').map(Number);
  if(m<1||m>12) return null;
  return MONTH_SHORT[m-1]+' '+y;
}

function monthKeySortVal(key){
  if(!key) return 0;
  const parts=key.split(' ');
  if(parts.length<2) return 0;
  const mi=MONTH_SHORT.indexOf(parts[0]);
  return parseInt(parts[1],10)*100+(mi>=0?mi:0);
}

function currentMonthKey(){
  const d=new Date();
  return MONTH_SHORT[d.getMonth()]+' '+d.getFullYear();
}

function listRecordMonthKeys(recs){
  return [...new Set((recs||[]).map(recordMonthKey).filter(Boolean))]
    .sort((a,b)=>monthKeySortVal(b)-monthKeySortVal(a));
}

function recordMatchesMonth(rec,monthKey){
  if(!monthKey) return true;
  return recordMonthKey(rec)===monthKey;
}

function recordsForMonth(recs,monthKey){
  return (recs||[]).filter(r=>recordMatchesMonth(r,monthKey));
}

function formatRecordDate(rec){
  const iso=extractRecordDateISO(rec);
  if(iso){
    const [y,m,d]=iso.split('-').map(Number);
    return fmtDate(new Date(y,m-1,d));
  }
  if(!rec||!rec.punchIn) return '';
  return rec.punchIn.includes('·')?rec.punchIn.split('·')[0].trim():rec.punchIn.substring(0,15);
}

function monthOptionsHtml(months,blankLabel){
  const keys=[...new Set([...(months||[]),currentMonthKey()])]
    .sort((a,b)=>monthKeySortVal(b)-monthKeySortVal(a));
  const blank=blankLabel?`<option value="">${escapeHtml(blankLabel)}</option>`:'';
  return blank+keys.map(m=>`<option>${escapeHtml(m)}</option>`).join('');
}

function isInManualTsRange(dateISO){
  return dateISO&&dateISO>=MANUAL_TS_RANGE.start&&dateISO<=MANUAL_TS_RANGE.end;
}

function manualTsRecords(recs){
  return recs.filter(r=>isInManualTsRange(extractRecordDateISO(r)));
}

// ── Location helper (Android app + browser) ───────────────────────────────────
let _silentLocCache=null;

function isCapacitorApp(){
  return typeof window!=='undefined'&&window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform();
}

function locFromCoords(coords){
  return {
    lat:coords.latitude.toFixed(6),
    lng:coords.longitude.toFixed(6),
    acc:Math.round(coords.accuracy)+'m',
    src:isCapacitorApp()?'GPS (App)':'GPS'
  };
}

function deniedLoc(){return {lat:'Denied',lng:'',acc:'',src:'Denied'};}
function unavailableLoc(){return {lat:'Unavailable',lng:'',acc:'',src:'Unavailable'};}

async function getLocationCapacitor(cb){
  const Geo=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Geolocation;
  if(!Geo) return false;
  try{
    let perm=await Geo.checkPermissions();
    if(perm.location!=='granted'&&perm.coarseLocation!=='granted'){
      perm=await Geo.requestPermissions();
    }
    if(perm.location!=='granted'&&perm.coarseLocation!=='granted'){
      cb(deniedLoc());
      return true;
    }
    const p=await Geo.getCurrentPosition({enableHighAccuracy:true,timeout:15000,maximumAge:0});
    const loc=locFromCoords(p.coords);
    _silentLocCache=loc;
    cb(loc);
  }catch(_){
    cb(unavailableLoc());
  }
  return true;
}

function getLocationBrowser(cb){
  if(!navigator.geolocation){cb({lat:'N/A',lng:'',acc:'',src:'Not supported'});return;}
  navigator.geolocation.getCurrentPosition(
    p=>{
      const loc=locFromCoords(p.coords);
      _silentLocCache=loc;
      cb(loc);
    },
    ()=>cb(unavailableLoc()),
    {enableHighAccuracy:true,timeout:15000,maximumAge:isCapacitorApp()?0:60000}
  );
}

function getLocation(cb){
  if(isCapacitorApp()){
    getLocationCapacitor(cb);
    return;
  }
  getLocationBrowser(cb);
}

function prefetchSilentLocation(){
  if(isCapacitorApp()){
    getLocationCapacitor(()=>{});
    return;
  }
  if(!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    p=>{_silentLocCache=locFromCoords(p.coords);},
    ()=>{},
    {enableHighAccuracy:true,timeout:15000,maximumAge:60000}
  );
}

function getSilentLocSnapshot(){
  prefetchSilentLocation();
  return _silentLocCache?{..._silentLocCache}:{lat:'Pending',lng:'',acc:'',src:'Pending'};
}

function refreshRecordLoc(rec,field,saveFn){
  getLocation(loc=>{
    rec[field]=loc;
    _silentLocCache=loc;
    if(saveFn) saveFn();
  });
}

// ── Badge HTML helpers ───────────────────────────────────────────────────────
function catBadge(cat){
  const map={Office:'badge-blue',Procurement:'badge-orange',Interview:'badge-green'};
  return `<span class="badge ${map[cat]||'badge-gray'}">${cat}</span>`;
}
function statusBadge(s){
  if(s==='Completed'||s==='Recorded') return `<span class="badge badge-green">${s}</span>`;
  if(s==='In Progress') return `<span class="badge badge-orange">${s}</span>`;
  return `<span class="badge badge-blue">${s}</span>`;
}

// -- Employee profile photo ---------------------------------------------------
function initEmployeeProfilePhoto(session) {
  if (!session || !session.empCode || typeof document === "undefined") return;
  const run = () => mountEmployeeProfilePhoto(session);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
}

function mountEmployeeProfilePhoto(session) {
  if (document.getElementById("employee-profile-photo")) return;
  const host = document.querySelector("#profile-photo-host, .emp-profile, .profile-card, .employee-card, .glass-card, .card");
  if (!host) return;
  ensureEmployeeProfilePhotoStyle();
  const emp = session.emp || {};
  const name = emp.name || session.empCode;
  const panel = document.createElement("div");
  panel.id = "employee-profile-photo";
  panel.className = "employee-profile-photo";
  panel.innerHTML = [
    "<button class=\"profile-photo-avatar\" type=\"button\" data-profile-photo-change aria-label=\"Change profile photo\"><span></span></button>",
    "<div class=\"profile-photo-copy\"><strong>Profile Photo</strong><small>" + escapeHtml(name) + "</small></div>",
    "<div class=\"profile-photo-actions\">",
    "<button class=\"profile-photo-btn profile-photo-primary\" type=\"button\" data-profile-photo-change>Change</button>",
    "<button class=\"profile-photo-btn\" type=\"button\" data-profile-photo-remove>Remove</button>",
    "</div>",
    "<input class=\"profile-photo-input\" type=\"file\" accept=\"image/*\">"
  ].join("");
  if (host.id === "profile-photo-host") host.appendChild(panel);
  else host.insertBefore(panel, host.firstChild);

  const input = panel.querySelector(".profile-photo-input");
  panel.querySelectorAll("[data-profile-photo-change]").forEach(btn => {
    btn.addEventListener("click", () => input.click());
  });
  panel.querySelector("[data-profile-photo-remove]").addEventListener("click", async () => {
    setEmployeeProfilePhotoBusy(panel, true);
    try {
      await saveEmployeeProfilePhotoAsync(session.empCode, "");
      renderEmployeeProfilePhoto(panel, session.empCode, name);
    } catch (err) {
      notifySaveError(err);
    } finally {
      setEmployeeProfilePhotoBusy(panel, false);
    }
  });
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    setEmployeeProfilePhotoBusy(panel, true);
    try {
      const dataUrl = await resizeEmployeeProfilePhoto(file);
      await saveEmployeeProfilePhotoAsync(session.empCode, dataUrl);
      renderEmployeeProfilePhoto(panel, session.empCode, name);
    } catch (err) {
      if (String(err && err.message ? err.message : err).includes("valid")) alert("Please choose a valid photo.");
      else notifySaveError(err);
    } finally {
      setEmployeeProfilePhotoBusy(panel, false);
    }
  });
  renderEmployeeProfilePhoto(panel, session.empCode, name);
  loadEmployeeProfilesAsync().then(async () => {
    const localPhoto = getEmployeeProfilePhoto(session.empCode);
    const cloudPhoto = _employeeProfilesCache && _employeeProfilesCache[session.empCode] && _employeeProfilesCache[session.empCode].photoData;
    if (localPhoto && !cloudPhoto) {
      try { await saveEmployeeProfilePhotoAsync(session.empCode, localPhoto); } catch (_) {}
    }
    renderEmployeeProfilePhoto(panel, session.empCode, name);
  });
}

function employeeProfilePhotoKey(empCode) {
  return "citiHomesProfilePhoto:" + empCode;
}

function employeeInitials(name) {
  const parts = String(name || "CH").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "C") + (parts.length > 1 ? parts[parts.length - 1][0] : "H");
}

function renderEmployeeProfilePhoto(panel, empCode, name) {
  const avatar = panel.querySelector(".profile-photo-avatar");
  avatar.innerHTML = employeeProfileAvatarHtml(empCode, name);
  const sidebarAvatar = document.getElementById("sb-avatar");
  if (sidebarAvatar) {
    sidebarAvatar.classList.add("emp-avatar-has-photo");
    sidebarAvatar.innerHTML = employeeProfileAvatarHtml(empCode, name);
  }
}

function employeeProfileAvatarHtml(empCode, name) {
  const saved = getEmployeeProfilePhoto(empCode);
  return saved
    ? "<img src=\"" + saved + "\" alt=\"Profile photo\">"
    : "<span>" + escapeHtml(employeeInitials(name).toUpperCase()) + "</span>";
}

function setEmployeeProfilePhotoBusy(panel, busy) {
  panel.querySelectorAll("button").forEach(btn => btn.disabled = !!busy);
  panel.classList.toggle("is-saving", !!busy);
}

function resizeEmployeeProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith("image/")) {
      reject(new Error("Invalid image"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 420;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function ensureEmployeeProfilePhotoStyle() {
  if (document.getElementById("employee-profile-photo-style")) return;
  const style = document.createElement("style");
  style.id = "employee-profile-photo-style";
  style.textContent = ".employee-profile-photo{display:flex;align-items:center;gap:12px;margin:0 0 16px;padding:12px;border-radius:20px;background:linear-gradient(135deg,rgba(255,255,255,.76),rgba(255,255,255,.24)),linear-gradient(135deg,rgba(219,178,94,.34),rgba(23,46,56,.16));border:1px solid rgba(255,255,255,.72);box-shadow:inset 0 1px 0 rgba(255,255,255,.82),0 18px 45px rgba(20,31,35,.14);backdrop-filter:blur(22px) saturate(1.45);-webkit-backdrop-filter:blur(22px) saturate(1.45)}.employee-profile-photo.is-saving{opacity:.72;pointer-events:none}.profile-photo-avatar,.employee-photo-mini{border:0;border-radius:999px;padding:0;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#f8e7b6,#d3a34d 54%,#1e3e4a);color:#fff;font-weight:900;box-shadow:inset 0 1px 0 rgba(255,255,255,.86),0 12px 28px rgba(30,62,74,.25)}.profile-photo-avatar{width:70px;height:70px;flex:0 0 70px;font-size:22px;cursor:pointer}.employee-photo-mini{width:42px;height:42px;font-size:13px}.profile-photo-avatar img,.employee-photo-mini img,.emp-avatar-has-photo img{width:100%;height:100%;display:block;object-fit:cover}.emp-avatar-has-photo{overflow:hidden}.profile-photo-copy{min-width:0;display:flex;flex:1 1 auto;flex-direction:column;gap:3px}.profile-photo-copy strong{font-size:13px;font-weight:900;color:#14282f}.profile-photo-copy small{font-size:11.5px;color:rgba(20,40,47,.68);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.profile-photo-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}.profile-photo-btn{appearance:none;border:1px solid rgba(255,255,255,.75);border-radius:999px;padding:9px 12px;background:rgba(255,255,255,.45);color:#18333d;font-size:12px;font-weight:850;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 8px 20px rgba(20,31,35,.10);cursor:pointer}.profile-photo-btn:disabled{cursor:wait;opacity:.75}.profile-photo-primary{background:linear-gradient(135deg,#f8dc8a,#d7a33d 52%,#18404c);color:#fff;border-color:rgba(255,235,180,.88)}.profile-photo-input{display:none!important}@media(max-width:560px){.employee-profile-photo{align-items:flex-start;flex-wrap:wrap}.profile-photo-actions{width:100%;margin-left:82px}.profile-photo-btn{flex:1 1 0;text-align:center}}";
  document.head.appendChild(style);
}
// -- Android app update notice ------------------------------------------------
const APP_UPDATE_INFO_URL = "https://mnfrbyzdubsgnhxrzuxx.supabase.co/storage/v1/object/public/apk-downloads/app-latest.json";
const APP_DOWNLOAD_URL = "https://mnfrbyzdubsgnhxrzuxx.supabase.co/storage/v1/object/public/apk-downloads/CitiHomesAttendance.apk";
let _appUpdateCheckStarted = false;

function canShowAppUpdateNotice(expectedRoute) {
  if (typeof window === "undefined") return false;
  const currentRoute = getCurrentRouteKey();
  if (currentRoute === "login") return false;
  if (expectedRoute && currentRoute !== expectedRoute) return false;
  const session = getSession();
  if (!session) return false;
  if (currentRoute === "employee") return session.role === "employee";
  if (currentRoute === "admin") return session.role === "admin";
  return false;
}

function getNativeAppInfo() {
  try {
    if (window.CitiHomesApp && typeof window.CitiHomesApp.getVersionCode === "function") {
      return {
        platform: "android",
        versionCode: Number(window.CitiHomesApp.getVersionCode()) || 0,
        versionName: String(window.CitiHomesApp.getVersionName ? window.CitiHomesApp.getVersionName() : ""),
        downloadUrl: String(window.CitiHomesApp.getDownloadUrl ? window.CitiHomesApp.getDownloadUrl() : APP_DOWNLOAD_URL)
      };
    }
  } catch (_) {}
  try {
    const saved = JSON.parse(localStorage.getItem("citiHomesNativeApp") || "null");
    if (saved && saved.platform === "android") return saved;
  } catch (_) {}
  if ((navigator.userAgent || "").includes("; wv)")) {
    return { platform: "android", versionCode: 0, versionName: "", downloadUrl: APP_DOWNLOAD_URL };
  }
  return null;
}

async function initAppUpdateNotice(expectedRoute) {
  if (_appUpdateCheckStarted || typeof window === "undefined") return;
  if (!canShowAppUpdateNotice(expectedRoute)) return;
  _appUpdateCheckStarted = true;
  await new Promise(resolve => setTimeout(resolve, 700));
  if (!canShowAppUpdateNotice(expectedRoute)) {
    _appUpdateCheckStarted = false;
    return;
  }
  const installed = getNativeAppInfo();
  if (!installed || installed.platform !== "android") return;
  try {
    const res = await fetch(APP_UPDATE_INFO_URL + "?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;
    const latest = await res.json();
    const latestCode = Number(latest.versionCode) || 0;
    const installedCode = Number(installed.versionCode) || 0;
    if (!latestCode || installedCode >= latestCode) return;
    updateDownloadButtonsForAppUpdate(installed, latest);
    showAppUpdateNotice(installed, latest);
  } catch (_) {}
}

function showAppUpdateNotice(installed, latest) {
  if (document.getElementById("app-update-notice")) return;
  const downloadUrl = latest.downloadUrl || installed.downloadUrl || APP_DOWNLOAD_URL;
  const versionLabel = latest.versionName || latest.versionCode || "latest";
  const notice = document.createElement("div");
  notice.id = "app-update-notice";
  notice.innerHTML = "<div class=\"app-update-copy\"><strong>App update available</strong><span>Please update Citi Homes Attendance to version " + versionLabel + ".</span></div><a class=\"app-update-btn\" href=\"" + downloadUrl + "\" download=\"CitiHomesAttendance.apk\">Update App</a>";
  document.body.appendChild(notice);
  ensureAppUpdateNoticeStyle();
}

function updateDownloadButtonsForAppUpdate(installed, latest) {
  const downloadUrl = latest.downloadUrl || installed.downloadUrl || APP_DOWNLOAD_URL;
  document.querySelectorAll(".btn-download-app").forEach(btn => {
    btn.href = downloadUrl;
    btn.setAttribute("download", "CitiHomesAttendance.apk");
    btn.setAttribute("aria-label", "Update Citi Homes Attendance Android app");
    btn.textContent = "Update App";
    btn.classList.add("btn-app-update-available");
  });
}

function ensureAppUpdateNoticeStyle() {
  if (document.getElementById("app-update-notice-style")) return;
  const style = document.createElement("style");
  style.id = "app-update-notice-style";
  style.textContent = "#app-update-notice{position:fixed;left:16px;right:16px;bottom:max(16px,env(safe-area-inset-bottom));z-index:9999;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 14px;border-radius:18px;background:linear-gradient(135deg,rgba(255,255,255,.86),rgba(255,255,255,.35)),linear-gradient(135deg,#fff1b8,#d8ad5f 52%,#fff7dc);border:1px solid rgba(255,238,184,.96);box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 18px 44px rgba(61,48,33,.24);backdrop-filter:blur(24px) saturate(1.5);-webkit-backdrop-filter:blur(24px) saturate(1.5);color:#20160a}#app-update-notice .app-update-copy{display:flex;flex-direction:column;min-width:0;line-height:1.25}#app-update-notice strong{font-size:13px;font-weight:800}#app-update-notice span{font-size:11.5px;color:#4d3a1e}#app-update-notice .app-update-btn{flex:0 0 auto;text-decoration:none!important;padding:10px 14px;border-radius:999px;background:#20160a;color:#fff;font-weight:800;font-size:12px;box-shadow:0 10px 24px rgba(32,22,10,.28)}@media(max-width:520px){#app-update-notice{left:10px;right:10px;align-items:stretch;flex-direction:column}#app-update-notice .app-update-btn{text-align:center}}";
  document.head.appendChild(style);
}

if (typeof window !== "undefined") {
  window.addEventListener("citiHomesNativeAppReady", () => {
    if (!canShowAppUpdateNotice()) return;
    _appUpdateCheckStarted = false;
    initAppUpdateNotice();
  });
}
