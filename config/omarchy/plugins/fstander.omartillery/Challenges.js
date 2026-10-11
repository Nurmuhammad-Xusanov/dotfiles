// Daily challenges are UTC calendar days. The BAT1 prefix pins the rules:
// an unsupported prefix is rejected rather than loading a different map.
//
// Two codes are not days at all. They are not advertised in the game, they
// keep no leaderboard, and each pays a medal the first time it is cleared.
var RACK = { he: 6, cluster: 2, digger: 2, roller: 2 };

// secret: the key Challenges.build switches on. index and seed pick the
// battlefield the secret world is carved out of.
var SECRETS = {
  "BAT1-SCORCHED": { secret: "scorched", index: 9, seed: 0x5c0c4ed, label: "Scorched" },
  "BAT0-GUNDRILL": { secret: "gundrill", index: 0, seed: 0x60d8111, label: "Gun Drill" }
};

function day(date) {
  return (date || new Date()).toISOString().slice(0, 10).replace(/-/g, "");
}
function parse(code) {
  if (typeof code !== "string") return null;
  var text = code.trim().toUpperCase();
  var found = SECRETS[text];
  if (found)
    return {
      code: text,
      day: "",
      seed: found.seed >>> 0,
      index: found.index,
      label: found.label,
      secret: found.secret
    };
  var match = /^BAT1-(\d{8})$/.exec(text);
  if (!match) return null;
  var d = match[1],
    year = Number(d.slice(0, 4)),
    month = Number(d.slice(4, 6)),
    date = Number(d.slice(6));
  if (year < 2026 || year > 2099) return null;
  var stamp = new Date(Date.UTC(year, month - 1, date));
  if (day(stamp) !== d) return null;
  var seed = 2166136261;
  for (var i = 0; i < d.length; i++) seed = Math.imul(seed ^ d.charCodeAt(i), 16777619) >>> 0;
  return {
    code: "BAT1-" + d,
    day: d,
    seed: seed,
    index: 4 + (seed % 6),
    label: d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6),
    secret: ""
  };
}
// A clock outside the supported range (a dead RTC reads 1970) must not leave
// the daily screens holding null, so an unusable date falls back to the first
// supported day instead.
function today(date) {
  return parse("BAT1-" + day(date)) || parse("BAT1-20260101");
}

// Level the ground under the whole field and re-seat everything standing on
// it, so the drill is fought on a parade square rather than a hillside.
function flatten(world, height) {
  var surface = world.terrain.surface;
  for (var i = 0; i < surface.length; i++) surface[i] = height;
  world.terrain.craters.length = 0;
  world.turret.y = height;
  for (var t = 0; t < world.targets.length; t++) {
    world.targets[t].y = height;
    world.targets[t].unstable = false;
  }
}

function scorched(world, levels, physics) {
  world.name = "The Scorched Battery";
  world.brief =
    "Nobody is coming to relieve either side. The ground has been fought over " +
    "until it will not hold a position, the wind has not dropped in days, and " +
    "the magazines are still live. Clear it.";
  // A gale that never lets up, on its own stream so the fight is the same for
  // everyone who enters the code.
  world.wind = -212;
  world.gust = 96;
  world.windLimit = 308;
  world.weather = physics.weather(world.wind, world.gust, world.ground.rng(world.seed ^ 0x5eed));
  // Old craters: the field opens already broken, and the positions have
  // already been shaken loose once.
  var dents = [220, 430, 520, 690, 760, 880, 1010];
  for (var d = 0; d < dents.length; d++)
    world.ground.carve(world.terrain, dents[d], world.ground.heightAt(world.terrain, dents[d]), 52);
  for (var t = 0; t < world.targets.length; t++) {
    world.targets[t].y = world.ground.heightAt(world.terrain, world.targets[t].x);
    world.targets[t].unstable = true;
  }
  // A second magazine, forward of the one this battlefield already carries.
  var first = world.props[0];
  if (first)
    world.props.push({
      kind: "depot",
      x: Math.max(140, first.x - 268),
      y: world.ground.heightAt(world.terrain, Math.max(140, first.x - 268)),
      hp: 1,
      blast: 110
    });
  world.rack = { he: 4, cluster: 2, digger: 2, roller: 1 };
  world.shots = levels.rackTotal(world.rack);
  world.shotsLeft = world.shots;
  return world;
}

function gundrill(world, levels, physics) {
  world.name = "Old Gun Drill";
  world.brief =
    "Before the drag tables, before the windsock, there was this: flat ground, " +
    "still air, and a row of marks at known range. The shell goes where the " +
    "arithmetic says it goes. Nothing here shoots back.";
  flatten(world, 470);
  // Still air and no drag: the school parabola, exactly as it was taught.
  world.wind = 0;
  world.gust = 0;
  world.windLimit = 0;
  world.weather = physics.weather(0, 0, world.ground.rng(1));
  world.dragScale = 0;
  world.enemy = null;
  // A row of marks at increasing range, every one of them an ordinary gun.
  var marks = [430, 610, 790, 970, 1150];
  world.targets.length = 0;
  for (var m = 0; m < marks.length; m++)
    world.targets.push({
      x: marks[m],
      y: 470,
      r: 19,
      hp: 1,
      maxHp: 1,
      role: "gun",
      unstable: false,
      error: 0,
      decay: 1,
      minError: 0,
      fired: 0
    });
  world.spotter = -1;
  world.rack = { he: 12, cluster: 0, digger: 0, roller: 0 };
  world.shots = levels.rackTotal(world.rack);
  world.shotsLeft = world.shots;
  return world;
}

function build(challenge, levels, terrain, physics) {
  var world = levels.build(challenge.index, challenge.seed, terrain, physics.weather);
  if (challenge.secret === "scorched") return scorched(world, levels, physics);
  if (challenge.secret === "gundrill") return gundrill(world, levels, physics);
  world.name = "Daily Battery · " + challenge.label;
  world.brief =
    "One battlefield, one issued rack. Compare your best result with the same challenge code. Assisted scores are recorded separately.";
  world.rack = { he: RACK.he, cluster: RACK.cluster, digger: RACK.digger, roller: RACK.roller };
  world.shots = levels.rackTotal(world.rack);
  world.shotsLeft = world.shots;
  return world;
}
if (typeof module !== "undefined")
  module.exports = {
    RACK: RACK,
    SECRETS: SECRETS,
    parse: parse,
    today: today,
    build: build
  };
