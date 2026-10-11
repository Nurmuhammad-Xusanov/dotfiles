// Gunnery records. These ride on the plugin's own entry in shell.json, written
// by the host, so everything that comes back in has to be treated as untrusted
// and clamped back into range before the game touches it.
var LEVEL_COUNT = 10;

function fresh() {
  return {
    version: 2,
    settings: { sound: true, effects: true, tracer: true, assist: false, mouse: false },
    levels: {},
    shotsFired: 0,
    targetsDestroyed: 0,
    directHits: 0,
    bestRun: 0,
    gunHits: 0,
    medals: [],
    daily: {},
    operation: null,
    operationsCompleted: 0,
    bestOperation: 0
  };
}

function cleared(p, index) {
  var r = p && p.levels && p.levels[String(index)];
  return !!(r && r.stars > 0);
}

// Levels open in order, with the first always available.
function unlocked(p, index) {
  return index === 0 || cleared(p, index - 1);
}

function progress(p) {
  var stars = 0,
    done = 0;
  for (var i = 0; i < LEVEL_COUNT; i++) {
    var r = p.levels[String(i)];
    if (r && r.stars > 0) {
      stars += r.stars;
      done++;
    }
  }
  return { stars: stars, total: LEVEL_COUNT * 3, cleared: done, levels: LEVEL_COUNT };
}

function accuracy(p) {
  return p.shotsFired > 0 ? p.targetsDestroyed / p.shotsFired : 0;
}

var MEDALS = [
  "First Blood",
  "Bullseye",
  "One Shot One Kill",
  "Wall Breaker",
  "Storm Gunner",
  "Double Tap",
  "Spotter Down",
  "Deep Strike",
  "Rolling Thunder",
  "Scattergun",
  "Untouchable",
  "Full Battery",
  "Master Gunner",
  "Earthmover",
  "Chain Reaction",
  "Operation Complete",
  "Daily Gunner",
  "Windsock Down",
  "Danger Close",
  "Ceasefire",
  "Gun Drill",
  "Scorched Earth"
];

// Medals for things the game never tells you about. Records shows an unearned
// one as an anonymous marker, so a collector knows how many are left to find
// without being told what any of them is.
var SECRET_MEDALS = ["Windsock Down", "Danger Close", "Ceasefire", "Gun Drill", "Scorched Earth"];

function isSecret(name) {
  return SECRET_MEDALS.indexOf(name) >= 0;
}

// Keep the Records tooltips alongside the award rules below.
var MEDAL_DESCRIPTIONS = {
  "First Blood": "Your first victory. Clear any battle to earn your place in the battery.",
  Bullseye: "Destroy an enemy position with a direct shell hit. Right on the emplacement.",
  "One Shot One Kill":
    "Clear a battle using exactly as many shells as there are enemy targets. Make your ammunition count.",
  "Wall Breaker":
    "Clear a battlefield with terrain barriers. Shoot over them or carve a path through.",
  "Storm Gunner":
    "Clear a battle with a prevailing wind of 30 or more on the wind scale, in either direction. Brief gusts alone do not count.",
  "Double Tap":
    "Destroy at least two enemy targets with a single shot. One shell, twice the trouble.",
  "Spotter Down":
    "Destroy the active enemy ranging gun after it has fired at least three times. Silence the gun walking its shells onto you.",
  "Deep Strike": "Destroy an enemy target with a digger shell. Put that buried blast to work.",
  "Rolling Thunder": "Destroy an enemy target with a roller shell. Let the hillside deliver it.",
  Scattergun:
    "Destroy at least two targets with one cluster shell, or at least three with any single shot.",
  Untouchable:
    "Clear a battle where the enemy returns fire without your gun taking any damage. Bring it home unscathed.",
  "Full Battery":
    "Clear all ten campaign levels. Every battlefield, from the range to the final battery.",
  "Master Gunner": "Earn all three stars on every campaign level. A full set of 30 stars.",
  Earthmover:
    "Undermine an enemy position so the fall damages it. The collapse does not have to finish it off.",
  "Chain Reaction":
    "Set off an ammunition depot or supply truck to trigger a secondary explosion. Make their supplies work for you.",
  "Operation Complete":
    "Bring your gun through all four battles of a Field Operation. Health and ammunition must last the journey.",
  "Daily Gunner":
    "Clear a Daily Battery challenge. Replayed codes and aim-assisted clears count too.",
  "Windsock Down":
    "Shoot the windsock off its pole. The wind goes on blowing; you just have nothing left to read it with.",
  "Danger Close":
    "Bring one of your own shells down on your own position. The crew would like a word.",
  Ceasefire:
    "Leave an enemy engineer the last one standing, then hold your fire. They have nothing left to repair, and they know it.",
  "Gun Drill": "Clear the old gun drill. Flat ground, still air, and no excuses.",
  "Scorched Earth":
    "Clear the scorched battery. Nobody was coming to relieve either side. The gunners who held it learned their trade on flat ground, still air and no excuses \u2014 BAT0-GUNDRILL still answers."
};

function medalDescription(name) {
  return MEDAL_DESCRIPTIONS[name] || "";
}

function clean(value) {
  var p = fresh();
  if (!value || typeof value !== "object") return p;
  if (value.settings && typeof value.settings === "object")
    ["sound", "effects", "tracer", "assist", "mouse"].forEach(function (k) {
      if (typeof value.settings[k] === "boolean") p.settings[k] = value.settings[k];
    });
  if (value.levels && typeof value.levels === "object")
    Object.keys(value.levels)
      .filter(function (id) {
        return /^[0-9]$/.test(id);
      })
      .slice(0, LEVEL_COUNT)
      .forEach(function (id) {
        if (!/^[0-9]$/.test(id) || Number(id) >= LEVEL_COUNT) return;
        var r = value.levels[id];
        if (!r || !Number.isFinite(r.score) || r.score < 0 || !Number.isFinite(r.stars)) return;
        p.levels[id] = {
          score: Math.min(1e7, Math.floor(r.score)),
          stars: Math.max(0, Math.min(3, Math.floor(r.stars)))
        };
      });
  [
    "shotsFired",
    "targetsDestroyed",
    "directHits",
    "bestRun",
    "gunHits",
    "operationsCompleted",
    "bestOperation"
  ].forEach(function (k) {
    if (Number.isFinite(value[k]) && value[k] >= 0) p[k] = Math.min(1e9, Math.floor(value[k]));
  });
  if (Array.isArray(value.medals))
    // Keep only medals this build still awards, each of them once.
    p.medals = value.medals.filter(function (m, i, all) {
      return MEDALS.indexOf(m) >= 0 && all.indexOf(m) === i;
    });
  p.operation = cleanOperation(value.operation);
  if (value.daily && typeof value.daily === "object" && !Array.isArray(value.daily)) {
    Object.keys(value.daily)
      .filter(validDailyKey)
      .sort()
      .reverse()
      .slice(0, 30)
      .forEach(function (key) {
        var r = value.daily[key];
        if (
          !r ||
          !Number.isFinite(r.score) ||
          r.score < 0 ||
          !Number.isFinite(r.spares) ||
          !Number.isFinite(r.stars)
        )
          return;
        p.daily[key] = {
          score: Math.min(1e7, Math.floor(r.score)),
          spares: Math.max(0, Math.min(12, Math.floor(r.spares))),
          stars: Math.max(1, Math.min(3, Math.floor(r.stars)))
        };
      });
  }
  return p;
}

function validDailyKey(key) {
  var m = /^BAT1-(\d{4})(\d{2})(\d{2}):(manual|assist)$/.exec(key);
  if (!m || Number(m[1]) < 2026 || Number(m[1]) > 2099) return false;
  var date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.toISOString().slice(0, 10).replace(/-/g, "") === m[1] + m[2] + m[3];
}
function recordDaily(p, code, run, assisted) {
  var key = code + (assisted ? ":assist" : ":manual");
  if (!run.cleared || !validDailyKey(key)) return false;
  var old = p.daily[key];
  if (old && (old.score > run.score || (old.score === run.score && old.spares >= run.spares)))
    return false;
  p.daily[key] = { score: run.score, spares: run.spares, stars: run.stars };
  return true;
}

// Accept only complete checkpoints. Malformed or future-version operations
// are discarded rather than loading a partial rack or an impossible route.
function cleanOperation(v) {
  if (!v || typeof v !== "object" || v.version !== 1) return null;
  function integer(key, low, high) {
    return Number.isInteger(v[key]) && v[key] >= low && v[key] <= high;
  }
  if (
    !integer("seed", 0, 4294967295) ||
    !integer("stage", 0, 4) ||
    !integer("maxHp", 3, 5) ||
    !integer("hp", 0, v.maxHp) ||
    !integer("credits", 0, 100) ||
    !integer("score", 0, 1e8) ||
    typeof v.payload !== "boolean" ||
    ["route", "battle", "supply", "complete", "failed"].indexOf(v.state) < 0
  )
    return null;
  if ((v.stage === 4) !== (v.state === "complete")) return null;
  if (v.state === "supply" && v.stage === 0) return null;
  if (v.state !== "failed" && v.hp === 0) return null;
  if (v.state === "battle" || v.state === "failed") {
    if (["ridge", "depot"].indexOf(v.route) < 0) return null;
  } else if (v.route !== "") return null;
  if (!v.rack || typeof v.rack !== "object") return null;
  var rack = {},
    kinds = ["he", "cluster", "digger", "roller"];
  for (var i = 0; i < kinds.length; i++) {
    var count = v.rack[kinds[i]];
    if (!Number.isInteger(count) || count < 0 || count > 60) return null;
    rack[kinds[i]] = count;
  }
  if (
    (v.state === "battle" || v.state === "route") &&
    kinds.every(function (k) {
      return rack[k] === 0;
    })
  )
    return null;
  return {
    version: 1,
    seed: v.seed,
    stage: v.stage,
    state: v.state,
    route: v.route,
    hp: v.hp,
    maxHp: v.maxHp,
    rack: rack,
    credits: v.credits,
    score: v.score,
    payload: v.payload
  };
}

// Fold one finished level into the records and report any new medals, so the
// game can announce them. `run` is the level summary the game just produced.
function record(p, run) {
  p.shotsFired += run.shotsUsed;
  p.targetsDestroyed += run.destroyed;
  p.directHits += run.directHits;
  p.gunHits += run.gunHits || 0;
  var earned = [];
  function earn(name, condition) {
    if (condition && p.medals.indexOf(name) < 0) {
      p.medals.push(name);
      earned.push(name);
    }
  }
  if (run.cleared) {
    var key = String(run.index),
      old = p.levels[key] || { score: 0, stars: 0 };
    // Campaign levels alone set the per-level record and the best of them.
    // A daily rack is twice the size of most campaign racks, and an operation
    // battle carries ammunition in from the last one, so folding either into
    // "best level score" would compare scores that were never comparable.
    // Operations keep their own total in bestOperation; dailies keep a per-code
    // best in `daily`.
    if (!run.mode || run.mode === "campaign") {
      p.levels[key] = {
        score: Math.max(old.score, run.score),
        stars: Math.max(old.stars, run.stars)
      };
      p.bestRun = Math.max(p.bestRun, run.score);
    }
    earn("First Blood", true);
    earn("One Shot One Kill", run.shotsUsed === run.targets);
    earn("Wall Breaker", run.hasCover);
    earn("Storm Gunner", Math.abs(run.wind) >= 150);
    earn("Untouchable", !!run.hasEnemy && !(run.gunHits > 0));
    earn("Full Battery", progress(p).cleared >= LEVEL_COUNT);
    earn("Master Gunner", progress(p).stars >= LEVEL_COUNT * 3);
  }
  earn("Earthmover", run.collapses > 0);
  earn("Chain Reaction", run.chains > 0);
  // A secret code is played from the daily screen but is not a daily: it keeps
  // no leaderboard and does not count towards the daily medal.
  earn("Daily Gunner", run.cleared && run.mode === "daily" && !run.secret);
  earn("Windsock Down", !!run.sockHit);
  earn("Danger Close", !!run.selfHit);
  earn("Ceasefire", !!run.ceasefire);
  earn("Gun Drill", run.cleared && run.secret === "gundrill");
  earn("Scorched Earth", run.cleared && run.secret === "scorched");
  earn("Operation Complete", run.operationComplete);
  earn("Bullseye", run.directHits > 0);
  earn("Double Tap", run.bestMultiKill >= 2);
  earn("Spotter Down", run.spotterKills > 0);
  earn("Deep Strike", run.diggerKills > 0);
  earn("Rolling Thunder", run.rollerKills > 0);
  earn("Scattergun", run.clusterMulti > 0 || run.bestMultiKill >= 3);
  return earned;
}

if (typeof module !== "undefined")
  module.exports = {
    LEVEL_COUNT: LEVEL_COUNT,
    MEDALS: MEDALS,
    SECRET_MEDALS: SECRET_MEDALS,
    isSecret: isSecret,
    medalDescription: medalDescription,
    fresh: fresh,
    clean: clean,
    cleanOperation: cleanOperation,
    recordDaily: recordDaily,
    record: record,
    progress: progress,
    accuracy: accuracy,
    unlocked: unlocked,
    cleared: cleared
  };
