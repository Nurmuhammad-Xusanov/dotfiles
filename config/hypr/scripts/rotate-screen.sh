#!/bin/bash
# Auto-rotate eDP-1 and the ELAN touchscreen from the accelerometer.
#
# iio-sensor-proxy reports four orientations; Hyprland's transform values are:
#   0 normal, 1 90deg, 2 180deg, 3 270deg
#
#   sensor        transform
#   normal    ->  0
#   left-up   ->  1
#   bottom-up ->  2
#   right-up  ->  3
#
# CALIBRATION: at first boot the sensor reported "bottom-up" while the machine
# was being used the right way up, which means this panel's accelerometer axes
# may be mounted inverted relative to the screen. If the display rotates the
# wrong way when you turn the device, set INVERT=1 below instead of editing the
# case statement.
#
# Hyprland 0.55+ uses the Lua config API, so `hyprctl keyword` is unavailable
# and everything goes through `hyprctl eval` with hl.monitor{} / hl.device{}.
# The current scale is read back inside Lua and re-applied on every rotation:
# hl.monitor() falls back to scale=auto for any field it is not given, which
# silently moved eDP-1 from scale 1 to 1.5 during testing.

set -u

OUTPUT="eDP-1"
INVERT=0

# The touch digitiser is split by Hyprland into a touch, mouse and keyboard
# node. All of them need the transform, otherwise the cursor ends up mirrored
# or offset from the finger. *-keyboard here is the touchscreen's own virtual
# button row, not the physical keyboard.
TOUCH_DEVICE="elan2514:00-04f3:465a"
EXTRA_TOUCH_DEVICES="elan2514:00-04f3:465a-mouse elan2514:00-04f3:465a-stylus elan2514:00-04f3:465a-keyboard"

apply_transform() {
    local t="$1"
    if [ "$INVERT" = "1" ]; then
        t=$(( (4 - t) % 4 ))
    fi

    local extras=""
    for name in $EXTRA_TOUCH_DEVICES; do
        extras="$extras'$name',"
    done

    hyprctl eval "
local t = $t
local output = '$OUTPUT'
local scale, position = nil, 'auto'
for _, m in ipairs(hl.get_monitors()) do
  if m.name == output then
    scale = m.scale
    if m.x and m.y then position = m.x .. 'x' .. m.y end
  end
end
hl.monitor({ output = output, mode = 'preferred', position = position, scale = scale or 1, transform = t })
hl.device({ name = '$TOUCH_DEVICE', transform = t })
for _, name in ipairs({ $extras }) do
  hl.device({ name = name, transform = t })
end
" >/dev/null
}

# Apply the current orientation immediately, so the screen is right on login
# instead of only after the first rotation.
case "$(timeout 5 monitor-sensor --accel 2>/dev/null | sed -n 's/.*orientation: \([a-z-]*\).*/\1/p' | head -1)" in
    normal)         apply_transform 0 ;;
    left-up)        apply_transform 1 ;;
    bottom-up)      apply_transform 2 ;;
    right-up)       apply_transform 3 ;;
esac

monitor-sensor --accel | while read -r line; do
    case "$line" in
        *"orientation changed: normal"*)    apply_transform 0 ;;
        *"orientation changed: left-up"*)   apply_transform 1 ;;
        *"orientation changed: bottom-up"*) apply_transform 2 ;;
        *"orientation changed: right-up"*)  apply_transform 3 ;;
    esac
done