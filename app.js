import { Synth } from './synth.js';
import { MIDIHandler } from './midi-handler.js';

/**
 * Main Application
 */

class App {
  constructor() {
    this.synth = null;
    this.midiHandler = null;
    this.isInitialized = false;
    
    // UI Elements
    this.elements = {
      startBtn: document.getElementById('startBtn'),
      resetBtn: document.getElementById('resetBtn'),
      errorMessage: document.getElementById('errorMessage'),
      currentNote: document.getElementById('currentNote'),
      currentFreq: document.getElementById('currentFreq'),
      referenceNote: document.getElementById('referenceNote'),
      referenceFreq: document.getElementById('referenceFreq'),
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
      midiDeviceList: document.getElementById('midiDeviceList')
    };
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.elements.startBtn.addEventListener('click', () => this.initialize());
    this.elements.resetBtn.addEventListener('click', () => this.resetReference());
    
    // Waveform control
    this.elements.waveform.addEventListener('change', (e) => {
      if (this.synth) {
        this.synth.setWaveform(e.target.value);
      }
    });
    
    // ADSR controls
    this.elements.attack.addEventListener('input', (e) => {
      const ms = parseInt(e.target.value);
      this.elements.attackValue.textContent = `${ms} ms`;
      if (this.synth) {
        this.synth.setAttackTime(ms / 1000);
      }
    });
    
    this.elements.decay.addEventListener('input', (e) => {
      const ms = parseInt(e.target.value);
      this.elements.decayValue.textContent = `${ms} ms`;
      if (this.synth) {
        this.synth.setDecayTime(ms / 1000);
      }
    });
    
    this.elements.sustain.addEventListener('input', (e) => {
      const percent = parseInt(e.target.value);
      this.elements.sustainValue.textContent = `${percent}%`;
      if (this.synth) {
        this.synth.setSustainLevel(percent / 100);
      }
    });
    
    this.elements.release.addEventListener('input', (e) => {
      const ms = parseInt(e.target.value);
      this.elements.releaseValue.textContent = `${ms} ms`;
      if (this.synth) {
        this.synth.setReleaseTime(ms / 1000);
      }
    });
    
    // Filter frequency control
    this.elements.filterFreq.addEventListener('input', (e) => {
      const freq = parseInt(e.target.value);
      this.elements.filterFreqValue.textContent = `${freq} Hz`;
      if (this.synth) {
        this.synth.setFilterFrequency(freq);
      }
    });
    
    // Filter Q control
    this.elements.filterQ.addEventListener('input', (e) => {
      const q = parseFloat(e.target.value);
      this.elements.filterQValue.textContent = q.toFixed(1);
      if (this.synth) {
        this.synth.setFilterQ(q);
      }
    });
    
    // Filter envelope control
    this.elements.filterEnv.addEventListener('input', (e) => {
      const amount = parseInt(e.target.value);
      this.elements.filterEnvValue.textContent = `${amount} Hz`;
      if (this.synth) {
        this.synth.setFilterEnvelopeAmount(amount);
      }
    });
    
    // Volume control
    this.elements.volume.addEventListener('input', (e) => {
      const volume = parseInt(e.target.value);
      this.elements.volumeValue.textContent = `${volume}%`;
      if (this.synth) {
        this.synth.setVolume(volume / 100);
      }
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
      
      // Initialize MIDI
      this.midiHandler = new MIDIHandler(
        (note, velocity) => this.handleNoteOn(note, velocity),
        (note) => this.handleNoteOff(note)
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
    }
  }

  async handleNoteOff(midiNote) {
    await this.ensureInitialized();
    if (this.synth) {
      // Only trigger noteOff if this is the currently playing note
      const state = this.synth.getState();
      if (state.currentNote === midiNote) {
        this.synth.noteOff();
      }
      // Otherwise, ignore the note-off (it's for a note that was retriggered)
    }
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
