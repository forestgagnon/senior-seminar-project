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
          gameData: procMsg.data
        });
      });
      console.log('SENT UPDATE ' + procMsg.data.timestamp);
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

  socket.on('disconnect', () => {
    gameProc.send({ message: procConstants.P_REMOVE_PLAYER, data: { socketId: socket.id } });
  });
});
