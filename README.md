# Just Interval Synth 🎹

MIDI-controlled synthesizers that use **just intonation** for pure harmonic intervals. Includes both monophonic and polyphonic versions with different tuning approaches.

## Synth Types

### 🎵 Monosynth (Sequential Tuning)
A monophonic synth where each note is tuned relative to the **last played note**. This creates melodically coherent sequences where each interval is perfectly in tune with the previous note.

**Use for:** Melodic lines, solos, exploring interval relationships

### PolySynth (Bass-Driven)
An 8-voice polyphonic synth where all notes are tuned relative to the **lowest currently playing note** (the bass). This creates harmonically pure chords with simple frequency ratios.

**Bass Change Modes:**
- **Static** (default): Notes keep their tuning when bass changes (smooth, natural)
- **Smooth**: Notes glide to new tuning over 200ms (experimental, theremin-like)
- **Instant**: Notes snap immediately to new tuning (demonstrates the math)

**Use for:** Chords, harmonic exploration, pure triads and intervals

## What is Just Intonation?

Just intonation uses simple frequency ratios (like 3:2 for a perfect fifth) instead of the equal temperament tuning found on most keyboards. This creates perfectly consonant intervals with no beating, resulting in a more "pure" harmonic sound.

## How It Works

### Monosynth (Sequential)
1. **First Note**: Uses standard equal temperament tuning (A4 = 440 Hz)
2. **Subsequent Notes**: Each note is calculated using just intonation ratios based on the **previous** note
3. **Reference Note**: After releasing a note, it becomes the reference for the next note
4. **Reset**: You can reset the reference at any time to start fresh

**Example:**
- **C4** (first note) → 261.63 Hz (equal temperament)
- **G4** (perfect fifth) → 261.63 × 3/2 = 392.44 Hz
- **E4** (down a minor third) → 392.44 × 5/6 = 327.03 Hz

### PolySynth (Bass-Driven)
1. **First/Lowest Note**: Becomes the "bass" reference, uses equal temperament
2. **Higher Notes**: All other notes tune to the bass using just intonation
3. **Changing Bass**: When the bass note releases and a new lowest note emerges, it becomes the new reference
4. **Voice Allocation**: 8 voices with oldest-first voice stealing

**Example (playing a C major triad):**
- **C4** (bass) → 261.63 Hz (equal temperament reference)
- **E4** → 261.63 × 5/4 = 327.03 Hz (major third)
- **G4** → 261.63 × 3/2 = 392.44 Hz (perfect fifth)
- Result: Perfect 4:5:6 ratio!

## Features

- 🎵 **Pure Just Intonation**: Perfect harmonic intervals
- 🎹 **MIDI Input**: Works with any MIDI keyboard or controller
- 🎸 **Real-time Visualizer**: Guitar Hero-style note visualization showing tuning deviations
- 🎚️ **Synth Controls**: 
  - Multiple waveforms (Sawtooth, Sine, Square, Triangle)
  - Full ADSR envelope control (Attack, Decay, Sustain, Release)
  - Resonant lowpass filter with envelope modulation
  - Sustain pedal support (CC64)
  - Master volume control
- 📊 **Real-time Display**: Shows current note, frequency, interval ratios, and reference note
- 🔄 **Reset Reference**: Start fresh at any time

## Requirements

- A modern web browser with Web Audio API and Web MIDI API support
  - Chrome, Edge, or Opera recommended (Firefox has limited MIDI support)
- A MIDI keyboard or controller

## Installation & Setup

1. **Install dependencies** (optional - only needed for local server):
   ```bash
   npm install
   ```

2. **Start the application**:
   ```bash
   npm start
   ```
   
   Or simply open `index.html` in your browser.

3. **Connect your MIDI device**:
   - Plug in your MIDI keyboard or controller
   - Your browser may ask for permission to access MIDI devices

4. **Click "Start Synth"** to initialize the audio and MIDI

5. **Play!** 🎹

## Usage Tips

- **Melodic Playing**: Play single notes in sequence to hear how each interval relates to the previous note
- **Experiment with Intervals**: Try different interval patterns and hear the pure ratios
- **Watch the Visualizer**: See how notes deviate from equal temperament in real-time
  - Center line = Equal temperament (0 cents)
  - Left of center = Flat (negative cents)
  - Right of center = Sharp (positive cents)
  - Each note color-coded by pitch class
- **Shape Your Sound**: 
  - Adjust the ADSR envelope for percussive (short attack/decay) or pad-like (long attack/release) sounds
  - Use the filter envelope to add movement and character to your notes
  - Increase resonance for a more "squelchy" analog sound
- **Use the Sustain Pedal**: Hold chords and notes like a real piano
- **Reset When Needed**: If notes drift too far from your desired pitch center, click "Reset Reference"
- **Waveform Selection**: Different waveforms emphasize different harmonics

## Just Intonation Ratios

The synth uses these traditional just intonation ratios:

| Interval | Ratio | Example |
|----------|-------|---------|
| Unison | 1:1 | C → C |
| Minor 2nd | 16:15 | C → C# |
| Major 2nd | 9:8 | C → D |
| Minor 3rd | 6:5 | C → Eb |
| Major 3rd | 5:4 | C → E |
| Perfect 4th | 4:3 | C → F |
| Tritone | 45:32 | C → F# |
| Perfect 5th | 3:2 | C → G |
| Minor 6th | 8:5 | C → Ab |
| Major 6th | 5:3 | C → A |
| Minor 7th | 9:5 | C → Bb |
| Major 7th | 15:8 | C → B |
| Octave | 2:1 | C → C |

## Technical Details

### Architecture

- **`just-intervals.js`**: Calculates just intonation frequency ratios
- **`midi-handler.js`**: Manages Web MIDI API connection and events
- **`synth.js`**: Web Audio synthesizer engine
- **`app.js`**: Main application logic and UI updates
- **`index.html`**: User interface

### Web Audio Graph

```
Oscillator → Filter (with envelope) → Gain Envelope (ADSR) → Master Gain → Destination
```

The synth features:
- **ADSR Amplitude Envelope**: Controls volume over time (Attack, Decay, Sustain, Release)
- **Filter Envelope**: Modulates the filter cutoff frequency for dynamic timbral changes
- **Velocity Sensitivity**: MIDI velocity affects both amplitude and filter brightness

### Browser Compatibility

| Browser | Web MIDI | Web Audio |
|---------|----------|-----------|
| Chrome | ✅ | ✅ |
| Edge | ✅ | ✅ |
| Opera | ✅ | ✅ |
| Firefox | ⚠️ Limited | ✅ |
| Safari | ❌ | ✅ |

## Troubleshooting

**No MIDI devices showing up?**
- Make sure your MIDI device is connected before opening the page
- Try refreshing the page after connecting the device
- Check that your browser supports Web MIDI API
- On some systems, you may need to grant MIDI permissions

**No sound?**
- Click the "Start Synth" button (required for Web Audio API)
- Check your system volume and browser audio settings
- Make sure the master volume slider isn't at zero

**Notes sound out of tune?**
- This is expected! Just intonation creates different tunings based on the melodic path
- Try clicking "Reset Reference" to start fresh from equal temperament

## Musical Applications

### When Just Intonation Shines
- Simple melodies with clear intervallic relationships
- Drone-based music (keep resetting to the same reference)
- Exploring pure harmonic intervals
- Experimental and microtonal music

### Limitations
- Complex chord progressions may sound "out of tune"
- The pitch center can drift over long melodic passages
- Not suitable for playing with equal-tempered instruments

## License

MIT License - feel free to use and modify!

## Credits

Built with Web Audio API and Web MIDI API.

---

**Enjoy exploring the world of just intonation!** 🎵
