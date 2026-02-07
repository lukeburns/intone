# Sustain Pedal Bug Fix

## 🐛 The Bug

**Issue**: When sustain pedal is lifted, notes that are currently being physically held down are also stopped.

**Scenario that triggered the bug:**
1. Play chord 1 (e.g., C-E-G) → keys down
2. Press sustain pedal
3. Release chord 1 keys → notes added to `sustainedNotes` Set
4. Play chord 2 (e.g., F-A-C) → keys down, **C is in both chords**
5. Release sustain pedal → **Bug: All C notes stop, even the one being held!**

**Root cause #1 (First attempt):**
- The system tracked **MIDI note numbers** in `sustainedNotes` Set
- When pedal lifted, it released **all voices** playing those MIDI notes
- It didn't distinguish between:
  - Voices sustained by the pedal (should release)
  - Voices physically held down (should NOT release)

**Root cause #2 (Real problem discovered after first fix):**
- Even with voice instance tracking, we weren't tracking **which keys are physically held down**
- When sustain lifts, we need to know: "Is this note's key still pressed?"
- A real piano knows the physical state of each key independently

## 🔧 The Fix (Complete Solution)

### Part 1: Track Voice Instances (Not Just MIDI Notes)

**Before:**
```javascript
// base-synth.js
this.sustainedNotes = new Set();  // Only tracked MIDI note numbers
```

**After:**
```javascript
// base-synth.js
this.sustainedNotes = new Set();  // MIDI notes (for compatibility)
this.sustainedVoices = new Set(); // Specific voice instances held by pedal
this.keysHeldDown = new Set();    // MIDI notes with keys currently physically held
```

### Part 2: Track Physical Key State

**polyapp.js & app.js:**
```javascript
async handleNoteOn(midiNote, velocity) {
  // Mark this key as being held down
  this.synth.keysHeldDown.add(midiNote);
  // ... rest of noteOn
}

async handleNoteOff(midiNote) {
  // Mark this key as no longer being held down
  this.synth.keysHeldDown.delete(midiNote);
  // ... rest of noteOff
}
```

### Part 3: Only Release Notes Whose Keys Are Up

**base-synth.js:**
```javascript
handleSustainPedalUp() {
  this.sustainPedalDown = false;
  console.log('Keys currently held down:', Array.from(this.keysHeldDown));
  console.log('Sustained notes:', Array.from(this.sustainedNotes));
  
  // Release notes that were sustained BUT whose keys are no longer held down
  const notesToRelease = Array.from(this.sustainedNotes)
    .filter(note => !this.keysHeldDown.has(note));
  
  console.log('Notes to release (sustained but not held):', notesToRelease);
  
  const voicesToRelease = Array.from(this.sustainedVoices);
  this.sustainedNotes.clear();
  this.sustainedVoices.clear();
  
  notesToRelease.forEach(note => {
    this._releaseNote(note, voicesToRelease);
  });
}
```

### Part 4: Release Only Sustained Voice Instances

**polysynth.js:**
```javascript
_releaseNote(midiNote, sustainedVoicesToRelease = null) {
  let voicesToRelease;
  
  if (sustainedVoicesToRelease && sustainedVoicesToRelease.length > 0) {
    // Only release the specific voices that were sustained
    voicesToRelease = this.voices.filter(v => 
      v.isActive && 
      v.midiNote === midiNote && 
      sustainedVoicesToRelease.includes(v)  // Check if this voice was sustained
    );
  } else {
    // Normal note off: release all voices playing this note
    voicesToRelease = this.voices.filter(v => v.isActive && v.midiNote === midiNote);
  }
  
  // ... rest of release logic
}
```

## ✅ Result

**Now the behavior matches a real piano:**

### Example Flow:

1. **Play C-E-G, press sustain, release keys**
   - Voice instances v1 (C), v2 (E), v3 (G) added to `sustainedVoices`
   - MIDI notes 60, 64, 67 added to `sustainedNotes`
   - `keysHeldDown` is now empty (all keys released)
   
2. **Play F-A-C (while sustain down)**
   - Voice instances v4 (F), v5 (A), v6 (C) start playing
   - `keysHeldDown` now has {65, 69, 60} (F, A, C)
   - C (60) is now playing in two voices: v3 (sustained) and v6 (held)
   
3. **Release sustain pedal**
   - System checks: which sustained notes are NOT in `keysHeldDown`?
     - C (60): Is in `keysHeldDown` → **DON'T RELEASE** ✓
     - E (64): Not in `keysHeldDown` → Release v2
     - G (67): Not in `keysHeldDown` → Release v3
   - Only releases v2 (E) and v3 (G, the sustained C voice)
   - v6 (C held down) continues playing! ✓

## 🎹 Testing Scenarios

1. **Overlapping notes with sustain:**
   - Play C, sustain, release C, play C again, lift sustain
   - Expected: Second C continues playing ✓

2. **Chord transition with sustain:**
   - Play C-E-G, sustain, release, play F-A-C (shares C), lift sustain
   - Expected: F-A-C continue playing ✓

3. **Multiple same notes:**
   - Play C (voice 1), sustain, play C again (voice 2), release first C, lift sustain
   - Expected: Voice 2 continues (it's being held) ✓

4. **Complex scenario:**
   - Play C-E, sustain, release C-E, play C-G, lift sustain
   - Expected: Only C-G continue (both held) ✓
   - What releases: E (sustained, not held) ✓
   - What continues: C and G (both held) ✓

## 🧩 How It Works

### Three Independent States:

1. **`keysHeldDown` Set** - Physical keyboard state
   - Added when note-on received
   - Removed when note-off received
   - Independent of sustain pedal

2. **`sustainedNotes` Set** - Notes held by pedal
   - Added when note-off received while pedal down
   - Cleared when pedal lifts

3. **`sustainedVoices` Set** - Specific voice instances
   - Added when note-off received while pedal down
   - Used to release only the correct voice instances

### The Magic Formula:

```
Notes to release when pedal lifts = sustainedNotes - keysHeldDown
```

This ensures:
- Notes that were sustained AND are now held → Continue playing
- Notes that were sustained AND are not held → Release
- Notes that were never sustained → Unaffected

## 📝 Files Changed

- `base-synth.js` - Added `keysHeldDown` tracking, updated sustain methods
- `polysynth.js` - Updated `_releaseNote()` to accept voice instances, return voice from `noteOn()`
- `synth.js` - Updated `_releaseNote()` signature for API compatibility
- `polyapp.js` - Track key state in `handleNoteOn/Off`, pass voice instances, filter visualizer updates
- `app.js` - Track key state in `handleNoteOn/Off` for monosynth, filter visualizer updates

## 🎨 Visualizer Integration

The visualizer also needs to respect the same logic:

```javascript
// polyapp.js & app.js
handleSustainPedal(pedalDown) {
  if (!pedalDown) {
    const sustainedNotes = Array.from(this.synth.sustainedNotes);
    const keysHeldDown = Array.from(this.synth.keysHeldDown);
    
    this.synth.handleSustainPedalUp();
    
    // Only stop visualizing notes whose keys are no longer held
    if (this.visualizer) {
      sustainedNotes.forEach(midiNote => {
        if (!keysHeldDown.includes(midiNote)) {
          this.visualizer.noteOff(midiNote);  // Stop the plot path
        }
        // If key IS held, path continues uninterrupted!
      });
    }
  }
}
```

This ensures the time-series plot paths continue for held notes even when sustain lifts.

## 🎵 Backward Compatibility

- Monosynth: Works as before (voice parameter unused, but key tracking works)
- MIDI note tracking: Still uses `sustainedNotes` for compatibility
- Voice-specific tracking: Only used in polysynth where it matters
- Key state tracking: Universal, mirrors real piano behavior

## 🔍 Debug Logs

When sustain pedal lifts, you'll see:
```
Sustain pedal: UP
Keys currently held down: [60, 65, 69]  // F, A, C
Sustained notes: [60, 64, 67]           // C, E, G
Notes to release (sustained but not held): [64, 67]  // E, G
```

This makes it easy to verify the correct behavior!
