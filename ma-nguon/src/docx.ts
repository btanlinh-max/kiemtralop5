import JSZip from 'jszip';

// Đọc file Word (.docx) ra văn bản, GIỮ được phân số/công thức (mammoth thường làm mất).
// Phân số được ghi theo dạng {tử/mẫu}, ví dụ 2{1/2} là hỗn số hai và một phần hai.

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

function local(n: Node) {
  return (n as Element).localName || '';
}

function mathText(node: Node): string {
  let out = '';
  node.childNodes.forEach((c) => {
    const ln = local(c);
    if (c.nodeType === 3) return;
    if (ln === 't') out += c.textContent || '';
    else if (ln === 'f') {
      const num = [...c.childNodes].find((x) => local(x) === 'num');
      const den = [...c.childNodes].find((x) => local(x) === 'den');
      out += `{${num ? mathText(num).trim() : ''}/${den ? mathText(den).trim() : ''}}`;
    } else if (ln === 'sSup') {
      const e = [...c.childNodes].find((x) => local(x) === 'e');
      const sup = [...c.childNodes].find((x) => local(x) === 'sup');
      const s = sup ? mathText(sup) : '';
      out += (e ? mathText(e) : '') + (/^\d+$/.test(s) ? s.split('').map((d) => SUP[d]).join('') : '^' + s);
    } else if (ln === 'sSub') {
      const e = [...c.childNodes].find((x) => local(x) === 'e');
      const sub = [...c.childNodes].find((x) => local(x) === 'sub');
      out += (e ? mathText(e) : '') + (sub ? mathText(sub) : '');
    } else if (ln === 'd') {
      const es = [...c.childNodes].filter((x) => local(x) === 'e').map(mathText);
      out += '(' + es.join('; ') + ')';
    } else if (ln === 'rad') {
      const e = [...c.childNodes].find((x) => local(x) === 'e');
      out += '√(' + (e ? mathText(e) : '') + ')';
    } else if (ln === 'rPr' || ln === 'ctrlPr' || ln === 'fPr' || ln === 'sSupPr' || ln === 'dPr') {
      // bỏ qua định dạng
    } else out += mathText(c);
  });
  return out;
}

function runsText(node: Node): string {
  let out = '';
  node.childNodes.forEach((c) => {
    if (c.nodeType !== 1) return;
    const ln = local(c);
    if (ln === 't') out += c.textContent || '';
    else if (ln === 'tab') out += '\t';
    else if (ln === 'br' || ln === 'cr') out += '\n';
    else if (ln === 'oMath' || ln === 'oMathPara') out += mathText(c);
    else if (ln === 'drawing' || ln === 'pict' || ln === 'object') out += ' [hình] ';
    else if (ln === 'rPr' || ln === 'pPr' || ln === 'instrText' || ln === 'delText') {
      // bỏ qua
    } else out += runsText(c);
  });
  return out;
}

function blockText(node: Node, lines: string[]) {
  node.childNodes.forEach((c) => {
    if (c.nodeType !== 1) return;
    const ln = local(c);
    if (ln === 'p') lines.push(runsText(c));
    else if (ln === 'tbl') {
      [...c.childNodes].filter((r) => local(r) === 'tr').forEach((tr) => {
        const cells = [...tr.childNodes].filter((x) => local(x) === 'tc').map((tc) => {
          const sub: string[] = [];
          blockText(tc, sub);
          return sub.filter((s) => s.trim()).join('\n');
        });
        // ô có nhiều dòng: tách thành nhiều dòng để nhận diện được tiêu đề "ĐỀ SỐ ..."
        const multi = cells.some((x) => x.includes('\n'));
        if (multi) cells.forEach((x) => x.split('\n').forEach((l) => lines.push(l)));
        else lines.push(cells.join(' \t '));
      });
    } else if (ln === 'sdt' || ln === 'sdtContent' || ln === 'body' || ln === 'customXml') blockText(c, lines);
  });
}

export async function docxToText(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file('word/document.xml');
  if (!f) throw new Error('Không đọc được file Word (thiếu document.xml). Hãy lưu lại dưới dạng .docx rồi thử lại.');
  const xml = await f.async('text');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = doc.getElementsByTagNameNS('*', 'body')[0];
  const lines: string[] = [];
  if (body) blockText(body, lines);
  return lines.join('\n').replace(/ /g, ' ');
}

export async function pdfToText(buf: ArrayBuffer): Promise<string> {
  const pdfjs: any = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const out: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    let line = '';
    let lastY: number | null = null;
    for (const it of tc.items as any[]) {
      const y = it.transform?.[5];
      if (lastY !== null && Math.abs(y - lastY) > 4) {
        out.push(line);
        line = '';
      }
      line += it.str + (it.hasEOL ? '' : '');
      if (it.hasEOL) {
        out.push(line);
        line = '';
        lastY = null;
        continue;
      }
      lastY = y;
    }
    if (line) out.push(line);
  }
  return out.join('\n');
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
