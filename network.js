// network.js - PeerJS room hosting / joining for Quantum Core Stability Arena

let peer = null;
let myPeerId = null;
let hostConn = null;
let clientConns = []; // { conn, peerId, name }
let netMode = 'local'; // 'local' | 'host' | 'client'
let roomCode = null;
let displayName = 'Node';

function getProfileTheme(name) {
  try {
    const raw = localStorage.getItem('quantum_core_profiles');
    if (raw) {
      const profiles = JSON.parse(raw);
      if (profiles[name] && profiles[name].selectedTheme) {
        return profiles[name].selectedTheme;
      }
    }
  } catch (e) {}
  return 'green';
}

const PREFIX = 'QCORE-';

const PEER_OPTIONS = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:openrelay.metered.ca:80' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  }
};

const netEvents = {
  onRoomCreated: null,
  onClientConnected: null,
  onLobbyUpdate: null,
  onJoinedRoom: null,
  onStateUpdate: null,
  onClientInput: null,
  onConnectionLost: null,
  onError: null
};

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function destroyPeer() {
  try {
    if (hostConn) {
      hostConn.close();
      hostConn = null;
    }
    clientConns.forEach(({ conn }) => {
      try { conn.close(); } catch (_) {}
    });
    clientConns = [];
    if (peer) {
      peer.destroy();
      peer = null;
    }
  } catch (_) {}
  myPeerId = null;
  roomCode = null;
}

function getLobbySnapshot() {
  const list = [{ peerId: myPeerId, name: displayName, isHost: true, theme: getProfileTheme(displayName) }];
  clientConns.forEach(({ peerId, name, theme }) => {
    list.push({ peerId, name: name || 'Remote Node', isHost: false, theme: theme || 'green' });
  });
  return list;
}

function emitLobbyUpdate() {
  const lobby = getLobbySnapshot();
  if (netEvents.onLobbyUpdate) netEvents.onLobbyUpdate(lobby);
  clientConns.forEach(({ conn }) => {
    if (conn.open) {
      conn.send({ type: 'LOBBY_UPDATE', lobby });
    }
  });
}

function sendToConn(conn, data) {
  if (conn && conn.open) conn.send(data);
}

function wireClientConnection(conn) {
  conn.on('open', () => {
    // Wait for HELLO with display name before counting as joined
  });

  conn.on('data', (data) => {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'HELLO') {
      const existing = clientConns.find(c => c.peerId === conn.peer);
      const name = (data.name && String(data.name).trim()) || 'Remote Node';
      const theme = data.theme || 'green';
      if (existing) {
        existing.name = name;
        existing.theme = theme;
        existing.conn = conn;
      } else {
        clientConns.push({ conn, peerId: conn.peer, name, theme });
      }

      sendToConn(conn, {
        type: 'WELCOME',
        roomCode,
        lobby: getLobbySnapshot()
      });

      if (netEvents.onClientConnected) {
        netEvents.onClientConnected(conn.peer, clientConns.length);
      }
      emitLobbyUpdate();
      return;
    }

    if (data.type === 'CLIENT_INPUT' && netEvents.onClientInput) {
      netEvents.onClientInput(conn.peer, data);
    }
  });

  conn.on('close', () => {
    clientConns = clientConns.filter(c => c.conn !== conn);
    emitLobbyUpdate();
    if (netEvents.onConnectionLost) netEvents.onConnectionLost('A player disconnected');
  });

  conn.on('error', (err) => {
    console.error('Host client connection error:', err);
  });
}

function startHosting(name) {
  destroyPeer();
  netMode = 'host';
  displayName = (name && String(name).trim()) || 'Host';
  roomCode = generateRoomCode();
  const fullId = PREFIX + roomCode;

  peer = new Peer(fullId, PEER_OPTIONS);

  peer.on('open', (id) => {
    myPeerId = id;
    if (netEvents.onRoomCreated) netEvents.onRoomCreated(roomCode);
    emitLobbyUpdate();
  });

  peer.on('connection', (conn) => {
    // Cap remote seats at 4 (5-node game minus host)
    if (clientConns.length >= 4) {
      conn.on('open', () => {
        sendToConn(conn, { type: 'ERROR', message: 'Room is full' });
        conn.close();
      });
      return;
    }
    wireClientConnection(conn);
  });

  peer.on('error', (err) => {
    console.error('PeerJS Host Error:', err);
    if (err.type === 'unavailable-id') {
      startHosting(displayName);
      return;
    }
    if (netEvents.onError) netEvents.onError(err.message || String(err));
  });

  peer.on('disconnected', () => {
    if (peer && !peer.destroyed) {
      try { peer.reconnect(); } catch (_) {}
    }
  });
}

function broadcastState(gameStateData) {
  if (netMode !== 'host') return;
  clientConns.forEach(({ conn }) => {
    sendToConn(conn, { type: 'STATE_UPDATE', payload: gameStateData });
  });
}

function broadcastAbort() {
  if (netMode !== 'host') return;
  clientConns.forEach(({ conn }) => {
    sendToConn(conn, { type: 'GAME_ABORTED' });
  });
}

function joinRoom(code, name) {
  destroyPeer();
  netMode = 'client';
  displayName = (name && String(name).trim()) || 'Remote Node';
  roomCode = String(code || '').trim().toUpperCase();
  if (roomCode.length < 4) {
    if (netEvents.onError) netEvents.onError('Enter a valid 4-letter room code');
    return;
  }

  const hostId = PREFIX + roomCode;
  peer = new Peer(PEER_OPTIONS);

  peer.on('open', (id) => {
    myPeerId = id;
    hostConn = peer.connect(hostId, { reliable: true });

    hostConn.on('open', () => {
      const theme = getProfileTheme(displayName);
      hostConn.send({ type: 'HELLO', name: displayName, peerId: myPeerId, theme });
    });

    hostConn.on('data', (data) => {
      if (!data || typeof data !== 'object') return;

      if (data.type === 'WELCOME') {
        if (netEvents.onJoinedRoom) {
          netEvents.onJoinedRoom(data.roomCode, data.lobby);
        }
        if (netEvents.onLobbyUpdate) netEvents.onLobbyUpdate(data.lobby);
        return;
      }

      if (data.type === 'LOBBY_UPDATE') {
        if (netEvents.onLobbyUpdate) netEvents.onLobbyUpdate(data.lobby);
        return;
      }

      if (data.type === 'STATE_UPDATE' && netEvents.onStateUpdate) {
        netEvents.onStateUpdate(data.payload);
        return;
      }

      if (data.type === 'GAME_ABORTED') {
        if (netEvents.onConnectionLost) {
          netEvents.onConnectionLost('Host aborted the game');
        }
        return;
      }

      if (data.type === 'ERROR') {
        if (netEvents.onError) netEvents.onError(data.message || 'Connection rejected');
        try { hostConn.close(); } catch (_) {}
      }
    });

    hostConn.on('close', () => {
      if (netEvents.onConnectionLost) {
        netEvents.onConnectionLost('Disconnected from host');
      }
    });

    hostConn.on('error', (err) => {
      console.error('Client hostConn error:', err);
      if (netEvents.onError) netEvents.onError('Could not reach host. Check the room code.');
    });
  });

  peer.on('error', (err) => {
    console.error('PeerJS Client Error:', err);
    const msg = err.type === 'peer-unavailable'
      ? 'Room not found. Check the code and that the host is still online.'
      : (err.message || 'Failed to connect to room');
    if (netEvents.onError) netEvents.onError(msg);
    if (netEvents.onConnectionLost) netEvents.onConnectionLost(msg);
  });
}

function sendInputToHost(choiceValue) {
  if (netMode === 'client' && hostConn && hostConn.open) {
    hostConn.send({
      type: 'CLIENT_INPUT',
      choice: choiceValue,
      peerId: myPeerId
    });
  }
}

function goLocal() {
  destroyPeer();
  netMode = 'local';
}

window.Network = {
  startHosting,
  joinRoom,
  broadcastState,
  broadcastAbort,
  sendInputToHost,
  goLocal,
  events: netEvents,
  getMode: () => netMode,
  getPeerId: () => myPeerId,
  getRoomCode: () => roomCode,
  getConnectedPeers: () => clientConns.map(c => c.peerId),
  getLobby: () => (netMode === 'host' ? getLobbySnapshot() : []),
  getDisplayName: () => displayName,
  setDisplayName: (name) => {
    displayName = (name && String(name).trim()) || displayName;
  }
};
