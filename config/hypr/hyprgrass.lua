-- Touchscreen gestures for the HP OmniBook X Flip 14, via hyprgrass.
--
-- The plugin is loaded from ~/.config/hypr/plugins.lua. This file is only
-- evaluated when hyprgrass actually loaded, so a missing/broken plugin does
-- not break the rest of the Hyprland config.
--
-- Install/update notes: hyprgrass is built from source into
-- ~/.local/lib/hypr/plugins/libhyprgrass.so and pinned to the Hyprland
-- 0.56.2 commit (efb50993780079460b0cbed1363e2166a2de1d9f). Rebuild with
--   hyprgrass-rebuild
-- hyprpm cannot be used on this machine because its state store lives in
-- /var/cache/hyprpm and needs root.

local hg = hl.plugin.hyprgrass

-- plugins.lua already checks this before requiring us, but plugin init order is
-- not guaranteed on a config reload. Without this guard a nil hg makes every
-- hg.gesture below index nil and aborts the whole config load.
if not hg then
    hl.print("hyprgrass plugin not loaded, skipping touchscreen gesture config")
    return
end

-- 1.0 is tuned for touchpads and is far too low for a 14" touchscreen.
hl.config({
    plugin = {
        hyprgrass = {
            sensitivity = 4.0,
            long_press_delay = 400,
            edge_margin = 10,
        },
    },
    gestures = {
        -- Native Hyprland touchscreen workspace swipe, which in 0.56 is an
        -- *edge* swipe (there is no gestures:workspace_swipe_fingers key).
        workspace_swipe_touch = true,
        workspace_swipe_cancel_ratio = 0.15,
    },
})

-- NOTE: hl.dsp.exec_cmd() spawns the process directly, it does not go through
-- a shell, so "~" is NOT expanded. Always use absolute paths below.

-- Workspace switching: 3-finger horizontal swipe.
--
-- These use the hl.dsp.focus dispatcher with the "next"/"prev" workspace
-- selectors rather than action = "workspace". "workspace" drives Hyprland's
-- animated UnifiedWorkspaceSwipe, which needs a continuous, uninterrupted
-- delta stream; browsers that take the touch sequence for themselves (Firefox
-- was the concrete case) break that stream and the swipe never completes.
-- A dispatcher jumps straight to Actions::changeWorkspace and cannot be
-- blocked by whatever the client does with the touches.
--   "next" -> active workspace id + 1   (see getWorkspaceIDNameFromString)
--   "prev" -> previously visited workspace, via the workspace history tracker
hg.bind {
    pattern = { kind = "swipe", fingers = 3, direction = "left" },
    action = hl.dsp.focus({ workspace = "next" }),
}

hg.bind {
    pattern = { kind = "swipe", fingers = 3, direction = "right" },
    action = hl.dsp.focus({ workspace = "prev" }),
}

-- Back: 2-finger swipe up closes the focused window.
hg.gesture {
    pattern = { kind = "swipe", fingers = 2, direction = "up" },
    action = "close",
}

-- Apps menu: 3-finger swipe up.
hg.bind {
    pattern = { kind = "swipe", fingers = 3, direction = "up" },
    action = hl.dsp.exec_cmd("omarchy-menu summon apps"),
}

-- On-screen keyboard: swipe down from the top edge.
-- Gated on tablet mode so it can never pop up over content in laptop mode.
hg.bind {
    pattern = { kind = "edge", origin = "up", direction = "down" },
    action = hl.dsp.exec_cmd("/home/nismo/.config/hypr/scripts/toggle-keyboard-tablet.sh"),
}

-- Fullscreen toggle with a 4-finger tap. kind=tap is only accepted by
-- hyprgrass.bind, not by hyprgrass.gesture.
hg.bind {
    pattern = { kind = "tap", fingers = 4 },
    action = hl.dsp.window.fullscreen({ action = "toggle" }),
}

-- Self-test: 2-finger tap logs a marker so we can confirm hyprgrass is
-- actually receiving touches at all. Check with:
--   journalctl -t hyprgrass-selftest -n 5 --no-pager
-- Remove this block once gestures are confirmed working.
hg.bind {
    pattern = { kind = "tap", fingers = 2 },
    action = hl.dsp.exec_cmd("logger -t hyprgrass-selftest TOUCHED"),
}
