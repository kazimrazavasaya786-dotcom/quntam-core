// script.js - Core Game Engine for Quantum Core Stability Arena

// Global State
let gameConfig = {
  nodeCount: 5,
  players: [],
  rules: {
    rule1: false, // Disqualification on duplicate values
    rule2: false, // Precision Target Spike (exact target match penalty for others)
    rule3: false  // 100 beats 0 in 1v1 shutdown
  },
  rulesAtStart: {
    rule1: false,
    rule2: false,
    rule3: false
  }
};

const RULE_DEFINITIONS = {
  1: {
    name: 'Disqualification Protocol',
    shortTag: 'Disqual. Override',
    desc: 'If multiple nodes select the exact same value, they are immediately disqualified and receive a stability penalty.',
    trigger: 'Active when 4 or fewer nodes remain.'
  },
  2: {
    name: 'Precision Target Spike',
    shortTag: 'Precision Spike',
    desc: 'If a node hits the target value precisely, all other nodes suffer double stability depletion (-2 points).',
    trigger: 'Active when 3 or fewer nodes remain.'
  },
  3: {
    name: 'Quantum Zero-One Override',
    shortTag: 'Zero-One Override',
    desc: 'In 1v1 shutdown mode, if one node chooses 0 and the other chooses 100, the node choosing 100 overrides all calculations and wins.',
    trigger: 'Active when exactly 2 nodes remain.'
  }
};

let gameState = {
  currentRound: 1,
  phase: 'setup', // 'setup', 'arena', 'input', 'reveal', 'meltdown_check', 'rule_notice', 'game_over'
  activeHumanIndex: -1, // DEPRECATED in multiplayer
  history: [],
  winnerId: null,
  ruleNoticeQueue: []
};

let peerToPlayerMap = {}; // mapping of peerId -> playerId
let myPlayerId = 1; // Default to Host (Player 1)
let lastSyncedPhase = null; // avoid reopening turn overlay on every host tick
let finalRoundStingerPlayed = false;
let currentTensionValue = 0.1;
let audioUnlocked = false;
let lastHeartbeatAt = 0;

// DOM Elements
const screens = {
  setup: document.getElementById('setup-screen'),
  turn: document.getElementById('turn-screen'),
  arena: document.getElementById('arena-screen'),
  victory: document.getElementById('victory-screen')
};

const btnNodes3 = document.getElementById('btn-nodes-3');
const btnNodes4 = document.getElementById('btn-nodes-4');
const btnNodes5 = document.getElementById('btn-nodes-5');
const nodeConfigList = document.getElementById('node-config-list');
const btnStartGame = document.getElementById('btn-start-game');

const ruleCards = {
  1: document.getElementById('rule-card-1'),
  2: document.getElementById('rule-card-2'),
  3: document.getElementById('rule-card-3')
};

const turnPlayerName = document.getElementById('turn-player-name');
const turnPrompt = document.getElementById('turn-prompt');
const btnAccessConfirm = document.getElementById('btn-access-confirm');
const turnInputControls = document.getElementById('turn-input-controls');
const nodeInputSlider = document.getElementById('node-input-slider');
const sliderValDisplay = document.getElementById('slider-val-display');
const btnLockInput = document.getElementById('btn-lock-input');

const lcdAverage = document.getElementById('lcd-average');
const lcdTarget = document.getElementById('lcd-target');
const scaleTicks = document.getElementById('scale-ticks');
const scalePlots = document.getElementById('scale-plots');
const nodesContainer = document.getElementById('nodes-container');
const btnArenaAction = document.getElementById('btn-arena-action');
const btnAbortGame = document.getElementById('btn-abort-game');
const arenaInstructions = document.getElementById('arena-instructions');
const roundNumberLcd = document.getElementById('round-number-lcd');
const activeRulesTags = document.getElementById('active-rules-tags');
const historyLogs = document.getElementById('history-logs');

const audioToggleBtn = document.getElementById('audio-toggle-btn');
let audioMuted = false;

const btnProtocols = document.getElementById('btn-protocols');
const btnCloseProtocols = document.getElementById('btn-close-protocols');
const protocolsModal = document.getElementById('protocols-modal');
const ruleNoticeModal = document.getElementById('rule-notice-modal');
const ruleNoticeTitle = document.getElementById('rule-notice-title');
const ruleNoticeDesc = document.getElementById('rule-notice-desc');
const ruleNoticeContext = document.getElementById('rule-notice-context');
const btnAckRuleNotice = document.getElementById('btn-ack-rule-notice');

const defaultNames = ['Node Alpha', 'Node Beta', 'Node Gamma', 'Node Delta', 'Node Epsilon'];
const aiPersonalities = ['rationalist', 'analyst', 'maverick', 'defender'];

function isOnlineHost() {
  return window.Network && window.Network.getMode() === 'host';
}

function isOnlineClient() {
  return window.Network && window.Network.getMode() === 'client';
}

function isOnlineGame() {
  return isOnlineHost() || isOnlineClient();
}

/** Local, host, and joining players all get sound. */
function canPlayAudio() {
  if (audioMuted) return false;
  return !!(window.quantumAudio);
}

function syncAudioToggleVisibility() {
  if (!audioToggleBtn) return;
  audioToggleBtn.style.display = 'flex';
}

/** Browsers block audio until a user gesture — call on taps/clicks. */
function unlockAudio() {
  if (!window.quantumAudio) return;
  window.quantumAudio.init();
  if (window.quantumAudio.ctx && window.quantumAudio.ctx.state === 'suspended') {
    window.quantumAudio.ctx.resume();
  }
  audioUnlocked = true;
  if (
    gameState.phase !== 'setup' &&
    gameState.phase !== 'game_over' &&
    !audioMuted
  ) {
    startGameMusic();
  }
}

function renderLobbyList(containerId, lobby) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!lobby || lobby.length === 0) {
    el.innerHTML = '';
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  el.innerHTML = lobby.map((p, i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0.55rem;margin-bottom:0.35rem;background:rgba(255,255,255,0.03);border:1px solid rgba(0,229,255,0.12);border-radius:6px;font-size:0.85rem;">
      <span>${p.name || ('Player ' + (i + 1))}</span>
      <span style="color:var(--accent-cyan);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;">${p.isHost ? 'Host' : 'Joined'}</span>
    </div>
  `).join('');
}

function openTurnInputFor(playerName) {
  turnPlayerName.textContent = playerName;
  nodeInputSlider.value = 50;
  sliderValDisplay.textContent = 50;

  if (isOnlineGame()) {
    // Online: no "pass the device" gate — each person has their own screen
    btnAccessConfirm.style.display = 'none';
    turnPrompt.style.display = 'none';
    turnPrompt.textContent = 'Pick your secret number (0–100). Other players cannot see this.';
    turnInputControls.style.display = 'block';
  } else {
    btnAccessConfirm.style.display = 'block';
    turnPrompt.style.display = 'block';
    turnPrompt.textContent = 'Please pass control to this administrator. Ensure all other administrators cannot view the input console.';
    turnInputControls.style.display = 'none';
  }
  switchScreen('turn');
}

function syncClientFromHost(payload) {
  gameConfig = payload.gameConfig;
  gameState = payload.gameState;
  peerToPlayerMap = payload.peerToPlayerMap || {};

  const myPeerId = window.Network.getPeerId();
  myPlayerId = peerToPlayerMap[myPeerId] || null;

  if (gameState.phase !== 'rule_notice') {
    hideRuleNoticeModal();
  }

  syncAudioToggleVisibility();

  document.body.classList.remove('nodes-3', 'nodes-4', 'nodes-5');
  if (gameConfig.nodeCount >= 3 && gameConfig.nodeCount <= 5) {
    document.body.classList.add(`nodes-${gameConfig.nodeCount}`);
  }

  // Start / keep tension music on joining devices when a match is running
  if (
    gameState.phase !== 'setup' &&
    gameState.phase !== 'game_over' &&
    !audioMuted &&
    audioUnlocked
  ) {
    startGameMusic();
    updateTensionIntensity();
  }

  renderActiveRulesTags();
  renderArenaNodeCards();
  resetScalePlot();
  roundNumberLcd.textContent = `Round ${gameState.currentRound}`;
  renderLogs();
  btnArenaAction.style.display = 'none';
  btnAbortGame.style.display = 'none';

  // Show status text for clients so they always know what's happening
  const clientStatus = document.getElementById('arena-instructions');

  if (gameState.history.length > 0) {
    const lastRound = gameState.history[gameState.history.length - 1];
    lcdAverage.textContent = lastRound.average.toFixed(2);
    lcdTarget.textContent = lastRound.target.toFixed(2);
  } else {
    lcdAverage.textContent = '--.--';
    lcdTarget.textContent = '--.--';
  }

  const phase = gameState.phase;

  if (phase === 'input') {
    const me = myPlayerId ? gameConfig.players.find(p => p.id === myPlayerId) : null;
    if (me && me.isAlive && me.lastChoice === null) {
      if (lastSyncedPhase !== 'input-open') {
        openTurnInputFor(me.name);
        lastSyncedPhase = 'input-open';
        playSelectSound();
      }
    } else {
      lastSyncedPhase = 'input-wait';
      if (clientStatus) {
        clientStatus.textContent = me && me.lastChoice !== null
          ? 'Value locked. Waiting for other nodes...'
          : 'Waiting for nodes to lock inputs... (Spectating)';
      }
      gameConfig.players.forEach(p => {
        if (!p.isAlive) return;
        const badge = document.getElementById(`node-val-${p.id}`);
        if (!badge) return;
        if (p.lastChoice !== null && p.type === 'human') {
          badge.textContent = 'LOCKED';
          badge.className = 'node-value-badge locked';
        } else {
          badge.textContent = 'WAITING';
          badge.className = 'node-value-badge';
        }
      });
      switchScreen('arena');
    }
    return;
  }

  if (phase === 'reveal') {
    if (lastSyncedPhase !== 'reveal') playTickSound();
    lastSyncedPhase = phase;
    if (clientStatus) clientStatus.textContent = 'All values locked. Waiting for host to Execute Evaluation...';
    gameConfig.players.forEach(p => {
      if (!p.isAlive) return;
      const badge = document.getElementById(`node-val-${p.id}`);
      if (badge) {
        badge.textContent = 'LOCKED';
        badge.className = 'node-value-badge locked';
      }
    });
    switchScreen('arena');
    return;
  }

  if (phase === 'rule_notice') {
    const isNewNotice = lastSyncedPhase !== 'rule_notice';
    lastSyncedPhase = phase;
    if (gameState.ruleNoticeQueue && gameState.ruleNoticeQueue.length > 0) {
      showRuleNotice(gameState.ruleNoticeQueue[0], { announce: isNewNotice });
    }
    renderActiveRulesTags();
    if (clientStatus) {
      clientStatus.textContent = 'New elimination protocol activated. Waiting for host acknowledgment...';
    }
    switchScreen('arena');
    return;
  }

  if (phase === 'meltdown_check') {
    const isNewReveal = lastSyncedPhase !== 'meltdown_check';
    if (isNewReveal) {
      playClankSound();
    }
    lastSyncedPhase = phase;
    if (gameState.history.length > 0) {
      const lastRound = gameState.history[gameState.history.length - 1];
      if (isNewReveal) {
        // Fresh transition into reveal — play the scramble animation
        revealPlayerChoicesStaggered(lastRound.winnerId);
      } else {
        // Re-sync (e.g. late state resend) — just show final values instantly
        gameConfig.players.forEach(p => {
          if (!p.isAlive) return;
          const badge = document.getElementById(`node-val-${p.id}`);
          if (!badge) return;
          const pChoice = lastRound.choices[p.name];
          const isDq = lastRound.disqualifiedIds.includes(p.id);
          const isWinner = lastRound.winnerId === p.id;

          if (isDq) {
            badge.textContent = `DQ (${pChoice})`;
            badge.className = 'node-value-badge disqualified';
          } else if (isWinner) {
            badge.textContent = String(pChoice);
            badge.className = 'node-value-badge winner green-glow';
          } else if (pChoice !== null && pChoice !== undefined) {
            badge.textContent = String(pChoice);
            badge.className = 'node-value-badge revealed';
          }
        });
      }
      plotScaleResults(
        gameConfig.players
          .filter(p => p.isAlive && !lastRound.disqualifiedIds.includes(p.id) && lastRound.choices[p.name] !== null && lastRound.choices[p.name] !== undefined)
          .map(p => ({ id: p.id, choice: lastRound.choices[p.name] })),
        lastRound.target,
        lastRound.disqualifiedIds
      );
      const winner = gameConfig.players.find(p => p.id === lastRound.winnerId);
      if (clientStatus) {
        clientStatus.textContent = winner
          ? `Target ${lastRound.target.toFixed(2)}. ${winner.name} wins this round. Waiting for host...`
          : `Target ${lastRound.target.toFixed(2)}. Waiting for host...`;
      }
      updateTensionIntensity();
    } else if (clientStatus) {
      clientStatus.textContent = 'Waiting for host...';
    }
    switchScreen('arena');
    return;
  }

  if (phase === 'game_over') {
    lastSyncedPhase = phase;
    const survivors = gameConfig.players.filter(p => p.isAlive);
    declareGameOver(survivors);
    return;
  }

  lastSyncedPhase = phase;
  if (phase === 'arena') {
    if (clientStatus) {
      clientStatus.textContent = `Round ${gameState.currentRound} — waiting for host to begin inputs.`;
    }
    gameConfig.players.forEach(p => {
      const badge = document.getElementById(`node-val-${p.id}`);
      if (!badge) return;
      badge.textContent = p.isAlive ? 'WAITING' : 'OFFLINE';
      badge.className = p.isAlive ? 'node-value-badge' : 'node-value-badge disqualified';
    });
    switchScreen('arena');
  } else if (screens[phase]) {
    switchScreen(phase);
  }
}

// Initialize App
function initApp() {
  setupEventListeners();
  renderNodeConfigList();
  renderScaleTicks();
  syncRuleCardsUI();
  
  // Set up Network Events
  if (window.Network) {
    window.Network.events.onRoomCreated = (code) => {
      document.getElementById('host-room-code').textContent = code;
    };

    window.Network.events.onClientConnected = (peerId, count) => {
      document.getElementById('connected-players-count').textContent = count;
    };

    window.Network.events.onLobbyUpdate = (lobby) => {
      const remotes = (lobby || []).filter(p => !p.isHost).length;
      const countEl = document.getElementById('connected-players-count');
      if (countEl) countEl.textContent = remotes;
      renderLobbyList('host-lobby-list', lobby);
      renderLobbyList('join-lobby-list', lobby);
    };

    window.Network.events.onJoinedRoom = (code, lobby) => {
      const msg = document.getElementById('join-status-msg');
      msg.style.color = 'var(--accent-cyan)';
      msg.textContent = `Connected to room ${code}. Waiting for host to start...`;
      document.getElementById('btn-join-room').disabled = true;
      renderLobbyList('join-lobby-list', lobby);
      syncAudioToggleVisibility();
    };

    window.Network.events.onError = (message) => {
      const msg = document.getElementById('join-status-msg');
      if (msg) {
        msg.style.color = 'var(--accent-orange)';
        msg.textContent = message || 'Connection error';
      }
      alert(message || 'Network error');
    };

    window.Network.events.onConnectionLost = (message) => {
      if (isOnlineClient() && gameState.phase !== 'setup' && gameState.phase !== 'game_over') {
        alert(message || 'Disconnected from host');
        gameState.phase = 'setup';
        switchScreen('setup');
        const msg = document.getElementById('join-status-msg');
        if (msg) {
          msg.style.color = 'var(--accent-orange)';
          msg.textContent = message || 'Disconnected';
        }
        document.getElementById('btn-join-room').disabled = false;
      } else if (isOnlineHost()) {
        // Soft notice only — remaining players can continue
        console.warn(message);
      } else {
        const msg = document.getElementById('join-status-msg');
        if (msg) {
          msg.style.color = 'var(--accent-orange)';
          msg.textContent = message || 'Disconnected';
        }
        document.getElementById('btn-join-room').disabled = false;
      }
    };
    
    window.Network.events.onClientInput = (peerId, data) => {
      if (!isOnlineHost()) return;
      const pId = peerToPlayerMap[peerId];
      if (pId) {
        const player = gameConfig.players.find(p => p.id === pId);
        if (player && player.isAlive && player.lastChoice === null) {
          player.lastChoice = data.choice;
          // Refresh waiting UI for host
          const badge = document.getElementById(`node-val-${player.id}`);
          if (badge) {
            badge.textContent = 'LOCKED';
            badge.className = 'node-value-badge locked';
          }
          window.Network.broadcastState({ gameConfig, gameState, peerToPlayerMap });
          checkAllInputsReceived();
        }
      }
    };
    
    window.Network.events.onStateUpdate = (payload) => {
      if (!isOnlineClient()) return;
      syncClientFromHost(payload);
    };
  }
  
  // Unlock audio on any tap/click (required for joining players on mobile)
  document.addEventListener('click', unlockAudio);
  document.addEventListener('touchstart', unlockAudio, { passive: true });

  syncAudioToggleVisibility();
}

// Setup Event Listeners
function bindClick(el, handler) {
  if (el) el.addEventListener('click', handler);
}

function setActiveNodeCountBtn(activeBtn) {
  [btnNodes3, btnNodes4, btnNodes5].filter(Boolean).forEach(btn => {
    btn.classList.add('btn', 'btn-nodes');
    if (btn === activeBtn) {
      btn.classList.remove('btn-secondary');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.add('btn-secondary');
      btn.setAttribute('aria-pressed', 'false');
    }
  });
}

function setupEventListeners() {
  // Multiplayer UI Controls
  const btnModeLocal = document.getElementById('btn-mode-local');
  const btnModeHost = document.getElementById('btn-mode-host');
  const btnModeJoin = document.getElementById('btn-mode-join');
  const onlineJoinSection = document.getElementById('online-join-section');
  const onlineHostSection = document.getElementById('online-host-section');
  const standardSetupSections = document.getElementById('standard-setup-sections');

  bindClick(btnModeLocal, () => {
    playSelectSound();
    btnModeLocal.className = 'btn';
    btnModeHost.className = 'btn btn-secondary';
    btnModeJoin.className = 'btn btn-secondary';
    
    if (onlineJoinSection) onlineJoinSection.style.display = 'none';
    if (onlineHostSection) onlineHostSection.style.display = 'none';
    if (standardSetupSections) standardSetupSections.style.display = 'block';
    if (btnStartGame) {
      btnStartGame.style.display = 'block';
      btnStartGame.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Initialize Sequence';
    }
    if (window.Network) window.Network.goLocal();
    syncAudioToggleVisibility();
  });

  bindClick(btnModeHost, () => {
    playSelectSound();
    btnModeHost.className = 'btn';
    btnModeLocal.className = 'btn btn-secondary';
    btnModeJoin.className = 'btn btn-secondary';
    
    if (onlineJoinSection) onlineJoinSection.style.display = 'none';
    if (onlineHostSection) onlineHostSection.style.display = 'block';
    if (standardSetupSections) standardSetupSections.style.display = 'block';
    if (btnStartGame) {
      btnStartGame.style.display = 'block';
      btnStartGame.innerHTML = 'Start Online Game';
    }

    const hostNameInput = document.getElementById('host-player-name');
    const hostName = (hostNameInput && hostNameInput.value.trim()) || 'Host';
    if (window.Network) {
      window.Network.startHosting(hostName);
    }
    syncAudioToggleVisibility();
  });

  bindClick(btnModeJoin, () => {
    playSelectSound();
    btnModeJoin.className = 'btn';
    btnModeLocal.className = 'btn btn-secondary';
    btnModeHost.className = 'btn btn-secondary';
    
    if (onlineJoinSection) onlineJoinSection.style.display = 'block';
    if (onlineHostSection) onlineHostSection.style.display = 'none';
    if (standardSetupSections) standardSetupSections.style.display = 'none';
    if (btnStartGame) btnStartGame.style.display = 'none';
    const joinBtn = document.getElementById('btn-join-room');
    if (joinBtn) joinBtn.disabled = false;
    const joinMsg = document.getElementById('join-status-msg');
    if (joinMsg) joinMsg.textContent = '';
    renderLobbyList('join-lobby-list', []);
    if (window.Network) window.Network.goLocal();
    stopGameMusic();
    syncAudioToggleVisibility();
  });

  bindClick(document.getElementById('btn-join-room'), () => {
    playSelectSound();
    unlockAudio();
    const codeInput = document.getElementById('join-room-code');
    const nameInput = document.getElementById('join-player-name');
    const code = codeInput ? codeInput.value.trim() : '';
    const name = (nameInput && nameInput.value.trim()) || 'Remote Node';
    if (code.length >= 4) {
      const msg = document.getElementById('join-status-msg');
      if (msg) {
        msg.style.color = 'var(--accent-orange)';
        msg.textContent = 'Connecting to ' + code.toUpperCase() + '...';
      }
      if (window.Network) window.Network.joinRoom(code, name);
    } else {
      const msg = document.getElementById('join-status-msg');
      if (msg) msg.textContent = 'Enter the 4-letter room code';
    }
  });

  const copyBtn = document.getElementById('btn-copy-room-code');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      playSelectSound();
      const codeEl = document.getElementById('host-room-code');
      const code = codeEl ? codeEl.textContent : '';
      if (!code || code === '----') return;
      try {
        await navigator.clipboard.writeText(code);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy Code'; }, 1200);
      } catch (_) {
        prompt('Copy this room code:', code);
      }
    });
  }

  const hostNameInput = document.getElementById('host-player-name');
  if (hostNameInput) {
    hostNameInput.addEventListener('change', () => {
      if (isOnlineHost() && window.Network) {
        window.Network.setDisplayName(hostNameInput.value.trim() || 'Host');
      }
    });
  }

  // Node Count Buttons (3-node button is optional — old HTML without it still works)
  bindClick(btnNodes3, () => {
    playSelectSound();
    gameConfig.nodeCount = 3;
    setActiveNodeCountBtn(btnNodes3);
    renderNodeConfigList();
  });

  bindClick(btnNodes4, () => {
    playSelectSound();
    gameConfig.nodeCount = 4;
    setActiveNodeCountBtn(btnNodes4);
    renderNodeConfigList();
  });

  bindClick(btnNodes5, () => {
    playSelectSound();
    gameConfig.nodeCount = 5;
    setActiveNodeCountBtn(btnNodes5);
    renderNodeConfigList();
  });

  // Highlight default node count on load
  const defaultNodeBtn = gameConfig.nodeCount === 3 ? btnNodes3
    : gameConfig.nodeCount === 4 ? btnNodes4 : btnNodes5;
  if (defaultNodeBtn) setActiveNodeCountBtn(defaultNodeBtn);

  // Rule Cards Click Toggles
  Object.keys(ruleCards).forEach(ruleNum => {
    const card = ruleCards[ruleNum];
    if (!card) return;
    card.addEventListener('click', () => {
      playSelectSound();
      gameConfig.rules[`rule${ruleNum}`] = !gameConfig.rules[`rule${ruleNum}`];
      syncRuleCardsUI();
    });
  });

  bindClick(btnAckRuleNotice, acknowledgeRuleNotice);

  // Start Game Button
  bindClick(btnStartGame, startGame);

  // Turn Screen Actions
  bindClick(btnAccessConfirm, () => {
    playSelectSound();
    btnAccessConfirm.style.display = 'none';
    turnPrompt.style.display = 'none';
    turnInputControls.style.display = 'block';
  });

  if (nodeInputSlider) {
    nodeInputSlider.addEventListener('input', (e) => {
      sliderValDisplay.textContent = e.target.value;
    });
  }

  bindClick(btnLockInput, handleLockInput);

  // Arena Screen Actions
  bindClick(btnArenaAction, handleArenaAction);
  bindClick(btnAbortGame, abortGame);

  const btnToggleLogs = document.getElementById('btn-toggle-logs');
  if (btnToggleLogs) {
    btnToggleLogs.addEventListener('click', () => {
      const card = btnToggleLogs.closest('.logs-card');
      if (!card) return;
      const open = card.classList.toggle('logs-open');
      btnToggleLogs.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Victory Screen Actions
  bindClick(document.getElementById('btn-restart-game'), () => {
    playSelectSound();
    gameState.phase = 'setup';
    gameState.ruleNoticeQueue = [];
    hideRuleNoticeModal();
    document.body.classList.remove('nodes-3', 'nodes-4', 'nodes-5');
    switchScreen('setup');
  });

  // Audio Toggle Button
  bindClick(audioToggleBtn, () => {
    audioMuted = !audioMuted;
    if (audioMuted) {
      audioToggleBtn.classList.add('muted');
      audioToggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="audio-icon-off"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v6a3 3 0 0 0 5.12 2.12M18.36 5.64A9 9 0 0 1 20.1 15"></path><path d="M11 5L6 9H2v6h4l5 4V5z"></path></svg>
      `;
      if (window.quantumAudio) window.quantumAudio.stopTensionMusic();
    } else {
      audioToggleBtn.classList.remove('muted');
      audioToggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="audio-icon-on"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
      `;
      if (canPlayAudio()) {
        window.quantumAudio.init();
        window.quantumAudio.playSelect();
        if (gameState.phase !== 'setup' && gameState.phase !== 'game_over') {
          startGameMusic();
        }
      }
    }
  });

  // Protocols Modal Events
  bindClick(btnProtocols, () => {
    playSelectSound();
    if (protocolsModal) protocolsModal.style.display = 'flex';
  });

  bindClick(btnCloseProtocols, () => {
    playSelectSound();
    if (protocolsModal) protocolsModal.style.display = 'none';
  });
}

// Sound Helpers — only host / local devices output sound
function playSelectSound() {
  if (canPlayAudio()) window.quantumAudio.playSelect();
}

function playWarningSound() {
  if (canPlayAudio()) window.quantumAudio.playWarning();
}

function playClankSound() {
  if (canPlayAudio()) window.quantumAudio.playClank();
}

function playSizzleSound() {
  if (canPlayAudio()) window.quantumAudio.playSizzle();
}

function playTickSound() {
  if (canPlayAudio()) window.quantumAudio.playTick();
}

function playMeltdownSound() {
  if (canPlayAudio()) window.quantumAudio.playMeltdown();
}

function playHeartbeatSound() {
  if (canPlayAudio()) window.quantumAudio.playHeartbeat();
}

function playFinalRoundStinger() {
  if (canPlayAudio()) window.quantumAudio.playFinalRoundStinger();
}

function vibrate(pattern) {
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (_) {}
  }
}

// Calculate and update tension music intensity based on game state
function updateTensionIntensity() {
  if (!canPlayAudio()) return;
  
  const alivePlayers = gameConfig.players.filter(p => p.isAlive);
  if (alivePlayers.length === 0) return;

  // Worst (lowest) stability among alive players drives intensity
  const worstStability = Math.min(...alivePlayers.map(p => p.stability));
  // Map stability range [0, -10] to intensity [0.1, 1.0]
  const intensity = 0.1 + (Math.abs(worstStability) / 10) * 0.9;

  // Also factor in how few players remain (fewer = more tense)
  const eliminationBonus = (gameConfig.nodeCount - alivePlayers.length) * 0.08;

  const finalIntensity = Math.min(1.0, intensity + eliminationBonus);
  window.quantumAudio.setTensionIntensity(finalIntensity);
  currentTensionValue = finalIntensity;

  // Drive the screen vignette pulse off the same value (see style.css)
  document.documentElement.style.setProperty('--tension', finalIntensity.toFixed(3));

  // Heartbeat thump when any node is critically low — throttled so it isn't spammy
  if (worstStability <= -6 && worstStability > -10) {
    const now = Date.now();
    if (now - lastHeartbeatAt > 1400) {
      lastHeartbeatAt = now;
      playHeartbeatSound();
    }
  }

  // One-time stinger + haptic the moment the match narrows to its final 2 nodes
  if (alivePlayers.length === 2 && !finalRoundStingerPlayed) {
    finalRoundStingerPlayed = true;
    playFinalRoundStinger();
    vibrate([80, 40, 80]);
  }
}

function startGameMusic() {
  if (!canPlayAudio()) return;
  window.quantumAudio.init();
  if (window.quantumAudio.ctx && window.quantumAudio.ctx.state === 'suspended') {
    window.quantumAudio.ctx.resume();
  }
  window.quantumAudio.startTensionMusic();
  updateTensionIntensity();
}

function stopGameMusic() {
  if (window.quantumAudio) {
    try { window.quantumAudio.stopTensionMusic(); } catch (_) {}
  }
}

// Screen Routing (does not mutate gameState.phase — UI screens ≠ game phases)
function switchScreen(screenKey) {
  Object.keys(screens).forEach(key => {
    screens[key].style.display = 'none';
    screens[key].classList.remove('active');
  });
  screens[screenKey].style.display = 'flex';
  screens[screenKey].classList.add('active');

  document.body.classList.toggle('arena-active', screenKey === 'arena');
  document.body.classList.toggle('setup-active', screenKey === 'setup');
  document.body.classList.toggle('victory-active', screenKey === 'victory');
}

// Render scale ticks
function renderScaleTicks() {
  scaleTicks.innerHTML = '';
  for (let i = 0; i <= 100; i += 5) {
    const tick = document.createElement('div');
    tick.className = 'scale-tick-mark';
    tick.setAttribute('data-val', i);
    scaleTicks.appendChild(tick);
  }
}

// Render Setup Player inputs dynamically
function renderNodeConfigList() {
  if (!nodeConfigList) return;
  nodeConfigList.innerHTML = '';
  for (let i = 0; i < gameConfig.nodeCount; i++) {
    const row = document.createElement('div');
    row.className = 'node-config-row';
    row.innerHTML = `
      <span class="node-label">Node ${i + 1}</span>
      <div>
        <input type="text" id="node-name-${i}" value="${defaultNames[i]}" placeholder="Node Name">
      </div>
      <div>
        <select id="node-type-${i}" onchange="togglePersonalityDropdown(${i})">
          <option value="human" ${i === 0 ? 'selected' : ''}>Human Admin</option>
          <option value="ai" ${i !== 0 ? 'selected' : ''}>AI Core</option>
        </select>
      </div>
      <div>
        <select id="node-ai-personality-${i}" ${i === 0 ? 'disabled style="opacity: 0.3;"' : ''}>
          <option value="rationalist" ${i === 1 ? 'selected' : ''}>The Rationalist</option>
          <option value="analyst" ${i === 2 ? 'selected' : ''}>The Analyst</option>
          <option value="maverick" ${i === 3 ? 'selected' : ''}>The Maverick</option>
          <option value="defender" ${i === 4 ? 'selected' : ''}>The Defender</option>
        </select>
      </div>
    `;
    nodeConfigList.appendChild(row);
  }
}

// Global scope bindings for dynamic selects
window.togglePersonalityDropdown = function(index) {
  const typeSelect = document.getElementById(`node-type-${index}`);
  const personalitySelect = document.getElementById(`node-ai-personality-${index}`);
  if (typeSelect.value === 'human') {
    personalitySelect.disabled = true;
    personalitySelect.style.opacity = '0.3';
  } else {
    personalitySelect.disabled = false;
    personalitySelect.style.opacity = '1';
  }
};

// Start Game and Initialize Player state
function startGame() {
  playSelectSound();
  gameConfig.players = [];
  
  for (let i = 0; i < gameConfig.nodeCount; i++) {
    const nameVal = document.getElementById(`node-name-${i}`).value.trim() || `Node ${i + 1}`;
    const typeVal = document.getElementById(`node-type-${i}`).value;
    const personalityVal = document.getElementById(`node-ai-personality-${i}`).value;
    
    gameConfig.players.push({
      id: i + 1,
      name: nameVal,
      type: typeVal,
      personality: typeVal === 'ai' ? personalityVal : 'none',
      stability: 0,
      isAlive: true,
      lastChoice: null,
      isDisqualified: false,
      isWinner: false
    });
  }

  // Reset State
  gameState.currentRound = 1;
  gameState.history = [];
  gameState.ruleNoticeQueue = [];
  finalRoundStingerPlayed = false;

  gameConfig.rulesAtStart = {
    rule1: gameConfig.rules.rule1,
    rule2: gameConfig.rules.rule2,
    rule3: gameConfig.rules.rule3
  };
  
  // Render Arena UI baseline
  renderActiveRulesTags();
  renderArenaNodeCards();
  resetScalePlot();
  renderLogs();
  
  roundNumberLcd.textContent = `Round ${gameState.currentRound}`;
  arenaInstructions.textContent = "Sequence initiated. Click 'Begin Inputs' to start player choices.";
  btnArenaAction.textContent = "Begin Inputs";
  btnArenaAction.style.display = 'block';

  lcdAverage.textContent = '--.--';
  lcdTarget.textContent = '--.--';

  gameState.phase = 'arena';
  lastSyncedPhase = null;
  switchScreen('arena');
  btnArenaAction.style.display = 'block';
  btnAbortGame.style.display = 'block';

  document.body.classList.remove('nodes-3', 'nodes-4', 'nodes-5');
  document.body.classList.add(`nodes-${gameConfig.nodeCount}`);
  
  if (isOnlineHost()) {
    // Auto-seat: Host + connected friends as humans; leftover seats become AI
    const lobby = window.Network.getLobby();
    const hostName = document.getElementById('host-player-name').value.trim()
      || window.Network.getDisplayName()
      || 'Host';
    const remotes = lobby.filter(p => !p.isHost);
    peerToPlayerMap = {};
    myPlayerId = gameConfig.players[0].id;

    gameConfig.players[0].type = 'human';
    gameConfig.players[0].personality = 'none';
    gameConfig.players[0].name = hostName;

    let remoteIndex = 0;
    for (let i = 1; i < gameConfig.players.length; i++) {
      if (remoteIndex < remotes.length) {
        const remote = remotes[remoteIndex++];
        gameConfig.players[i].type = 'human';
        gameConfig.players[i].personality = 'none';
        gameConfig.players[i].name = remote.name || (`Remote ${remoteIndex}`);
        peerToPlayerMap[remote.peerId] = gameConfig.players[i].id;
      } else {
        // Fill with AI — keep configured personality when possible
        const personalitySelect = document.getElementById(`node-ai-personality-${i}`);
        const nameInput = document.getElementById(`node-name-${i}`);
        gameConfig.players[i].type = 'ai';
        gameConfig.players[i].personality = (personalitySelect && personalitySelect.value) || aiPersonalities[(i - 1) % aiPersonalities.length];
        gameConfig.players[i].name = (nameInput && nameInput.value.trim()) || defaultNames[i] || (`AI Core ${i + 1}`);
      }
    }

    // Extra friends beyond seat count spectate (no mapping)
    renderArenaNodeCards();
    window.Network.broadcastState({ gameConfig, gameState, peerToPlayerMap });
  } else if (!isOnlineClient()) {
    myPlayerId = gameConfig.players[0].id;
  }

  // Start tension music (host / local only)
  startGameMusic();
}

// Abort Game
function abortGame() {
  playSelectSound();
  if (isOnlineClient()) return; // Host controls abort
  if (confirm("Are you sure you want to abort the current simulation sequence?")) {
    stopGameMusic();
    if (isOnlineHost() && window.Network.broadcastAbort) {
      window.Network.broadcastAbort();
    }
    gameState.phase = 'setup';
    gameState.ruleNoticeQueue = [];
    hideRuleNoticeModal();
    document.body.classList.remove('nodes-3', 'nodes-4', 'nodes-5');
    switchScreen('setup');
  }
}

// Render active rules tags in sidebar
function syncRuleCardsUI() {
  Object.keys(ruleCards).forEach(ruleNum => {
    const card = ruleCards[ruleNum];
    if (!card) return;
    if (gameConfig.rules[`rule${ruleNum}`]) {
      card.classList.add('enabled');
    } else {
      card.classList.remove('enabled');
    }
  });
}

function getNextUnmarkedEliminationRule() {
  for (const ruleNum of [1, 2, 3]) {
    const key = `rule${ruleNum}`;
    if (!gameConfig.rulesAtStart[key] && !gameConfig.rules[key]) {
      return ruleNum;
    }
  }
  return null;
}

function addEliminationRules(eliminationCount) {
  const added = [];
  for (let i = 0; i < eliminationCount; i++) {
    const ruleNum = getNextUnmarkedEliminationRule();
    if (!ruleNum) break;
    gameConfig.rules[`rule${ruleNum}`] = true;
    added.push(ruleNum);
  }
  if (added.length > 0) {
    renderActiveRulesTags();
    syncRuleCardsUI();
  }
  return added;
}

function showRuleNotice(ruleNum, options = {}) {
  const def = RULE_DEFINITIONS[ruleNum];
  if (!def || !ruleNoticeModal) return;

  if (ruleNoticeTitle) ruleNoticeTitle.textContent = def.name;
  if (ruleNoticeDesc) ruleNoticeDesc.textContent = def.desc;
  if (ruleNoticeContext) {
    ruleNoticeContext.textContent = `A node was eliminated. This protocol was not selected at start and is now active. ${def.trigger}`;
  }

  ruleNoticeModal.style.display = 'flex';
  if (btnAckRuleNotice) {
    btnAckRuleNotice.style.display = isOnlineClient() ? 'none' : 'block';
  }

  if (options.announce) {
    playWarningSound();
    vibrate([60, 40, 80]);
  }
}

function hideRuleNoticeModal() {
  if (ruleNoticeModal) ruleNoticeModal.style.display = 'none';
}

function acknowledgeRuleNotice() {
  if (isOnlineClient()) return;
  playSelectSound();

  if (!gameState.ruleNoticeQueue || gameState.ruleNoticeQueue.length === 0) {
    hideRuleNoticeModal();
    return;
  }

  gameState.ruleNoticeQueue.shift();

  if (gameState.ruleNoticeQueue.length > 0) {
    showRuleNotice(gameState.ruleNoticeQueue[0], { announce: true });
  } else {
    hideRuleNoticeModal();
    finishMeltdownAndAdvanceRound();
  }

  if (isOnlineHost()) {
    window.Network.broadcastState({ gameConfig, gameState, peerToPlayerMap });
  }
}

function renderActiveRulesTags() {
  activeRulesTags.innerHTML = '';
  if (gameConfig.rules.rule1) {
    activeRulesTags.innerHTML += `<span class="rule-tag">${RULE_DEFINITIONS[1].shortTag}</span>`;
  }
  if (gameConfig.rules.rule2) {
    activeRulesTags.innerHTML += `<span class="rule-tag">${RULE_DEFINITIONS[2].shortTag}</span>`;
  }
  if (gameConfig.rules.rule3) {
    activeRulesTags.innerHTML += `<span class="rule-tag">${RULE_DEFINITIONS[3].shortTag}</span>`;
  }
  if (activeRulesTags.innerHTML === '') {
    activeRulesTags.innerHTML = `<span class="rule-tag" style="background: rgba(255,255,255,0.03); color: var(--text-secondary); border-color: rgba(255,255,255,0.05)">No Active Overrides</span>`;
  }
}

// Render static layout of player cards inside Arena
function renderArenaNodeCards() {
  nodesContainer.innerHTML = '';
  gameConfig.players.forEach(player => {
    const card = document.createElement('div');
    card.id = `player-card-${player.id}`;
    card.className = `node-card glass-panel ${player.isAlive ? '' : 'eliminated'}`;
    
    // Determine subtitle based on type/personality
    let roleText = 'Human Admin';
    if (player.type === 'ai') {
      const pNames = {
        rationalist: 'AI: Rationalist',
        analyst: 'AI: Analyst',
        maverick: 'AI: Maverick',
        defender: 'AI: Defender'
      };
      roleText = pNames[player.personality] || 'AI Core';
    }

    card.innerHTML = `
      <div class="node-header">
        <div class="node-name">${player.name}</div>
        <div class="node-role">${roleText}</div>
      </div>
      
      <div class="node-value-badge" id="node-val-${player.id}">
        ${player.isAlive ? 'WAITING' : 'OFFLINE'}
      </div>

      <div class="plasma-tube-wrapper">
        <div class="plasma-tube-cap-top"></div>
        <div class="plasma-tube-cylinder">
          <div class="plasma-fluid" id="plasma-fluid-${player.id}"></div>
        </div>
        <div class="plasma-tube-cap-bottom"></div>
        
        <!-- Meltdown overlay -->
        <div class="meltdown-overlay" id="meltdown-overlay-${player.id}" style="display: none;">
          <div class="meltdown-text">Meltdown</div>
          <div class="meltdown-subtext">Core offline</div>
        </div>
      </div>

      <div>
        <span style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Stability: </span>
        <span class="stability-score green" id="stability-score-${player.id}">${player.stability}/-10</span>
      </div>
    `;
    
    nodesContainer.appendChild(card);
    
    // Update liquid level initially
    updatePlayerLiquidUI(player.id);
  });
}

// Update liquid levels and animations for a single player core
function updatePlayerLiquidUI(playerId) {
  const player = gameConfig.players.find(p => p.id === playerId);
  const fluid = document.getElementById(`plasma-fluid-${playerId}`);
  const card = document.getElementById(`player-card-${playerId}`);
  const scoreText = document.getElementById(`stability-score-${playerId}`);
  
  if (!player || !fluid) return;

  // Percentage fill calculation: (stability / -10) * 100
  // starts at 0% when stability is 0, reaches 100% when stability is -10
  const percentage = Math.max(0, Math.min(100, (player.stability / -10) * 100));
  fluid.style.height = `${percentage}%`;
  fluid.style.setProperty('--fill', `${percentage}%`);

  // Color profiles
  card.classList.remove('danger', 'melted');
  scoreText.className = 'stability-score';
  
  if (player.stability <= -7) {
    card.classList.add('danger');
    scoreText.classList.add('red');
  } else if (player.stability <= -4) {
    scoreText.classList.add('orange');
  } else {
    scoreText.classList.add('green');
  }

  scoreText.textContent = `${player.stability}/-10`;

  // Bubbles population based on stability level (more danger = more bubbles!)
  const bubbleCount = Math.floor(percentage / 10) + 1;
  
  // Clear old bubbles
  const existingBubbles = fluid.querySelectorAll('.plasma-bubble');
  existingBubbles.forEach(b => b.remove());

  if (player.isAlive) {
    for (let i = 0; i < bubbleCount; i++) {
      const bubble = document.createElement('div');
      bubble.className = 'plasma-bubble';
      
      const size = Math.random() * 6 + 3;
      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${Math.random() * 80 + 10}%`;
      bubble.style.animationDelay = `${Math.random() * 1.5}s`;
      const bubbleSpeedFactor = Math.max(0.35, 1 - currentTensionValue * 0.6);
      bubble.style.animationDuration = `${(1.2 + Math.random() * 1) * bubbleSpeedFactor}s`;
      
      fluid.appendChild(bubble);
    }
  } else {
    // Show meltdown overlay
    const overlay = document.getElementById(`meltdown-overlay-${playerId}`);
    if (overlay) overlay.style.display = 'flex';
    card.classList.add('melted');
  }
}

// Reset Scale plotting
function resetScalePlot() {
  scalePlots.innerHTML = '';
}

// Handle control button clicks in the Sidebar
function handleArenaAction() {
  if (isOnlineClient()) return; // Only the host advances phases online
  playSelectSound();
  
  if (gameState.phase === 'arena' && (btnArenaAction.textContent === "Begin Inputs" || btnArenaAction.textContent.includes('Begin'))) {
    gameState.phase = 'input';
    gatherNextInput();
  } else if (gameState.phase === 'reveal') {
    evaluateRound();
  } else if (gameState.phase === 'meltdown_check') {
    prepareNextRoundOrFinish();
  }
}

// Cycle through human inputs and AI choices
function gatherNextInput() {
  if (isOnlineHost()) {
    // Multiplayer Simultaneous Turn
    const hostPlayer = gameConfig.players.find(p => p.id === myPlayerId);
    
    if (hostPlayer && hostPlayer.isAlive && hostPlayer.lastChoice === null) {
      openTurnInputFor(hostPlayer.name);
    } else {
      arenaInstructions.textContent = "Waiting for network nodes to lock inputs...";
      btnArenaAction.style.display = 'none';
      switchScreen('arena');
    }
    
    window.Network.broadcastState({ gameConfig, gameState, peerToPlayerMap });
    checkAllInputsReceived();
    
  } else if (isOnlineClient()) {
    return;
  } else {
    // Local Hotseat Sequential Turn
    const nextHumanIndex = gameConfig.players.findIndex((p, idx) => 
      p.isAlive && p.type === 'human' && p.lastChoice === null && idx > gameState.activeHumanIndex
    );

    if (nextHumanIndex !== -1) {
      gameState.activeHumanIndex = nextHumanIndex;
      const player = gameConfig.players[nextHumanIndex];
      openTurnInputFor(player.name);
    } else {
      checkAllInputsReceived();
    }
  }
}

function checkAllInputsReceived() {
  if (isOnlineClient()) return; // Only host evaluates
  
  const allHumansInputted = gameConfig.players.every(p => 
    !p.isAlive || p.type !== 'human' || p.lastChoice !== null
  );
  
  if (allHumansInputted) {
    computeAIChoices();
    gameState.phase = 'reveal';
    switchScreen('arena');
    arenaInstructions.textContent = "All Node values locked. Ready to execute dynamic calculation scale.";
    btnArenaAction.textContent = "Execute Evaluation";
    btnArenaAction.style.display = 'block';
    
    // Update player cards status to "LOCKED"
    gameConfig.players.forEach(p => {
      if (p.isAlive) {
        const badge = document.getElementById(`node-val-${p.id}`);
        if (badge) {
          badge.textContent = 'LOCKED';
          badge.className = 'node-value-badge locked';
        }
      }
    });
    
    if (isOnlineHost()) {
       window.Network.broadcastState({ gameConfig, gameState, peerToPlayerMap });
    }
  }
}

// Handle locking human input
function handleLockInput() {
  const choice = parseInt(nodeInputSlider.value, 10);
  playSelectSound();
  unlockAudio();
  
  if (isOnlineClient()) {
    window.Network.sendInputToHost(choice);
    
    const me = gameConfig.players.find(p => p.id === myPlayerId);
    if (me) me.lastChoice = choice;
    
    lastSyncedPhase = 'input-wait';
    switchScreen('arena');
    arenaInstructions.textContent = "Input locked. Waiting for other nodes...";
    const badge = document.getElementById(`node-val-${myPlayerId}`);
    if (badge) {
      badge.textContent = 'LOCKED';
      badge.className = 'node-value-badge locked';
    }
    
  } else if (isOnlineHost()) {
    const me = gameConfig.players.find(p => p.id === myPlayerId);
    if (me) me.lastChoice = choice;
    
    switchScreen('arena');
    arenaInstructions.textContent = "Input locked. Waiting for network nodes...";
    const badge = document.getElementById(`node-val-${myPlayerId}`);
    if (badge) {
      badge.textContent = 'LOCKED';
      badge.className = 'node-value-badge locked';
    }
    window.Network.broadcastState({ gameConfig, gameState, peerToPlayerMap });
    checkAllInputsReceived();
  } else {
    // Local hotseat
    const player = gameConfig.players[gameState.activeHumanIndex];
    player.lastChoice = choice;
    
    switchScreen('arena');
    gatherNextInput();
  }
}

// AI Decision-Making Algorithms (Game Theory)
function computeAIChoices() {
  const activePlayers = gameConfig.players.filter(p => p.isAlive);
  const numActive = activePlayers.length;
  
  // Get history logs for modeling
  const roundsPlayed = gameState.history.length;
  let lastTarget = 30; // Default estimate
  if (roundsPlayed > 0) {
    lastTarget = gameState.history[roundsPlayed - 1].target;
  }

  gameConfig.players.forEach(p => {
    if (!p.isAlive || p.type === 'human') return;

    let choice = 50;

    switch (p.personality) {
      case 'rationalist': // Nash Solver
        if (gameState.currentRound === 1) {
          choice = Math.floor(22 + Math.random() * 10); // Starts low
        } else {
          // Plays below the previous target as players adapt down
          choice = Math.floor(lastTarget * (0.7 + Math.random() * 0.15));
        }

        // Special 1v1 rule 3 override capability
        if (numActive === 2 && gameConfig.rules.rule3) {
          const opponent = activePlayers.find(op => op.id !== p.id);
          // Guessing if opponent plays 0 based on history
          let oppChoseZero = false;
          if (roundsPlayed > 0) {
            const oppLastChoice = gameState.history[roundsPlayed - 1].choices[opponent.name];
            oppChoseZero = (oppLastChoice === 0 || oppLastChoice === 1);
          }

          if (oppChoseZero && Math.random() < 0.3) {
            choice = 100; // Counter-trap!
          } else {
            choice = Math.floor(Math.random() * 3); // Plays extremely low (0, 1, or 2)
          }
        }
        break;

      case 'analyst': // Historical Modeler
        if (roundsPlayed === 0) {
          choice = Math.floor(35 + Math.random() * 15);
        } else {
          // Model other players' average choice in last 2 rounds
          let otherSum = 0;
          let otherCount = 0;
          const otherActive = activePlayers.filter(op => op.id !== p.id);

          otherActive.forEach(op => {
            let opSum = 0;
            let opCount = 0;
            // Scan last 2 rounds
            const lookback = Math.min(2, roundsPlayed);
            for (let r = 0; r < lookback; r++) {
              const hist = gameState.history[roundsPlayed - 1 - r];
              const val = hist.choices[op.name];
              if (val !== null && val !== undefined && !hist.disqualifiedIds.includes(op.id)) {
                opSum += val;
                opCount++;
              }
            }
            if (opCount > 0) {
              otherSum += (opSum / opCount);
              otherCount++;
            } else {
              otherSum += 35; // Default guess
              otherCount++;
            }
          });

          const predictedOtherAvg = otherCount > 0 ? (otherSum / otherCount) : 40;
          
          // Solve algebraic equation for myChoice to hit target:
          // target = ((OtherSum_of_averages + MyChoice) / numActive) * 0.8
          // We want MyChoice = target
          // MyChoice = ((predictedOtherAvg * (numActive - 1) + MyChoice) / numActive) * 0.8
          // Solving: MyChoice = (predictedOtherAvg * (numActive - 1) * 0.8) / (numActive - 0.8)
          const otherSumAverages = predictedOtherAvg * (numActive - 1);
          const computedChoice = (otherSumAverages * 0.8) / (numActive - 0.8);
          choice = Math.floor(computedChoice);
        }
        break;

      case 'maverick': // Aggressive Variant
        // If high stability, disrupt others by pulling the average up
        if (p.stability > -5) {
          choice = Math.floor(60 + Math.random() * 30);
        } else {
          // Plays defensively when threatened
          choice = Math.floor(2 + Math.random() * 18);
        }
        
        // Minor pure randomization factor
        if (Math.random() < 0.15) {
          choice = Math.floor(Math.random() * 100);
        }
        break;

      case 'defender': // Conservative Target Tracker
        if (gameState.currentRound === 1) {
          choice = 35;
        } else {
          // Track target and adjust down slightly
          choice = Math.max(0, Math.floor(lastTarget * 0.9));
        }
        break;
        
      default:
        choice = Math.floor(Math.random() * 101);
    }

    // Clamp values safely
    p.lastChoice = Math.max(0, Math.min(100, choice));
  });
}

// Main evaluation logic
function evaluateRound() {
  if (gameState.phase !== 'reveal') return;
  const activePlayers = gameConfig.players.filter(p => p.isAlive);
  const numActive = activePlayers.length;

  let choicesSummary = {};
  let disqualifiedIds = [];
  let validChoices = [];

  // 1. Check for Duplicate choices (Disqualification protocol Rule 1)
  // Triggers only when 4 or fewer active nodes remain in the arena
  const rule1Active = gameConfig.rules.rule1 && (numActive <= 4);

  if (rule1Active) {
    const choiceCounts = {};
    activePlayers.forEach(p => {
      const val = p.lastChoice;
      choiceCounts[val] = (choiceCounts[val] || 0) + 1;
    });

    activePlayers.forEach(p => {
      const val = p.lastChoice;
      if (choiceCounts[val] > 1) {
        disqualifiedIds.push(p.id);
        p.isDisqualified = true;
      } else {
        p.isDisqualified = false;
        validChoices.push({ id: p.id, choice: val });
      }
    });
  } else {
    activePlayers.forEach(p => {
      p.isDisqualified = false;
      validChoices.push({ id: p.id, choice: p.lastChoice });
    });
  }

  // 2. Calculations
  let average = 0;
  let target = 0;
  let winnerId = null;
  let exactMatchHit = false;

  // Populate choices summary for log
  gameConfig.players.forEach(p => {
    choicesSummary[p.name] = p.isAlive ? p.lastChoice : null;
  });

  if (validChoices.length > 0) {
    const sum = validChoices.reduce((acc, curr) => acc + curr.choice, 0);
    average = sum / validChoices.length;
    target = average * 0.8;
  } else {
    // If everyone is disqualified, average and target are 0
    average = 0;
    target = 0;
  }

  // 3. Determine winner
  // Rule 3 check: 0 vs 100 Counter (triggers only when exactly 2 active nodes remain)
  const rule3Active = gameConfig.rules.rule3 && (numActive === 2);
  let rule3Triggered = false;

  if (rule3Active && validChoices.length === 2) {
    const p1 = validChoices[0];
    const p2 = validChoices[1];
    
    if ((p1.choice === 0 && p2.choice === 100) || (p1.choice === 100 && p2.choice === 0)) {
      winnerId = p1.choice === 100 ? p1.id : p2.id;
      rule3Triggered = true;
    }
  }

  // Standard closest calculation if Rule 3 didn't override
  if (winnerId === null && validChoices.length > 0) {
    let minDiff = Infinity;
    
    validChoices.forEach(item => {
      const diff = Math.abs(item.choice - target);
      if (diff < minDiff) {
        minDiff = diff;
        winnerId = item.id;
      } else if (diff === minDiff) {
        // Tie breaker: multiple winners? In the series, if multiple players are equally close, 
        // they all win. Let's support tie-winners by using an array, but we can assign winnerId to one 
        // and adjust scoring rules. Let's make it so all closest players get 0 penalty.
      }
    });

    // Find all players who are tied for closest
    const winners = validChoices.filter(item => Math.abs(item.choice - target) === minDiff).map(item => item.id);
    
    // In our simplified state, we pick the first winner for the main UI but apply score adjustments to all
    winnerId = winners[0];
  }

  // Check if winner got the exact target value (Precision Spike Rule 2)
  // Triggers only when 3 or fewer active nodes remain
  const rule2Active = gameConfig.rules.rule2 && (numActive <= 3);
  if (rule2Active && winnerId !== null) {
    const winnerChoice = gameConfig.players.find(p => p.id === winnerId).lastChoice;
    // float precision match check
    if (Math.abs(winnerChoice - target) < 0.0001) {
      exactMatchHit = true;
    }
  }

  // 4. Update Stability Scores
  let stabilityUpdates = {};
  let someoneSizzled = false;

  gameConfig.players.forEach(p => {
    if (!p.isAlive) {
      stabilityUpdates[p.name] = 0;
      return;
    }

    let penalty = 0;

    if (p.isDisqualified) {
      // Disqualification penalty
      penalty = -1;
    } else if (p.id === winnerId) {
      // Winner gets 0 penalty
      penalty = 0;
    } else {
      // Loser penalty
      if (exactMatchHit) {
        // Precision match doubles penalty
        penalty = -2;
      } else {
        penalty = -1;
      }
    }

    p.stability += penalty;
    // Lock minimum score to -10
    if (p.stability < -10) p.stability = -10;

    stabilityUpdates[p.name] = penalty;

    if (penalty < 0) {
      someoneSizzled = true;
    }
  });

  // Save Round History
  const roundRecord = {
    round: gameState.currentRound,
    choices: choicesSummary,
    average: average,
    target: target,
    winnerId: winnerId,
    disqualifiedIds: disqualifiedIds,
    stabilityUpdates: stabilityUpdates,
    exactMatchHit: exactMatchHit,
    rule3Triggered: rule3Triggered
  };
  gameState.history.push(roundRecord);

  // 5. Sound effects and animations
  playClankSound();
  if (someoneSizzled) {
    setTimeout(playSizzleSound, 600);
  }

  // 6. UI Updates (Visual reveal phase)
  lcdAverage.textContent = average.toFixed(2);
  lcdTarget.textContent = target.toFixed(2);

  // Reveal player choices with a staggered scramble effect for tension
  revealPlayerChoicesStaggered(winnerId);
  gameConfig.players.forEach(p => {
    if (!p.isAlive) return;
    // Stability/liquid updates instantly; the number badge reveal is staggered above
    updatePlayerLiquidUI(p.id);
  });

  // Plot results on Scale UI
  plotScaleResults(validChoices, target, disqualifiedIds);

  // Render logs panel
  renderLogs();

  // Update tension intensity based on game state
  updateTensionIntensity();

  // Set Arena Instructions based on results
  let resultText = `Target is ${target.toFixed(2)}. `;
  if (rule3Triggered) {
    const winnerName = gameConfig.players.find(p => p.id === winnerId).name;
    resultText += `Quantum Override triggered! ${winnerName} (100) overrides (0) and wins! `;
  } else if (winnerId !== null) {
    const winnerName = gameConfig.players.find(p => p.id === winnerId).name;
    const winnerChoice = gameConfig.players.find(p => p.id === winnerId).lastChoice;
    resultText += `${winnerName} wins with ${winnerChoice}. `;
  }

  if (exactMatchHit) {
    resultText += `Precision Spike Hit! Other nodes suffer double stability drain.`;
    screens.arena.classList.add('glitch-effect');
    vibrate([40, 30, 40, 30, 90]);
    setTimeout(() => screens.arena.classList.remove('glitch-effect'), 400);
  }

  arenaInstructions.textContent = resultText;
  
  // Transition Phase to meltdown checks
  gameState.phase = 'meltdown_check';
  btnArenaAction.textContent = "Process Core Meltdowns";
  btnArenaAction.style.display = 'block';
  
  if (isOnlineHost()) {
    window.Network.broadcastState({ gameConfig, gameState, peerToPlayerMap });
  }
}

// Plot numbers on the visual slider scale
function plotScaleResults(validChoices, target, disqualifiedIds) {
  resetScalePlot();

  // Plot Player Nodes
  gameConfig.players.forEach(p => {
    if (!p.isAlive) return;
    
    const plot = document.createElement('div');
    plot.className = `scale-plot-node`;
    plot.style.left = `${p.lastChoice}%`;
    
    let labelText = `${p.name}: ${p.lastChoice}`;
    if (p.isDisqualified) {
      labelText += ' (DQ)';
      plot.style.opacity = '0.4';
    }
    
    plot.innerHTML = `
      <div class="scale-plot-label">${labelText}</div>
      <div class="scale-plot-dot" style="background-color: ${p.isDisqualified ? 'var(--accent-orange)' : 'var(--accent-cyan)'}; box-shadow: 0 0 10px ${p.isDisqualified ? 'var(--accent-orange)' : 'var(--accent-cyan)'}"></div>
    `;
    scalePlots.appendChild(plot);
  });

  // Plot Target
  const targetPlot = document.createElement('div');
  targetPlot.className = 'scale-plot-node target';
  targetPlot.style.left = `${target}%`;
  targetPlot.innerHTML = `
    <div class="scale-plot-label orange-glow">Target: ${target.toFixed(2)}</div>
    <div class="scale-plot-dot"></div>
  `;
  scalePlots.appendChild(targetPlot);
}

// Reveal player choice badges one at a time with a slot-machine scramble.
// Non-winners flip first, in order; the winner flips last for suspense.
function revealPlayerChoicesStaggered(winnerId) {
  const alive = gameConfig.players.filter(p => p.isAlive);
  const nonWinners = alive.filter(p => p.id !== winnerId);
  const winner = alive.find(p => p.id === winnerId);
  const order = winner ? [...nonWinners, winner] : alive;

  order.forEach((p, index) => {
    setTimeout(() => {
      scrambleRevealBadge(p, winnerId);
      playTickSound();
    }, index * 220);
  });
}

function scrambleRevealBadge(p, winnerId) {
  const badge = document.getElementById(`node-val-${p.id}`);
  if (!badge || p.lastChoice === null || p.lastChoice === undefined) return;

  const finalText = p.isDisqualified ? `DQ (${p.lastChoice})` : p.lastChoice.toString();
  const finalClass = p.isDisqualified
    ? 'node-value-badge disqualified'
    : (p.id === winnerId ? 'node-value-badge winner green-glow' : 'node-value-badge revealed');

  let ticks = 0;
  const maxTicks = 6;
  const scrambleInterval = setInterval(() => {
    ticks++;
    if (ticks >= maxTicks) {
      clearInterval(scrambleInterval);
      badge.textContent = finalText;
      badge.className = finalClass;
    } else {
      badge.textContent = Math.floor(Math.random() * 101).toString();
      badge.className = 'node-value-badge locked';
    }
  }, 40);
}

// Meltdown verification phase (deactivating players who hit -10)
function prepareNextRoundOrFinish() {
  if (gameState.phase !== 'meltdown_check') return;
  let meltdownsHappened = false;
  let meltdownCount = 0;

  gameConfig.players.forEach(p => {
    if (p.isAlive && p.stability <= -10) {
      p.isAlive = false;
      p.stability = -10;
      meltdownsHappened = true;
      meltdownCount++;

      // Update UI card to show meltdown
      updatePlayerLiquidUI(p.id);
    }
  });

  if (meltdownsHappened) {
    playMeltdownSound();
    vibrate(meltdownCount > 1 ? [120, 60, 120, 60, 120] : [150]);

    // Shake effect on arena — heavier if multiple nodes melted at once
    const heavy = meltdownCount > 1;
    screens.arena.classList.add('shake-effect');
    if (heavy) screens.arena.classList.add('shake-heavy');
    setTimeout(() => {
      screens.arena.classList.remove('shake-effect', 'shake-heavy');
    }, heavy ? 800 : 500);

    arenaInstructions.textContent = "Critical alert: Core Stability exceeded limits! Triggered coolant overflow purge.";

    const addedRules = addEliminationRules(meltdownCount);
    if (addedRules.length > 0) {
      gameState.ruleNoticeQueue = addedRules;
      gameState.phase = 'rule_notice';
      btnArenaAction.style.display = 'none';
      showRuleNotice(addedRules[0], { announce: true });

      if (isOnlineHost()) {
        window.Network.broadcastState({ gameConfig, gameState, peerToPlayerMap });
      }
      return;
    }
  }

  finishMeltdownAndAdvanceRound();
}

function finishMeltdownAndAdvanceRound() {
  // Count survivors
  const survivors = gameConfig.players.filter(p => p.isAlive);

  if (survivors.length <= 1) {
    // Game is Over!
    setTimeout(() => {
      declareGameOver(survivors);
    }, 1200);
  } else {
    // Proceed to next round setup
    gameState.currentRound++;

    // Reset player turn choices
    gameConfig.players.forEach(p => {
      p.lastChoice = null;
      p.isDisqualified = false;
      p.isWinner = false;
    });

    gameState.activeHumanIndex = -1;
    gameState.phase = 'arena';

    roundNumberLcd.textContent = `Round ${gameState.currentRound}`;
    arenaInstructions.textContent = `Round ${gameState.currentRound} setup complete. Press 'Begin Inputs' to gather values.`;
    btnArenaAction.textContent = "Begin Inputs";
    btnArenaAction.style.display = 'block';

    // Clear plots and LCDs
    resetScalePlot();
    lcdAverage.textContent = '--.--';
    lcdTarget.textContent = '--.--';

    // Reset player value badges
    gameConfig.players.forEach(p => {
      const badge = document.getElementById(`node-val-${p.id}`);
      badge.textContent = p.isAlive ? 'WAITING' : 'OFFLINE';
      badge.className = p.isAlive ? 'node-value-badge' : 'node-value-badge disqualified';
    });

    if (isOnlineHost()) {
      window.Network.broadcastState({ gameConfig, gameState, peerToPlayerMap });
    }
  }
}

// Declares the game over screen
function declareGameOver(survivors) {
  const winner = survivors.length === 1 ? survivors[0] : null;
  const winnerNameElement = document.getElementById('victory-winner-name');
  
  if (winner) {
    winnerNameElement.textContent = winner.name;
    winnerNameElement.className = 'victory-winner-name green-glow';
    document.getElementById('victory-icon-container').innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="green-glow" style="margin: 1rem auto;"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>
    `;
  } else {
    winnerNameElement.textContent = "NO SURVIVORS";
    winnerNameElement.className = 'victory-winner-name red-glow';
    document.getElementById('victory-icon-container').innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="red-glow" style="margin: 1rem auto;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
    `;
  }

  // Stop tension music on game end
  stopGameMusic();

  playWarningSound();
  switchScreen('victory');
  
  gameState.phase = 'game_over';
  if (isOnlineHost()) {
    window.Network.broadcastState({ gameConfig, gameState, peerToPlayerMap });
  }
}

// Render dynamic round history logs in sidebar
function renderLogs() {
  if (gameState.history.length === 0) {
    historyLogs.innerHTML = `
      <div style="color: var(--text-secondary); font-size: 0.85rem; font-style: italic; text-align: center; margin-top: 2rem;">No logs generated.</div>
    `;
    return;
  }

  historyLogs.innerHTML = '';
  // Show newest logs at top
  const reversedHistory = [...gameState.history].reverse();

  reversedHistory.forEach(record => {
    const logItem = document.createElement('div');
    logItem.className = 'log-item';

    // Build choice table content
    let choicesHtml = '';
    gameConfig.players.forEach(p => {
      const pChoice = record.choices[p.name];
      if (pChoice === null) return; // Player was already dead in this round

      const isDq = record.disqualifiedIds.includes(p.id);
      const isWinner = record.winnerId === p.id;
      const penalty = record.stabilityUpdates[p.name];
      
      let valClass = '';
      let valText = pChoice.toString();
      
      if (isDq) {
        valClass = 'dq';
        valText = `DQ (${pChoice})`;
      } else if (isWinner) {
        valClass = 'win';
      }

      choicesHtml += `
        <div class="log-choice-row">
          <span class="log-choice-name">${p.name}</span>
          <span class="log-choice-val ${valClass}">${valText} [${penalty >= 0 ? `+${penalty}` : penalty}]</span>
        </div>
      `;
    });

    logItem.innerHTML = `
      <div class="log-round-hdr">
        <span>Round ${record.round}</span>
        <span style="font-size: 0.75rem;">Target: ${record.target.toFixed(1)}</span>
      </div>
      <div class="log-data-grid">
        <div>Avg: ${record.average.toFixed(1)}</div>
        <div style="text-align: right;">Mult: 0.8</div>
      </div>
      <div>
        ${choicesHtml}
      </div>
    `;

    historyLogs.appendChild(logItem);
  });
}

// Launch application on DOM Load
document.addEventListener('DOMContentLoaded', initApp);