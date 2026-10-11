#!/usr/bin/env bash
# Everything that can be verified without a desktop. Run from the plugin root.
#
#   bash scripts/check.sh            # the portable suite
#   BALANCE_SEEDS=40 bash scripts/check.sh   # a wider campaign sweep
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

QT_BIN=${QT_BIN:-/usr/lib/qt6/bin}
OMARCHY_SHELL=${OMARCHY_SHELL:-/usr/share/omarchy/shell}
failures=0
step() {
    printf '\n\033[1m== %s\033[0m\n' "$1"
    shift
    "$@" || {
        failures=$((failures + 1))
        printf '\033[31m   FAILED\033[0m\n'
    }
}

step "unit tests" node --test tests/test_terrain.cjs tests/test_physics.cjs \
    tests/test_levels.cjs tests/test_profile.cjs tests/test_palette.cjs tests/test_package.cjs \
    tests/test_tactics.cjs tests/test_modes.cjs

step "campaign balance (every level must clear inside its allowance)" \
    node tests/balance.cjs

step "performance budget" node tests/performance.cjs

if [[ -x "$QT_BIN/qmllint" ]]; then
    # The game's own QML imports nothing but Qt, so it is linted strictly.
    step "qmllint (game)" "$QT_BIN/qmllint" \
        GameView.qml Gauge.qml GunButton.qml Header.qml Hud.qml MenuPage.qml ResultCard.qml \
        Notebook.qml IntelPanel.qml BriefingCard.qml OperationsPage.qml DailyPage.qml

    if [[ -x "$QT_BIN/qmltestrunner" ]]; then
        step "QML game flows (offscreen)" env QT_QPA_PLATFORM=offscreen QT_QUICK_BACKEND=software \
            "$QT_BIN/qmltestrunner" -input tests/qml -import . -o -,txt
    fi

    # Panel.qml and BarWidget.qml sit on qs.Ui and qs.Commons, which exist only
    # inside the running shell. Outside it every reference through them is
    # unresolvable by construction, so those categories are off here; they are
    # what the on-desktop checks in docs/development.md cover instead.
    step "qmllint (shell-facing)" "$QT_BIN/qmllint" -I "$OMARCHY_SHELL" \
        --import disable --unqualified disable --unresolved-type disable \
        --inheritance-cycle disable Panel.qml BarWidget.qml
else
    printf '\nskipping qmllint (set QT_BIN to your Qt 6 bin directory)\n'
fi

if command -v shellcheck >/dev/null; then
    step "shellcheck" shellcheck scripts/check.sh
fi

printf '\n'
if ((failures)); then
    printf '\033[31m%d check(s) failed\033[0m\n' "$failures"
    exit 1
fi
printf '\033[32mall checks passed\033[0m\n'
