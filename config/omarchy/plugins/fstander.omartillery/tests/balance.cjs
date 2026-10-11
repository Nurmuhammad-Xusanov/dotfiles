// The campaign, played offline. Two gunners play every level through the
// ordinary game surface — pick a shell, pick an angle and a power, fire, read
// where it landed, take the return fire — and never edit the world.
//
//   The ACE never misses the dials. It still cannot see the gust that arrives
//   after it fires, so on windy levels even the ace takes the odd hit; but if
//   the ace cannot clear a level on almost every seed, the level is not
//   beatable and the campaign is wrong.
//
//   The CADET has a human hand: a few percent on the power, a degree or two
//   on the angle. The cadet is the difficulty gauge — a level the cadet never
//   wins is too hard, one the cadet never loses is too easy — and the cadet is
//   who the return fire is balanced against.
//
// `BALANCE_SEEDS=40 node tests/balance.cjs` for a wider sweep before a release.
const Levels = require("../Levels.js");
const { play } = require("./play.cjs");

const seedCount = Math.max(1, Number(process.env.BALANCE_SEEDS) || 6);
const seeds = Array.from({ length: seedCount }, (_, i) => (i + 1) * 7919 + 13);
const CADET = { power: 0.045, angle: 1.5 };
// The cadet must win at least this often on every level. Below it, a level is
// a wall; the campaign should feel earned, not lucky.
const CADET_FLOOR = 0.5;
const ACE_FLOOR = 0.9;

let failures = 0;
console.log("level                 ace: worst/allow win%   cadet: win%  gun-hits/game  destroyed");
for (let index = 0; index < Levels.count(); index++) {
  const spec = Levels.spec(index);
  let aceWorst = 0,
    aceWins = 0;
  const cadet = { wins: 0, hits: 0, deaths: 0 };
  for (const seed of seeds) {
    const ace = play(index, seed);
    if (ace.cleared) aceWins++;
    else if (!ace.destroyedGun) {
      // Running out of shells with perfect dials is a design fault, full stop.
      console.log(
        `FAIL level ${index} (${ace.name}) seed ${seed}: the ace ran dry with ${spec.targets - ace.destroyed} left`
      );
      failures++;
    }
    aceWorst = Math.max(aceWorst, ace.shots);
    const c = play(index, seed, { noise: CADET });
    if (c.cleared) cadet.wins++;
    cadet.hits += c.gunHits;
    if (c.destroyedGun) cadet.deaths++;
  }
  const aceRate = aceWins / seeds.length;
  if (aceRate < ACE_FLOOR) {
    console.log(
      `TOO HARD level ${index} (${spec.name}): even the ace wins only ${(aceRate * 100).toFixed(0)}%`
    );
    failures++;
  }
  const winRate = cadet.wins / seeds.length;
  if (winRate < CADET_FLOOR) {
    console.log(
      `TOO HARD level ${index} (${spec.name}): the cadet wins ${(winRate * 100).toFixed(0)}%`
    );
    failures++;
  }
  console.log(
    `${String(index).padStart(2)} ${spec.name.padEnd(16)}   ${String(aceWorst).padStart(3)}/${String(Levels.rackTotal(spec.rack)).padEnd(3)} ${String(Math.round(aceRate * 100)).padStart(3)}%` +
      `       ${String(Math.round(winRate * 100)).padStart(3)}%       ${(cadet.hits / seeds.length).toFixed(1)}` +
      `          ${cadet.deaths ? cadet.deaths + " gun(s) lost" : ""}` +
      (aceWorst <= Levels.rackTotal(spec.rack) * 0.45 ? "  (3★ reachable)" : "")
  );
}
console.log(
  failures
    ? `\n${failures} failure(s)`
    : "\nevery level clears within its rack, and the cadet can win them all"
);
process.exit(failures ? 1 : 0);
