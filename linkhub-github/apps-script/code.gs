/**
 * ศูนย์รวมลิงก์ รพ.กองบิน กองบิน 5  —  Code.gs  (เวอร์ชัน GitHub Pages + ระบบสมาชิก)
 *
 * เริ่มใช้งาน : รัน setup() หนึ่งครั้ง แล้วดูรหัสผ่านผู้ดูแลหลักที่ "บันทึกการดำเนินการ" (Execution log)
 * ลืมรหัส admin: รัน resetAdminPassword()
 *
 * บัญชี 3 แบบ
 *   - ผู้เยี่ยมชม  : ไม่ต้องเข้าสู่ระบบ เห็นเฉพาะรายการที่ตั้งเป็น "ทุกคน"
 *   - สมาชิก (user): สมัครเองแล้วใช้ได้ทันที เห็น "ทุกคน" + "เฉพาะสมาชิก"
 *   - แอดมิน (admin): เห็น/แก้ไขได้ทั้งหมด จัดการสมาชิก ดูประวัติเข้าใช้
 *   - ชื่อผู้ใช้ "admin" = ผู้ดูแลหลัก ใช้รหัสผ่านที่ setup() สร้างให้ (เก็บใน Script Properties)
 *
 * การกรองข้อมูลตามสิทธิ์ทำที่ฝั่งเซิร์ฟเวอร์ทั้งหมด (getData) — รายการที่ผู้ใช้ไม่มีสิทธิ์จะไม่ถูกส่งออกไปเลย
 */
const SHEET_NAME = 'ชีต1';              // ลิงก์/ข้อมูลย่อย: ID | ชื่อ | กลุ่ม | URL | ไอคอน | รายละเอียด | ลำดับ | การมองเห็น
const SETTINGS_SHEET_NAME = 'ตั้งค่า';   // แถว 2: โลโก้ | ชื่อหน่วยงาน | โหมดมืด | พื้นหลัง | ชื่อรอง | ผู้พัฒนา...
const GROUP_SHEET_NAME = 'กลุ่มงาน';     // ID | ชื่อกลุ่ม | ชื่ออังกฤษ | ไอคอน | ลำดับ | การมองเห็น
const NEWS_SHEET = 'ข่าวสาร';           // ID | หัวข้อ | ประเภท | เนื้อหา | รูปปก | วันที่ | ปักหมุด | การมองเห็น
const NOTICE_SHEET = 'ประกาศ';          // ID | ชนิด(banner/popup) | หัวข้อ | ข้อความ | รูป | ลิงก์ | เริ่ม | สิ้นสุด | เปิดใช้
const PAGE_SHEET = 'แท็บเมนู';          // ID | ชื่อแท็บ | ไอคอน | เนื้อหา | ลิงก์(JSON) | ลำดับ | เปิดใช้ | การมองเห็น
const USER_SHEET = 'สมาชิก';            // ID | ชื่อผู้ใช้ | ชื่อ-สกุล | สังกัด | รหัสผ่าน(แฮช) | สิทธิ์ | ใช้งาน | สมัครเมื่อ | เข้าใช้ล่าสุด | จำนวนครั้ง | รุ่นเซสชัน
const LOG_SHEET = 'ประวัติเข้าใช้';      // เวลา | ชื่อผู้ใช้ | ชื่อ-สกุล | เหตุการณ์ | รายละเอียด
const SESSION_SEC = 21600;              // เข้าสู่ระบบได้ 6 ชั่วโมง (สูงสุดของ CacheService)

/* ความปลอดภัยการเข้าสู่ระบบ */
const LOGIN_MAX_FAILS = 5;              // ใส่รหัสผิดติดกันได้กี่ครั้งก่อนถูกล็อก
const LOGIN_LOCK_MS = 10 * 60 * 1000;   // ล็อก 10 นาที
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // ไม่ผิดต่อเนื่องเกินช่วงนี้ ตัวนับเริ่มใหม่
const PW_MIN = 10;                      // รหัสผ่านผู้ดูแลหลักขั้นต่ำ
const USER_PW_MIN = 8;                  // รหัสผ่านสมาชิกขั้นต่ำ
const PW_MAX = 128;
const HASH_ROUNDS = 100;                // จำนวนรอบแฮชรหัสผ่านสมาชิก
const MAX_USERS = 1500;
const REG_MAX_PER_WINDOW = 150;         // จำนวนครั้งที่สมัคร/ลองสมัคร ต่อ 10 นาที (ทั้งระบบ)
const REG_CODE_MAX_FAILS = 10;          // ใส่รหัสสมัครผิดได้กี่ครั้งต่อ 10 นาที
const LOCK_WAIT_MS = 15000;             // รอคิวสูงสุดเมื่อมีคนใช้งานพร้อมกัน
const LOG_MAX = 20000, LOG_TRIM = 2000; // เก็บประวัติสูงสุดกี่แถว / ตัดแถวเก่าทิ้งครั้งละกี่แถว

const LV_ = { public: 0, member: 1, admin: 2 };      // ระดับการมองเห็น
const RESERVED_ = ['admin', 'administrator', 'root', 'system'];

const DEFAULT_GROUPS = [
  ['it', 'ระบบบริการด้านไอทีสำหรับเจ้าหน้าที่', 'IT Services & Helpdesk', '💻', 1],
  ['hr', 'ระบบบริหารจัดการองค์กร / บุคลากร', 'Hospital HR & Office System', '👥', 2],
  ['kb', 'คลังความรู้ คู่มือ และดาวน์โหลด', 'Knowledge Base & Downloads', '📚', 3],
  ['data', 'ระบบฐานข้อมูลและรายงานสารสนเทศ', 'Data & Analytics', '📊', 4],
  ['about', 'ข้อมูลองค์กรและการติดต่อ', 'About Us & Contact', '🏥', 5]
];
const DEFAULT_SITE = 'สารสนเทศโรงพยาบาลกองบิน กองบิน 5';
const NEWS_TYPES = ['ข่าวประชาสัมพันธ์', 'บทความ', 'ประกาศ'];
const TZ = 'Asia/Bangkok';

/* ---------- Web API ---------- */
/**
 *  - GET            → ตรวจสถานะ (เปิดลิงก์ /exec ในเบราว์เซอร์แล้วต้องเห็น JSON)
 *  - POST {fn,args} → เรียกเฉพาะฟังก์ชันใน API_ ด้านล่าง (setup/resetAdminPassword เรียกจากเว็บไม่ได้)
 */
const API_ = {
  getData, login, register, logout, changeMyPassword,
  saveSettingsData, saveGroup, deleteGroup, moveGroup, saveLinkData, deleteLinkData,
  saveNews, deleteNews, saveNotice, deleteNotice, savePage, deletePage, uploadImage,
  listUsers, updateUser, resetUserPassword, deleteUser, getLoginLog, saveRegSettings
};
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return json_({ ok: true, service: 'linkhub', time: new Date().toISOString() }); }
function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = String(req.fn || '');
    if (!Object.prototype.hasOwnProperty.call(API_, fn)) throw new Error('ไม่รู้จักคำสั่ง');
    const args = Array.isArray(req.args) ? req.args : [];
    return json_({ ok: true, data: API_[fn].apply(null, args) });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/** ให้ทำงานได้เฉพาะเจ้าของสคริปต์ที่รันจากตัวแก้ไข (ต้องมี scope userinfo.email ใน appsscript.json) */
function ownerOnly_() {
  const me = Session.getActiveUser().getEmail(), owner = Session.getEffectiveUser().getEmail();
  if (!me || !owner) {
    throw new Error('ตรวจสอบตัวตนผู้รันไม่ได้: เพิ่ม scope "https://www.googleapis.com/auth/userinfo.email" ใน appsscript.json แล้วรันใหม่และกดอนุญาตสิทธิ์');
  }
  if (me !== owner) throw new Error('ฟังก์ชันนี้สำหรับเจ้าของสคริปต์เท่านั้น');
}

/* ---------- ติดตั้ง ---------- */
function setup() {
  ownerOnly_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = (n, head) => {
    const s = ss.getSheetByName(n) || ss.insertSheet(n);
    if (s.getLastRow() === 0) s.appendRow(head);
    else s.getRange(1, 1, 1, head.length).setValues([head]); // เติมหัวคอลัมน์ใหม่ โดยไม่แตะข้อมูลเดิม
    return s;
  };
  sheet(SHEET_NAME, ['ID', 'ชื่อ', 'กลุ่ม', 'URL', 'ไอคอน', 'รายละเอียด', 'ลำดับ', 'การมองเห็น']);
  const st = sheet(SETTINGS_SHEET_NAME, ['ProfileImage', 'SiteName', 'IsDarkMode', 'Background', 'SiteSub', 'DevName', 'DevRole', 'DevPhone']);
  st.getRange('H2').setNumberFormat('@'); // เบอร์โทรเก็บเป็นข้อความ ไม่ให้เลข 0 นำหน้าหาย
  if (st.getLastRow() < 2) st.appendRow(['', DEFAULT_SITE, false, 'preset:sky', 'ศูนย์รวมระบบสารสนเทศ']);
  const g = sheet(GROUP_SHEET_NAME, ['ID', 'ชื่อกลุ่ม', 'ชื่ออังกฤษ', 'ไอคอน', 'ลำดับ', 'การมองเห็น']);
  if (g.getLastRow() < 2) g.getRange(2, 1, DEFAULT_GROUPS.length, 5).setValues(DEFAULT_GROUPS);
  sheet(NEWS_SHEET, ['ID', 'หัวข้อ', 'ประเภท', 'เนื้อหา', 'รูปปก', 'วันที่', 'ปักหมุด', 'การมองเห็น']).getRange('F2:F2000').setNumberFormat('@');
  sheet(NOTICE_SHEET, ['ID', 'ชนิด', 'หัวข้อ', 'ข้อความ', 'รูป', 'ลิงก์', 'เริ่ม', 'สิ้นสุด', 'เปิดใช้']).getRange('G2:H2000').setNumberFormat('@');
  sheet(PAGE_SHEET, ['ID', 'ชื่อแท็บ', 'ไอคอน', 'เนื้อหา', 'ลิงก์', 'ลำดับ', 'เปิดใช้', 'การมองเห็น']);
  sheet(USER_SHEET, ['ID', 'ชื่อผู้ใช้', 'ชื่อ-สกุล', 'สังกัด', 'รหัสผ่าน (แฮช)', 'สิทธิ์', 'ใช้งาน', 'สมัครเมื่อ', 'เข้าใช้ล่าสุด', 'จำนวนครั้ง', 'รุ่นเซสชัน']);
  sheet(LOG_SHEET, ['เวลา', 'ชื่อผู้ใช้', 'ชื่อ-สกุล', 'เหตุการณ์', 'รายละเอียด']);
  const P = PropertiesService.getScriptProperties();
  if (P.getProperty('REG_OPEN') === null) P.setProperty('REG_OPEN', '1');
  if (!P.getProperty('ADMIN_HASH')) resetAdminPassword();
}

/** รันเมื่อลืมรหัสผ่าน admin: สร้างรหัสใหม่ แสดงใน Execution log ปลดล็อก และยกเลิกเซสชัน admin หลักที่ค้างอยู่ */
function resetAdminPassword() {
  ownerOnly_();
  const pw = genPw_();
  withLock_(() => { setPw_(pw); clearLoginFails_(); });
  Logger.log('รหัสผ่านผู้ดูแลหลักใหม่ (ชื่อผู้ใช้ admin): ' + pw + '  (เข้าสู่ระบบแล้วเปลี่ยนรหัสได้ทันที)');
}

/** สุ่มรหัสผ่านด้วย UUID ต้องมีทั้งตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ และตัวเลข */
function genPw_() {
  const cs = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  for (;;) {
    const hex = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    let pw = '';
    for (let i = 0; i < 12; i++) pw += cs.charAt(parseInt(hex.substr(i * 2, 2), 16) % cs.length);
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw)) return pw;
  }
}

/* ---------- สิทธิ์การมองเห็น ---------- */
const own_ = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/** อ่านจากชีต: ว่าง = ทุกคน, ค่าที่ไม่รู้จัก = เฉพาะแอดมิน (ปิดไว้ก่อนเพื่อความปลอดภัย) */
function accOut_(v) { v = String(v == null ? '' : v).trim().toLowerCase(); if (!v) return 'public'; return own_(LV_, v) ? v : 'admin'; }
/** รับจากหน้าเว็บ: ต้องเป็นค่าที่กำหนดเท่านั้น */
function accIn_(v) { v = String(v == null || v === '' ? 'public' : v).trim(); if (!own_(LV_, v)) throw new Error('สิทธิ์การมองเห็นไม่ถูกต้อง'); return v; }
const maxAcc_ = (a, b) => (LV_[a] >= LV_[b] ? a : b);

/* ---------- อ่านข้อมูล ---------- */
/**
 * ข้อมูลทั้งหมดที่เว็บต้องใช้ ตามสิทธิ์ของผู้เรียก
 *  - ไม่มี token / token หมดอายุ → ผู้เยี่ยมชม (ถ้ามี token แต่หมดอายุจะมี expired:true)
 *  - สมาชิก → รายการ public + member
 *  - แอดมิน → ทุกอย่าง (รวมประกาศร่าง แท็บที่ซ่อน และการตั้งค่าการสมัคร)
 */
function getData(token) {
  const w = token ? whoami_(token) : null;
  const level = !w ? 0 : (w.role === 'admin' ? 2 : 1);
  let d;
  if (level === 2) {
    d = fullData_(); d.reg = regInfo_(true);
  } else {
    const cache = CacheService.getScriptCache(), key = 'pub_' + level, hit = cache.get(key);
    if (hit) d = JSON.parse(hit);
    else {
      d = filterData_(fullData_(), level);
      try { cache.put(key, JSON.stringify(d), 300); } catch (err) { /* ข้อมูลใหญ่เกิน cache ก็อ่านสดทุกครั้ง */ }
    }
    d.reg = regInfo_(false);
  }
  d.me = w ? { name: w.name, username: w.username, role: w.role, master: !!w.master } : null;
  if (token && !w) d.expired = true;
  return d;
}
function fullData_() {
  return { settings: getSettingsData(), groups: getGroups_(), links: getLinksData(), news: getNews_(), notices: getNotices_(), pages: getPages_() };
}
/** ตัดรายการที่ผู้ชมระดับ level ไม่มีสิทธิ์เห็นออก (กลุ่มที่ซ่อน → ลิงก์ในกลุ่มนั้นซ่อนด้วย) */
function filterData_(d, level) {
  const ok = a => LV_[a] <= level;
  const gacc = {};
  d.groups.forEach(g => { gacc[g.id] = g.access; });
  const eff = l => (own_(gacc, l.category) ? maxAcc_(l.access, gacc[l.category]) : l.access);
  let hidden = 0;
  const links = d.links.filter(l => { const a = eff(l); if (ok(a)) return true; if (level === 0 && a === 'member') hidden++; return false; });
  const news = d.news.filter(n => { if (ok(n.access)) return true; if (level === 0 && n.access === 'member') hidden++; return false; });
  const pages = d.pages.filter(p => { if (!p.active) return false; if (ok(p.access)) return true; if (level === 0 && p.access === 'member') hidden++; return false; });
  return {
    settings: d.settings,
    groups: d.groups.filter(g => ok(g.access)),
    links: links, news: news, pages: pages,
    notices: d.notices.filter(liveNotice_),
    hidden: hidden
  };
}
function liveNotice_(n) {
  const t = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  return !!n.active && (!n.start || t >= n.start) && (!n.end || t <= n.end);
}
function regInfo_(admin) {
  const P = PropertiesService.getScriptProperties();
  const o = { open: P.getProperty('REG_OPEN') !== '0', needCode: !!P.getProperty('REG_CODE') };
  if (admin) o.code = P.getProperty('REG_CODE') || '';
  return o;
}

function getSettingsData() {
  const d = { profileImage: '', siteName: DEFAULT_SITE, siteSub: 'ศูนย์รวมระบบสารสนเทศ', background: 'preset:sky', isDarkMode: false, devName: '', devRole: '', devPhone: '' };
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  if (!s || s.getLastRow() < 2) return d;
  const r = s.getRange(2, 1, 1, 8).getValues()[0];
  return {
    profileImage: String(r[0] || ''), siteName: String(r[1] || d.siteName), siteSub: String(r[4] || d.siteSub),
    background: String(r[3] || d.background), isDarkMode: r[2] === true || String(r[2]).toLowerCase() === 'true',
    devName: String(r[5] || ''), devRole: String(r[6] || ''), devPhone: String(r[7] || '')
  };
}

function getGroups_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GROUP_SHEET_NAME);
  const rows = s && s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, 6).getValues() : DEFAULT_GROUPS;
  return rows.filter(r => r[0]).map(r => ({ id: String(r[0]), name: String(r[1]), sub: String(r[2]), icon: String(r[3]), order: +r[4] || 0, access: accOut_(r[5]) }))
    .sort((a, b) => a.order - b.order);
}

function getLinksData() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, 8).getValues().filter(r => r[0] !== '').map(r => ({
    id: String(r[0]), name: String(r[1] || ''), category: String(r[2] || ''), url: String(r[3] || ''),
    image: String(r[4] || ''), desc: String(r[5] || ''), order: +r[6] || 0, access: accOut_(r[7])
  }));
}

/* ---------- เซสชัน / ผู้ใช้ปัจจุบัน ---------- */
const newToken_ = () => (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
const MASTER_ = { role: 'admin', master: true, name: 'ผู้ดูแลหลัก', username: 'admin' };

/** ใครคือเจ้าของ token (null = ไม่ถูกต้อง/หมดอายุ): คืน {role, name, username, uid?, master?} */
function whoami_(token) {
  token = String(token || '');
  if (token.length < 32) return null;
  const cache = CacheService.getScriptCache();
  if (cache.get('tk_' + token) === epoch_()) return Object.assign({}, MASTER_);
  const v = cache.get('ut_' + token);
  if (!v) return null;
  const i = v.indexOf('|'), uid = v.slice(0, i), ver = v.slice(i + 1);
  const u = usersIdx_()[uid];
  if (!u || !u.active || String(u.ver) !== ver) return null;      // ถูกระงับ/ลบ/เปลี่ยนรหัสแล้ว → เซสชันหมดทันที
  return { role: u.role, name: u.name, username: u.username, uid: uid };
}
/** ต้องเป็นแอดมิน (ผู้ดูแลหลักหรือสมาชิกที่เป็น admin) */
function auth_(token) {
  const w = whoami_(token);
  if (!w) throw new Error('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
  if (w.role !== 'admin') throw new Error('ต้องใช้สิทธิ์ผู้ดูแลระบบ');
  return w;
}
function startSession_(uid, ver) {
  const token = newToken_();
  CacheService.getScriptCache().put('ut_' + token, uid + '|' + ver, SESSION_SEC);
  return token;
}

/* ---------- ตารางสมาชิก ---------- */
const dt_ = v => v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss') : String(v || '');
const isTrue_ = v => v === true || String(v).toLowerCase() === 'true';
function userRows_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_SHEET);
  return s && s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, 11).getValues().filter(r => r[0] !== '') : [];
}
const userObj_ = r => ({
  id: String(r[0]), username: String(r[1]), name: String(r[2]), unit: String(r[3]), role: r[5] === 'admin' ? 'admin' : 'user',
  active: isTrue_(r[6]), created: dt_(r[7]), last: dt_(r[8]), count: +r[9] || 0, ver: String(r[10] || 1)
});
/** ดัชนีผู้ใช้แบบย่อ (cache 10 นาที) ใช้ตรวจเซสชันทุกคำขอ */
function usersIdx_() {
  const cache = CacheService.getScriptCache(), hit = cache.get('usr');
  if (hit) return JSON.parse(hit);
  const idx = {};
  userRows_().map(userObj_).forEach(u => { idx[u.id] = { role: u.role, active: u.active, ver: u.ver, name: u.name, username: u.username }; });
  try { cache.put('usr', JSON.stringify(idx), 600); } catch (err) { /* ใหญ่เกิน cache */ }
  return idx;
}
const dropUsers_ = () => CacheService.getScriptCache().remove('usr');
function rowOf_(sh, id) {
  if (sh.getLastRow() < 2) return -1;
  const i = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().findIndex(r => String(r[0]) === String(id));
  return i < 0 ? -1 : i + 2;
}
function normUser_(v) {
  v = String(v == null ? '' : v).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(v)) throw new Error('ชื่อผู้ใช้ต้องยาว 3-30 ตัว ใช้ได้เฉพาะ a-z 0-9 . _ - และขึ้นต้นด้วยตัวอักษรหรือตัวเลข');
  if (RESERVED_.indexOf(v) >= 0) throw new Error('ชื่อผู้ใช้นี้สงวนไว้ กรุณาเลือกชื่ออื่น');
  return v;
}

/* ---------- แฮชรหัสผ่านสมาชิก (เกลือรายคน + แฮชซ้ำ) ---------- */
function hashPw_(pw, salt, rounds) {
  let h = salt + '|' + pw, bytes;
  for (let i = 0; i < rounds; i++) {
    bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8);
    h = Utilities.base64Encode(bytes) + salt;
  }
  return Utilities.base64Encode(bytes);
}
function makePwHash_(pw) {
  const salt = Utilities.getUuid().replace(/-/g, '');
  return 'v1$' + HASH_ROUNDS + '$' + salt + '$' + hashPw_(pw, salt, HASH_ROUNDS);
}
function checkPwHash_(pw, stored) {
  const p = String(stored || '').split('$');
  const rounds = parseInt(p[1], 10);
  if (p.length !== 4 || p[0] !== 'v1' || !(rounds >= 1 && rounds <= 2000)) return false;
  return safeEq_(hashPw_(String(pw), p[2], rounds), p[3]);
}

/* ---------- ตัวนับลองรหัสผิดของสมาชิก (ตรวจ+นับก่อนเทียบรหัส ภายใน Lock) ---------- */
/**
 * นับ "ก่อน" ตรวจรหัสเสมอ จึงยิงคำขอพร้อมกันเพื่อเดารหัสเกินจำนวนที่กำหนดไม่ได้
 * ถูกต้องแล้วค่อยล้างตัวนับด้วย clearGate_
 */
function gate_(key) {
  return withLock_(() => {
    const c = CacheService.getScriptCache(), k = 'lf_' + key, now = Date.now();
    let st; try { st = JSON.parse(c.get(k) || '{}') || {}; } catch (e) { st = {}; }
    if (st.until && now < st.until) throw new Error('ใส่รหัสผิดหลายครั้ง กรุณารอ ' + Math.ceil((st.until - now) / 60000) + ' นาที แล้วลองใหม่');
    if ((st.until && now >= st.until) || (st.t && now - st.t > LOGIN_WINDOW_MS)) st = {};
    st.n = (st.n || 0) + 1; st.t = now;
    if (st.n > LOGIN_MAX_FAILS) {
      st.until = now + LOGIN_LOCK_MS;
      c.put(k, JSON.stringify(st), Math.round(LOGIN_LOCK_MS / 1000) + 60);
      throw new Error('ใส่รหัสผิดหลายครั้ง ระบบล็อก ' + Math.round(LOGIN_LOCK_MS / 60000) + ' นาที');
    }
    c.put(k, JSON.stringify(st), Math.round(LOGIN_WINDOW_MS / 1000));
    return LOGIN_MAX_FAILS - st.n;      // จำนวนครั้งที่เหลือ (ถ้ารหัสผิดต่อ)
  });
}
function clearGate_(key) { CacheService.getScriptCache().remove('lf_' + key); }

/* ---------- ประวัติเข้าใช้ ---------- */
function logEv_(username, name, event, note) {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET);
    if (!sh) return;
    sh.appendRow([new Date(), txt_(username), txt_(cut_(name, 80)), event, txt_(cut_(note, 200))]);
    if (sh.getLastRow() > LOG_MAX + 1) sh.deleteRows(2, LOG_TRIM);
  } catch (e) { /* บันทึกประวัติไม่สำเร็จไม่ควรทำให้การใช้งานล้มเหลว */ }
}
/** ประวัติล่าสุด (ใหม่ก่อน) กรองด้วยชื่อ/ชื่อผู้ใช้ได้ สูงสุด max รายการ (ไม่เกิน 5000) */
function getLoginLog(token, q, max) {
  auth_(token);
  const sh = need_(LOG_SHEET), last = sh.getLastRow();
  if (last < 2) return [];
  const n = Math.min(last - 1, LOG_MAX), rows = sh.getRange(last - n + 1, 1, n, 5).getValues();
  q = String(q == null ? '' : q).trim().toLowerCase();
  max = Math.max(1, Math.min(+max || 500, 5000));
  const out = [];
  for (let i = rows.length - 1; i >= 0 && out.length < max; i--) {
    const r = rows[i];
    if (q && (String(r[1]) + ' ' + String(r[2]) + ' ' + String(r[3])).toLowerCase().indexOf(q) < 0) continue;
    out.push({ t: dt_(r[0]), u: String(r[1]), n: String(r[2]), e: String(r[3]), d: String(r[4]) });
  }
  return out;
}

/* ---------- สมัครสมาชิก / เข้าสู่ระบบ ---------- */
/** สมัครแล้วใช้ได้ทันที (ไม่ต้องรออนุมัติ) — ถ้าแอดมินตั้งรหัสสมัครของหน่วยไว้ ต้องกรอกให้ตรง */
function register(f, device) {
  f = f || {};
  const P = PropertiesService.getScriptProperties();
  if (P.getProperty('REG_OPEN') === '0') throw new Error('ขณะนี้ปิดรับสมัครสมาชิก กรุณาติดต่อผู้ดูแลระบบ');
  const uname = normUser_(f.username);
  const name = cut_(f.name, 80), unit = cut_(f.unit, 80);
  if (name.length < 2) throw new Error('กรุณากรอกชื่อ-สกุล');
  const pw = String(f.password == null ? '' : f.password);
  validNewPw_(pw, '', USER_PW_MIN);
  const ph = makePwHash_(pw);
  return withLock_(() => {
    const c = CacheService.getScriptCache(), now = Date.now();
    let rg; try { rg = JSON.parse(c.get('rg') || '{}') || {}; } catch (e) { rg = {}; }
    if (!rg.t || now - rg.t > 600000) rg = { n: 0, t: now };
    rg.n++; c.put('rg', JSON.stringify(rg), 600);
    if (rg.n > REG_MAX_PER_WINDOW) throw new Error('มีการสมัครจำนวนมากในช่วงเวลาสั้น ๆ กรุณารอสักครู่แล้วลองใหม่');
    const need = P.getProperty('REG_CODE') || '';
    if (need) {
      let rc; try { rc = JSON.parse(c.get('rc') || '{}') || {}; } catch (e) { rc = {}; }
      if ((rc.n || 0) >= REG_CODE_MAX_FAILS) throw new Error('ใส่รหัสสมัครผิดหลายครั้ง กรุณารอ 10 นาที แล้วลองใหม่');
      if (!safeEq_(String(f.code == null ? '' : f.code).trim(), need)) {
        rc.n = (rc.n || 0) + 1; c.put('rc', JSON.stringify(rc), 600);
        throw new Error('รหัสสมัครของหน่วยไม่ถูกต้อง');
      }
    }
    const sh = need_(USER_SHEET), rows = userRows_();
    if (rows.length >= MAX_USERS) throw new Error('จำนวนสมาชิกเต็มแล้ว กรุณาติดต่อผู้ดูแลระบบ');
    if (rows.some(r => String(r[1]).toLowerCase() === uname)) throw new Error('ชื่อผู้ใช้นี้ถูกใช้แล้ว กรุณาเลือกชื่ออื่น');
    const id = Utilities.getUuid(), at = new Date();
    sh.getRange(sh.getLastRow() + 1, 1, 1, 11).setValues([[id, uname, txt_(name), txt_(unit), ph, 'user', true, at, at, 1, 1]]);
    dropUsers_();
    logEv_(uname, name, 'สมัครสมาชิก', device);
    return { token: startSession_(id, '1'), me: { name: name, username: uname, role: 'user', master: false } };
  });
}

/**
 * เข้าสู่ระบบ: ชื่อผู้ใช้ "admin" = ผู้ดูแลหลัก (รหัสผ่านใน Script Properties) นอกนั้นคือสมาชิก
 * ข้อความผิดพลาดไม่บอกว่าชื่อผู้ใช้มีอยู่จริงหรือไม่
 */
function login(username, pw, device) {
  const un = String(username == null ? '' : username).trim().toLowerCase();
  if (!un) throw new Error('กรุณากรอกชื่อผู้ใช้');
  if (un === 'admin') return adminLogin_(pw, device);
  const left = gate_(un);
  pw = String(pw == null ? '' : pw);
  const sh = need_(USER_SHEET), rows = userRows_();
  const row = rows.find(r => String(r[1]).toLowerCase() === un);
  let ok = false;
  if (pw.length > 0 && pw.length <= PW_MAX) ok = row ? checkPwHash_(pw, row[4]) : (hashPw_(pw, 'x', HASH_ROUNDS), false);
  if (!row || !ok) {
    if (row) logEv_(row[1], row[2], 'รหัสผ่านไม่ถูกต้อง', device);
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' + (left <= 2 ? ' (เหลืออีก ' + left + ' ครั้ง)' : ''));
  }
  const u = userObj_(row);
  if (!u.active) { logEv_(u.username, u.name, 'เข้าสู่ระบบไม่ได้ (บัญชีถูกระงับ)', device); throw new Error('บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ'); }
  return withLock_(() => {
    clearGate_(un);
    const i = rowOf_(sh, u.id);
    if (i < 0) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    const cur = sh.getRange(i, 10).getValue();
    sh.getRange(i, 9, 1, 2).setValues([[new Date(), (+cur || 0) + 1]]);
    logEv_(u.username, u.name, 'เข้าสู่ระบบ', device);
    return { token: startSession_(u.id, u.ver), me: { name: u.name, username: u.username, role: u.role, master: false } };
  });
}
function adminLogin_(pw, device) {
  try {
    return withLock_(() => {
      checkAdminPw_(pw);
      const token = newToken_();
      CacheService.getScriptCache().put('tk_' + token, epoch_(), SESSION_SEC);
      logEv_('admin', MASTER_.name, 'เข้าสู่ระบบ', device);
      return { token: token, me: { name: MASTER_.name, username: 'admin', role: 'admin', master: true } };
    });
  } catch (e) {
    const m = String((e && e.message) || e);
    if (m.indexOf('รหัสผ่านไม่ถูกต้อง') === 0 || m.indexOf('ระบบล็อก') >= 0) logEv_('admin', MASTER_.name, 'รหัสผ่านไม่ถูกต้อง', device);
    throw e;
  }
}
function logout(token) {
  if (!token) return true;
  const w = whoami_(token), cache = CacheService.getScriptCache();
  cache.remove('tk_' + token); cache.remove('ut_' + token);
  if (w) logEv_(w.username, w.name, 'ออกจากระบบ', '');
  return true;
}

/** นโยบายรหัสผ่านใหม่: ยาว >= min, มีตัวอักษรและตัวเลข, ไม่ซ้ำเดิม, ไม่ใช่รหัสที่เดาง่าย */
function validNewPw_(pw, oldPw, min) {
  pw = String(pw == null ? '' : pw);
  if (pw.length < min) throw new Error('รหัสผ่านต้องยาวอย่างน้อย ' + min + ' ตัวอักษร');
  if (pw.length > PW_MAX) throw new Error('รหัสผ่านยาวเกินไป (สูงสุด ' + PW_MAX + ' ตัวอักษร)');
  if (!/\p{L}/u.test(pw) || !/[0-9]/.test(pw)) throw new Error('รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข');
  if (/^(.)\1+$/u.test(pw)) throw new Error('รหัสผ่านง่ายเกินไป (ตัวอักษรซ้ำกันทั้งหมด)');
  const common = ['password12', 'password123', 'password1234', 'admin12345', 'admin123456', 'qwerty1234', 'qwerty12345', 'abc1234567', 'abcd123456', 'a123456789', 'iloveyou123', 'password1', 'abc12345', 'qwerty123', '12345678a', 'a12345678'];
  if (common.indexOf(pw.toLowerCase()) >= 0) throw new Error('รหัสผ่านนี้เดาง่ายเกินไป กรุณาใช้รหัสอื่น');
  if (oldPw !== '' && pw === String(oldPw)) throw new Error('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม');
}

/** เปลี่ยนรหัสผ่านของตัวเอง (ผู้ดูแลหลักหรือสมาชิก) — เครื่องอื่นที่ล็อกอินอยู่จะหลุดทั้งหมด คืน token ใหม่ให้เครื่องนี้ */
function changeMyPassword(token, oldPw, newPw) {
  const w = whoami_(token);
  if (!w) throw new Error('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
  if (w.master) {
    return withLock_(() => {
      if (!whoami_(token)) throw new Error('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
      checkAdminPw_(oldPw);                       // ใช้ตัวนับ/ล็อกชุดเดียวกับหน้าเข้าสู่ระบบ
      validNewPw_(newPw, oldPw, PW_MIN);
      setPw_(newPw);                              // เพิ่ม epoch → เซสชัน admin หลักอื่นหมดอายุ
      CacheService.getScriptCache().put('tk_' + token, epoch_(), SESSION_SEC);
      logEv_('admin', MASTER_.name, 'เปลี่ยนรหัสผ่าน', '');
      return { token: token };
    });
  }
  const key = 'pw_' + w.uid;
  gate_(key);
  const sh = need_(USER_SHEET), i = rowOf_(sh, w.uid);
  if (i < 0) throw new Error('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
  const r = sh.getRange(i, 1, 1, 11).getValues()[0];
  if (!checkPwHash_(String(oldPw == null ? '' : oldPw), r[4])) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
  validNewPw_(newPw, oldPw, USER_PW_MIN);
  const ph = makePwHash_(String(newPw));
  return withLock_(() => {
    clearGate_(key);
    const j = rowOf_(sh, w.uid);
    if (j < 0) throw new Error('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
    const ver = String((+sh.getRange(j, 11).getValue() || 1) + 1);
    sh.getRange(j, 5).setValue(ph);
    sh.getRange(j, 11).setValue(+ver);
    dropUsers_();
    CacheService.getScriptCache().remove('ut_' + token);
    logEv_(w.username, w.name, 'เปลี่ยนรหัสผ่าน', '');
    return { token: startSession_(w.uid, ver) };
  });
}

/** ตัวนับรหัสผิดของผู้ดูแลหลัก เก็บใน Script Properties ตรวจ+เพิ่มภายใน Lock เดียว */
function readLoginFails_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('LOGIN_FAILS') || '{}') || {}; } catch (e) { return {}; }
}
function clearLoginFails_() { PropertiesService.getScriptProperties().deleteProperty('LOGIN_FAILS'); }
/** ต้องเรียกภายใน withLock_ */
function checkAdminPw_(pw) {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('ADMIN_HASH')) throw new Error('ยังไม่ได้ตั้งรหัสผ่าน โปรดรันฟังก์ชัน setup() ก่อน');
  const now = Date.now();
  let st = readLoginFails_();
  if (st.until && now < st.until) throw new Error('ใส่รหัสผิดหลายครั้ง กรุณารอ ' + Math.ceil((st.until - now) / 60000) + ' นาที แล้วลองใหม่');
  if ((st.until && now >= st.until) || (st.t && now - st.t > LOGIN_WINDOW_MS)) st = {};
  pw = String(pw == null ? '' : pw);
  const ok = pw.length > 0 && pw.length <= PW_MAX && safeEq_(hash_(pw), p.getProperty('ADMIN_HASH'));
  if (ok) { clearLoginFails_(); return; }
  const n = (st.n || 0) + 1;
  const next = { n: n, t: now };
  if (n >= LOGIN_MAX_FAILS) next.until = now + LOGIN_LOCK_MS;
  p.setProperty('LOGIN_FAILS', JSON.stringify(next));
  throw new Error(n >= LOGIN_MAX_FAILS ? 'ใส่รหัสผิดหลายครั้ง ระบบล็อก ' + Math.round(LOGIN_LOCK_MS / 60000) + ' นาที' : 'รหัสผ่านไม่ถูกต้อง (เหลืออีก ' + (LOGIN_MAX_FAILS - n) + ' ครั้ง)');
}

/* ---------- แอดมิน: จัดการสมาชิก ---------- */
function listUsers_() {
  return userRows_().map(userObj_).map(u => ({ id: u.id, username: u.username, name: u.name, unit: u.unit, role: u.role, active: u.active, created: u.created, last: u.last, count: u.count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
}
function listUsers(token) { auth_(token); return listUsers_(); }

/** เปลี่ยนสิทธิ์ (role: user|admin) หรือระงับ/เปิดใช้ (active) — แก้ของตัวเองไม่ได้ */
function updateUser(token, id, patch) {
  const w = auth_(token);
  patch = patch || {};
  if (w.uid && w.uid === String(id)) throw new Error('ไม่สามารถเปลี่ยนสิทธิ์หรือระงับบัญชีของตัวเองได้');
  if (patch.role !== undefined && patch.role !== 'admin' && patch.role !== 'user') throw new Error('สิทธิ์ไม่ถูกต้อง');
  return withLock_(() => {
    const sh = need_(USER_SHEET), i = rowOf_(sh, id);
    if (i < 0) throw new Error('ไม่พบสมาชิก');
    const r = sh.getRange(i, 1, 1, 11).getValues()[0], notes = [];
    if (patch.role !== undefined) { sh.getRange(i, 6).setValue(patch.role); notes.push('สิทธิ์ → ' + patch.role); }
    if (patch.active !== undefined) { sh.getRange(i, 7).setValue(!!patch.active); notes.push(patch.active ? 'เปิดใช้' : 'ระงับ'); }
    dropUsers_();
    logEv_(w.username, w.name, 'แก้ไขสมาชิก', r[1] + ': ' + notes.join(', '));
    return listUsers_();
  });
}
/** สร้างรหัสผ่านชั่วคราวใหม่ให้สมาชิก (แสดงครั้งเดียว) และทำให้เซสชันเดิมของสมาชิกหลุดทั้งหมด */
function resetUserPassword(token, id) {
  const w = auth_(token);
  const pw = genPw_(), ph = makePwHash_(pw);
  return withLock_(() => {
    const sh = need_(USER_SHEET), i = rowOf_(sh, id);
    if (i < 0) throw new Error('ไม่พบสมาชิก');
    const r = sh.getRange(i, 1, 1, 11).getValues()[0];
    sh.getRange(i, 5).setValue(ph);
    sh.getRange(i, 11).setValue((+r[10] || 1) + 1);
    clearGate_(String(r[1]).toLowerCase()); clearGate_('pw_' + id);
    dropUsers_();
    logEv_(w.username, w.name, 'รีเซ็ตรหัสผ่านสมาชิก', r[1]);
    return { username: String(r[1]), pw: pw };
  });
}
function deleteUser(token, id) {
  const w = auth_(token);
  if (w.uid && w.uid === String(id)) throw new Error('ไม่สามารถลบบัญชีของตัวเองได้');
  return withLock_(() => {
    const sh = need_(USER_SHEET), i = rowOf_(sh, id);
    if (i < 0) throw new Error('ไม่พบสมาชิก');
    const name = sh.getRange(i, 2).getValue();
    sh.deleteRow(i);
    dropUsers_();
    logEv_(w.username, w.name, 'ลบสมาชิก', name);
    return listUsers_();
  });
}
/** เปิด/ปิดรับสมัคร และตั้งรหัสสมัครของหน่วย (เว้นว่าง = ไม่ใช้รหัส) */
function saveRegSettings(token, open, code) {
  const w = auth_(token);
  code = cut_(code, 40);
  return withLock_(() => {
    const P = PropertiesService.getScriptProperties();
    P.setProperty('REG_OPEN', open ? '1' : '0');
    if (code) P.setProperty('REG_CODE', code); else P.deleteProperty('REG_CODE');
    logEv_(w.username, w.name, 'ตั้งค่าการสมัคร', (open ? 'เปิดรับสมัคร' : 'ปิดรับสมัคร') + (code ? ' | ใช้รหัสสมัคร' : ' | ไม่ใช้รหัสสมัคร'));
    return regInfo_(true);
  });
}

/* ---------- แก้ไขข้อมูล (ต้องเป็นแอดมินและเขียนทีละคิวด้วย Lock) ---------- */
function saveSettingsData(token, s) {
  auth_(token);
  s = s || {};
  const bg = String(s.background || 'preset:sky');
  if (bg.length > 2000 || !/^(preset:[a-z]+|color:#[0-9a-f]{3,8}|img:https:\/\/\S+)$/i.test(bg)) throw new Error('รูปแบบพื้นหลังไม่ถูกต้อง');
  if (s.profileImage && (String(s.profileImage).length > 2000 || !/^https:\/\//i.test(s.profileImage))) throw new Error('โลโก้ต้องเป็นลิงก์ https');
  return withLock_(() => {
    const sh = need_(SETTINGS_SHEET_NAME);
    sh.getRange(2, 8).setNumberFormat('@');
    sh.getRange(2, 1, 1, 8).setValues([[String(s.profileImage || ''), txt_(cut_(s.siteName, 120)) || DEFAULT_SITE, !!s.isDarkMode, bg, txt_(cut_(s.siteSub, 120)),
      txt_(cut_(s.devName, 80)), txt_(cut_(s.devRole, 80)), cut_(s.devPhone, 30)]]);
    return done_();
  });
}

function saveGroup(token, g) {
  auth_(token);
  g = g || {};
  const name = cut_(g.name, 200);
  if (!name) throw new Error('กรุณากรอกชื่อกลุ่ม');
  const icon = iconOk_(g.icon), access = accIn_(g.access);
  return withLock_(() => {
    const sh = need_(GROUP_SHEET_NAME);
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    if (!g.id) {                                   // เพิ่มกลุ่มใหม่ต่อท้าย
      if (ids.length >= 30) throw new Error('เพิ่มกลุ่มได้ไม่เกิน 30 กลุ่ม');
      const mx = getGroups_().reduce((m, x) => Math.max(m, x.order), 0);
      const r = sh.getLastRow() + 1;
      sh.getRange(r, 1, 1, 4).setNumberFormat('@');
      sh.getRange(r, 1, 1, 6).setValues([['g' + Utilities.getUuid().slice(0, 8), txt_(name), txt_(cut_(g.sub, 200)), txt_(icon), mx + 1, access]]);
      return done_();
    }
    const i = ids.indexOf(String(g.id));
    if (i < 0) throw new Error('ไม่พบกลุ่มงาน');
    sh.getRange(i + 2, 2, 1, 3).setValues([[txt_(name), txt_(cut_(g.sub, 200)), txt_(icon)]]);
    sh.getRange(i + 2, 6).setValue(access);
    return done_();
  });
}
/** ลบกลุ่ม: ลบได้เฉพาะกลุ่มที่ไม่มีข้อมูลย่อยอยู่ และต้องเหลืออย่างน้อย 1 กลุ่ม */
function deleteGroup(token, id) {
  auth_(token);
  return withLock_(() => {
    const sh = need_(GROUP_SHEET_NAME);
    if (sh.getLastRow() < 3) throw new Error('ต้องมีอย่างน้อย 1 กลุ่ม');
    if (getLinksData().some(l => l.category === String(id))) throw new Error('กลุ่มนี้ยังมีข้อมูลย่อยอยู่ กรุณาย้ายหรือลบข้อมูลย่อยก่อน');
    delete_(sh, id);
    return done_();
  });
}

function saveLinkData(token, f) {
  auth_(token);
  f = f || {};
  const name = cut_(f.name, 200);
  if (!name) throw new Error('กรุณากรอกชื่อ');
  const url = cut_(f.url, 2000);
  if (url && !/^(https?:\/\/|tel:|mailto:)/i.test(url)) throw new Error('ลิงก์ต้องขึ้นต้นด้วย http://, https://, tel: หรือ mailto:');
  const image = iconOk_(f.image), access = accIn_(f.access);
  return withLock_(() => {
    const sh = need_(SHEET_NAME);
    const cat = String(f.category || '');
    if (cat && !getGroups_().some(g => g.id === cat)) throw new Error('ไม่พบกลุ่มงานที่เลือก');
    const all = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues() : [];
    const i = f.id ? all.findIndex(r => String(r[0]) === String(f.id)) : -1;
    const ord = +f.order;
    const order = isFinite(ord) && ord > 0 ? ord : (Math.max(0, ...all.map(r => +r[6] || 0)) + 1);
    const row = [i >= 0 ? String(f.id) : Utilities.getUuid(), txt_(name), cat, url, txt_(image), txt_(cut_(f.desc, 2000)), order, access];
    sh.getRange(i >= 0 ? i + 2 : sh.getLastRow() + 1, 1, 1, 8).setValues([row]);
    return done_();
  });
}

function deleteLinkData(token, id) {
  auth_(token);
  return withLock_(() => {
    const sh = need_(SHEET_NAME);
    if (sh.getLastRow() > 1) {
      const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]));
      const i = ids.indexOf(String(id));
      if (i >= 0) sh.deleteRow(i + 2);
    }
    return done_();
  });
}

function moveGroup(token, id, dir) {
  auth_(token);
  return withLock_(() => {
    const sh = need_(GROUP_SHEET_NAME), gs = getGroups_(), i = gs.findIndex(g => g.id === id), j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= gs.length || sh.getLastRow() < 2) return done_();
    const t = gs[i]; gs[i] = gs[j]; gs[j] = t;
    const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]));
    gs.forEach((g, k) => { const r = ids.indexOf(g.id); if (r >= 0) sh.getRange(r + 2, 5).setValue(k + 1); });
    return done_();
  });
}

/* ---------- ข่าวสาร / บทความ ---------- */
function getNews_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NEWS_SHEET);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, 8).getValues().filter(r => r[0] !== '').map(r => ({
    id: String(r[0]), title: String(r[1]), type: String(r[2]), body: String(r[3]), cover: String(r[4]),
    date: ds_(r[5]), pin: isTrue_(r[6]), access: accOut_(r[7])
  }));
}

function saveNews(token, n) {
  auth_(token);
  n = n || {};
  const title = cut_(n.title, 300);
  if (!title) throw new Error('กรุณากรอกหัวข้อ');
  if (NEWS_TYPES.indexOf(n.type) < 0) throw new Error('ประเภทไม่ถูกต้อง');
  if (n.cover && (String(n.cover).length > 2000 || !/^https:\/\//i.test(n.cover))) throw new Error('รูปปกต้องเป็นลิงก์ https');
  if (String(n.body || '').length > 40000) throw new Error('เนื้อหายาวเกินไป (สูงสุด 40,000 ตัวอักษร)');
  dateOk_(n.date);
  const access = accIn_(n.access);
  return withLock_(() => {
    upsert_(need_(NEWS_SHEET), n.id, 8, id => [id, txt_(title), n.type, txt_(String(n.body || '')), n.cover || '', n.date || '', !!n.pin, access], [6]);
    return done_();
  });
}

function deleteNews(token, id) { auth_(token); return withLock_(() => { delete_(need_(NEWS_SHEET), id); return done_(); }); }

/* ---------- แบนเนอร์ / ป๊อปอัป (แสดงทุกคนตามช่วงเวลา) ---------- */
function getNotices_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOTICE_SHEET);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, 9).getValues().filter(r => r[0] !== '').map(r => ({
    id: String(r[0]), kind: String(r[1]), title: String(r[2]), text: String(r[3]), image: String(r[4]), url: String(r[5]),
    start: ds_(r[6]), end: ds_(r[7]), active: isTrue_(r[8])
  }));
}

function saveNotice(token, n) {
  auth_(token);
  n = n || {};
  const title = cut_(n.title, 300);
  if (!title) throw new Error('กรุณากรอกหัวข้อ');
  if (n.kind !== 'banner' && n.kind !== 'popup') throw new Error('ชนิดประกาศไม่ถูกต้อง');
  if (n.url && (String(n.url).length > 2000 || !/^(https?:\/\/|tel:|mailto:)/i.test(n.url))) throw new Error('ลิงก์ต้องขึ้นต้นด้วย http://, https://, tel: หรือ mailto:');
  if (n.image && (String(n.image).length > 2000 || !/^https:\/\//i.test(n.image))) throw new Error('รูปต้องเป็นลิงก์ https');
  dateOk_(n.start); dateOk_(n.end);
  if (n.start && n.end && n.start > n.end) throw new Error('วันที่สิ้นสุดต้องไม่ก่อนวันเริ่ม');
  if (String(n.text || '').length > 5000) throw new Error('ข้อความยาวเกินไป (สูงสุด 5,000 ตัวอักษร)');
  return withLock_(() => {
    upsert_(need_(NOTICE_SHEET), n.id, 9,
      id => [id, n.kind, txt_(title), txt_(String(n.text || '')), n.image || '', n.url || '', n.start || '', n.end || '', !!n.active], [7, 8]);
    return done_();
  });
}

function deleteNotice(token, id) { auth_(token); return withLock_(() => { delete_(need_(NOTICE_SHEET), id); return done_(); }); }

/* ---------- แท็บเมนูที่ผู้ดูแลเพิ่มเองได้ ---------- */
function getPages_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PAGE_SHEET);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, 8).getValues().filter(r => r[0] !== '').map(r => {
    let links = []; try { links = JSON.parse(String(r[4] || '[]')); } catch (e) {}
    return { id: String(r[0]), name: String(r[1]), icon: String(r[2]), body: String(r[3]), links: Array.isArray(links) ? links : [],
      order: Number(r[5]) || 0, active: isTrue_(r[6]), access: accOut_(r[7]) };
  });
}
function savePage(token, p) {
  auth_(token);
  p = p || {};
  const name = cut_(p.name, 40);
  if (!name) throw new Error('กรุณากรอกชื่อแท็บ');
  const icon = iconOk_(p.icon), access = accIn_(p.access);
  const body = String(p.body || '');
  if (body.length > 20000) throw new Error('เนื้อหายาวเกินไป (สูงสุด 20,000 ตัวอักษร)');
  const links = (Array.isArray(p.links) ? p.links : []).filter(l => l && (l.u || l.n));
  if (links.length > 50) throw new Error('เพิ่มลิงก์ได้ไม่เกิน 50 รายการต่อแท็บ');
  const clean = links.map(l => {
    const n = cut_(l.n, 120), u = cut_(l.u, 2000);
    if (!n) throw new Error('ลิงก์ทุกรายการต้องมีชื่อ');
    if (!/^(https?:\/\/|tel:|mailto:)/i.test(u)) throw new Error('ลิงก์ "' + n + '" ต้องขึ้นต้นด้วย http://, https://, tel: หรือ mailto:');
    return { n: n, u: u };
  });
  const order = Number(p.order);
  if (p.order !== '' && p.order != null && !isFinite(order)) throw new Error('ลำดับต้องเป็นตัวเลข');
  return withLock_(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(PAGE_SHEET);
    if (!sh) { sh = ss.insertSheet(PAGE_SHEET); sh.appendRow(['ID', 'ชื่อแท็บ', 'ไอคอน', 'เนื้อหา', 'ลิงก์', 'ลำดับ', 'เปิดใช้', 'การมองเห็น']); }
    if (!p.id && getPages_().length >= 30) throw new Error('เพิ่มแท็บได้ไม่เกิน 30 แท็บ');
    upsert_(sh, p.id, 8, id => [id, txt_(name), icon, txt_(body), JSON.stringify(clean), isFinite(order) && p.order !== '' ? order : 99, !!p.active, access], [2, 4]);
    return done_();
  });
}
function deletePage(token, id) { auth_(token); return withLock_(() => { const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PAGE_SHEET); if (s) delete_(s, id); return done_(); }); }

/* ---------- ตัวช่วยเขียน/ลบแถว ---------- */
function need_(name) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!s) throw new Error('ยังไม่มีชีต "' + name + '" โปรดรัน setup() อีกครั้ง');
  return s;
}
function upsert_(sh, id, width, makeRow, textCols) {
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  const i = id ? ids.findIndex(r => String(r[0]) === String(id)) : -1;
  const r = i >= 0 ? i + 2 : sh.getLastRow() + 1;
  textCols.forEach(col => sh.getRange(r, col).setNumberFormat('@'));
  sh.getRange(r, 1, 1, width).setValues([makeRow(i >= 0 ? String(id) : Utilities.getUuid())]);
}
function delete_(sh, id) {
  if (sh.getLastRow() < 2) return;
  const i = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().findIndex(r => String(r[0]) === String(id));
  if (i >= 0) sh.deleteRow(i + 2);
}
const ds_ = v => v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v || '');
const txt_ = s => { s = String(s == null ? '' : s); return /^(=|\+|@|-(?=[A-Za-z0-9(]))/.test(s) ? "'" + s : s; }; // กันข้อความที่ขึ้นต้นเหมือนสูตรถูกตีเป็นสูตร
const cut_ = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
/** ไอคอน: อีโมจิ/ข้อความสั้น หรือลิงก์รูป https */
function iconOk_(v) {
  v = String(v == null ? '' : v).trim();
  if (/^https?:\/\//i.test(v)) {
    if (!/^https:\/\//i.test(v) || v.length > 2000) throw new Error('ไอคอน/รูปต้องเป็นลิงก์ https');
    return v;
  }
  if (v.length > 16) throw new Error('ไอคอนต้องเป็นอีโมจิ (สั้นๆ) หรือลิงก์รูป https');
  return v;
}
function dateOk_(v) { if (v && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new Error('รูปแบบวันที่ไม่ถูกต้อง'); }

/** อัปโหลดรูป (โลโก้/พื้นหลัง/ไอคอน) เก็บใน Google Drive โฟลเดอร์ LinkHub_Images แล้วคืนลิงก์รูป */
function uploadImage(token, dataUrl) {
  auth_(token);
  dataUrl = String(dataUrl || '');
  if (dataUrl.length > 7.5 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 5 MB');
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+\/=]+)$/.exec(dataUrl);
  if (!m) throw new Error('รองรับเฉพาะไฟล์รูป PNG, JPEG, WEBP, GIF');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 5 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 5 MB');
  const it = DriveApp.getFoldersByName('LinkHub_Images');
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder('LinkHub_Images');
  const file = folder.createFile(Utilities.newBlob(bytes, m[1], 'img_' + Date.now() + '.' + m[1].split('/')[1]));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1600';
}

/* ---------- ภายใน ---------- */
/** เข้าคิวเขียนทีละคำขอ กันแถวชนกัน/ลบผิดแถวเมื่อใช้งานพร้อมกัน */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) throw new Error('ระบบกำลังประมวลผลคำขออื่นอยู่ กรุณาลองใหม่อีกครั้ง');
  try { return fn(); } finally { lock.releaseLock(); }
}
/** เลขรุ่นของเซสชันผู้ดูแลหลัก: เพิ่มเมื่อเปลี่ยน/รีเซ็ตรหัสผ่าน ทำให้ token เก่าใช้ไม่ได้ทันที */
function epoch_() { return PropertiesService.getScriptProperties().getProperty('SESS_EPOCH') || '1'; }
function dropPub_() { const c = CacheService.getScriptCache(); c.remove('pub_0'); c.remove('pub_1'); }
/** หลังแก้ไขข้อมูล: ล้างแคชหน้าเว็บ แล้วคืนข้อมูลฉบับเต็มให้แอดมิน */
function done_() { dropPub_(); const d = fullData_(); d.reg = regInfo_(true); return d; }
function hash_(pw) {
  const salt = PropertiesService.getScriptProperties().getProperty('ADMIN_SALT') || '';
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + pw, Utilities.Charset.UTF_8));
}
/** เปรียบเทียบสตริงแบบเวลาคงที่ */
function safeEq_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
/** ต้องเรียกภายใน withLock_ */
function setPw_(pw) {
  const p = PropertiesService.getScriptProperties();
  p.setProperty('ADMIN_SALT', Utilities.getUuid());
  p.setProperty('ADMIN_HASH', hash_(pw));
  p.setProperty('SESS_EPOCH', String((parseInt(p.getProperty('SESS_EPOCH'), 10) || 1) + 1));
}
