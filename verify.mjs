import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://localhost:5173/";
const OUT = "C:\\Users\\user\\Desktop\\lumiere-residences\\shots";
import { mkdirSync } from "fs";
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
const errors = [];
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("requestfailed", (r) =>
  errors.push("REQFAIL: " + r.url() + " " + (r.failure()?.errorText ?? "")),
);

await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
await sleep(3500); // let the hero tower render + fonts load
await page.screenshot({ path: OUT + "\\01-hero.png" });

// toggle to DAY and capture
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "DAY");
  b?.click();
});
await sleep(3000);
await page.screenshot({ path: OUT + "\\01b-hero-day.png" });
// back to NIGHT
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "NIGHT");
  b?.click();
});
await sleep(1500);

// scroll to residences
await page.evaluate(() => document.querySelector("#residences")?.scrollIntoView({ behavior: "instant" }));
await sleep(2500);
await page.screenshot({ path: OUT + "\\02-residences.png" });

// click the first available "3Dで内覧する" CTA
const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  const target = btns.find((b) => b.textContent && b.textContent.includes("3Dで内覧"));
  if (target) {
    target.click();
    return target.textContent.trim();
  }
  return null;
});
console.log("CLICKED:", clicked);

// wait through fly-in (2.3s) + fade (0.7s) + interior mount + texture load
await sleep(7500);
await page.screenshot({ path: OUT + "\\03-interior.png" });

// switch viewpoint to the bedroom
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "ベッドルーム");
  b?.click();
});
await sleep(3500);
await page.screenshot({ path: OUT + "\\03b-interior-bed.png" });

// expand the floor plan
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "間取りを拡大");
  b?.click();
});
await sleep(1200);
await page.screenshot({ path: OUT + "\\03c-plan-expanded.png" });

// toggle DAY inside the viewer
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "DAY");
  b?.click();
});
await sleep(3500);
await page.screenshot({ path: OUT + "\\03d-interior-day.png" });

// report WebGL + canvas presence
const diag = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  return {
    canvases: document.querySelectorAll("canvas").length,
    firstCanvas: c ? { w: c.width, h: c.height } : null,
    bodyClass: document.body.className,
  };
});

console.log("DIAG:", JSON.stringify(diag));
console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
console.log(
  "NOTABLE_LOGS:",
  logs.filter((l) => /error|warn|fail|three|webgl/i.test(l)).slice(0, 25).join("\n") || "none",
);

await browser.close();
