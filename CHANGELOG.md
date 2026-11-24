# Changelog

## 1.1.0
- Pop-up / pop-under guard (`popguard.js`): blocks script-opened windows, fake link clicks, hidden `target=_blank` forms and invisible click-catcher overlays.
- Auto-close ad tabs opened by a page and return to the original tab.
- Fix: ad-host detection no longer matches normal hosts such as `download.*` or `upload.*`.
- Fix: blocked-ad counter now survives the MV3 service worker going idle.
- Fix: "same site" check understands `co.in` / `co.uk` style domains.
- Manifest declares `minimum_chrome_version` 111 (needed for `world: "MAIN"` content scripts).

## 1.0.0
- Initial release: network blocking via declarativeNetRequest, cosmetic filtering, YouTube ad handling, per-site pause and master switch.
