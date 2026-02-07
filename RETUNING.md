# Bass Retuning Modes

## Overview

The polysynth supports three different behaviors when the bass note (lowest playing note) changes. This affects how existing notes respond to the new harmonic reference.

## The Problem

When you release the bass note in a chord, a new lowest note becomes the harmonic reference. This creates a choice:

1. **Keep existing notes at their current frequency** - Simple, smooth, but may no longer be in pure just intonation with the new bass
2. **Retune existing notes** - Maintains pure just intonation, but creates pitch changes

## The Three Modes

### 1. Static Mode (Default) ✓

**Behavior:** Notes keep their original tuning when bass changes.

**Example:**
```
Play: C4-E4-G4 (C major triad)
- C4: 261.63 Hz (bass)
- E4: 327.03 Hz (5:4 from C)
- G4: 392.44 Hz (3:2 from C)

Release C4:
- E4: Still 327.03 Hz ✓
- G4: Still 392.44 Hz ✓
- New bass is E4

Play new note B4:
- B4: 545.05 Hz (5:3 from E4, the new bass)
```

**Pros:**
- ✅ No pitch glitches or artifacts
- ✅ Smooth, natural sound
- ✅ Predictable behavior
- ✅ Works well with sustain pedal
- ✅ Low CPU usage

**Cons:**
- ❌ Existing notes may not be in pure just intonation with new bass
- ❌ Can create subtle dissonances if bass changes frequently

**Use For:**
- Normal playing
- Piano-style performance
- Live performance
- Most musical situations

### 2. Smooth Mode (Portamento)

**Behavior:** Notes glide smoothly to new tuning over 200ms when bass changes.

**Example:**
```
Play: C4-E4-G4
- C4: 261.63 Hz (bass)
- E4: 327.03 Hz (5:4 from C)
- G4: 392.44 Hz (3:2 from C)

Release C4:
- E4: Stays 327.03 Hz (now the bass)
- G4: Glides from 392.44 Hz → 392.04 Hz (6:5 from E4)
  [200ms smooth transition]
```

**Pros:**
- ✅ Maintains just intonation after transition
- ✅ No harsh pitch jumps
- ✅ Can sound musical (like slide guitar/theremin)
- ✅ Interesting for experimental music

**Cons:**
- ❌ Pitch glides may sound unintended
- ❌ More CPU intensive (continuous frequency updates)
- ❌ Can be confusing if bass changes rapidly
- ❌ May sound "out of tune" during transition

**Use For:**
- Drone music with shifting harmonies
- Experimental/ambient compositions
- Slow, sustained chords
- Demonstrating just intonation principles
- Theremin-like effects

### 3. Instant Mode

**Behavior:** Notes immediately snap to new tuning when bass changes.

**Example:**
```
Play: C4-E4-G4
- C4: 261.63 Hz (bass)
- E4: 327.03 Hz (5:4 from C)
- G4: 392.44 Hz (3:2 from C)

Release C4:
- E4: Stays 327.03 Hz (now the bass)
- G4: INSTANTLY 392.04 Hz (6:5 from E4)
  [Sudden pitch jump: -1.76 cents]
```

**Pros:**
- ✅ Always perfectly in tune with bass
- ✅ Mathematically "correct"
- ✅ Educational value
- ✅ Low CPU (one-time calculation)

**Cons:**
- ❌ **Very noticeable pitch glitches**
- ❌ Sounds like tuning errors
- ❌ Unmusical in most contexts
- ❌ Can be jarring

**Use For:**
- Education/demonstration
- Understanding just intonation mechanics
- Algorithmic/computer-controlled composition
- Not recommended for normal playing

## Implementation Details

### Detection

The system detects bass changes when:
1. A voice with MIDI note matching current bass is released
2. There are still other active voices
3. A new lowest voice exists

### Calculation

For each active voice (except the new bass):
```javascript
newFreq = newBassFreq × justInterval(newBassNote → voiceNote)
```

### Retuning Methods

**Instant:**
```javascript
oscillator.frequency.setValueAtTime(newFreq, now)
```

**Smooth:**
```javascript
oscillator.frequency.setValueAtTime(currentFreq, now)
oscillator.frequency.exponentialRampToValueAtTime(newFreq, now + 0.2)
```

### Tracking

Each voice tracks:
- `tunedToBassNote` - Which bass note it was tuned against
- `tunedToBassFreq` - The frequency of that bass note
- `frequency` - Current playing frequency

## Musical Examples

### Example 1: Chord Inversion

**Setup:** Static mode

```
Play C-E-G (C major)
Release C (E becomes bass)
Result: E-G sounds as minor 3rd (still pure from original C)
```

**Setup:** Smooth mode
```
Play C-E-G
Release C
Result: G glides slightly sharper to be pure 5th from E
```

### Example 2: Pedal Point Release

**Setup:** Static mode (recommended)

```
Play C (bass pedal tone)
Play D-F-A-C above (Dm7)
Release bass C
Result: Chord stays stable, D becomes new bass
```

**Setup:** Smooth mode
```
Play C
Play D-F-A-C above
Release C
Result: All upper notes glide to retune to D
        Creates warbling effect
```

### Example 3: Drone Music

**Setup:** Smooth mode (interesting)

```
Play and hold: C-E-G-B-D-F#
Slowly release notes one by one from bottom
Result: Evolving harmonic space as each note recontextualizes
```

## Recommendations

### By Musical Style

| Style | Recommended Mode |
|-------|-----------------|
| Classical/Jazz | Static |
| Pop/Rock | Static |
| Piano performance | Static |
| Drone/Ambient | Smooth or Static |
| Experimental | Any (explore!) |
| Educational | Instant (to hear differences) |
| Algorithmic | Smooth or Instant |

### By Sustain Pedal Usage

- **With pedal:** Static only (smooth transitions with held notes sound weird)
- **Without pedal:** Any mode works

### Performance Tips

1. Start with **Static mode** - it behaves most naturally
2. Try **Smooth mode** with long, sustained chords
3. Use **Instant mode** briefly to understand the math, then switch back
4. Bass changes are rare in normal playing, so mode choice often doesn't matter

## Visualizer Integration

The visualizer shows retuning in real-time:
- **Static:** Trails stay at their horizontal position
- **Smooth:** Trails gradually shift horizontally during glide
- **Instant:** Trails suddenly jump horizontally (visible glitch)

Watch the visualizer to see exactly what's happening!

## Technical Notes

### Performance

- Static: No computational cost when bass changes
- Smooth: Minimal cost (exponentialRampToValueAtTime is efficient)
- Instant: Negligible cost (single setValueAtTime call)

### Limitations

- Retuning only happens on bass **release**, not on bass **addition** below existing notes
- Very rapid bass changes may cause overlapping retunes (smooth mode)
- Exponential ramps can't go through zero frequency (not an issue for musical ranges)

## Future Enhancements

Possible improvements:
1. **Adjustable glide time** for smooth mode (currently fixed at 200ms)
2. **Per-voice retune enable** - only retune certain notes
3. **Retune on bass addition** - even when bass note played below existing notes
4. **Smart retune** - only retune if deviation is above threshold
5. **Retune mode per interval** - different behavior for different intervals
