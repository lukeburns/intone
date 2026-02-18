import { JustIntervals } from './just-intervals.js';
import { BaseSynth } from './base-synth.js';

/**
 * Voice - Individual synthesizer voice
 * Represents one note in the polyphonic synth
 */
class Voice {
  constructor(audioContext, masterGain) {
    this.audioContext = audioContext;
    this.masterGain = masterGain;
    
    // Audio nodes
    this.oscillator = null;
    this.filter = null;
    this.gainEnvelope = null;
    this.panner = null;  // Stereo panner
    this.lfo = null;  // LFO for vibrato
    this.lfoGain = null;  // LFO amount control
    
    // State
    this.isActive = false;
    this.midiNote = null;
    this.frequency = null;
    this.noteOnTime = null;
    
    // Tuning tracking
    this.tunedToBassNote = null;  // Which bass note was this tuned against?
    this.tunedToBassFreq = null;
    
    // Vibrato state
    this.vibratoAmount = 0;  // Current mod wheel amount (0-1)
    
    // Stereo position
    this.panPosition = 0;  // -1 (left) to 1 (right)
  }

  /**
   * Start playing this voice
   */
  start(midiNote, frequency, velocity, params, bassNote, bassFreq) {
    // If already playing, do a very quick crossfade
    const wasPlaying = this.isActive && this.oscillator;
    
    if (wasPlaying) {
      // Store old nodes for quick fadeout
      const oldOsc = this.oscillator;
      const oldGain = this.gainEnvelope;
      const oldFilter = this.filter;
      const now = this.audioContext.currentTime;
      
      // Quick fade out the old sound (5ms)
      try {
        oldGain.gain.cancelScheduledValues(now);
        oldGain.gain.setValueAtTime(oldGain.gain.value, now);
        oldGain.gain.linearRampToValueAtTime(0.001, now + 0.005);
        oldOsc.stop(now + 0.005);
        
        setTimeout(() => {
          try {
            oldOsc.disconnect();
            oldFilter.disconnect();
            oldGain.disconnect();
          } catch (e) {}
        }, 10);
      } catch (e) {}
    }
    
    // Create new oscillator
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = params.waveform;
    this.oscillator.frequency.value = frequency;
    
    // Create LFO for vibrato (very slow, subtle pitch modulation)
    this.lfo = this.audioContext.createOscillator();
    this.lfo.type = 'sine';
    // Variable rate: 0.5Hz to 3Hz based on note (slightly different per voice)
    const baseRate = 0.5 + (Math.random() * 0.3); // 0.5-0.8 Hz per voice
    this.lfo.frequency.value = baseRate;
    
    // LFO gain controls the amount of frequency modulation
    this.lfoGain = this.audioContext.createGain();
    this.lfoGain.gain.value = 0; // Start at 0, controlled by mod wheel
    
    // Connect LFO to oscillator frequency (for vibrato)
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.oscillator.frequency);
    
    // Start LFO
    this.lfo.start();
    
    // Create filter
    this.filter = this.audioContext.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = params.filterFrequency;
    this.filter.Q.value = params.filterQ;
    
    // Create gain envelope
    this.gainEnvelope = this.audioContext.createGain();
    this.gainEnvelope.gain.value = 0;
    
    // Create stereo panner
    this.panner = this.audioContext.createStereoPanner();
    this.panner.pan.value = this.panPosition;
    
    // Connect the audio graph: Oscillator -> Filter -> Gain -> Panner -> Master
    this.oscillator.connect(this.filter);
    this.filter.connect(this.gainEnvelope);
    this.gainEnvelope.connect(this.panner);
    this.panner.connect(this.masterGain);
    
    // Start the oscillator
    this.oscillator.start();
    
    // Apply ADSR envelope
    const now = this.audioContext.currentTime;
    const normalizedVelocity = velocity / 127;
    const peakGain = normalizedVelocity * 0.6; // Lower per-voice volume for polyphony
    const sustainGain = peakGain * params.sustainLevel;
    
    // Amplitude envelope: Attack -> Decay -> Sustain (hold)
    this.gainEnvelope.gain.cancelScheduledValues(now);
    this.gainEnvelope.gain.setValueAtTime(0, now);
    this.gainEnvelope.gain.linearRampToValueAtTime(peakGain, now + params.attackTime);
    this.gainEnvelope.gain.linearRampToValueAtTime(sustainGain, now + params.attackTime + params.decayTime);
    this.gainEnvelope.gain.setValueAtTime(sustainGain, now + params.attackTime + params.decayTime);
    
    // Filter envelope: Attack -> Decay -> Sustain (hold)
    const baseFilterFreq = params.filterFrequency;
    const peakFilterFreq = Math.min(baseFilterFreq + (params.filterEnvelopeAmount * normalizedVelocity), 20000);
    const sustainFilterFreq = baseFilterFreq + (params.filterEnvelopeAmount * params.filterSustain * normalizedVelocity);
    
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(baseFilterFreq, now);
    this.filter.frequency.linearRampToValueAtTime(peakFilterFreq, now + params.filterAttack);
    this.filter.frequency.linearRampToValueAtTime(sustainFilterFreq, now + params.filterAttack + params.filterDecay);
    this.filter.frequency.setValueAtTime(sustainFilterFreq, now + params.filterAttack + params.filterDecay);
    
    // Update state
    this.isActive = true;
    this.midiNote = midiNote;
    this.frequency = frequency;
    this.noteOnTime = now;
    this.tunedToBassNote = bassNote;
    this.tunedToBassFreq = bassFreq;
  }

  /**
   * Retune this voice to a new frequency
   * @param {number} newFrequency - Target frequency
   * @param {string} mode - 'instant' or 'smooth'
   * @param {number} glideTime - Time for smooth retune (seconds)
   */
  retune(newFrequency, mode = 'instant', glideTime = 0.2) {
    if (!this.oscillator || !this.isActive) return;
    
    const now = this.audioContext.currentTime;
    
    if (mode === 'instant') {
      this.oscillator.frequency.cancelScheduledValues(now);
      this.oscillator.frequency.setValueAtTime(newFrequency, now);
    } else if (mode === 'smooth') {
      this.oscillator.frequency.cancelScheduledValues(now);
      this.oscillator.frequency.setValueAtTime(this.frequency, now);
      this.oscillator.frequency.exponentialRampToValueAtTime(newFrequency, now + glideTime);
    }
    
    this.frequency = newFrequency;
  }

  /**
   * Release this voice (apply release envelope)
   */
  release(releaseTime) {
    if (!this.oscillator) return;
    
    const now = this.audioContext.currentTime;
    
    // Apply release envelope for both gain and filter
    this.gainEnvelope.gain.cancelScheduledValues(now);
    this.gainEnvelope.gain.setValueAtTime(this.gainEnvelope.gain.value, now);
    this.gainEnvelope.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);
    
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, now);
    const baseFreq = Math.max(this.filter.frequency.value * 0.5, 20);
    this.filter.frequency.exponentialRampToValueAtTime(baseFreq, now + releaseTime);
    
    // Stop and clean up after release
    this.oscillator.stop(now + releaseTime);
    if (this.lfo) {
      this.lfo.stop(now + releaseTime);
    }
    
    const oldOsc = this.oscillator;
    const oldGain = this.gainEnvelope;
    const oldFilter = this.filter;
    const oldPanner = this.panner;
    const oldLfo = this.lfo;
    const oldLfoGain = this.lfoGain;
    
    setTimeout(() => {
      oldOsc.disconnect();
      oldGain.disconnect();
      oldFilter.disconnect();
      if (oldPanner) oldPanner.disconnect();
      if (oldLfo) oldLfo.disconnect();
      if (oldLfoGain) oldLfoGain.disconnect();
    }, releaseTime * 1000 + 100);
    
    this.oscillator = null;
    this.gainEnvelope = null;
    this.filter = null;
    this.panner = null;
    this.lfo = null;
    this.lfoGain = null;
    this.isActive = false;
    this.midiNote = null;
    this.frequency = null;
  }

  /**
   * Stop this voice immediately (for voice stealing)
   */
  stop() {
    if (this.oscillator) {
      try {
        const now = this.audioContext.currentTime;
        
        // Quick fade out to prevent clicks (10ms)
        this.gainEnvelope.gain.cancelScheduledValues(now);
        this.gainEnvelope.gain.setValueAtTime(this.gainEnvelope.gain.value, now);
        this.gainEnvelope.gain.linearRampToValueAtTime(0.001, now + 0.01);
        
        this.oscillator.stop(now + 0.01);
        if (this.lfo) {
          this.lfo.stop(now + 0.01);
        }
        
        // Disconnect after fade
        setTimeout(() => {
          try {
            this.oscillator.disconnect();
            this.filter.disconnect();
            this.gainEnvelope.disconnect();
            if (this.panner) this.panner.disconnect();
            if (this.lfo) this.lfo.disconnect();
            if (this.lfoGain) this.lfoGain.disconnect();
          } catch (e) {
            // Already disconnected
          }
        }, 20);
      } catch (e) {
        // Already stopped
      }
      
      this.oscillator = null;
      this.gainEnvelope = null;
      this.filter = null;
      this.panner = null;
      this.lfo = null;
      this.lfoGain = null;
    }
    
    this.isActive = false;
    this.midiNote = null;
    this.frequency = null;
  }

  /**
   * Update vibrato amount (controlled by mod wheel)
   * @param {number} amount - 0.0 to 1.0
   */
  setVibratoAmount(amount) {
    if (!this.lfoGain || !this.oscillator) return;
    
    this.vibratoAmount = amount;
    
    // Map mod wheel amount to a very small frequency deviation
    // At max (amount=1.0): ±0.5 cents deviation (very subtle!)
    // This is 0.5/1200 = 0.00041667 of the base frequency
    const maxDeviationRatio = 0.005; // 0.5 cents max
    const deviationHz = this.frequency * maxDeviationRatio * amount;
    
    // Update LFO gain smoothly
    const now = this.audioContext.currentTime;
    this.lfoGain.gain.cancelScheduledValues(now);
    this.lfoGain.gain.setValueAtTime(this.lfoGain.gain.value, now);
    this.lfoGain.gain.linearRampToValueAtTime(deviationHz, now + 0.05);
    
    // Also vary LFO rate slightly with mod wheel for more organic feel
    // Base rate + up to 2Hz additional
    const baseRate = 0.5 + (Math.random() * 0.3);
    const lfoRate = baseRate + (amount * 2.0);
    this.lfo.frequency.setValueAtTime(lfoRate, now);
  }

  /**
   * Set stereo pan position
   * @param {number} position - -1.0 (left) to 1.0 (right)
   */
  setPan(position) {
    this.panPosition = Math.max(-1, Math.min(1, position));
    if (this.panner) {
      const now = this.audioContext.currentTime;
      this.panner.pan.setValueAtTime(this.panPosition, now);
    }
  }
}

/**
 * PolySynth - Polyphonic synthesizer with bass-driven just intonation
 * Each new note is tuned relative to the lowest currently playing note
 */
export class PolySynth extends BaseSynth {
  constructor(polyphony = 8) {
    super();
    
    this.justIntervals = new JustIntervals();
    
    // Separate tuning systems for split keyboard mode
    this.leftJustIntervals = new JustIntervals();
    this.rightJustIntervals = new JustIntervals();
    
    // Voice pool
    this.maxVoices = polyphony;
    this.voices = [];
    
    // Pitch bend
    this.pitchBendRange = 200; // cents (default ±2 semitones)
    this.pitchBendAmount = 0; // -1.0 to +1.0
    
    // Last audible bass (used as reference for next note)
    this.lastBassFrequency = null;
    this.lastBassMidiNote = null;
    
    // Split keyboard mode
    this.splitMode = 'off'; // 'off', 'independent', 'shared'
    this.splitPoint = 67; // MIDI note 66 = F#4 (midpoint of C2-C7 range)
    this.leftKeyboardTranspose = 12; // Transpose left keyboard down by 1 octave
    this.rightKeyboardTranspose = 12; // Transpose right keyboard down by this many semitones (1 octave)
    
    // Stored references for each side in split mode
    this.leftLastReferenceFrequency = null;
    this.leftLastReferenceMidiNote = null;
    this.rightLastReferenceFrequency = null;
    this.rightLastReferenceMidiNote = null;
    
    // Reference mode and tracking
    this.referenceMode = 'bass'; // 'bass', 'random', or 'harmonic'
    this.currentReferenceVoice = null; // For random/harmonic mode: sticky reference
    
    // Stereo spread settings
    this.stereoSpread = 0; // 0.0 to 1.0
    this.spreadMode = 'linear'; // 'linear', 'pitch', 'harmonic', 'alternating'
  }

  /**
   * Initialize the audio context and voice pool
   */
  async init() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create master gain
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.4; // Slightly higher for poly
    this.masterGain.connect(this.audioContext.destination);
    
    // Create voice pool
    for (let i = 0; i < this.maxVoices; i++) {
      this.voices.push(new Voice(this.audioContext, this.masterGain));
    }
    
    console.log(`PolySynth initialized with ${this.maxVoices} voices. Sample rate:`, this.audioContext.sampleRate);
  }

  /**
   * Get the lowest currently active note (bass note)
   */
  getLowestActiveVoice() {
    const activeVoices = this.voices.filter(v => v.isActive);
    if (activeVoices.length === 0) return null;
    
    return activeVoices.reduce((lowest, v) => 
      v.midiNote < lowest.midiNote ? v : lowest
    );
  }

  /**
   * Get the reference voice based on current reference mode
   * @param {number} forMidiNote - Optional: which MIDI note we're getting reference for (split mode)
   * Returns the voice that other notes should tune relative to
   */
  getReferenceVoice(forMidiNote = null) {
    // Handle split keyboard mode
    if (this.splitMode !== 'off' && forMidiNote !== null) {
      const isLeftHand = forMidiNote <= this.splitPoint;
      
      if (this.splitMode === 'independent') {
        // Independent references for left and right hands
        return this.getReferenceForSide(isLeftHand);
      } else if (this.splitMode === 'shared') {
        // Shared reference: use the absolute lowest note
        return this.getLowestActiveVoice();
      }
    }
    
    // Normal mode (no split)
    if (this.referenceMode === 'bass') {
      return this.getLowestActiveVoice();
    } else if (this.referenceMode === 'random') {
      // If we have a current reference and it's still active, keep it
      if (this.currentReferenceVoice && this.currentReferenceVoice.isActive) {
        return this.currentReferenceVoice;
      }
      
      // Otherwise, select a new random reference from active voices
      const activeVoices = this.voices.filter(v => v.isActive);
      if (activeVoices.length === 0) {
        this.currentReferenceVoice = null;
        return null;
      }
      
      // Pick a random voice
      const randomIndex = Math.floor(Math.random() * activeVoices.length);
      this.currentReferenceVoice = activeVoices[randomIndex];
      console.log(`Selected new random reference: ${this.justIntervals.getMidiNoteName(this.currentReferenceVoice.midiNote)}`);
      return this.currentReferenceVoice;
    } else if (this.referenceMode === 'lattice') {
      // If we have a current reference and it's still active, keep it (sticky)
      if (this.currentReferenceVoice && this.currentReferenceVoice.isActive) {
        return this.currentReferenceVoice;
      }
      
      // Otherwise, find the harmonic center
      const harmonicCenter = this.findHarmonicCenter();
      this.currentReferenceVoice = harmonicCenter;
      if (harmonicCenter) {
        console.log(`Selected harmonic center: ${this.justIntervals.getMidiNoteName(harmonicCenter.midiNote)}`);
      }
      return harmonicCenter;
    }
    
    return this.getLowestActiveVoice(); // Fallback
  }

  /**
   * Get reference for left or right side of split keyboard
   */
  getReferenceForSide(isLeftHand) {
    const activeVoices = this.voices.filter(v => v.isActive);
    const sideVoices = activeVoices.filter(v => 
      isLeftHand ? v.midiNote <= this.splitPoint : v.midiNote > this.splitPoint
    );
    
    if (sideVoices.length === 0) return null;
    
    // Use bass mode for each side
    return sideVoices.reduce((lowest, v) => 
      v.midiNote < lowest.midiNote ? v : lowest
    );
  }

  /**
   * Find the harmonic center - the note with strongest harmonic relationships
   * to all other active notes (Tonnetz-inspired algorithm)
   */
  findHarmonicCenter() {
    const activeVoices = this.voices.filter(v => v.isActive);
    if (activeVoices.length === 0) return null;
    if (activeVoices.length === 1) return activeVoices[0];
    
    let bestVoice = null;
    let bestScore = -Infinity;
    
    // For each voice, calculate its harmonic "consonance score"
    for (const candidate of activeVoices) {
      let score = 0;
      
      // Score based on harmonic relationships to all other notes
      for (const other of activeVoices) {
        if (candidate === other) continue;
        
        // Calculate interval from candidate to other
        const interval = other.midiNote - candidate.midiNote;
        
        // Add consonance score for this interval
        score += this.getConsonanceScore(interval);
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestVoice = candidate;
      }
    }
    
    return bestVoice;
  }

  /**
   * Get consonance score for an interval
   * Higher scores = more consonant = better reference candidates
   * Based on simple just intonation ratios
   */
  getConsonanceScore(interval) {
    // Normalize to octave (0-11)
    const mod12 = ((interval % 12) + 12) % 12;
    
    // Score based on consonance hierarchy
    // Perfect consonances score highest, then imperfect, then dissonances
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
      6: 1     // Tritone (45:32 or 64:45) - dissonance
    };
    
    return scores[mod12] || 0;
  }

  /**
   * Set reference mode: 'bass', 'random', or 'lattice'
   */
  setReferenceMode(mode) {
    if (mode !== 'bass' && mode !== 'random' && mode !== 'lattice') {
      console.warn(`Invalid reference mode: ${mode}. Using 'bass'.`);
      mode = 'bass';
    }
    
    this.referenceMode = mode;
    
    // Clear current reference when switching modes
    this.currentReferenceVoice = null;
    
    console.log(`Reference mode set to: ${mode}`);
  }

  /**
   * Find an available voice or steal one
   * Returns { voice, stolenNote } where stolenNote is the midiNote that was stolen (if any)
   */
  allocateVoice(midiNote) {
    // 1. Check if this note is already playing - retrigger it
    let voice = this.voices.find(v => v.isActive && v.midiNote === midiNote);
    if (voice) return { voice, stolenNote: null };
    
    // 2. Find an inactive voice
    voice = this.voices.find(v => !v.isActive);
    if (voice) return { voice, stolenNote: null };
    
    // 3. Steal the oldest voice
    const oldestVoice = this.voices.reduce((oldest, v) => 
      v.noteOnTime < oldest.noteOnTime ? v : oldest
    );
    
    return { voice: oldestVoice, stolenNote: oldestVoice.midiNote };
  }

  /**
   * Map incoming MIDI note to virtual note for split keyboard mode
   * In independent mode, both keyboards are transposed to overlap
   */
  mapMidiNoteForSplit(midiNote) {
    if (this.splitMode === 'independent') {
      if (midiNote <= this.splitPoint) {
        // Left keyboard: transpose down
        return midiNote + this.leftKeyboardTranspose;
      } else {
        // Right keyboard: transpose down
        return midiNote - this.rightKeyboardTranspose;
      }
    }
    return midiNote; // Non-split mode: no transposition
  }

  /**
   * Get the appropriate JustIntervals instance for a given MIDI note
   * In split mode with different tunings, returns left or right instance
   */
  getJustIntervalsForNote(midiNote) {
    if (this.splitMode === 'independent' && midiNote !== null) {
      const isLeftHand = midiNote <= this.splitPoint;
      return isLeftHand ? this.leftJustIntervals : this.rightJustIntervals;
    }
    // Normal mode or shared mode: use the main instance
    return this.justIntervals;
  }

  /**
   * Play a note using just intonation based on the reference note
   */
  noteOn(midiNote, velocity) {
    // Map the note for split keyboard mode (actual MIDI note stays the same for tracking)
    const virtualNote = this.mapMidiNoteForSplit(midiNote);
    
    // Get reference note for tuning (pass original midiNote for split detection)
    const referenceVoice = this.getReferenceVoice(midiNote);
    
    let frequency;
    let intervalInfo = null;
    let usedStoredReference = false;
    
    // Determine if this is left or right hand (needed in multiple places)
    const isLeftHand = midiNote <= this.splitPoint;
    
    // Get the appropriate JustIntervals instance for this note
    const justIntervals = this.getJustIntervalsForNote(midiNote);
    
    if (!referenceVoice) {
      // First note (or first on this side in split mode): use stored reference if available
      
      // Determine which stored reference to use based on split mode
      let storedFreq, storedMidi;
      if (this.splitMode === 'independent') {
        // Use side-specific stored reference
        storedFreq = isLeftHand ? this.leftLastReferenceFrequency : this.rightLastReferenceFrequency;
        storedMidi = isLeftHand ? this.leftLastReferenceMidiNote : this.rightLastReferenceMidiNote;
      } else {
        // Use global stored reference
        storedFreq = this.lastBassFrequency;
        storedMidi = this.lastBassMidiNote;
      }
      
      if (storedFreq !== null && storedMidi !== null) {
        usedStoredReference = true;
        // Calculate frequency based on interval from stored reference
        if (virtualNote === storedMidi) {
          // Same note as stored reference, use it directly
          frequency = storedFreq;
          console.log(`First note (reference): ${justIntervals.getMidiNoteName(virtualNote)} at ${frequency.toFixed(2)} Hz (from stored reference)`);
        } else {
          // Different note, calculate interval from stored reference
          const interval = virtualNote - storedMidi;
          frequency = justIntervals.getJustFrequency(
            storedFreq,
            storedMidi,
            virtualNote
          );
          
          const ratioString = justIntervals.getRatioString(interval);
          const intervalName = justIntervals.getIntervalName(interval);
          console.log(`First note (reference): ${justIntervals.getMidiNoteName(virtualNote)} at ${frequency.toFixed(2)} Hz (${intervalName} from stored reference)`);
          
          // Create interval info for UI
          intervalInfo = {
            interval,
            ratio: ratioString,
            name: intervalName,
            referenceMidi: storedMidi,
            referenceFreq: storedFreq,
            referenceNote: justIntervals.getMidiNoteName(storedMidi)
          };
        }
      } else {
        // No previous reference, use equal temperament
        frequency = justIntervals.midiToFrequency(virtualNote);
        console.log(`First note (reference): ${justIntervals.getMidiNoteName(virtualNote)} at ${frequency.toFixed(2)} Hz (equal temperament)`);
      }
      
      // This becomes the new reference, store it (both global and side-specific)
      // Store the VIRTUAL note (transposed) as the reference
      this.lastBassFrequency = frequency;
      this.lastBassMidiNote = virtualNote;
      
      // Also store in the appropriate side-specific variable for split mode
      if (isLeftHand) {
        this.leftLastReferenceFrequency = frequency;
        this.leftLastReferenceMidiNote = virtualNote;
      } else {
        this.rightLastReferenceFrequency = frequency;
        this.rightLastReferenceMidiNote = virtualNote;
      }
    } else {
      // Calculate just intonation based on the reference note
      // Need to get the virtual note for the reference as well (in case it's on the right keyboard)
      const referenceVirtualNote = this.mapMidiNoteForSplit(referenceVoice.midiNote);
      const interval = virtualNote - referenceVirtualNote;
      frequency = justIntervals.getJustFrequency(
        referenceVoice.frequency,
        referenceVirtualNote,
        virtualNote
      );
      
      const ratioString = justIntervals.getRatioString(interval);
      const intervalName = justIntervals.getIntervalName(interval);
      
      intervalInfo = {
        interval,
        ratio: ratioString,
        name: intervalName,
        referenceMidi: referenceVirtualNote,
        referenceFreq: referenceVoice.frequency,
        referenceNote: justIntervals.getMidiNoteName(referenceVirtualNote)
      };
      
      console.log(`Playing ${justIntervals.getMidiNoteName(virtualNote)} at ${frequency.toFixed(2)} Hz`);
      console.log(`  Interval: ${intervalName} (${ratioString}) from reference note ${intervalInfo.referenceNote} [${this.referenceMode} mode]`);
    }
    
    // Allocate and start voice (use ORIGINAL midiNote for tracking)
    const allocation = this.allocateVoice(midiNote);
    const voice = allocation.voice;
    const stolenNote = allocation.stolenNote;
    
    voice.start(
      midiNote, // Keep original for tracking
      frequency, 
      velocity, 
      this.getVoiceParams(),
      referenceVoice ? this.mapMidiNoteForSplit(referenceVoice.midiNote) : virtualNote,
      referenceVoice ? referenceVoice.frequency : frequency
    );
    
    // Update stereo panning for all voices
    this.updateAllVoicePanning();
    
    return {
      midiNote,
      frequency,
      voice,  // Return the voice instance for sustain tracking
      noteName: this.justIntervals.getMidiNoteName(midiNote),
      velocity,
      intervalInfo,
      usedStoredReference,
      activeVoices: this.voices.filter(v => v.isActive).length,
      stolenNote // null if no voice was stolen
    };
  }

  /**
   * Release a note
   * Returns array of {midiNote, newFrequency} for any notes that were retuned
   */
  noteOff(midiNote) {
    return this._releaseNote(midiNote);
  }

  /**
   * Implementation of BaseSynth abstract method for sustain pedal
   * Returns information about retuned notes if reference changed
   * @param {number} midiNote - The MIDI note to release
   * @param {Array} sustainedVoicesToRelease - Optional: specific voice instances to release (from sustain pedal)
   */
  _releaseNote(midiNote, sustainedVoicesToRelease = null) {
    let voicesToRelease;
    
    if (sustainedVoicesToRelease && sustainedVoicesToRelease.length > 0) {
      // Only release the specific voices that were sustained
      voicesToRelease = this.voices.filter(v => 
        v.isActive && 
        v.midiNote === midiNote && 
        sustainedVoicesToRelease.includes(v)
      );
    } else {
      // Normal note off: release all voices playing this note
      voicesToRelease = this.voices.filter(v => v.isActive && v.midiNote === midiNote);
    }
    
    if (voicesToRelease.length === 0) {
      return [];
    }
    
    // Get current reference BEFORE releasing
    const currentReference = this.getReferenceVoice();
    const wasReference = voicesToRelease.some(v => {
      return currentReference && v.midiNote === currentReference.midiNote;
    });
    
    // If releasing the reference, store its current audible frequency (with pitch bend)
    if (wasReference && currentReference) {
      const refFreq = this.getReferenceFrequencyWithBend();
      if (refFreq) {
        // Store globally
        this.lastBassFrequency = refFreq;
        this.lastBassMidiNote = currentReference.midiNote;
        
        // Also store in side-specific variables for split mode (use VIRTUAL notes!)
        const isLeftHand = currentReference.midiNote <= this.splitPoint;
        const virtualRefNote = this.mapMidiNoteForSplit(currentReference.midiNote);
        if (isLeftHand) {
          this.leftLastReferenceFrequency = refFreq;
          this.leftLastReferenceMidiNote = virtualRefNote;
        } else {
          this.rightLastReferenceFrequency = refFreq;
          this.rightLastReferenceMidiNote = virtualRefNote;
        }
        
        console.log(`Storing last reference (${this.referenceMode} mode): ${this.justIntervals.getMidiNoteName(virtualRefNote)} at ${refFreq.toFixed(2)} Hz`);
      }
    }
    
    // Mark voices as inactive FIRST (so getReferenceVoice works correctly)
    voicesToRelease.forEach(v => {
      v.isActive = false;
    });
    
    // In random/lattice mode, clear the current reference if we just released it
    if ((this.referenceMode === 'random' || this.referenceMode === 'lattice') && wasReference) {
      this.currentReferenceVoice = null;
    }
    
    // Then apply release envelopes
    voicesToRelease.forEach(v => v.release(this.releaseTime));
    
    // If reference changed and retune mode is enabled, retune remaining voices
    if (wasReference && this.retuneMode !== 'static') {
      return this.retuneToNewReference();
    }
    
    return [];
  }

  /**
   * Retune all active voices to the new reference note
   * Returns array of {midiNote, newFrequency} for retuned notes
   */
  retuneToNewReference() {
    const retunedNotes = [];
    
    for (const voice of this.voices) {
      if (!voice.isActive) continue;
      
      // Get the appropriate reference for this voice (handles split mode)
      const newReference = this.getReferenceVoice(voice.midiNote);
      if (!newReference || voice.midiNote === newReference.midiNote) continue;
      
      // Map to virtual notes for frequency calculation
      const voiceVirtualNote = this.mapMidiNoteForSplit(voice.midiNote);
      const refVirtualNote = this.mapMidiNoteForSplit(newReference.midiNote);
      
      // Get the appropriate JustIntervals for this voice
      const justIntervals = this.getJustIntervalsForNote(voice.midiNote);
      
      // Calculate new frequency based on new reference (using virtual notes)
      const interval = voiceVirtualNote - refVirtualNote;
      const newFrequency = justIntervals.getJustFrequency(
        newReference.frequency,
        refVirtualNote,
        voiceVirtualNote
      );
      
      // Retune the voice
      if (this.retuneMode === 'instant') {
        voice.retune(newFrequency, 'instant');
      } else if (this.retuneMode === 'smooth') {
        voice.retune(newFrequency, 'smooth', this.retuneSpeed);
      }
      
      // Update tuning tracking (use virtual notes)
      voice.tunedToBassNote = refVirtualNote;
      voice.tunedToBassFreq = newReference.frequency;
      
      retunedNotes.push({ midiNote: voice.midiNote, newFrequency });
      
      console.log(`  Retuned ${justIntervals.getMidiNoteName(voiceVirtualNote)} to ${newFrequency.toFixed(2)} Hz`);
    }
    
    if (retunedNotes.length > 0 && this.splitMode === 'off') {
      const newReference = this.getReferenceVoice();
      if (newReference) {
        console.log(`Reference changed to ${this.justIntervals.getMidiNoteName(newReference.midiNote)} (${this.referenceMode} mode), retuning voices in ${this.retuneMode} mode`);
      }
    }
    
    return retunedNotes;
  }

  /**
   * Set pitch bend range in cents
   */
  setPitchBendRange(cents) {
    this.pitchBendRange = cents;
  }

  /**
   * Apply pitch bend
   * @param {number} amount - Normalized bend amount (-1.0 to +1.0)
   */
  applyPitchBend(amount) {
    this.pitchBendAmount = amount;
    const centsOffset = amount * this.pitchBendRange;
    
    // Apply to all active voices
    for (const voice of this.voices) {
      if (voice.isActive && voice.oscillator) {
        // Calculate the bent frequency
        const bendRatio = Math.pow(2, centsOffset / 1200);
        const bentFrequency = voice.frequency * bendRatio;
        
        const now = this.audioContext.currentTime;
        voice.oscillator.frequency.setValueAtTime(bentFrequency, now);
      }
    }
  }

  /**
   * Set vibrato amount for all voices (mod wheel control)
   * @param {number} amount - 0.0 to 1.0
   */
  setVibratoAmount(amount) {
    for (const voice of this.voices) {
      if (voice.isActive) {
        voice.setVibratoAmount(amount);
      }
    }
  }

  /**
   * Set split keyboard mode
   * @param {string} mode - 'off', 'independent', or 'shared'
   */
  setSplitMode(mode) {
    this.splitMode = mode;
    console.log(`Split keyboard mode: ${mode}`);
    
    // Update panning for all voices based on new mode
    this.updateAllVoicePanning();
    
    // If switching to split mode, may need to retune voices
    if (mode !== 'off') {
      const activeVoices = this.voices.filter(v => v.isActive);
      if (activeVoices.length > 0) {
        this.retuneToNewReference(null); // Retune based on new split references
      }
    }
  }

  /**
   * Get the reference frequency with pitch bend applied
   */
  getReferenceFrequencyWithBend() {
    const referenceVoice = this.getReferenceVoice();
    if (!referenceVoice) return null;
    
    const centsOffset = this.pitchBendAmount * this.pitchBendRange;
    const bendRatio = Math.pow(2, centsOffset / 1200);
    return referenceVoice.frequency * bendRatio;
  }

  /**
   * Set stereo spread amount (0.0 to 1.0)
   */
  setStereoSpread(amount) {
    this.stereoSpread = Math.max(0, Math.min(1, amount));
    this.updateAllVoicePanning();
  }

  /**
   * Set spread mode
   */
  setSpreadMode(mode) {
    this.spreadMode = mode;
    this.updateAllVoicePanning();
  }

  /**
   * Set tuning system for left keyboard
   */
  setLeftTuningSystem(systemName) {
    this.leftJustIntervals.setTuningSystem(systemName);
    console.log(`Left keyboard tuning system: ${systemName}`);
  }

  /**
   * Set tuning system for right keyboard
   */
  setRightTuningSystem(systemName) {
    this.rightJustIntervals.setTuningSystem(systemName);
    console.log(`Right keyboard tuning system: ${systemName}`);
  }

  /**
   * Calculate pan position for a voice based on spread mode
   */
  calculatePanPosition(voice, voiceIndex) {
    // Split mode overrides normal panning - hard left/right
    if (this.splitMode !== 'off') {
      const isLeftHand = voice.midiNote <= this.splitPoint;
      return isLeftHand ? -1 : 1; // Hard left for left hand, hard right for right hand
    }
    
    if (this.stereoSpread === 0) return 0;
    
    const activeVoices = this.voices.filter(v => v.isActive);
    const numActive = activeVoices.length;
    if (numActive <= 1) return 0;
    
    let panValue = 0;
    
    switch (this.spreadMode) {
      case 'linear':
        // Evenly distribute voices across stereo field
        const voicePosition = activeVoices.indexOf(voice);
        panValue = (voicePosition / (numActive - 1)) * 2 - 1; // -1 to 1
        break;
        
      case 'pitch':
        // Pan based on frequency (lower = left, higher = right)
        const minFreq = Math.min(...activeVoices.map(v => v.frequency));
        const maxFreq = Math.max(...activeVoices.map(v => v.frequency));
        if (maxFreq > minFreq) {
          panValue = ((voice.frequency - minFreq) / (maxFreq - minFreq)) * 2 - 1;
        }
        break;
        
      case 'harmonic':
        // Pan based on interval from reference
        const refVoice = this.getReferenceVoice();
        if (refVoice && voice !== refVoice) {
          const interval = Math.abs(voice.midiNote - refVoice.midiNote);
          // Center the reference, spread others by interval size
          panValue = (interval % 12) / 12 * 2 - 1;
          // Alternate sides for ascending/descending
          if (voice.midiNote < refVoice.midiNote) panValue *= -1;
        }
        break;
        
      case 'alternating':
        // Simple L/R alternating pattern
        panValue = (voiceIndex % 2 === 0) ? -1 : 1;
        break;
    }
    
    // Apply spread amount (0 = mono, 1 = full stereo)
    return panValue * this.stereoSpread;
  }

  /**
   * Update panning for all active voices
   */
  updateAllVoicePanning() {
    this.voices.forEach((voice, index) => {
      if (voice.isActive) {
        const panPosition = this.calculatePanPosition(voice, index);
        voice.setPan(panPosition);
      }
    });
  }

  /**
   * Reset - stop all voices
   */
  resetReference() {
    this.voices.forEach(v => v.stop());
    this.pitchBendAmount = 0; // Reset pitch bend
    
    // Clear all stored references
    this.lastBassFrequency = null;
    this.lastBassMidiNote = null;
    this.leftLastReferenceFrequency = null;
    this.leftLastReferenceMidiNote = null;
    this.rightLastReferenceFrequency = null;
    this.rightLastReferenceMidiNote = null;
    
    this.currentReferenceVoice = null; // Clear random mode reference
    console.log('All voices stopped');
  }

  /**
   * Get current synth state
   */
  getState() {
    const activeVoices = this.voices.filter(v => v.isActive);
    const referenceVoice = this.getReferenceVoice();
    const bassVoice = this.getLowestActiveVoice(); // Keep for backwards compat
    
    return {
      activeVoiceCount: activeVoices.length,
      maxVoices: this.maxVoices,
      activeNotes: activeVoices.map(v => ({
        midiNote: v.midiNote,
        frequency: v.frequency,
        noteName: this.justIntervals.getMidiNoteName(v.midiNote)
      })),
      referenceMode: this.referenceMode,
      referenceNote: referenceVoice ? this.mapMidiNoteForSplit(referenceVoice.midiNote) : null,
      referenceFrequency: referenceVoice ? referenceVoice.frequency : null,
      bassNote: bassVoice ? bassVoice.midiNote : null, // Backwards compat
      bassFrequency: bassVoice ? bassVoice.frequency : null, // Backwards compat
      waveform: this.waveform,
      filterFrequency: this.filterFrequency,
      filterQ: this.filterQ
    };
  }
}
