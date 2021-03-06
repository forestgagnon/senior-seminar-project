const express = require('express'),
  app = express(),
  http = require('http').Server(app),
  session = require('express-session'),
  io = require('socket.io')(http),
  path = require('path'),
  _ = require('underscore'),
  socketConstants = require(path.resolve(__dirname, 'shared/socketConstants.js')),
  procConstants = require(path.resolve(__dirname, 'server_modules/procConstants.js')),
  childProcess = require('child_process');


//========== ROUTING ==========\\
app.use(express.static(path.join(__dirname, 'public')));

//========== GAME SUBPROCESS ==========\\
const gameProc = childProcess.fork(path.resolve(__dirname, 'server_modules/gameProcess.js'));

gameProc.on('message', (procMsg) => {
  switch(procMsg.message) {
    case procConstants.R_GAME_DATA:
      _.values(io.sockets.connected).forEach((socket) => {
        socket.emit(socketConstants.S_GAME_UPDATE, {
          playerId: socket.id,
          gameData: procMsg.data.gameData,
          lastClientTimestamp: procMsg.data.playerDataBySocketId[socket.id] ? procMsg.data.playerDataBySocketId[socket.id].lastClientTimestamp : null
        });
      });
      // console.log('SENT UPDATE ' + procMsg.data.gameData.timestamp);
      break;

    case procConstants.R_PLAYERS_THAT_MOVED:
      procMsg.data.forEach((player) => {
        io.sockets.connected[player.id].emit(socketConstants.S_MOVE_CONFIRMATION, {
          lastClientTimestamp: player.lastClientTimestamp
        });
      });
      break;
  }
});

gameProc.send({ message: procConstants.P_START_GAME });

//========== PORT ==========\\
const portNumber = process.env.PORT || 3000; //process.env.PORT is for Heroku's dynamic port allocation

http.listen(portNumber, () => {
    console.log("listening on " + portNumber + "!");
});


//========== SOCKET MESSAGES ==========\\
io.on('connection', (socket) => {
  gameProc.send({ message: procConstants.P_ADD_PLAYER, data: { socketId: socket.id } });
  socket.on(socketConstants.C_INITIALIZE, (data) => {
    console.log('Client socket initialized');
    socket.emit(socketConstants.S_INITIALIZE, "blah");
  });

  socket.on(socketConstants.C_MOVE, (data) => {
    if (!_.isArray(data.directions)) {
      throw new Error('INVALID_DIRECTIONS_OBJECT');
    }
    gameProc.send({
      message: procConstants.P_PLAYER_MOVE,
      data: {
        socketId: socket.id,
        directions: data.directions,
        clientTimestamp: data.clientTimestamp
      }
    });
  });

  socket.on(socketConstants.C_PING_RESPONSE, (data) => {
    const latency = Math.ceil((Date.now() - data.serverTimestamp) / 2);
    gameProc.send({
      message: procConstants.P_UPDATE_PLAYER_LATENCY,
      data: {
        socketId: socket.id,
        latency: latency
      }
    });
    socket.emit(socketConstants.S_PING_NOTIFICATION, { latency: latency });
  });

  socket.on('disconnect', () => {
    gameProc.send({ message: procConstants.P_REMOVE_PLAYER, data: { socketId: socket.id } });
  });
});

setInterval(() => {
  const now = Date.now();
  io.sockets.emit(socketConstants.S_PING_REQUEST, { serverTimestamp: now });
}, 1000);
