// Checks on the built page (index.html), run in headless Chrome:  node tests/run.mjs
// They step the colony by hand, so minutes of colony time take a moment. No AI is called.
import { openPage } from "./chrome.mjs";

const page = await openPage();
const results = [];
async function test(name, fn) {
  try { await page.fresh(); const note = await fn(); results.push({ name, ok: true, note }); console.log(`ok    ${name}${note ? "  (" + note + ")" : ""}`); }
  catch (e) { results.push({ name, ok: false }); console.log(`FAIL  ${name}\n      ${String(e.message || e).split("\n")[0]}`); }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const run = code => page.evaluate(`(async () => { ${code} })()`);
// step the colony `seconds` of its own time, in pieces so a hang would show
const STEP = `const stepFor = s => { for (let i = 0; i < s * 60; i++) step(1 / 60); };`;

await test("the page starts with a working colony and no errors", async () => {
  const s = await run(`return { ants: ants.length, crumbs: crumbs.length, sheets: [atlas, foodImg, spiderImg, anteaterImg].every(i => i.naturalWidth > 0), mind: mind() };`);
  assert(s.ants >= 40 && s.crumbs === 2 && s.sheets && s.mind === "clear", JSON.stringify(s));
  assert(!page.errors.length, "errors: " + page.errors.join(" | "));
});

await test("with steady food the colony grows and stays fed", async () => {
  const s = await run(`${STEP} const n = nestXY(), start = ants.length;
    for (let t = 0; t < 300; t += 20) { if (crumbs.length < 2) addCrumb(n.x + 150, n.y - 40, 140, 0); stepFor(20); }
    return { start, end: ants.length, pantry: pantry, dead: colonyDead, starved: tally.starved };`);
  assert(s.end > s.start + 15 && !s.dead && s.starved === 0, JSON.stringify(s));
  return `${s.start} to ${s.end} ants in 5 minutes`;
});

await test("with no food it starves slowly enough to watch her fade", async () => {
  const s = await run(`${STEP} crumbs = []; let t = 0, empty = null, under30 = null, failing = null, gone = null, dead = null;
    while (t < 1500 && !colonyDead) { stepFor(5); t += 5;
      if (empty === null && pantry <= 0) empty = t;
      if (under30 === null && ants.length < 30) under30 = t;
      if (failing === null && mind() === "failing") failing = t;
      if (gone === null && mind() === "almost gone") gone = t; }
    return { dead: colonyDead, t, empty, under30, failing, gone, starved: tally.starved };`);
  assert(s.dead, "the colony should die with no food: " + JSON.stringify(s));
  const famine = s.t - s.empty, fading = s.t - s.under30;
  assert(famine >= 300 && famine <= 600, `from an empty pantry to the end took ${famine}s; expected 5 to 10 minutes`);
  assert(fading >= 180, `she fades for only ${fading}s; expected at least 3 minutes`);
  assert(s.failing !== null && s.gone !== null && s.gone > s.failing, "she should pass through failing, then almost gone");
  return `famine ${Math.round(famine / 60 * 10) / 10} min, fading for ${Math.round(fading / 60 * 10) / 10} min`;
});

await test("a starving colony recovers when fed", async () => {
  const s = await run(`${STEP} crumbs = []; pantry = 0; stepFor(40); const low = ants.length, starved = tally.starved;
    const n = nestXY(); addCrumb(n.x + 90, n.y, 140, 0); addCrumb(n.x - 90, n.y, 140, 0); stepFor(60);
    return { low, starved, after: ants.length, pantry, dead: colonyDead, starvedAfter: tally.starved };`);
  assert(s.starved > 0 && !s.dead && s.pantry > 5 && s.starvedAfter - s.starved <= 2, JSON.stringify(s));
});

await test("her mind and senses fade with the number of ants", async () => {
  const s = await run(`const at = n => { ants.length = Math.min(ants.length, n); while (ants.length < n) ants.push(makeAnt()); return mind(); };
    const minds = [40, 30, 29, 18, 17, 8, 7, 1].map(at);
    at(40); const whole = felt() === sense();
    at(10); const full = sense(), got = felt();
    return { minds, whole, shorter: got.length < full.length, marks: /[…?]/.test(got), mindLine: /^My mind: failing\\.$/m.test(got), clarity10: clarity() };`);
  assert(s.minds.join() === "clear,clear,a little foggy,a little foggy,failing,failing,almost gone,almost gone", s.minds.join());
  assert(s.whole, "with 40 ants she should sense everything");
  assert(s.shorter && s.marks && s.mindLine, "with 10 ants her senses should have gaps but keep the mind line: " + JSON.stringify(s));
});

await test("rules: scent fades at the chosen rate, can be switched off, and can spread", async () => {
  const s = await run(`${STEP} const total = () => trail.reduce((a, b) => a + b, 0), cells = () => trail.filter(v => v > 0.02).length;
    // fading: one marked square, no ants and no food (or newly hatched ants would lay scent of their own)
    const keep = ants, food = crumbs; ants = []; crumbs = []; trail.fill(0); trail[5 * gw + 5] = 1; rules.halfLife = 11; stepFor(11); const half = trail[5 * gw + 5];
    trail.fill(0); trail[5 * gw + 5] = 1; rules.halfLife = 30; stepFor(11); const slow = trail[5 * gw + 5];
    // spreading
    trail.fill(0); trail[20 * gw + 20] = 4; rules.spread = 0; stepFor(3); const tight = cells();
    trail.fill(0); trail[20 * gw + 20] = 4; rules.spread = 1; stepFor(3); const wide = cells();
    // switched off: carriers leave nothing
    ants = keep; crumbs = food; Object.assign(rules, RULE_DEFAULTS); rules.scent = false; trail.fill(0); stepFor(30); const off = total();
    rules.scent = true; stepFor(30); const on = total();
    return { half, slow, tight, wide, off, on, carrying: ants.filter(a => a.carrying).length };`);
  assert(Math.abs(s.half - 0.5) < 0.03, `after one half-life the scent is ${s.half}, expected 0.5`);
  assert(s.slow > 0.7, `with a 30 s half-life it should fade less: ${s.slow}`);
  assert(s.tight === 1 && s.wide > 5, `spreading: ${s.tight} square without, ${s.wide} with`);
  assert(s.off === 0 && s.on > 5, `scent off left ${s.off}; back on left ${s.on}`);
});

await test("rules: ants find food from farther away when they can smell farther", async () => {
  const s = await run(`${STEP} const tryIt = smell => { crumbs = []; trail.fill(0); rules.scent = false; rules.smell = smell; delivered = 0;
      for (const a of ants) a.carrying = false;
      const n = nestXY(); addCrumb(n.x + 260, n.y - 120, 140, 0); stepFor(90); return delivered; };
    const near = tryIt(0.5), far = tryIt(8); Object.assign(rules, RULE_DEFAULTS); return { near, far };`);
  assert(s.far > s.near * 2 && s.far > 10, JSON.stringify(s));
  return `${s.near} crumbs home at 0.5 ant-lengths, ${s.far} at 8`;
});

await test("a changed rule is told to Aunt Hillary, and her rules say the same", async () => {
  const s = await run(`$("r-scent").click(); const off = sense(), p1 = hillaryPrompt();
    $("r-reset").click(); $("r-smell").value = 6; $("r-smell").dispatchEvent(new Event("input")); $("r-smell").dispatchEvent(new Event("change"));
    const far = sense(), p2 = hillaryPrompt(); $("r-reset").click();
    return { off: /Changed habits:.*no scent at all/.test(off), p1: /switched scent off/.test(p1), far: /smells food from 6 ant-lengths/.test(far), p2: /within about 6 ant-lengths/.test(p2),
      back: !/Changed habits/.test(sense()), event: events.at(-1).text };`);
  assert(s.off && s.p1 && s.far && s.p2 && s.back, JSON.stringify(s));
});

await test("scatter panics ants and wipes the scent; a spider eats three and leaves", async () => {
  const s = await run(`${STEP} const a = ants.find(a => a.carrying) || ants[0];
    const at = (x, y) => trailAt(x, y); const before = at(a.x, a.y);
    scatter(a.x, a.y); const fleeing = ants.filter(b => b.flee > 0).length, after = at(a.x, a.y);
    const n0 = spiderEaten; dropSpider(W * 0.6, H * 0.5); let t = 0; while (spiders.length && t < 120) { stepFor(1); t++; }
    return { before, after, fleeing, eaten: spiderEaten - n0, left: spiders.length, t };`);
  assert(s.after === 0 && s.fleeing > 0, JSON.stringify(s));
  assert(s.eaten === 3 && s.left === 0, `the spider ate ${s.eaten} and ${s.left ? "stayed" : "left"} after ${s.t}s`);
});

await test("the Ants slider hatches ants from the nest and lets them die in place", async () => {
  const s = await run(`${STEP} const sl = $("n-ants"), set = v => { sl.value = v; sl.dispatchEvent(new Event("input")); };
    crumbs = []; pantry = 20;   // no laying, so only the slider changes the count
    set(90); stepFor(8); const up = ants.length, born = tally.born;
    set(30); stepFor(8); const down = ants.length;
    return { up, born, down, bodies: bodies.length, wished: tally.wished };`);
  assert(s.up === 90 && s.born >= 45 && s.down === 30 && s.wished === 60 && s.bodies > 0, JSON.stringify(s));
});

await test("pointers: the pile picture for crumbs; one spider at a time, with a plain arrow while it hunts", async () => {
  const s = await run(`${STEP} const cur = () => world.style.cursor;
    setTool("crumb"); const crumb = cur();
    setTool("spider"); const before = cur();
    dropSpider(W * 0.6, H * 0.5); const during = cur(); dropSpider(W * 0.3, H * 0.3); const count = spiders.length, tip = $("tip").textContent;
    let t = 0; while (spiders.length && t < 120) { stepFor(1); t++; }
    return { crumb: crumb.slice(0, 26), before, during, count, tip, after: cur() };`);
  assert(s.crumb.startsWith('url("data:image/png;base64'), "the crumb pointer should be a picture: " + s.crumb);
  assert(s.before === "none" && s.during === "default" && s.after === "none", `${s.before} / ${s.during} / ${s.after}`);
  assert(s.count === 1 && /One spider at a time/.test(s.tip), `${s.count} spiders; tip: ${s.tip}`);
});

await test("the What she feels tab shows what the AI is told, and asking returns to the conversation", async () => {
  const s = await run(`ai.provider = "claude"; sampleFn = async () => ({ text: "Quite well." });
    $("t-feel").click();
    const labels = [...document.querySelectorAll("#g-sense dt")].map(d => d.textContent);
    const ants = [...document.querySelectorAll("#g-sense dt")].find(d => d.textContent === "Ants")?.nextElementSibling.textContent;
    const shown = { feel: $("g-feel").style.display !== "none", talk: $("g-scroll").style.display !== "none", form: $("g-form").getBoundingClientRect().height > 0 };
    events.push({ t: simTime, text: "Something happened." }); showTab("feel");
    const happenings = document.querySelectorAll("#g-sense dd ul li").length;
    await speak("How are you?");
    return { labels, ants, shown, happenings, backToTalk: $("g-scroll").style.display !== "none" && $("g-feel").style.display === "none", selected: $("t-talk").getAttribute("aria-selected") };`);
  for (const l of ["Ants", "Teams right now", "Hunger", "Scent", "Danger", "My mind"]) assert(s.labels.includes(l), "missing " + l + ": " + s.labels.join(", "));
  assert(/^\d+\. In the last minute/.test(s.ants), "Ants line: " + s.ants);
  assert(s.shown.feel && !s.shown.talk && s.shown.form && s.happenings >= 1, JSON.stringify(s.shown) + " happenings " + s.happenings);
  assert(s.backToTalk && s.selected === "true", "asking should return to the Talk tab");
});

await test("resizing keeps the scent and moves spiders with the ground", async () => {
  await run(`dropSpider(W * 0.5, H * 0.5); window.__before = { W, H, scent: trail.reduce((a, b) => a + b, 0), sx: spiders[0].x / W, sy: spiders[0].y / H }; return 0;`);
  await page.setSize(1700, 1000);
  const s = await run(`await new Promise(r => setTimeout(r, 300)); resize();
    return { before: window.__before, W, H, scent: trail.reduce((a, b) => a + b, 0), sx: spiders[0].x / W, sy: spiders[0].y / H };`);
  await page.setSize(1280, 800);
  assert(s.W > s.before.W, "the colony should have grown: " + JSON.stringify(s));
  assert(s.before.scent > 5 && s.scent > s.before.scent * 0.8, `scent before ${s.before.scent}, after ${s.scent}`);
  assert(Math.abs(s.sx - s.before.sx) < 0.01 && Math.abs(s.sy - s.before.sy) < 0.01, "the spider should keep its place on the ground");
});

await test("on a touch screen a tap drops a crumb, a sideways drag sprinkles, and a scroll does nothing", async () => {
  const s = await run(`const r = world.getBoundingClientRect();
    const ev = (t, x, y) => world.dispatchEvent(new PointerEvent(t, { clientX: r.left + x, clientY: r.top + y, pointerType: "touch", pointerId: 9, bubbles: true }));
    const c0 = crumbs.length;
    ev("pointerdown", 300, 200); ev("pointermove", 301, 204); ev("pointercancel", 301, 230); const scroll = crumbs.length - c0;
    ev("pointerdown", 150, 120); ev("pointerup", 150, 120); const tap = crumbs.length - c0;
    ev("pointerdown", 60, 300); for (let x = 70; x <= 260; x += 10) ev("pointermove", x, 300); ev("pointerup", 260, 300);
    return { scroll, tap, drag: crumbs.length - c0, touchAction: getComputedStyle(world).touchAction };`);
  assert(s.scroll === 0 && s.tap === 1 && s.drag > 5 && s.touchAction === "pan-y", JSON.stringify(s));
});

await test("when hungry she asks for food without saying where, and waits her turn to speak", async () => {
  const s = await run(`${STEP} const cues = []; ai.provider = "claude"; aiWorked = true;
    sampleFn = async msgs => { const c = msgs[0].content; cues.push(c.slice(c.lastIndexOf("Nobody has said"))); return { text: "Please, some food." }; };
    crumbs = []; pantry = 10; checkHunger(); await new Promise(r => setTimeout(r, 50));
    const bubble = $("plea").style.display !== "none" && /some food/.test($("plea").innerText);
    pantry = 0; stepFor(1); pantry = 0; checkHunger(); await new Promise(r => setTimeout(r, 50));
    return { cues, bubble, system: hillaryPrompt() };`);
  assert(s.cues.length === 2 && s.bubble, "expected a plea when hungry and another when starving: " + s.cues.length);
  assert(s.cues.every(c => /Don't say where to put it/.test(c)) && !/scouts can find/.test(s.cues.join()), "pleas should not point to places");
  assert(/Never say where the Anteater should put it/.test(s.system), "her rules should say to keep requests simple");
});

await test("speech comes out in order, sentence by sentence, and a question cuts in", async () => {
  const s = await run(`const said = []; let cancels = 0;
    const fake = { speak: u => { said.push(u.text); }, cancel: () => { cancels++; }, resume() {}, getVoices: () => [], speaking: false, pending: false };
    // the page holds the real engine in a constant, so swap its methods
    speechSynthesis.speak = fake.speak; speechSynthesis.cancel = fake.cancel;
    voice.on = true;
    const t = talker(true); t.feed("First one."); t.feed("First one. Second"); t.feed("First one. Second one! Thi"); t.end("First one. Second one! Third.");
    await new Promise(r => setTimeout(r, 400));
    const inOrder = said.join("|");
    say("An answer.", true); await new Promise(r => setTimeout(r, 400));
    return { inOrder, last: said.at(-1), cancels, talking };`);
  assert(s.inOrder === "First one.|Second one!|Third.", s.inOrder);
  assert(s.last === "An answer." && s.cancels >= 1, JSON.stringify(s));
});

await test("Claude's streamed answer is read correctly, with a retry when extras are refused", async () => {
  const s = await run(`const calls = [];
    const sse = parts => new Response(new ReadableStream({ start(c) { const e = new TextEncoder(); for (const p of parts) c.enqueue(e.encode(p)); c.close(); } }), { status: 200 });
    const ev = o => "event: " + o.type + "\\r\\ndata: " + JSON.stringify(o) + "\\r\\n\\r\\n";
    const good = ev({ type: "message_start" }) + ev({ type: "content_block_delta", delta: { type: "thinking_delta", thinking: "hm" } }) +
      ev({ type: "content_block_delta", delta: { type: "text_delta", text: "Hello, " } }) + ev({ type: "content_block_delta", delta: { type: "text_delta", text: "Anteater." } }) +
      ev({ type: "message_delta", delta: { stop_reason: "end_turn" } });
    const realFetch = window.fetch;
    // 1: the stream arrives in awkward pieces
    window.fetch = async (url, init) => { calls.push(JSON.parse(init.body)); return sse([good.slice(0, 37), good.slice(37, 180), good.slice(180)]); };
    const seen = []; const text = await askClaude("k", "claude-sonnet-5-5", "sys", "hi", t => seen.push(t));
    const first = calls[0];
    // 2: a 400 with the extras, then fine without them
    calls.length = 0;
    window.fetch = async (url, init) => { const b = JSON.parse(init.body); calls.push(b);
      return b.output_config ? new Response(JSON.stringify({ error: { message: "output_config: Extra inputs are not permitted" } }), { status: 400 }) : sse([good]); };
    const retried = await askClaude("k", "claude-sonnet-5-5", "sys", "hi");
    // 3: a refusal
    window.fetch = async () => sse([ev({ type: "message_delta", delta: { stop_reason: "refusal" } })]);
    let refused = null; try { await askClaude("k", "claude-haiku-5-5", "sys", "hi"); } catch (e) { refused = e.code; }
    // 4: a bad key
    window.fetch = async () => new Response(JSON.stringify({ error: { message: "invalid x-api-key" } }), { status: 401 });
    let bad = null; try { await askClaude("k", "claude-sonnet-5-5", "sys", "hi"); } catch (e) { bad = e.code; }
    window.fetch = realFetch;
    return { text, seen, first: { max: first.max_tokens, stream: first.stream, effort: first.output_config?.effort, fallbacks: first.fallbacks }, retried, calls: calls.map(c => !!c.output_config), refused, bad };`);
  assert(s.text === "Hello, Anteater." && s.seen.join("|") === "Hello, |Hello, Anteater.", JSON.stringify(s.seen));
  assert(s.first.max === 8000 && s.first.stream && s.first.effort === "low" && s.first.fallbacks === "default", JSON.stringify(s.first));
  assert(s.retried === "Hello, Anteater." && s.calls.join() === "true,false", "retry: " + s.calls.join());
  assert(s.refused === "refused" && s.bad === "bad_key", `${s.refused} ${s.bad}`);
});

await test("Science lab: runs repeat exactly, differ between settings, and leave the live colony untouched", async () => {
  const s = await run(`const live = () => JSON.stringify({ ants: ants.length, pantry, W, H, simTime, crumbs: crumbs.length, delivered, scent: trail.reduce((a, b) => a + b, 0), rules, born: tally.born });
    const before = live();
    const fixed = Object.fromEntries(LAB_PARAMS.map(p => [p.id, p.def]));
    const plan = { a: labParam("scent"), b: null, aValues: ["off", "on"], bValues: null, fixed, seconds: 180, reps: 2 };
    const t0 = performance.now(); const rows = await labRun(plan); const ms = performance.now() - t0;
    const again = await labRun(plan);
    const mean = v => rows.filter(r => r.scent === v).reduce((a, r) => a + r.home, 0) / 2;
    return { n: rows.length, same: JSON.stringify(rows) === JSON.stringify(again), restored: before === live(), busy: labBusy, off: mean("off"), on: mean("on"),
      repeatsDiffer: rows[0].home !== rows[1].home, msPerColonyMinute: Math.round(ms / (4 * 3)), first: rows[2] };`);
  assert(s.n === 4 && s.same, "the same plan should give the same rows");
  assert(s.restored && !s.busy, "the live colony should be exactly as it was");
  assert(s.on > s.off * 1.3, `scent should help at this distance: ${s.off} crumbs without, ${s.on} with`);
  assert(s.repeatsDiffer, "repeats should differ from each other");
  return `${s.off} crumbs home without scent, ${s.on} with; ${s.msPerColonyMinute} ms per colony-minute`;
});

await test("Science lab: the form runs an experiment and shows a chart, a table and a spreadsheet", async () => {
  const s = await run(`location.hash = "#science"; await new Promise(r => setTimeout(r, 100));
    const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new Event("input", { bubbles: true })); $(id).dispatchEvent(new Event("change", { bubbles: true })); };
    set("s-a", "halfLife"); set("s-a-values", "2, 11, 40"); set("s-b", "distance"); set("s-b-values", "5, 10"); set("s-mins", 2); set("s-reps", 2);
    $("s-guess").value = "Longer-lasting scent will bring more food home";
    const count = $("s-count").textContent;
    // a bad value is explained, and nothing runs
    set("s-a-values", "2, 500"); $("s-run").click(); await new Promise(r => setTimeout(r, 50));
    const problem = $("s-problem").style.display !== "none" ? $("s-problem").textContent : "";
    set("s-a-values", "2, 11, 40");
    await labGo();
    const rowsShown = $("s-table").tBodies[0].rows.length, head = [...$("s-table").tHead.rows[0].cells].map(c => c.textContent);
    const dots = document.querySelectorAll("#s-chart .dot").length, lines = document.querySelectorAll("#s-chart .mean").length, legend = document.querySelector("#s-chart .viz-legend")?.textContent;
    set("s-measure", "antsEnd"); const title = document.querySelector("#s-chart .title").textContent;
    const csv = labTable(",").trim().split("\\r\\n"), brief = labBrief();
    await labDownload();
    location.hash = "#colony"; await new Promise(r => setTimeout(r, 100));
    return { count, problem, rowsShown, head, dots, lines, legend, title, csvRows: csv.length, csvHead: csv[0], csvFirst: csv[1], saveNote: $("s-save-note").textContent, copy: $("s-copy").value.split("\\n")[0],
      brief: brief.slice(0, 900), guideShown: $("s-guide").style.display !== "none", liveOk: W !== LAB_W && ants.length > 0 };`);
  assert(/12 colonies/.test(s.count), "count: " + s.count);
  assert(/between 1 and 120/.test(s.problem), "a bad value should be explained: " + s.problem);
  assert(s.rowsShown === 12 && s.dots === 12 && s.lines === 2 && /Food distance.*5.*10/.test(s.legend), JSON.stringify({ rows: s.rowsShown, dots: s.dots, lines: s.lines, legend: s.legend }));
  assert(s.head.includes("Scent half-life (s)") && s.head.includes("Crumbs brought home") && s.title === "Ants at the end", s.head.join(" | "));
  assert(s.csvRows === 13 && /^Run,Scent half-life \(s\),Scent,/.test(s.csvHead) && /Minutes run/.test(s.csvHead) && /^1,2,on,0,2,40,5,2,300,1,1,1,2,/.test(s.csvFirst), s.csvHead + " / " + s.csvFirst);
  assert(/Saved as ant-playground-experiment.csv/.test(s.saveNote) && /^Run\t/.test(s.copy), s.saveNote);
  assert(/Changed: Scent half-life/.test(s.brief) && /Longer-lasting scent/.test(s.brief) && s.guideShown && s.liveOk, JSON.stringify({ guide: s.guideShown, live: s.liveOk }) + " " + s.brief);
});

await test("Science lab: the guide is given the results and told to ask, not tell", async () => {
  const s = await run(`const fixed = Object.fromEntries(LAB_PARAMS.map(p => [p.id, p.def]));
    const plan = { a: labParam("ants"), b: null, aValues: [5, 40], bValues: null, fixed, seconds: 60, reps: 1, guess: "" };
    lab = { ...plan, rows: await labRun(plan), stopped: false };
    let got = null; ai.provider = "claude"; sampleFn = async msgs => { got = msgs[0].content; return { text: "What do you notice about the two rows?" }; };
    const reply = await labAsk("Just tell me the answer");
    return { reply, sys: /Ask before you tell/.test(got) && /Don't state the conclusion/.test(got), table: /EVERY RUN/.test(got) && /Ants at start \\| Repeat/.test(got),
      guess: /they didn't write one/.test(got), said: /The student says: "Just tell me the answer"/.test(got), log: $("s-log").children.length };`);
  assert(s.reply && s.sys && s.table && s.guess && s.said && s.log === 2, JSON.stringify(s));
});

await page.close();
if (page.errors.length) console.log("\npage errors:\n  " + [...new Set(page.errors)].join("\n  "));
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} passed`);
process.exit(failed || page.errors.length ? 1 : 0);
