import { PolySynth } from './polysynth.js';
import { MIDIHandler } from './midi-handler.js';
import { NoteVisualizer } from './visualizer.js';
import { SettingsManager } from './settings-manager.js';

/**
 * PolySynth Application
 */

class PolyApp {
  constructor() {
    this.synth = null;
    this.midiHandler = null;
    this.visualizer = null;
    this.isInitialized = false;
    this.settingsManager = new SettingsManager('polysynth-settings');
    
    // UI Elements
    this.elements = {
      startBtn: document.getElementById('startBtn'),
      resetBtn: document.getElementById('resetBtn'),
      errorMessage: document.getElementById('errorMessage'),
      voiceCount: document.getElementById('voiceCount'),
      bassNote: document.getElementById('bassNote'),
      bassFreq: document.getElementById('bassFreq'),
      activeVoices: document.getElementById('activeVoices'),
      sustainPedal: document.getElementById('sustainPedal'),
      intervalName: document.getElementById('intervalName'),
      intervalDetails: document.getElementById('intervalDetails'),
      waveform: document.getElementById('waveform'),
      referenceMode: document.getElementById('referenceMode'),
      retuneMode: document.getElementById('retuneMode'),
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
      stereoSpread: document.getElementById('stereoSpread'),
      stereoSpreadValue: document.getElementById('stereoSpreadValue'),
      spreadMode: document.getElementById('spreadMode'),
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
    const settings = this.settingsManager.loadSettings() || SettingsManager.getPolyDefaults();
    
    // Apply to UI
    this.elements.waveform.value = settings.waveform;
    this.elements.referenceMode.value = settings.referenceMode || 'bass';
    this.elements.retuneMode.value = settings.retuneMode;
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
    this.elements.stereoSpread.value = settings.stereoSpread || 0;
    this.elements.stereoSpreadValue.textContent = `${settings.stereoSpread || 0}%`;
    this.elements.spreadMode.value = settings.spreadMode || 'linear';
  }

  /**
   * Save current settings to localStorage
   */
  saveSettings() {
    const settings = {
      waveform: this.elements.waveform.value,
      referenceMode: this.elements.referenceMode.value,
      retuneMode: this.elements.retuneMode.value,
      attack: parseInt(this.elements.attack.value),
      decay: parseInt(this.elements.decay.value),
      sustain: parseInt(this.elements.sustain.value),
      release: parseInt(this.elements.release.value),
      filterFreq: parseInt(this.elements.filterFreq.value),
      filterQ: parseFloat(this.elements.filterQ.value),
      filterEnv: parseInt(this.elements.filterEnv.value),
      volume: parseInt(this.elements.volume.value),
      stereoSpread: parseInt(this.elements.stereoSpread.value),
      spreadMode: this.elements.spreadMode.value
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
    
    // Reference mode control
    this.elements.referenceMode.addEventListener('change', (e) => {
      if (this.synth) {
        this.synth.setReferenceMode(e.target.value);
      }
      this.saveSettings();
    });
    
    // Retune mode control
    this.elements.retuneMode.addEventListener('change', (e) => {
      if (this.synth) {
        this.synth.setRetuneMode(e.target.value);
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
    
    // Stereo spread control
    this.elements.stereoSpread.addEventListener('input', (e) => {
      const spread = parseInt(e.target.value);
      this.elements.stereoSpreadValue.textContent = `${spread}%`;
      if (this.synth) {
        this.synth.setStereoSpread(spread / 100);
      }
      this.saveSettings();
    });
    
    // Spread mode control
    this.elements.spreadMode.addEventListener('change', (e) => {
      if (this.synth) {
        this.synth.setSpreadMode(e.target.value);
      }
      this.saveSettings();
    });
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      this.elements.startBtn.disabled = true;
      this.elements.startBtn.textContent = 'Initializing...';
      
      // Initialize synth (8 voices)
      this.synth = new PolySynth(8);
      await this.synth.init();
      
      // Apply saved settings to synth
      const settings = this.settingsManager.loadSettings() || SettingsManager.getPolyDefaults();
      this.synth.setWaveform(settings.waveform);
      this.synth.setReferenceMode(settings.referenceMode || 'bass');
      this.synth.setRetuneMode(settings.retuneMode);
      this.synth.setAttackTime(settings.attack / 1000);
      this.synth.setDecayTime(settings.decay / 1000);
      this.synth.setSustainLevel(settings.sustain / 100);
      this.synth.setReleaseTime(settings.release / 1000);
      this.synth.setFilterFrequency(settings.filterFreq);
      this.synth.setFilterQ(settings.filterQ);
      this.synth.setFilterEnvelopeAmount(settings.filterEnv);
      this.synth.setVolume(settings.volume / 100);
      this.synth.setStereoSpread((settings.stereoSpread || 0) / 100);
      this.synth.setSpreadMode(settings.spreadMode || 'linear');
      
      // Initialize visualizer
      this.visualizer = new NoteVisualizer('noteCanvas');
      
      // Initialize MIDI
      this.midiHandler = new MIDIHandler(
        (note, velocity) => this.handleNoteOn(note, velocity),
        (note) => this.handleNoteOff(note),
        (pedalDown) => this.handleSustainPedal(pedalDown),
        (amount) => this.handlePitchBend(amount),
        (amount) => this.handleModWheel(amount)
      );
      
      await this.midiHandler.init();
      
      // Update UI
      this.updateMIDIDeviceList();
      this.elements.startBtn.textContent = '✓ PolySynth Ready';
      this.elements.startBtn.style.background = '#4caf50';
      this.elements.resetBtn.disabled = false;
      this.isInitialized = true;
      
      this.showSuccess('PolySynth ready! Play chords on your MIDI controller.');
      
    } catch (error) {
      this.showError(`Failed to initialize: ${error.message}`);
      this.elements.startBtn.disabled = false;
      this.elements.startBtn.textContent = 'Start PolySynth';
      console.error('Initialization error:', error);
      throw error;
    }
  }

  async ensureInitialized() {
    if (!this.isInitialized) {
      try {
        await this.initialize();
      } catch (error) {
        console.log('Auto-initialization blocked, waiting for user interaction');
      }
    }
  }

  async handleNoteOn(midiNote, velocity) {
    await this.ensureInitialized();
    if (this.synth) {
      // Mark this key as being held down
      this.synth.keysHeldDown.add(midiNote);
      
      const noteInfo = this.synth.noteOn(midiNote, velocity);
      this.updateUI(noteInfo);
      
      // Update visualizer
      if (this.visualizer) {
        // If a voice was stolen, mark that note as inactive in the visualizer
        if (noteInfo.stolenNote !== null && noteInfo.stolenNote !== undefined) {
          this.visualizer.noteOff(noteInfo.stolenNote);
        }
        
        // Check if this note is the reference note
        const state = this.synth.getState();
        const isReferenceNote = state.referenceNote === midiNote;
        this.visualizer.noteOn(midiNote, noteInfo.frequency, isReferenceNote);
        
        // Update reference frequency to match current reference
        if (state.referenceNote !== null) {
          const refVoice = this.synth.voices.find(v => v.isActive && v.midiNote === state.referenceNote);
          if (refVoice) {
            this.visualizer.referenceFrequency = { 
              frequency: refVoice.frequency,
              midiNote: state.referenceNote,
              timestamp: performance.now()
            };
          }
        }
      }
    }
  }

  async handleNoteOff(midiNote) {
    await this.ensureInitialized();
    if (this.synth) {
      // Mark this key as no longer being held down
      this.synth.keysHeldDown.delete(midiNote);
      
      // Find the voice(s) playing this note that we're about to release
      const voicesToCheck = this.synth.voices.filter(v => v.isActive && v.midiNote === midiNote);
      
      // Check if sustain pedal should hold the note
      // Pass the voice instance so the synth can track which specific voices are sustained
      const shouldRelease = voicesToCheck.length > 0 && 
        this.synth.handleNoteOffWithSustain(midiNote, voicesToCheck[voicesToCheck.length - 1]);
      
      if (shouldRelease) {
        // Note is actually being released (not sustained)
        
        // Update visualizer
        if (this.visualizer) {
          this.visualizer.noteOff(midiNote);
        }
        
        const retunedNotes = this.synth.noteOff(midiNote);
        
        // If notes were retuned (reference changed), update visualizer
        if (retunedNotes && Array.isArray(retunedNotes) && this.visualizer) {
          // Update reference note FIRST so ratio calculations are correct
          const state = this.synth.getState();
          if (state.referenceNote !== null) {
            const refVoice = this.synth.voices.find(v => v.isActive && v.midiNote === state.referenceNote);
            if (refVoice) {
              this.visualizer.referenceFrequency = { 
                frequency: refVoice.frequency,
                midiNote: state.referenceNote,
                timestamp: performance.now()
              };
              
              // Update all active notes' ratio displays for the new reference
              this.visualizer.updateAllRatiosForNewReference();
            }
          }
          
          // Then update the retuned notes with the new reference
          const isSmooth = this.synth.retuneMode === 'smooth';
          const glideTime = this.synth.retuneSpeed || 0.2;
          
          retunedNotes.forEach(({ midiNote: retunedNote, newFrequency }) => {
            this.visualizer.updateNoteTuning(retunedNote, newFrequency, isSmooth, glideTime);
          });
        }
        
        this.updateUIAfterNoteOff();
      }
      // If sustain pedal is holding the note, do nothing - keep visualizer growing
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
        const keysHeldDown = Array.from(this.synth.keysHeldDown);
        
        const retunedNotes = this.synth.handleSustainPedalUp();
        
        // Tell visualizer that sustained notes are now released
        // BUT only for notes whose keys are no longer held down
        if (this.visualizer) {
          sustainedNotes.forEach(midiNote => {
            // Only stop visualizing if the key is not currently held down
            if (!keysHeldDown.includes(midiNote)) {
              this.visualizer.noteOff(midiNote);
            }
          });
        }
        
        // If notes were retuned (reference changed), update visualizer
        if (retunedNotes && Array.isArray(retunedNotes) && this.visualizer) {
          // Update reference note FIRST so ratio calculations are correct
          const state = this.synth.getState();
          if (state.referenceNote !== null) {
            const refVoice = this.synth.voices.find(v => v.isActive && v.midiNote === state.referenceNote);
            if (refVoice) {
              this.visualizer.referenceFrequency = { 
                frequency: refVoice.frequency,
                midiNote: state.referenceNote,
                timestamp: performance.now()
              };
              
              // Update all active notes' ratio displays for the new reference
              this.visualizer.updateAllRatiosForNewReference();
            }
          }
          
          // Then update the retuned notes with the new reference
          const isSmooth = this.synth.retuneMode === 'smooth';
          const glideTime = this.synth.retuneSpeed || 0.2;
          
          retunedNotes.forEach(({ midiNote: retunedNote, newFrequency }) => {
            this.visualizer.updateNoteTuning(retunedNote, newFrequency, isSmooth, glideTime);
          });
        }
        
        this.updateUIAfterNoteOff();
        this.elements.sustainPedal.textContent = 'UP';
        this.elements.sustainPedal.style.color = '';
      }
    }
  }

  handlePitchBend(amount) {
    if (this.synth) {
      this.synth.applyPitchBend(amount);
      
      // Update visualizer reference frequency with bent reference
      if (this.visualizer) {
        const bentFreq = this.synth.getReferenceFrequencyWithBend();
        if (bentFreq) {
          const state = this.synth.getState();
          this.visualizer.referenceFrequency = {
            frequency: bentFreq,
            midiNote: state.referenceNote,
            timestamp: performance.now()
          };
          // Recalculate comma drift with the new bent frequency
          this.visualizer.updateAllRatiosForNewReference();
        }
      }
    }
  }

  handleModWheel(amount) {
    if (this.synth) {
      this.synth.setVibratoAmount(amount);
    }
  }

  updateUI(noteInfo) {
    // Update voice count
    this.elements.voiceCount.textContent = noteInfo.activeVoices;
    
    // Update reference note info
    const state = this.synth.getState();
    if (state.referenceNote !== null) {
      const refNoteName = this.synth.justIntervals.getMidiNoteName(state.referenceNote);
      const modeLabels = {
        bass: ' (bass)',
        random: ' (random)',
        harmonic: ' (harmonic)'
      };
      const modeLabel = modeLabels[state.referenceMode] || '';
      this.elements.bassNote.textContent = refNoteName + modeLabel;
      this.elements.bassFreq.textContent = `${state.referenceFrequency.toFixed(2)} Hz`;
    } else {
      this.elements.bassNote.textContent = '—';
      this.elements.bassFreq.textContent = '—';
    }
    
    // Display active voices
    if (state.activeNotes.length > 0) {
      this.elements.activeVoices.textContent = state.activeNotes
        .map(n => n.noteName)
        .join(', ');
    } else {
      this.elements.activeVoices.textContent = '—';
    }
    
    // Update interval info
    if (noteInfo.intervalInfo) {
      const info = noteInfo.intervalInfo;
      this.elements.intervalName.textContent = `${noteInfo.noteName}: ${info.name}`;
      this.elements.intervalDetails.textContent = 
        `Ratio ${info.ratio} from reference note ${info.referenceNote} (${info.referenceFreq.toFixed(2)} Hz)`;
    } else {
      this.elements.intervalName.textContent = `${noteInfo.noteName} (Reference/First Note)`;
      if (noteInfo.usedStoredReference) {
        this.elements.intervalDetails.textContent = 
          `${noteInfo.frequency.toFixed(2)} Hz — From stored reference (detuned)`;
      } else {
        this.elements.intervalDetails.textContent = 
          `${noteInfo.frequency.toFixed(2)} Hz — Equal Temperament (becomes reference)`;
      }
    }
  }

  updateUIAfterNoteOff() {
    const state = this.synth.getState();
    
    // Update voice count
    this.elements.voiceCount.textContent = state.activeVoiceCount;
    
    // Update reference note info
    if (state.referenceNote !== null) {
      const refNoteName = this.synth.justIntervals.getMidiNoteName(state.referenceNote);
      const modeLabels = {
        bass: ' (bass)',
        random: ' (random)',
        harmonic: ' (harmonic)'
      };
      const modeLabel = modeLabels[state.referenceMode] || '';
      this.elements.bassNote.textContent = refNoteName + modeLabel;
      this.elements.bassFreq.textContent = `${state.referenceFrequency.toFixed(2)} Hz`;
    } else {
      this.elements.bassNote.textContent = '—';
      this.elements.bassFreq.textContent = '—';
    }
    
    // Display active voices
    if (state.activeNotes.length > 0) {
      this.elements.activeVoices.textContent = state.activeNotes
        .map(n => n.noteName)
        .join(', ');
    } else {
      this.elements.activeVoices.textContent = '—';
    }
  }

  resetReference() {
    if (this.synth) {
      this.synth.resetReference();
      this.elements.bassNote.textContent = '—';
      this.elements.bassFreq.textContent = '—';
      this.elements.activeVoices.textContent = '—';
      this.elements.voiceCount.textContent = '0';
      this.elements.intervalName.textContent = 'All Voices Stopped';
      this.elements.intervalDetails.textContent = 'Next note will establish new bass reference';
      this.showSuccess('All voices stopped. Next note will be the new bass reference.');
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
        this.visualizer.updateCanvasSize();
      }, 100);
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new PolyApp();
  
  // Attempt to auto-initialize
  app.initialize().catch(() => {
    console.log('Auto-start blocked by browser. Waiting for user interaction.');
    app.elements.startBtn.textContent = 'Click to Start PolySynth';
    app.elements.startBtn.disabled = false;
    app.elements.intervalName.textContent = 'Click "Start PolySynth" to begin';
    app.elements.intervalDetails.textContent = 'Browser requires user interaction to start audio';
  });
});
