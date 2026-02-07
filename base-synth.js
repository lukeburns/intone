/**
 * BaseSynth - Shared synth parameters and functionality
 * Provides common ADSR, filter, and control parameters
 */

export class BaseSynth {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    
    // Synth parameters
    this.waveform = 'sawtooth';
    
    // ADSR Envelope parameters
    this.attackTime = 0.02;      // Attack time in seconds
    this.decayTime = 0.2;        // Decay time in seconds
    this.sustainLevel = 0.7;     // Sustain level (0-1)
    this.releaseTime = 0.3;      // Release time in seconds
    
    // Filter parameters
    this.filterFrequency = 2000;
    this.filterQ = 5;
    
    // Filter envelope parameters
    this.filterEnvelopeAmount = 3000;  // Amount to modulate filter frequency
    this.filterAttack = 0.01;
    this.filterDecay = 0.3;
    this.filterSustain = 0.3;
    
    // Sustain pedal state
    this.sustainPedalDown = false;
    this.sustainedNotes = new Set();  // Notes held by sustain pedal
    
    // Retuning mode (for polysynth)
    this.retuneMode = 'static'; // 'static', 'smooth', 'instant'
    this.retuneSpeed = 0.2; // seconds for smooth retune
  }

  /**
   * Get current synth parameters for voice starting
   */
  getVoiceParams() {
    return {
      waveform: this.waveform,
      attackTime: this.attackTime,
      decayTime: this.decayTime,
      sustainLevel: this.sustainLevel,
      filterFrequency: this.filterFrequency,
      filterQ: this.filterQ,
      filterEnvelopeAmount: this.filterEnvelopeAmount,
      filterAttack: this.filterAttack,
      filterDecay: this.filterDecay,
      filterSustain: this.filterSustain
    };
  }

  /**
   * Set the waveform type
   */
  setWaveform(type) {
    this.waveform = type;
  }

  /**
   * Set the filter cutoff frequency
   */
  setFilterFrequency(frequency) {
    this.filterFrequency = frequency;
  }

  /**
   * Set the filter resonance
   */
  setFilterQ(q) {
    this.filterQ = q;
  }

  /**
   * Set the master volume
   */
  setVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  /**
   * Set the attack time
   */
  setAttackTime(time) {
    this.attackTime = time;
  }

  /**
   * Set the decay time
   */
  setDecayTime(time) {
    this.decayTime = time;
  }

  /**
   * Set the sustain level
   */
  setSustainLevel(level) {
    this.sustainLevel = level;
  }

  /**
   * Set the release time
   */
  setReleaseTime(time) {
    this.releaseTime = time;
  }

  /**
   * Set the filter envelope amount
   */
  setFilterEnvelopeAmount(amount) {
    this.filterEnvelopeAmount = amount;
  }

  /**
   * Set the retune mode (for polysynth)
   */
  setRetuneMode(mode) {
    this.retuneMode = mode;
    console.log(`Retune mode: ${mode}`);
  }

  /**
   * Set the retune speed (for smooth mode)
   */
  setRetuneSpeed(speed) {
    this.retuneSpeed = speed;
  }

  /**
   * Handle sustain pedal down
   */
  handleSustainPedalDown() {
    this.sustainPedalDown = true;
    console.log('Sustain pedal: DOWN');
  }

  /**
   * Handle sustain pedal up - release all sustained notes
   * Returns array of retuned notes (for polysynth)
   */
  handleSustainPedalUp() {
    this.sustainPedalDown = false;
    console.log('Sustain pedal: UP');
    
    // Release all notes that were being held by the pedal
    const notesToRelease = Array.from(this.sustainedNotes);
    this.sustainedNotes.clear();
    
    const allRetunedNotes = [];
    notesToRelease.forEach(note => {
      const retunedNotes = this._releaseNote(note);
      if (retunedNotes && Array.isArray(retunedNotes)) {
        allRetunedNotes.push(...retunedNotes);
      }
    });
    
    return allRetunedNotes;
  }

  /**
   * Handle note off with sustain pedal consideration
   * Returns true if note should be released, false if sustained
   */
  handleNoteOffWithSustain(midiNote) {
    if (this.sustainPedalDown) {
      // Pedal is down - add to sustained notes instead of releasing
      this.sustainedNotes.add(midiNote);
      console.log(`Note ${midiNote} held by sustain pedal`);
      return false;  // Don't release yet
    } else {
      // No pedal - release immediately
      return true;
    }
  }

  /**
   * Abstract method - must be implemented by subclass
   */
  _releaseNote(midiNote) {
    throw new Error('_releaseNote must be implemented by subclass');
  }
}
