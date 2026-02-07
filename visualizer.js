import { JustIntervals } from './just-intervals.js';

/**
 * NoteVisualizer - Time-series plot of just intonation ratios
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
 * - Horizontal position: Just intonation ratio relative to reference note
 *   (e.g., 5:4 for major third, 3:2 for perfect fifth)
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
    this.noteData = new Map(); // noteId -> { midiNote, dataPoints, isActive, referenceFreq, ratio }
    this.activeNotesByMidi = new Map(); // midiNote -> Set of active noteIds
    this.nextNoteId = 0;
    
    // Reference frequency for tuning (not tied to a specific key)
    this.referenceFrequency = null; // { frequency, midiNote, timestamp }
    
    // Track reference drift over time
    this.initialReferenceFrequency = null; // Store the very first reference
    this.referenceDriftCents = 0; // Total accumulated drift from initial reference
    
    // Visual parameters
    this.keyboardHeight = 60; // Height of keyboard at bottom
    this.tunerHeight = 50; // Height of tuner display below keyboard
    this.plotHeight = 0; // Calculated in setupCanvas
    this.maxRatioCents = 25; // max horizontal deviation in cents from perfect ratio (per side)
    
    // MIDI note range to display
    this.minMidiNote = 36; // C2
    this.maxMidiNote = 96; // C7
    this.noteRange = this.maxMidiNote - this.minMidiNote;
    
    this.animationId = null;
    
    this.setupCanvas();
  }

  setupCanvas() {
    // Set canvas size based on container
    this.updateCanvasSize();
    
    // Handle resize and fullscreen changes
    window.addEventListener('resize', () => this.updateCanvasSize());
    
    // Listen for fullscreen changes to update canvas size
    document.addEventListener('fullscreenchange', () => this.updateCanvasSize());
    document.addEventListener('webkitfullscreenchange', () => this.updateCanvasSize());
    document.addEventListener('mozfullscreenchange', () => this.updateCanvasSize());
  }

  updateCanvasSize() {
    const container = this.canvas.parentElement;
    const isFullscreen = !!(document.fullscreenElement || 
                            document.webkitFullscreenElement || 
                            document.mozFullScreenElement);
    
    // In fullscreen, use the actual container dimensions
    // Otherwise, use a fixed width with reasonable height
    if (isFullscreen) {
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
    } else {
      this.canvas.width = container.clientWidth;
      this.canvas.height = Math.min(600, Math.max(400, container.clientHeight));
    }
    
    this.plotHeight = this.canvas.height - this.keyboardHeight - this.tunerHeight;
  }

  /**
   * Calculate the interval and ratio from reference note
   * Returns { interval, ratio, ratioString, intervalName, centsFromPureRatio }
   */
  calculateRatioFromReference(noteFreq, noteMidi, refFreq, refMidi) {
    if (!refFreq || !refMidi) {
      // No reference, treat note as its own reference (1:1)
      return {
        interval: 0,
        ratio: 1.0,
        ratioString: '1:1',
        intervalName: 'Reference',
        centsFromPureRatio: 0
      };
    }
    
    const interval = noteMidi - refMidi;
    const ratioString = this.justIntervals.getRatioString(interval);
    const intervalName = this.justIntervals.getIntervalName(interval);
    
    // Calculate the ideal just frequency for this interval
    const idealFreq = this.justIntervals.getJustFrequency(refFreq, refMidi, noteMidi);
    
    // Calculate how far the actual frequency is from the ideal ratio
    // (This should be nearly 0 for our synth, but captures micro-variations)
    const centsFromPureRatio = 1200 * Math.log2(noteFreq / idealFreq);
    
    const ratio = noteFreq / refFreq;
    
    return {
      interval,
      ratio,
      ratioString,
      intervalName,
      centsFromPureRatio
    };
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
    const y = this.plotHeight; // Keys start after plot area
    
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
   * Get X offset from cents deviation from perfect ratio (relative to key center)
   */
  getXOffsetFromCents(cents, keyBounds) {
    // Map cents to pixels within half the key width
    const maxPixelOffset = keyBounds.pathWidth / 2;
    const pixelsPerCent = maxPixelOffset / this.maxRatioCents;
    return cents * pixelsPerCent;
  }

  /**
   * Get color based on cents deviation from perfect ratio
   * Green (flat) → Blue (perfect ratio) → Red (sharp)
   */
  getColorFromCents(cents) {
    // Normalize cents to 0-1 range
    const normalized = (cents + this.maxRatioCents) / (2 * this.maxRatioCents);
    const clamped = Math.max(0, Math.min(1, normalized));
    
    // Create gradient: Green → Blue → Red
    let r, g, b;
    
    if (clamped < 0.5) {
      // Green to Blue (flat to perfect)
      const t = clamped * 2; // 0 to 1
      r = Math.round(0 * (1 - t) + 70 * t);
      g = Math.round(200 * (1 - t) + 130 * t);
      b = Math.round(100 * (1 - t) + 255 * t);
    } else {
      // Blue to Red (perfect to sharp)
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
    const timestamp = performance.now();
    
    // Calculate ratio from reference
    const ratioInfo = this.calculateRatioFromReference(
      frequency,
      midiNote,
      this.referenceFrequency?.frequency,
      this.referenceFrequency?.midiNote
    );
    
    // Create unique ID for this note instance
    const noteId = this.nextNoteId++;
    
    // Initialize note data
    this.noteData.set(noteId, {
      midiNote,
      referenceFreq: this.referenceFrequency?.frequency || frequency,
      dataPoints: [{ 
        timestamp, 
        centsFromPureRatio: ratioInfo.centsFromPureRatio, 
        frequency,
        ratio: ratioInfo.ratio,
        ratioString: ratioInfo.ratioString,
        intervalName: ratioInfo.intervalName
      }],
      isActive: true
    });
    
    // Track active notes by MIDI note number
    if (!this.activeNotesByMidi.has(midiNote)) {
      this.activeNotesByMidi.set(midiNote, new Set());
    }
    this.activeNotesByMidi.get(midiNote).add(noteId);
    
    // Update reference frequency if this is the bass/reference
    if (isReferenceNote) {
      // Store initial reference if this is the first one
      if (!this.initialReferenceFrequency) {
        this.initialReferenceFrequency = { 
          frequency, 
          midiNote, 
          timestamp 
        };
        this.referenceDriftCents = 0;
        console.log(`Initial reference set: ${this.getNoteLabel(midiNote)} at ${frequency.toFixed(2)} Hz`);
      }
      
      this.referenceFrequency = { frequency, midiNote, timestamp };
      
      // Calculate drift from initial reference (only if same MIDI note)
      if (this.initialReferenceFrequency && midiNote === this.initialReferenceFrequency.midiNote) {
        this.referenceDriftCents = 1200 * Math.log2(frequency / this.initialReferenceFrequency.frequency);
        console.log(`Reference drift: ${this.referenceDriftCents > 0 ? '+' : ''}${this.referenceDriftCents.toFixed(1)}¢ from initial`);
      }
    }
    
    // Start animation if not running
    if (!this.animationId) {
      this.animate();
    }
    
    return noteId;
  }

  /**
   * Update a note's tuning (for retuning during reference changes)
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
      
      // Calculate new ratio from reference
      const newRatioInfo = this.calculateRatioFromReference(
        newFrequency,
        midiNote,
        this.referenceFrequency?.frequency,
        this.referenceFrequency?.midiNote
      );
      
      if (isSmooth && noteInfo.dataPoints.length > 0) {
        // For smooth retuning, interpolate several points
        const lastPoint = noteInfo.dataPoints[noteInfo.dataPoints.length - 1];
        const oldFrequency = lastPoint.frequency;
        const oldCents = lastPoint.centsFromPureRatio;
        
        console.log(`  Note ${noteId}: ${oldCents.toFixed(1)}¢ → ${newRatioInfo.centsFromPureRatio.toFixed(1)}¢ from perfect ratio`);
        
        if (Math.abs(newRatioInfo.centsFromPureRatio - oldCents) > 1) {
          const numSteps = Math.ceil(glideTime * 30); // ~30 samples per second
          for (let i = 1; i <= numSteps; i++) {
            const t = i / numSteps;
            const interpTimestamp = timestamp + (t * glideTime * 1000);
            // Exponential interpolation
            const ratio = Math.pow(newFrequency / oldFrequency, t);
            const interpFreq = oldFrequency * ratio;
            const interpRatioInfo = this.calculateRatioFromReference(
              interpFreq,
              midiNote,
              this.referenceFrequency?.frequency,
              this.referenceFrequency?.midiNote
            );
            noteInfo.dataPoints.push({ 
              timestamp: interpTimestamp, 
              centsFromPureRatio: interpRatioInfo.centsFromPureRatio, 
              frequency: interpFreq,
              ratio: interpRatioInfo.ratio,
              ratioString: interpRatioInfo.ratioString,
              intervalName: interpRatioInfo.intervalName
            });
          }
        } else {
          noteInfo.dataPoints.push({ 
            timestamp, 
            centsFromPureRatio: newRatioInfo.centsFromPureRatio, 
            frequency: newFrequency,
            ratio: newRatioInfo.ratio,
            ratioString: newRatioInfo.ratioString,
            intervalName: newRatioInfo.intervalName
          });
        }
      } else {
        // Instant retune
        noteInfo.dataPoints.push({ 
          timestamp, 
          centsFromPureRatio: newRatioInfo.centsFromPureRatio, 
          frequency: newFrequency,
          ratio: newRatioInfo.ratio,
          ratioString: newRatioInfo.ratioString,
          intervalName: newRatioInfo.intervalName
        });
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
   * Update all active notes' ratio displays when reference changes
   * This recalculates ratios for all active notes without changing their frequencies
   */
  updateAllRatiosForNewReference() {
    if (!this.referenceFrequency) return;
    
    // Calculate drift from initial reference
    if (this.initialReferenceFrequency) {
      if (this.referenceFrequency.midiNote === this.initialReferenceFrequency.midiNote) {
        // Same note - direct comparison
        this.referenceDriftCents = 1200 * Math.log2(
          this.referenceFrequency.frequency / this.initialReferenceFrequency.frequency
        );
      } else {
        // Different note - calculate based on expected frequency relationship
        const expectedFreq = this.justIntervals.getJustFrequency(
          this.initialReferenceFrequency.frequency,
          this.initialReferenceFrequency.midiNote,
          this.referenceFrequency.midiNote
        );
        this.referenceDriftCents = 1200 * Math.log2(
          this.referenceFrequency.frequency / expectedFreq
        );
      }
      console.log(`Reference drift updated: ${this.referenceDriftCents > 0 ? '+' : ''}${this.referenceDriftCents.toFixed(1)}¢ from initial`);
    }
    
    const timestamp = performance.now();
    console.log(`Updating all ratio displays for new reference: ${this.getNoteLabel(this.referenceFrequency.midiNote)}`);
    
    for (const [noteId, noteInfo] of this.noteData) {
      if (!noteInfo.isActive) continue;
      
      // Get the current frequency of this note
      const lastPoint = noteInfo.dataPoints[noteInfo.dataPoints.length - 1];
      if (!lastPoint) continue;
      
      // Recalculate ratio based on new reference
      const newRatioInfo = this.calculateRatioFromReference(
        lastPoint.frequency,
        noteInfo.midiNote,
        this.referenceFrequency.frequency,
        this.referenceFrequency.midiNote
      );
      
      // Add a new data point with updated ratio info (same frequency, new ratio)
      noteInfo.dataPoints.push({
        timestamp,
        centsFromPureRatio: newRatioInfo.centsFromPureRatio,
        frequency: lastPoint.frequency,
        ratio: newRatioInfo.ratio,
        ratioString: newRatioInfo.ratioString,
        intervalName: newRatioInfo.intervalName
      });
      
      console.log(`  ${this.getNoteLabel(noteInfo.midiNote)}: ${lastPoint.ratioString} → ${newRatioInfo.ratioString}`);
    }
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
    
    // Draw keyboard
    this.drawKeyboard();
    
    // Draw tuner display below keyboard (always visible)
    this.drawTunerDisplay();
    
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
   * Update active notes with current frequency/ratio data
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
        // For active notes, the frequency/ratio should be stable unless retuning
        // Just add the current state as a new data point
        noteInfo.dataPoints.push({
          timestamp: currentTime,
          centsFromPureRatio: lastPoint.centsFromPureRatio,
          frequency: lastPoint.frequency,
          ratio: lastPoint.ratio,
          ratioString: lastPoint.ratioString,
          intervalName: lastPoint.intervalName
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
   * Draw time axis label (currently unused, but kept for potential future use)
   */
  drawTimeLabel() {
    // Time window label removed - information is implicit from time axis
  }

  /**
   * Draw guitar-tuner-style display showing average deviation from pure ratios
   * and accumulated comma drift
   */
  drawTunerDisplay() {
    // Calculate purity display value (deviation from perfect ratios)
    let displayCents = 0;
    let label = '';
    
    // Calculate average cents deviation from pure ratios of all active notes
    const activeNotesArray = Array.from(this.noteData.values()).filter(n => n.isActive);
    
    if (activeNotesArray.length > 0) {
      // Active notes - show average
      let totalCents = 0;
      let count = 0;
      
      for (const noteInfo of activeNotesArray) {
        if (noteInfo.dataPoints.length > 0) {
          const lastPoint = noteInfo.dataPoints[noteInfo.dataPoints.length - 1];
          totalCents += lastPoint.centsFromPureRatio;
          count++;
        }
      }
      
      if (count > 0) {
        displayCents = totalCents / count;
        label = `Purity (${count} note${count > 1 ? 's' : ''})`;
      }
    } else if (this.referenceFrequency) {
      // No active notes, reference is always perfectly in-tune with itself
      displayCents = 0;
      label = 'Perfect';
    } else {
      // No reference yet - show centered
      displayCents = 0;
      label = 'Awaiting First Note';
    }
    
    // Draw tuner display below keyboard
    const centerX = this.canvas.width / 2;
    const y = this.plotHeight + this.keyboardHeight; // Below keyboard
    const width = Math.min(400, this.canvas.width - 40);
    const height = this.tunerHeight - 15;
    const tickRange = 50; // ±50 cents display range
    
    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(centerX - width/2, y, width, height);
    
    // Border
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(centerX - width/2, y, width, height);
    
    // Center line
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, y + 5);
    this.ctx.lineTo(centerX, y + height - 5);
    this.ctx.stroke();
    
    // Tick marks
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.font = '8px monospace';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.textAlign = 'center';
    
    for (let cents = -tickRange; cents <= tickRange; cents += 10) {
      if (cents === 0) continue;
      const x = centerX + (cents / tickRange) * (width / 2 - 10);
      const tickHeight = (cents % 20 === 0) ? height * 0.3 : height * 0.15;
      
      this.ctx.beginPath();
      this.ctx.moveTo(x, y + height - tickHeight - 5);
      this.ctx.lineTo(x, y + height - 5);
      this.ctx.stroke();
      
      // Label major ticks
      if (cents % 20 === 0) {
        this.ctx.fillText(`${cents > 0 ? '+' : ''}${cents}`, x, y + height - tickHeight - 10);
      }
    }
    
    // PRIMARY NEEDLE: Current purity (average deviation from perfect ratios)
    const needleCents = Math.max(-tickRange, Math.min(tickRange, displayCents));
    const needleX = centerX + (needleCents / tickRange) * (width / 2 - 10);
    
    // Needle triangle
    this.ctx.fillStyle = this.getColorFromCents(displayCents);
    this.ctx.beginPath();
    this.ctx.moveTo(needleX, y + 5);
    this.ctx.lineTo(needleX - 6, y + 15);
    this.ctx.lineTo(needleX + 6, y + 15);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Needle line
    this.ctx.strokeStyle = this.getColorFromCents(displayCents);
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(needleX, y + 15);
    this.ctx.lineTo(needleX, y + height / 2 - 10);
    this.ctx.stroke();
    
    // Display purity cents value
    this.ctx.fillStyle = this.getColorFromCents(displayCents);
    this.ctx.font = 'bold 11px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      `${displayCents > 0 ? '+' : ''}${displayCents.toFixed(1)}¢`,
      centerX,
      y + height / 2 - 12
    );
    
    // SECONDARY INDICATOR: Comma drift (if present)
    if (this.initialReferenceFrequency && Math.abs(this.referenceDriftCents) > 0.5) {
      const driftCents = Math.max(-tickRange, Math.min(tickRange, this.referenceDriftCents));
      const driftX = centerX + (driftCents / tickRange) * (width / 2 - 10);
      
      // Drift marker (small triangle at bottom)
      this.ctx.fillStyle = '#FFD700'; // Gold for drift
      this.ctx.globalAlpha = 0.8;
      this.ctx.beginPath();
      this.ctx.moveTo(driftX, y + height - 5);
      this.ctx.lineTo(driftX - 5, y + height - 13);
      this.ctx.lineTo(driftX + 5, y + height - 13);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Drift line (subtle dashed line)
      this.ctx.strokeStyle = '#FFD700';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([3, 3]);
      this.ctx.globalAlpha = 0.5;
      this.ctx.beginPath();
      this.ctx.moveTo(driftX, y + height / 2);
      this.ctx.lineTo(driftX, y + height - 13);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.globalAlpha = 1.0;
      
      // Drift value
      this.ctx.fillStyle = '#FFD700';
      this.ctx.font = 'bold 9px monospace';
      this.ctx.fillText(
        `${this.referenceDriftCents > 0 ? '+' : ''}${this.referenceDriftCents.toFixed(1)}¢`,
        driftX,
        y + height - 16
      );
    }
    
    // Labels
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.font = '9px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(label, centerX - width/2 + 5, y + 10);
    
    // Drift label (if present)
    if (this.initialReferenceFrequency && Math.abs(this.referenceDriftCents) > 0.5) {
      this.ctx.fillStyle = '#FFD700';
      this.ctx.textAlign = 'right';
      this.ctx.fillText('Drift', centerX + width/2 - 5, y + 10);
    }
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
        // Get most recent ratio info from any active instance
        let mostRecentCents = 0;
        let ratioString = '1:1';
        for (const noteId of activeNoteIds) {
          const noteInfo = this.noteData.get(noteId);
          if (noteInfo && noteInfo.dataPoints.length > 0) {
            const lastPoint = noteInfo.dataPoints[noteInfo.dataPoints.length - 1];
            mostRecentCents = lastPoint.centsFromPureRatio;
            ratioString = lastPoint.ratioString;
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
      
      // Show ratio and deviation for active notes
      if (isActive) {
        let mostRecentCents = 0;
        let ratioString = '1:1';
        for (const noteId of activeNoteIds) {
          const noteInfo = this.noteData.get(noteId);
          if (noteInfo && noteInfo.dataPoints.length > 0) {
            const lastPoint = noteInfo.dataPoints[noteInfo.dataPoints.length - 1];
            mostRecentCents = lastPoint.centsFromPureRatio;
            ratioString = lastPoint.ratioString;
            break;
          }
        }
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.font = 'bold 9px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(ratioString, bounds.centerX, bounds.y + bounds.height - 18);
        if (Math.abs(mostRecentCents) > 1) {
          this.ctx.font = '8px monospace';
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          this.ctx.fillText(`${mostRecentCents > 0 ? '+' : ''}${mostRecentCents.toFixed(0)}¢`, bounds.centerX, bounds.y + bounds.height - 8);
        }
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
    
    // The reference is always perfectly centered (it's the reference - ratio 1:1)
    const x = bounds.centerX;
    
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
    
    // Add a label at the top showing reference note
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = 'bold 10px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`REFERENCE: ${this.getNoteLabel(refMidi)} (${refFreq.toFixed(1)} Hz)`, x, 25);
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
        const xOffset = this.getXOffsetFromCents(dataPoint.centsFromPureRatio, bounds);
        const x = bounds.centerX + xOffset;
        points.push({ x, y, cents: dataPoint.centsFromPureRatio });
      }
    }
    
    // Draw the path with color gradient based on deviation from pure ratio
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
