/**
 * SettingsManager - Persist synth settings to localStorage
 */

export class SettingsManager {
  constructor(storageKey = 'just-interval-synth-settings') {
    this.storageKey = storageKey;
  }

  /**
   * Save settings to localStorage
   */
  saveSettings(settings) {
    try {
      const json = JSON.stringify(settings);
      localStorage.setItem(this.storageKey, json);
      console.log('Settings saved:', settings);
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const json = localStorage.getItem(this.storageKey);
      if (json) {
        const settings = JSON.parse(json);
        console.log('Settings loaded:', settings);
        return settings;
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    return null;
  }

  /**
   * Clear saved settings
   */
  clearSettings() {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('Settings cleared');
    } catch (e) {
      console.warn('Failed to clear settings:', e);
    }
  }

  /**
   * Get default settings for monosynth
   */
  static getMonoDefaults() {
    return {
      waveform: 'sawtooth',
      attack: 20,
      decay: 200,
      sustain: 70,
      release: 300,
      filterFreq: 2000,
      filterQ: 5,
      filterEnv: 3000,
      volume: 30
    };
  }

  /**
   * Get default settings for polysynth
   */
  static getPolyDefaults() {
    return {
      waveform: 'sine',
      referenceMode: 'harmonic',
      retuneMode: 'smooth',
      attack: 20,
      decay: 200,
      sustain: 70,
      release: 300,
      filterFreq: 2000,
      filterQ: 5,
      filterEnv: 3000,
      volume: 40,
      stereoSpread: 69,
      spreadMode: 'harmonic'
    };
  }
}
