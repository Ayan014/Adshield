// Runs inside the page itself (world: MAIN) so it can intercept the page's own calls.
(() => {
  if (window.__adshieldPG) return;
  window.__adshieldPG = true;

  const off = () => document.documentElement && document.documentElement.dataset.adshieldOff === "1";
  const AD_HOSTS = /(doubleclick|popads|popcash|propeller|exoclick|adsterra|onclickads|clickadu|juicyads|trafficjunky|hilltopads|adcash|admaven|ad-maven|popunder|richpush|trafficfactory|plugrush|adsrvr|taboola|outbrain|mgid|revcontent|zedo|adnxs|clickaine|clickadilla|monetag|a-ads|(^|\.)ads?\.)/i;
  const notify = what => { try { window.postMessage({ __adshield: "blocked", what }, "*"); } catch (e) {} };
  const site = h => {            // registrable domain, aware of co.in / co.uk / com.au style suffixes
    const p = h.split(".");
    const n = p.length >= 3 && p[p.length - 1].length === 2 && /^(co|com|org|net|gov|edu|ac)$/.test(p[p.length - 2]) ? 3 : 2;
    return p.slice(-n).join(".");
  };
  const resolve = u => { try { return new URL(u, location.href); } catch (e) { return null; } };
  const sameSite = u => { const x = resolve(u); return !!x && site(x.hostname) === site(location.hostname); };

  // remember the last REAL user click (isTrusted can't be faked by page scripts)
  let last = { t: 0, el: null };
  const track = e => { if (e.isTrusted) last = { t: Date.now(), el: e.target }; };
  addEventListener("pointerdown", track, true);
  addEventListener("mousedown", track, true);
  addEventListener("touchstart", track, true);

  const fakeWin = () => ({
    closed: true, close() {}, focus() {}, blur() {}, postMessage() {},
    location: { href: "", assign() {}, replace() {} }, document: { write() {}, close() {} }
  });

  // ---- 1. window.open ----
  const realOpen = window.open;
  window.open = function (url, target, features) {
    if (off()) return realOpen.apply(this, arguments);
    const u = url ? resolve(url) : null;
    const recentClick = Date.now() - last.t < 1000;
    const clickedLink = last.el && last.el.closest && last.el.closest("a[href]");
    const isAdUrl = u && AD_HOSTS.test(u.hostname);
    // allowed: real click + (same-site URL, or a sized popup window like a login/share dialog) + not an ad host
    const looksLegit = recentClick && !isAdUrl &&
      (sameSite(url) || (features && /width|height/i.test(features)) ||
       (clickedLink && resolve(clickedLink.href) && resolve(clickedLink.href).href === u.href));
    if (looksLegit) return realOpen.apply(this, arguments);
    notify("window.open");
    return fakeWin();
  };

  // ---- 2. script-generated link clicks (a.click() / dispatchEvent) ----
  addEventListener("click", e => {
    if (off()) return;
    const a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    const u = resolve(a.href);
    const opensNew = (a.target && a.target !== "_self") || e.ctrlKey || e.metaKey;
    if (!u || !opensNew) return;
    if (!e.isTrusted || (AD_HOSTS.test(u.hostname) && !sameSite(a.href))) {
      e.preventDefault(); e.stopImmediatePropagation(); notify("link");
    }
  }, true);

  // ---- 3. forms that submit into a new tab ----
  addEventListener("submit", e => {
    if (off()) return;
    const f = e.target;
    if (f && f.target && f.target !== "_self" && !e.isTrusted) { e.preventDefault(); e.stopImmediatePropagation(); notify("form"); }
  }, true);

  // ---- 4. invisible full-screen click-catcher overlays ----
  function isCatcher(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (el.parentElement !== document.body && el.parentElement !== document.documentElement) return false;
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "absolute") return false;
    const r = el.getBoundingClientRect();
    if (r.width < innerWidth * 0.8 || r.height < innerHeight * 0.8) return false;
    if ((el.textContent || "").trim().length > 0) return false;
    if (el.querySelector("img,video,canvas,input,button,svg")) return false;
    const clear = parseFloat(cs.opacity) < 0.1 || cs.backgroundColor === "rgba(0, 0, 0, 0)" || cs.backgroundColor === "transparent";
    return clear && (parseInt(cs.zIndex, 10) || 0) >= 100;
  }
  const catchOverlay = e => {
    if (off() || !e.isTrusted) return;
    const x = e.clientX != null ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX);
    const y = e.clientY != null ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY);
    let el = e.target;
    if (x != null && y != null) el = document.elementFromPoint(x, y) || el;
    if (isCatcher(el)) {
      e.preventDefault(); e.stopImmediatePropagation();
      el.remove(); notify("overlay");
    }
  };
  ["pointerdown", "mousedown", "touchstart", "click"].forEach(t => addEventListener(t, catchOverlay, true));

  // ---- 5. fake "ad block detected" helpers ----
  window.canRunAds = true;
})();
