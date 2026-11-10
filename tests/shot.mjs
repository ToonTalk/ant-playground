// Take a picture of the Science lab after a small experiment:  node tests/shot.mjs [out.png] [width] [height]
// (For checking the layout by eye; not part of the test suite.)
import fs from "node:fs";
import { openPage } from "./chrome.mjs";

const out = process.argv[2] || "science-lab.png", width = +process.argv[3] || 1280, height = +process.argv[4] || 900;
const page = await openPage({ width, height });
await page.fresh();
await page.evaluate(`(async () => {
  location.hash = "#science"; await new Promise(r => setTimeout(r, 200));
  const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new Event("input", { bubbles: true })); $(id).dispatchEvent(new Event("change", { bubbles: true })); };
  set("s-a", "halfLife"); set("s-b", "distance"); set("s-b-values", "5, 9, 13"); set("s-mins", 3); set("s-reps", 3);
  $("s-guess").value = "Scent that lasts longer will bring more food home, most of all when the food is far away.";
  await labGo();
  labMsg("you", md("The lines go up and then flatten. Is that the answer?"));
  labMsg("guide", md("You've spotted a shape, which is a good start. Look at the three dots at 25 seconds for food 13 ant-lengths away: how far apart are they from each other, compared with how far they are from the dots at 11 seconds?"));
  window.scrollTo(0, 0);
})()`);
const { contentSize } = await page.send("Page.getLayoutMetrics");
const shot = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: contentSize.width, height: contentSize.height, scale: 1 } });
fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log("wrote", out, contentSize.width + "x" + contentSize.height, page.errors.length ? "errors: " + page.errors.join(" | ") : "");
await page.close();
