import { JustIntervals } from './just-intervals.js';

/**
 * Web Audio Synthesizer Engine
 * Creates and manages audio synthesis with just intonation
 */

export class Synth {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.oscillator = null;
    this.gainEnvelope = null;
    this.filter = null;
    this.justIntervals = new JustIntervals();
    
    // Reference note tracking
    this.lastPlayedNote = null;
    this.lastPlayedFrequency = null;
    this.currentNote = null;
    this.currentFrequency = null;
    
    // Synth parameters
    this.waveform = 'sawtooth';
    
    // ADSR Envelope parameters
    this.attackTime = 0.02;      // Attack time in seconds
    this.decayTime = 0.2;        // Decay time in seconds
    this.sustainLevel = 0.7;     // Sustain level (0-1)
    this.releaseTime = 0.3;      // Release time in seconds
    
    this.filterFrequency = 2000;
    this.filterQ = 5;
    
    // Filter envelope parameters
    this.filterEnvelopeAmount = 3000;  // Amount to modulate filter frequency
    this.filterAttack = 0.01;
    this.filterDecay = 0.3;
    this.filterSustain = 0.3;
  }

  /**
   * Initialize the audio context
   */
  async init() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create master gain
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.audioContext.destination);
    
    console.log('Synth initialized. Sample rate:', this.audioContext.sampleRate);
  }

  /**
   * Play a note using just intonation based on the last played note
   * @param {number} midiNote - MIDI note number
   * @param {number} velocity - MIDI velocity (0-127)
   */
  noteOn(midiNote, velocity) {
    // Stop any currently playing note
    this.noteOff();
    
    let frequency;
    let intervalInfo = null;
    
    if (this.lastPlayedNote === null) {
      // First note: use equal temperament as reference
      frequency = this.justIntervals.midiToFrequency(midiNote);
      console.log(`First note: ${this.justIntervals.getMidiNoteName(midiNote)} at ${frequency.toFixed(2)} Hz (equal temperament)`);
    } else {
      // Calculate just intonation based on the last note
      const interval = midiNote - this.lastPlayedNote;
      frequency = this.justIntervals.getJustFrequency(
        this.lastPlayedFrequency,
        this.lastPlayedNote,
        midiNote
      );
      
      const ratioString = this.justIntervals.getRatioString(interval);
      const intervalName = this.justIntervals.getIntervalName(interval);
      
      intervalInfo = {
        interval,
        ratio: ratioString,
        name: intervalName,
        referenceMidi: this.lastPlayedNote,
        referenceFreq: this.lastPlayedFrequency,
        referenceNote: this.justIntervals.getMidiNoteName(this.lastPlayedNote)
      };
      
      console.log(`Playing ${this.justIntervals.getMidiNoteName(midiNote)} at ${frequency.toFixed(2)} Hz`);
      console.log(`  Interval: ${intervalName} (${ratioString})`);
      console.log(`  Reference: ${intervalInfo.referenceNote} (${this.lastPlayedFrequency.toFixed(2)} Hz)`);
    }
    
    // Create oscillator
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = this.waveform;
    this.oscillator.frequency.value = frequency;
    
    // Create filter
    this.filter = this.audioContext.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.filterFrequency;
    this.filter.Q.value = this.filterQ;
    
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
    const peakGain = normalizedVelocity * 0.8;
    const sustainGain = peakGain * this.sustainLevel;
    
    // Amplitude envelope: Attack -> Decay -> Sustain (hold indefinitely)
    this.gainEnvelope.gain.cancelScheduledValues(now);
    this.gainEnvelope.gain.setValueAtTime(0, now);
    this.gainEnvelope.gain.linearRampToValueAtTime(peakGain, now + this.attackTime);
    this.gainEnvelope.gain.linearRampToValueAtTime(sustainGain, now + this.attackTime + this.decayTime);
    // Hold the sustain level - set it again at the end of decay to ensure it stays there
    this.gainEnvelope.gain.setValueAtTime(sustainGain, now + this.attackTime + this.decayTime);
    
    // Filter envelope: Attack -> Decay -> Sustain (hold indefinitely)
    const baseFilterFreq = this.filterFrequency;
    const peakFilterFreq = Math.min(baseFilterFreq + (this.filterEnvelopeAmount * normalizedVelocity), 20000);
    const sustainFilterFreq = baseFilterFreq + (this.filterEnvelopeAmount * this.filterSustain * normalizedVelocity);
    
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(baseFilterFreq, now);
    this.filter.frequency.linearRampToValueAtTime(peakFilterFreq, now + this.filterAttack);
    this.filter.frequency.linearRampToValueAtTime(sustainFilterFreq, now + this.filterAttack + this.filterDecay);
    // Hold the sustain level
    this.filter.frequency.setValueAtTime(sustainFilterFreq, now + this.filterAttack + this.filterDecay);
    
    // Update tracking
    this.currentNote = midiNote;
    this.currentFrequency = frequency;
    
    return {
      midiNote,
      frequency,
      noteName: this.justIntervals.getMidiNoteName(midiNote),
      velocity,
      intervalInfo
    };
  }

  /**
   * Stop the currently playing note
   */
  noteOff() {
    if (this.oscillator) {
      const now = this.audioContext.currentTime;
      
      // Apply release envelope for both gain and filter
      this.gainEnvelope.gain.cancelScheduledValues(now);
      this.gainEnvelope.gain.setValueAtTime(this.gainEnvelope.gain.value, now);
      this.gainEnvelope.gain.exponentialRampToValueAtTime(0.001, now + this.releaseTime);
      
      this.filter.frequency.cancelScheduledValues(now);
      this.filter.frequency.setValueAtTime(this.filter.frequency.value, now);
      this.filter.frequency.exponentialRampToValueAtTime(Math.max(this.filterFrequency * 0.5, 20), now + this.releaseTime);
      
      // Stop and clean up after release
      this.oscillator.stop(now + this.releaseTime);
      
      const oldOsc = this.oscillator;
      const oldGain = this.gainEnvelope;
      const oldFilter = this.filter;
      
      setTimeout(() => {
        oldOsc.disconnect();
        oldGain.disconnect();
        oldFilter.disconnect();
      }, this.releaseTime * 1000 + 100);
      
      // Update reference to current note for next calculation
      if (this.currentNote !== null) {
        this.lastPlayedNote = this.currentNote;
        this.lastPlayedFrequency = this.currentFrequency;
      }
      
      this.oscillator = null;
      this.gainEnvelope = null;
      this.filter = null;
      this.currentNote = null;
      this.currentFrequency = null;
    }
  }

  /**
   * Set the waveform type
   * @param {string} type - 'sine', 'square', 'sawtooth', 'triangle'
   */
  setWaveform(type) {
    this.waveform = type;
    if (this.oscillator) {
      this.oscillator.type = type;
    }
  }

  /**
   * Set the filter cutoff frequency
   * @param {number} frequency - Frequency in Hz
   */
  setFilterFrequency(frequency) {
    this.filterFrequency = frequency;
    if (this.filter) {
      this.filter.frequency.value = frequency;
    }
  }

  /**
   * Set the filter resonance
   * @param {number} q - Q factor
   */
  setFilterQ(q) {
    this.filterQ = q;
    if (this.filter) {
      this.filter.Q.value = q;
    }
  }

  /**
   * Set the master volume
   * @param {number} volume - Volume (0-1)
   */
  setVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  /**
   * Set the attack time
   * @param {number} time - Attack time in seconds
   */
  setAttackTime(time) {
    this.attackTime = time;
  }

  /**
   * Set the decay time
   * @param {number} time - Decay time in seconds
   */
  setDecayTime(time) {
    this.decayTime = time;
  }

  /**
   * Set the sustain level
   * @param {number} level - Sustain level (0-1)
   */
  setSustainLevel(level) {
    this.sustainLevel = level;
  }

  /**
   * Set the release time
   * @param {number} time - Release time in seconds
   */
  setReleaseTime(time) {
    this.releaseTime = time;
  }

  /**
   * Set the filter envelope amount
   * @param {number} amount - Filter modulation amount in Hz
   */
  setFilterEnvelopeAmount(amount) {
    this.filterEnvelopeAmount = amount;
  }

  /**
   * Reset the reference note
   */
  resetReference() {
    this.lastPlayedNote = null;
    this.lastPlayedFrequency = null;
    console.log('Reference note reset');
  }

  /**
   * Get current synth state
   */
  getState() {
    return {
      isPlaying: this.oscillator !== null,
      currentNote: this.currentNote,
      currentFrequency: this.currentFrequency,
      lastPlayedNote: this.lastPlayedNote,
      lastPlayedFrequency: this.lastPlayedFrequency,
      waveform: this.waveform,
      filterFrequency: this.filterFrequency,
      filterQ: this.filterQ
    };
  }
}
