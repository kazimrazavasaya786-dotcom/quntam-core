// script.js - Core Game Engine for Quantum Core Stability Arena

// Global State
let gameConfig = {
  nodeCount: 5,
  players: [],
  rules: {
    rule1: true, // Disqualification on duplicate values
    rule2: true, // Precision Target Spike (exact target match penalty for others)
    rule3: true  // 100 beats 0 in 1v1 shutdown
  }
};

let gameState = {
  currentRound: 1,
  phase: 'setup', // 'setup', 'input', 'reveal', 'meltdown_check', 'game_over'
  activeHumanIndex: -1, // Index of human player currently choosing
  history: [],
  winnerId: null
};

// DOM Elements
const screens = {
  setup: document.getElementById('setup-screen'),
  turn: document.getElementById('turn-screen'),
  arena: document.getElementById('arena-screen'),
  victory: document.getElementById('victory-screen')
};

// Setup Screen Inputs
const btnNodes4 = document.getElementById('btn-nodes-4');
const btnNodes5 = document.getElementById('btn-nodes-5');
const nodeConfigList = document.getElementById('node-config-list');
const btnStartGame = document.getElementById('btn-start-game');

// Rule cards
const ruleCards = {
  1: document.getElementById('rule-card-1'),
  2: document.getElementById('rule-card-2'),
  3: document.getElementById('rule-card-3')
};

// Turn Input elements
const turnPlayerName = document.getElementById('turn-player-name');
const turnPrompt = document.getElementById('turn-prompt');
const btnAccessConfirm = document.getElementById('btn-access-confirm');
const turnInputControls = document.getElementById('turn-input-controls');
const nodeInputSlider = document.getElementById('node-input-slider');
const sliderValDisplay = document.getElementById('slider-val-display');
const btnLockInput = document.getElementById('btn-lock-input');

// Arena Elements
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

// Audio Toggle
const audioToggleBtn = document.getElementById('audio-toggle-btn');
let audioMuted = false;

// Protocols Modal Elements
const btnProtocols = document.getElementById('btn-protocols');
const btnCloseProtocols = document.getElementById('btn-close-protocols');
const protocolsModal = document.getElementById('protocols-modal');

// Default Node Names and AI Personalities
const defaultNames = ['Node Alpha', 'Node Beta', 'Node Gamma', 'Node Delta', 'Node Epsilon'];
const aiPersonalities = ['rationalist', 'analyst', 'maverick', 'defender'];

// Initialize App
function initApp() {
  setupEventListeners();
  renderNodeConfigList();
  renderScaleTicks();
  
  // Set up Network Events
  if (window.Network) {
    window.Network.events.onRoomCreated = (code) => {
      document.getElementById('host-room-code').textContent = code;
    };
    
    window.Network.events.onClientConnected = (peerId, count) => {
      document.getElementById('connected-players-count').textContent = count;
      // You can expand this later to assign players to nodes
    };
    
    window.Network.events.onStateUpdate = (payload) => {
      // Received game state from host!
      console.log("Got state from host", payload);
      // Here you would update your UI to match payload
    };
  }
  
  // Unlock audio context on document click
  document.addEventListener('click', () => {
    if (window.quantumAudio) {
      window.quantumAudio.init();
    }
  }, { once: true });
}

// Setup Event Listeners
function setupEventListeners() {
  // Multiplayer UI Controls
  const btnModeLocal = document.getElementById('btn-mode-local');
  const btnModeHost = document.getElementById('btn-mode-host');
  const btnModeJoin = document.getElementById('btn-mode-join');
  const onlineJoinSection = document.getElementById('online-join-section');
  const onlineHostSection = document.getElementById('online-host-section');
  const standardSetupSections = document.getElementById('standard-setup-sections');

  btnModeLocal.addEventListener('click', () => {
    playSelectSound();
    btnModeLocal.className = 'btn';
    btnModeHost.className = 'btn btn-secondary';
    btnModeJoin.className = 'btn btn-secondary';
    
    onlineJoinSection.style.display = 'none';
    onlineHostSection.style.display = 'none';
    standardSetupSections.style.display = 'block';
    btnStartGame.style.display = 'block';
    btnStartGame.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Initialize Sequence';
  });

  btnModeHost.addEventListener('click', () => {
    playSelectSound();
    btnModeHost.className = 'btn';
    btnModeLocal.className = 'btn btn-secondary';
    btnModeJoin.className = 'btn btn-secondary';
    
    onlineJoinSection.style.display = 'none';
    onlineHostSection.style.display = 'block';
    standardSetupSections.style.display = 'block';
    btnStartGame.style.display = 'block';
    btnStartGame.innerHTML = 'Start Hosted Game';
    
    if (window.Network && window.Network.getMode() !== 'host') {
      window.Network.startHosting();
    }
  });

  btnModeJoin.addEventListener('click', () => {
    playSelectSound();
    btnModeJoin.className = 'btn';
    btnModeLocal.className = 'btn btn-secondary';
    btnModeHost.className = 'btn btn-secondary';
    
    onlineJoinSection.style.display = 'block';
    onlineHostSection.style.display = 'none';
    standardSetupSections.style.display = 'none';
    btnStartGame.style.display = 'none'; // Joining players wait for host to start
  });

  document.getElementById('btn-join-room').addEventListener('click', () => {
    playSelectSound();
    const code = document.getElementById('join-room-code').value.trim();
    if (code.length >= 4) {
      document.getElementById('join-status-msg').textContent = "Connecting to " + code + "...";
      if (window.Network) window.Network.joinRoom(code);
    }
  });
  // Node Count Buttons
  btnNodes4.addEventListener('click', () => {
    playSelectSound();
    gameConfig.nodeCount = 4;
    btnNodes4.classList.add('btn');
    btnNodes4.classList.remove('btn-secondary');
    btnNodes5.classList.add('btn-secondary');
    btnNodes5.classList.remove('btn');
    renderNodeConfigList();
  });

  btnNodes5.addEventListener('click', () => {
    playSelectSound();
    gameConfig.nodeCount = 5;
    btnNodes5.classList.add('btn');
    btnNodes5.classList.remove('btn-secondary');
    btnNodes4.classList.add('btn-secondary');
    btnNodes4.classList.remove('btn');
    renderNodeConfigList();
  });

  // Rule Cards Click Toggles
  Object.keys(ruleCards).forEach(ruleNum => {
    ruleCards[ruleNum].addEventListener('click', () => {
      playSelectSound();
      gameConfig.rules[`rule${ruleNum}`] = !gameConfig.rules[`rule${ruleNum}`];
      if (gameConfig.rules[`rule${ruleNum}`]) {
        ruleCards[ruleNum].classList.add('enabled');
      } else {
        ruleCards[ruleNum].classList.remove('enabled');
      }
    });
  });

  // Start Game Button
  btnStartGame.addEventListener('click', startGame);

  // Turn Screen Actions
  btnAccessConfirm.addEventListener('click', () => {
    playSelectSound();
    btnAccessConfirm.style.display = 'none';
    turnPrompt.style.display = 'none';
    turnInputControls.style.display = 'block';
  });

  nodeInputSlider.addEventListener('input', (e) => {
    sliderValDisplay.textContent = e.target.value;
  });

  btnLockInput.addEventListener('click', handleLockInput);

  // Arena Screen Actions
  btnArenaAction.addEventListener('click', handleArenaAction);
  btnAbortGame.addEventListener('click', abortGame);

  // Victory Screen Actions
  document.getElementById('btn-restart-game').addEventListener('click', () => {
    playSelectSound();
    switchScreen('setup');
  });

  // Audio Toggle Button
  audioToggleBtn.addEventListener('click', () => {
    audioMuted = !audioMuted;
    if (audioMuted) {
      audioToggleBtn.classList.add('muted');
      audioToggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="audio-icon-off"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v6a3 3 0 0 0 5.12 2.12M18.36 5.64A9 9 0 0 1 20.1 15"></path><path d="M11 5L6 9H2v6h4l5 4V5z"></path></svg>
      `;
      // Stop tension music when muted
      if (window.quantumAudio) window.quantumAudio.stopTensionMusic();
    } else {
      audioToggleBtn.classList.remove('muted');
      audioToggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="audio-icon-on"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
      `;
      if (window.quantumAudio) {
        window.quantumAudio.init();
        window.quantumAudio.playSelect();
        // Resume tension music if game is in progress
        if (gameState.phase !== 'setup') {
          window.quantumAudio.startTensionMusic();
          updateTensionIntensity();
        }
      }
    }
  });

  // Protocols Modal Events
  btnProtocols.addEventListener('click', () => {
    playSelectSound();
    protocolsModal.style.display = 'flex';
  });

  btnCloseProtocols.addEventListener('click', () => {
    playSelectSound();
    protocolsModal.style.display = 'none';
  });
}

// Sound Helpers
function playSelectSound() {
  if (!audioMuted && window.quantumAudio) {
    window.quantumAudio.playSelect();
  }
}

function playWarningSound() {
  if (!audioMuted && window.quantumAudio) {
    window.quantumAudio.playWarning();
  }
}

function playClankSound() {
  if (!audioMuted && window.quantumAudio) {
    window.quantumAudio.playClank();
  }
}

function playSizzleSound() {
  if (!audioMuted && window.quantumAudio) {
    window.quantumAudio.playSizzle();
  }
}

function playTickSound() {
  if (!audioMuted && window.quantumAudio) {
    window.quantumAudio.playTick();
  }
}

function playMeltdownSound() {
  if (!audioMuted && window.quantumAudio) {
    window.quantumAudio.playMeltdown();
  }
}

// Calculate and update tension music intensity based on game state
function updateTensionIntensity() {
  if (!window.quantumAudio) return;
  
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
}

// Screen Routing
function switchScreen(screenKey) {
  Object.keys(screens).forEach(key => {
    screens[key].style.display = 'none';
    screens[key].classList.remove('active');
  });
  screens[screenKey].style.display = 'flex';
  screens[screenKey].classList.add('active');
  gameState.phase = screenKey;
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

  switchScreen('arena');

  // Start tension music
  if (!audioMuted && window.quantumAudio) {
    window.quantumAudio.startTensionMusic();
  }
}

// Abort Game
function abortGame() {
  playSelectSound();
  if (confirm("Are you sure you want to abort the current simulation sequence?")) {
    if (window.quantumAudio) window.quantumAudio.stopTensionMusic();
    switchScreen('setup');
  }
}

// Render active rules tags in sidebar
function renderActiveRulesTags() {
  activeRulesTags.innerHTML = '';
  if (gameConfig.rules.rule1) {
    activeRulesTags.innerHTML += `<span class="rule-tag">Disqual. Override</span>`;
  }
  if (gameConfig.rules.rule2) {
    activeRulesTags.innerHTML += `<span class="rule-tag">Precision Spike</span>`;
  }
  if (gameConfig.rules.rule3) {
    activeRulesTags.innerHTML += `<span class="rule-tag">Zero-One Override</span>`;
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
      bubble.style.animationDuration = `${1.2 + Math.random() * 1}s`;
      
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
  playSelectSound();
  
  if (gameState.phase === 'arena' && btnArenaAction.textContent === "Begin Inputs") {
    // Transition to turn gathering phase
    gameState.phase = 'input';
    gatherNextInput();
  } else if (gameState.phase === 'reveal') {
    // Evaluate the round results
    evaluateRound();
  } else if (gameState.phase === 'meltdown_check') {
    // Check for game completion or trigger next round setup
    prepareNextRoundOrFinish();
  }
}

// Cycle through human inputs and AI choices
function gatherNextInput() {
  // Find the next active human player who hasn't input a choice yet
  const nextHumanIndex = gameConfig.players.findIndex((p, idx) => 
    p.isAlive && p.type === 'human' && p.lastChoice === null && idx > gameState.activeHumanIndex
  );

  if (nextHumanIndex !== -1) {
    // Open Secret turn modal
    gameState.activeHumanIndex = nextHumanIndex;
    const player = gameConfig.players[nextHumanIndex];
    
    // Reset Turn UI
    turnPlayerName.textContent = player.name;
    btnAccessConfirm.style.display = 'block';
    turnPrompt.style.display = 'block';
    turnInputControls.style.display = 'none';
    nodeInputSlider.value = 50;
    sliderValDisplay.textContent = 50;

    switchScreen('turn');
  } else {
    // All human choices collected. Now compute AI selections.
    computeAIChoices();
    
    // Transition back to Arena screen
    switchScreen('arena');
    gameState.phase = 'reveal';
    
    // Set UI to Ready for Evaluation
    arenaInstructions.textContent = "All Node values successfully locked into buffer. Ready to execute dynamic calculation scale.";
    btnArenaAction.textContent = "Execute Evaluation";
    btnArenaAction.style.display = 'block';

    // Update player cards status to "LOCKED"
    gameConfig.players.forEach(p => {
      if (p.isAlive) {
        const badge = document.getElementById(`node-val-${p.id}`);
        badge.textContent = 'LOCKED';
        badge.className = 'node-value-badge locked';
      }
    });
  }
}

// Handle locking human input
function handleLockInput() {
  const choice = parseInt(nodeInputSlider.value);
  const player = gameConfig.players[gameState.activeHumanIndex];
  
  player.lastChoice = choice;
  playSelectSound();

  // Reset to intermediate arena view
  switchScreen('arena');
  
  // Go to next human or trigger calculation
  gatherNextInput();
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

  // Reveal player choices on cards
  gameConfig.players.forEach(p => {
    if (!p.isAlive) return;

    const badge = document.getElementById(`node-val-${p.id}`);
    
    if (p.isDisqualified) {
      badge.textContent = `DQ (${p.lastChoice})`;
      badge.className = 'node-value-badge disqualified';
    } else if (p.id === winnerId) {
      badge.textContent = p.lastChoice.toString();
      badge.className = 'node-value-badge winner green-glow';
    } else {
      badge.textContent = p.lastChoice.toString();
      badge.className = 'node-value-badge revealed';
    }

    // Update stability and liquid
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
  }

  arenaInstructions.textContent = resultText;
  
  // Transition Phase to meltdown checks
  gameState.phase = 'meltdown_check';
  btnArenaAction.textContent = "Process Core Meltdowns";
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

// Meltdown verification phase (deactivating players who hit -10)
function prepareNextRoundOrFinish() {
  let meltdownsHappened = false;

  gameConfig.players.forEach(p => {
    if (p.isAlive && p.stability <= -10) {
      p.isAlive = false;
      p.stability = -10;
      meltdownsHappened = true;
      
      // Update UI card to show meltdown
      updatePlayerLiquidUI(p.id);
    }
  });

  if (meltdownsHappened) {
    playMeltdownSound();
    
    // Shake effect on arena
    screens.arena.classList.add('shake-effect');
    setTimeout(() => {
      screens.arena.classList.remove('shake-effect');
    }, 500);

    arenaInstructions.textContent = "Critical alert: Core Stability exceeded limits! Triggered coolant overflow purge.";
  }

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
  if (window.quantumAudio) window.quantumAudio.stopTensionMusic();

  playWarningSound();
  switchScreen('victory');
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
