#!/bin/bash
# Toggle the wvkbd on-screen keyboard cleanly.

if pgrep -x wvkbd-mobintl >/dev/null; then
    pkill -x wvkbd-mobintl
else
    wvkbd-mobintl -L 300 >/dev/null 2>&1 &
fi