import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import {
  changingMidi,
  smf,
  name,
  tempo,
  meter,
} from "../test/midi-fixtures.js";
import { parseMidi } from "../dist/src/midi-import.js";
const { chromium } = createRequire(resolve(process.argv[2]))("playwright"),
  base = process.argv[3];
const out = resolve(import.meta.dirname, "../output/playwright/midi-20261019");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--mute-audio"],
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    acceptDownloads: true,
  }),
  page = await context.newPage(),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
let accept = true;
page.on("dialog", (d) => (accept ? d.accept() : d.dismiss()));
const project = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("score-lab-project-v1")));
const upload = (bytes = changingMidi(), name = "변화 연습.mid") =>
  page
    .locator("#midi-open")
    .setInputFiles({
      name,
      mimeType: "audio/midi",
      buffer: Buffer.from(bytes),
    });
async function confirm() {
  await page.locator("#midi-confirm").click();
  await page.locator("#midi-dialog").waitFor({ state: "hidden" });
}
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
}
const many = smf([
  ...Array.from({ length: 18 }, (_, i) => [
    [0, name("현악 " + i)],
    [0, [255, 33, 1, i]],
    [0, [0xc0, 40]],
    [0, [0x90, 60 + (i % 10), 80]],
    [480, [0x80, 60 + (i % 10), 0]],
  ]),
  [
    [0, name("타악기")],
    [0, [0x99, 36, 90]],
    [120, [0x89, 36, 0]],
  ],
]);
try {
  await page.goto(base);
  await page.waitForFunction(
    () => document.querySelectorAll(".track-card").length === 10,
  );
  await check(
    "MIDI preview and cancellation preserve existing local composition",
    async () => {
      const before = await project();
      await upload();
      await page.locator("#midi-dialog").waitFor({ state: "visible" });
      assert.equal(await page.locator(".midi-track").count(), 2);
      assert.deepEqual(await project(), before);
      await page.screenshot({ path: resolve(out, "import-preview.png") });
      await page.locator("#midi-dialog").press("Escape");
      assert.deepEqual(await project(), before);
      await upload();
      accept = false;
      await page.locator("#midi-confirm").click();
      assert.deepEqual(await project(), before);
      accept = true;
      await confirm();
    },
  );
  await check(
    "changing tempo, meter and programs survive actual import, map display and reload",
    async () => {
      const p = await project();
      assert.equal(p.version, 2);
      assert.deepEqual(
        p.meterMap.map((e) => e.numerator),
        [4, 3, 6],
      );
      assert.equal(p.tracks[0].instrument, "violin");
      await page.locator("#timing-map").click();
      assert.equal(await page.locator(".timing-event").count(), 6);
      await page.screenshot({ path: resolve(out, "timing-map.png") });
      await page.locator("#timing-dialog").press("Escape");
      await page.reload();
      await page.waitForFunction(
        () => document.querySelectorAll(".track-card").length === 2,
      );
      assert.deepEqual(await project(), p);
      assert.match(
        await page.locator(".bar-label").nth(2).textContent(),
        /6\/8/,
      );
      await page.locator("#score-tab").click();
      assert.equal(await page.locator("#score-pages>svg").count(), 2);
      await page.screenshot({ path: resolve(out, "changing-score.png") });
      await page.locator("#roll-tab").click();
    },
  );
  await check(
    "actual WAV integrates tempo changes and program-switched samples",
    async () => {
      const pending = page.waitForEvent("download");
      await page.locator("[data-export=wav]").click();
      const file = await pending;
      await file.saveAs(resolve(out, "changing.wav"));
      const wav = await readFile(resolve(out, "changing.wav")),
        v = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
      assert.equal(v.getUint32(24, true), 48000);
      assert(Math.abs(v.getUint32(40, true) / 6 / 48000 - 6.700001) < 0.00003);
      assert(wav.subarray(44).some((b) => b !== 0));
    },
  );
  await check(
    "real-time playback and bar-range loop follow changing tempo without constant-BPM drift",
    async () => {
      await page.locator("#loop-start").fill("2");
      await page.locator("#loop-end").fill("3");
      await page.locator("#loop").check();
      await page.locator("#play").click();
      await page.waitForFunction(
        async () => (await import("./src/audio.js")).audioState().playing,
      );
      await page.waitForTimeout(1200);
      const tick = await page.evaluate(
        async () => (await import("./src/audio.js")).audioState().tick,
      );
      assert(tick > 5000 && tick < 5900, `tempo-mapped tick ${tick}`);
      await page.waitForTimeout(2400);
      const loop = await page.evaluate(
        async () => (await import("./src/audio.js")).audioState().tick,
      );
      assert(loop >= 3840 && loop < 5500, `loop tick ${loop}`);
      await page.locator("#stop").click();
      await page.locator("#loop").uncheck();
    },
  );
  await check(
    "edit pitch/ticks/instrument, download MIDI, parse and reimport without timing loss",
    async () => {
      await page.locator(".note").first().click();
      await page.locator("#note-pitch").fill("61");
      await page.locator("#note-pitch").press("Tab");
      await page.locator("#note-start").fill("11");
      await page.locator("#note-start").press("Tab");
      await page.locator("#instrument").selectOption("cello");
      const before = await project(),
        pending = page.waitForEvent("download");
      await page.locator("[data-export=midi]").click();
      const file = await pending;
      await file.saveAs(resolve(out, "edited.mid"));
      const bytes = await readFile(resolve(out, "edited.mid")),
        parsed = parseMidi(bytes);
      assert.equal(parsed.tracks[0].notes[0].pitch, 61);
      assert.equal(parsed.tracks[0].notes[0].start, 11);
      assert.equal(parsed.tracks[0].programs[0].program, 42);
      assert.deepEqual(parsed.tempoMap, before.tempoMap);
      await upload(bytes, "편집본.mid");
      await confirm();
      assert.equal((await project()).tracks[0].instrument, "cello");
      const save = page.waitForEvent("download");
      await page.locator("#save").click();
      await (await save).saveAs(resolve(out, "edited.json"));
      const raw = await readFile(resolve(out, "edited.json"), "utf8");
      assert.deepEqual(JSON.parse(raw), await project());
    },
  );
  await check(
    "19-part MIDI exposes user choice and enforces 15 melodic plus one kit",
    async () => {
      const before = await project();
      await upload(many, "19트랙.mid");
      assert.equal(await page.locator(".midi-track").count(), 19);
      assert.equal(await page.locator(".midi-track input:checked").count(), 0);
      await page.locator("#midi-all").click();
      assert(await page.locator("#midi-confirm").isDisabled());
      await page.locator("#midi-none").click();
      for (let i = 0; i < 16; i++)
        await page.locator(".midi-track input").nth(i).check();
      assert(await page.locator("#midi-confirm").isDisabled());
      assert.deepEqual(await project(), before);
      await page.locator(".midi-track input").nth(15).uncheck();
      await page.locator(".midi-track input").nth(18).check();
      assert(!(await page.locator("#midi-confirm").isDisabled()));
      await page.screenshot({ path: resolve(out, "track-selection.png") });
      await confirm();
      assert.equal((await project()).tracks.length, 16);
    },
  );
  await check(
    "corrupt, oversized, unsupported and empty MIDI never replace the current song",
    async () => {
      const before = await project();
      for (const bytes of [
        new Uint8Array([0, 1]),
        new Uint8Array(2000001),
        smf([[]], { format: 2 }),
        smf([[]]),
      ]) {
        await upload(bytes, "invalid.mid");
        await page.waitForTimeout(100);
        assert.equal(await page.locator("#midi-dialog").isVisible(), false);
        assert.deepEqual(await project(), before);
      }
    },
  );
  await check(
    "stale MIDI read cannot replace a newer MIDI or unblurred edits",
    async () => {
      await page.evaluate(() => {
        const original = File.prototype.arrayBuffer;
        File.prototype.arrayBuffer = function () {
          if (this.name === "slow.mid")
            return original
              .call(this)
              .then(
                (bytes) =>
                  new Promise(
                    (resolve) => (window.__releaseMidi = () => resolve(bytes)),
                  ),
              );
          return original.call(this);
        };
      });
      await page.evaluate(() => (window.__releaseMidi = null));
      await upload(changingMidi(), "slow.mid");
      await page.waitForFunction(
        () => typeof window.__releaseMidi === "function",
      );
      await upload(changingMidi(), "new.mid");
      await confirm();
      const before = await project();
      await page.evaluate(() => window.__releaseMidi());
      await page.waitForTimeout(100);
      assert.deepEqual(await project(), before);
      assert.equal(await page.locator("#midi-dialog").isVisible(), false);
      await page.evaluate(() => (window.__releaseMidi = null));
      await upload(changingMidi(), "slow.mid");
      await page.waitForFunction(
        () => typeof window.__releaseMidi === "function",
      );
      await page.locator("#title").fill("읽는 동안 작성");
      await page.evaluate(() => window.__releaseMidi());
      await page.waitForTimeout(100);
      assert.equal(await page.locator("#title").inputValue(), "읽는 동안 작성");
      assert.equal(await page.locator("#midi-dialog").isVisible(), false);
      await page.locator("#title").press("Tab");
    },
  );
  await check(
    "mobile 390/320 MIDI chooser and time map remain usable without page overflow",
    async () => {
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await upload(many);
        await page.locator("#midi-dialog").waitFor({ state: "visible" });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        assert.equal(
          await page
            .locator("#midi-dialog")
            .evaluate((e) => e.scrollWidth > e.clientWidth),
          false,
        );
        await page.screenshot({
          path: resolve(out, "import-" + width + ".png"),
        });
        await page.locator("#midi-dialog").press("Escape");
      }
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(out, "report.json"),
    JSON.stringify({ status: "PASS", base, checks, errors }, null, 2),
  );
} catch (e) {
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
  await writeFile(
    resolve(out, "failure.json"),
    JSON.stringify({ base, checks, errors, error: e.stack }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
}
