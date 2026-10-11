# Developing Omartillery

## Layout

The simulation is plain JavaScript with no dependencies on QML or on each
other. QML JavaScript resources cannot `require()` or import one another, so
nothing here does: where a module needs another, the caller passes it in
(`Levels.build(index, seed, Terrain, Physics.weather)`, `world.ground`). That
is also what makes every module directly testable from Node.

| File | What it owns |
|---|---|
| `Terrain.js` | the seeded heightmap, height queries, crater carving |
| `Physics.js` | drag ballistics, the weather, the four shell types, swept collision, detonation, settling, the enemy's firing solution |
| `Levels.js` | the ten level recipes, racks, return-fire profiles, target placement, stars, scoring |
| `Profile.js` | records, unlocks, medals, daily bests, operation-checkpoint validation and legacy-profile migration |
| `Operations.js` | branching four-battle runs, loadout carryover, resupply and upgrades |
| `Challenges.js` | validated UTC daily codes, fixed racks and challenge construction |
| `Palette.js` | the whole game palette, derived from the Omarchy theme |
| `Renderer.js` | all canvas drawing; it never names a colour |
| `GameView.qml` | game state, the turn loop, input, effects, the frame loop, the canvas |
| `Hud.qml` | the dials, rack chips, selected-shell description and key hint |
| `Notebook.qml`, `IntelPanel.qml`, `BriefingCard.qml` | shot history, enemy intentions and mission introductions |
| `OperationsPage.qml`, `DailyPage.qml` | route choices, resupply, daily-code entry and local records |
| `Panel.qml` | the window, theme wiring, records persistence, the IPC surface |
| `preview.png` | the listing image, rendered by `tests/preview` (see Verify) |

`Panel.qml` is the only file that talks to the host. It never opens a file and
never starts a process: records go through the shell's scoped settings API, and
window placement goes through Quickshell's Hyprland binding straight to the
compositor socket.

## The simulation

`Physics.fly` advances a shot through a fixed 120 Hz accumulator, so a flight
is bit-identical whatever the display rate; every test and the offline gunner
rely on that. Each step applies gravity and quadratic drag against the shell's
velocity *relative to the air*, where the air moves at `windAt(world, y)` —
the weather's current value scaled by an altitude shear profile. `weather()`
holds a prevailing wind and a gust band; `blow(w, dt)` wanders it toward a new
seeded target every few seconds. The view and the harness call `blow` in the
same small steps, so a seed replays the same gusts in both.

Shell types live in `Physics.WEAPONS`: drag, blast, damage, muzzle-speed factor,
and the per-type behaviours — `bomblets` split at the apex, `penetration`
detonates below the surface, `rolls` hands the shell to `roll()` on landing.
Add a type by adding an entry and a case in `Renderer.shell`; the rack, the
HUD and the key bindings read `WEAPON_ORDER`.

Return fire is planned by `enemyTurn`, which repairs and moves support units,
advances heavy-gun charge, and returns a queue of replies. Each reply uses
`enemyShot`: `solvePower` bisects over full simulated flights of
a probe shell (owner `"probe"`, which strikes nothing) to find the power that
lands on an aim point, then the emplacement's `error` offsets that aim point and
decays each time it fires. Nothing about the enemy is scripted; it plays the
same physics you do, including the wind it cannot see.

**Bindings on `property var` objects mutated in place never re-evaluate.** The
world is one such object, so `GameView.refresh()` copies what the HUD needs
into plain properties after every change; `tests/test_package.cjs` fails if a
binding reads the world directly.

## Install from a checkout

The checkout is the source of truth; the plugin directory is only an install.

```sh
omarchy plugin add /path/to/omartillery --yes     # first time: clones the checkout
omarchy plugin update fstander.omartillery --yes  # after each commit: pulls it
```

`plugin add` clones the checkout into
`~/.config/omarchy/plugins/fstander.omartillery/` and leaves `origin` pointing
back at it, so `plugin update` is a plain pull. Only committed work is
installed by a pull. To try uncommitted changes, copy the source QML, JavaScript,
manifest and sounds into the installed plugin and rescan with
`omarchy-shell shell rescanPlugins`; changed QML may still require the shell
restart described below.

**The shell caches compiled QML components in memory.** A rescan reliably picks
up new `.js`, but an edited `.qml` may keep running the old component — the
symptom is a change that simply does not appear. `omarchy restart shell` clears
it. That restarts the desktop shell, so close any level in progress first.

## Verify

```sh
bash scripts/check.sh                      # the portable suite
BALANCE_SEEDS=40 bash scripts/check.sh     # a wider campaign sweep
```

The checks cover terrain determinism and bounds, crater carving, drag and
wind ballistics, frame-rate independence, gust determinism, swept collision
against tunnelling, each shell type's behaviour, armour and multi-kills, the
enemy's firing solution and its walking-on, level construction and target
placement, star and score thresholds, records validation against hostile input,
palette contrast on dark, light and monochrome themes, package integrity, and a
performance budget. Tactical tests exercise fall damage, undermining, explosive
chains, repairs, patrol limits and charged salvos. Mode tests check daily-code
reproducibility, assisted records, profile migration and complete operations.
When Qt Quick Test is installed, `tests/qml/tst_game.qml` also runs the actual
GameView through briefings, notebook recall, campaign clears, daily replays,
operation persistence, resupply and keyboard navigation on an offscreen window.
Warnings fail those tests.

`tests/balance.cjs` is the one that matters most. `tests/play.cjs` is a headless
game — the same turn loop the view runs, driven from Node — and `balance.cjs`
plays every level with two gunners through the ordinary game surface, never
editing the world. The **ace** finds the best dials it can and must clear
almost every seed, or the level is not beatable. The **cadet** adds a human
hand's worth of error and must win at least half the time, or the level is a
wall; the cadet is who the return fire is tuned against. Neither is part of
gameplay.

Regenerate the audio with `python3 scripts/generate-sounds.py`. It is seeded, so
a regeneration reproduces the shipped WAVs byte for byte; changing an earlier
cue shifts the noise stream for every cue after it.

Regenerate the marketplace preview — the real UI rendered offscreen, never a
desktop screenshot, because the shell's window opacity lets the desktop bleed
through a live capture:

```sh
QT_QPA_PLATFORM=offscreen QT_QUICK_BACKEND=software \
  qmltestrunner -input tests/preview -import .
```

JavaScript uses two-space indentation; QML and Python use four. Format
JavaScript with `npx prettier@3.9.6 --write "*.js" "tests/*.cjs"` and QML with
`qmlformat --inplace --column-width 120 *.qml`.

## Driving it live

The shell exposes inspection and ordinary input, which is how the on-desktop
checks are done:

```sh
omarchy-shell shell summon fstander.omartillery '{}'
omarchy-shell shell call fstander.omartillery startLevel '{"index":4,"seed":42}'
omarchy-shell shell call fstander.omartillery input 'enter' # accept the briefing
omarchy-shell shell call fstander.omartillery aim '{"angle":52,"power":74}'
omarchy-shell shell call fstander.omartillery weapon 'cluster'
omarchy-shell shell call fstander.omartillery setting '{"key":"mouse","value":false}'
omarchy-shell shell call fstander.omartillery input 'fire'
omarchy-shell shell call fstander.omartillery snapshot ''
omarchy-shell shell call fstander.omartillery diagnostics ''
omarchy-shell shell call fstander.omartillery navigate 'records'
omarchy-shell shell hide fstander.omartillery
```

`startLevel` takes an optional `seed`, which makes a level reproducible — pass
the same seed the offline gunner used to watch a computed solution play out.
`input` accepts `fire`, `enter`, `up`, `down`, `left`, `right`, `1`–`4`,
`cycle`, `pause`, `retry`, `next`, `tracer`, `assist`, `sound`, `notebook`,
`previousShot`, `nextShot`, `recall` and `back`,
optionally suffixed `:up` to release a held key. `weapon` takes a shell type
from `Physics.WEAPON_ORDER`. `snapshot` reports the turn: `status` (`aiming`,
`flying`, `incoming`, `cleared`, `failed`, `destroyed`), the rack, the wind
now and its prevailing value, gun HP, which emplacement is ranging you, the
combo and the current callout.

A pointer over the field aims the gun, so park the cursor
(`hyprctl dispatch movecursor ...`) or turn off mouse control before driving
the dials over IPC.

## New modes and records

Profile version 2 preserves version-1 campaign records, medals and settings.
Daily bests are keyed by challenge code plus `manual` or `assist`, capped at
30 entries. Operation state is a small validated checkpoint, not a serialized
world: its seed, route, stage and starting loadout rebuild the current battle.
The shell's existing 16 KiB record limit and scoped persistence API still apply.

`Panel.qml` warns on the shell's console rather than failing when persistence
is unavailable: `bar widget entry not found` (the game was summoned without the
widget in the bar, so nothing is saved), `invalid gunnery records` (the stored
object did not survive `Profile.clean`, so defaults are used) and `records too
large to save` (the 16 KiB cap). The game stays playable in all three cases.

`GameView.start(index, seed)` is the campaign entry point and respects unlocks.
`startDaily(code)` and `resumeOperation()` build their own worlds and do not
change campaign unlocks. A new battle shows a briefing; `input 'enter'` accepts
it. Retry keeps a daily code or the current operation battle checkpoint.
Operation failure starts a new run; it cannot award a completed battle twice.

Additional IPC calls:

```sh
omarchy-shell shell call fstander.omartillery navigate 'daily'
omarchy-shell shell call fstander.omartillery daily 'BAT1-20260913'
omarchy-shell shell call fstander.omartillery operation 'new'
omarchy-shell shell call fstander.omartillery operation 'route:depot'
omarchy-shell shell call fstander.omartillery operation 'buy:repair'
omarchy-shell shell call fstander.omartillery operation 'depart'
```

The `BAT1` prefix identifies the current challenge rules. Changes to terrain,
role assignment, racks or physics that alter a challenge must introduce a new
code version, or retain the old rules for imported codes. A seed fixes the
weather stream, not the player's timing: replaying exact flights would also
require input timestamps and the physics version.

## Performance

The battlefield is a single `Canvas` with `Canvas.Cooperative`, sized in window
pixels and counter-scaled, so nothing is magnified or resampled. Redraws are
paced by what is actually moving:

- a shell in flight redraws every display frame, so the arc is evenly paced at
  any refresh rate, while the ballistics advance in fixed 120 Hz steps through
  an accumulator, so a flight is bit-identical at 60 Hz and 240 Hz;
- an idle battlefield redraws at 24 Hz for the drifting ridges and the blinking
  slits, and stops entirely if effects are off;
- menus, the pause card and the result card do no work at all.

The simulation costs a few microseconds per frame against an 8.3 ms budget, and
the enemy's firing solution — a bisection over full simulated flights — under
half a millisecond once per turn; see `tests/performance.cjs`. Live paint cost
comes from the `diagnostics` call above.

## The secrets

Five things the game never mentions, each paying a medal that Records hides
behind an unnamed marker until it is earned. They are listed here because a
change that quietly breaks one would otherwise go unnoticed; `tests/` covers
all five.

| Secret | Trigger | Lives in |
|---|---|---|
| Windsock Down | Put a shell through the windsock, which is scenery and scores nothing. It is also the wind instrument: with it down the HUD gauge reads `NO SOCK`, the notebook logs no reading for shots fired after it fell, and `weatherMoving` stops asking for idle repaints. The wind itself is untouched | `Physics.struck`, `Renderer.windsock`, `world.sock`, `Hud.windReadable` |
| Danger Close | Land one of your own shells on your own position. It cannot hurt the gun: only the enemy's shells do that | `Physics.detonate` (`result.selfHit`) |
| Ceasefire | Leave an engineer the last position alive, then hold fire for ten seconds. A flag of truce goes up over the position and the battle clears without spending the shell | `GameView.surrenderOffered` / `surrender` / `parleyFlag`, `Renderer.parleyFlag`, `sounds/parley.wav` |
| Scorched Earth | Clear `BAT1-SCORCHED` | `Challenges.scorched` |
| Gun Drill | Clear `BAT0-GUNDRILL` | `Challenges.gundrill` |

The two codes are entered on the Daily Battery screen. They keep no
leaderboard — `Profile.validDailyKey` rejects them by construction — and they
do not pay the Daily Gunner medal. The trail to them is: the daily screen
nudges once Full Battery is earned, the initials of the eight bullets under
"Range notes" in [the field manual](field-manual.md) spell the first code, and
the medal earned for clearing it names the second.

The surrender does not end the battle straight away: `surrenderHold` runs the
flag up over about a second and holds it for a beat, because the result card
would otherwise cover the very position it is raised over. Nothing can be
fired during that window.

`Challenges.gundrill` sets `world.dragScale = 0`. Anything that rehearses a
shot — aim assist, the enemy's firing solution, the test drivers — must build
its frozen world through `Physics.stillAir`, which is the one place that
carries such properties across. Three separate copies of that object had to be
collapsed into it to make the drill work; do not add a fourth by hand.

## Before a release

The portable suite cannot see a compositor. On an Omarchy desktop, confirm by
hand that:

- the `◥` bar icon summons and hides the window, and `FULL` enters and leaves
  fullscreen;
- a theme switch repaints a paused level (`omarchy theme set <name>`);
- records survive `omarchy restart shell`;
- the window is placed centred on the focused monitor at first open;
- `diagnostics` reports a steady frame rate and a small average paint time
  during a flight;
- on a level with return fire, the reply lands, the gun smokes as it loses HP,
  and `GUN DESTROYED` ends the level.
