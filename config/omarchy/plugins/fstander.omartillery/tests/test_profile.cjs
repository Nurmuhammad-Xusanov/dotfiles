const test = require("node:test");
const assert = require("node:assert");
const Profile = require("../Profile.js");

function run(overrides) {
  return Object.assign(
    {
      index: 0,
      cleared: true,
      score: 1000,
      stars: 3,
      shotsUsed: 3,
      targets: 3,
      destroyed: 3,
      directHits: 0,
      hasCover: false,
      wind: 0,
      bestMultiKill: 1
    },
    overrides
  );
}

test("a fresh profile has usable defaults", () => {
  const p = Profile.fresh();
  assert.strictEqual(p.settings.sound, true);
  assert.strictEqual(p.settings.assist, false);
  // A new gunner is keyboard-only: mouse aiming is an opt-in, because a
  // pointer resting over the field silently overwrites the elevation.
  assert.strictEqual(p.settings.mouse, false);
  assert.strictEqual(p.settings.effects, true);
  assert.strictEqual(p.settings.tracer, true);
  assert.strictEqual(Profile.clean({ settings: { sound: false } }).settings.mouse, false);
  assert.deepStrictEqual(p.levels, {});
  assert.deepStrictEqual(p.medals, [], "a new gunner has earned nothing yet");
  assert.strictEqual(Profile.unlocked(p, 0), true);
  assert.strictEqual(Profile.unlocked(p, 1), false);
});

test("clean survives anything the config file might contain", () => {
  for (const junk of [null, undefined, 0, "", [], "wat", { levels: "no" }, { settings: 5 }])
    assert.deepStrictEqual(Profile.clean(junk), Profile.fresh());
});

test("clean clamps hostile values back into range", () => {
  const p = Profile.clean({
    settings: { sound: "yes", effects: false, tracer: 1, assist: true, mouse: true },
    levels: {
      0: { score: 1e12, stars: 99 },
      3: { score: -5, stars: 1 },
      99: { score: 1, stars: 1 },
      "../etc": { score: 1, stars: 1 },
      bad: null
    },
    shotsFired: -40,
    targetsDestroyed: 1e15,
    bestRun: 7,
    medals: ["Bullseye", "Bullseye", "BULLSEYE", "Retired Medal", "Not A Medal", 42]
  });
  assert.strictEqual(p.settings.sound, true, "a non-boolean must not flip a setting");
  assert.strictEqual(p.settings.effects, false);
  assert.strictEqual(p.settings.tracer, true, "1 is not a boolean");
  assert.strictEqual(p.settings.assist, true);
  assert.strictEqual(p.settings.mouse, true);
  assert.strictEqual(p.levels["0"].stars, 3);
  assert.ok(p.levels["0"].score <= 1e7);
  assert.strictEqual(p.levels["3"], undefined, "a negative score is not a record");
  assert.strictEqual(p.levels["99"], undefined);
  assert.strictEqual(p.levels["../etc"], undefined);
  assert.strictEqual(p.shotsFired, 0);
  assert.ok(p.targetsDestroyed <= 1e9);
  assert.deepStrictEqual(
    p.medals,
    ["Bullseye"],
    "only medals this build still awards survive, each of them once"
  );
});

test("clean is idempotent and round-trips through JSON", () => {
  const p = Profile.clean({ levels: { 0: { score: 100, stars: 2 } }, medals: ["First Blood"] });
  assert.deepStrictEqual(Profile.clean(p), p);
  assert.deepStrictEqual(Profile.clean(JSON.parse(JSON.stringify(p))), p);
});

test("levels unlock strictly in order", () => {
  const p = Profile.fresh();
  assert.strictEqual(Profile.unlocked(p, 1), false);
  Profile.record(p, run({ index: 0 }));
  assert.strictEqual(Profile.unlocked(p, 1), true);
  assert.strictEqual(Profile.unlocked(p, 2), false);
  // A failed run unlocks nothing.
  Profile.record(p, run({ index: 1, cleared: false, stars: 0 }));
  assert.strictEqual(Profile.unlocked(p, 2), false);
});

test("a record only ever improves", () => {
  const p = Profile.fresh();
  Profile.record(p, run({ index: 0, score: 900, stars: 3 }));
  Profile.record(p, run({ index: 0, score: 100, stars: 1 }));
  assert.strictEqual(p.levels["0"].score, 900);
  assert.strictEqual(p.levels["0"].stars, 3);
});

test("lifetime tallies count failed runs too", () => {
  const p = Profile.fresh();
  Profile.record(p, run({ cleared: false, shotsUsed: 6, destroyed: 1, directHits: 1 }));
  assert.strictEqual(p.shotsFired, 6);
  assert.strictEqual(p.targetsDestroyed, 1);
  assert.strictEqual(p.directHits, 1);
  assert.strictEqual(p.bestRun, 0, "a failed run is not a best run");
});

test("medals are earned once, for the right reasons", () => {
  const p = Profile.fresh();
  let earned = Profile.record(p, run({ index: 0, directHits: 1, bestMultiKill: 2 }));
  assert.ok(earned.includes("First Blood"));
  assert.ok(earned.includes("One Shot One Kill"), "3 shells for 3 targets is one apiece");
  assert.ok(earned.includes("Bullseye"));
  assert.ok(earned.includes("Double Tap"));
  assert.ok(!earned.includes("Wall Breaker"));
  assert.ok(!earned.includes("Storm Gunner"));
  // Nothing is awarded twice.
  earned = Profile.record(p, run({ index: 1, directHits: 1, bestMultiKill: 2 }));
  assert.deepStrictEqual(earned, []);
  assert.ok(Profile.record(p, run({ index: 2, hasCover: true })).includes("Wall Breaker"));
  // Wind is an air speed in px/s now; a storm starts at 150.
  assert.ok(!Profile.record(p, run({ index: 3, wind: -120 })).includes("Storm Gunner"));
  assert.ok(Profile.record(p, run({ index: 4, wind: -160 })).includes("Storm Gunner"));
  for (const m of p.medals) assert.ok(Profile.MEDALS.includes(m));
});

test("the duel medals reward the rack and the return fire", () => {
  const p = Profile.fresh();
  let earned = Profile.record(p, run({ index: 0, hasEnemy: true, gunHits: 0, spotterKills: 1 }));
  assert.ok(earned.includes("Untouchable"), "a clean sheet under fire");
  assert.ok(earned.includes("Spotter Down"));
  earned = Profile.record(
    p,
    run({ index: 1, hasEnemy: true, gunHits: 2, diggerKills: 1, rollerKills: 1 })
  );
  assert.ok(!earned.includes("Untouchable"), "you were hit");
  assert.ok(earned.includes("Deep Strike"));
  assert.ok(earned.includes("Rolling Thunder"));
  assert.strictEqual(p.gunHits, 2, "hits taken are tallied");
  earned = Profile.record(p, run({ index: 2, bestMultiKill: 3 }));
  assert.ok(earned.includes("Scattergun"), "three with one shell");
  // A level with no return fire cannot award a clean sheet under fire.
  const q = Profile.fresh();
  assert.ok(
    !Profile.record(q, run({ index: 0, hasEnemy: false, gunHits: 0 })).includes("Untouchable")
  );
});

test("clearing the campaign earns the closing medals", () => {
  const p = Profile.fresh();
  let earned = [];
  for (let i = 0; i < Profile.LEVEL_COUNT; i++)
    earned = earned.concat(Profile.record(p, run({ index: i })));
  assert.ok(earned.includes("Full Battery"));
  assert.ok(earned.includes("Master Gunner"), "every level at three stars is mastery");
  const progress = Profile.progress(p);
  assert.strictEqual(progress.cleared, Profile.LEVEL_COUNT);
  assert.strictEqual(progress.stars, progress.total);
});

test("accuracy is targets per shell and never divides by zero", () => {
  const p = Profile.fresh();
  assert.strictEqual(Profile.accuracy(p), 0);
  Profile.record(p, run({ shotsUsed: 4, destroyed: 2 }));
  assert.strictEqual(Profile.accuracy(p), 0.5);
});

test("records stay small enough for the config file", () => {
  const p = Profile.fresh();
  for (let i = 0; i < Profile.LEVEL_COUNT; i++)
    Profile.record(p, run({ index: i, score: 9999999 }));
  assert.ok(JSON.stringify(p).length < 2048, "records would crowd shell.json");
});

test("best level score is a campaign score, not a daily or operation one", () => {
  const p = Profile.fresh();
  Profile.record(p, run({ index: 2, mode: "campaign", score: 1200, stars: 2 }));
  assert.strictEqual(p.bestRun, 1200);
  // A daily rack is twice a campaign rack and an operation battle carries
  // ammunition in, so neither may set the per-level record or the best of them.
  Profile.record(p, run({ index: 2, mode: "daily", score: 9000, stars: 3 }));
  Profile.record(p, run({ index: 2, mode: "operation", score: 9000, stars: 3 }));
  assert.strictEqual(p.bestRun, 1200, "another mode inflated the best level score");
  assert.strictEqual(p.levels["2"].score, 1200, "another mode overwrote a level record");
  assert.strictEqual(p.levels["2"].stars, 2);
  // They still count towards lifetime tallies and their own medals.
  assert.strictEqual(p.shotsFired, 9);
  assert.ok(p.medals.includes("Daily Gunner"));
});

test("secret medals are awarded by discovery, and listed as secret", () => {
  // Every secret is a medal this build still awards, and none of them is
  // reachable by ordinary play.
  for (const name of Profile.SECRET_MEDALS) {
    assert.ok(Profile.MEDALS.includes(name), name + " must be a real medal");
    assert.ok(Profile.isSecret(name));
    assert.ok(Profile.medalDescription(name).length > 0, name + " needs a description");
  }
  assert.equal(Profile.isSecret("Bullseye"), false);

  const run = {
    index: 0,
    shotsUsed: 3,
    destroyed: 0,
    directHits: 0,
    gunHits: 0,
    collapses: 0,
    chains: 0,
    cleared: false
  };
  assert.deepEqual(Profile.record(Profile.fresh(), { ...run, sockHit: true }), ["Windsock Down"]);
  assert.deepEqual(Profile.record(Profile.fresh(), { ...run, selfHit: true }), ["Danger Close"]);
  assert.deepEqual(Profile.record(Profile.fresh(), { ...run, ceasefire: true }), ["Ceasefire"]);
  // Each is earned once.
  const p = Profile.fresh();
  Profile.record(p, { ...run, sockHit: true });
  assert.deepEqual(Profile.record(p, { ...run, sockHit: true }), []);
});

test("a secret code pays its own medal and not the daily one", () => {
  const cleared = {
    index: 4,
    mode: "daily",
    shotsUsed: 4,
    targets: 5,
    destroyed: 5,
    directHits: 0,
    gunHits: 0,
    collapses: 0,
    chains: 0,
    cleared: true,
    score: 3000,
    stars: 3
  };
  const drill = Profile.record(Profile.fresh(), { ...cleared, secret: "gundrill" });
  assert.ok(drill.includes("Gun Drill"));
  assert.ok(!drill.includes("Daily Gunner"), "a secret is not a daily");
  const scorched = Profile.record(Profile.fresh(), { ...cleared, secret: "scorched" });
  assert.ok(scorched.includes("Scorched Earth"));
  assert.ok(!scorched.includes("Daily Gunner"));
  // An ordinary daily still pays the daily medal.
  assert.ok(Profile.record(Profile.fresh(), { ...cleared, secret: "" }).includes("Daily Gunner"));
  // And none of them touches the campaign.
  const p = Profile.fresh();
  Profile.record(p, { ...cleared, secret: "scorched" });
  assert.deepEqual(p.levels, {});
  assert.equal(p.bestRun, 0);
});

test("a retired secret medal is dropped from a stored profile like any other", () => {
  const kept = Profile.clean({ medals: ["Ceasefire", "Gun Drill", "Ghost Battery"] });
  assert.deepEqual(kept.medals, ["Ceasefire", "Gun Drill"]);
});
