import { Synth } from './synth.js';
import { MIDIHandler } from './midi-handler.js';
import { NoteVisualizer } from './visualizer.js';
import { SettingsManager } from './settings-manager.js';

/**
 * Main Application
 */

class App {
  constructor() {
    this.synth = null;
    this.midiHandler = null;
    this.visualizer = null;
    this.isInitialized = false;
    this.settingsManager = new SettingsManager('monosynth-settings');
    
    // UI Elements
    this.elements = {
      startBtn: document.getElementById('startBtn'),
      resetBtn: document.getElementById('resetBtn'),
      errorMessage: document.getElementById('errorMessage'),
      currentNote: document.getElementById('currentNote'),
      currentFreq: document.getElementById('currentFreq'),
      referenceNote: document.getElementById('referenceNote'),
      referenceFreq: document.getElementById('referenceFreq'),
      sustainPedal: document.getElementById('sustainPedal'),
      intervalName: document.getElementById('intervalName'),
      intervalDetails: document.getElementById('intervalDetails'),
      waveform: document.getElementById('waveform'),
      attack: document.getElementById('attack'),
      attackValue: document.getElementById('attackValue'),
      decay: document.getElementById('decay'),
      decayValue: document.getElementById('decayValue'),
      sustain: document.getElementById('sustain'),
      sustainValue: document.getElementById('sustainValue'),
      release: document.getElementById('release'),
      releaseValue: document.getElementById('releaseValue'),
      filterFreq: document.getElementById('filterFreq'),
      filterFreqValue: document.getElementById('filterFreqValue'),
      filterQ: document.getElementById('filterQ'),
      filterQValue: document.getElementById('filterQValue'),
      filterEnv: document.getElementById('filterEnv'),
      filterEnvValue: document.getElementById('filterEnvValue'),
      volume: document.getElementById('volume'),
      volumeValue: document.getElementById('volumeValue'),
      midiDeviceList: document.getElementById('midiDeviceList'),
      visualizerSection: document.getElementById('visualizerSection'),
      fullscreenBtn: document.getElementById('fullscreenBtn'),
      fullscreenIcon: document.getElementById('fullscreenIcon')
    };
    
    this.setupEventListeners();
    this.loadSettings();
  }

  /**
   * Load settings from localStorage and apply to UI
   */
  loadSettings() {
    const settings = this.settingsManager.loadSettings() || SettingsManager.getMonoDefaults();
    
    // Apply to UI
    this.elements.waveform.value = settings.waveform;
    this.elements.attack.value = settings.attack;
    this.elements.attackValue.textContent = `${settings.attack} ms`;
    this.elements.decay.value = settings.decay;
    this.elements.decayValue.textContent = `${settings.decay} ms`;
    this.elements.sustain.value = settings.sustain;
    this.elements.sustainValue.textContent = `${settings.sustain}%`;
    this.elements.release.value = settings.release;
    this.elements.releaseValue.textContent = `${settings.release} ms`;
    this.elements.filterFreq.value = settings.filterFreq;
    this.elements.filterFreqValue.textContent = `${settings.filterFreq} Hz`;
    this.elements.filterQ.value = settings.filterQ;
    this.elements.filterQValue.textContent = settings.filterQ.toFixed(1);
    this.elements.filterEnv.value = settings.filterEnv;
    this.elements.filterEnvValue.textContent = `${settings.filterEnv} Hz`;
    this.elements.volume.value = settings.volume;
    this.elements.volumeValue.textContent = `${settings.volume}%`;
  }

  /**
   * Save current settings to localStorage
   */
  saveSettings() {
    const settings = {
      waveform: this.elements.waveform.value,
      attack: parseInt(this.elements.attack.value),
      decay: parseInt(this.elements.decay.value),
      sustain: parseInt(this.elements.sustain.value),
      release: parseInt(this.elements.release.value),
      filterFreq: parseInt(this.elements.filterFreq.value),
      filterQ: parseFloat(this.elements.filterQ.value),
      filterEnv: parseInt(this.elements.filterEnv.value),
      volume: parseInt(this.elements.volume.value)
    };
    this.settingsManager.saveSettings(settings);
  }

  setupEventListeners() {
    this.elements.startBtn.addEventListener('click', () => this.initialize());
    this.elements.resetBtn.addEventListener('click', () => this.resetReference());
    
    // Fullscreen control
    this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    
    // Listen for fullscreen changes to update button text
    document.addEventListener('fullscreenchange', () => this.updateFullscreenButton());
    document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenButton());
    document.addEventListener('mozfullscreenchange', () => this.updateFullscreenButton());
    document.addEventListener('MSFullscreenChange', () => this.updateFullscreenButton());
    
    // Waveform control
    this.elements.waveform.addEventListener('change', (e) => {
      if (this.synth) {
        this.synth.setWaveform(e.target.value);
      }
      this.saveSettings();
    });
    
    // ADSR controls
    this.elements.attack.addEventListener('input', (e) => {
      const ms = parseInt(e.target.value);
      this.elements.attackValue.textContent = `${ms} ms`;
      if (this.synth) {
        this.synth.setAttackTime(ms / 1000);
      }
      this.saveSettings();
    });
    
    this.elements.decay.addEventListener('input', (e) => {
      const ms = parseInt(e.target.value);
      this.elements.decayValue.textContent = `${ms} ms`;
      if (this.synth) {
        this.synth.setDecayTime(ms / 1000);
      }
      this.saveSettings();
    });
    
    this.elements.sustain.addEventListener('input', (e) => {
      const percent = parseInt(e.target.value);
      this.elements.sustainValue.textContent = `${percent}%`;
      if (this.synth) {
        this.synth.setSustainLevel(percent / 100);
      }
      this.saveSettings();
    });
    
    this.elements.release.addEventListener('input', (e) => {
      const ms = parseInt(e.target.value);
      this.elements.releaseValue.textContent = `${ms} ms`;
      if (this.synth) {
        this.synth.setReleaseTime(ms / 1000);
      }
      this.saveSettings();
    });
    
    // Filter frequency control
    this.elements.filterFreq.addEventListener('input', (e) => {
      const freq = parseInt(e.target.value);
      this.elements.filterFreqValue.textContent = `${freq} Hz`;
      if (this.synth) {
        this.synth.setFilterFrequency(freq);
      }
      this.saveSettings();
    });
    
    // Filter Q control
    this.elements.filterQ.addEventListener('input', (e) => {
      const q = parseFloat(e.target.value);
      this.elements.filterQValue.textContent = q.toFixed(1);
      if (this.synth) {
        this.synth.setFilterQ(q);
      }
      this.saveSettings();
    });
    
    // Filter envelope control
    this.elements.filterEnv.addEventListener('input', (e) => {
      const amount = parseInt(e.target.value);
      this.elements.filterEnvValue.textContent = `${amount} Hz`;
      if (this.synth) {
        this.synth.setFilterEnvelopeAmount(amount);
      }
      this.saveSettings();
    });
    
    // Volume control
    this.elements.volume.addEventListener('input', (e) => {
      const volume = parseInt(e.target.value);
      this.elements.volumeValue.textContent = `${volume}%`;
      if (this.synth) {
        this.synth.setVolume(volume / 100);
      }
      this.saveSettings();
    });
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      this.elements.startBtn.disabled = true;
      this.elements.startBtn.textContent = 'Initializing...';
      
      // Initialize synth
      this.synth = new Synth();
      await this.synth.init();
      
      // Apply saved settings to synth
      const settings = this.settingsManager.loadSettings() || SettingsManager.getMonoDefaults();
      this.synth.setWaveform(settings.waveform);
      this.synth.setAttackTime(settings.attack / 1000);
      this.synth.setDecayTime(settings.decay / 1000);
      this.synth.setSustainLevel(settings.sustain / 100);
      this.synth.setReleaseTime(settings.release / 1000);
      this.synth.setFilterFrequency(settings.filterFreq);
      this.synth.setFilterQ(settings.filterQ);
      this.synth.setFilterEnvelopeAmount(settings.filterEnv);
      this.synth.setVolume(settings.volume / 100);
      
      // Initialize visualizer
      this.visualizer = new NoteVisualizer('noteCanvas');
      
      // Initialize MIDI
      this.midiHandler = new MIDIHandler(
        (note, velocity) => this.handleNoteOn(note, velocity),
        (note) => this.handleNoteOff(note),
        (pedalDown) => this.handleSustainPedal(pedalDown),
        (amount) => this.handlePitchBend(amount)
      );
      
      await this.midiHandler.init();
      
      // Update UI
      this.updateMIDIDeviceList();
      this.elements.startBtn.textContent = '✓ Synth Ready';
      this.elements.startBtn.style.background = '#4caf50';
      this.elements.resetBtn.disabled = false;
      this.isInitialized = true;
      
      this.showSuccess('Synth ready! Play notes on your MIDI controller.');
      
    } catch (error) {
      this.showError(`Failed to initialize: ${error.message}`);
      this.elements.startBtn.disabled = false;
      this.elements.startBtn.textContent = 'Start Synth';
      console.error('Initialization error:', error);
      throw error;
    }
  }

  async ensureInitialized() {
    if (!this.isInitialized) {
      try {
        await this.initialize();
      } catch (error) {
        // If auto-init fails, user will need to click the button
        console.log('Auto-initialization blocked, waiting for user interaction');
      }
    }
  }

  async handleNoteOn(midiNote, velocity) {
    await this.ensureInitialized();
    if (this.synth) {
      const noteInfo = this.synth.noteOn(midiNote, velocity);
      this.updateUI(noteInfo);
      
      // Update visualizer
      if (this.visualizer) {
        // In monosynth, the current note is always the reference
        this.visualizer.noteOn(midiNote, noteInfo.frequency, true);
      }
    }
  }

  async handleNoteOff(midiNote) {
    await this.ensureInitialized();
    if (this.synth) {
      // Only trigger noteOff if this is the currently playing note
      const state = this.synth.getState();
      if (state.currentNote === midiNote) {
        // Check if sustain pedal should hold the note
        if (this.synth.handleNoteOffWithSustain(midiNote)) {
          // Note is actually being released (not sustained)
          
          // Update visualizer
          if (this.visualizer) {
            this.visualizer.noteOff(midiNote);
          }
          
          this.synth.noteOff();
        }
        // If sustain pedal is holding the note, do nothing - keep visualizer growing
      }
      // Otherwise, ignore the note-off (it's for a note that was retriggered)
    }
  }

  handleSustainPedal(pedalDown) {
    if (this.synth) {
      if (pedalDown) {
        this.synth.handleSustainPedalDown();
        this.elements.sustainPedal.textContent = '🎹 DOWN';
        this.elements.sustainPedal.style.color = '#4caf50';
      } else {
        // Get the notes that were being sustained before releasing the pedal
        const sustainedNotes = Array.from(this.synth.sustainedNotes);
        
        this.synth.handleSustainPedalUp();
        
        // Tell visualizer that sustained notes are now released
        if (this.visualizer) {
          sustainedNotes.forEach(midiNote => {
            this.visualizer.noteOff(midiNote);
          });
        }
        
        this.elements.sustainPedal.textContent = 'UP';
        this.elements.sustainPedal.style.color = '';
      }
    }
  }

  handlePitchBend(amount) {
    // Monosynth doesn't use pitch bend in the same way
    // Could be added later if desired
  }

  updateUI(noteInfo) {
    // Update current note info
    this.elements.currentNote.textContent = noteInfo.noteName;
    this.elements.currentFreq.textContent = `${noteInfo.frequency.toFixed(2)} Hz`;
    
    // Update reference note info
    const state = this.synth.getState();
    if (state.lastPlayedNote !== null) {
      const lastNoteName = this.synth.justIntervals.getMidiNoteName(state.lastPlayedNote);
      this.elements.referenceNote.textContent = lastNoteName;
      this.elements.referenceFreq.textContent = `${state.lastPlayedFrequency.toFixed(2)} Hz`;
    } else {
      this.elements.referenceNote.textContent = '—';
      this.elements.referenceFreq.textContent = '—';
    }
    
    // Update interval info
    if (noteInfo.intervalInfo) {
      const info = noteInfo.intervalInfo;
      this.elements.intervalName.textContent = info.name;
      this.elements.intervalDetails.textContent = 
        `Ratio ${info.ratio} from ${info.referenceNote} (${info.referenceFreq.toFixed(2)} Hz)`;
    } else {
      this.elements.intervalName.textContent = 'First Note (Reference)';
      this.elements.intervalDetails.textContent = 
        `${noteInfo.noteName} at ${noteInfo.frequency.toFixed(2)} Hz — Equal Temperament`;
    }
  }

  resetReference() {
    if (this.synth) {
      this.synth.resetReference();
      this.elements.referenceNote.textContent = '—';
      this.elements.referenceFreq.textContent = '—';
      this.elements.intervalName.textContent = 'Reference Reset';
      this.elements.intervalDetails.textContent = 'Next note will be the new reference';
      this.showSuccess('Reference note reset. Next note will use equal temperament.');
    }
    if (this.visualizer) {
      this.visualizer.clear();
    }
  }

  updateMIDIDeviceList() {
    const devices = this.midiHandler.getConnectedDevices();
    
    if (devices.length === 0) {
      this.elements.midiDeviceList.innerHTML = 
        '<div style="padding: 8px 0; color: #999;">No devices connected</div>';
    } else {
      this.elements.midiDeviceList.innerHTML = devices
        .map(device => `
          <div class="midi-device">
            🎹 ${device.name}${device.manufacturer ? ` (${device.manufacturer})` : ''}
          </div>
        `)
        .join('');
    }
  }

  showError(message) {
    this.elements.errorMessage.textContent = message;
    this.elements.errorMessage.style.display = 'block';
    setTimeout(() => {
      this.elements.errorMessage.style.display = 'none';
    }, 5000);
  }

  showSuccess(message) {
    // Use interval info area for success messages
    this.elements.intervalName.textContent = 'Ready!';
    this.elements.intervalDetails.textContent = message;
  }

  /**
   * Toggle fullscreen mode for visualizer
   */
  toggleFullscreen() {
    const elem = this.elements.visualizerSection;
    
    if (!document.fullscreenElement && 
        !document.webkitFullscreenElement && 
        !document.mozFullScreenElement &&
        !document.msFullscreenElement) {
      // Enter fullscreen
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) { // Safari
        elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) { // Firefox
        elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) { // IE/Edge
        elem.msRequestFullscreen();
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }

  /**
   * Update fullscreen button icon based on state
   */
  updateFullscreenButton() {
    const isFullscreen = document.fullscreenElement || 
                        document.webkitFullscreenElement || 
                        document.mozFullScreenElement ||
                        document.msFullscreenElement;
    
    // Update icon (⛶ for both states, could use different icons if desired)
    this.elements.fullscreenIcon.textContent = isFullscreen ? '⛶' : '⛶';
    
    // Update tooltip
    this.elements.fullscreenBtn.title = isFullscreen ? 'Exit Fullscreen (ESC)' : 'Toggle Fullscreen';
    
    // Trigger canvas resize if visualizer exists
    if (this.visualizer) {
      // Give the browser a moment to update the layout
      setTimeout(() => {
        if (this.visualizer.canvas) {
          this.visualizer.canvas.width = this.visualizer.canvas.offsetWidth * window.devicePixelRatio;
          this.visualizer.canvas.height = this.visualizer.canvas.offsetHeight * window.devicePixelRatio;
          this.visualizer.draw();
        }
      }, 100);
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  
  // Attempt to auto-initialize
  // This may be blocked by browser autoplay policies, but will work in many cases
  app.initialize().catch(() => {
    console.log('Auto-start blocked by browser. Waiting for user interaction.');
    // Reset button state for manual initialization
    app.elements.startBtn.textContent = 'Click to Start Synth';
    app.elements.startBtn.disabled = false;
    app.elements.intervalName.textContent = 'Click "Start Synth" to begin';
    app.elements.intervalDetails.textContent = 'Browser requires user interaction to start audio';
  });
});
