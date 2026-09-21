#!/usr/bin/env python3
"""
Original Arabic-flavored hip-hop loop for Djinn's Court Chaos.
100% composed in code — no samples, no copyright issues. Leon owns it outright.

Vibe: dark, driving, Middle Eastern-inflected hip-hop (in the spirit of the
"Arab Money" era sound) — hard drums, deep 808 bass, oud-like plucked lead
in Hijaz scale, darbuka percussion accents. Original melody, original pattern.
"""
import numpy as np

SR = 44100
BPM = 100
BEAT = 60.0 / BPM
BAR = BEAT * 4
BARS = 12
DUR = BAR * BARS
N = int(SR * DUR)

rng = np.random.default_rng(7)

def adsr(n, a=0.005, d=0.05, s=0.7, r=0.08):
    env = np.ones(n)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    if na > 0: env[:na] = np.linspace(0, 1, na)
    if nd > 0: env[na:na + nd] = np.linspace(1, s, nd)
    if nr > 0: env[-nr:] = np.linspace(env[-nr - 1] if n - nr - 1 >= 0 else s, 0, nr)
    return env

def place(track, sig, t):
    i = int(t * SR)
    j = min(i + len(sig), len(track))
    if i < len(track):
        track[i:j] += sig[:j - i]

# ---------------- drums ----------------
def kick():
    t = np.arange(int(SR * 0.35)) / SR
    f = 160 * np.exp(-t * 30) + 45
    ph = np.cumsum(2 * np.pi * f / SR)
    s = np.sin(ph) * np.exp(-t * 14)
    s += 0.4 * np.sin(ph * 2) * np.exp(-t * 25)
    return s * 0.9

def snare():
    t = np.arange(int(SR * 0.25)) / SR
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    noise = rng.standard_normal(len(t)) * np.exp(-t * 22)
    return (tone * 0.5 + noise * 0.5) * 0.7

def hat(open_=False):
    dur = 0.30 if open_ else 0.06
    t = np.arange(int(SR * dur)) / SR
    n = rng.standard_normal(len(t))
    # crude highpass
    n = np.diff(n, prepend=0)
    return n * np.exp(-t * (18 if open_ else 90)) * 0.32

def clap():
    t = np.arange(int(SR * 0.2)) / SR
    n = rng.standard_normal(len(t)) * np.exp(-t * 28)
    return n * 0.35

# ---------------- 808 bass ----------------
def bass808(freq, dur):
    t = np.arange(int(SR * dur)) / SR
    f = freq * (1 + 0.9 * np.exp(-t * 25))
    ph = np.cumsum(2 * np.pi * f / SR)
    s = np.sin(ph) * np.exp(-t * 3.2)
    s += 0.25 * np.sin(2 * ph) * np.exp(-t * 6)
    return s * adsr(len(t), a=0.004, d=0.02, s=0.85, r=min(0.15, dur * 0.4)) * 0.85

# ---------------- oud-like pluck (Karplus-Strong) ----------------
def oud(freq, dur, bright=0.55):
    n = int(SR * dur)
    p = max(2, int(SR / freq))
    buf = rng.standard_normal(p) * 2 - 1
    buf = buf - np.mean(buf)
    out = np.zeros(n)
    idx = 0
    prev = 0.0
    for i in range(n):
        v = buf[idx]
        out[i] = v
        nxt = buf[(idx + 1) % p]
        buf[idx] = bright * 0.5 * (v + nxt) + (1 - bright) * prev
        prev = v
        idx = (idx + 1) % p
    env = adsr(n, a=0.003, d=0.09, s=0.55, r=min(0.25, dur * 0.5))
    return out * env * 0.5

# ---------------- darbuka ----------------
def doum():
    t = np.arange(int(SR * 0.30)) / SR
    f = 110 * np.exp(-t * 18) + 55
    ph = np.cumsum(2 * np.pi * f / SR)
    return np.sin(ph) * np.exp(-t * 12) * 0.6

def tek():
    t = np.arange(int(SR * 0.09)) / SR
    n = rng.standard_normal(len(t))
    n = np.diff(n, prepend=0)
    tone = np.sin(2 * np.pi * 900 * t) * np.exp(-t * 60)
    return (n * 0.5 + tone * 0.6) * np.exp(-t * 45) * 0.5

# ---------------- arrangement ----------------
mix = np.zeros(N)
drums = np.zeros(N)
bass = np.zeros(N)
lead = np.zeros(N)
perc = np.zeros(N)

K, S, H, HC, OH, CL = kick(), snare(), hat(), hat(), hat(open_=True), clap()
DM, TK = doum(), tek()

# dark progression: Em | Em | C | D | Em | Em | C | B | Em | Em | C | D B
roots = [82.41, 82.41, 65.41, 73.42, 82.41, 82.41, 65.41, 61.74, 82.41, 82.41, 65.41, 73.42]
# Hijaz on E: E F G# A B C D
HIJAZ = {'E': 329.63, 'F': 349.23, 'G#': 415.30, 'A': 440.0, 'B': 493.88,
         'C': 523.25, 'D': 587.33, 'E5': 659.25, 'F5': 698.46, 'G#5': 830.61}

# original 12-bar riff (call & response phrasing, original notes)
riff = [
    # bar: list of (beat_offset, note, dur_beats)
    (0, [(0.0, 'E', 0.5), (0.5, 'G#', 0.5), (1.0, 'A', 1.0), (2.0, 'G#', 0.5), (2.5, 'F', 0.5), (3.0, 'E', 1.0)]),
    (1, [(0.0, 'E', 1.5), (2.0, 'D', 0.5), (2.5, 'C', 0.5), (3.0, 'D', 1.0)]),
    (2, [(0.0, 'C', 0.5), (0.5, 'D', 0.5), (1.0, 'E', 1.0), (2.5, 'G#', 0.5), (3.0, 'A', 1.0)]),
    (3, [(0.0, 'B', 1.0), (1.0, 'A', 0.5), (1.5, 'G#', 0.5), (2.0, 'A', 2.0)]),
    (4, [(0.0, 'E5', 0.5), (0.5, 'D', 0.5), (1.0, 'C', 0.5), (1.5, 'D', 0.5), (2.0, 'E', 1.0), (3.0, 'F', 0.5), (3.5, 'G#', 0.5)]),
    (5, [(0.0, 'A', 1.5), (2.0, 'G#', 1.0), (3.0, 'F', 1.0)]),
    (6, [(0.0, 'G#', 0.5), (0.5, 'A', 0.5), (1.0, 'C', 1.0), (2.0, 'D', 0.5), (2.5, 'C', 0.5), (3.0, 'B', 1.0)]),
    (7, [(0.0, 'B', 2.0), (2.5, 'A', 0.5), (3.0, 'G#', 0.5), (3.5, 'F#', 0.5)]),  # F# passing tone for tension
    (8, [(0.0, 'E', 0.5), (0.5, 'G#', 0.5), (1.0, 'A', 1.0), (2.0, 'G#', 0.5), (2.5, 'F', 0.5), (3.0, 'E', 1.0)]),
    (9, [(0.5, 'D', 0.5), (1.0, 'E', 0.5), (1.5, 'F', 0.5), (2.0, 'G#', 1.0), (3.0, 'A', 1.0)]),
    (10, [(0.0, 'G#5', 1.0), (1.0, 'F5', 0.5), (1.5, 'E5', 0.5), (2.0, 'D', 0.5), (2.5, 'C', 0.5), (3.0, 'D', 1.0)]),
    (11, [(0.0, 'E', 1.0), (1.0, 'F', 0.5), (1.5, 'G#', 0.5), (2.0, 'A', 0.5), (2.5, 'B', 0.5), (3.0, 'E5', 1.0)]),
]
HIJAZ['F#'] = 369.99

for bar in range(BARS):
    t0 = bar * BAR
    # drums: driving pattern
    for b, sig in [(0.0, K), (1.0, S), (2.0, K), (2.5, K), (3.0, S)]:
        place(drums, sig, t0 + b * BEAT)
    if bar % 4 == 3:  # fill bar: extra kick
        place(drums, K, t0 + 3.5 * BEAT)
    for e in range(8):  # 8th hats
        place(drums, H, t0 + e * BEAT / 2)
    if bar % 2 == 1:
        place(drums, OH, t0 + 3.5 * BEAT)
    if bar in (3, 7, 11):  # clap layer on snare in fill bars
        for b in (1.0, 3.0):
            place(drums, CL, t0 + b * BEAT)
    # 808 bass: root with rhythm
    r = roots[bar]
    for b, d in [(0.0, 0.45), (1.75, 0.22), (2.5, 0.4)]:
        place(bass, bass808(r, d + 0.25), t0 + b * BEAT)
    # darbuka accents on offbeats
    for b in (0.5, 1.5, 2.5, 3.5):
        place(perc, TK if (int(b * 2) % 2 == 0) else DM, t0 + b * BEAT)
    # oud riff
    for bnum, notes in riff:
        if bnum != bar:
            continue
        for off, note, db in notes:
            place(lead, oud(HIJAZ[note], db * BEAT + 0.35), t0 + off * BEAT)

# simple slapback delay on lead for space
delay = int(SR * 0.28)
wet = np.zeros_like(lead)
wet[delay:] += lead[:-delay] * 0.28
lead = lead + wet

mix = drums * 1.0 + bass * 1.0 + lead * 0.9 + perc * 0.8

# glue: gentle saturation + normalize
mix = np.tanh(mix * 1.4)
mix = mix / max(1e-6, np.max(np.abs(mix))) * 0.89

# short fades to make the loop seamless
f = int(SR * 0.05)
mix[:f] *= np.linspace(0, 1, f)
mix[-f:] *= np.linspace(1, 0, f)

import wave
with wave.open('/tmp/court-chaos-theme.wav', 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("rendered", DUR, "seconds")
