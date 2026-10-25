import React from 'react';

// Hiển thị văn bản có phân số {a/b}, \frac{a}{b}, **đậm**, xuống dòng
const TOKEN = /(\{[^{}\/]{1,20}\/[^{}\/]{1,20}\}|\\frac\{[^{}]*\}\{[^{}]*\}|\*\*[^*]+\*\*)/g;

export function Frac({ n, d }: { n: string; d: string }) {
  return (
    <span className="inline-flex flex-col items-center align-middle mx-0.5 leading-none text-[0.92em]" aria-label={`${n} phần ${d}`}>
      <span className="px-0.5 pb-[1px]">{n}</span>
      <span className="px-0.5 pt-[1px] border-t-[1.5px] border-current">{d}</span>
    </span>
  );
}

function renderLine(line: string, key: number) {
  const parts = line.split(TOKEN);
  return (
    <React.Fragment key={key}>
      {parts.map((p, i) => {
        if (!p) return null;
        let m = p.match(/^\{([^{}\/]+)\/([^{}\/]+)\}$/);
        if (m) return <Frac key={i} n={m[1]} d={m[2]} />;
        m = p.match(/^\\frac\{([^{}]*)\}\{([^{}]*)\}$/);
        if (m) return <Frac key={i} n={m[1]} d={m[2]} />;
        m = p.match(/^\*\*([^*]+)\*\*$/);
        if (m) return <b key={i}>{m[1]}</b>;
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </React.Fragment>
  );
}

export function Rich({ text, className = '' }: { text?: string; className?: string }) {
  const lines = String(text || '').split('\n');
  return (
    <span className={className}>
      {lines.map((l, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {renderLine(l, i)}
        </React.Fragment>
      ))}
    </span>
  );
}

// Văn bản thuần (để xuất Word/Excel): {3/4} -> 3/4
export function plain(text?: string) {
  return String(text || '').replace(/\{([^{}\/]+)\/([^{}\/]+)\}/g, '$1/$2').replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2').replace(/\*\*/g, '');
}
