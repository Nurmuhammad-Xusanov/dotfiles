#!/usr/bin/env python3
"""
Hyprland Display Settings Manager
Vantablack monochrome theme, English language, no emojis.
"""
import sys
import os
import json
import subprocess
import re

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GLib

CONFIG_FILE = os.path.expanduser("~/.config/hypr/monitors.lua")

def run_cmd(cmd):
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return res.stdout.strip()
    except subprocess.CalledProcessError:
        return ""

def notify(msg, title="Display Settings"):
    subprocess.Popen(["notify-send", "-a", "Hyprland Display", title, msg])

def get_monitors():
    out = run_cmd(["hyprctl", "-j", "monitors", "all"])
    if not out:
        return []
    try:
        return json.loads(out)
    except Exception:
        return []

def apply_hyprland_lua(lua_code):
    cmd = ["hyprctl", "eval", lua_code]
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

class DisplayManagerWindow(Gtk.Window):
    def __init__(self):
        super().__init__(title="Display Settings")
        self.set_default_size(680, 580)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_border_width(16)

        # Prefer dark theme
        settings = Gtk.Settings.get_default()
        if settings:
            settings.set_property("gtk-application-prefer-dark-theme", True)

        # Vantablack monochrome styling
        css = b"""
        window {
            background-color: #090909;
            color: #ffffff;
        }
        .header-title {
            font-size: 16px;
            font-weight: bold;
            color: #ffffff;
        }
        .section-title {
            font-size: 11px;
            font-weight: bold;
            color: #777777;
            margin-top: 8px;
            margin-bottom: 4px;
        }
        .card {
            background: #111111;
            border: 1px solid #222222;
            border-radius: 6px;
            padding: 12px;
        }
        .mode-btn {
            background: #141414;
            color: #ffffff;
            border-radius: 6px;
            padding: 10px 12px;
            border: 1px solid #262626;
            font-size: 12px;
            font-weight: bold;
        }
        .mode-btn:hover {
            background: #1f1f1f;
            border-color: #404040;
        }
        .mode-btn:focus {
            background: #262626;
            border-color: #666666;
        }
        .action-btn-primary {
            background: #ffffff;
            color: #000000;
            font-weight: bold;
            border-radius: 6px;
            padding: 6px 16px;
            border: 1px solid #ffffff;
        }
        .action-btn-primary:hover {
            background: #e0e0e0;
            border-color: #e0e0e0;
        }
        .action-btn-save {
            background: #1a1a1a;
            color: #ffffff;
            font-weight: bold;
            border-radius: 6px;
            padding: 6px 16px;
            border: 1px solid #333333;
        }
        .action-btn-save:hover {
            background: #252525;
            border-color: #555555;
        }
        notebook {
            background: transparent;
        }
        notebook tab {
            background: #111111;
            color: #888888;
            border: 1px solid #222222;
            padding: 6px 14px;
            border-bottom: none;
            font-size: 12px;
        }
        notebook tab:checked {
            background: #181818;
            color: #ffffff;
            border-color: #383838;
        }
        notebook stack {
            background: #111111;
            border: 1px solid #222222;
            border-radius: 0 0 6px 6px;
            padding: 12px;
        }
        """
        try:
            style_provider = Gtk.CssProvider()
            style_provider.load_from_data(css)
            Gtk.StyleContext.add_provider_for_screen(
                Gdk.Screen.get_default(),
                style_provider,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
            )
        except Exception as e:
            print("CSS load warning:", e)


        self.monitors = get_monitors()
        self.internal_mon = None
        self.external_mon = None

        for m in self.monitors:
            name = m.get("name", "")
            if re.match(r"^(eDP|LVDS|DSI)-", name):
                self.internal_mon = m
            else:
                self.external_mon = m

        self.build_ui()

    def build_ui(self):
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self.add(vbox)

        # Header Title
        top_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        title_lbl = Gtk.Label(label="Display Settings", xalign=0)
        title_lbl.get_style_context().add_class("header-title")
        top_box.pack_start(title_lbl, True, True, 0)
        vbox.pack_start(top_box, False, False, 0)

        # Section: Quick Presets (Win + P style)
        presets_lbl = Gtk.Label(label="Quick Presets", xalign=0)
        presets_lbl.get_style_context().add_class("section-title")
        vbox.pack_start(presets_lbl, False, False, 0)

        modes_grid = Gtk.Grid()
        modes_grid.set_column_spacing(8)
        modes_grid.set_row_spacing(8)
        modes_grid.set_column_homogeneous(True)

        btn_extend = Gtk.Button(label="Extend Displays\n(PC + 100Hz External)")
        btn_extend.get_style_context().add_class("mode-btn")
        btn_extend.connect("clicked", lambda b: self.set_preset_mode("extend"))
        modes_grid.attach(btn_extend, 0, 0, 1, 1)

        btn_mirror = Gtk.Button(label="Duplicate Displays\n(Mirror mode)")
        btn_mirror.get_style_context().add_class("mode-btn")
        btn_mirror.connect("clicked", lambda b: self.set_preset_mode("mirror"))
        modes_grid.attach(btn_mirror, 1, 0, 1, 1)

        btn_pc_only = Gtk.Button(label="Show Only on 1\n(PC display only)")
        btn_pc_only.get_style_context().add_class("mode-btn")
        btn_pc_only.connect("clicked", lambda b: self.set_preset_mode("pc_only"))
        modes_grid.attach(btn_pc_only, 2, 0, 1, 1)

        btn_ext_only = Gtk.Button(label="Show Only on 2\n(External 100Hz only)")
        btn_ext_only.get_style_context().add_class("mode-btn")
        btn_ext_only.connect("clicked", lambda b: self.set_preset_mode("ext_only"))
        modes_grid.attach(btn_ext_only, 3, 0, 1, 1)

        vbox.pack_start(modes_grid, False, False, 0)

        # Section: Display Arrangement
        pos_lbl = Gtk.Label(label="Display Arrangement", xalign=0)
        pos_lbl.get_style_context().add_class("section-title")
        vbox.pack_start(pos_lbl, False, False, 0)

        pos_card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        pos_card.get_style_context().add_class("card")

        pos_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        pos_info = Gtk.Label(label="External display relative position:", xalign=0)
        pos_row.pack_start(pos_info, True, True, 0)

        self.pos_combo = Gtk.ComboBoxText()
        self.pos_combo.append("right", "To the right of PC display")
        self.pos_combo.append("left", "To the left of PC display")
        self.pos_combo.append("top", "Above PC display")
        self.pos_combo.append("bottom", "Below PC display")
        self.pos_combo.set_active(0)
        pos_row.pack_start(self.pos_combo, False, False, 0)
        pos_card.pack_start(pos_row, False, False, 0)
        vbox.pack_start(pos_card, False, False, 0)

        # Section: Display Configuration
        conf_lbl = Gtk.Label(label="Display Configuration", xalign=0)
        conf_lbl.get_style_context().add_class("section-title")
        vbox.pack_start(conf_lbl, False, False, 0)

        self.notebook = Gtk.Notebook()
        vbox.pack_start(self.notebook, True, True, 0)

        self.mon_controls = {}
        for idx, m in enumerate(self.monitors):
            tab = self.create_monitor_tab(m)
            status_text = "Active" if not m.get("disabled") else "Disabled"
            tab_lbl = Gtk.Label(label=f"Display {idx + 1}: {m.get('name')} ({status_text})")
            self.notebook.append_page(tab, tab_lbl)

        # Footer Actions
        footer_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        footer_box.set_halign(Gtk.Align.END)

        btn_reload = Gtk.Button(label="Refresh")
        btn_reload.get_style_context().add_class("action-btn-save")
        btn_reload.connect("clicked", lambda b: self.refresh_data())
        footer_box.pack_start(btn_reload, False, False, 0)

        btn_apply = Gtk.Button(label="Apply")
        btn_apply.get_style_context().add_class("action-btn-primary")
        btn_apply.connect("clicked", lambda b: self.apply_current_settings(save=False))
        footer_box.pack_start(btn_apply, False, False, 0)

        btn_save = Gtk.Button(label="Save as Default")
        btn_save.get_style_context().add_class("action-btn-save")
        btn_save.connect("clicked", lambda b: self.apply_current_settings(save=True))
        footer_box.pack_start(btn_save, False, False, 0)

        vbox.pack_start(footer_box, False, False, 0)

    def create_monitor_tab(self, mon):
        tab_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        tab_box.set_border_width(8)

        name = mon.get("name", "")
        desc = mon.get("description", "")
        curr_w = mon.get("width", 1920)
        curr_h = mon.get("height", 1080)
        curr_hz = round(mon.get("refreshRate", 60), 2)
        modes = mon.get("availableModes", [])
        curr_scale = mon.get("scale", 1.0)
        disabled = mon.get("disabled", False)

        # Device info
        info_str = f"<b>{name}</b> — {desc}"
        info_lbl = Gtk.Label(label=info_str, xalign=0, use_markup=True)
        tab_box.pack_start(info_lbl, False, False, 4)

        grid = Gtk.Grid()
        grid.set_column_spacing(16)
        grid.set_row_spacing(8)
        tab_box.pack_start(grid, False, False, 0)

        # Status Switch
        grid.attach(Gtk.Label(label="Display status:", xalign=0), 0, 0, 1, 1)
        enable_sw = Gtk.Switch()
        enable_sw.set_active(not disabled)
        enable_sw.set_halign(Gtk.Align.START)
        grid.attach(enable_sw, 1, 0, 1, 1)

        # Parse resolutions and refresh rates
        res_map = {}
        for m_str in modes:
            parts = m_str.replace("Hz", "").split("@")
            if len(parts) == 2:
                r_key = parts[0]
                try:
                    hz_val = float(parts[1])
                except ValueError:
                    continue
                if r_key not in res_map:
                    res_map[r_key] = []
                if hz_val not in res_map[r_key]:
                    res_map[r_key].append(hz_val)

        for k in res_map:
            res_map[k].sort(reverse=True)

        # Resolution dropdown
        grid.attach(Gtk.Label(label="Resolution:", xalign=0), 0, 1, 1, 1)
        res_combo = Gtk.ComboBoxText()
        cur_res_key = f"{curr_w}x{curr_h}"

        def res_sort_key(r):
            w, h = map(int, r.split("x"))
            return w * h
        sorted_resolutions = sorted(res_map.keys(), key=res_sort_key, reverse=True)
        if cur_res_key not in sorted_resolutions:
            sorted_resolutions.insert(0, cur_res_key)

        for r in sorted_resolutions:
            res_combo.append(r, r)
        res_combo.set_active_id(cur_res_key)
        grid.attach(res_combo, 1, 1, 1, 1)

        # Refresh rate dropdown
        grid.attach(Gtk.Label(label="Refresh rate:", xalign=0), 0, 2, 1, 1)
        hz_combo = Gtk.ComboBoxText()

        def update_hz_options(selected_res):
            hz_combo.remove_all()
            rates = res_map.get(selected_res, [60.0])
            rates.sort(reverse=True)
            active_id = None
            for rate in rates:
                rate_id = f"{rate:.2f}"
                label = f"{rate:.0f} Hz" if rate.is_integer() else f"{rate:.2f} Hz"
                if rate >= 99.0:
                    label += " (Optimal / 100Hz)"
                hz_combo.append(rate_id, label)
                if abs(rate - curr_hz) < 1.0 and active_id is None:
                    active_id = rate_id
            if active_id:
                hz_combo.set_active_id(active_id)
            else:
                hz_combo.set_active(0)

        update_hz_options(cur_res_key)
        res_combo.connect("changed", lambda cb: update_hz_options(cb.get_active_text() or cur_res_key))
        grid.attach(hz_combo, 1, 2, 1, 1)

        # Scale dropdown
        grid.attach(Gtk.Label(label="Scale:", xalign=0), 0, 3, 1, 1)
        scale_combo = Gtk.ComboBoxText()
        scales = [("1", "100% (1.0x)"), ("1.25", "125% (1.25x)"), ("1.5", "150% (1.5x)"), ("1.75", "175% (1.75x)"), ("2", "200% (2.0x)")]
        for s_val, s_lbl in scales:
            scale_combo.append(s_val, s_lbl)
        scale_id = str(curr_scale).rstrip(".0") if float(curr_scale).is_integer() else str(curr_scale)
        scale_combo.set_active_id(scale_id)
        if scale_combo.get_active() == -1:
            scale_combo.set_active(0)
        grid.attach(scale_combo, 1, 3, 1, 1)

        self.mon_controls[name] = {
            "mon": mon,
            "enable_sw": enable_sw,
            "res_combo": res_combo,
            "hz_combo": hz_combo,
            "scale_combo": scale_combo,
        }

        return tab_box

    def refresh_data(self):
        self.monitors = get_monitors()
        for m in self.monitors:
            name = m.get("name")
            if name in self.mon_controls:
                ctrl = self.mon_controls[name]
                ctrl["enable_sw"].set_active(not m.get("disabled", False))
        notify("Display information refreshed")

    def set_preset_mode(self, mode):
        int_name = self.internal_mon.get("name", "eDP-1") if self.internal_mon else "eDP-1"
        ext_name = self.external_mon.get("name", "HDMI-A-1") if self.external_mon else "HDMI-A-1"

        if mode == "extend":
            lua = f'''
hl.monitor({{ output = "{int_name}", mode = "1920x1200@60", position = "0x0", scale = 1, bitdepth = 10 }})
hl.monitor({{ output = "{ext_name}", mode = "1920x1080@100", position = "1920x0", scale = 1 }})
'''
            apply_hyprland_lua(lua)
            notify("Extended display mode applied (100Hz)")
            self.save_to_config(int_name, "1920x1200@60", "0x0", 1, ext_name, "1920x1080@100", "1920x0", 1)

        elif mode == "mirror":
            lua = f'''
hl.monitor({{ output = "{int_name}", mode = "1920x1200@60", position = "0x0", scale = 1, bitdepth = 10 }})
hl.monitor({{ output = "{ext_name}", mode = "1920x1080@100", position = "auto", scale = 1, mirror = "{int_name}" }})
'''
            apply_hyprland_lua(lua)
            notify("Duplicate display mode applied")
            self.save_to_config(int_name, "1920x1200@60", "0x0", 1, ext_name, "1920x1080@100", "auto", 1, mirror=int_name)

        elif mode == "pc_only":
            lua = f'''
hl.monitor({{ output = "{int_name}", mode = "1920x1200@60", position = "0x0", scale = 1, bitdepth = 10 }})
hl.monitor({{ output = "{ext_name}", mode = "disable" }})
'''
            apply_hyprland_lua(lua)
            notify("Output on PC display only")

        elif mode == "ext_only":
            lua = f'''
hl.monitor({{ output = "{int_name}", mode = "disable" }})
hl.monitor({{ output = "{ext_name}", mode = "1920x1080@100", position = "0x0", scale = 1 }})
'''
            apply_hyprland_lua(lua)
            notify("Output on external display only (100Hz)")

    def apply_current_settings(self, save=False):
        int_name = self.internal_mon.get("name", "eDP-1") if self.internal_mon else "eDP-1"
        ext_name = self.external_mon.get("name", "HDMI-A-1") if self.external_mon else "HDMI-A-1"

        pos_mode = self.pos_combo.get_active_id() or "right"

        int_ctrl = self.mon_controls.get(int_name)
        int_enabled = int_ctrl["enable_sw"].get_active() if int_ctrl else True
        int_res = int_ctrl["res_combo"].get_active_text() if int_ctrl else "1920x1200"
        int_hz = float(int_ctrl["hz_combo"].get_active_id() or 60.0) if int_ctrl else 60.0
        int_scale = float(int_ctrl["scale_combo"].get_active_id() or 1.0) if int_ctrl else 1.0

        ext_ctrl = self.mon_controls.get(ext_name)
        ext_enabled = ext_ctrl["enable_sw"].get_active() if ext_ctrl else True
        ext_res = ext_ctrl["res_combo"].get_active_text() if ext_ctrl else "1920x1080"
        ext_hz = float(ext_ctrl["hz_combo"].get_active_id() or 100.0) if ext_ctrl else 100.0
        ext_scale = float(ext_ctrl["scale_combo"].get_active_id() or 1.0) if ext_ctrl else 1.0

        int_w, int_h = map(int, int_res.split("x"))
        ext_w, ext_h = map(int, ext_res.split("x"))

        if pos_mode == "right":
            int_pos = "0x0"
            ext_pos = f"{int_w}x0"
        elif pos_mode == "left":
            ext_pos = "0x0"
            int_pos = f"{ext_w}x0"
        elif pos_mode == "top":
            ext_pos = "0x0"
            int_pos = f"0x{ext_h}"
        elif pos_mode == "bottom":
            int_pos = "0x0"
            ext_pos = f"0x{int_h}"
        else:
            int_pos = "0x0"
            ext_pos = "auto"

        lua_parts = []
        if int_enabled:
            int_mode = f"{int_res}@{int_hz:.0f}" if int_hz.is_integer() else f"{int_res}@{int_hz:.2f}"
            lua_parts.append(f'hl.monitor({{ output = "{int_name}", mode = "{int_mode}", position = "{int_pos}", scale = {int_scale}, bitdepth = 10 }})')
        else:
            lua_parts.append(f'hl.monitor({{ output = "{int_name}", mode = "disable" }})')

        if ext_enabled:
            ext_mode = f"{ext_res}@{ext_hz:.0f}" if ext_hz.is_integer() else f"{ext_res}@{ext_hz:.2f}"
            lua_parts.append(f'hl.monitor({{ output = "{ext_name}", mode = "{ext_mode}", position = "{ext_pos}", scale = {ext_scale} }})')
        else:
            lua_parts.append(f'hl.monitor({{ output = "{ext_name}", mode = "disable" }})')

        full_lua = "\n".join(lua_parts)
        apply_hyprland_lua(full_lua)

        if save:
            int_mode = f"{int_res}@{int_hz:.0f}" if int_hz.is_integer() else f"{int_res}@{int_hz:.2f}"
            ext_mode = f"{ext_res}@{ext_hz:.0f}" if ext_hz.is_integer() else f"{ext_res}@{ext_hz:.2f}"
            self.save_to_config(
                int_name, int_mode, int_pos, int_scale,
                ext_name, ext_mode, ext_pos, ext_scale,
                int_enabled=int_enabled, ext_enabled=ext_enabled
            )
            notify("Configuration saved and applied", "Display Settings")
        else:
            notify("Display settings applied", "Display Settings")

    def save_to_config(self, int_name, int_mode, int_pos, int_scale,
                       ext_name, ext_mode, ext_pos, ext_scale,
                       int_enabled=True, ext_enabled=True, mirror=None):
        lua_content = f"""-- Auto-configured by Hyprland Display Settings
local omarchy_gdk_scale = 1
local omarchy_monitor_scale = 1

hl.env("GDK_SCALE", tostring(omarchy_gdk_scale))
hl.env("FREETYPE_PROPERTIES", "cff:no-stem-darkening=0 autofitter:no-stem-darkening=0 type1:no-stem-darkening=0 t1cid:no-stem-darkening=0")

-- PC Display ({int_name})
"""
        if int_enabled:
            lua_content += f"""hl.monitor({{
  output = "{int_name}",
  mode = "{int_mode}",
  position = "{int_pos}",
  scale = {int_scale},
  bitdepth = 10,
}})
"""
        else:
            lua_content += f"""hl.monitor({{
  output = "{int_name}",
  mode = "disable",
}})
"""

        lua_content += f"\n-- External Display ({ext_name})\n"
        if ext_enabled:
            if mirror:
                lua_content += f"""hl.monitor({{
  output = "{ext_name}",
  mode = "{ext_mode}",
  position = "{ext_pos}",
  scale = {ext_scale},
  mirror = "{mirror}",
}})
"""
            else:
                lua_content += f"""hl.monitor({{
  output = "{ext_name}",
  mode = "{ext_mode}",
  position = "{ext_pos}",
  scale = {ext_scale},
}})
"""
        else:
            lua_content += f"""hl.monitor({{
  output = "{ext_name}",
  mode = "disable",
}})
"""

        lua_content += """
-- Default fallback for any other external monitors
hl.monitor({
  output = "",
  mode = "preferred",
  position = "auto",
  scale = omarchy_monitor_scale,
})
"""
        try:
            with open(CONFIG_FILE, "w") as f:
                f.write(lua_content)
        except Exception as e:
            notify(f"Error saving config: {e}", "Error")

def main():
    win = DisplayManagerWindow()
    win.connect("destroy", Gtk.main_quit)
    win.show_all()
    Gtk.main()

if __name__ == "__main__":
    main()
