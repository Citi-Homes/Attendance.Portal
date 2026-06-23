// ── shared.js — common data, helpers, session guard ──────────────────────────
"use strict";

const EMPLOYEES = {

  "CH6": {
    name: "Jehanzaib Akbar",
    desig: "Manager Business Excellence & Finance",
    dept: "Citi Homes",
    email: "jehanzaib@citihomes.ae",
    status: "Active"
  },

  "CH3": {
    name: "Mohammed Irfan",
    desig: "Operations Manager",
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
const ROUTES = {
  login: "index.html",
  employee: "employee.html",
  admin: "admin.html"
};

const SESSION_KEY = "att_session_v4";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_ATTEMPTS_KEY = "att_login_attempts";
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

function getConfig() {
  return typeof window !== "undefined" && window.ATT_CONFIG ? window.ATT_CONFIG : null;
}

function ensureConfig() {
  const cfg = getConfig();
  if (!cfg || !cfg.sessionSecret) {
    throw new Error("Missing config.js — copy config.example.js to config.js and set credentials.");
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
  const cfg = ensureConfig();
  const hash = cfg.employeePassHashes && cfg.employeePassHashes[code];
  if (!hash) return false;
  return (await sha256(password)) === hash;
}

async function verifyAdminCredentials(user, password) {
  const cfg = ensureConfig();
  const admins = cfg.admins || (cfg.admin ? [cfg.admin] : []);
  if (!admins.length) return false;
  const inputHash = await sha256(password);
  return admins.some(a => a.user === user && inputHash === a.passHash);
}

function navigateTo(route) {
  window.location.href = ROUTES[route] || route;
}

function navigateReplace(route) {
  window.location.replace(ROUTES[route] || route);
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

    if (payload.role === "admin") return { role: "admin" };
    return null;
  } catch {
    return null;
  }
}

function getSession() {
  return parseSession(sessionStorage.getItem(SESSION_KEY));
}

function setSession(data) {
  const cfg = ensureConfig();
  const payload = {
    role: data.role,
    empCode: data.empCode || null,
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
  return { role: "employee", empCode: s.empCode, emp: fresh };
}

function requireAdmin() {
  const s = getSession();
  if (!s || s.role !== "admin") {
    navigateReplace("login");
    throw 0;
  }
  return s;
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

// ── Records storage ──────────────────────────────────────────────────────────
const REC_KEY='att_v3_records';
function loadRecords(){try{return JSON.parse(localStorage.getItem(REC_KEY)||'[]');}catch{return[];}}
function saveRecords(recs){localStorage.setItem(REC_KEY,JSON.stringify(recs));}

// ── Manual timesheet (admin Excel import) ────────────────────────────────────
const MANUAL_TS_RANGE={start:'2026-06-01',end:'2026-06-22'};

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
  const slash=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(slash){
    const a=parseInt(slash[1],10),b=parseInt(slash[2],10),y=parseInt(slash[3],10);
    const day=a>12?a:b,m=a>12?b:a;
    return dateISOFromParts(y,m,day);
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
  if(!rec||!rec.punchIn) return null;
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

function isInManualTsRange(dateISO){
  return dateISO&&dateISO>=MANUAL_TS_RANGE.start&&dateISO<=MANUAL_TS_RANGE.end;
}

function manualTsRecords(recs){
  return recs.filter(r=>isInManualTsRange(extractRecordDateISO(r)));
}

// ── Location helper (silent background capture — no employee UI) ─────────────
let _silentLocCache=null;

function getLocation(cb){
  if(!navigator.geolocation){cb({lat:'N/A',lng:'',acc:'',src:'Not supported'});return;}
  navigator.geolocation.getCurrentPosition(
    p=>{
      const loc={lat:p.coords.latitude.toFixed(6),lng:p.coords.longitude.toFixed(6),acc:Math.round(p.coords.accuracy)+'m',src:'GPS'};
      _silentLocCache=loc;
      cb(loc);
    },
    ()=>cb({lat:'Unavailable',lng:'',acc:'',src:'Unavailable'}),
    {timeout:10000,maximumAge:300000}
  );
}

function prefetchSilentLocation(){
  if(!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    p=>{_silentLocCache={lat:p.coords.latitude.toFixed(6),lng:p.coords.longitude.toFixed(6),acc:Math.round(p.coords.accuracy)+'m',src:'GPS'};},
    ()=>{},
    {timeout:10000,maximumAge:300000}
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
