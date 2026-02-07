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
    this.sustainedNotes = new Set();  // MIDI notes held by sustain pedal (for compatibility)
    this.sustainedVoices = new Set(); // Specific voice instances held by sustain pedal
    this.keysHeldDown = new Set();    // MIDI notes with keys currently physically held down
    
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
   * Handle sustain pedal up - release all sustained notes that aren't being held
   * Returns array of retuned notes (for polysynth)
   */
  handleSustainPedalUp() {
    this.sustainPedalDown = false;
    console.log('Sustain pedal: UP');
    console.log('Keys currently held down:', Array.from(this.keysHeldDown));
    console.log('Sustained notes:', Array.from(this.sustainedNotes));
    
    // Release notes that were sustained BUT whose keys are no longer held down
    const notesToRelease = Array.from(this.sustainedNotes).filter(note => !this.keysHeldDown.has(note));
    const voicesToRelease = Array.from(this.sustainedVoices);
    
    console.log('Notes to release (sustained but not held):', notesToRelease);
    
    this.sustainedNotes.clear();
    this.sustainedVoices.clear();
    
    const allRetunedNotes = [];
    notesToRelease.forEach(note => {
      // Pass the set of sustained voices so _releaseNote knows which to release
      const retunedNotes = this._releaseNote(note, voicesToRelease);
      if (retunedNotes && Array.isArray(retunedNotes)) {
        allRetunedNotes.push(...retunedNotes);
      }
    });
    
    return allRetunedNotes;
  }

  /**
   * Handle note off with sustain pedal consideration
   * Returns true if note should be released, false if sustained
   * @param {number} midiNote - The MIDI note number
   * @param {Object} voice - Optional: the specific voice instance to sustain (for polysynth)
   */
  handleNoteOffWithSustain(midiNote, voice = null) {
    if (this.sustainPedalDown) {
      // Pedal is down - add to sustained notes instead of releasing
      this.sustainedNotes.add(midiNote);
      if (voice) {
        this.sustainedVoices.add(voice);
      }
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
