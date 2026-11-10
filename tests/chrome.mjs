// Open the built page in headless Chrome and talk to it over the DevTools protocol.
// Needs Node 22 or newer (global WebSocket and fetch) and Chrome; set CHROME to its path if it isn't found.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].find(p => fs.existsSync(p));
const TYPES = { ".html": "text/html; charset=utf-8", ".webp": "image/webp", ".json": "application/json", ".png": "image/png" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function openPage({ file = "index.html", width = 1280, height = 800 } = {}) {
  if (!CHROME) throw new Error("Chrome not found. Set the CHROME environment variable to its path.");
  // serve the repository, so the page loads as it does on the site
  const server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/${file}`;

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ant-playground-test-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--mute-audio", "about:blank"], { stdio: "ignore" });
  const portFile = path.join(profile, "DevToolsActivePort");       // Chrome writes the port it chose here
  let port;
  for (let i = 0; i < 150 && !port; i++) {
    try { port = /^\d+/.exec(fs.readFileSync(portFile, "utf8"))?.[0]; } catch {}     // not there yet, or still being written
    if (!port) await sleep(100);
  }
  if (!port) { chrome.kill(); server.close(); throw new Error("Chrome did not start"); }
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === "page");
    if (!target) await sleep(100);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const waiting = new Map(), listeners = [], errors = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id) { const w = waiting.get(d.id); waiting.delete(d.id); d.error ? w.rej(new Error(`${w.method}: ${d.error.message}`)) : w.res(d.result); }
    else for (const l of [...listeners]) l(d);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { waiting.set(++id, { res, rej, method }); ws.send(JSON.stringify({ id, method, params })); });
  listeners.push(d => { if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); });
  await send("Runtime.enable"); await send("Page.enable");
  const setSize = (w, h) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await setSize(width, height);

  // run JavaScript in the page; the page's own functions and variables are in reach
  async function evaluate(expression) {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  // load (or reload) the page, wait for the colony to start, then hold time still so tests step it themselves
  async function fresh() {
    const loaded = new Promise(r => { const l = d => { if (d.method === "Page.loadEventFired") { listeners.splice(listeners.indexOf(l), 1); r(); } }; listeners.push(l); });
    await send("Page.navigate", { url });
    await loaded;
    for (let i = 0; i < 100; i++) { if (await evaluate("typeof seeded !== 'undefined' && seeded")) break; await sleep(100); }
    if (!(await evaluate("seeded"))) throw new Error("the colony never started");
    await evaluate("paused = true; 0");
  }
  async function close() {
    try { ws.close(); } catch {}
    chrome.kill(); server.close();
    await sleep(400);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); } catch {}
  }
  return { evaluate, fresh, send, setSize, on: l => listeners.push(l), errors, close, url };
}
