#!/usr/bin/env python3
"""
Windows-style Project / Display Switcher Popup for Hyprland
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

def notify(msg, title="Display"):
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

class ProjectorPopup(Gtk.Window):
    def __init__(self):
        super().__init__(title="Project")
        self.set_default_size(340, 390)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.set_border_width(12)
        self.set_keep_above(True)

        # Prefer dark theme
        settings = Gtk.Settings.get_default()
        if settings:
            settings.set_property("gtk-application-prefer-dark-theme", True)

        # Vantablack clean theme
        css = b"""
        window {
            background-color: #090909;
            color: #ffffff;
            border-radius: 8px;
            border: 1px solid #282828;
        }
        .title {
            font-size: 14px;
            font-weight: bold;
            color: #888888;
            margin-bottom: 6px;
        }
        .btn-choice {
            background: #121212;
            color: #ffffff;
            border-radius: 6px;
            padding: 10px 12px;
            border: 1px solid #242424;
            margin-bottom: 4px;
        }
        .btn-choice:hover {
            background: #1c1c1c;
            border-color: #404040;
        }
        .btn-choice:focus {
            background: #242424;
            border-color: #777777;
        }
        .btn-choice-title {
            font-size: 13px;
            font-weight: bold;
            color: #ffffff;
        }
        .btn-choice-desc {
            font-size: 11px;
            color: #888888;
        }
        .btn-settings {
            background: #090909;
            color: #888888;
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 12px;
            border: 1px solid #202020;
            margin-top: 4px;
        }
        .btn-settings:hover {
            background: #161616;
            color: #ffffff;
            border-color: #383838;
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


        self.connect("key-press-event", self.on_key_press)

        self.monitors = get_monitors()
        self.internal_mon = "eDP-1"
        self.external_mon = "HDMI-A-1"

        for m in self.monitors:
            name = m.get("name", "")
            if re.match(r"^(eDP|LVDS|DSI)-", name):
                self.internal_mon = name
            else:
                self.external_mon = name

        self.build_ui()

    def build_ui(self):
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        self.add(vbox)

        lbl = Gtk.Label(label="Project (Win + P)", xalign=0)
        lbl.get_style_context().add_class("title")
        vbox.pack_start(lbl, False, False, 2)

        # 1. PC screen only
        btn1 = self.create_choice_button("1. PC screen only", "Disconnect external display", lambda: self.set_mode("pc_only"))
        vbox.pack_start(btn1, False, False, 0)

        # 2. Duplicate
        btn2 = self.create_choice_button("2. Duplicate", "Show same screen on both displays", lambda: self.set_mode("mirror"))
        vbox.pack_start(btn2, False, False, 0)

        # 3. Extend
        btn3 = self.create_choice_button("3. Extend", "Expand workspace across displays (100Hz)", lambda: self.set_mode("extend"))
        vbox.pack_start(btn3, False, False, 0)

        # 4. Second screen only
        btn4 = self.create_choice_button("4. Second screen only", "Disconnect PC display (100Hz)", lambda: self.set_mode("ext_only"))
        vbox.pack_start(btn4, False, False, 0)

        # 5. Full Settings
        btn5 = Gtk.Button(label="Display settings...")
        btn5.get_style_context().add_class("btn-settings")
        btn5.connect("clicked", self.open_full_settings)
        vbox.pack_start(btn5, False, False, 4)

        # Default focus on Extend
        btn3.grab_focus()

    def create_choice_button(self, title, desc, callback):
        btn = Gtk.Button()
        btn.get_style_context().add_class("btn-choice")
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)

        t_lbl = Gtk.Label(label=title, xalign=0)
        t_lbl.get_style_context().add_class("btn-choice-title")
        box.pack_start(t_lbl, False, False, 0)

        d_lbl = Gtk.Label(label=desc, xalign=0)
        d_lbl.get_style_context().add_class("btn-choice-desc")
        box.pack_start(d_lbl, False, False, 0)

        btn.add(box)
        btn.connect("clicked", lambda b: callback())
        return btn

    def on_key_press(self, widget, event):
        if event.keyval == Gdk.KEY_Escape:
            self.destroy()
            return True
        elif event.keyval in (Gdk.KEY_1, Gdk.KEY_KP_1):
            self.set_mode("pc_only")
            return True
        elif event.keyval in (Gdk.KEY_2, Gdk.KEY_KP_2):
            self.set_mode("mirror")
            return True
        elif event.keyval in (Gdk.KEY_3, Gdk.KEY_KP_3):
            self.set_mode("extend")
            return True
        elif event.keyval in (Gdk.KEY_4, Gdk.KEY_KP_4):
            self.set_mode("ext_only")
            return True
        return False

    def open_full_settings(self, btn):
        self.destroy()
        script = os.path.expanduser("~/.config/hypr/scripts/display-manager.py")
        subprocess.Popen([sys.executable, script])

    def set_mode(self, mode):
        int_name = self.internal_mon
        ext_name = self.external_mon

        if mode == "extend":
            lua = f'''
hl.monitor({{ output = "{int_name}", mode = "1920x1200@60", position = "0x0", scale = 1, bitdepth = 10 }})
hl.monitor({{ output = "{ext_name}", mode = "1920x1080@100", position = "1920x0", scale = 1 }})
'''
            apply_hyprland_lua(lua)
            notify("Extended mode enabled (100Hz external)", "Display Mode")

        elif mode == "mirror":
            lua = f'''
hl.monitor({{ output = "{int_name}", mode = "1920x1200@60", position = "0x0", scale = 1, bitdepth = 10 }})
hl.monitor({{ output = "{ext_name}", mode = "1920x1080@100", position = "auto", scale = 1, mirror = "{int_name}" }})
'''
            apply_hyprland_lua(lua)
            notify("Duplicate mode enabled", "Display Mode")

        elif mode == "pc_only":
            lua = f'''
hl.monitor({{ output = "{int_name}", mode = "1920x1200@60", position = "0x0", scale = 1, bitdepth = 10 }})
hl.monitor({{ output = "{ext_name}", mode = "disable" }})
'''
            apply_hyprland_lua(lua)
            notify("PC screen only enabled", "Display Mode")

        elif mode == "ext_only":
            lua = f'''
hl.monitor({{ output = "{int_name}", mode = "disable" }})
hl.monitor({{ output = "{ext_name}", mode = "1920x1080@100", position = "0x0", scale = 1 }})
'''
            apply_hyprland_lua(lua)
            notify("Second screen only enabled (100Hz)", "Display Mode")

        self.destroy()

def main():
    win = ProjectorPopup()
    win.connect("destroy", Gtk.main_quit)
    win.show_all()
    Gtk.main()

if __name__ == "__main__":
    main()
