import { JustIntervals } from './just-intervals.js';

/**
 * NoteVisualizer - Time-series plot of note tuning
 * 
 * Conceptual Model:
 * - This is a literal 2D plot with time on the Y-axis
 * - We show a fixed time window (e.g., last 8 seconds)
 * - Notes have complete temporal histories stored as data points
 * - The view scrolls to show the most recent section of the plot
 * 
 * Axes:
 * - X-axis: MIDI note number (keyboard position)
 * - Y-axis: Time (present at bottom, past scrolling upward)
 * - Horizontal deviation: Cents from equal temperament
 */

export class NoteVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.justIntervals = new JustIntervals();
    
    // Time window configuration (in seconds)
    this.timeWindow = 8; // Show last 8 seconds
    this.bufferTime = 2; // Keep 2 extra seconds of data beyond visible window
    
    // All note data (stored as absolute timestamps)
    // Using unique IDs to allow multiple instances of the same MIDI note
    this.noteData = new Map(); // noteId -> { midiNote, dataPoints, isActive, equalTempFreq }
    this.activeNotesByMidi = new Map(); // midiNote -> Set of active noteIds
    this.nextNoteId = 0;
    
    // Reference frequency for tuning (not tied to a specific key)
    this.referenceFrequency = null; // { frequency, midiNote, timestamp }
    
    // Visual parameters
    this.keyboardHeight = 60; // Height of keyboard at bottom
    this.plotHeight = 0; // Calculated in setupCanvas
    this.maxDeviation = 25; // max horizontal deviation in cents (per side)
    
    // MIDI note range to display
    this.minMidiNote = 36; // C2
    this.maxMidiNote = 96; // C7
    this.noteRange = this.maxMidiNote - this.minMidiNote;
    
    this.animationId = null;
    
    this.setupCanvas();
  }

  setupCanvas() {
    // Set canvas size
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = 400;
    this.plotHeight = this.canvas.height - this.keyboardHeight;
    
    // Handle resize
    window.addEventListener('resize', () => {
      this.canvas.width = container.clientWidth;
      this.canvas.height = 400;
      this.plotHeight = this.canvas.height - this.keyboardHeight;
    });
  }

  /**
   * Calculate cents deviation from equal temperament
   */
  calculateCentsDeviation(actualFreq, equalTempFreq) {
    return 1200 * Math.log2(actualFreq / equalTempFreq);
  }

  /**
   * Map absolute timestamp to Y coordinate
   * Present (now) is at the bottom of the plot area
   * Past scrolls upward
   */
  timestampToY(timestamp, currentTime) {
    const age = (currentTime - timestamp) / 1000; // Age in seconds
    const y = this.plotHeight - (age / this.timeWindow) * this.plotHeight;
    return y;
  }

  /**
   * Get the key bounds for a MIDI note
   */
  getKeyBounds(midiNote) {
    const keyWidth = this.canvas.width / this.noteRange;
    const keyIndex = midiNote - this.minMidiNote;
    const x = keyIndex * keyWidth;
    const y = this.canvas.height - this.keyboardHeight;
    
    return {
      x,
      y,
      width: keyWidth,
      height: this.keyboardHeight,
      centerX: x + keyWidth / 2, // Center of key (equal temperament reference)
      pathWidth: keyWidth / 2 // Path is half the key width
    };
  }

  /**
   * Get X offset from cents deviation (relative to key center)
   */
  getXOffsetFromCents(cents, keyBounds) {
    // Map cents to pixels within half the key width
    const maxPixelOffset = keyBounds.pathWidth / 2;
    const pixelsPerCent = maxPixelOffset / this.maxDeviation;
    return cents * pixelsPerCent;
  }

  /**
   * Get color based on cents deviation
   * Green (flat) → Blue (in tune) → Red (sharp)
   */
  getColorFromCents(cents) {
    // Normalize cents to 0-1 range
    const normalized = (cents + this.maxDeviation) / (2 * this.maxDeviation);
    const clamped = Math.max(0, Math.min(1, normalized));
    
    // Create gradient: Green → Blue → Red
    let r, g, b;
    
    if (clamped < 0.5) {
      // Green to Blue (flat to in-tune)
      const t = clamped * 2; // 0 to 1
      r = Math.round(0 * (1 - t) + 70 * t);
      g = Math.round(200 * (1 - t) + 130 * t);
      b = Math.round(100 * (1 - t) + 255 * t);
    } else {
      // Blue to Red (in-tune to sharp)
      const t = (clamped - 0.5) * 2; // 0 to 1
      r = Math.round(70 * (1 - t) + 255 * t);
      g = Math.round(130 * (1 - t) + 80 * t);
      b = Math.round(255 * (1 - t) + 80 * t);
    }
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Get note label
   */
  getNoteLabel(midiNote) {
    return this.justIntervals.getMidiNoteName(midiNote);
  }

  /**
   * Start a new note
   * Returns the unique noteId for this note instance
   */
  noteOn(midiNote, frequency, isReferenceNote = false) {
    const equalTempFreq = this.justIntervals.midiToFrequency(midiNote);
    const cents = this.calculateCentsDeviation(frequency, equalTempFreq);
    const timestamp = performance.now();
    
    // Create unique ID for this note instance
    const noteId = this.nextNoteId++;
    
    // Initialize note data
    this.noteData.set(noteId, {
      midiNote,
      equalTempFreq,
      dataPoints: [{ timestamp, cents, frequency }],
      isActive: true
    });
    
    // Track active notes by MIDI note number
    if (!this.activeNotesByMidi.has(midiNote)) {
      this.activeNotesByMidi.set(midiNote, new Set());
    }
    this.activeNotesByMidi.get(midiNote).add(noteId);
    
    // Update reference frequency if this is the bass/reference
    if (isReferenceNote) {
      this.referenceFrequency = { frequency, midiNote, timestamp };
    }
    
    // Start animation if not running
    if (!this.animationId) {
      this.animate();
    }
    
    return noteId;
  }

  /**
   * Update a note's tuning (for retuning during bass changes)
   * This updates ALL active instances of the given MIDI note
   */
  updateNoteTuning(midiNote, newFrequency, isSmooth = false, glideTime = 0.2) {
    const activeNoteIds = this.activeNotesByMidi.get(midiNote);
    if (!activeNoteIds) {
      console.log(`updateNoteTuning: No active notes for MIDI ${midiNote}`);
      return;
    }
    
    console.log(`updateNoteTuning: MIDI ${midiNote}, ${activeNoteIds.size} active instances, newFreq=${newFrequency.toFixed(2)}, smooth=${isSmooth}`);
    
    const timestamp = performance.now();
    
    for (const noteId of activeNoteIds) {
      const noteInfo = this.noteData.get(noteId);
      if (!noteInfo || !noteInfo.isActive) continue;
      
      const newCents = this.calculateCentsDeviation(newFrequency, noteInfo.equalTempFreq);
      
      if (isSmooth && noteInfo.dataPoints.length > 0) {
        // For smooth retuning, interpolate several points
        const lastPoint = noteInfo.dataPoints[noteInfo.dataPoints.length - 1];
        const oldFrequency = lastPoint.frequency;
        const oldCents = lastPoint.cents;
        
        console.log(`  Note ${noteId}: ${oldCents.toFixed(1)}¢ → ${newCents.toFixed(1)}¢`);
        
        if (Math.abs(newCents - oldCents) > 1) {
          const numSteps = Math.ceil(glideTime * 30); // ~30 samples per second
          for (let i = 1; i <= numSteps; i++) {
            const t = i / numSteps;
            const interpTimestamp = timestamp + (t * glideTime * 1000);
            // Exponential interpolation
            const ratio = Math.pow(newFrequency / oldFrequency, t);
            const interpFreq = oldFrequency * ratio;
            const interpCents = this.calculateCentsDeviation(interpFreq, noteInfo.equalTempFreq);
            noteInfo.dataPoints.push({ timestamp: interpTimestamp, cents: interpCents, frequency: interpFreq });
          }
        } else {
          noteInfo.dataPoints.push({ timestamp, cents: newCents, frequency: newFrequency });
        }
      } else {
        // Instant retune
        const lastPoint = noteInfo.dataPoints[noteInfo.dataPoints.length - 1];
        console.log(`  Note ${noteId}: ${lastPoint.cents.toFixed(1)}¢ → ${newCents.toFixed(1)}¢ (instant)`);
        noteInfo.dataPoints.push({ timestamp, cents: newCents, frequency: newFrequency });
      }
    }
    
    // Start animation if not running
    if (!this.animationId) {
      this.animate();
    }
  }

  /**
   * Stop a note (mark as inactive)
   * This stops ALL active instances of the given MIDI note
   */
  noteOff(midiNote) {
    const activeNoteIds = this.activeNotesByMidi.get(midiNote);
    if (!activeNoteIds) return;
    
    for (const noteId of activeNoteIds) {
      const noteInfo = this.noteData.get(noteId);
      if (noteInfo) {
        noteInfo.isActive = false;
      }
    }
    
    // Clear the active tracking for this MIDI note
    this.activeNotesByMidi.delete(midiNote);
  }

  /**
   * Clean up old data points outside the buffer window
   */
  cleanupOldData(currentTime) {
    const cutoffTime = currentTime - (this.timeWindow + this.bufferTime) * 1000;
    
    for (const [noteId, noteInfo] of this.noteData) {
      // Remove old data points
      noteInfo.dataPoints = noteInfo.dataPoints.filter(point => point.timestamp > cutoffTime);
      
      // If no data points remain and note is inactive, remove the note entirely
      if (noteInfo.dataPoints.length === 0 && !noteInfo.isActive) {
        this.noteData.delete(noteId);
      }
    }
    
    // Clean up old reference frequency
    if (this.referenceFrequency && this.referenceFrequency.timestamp < cutoffTime) {
      // Only clear if there's no active note with this midi note
      const hasActiveInstance = this.activeNotesByMidi.has(this.referenceFrequency.midiNote);
      if (!hasActiveInstance) {
        this.referenceFrequency = null;
      }
    }
  }

  /**
   * Update and render visualization
   */
  animate() {
    const now = performance.now();
    
    // Update active notes with current data points
    this.updateActiveNotes(now);
    
    // Clean up old data periodically (every ~1 second)
    if (!this.lastCleanup || now - this.lastCleanup > 1000) {
      this.cleanupOldData(now);
      this.lastCleanup = now;
    }
    
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw time grid
    this.drawTimeGrid(now);
    
    // Draw keyboard at bottom
    this.drawKeyboard();
    
    // Draw note paths
    for (const [noteId, noteInfo] of this.noteData) {
      this.drawNotePath(noteInfo, now);
    }
    
    // Draw time axis label
    this.drawTimeLabel();
    
    // Always continue animation to show scrolling effect
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Update active notes with current frequency/cents data
   * This continuously samples active notes to build their paths
   */
  updateActiveNotes(currentTime) {
    for (const [noteId, noteInfo] of this.noteData) {
      if (!noteInfo.isActive) continue;
      
      // Only add a point if enough time has passed since last point
      // This prevents oversampling (sample at ~60fps max)
      const lastPoint = noteInfo.dataPoints[noteInfo.dataPoints.length - 1];
      const timeSinceLastPoint = currentTime - lastPoint.timestamp;
      
      if (timeSinceLastPoint > 16) { // ~60fps
        // For active notes, the frequency/cents should be stable unless retuning
        // Just add the current state as a new data point
        noteInfo.dataPoints.push({
          timestamp: currentTime,
          cents: lastPoint.cents,
          frequency: lastPoint.frequency
        });
      }
    }
  }

  /**
   * Draw time grid lines
   */
  drawTimeGrid(currentTime) {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 1;
    this.ctx.font = '9px monospace';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.textAlign = 'left';
    
    // Draw horizontal lines for each second
    for (let i = 0; i <= this.timeWindow; i++) {
      const timestamp = currentTime - i * 1000;
      const y = this.timestampToY(timestamp, currentTime);
      
      if (y >= 0 && y <= this.plotHeight) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.canvas.width, y);
        this.ctx.stroke();
        
        // Label every 2 seconds
        if (i % 2 === 0) {
          this.ctx.fillText(`-${i}s`, 5, y - 3);
        }
      }
    }
  }

  /**
   * Draw time axis label
   */
  drawTimeLabel() {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.font = '11px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Time Window: ${this.timeWindow}s | Tuning Deviation: ±${this.maxDeviation}¢`, this.canvas.width / 2, 15);
  }

  /**
   * Draw the keyboard at the bottom
   */
  drawKeyboard() {
    for (let midiNote = this.minMidiNote; midiNote <= this.maxMidiNote; midiNote++) {
      const bounds = this.getKeyBounds(midiNote);
      const noteClass = midiNote % 12;
      const isBlackKey = [1, 3, 6, 8, 10].includes(noteClass);
      
      // Check if this MIDI note has any active instances
      const activeNoteIds = this.activeNotesByMidi.get(midiNote);
      const isActive = activeNoteIds && activeNoteIds.size > 0;
      
      // Key background
      if (isActive) {
        // Get most recent cents value from any active instance
        let mostRecentCents = 0;
        for (const noteId of activeNoteIds) {
          const noteInfo = this.noteData.get(noteId);
          if (noteInfo && noteInfo.dataPoints.length > 0) {
            const lastPoint = noteInfo.dataPoints[noteInfo.dataPoints.length - 1];
            mostRecentCents = lastPoint.cents;
            break; // Just use the first active one
          }
        }
        this.ctx.fillStyle = this.getColorFromCents(mostRecentCents);
      } else if (isBlackKey) {
        this.ctx.fillStyle = '#0f0f1e';
      } else {
        this.ctx.fillStyle = '#2a2a3e';
      }
      
      this.ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      
      // Key border
      this.ctx.strokeStyle = '#1a1a2e';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      
      // Center line (equal temperament reference)
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(bounds.centerX, bounds.y);
      this.ctx.lineTo(bounds.centerX, bounds.y + bounds.height);
      this.ctx.stroke();
      
      // Label C notes
      if (noteClass === 0) {
        this.ctx.fillStyle = isActive ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.getNoteLabel(midiNote), bounds.centerX, bounds.y + bounds.height / 2);
      }
      
      // Show cents deviation for active notes
      if (isActive) {
        let mostRecentCents = 0;
        for (const noteId of activeNoteIds) {
          const noteInfo = this.noteData.get(noteId);
          if (noteInfo && noteInfo.dataPoints.length > 0) {
            const lastPoint = noteInfo.dataPoints[noteInfo.dataPoints.length - 1];
            mostRecentCents = lastPoint.cents;
            break;
          }
        }
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.font = 'bold 9px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${mostRecentCents > 0 ? '+' : ''}${mostRecentCents.toFixed(0)}¢`, bounds.centerX, bounds.y + bounds.height - 12);
      }
    }
    
    // Draw reference frequency line AFTER all keys (so it's on top)
    if (this.referenceFrequency) {
      this.drawReferenceFrequencyLine();
    }
  }

  /**
   * Draw a vertical line showing the reference frequency
   */
  drawReferenceFrequencyLine() {
    if (!this.referenceFrequency) return;
    
    const refFreq = this.referenceFrequency.frequency;
    const refMidi = this.referenceFrequency.midiNote;
    
    // Get the key bounds for the reference note
    const bounds = this.getKeyBounds(refMidi);
    
    // Calculate the X position based on the actual frequency
    // The reference frequency might be detuned from equal temperament
    const equalTempFreq = this.justIntervals.midiToFrequency(refMidi);
    const cents = this.calculateCentsDeviation(refFreq, equalTempFreq);
    const xOffset = this.getXOffsetFromCents(cents, bounds);
    const x = bounds.centerX + xOffset;
    
    // Draw a vertical golden line from the key through the entire plot
    this.ctx.strokeStyle = '#FFD700'; // Gold
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]); // Dashed line
    this.ctx.globalAlpha = 0.8;
    
    this.ctx.beginPath();
    this.ctx.moveTo(x, 0);
    this.ctx.lineTo(x, this.canvas.height);
    this.ctx.stroke();
    
    this.ctx.setLineDash([]); // Reset to solid line
    this.ctx.globalAlpha = 1.0;
    
    // Add a label at the top
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = 'bold 10px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`REF: ${this.getNoteLabel(refMidi)} (${refFreq.toFixed(1)} Hz, ${cents > 0 ? '+' : ''}${cents.toFixed(1)}¢)`, x, 25);
  }

  /**
   * Draw a note's path in the plot
   */
  drawNotePath(noteInfo, currentTime) {
    if (noteInfo.dataPoints.length < 2) return;
    
    const bounds = this.getKeyBounds(noteInfo.midiNote);
    
    // Build visible points within time window
    const points = [];
    for (const dataPoint of noteInfo.dataPoints) {
      const y = this.timestampToY(dataPoint.timestamp, currentTime);
      
      // Only include points within visible area (with small buffer)
      if (y >= -10 && y <= this.plotHeight + 10) {
        const xOffset = this.getXOffsetFromCents(dataPoint.cents, bounds);
        const x = bounds.centerX + xOffset;
        points.push({ x, y, cents: dataPoint.cents });
      }
    }
    
    // Draw the path with color gradient based on detuning
    if (points.length >= 2) {
      this.ctx.lineWidth = bounds.pathWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.globalAlpha = 0.9;
      
      // Draw segments with varying color
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        
        // Use average cents for segment color
        const avgCents = (p1.cents + p2.cents) / 2;
        this.ctx.strokeStyle = this.getColorFromCents(avgCents);
        
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
      }
      
      this.ctx.globalAlpha = 1.0;
      
      // Draw glow at current position (only if active)
      if (noteInfo.isActive && points.length > 0) {
        const currentPoint = points[points.length - 1];
        const currentColor = this.getColorFromCents(currentPoint.cents);
        
        // Parse RGB from the color string to add alpha
        const gradient = this.ctx.createRadialGradient(
          currentPoint.x, currentPoint.y, 0,
          currentPoint.x, currentPoint.y, bounds.pathWidth
        );
        
        // Extract RGB values for gradient
        const match = currentColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
          const r = match[1], g = match[2], b = match[3];
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1.0)`);
          gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.5)`);
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);
        }
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(currentPoint.x, currentPoint.y, bounds.pathWidth, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  /**
   * Clear all notes
   */
  clear() {
    this.noteData.clear();
    this.referenceFrequency = null;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Draw empty state
    const now = performance.now();
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawTimeGrid(now);
    this.drawKeyboard();
    this.drawTimeLabel();
  }

  /**
   * Stop animation
   */
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
