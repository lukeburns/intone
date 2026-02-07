# Note Visualizer Documentation

## Overview

The `NoteVisualizer` creates a Guitar Hero-style visualization showing notes as they're played with horizontal position representing the tuning deviation from equal temperament.

## Visual Design

### Layout
```
        -50¢         -25¢         0¢ (ET)      +25¢         +50¢
          │            │            │            │            │
          │            │            │            │            │
          │            │     ┌──────┤            │
          │            │     │ C4   │            │
          │            │     │+12.5¢│            │
          │            │     └──────┘            │
          │            │       ║                 │
          │            └───────╫─────────────────┘
          │                    ║
          │                    ║
          └────────────────────╨─────────────────
```

### Features

**1. Scrolling Note Trails**
- Notes scroll upward from bottom to top (like Guitar Hero)
- Each note leaves a colored trail showing its path
- Trail width: 8px with rounded caps
- Gradient fade from transparent (bottom) to solid (top)

**2. Horizontal Position = Tuning**
- Center line = Equal Temperament (0 cents deviation)
- Left of center = Flat (negative cents)
- Right of center = Sharp (positive cents)
- ±50 cents maximum deviation shown

**3. Note Head (Active Notes)**
- Colored outer circle (15px radius) matching note class
- White inner circle (10px radius)
- Note name label (e.g., "C4")
- Cents deviation below (e.g., "+12.5¢")

**4. Color Coding by Note Class**
Each chromatic note has a unique color:
```
C   - Red      (#FF6B6B)
C#  - Orange   (#FFB347)
D   - Yellow   (#FFD93D)
D#  - Lt Green (#95E77D)
E   - Green    (#6BCF7F)
F   - Turquoise(#4ECDC4)
F#  - Lt Blue  (#45B7D1)
G   - Blue     (#5DADE2)
G#  - Purple   (#8E7CC3)
A   - Violet   (#C77DFF)
A#  - Pink     (#FF6EC7)
B   - Rose     (#FF8FA3)
```

### Reference Guides

**Center Line (Dashed)**
- Vertical dashed line at center
- Label: "Equal Temperament"
- Shows the reference tuning

**Scale Markers**
- Bottom tick marks at -50, -25, 0, +25, +50 cents
- Labels show deviation (e.g., "+25¢")

## How It Works

### Cents Calculation

**What are Cents?**
A logarithmic unit of musical pitch. 100 cents = 1 semitone.

```javascript
cents = 1200 × log₂(actualFreq / equalTempFreq)
```

**Examples:**
- Just major third (5:4) = +13.7 cents from ET
- Just perfect fifth (3:2) = +2.0 cents from ET
- Pythagorean comma = 23.5 cents

### Position Mapping

```javascript
centerX = canvas.width / 2
pixelsPerCent = 100 / 50  // 2 pixels per cent
x = centerX + (cents × pixelsPerCent)
```

**Range:**
- -50 cents → 100px left of center
- 0 cents → center
- +50 cents → 100px right of center

### Animation Loop

1. **noteOn()**: Start tracking note
   - Calculate cents deviation
   - Determine X position
   - Create first segment at bottom
   - Start animation loop

2. **animate()**: Each frame (~60fps)
   - Move all segments upward (150 pixels/sec)
   - Add new segments for active notes
   - Draw all note trails
   - Remove off-screen segments
   - Continue if any notes active

3. **noteOff()**: Mark note for release
   - Note marked as "released"
   - Trail continues scrolling upward
   - Removed when completely off-screen

### Data Structure

```javascript
activeNotes = Map<midiNote, {
  startTime: number,           // When note started
  frequency: number,           // Just intonation frequency
  equalTempFreq: number,       // Equal temperament frequency
  cents: number,               // Deviation in cents
  x: number,                   // Horizontal position
  segments: [                  // Trail segments
    { x, y, time }
  ],
  color: string,               // Note color
  label: string,               // Note name (e.g., "C4")
  released: boolean,           // Has key been released?
  releaseTime: number          // When was it released?
}>
```

## Usage

### Initialization
```javascript
import { NoteVisualizer } from './visualizer.js';

const visualizer = new NoteVisualizer('canvasElementId');
```

### Note Events
```javascript
// When note plays
visualizer.noteOn(midiNote, actualFrequency);

// When note releases
visualizer.noteOff(midiNote);

// Clear all notes
visualizer.clear();

// Stop animation
visualizer.stop();
```

## Musical Insights

### What You'll See

**Monosynth (Sequential Tuning):**
- Notes show cumulative drift from equal temperament
- Each note's position relative to previous note
- Can drift significantly over long melodic passages
- Pattern shows the "journey" through tuning space

**PolySynth (Bass-Driven):**
- Multiple simultaneous trails
- All notes positioned relative to bass (lowest note)
- Chords show their harmonic relationships visually
- Pure triads cluster in specific patterns

### Common Patterns

**Major Triad (4:5:6):**
```
G  ─────────────── +2¢   (perfect fifth)
E  ──────────── +14¢     (major third)
C  ────── 0¢             (root/bass)
```

**Minor Triad (10:12:15):**
```
G  ─────────────── +2¢
Eb ─────────── +16¢
C  ────── 0¢
```

**Pythagorean Tuning:**
- Perfect fifths: ~+2 cents
- Major thirds: ~+14 cents
- Minor thirds: ~-16 cents

## Performance

### Optimization
- Pre-allocated canvas context
- Efficient segment pruning (removes off-screen)
- RequestAnimationFrame for smooth 60fps
- Stops animation when no active notes
- Gradient caching per note

### Canvas Size
- Width: 100% of container
- Height: 400px fixed
- Responsive to window resize
- Retina/HiDPI ready

## Visual Parameters (Tunable)

```javascript
scrollSpeed = 150           // pixels per second
maxDeviation = 50          // max cents to display (±50)
noteHeight = 30            // size of note head
trailOpacity = 0.8         // trail transparency
lineWidth = 8              // trail thickness
noteRadius = 15            // outer circle radius
innerRadius = 10           // inner circle radius
```

## Future Enhancements

Possible additions:
1. **Harmonic lattice grid** - Show pure interval positions
2. **History mode** - Leave permanent trails
3. **Zoom control** - Adjust cents range (±25, ±50, ±100)
4. **Spectral analysis** - Show harmonics
5. **Beat visualization** - Show interference patterns
6. **Recording/playback** - Save and replay visualizations
7. **Export** - Save as image/video
8. **Tuning overlays** - Compare to different tuning systems

## Integration

Works with both monosynth and polysynth:
- Automatic frequency tracking
- Scales with any number of simultaneous notes
- Frame-rate independent animation
- Zero-config setup (just pass canvas ID)
