/**
 * Just Intonation Interval Calculator
 * Maps semitone intervals to perfect frequency ratios
 */

export class JustIntervals {
  constructor() {
    // Just intonation ratios for each semitone interval (0-12)
    // These are the pure harmonic ratios
    this.intervalRatios = {
      0: [1, 1],          // Unison
      1: [16, 15],        // Minor second (semitone)
      2: [9, 8],          // Major second (whole tone)
      3: [6, 5],          // Minor third
      4: [5, 4],          // Major third
      5: [4, 3],          // Perfect fourth
      6: [45, 32],        // Tritone (augmented fourth)
      7: [3, 2],          // Perfect fifth
      8: [8, 5],          // Minor sixth
      9: [5, 3],          // Major sixth
      10: [9, 5],         // Minor seventh
      11: [15, 8],        // Major seventh
      12: [2, 1]          // Octave
    };
  }

  /**
   * Calculate the just intonation frequency based on a reference note
   * @param {number} referenceFreq - The frequency of the reference note (Hz)
   * @param {number} referenceMidi - The MIDI note number of the reference
   * @param {number} targetMidi - The MIDI note number to calculate
   * @returns {number} The just intonation frequency (Hz)
   */
  getJustFrequency(referenceFreq, referenceMidi, targetMidi) {
    const interval = targetMidi - referenceMidi;
    const absInterval = Math.abs(interval);
    
    // Calculate octave offset and interval within octave
    const octaves = Math.floor(absInterval / 12);
    const semitones = absInterval % 12;
    
    // Get the ratio for the interval
    const [numerator, denominator] = this.intervalRatios[semitones];
    let ratio = numerator / denominator;
    
    // Apply octave multiplier
    ratio *= Math.pow(2, octaves);
    
    // If interval is negative (going down), invert the ratio
    if (interval < 0) {
      ratio = 1 / ratio;
    }
    
    return referenceFreq * ratio;
  }

  /**
   * Get the ratio as a string for display
   * @param {number} semitones - Number of semitones (0-12)
   * @returns {string} The ratio as a string
   */
  getRatioString(semitones) {
    const abs = Math.abs(semitones) % 12;
    const [num, den] = this.intervalRatios[abs];
    return `${num}:${den}`;
  }

  /**
   * Get the interval name
   * @param {number} semitones - Number of semitones
   * @returns {string} The interval name
   */
  getIntervalName(semitones) {
    const abs = Math.abs(semitones) % 12;
    const names = [
      'Unison',
      'Minor 2nd',
      'Major 2nd',
      'Minor 3rd',
      'Major 3rd',
      'Perfect 4th',
      'Tritone',
      'Perfect 5th',
      'Minor 6th',
      'Major 6th',
      'Minor 7th',
      'Major 7th',
      'Octave'
    ];
    
    const octaves = Math.floor(Math.abs(semitones) / 12);
    let name = names[abs];
    
    if (octaves > 0) {
      name += ` + ${octaves} octave${octaves > 1 ? 's' : ''}`;
    }
    
    if (semitones < 0) {
      name += ' (descending)';
    }
    
    return name;
  }

  /**
   * Convert MIDI note number to frequency using equal temperament (A4 = 440 Hz)
   * Used only for the very first note
   * @param {number} midiNote - MIDI note number (0-127)
   * @returns {number} Frequency in Hz
   */
  midiToFrequency(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  /**
   * Get MIDI note name
   * @param {number} midiNote - MIDI note number (0-127)
   * @returns {string} Note name (e.g., "C4", "A#5")
   */
  getMidiNoteName(midiNote) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = noteNames[midiNote % 12];
    return `${noteName}${octave}`;
  }
}
