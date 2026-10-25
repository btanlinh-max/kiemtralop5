/**
 * MÁY CHỦ DỮ LIỆU cho "Hệ thống đề kiểm tra & ôn tập lớp 5"
 * Dữ liệu nằm trong chính Google Sheet này (thuộc Drive của giáo viên).
 *
 * CÀI ĐẶT (làm 1 lần):
 * 1. Sửa MA_KHOI bên dưới thành mã bí mật của khối (chỉ giáo viên biết), ví dụ "khoi5vtv2026".
 * 2. Bấm Triển khai (Deploy) → Tùy chọn triển khai mới → Loại: Ứng dụng web
 *    - Thực thi với tư cách: Tôi
 *    - Người có quyền truy cập: Bất kỳ ai
 * 3. Cấp quyền, rồi sao chép "URL ứng dụng web" (đuôi /exec) dán vào web: ⚙️ Cài đặt → Kết nối Google Sheets.
 */
var MA_KHOI = 'khoi5';

var COLS = ['exams', 'subs', 'reviews', 'resources', 'rosters'];
var CHUNK = 45000; // giới hạn 50.000 ký tự/ô của Google Sheets

function doGet(e) {
  return out({ ok: true, data: { name: SpreadsheetApp.getActive().getName(), hello: 'Máy chủ đang chạy' } });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return out({ ok: false, error: 'Yêu cầu không hợp lệ' });
  }
  var teacher = String(req.key || '') === String(MA_KHOI);
  try {
    var a = req.action;
    if (a === 'ping') return out({ ok: true, data: { name: SpreadsheetApp.getActive().getName(), counts: counts() } });
    if (a === 'auth') return out({ ok: true, data: teacher });

    if (a === 'list') {
      checkCol(req.col);
      var filter = req.filter || {};
      // học sinh chỉ xem được bài làm/bài ôn của chính mình (phải có tên + lớp)
      if (!teacher && (req.col === 'subs' || req.col === 'reviews') && !(filter.studentName && filter.className)) {
        return out({ ok: false, error: 'Cần đăng nhập giáo viên' });
      }
      return out({ ok: true, data: readAll(req.col).filter(function (x) { return match(x, filter); }) });
    }

    if (a === 'submit') {
      var s = req.item;
      if (!s || !s.id || !s.examId) throw new Error('Thiếu dữ liệu bài làm');
      withLock(function () {
        if (!findRow(sheet('subs'), s.id)) writeItem('subs', s);
      });
      return out({ ok: true, data: true });
    }

    if (a === 'progress') {
      withLock(function () {
        var r = getItem('reviews', req.id);
        if (!r) throw new Error('Không tìm thấy bài ôn');
        r.attempts = (r.attempts || 0) + 1;
        r.best = Math.max(r.best || 0, Number(req.best) || 0);
        r.mastered = !!(r.mastered || req.mastered);
        writeItem('reviews', r);
      });
      return out({ ok: true, data: true });
    }

    // ----- các thao tác dưới đây chỉ dành cho giáo viên -----
    if (!teacher) return out({ ok: false, error: 'Sai mã khối giáo viên. Vào ⚙️ Cài đặt để nhập đúng mã.' });

    if (a === 'put') {
      checkCol(req.col);
      if (!req.item || !req.item.id) throw new Error('Thiếu id');
      withLock(function () { writeItem(req.col, req.item); });
      return out({ ok: true, data: req.item });
    }
    if (a === 'del') {
      checkCol(req.col);
      withLock(function () {
        var sh = sheet(req.col);
        var row = findRow(sh, req.id);
        if (row) sh.deleteRow(row);
      });
      return out({ ok: true, data: true });
    }
    if (a === 'upload') {
      var folder = getFolder();
      var blob = Utilities.newBlob(Utilities.base64Decode(req.data), req.mime || 'application/octet-stream', req.name || 'tai-lieu');
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return out({ ok: true, data: file.getUrl() });
    }
    return out({ ok: false, error: 'Không rõ thao tác: ' + a });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function checkCol(c) {
  if (COLS.indexOf(c) < 0) throw new Error('Sai bảng dữ liệu');
}
function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { fn(); } finally { lock.releaseLock(); }
}
function sheet(col) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(col);
  if (!sh) {
    sh = ss.insertSheet(col);
    sh.appendRow(['id', 'capNhat', 'tomTat', 'duLieu']);
    sh.setFrozenRows(1);
  }
  return sh;
}
function findRow(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
function summary(col, x) {
  if (col === 'exams') return (x.subject || '') + ' | ' + (x.title || '') + ' | mã ' + (x.code || '');
  if (col === 'subs') return (x.className || '') + ' | ' + (x.studentName || '') + ' | ' + (x.examTitle || '') + ' | ' + x.score + ' điểm';
  if (col === 'reviews') return (x.className || '') + ' | ' + (x.studentName || '') + ' | ' + (x.topic || '');
  if (col === 'resources') return (x.title || '') + ' | ' + (x.url || '');
  if (col === 'rosters') return (x.className || '') + ' | ' + ((x.students || []).length) + ' HS';
  return '';
}
function writeItem(col, x) {
  var sh = sheet(col);
  var json = JSON.stringify(x);
  var parts = [];
  for (var i = 0; i < json.length; i += CHUNK) parts.push(json.substring(i, i + CHUNK));
  var row = [x.id, new Date(), summary(col, x)].concat(parts);
  var r = findRow(sh, x.id);
  if (r) {
    var lastCol = sh.getLastColumn();
    if (lastCol > 3) sh.getRange(r, 4, 1, lastCol - 3).clearContent();
    sh.getRange(r, 1, 1, row.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
}
function parseRow(row) {
  var json = '';
  for (var i = 3; i < row.length; i++) if (row[i] !== '' && row[i] !== null) json += String(row[i]);
  try { return JSON.parse(json); } catch (e) { return null; }
}
function readAll(col) {
  var sh = sheet(col);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, Math.max(4, sh.getLastColumn())).getValues();
  var outArr = [];
  for (var i = vals.length - 1; i >= 0; i--) {
    var o = parseRow(vals[i]);
    if (o) outArr.push(o);
  }
  return outArr;
}
function getItem(col, id) {
  var sh = sheet(col);
  var r = findRow(sh, id);
  if (!r) return null;
  return parseRow(sh.getRange(r, 1, 1, Math.max(4, sh.getLastColumn())).getValues()[0]);
}
function match(x, f) {
  for (var k in f) {
    var v = f[k];
    if (v === undefined || v === null || v === '') continue;
    if (String(x[k] == null ? '' : x[k]).toLowerCase() !== String(v).toLowerCase()) return false;
  }
  return true;
}
function counts() {
  var c = {};
  COLS.forEach(function (col) { c[col] = Math.max(0, sheet(col).getLastRow() - 1); });
  return c;
}
function getFolder() {
  var name = 'Tài liệu – Hệ thống đề lớp 5';
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}
/** Chạy hàm này 1 lần trong trình soạn thảo để tạo sẵn các trang tính và cấp quyền. */
function caiDat() {
  COLS.forEach(sheet);
  getFolder();
  Logger.log('Đã tạo xong. Giờ bấm Triển khai → Ứng dụng web.');
}
