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

    // If already playing, don't double-start
    if (this._tensionPlaying && this._musicMaster) return;

    // Cancel any pending teardown from a previous stop
    this._musicGen = (this._musicGen || 0) + 1;
    const gen = this._musicGen;
    this._clearMusicTimers();

    this._tensionPlaying = true;
    this._tensionIntensity = 0.2;

    // Master bus → compressor (keeps it loud but not clipped/silent)
    this._musicMaster = this.ctx.createGain();
    this._musicMaster.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this._musicMaster.gain.exponentialRampToValueAtTime(1.0, this.ctx.currentTime + 0.8);

    this._musicComp = this.ctx.createDynamicsCompressor();
    this._musicComp.threshold.setValueAtTime(-18, this.ctx.currentTime);
    this._musicComp.knee.setValueAtTime(12, this.ctx.currentTime);
    this._musicComp.ratio.setValueAtTime(4, this.ctx.currentTime);
    this._musicComp.attack.setValueAtTime(0.01, this.ctx.currentTime);
    this._musicComp.release.setValueAtTime(0.25, this.ctx.currentTime);

    // Final output gain — strong & audible
    this._musicOut = this.ctx.createGain();
    this._musicOut.gain.setValueAtTime(2.2, this.ctx.currentTime);

    this._musicMaster.connect(this._musicComp);
    this._musicComp.connect(this._musicOut);
    this._musicOut.connect(this.ctx.destination);

    this._startDronePad();
    this._startSubBass();
    this._startNoiseTexture();
    this._startPulseSequencer();
    this._updateTensionParams();

    // Keep context alive if browser suspends it
    this._musicResumeWatch = setInterval(() => {
      if (this._musicGen !== gen || !this._tensionPlaying) return;
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }, 1000);
  }

  stopTensionMusic() {
    if (!this._tensionPlaying || !this.ctx) return;
    this._tensionPlaying = false;
    const gen = this._musicGen;

    const now = this.ctx.currentTime;
    if (this._musicMaster) {
      try {
        this._musicMaster.gain.cancelScheduledValues(now);
        this._musicMaster.gain.setValueAtTime(Math.max(0.001, this._musicMaster.gain.value || 0.001), now);
        this._musicMaster.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      } catch (_) {}
    }

    setTimeout(() => {
      // Only tear down if no newer start happened
      if (this._musicGen !== gen) return;
      this._stopMusicNodes();
    }, 1400);
  }

  setTensionIntensity(level) {
    this._tensionIntensity = Math.max(0, Math.min(1, level));
    this._updateTensionParams();
  }

  _updateTensionParams() {
    if (!this.ctx || !this._tensionPlaying) return;
    const t = this._tensionIntensity;
    const now = this.ctx.currentTime;

    if (this._droneGain) {
      this._droneGain.gain.cancelScheduledValues(now);
      this._droneGain.gain.setTargetAtTime(0.18 + t * 0.22, now, 0.5);
    }
    if (this._droneOsc2) {
      this._droneOsc2.detune.cancelScheduledValues(now);
      this._droneOsc2.detune.setTargetAtTime(t * 25, now, 0.5);
    }

    // Volume amp (not the LFO-modulated node)
    if (this._subAmp) {
      this._subAmp.gain.cancelScheduledValues(now);
      this._subAmp.gain.setTargetAtTime(0.35 + t * 0.40, now, 0.5);
    }
    if (this._subLfo) {
      this._subLfo.frequency.cancelScheduledValues(now);
      this._subLfo.frequency.setTargetAtTime(0.35 + t * 1.5, now, 0.5);
    }

    if (this._noiseFilter) {
      this._noiseFilter.frequency.cancelScheduledValues(now);
      this._noiseFilter.frequency.setTargetAtTime(200 + t * 1200, now, 0.5);
    }
    if (this._noiseGain) {
      this._noiseGain.gain.cancelScheduledValues(now);
      this._noiseGain.gain.setTargetAtTime(0.05 + t * 0.12, now, 0.5);
    }

    if (this._pulseGain) {
      this._pulseGain.gain.cancelScheduledValues(now);
      this._pulseGain.gain.setTargetAtTime(0.22 + t * 0.30, now, 0.5);
    }

    if (this._musicOut) {
      this._musicOut.gain.cancelScheduledValues(now);
      this._musicOut.gain.setTargetAtTime(2.0 + t * 0.8, now, 0.8);
    }
  }

  // Layer 1: Dark pad — two detuned sawtooth oscillators through lowpass
  _startDronePad() {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(55, this.ctx.currentTime);
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(55.3, this.ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);

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

    this._droneSweepInterval = setInterval(() => {
      if (!this._tensionPlaying || !this.ctx) return;
      const t = this._tensionIntensity;
      const now = this.ctx.currentTime;
      const baseFreq = 180 + t * 320;
      const sweep = Math.sin(now * 0.15) * (80 + t * 150);
      filter.frequency.setTargetAtTime(baseFreq + sweep, now, 0.3);
    }, 200);
  }

  // Layer 2: Sub bass with safe LFO pulse (LFO never rides the volume AudioParam)
  _startSubBass() {
    const osc = this.ctx.createOscillator();
    const pulse = this.ctx.createGain(); // LFO modulates this between ~0.2–1.0
    const amp = this.ctx.createGain();   // overall loudness control
    const lfo = this.ctx.createOscillator();
    const lfoDepth = this.ctx.createGain();
    const lfoOffset = this.ctx.createConstantSource();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(36.7, this.ctx.currentTime);

    // pulse = 0.55 + LFO*0.45 → stays positive so audio never goes silent
    pulse.gain.setValueAtTime(0, this.ctx.currentTime);
    lfoOffset.offset.setValueAtTime(0.55, this.ctx.currentTime);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.5, this.ctx.currentTime);
    lfoDepth.gain.setValueAtTime(0.45, this.ctx.currentTime);

    amp.gain.setValueAtTime(0.4, this.ctx.currentTime);

    lfo.connect(lfoDepth);
    lfoDepth.connect(pulse.gain);
    lfoOffset.connect(pulse.gain);

    osc.connect(pulse);
    pulse.connect(amp);
    amp.connect(this._musicMaster);

    osc.start();
    lfo.start();
    lfoOffset.start();

    this._subOsc = osc;
    this._subPulse = pulse;
    this._subAmp = amp;
    this._subLfo = lfo;
    this._subLfoDepth = lfoDepth;
    this._subLfoOffset = lfoOffset;
  }

  // Layer 3: Filtered noise for texture / atmosphere
  _startNoiseTexture() {
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
    gain.gain.setValueAtTime(0.07, this.ctx.currentTime);

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
    gain.gain.setValueAtTime(0.28, this.ctx.currentTime);
    gain.connect(this._musicMaster);
    this._pulseGain = gain;

    const pattern = [55, 0, 55, 0, 73.4, 0, 55, 65.4];
    let step = 0;

    const firePulse = () => {
      if (!this._tensionPlaying || !this.ctx || !this._pulseGain) return;
      const note = pattern[step % pattern.length];
      step++;
      if (note === 0) return;

      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note, this.ctx.currentTime);

      env.gain.setValueAtTime(0.001, this.ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(1.0, this.ctx.currentTime + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

      osc.connect(env);
      env.connect(this._pulseGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.32);
    };

    const schedulePulseLoop = () => {
      clearInterval(this._pulseInterval);
      const interval = Math.max(220, 520 - this._tensionIntensity * 220);
      this._pulseInterval = setInterval(firePulse, interval);
      this._lastPulseTempo = interval;
    };

    schedulePulseLoop();

    this._pulseTempoUpdater = setInterval(() => {
      if (!this._tensionPlaying) return;
      const newInterval = Math.max(220, 520 - this._tensionIntensity * 220);
      if (!this._lastPulseTempo || Math.abs(this._lastPulseTempo - newInterval) > 30) {
        schedulePulseLoop();
      }
    }, 2000);
  }

  _clearMusicTimers() {
    clearInterval(this._droneSweepInterval);
    clearInterval(this._pulseInterval);
    clearInterval(this._pulseTempoUpdater);
    clearInterval(this._musicResumeWatch);
    this._droneSweepInterval = null;
    this._pulseInterval = null;
    this._pulseTempoUpdater = null;
    this._musicResumeWatch = null;
  }

  _stopMusicNodes() {
    const nodes = [
      this._droneOsc1, this._droneOsc2,
      this._subOsc, this._subLfo, this._subLfoOffset,
      this._noiseSrc
    ];
    nodes.forEach(n => {
      try { if (n) n.stop(); } catch (_) {}
    });

    this._clearMusicTimers();

    try { if (this._musicMaster) this._musicMaster.disconnect(); } catch (_) {}
    try { if (this._musicComp) this._musicComp.disconnect(); } catch (_) {}
    try { if (this._musicOut) this._musicOut.disconnect(); } catch (_) {}

    this._droneOsc1 = null;
    this._droneOsc2 = null;
    this._droneFilter = null;
    this._droneGain = null;
    this._subOsc = null;
    this._subPulse = null;
    this._subAmp = null;
    this._subLfo = null;
    this._subLfoDepth = null;
    this._subLfoOffset = null;
    this._subGain = null;
    this._subLfoGain = null;
    this._noiseSrc = null;
    this._noiseFilter = null;
    this._noiseGain = null;
    this._pulseGain = null;
    this._musicMaster = null;
    this._musicComp = null;
    this._musicOut = null;
  }
}

// Export a single instance to be used everywhere
window.quantumAudio = new QuantumAudio();
