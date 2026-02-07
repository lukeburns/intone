# PolySynth Implementation Summary

## Architecture Overview

### Voice Management
- **Voice Pool**: Pre-allocated array of 8 Voice objects
- **Voice Allocation**: 
  1. Check if note is already playing (retrigger)
  2. Find inactive voice
  3. Steal oldest voice if all active
- **Voice Stealing**: Based on noteOnTime (oldest-first)

### Bass-Driven Tuning
- The **lowest MIDI note** currently playing becomes the reference
- All other notes calculate their frequency relative to this bass note
- Uses `getLowestActiveVoice()` to find the bass note
- When bass releases, next lowest note becomes new reference

### Key Differences from Monosynth

| Aspect | Monosynth | PolySynth |
|--------|-----------|-----------|
| Voices | 1 | 8 |
| Reference | Last played note | Lowest playing note |
| Voice Management | Simple replace | Pool with allocation |
| Use Case | Melody | Harmony/Chords |
| Tuning Type | Sequential | Harmonic |

## Files Created

1. **polysynth.js**
   - `Voice` class: Individual synthesizer voice
   - `PolySynth` class: Main polyphonic synth engine
   - Bass-driven just intonation logic

2. **polyapp.js**
   - Application logic for polysynth
   - UI updates for voice count, bass note, active notes
   - MIDI event handling

3. **poly.html**
   - UI for polysynth (pink/red theme)
   - Status display for polyphonic info
   - Same ADSR and filter controls as monosynth

4. **start.html**
   - Landing page to choose mono or poly
   - Explains the difference between the two

## Musical Characteristics

### Bass-Driven Advantages
- **Stable Harmony**: Chords always tuned relative to bass
- **Pure Triads**: Major/minor triads are perfectly in tune
- **Traditional**: Mimics how harmony works in Western music

### Bass-Driven Challenges
- **Inversions Matter**: C-E-G sounds different than E-G-C
- **Reference Changes**: When bass releases, tuning reference shifts
- **Voice Leading**: Not optimized for melodic voice leading

## Future Enhancements (Ideas Discussed)

1. **Random Reference Mode**: Each note picks random active voice
   - Creates unpredictable, evolving tuning
   - Generative music applications
   
2. **Harmonic Lattice Mode**: Tonnetz-inspired
   - All notes have fixed position in harmonic space
   - Most "correct" but complex to implement
   - Handles comma problem

3. **Tuning Mode Selector**: Let user choose:
   - Bass-driven (current)
   - Sequential (monosynth-style)
   - Random
   - Lattice
   - Equal temperament (fallback)

4. **Voice Visualization**: Visual indicators showing which voices are active

5. **Configurable Polyphony**: Let user choose 4/8/16 voices

## Technical Notes

### Voice Class
- Self-contained audio graph per voice
- Manages own oscillator, filter, gain envelope
- Independent ADSR envelopes per voice
- Clean disconnect on release

### Performance
- Pre-allocated voice pool (no GC pressure)
- Efficient voice lookup with Array.find()
- Exponential release ramps for smooth fade
- Lower per-voice gain (0.6 vs 0.8) to prevent clipping

### Tuning Calculation
```javascript
// Monosynth
frequency = justIntervals.getJustFrequency(
  lastPlayedFrequency,  // Sequential reference
  lastPlayedNote,
  midiNote
);

// PolySynth  
const bassVoice = getLowestActiveVoice();
frequency = justIntervals.getJustFrequency(
  bassVoice.frequency,  // Bass reference
  bassVoice.midiNote,
  midiNote
);
```

## Testing Suggestions

1. **Pure Triads**: Play C-E-G and listen for beating (should be none!)
2. **Inversions**: Compare C-E-G vs E-G-C (different tuning)
3. **Bass Movement**: Hold a chord, release the bass, hear retune
4. **Voice Stealing**: Play 9+ notes, hear oldest voice stolen
5. **Chord Progressions**: Try I-IV-V-I in C major

## Known Behavior

- When bass note releases, remaining notes keep their current frequency
  - They don't retune to the new bass (avoids glitching)
  - New notes will tune to the new bass
- Voice stealing uses oldest-first (not loudest or softest)
- Maximum 8 simultaneous voices (configurable in constructor)
