# Just Interval Monosynth 🎹

A MIDI-controlled monosynth that uses **just intonation** based on the last played note. Each note is tuned in perfect harmonic relationship to the previous note, creating pure musical intervals.

## What is Just Intonation?

Just intonation uses simple frequency ratios (like 3:2 for a perfect fifth) instead of the equal temperament tuning found on most keyboards. This creates perfectly consonant intervals with no beating, resulting in a more "pure" harmonic sound.

## How It Works

1. **First Note**: The first note you play uses standard equal temperament tuning (A4 = 440 Hz)
2. **Subsequent Notes**: Each following note is calculated using just intonation ratios based on its interval from the **previous** note
3. **Reference Note**: After releasing a note, it becomes the reference for the next note
4. **Reset**: You can reset the reference at any time to start fresh

### Example

If you play:
- **C4** (first note) → Uses equal temperament: 261.63 Hz
- **G4** (perfect fifth) → Uses 3:2 ratio: 261.63 × 3/2 = 392.44 Hz
- **E4** (down a minor third) → Uses 6:5 ratio from G4: 392.44 × 5/6 = 327.03 Hz

## Features

- 🎵 **Pure Just Intonation**: Perfect harmonic intervals
- 🎹 **MIDI Input**: Works with any MIDI keyboard or controller
- 🎚️ **Synth Controls**: 
  - Multiple waveforms (Sawtooth, Sine, Square, Triangle)
  - Full ADSR envelope control (Attack, Decay, Sustain, Release)
  - Resonant lowpass filter with envelope modulation
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
- **Shape Your Sound**: 
  - Adjust the ADSR envelope for percussive (short attack/decay) or pad-like (long attack/release) sounds
  - Use the filter envelope to add movement and character to your notes
  - Increase resonance for a more "squelchy" analog sound
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
