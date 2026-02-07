/**
 * MIDI Input Handler
 * Manages MIDI device connection and note events
 */

export class MIDIHandler {
  constructor(onNoteOn, onNoteOff, onSustainPedal, onPitchBend, onModWheel) {
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
    this.onSustainPedal = onSustainPedal || (() => {}); // Optional callback
    this.onPitchBend = onPitchBend || (() => {}); // Optional callback
    this.onModWheel = onModWheel || (() => {}); // Optional callback
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
    const [status, data1, data2] = message.data;
    
    // Get the command (upper 4 bits) and channel (lower 4 bits)
    const command = status >> 4;
    const channel = status & 0x0F;
    
    switch (command) {
      case 0x9: // Note On
        if (data2 > 0) {
          this.onNoteOn(data1, data2);
        } else {
          // Velocity 0 is treated as note off
          this.onNoteOff(data1);
        }
        break;
        
      case 0x8: // Note Off
        this.onNoteOff(data1);
        break;
        
      case 0xB: // Control Change
        this.handleControlChange(data1, data2);
        break;
        
      case 0xE: // Pitch Bend
        this.handlePitchBend(data1, data2);
        break;
    }
  }

  /**
   * Handle MIDI Control Change messages
   */
  handleControlChange(controller, value) {
    switch (controller) {
      case 1: // Modulation Wheel (CC1)
        // Normalize to 0.0 - 1.0 range
        const modAmount = value / 127;
        this.onModWheel(modAmount);
        break;
        
      case 64: // Sustain Pedal (CC64)
        const pedalDown = value >= 64;
        this.onSustainPedal(pedalDown);
        break;
        
      // Could add more controllers here:
      // case 7: // Volume
      // case 10: // Pan
      // etc.
    }
  }

  /**
   * Handle MIDI Pitch Bend messages
   * Pitch bend is sent as two 7-bit values (LSB, MSB)
   * Range: 0-16383, center is 8192
   */
  handlePitchBend(lsb, msb) {
    // Combine the two 7-bit values into a 14-bit value
    const bendValue = (msb << 7) | lsb;
    
    // Normalize to -1.0 to +1.0 range (center at 8192)
    const normalizedBend = (bendValue - 8192) / 8192;
    
    this.onPitchBend(normalizedBend);
  }

  /**
   * Get list of connected devices
   */
  getConnectedDevices() {
    return this.connectedDevices;
  }
}
