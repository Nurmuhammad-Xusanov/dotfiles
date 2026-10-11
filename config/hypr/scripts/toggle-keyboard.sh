#!/bin/bash
# Toggle the wvkbd on-screen keyboard.
#
# wvkbd-mobintl picks portrait/landscape layouts at runtime from the output's
# aspect ratio, so only the landscape height needs to be set.
#
# Output is redirected because wvkbd keeps running in the background and would
# otherwise hold the calling shell's stdout open.

if pgrep -x wvkbd-mobintl >/dev/null; then
    pkill -x wvkbd-mobintl
else
    wvkbd-mobintl -L 300 >/dev/null 2>&1 &
fi