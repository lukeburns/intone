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
    
    // State
    this.isActive = false;
    this.midiNote = null;
    this.frequency = null;
    this.noteOnTime = null;
    
    // Tuning tracking
    this.tunedToBassNote = null;  // Which bass note was this tuned against?
    this.tunedToBassFreq = null;
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
    
    // Create new oscillator
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = params.waveform;
    this.oscillator.frequency.value = frequency;
    
    // Create filter
    this.filter = this.audioContext.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = params.filterFrequency;
    this.filter.Q.value = params.filterQ;
    
    // Create gain envelope
    this.gainEnvelope = this.audioContext.createGain();
    this.gainEnvelope.gain.value = 0;
    
    // Connect the audio graph
    this.oscillator.connect(this.filter);
    this.filter.connect(this.gainEnvelope);
    this.gainEnvelope.connect(this.masterGain);
    
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
    
    const oldOsc = this.oscillator;
    const oldGain = this.gainEnvelope;
    const oldFilter = this.filter;
    
    setTimeout(() => {
      oldOsc.disconnect();
      oldGain.disconnect();
      oldFilter.disconnect();
    }, releaseTime * 1000 + 100);
    
    this.oscillator = null;
    this.gainEnvelope = null;
    this.filter = null;
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
        
        // Disconnect after fade
        setTimeout(() => {
          try {
            this.oscillator.disconnect();
            this.filter.disconnect();
            this.gainEnvelope.disconnect();
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
    }
    
    this.isActive = false;
    this.midiNote = null;
    this.frequency = null;
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
    
    // Voice pool
    this.maxVoices = polyphony;
    this.voices = [];
    
    // Pitch bend
    this.pitchBendRange = 200; // cents (default ±2 semitones)
    this.pitchBendAmount = 0; // -1.0 to +1.0
    
    // Last audible bass (used as reference for next note)
    this.lastBassFrequency = null;
    this.lastBassMidiNote = null;
    
    // Reference mode and tracking
    this.referenceMode = 'bass'; // 'bass' or 'random'
    this.currentReferenceVoice = null; // For random mode: sticky reference
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
   * Returns the voice that other notes should tune relative to
   */
  getReferenceVoice() {
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
    }
    
    return this.getLowestActiveVoice(); // Fallback
  }

  /**
   * Set reference mode: 'bass' (lowest note) or 'random' (random sticky note)
   */
  setReferenceMode(mode) {
    if (mode !== 'bass' && mode !== 'random') {
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
   * Play a note using just intonation based on the reference note
   */
  noteOn(midiNote, velocity) {
    // Get reference note for tuning
    const referenceVoice = this.getReferenceVoice();
    
    let frequency;
    let intervalInfo = null;
    let usedStoredReference = false;
    
    if (!referenceVoice) {
      // First note: use stored reference if available, otherwise equal temperament
      if (this.lastBassFrequency !== null && this.lastBassMidiNote !== null) {
        usedStoredReference = true;
        // Calculate frequency based on interval from stored reference
        if (midiNote === this.lastBassMidiNote) {
          // Same note as stored reference, use it directly
          frequency = this.lastBassFrequency;
          console.log(`First note (reference): ${this.justIntervals.getMidiNoteName(midiNote)} at ${frequency.toFixed(2)} Hz (from stored reference)`);
        } else {
          // Different note, calculate interval from stored reference
          const interval = midiNote - this.lastBassMidiNote;
          frequency = this.justIntervals.getJustFrequency(
            this.lastBassFrequency,
            this.lastBassMidiNote,
            midiNote
          );
          
          const ratioString = this.justIntervals.getRatioString(interval);
          const intervalName = this.justIntervals.getIntervalName(interval);
          console.log(`First note (reference): ${this.justIntervals.getMidiNoteName(midiNote)} at ${frequency.toFixed(2)} Hz (${intervalName} from stored reference)`);
          
          // Create interval info for UI
          intervalInfo = {
            interval,
            ratio: ratioString,
            name: intervalName,
            referenceMidi: this.lastBassMidiNote,
            referenceFreq: this.lastBassFrequency,
            referenceNote: this.justIntervals.getMidiNoteName(this.lastBassMidiNote)
          };
        }
      } else {
        // No previous reference, use equal temperament
        frequency = this.justIntervals.midiToFrequency(midiNote);
        console.log(`First note (reference): ${this.justIntervals.getMidiNoteName(midiNote)} at ${frequency.toFixed(2)} Hz (equal temperament)`);
      }
      
      // This becomes the new reference, store it
      this.lastBassFrequency = frequency;
      this.lastBassMidiNote = midiNote;
    } else {
      // Calculate just intonation based on the reference note
      const interval = midiNote - referenceVoice.midiNote;
      frequency = this.justIntervals.getJustFrequency(
        referenceVoice.frequency,
        referenceVoice.midiNote,
        midiNote
      );
      
      const ratioString = this.justIntervals.getRatioString(interval);
      const intervalName = this.justIntervals.getIntervalName(interval);
      
      intervalInfo = {
        interval,
        ratio: ratioString,
        name: intervalName,
        referenceMidi: referenceVoice.midiNote,
        referenceFreq: referenceVoice.frequency,
        referenceNote: this.justIntervals.getMidiNoteName(referenceVoice.midiNote)
      };
      
      console.log(`Playing ${this.justIntervals.getMidiNoteName(midiNote)} at ${frequency.toFixed(2)} Hz`);
      console.log(`  Interval: ${intervalName} (${ratioString}) from reference note ${intervalInfo.referenceNote} [${this.referenceMode} mode]`);
    }
    
    // Allocate and start voice
    const allocation = this.allocateVoice(midiNote);
    const voice = allocation.voice;
    const stolenNote = allocation.stolenNote;
    
    voice.start(
      midiNote, 
      frequency, 
      velocity, 
      this.getVoiceParams(),
      referenceVoice ? referenceVoice.midiNote : midiNote,
      referenceVoice ? referenceVoice.frequency : frequency
    );
    
    return {
      midiNote,
      frequency,
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
   */
  _releaseNote(midiNote) {
    // Find all voices playing this note
    const voicesToRelease = this.voices.filter(v => v.isActive && v.midiNote === midiNote);
    
    // Get current reference BEFORE releasing
    const currentReference = this.getReferenceVoice();
    const wasReference = voicesToRelease.some(v => {
      return currentReference && v.midiNote === currentReference.midiNote;
    });
    
    // If releasing the reference, store its current audible frequency (with pitch bend)
    if (wasReference && currentReference) {
      const refFreq = this.getReferenceFrequencyWithBend();
      if (refFreq) {
        this.lastBassFrequency = refFreq;
        this.lastBassMidiNote = currentReference.midiNote;
        console.log(`Storing last reference (${this.referenceMode} mode): ${this.justIntervals.getMidiNoteName(currentReference.midiNote)} at ${refFreq.toFixed(2)} Hz`);
      }
    }
    
    // Mark voices as inactive FIRST (so getReferenceVoice works correctly)
    voicesToRelease.forEach(v => {
      v.isActive = false;
    });
    
    // In random mode, clear the current reference if we just released it
    if (this.referenceMode === 'random' && wasReference) {
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
    const newReference = this.getReferenceVoice();
    if (!newReference) return [];
    
    console.log(`Reference changed to ${this.justIntervals.getMidiNoteName(newReference.midiNote)} (${this.referenceMode} mode), retuning voices in ${this.retuneMode} mode`);
    
    const retunedNotes = [];
    
    for (const voice of this.voices) {
      if (!voice.isActive || voice.midiNote === newReference.midiNote) continue;
      
      // Calculate new frequency based on new reference
      const interval = voice.midiNote - newReference.midiNote;
      const newFrequency = this.justIntervals.getJustFrequency(
        newReference.frequency,
        newReference.midiNote,
        voice.midiNote
      );
      
      // Retune the voice
      if (this.retuneMode === 'instant') {
        voice.retune(newFrequency, 'instant');
      } else if (this.retuneMode === 'smooth') {
        voice.retune(newFrequency, 'smooth', this.retuneSpeed);
      }
      
      // Update tuning tracking
      voice.tunedToBassNote = newReference.midiNote;
      voice.tunedToBassFreq = newReference.frequency;
      
      retunedNotes.push({ midiNote: voice.midiNote, newFrequency });
      
      console.log(`  Retuned ${this.justIntervals.getMidiNoteName(voice.midiNote)} to ${newFrequency.toFixed(2)} Hz`);
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
   * Reset - stop all voices
   */
  resetReference() {
    this.voices.forEach(v => v.stop());
    this.pitchBendAmount = 0; // Reset pitch bend
    this.lastBassFrequency = null; // Clear stored reference
    this.lastBassMidiNote = null;
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
      referenceNote: referenceVoice ? referenceVoice.midiNote : null,
      referenceFrequency: referenceVoice ? referenceVoice.frequency : null,
      bassNote: bassVoice ? bassVoice.midiNote : null, // Backwards compat
      bassFrequency: bassVoice ? bassVoice.frequency : null, // Backwards compat
      waveform: this.waveform,
      filterFrequency: this.filterFrequency,
      filterQ: this.filterQ
    };
  }
}
