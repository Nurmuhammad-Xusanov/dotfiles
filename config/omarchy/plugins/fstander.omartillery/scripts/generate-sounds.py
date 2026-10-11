#!/usr/bin/env python3
"""Synthesize the game's audio cues.

Everything here is generated from noise and simple oscillators, so the plugin
ships no sampled material and the sounds can be regenerated from source. Run
`python3 scripts/generate-sounds.py` from the plugin root.
"""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parent.parent / "sounds"


def write(name, samples):
    peak = max(1e-9, max(abs(s) for s in samples))
    scale = 0.86 / peak
    path = OUT / name
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(
            b"".join(
                struct.pack("<h", max(-32767, min(32767, int(s * scale * 32767))))
                for s in samples
            )
        )
    print(f"{name}: {len(samples) / RATE:.2f}s")


def envelope(i, count, attack=0.01, release=0.6):
    t = i / count
    if t < attack:
        return t / attack
    decay = 1 - (t - attack) / max(1e-6, release)
    return decay**1.6 if decay > 0 else 0.0


def noise_burst(duration, cutoff_start, cutoff_end, attack=0.004, release=0.9):
    """Filtered noise: a one-pole lowpass whose corner sweeps down over time."""
    count = int(RATE * duration)
    out = []
    state = 0.0
    for i in range(count):
        t = i / count
        cutoff = cutoff_start + (cutoff_end - cutoff_start) * t
        alpha = 1 - math.exp(-2 * math.pi * cutoff / RATE)
        state += alpha * (random.uniform(-1, 1) - state)
        out.append(state * envelope(i, count, attack, release))
    return out


def tone(duration, f0, f1, shape="sine", attack=0.01, release=0.8, detune=0.0):
    count = int(RATE * duration)
    out = []
    phase = 0.0
    phase2 = 0.0
    for i in range(count):
        t = i / count
        freq = f0 * (f1 / f0) ** t
        phase += 2 * math.pi * freq / RATE
        phase2 += 2 * math.pi * freq * (1 + detune) / RATE
        if shape == "square":
            value = (1 if math.sin(phase) >= 0 else -1) * 0.5
        else:
            value = math.sin(phase)
            if detune:
                value = (value + math.sin(phase2)) * 0.5
        out.append(value * envelope(i, count, attack, release))
    return out


def mix(*layers):
    length = max(len(layer) for layer in layers)
    out = [0.0] * length
    for layer in layers:
        for i, value in enumerate(layer):
            out[i] += value
    return out


def main():
    random.seed(20260912)
    OUT.mkdir(exist_ok=True)

    # The gun: a hard crack over a falling body thump.
    write(
        "fire.wav",
        mix(
            noise_burst(0.36, 5200, 260, attack=0.001, release=0.55),
            [v * 0.9 for v in tone(0.36, 150, 44, attack=0.002, release=0.5)],
        ),
    )
    # A shell into dirt: duller, shorter, no crack.
    write(
        "impact.wav",
        mix(
            noise_burst(0.3, 1500, 150, attack=0.002, release=0.8),
            [v * 0.5 for v in tone(0.3, 110, 40, attack=0.003, release=0.7)],
        ),
    )
    # A target coming apart: the impact plus debris rattling after it.
    write(
        "kill.wav",
        mix(
            noise_burst(0.55, 3200, 180, attack=0.001, release=0.7),
            [v * 0.6 for v in tone(0.55, 210, 52, attack=0.002, release=0.6)],
            [v * 0.25 for v in noise_burst(0.55, 900, 700, attack=0.18, release=0.9)],
        ),
    )
    # Level cleared: a clean rising third.
    write(
        "clear.wav",
        mix(
            tone(0.5, 392, 392, shape="square", attack=0.01, release=0.9),
            [v * 0.8 for v in tone(0.5, 523, 523, shape="square", attack=0.14, release=0.9)],
            [v * 0.7 for v in tone(0.5, 659, 784, shape="square", attack=0.26, release=0.9)],
        ),
    )
    # Out of shells: the same shape, falling.
    write("fail.wav", tone(0.6, 330, 110, shape="square", attack=0.01, release=0.85))
    # Gun ready.
    write("ready.wav", tone(0.16, 660, 880, shape="square", attack=0.01, release=0.9))
    # A cluster shell opening: a short, bright pop.
    write(
        "split.wav",
        mix(
            noise_burst(0.12, 6000, 2400, attack=0.002, release=0.7),
            [v * 0.5 for v in tone(0.12, 900, 500, attack=0.002, release=0.6)],
        ),
    )
    # Incoming: a distant report, lower and further away than our own gun.
    write(
        "incoming.wav",
        mix(
            noise_burst(0.42, 1400, 120, attack=0.01, release=0.75),
            [v * 0.9 for v in tone(0.42, 95, 38, attack=0.01, release=0.6)],
        ),
    )
    # The gun taking a hit: a clang with a body under it.
    write(
        "hit.wav",
        mix(
            tone(0.28, 1800, 900, attack=0.001, release=0.35, detune=0.011),
            [v * 0.8 for v in noise_burst(0.28, 3000, 200, attack=0.001, release=0.5)],
            [v * 0.7 for v in tone(0.28, 130, 50, attack=0.002, release=0.5)],
        ),
    )

    # Shell-specific material reports: a deep buried blast, a metallic roller,
    # and a longer magazine detonation. Append to keep existing cues identical.
    write("digger.wav", mix(noise_burst(0.65, 800, 80), tone(0.65, 78, 24)))
    write("roller.wav", mix(noise_burst(0.26, 2400, 400), tone(0.26, 720, 180, detune=0.03)))
    write("depot.wav", mix(noise_burst(0.95, 4200, 95), tone(0.95, 115, 28),
                          [v * 0.45 for v in noise_burst(0.95, 2200, 300, attack=0.18)]))

    # A flag of truce going up: two soft falling notes, like a bugle standing
    # the battery down, with a breath of cloth under them. Appended last so
    # every cue above keeps its place in the noise stream.
    write(
        "parley.wav",
        mix(
            tone(0.9, 587, 392, shape="sine", attack=0.05, release=0.85, detune=0.004),
            [v * 0.45 for v in tone(0.9, 294, 196, shape="sine", attack=0.08, release=0.8)],
            [v * 0.22 for v in noise_burst(0.9, 1800, 500, attack=0.25, release=0.9)],
        ),
    )


if __name__ == "__main__":
    main()
