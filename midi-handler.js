/**
 * MIDI Input Handler
 * Manages MIDI device connection and note events
 */

export class MIDIHandler {
  constructor(onNoteOn, onNoteOff) {
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
    this.midiAccess = null;
    this.connectedDevices = [];
  }

  /**
   * Initialize MIDI access
   * @returns {Promise<boolean>} True if MIDI is available
   */
  async init() {
    try {
      if (!navigator.requestMIDIAccess) {
        throw new Error('Web MIDI API not supported in this browser');
      }

      this.midiAccess = await navigator.requestMIDIAccess();
      
      // Listen for device connections/disconnections
      this.midiAccess.addEventListener('statechange', (e) => {
        this.handleStateChange(e);
      });

      // Connect to existing inputs
      this.connectToInputs();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize MIDI:', error);
      throw error;
    }
  }

  /**
   * Connect to all available MIDI inputs
   */
  connectToInputs() {
    this.connectedDevices = [];
    
    for (let input of this.midiAccess.inputs.values()) {
      console.log('Connecting to MIDI input:', input.name);
      input.onmidimessage = (message) => this.handleMIDIMessage(message);
      this.connectedDevices.push({
        id: input.id,
        name: input.name,
        manufacturer: input.manufacturer
      });
    }
  }

  /**
   * Handle MIDI device state changes
   */
  handleStateChange(event) {
    const port = event.port;
    console.log(`MIDI device ${port.name} ${port.state}`);
    
    if (port.type === 'input') {
      if (port.state === 'connected') {
        port.onmidimessage = (message) => this.handleMIDIMessage(message);
        this.connectedDevices.push({
          id: port.id,
          name: port.name,
          manufacturer: port.manufacturer
        });
      } else if (port.state === 'disconnected') {
        this.connectedDevices = this.connectedDevices.filter(d => d.id !== port.id);
      }
    }
  }

  /**
   * Handle incoming MIDI messages
   */
  handleMIDIMessage(message) {
    const [status, note, velocity] = message.data;
    
    // Get the command (upper 4 bits) and channel (lower 4 bits)
    const command = status >> 4;
    const channel = status & 0x0F;
    
    switch (command) {
      case 0x9: // Note On
        if (velocity > 0) {
          this.onNoteOn(note, velocity);
        } else {
          // Velocity 0 is treated as note off
          this.onNoteOff(note);
        }
        break;
        
      case 0x8: // Note Off
        this.onNoteOff(note);
        break;
    }
  }

  /**
   * Get list of connected devices
   */
  getConnectedDevices() {
    return this.connectedDevices;
  }
}
