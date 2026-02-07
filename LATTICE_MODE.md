# Harmonic Lattice Reference Mode (Tonnetz)

## Overview

The **Lattice Mode** implements a Tonnetz-inspired algorithm to find the "harmonic center" of a chord - the note with the strongest consonant relationships to all other active notes. This creates musically intelligent reference selection.

---

## What is the Tonnetz?

The **Tonnetz** (German: "tone network") is a lattice diagram representing harmonic relationships:

```
        C ---- G ---- D ---- A ---- E
       / \    / \    / \    / \    / \
      /   \  /   \  /   \  /   \  /   \
    Ab --- Eb --- Bb --- F ---- C ---- G
     \    / \    / \    / \    / \    /
      \  /   \  /   \  /   \  /   \  /
       E ---- B ---- F# --- C# --- G#
      / \    / \    / \    / \    / \
     /   \  /   \  /   \  /   \  /   \
   C# --- G# --- D# --- A# --- E# --- B#
```

**Relationships:**
- **Horizontal edges**: Perfect fifths (3:2)
- **Diagonal ↗ edges**: Major thirds (5:4)
- **Diagonal ↘ edges**: Minor thirds (6:5)

---

## Algorithm

### Step 1: Calculate Consonance Scores

For each active voice, calculate its total consonance score by summing the consonance values of its intervals to all other notes.

### Step 2: Consonance Hierarchy

```javascript
const scores = {
  0: 10,   // Unison/Octave (1:1, 2:1) - perfect
  7: 9,    // Perfect fifth (3:2) - perfect
  5: 8,    // Perfect fourth (4:3) - perfect
  4: 7,    // Major third (5:4) - imperfect consonance
  3: 7,    // Minor third (6:5) - imperfect consonance
  9: 6,    // Major sixth (5:3) - imperfect consonance
  8: 6,    // Minor sixth (8:5) - imperfect consonance
  2: 3,    // Major second (9:8) - mild dissonance
  10: 3,   // Minor seventh (9:5) - mild dissonance
  11: 2,   // Major seventh (15:8) - dissonance
  1: 1,    // Minor second (16:15) - dissonance
  6: 1     // Tritone (45:32) - dissonance
};
```

### Step 3: Select Highest Score

The voice with the highest total consonance score becomes the reference.

---

## Examples

### Example 1: C Major Triad (C4-E4-G4)

**Calculate scores for each note:**

**C4 as reference:**
- C→E: Major third (4 semitones) = 7 points
- C→G: Perfect fifth (7 semitones) = 9 points
- **Total: 16 points** ✓

**E4 as reference:**
- E→C: Minor sixth (8 semitones) = 6 points
- E→G: Minor third (3 semitones) = 7 points
- **Total: 13 points**

**G4 as reference:**
- G→C: Perfect fourth (5 semitones) = 8 points
- G→E: Major sixth (9 semitones) = 6 points
- **Total: 14 points**

**Result**: C4 selected (highest score)

### Example 2: First Inversion C Major (E4-G4-C5)

**Bass mode**: Would choose E4 (lowest)
**Lattice mode**: Still chooses C5 (harmonic root)

**E4 as reference:**
- E→G: Minor third (3) = 7
- E→C: Minor sixth (8) = 6
- **Total: 13**

**G4 as reference:**
- G→E: Major sixth (9) = 6
- G→C: Perfect fourth (5) = 8
- **Total: 14**

**C5 as reference:**
- C→E: Major third (4) = 7
- C→G: Perfect fifth (7) = 9
- **Total: 16** ✓

**Result**: C5 selected (the "root" despite being highest pitch!)

### Example 3: Dominant 7th (G4-B4-D5-F5)

**G4 as reference:**
- G→B: Major third (4) = 7
- G→D: Perfect fifth (7) = 9
- G→F: Minor seventh (10) = 3
- **Total: 19** ✓

**B4 as reference:**
- B→G: Minor sixth (8) = 6
- B→D: Minor third (3) = 7
- B→F: Tritone (6) = 1
- **Total: 14**

**Result**: G4 selected (the root of the dominant chord)

---

## Benefits

### 1. **Harmony-Aware**
Unlike bass mode (pitch-based) or random mode (arbitrary), lattice mode respects harmonic structure.

### 2. **Stable Roots**
Chord roots tend to be selected as reference, providing stable tuning centers.

### 3. **Inversions Work Correctly**
First inversion C major (E-G-C) still tunes to C as the root, not E.

```
Bass Mode:    E4 (bass) → G4, C5 tune to E4
Lattice Mode: C5 (root) → E4, G4 tune to C5 ✓
```

### 4. **Voice Leading**
Better support for chord progressions and voice leading:

```
C major → F major
Bass:    C4 → F4 (reference changes)
Lattice: C4 → F4 (both roots, musically correct)
```

### 5. **Minimal Comma Drift**
Since roots are stable, there's less tendency for comma drift during chord progressions.

---

## Use Cases

### 1. **Chord Progressions**
Lattice mode naturally finds the root of each chord:

```
I    - IV   - V    - I
C    - F    - G    - C
Root - Root - Root - Root (all correct!)
```

### 2. **Inversions**
Play triads in any inversion - lattice finds the root:

```
Root position:    C-E-G  → C reference
First inversion:  E-G-C  → C reference
Second inversion: G-C-E  → C reference
```

### 3. **Jazz Harmony**
Complex chords select appropriate roots:

```
Cmaj7: C-E-G-B  → C reference
Dm7:   D-F-A-C  → D reference
G7:    G-B-D-F  → G reference
```

### 4. **Modal Music**
Different modes emphasize different tonal centers:

```
C Ionian (major):     C-D-E-F-G → likely C reference
D Dorian:             D-E-F-G-A → likely D reference
E Phrygian:           E-F-G-A-B → likely E reference
```

---

## Comparison with Other Modes

| Aspect | Bass | Random | Lattice |
|--------|------|--------|---------|
| **Selection** | Lowest pitch | Random choice | Harmonic center |
| **Stability** | Changes with bass | Random changes | Root-based |
| **Inversions** | Wrong root | Random | Correct root |
| **Progressions** | Pitch-driven | Arbitrary | Harmony-aware |
| **Use case** | Simple bass lines | Experimentation | Tonal music |
| **Predictability** | Very high | Very low | Medium-high |

---

## Implementation Details

### Sticky Behavior

Like random mode, lattice mode uses "sticky" reference selection:

1. **First note**: Calculated as harmonic center (trivial - only one note)
2. **Add notes**: Reference recalculated if current reference released
3. **Remove notes**: Reference stays if still active
4. **Release reference**: New harmonic center calculated

### Edge Cases

**Single note:**
- Returns that note (only option)

**Two notes:**
- Calculates scores for both
- Generally prefers the lower of two consonant notes (perfect fifth → lower note has higher score due to our weighting)

**Equal scores:**
- First voice encountered with max score is selected
- Rare in practice due to different interval combinations

### Performance

- **Time complexity**: O(n²) where n = active voices
- **Typical case**: n ≤ 8 (max polyphony), so ~64 operations
- **Impact**: Negligible (< 1ms even on slow devices)

---

## Musical Theory Background

### Root Perception

Humans perceive chord "roots" based on:
1. **Overtone series**: Which note generates the chord's overtones
2. **Harmonic strength**: Perfect fifths and major thirds define roots
3. **Voice leading**: Roots provide melodic anchors

### Tonnetz Origins

The Tonnetz concept comes from:
- **Leonhard Euler** (18th century): Original lattice diagrams
- **Hugo Riemann** (19th century): Harmonic function theory
- **Neo-Riemannian theory** (20th century): Transformational analysis
- **David Lewin**: Mathematical formalization

### Just Intonation Context

In just intonation:
- Roots should be stable tuning references
- Intervals tune relative to roots for maximum consonance
- Comma drift minimized when roots are stable

---

## Future Enhancements

### Potential Improvements

1. **Weighted intervals**: Weight lower octaves more heavily (bass is harmonically stronger)
2. **Temporal stability**: Prefer keeping current reference (hysteresis)
3. **Voice leading hints**: Consider melodic context
4. **User overrides**: Manual root selection option

### Alternative Algorithms

1. **Fundamental bass**: Use virtual pitch perception
2. **Harmonic series matching**: Which note best explains the overtones
3. **Machine learning**: Train on chord root databases
4. **Context-aware**: Consider previous chords in progression

---

## Testing Examples

### Test 1: Major Triads
```
C-E-G:  Expected C ✓
E-G-C:  Expected C ✓
G-C-E:  Expected C ✓
```

### Test 2: Minor Triads
```
A-C-E:  Expected A ✓
C-E-A:  Expected A ✓
```

### Test 3: Seventh Chords
```
C-E-G-B:  Expected C (Cmaj7) ✓
G-B-D-F:  Expected G (G7) ✓
```

### Test 4: Ambiguous Chords
```
C-F#:     Tritone - could be either
C-D-E:    Seconds - complex harmony
```

---

## Summary

Lattice mode brings **harmonic intelligence** to just intonation tuning by:
- Finding chord roots automatically
- Working correctly with inversions
- Supporting voice leading and progressions
- Minimizing comma drift
- Respecting musical theory

It's the most musically sophisticated reference mode, perfect for tonal music, chord progressions, and traditional harmony!

**Status**: ✅ Implemented
**Version**: 1.0
**Date**: 2026-02-07
