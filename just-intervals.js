/**
 * Just Intonation Interval Calculator
 * Maps semitone intervals to perfect frequency ratios
 */

export class JustIntervals {
  constructor() {
    // Different tuning systems
    this.tuningSystems = {
      'equal': {
        name: 'Equal Temperament',
        description: 'Standard 12-tone equal temperament - reference for comparison',
        ratios: 'equal' // Special marker for equal temperament
      },
      '5-limit': {
        name: '5-Limit (Classical)',
        description: 'Pure major/minor harmonies using factors of 2, 3, 5',
        ratios: {
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
        }
      },
      '7-limit': {
        name: '7-Limit (Blues/Jazz)',
        description: 'Adds 7th harmonic for bluesier intervals',
        ratios: {
          0: [1, 1],          // Unison
          1: [16, 15],        // Minor second
          2: [9, 8],          // Major second
          3: [6, 5],          // Minor third
          4: [5, 4],          // Major third
          5: [4, 3],          // Perfect fourth
          6: [7, 5],          // Tritone (natural, from 7th harmonic)
          7: [3, 2],          // Perfect fifth
          8: [8, 5],          // Minor sixth
          9: [5, 3],          // Major sixth
          10: [7, 4],         // Natural seventh (968¢, very flat!)
          11: [15, 8],        // Major seventh
          12: [2, 1]          // Octave
        }
      },
      'pythagorean': {
        name: 'Pythagorean (Medieval)',
        description: 'Built from perfect fifths, sharp major thirds',
        ratios: {
          0: [1, 1],          // Unison
          1: [256, 243],      // Minor second (Pythagorean)
          2: [9, 8],          // Major second
          3: [32, 27],        // Minor third (Pythagorean)
          4: [81, 64],        // Major third (Pythagorean, sharper!)
          5: [4, 3],          // Perfect fourth
          6: [729, 512],      // Tritone (Pythagorean)
          7: [3, 2],          // Perfect fifth
          8: [128, 81],       // Minor sixth (Pythagorean)
          9: [27, 16],        // Major sixth (Pythagorean)
          10: [16, 9],        // Minor seventh
          11: [243, 128],     // Major seventh (Pythagorean)
          12: [2, 1]          // Octave
        }
      },
      'harmonic': {
        name: 'Harmonic Series',
        description: 'Pure harmonics - approximates closest harmonic up to 16th',
        ratios: {
          0: [1, 1],          // 1:1 (fundamental)
          1: [16, 15],        // ~16:15 (close to harmonic 16)
          2: [9, 8],          // 9:8 (9th harmonic)
          3: [6, 5],          // 6:5 (close to 19:16)
          4: [5, 4],          // 5:4 (5th harmonic)
          5: [4, 3],          // 4:3 (4th harmonic)
          6: [11, 8],         // 11:8 (11th harmonic - very sharp tritone!)
          7: [3, 2],          // 3:2 (3rd harmonic)
          8: [13, 8],         // 13:8 (13th harmonic)
          9: [5, 3],          // 5:3 
          10: [7, 4],         // 7:4 (7th harmonic)
          11: [15, 8],        // 15:8
          12: [2, 1]          // 2:1 (octave)
        }
      }
    };
    
    // Default tuning system
    this.currentSystem = '5-limit';
  }

  /**
   * Set the current tuning system
   */
  setTuningSystem(systemName) {
    if (this.tuningSystems[systemName]) {
      this.currentSystem = systemName;
      console.log(`Tuning system changed to: ${this.tuningSystems[systemName].name}`);
    }
  }

  /**
   * Get current interval ratios
   */
  get intervalRatios() {
    return this.tuningSystems[this.currentSystem].ratios;
  }

  /**
   * Calculate the just intonation frequency based on a reference note
   * @param {number} referenceFreq - The frequency of the reference note (Hz)
   * @param {number} referenceMidi - The MIDI note number of the reference
   * @param {number} targetMidi - The MIDI note number to calculate
   * @returns {number} The just intonation frequency (Hz)
   */
  getJustFrequency(referenceFreq, referenceMidi, targetMidi) {
    // If using equal temperament, calculate using standard formula
    if (this.intervalRatios === 'equal') {
      const semitones = targetMidi - referenceMidi;
      return referenceFreq * Math.pow(2, semitones / 12);
    }
    
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
    if (this.intervalRatios === 'equal') {
      const abs = Math.abs(semitones) % 12;
      // Return equal temperament ratio (2^(n/12):1)
      const ratio = Math.pow(2, abs / 12);
      return `${ratio.toFixed(4)}:1`;
    }
    
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
