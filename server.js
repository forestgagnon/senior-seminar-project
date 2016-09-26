const express = require('express'),
  app = express(),
  http = require('http').createServer(app),
  session = require('express-session'),
  io = require('socket.io').listen(http);
