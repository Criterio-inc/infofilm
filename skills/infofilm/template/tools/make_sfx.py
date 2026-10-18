#!/usr/bin/env python3
"""Synthesise the house sound effects into video/public/sfx/ (48 kHz mono WAV). No samples, no licences.

  python3 tools/make_sfx.py
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
OUT = Path(__file__).resolve().parent.parent / "video/public/sfx"
rng = np.random.default_rng(7)


def t(sec):
    return np.arange(int(SR * sec)) / SR


def env(n, attack=0.005, release=None):
    e = np.ones(n)
    a = max(1, int(SR * attack))
    e[:a] = np.linspace(0, 1, a)
    if release:
        r = min(n, int(SR * release))
        e[-r:] *= np.linspace(1, 0, r)
    return e


def lowpass(x, k):
    """One-pole low-pass with a per-sample coefficient (0..1, higher = brighter)."""
    y, acc = np.empty_like(x), 0.0
    k = np.broadcast_to(k, x.shape)
    for i, v in enumerate(x):
        acc += k[i] * (v - acc)
        y[i] = acc
    return y


def write(name, x, gain=0.8):
    x = x / (np.abs(x).max() + 1e-9) * gain
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def whoosh():
    tt = t(0.6)
    sweep = np.sin(np.pi * tt / tt[-1]) ** 2
    return lowpass(rng.standard_normal(len(tt)), 0.02 + 0.25 * sweep) * sweep


def hit():
    tt = t(0.35)
    body = np.sin(2 * np.pi * (90 * tt - 60 * tt ** 2)) * np.exp(-tt * 14)
    click = lowpass(rng.standard_normal(len(tt)), 0.5) * np.exp(-tt * 90)
    return body + 0.5 * click


def tick():
    tt = t(0.06)
    return np.sin(2 * np.pi * 2200 * tt) * np.exp(-tt * 120)


def ding():
    tt = t(1.4)
    return sum(a * np.sin(2 * np.pi * f * tt) for f, a in ((1320, 1), (2640, 0.35), (3960, 0.12))) * np.exp(-tt * 3.2) * env(len(tt))


def pop():
    tt = t(0.12)
    return np.sin(2 * np.pi * (400 * tt + 2600 * tt ** 2)) * np.exp(-tt * 40) * env(len(tt), 0.002)


def riser():
    tt = t(1.5)
    noise = lowpass(rng.standard_normal(len(tt)), 0.01 + 0.3 * (tt / tt[-1]) ** 2)
    tone = np.sin(2 * np.pi * (200 * tt + 260 * tt ** 2))
    return (noise + 0.4 * tone) * (tt / tt[-1]) ** 2 * env(len(tt), release=0.05)


def shutter():
    tt = t(0.18)
    n = lowpass(rng.standard_normal(len(tt)), 0.6)
    return n * (np.exp(-tt * 70) + 0.8 * np.exp(-np.maximum(0, tt - 0.08) * 70) * (tt > 0.08))


def type_():
    tt = t(0.05)
    return lowpass(rng.standard_normal(len(tt)), 0.7) * np.exp(-tt * 160)


for name, fn in (("whoosh", whoosh), ("hit", hit), ("tick", tick), ("ding", ding), ("pop", pop),
                 ("riser", riser), ("shutter", shutter), ("type", type_)):
    write(name, fn())
print(f"8 sound effects in {OUT}")
