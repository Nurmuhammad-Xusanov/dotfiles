#!/usr/bin/env python3
"""Single-finger touch scrolling for Hyprland, injected as a uinput virtual wheel."""

import fcntl
import glob
import json
import os
import re
import select
import struct
import subprocess
import sys
import time

EV_SYN, EV_KEY, EV_REL, EV_ABS = 0x00, 0x01, 0x02, 0x03
SYN_REPORT, SYN_DROPPED = 0x00, 0x03
BTN_LEFT, BTN_RIGHT, BTN_MIDDLE, BTN_TOUCH = 0x110, 0x111, 0x112, 0x14A
ABS_MT_SLOT, ABS_MT_TRACKING_ID = 0x2F, 0x39
ABS_MT_POSITION_X, ABS_MT_POSITION_Y = 0x35, 0x36
REL_X, REL_Y, REL_HWHEEL, REL_WHEEL = 0x00, 0x01, 0x06, 0x08
REL_HWHEEL_HI_RES, REL_WHEEL_HI_RES = 0x0C, 0x0B

EVENT = struct.Struct("llHHi")
SETUP = struct.Struct("80s4H" + "i" + "i" * 256)
UI_SET_EVBIT, UI_SET_KEYBIT, UI_SET_RELBIT, UI_SET_PROPBIT = (0x40045500 + n for n in (100, 101, 102, 107))
UI_DEV_CREATE, UI_DEV_DESTROY = 0x5501, 0x5502
INPUT_PROP_POINTER = 0x00
NOTCH = 120
TICK = 0.016
BITMAP = 64

WHEEL_UNITS_PER_SCREEN = float(os.environ.get("WHEEL_UNITS_PER_SCREEN", "2400"))
NATURAL = os.environ.get("NATURAL", "1") not in ("0", "", "no", "false")
MOMENTUM = float(os.environ.get("MOMENTUM", "0.35"))
FRICTION = float(os.environ.get("FRICTION", "0.94"))
TAP_CLICK = os.environ.get("TAP_CLICK", "0") not in ("0", "", "no", "false")
TAP_MS = int(os.environ.get("TAP_MS", "300"))
SLOP = int(os.environ.get("DRAG_SLOP", "12"))
DEBUG = os.environ.get("TOUCHSCROLL_DEBUG", "0") not in ("0", "", "no", "false")


def log(*args):
    print(time.strftime("%H:%M:%S"), *args, file=sys.stderr, flush=True)


def ioctl(fd, request, arg=0):
    return fcntl.ioctl(fd, request, arg)


def ioc(direction, typ, nr, size):
    return (direction << 30) | (typ << 8) | nr | (size << 16)


def ev_bits(fd, event):
    return ioctl(fd, ioc(2, ord("E"), 0x20 + event, BITMAP), b"\0" * BITMAP)


def has(bitmap, code):
    return bool(bitmap[code // 8] >> (code % 8) & 1)


def abs_info(fd, code):
    return struct.unpack("6i", ioctl(fd, ioc(2, ord("E"), 0x40, 24) | code, b"\0" * 24))


def is_touchscreen(fd):
    keys, axes = ev_bits(fd, EV_KEY), ev_bits(fd, EV_ABS)
    return (
        has(keys, BTN_TOUCH)
        and not has(keys, BTN_LEFT)
        and all(has(axes, code) for code in (ABS_MT_SLOT, ABS_MT_TRACKING_ID, ABS_MT_POSITION_X, ABS_MT_POSITION_Y))
    )


def device_name(path):
    match = re.search(r"event\d+", path)
    if not match:
        return path
    link = "/sys/class/input/" + match.group(0) + "/device/name"
    try:
        return open(link).read().strip()
    except OSError:
        return path


def find_touchscreen():
    pinned = os.environ.get("TOUCHSCROLL_DEVICE")
    if pinned:
        return pinned
    for path in sorted(glob.glob("/dev/input/event*"), key=lambda p: int(p.rsplit("event", 1)[-1])):
        try:
            fd = os.open(path, os.O_RDONLY)
        except OSError:
            continue
        try:
            if is_touchscreen(fd):
                return path
        finally:
            os.close(fd)
    return None


def screen_size():
    try:
        out = subprocess.run(["hyprctl", "monitors", "-j"], capture_output=True, text=True, timeout=3).stdout
        monitors = [m for m in json.loads(out) if m.get("width")]
        if monitors:
            active = [m for m in monitors if m.get("active")] or monitors
            return int(active[0]["width"]), int(active[0]["height"])
    except Exception:
        pass
    return 1920, 1200


_transform_cache = (0.0, 0)


def screen_transform():
    # Read the live monitor transform rather than input:touchdevice:transform.
    # Rotation is applied per-device via hl.device{}, so the global option stays
    # at its default and would always report 0 once the screen is turned.
    #
    # Called once per frame, so the hyprctl round-trip is cached briefly -
    # rotation changes are rare and a second of lag is invisible.
    global _transform_cache
    cached_at, cached = _transform_cache
    now = time.monotonic()
    if now - cached_at < 0.5:
        return cached

    value = 0
    try:
        out = subprocess.run(["hyprctl", "monitors", "-j"], capture_output=True, text=True, timeout=3).stdout
        monitors = [m for m in json.loads(out) if m.get("width")]
        if monitors:
            active = [m for m in monitors if m.get("active")] or monitors
            value = int(active[0].get("transform", 0))
    except Exception:
        value = cached

    _transform_cache = (now, value)
    return value


def orient(x, y, transform):
    if transform == 1:
        return -y, x
    if transform == 2:
        return -x, -y
    if transform == 3:
        return y, -x
    return x, y


class VirtualWheel:
    def __init__(self):
        self.fd = os.open("/dev/uinput", os.O_WRONLY)
        ioctl(self.fd, UI_SET_EVBIT, EV_REL)
        ioctl(self.fd, UI_SET_EVBIT, EV_KEY)
        for code in (BTN_LEFT, BTN_RIGHT, BTN_MIDDLE):
            ioctl(self.fd, UI_SET_KEYBIT, code)
        for code in (REL_X, REL_Y, REL_WHEEL, REL_HWHEEL, REL_WHEEL_HI_RES, REL_HWHEEL_HI_RES):
            ioctl(self.fd, UI_SET_RELBIT, code)
        ioctl(self.fd, UI_SET_PROPBIT, INPUT_PROP_POINTER)
        os.write(self.fd, SETUP.pack(b"touchscroll".ljust(80, b"\0"), 0x03, 0x465A, 0x1204, 0x0001, *([0] * 257)))
        ioctl(self.fd, UI_DEV_CREATE)
        self.vertical = 0.0
        self.horizontal = 0.0

    def event(self, typ, code, value):
        return EVENT.pack(0, 0, typ, code, value)

    def scroll(self, vertical, horizontal):
        self.vertical += vertical
        self.horizontal += horizontal
        events = b""
        for name, hi, lo in (("vertical", REL_WHEEL_HI_RES, REL_WHEEL), ("horizontal", REL_HWHEEL_HI_RES, REL_HWHEEL)):
            acc = getattr(self, name)
            if abs(acc) < 1.0:
                continue
            detents = int(acc / NOTCH)
            if detents:
                events += self.event(EV_REL, lo, detents)
                events += self.event(EV_REL, hi, detents * NOTCH)
                acc -= detents * NOTCH
                setattr(self, name, acc)
            events += self.event(EV_REL, hi, int(round(acc)))
        if events:
            os.write(self.fd, events + self.event(EV_SYN, SYN_REPORT, 0))

    def click(self):
        os.write(self.fd, self.event(EV_KEY, BTN_LEFT, 1) + self.event(EV_SYN, SYN_REPORT, 0))
        time.sleep(0.03)
        os.write(self.fd, self.event(EV_KEY, BTN_LEFT, 0) + self.event(EV_SYN, SYN_REPORT, 0))

    def close(self):
        try:
            ioctl(self.fd, UI_DEV_DESTROY)
        finally:
            os.close(self.fd)


class TouchReader:
    def __init__(self, path, slots):
        self.fd = os.open(path, os.O_RDONLY)
        self.slots = slots
        self.slot = 0
        self.state = [None] * slots
        self.touching = False
        self.pending = False
        self.dropped = False

    def close(self):
        os.close(self.fd)

    def reset(self):
        self.slot = 0
        self.state = [None] * self.slots
        self.touching = False
        self.pending = False
        self.dropped = False

    def frames(self):
        data = os.read(self.fd, EVENT.size * 256)
        for offset in range(0, len(data) - EVENT.size + 1, EVENT.size):
            _, _, typ, code, value = EVENT.unpack_from(data, offset)
            if typ == EV_SYN:
                if code == SYN_DROPPED:
                    self.dropped = True
                elif self.dropped:
                    self.reset()
                elif self.pending:
                    self.pending = False
                    yield
                continue
            if typ == EV_KEY and code == BTN_TOUCH:
                self.touching = value == 1
                self.pending = True
            elif typ == EV_ABS:
                self.pending = True
                if code == ABS_MT_SLOT:
                    self.slot = max(0, min(value, self.slots - 1))
                elif code == ABS_MT_TRACKING_ID:
                    if value < 0:
                        self.state[self.slot] = None
                    else:
                        self.state[self.slot] = {**(self.state[self.slot] or {}), "id": value}
                elif code in (ABS_MT_POSITION_X, ABS_MT_POSITION_Y):
                    key = "x" if code == ABS_MT_POSITION_X else "y"
                    if self.state[self.slot] is None:
                        self.state[self.slot] = {"id": None}
                    self.state[self.slot][key] = value

    def contacts(self):
        if not self.touching:
            return []
        return [s for s in self.state if s is not None and s.get("id") is not None and "x" in s and "y" in s]


class TouchScroll:
    def __init__(self):
        self.device = find_touchscreen()
        if not self.device:
            raise SystemExit("touchscroll: no touchscreen found")

        fd = os.open(self.device, os.O_RDONLY)
        try:
            slots = abs_info(fd, ABS_MT_SLOT)[2] + 1
            raw_x = abs_info(fd, ABS_MT_POSITION_X)[2]
            raw_y = abs_info(fd, ABS_MT_POSITION_Y)[2]
        finally:
            os.close(fd)

        width, height = screen_size()
        self.scale_x = WHEEL_UNITS_PER_SCREEN / max(raw_x, 1)
        self.scale_y = WHEEL_UNITS_PER_SCREEN / max(raw_y, 1)
        self.reader = TouchReader(self.device, max(slots, 2))
        self.wheel = VirtualWheel()

        self.active = None
        self.dragging = False
        self.multi = False
        self.down_at = 0.0
        self.travel = 0.0
        self.last_frame = 0.0
        self.vx = self.vy = 0.0
        self.coast = (0.0, 0.0)

        log(f"device={self.device} ({device_name(self.device)}) raw={raw_x}x{raw_y} screen={width}x{height} slots={slots}")
        log(f"scale_x={self.scale_x:.4f} scale_y={self.scale_y:.4f} natural={NATURAL} momentum={MOMENTUM} tap_click={TAP_CLICK}")

    def on_frame(self):
        now = time.monotonic()
        dt = now - self.last_frame if self.last_frame else 0.0
        self.last_frame = now
        contacts = self.reader.contacts()

        if len(contacts) != 1:
            if len(contacts) > 1:
                self.multi = True
            if self.active is not None and not contacts:
                self.release()
            self.active = None
            self.dragging = False
            return

        point = contacts[0]
        if self.active is None:
            self.active = point
            self.down_at = now
            self.travel = 0.0
            self.dragging = False
            self.vx = self.vy = 0.0
            return

        dx = point["x"] - self.active["x"]
        dy = point["y"] - self.active["y"]
        self.active = point
        self.travel += abs(dx) + abs(dy)

        if not self.dragging:
            if self.travel < SLOP:
                return
            self.dragging = True
            self.vx = self.vy = 0.0

        if DEBUG:
            log(f"drag dx={dx} dy={dy} dt={dt:.3f}")

        # Read live: the transform changes when the accelerometer autorotates
        # the screen, and this object outlives any single orientation.
        x, y = orient(dx * self.scale_x, dy * self.scale_y, screen_transform())
        sign = -1.0 if NATURAL else 1.0
        self.wheel.scroll(y * sign, x * sign)
        self.vx += (x - self.vx) * 0.35
        self.vy += (y - self.vy) * 0.35

    def release(self):
        if TAP_CLICK and not self.dragging and not self.multi and (time.monotonic() - self.down_at) * 1000 < TAP_MS:
            self.wheel.click()
        self.dragging = False
        self.multi = False
        if MOMENTUM > 0 and (abs(self.vx) > 60 or abs(self.vy) > 60):
            self.coast = (self.vx, self.vy)
        self.vx = self.vy = 0.0

    def tick(self, elapsed):
        vx, vy = self.coast
        if abs(vx) < 10 and abs(vy) < 10:
            self.coast = (0.0, 0.0)
            return
        decay = FRICTION ** (elapsed / TICK)
        vx, vy = vx * decay, vy * decay
        self.coast = (vx, vy)
        sign = -1.0 if NATURAL else 1.0
        self.wheel.scroll(vy * elapsed * sign, vx * elapsed * sign)

    def run(self):
        while True:
            coasting = self.coast != (0.0, 0.0)
            ready, _, _ = select.select([self.reader.fd], [], [], TICK if coasting else None)
            if ready:
                for _ in self.reader.frames():
                    self.on_frame()
            elif coasting:
                self.tick(TICK)


def main():
    app = TouchScroll()
    log("started")
    try:
        app.run()
    except KeyboardInterrupt:
        pass
    finally:
        app.reader.close()
        app.wheel.close()


if __name__ == "__main__":
    main()
