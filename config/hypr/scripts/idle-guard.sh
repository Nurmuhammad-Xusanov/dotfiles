#!/bin/bash
# Run the given command only when the bar's "Stay Awake" toggle is off.
# Omarchy writes that toggle to this state file and the shell idle service
# watches it, so hypridle uses the same source of truth to skip sleep/screen-off.
[[ -f "$HOME/.local/state/omarchy/indicators/stay-awake" ]] && exit 0
exec "$@"
