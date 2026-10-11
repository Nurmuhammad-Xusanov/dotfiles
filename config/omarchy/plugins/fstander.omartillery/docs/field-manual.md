# Omartillery field manual

The README is the front door. This is the detail: how shells fly, what the
ground does when you hit it, who is shooting back, and how a run is scored.

## The air

Shells do not fly on a school parabola. Each one feels quadratic drag against
the air it is moving through, and the air itself is moving:

- **Wind is an air velocity, not a sideways push.** A shell going with the wind
  feels less drag; one going against it, more. A high lob spends longer aloft
  and drifts further than a flat shot fired at the same wind.
- **Wind shears with altitude.** It is a little over half strength at ground
  level and a third stronger than the HUD reading at the top of the field, so
  the apex of a lob is where the weather does its work.
- **Wind gusts.** Levels with `GUSTING` on the HUD carry a prevailing wind and a
  gust band. The actual wind wanders inside that band, easing toward a new
  value every few seconds. The windsock and the HUD show the wind *now*; what
  the shell meets thirty seconds from now is a judgement call.

Aim assist (`G`) previews the arc in still air on purpose. Reading the wind is
the game.

## The rack

Each level issues a rack of shells. Pick with `1`–`4` or `Tab`; the chip under
the dials shows what is loaded and how many are left.

| | | |
|---|---|---|
| **HE** | `1` | the workhorse: a 46 px blast, one point of damage |
| **Cluster** | `2` | bursts at the top of its arc into five bomblets that fan out under heavy drag; each is a small blast. Two emplacements close together fall to one shell. Struck before it gets there — into a mesa face, say — it bursts where it is |
| **Digger** | `3` | slim and fast, it cuts through the wind, buries itself and detonates below the surface: two points of damage, which kills an armoured bunker outright, and it digs a deep crater |
| **Roller** | `4` | lands and keeps going, rolling downhill with the terrain and stopping against whatever it meets. Aim it at the slope above a target, not at the target |

## The ground

Every shell that lands digs a crater, and the ground remembers.

Intact positions take fall damage for drops of at least 52 field pixels.
Crack-marked unstable positions take it from 26 pixels, can slide when their
footing is eroded, and can be undermined by a buried digger within 64 pixels.
A gun falling at least 75 pixels loses health too — including yours.

The Wall is an authored terrain puzzle: one fractured mesa position and two
lower bunkers with a magazine between them. Direct fire, collapse, and chain
reactions are three different ways through it.

Magazines are optional explosive scenery; supply trucks count as enemy targets
and carry the same payload. Each depot explodes only once in a chain. Collapse
kills count toward the shell's score and its multi-kill.

## The enemy

From level 4 on, the emplacements shoot back. After each of your shots an
ordinary gun or spotter — marked with a chevron — fires a ranging round at your
gun. Support units act, and charged heavy guns add their shells to the reply.
Every round they fire, the next lands closer. Your gun takes three hits; a
direct hit counts for two.

The bunker that is ranging you is the one to kill. Kill it and the next one
starts ranging from scratch.

The enemy-intent panel numbers positions to match the field and shows their
health and next action:

| Role | Behaviour |
|---|---|
| Gun | Ranges your position after each player shot |
| Spotter | Ranges faster; killing the active spotter hands ranging to another gun |
| Heavy gun | Charges for three enemy turns, then adds a larger shell to the reply |
| Engineer | Repairs one surviving damaged position within 210 pixels each turn; never itself or a wreck. It carries no gun of its own |
| Supply truck | Patrols a short stretch between turns; its ammunition explodes when destroyed |

`SEARCHING`, `ADJUSTING` and `LOCKED ON` describe the current ranging threat.
`SALVO IN 1` is a warning to deal with a heavy gun before its next turn.

## The modes

**Campaign** is the ten-level progression, with stars and unlocks. Each mission
opens with a briefing covering the enemy roles and the issued shells.

**Field Operations** is a four-battle run with branching routes. You start with
3 health, 16 HE, 4 clusters, 3 diggers, 3 rollers and 2 supply. Ridge routes
have one fewer position and stronger prevailing wind; depot routes face a full
force and an explosive magazine. Clears earn 3 supply on a ridge route, or 5
supply and 2 HE on a depot route. Health and unused ammunition carry forward.
Between battles, buy repairs, shells, a reinforced hull (up to 5 health), or an
HE payload upgrade (+8 blast radius for the rest of the operation).

An operation saves its starting loadout before each battle and its supplies
between battles, so leaving to the menu or reopening the shell resumes that
battle from its checkpoint. A destroyed gun or an exhausted rack ends the run.
Completed runs keep their own best total score.

**The Daily Battery** issues one seeded fight per UTC day with 6 HE, 2 clusters,
2 diggers and 2 rollers. Copy its `BAT1-YYYYMMDD` code, or enter someone else's
to play the same terrain, enemy formation, rack and weather seed. Gusts advance
while you aim, so when you fire matters. Personal bests are local, and using
aim assist at any point records an assisted result separately. The last 30
entries are kept. Codes carry a rules version; unsupported versions and invalid
dates are rejected.

Campaign unlocks, stars and the best level score come from campaign clears
alone — a daily rack is twice the size of most campaign racks, and an operation
battle carries ammunition in from the last one. Operations and dailies keep
their own records on their own pages, and every mode feeds the lifetime tallies
and the medals.

## The notebook

The notebook keeps your last three shots: dials, wind at launch, landing range
from the gun, and kills. `[` and `]` select one, `C` recalls its dials, and the
selected shot's trail is the one drawn on the field. Cluster landings show the
average of their impacts; a lost shell reads `LOST`.

The fire-control callouts over the field — `SHORT 120`, `BRACKETED`,
`ON TARGET ×2` — tell you what each shell did, so you can correct without
guessing.

## How it scores

| | |
|---|---|
| Emplacement destroyed | 250 |
| Direct hit | +100 |
| Consecutive shells that kill | ×1.5, ×2, ×2.5 … on the kill; a miss resets it |
| Walking a miss closer than the last | +50 |
| Level cleared | +500 |
| Each shell left in the rack | +150 |

Stars reward economy: three for clearing on 45% of the rack or less, two under
72%, one for clearing at all.

Armoured bunkers take two near misses — or one direct hit, or one digger. A
single blast can take two emplacements if they are close enough, which is the
fastest route to three stars on the crowded levels.

Hover any medal in **Records** to see what it means and how to earn it. Some of
them are not written down anywhere; Records shows those as an unnamed marker
until you find them.

## Range notes

Eight things worth knowing, in no particular order.

- Short is easier to correct than over: the ground rises towards most
  emplacements, so a round that falls short leaves you a visible crater to
  measure from.
- Cluster shells are for pairs. One emplacement is a waste of the pattern.
- Over water and open ground the wind reads honestly; over a mesa it does not,
  because the shear at the apex is doing most of the work.
- Rollers are aimed at the slope above a target, never at the target.
- Craters are permanent. Three shells into the same shoulder will undermine a
  position that no single shell could reach.
- Hold the elevation and walk the power. Changing both at once tells you
  nothing about either.
- Engineers repair; they do not shoot. Killing one first is usually a wasted
  round, and killing one last is sometimes not necessary at all.
- Diggers are for armour. A bunker that shrugs off a near miss does not shrug
  off two points of damage from underneath.
