# Just Interval Synth 🎹

MIDI-controlled polyphonic synthesizer that uses **just intonation** for pure harmonic intervals. Features multiple reference modes and real-time visualization of tuning and comma drift.

## Features

### 🎵 8-Voice Polyphonic Synth
A polyphonic synth where all notes are tuned relative to a dynamically selected **reference note**. This creates harmonically pure chords with simple frequency ratios.

### 🎯 Three Reference Modes:
- **Bass Mode** (default): The lowest note becomes the reference
- **Random Mode**: A random note is chosen and "sticks" until released
- **Lattice Mode**: The "harmonic center" (Tonnetz) - finds the chord root regardless of pitch order

### 🔄 Reference Change Behaviors:
- **Static** (default): Notes keep their tuning when reference changes (smooth, natural)
- **Smooth**: Notes glide to new tuning over 200ms (experimental, theremin-like)
- **Instant**: Notes snap immediately to new tuning (demonstrates the math)

### 📊 Real-Time Visualizer
- Time-series plot showing tuning history of all voices
- Dual-indicator tuner display:
  - **Purity**: Average deviation from perfect ratios (colored needle)
  - **Comma Drift**: Accumulated drift from initial reference (gold indicator)
- Fullscreen mode for performance

### 🎛️ MIDI Controls
- Note on/off with velocity
- Sustain pedal (CC64)
- Pitch wheel for reference frequency detuning
- Mod wheel (CC1) for per-voice vibrato

## What is Just Intonation?

Just intonation uses simple frequency ratios (like 3:2 for a perfect fifth) instead of the equal temperament tuning found on most keyboards. This creates perfectly consonant intervals with no beating, resulting in a more "pure" harmonic sound.

## How It Works

1. **Reference Note**: Selected based on the chosen mode (bass, random, or harmonic center)
2. **Tuning**: All other notes calculate their frequency using just intonation ratios relative to the reference
3. **Comma Drift**: As the reference changes, the system tracks accumulated pitch drift from the initial starting point
4. **Voice Allocation**: 8 voices with oldest-first voice stealing


**Example (playing a C major triad in Bass Mode):**
- **C4** (bass) → 261.63 Hz (equal temperament reference)
- **E4** → 261.63 × 5/4 = 327.03 Hz (major third)
- **G4** → 261.63 × 3/2 = 392.44 Hz (perfect fifth)
- Result: Perfect 4:5:6 ratio!

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

### Reference Modes
- **Bass Mode**: Great for traditional harmony - the lowest note is the root
- **Random Mode**: Adds unpredictability - reference "sticks" to a random note
- **Lattice Mode**: Best for complex chords - automatically finds the harmonic center

### Playing Techniques
- **Pure Triads**: Play root position chords (C-E-G) to hear perfect 4:5:6 ratios
- **Inversions**: Use Lattice mode to preserve harmonic relationships in inversions
- **Comma Drift**: Watch the gold indicator to see your harmonic journey
- **Pitch Wheel**: Detune the reference frequency for microtonal exploration
- **Mod Wheel**: Add subtle vibrato to individual voices

### Visualizer
- **Keyboard Roll**: Shows which notes are playing and their current tuning
- **Time Plot**: Displays the tuning history of each voice over time
- **Purity Needle**: Shows average deviation from perfect ratios (colored)
- **Drift Indicator**: Shows accumulated comma drift (gold)
- **Fullscreen**: Click ⛶ for an immersive visualization experience

### Sound Design
- Adjust the ADSR envelope for percussive (short attack/decay) or pad-like (long attack/release) sounds
- Use the filter envelope to add movement and character to your notes
  - Increase resonance for a more "squelchy" analog sound
- **Use the Sustain Pedal**: Hold chords and notes like a real piano
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

- **`polysynth.js`**: Polyphonic synth engine with just intonation and multiple reference modes
- **`polyapp.js`**: Application logic, UI updates, and MIDI event routing
- **`just-intervals.js`**: Calculates just intonation frequency ratios
- **`midi-handler.js`**: Manages Web MIDI API connections and events (note on/off, CC, pitch bend)
- **`visualizer.js`**: Real-time visualization of tuning, purity, and comma drift
- **`base-synth.js`**: Abstract base class for synth parameters and sustain pedal logic
- **`settings-manager.js`**: Persists synth settings to localStorage
- **`index.html`**: User interface

### Web Audio Graph (per voice)

```
Oscillator ──┬──> Filter (with envelope) ──> Gain Envelope (ADSR) ──> Master Gain ──> Destination
             │
LFO ─────────┘ (modulates frequency for vibrato)
```

The synth features:
- **8-Voice Polyphony**: Pre-allocated voice pool with oldest-first voice stealing
- **ADSR Amplitude Envelope**: Controls volume over time (Attack, Decay, Sustain, Release)
- **Filter Envelope**: Modulates the filter cutoff frequency for dynamic timbral changes
- **Per-Voice LFO**: Controlled by mod wheel (CC1) for subtle vibrato
- **Velocity Sensitivity**: MIDI velocity affects both amplitude and filter brightness
- **Pitch Bend**: Detunes the reference frequency for microtonal exploration

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
