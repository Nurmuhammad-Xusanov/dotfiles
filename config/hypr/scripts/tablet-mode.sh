#!/bin/bash
# Tablet-mode detection for the HP OmniBook X Flip 14.
#
# There is no SW_TABLET_MODE exposed to libinput/Hyprland on this machine
# (hyprctl devices only lists "Lid Switch" and "HP WMI hotkeys"), so the
# convertible/tablet flag is read straight from the hp-wmi driver instead:
#
#   /sys/devices/platform/hp-wmi/tablet   -> 0 = laptop, 1 = tablet
#
# In tablet mode the physical keyboard (AT translated set 2) and the touchpad
# are disabled. Folding the device back restores both.
#
# The on-screen keyboard is deliberately NOT started here - it used to be
# popped up on every fold, which was intrusive. It is now opened explicitly by
# the top-edge swipe-down gesture, which is itself gated on tablet mode by
# scripts/toggle-keyboard-tablet.sh (or with SUPER + N).
#
# NOTE: the ELAN touchscreen nodes (elan2514:*-keyboard, *-mouse, *-stylus)
# are deliberately left enabled - *-keyboard is the touchscreen's own virtual
# button row and *-mouse is finger input, not the physical keyboard.
#
# Escape hatch if this ever gets stuck: run
#   ~/.config/hypr/scripts/tablet-mode-force-laptop

set -u

# Overridable only so the loop can be tested without physically folding the
# laptop: OMARCHY_TABLET_FLAG=/tmp/fake-tablet ~/.config/hypr/scripts/tablet-mode.sh
TABLET_FLAG="${OMARCHY_TABLET_FLAG:-/sys/devices/platform/hp-wmi/tablet}"
POLL_INTERVAL="${OMARCHY_TABLET_POLL:-2}"

# Built-in laptop keyboard and touchpad (external keyboards are left alone).
PHYSICAL_KEYBOARD="at-translated-set-2-keyboard"
TOUCHPAD="syna352b:00-06cb:cfc5-touchpad"

STATE_FILE="/tmp/omarchy-tablet-mode"

set_devices() {
    local enabled="$1"
    hyprctl eval "hl.device({name='$PHYSICAL_KEYBOARD', enabled=$enabled})" >/dev/null
    hyprctl eval "hl.device({name='$TOUCHPAD', enabled=$enabled})" >/dev/null
    echo "$enabled" >"$STATE_FILE"
}

notify() {
    hyprctl eval "hl.notification.create({text='$1', duration=2500, icon='$2'})" >/dev/null
}

# Seed the state without notifying, so logging in never fires a spurious
# "Laptop mode" notification, but a session that starts folded still gets the
# right keyboard/touchpad state.
last=$(cat "$TABLET_FLAG" 2>/dev/null || echo 0)
set_devices "$([ "$last" = "1" ] && echo false || echo true)"

while true; do
    current=$(cat "$TABLET_FLAG" 2>/dev/null || echo "$last")

    if [ "$current" != "$last" ]; then
        if [ "$current" = "1" ]; then
            set_devices false
            notify "Tablet mode: keyboard + touchpad off" "info"
        else
            set_devices true
            notify "Laptop mode: keyboard + touchpad on" "ok"
        fi
        last="$current"
    fi

    sleep "$POLL_INTERVAL"
done