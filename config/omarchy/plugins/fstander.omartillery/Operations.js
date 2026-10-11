// Four-battle operations. Stored runs are validated by Profile.cleanOperation.
// A battle starts from the saved loadout, so quitting resumes its checkpoint.
var LENGTH = 4;
var ITEMS = [
  { id: "repair", name: "FIELD REPAIR", hint: "Restore 1 gun health", cost: 2 },
  { id: "he", name: "HE CRATE", hint: "Add 4 standard shells", cost: 2 },
  { id: "digger", name: "BREACHING KIT", hint: "Add 2 diggers", cost: 3 },
  { id: "cluster", name: "CLUSTER CRATE", hint: "Add 2 cluster shells", cost: 3 },
  { id: "roller", name: "ROLLER CRATE", hint: "Add 2 rollers", cost: 2 },
  {
    id: "armour",
    name: "REINFORCED HULL",
    hint: "+1 maximum health and repair 1 (max 5)",
    cost: 4
  },
  { id: "payload", name: "HE PAYLOAD", hint: "+8 HE blast radius for this operation", cost: 5 }
];
function copy(value) {
  return JSON.parse(JSON.stringify(value));
}
function fresh(seed) {
  return {
    version: 1,
    seed: seed >>> 0,
    stage: 0,
    state: "route",
    route: "",
    hp: 3,
    maxHp: 3,
    rack: { he: 16, cluster: 4, digger: 3, roller: 3 },
    credits: 2,
    score: 0,
    payload: false
  };
}
function routes(run) {
  var stage = Math.min(3, run.stage);
  return [
    {
      id: "ridge",
      name: ["QUARRY CUT", "COASTAL CLIFFS", "WHITE PASS", "THE HIGH KEEP"][stage],
      hint: "One fewer position. Stronger wind. Earn 3 supply.",
      index: [3, 5, 7, 9][stage],
      biome: ["quarry", "coast", "snow", "quarry"][stage],
      reward: 3
    },
    {
      id: "depot",
      name: ["SUPPLY ROAD", "ENGINEERING WORKS", "FROZEN DEPOT", "ARSENAL APPROACH"][stage],
      hint: "Full enemy force. Explosive magazine. Earn 5 supply + 2 HE.",
      index: [4, 6, 8, 9][stage],
      biome: ["coast", "industry", "snow", "industry"][stage],
      reward: 5
    }
  ];
}
function route(run) {
  var choices = routes(run);
  for (var i = 0; i < choices.length; i++) if (choices[i].id === run.route) return choices[i];
  return null;
}
function choose(run, id) {
  if (!run || run.hp <= 0 || run.state !== "route" || ["ridge", "depot"].indexOf(id) < 0)
    return null;
  var next = copy(run);
  next.route = id;
  next.state = "battle";
  return next;
}
function build(run, levels, terrain, physics) {
  var choice = route(run);
  if (!choice || run.state !== "battle") return null;
  var seed =
    (run.seed ^
      Math.imul(run.stage + 1, 7919) ^
      (run.route === "depot" ? 0x5bd1e995 : 0xa5a5a5a5)) >>>
    0;
  var world = levels.build(choice.index, seed, terrain, physics.weather);
  world.name = choice.name;
  world.battle = run.stage + 1;
  world.biome = choice.biome;
  world.brief =
    "BATTLE " +
    (run.stage + 1) +
    " OF " +
    LENGTH +
    " · " +
    choice.hint +
    " Health and unused shells carry forward.";
  world.turret.hp = run.hp;
  world.turret.maxHp = run.maxHp;
  world.rack = copy(run.rack);
  world.shots = levels.rackTotal(world.rack);
  world.shotsLeft = world.shots;
  world.payload = run.payload;
  if (run.route === "ridge") {
    world.targets.pop();
    world.wind *= 1.2;
    world.weather.base = world.wind;
    world.weather.value = world.wind;
    world.windLimit *= 1.2;
  } else if (!world.props.length) {
    var last = world.targets[world.targets.length - 1],
      prior = world.targets[world.targets.length - 2];
    var x = (last.x + prior.x) / 2;
    world.props.push({
      kind: "depot",
      x: x,
      y: terrain.heightAt(world.terrain, x),
      hp: 1,
      blast: 110
    });
  }
  return world;
}
function finish(run, world, score, cleared) {
  if (!run || run.state !== "battle") return null;
  var next = copy(run),
    choice = route(run);
  next.hp = world.turret.hp;
  next.rack = copy(world.rack);
  next.score += score;
  if (!cleared) {
    next.state = "failed";
    return next;
  }
  next.stage++;
  next.credits += choice.reward;
  if (run.route === "depot") next.rack.he = Math.min(60, next.rack.he + 2);
  next.state = next.stage === LENGTH ? "complete" : "supply";
  next.route = "";
  return next;
}
function available(run, item) {
  if (!run || run.state !== "supply" || run.credits < item.cost) return false;
  if (item.id === "repair") return run.hp < run.maxHp;
  if (item.id === "armour") return run.maxHp < 5;
  if (item.id === "payload") return !run.payload;
  return run.rack[item.id] <= 56;
}
function buy(run, id) {
  var item = null;
  for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) item = ITEMS[i];
  if (!item || !available(run, item)) return null;
  var next = copy(run);
  next.credits -= item.cost;
  if (id === "repair") next.hp++;
  else if (id === "armour") {
    next.maxHp++;
    next.hp++;
  } else if (id === "payload") next.payload = true;
  else next.rack[id] += id === "he" ? 4 : 2;
  return next;
}
function depart(run) {
  if (!run || run.state !== "supply") return null;
  if (run.rack.he + run.rack.cluster + run.rack.digger + run.rack.roller === 0) return null;
  var next = copy(run);
  next.state = "route";
  return next;
}
if (typeof module !== "undefined")
  module.exports = {
    LENGTH: LENGTH,
    ITEMS: ITEMS,
    fresh: fresh,
    routes: routes,
    choose: choose,
    build: build,
    finish: finish,
    available: available,
    buy: buy,
    depart: depart
  };
