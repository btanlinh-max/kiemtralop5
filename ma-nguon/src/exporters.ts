import type { Exam, Submission } from './types';
import { plain } from './components/Rich';
import { CONFIG } from './config';
import { LEVEL_SHORT } from './curriculum';
import { rank } from './grading';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fracHtml = (s: string) => esc(plain(s)).replace(/\n/g, '<br>');

function download(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export const safeName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60);

// Xuất đề ra Word (.doc) để in – kèm đáp án ở trang cuối
export function examToWord(e: Exam, withKey = true) {
  const L = 'ABCDEFGH';
  let qn = 0;
  const body: string[] = [];
  const passIds = new Set<string>();
  for (const q of e.questions) {
    if (q.passageId && !passIds.has(q.passageId)) {
      passIds.add(q.passageId);
      const p = e.passages.find((x) => x.id === q.passageId);
      if (p) body.push(`<p><b>Đọc thầm văn bản sau:</b></p><p align="center"><b>${esc(p.title)}</b></p><p>${fracHtml(p.content)}</p>${p.source ? `<p align="right"><i>(${esc(p.source)})</i></p>` : ''}`);
    }
    qn++;
    let s = `<p><b>Câu ${qn}.</b> <i>(${q.points.toString().replace('.', ',')} điểm – ${LEVEL_SHORT[q.level]})</i> ${fracHtml(q.type === 'fill' ? q.prompt.replace(/\[\[\d+\]\]/g, '…………') : q.prompt)}</p>`;
    if (q.type === 'mcq') s += `<p style="margin-left:24pt">${(q.options || []).map((o, i) => `${L[i]}. ${fracHtml(o)}`).join('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;')}</p>`;
    if (q.type === 'tf') s += (q.statements || []).map((t, i) => `<p style="margin-left:24pt">${String.fromCharCode(97 + i)}) ${fracHtml(t)} &nbsp; ☐</p>`).join('');
    if (q.type === 'match') s += `<table border="1" cellpadding="4" style="border-collapse:collapse;margin-left:24pt"><tr><th>A</th><th>B</th></tr>${(q.pairs || []).map((p, i, arr) => `<tr><td>${i + 1}. ${fracHtml(p[0])}</td><td>${String.fromCharCode(97 + i)}) ${fracHtml(arr[(i + 1) % arr.length][1])}</td></tr>`).join('')}</table>`;
    if (q.type === 'order') s += `<p style="margin-left:24pt">${[...(q.items || [])].reverse().map((x) => '☐ ' + fracHtml(x)).join('<br>')}</p>`;
    if (q.type === 'short' || q.type === 'essay') s += `<p>${'.'.repeat(150)}</p>`.repeat(q.type === 'essay' ? Math.min(8, Math.max(2, Math.ceil(q.points * 2))) : 1);
    body.push(s);
  }
  let key = '';
  if (withKey) {
    qn = 0;
    key = `<br style="page-break-before:always"><h3 align="center">ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM</h3>` + e.questions.map((q) => {
      qn++;
      let a = '';
      if (q.type === 'mcq') a = (q.answer ?? -1) >= 0 ? L[q.answer!] : '(chưa có)';
      if (q.type === 'tf') a = (q.tfAnswers || []).map((v, i) => `${String.fromCharCode(97 + i)}) ${v ? 'Đ' : 'S'}`).join('; ');
      if (q.type === 'fill') a = (q.blanks || []).map((b) => b.split('|')[0]).join('; ');
      if (q.type === 'match') a = (q.pairs || []).map((p, i) => `${i + 1} – ${plain(p[1])}`).join('; ');
      if (q.type === 'order') a = (q.items || []).map(plain).join(' → ');
      if (q.type === 'short') a = (q.accepted || []).join(' / ');
      if (q.type === 'essay') a = q.guide || '';
      return `<p><b>Câu ${qn}</b> (${q.points.toString().replace('.', ',')}đ): ${fracHtml(a)}${q.explanation ? `<br><i>${fracHtml(q.explanation)}</i>` : ''}</p>`;
    }).join('');
  }
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(e.title)}</title>
<style>body{font-family:'Times New Roman';font-size:14pt;line-height:1.4} p{margin:4pt 0} td,th{font-size:13pt}</style></head><body>
<table width="100%"><tr><td width="45%" align="center"><b>${esc(CONFIG.school.toUpperCase())}</b><br>Họ và tên: ……………………………<br>Lớp: ${esc(e.classes?.length === 1 ? e.classes[0] : '5……')}</td>
<td align="center"><b>${esc(e.title.toUpperCase())}</b><br>Môn: ${esc(e.subject)} – Lớp 5<br>${e.duration ? `Thời gian: ${e.duration} phút` : ''}</td></tr></table>
<table border="1" cellpadding="6" width="100%" style="border-collapse:collapse;margin:8pt 0"><tr><td width="25%" height="50"><b>Điểm</b></td><td><b>Nhận xét của giáo viên</b></td></tr></table>
${body.join('\n')}${key}</body></html>`;
  download(safeName(e.title || 'de') + '.doc', new Blob(['﻿' + html], { type: 'application/msword' }));
}

export async function subsToExcel(exam: Exam | null, subs: Submission[], fileName: string) {
  const XLSX = await import('xlsx');
  const rows = subs.map((s, i) => {
    const r: Record<string, any> = {
      STT: i + 1, 'Lớp': s.className, 'Họ và tên': s.studentName, 'Đề': s.examTitle, 'Môn': s.subject,
      'Điểm (thang 10)': s.score, 'Mức đạt (TT27)': s.pending ? 'Chờ chấm' : rank(Math.round(s.score)).label,
      'Thời gian làm (phút)': Math.round(s.durationSec / 6) / 10, 'Nộp lúc': new Date(s.submittedAt).toLocaleString('vi-VN'), 'Thiết bị': s.device || '',
    };
    if (exam) exam.questions.forEach((q, k) => { const x = s.results.find((y) => y.qid === q.id); r[`Câu ${k + 1}`] = x ? x.earned : ''; });
    return r;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kết quả');
  XLSX.writeFile(wb, safeName(fileName) + '.xlsx');
}
