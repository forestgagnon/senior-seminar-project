const express = require('express'),
  app = express(),
  http = require('http').Server(app),
  session = require('express-session'),
  io = require('socket.io')(http),
  path = require('path'),
  socketConstants = require(path.resolve(__dirname, 'shared/socketConstants.js'));

  app.use(express.static(path.join(__dirname, 'public')));


  //===============PORT=================
  const portNumber = process.env.PORT || 3000; //process.env.PORT is for Heroku's dynamic port allocation

  http.listen(portNumber, () => {
      console.log("listening on " + portNumber + "!");
  });

  io.on('connection', (socket) => {
    socket.on(socketConstants.C_INITIALIZE, (data) => {
      console.log('yay!');
      socket.emit(socketConstants.S_INITIALIZE, "blah");
    })
  });
