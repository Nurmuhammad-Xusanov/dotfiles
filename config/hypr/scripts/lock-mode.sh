#!/bin/bash
# ~/.config/hypr/scripts/lock-mode.sh [lock|unlock]
# Full input lock: disables touchscreen, touchpad, and all external mice/pointers.

ACTION="${1:-lock}"
STATE_DIR="$HOME/.local/state/omarchy/lock-mode"
MICE_FILE="$STATE_DIR/disabled-mice.txt"

mkdir -p "$STATE_DIR"

if [ "$ACTION" = "lock" ]; then
    # 1. Disable touchscreen
    omarchy-toggle-touchscreen off 2>/dev/null || true

    # 2. Disable touchpad via omarchy tool
    omarchy-toggle-touchpad off 2>/dev/null || true

    # 3. Disable all pointing devices (touchpad, external USB/Bluetooth mice like AJ159 PRO)
    mice=""
    if command -v jq >/dev/null 2>&1; then
        mice=$(hyprctl devices -j 2>/dev/null | jq -r '.mice[]?.name // empty' 2>/dev/null)
    fi

    # Save to file so we can restore all of them on unlock
    if [ -n "$mice" ]; then
        echo "$mice" > "$MICE_FILE"
        while IFS= read -r m; do
            [ -z "$m" ] && continue
            quoted="${m//\"/\\\"}"
            hyprctl eval "hl.device({ name = \"$quoted\", enabled = false })" >/dev/null 2>&1
        done <<< "$mice"
    fi

    # Explicit fallback for known device names on this hardware
    for dev in "syna352b:00-06cb:cfc5-touchpad" "syna352b:00-06cb:cfc5-mouse" "aj159-pro-mouse" "aj159-pro" "elan2514:00-04f3:465a-mouse"; do
        hyprctl eval "hl.device({ name = '$dev', enabled = false })" >/dev/null 2>&1
    done

    # User notification
    omarchy-osd -i lock -m "Locked: Touch, Mice & Keyboard (SUPER+ALT+L to unlock)" 2>/dev/null || true

elif [ "$ACTION" = "unlock" ]; then
    # 1. Re-enable touchscreen
    omarchy-toggle-touchscreen on 2>/dev/null || true

    # 2. Re-enable touchpad
    omarchy-toggle-touchpad on 2>/dev/null || true

    # 3. Re-enable all mice (from current list and saved list)
    current_mice=""
    if command -v jq >/dev/null 2>&1; then
        current_mice=$(hyprctl devices -j 2>/dev/null | jq -r '.mice[]?.name // empty' 2>/dev/null)
    fi
    saved_mice=$(cat "$MICE_FILE" 2>/dev/null || true)
    all_mice=$(printf "%s\n%s\n" "$current_mice" "$saved_mice" | grep -v '^$' | sort -u)

    while IFS= read -r m; do
        [ -z "$m" ] && continue
        quoted="${m//\"/\\\"}"
        hyprctl eval "hl.device({ name = \"$quoted\", enabled = true })" >/dev/null 2>&1
    done <<< "$all_mice"

    # Explicit fallback for known device names on this hardware
    for dev in "syna352b:00-06cb:cfc5-touchpad" "syna352b:00-06cb:cfc5-mouse" "aj159-pro-mouse" "aj159-pro" "elan2514:00-04f3:465a-mouse"; do
        hyprctl eval "hl.device({ name = '$dev', enabled = true })" >/dev/null 2>&1
    done

    rm -f "$MICE_FILE"

    # User notification
    omarchy-osd -i unlock -m "Unlocked: All inputs active" 2>/dev/null || true
fi
