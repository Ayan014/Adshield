const $ = id => document.getElementById(id);
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = "";
  try { host = new URL(tab.url).hostname; } catch {}
  $("host").textContent = host || "";
  const { enabled = true, whitelist = [] } = await chrome.storage.local.get(["enabled", "whitelist"]);
  $("master").checked = enabled;

  const paused = () => whitelist.includes(host);
  const refresh = () => { $("pause").textContent = paused() ? "Resume on this site" : "Pause on this site"; };
  refresh();
  if (!host) $("pause").disabled = true;

  $("master").onchange = e => chrome.storage.local.set({ enabled: e.target.checked });
  $("pause").onclick = async () => {
    const i = whitelist.indexOf(host);
    i >= 0 ? whitelist.splice(i, 1) : whitelist.push(host);
    await chrome.storage.local.set({ whitelist });
    refresh();
    chrome.tabs.reload(tab.id);
  };
  $("reload").onclick = () => { chrome.tabs.reload(tab.id); window.close(); };

  chrome.runtime.sendMessage({ type: "getCount", tabId: tab.id }, r => { $("count").textContent = r?.count ?? 0; });
})();
