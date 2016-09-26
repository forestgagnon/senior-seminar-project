const express = require('express'),
  app = express(),
  http = require('http').createServer(app),
  session = require('express-session'),
  io = require('socket.io').listen(http),
  path = require('path');

  app.use(express.static(path.join(__dirname, 'public')));


  //===============PORT=================
  const portNumber = process.env.PORT || 3000; //process.env.PORT is for Heroku's dynamic port allocation

  http.listen(portNumber, () => {
      console.log("listening on " + portNumber + "!");
  });
