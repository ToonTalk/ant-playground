// Talk to Aunt Hillary with a real Claude key, in headless Chrome:  node tests/hillary.mjs [model ...]
// This costs a little money (about a dozen short requests per model).
//
// The key is read from the environment variable ANT-PLAYGROUND-ANTHROPIC-KEY and never enters the
// browser (see relay.mjs).
import fs from "node:fs";
import { openPage } from "./chrome.mjs";
import { readKey, relay, shim } from "./relay.mjs";

const KEY = readKey();
if (!KEY) { console.error("No key found. Set ANT-PLAYGROUND-ANTHROPIC-KEY."); process.exit(2); }
const models = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (!models.length) models.push("claude-sonnet-5-5");
const quick = process.argv.includes("--quick");     // two scenes only, to check a model answers at all

const page = await openPage();
const log = await relay(page, KEY);      // one entry per request: model, status, tokens, timings

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
    await page.evaluate(shim(model));
    const n0 = log.length;
    const r = await page.evaluate(`(async () => {
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
