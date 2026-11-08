// Watches the extension's own files. When one changes on disk (an unpacked extension
// serves them straight from the folder), the extension reloads itself so the new skin
// is used on the next page load. Chrome only allows alarms every 30 seconds.
const FILES = ["skin.js", "manifest.json", "background.js"];

async function fingerprint() {
  let out = "";
  for (const f of FILES) {
    const text = await (await fetch(chrome.runtime.getURL(f), { cache: "no-store" })).text();
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    out += f + ":" + text.length + ":" + h + ";";
  }
  return out;
}

async function check() {
  try {
    const now = await fingerprint();
    const { last } = await chrome.storage.session.get("last");
    if (!last) { await chrome.storage.session.set({ last: now }); return; }
    if (last !== now) { await chrome.storage.session.remove("last"); chrome.runtime.reload(); }
  } catch (e) { /* a file mid-save; try again next tick */ }
}

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create("watch", { periodInMinutes: 0.5 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create("watch", { periodInMinutes: 0.5 }));
chrome.alarms.onAlarm.addListener(a => { if (a.name === "watch") check(); });
check();
