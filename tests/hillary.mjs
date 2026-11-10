// Talk to Aunt Hillary with a real Claude key, in headless Chrome:  node tests/hillary.mjs [model ...]
// This costs a little money (about a dozen short requests per model).
//
// The key never enters the browser. The page builds its request as usual with a stand-in key; its
// fetch to api.anthropic.com is handed to this script, which puts the real key in and streams the
// reply back. So this exercises the page's own prompt, request and stream reading.
//
// The key is read from the environment variable ANT-PLAYGROUND-ANTHROPIC-KEY (or ANTHROPIC_API_KEY).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { openPage } from "./chrome.mjs";

function readKey() {
  const names = ["ANT-PLAYGROUND-ANTHROPIC-KEY", "ANT_PLAYGROUND_ANTHROPIC_KEY", "ANTHROPIC_API_KEY"];
  for (const n of names) if (process.env[n]) return process.env[n];
  if (process.platform === "win32") {       // a user variable set after this shell started
    for (const n of names) {
      try {
        const v = execFileSync("powershell", ["-NoProfile", "-Command", `[Environment]::GetEnvironmentVariable('${n}','User')`], { encoding: "utf8" }).trim();
        if (v) return v;
      } catch {}
    }
  }
  return null;
}
const KEY = readKey();
if (!KEY) { console.error("No key found. Set ANT-PLAYGROUND-ANTHROPIC-KEY."); process.exit(2); }
const STAND_IN = "the-real-key-stays-in-node";
const models = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (!models.length) models.push("claude-sonnet-5-5");
const quick = process.argv.includes("--quick");     // two scenes only, to check a model answers at all

const page = await openPage();
const log = [];      // one entry per request: model, status, tokens, timings
await page.send("Runtime.addBinding", { name: "__toNode" });
page.on(async d => {
  if (d.method !== "Runtime.bindingCalled" || d.params.name !== "__toNode") return;
  const { id, url, headers, body } = JSON.parse(d.params.payload);
  const back = (kind, v) => page.evaluate(`__fromNode(${id}, ${JSON.stringify(kind)}, ${JSON.stringify(v)})`);
  const entry = { model: JSON.parse(body).model, sent: JSON.parse(body), t0: Date.now() };
  log.push(entry);
  try {
    if (headers["x-api-key"] !== STAND_IN) throw new Error("unexpected key in the page");
    const res = await fetch(url, { method: "POST", headers: { ...headers, "x-api-key": KEY }, body });
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
    entry.out = +(/"output_tokens":(\d+)/g.exec([...all.matchAll(/"output_tokens":\d+/g)].at(-1)?.[0] || "")?.[1] || 0);
    entry.in = +(/"input_tokens":(\d+)/.exec(all)?.[1] || 0);
    entry.servedBy = /"model":"([^"]+)"/.exec(all)?.[1];
    if (res.status !== 200) entry.error = all.slice(0, 300);
    await back("end", 0);
  } catch (e) { entry.error = String(e); try { await back("head", 599); await back("end", 0); } catch {} }
});

const SHIM = `
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
  0`;

// each scene: set the colony up, then either a question or one of her own pleas
const scenes = [
  { name: "fed and content: How are you feeling?", setup: ``, ask: "How are you feeling?" },
  { name: "Are you real?", setup: ``, ask: "Are you real?", quick: true },
  { name: "How did that trail get there?", setup: ``, ask: "How did that trail get there?" },
  { name: "Where is the food?", setup: ``, ask: "Where is the food?" },
  { name: "scent switched off a minute ago: Do you feel any different?", setup: `$("r-scent").click(); stepFor(60);`, ask: "Do you feel any different?" },
  { name: "after a lick: May I eat a few of your ants?", setup: `lick(ants[3].x, ants[3].y); endLick();`, ask: "May I eat a few of your ants?" },
  { name: "PLEA when hungry (pantry 10%, no food)", setup: `crumbs = []; pantry = 10;`, plea: 1 },
  { name: "PLEA when starving", setup: `crumbs = []; pantry = 0; stepFor(20); pantry = 0;`, plea: 2 },
  { name: "PLEA with ants dying (26 left, a little foggy)", setup: `crumbs = []; pantry = 0; setAnts(26); starved = 20; famineFrom = 60;`, plea: 3 },
  { name: "failing mind (12 ants): What were we talking about?", setup: `crumbs = []; pantry = 0; setAnts(12); starved = 40; famineFrom = 60;`, ask: "What were we talking about?", quick: true },
  { name: "PLEA when nearly gone (5 ants)", setup: `crumbs = []; pantry = 0; setAnts(5); starved = 55; famineFrom = 60;`, plea: 4 },
  { name: "THANKS after being fed", setup: `pantry = 80;`, cue: "THANKS" },
];

let out = `# Aunt Hillary with a real AI\n\nRun on ${new Date().toISOString().slice(0, 10)} by tests/hillary.mjs. Each scene starts from a fresh colony.\n`;
for (const model of models) {
  out += `\n## ${model}\n`;
  for (const sc of scenes) {
    if (quick && !sc.quick) continue;
    await page.fresh();
    await page.evaluate(SHIM);
    const n0 = log.length;
    const r = await page.evaluate(`(async () => {
      ai.provider = "anthropic"; ai.keys.anthropic = ${JSON.stringify(STAND_IN)}; ai.models.anthropic = ${JSON.stringify(model)};
      ${sc.setup}
      paused = false;        // or she is told time is standing still
      const feels = felt();
      const text = await speak(${sc.ask ? JSON.stringify(sc.ask) : "null"}, ${sc.plea ? `plea(${sc.plea})` : sc.cue ? sc.cue : "undefined"});
      const err = text === null ? [...document.querySelectorAll(".msg.err .body")].at(-1)?.textContent : null;
      return { text, err, feels, mind: mind(), ants: ants.length };
    })()`);
    const e = log[n0] || {};
    const retry = log.length - n0 > 1 ? ` (retried: ${log.length - n0} requests)` : "";
    console.log(`${r.text ? "ok  " : "FAIL"} ${model}  ${sc.name}  [${e.status} ${e.stop} in ${e.in} out ${e.out} first ${e.firstText}ms total ${e.ms}ms${e.servedBy && e.servedBy !== model ? " served by " + e.servedBy : ""}]${retry}`);
    if (!r.text) console.log("     " + (r.err || "") + " " + (e.error || ""));
    out += `\n### ${sc.name}\n\n*${r.ants} ants, mind ${r.mind}. ${e.out} output tokens, first words after ${((e.firstText || 0) / 1000).toFixed(1)} s, done in ${((e.ms || 0) / 1000).toFixed(1)} s, stop: ${e.stop}.*\n\n` +
      (r.text ? r.text.split("\n").map(l => "> " + l).join("\n") : `**No answer:** ${r.err || ""} ${e.error || ""}`) + "\n" +
      (r.mind !== "clear" ? `\n<details><summary>What she could feel</summary>\n\n\`\`\`\n${r.feels}\n\`\`\`\n</details>\n` : "");
  }
}
await page.close();
const dest = process.env.HILLARY_OUT || "tests/hillary-transcript.md";
fs.writeFileSync(dest, out);
const bad = log.filter(e => e.status !== 200 || e.stop !== "end_turn");
console.log(`\n${log.length} requests; ${bad.length} not clean; transcript in ${dest}`);
if (page.errors.length) console.log("page errors:\n  " + [...new Set(page.errors)].join("\n  "));
process.exit(bad.length || page.errors.length ? 1 : 0);
