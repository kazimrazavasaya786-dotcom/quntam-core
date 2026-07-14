// network.js - Handles PeerJS networking for Quantum Core Stability Arena

let peer = null;
let myPeerId = null;
let hostConn = null; // Used when this instance is a Client joining a Host
let clientConns = []; // Used when this instance is a Host managing Clients

let netMode = 'local'; // 'local', 'host', 'client'

// Event callbacks for integrating with script.js
const netEvents = {
  onRoomCreated: null, // Host got room code
  onClientConnected: null, // Host got a new client
  onStateUpdate: null, // Client got new state from Host
  onClientInput: null, // Host got input from Client
  onConnectionLost: null // Disconnect handler
};

// Generates a random 4-letter room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Prefix to avoid peer ID collisions on the public PeerJS server
const PREFIX = 'QCORE-';

// --- HOST FUNCTIONS ---

function startHosting() {
  netMode = 'host';
  roomCode = generateRoomCode();
  const fullId = PREFIX + roomCode;
  
  peer = new Peer(fullId);
  
  peer.on('open', (id) => {
    myPeerId = id;
    if (netEvents.onRoomCreated) netEvents.onRoomCreated(roomCode);
  });
  
  peer.on('connection', (conn) => {
    // New client connected
    clientConns.push(conn);
    
    conn.on('open', () => {
      if (netEvents.onClientConnected) netEvents.onClientConnected(conn.peer, clientConns.length);
    });
    
    conn.on('data', (data) => {
      // Data received from client (usually their input value)
      if (netEvents.onClientInput) {
        netEvents.onClientInput(conn.peer, data);
      }
    });
    
    conn.on('close', () => {
      clientConns = clientConns.filter(c => c !== conn);
      if (netEvents.onConnectionLost) netEvents.onConnectionLost();
    });
  });

  peer.on('error', (err) => {
    console.error("PeerJS Host Error:", err);
    if (err.type === 'unavailable-id') {
      // Code collision, try again
      startHosting();
    }
  });
}

function broadcastState(gameStateData) {
  if (netMode !== 'host') return;
  // Send the entire current game state to all connected clients
  clientConns.forEach(conn => {
    if (conn.open) {
      conn.send({ type: 'STATE_UPDATE', payload: gameStateData });
    }
  });
}

// --- CLIENT FUNCTIONS ---

function joinRoom(code) {
  netMode = 'client';
  roomCode = code.toUpperCase();
  const hostId = PREFIX + roomCode;
  
  peer = new Peer(); // Client gets a random ID
  
  peer.on('open', (id) => {
    myPeerId = id;
    // Connect to host
    hostConn = peer.connect(hostId, { reliable: true });
    
    hostConn.on('open', () => {
      console.log("Connected to Host:", hostId);
    });
    
    hostConn.on('data', (data) => {
      // Receive data from host
      if (data.type === 'STATE_UPDATE' && netEvents.onStateUpdate) {
        netEvents.onStateUpdate(data.payload);
      }
    });
    
    hostConn.on('close', () => {
      if (netEvents.onConnectionLost) netEvents.onConnectionLost();
    });
  });
  
  peer.on('error', (err) => {
    console.error("PeerJS Client Error:", err);
    if (netEvents.onConnectionLost) netEvents.onConnectionLost("Failed to connect to room");
  });
}

function sendInputToHost(choiceValue) {
  if (netMode === 'client' && hostConn && hostConn.open) {
    hostConn.send({ type: 'CLIENT_INPUT', choice: choiceValue, peerId: myPeerId });
  }
}

// Export object for window
window.Network = {
  startHosting,
  joinRoom,
  broadcastState,
  sendInputToHost,
  events: netEvents,
  getMode: () => netMode,
  getPeerId: () => myPeerId
};
