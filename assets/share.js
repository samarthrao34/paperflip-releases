/* Shared-note page (/n/#1.<data>). The note is inside the link after "#":
   JSON → raw deflate → base64url. The part after "#" never reaches the server,
   and this page makes no network requests with it. */
(() => {
  const $ = (s) => document.querySelector(s);
  const payload = decodeURIComponent(location.hash.slice(1)).trim();

  function fail(reason) {
    $("[data-share-error]").hidden = false;
    if (reason) $("[data-share-reason]").textContent = reason;
  }

  function b64url(s) {
    const t = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(t + "===".slice((t.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  async function decode(p) {
    const dot = p.indexOf(".");
    if (dot < 1) throw new Error("This isn't a Paperflip share link.");
    if (p.slice(0, dot) !== "1") throw new Error("This link was made by a newer Paperflip. Open it in the app instead.");
    const bytes = b64url(p.slice(dot + 1));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const json = await new Response(stream).text();
    const n = JSON.parse(json);
    if (typeof n !== "object" || n === null) throw new Error("bad note");
    return { title: String(n.t || ""), body: String(n.b || ""), tags: Array.isArray(n.g) ? n.g.map(String) : [], from: String(n.f || "") };
  }

  /* Rendered Markdown comes from a link anyone can make, so strip anything active. */
  function clean(html) {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    root.querySelectorAll("script,style,iframe,object,embed,link,meta,base,form,input:not([type=checkbox])").forEach((e) => e.remove());
    root.querySelectorAll("*").forEach((el) => {
      for (const a of [...el.attributes]) {
        const v = a.value.trim().toLowerCase();
        if (a.name.startsWith("on") || ((a.name === "href" || a.name === "src" || a.name === "xlink:href") && /^(javascript|data|vbscript):/.test(v))) el.removeAttribute(a.name);
      }
      if (el.tagName === "A") { el.setAttribute("rel", "noopener nofollow noreferrer"); el.setAttribute("target", "_blank"); }
      if (el.matches("input[type=checkbox]")) el.setAttribute("disabled", "");
    });
    return root.innerHTML;
  }

  function download(n) {
    const name = (n.title || "Shared note").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80) || "note";
    const front = n.tags.length ? `---\ntitle: ${JSON.stringify(n.title)}\ntags: [${n.tags.map((t) => JSON.stringify(t)).join(", ")}]\n---\n\n` : "";
    const url = URL.createObjectURL(new Blob([front + n.body], { type: "text/markdown;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${name}.md` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function main() {
    if (!payload) return fail();
    let n;
    try {
      n = await decode(payload);
    } catch (e) {
      return fail(e instanceof Error && /newer|isn't/.test(e.message) ? e.message : undefined);
    }
    const title = n.title.trim() || "Untitled note";
    document.title = `${title} — shared with Paperflip`;
    $("[data-share-title]").textContent = title;
    $("[data-share-from]").textContent = n.from.trim() ? `${n.from.trim()} shared a note with you` : "A note was shared with you";
    const words = n.body.split(/\s+/).filter(Boolean).length;
    $("[data-share-meta]").textContent = [`${words} words`, ...n.tags.map((t) => `#${t}`)].join("  ·  ");
    const body = $("[data-share-body]");
    if (!window.PFmd) return fail("This page didn't load properly. Refresh to try again.");
    body.innerHTML = clean(window.PFmd.render(n.body));
    window.PFmd?.wire?.(body);
    $("[data-share-open]").href = `paperflip://open#${payload}`;
    $("[data-share-download]").addEventListener("click", () => download(n));
    $("[data-share]").hidden = false;
  }

  addEventListener("hashchange", () => location.reload());
  main();
})();
