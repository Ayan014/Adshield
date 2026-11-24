(async () => {
  const host = location.hostname;
  let state;
  try { state = await chrome.storage.local.get(["enabled", "whitelist"]); } catch { return; }
  const enabled = state.enabled !== false;
  const wl = state.whitelist || [];
  const paused = wl.some(h => host === h || host.endsWith("." + h));
  if (!enabled || paused) {
    document.documentElement.dataset.adshieldOff = "1";   // tells popguard.js to stand down
    return;
  }

  // ---------- cosmetic filtering ----------
  const selectors = [
    // generic ad containers
    'ins.adsbygoogle', '[id^="google_ads_"]', '[id^="div-gpt-ad"]', '[id^="ad-slot"]',
    '[class*="adsbygoogle"]', 'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication"]',
    'iframe[src*="adservice"]', 'iframe[id^="google_ads_iframe"]', 'iframe[title="Advertisement"]',
    '[aria-label="Advertisement"]', '[aria-label="advertisement"]', '[data-ad-slot]', '[data-ad-client]',
    '[data-google-query-id]', '[data-ad-unit]', '[data-adunit]',
    '.ad-banner', '.ad-container', '.ad-wrapper', '.ad-slot', '.ad-unit', '.ad-box', '.ad-block',
    '.advert', '.advertisement', '.advertising', '.adsbox', '.sponsored-ad', '.banner-ad',
    '.top-ad', '.bottom-ad', '.sidebar-ad', '.sticky-ad', '.native-ad', '.text-ad',
    '#ad-banner', '#ad-container', '#ad-wrapper', '#ads', '#advert', '#advertisement',
    '#sidebar-ads', '#header-ad', '#footer-ad', '#top-ads', '#bottom-ads',
    // native-ad networks
    '.taboola', '[id^="taboola-"]', '[class*="taboola"]', '.OUTBRAIN', '[data-widget-id*="outbrain"]',
    '[id^="outbrain"]', '.mgid', '[id^="mgid"]', '.revcontent', '[id^="rc-widget"]',
    // cookie/newsletter nags that overlay content are NOT touched (avoid breaking sites)
    // YouTube
    'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', 'ytd-banner-promo-renderer',
    'ytd-promoted-sparkles-web-renderer', 'ytd-promoted-video-renderer', 'ytd-display-ad-renderer',
    '#player-ads', '#masthead-ad', '.ytp-ad-overlay-container', '.ytp-ad-module',
    'ytd-companion-slot-renderer', 'ytd-action-companion-ad-renderer', '.ytd-ad-slot-renderer',
    // Facebook / social
    'a[href*="/ads/about"]', '[data-pagelet="RightRail"] [data-pagelet*="Ad"]',
    // Twitter/X promoted
    '[data-testid="placementTracking"]'
  ];

  const style = document.createElement("style");
  style.id = "adshield-style";
  style.textContent = selectors.join(",\n") + " { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; }";
  (document.head || document.documentElement).appendChild(style);

  // Remove empty leftover wrappers + text-labelled "Sponsored"/"Advertisement" blocks
  let hidden = 0;
  const LABELS = /^(ad|ads|advertisement|advertisements|sponsored|promoted|sponsored content|paid content)$/i;
  function sweep() {
    // label-based sweep (short elements whose entire text is "Advertisement"/"Sponsored")
    document.querySelectorAll("span, div, p, small, h6").forEach(el => {
      if (el.dataset.adshield || el.children.length) return;
      const t = (el.textContent || "").trim();
      if (t.length > 0 && t.length < 20 && LABELS.test(t)) {
        // hide the closest reasonably-sized container
        let box = el.parentElement;
        for (let i = 0; i < 2 && box && box.parentElement && box.parentElement !== document.body; i++) {
          if (box.getBoundingClientRect().height > 600) break;
          box = box.parentElement;
        }
        if (box && box !== document.body && box !== document.documentElement) {
          box.style.setProperty("display", "none", "important");
          box.dataset.adshield = "1"; el.dataset.adshield = "1"; hidden++;
        }
      }
    });
  }

  // ---------- YouTube video-ad handling ----------
  const isYT = /(^|\.)youtube\.com$/.test(host);
  function youtube() {
    const player = document.querySelector(".html5-video-player");
    if (!player) return;
    const adShowing = player.classList.contains("ad-showing") || document.querySelector(".ytp-ad-player-overlay");
    const video = player.querySelector("video");
    if (adShowing && video) {
      video.muted = true;
      if (isFinite(video.duration) && video.duration > 0) video.currentTime = video.duration;
      video.playbackRate = 16;
    }
    const skip = document.querySelector(
      ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button.ytp-ad-skip-button-container"
    );
    if (skip) skip.click();
    const close = document.querySelector(".ytp-ad-overlay-close-button");
    if (close) close.click();
  }

  // ---------- Pop-up guard reports (popguard.js runs in the page and posts here) ----------
  function toast(text) {
    if (window.top !== window) return;
    const d = document.createElement("div");
    d.textContent = text;
    d.style.cssText = "position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#202124;color:#fff;" +
      "padding:8px 14px;border-radius:20px;font:13px system-ui,sans-serif;z-index:2147483647;opacity:.95;pointer-events:none";
    (document.body || document.documentElement).appendChild(d);
    setTimeout(() => d.remove(), 2200);
  }
  window.addEventListener("message", e => {
    if (e.source !== window || !e.data || e.data.__adshield !== "blocked") return;
    try { chrome.runtime.sendMessage({ type: "cosmeticCount", n: 1 }); } catch {}
    toast("AdShield blocked a pop-up");
  });

  // ---------- run ----------
  let timer = null;
  const run = () => { timer = null; sweep(); if (isYT) youtube(); };
  const schedule = () => { if (!timer) timer = setTimeout(run, 150); };

  const start = () => {
    run();
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: isYT, attributeFilter: isYT ? ["class"] : undefined });
    if (isYT) setInterval(youtube, 500);
    setTimeout(() => {
      const n = hidden + document.querySelectorAll(selectors.slice(0, 40).join(",")).length;
      if (n) try { chrome.runtime.sendMessage({ type: "cosmeticCount", n }); } catch {}
    }, 2500);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
