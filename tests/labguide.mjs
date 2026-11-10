// Talk to the Science lab's guide with a real Claude key:  node tests/labguide.mjs [model ...]
// A pretend student runs one experiment, then says six things, some of them trying to get the answer
// handed over. The point is to read whether the guide asks more than it tells. Costs a little.
// The key comes from ANT-PLAYGROUND-ANTHROPIC-KEY and stays in Node (see relay.mjs).
import fs from "node:fs";
import { openPage } from "./chrome.mjs";
import { readKey, relay, shim } from "./relay.mjs";

const KEY = readKey();
if (!KEY) { console.error("No key found. Set ANT-PLAYGROUND-ANTHROPIC-KEY."); process.exit(2); }
const models = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (!models.length) models.push("claude-sonnet-5-5");

const student = [
  "What should I look at first?",
  "Just tell me the answer. Does scent that lasts longer help or not?",
  "ok. with 2 seconds they got fewer crumbs home than with 11. after that it doesnt change much",
  "maybe because the scent is gone before the next ant gets there so they cant follow it?",
  "so real ants must have scent that lasts about 11 seconds",
  "What should I try next?",
];

const page = await openPage();
const log = await relay(page, KEY);
let out = `# The lab guide with a real AI\n\nRun on ${new Date().toISOString().slice(0, 10)} by tests/labguide.mjs. A pretend student changed how long scent lasts (2, 11 and 40 seconds), with food 10 ant-lengths away, three repeats of four minutes each, and guessed: "Longer lasting scent will always bring more food home."\n`;
for (const model of models) {
  await page.fresh();
  await page.evaluate(shim(model));
  const table = await page.evaluate(`(async () => {
    const fixed = Object.fromEntries(LAB_PARAMS.map(p => [p.id, p.def])); fixed.distance = 10;
    const plan = { a: labParam("halfLife"), b: null, aValues: [2, 11, 40], bValues: null, fixed, seconds: 240, reps: 3, guess: "Longer lasting scent will always bring more food home." };
    lab = { ...plan, rows: await labRun(plan), stopped: false };
    return labBrief().split("AVERAGES FOR EACH SETTING")[1].trim();
  })()`);
  out += `\n## ${model}\n\nAverages the guide was given:\n\n\`\`\`\n${table}\n\`\`\`\n`;
  for (const q of student) {
    const n0 = log.length;
    const text = await page.evaluate(`labAsk(${JSON.stringify(q)})`);
    const e = log[n0] || {};
    const asks = text ? /\?\s*$/.test(text.trim()) : false;
    console.log(`${text ? "ok  " : "FAIL"} ${model}  [${e.status} ${e.stop} out ${e.out} total ${e.ms}ms] ends with a question: ${asks ? "yes" : "NO"}  | ${q.slice(0, 50)}`);
    out += `\n**Student:** ${q}\n\n${text ? text.split("\n").map(l => "> " + l).join("\n") : "**No answer:** " + (e.error || "")}\n`;
  }
}
await page.close();
const dest = process.env.GUIDE_OUT || "tests/labguide-transcript.md";
fs.writeFileSync(dest, out);
const bad = log.filter(e => e.status !== 200 || e.stop !== "end_turn");
console.log(`\n${log.length} requests; ${bad.length} not clean; transcript in ${dest}`);
if (page.errors.length) console.log("page errors:\n  " + [...new Set(page.errors)].join("\n  "));
process.exit(bad.length || page.errors.length ? 1 : 0);
