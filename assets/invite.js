/* Write-together invite page (/c/#c1.<room>.<key>). The key after "#" never
   reaches a server, and this page makes no network requests with it. */
(() => {
  const $ = (s) => document.querySelector(s);
  const payload = decodeURIComponent(location.hash.slice(1)).trim();

  function fail(reason) {
    $("[data-invite-error]").hidden = false;
    if (reason) $("[data-invite-reason]").textContent = reason;
  }

  function valid(p) {
    const parts = p.split(".");
    if (parts.length !== 3) return "missing";
    const [v, room, key] = parts;
    if (v !== "c1") return "newer";
    if (!/^[A-Za-z0-9_-]{22,64}$/.test(room) || !/^[A-Za-z0-9_-]{43}$/.test(key)) return "missing";
    return "";
  }

  function main() {
    if (!payload) return fail();
    const why = valid(payload);
    if (why === "newer") return fail("This invite was made by a newer Paperflip. Update Paperflip, then paste the link into it (Ctrl+K → Open a shared link).");
    if (why) return fail();
    $("[data-invite-open]").href = `paperflip://join#${payload}`;
    $("[data-invite-copy]").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
      } catch {
        const t = Object.assign(document.createElement("textarea"), { value: location.href });
        document.body.append(t);
        t.select();
        document.execCommand("copy");
        t.remove();
      }
      $("[data-invite-copied]").hidden = false;
    });
    $("[data-invite]").hidden = false;
  }

  addEventListener("hashchange", () => location.reload());
  main();
})();
