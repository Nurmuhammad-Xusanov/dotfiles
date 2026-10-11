const test = require("node:test");
const assert = require("node:assert");
const Terrain = require("../Terrain.js");

const opts = { seed: 7, roughness: 0.9, hilliness: 0.4 };

test("generation is deterministic for a seed", () => {
  const a = Terrain.generate(1280, 600, opts);
  const b = Terrain.generate(1280, 600, opts);
  assert.deepStrictEqual(a.surface, b.surface);
  const c = Terrain.generate(1280, 600, { ...opts, seed: 8 });
  assert.notDeepStrictEqual(a.surface, c.surface);
});

test("the surface stays inside the playable band", () => {
  for (let seed = 0; seed < 40; seed++)
    for (const hilliness of [0, 0.3, 0.6, 1]) {
      const t = Terrain.generate(1280, 600, { seed, roughness: 1.1, hilliness });
      const low = Math.min(...t.surface);
      const high = Math.max(...t.surface);
      assert.ok(high <= 600 * 0.96 + 1e-6, `seed ${seed} sank below the field`);
      assert.ok(low >= 0, `seed ${seed} rose off the top of the field`);
      // Even the calmest ground must have visible mass under it.
      assert.ok(600 * 0.96 - low >= 60, `seed ${seed}/${hilliness} is a flat line`);
    }
});

test("heightAt interpolates between samples and clamps off the ends", () => {
  const t = Terrain.generate(1280, 600, opts);
  const step = t.step;
  const mid = Terrain.heightAt(t, step * 1.5);
  const lo = Math.min(t.surface[1], t.surface[2]);
  const hi = Math.max(t.surface[1], t.surface[2]);
  assert.ok(mid >= lo && mid <= hi);
  assert.strictEqual(Terrain.heightAt(t, -500), t.surface[0]);
  assert.strictEqual(Terrain.heightAt(t, 1e6), t.surface[t.surface.length - 1]);
});

test("isSolid agrees with the surface", () => {
  const t = Terrain.generate(1280, 600, opts);
  const y = Terrain.heightAt(t, 640);
  assert.ok(Terrain.isSolid(t, 640, y + 1));
  assert.ok(!Terrain.isSolid(t, 640, y - 1));
});

test("carving digs a bowl, never past the bottom of the field", () => {
  const t = Terrain.generate(1280, 600, opts);
  const before = Terrain.heightAt(t, 640);
  const moved = Terrain.carve(t, 640, before, 50);
  assert.ok(moved > 0, "nothing was dug");
  const after = Terrain.heightAt(t, 640);
  assert.ok(after > before, "the ground did not drop");
  // The bowl is deepest at its centre and shallower at the rim.
  assert.ok(after - before > Terrain.heightAt(t, 640 + 45) - before);
  for (let i = 0; i < 60; i++) Terrain.carve(t, 640, Terrain.heightAt(t, 640), 60);
  assert.ok(Math.max(...t.surface) <= t.floor + 1e-6, "dug through the floor");
});

test("carving away from the ground changes nothing", () => {
  const t = Terrain.generate(1280, 600, opts);
  const before = t.surface.slice();
  assert.strictEqual(Terrain.carve(t, 640, 20, 30), 0);
  assert.deepStrictEqual(t.surface, before);
  assert.strictEqual(t.craters.length, 0);
});

test("the crater list is bounded", () => {
  const t = Terrain.generate(1280, 600, opts);
  for (let i = 0; i < 300; i++)
    Terrain.carve(t, 200 + (i % 800), Terrain.heightAt(t, 200 + (i % 800)), 30);
  assert.ok(t.craters.length <= 80);
});

test("a pillar raises a flat-topped mesa", () => {
  const t = Terrain.generate(1280, 600, { ...opts, pillars: [{ x: 700, width: 80, height: 260 }] });
  const top = Terrain.heightAt(t, 700);
  assert.ok(Math.abs(Terrain.heightAt(t, 690) - top) < 1, "the top is not flat");
  assert.ok(Terrain.heightAt(t, 760) > top + 100, "the mesa has no sides");
});

test("snapshot is an independent copy", () => {
  const t = Terrain.generate(1280, 600, opts);
  const copy = Terrain.snapshot(t);
  Terrain.carve(copy, 640, Terrain.heightAt(copy, 640), 50);
  assert.notDeepStrictEqual(copy.surface, t.surface);
});
