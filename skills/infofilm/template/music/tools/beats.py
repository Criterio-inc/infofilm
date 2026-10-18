#!/usr/bin/env python3
"""Estimate tempo and beat grid of a WAV from its spectral-flux onset envelope.

  python3 music/tools/beats.py music/suno/theme.wav [bpm_min bpm_max]

Keep the search range wide (default 70–220): a narrow range reads 166 BPM as 118. Calibrated against
click tracks (126 → 126.13, 166 → 165.80). Swing tunes report both the beat and its double/half —
listen and pick. Writes <file>.beats.txt (one beat time in seconds per line).
"""
import sys
import numpy as np
from scipy.io import wavfile

path = sys.argv[1]
lo, hi = (float(sys.argv[2]), float(sys.argv[3])) if len(sys.argv) > 3 else (70.0, 220.0)
sr, x = wavfile.read(path)
x = x.astype(np.float64)
if x.ndim > 1:
    x = x.mean(1)
x /= np.abs(x).max() + 1e-9
hop, win = 256, 1024
n = 1 + (len(x) - win) // hop
frames = np.lib.stride_tricks.as_strided(x, (n, win), (x.strides[0] * hop, x.strides[0]))
mag = np.abs(np.fft.rfft(frames * np.hanning(win), axis=1))
flux = np.maximum(0, np.diff(np.log1p(100 * mag), axis=0)).sum(1)
flux = (flux - flux.mean()) / (flux.std() + 1e-9)
fps = sr / hop

# tempo: autocorrelation peak inside [lo, hi] BPM, refined with a parabola
ac = np.correlate(flux, flux, "full")[len(flux) - 1:]
lags = np.arange(int(fps * 60 / hi), int(fps * 60 / lo) + 1)
k = lags[np.argmax(ac[lags])]
a, b, c = ac[k - 1], ac[k], ac[k + 1]
period = (k + 0.5 * (a - c) / (a - 2 * b + c)) / fps
# phase: comb over the whole clip
phases = np.linspace(0, period, 200, endpoint=False)
score = [np.interp(np.arange(p, len(flux) / fps, period) * fps, np.arange(len(flux)), flux).sum() for p in phases]
phase = phases[int(np.argmax(score))]
beats = np.arange(phase, len(x) / sr, period)
print(f"tempo {60 / period:.2f} BPM  period {period:.4f} s  phase {phase:.4f} s  beats {len(beats)}")
np.savetxt(path + ".beats.txt", beats, fmt="%.4f")
