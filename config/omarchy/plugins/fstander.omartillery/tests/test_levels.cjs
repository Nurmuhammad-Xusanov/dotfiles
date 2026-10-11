const test = require("node:test");
const assert = require("node:assert");
const Terrain = require("../Terrain.js");
const Physics = require("../Physics.js");
const Levels = require("../Levels.js");
const Profile = require("../Profile.js");

const build = (index, seed) => Levels.build(index, seed, Terrain, Physics.weather);

// Shells leave the muzzle, exactly as they do in the game.
const muzzleOf = (w, angle) => {
  const tip = Physics.muzzle(w.turret, angle);
  return [tip.x, tip.y];
};

const seeds = [1, 2, 3, 99, 12345, 777777];

test("the campaign length matches what the records model expects", () => {
  assert.strictEqual(Levels.count(), Profile.LEVEL_COUNT);
});

test("spec clamps an out-of-range index instead of returning undefined", () => {
  assert.strictEqual(Levels.spec(-5), Levels.levels[0]);
  assert.strictEqual(Levels.spec(999), Levels.levels[Levels.count() - 1]);
  assert.strictEqual(Levels.spec(undefined), Levels.levels[0]);
});

test("every level builds a playable world", () => {
  for (let index = 0; index < Levels.count(); index++)
    for (const seed of seeds) {
      const w = build(index, seed);
      const spec = Levels.spec(index);
      assert.strictEqual(w.targets.length, spec.targets, `level ${index} target count`);
      assert.strictEqual(w.shots, Levels.rackTotal(spec.rack));
      assert.strictEqual(w.shotsLeft, w.shots);
      assert.deepStrictEqual(w.rack, spec.rack, "the rack is a copy of the recipe");
      assert.notStrictEqual(
        w.rack,
        spec.rack,
        "the rack must be a copy, or a level would consume the recipe"
      );
      assert.ok(w.rack.he >= 5, `level ${index} does not carry enough HE to bracket with`);
      assert.ok(w.shots > w.targets.length, `level ${index} gives no margin for error`);
      assert.strictEqual(w.turret.hp, Physics.GUN_HP);
      assert.ok(
        w.weather && w.weather.base === w.wind,
        "the weather does not start from the level's wind"
      );
      assert.strictEqual(w.weather.gust, spec.gust);
      for (const t of w.targets) {
        if (spec.enemy) {
          assert.strictEqual(t.error, spec.enemy.error);
          assert.strictEqual(t.fired, 0);
        } else assert.strictEqual(t.error, 0);
      }
      assert.ok(w.turret.y > 0 && w.turret.y < Levels.FIELD_HEIGHT);
      for (const t of w.targets) {
        assert.ok(t.x >= spec.span[0] - 120 && t.x <= spec.span[1] + 120, `target off its span`);
        assert.ok(
          Math.abs(t.y - Terrain.heightAt(w.terrain, t.x)) < 1,
          "a target is not on the ground"
        );
        assert.strictEqual(t.hp, spec.armour || 1);
      }
    }
});

test("targets are never stacked on top of one another", () => {
  for (let index = 0; index < Levels.count(); index++)
    for (const seed of seeds) {
      const w = build(index, seed);
      const xs = w.targets.map((t) => t.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++)
        assert.ok(
          xs[i] - xs[i - 1] >= Levels.MIN_SPACING - 1,
          `level ${index} seed ${seed}: targets ${xs[i - 1]} and ${xs[i]} are too close`
        );
    }
});

test("no target hides in the dead pocket at the foot of a mesa", () => {
  for (let index = 0; index < Levels.count(); index++) {
    const pillars = Levels.spec(index).pillars || [];
    if (!pillars.length) continue;
    for (const seed of seeds)
      for (const t of build(index, seed).targets)
        for (const p of pillars) {
          const offset = Math.abs(t.x - p.x);
          const onTop = offset <= p.width * 0.34;
          const clear = offset >= p.width / 2 + 78;
          assert.ok(
            onTop || clear,
            `level ${index} seed ${seed}: target ${t.x} is in ${p.x}'s shadow`
          );
        }
  }
});

test("the gun stands on a level apron", () => {
  for (const seed of seeds) {
    const w = build(4, seed);
    const under = Terrain.heightAt(w.terrain, Levels.TURRET_X);
    assert.ok(Math.abs(under - w.turret.y) < 1);
    for (const x of [Levels.TURRET_X - 24, Levels.TURRET_X + 24])
      assert.ok(
        Math.abs(Terrain.heightAt(w.terrain, x) - w.turret.y) < 2,
        "the apron is not level"
      );
  }
});

test("a level that asks for wind always gets meaningful wind", () => {
  for (let index = 0; index < Levels.count(); index++) {
    const limit = Levels.spec(index).wind;
    assert.ok(Levels.spec(index).gust >= 0);
    for (const seed of seeds) {
      const wind = build(index, seed).wind;
      if (!limit) assert.strictEqual(wind, 0, `level ${index} should be calm`);
      else {
        assert.ok(
          Math.abs(wind) >= limit * 0.45 - 1e-9,
          `level ${index} wind ${wind} is a whisper`
        );
        assert.ok(Math.abs(wind) <= limit + 1e-9, `level ${index} wind ${wind} exceeds its limit`);
      }
    }
  }
});

test("rebuilding with the same seed gives the same fight", () => {
  const a = build(5, 4242);
  const b = build(5, 4242);
  assert.deepStrictEqual(a.terrain.surface, b.terrain.surface);
  assert.deepStrictEqual(a.targets, b.targets);
  assert.strictEqual(a.wind, b.wind);
  // And the gusts, which have their own seeded stream.
  for (let i = 0; i < 300; i++)
    assert.strictEqual(Physics.blow(a.weather, 1 / 60), Physics.blow(b.weather, 1 / 60));
  const c = build(5, 4243);
  assert.notDeepStrictEqual(a.terrain.surface, c.terrain.surface);
});

test("stars reward economy of ammunition", () => {
  const level = { shots: 10, shotsLeft: 10 };
  assert.strictEqual(Levels.stars({ shots: 10, shotsLeft: 6 }), 3); // 40% of the rack
  assert.strictEqual(Levels.stars({ shots: 10, shotsLeft: 5 }), 2); // 50% is past the 45% mark
  assert.strictEqual(Levels.stars({ shots: 10, shotsLeft: 3 }), 2); // 70%
  assert.strictEqual(Levels.stars({ shots: 10, shotsLeft: 2 }), 1); // 80%
  assert.strictEqual(Levels.stars({ shots: 10, shotsLeft: 0 }), 1); // every shell spent
  assert.strictEqual(Levels.stars(null), 0);
  assert.strictEqual(Levels.stars(level), 3);
});

test("the difficulty dials rise through the campaign", () => {
  // Return fire arrives after the player has learned the dials, and once it
  // does, the enemy only gets sharper.
  const first = Levels.levels.findIndex((l) => l.enemy);
  assert.ok(first >= 3, "return fire arrives before the basics are taught");
  for (let i = first; i < Levels.count(); i++)
    assert.ok(Levels.levels[i].enemy, `level ${i} lost its return fire`);
  for (let i = first + 1; i < Levels.count(); i++)
    assert.ok(
      Levels.levels[i].enemy.error <= Levels.levels[i - 1].enemy.error,
      `level ${i} enemy got wilder`
    );
  // Every shell type is introduced somewhere, and only after HE is familiar.
  for (const kind of ["cluster", "digger", "roller"]) {
    const intro = Levels.levels.findIndex((l) => l.rack[kind]);
    assert.ok(intro >= 3, `${kind} arrives on level ${intro}, before the player can shoot`);
  }
});

test("the spotter is the emplacement that has already got closest", () => {
  const w = build(3, 7);
  const random = Terrain.rng(1);
  const opening = Levels.nextSpotter(w, random);
  assert.ok(opening >= 0 && opening < w.targets.length);
  // Once one has fired it keeps the job, however wild it still is.
  w.targets[opening].fired = 1;
  w.targets[opening].error = 200;
  assert.strictEqual(Levels.nextSpotter(w, random), opening);
  // A second, better spotter takes over.
  const other = (opening + 1) % w.targets.length;
  w.targets[other].fired = 2;
  w.targets[other].error = 90;
  assert.strictEqual(Levels.nextSpotter(w, random), other);
  // Killing it hands the job to the next best, and a dead battery has none.
  w.targets[other].hp = 0;
  assert.strictEqual(Levels.nextSpotter(w, random), opening);
  for (const t of w.targets) t.hp = 0;
  assert.strictEqual(Levels.nextSpotter(w, random), -1);
});

test("a combo pays more for every consecutive kill", () => {
  assert.strictEqual(Levels.comboMultiplier(0), 1);
  assert.strictEqual(Levels.comboMultiplier(1), 1);
  assert.strictEqual(Levels.comboMultiplier(2), 1.5);
  assert.strictEqual(Levels.comboMultiplier(3), 2);
});

test("scoring pays for kills and rewards direct hits", () => {
  assert.strictEqual(Levels.scoreFor(1, 0), Levels.SCORE.kill);
  assert.strictEqual(Levels.scoreFor(1, 1), Levels.SCORE.kill + Levels.SCORE.direct);
  assert.strictEqual(Levels.scoreFor(3, 2), 3 * Levels.SCORE.kill + 2 * Levels.SCORE.direct);
  assert.strictEqual(Levels.scoreFor(0, 0), 0);
});

test("every target is reachable by some ordinary shot", () => {
  // Each emplacement must be killable from the gun with dials a player can set.
  for (let index = 0; index < Levels.count(); index++) {
    const w = build(index, 31337);
    for (const target of w.targets) {
      let best = Infinity;
      for (let angle = 15; angle <= 88; angle += 1.5)
        for (let power = 20; power <= 100; power += 2) {
          const probe = {
            ...w,
            terrain: Terrain.snapshot(w.terrain),
            ground: Terrain,
            targets: w.targets.map((t) => ({ ...t }))
          };
          const shot = Physics.launch(...muzzleOf(w, angle), angle, power);
          let impact = null,
            guard = 0;
          while (!impact && guard++ < 3000) impact = Physics.fly(shot, 1 / 60, probe);
          if (!impact) continue;
          best = Math.min(
            best,
            Math.hypot(impact.x - target.x, impact.y - (target.y - target.r * 0.4))
          );
        }
      assert.ok(
        best <= Physics.BLAST_RADIUS + target.r * 0.6,
        `level ${index}: no shot reaches the target at x=${Math.round(target.x)} (best miss ${best.toFixed(1)})`
      );
    }
  }
});
