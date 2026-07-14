// audio.js - Web Audio API Synthesizer for Quantum Core Stability Arena

class QuantumAudio {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
  }

  init() {
    if (this.unlocked && this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.unlocked = true;
    } catch (e) {
      console.warn("Web Audio API not supported on this browser", e);
    }
  }

  // Play a simple digital click sound
  playSelect() {
    this.init();
    if (!this.ctx) return;
    
    // Resume context if suspended (browser security policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  // Play a warning alarm sound (siren effect)
  playWarning() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 0.4);
    osc1.frequency.linearRampToValueAtTime(150, this.ctx.currentTime + 0.8);

    osc2.frequency.setValueAtTime(152, this.ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(302, this.ctx.currentTime + 0.4);
    osc2.frequency.linearRampToValueAtTime(152, this.ctx.currentTime + 0.8);

    gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.8);
    osc2.stop(this.ctx.currentTime + 0.8);
  }

  // Play a heavy clank sound when scores/results are computed
  playClank() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const noise = this.createNoiseBuffer();
    const noiseNode = this.ctx.createBufferSource();
    const gainOsc = this.ctx.createGain();
    const gainNoise = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.3);

    gainOsc.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gainOsc.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

    if (noise) {
      noiseNode.buffer = noise;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(100, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.0, this.ctx.currentTime);
      
      gainNoise.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gainNoise.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      noiseNode.connect(filter);
      filter.connect(gainNoise);
      gainNoise.connect(this.ctx.destination);
      noiseNode.start();
    }

    osc.connect(gainOsc);
    gainOsc.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  // Play a bubbling sizzle noise when coolant/plasma levels increase
  playSizzle() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const noise = this.createNoiseBuffer();
    if (!noise) return;

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noise;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1500, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(3000, this.ctx.currentTime + 0.6);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.65);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noiseNode.start();
    noiseNode.stop(this.ctx.currentTime + 0.75);

    // Play a couple of offset high pitch bubble pops
    for (let i = 0; i < 3; i++) {
      const delay = 0.1 * i + Math.random() * 0.05;
      this.playBubblePop(this.ctx.currentTime + delay);
    }
  }

  playBubblePop(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800 + Math.random() * 400, time);
    osc.frequency.exponentialRampToValueAtTime(1500, time + 0.03);

    gain.gain.setValueAtTime(0.02, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.04);
  }

  // Play a ticking countdown sound
  playTick() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.03);
  }

  // Play meltdown alarm sound
  playMeltdown() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const duration = 1.5;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 0.2);
    gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);

    // Large splash / bubble storm
    const noise = this.createNoiseBuffer();
    if (noise) {
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = noise;
      const noiseGain = this.ctx.createGain();
      
      noiseGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      noiseNode.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noiseNode.start();
      noiseNode.stop(this.ctx.currentTime + duration);
    }
  }

  // Helper to create white noise
  createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // ============================================================
  // TENSION MUSIC ENGINE
  // Procedural ambient soundtrack using layered synth drones,
  // a rhythmic pulse sequencer, and filtered noise textures.
  // intensity: 0.0 (calm) → 1.0 (critical meltdown territory)
  // ============================================================

  startTensionMusic() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this._tensionPlaying) return;
    this._tensionPlaying = true;
    this._tensionIntensity = 0.15;

    // Master gain for entire music bus
    this._musicMaster = this.ctx.createGain();
    this._musicMaster.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this._musicMaster.gain.linearRampToValueAtTime(1.0, this.ctx.currentTime + 2.0);
    this._musicMaster.connect(this.ctx.destination);

    this._startDronePad();
    this._startSubBass();
    this._startNoiseTexture();
    this._startPulseSequencer();
  }

  stopTensionMusic() {
    if (!this._tensionPlaying || !this.ctx) return;
    this._tensionPlaying = false;

    const now = this.ctx.currentTime;
    if (this._musicMaster) {
      this._musicMaster.gain.cancelScheduledValues(now);
      this._musicMaster.gain.setValueAtTime(this._musicMaster.gain.value, now);
      this._musicMaster.gain.linearRampToValueAtTime(0.0, now + 1.5);
    }

    // Stop all music nodes after fade out
    setTimeout(() => {
      this._stopMusicNodes();
    }, 2000);
  }

  setTensionIntensity(level) {
    // level: 0.0 to 1.0
    this._tensionIntensity = Math.max(0, Math.min(1, level));
    this._updateTensionParams();
  }

  _updateTensionParams() {
    if (!this.ctx || !this._tensionPlaying) return;
    const t = this._tensionIntensity;
    const now = this.ctx.currentTime;

    // Drone gets louder and more dissonant
    if (this._droneGain) {
      this._droneGain.gain.cancelScheduledValues(now);
      this._droneGain.gain.setTargetAtTime(0.04 + t * 0.06, now, 0.5);
    }
    // Detune drone for dissonance at high intensity
    if (this._droneOsc2) {
      this._droneOsc2.detune.cancelScheduledValues(now);
      this._droneOsc2.detune.setTargetAtTime(t * 25, now, 0.5);
    }

    // Sub bass throbs harder
    if (this._subGain) {
      this._subGain.gain.cancelScheduledValues(now);
      this._subGain.gain.setTargetAtTime(0.06 + t * 0.10, now, 0.5);
    }
    // Sub LFO rate increases
    if (this._subLfo) {
      this._subLfo.frequency.cancelScheduledValues(now);
      this._subLfo.frequency.setTargetAtTime(0.3 + t * 1.7, now, 0.5);
    }

    // Noise texture opens up filter
    if (this._noiseFilter) {
      this._noiseFilter.frequency.cancelScheduledValues(now);
      this._noiseFilter.frequency.setTargetAtTime(200 + t * 1200, now, 0.5);
    }
    if (this._noiseGain) {
      this._noiseGain.gain.cancelScheduledValues(now);
      this._noiseGain.gain.setTargetAtTime(0.01 + t * 0.05, now, 0.5);
    }

    // Pulse volume
    if (this._pulseGain) {
      this._pulseGain.gain.cancelScheduledValues(now);
      this._pulseGain.gain.setTargetAtTime(0.02 + t * 0.08, now, 0.5);
    }
  }

  // Layer 1: Dark pad — two detuned sawtooth oscillators through lowpass
  _startDronePad() {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(55, this.ctx.currentTime); // A1
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(55.3, this.ctx.currentTime); // slightly detuned

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, this.ctx.currentTime);
    filter.Q.setValueAtTime(2, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this._musicMaster);

    osc1.start();
    osc2.start();

    this._droneOsc1 = osc1;
    this._droneOsc2 = osc2;
    this._droneFilter = filter;
    this._droneGain = gain;

    // Slow filter sweep LFO via script
    this._droneSweepInterval = setInterval(() => {
      if (!this._tensionPlaying || !this.ctx) return;
      const t = this._tensionIntensity;
      const now = this.ctx.currentTime;
      const baseFreq = 150 + t * 300;
      const sweep = Math.sin(now * 0.15) * (80 + t * 150);
      filter.frequency.setTargetAtTime(baseFreq + sweep, now, 0.3);
    }, 200);
  }

  // Layer 2: Sub bass with LFO-driven amplitude pulsing
  _startSubBass() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(36.7, this.ctx.currentTime); // D1

    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);

    // LFO modulates volume for a throbbing pulse
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.5, this.ctx.currentTime);
    lfoGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc.connect(gain);
    gain.connect(this._musicMaster);

    osc.start();
    lfo.start();

    this._subOsc = osc;
    this._subGain = gain;
    this._subLfo = lfo;
    this._subLfoGain = lfoGain;
  }

  // Layer 3: Filtered noise for texture / atmosphere
  _startNoiseTexture() {
    // Create a long looping noise buffer (4 seconds)
    const bufLen = this.ctx.sampleRate * 4;
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.8, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.015, this.ctx.currentTime);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this._musicMaster);

    src.start();

    this._noiseSrc = src;
    this._noiseFilter = filter;
    this._noiseGain = gain;
  }

  // Layer 4: Rhythmic pulse sequencer — timed blips that create heartbeat tension
  _startPulseSequencer() {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
    gain.connect(this._musicMaster);
    this._pulseGain = gain;

    // Notes pattern: minor key industrial feel
    const pattern = [55, 0, 55, 0, 73.4, 0, 55, 65.4]; // A1, rest, A1, rest, D2, rest, A1, C2
    let step = 0;

    this._pulseInterval = setInterval(() => {
      if (!this._tensionPlaying || !this.ctx) return;
      const t = this._tensionIntensity;
      const note = pattern[step % pattern.length];
      step++;

      if (note === 0) return; // rest

      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note, this.ctx.currentTime);

      env.gain.setValueAtTime(0.0, this.ctx.currentTime);
      env.gain.linearRampToValueAtTime(1.0, this.ctx.currentTime + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      osc.connect(env);
      env.connect(this._pulseGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    }, 500 - this._tensionIntensity * 200); // Tempo increases with intensity

    // Restart interval when intensity changes to update tempo
    this._pulseTempoUpdater = setInterval(() => {
      if (!this._tensionPlaying) return;
      const newInterval = 500 - this._tensionIntensity * 200;
      // We only restart if tempo changed significantly
      if (this._lastPulseTempo && Math.abs(this._lastPulseTempo - newInterval) > 30) {
        clearInterval(this._pulseInterval);
        this._lastPulseTempo = newInterval;
        let localStep = step;
        this._pulseInterval = setInterval(() => {
          if (!this._tensionPlaying || !this.ctx) return;
          const note = pattern[localStep % pattern.length];
          localStep++;
          step = localStep;

          if (note === 0) return;

          const osc = this.ctx.createOscillator();
          const env = this.ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(note, this.ctx.currentTime);

          env.gain.setValueAtTime(0.0, this.ctx.currentTime);
          env.gain.linearRampToValueAtTime(1.0, this.ctx.currentTime + 0.01);
          env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

          osc.connect(env);
          env.connect(this._pulseGain);

          osc.start();
          osc.stop(this.ctx.currentTime + 0.3);
        }, newInterval);
      }
      this._lastPulseTempo = newInterval;
    }, 2000);
  }

  _stopMusicNodes() {
    // Stop all oscillators and sources
    const nodes = [this._droneOsc1, this._droneOsc2, this._subOsc, this._subLfo, this._noiseSrc];
    nodes.forEach(n => {
      try { if (n) n.stop(); } catch(e) {}
    });

    // Clear intervals
    clearInterval(this._droneSweepInterval);
    clearInterval(this._pulseInterval);
    clearInterval(this._pulseTempoUpdater);

    // Null out references
    this._droneOsc1 = null;
    this._droneOsc2 = null;
    this._droneFilter = null;
    this._droneGain = null;
    this._subOsc = null;
    this._subGain = null;
    this._subLfo = null;
    this._subLfoGain = null;
    this._noiseSrc = null;
    this._noiseFilter = null;
    this._noiseGain = null;
    this._pulseGain = null;
    this._musicMaster = null;
  }
}

// Export a single instance to be used everywhere
window.quantumAudio = new QuantumAudio();
