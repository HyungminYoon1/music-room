import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = createRequire(resolve(process.argv[2]))("playwright"),
  base = process.argv[3] || "http://127.0.0.1:56679/";
const out = resolve(import.meta.dirname, "../output/playwright/music-20261019");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--mute-audio"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  acceptDownloads: true,
});
const page = await context.newPage(),
  errors = [],
  checks = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/\.(wav|mp3)$/.test(r.url())) requests.push(r.url());
});
page.on("dialog", (d) => d.accept());
const project = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("score-lab-project-v1")));
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
}
async function seed(raw) {
  await page.evaluate(
    (raw) => localStorage.setItem("score-lab-project-v1", raw),
    JSON.stringify(raw),
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".track-card").length > 0,
  );
}
try {
  await page.goto(base);
  await page.waitForFunction(
    () => document.querySelectorAll(".note").length > 0,
  );
  await check(
    "new brand, 10-part original arrangement and no audio download before action",
    async () => {
      assert.match(await page.title(), /MUSIC ROOM/);
      assert.equal((await project()).tracks.length, 10);
      assert.equal(await page.locator("#instrument option").count(), 30);
      assert.equal(requests.length, 0);
      await page.screenshot({ path: resolve(out, "desktop.png") });
    },
  );
  await check(
    "instrument search, family filter, preview and add actual oboe",
    async () => {
      await page.locator("#add-track").click();
      await page.locator("#instrument-search").fill("oboe");
      assert.equal(await page.locator(".instrument-item").count(), 1);
      await page
        .getByRole("button", { name: "오보에 미리듣기", exact: true })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector("#audition-status")
          .textContent.includes("미리듣기"),
      );
      assert(requests.some((u) => /oboe-/.test(u)));
      await page
        .getByRole("button", { name: "오보에 트랙 추가", exact: true })
        .click();
      assert.equal((await project()).tracks.at(-1).instrument, "oboe");
      assert.equal((await project()).tracks.length, 11);
      await page.locator("#browse-instruments").click();
      await page.getByRole("button", { name: "목관", exact: true }).click();
      assert.equal(await page.locator(".instrument-item").count(), 5);
      await page.screenshot({ path: resolve(out, "instrument-library.png") });
      await page.locator("#instrument-dialog").press("Escape");
    },
  );
  await check(
    "chord insertion, group velocity, quantize and undo/redo",
    async () => {
      await page.locator("#add-chord").click();
      await page.locator("#chord-quality").selectOption("maj7");
      await page.locator("#chord-inversion").selectOption("1");
      await page.locator("#chord-duration").selectOption("960");
      await page.locator("#insert-chord").click();
      assert.deepEqual(
        (await project()).tracks.at(-1).notes.map((n) => n.pitch),
        [64, 67, 71, 72],
      );
      await page.locator("#note-velocity").fill("57");
      await page.locator("#note-velocity").press("Tab");
      assert(
        (await project()).tracks.at(-1).notes.every((n) => n.velocity === 57),
      );
      await page.locator("#quantize").click();
      await page.locator("#length-preset").selectOption("480");
      assert(
        (await project()).tracks.at(-1).notes.every((n) => n.duration === 480),
      );
      await page.locator("#undo").click();
      assert(
        (await project()).tracks.at(-1).notes.every((n) => n.duration === 960),
      );
      await page.locator("#redo").click();
    },
  );
  const fixture = await page.evaluate(async () => {
    const m = await import("./src/model.js");
    const p = m.emptyProject();
    p.title = "Browser fixture";
    p.bars = 4;
    p.tracks[0].instrument = "pluck";
    p.tracks[0].notes = [
      { id: 'quote"[]', pitch: 72, start: 480, duration: 480, velocity: 90 },
      { id: "second", pitch: 76, start: 1440, duration: 480, velocity: 75 },
    ];
    return p;
  });
  await seed(fixture);
  await check(
    "marquee selection, group move, quoted IDs and draw gesture cancellation",
    async () => {
      await page.locator("[data-tool=select]").click();
      const boxes = await page.locator(".note").evaluateAll((es) =>
        es.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }),
      );
      const left = Math.min(...boxes.map((r) => r.x)) - 10,
        right = Math.max(...boxes.map((r) => r.x + r.width)) + 10,
        top = Math.min(...boxes.map((r) => r.y)) - 9,
        bottom = Math.max(...boxes.map((r) => r.y + r.height)) + 9;
      await page.mouse.move(left, top);
      await page.mouse.down();
      await page.mouse.move(right, bottom, { steps: 6 });
      await page.mouse.up();
      assert.equal(await page.locator(".note.selected").count(), 2);
      await page.locator("#grid").focus();
      await page.keyboard.press("ArrowRight");
      assert.deepEqual(
        (await project()).tracks[0].notes.map((n) => n.start),
        [720, 1680],
      );
      const first = await page.locator(".note").first().boundingBox();
      await page.mouse.move(first.x + 10, first.y + 7);
      await page.mouse.down();
      await page.mouse.move(first.x + 50, first.y + 7, { steps: 5 });
      await page.keyboard.press("Escape");
      await page.mouse.up();
      assert.deepEqual(
        (await project()).tracks[0].notes.map((n) => n.start),
        [720, 1680],
      );
      await page.locator("[data-tool=draw]").click();
      const r = await page.locator("#roll-scroll").boundingBox(),
        before = await project();
      await page.mouse.move(r.x + 400, r.y + 90);
      await page.mouse.down();
      await page.mouse.move(r.x + 470, r.y + 90, { steps: 5 });
      await page.keyboard.press("Escape");
      await page.mouse.up();
      assert.deepEqual(await project(), before);
    },
  );
  await check(
    "draw length, velocity drag, erase and keyboard shortcuts",
    async () => {
      const r = await page.locator("#roll-scroll").boundingBox(),
        before = (await project()).tracks[0].notes.length;
      await page.mouse.move(r.x + 400, r.y + 90);
      await page.mouse.down();
      await page.mouse.move(r.x + 472, r.y + 90, { steps: 6 });
      await page.mouse.up();
      assert.equal((await project()).tracks[0].notes.length, before + 1);
      const bar = page.locator(".velocity-bar").last();
      await bar.scrollIntoViewIfNeeded();
      const b = await bar.boundingBox();
      await page.mouse.move(b.x + 3, b.y + 5);
      await page.mouse.down();
      await page.mouse.move(b.x + 3, b.y - 10, { steps: 4 });
      await page.mouse.up();
      assert((await project()).tracks[0].notes.at(-1).velocity > 88);
      await page.locator("#grid").focus();
      await page.keyboard.press("Control+a");
      assert.equal(await page.locator(".note.selected").count(), 3);
      await page.keyboard.press("Control+d");
      assert.equal((await project()).tracks[0].notes.length, 6);
      await page.locator("#undo").click();
      assert.equal((await project()).tracks[0].notes.length, 3);
      await page.locator("[data-tool=erase]").click();
      await page
        .locator(".note")
        .last()
        .click({ position: { x: 8, y: 6 } });
      assert.equal((await project()).tracks[0].notes.length, 2);
      await page.locator("#undo").click();
      assert.equal((await project()).tracks[0].notes.length, 3);
    },
  );
  await check(
    "loop transport crosses boundary without restart, stop and invalid range",
    async () => {
      await page.locator("#tempo").fill("240");
      await page.locator("#tempo").press("Tab");
      await page.locator("#loop").check();
      await page.locator("#loop-start").fill("1");
      await page.locator("#loop-end").fill("1");
      await page.locator("#loop-end").press("Tab");
      await page.locator("#metronome").check();
      await page.locator("#play").click();
      await page.waitForFunction(() =>
        document.querySelector("#play").textContent.includes("일시"),
      );
      await page.waitForTimeout(2300);
      assert.match(await page.locator("#play").textContent(), /일시/);
      assert.match(await page.locator("#clock").textContent(), /^01/);
      await page.locator("#stop").click();
      assert.match(await page.locator("#clock").textContent(), /^01 : 1/);
      await page.locator("#loop-start").fill("2");
      await page.locator("#loop-start").press("Tab");
      await page.locator("#play").click();
      await page.waitForFunction(() =>
        document.querySelector("#status").textContent.includes("구간"),
      );
      assert(
        !(await page.evaluate(
          async () => (await import("./src/audio.js")).audioState().playing,
        )),
      );
    },
  );
  await check(
    "velocity keyboard focus survives consecutive edits",
    async () => {
      const before = (await project()).tracks[0].notes[0].velocity;
      await page.locator(".velocity-bar").first().focus();
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("ArrowUp");
      assert.equal((await project()).tracks[0].notes[0].velocity, before + 2);
    },
  );
  await check(
    "stopping a delayed sample load keeps the stopped UI status",
    async () => {
      const ctx = await browser.newContext();
      let release;
      const delayed = new Promise((r) => (release = r));
      let requested;
      const started = new Promise((r) => (requested = r));
      await ctx.route("**/assets/piano/*.mp3", async (route) => {
        requested();
        await delayed;
        await route.continue();
      });
      const q = structuredClone(fixture);
      q.tracks[0].instrument = "piano";
      q.tracks[0].notes = q.tracks[0].notes.slice(0, 1);
      await ctx.addInitScript(
        (q) => localStorage.setItem("score-lab-project-v1", JSON.stringify(q)),
        q,
      );
      const tab = await ctx.newPage();
      try {
        await tab.goto(base);
        await tab.locator("#play").click();
        await started;
        await tab.locator("#stop").click();
        release();
        await tab.waitForTimeout(300);
        assert.equal(await tab.locator("#status").textContent(), "정지");
        assert(
          !(await tab.evaluate(
            async () => (await import("./src/audio.js")).audioState().playing,
          )),
        );
      } finally {
        release();
        await ctx.close();
      }
    },
  );
  await check(
    "16-track UI reserves percussion channel and rejects destructive instrument change",
    async () => {
      const q = structuredClone(fixture);
      q.tracks = Array.from({ length: 15 }, (_, i) => ({
        ...structuredClone(q.tracks[0]),
        id: "t" + i,
        notes: [],
      }));
      await seed(q);
      await page.locator("#add-track").click();
      assert.equal(
        await page
          .locator(".instrument-actions button:last-child:enabled")
          .count(),
        2,
      );
      await page
        .getByRole("button", {
          name: "오케스트라 타악기 트랙 추가",
          exact: true,
        })
        .click();
      assert.equal((await project()).tracks.length, 16);
      assert(await page.locator("#add-track").isDisabled());
      const old = await project();
      await page.locator("#instrument").selectOption("piano");
      assert.deepEqual(await project(), old);
      assert.match(await page.locator("#status").textContent(), /15트랙/);
      assert.equal(await page.locator("#keys .key").count(), 8);
    },
  );
  await check(
    "all 30 sounds render non-silent 48kHz stereo 24-bit WAV with actual Web Audio",
    async () => {
      const result = await page.evaluate(async () => {
        const { CATALOG } = await import("./src/instruments.js"),
          m = await import("./src/model.js"),
          audio = await import("./src/audio.js"),
          out = [];
        for (const [id, info] of Object.entries(CATALOG)) {
          const p = m.emptyProject();
          p.bars = 1;
          p.tempo = 240;
          p.tracks[0].instrument = id;
          p.tracks[0].notes = [
            {
              id: "render",
              pitch: info.percussion
                ? 36
                : Math.max(info.range[0], Math.min(info.range[1], 60)),
              start: 0,
              duration: 960,
              velocity: 96,
            },
          ];
          const b = await audio.wav(p),
            v = new DataView(b);
          let peak = 0;
          for (let i = 44; i < b.byteLength; i += 6) {
            let n =
              v.getUint8(i) |
              (v.getUint8(i + 1) << 8) |
              (v.getUint8(i + 2) << 16);
            if (n & 0x800000) n -= 0x1000000;
            peak = Math.max(peak, Math.abs(n) / 8388608);
          }
          out.push({
            id,
            bytes: b.byteLength,
            peak,
            rate: v.getUint32(24, true),
            bits: v.getUint16(34, true),
          });
        }
        return out;
      });
      assert.equal(result.length, 30);
      for (const sound of result) {
        assert(sound.peak > 0.0001 && sound.peak <= 1, JSON.stringify(sound));
        assert.equal(sound.rate, 48000);
        assert.equal(sound.bits, 24);
      }
      await writeFile(
        resolve(out, "audio-render.json"),
        JSON.stringify(result, null, 2),
      );
    },
  );
  await check(
    "sustained violin sounds beyond original sample and all 180 files decode",
    async () => {
      const result = await page.evaluate(async () => {
        const audio = await import("./src/audio.js"),
          m = await import("./src/model.js");
        const p = m.emptyProject();
        p.bars = 4;
        p.tempo = 120;
        p.tracks[0].instrument = "violin";
        p.tracks[0].notes = [
          { id: "long", pitch: 72, start: 0, duration: 15360, velocity: 100 },
        ];
        const b = await audio.wav(p),
          v = new DataView(b);
        let energy = 0;
        for (let i = 44 + 6 * 48000 * 6; i < 44 + 6 * 48000 * 7; i += 6) {
          let n =
            v.getUint8(i) |
            (v.getUint8(i + 1) << 8) |
            (v.getUint8(i + 2) << 16);
          if (n & 0x800000) n -= 0x1000000;
          energy += (n / 8388608) ** 2;
        }
        const manifest = await (
            await fetch("./assets/orchestra/manifest.json")
          ).json(),
          ctx = new AudioContext();
        let decoded = 0;
        for (const bank of Object.values(manifest.banks))
          for (const s of bank.samples) {
            const buffer = await ctx.decodeAudioData(
              await (await fetch("./assets/orchestra/" + s.file)).arrayBuffer(),
            );
            if (buffer.length <= 0 || buffer.duration <= 0) throw Error(s.file);
            decoded++;
          }
        await ctx.close();
        return { rms: Math.sqrt(energy / 48000), decoded };
      });
      assert(result.rms > 0.001);
      assert.equal(result.decoded, 180);
    },
  );
  await check(
    "orchestral score clefs, percussion and exact MusicXML render",
    async () => {
      const q = await page.evaluate(async () =>
        (await import("./src/templates.js")).templateProject(),
      );
      await seed(q);
      await page.locator("#score-tab").click();
      assert.equal(await page.locator("#score-pages>svg").count(), 10);
      await page.screenshot({ path: resolve(out, "notation.png") });
      const pending = page.waitForEvent("download");
      await page.locator("[data-export=xml]").click();
      const file = await pending;
      await file.saveAs(resolve(out, "orchestra.musicxml"));
      const xml = await readFile(resolve(out, "orchestra.musicxml"), "utf8");
      assert(xml.includes("<sign>C</sign>"));
      assert(xml.includes("<midi-unpitched>37</midi-unpitched>"));
      await page.locator("#roll-tab").click();
    },
  );
  await check(
    "mobile 390/320: no page overflow, instrument dialog and visible mixer",
    async () => {
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.reload();
        await page.waitForFunction(
          () => document.querySelectorAll(".note").length > 0,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page.screenshot({
          path: resolve(out, "mobile-" + width + ".png"),
        });
        await page.locator(".track-settings summary").click();
        await page.locator("#volume").scrollIntoViewIfNeeded();
        assert(await page.locator("#volume").isVisible());
        await page.locator("#browse-instruments").click();
        await page.locator("#instrument-search").fill("호른");
        assert.equal(await page.locator(".instrument-item").count(), 1);
        await page.screenshot({
          path: resolve(out, "mobile-library-" + width + ".png"),
        });
        await page.locator("#instrument-dialog").press("Escape");
        await page.locator("#roll-scroll").scrollIntoViewIfNeeded();
        await page.screenshot({
          path: resolve(out, "mobile-editor-" + width + ".png"),
        });
      }
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(out, "report.json"),
    JSON.stringify(
      { status: "PASS", base, checks, errors, audioRequests: requests.length },
      null,
      2,
    ),
  );
} catch (e) {
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
  await writeFile(
    resolve(out, "failure.json"),
    JSON.stringify({ checks, errors, error: e.stack }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
}
