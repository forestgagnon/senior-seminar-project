const express = require('express'),
  app = express(),
  http = require('http').Server(app),
  session = require('express-session'),
  io = require('socket.io')(http),
  path = require('path'),
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
      io.sockets.emit(socketConstants.S_GAME_UPDATE, procMsg.data);
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
  socket.on(socketConstants.C_INITIALIZE, (data) => {
    console.log('Client socket initialized');
    socket.emit(socketConstants.S_INITIALIZE, "blah");
  })
});
