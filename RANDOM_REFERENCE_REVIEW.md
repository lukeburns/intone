# Random Reference Mode - Code Review & Adaptation Plan

## Overview
Currently, the polysynth uses **bass-driven reference** (lowest active voice). This review identifies all bass-specific code that needs adaptation for a **random reference mode**.

---

## 1. Core Reference Selection Logic

### Current: `getLowestActiveVoice()` (polysynth.js:265)
```javascript
getLowestActiveVoice() {
  const activeVoices = this.voices.filter(v => v.isActive);
  if (activeVoices.length === 0) return null;
  
  return activeVoices.reduce((lowest, v) => 
    v.midiNote < lowest.midiNote ? v : lowest
  );
}
```

**Adaptation Needed:**
- Abstract to `getReferenceVoice()`
- Add mode parameter: `'bass' | 'random'`
- Random mode: select a random active voice (or keep existing reference if still active)

---

## 2. Note-On Logic (polysynth.js:297-391)

### Current Bass-Specific Code:
```javascript
noteOn(midiNote, velocity) {
  const bassVoice = this.getLowestActiveVoice();  // LINE 300
  
  if (!bassVoice) {
    // First note logic...
  } else {
    // Tune relative to bassVoice.frequency & bassVoice.midiNote
  }
}
```

**Adaptation Needed:**
- Rename `bassVoice` → `referenceVoice`
- Same logic works for any reference (doesn't need bass-specific changes)

---

## 3. Reference Change Detection (_releaseNote, polysynth.js:410-445)

### Current Bass Change Detection:
```javascript
_releaseNote(midiNote) {
  // Check if any of these voices are the current bass
  const wasBass = voicesToRelease.some(v => {
    const currentBass = this.getLowestActiveVoice();
    return currentBass && v.midiNote === currentBass.midiNote;
  });
  
  // Store last bass frequency if releasing bass
  if (wasBass) {
    const bassFreq = this.getBassFrequencyWithBend();
    const currentBass = this.getLowestActiveVoice();
    // Store...
  }
  
  // If bass changed and retune mode enabled, retune
  if (wasBass && this.retuneMode !== 'static') {
    return this.retuneToNewBass();
  }
}
```

**Adaptation Needed:**
- Rename `wasBass` → `wasReference`
- Random mode: **different logic needed!**
  - Bass mode: reference changes when bass voice released
  - **Random mode**: reference should **stick** to current reference voice until it's released
  - Only change reference when the **current reference voice** is released

---

## 4. Retuning Logic (retuneToNewBass, polysynth.js:451-487)

### Current Implementation:
```javascript
retuneToNewBass() {
  const newBass = this.getLowestActiveVoice();  // Get new bass
  
  for (const voice of this.voices) {
    if (!voice.isActive || voice.midiNote === newBass.midiNote) continue;
    
    // Retune to newBass
    const interval = voice.midiNote - newBass.midiNote;
    const newFrequency = this.justIntervals.getJustFrequency(
      newBass.frequency, newBass.midiNote, voice.midiNote
    );
    // ...
  }
}
```

**Adaptation Needed:**
- Rename to `retuneToNewReference()`
- Use `getReferenceVoice()` instead of `getLowestActiveVoice()`
- Random mode: select new random reference only when current reference released

---

## 5. Pitch Bend (polysynth.js:521-527)

### Current:
```javascript
getBassFrequencyWithBend() {
  const bassVoice = this.getLowestActiveVoice();
  if (!bassVoice) return null;
  
  const centsOffset = this.pitchBendAmount * this.pitchBendRange;
  const bendRatio = Math.pow(2, centsOffset / 1200);
  return bassVoice.frequency * bendRatio;
}
```

**Adaptation Needed:**
- Rename to `getReferenceFrequencyWithBend()`
- Use `getReferenceVoice()` instead

---

## 6. State Reporting (getState, polysynth.js:543-562)

### Current:
```javascript
getState() {
  const bassVoice = this.getLowestActiveVoice();
  
  return {
    // ...
    bassNote: bassVoice ? bassVoice.midiNote : null,
    bassFrequency: bassVoice ? bassVoice.frequency : null,
  };
}
```

**Adaptation Needed:**
- Add `referenceMode` to state
- Rename `bassNote` → `referenceNote` (or keep both for backwards compat)
- Use `getReferenceVoice()`

---

## 7. UI & Display (polyapp.js, multiple locations)

### Current Bass-Specific Labels:
- Line 24: `bassNote` element
- Line 25: `bassFreq` element
- Line 312: "bass note"
- Line 425: "bass note"
- Line 451-456: "Bass Note" display

**Adaptation Needed:**
- Update labels: "Bass Note" → "Reference Note"
- Update element IDs (or keep bass* for backwards compat)
- Display reference mode in UI

---

## 8. Voice Tracking (Voice class, polysynth.js:32, 114-115)

### Current:
```javascript
start(midiNote, frequency, velocity, params, bassNote, bassFreq) {
  // ...
  this.tunedToBassNote = bassNote;
  this.tunedToBassFreq = bassFreq;
}
```

**Adaptation Needed:**
- Rename to `tunedToReferenceNote` / `tunedToReferenceFreq`
- Same functionality works for any reference

---

## 9. Console Logging

### Multiple console.log statements mention "bass":
- Line 307: "First note (bass)"
- Line 313: "First note (bass)"
- Line 324: "First note (bass)"
- Line 427: "Storing last bass"
- Line 455: "Bass changed to..."

**Adaptation Needed:**
- Update to say "reference" instead of "bass"
- Add mode indicator: "Bass changed" → "Reference changed (bass mode)" / "Reference changed (random mode)"

---

## 10. Documentation

### Files to Update:
- `RETUNING.md` - Currently says "Bass Retuning Modes"
- `POLYSYNTH.md` - Describes bass-driven behavior
- `README.md` - Mentions bass note
- `poly.html` - Help text

**Adaptation Needed:**
- Update to describe both modes
- Explain difference in behavior

---

## Implementation Strategy

### Phase 1: Abstraction
1. Add `referenceMode` property: `'bass' | 'random'`
2. Create `getReferenceVoice()` method
3. Add `currentReferenceVoice` property to track chosen reference in random mode
4. Refactor all `getLowestActiveVoice()` calls to `getReferenceVoice()`

### Phase 2: Random Mode Logic
1. Implement random selection on first note
2. Implement "sticky" behavior (keep reference until it's released)
3. Only select new random reference when current reference released

### Phase 3: UI & Display
1. Add mode selector dropdown
2. Update labels to be mode-agnostic ("Reference Note")
3. Update console logs
4. Save/load mode preference

### Phase 4: Testing
1. Test bass mode still works correctly
2. Test random mode selection
3. Test reference stickiness
4. Test retuning behavior in both modes
5. Test with pitch wheel
6. Test visualizer reference line

---

## Key Differences: Bass vs Random Mode

| Aspect | Bass Mode | Random Mode |
|--------|-----------|-------------|
| **Initial reference** | First note played | First note played |
| **Reference selection** | Lowest active voice | Random active voice (chosen once) |
| **Reference changes when** | Any time lowest note changes | Only when current reference released |
| **Retuning triggers** | Frequent (every bass note release) | Rare (only when reference released) |
| **Predictability** | Deterministic (always lowest) | Non-deterministic (random choice) |
| **Use case** | Bass-driven harmony | Equal-weight harmony, lattice exploration |

---

## Critical Design Question

**In random mode, when reference is released:**

**Option A: Select new random reference from remaining voices**
- Pros: Always has a reference while notes are playing
- Cons: Can cause unexpected retunings

**Option B: Keep last reference frequency (like bass mode)**
- Pros: More stable, less retuning
- Cons: Reference might not be actively playing

**Recommendation:** Start with Option A, add Option B as "sticky reference" variant later.

---

## Files Requiring Changes

1. ✅ `polysynth.js` - Core logic (most changes)
2. ✅ `polyapp.js` - UI updates, mode handling
3. ✅ `poly.html` - Add mode selector
4. ✅ `visualizer.js` - Update comments/labels (minimal changes)
5. ✅ `settings-manager.js` - Save/load reference mode
6. ⚠️ `RETUNING.md` - Update documentation
7. ⚠️ `POLYSYNTH.md` - Update documentation
8. ⚠️ `README.md` - Update documentation

---

## Next Steps

1. Review this document
2. Decide on random mode behavior (Option A vs B)
3. Implement Phase 1 (Abstraction)
4. Test bass mode still works
5. Implement Phase 2 (Random mode)
6. Test & iterate
