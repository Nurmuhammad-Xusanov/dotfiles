-- Hyprland plugin loading.
--
-- hyprpm is unusable here: its state store is /var/cache/hyprpm and creating it
-- needs root, so plugins are loaded straight from ~/.local/lib/hypr/plugins.
--
-- Any plugin config must be required *after* the plugin is loaded, so that is
-- why this file exists separately from hyprgrass.lua.

local plugins = {
    { path = "/home/nismo/.local/lib/hypr/plugins/libhyprgrass.so", config = "hypr.hyprgrass" },
}

for _, plugin in ipairs(plugins) do
    hl.plugin.load(plugin.path)

    local loaded = false
    for _, p in ipairs(hl.get_loaded_plugins()) do
        if p.name == "hyprgrass" then
            loaded = true
        end
    end

    if loaded then
        require(plugin.config)
    else
        hl.print("hyprgrass failed to load, skipping its config")
    end
end