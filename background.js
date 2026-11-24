const RULESET = "ads";
const WL_BASE = 1000; // dynamic allow-rule ids start here

async function getState() {
  const { enabled = true, whitelist = [] } = await chrome.storage.local.get(["enabled", "whitelist"]);
  return { enabled, whitelist };
}

async function applyEnabled(enabled) {
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    enabled ? { enableRulesetIds: [RULESET] } : { disableRulesetIds: [RULESET] }
  );
}

async function syncWhitelist(whitelist) {
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  const add = whitelist.map((host, idx) => ({
    id: WL_BASE + idx,
    priority: 100,
    action: { type: "allowAllRequests" },
    condition: { requestDomains: [host], resourceTypes: ["main_frame", "sub_frame"] }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: old.map(r => r.id),
    addRules: add
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled, whitelist } = await getState();
  await chrome.storage.local.set({ enabled, whitelist, blocked: {} });
  await applyEnabled(enabled);
  await syncWhitelist(whitelist);
});

chrome.runtime.onStartup.addListener(async () => {
  const { enabled, whitelist } = await getState();
  await applyEnabled(enabled);
  await syncWhitelist(whitelist);
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  if (changes.enabled) await applyEnabled(changes.enabled.newValue);
  if (changes.whitelist) await syncWhitelist(changes.whitelist.newValue || []);
});

// ---- per-tab blocked counter ----
// Kept in storage.session (not a plain variable) because MV3 service workers are
// shut down when idle and would otherwise lose the counts.
let queue = Promise.resolve();
function updateCounts(fn) {
  queue = queue.then(async () => {
    const { counts = {} } = await chrome.storage.session.get("counts");
    fn(counts);
    await chrome.storage.session.set({ counts });
  }).catch(() => {});
  return queue;
}
function setBadge(tabId, n) {
  chrome.action.setBadgeBackgroundColor({ color: "#d93025", tabId }).catch(() => {});
  chrome.action.setBadgeText({ text: n ? String(n > 999 ? "999+" : n) : "", tabId }).catch(() => {});
}
const bump = (tabId, n = 1) => updateCounts(c => { c[tabId] = (c[tabId] || 0) + n; setBadge(tabId, c[tabId]); });

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {   // only available in unpacked installs
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(info => {
    if (info.request.tabId >= 0) bump(info.request.tabId);
  });
}
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === "loading" && change.url !== undefined) updateCounts(c => { c[tabId] = 0; setBadge(tabId, 0); });
});
chrome.tabs.onRemoved.addListener(tabId => updateCounts(c => { delete c[tabId]; }));

chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (msg.type === "getCount") {
    queue.then(() => chrome.storage.session.get("counts"))
         .then(({ counts = {} }) => send({ count: counts[msg.tabId] || 0 }));
    return true;                                          // async response
  }
  if (msg.type === "cosmeticCount" && sender.tab) bump(sender.tab.id, msg.n);
});


// ---------- close ad tabs opened by a page ----------
const adDomains = new Set();
const adDomainsReady = fetch(chrome.runtime.getURL("rules.json"))
  .then(r => r.json())
  .then(rs => { for (const r of rs) (r.condition.requestDomains || []).forEach(d => adDomains.add(d)); })
  .catch(() => {});
const AD_WORDS = /(popads|popcash|propeller|exoclick|adsterra|onclickads|clickadu|juicyads|trafficjunky|hilltopads|adcash|admaven|popunder|monetag|clickadilla)/i;
function isAdUrl(url) {
  try {
    const h = new URL(url).hostname;
    if (AD_WORDS.test(h)) return true;
    for (let p = h; p.includes("."); p = p.slice(p.indexOf(".") + 1)) if (adDomains.has(p)) return true;
  } catch {}
  return false;
}
const closing = new Set();   // onCreated and onUpdated can both fire for one tab
async function maybeClose(tab, url) {
  if (!url || tab.openerTabId == null || closing.has(tab.id)) return;
  await adDomainsReady;
  if (!isAdUrl(url)) return;
  closing.add(tab.id);
  try {
    const { enabled = true, whitelist = [] } = await chrome.storage.local.get(["enabled", "whitelist"]);
    if (!enabled) return;
    try {
      const opener = await chrome.tabs.get(tab.openerTabId);
      const oh = new URL(opener.url).hostname;
      if (whitelist.some(h => oh === h || oh.endsWith("." + h))) return;
      await chrome.tabs.update(opener.id, { active: true });
      bump(opener.id);
    } catch {}
    await chrome.tabs.remove(tab.id).catch(() => {});
  } finally {
    setTimeout(() => closing.delete(tab.id), 5000);
  }
}
chrome.tabs.onCreated.addListener(tab => maybeClose(tab, tab.pendingUrl || tab.url));
chrome.tabs.onUpdated.addListener((id, change, tab) => { if (change.url) maybeClose(tab, change.url); });
