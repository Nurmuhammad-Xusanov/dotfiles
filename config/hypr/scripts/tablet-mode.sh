#!/bin/bash
# Tablet-mode detection for the HP OmniBook X Flip 14 via kernel WMI events.
# HP OmniBook X Flip firmware emits WMI event 36:
#   0x3, 0x4 -> Laptop mode (normal clamshell)
#   0x2      -> Tent / Stand mode
#   0x0, 0x1 -> Tablet mode (folded 360)

PHYSICAL_KEYBOARD="at-translated-set-2-keyboard"
TOUCHPAD="syna352b:00-06cb:cfc5-touchpad"
STATE_FILE="/tmp/omarchy-tablet-mode"

current_mode=""

set_mode() {
    local mode="$1"
    [ "$mode" = "$current_mode" ] && return
    current_mode="$mode"

    if [ "$mode" = "tablet" ]; then
        wtype -k Shift_L >/dev/null 2>&1 || true
        hyprctl eval "hl.device({name='$PHYSICAL_KEYBOARD', enabled=false})" >/dev/null 2>&1
        hyprctl eval "hl.device({name='$TOUCHPAD', enabled=false})" >/dev/null 2>&1
        echo "1" > "$STATE_FILE"
        omarchy-osd -i tablet -m "Tablet mode: Touch & Stylus ready" 2>/dev/null || true
    else
        hyprctl eval "hl.device({name='$PHYSICAL_KEYBOARD', enabled=true})" >/dev/null 2>&1
        hyprctl eval "hl.device({name='$TOUCHPAD', enabled=true})" >/dev/null 2>&1
        wtype -k Shift_L >/dev/null 2>&1 || true
        echo "0" > "$STATE_FILE"
        omarchy-osd -i laptop -m "Laptop mode: Keyboard & Touchpad active" 2>/dev/null || true
    fi
}

# Seed initial state from the latest event in dmesg
initial_val=$(journalctl -k -b -g "Unknown event_id - 36" -n 1 --no-pager 2>/dev/null | grep -o "0x[0-9]" | tail -1)
if [[ "$initial_val" =~ ^0x[012] ]]; then
    set_mode tablet
else
    set_mode laptop
fi

# Stream live kernel events for instant reaction
journalctl -k -b -f -n 0 --no-pager 2>/dev/null | while read -r line; do
    if [[ "$line" =~ "hp_wmi: Unknown event_id - 36 - 0x" ]]; then
        val="${line##*0x}"
        val="${val:0:1}"
        if [[ "$val" =~ [012] ]]; then
            set_mode tablet
        elif [[ "$val" =~ [34] ]]; then
            set_mode laptop
        fi
    fi
done