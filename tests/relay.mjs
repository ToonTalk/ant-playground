// Let the page under test talk to Claude with a real key, without the key ever entering the browser.
// The page builds its request as usual with a stand-in key; its fetch to api.anthropic.com is handed to
// Node, which puts the real key in and streams the reply back. So the page's own prompt, request and
// stream reading are what get exercised.
import { execFileSync } from "node:child_process";

export const STAND_IN = "the-real-key-stays-in-node";

// The key: ANT-PLAYGROUND-ANTHROPIC-KEY (or ANTHROPIC_API_KEY), from the environment or, on Windows, from
// the user's variables (for one set after this shell started).
export function readKey() {
  const names = ["ANT-PLAYGROUND-ANTHROPIC-KEY", "ANT_PLAYGROUND_ANTHROPIC_KEY", "ANTHROPIC_API_KEY"];
  for (const n of names) if (process.env[n]) return process.env[n];
  if (process.platform === "win32") {
    for (const n of names) {
      try {
        const v = execFileSync("powershell", ["-NoProfile", "-Command", `[Environment]::GetEnvironmentVariable('${n}','User')`], { encoding: "utf8" }).trim();
        if (v) return v;
      } catch {}
    }
  }
  return null;
}

// Start relaying. Returns a log with one entry per request: model, status, tokens, timings.
export async function relay(page, key) {
  const log = [];
  await page.send("Runtime.addBinding", { name: "__toNode" });
  page.on(async d => {
    if (d.method !== "Runtime.bindingCalled" || d.params.name !== "__toNode") return;
    const { id, url, headers, body } = JSON.parse(d.params.payload);
    const back = (kind, v) => page.evaluate(`__fromNode(${id}, ${JSON.stringify(kind)}, ${JSON.stringify(v)})`);
    const entry = { model: JSON.parse(body).model, t0: Date.now() };
    log.push(entry);
    try {
      if (headers["x-api-key"] !== STAND_IN) throw new Error("unexpected key in the page");
      const res = await fetch(url, { method: "POST", headers: { ...headers, "x-api-key": key }, body });
      entry.status = res.status;
      await back("head", res.status);
      const dec = new TextDecoder();
      let all = "";
      for await (const chunk of res.body) {
        const t = dec.decode(chunk, { stream: true });
        if (!entry.firstText && /text_delta/.test(t)) entry.firstText = Date.now() - entry.t0;
        all += t;
        await back("chunk", t);
      }
      entry.ms = Date.now() - entry.t0;
      entry.stop = /"stop_reason":"(\w+)"/.exec(all)?.[1];
      entry.out = +(/(\d+)/.exec([...all.matchAll(/"output_tokens":\d+/g)].at(-1)?.[0] || "")?.[1] || 0);
      entry.in = +(/"input_tokens":(\d+)/.exec(all)?.[1] || 0);
      entry.servedBy = /"model":"([^"]+)"/.exec(all)?.[1];
      if (res.status !== 200) entry.error = all.slice(0, 300);
      await back("end", 0);
    } catch (e) { entry.error = String(e); try { await back("head", 599); await back("end", 0); } catch {} }
  });
  return log;
}

// Run this in the page after each load: hands Claude requests to Node, and points the page at Claude
// with the stand-in key.
export const shim = model => `
  window.__pending = new Map(); window.__n = 0;
  const realFetch = window.fetch;
  window.fetch = (url, init) => {
    if (!String(url).startsWith("https://api.anthropic.com/")) return realFetch(url, init);
    const id = ++window.__n;
    return new Promise(resolve => {
      let ctrl; const stream = new ReadableStream({ start(c) { ctrl = c; } }); const enc = new TextEncoder();
      window.__pending.set(id, { head: s => resolve(new Response(stream, { status: s })), chunk: t => ctrl.enqueue(enc.encode(t)), end: () => ctrl.close() });
      __toNode(JSON.stringify({ id, url: String(url), headers: init.headers, body: init.body }));
    });
  };
  window.__fromNode = (id, kind, v) => window.__pending.get(id)[kind](v);
  window.stepFor = s => { for (let i = 0; i < s * 60; i++) step(1 / 60); };
  window.setAnts = n => { ants.length = Math.min(ants.length, n); while (ants.length < n) ants.push(makeAnt()); };
  ai.provider = "anthropic"; ai.keys.anthropic = ${JSON.stringify(STAND_IN)}; ai.models.anthropic = ${JSON.stringify(model)};
  0`;
