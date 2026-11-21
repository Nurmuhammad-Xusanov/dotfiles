#!/usr/bin/env python3
import os
import re
import zipfile
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.expanduser("~/Downloads/Telegram-Theme-White")
os.makedirs(BASE_DIR, exist_ok=True)
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# 1. Palette definition for "White" theme
palette = {
    'base': 'ffffff',        # Pure white background
    'mantle': 'f6f6f8',      # Soft light gray (secondary background)
    'crust': 'eeeeef',       # Toolbar / dialog background
    'surface0': 'e4e4e7',    # Dividers, inputs
    'surface1': 'd5d5db',    # Hover highlight
    'surface2': 'c2c2cb',    # Active highlight
    'overlay0': '9a9aa2',    # Disabled text / inactive icons
    'overlay1': '808080',    # Muted secondary text
    'overlay2': '606068',    # Secondary icons / tabs
    'subtext0': '6e6e6e',    # Timestamps & status
    'subtext1': '38383e',    # Secondary titles & authors
    'text': '000000',        # Pure black crisp readable text
    'blue': '1a1a1a',        # Dark monochrome accent for buttons & links
    'green': '2e7d32',       # Subtle green for online status / active call
    'red': 'd32f2f',         # Error & destructive actions
    'yellow': 'd97706',      # Starred / warnings
    'peach': 'ea580c',
    'maroon': 'b91c1c',
    'mauve': '222222',       # Deep charcoal
    'pink': '505050',
    'flamingo': '606060',
    'rosewater': '707070',
    'sapphire': '2563eb',
    'sky': '475569',
    'teal': '334155',
    'lavender': '3a3a44',
}

# 2. Build Telegram Desktop Theme
with open('/home/nismo/.config/omarchy/themes/white/telegram/templates/desktop.tera') as f:
    desktop_template = f.read()

parts = desktop_template.split('---', 2)
desktop_body = parts[2].strip() if len(parts) > 2 else desktop_template

# Substitute palette variables
desktop_body = re.sub(r'\{\{\s*flavor\.name\s*\}\}', 'White', desktop_body)
desktop_body = re.sub(r'\{\{\s*flavor\.identifier\s*\}\}', 'white', desktop_body)
desktop_body = re.sub(r'\{\{\s*flavor\.dark\s*\|\s*as_str\s*\}\}', 'false', desktop_body)
desktop_body = re.sub(r'\{\{\s*wallpapers\[flavor\.identifier\]\s*\}\}', '', desktop_body)

for k, v in palette.items():
    desktop_body = re.sub(r'\{\{\s*' + k + r'\.hex\s*\}\}', v, desktop_body)

# Fix known typos in catppuccin template
desktop_body = desktop_body.replace('cptText', 'ctpText')
desktop_body = desktop_body.replace('cptRed', 'ctpRed')
desktop_body = desktop_body.replace('windowSubtextFg', 'windowSubTextFg')

# Collect all raw variable assignments
raw_vars = {}
for line in desktop_body.splitlines():
    s = line.strip()
    if not s or s.startswith('//'):
        continue
    if any(s.startswith(bad) for bad in ['name:', 'shortname:', 'dark:', 'wallpaper:']):
        continue
    if '//' in s:
        s = s.split('//')[0].strip()
    if s.endswith(';'):
        s = s[:-1].strip()
    if ':' in s:
        k, v = s.split(':', 1)
        raw_vars[k.strip()] = v.strip()

# Refine bubble colors: Pure white incoming bubble, sleek soft-slate outgoing bubble
raw_vars['msgInBg'] = '#ffffff'
raw_vars['msgInBgSelected'] = '#f0f0f4'
raw_vars['msgOutBg'] = '#e6e8ec'
raw_vars['msgOutBgSelected'] = '#d8dbe2'
raw_vars['msgInDateFg'] = '#707075'
raw_vars['msgOutDateFg'] = '#606266'
raw_vars['historyTextInFg'] = '#000000'
raw_vars['historyTextOutFg'] = '#000000'
raw_vars['activeButtonBg'] = '#1a1a1a'
raw_vars['activeButtonBgOver'] = '#2a2a2a'
raw_vars['activeButtonBgRipple'] = '#333333'
raw_vars['activeButtonFg'] = '#ffffff'
raw_vars['activeButtonFgOver'] = '#ffffff'
raw_vars['activeButtonSecondaryFg'] = '#e0e0e0'
raw_vars['activeButtonSecondaryFgOver'] = '#e0e0e0'


# Fully resolve all variables to pure hex (#RRGGBB or #RRGGBBAA)
hex_re = re.compile(r'^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$')
resolved_vars = {}
for k in raw_vars:
    cur = raw_vars[k]
    visited = {k}
    while not hex_re.match(cur):
        if cur not in raw_vars:
            raise ValueError(f"Unresolved variable: {k} -> {cur}")
        cur = raw_vars[cur]
        if cur in visited:
            raise ValueError(f"Cycle detected for variable {k}: {cur}")
        visited.add(cur)
    resolved_vars[k] = cur

# Filter out internal ctp* palette variables so only native Telegram Desktop keys remain
tdesktop_final = {k: v for k, v in resolved_vars.items() if not k.startswith('ctp')}

desktop_content = "// Telegram Desktop Theme - White\n"
desktop_content += "// Built for Omarchy White theme\n\n"
for k in sorted(tdesktop_final.keys()):
    desktop_content += f"{k}: {tdesktop_final[k]};\n"

# Save colors.tdesktop-theme and colors.tdesktop-palette
desktop_theme_file_path = os.path.join(BASE_DIR, 'colors.tdesktop-theme')
with open(desktop_theme_file_path, 'w', encoding='utf-8') as f:
    f.write(desktop_content)

desktop_palette_path = os.path.join(BASE_DIR, 'colors.tdesktop-palette')
with open(desktop_palette_path, 'w', encoding='utf-8') as f:
    f.write(desktop_content)

# Convert background to baseline JPEG
bg_path = os.path.join(BASE_DIR, 'background.jpg')
os.system(f"magick /usr/share/omarchy/themes/white/backgrounds/1-white.webp -interlace none -quality 90 '{bg_path}'")

# Create .tdesktop-theme package (Strictly colors.tdesktop-theme and background.jpg at root of ZIP)
zip_path = os.path.join(BASE_DIR, 'White.tdesktop-theme')
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    zf.write(desktop_theme_file_path, 'colors.tdesktop-theme')
    zf.write(bg_path, 'background.jpg')

print("Telegram Desktop theme built successfully:", zip_path)

# 3. Build Telegram Android Theme (.attheme)
with open('/home/nismo/.config/omarchy/themes/white/telegram/templates/android.tera') as f:
    android_template = f.read()

parts = android_template.split('---', 2)
android_body = parts[2].strip() if len(parts) > 2 else android_template

android_body = re.sub(r'\{\{\s*flavor\.name\s*\}\}', 'White', android_body)
android_body = re.sub(r'\{\{\s*flavor\.identifier\s*\}\}', 'white', android_body)
android_body = re.sub(r'\{\{\s*flavor\.dark\s*\|\s*as_str\s*\}\}', 'false', android_body)

def replace_mod(m):
    color_name = m.group(1).strip()
    opacity = float(m.group(2))
    hex_color = palette.get(color_name, 'ffffff')
    alpha_int = int(opacity * 255)
    return f"{hex_color}{alpha_int:02x}"

android_body = re.sub(r'\{\{\s*(\w+)\s*\|\s*mod\(opacity=([0-9.]+)\)\s*\|\s*get\(key=[\"\x27]hex[\"\x27]\)\s*\}\}', replace_mod, android_body)

for k, v in palette.items():
    android_body = re.sub(r'\{\{\s*' + k + r'\.hex\s*\}\}', v, android_body)

android_hex_map = {}
for line in android_body.splitlines():
    line = line.strip()
    if ':' in line and not line.startswith('//') and not line.startswith('#'):
        k, v = line.split(':', 1)
        k = k.strip()
        v = v.strip()
        if k in ('name', 'shortname', 'dark'):
            continue
        android_hex_map[k] = v

# Android White refinements
android_hex_map['chat_inBubble'] = '#ffffff'
android_hex_map['chat_inBubbleSelected'] = '#f0f0f4'
android_hex_map['chat_outBubble'] = '#e6e8ec'
android_hex_map['chat_outBubbleSelected'] = '#d8dbe2'
android_hex_map['chat_messageTextIn'] = '#000000'
android_hex_map['chat_messageTextOut'] = '#000000'
android_hex_map['chat_inTimeText'] = '#707075'
android_hex_map['chat_outTimeText'] = '#606266'
android_hex_map['actionBarDefault'] = '#ffffff'
android_hex_map['actionBarDefaultTitle'] = '#000000'
android_hex_map['actionBarDefaultIcon'] = '#1a1a1a'
android_hex_map['actionBarDefaultSearch'] = '#1a1a1a'
android_hex_map['actionBarDefaultSearchPlaceholder'] = '#80808080'
android_hex_map['dialogSearchHint'] = '#808080'
android_hex_map['chats_actionBackground'] = '#1a1a1a'
android_hex_map['chats_actionIcon'] = '#ffffff'
android_hex_map['chats_unreadCounter'] = '#1a1a1a'
android_hex_map['chats_unreadCounterText'] = '#ffffff'
android_hex_map['windowBackgroundWhite'] = '#ffffff'
android_hex_map['windowBackgroundGray'] = '#f5f5f7'

def hex_to_argb_int(hex_str):
    hex_str = hex_str.strip().lstrip('#')
    if len(hex_str) == 6:
        a = 0xff
        r = int(hex_str[0:2], 16)
        g = int(hex_str[2:4], 16)
        b = int(hex_str[4:6], 16)
    elif len(hex_str) == 8:
        r = int(hex_str[0:2], 16)
        g = int(hex_str[2:4], 16)
        b = int(hex_str[4:6], 16)
        a = int(hex_str[6:8], 16)
    else:
        raise ValueError(f"Invalid hex: {hex_str}")
    val = (a << 24) | (r << 16) | (g << 8) | b
    if val >= 0x80000000:
        val -= 0x100000000
    return val

attheme_int_lines = []
for k in sorted(android_hex_map.keys()):
    v_hex = android_hex_map[k]
    try:
        v_int = hex_to_argb_int(v_hex)
        attheme_int_lines.append(f"{k}={v_int}")
    except Exception as e:
        pass

# 1. Standalone .attheme
attheme_standalone_path = os.path.join(BASE_DIR, 'White-standalone.attheme')
with open(attheme_standalone_path, 'w', encoding='utf-8') as f:
    f.write("wallpaperFileOffset=-1\n")
    f.write("\n".join(attheme_int_lines) + "\n")

# 2. Embedded wallpaper .attheme
with open(bg_path, 'rb') as f:
    bg_bytes = f.read()

dummy_header = f"wallpaperFileOffset={999999999}\n" + "\n".join(attheme_int_lines) + "\n"
offset = len(dummy_header.encode('utf-8'))
final_header = f"wallpaperFileOffset={offset:09d}\n" + "\n".join(attheme_int_lines) + "\n"
assert len(final_header.encode('utf-8')) == offset

attheme_embedded_path = os.path.join(BASE_DIR, 'White.attheme')
with open(attheme_embedded_path, 'wb') as f:
    f.write(final_header.encode('utf-8'))
    f.write(bg_bytes)

# 3. Human-readable hex version
attheme_hex_path = os.path.join(BASE_DIR, 'White-hex.attheme')
with open(attheme_hex_path, 'w', encoding='utf-8') as f:
    f.write("# Telegram Android Theme: White (Hex representation)\n")
    for k in sorted(android_hex_map.keys()):
        f.write(f"{k}: {android_hex_map[k]}\n")

print("Telegram Android theme built successfully:", attheme_embedded_path)

# Copy all files to Downloads folder
dist_files = [
    'White.tdesktop-theme',
    'colors.tdesktop-palette',
    'colors.tdesktop-theme',
    'White.attheme',
    'White-standalone.attheme',
    'White-hex.attheme',
    'background.jpg'
]

for fname in dist_files:
    src = os.path.join(BASE_DIR, fname)
    dst = os.path.join(DOWNLOADS_DIR, fname)
    shutil.copy2(src, dst)

print(f"All files copied to {DOWNLOADS_DIR}")
