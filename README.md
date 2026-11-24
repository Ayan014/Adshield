# 🛡️ AdShield – General Ad Blocker

A lightweight ad, tracker and pop-up blocker for **Chrome, Edge, Brave and Opera** (Manifest V3, Chrome 111+). No build step, no dependencies, no data collection.

## Install (developer mode)
1. Download or clone this repository:
   ```bash
   git clone https://github.com/<your-username>/adshield.git
   ```
2. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the repository folder (the one containing `manifest.json`).

## Features
- **Network blocking** (`rules.json`): ~130 ad, tracker and pop-under domains plus generic third-party ad URL patterns, using `declarativeNetRequest`.
- **Cosmetic filtering** (`content.js`): hides leftover ad containers, native-ad widgets (Taboola, Outbrain, …) and blocks labelled "Sponsored" / "Advertisement".
- **YouTube**: hides ad slots, skips / fast-forwards video ads.
- **Pop-up guard** (`popguard.js`):
  - `window.open` is blocked unless you really clicked *and* it goes to the same site, a sized login/share window, or the exact link you clicked.
  - Script-made link clicks, hidden `target=_blank` forms and links to ad hosts are cancelled.
  - Invisible full-screen click-catcher overlays are removed when tapped.
  - Ad tabs that still open are closed automatically and you're returned to the original page.
- **Controls**: toolbar popup with master on/off switch, "Pause on this site" and reload. The badge shows a per-tab count.

## Project structure
```
manifest.json     extension manifest (MV3)
background.js     service worker: rulesets, allow-list, badge counter, ad-tab closer
content.js        cosmetic filtering + YouTube handling (isolated world)
popguard.js       pop-up / click-hijack protection (runs in the page's main world)
popup.html/js     toolbar popup UI
rules.json        declarativeNetRequest static rules
icons/            16, 48, 128 px icons
```

## Customising
- **Block a domain:** add it to `requestDomains` in rule `id: 1` of `rules.json`, then click *Reload* on `chrome://extensions`.
- **Hide an element:** add a CSS selector to the `selectors` array in `content.js`.
- A site is broken? Use **Pause on this site** in the popup and please open an issue with the URL.

## Known limitations
- The live network-block counter relies on `onRuleMatchedDebug`, which Chrome only provides for **unpacked** extensions. Cosmetic/pop-up blocks are always counted.
- Pausing a site applies to the page and its frames for network rules, but cosmetic filtering inside third-party iframes checks the iframe's own hostname.
- Some sites open login/OAuth windows long after a click; the pop-up guard may block those. Pause the site if that happens.
- YouTube changes its ad system often, so that part may need occasional tweaks.
- Blocking analytics/tag-manager domains (e.g. Google Tag Manager, Hotjar) can occasionally break sites that depend on them.

## Privacy
AdShield runs entirely in your browser. It does not collect, store or transmit any browsing data. The only things saved (via `chrome.storage`) are your on/off setting and your allow-list.

## Contributing
Issues and pull requests are welcome. For site-specific breakage please include the URL and what stopped working.

## License
[MIT](LICENSE)
