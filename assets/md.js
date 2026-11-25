/* Paperflip mini renderer for the website demo: Markdown, code colours, Mermaid flowcharts, TeX → MathML.
   Small on purpose; the real app does far more. */
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ── Code highlighting ─────────────────────────────── */
  const KW = {
    rust: "fn let mut match if else for while loop return pub struct enum impl use mod trait where as in ref self Self async await move const static type dyn crate super unsafe",
    python: "def class return if elif else for while in import from as with try except finally raise lambda yield pass break continue and or not is None True False async await",
    ts: "const let var function return if else for while of in import from export default class extends new type interface async await try catch throw typeof instanceof",
    bash: "if then else fi for do done case esac function export echo cd sudo",
  };
  const ALIAS = { rs: "rust", py: "python", js: "ts", javascript: "ts", typescript: "ts", tsx: "ts", sh: "bash", shell: "bash", zsh: "bash" };
  const LANG_NAME = { rust: "Rust", python: "Python", ts: "TypeScript", bash: "Shell" };
  function highlight(code, lang) {
    const l = ALIAS[lang] || lang;
    const kws = new Set((KW[l] || "").split(" "));
    const lits = new Set(["true", "false", "None", "True", "False", "null", "undefined"]);
    const re = /(\/\/[^\n]*|#[^\n!]*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\\n])*'|`[^`]*`|\b\d[\d_.]*\b|\b[A-Za-z_][A-Za-z0-9_]*\b|::|=>|->|[^\sA-Za-z0-9_])/gm;
    let out = "", last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      const t = m[0];
      let cls = "";
      if (t.startsWith("//") || (t.startsWith("#") && (l === "python" || l === "bash"))) cls = "c";
      else if (/^["'`]/.test(t)) cls = "s";
      else if (/^\d/.test(t)) cls = "n";
      else if (lits.has(t)) cls = "n";
      else if (kws.has(t)) cls = "k";
      else if (/^[A-Z][A-Za-z0-9_]*$/.test(t)) cls = "t";
      else if (/^[a-z_][A-Za-z0-9_]*$/.test(t) && code[re.lastIndex] === "(") cls = "f";
      out += cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t);
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }
  function codeBlock(code, lang, title) {
    const lines = code.replace(/\n$/, "").split("\n");
    const name = LANG_NAME[ALIAS[lang] || lang] || (lang ? lang[0].toUpperCase() + lang.slice(1) : "Text");
    return `<div class="md-code"><div class="md-code-bar"><span class="md-code-lang">${esc(name)}</span>${title ? `<span class="md-code-file">${esc(title)}</span>` : ""}<button type="button" class="md-copy" data-copy>Copy</button></div>` +
      `<pre><code>${lines.map((ln, i) => `<span class="ln">${i + 1}</span>${highlight(ln, lang) || " "}`).join("\n")}</code></pre><textarea hidden data-src>${esc(code)}</textarea></div>`;
  }

  /* ── Mermaid flowcharts (LR / TD) ──────────────────── */
  let mid = 0;
  function mermaid(src) {
    const lines = src.split("\n").map((s) => s.trim()).filter(Boolean);
    const dir = /flowchart\s+(TD|TB)|graph\s+(TD|TB)/.test(lines[0] || "") ? "TD" : "LR";
    const nodes = new Map(), edges = [];
    const node = (tok) => {
      const m = tok.match(/^([A-Za-z0-9_]+)\s*(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\})?$/);
      if (!m) return null;
      const id = m[1], label = m[2] ?? m[3] ?? m[4];
      if (!nodes.has(id)) nodes.set(id, { id, label: label ?? id, shape: m[4] != null ? "rhombus" : m[3] != null ? "round" : "rect" });
      else if (label != null) nodes.get(id).label = label;
      return id;
    };
    for (const ln of lines.slice(1)) {
      const parts = ln.split(/\s*-->\s*|\s*---\s*|\s*-\.->\s*|\s*==>\s*/);
      if (parts.length < 2) { node(ln); continue; }
      for (let i = 0; i < parts.length - 1; i++) {
        const a = node(parts[i]), b = node(parts[i + 1]);
        if (a && b) edges.push([a, b]);
      }
    }
    if (!nodes.size) return `<div class="md-mermaid-err">Couldn't draw this diagram</div>`;
    const rank = new Map([...nodes.keys()].map((k) => [k, 0]));
    for (let it = 0; it < nodes.size; it++) for (const [a, b] of edges) if (rank.get(b) < rank.get(a) + 1 && rank.get(a) + 1 < nodes.size) rank.set(b, rank.get(a) + 1);
    const cols = [];
    for (const [k, r] of rank) (cols[r] ||= []).push(k);
    const W = 108, H = 40, GX = 66, GY = 30;
    const pos = new Map();
    const maxRows = Math.max(...cols.map((c) => c.length));
    cols.forEach((c, ci) => c.forEach((k, ri) => {
      const off = (maxRows - c.length) * (dir === "LR" ? H + GY : W + GX) / 2;
      pos.set(k, dir === "LR" ? { x: ci * (W + GX), y: off + ri * (H + GY) } : { x: off + ri * (W + GX), y: ci * (H + GY + 16) });
    }));
    const vw = Math.max(...[...pos.values()].map((p) => p.x)) + W + 4, vh = Math.max(...[...pos.values()].map((p) => p.y)) + H + 4;
    const id = "mm" + ++mid;
    const ed = edges.map(([a, b]) => {
      const p = pos.get(a), q = pos.get(b);
      let d;
      if (dir === "LR") { const x1 = p.x + W, y1 = p.y + H / 2, x2 = q.x - 2, y2 = q.y + H / 2, mx = (x1 + x2) / 2; d = `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`; }
      else { const x1 = p.x + W / 2, y1 = p.y + H, x2 = q.x + W / 2, y2 = q.y - 2, my = (y1 + y2) / 2; d = `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`; }
      return `<path class="mm-edge" pathLength="1" d="${d}" marker-end="url(#${id}a)"/>`;
    }).join("");
    const nd = [...nodes.values()].map((n) => {
      const p = pos.get(n.id);
      const shape = n.shape === "rhombus"
        ? `<path d="M${p.x + W / 2} ${p.y} L${p.x + W} ${p.y + H / 2} L${p.x + W / 2} ${p.y + H} L${p.x} ${p.y + H / 2}Z"/>`
        : `<rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="${n.shape === "round" ? 20 : 4}"/>`;
      return `<g class="mm-node">${shape}<text x="${p.x + W / 2}" y="${p.y + H / 2 + 4}">${esc(n.label)}</text></g>`;
    }).join("");
    const svg = `<svg viewBox="-2 -2 ${vw + 4} ${vh + 4}" role="img" aria-label="Flowchart"><defs><marker id="${id}a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 8 4 0 8z" fill="currentColor"/></marker></defs>${ed}${nd}</svg>`;
    return `<div class="md-mermaid" data-zoom="1"><div class="md-mermaid-bar"><span>Flowchart</span><span class="md-mermaid-tools"><button type="button" data-mm="out" aria-label="Zoom out">−</button><button type="button" data-mm="in" aria-label="Zoom in">+</button><button type="button" data-mm="fit">Fit</button><button type="button" data-mm="code">Code</button><button type="button" data-mm="full" aria-label="Full screen">⤢</button></span></div><div class="md-mermaid-view"><div class="md-mermaid-canvas">${svg}</div><pre class="md-mermaid-src" hidden>${esc(src)}</pre></div></div>`;
  }

  /* ── TeX → MathML (a useful subset) ────────────────── */
  const SYM = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π", sigma: "σ", tau: "τ", phi: "φ", omega: "ω", Delta: "Δ", Sigma: "Σ", Omega: "Ω", Pi: "Π", infty: "∞" };
  const OPS = { gg: "≫", ll: "≪", le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", approx: "≈", cdot: "·", times: "×", pm: "±", to: "→", rightarrow: "→", sum: "∑", prod: "∏", int: "∫", partial: "∂", nabla: "∇", in: "∈", forall: "∀", exists: "∃", sim: "∼" };
  function tex(src) {
    let i = 0;
    const s = src.trim();
    const peek = () => s[i];
    const ws = () => { while (s[i] === " ") i++; };
    function group() {
      ws();
      if (s[i] === "{") { i++; const r = seq("}"); i++; return `<mrow>${r}</mrow>`; }
      return atom();
    }
    function atom() {
      ws();
      const c = s[i];
      if (c == null) return "";
      if (c === "\\") {
        i++;
        const m = s.slice(i).match(/^[A-Za-z]+|^./)[0];
        i += m.length;
        if (m === "frac") { const a = group(), b = group(); return `<mfrac>${a}${b}</mfrac>`; }
        if (m === "sqrt") return `<msqrt>${group()}</msqrt>`;
        if (m === "text" || m === "mathrm") { ws(); i++; let t = ""; while (i < s.length && s[i] !== "}") t += s[i++]; i++; return `<mtext>${esc(t)}</mtext>`; }
        if (m === "left" || m === "right") return atom();
        if (SYM[m]) return `<mi>${SYM[m]}</mi>`;
        if (OPS[m]) return `<mo>${OPS[m]}</mo>`;
        if (m === "," || m === ";" || m === " ") return `<mspace width="0.2em"/>`;
        return `<mi>${esc(m)}</mi>`;
      }
      i++;
      if (/[0-9.]/.test(c)) { let n = c; while (/[0-9.]/.test(s[i] || "")) n += s[i++]; return `<mn>${n}</mn>`; }
      if (/[A-Za-z]/.test(c)) return `<mi>${c}</mi>`;
      if (c === "-") return "<mo>−</mo>";
      return `<mo>${esc(c)}</mo>`;
    }
    function seq(end) {
      let out = "";
      while (i < s.length && s[i] !== end) {
        ws();
        if (s[i] === end || i >= s.length) break;
        let base = atom();
        let sub = null, sup = null;
        for (;;) { ws(); if (s[i] === "_") { i++; sub = group(); } else if (s[i] === "^") { i++; sup = group(); } else break; }
        if (sub && sup) base = `<msubsup>${base}${sub}${sup}</msubsup>`;
        else if (sub) base = `<msub>${base}${sub}</msub>`;
        else if (sup) base = `<msup>${base}${sup}</msup>`;
        out += base;
      }
      return out;
    }
    try { return `<math display="block"><mrow>${seq(undefined)}</mrow></math>`; }
    catch { return `<code>${esc(src)}</code>`; }
  }

  /* ── Inline Markdown ───────────────────────────────── */
  function inline(t) {
    const codes = [];
    t = t.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    t = esc(t)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/==([^=]+)==/g, "<mark>$1</mark>")
      .replace(/\[\[([^\]]+)\]\]/g, (_, n) => `<a href="#" class="md-wiki" data-wiki="${n}">${n}</a>`)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener nofollow">$1</a>')
      .replace(/\$([^$]+)\$/g, (_, m) => tex(m.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")).replace('display="block"', ""));
    return t.replace(/\u0000(\d+)\u0000/g, (_, k) => `<code>${esc(codes[+k])}</code>`);
  }

  /* ── Block Markdown ────────────────────────────────── */
  function render(md) {
    const L = md.split("\n");
    let html = "", i = 0, para = [];
    const flush = () => { if (para.length) { html += `<p>${inline(para.join(" "))}</p>`; para = []; } };
    while (i < L.length) {
      const ln = L[i];
      let m;
      if ((m = ln.match(/^```\s*([\w+-]*)\s*(?:title="([^"]*)")?/))) {
        flush();
        const lang = m[1].toLowerCase(), title = m[2];
        const buf = [];
        i++;
        while (i < L.length && !/^```/.test(L[i])) buf.push(L[i++]);
        i++;
        const body = buf.join("\n");
        html += lang === "mermaid" ? mermaid(body) : lang === "math" || lang === "latex" ? `<div class="md-math">${tex(body)}</div>` : codeBlock(body, lang, title);
        continue;
      }
      if (/^\$\$/.test(ln.trim())) {
        flush();
        let body = ln.trim().slice(2);
        if (body.endsWith("$$")) body = body.slice(0, -2);
        else { i++; while (i < L.length && !L[i].includes("$$")) body += " " + L[i++]; if (i < L.length) body += " " + L[i].replace("$$", ""); }
        html += `<div class="md-math">${tex(body)}</div>`;
        i++;
        continue;
      }
      if ((m = ln.match(/^(#{1,4})\s+(.*)/))) { flush(); html += `<h${m[1].length + 1} class="md-h">${inline(m[2])}</h${m[1].length + 1}>`; i++; continue; }
      if (/^\s*(---|\*\*\*)\s*$/.test(ln)) { flush(); html += "<hr>"; i++; continue; }
      if (/^>\s?/.test(ln)) {
        flush();
        const buf = [];
        while (i < L.length && /^>\s?/.test(L[i])) buf.push(L[i++].replace(/^>\s?/, ""));
        const a = buf[0].match(/^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(.*)/i);
        if (a) { const rest = [a[2], ...buf.slice(1)].filter(Boolean).join(" "); html += `<div class="md-alert md-alert-${a[1].toLowerCase()}"><b>${a[1][0] + a[1].slice(1).toLowerCase()}</b><p>${inline(rest)}</p></div>`; }
        else html += `<blockquote>${inline(buf.join(" "))}</blockquote>`;
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(ln) && /^\s*\|[\s:|-]+\|\s*$/.test(L[i + 1] || "")) {
        flush();
        const row = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const head = row(ln);
        i += 2;
        let body = "";
        while (i < L.length && /^\s*\|/.test(L[i])) body += `<tr>${row(L[i++]).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`;
        html += `<div class="md-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
        continue;
      }
      if (/^\s*([-*+]|\d+\.)\s+/.test(ln)) {
        flush();
        const ordered = /^\s*\d+\./.test(ln);
        let items = "";
        while (i < L.length && /^\s*([-*+]|\d+\.)\s+/.test(L[i])) {
          const t = L[i].replace(/^\s*([-*+]|\d+\.)\s+/, "");
          const task = t.match(/^\[( |x|X)\]\s*(.*)/);
          if (task) {
            const done = task[1] !== " ";
            items += `<li class="md-task${done ? " is-done" : ""}"><label><input type="checkbox" data-task-line="${i}"${done ? " checked" : ""}><span>${inline(task[2])}</span></label></li>`;
          } else items += `<li>${inline(t)}</li>`;
          i++;
        }
        html += ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
        continue;
      }
      if (!ln.trim()) { flush(); i++; continue; }
      para.push(ln.trim());
      i++;
    }
    flush();
    return html;
  }

  /* ── Shared behaviour for rendered blocks (copy, diagram tools) ── */
  function wire(root) {
    root.addEventListener("click", async (e) => {
      const copy = e.target.closest("[data-copy]");
      if (copy) {
        const src = copy.closest(".md-code").querySelector("[data-src]").value;
        try { await navigator.clipboard.writeText(src); copy.textContent = "Copied"; } catch { copy.textContent = "Select & copy"; }
        setTimeout(() => (copy.textContent = "Copy"), 1400);
        return;
      }
      const mm = e.target.closest("[data-mm]");
      if (mm) {
        const box = mm.closest(".md-mermaid");
        const canvas = box.querySelector(".md-mermaid-canvas");
        let z = +box.dataset.zoom;
        const act = mm.dataset.mm;
        if (act === "in") z = Math.min(2.5, z + 0.25);
        if (act === "out") z = Math.max(0.5, z - 0.25);
        if (act === "fit") z = 1;
        if (act === "code") {
          const src = box.querySelector(".md-mermaid-src");
          const show = src.hidden;
          src.hidden = !show; canvas.hidden = show;
          mm.setAttribute("aria-pressed", String(show));
        }
        if (act === "full") {
          if (document.fullscreenElement) document.exitFullscreen();
          else box.requestFullscreen?.().catch(() => {});
        }
        box.dataset.zoom = z;
        canvas.style.transform = `scale(${z})`;
      }
    });
  }

  window.PFmd = { render, highlight, codeBlock, mermaid, tex, inline, esc, wire };
})();
