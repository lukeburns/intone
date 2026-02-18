# Split Keyboard Mode Implementation

## Overview
Added split keyboard mode to explore just intonation behavior with independent vs. shared reference notes across left and right hands.

**Key Innovation**: In independent mode, the right keyboard is **virtually transposed down by 1 octave** so both keyboards can play the same note names (e.g., both can play C4, E4, G4) at potentially different frequencies, allowing direct comparison of how identical melodic content evolves in separate just intonation systems.

## Split Point
- **MIDI Note 60 (C4 / Middle C)** is the physical split point
- Left keyboard: Physical MIDI notes ≤ 60
- Right keyboard: Physical MIDI notes > 60
- **Right keyboard transposes down 12 semitones** (1 octave) for pitch calculations in independent mode

## Three Modes

### 1. Off (Default)
- Normal behavior: all notes share a single reference based on the selected reference mode (Bass/Random/Harmonic)
- No transposition

### 2. Independent ⭐
- Left keyboard (≤C4) and right keyboard (>C4) have **completely separate references**
- **Virtual Transposition**: Right keyboard plays **1 octave lower** than the physical keys
  - Physical C5 on right keyboard → sounds as C4
  - Physical E5 on right keyboard → sounds as E4
  - This allows both keyboards to play the **same note names** simultaneously!
- Each keyboard uses "bass mode" internally (lowest note on that keyboard becomes the reference)
- **Hard panning**: Left keyboard → Left channel, Right keyboard → Right channel
- **Separate reference memory**: Each keyboard stores its own last reference frequency independently
- Allows exploration of **comma drift divergence** between two independent just intonation systems
- **Both keyboards can play the same notes** (e.g., both can play C4) at different pitches!

### 3. Shared
- Both keyboards use the **absolute lowest note** across both as the reference
- All notes tune relative to this single reference
- **Hard panning**: Left keyboard → Left channel, Right keyboard → Right channel
- **Shared reference memory**: Both keyboards use the global stored reference
- **No transposition** in shared mode (both keyboards stay in their natural ranges)
- Allows exploration of how sharing a reference affects the harmonic relationships when keyboards are separated spatially

## Key Features

### Independent Reference Memory (NEW!)
The critical fix that makes split mode work correctly:

**Problem**: Previously, when you played the right hand alone after releasing all left hand notes, it would fall back to equal temperament, making right hand notes naturally higher pitched than left hand notes.

**Solution**: Each side now maintains its own stored reference frequency:
- `leftLastReferenceFrequency` / `leftLastReferenceMidiNote` - Stores the last left hand reference
- `rightLastReferenceFrequency` / `rightLastReferenceMidiNote` - Stores the last right hand reference
- When a side goes silent and then plays again, it uses its own stored reference, maintaining pitch continuity

**In Independent Mode**:
- Left hand notes use `leftLastReference*` when restarting
- Right hand notes use `rightLastReference*` when restarting
- This ensures both hands maintain their own pitch "universes" even across silence

**In Shared Mode**:
- Both sides use the global `lastBassFrequency/lastBassMidiNote`
- Ensures unity even when one side is silent

### Stereo Panning Override
When split mode is active (Independent or Shared), the normal stereo spread settings are overridden:
- Left hand is **hard panned left** (-1)
- Right hand is **hard panned right** (+1)
- This creates a clear spatial separation, like two keyboards

### Reference Calculation
- In independent mode: `getReferenceVoice(midiNote)` calculates references separately for each side
- In shared mode: uses the global lowest note, but panning still separates the hands
- Retuning behavior respects the current retune mode (Static/Smooth/Instant)

### Dynamic Switching
- You can switch between split modes in real-time while playing
- Voices will be retuned according to the new reference structure
- Panning updates immediately

## UI Controls
- **Control Panel**: New "Split Keyboard Mode" dropdown
- **Options**:
  - Off - Single reference
  - Split - Independent references
  - Split - Shared reference

## Experimental Use Cases

### 1. The Same Melody, Two Universes 🌍🌍
Play **identical melodies** on both keyboards with **Independent mode**:
1. Left keyboard: Play C4 → E4 → G4 → C5
2. Right keyboard: Play C5 → E5 → G5 → C6 (sounds as C4 → E4 → G4 → C5 due to transposition)
3. **Result**: You're playing the "same" melody, but they'll drift to different pitches!
4. Now play C4 on BOTH keyboards simultaneously
5. **The two C4s will be at different frequencies** - they exist in separate harmonic spaces!

This is the key experiment enabled by the transposition feature.

### 2. Comma Drift Divergence Study
With **Independent mode**:
1. **Both keyboards** start on C4 (left plays physical C4, right plays physical C5 → C4)
2. Left keyboard: drift through E4 → F4 → A4 → C5
3. Right keyboard: drift through E4 → G4 → B4 → D5
4. **Each maintains pure intervals within itself**
5. Play E4 on both keyboards - they'll be at different pitches!
6. The difference is the accumulated comma drift between the two progressions

### 3. Pitch Continuity Exploration
With **Independent mode**:
1. Left keyboard: Play C4, then E4 (major third above)
2. Right keyboard: Play C5 (→C4), then E5 (→E4)
3. Release all notes
4. Play E4 on left, E5 (→E4) on right simultaneously
5. **Result**: Both Es maintain their own pitch from their respective references - they're different frequencies!

### 4. Harmonic Anchoring
Use **Shared mode** to explore:
- How both keyboards relate to a common bass note
- Effects of spatial separation while maintaining harmonic unity
- Bass note changes affect both keyboards simultaneously
- No transposition - right keyboard stays in its natural upper register

### 5. Hybrid Approach
Switch between modes mid-performance:
1. Start with Independent to establish separate harmonic territories (with transposition)
2. Switch to Shared to "lock" them together (transposition disabled, pitches jump to natural ranges)
3. Return to Independent to let them drift again

## Technical Implementation

### Files Modified
- `polysynth.js`: Core logic for split references, panning override, retuning, separate reference storage
- `polyapp.js`: UI integration, event handling, settings persistence
- `index.html`: UI controls and help text
- `settings-manager.js`: Default settings storage

### Key Methods
- `mapMidiNoteForSplit(midiNote)`: **NEW** - Applies -12 semitone transposition to right keyboard notes in independent mode
- `getReferenceVoice(forMidiNote)`: Now accepts optional MIDI note to determine which reference to use
- `getReferenceForSide(isLeftHand)`: Returns the reference for a specific side
- `setSplitMode(mode)`: Sets the split mode and updates all voices
- `calculatePanPosition()`: Overrides normal panning when split mode is active
- `retuneToNewReference()`: Now handles per-voice reference selection
- `noteOn()`: Uses side-specific stored references based on split mode, applies virtual note mapping for frequency calculations while maintaining original MIDI note for voice tracking
- `_releaseNote()`: Stores references separately for each side (using virtual notes)
- `resetReference()`: Clears all stored references (global + left + right)

### Reference Storage Variables
```javascript
// Global references (used in normal mode and shared split mode)
this.lastBassFrequency = null;
this.lastBassMidiNote = null;

// Left keyboard references (used in independent split mode)
this.leftLastReferenceFrequency = null;
this.leftLastReferenceMidiNote = null;  // Stores virtual (transposed) notes

// Right keyboard references (used in independent split mode)  
this.rightLastReferenceFrequency = null;
this.rightLastReferenceMidiNote = null;  // Stores virtual (transposed) notes

// Transposition amount for right keyboard in independent mode
this.rightKeyboardTranspose = 12;  // Semitones (1 octave down)
```

## Notes
- The split point (C4/60) is currently hardcoded but could be made configurable
- The transposition amount (12 semitones / 1 octave) is currently hardcoded
- **Voice tracking uses original MIDI notes**, but **frequency calculations use virtual (transposed) notes** in independent mode
- **Stored references save virtual notes**, ensuring pitch continuity even across mode switches
- Split mode works with all tuning systems (5-Limit, 7-Limit, Pythagorean, Harmonic)
- The visualizer shows all notes but doesn't currently distinguish between left/right keyboards
- Split mode is saved to localStorage and persists across sessions
- Reference storage ensures pitch continuity even when one keyboard goes silent
- **Transposition only applies in Independent mode** - Shared and Off modes use natural pitches

