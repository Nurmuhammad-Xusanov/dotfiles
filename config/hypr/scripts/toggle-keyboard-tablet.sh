#!/bin/bash
# Toggle the on-screen keyboard, but only while the machine is in tablet mode.
#
# Used by the top-edge swipe-down gesture so that brushing the screen in laptop
# mode never pops the keyboard over your content.
#
# The convertible flag is read from the hp-wmi driver:
#   /sys/devices/platform/hp-wmi/tablet  -> 0 = laptop, 1 = tablet
#
# Override for testing without folding the laptop:
#   OMARCHY_TABLET_FLAG=/tmp/fake-tablet ~/.config/hypr/scripts/toggle-keyboard-tablet.sh

set -u

TABLET_FLAG="${OMARCHY_TABLET_FLAG:-/sys/devices/platform/hp-wmi/tablet}"

if [ "$(cat "$TABLET_FLAG" 2>/dev/null || echo 0)" != "1" ]; then
    exit 0
fi

exec /home/nismo/.config/hypr/scripts/toggle-keyboard.sh
