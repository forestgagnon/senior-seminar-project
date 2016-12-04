const path = require('path'),
  _ = require('underscore'),
  fixedQueue = require('fixedqueue').FixedQueue,
  procConstants = require(path.resolve(__dirname, 'procConstants.js')),
  physicsConfig = require(path.resolve(__dirname, '../shared/physicsConfig.js')),
  // m = require('matter-js'),
  m = require(path.resolve(__dirname, '../shared/matter-edge-build.js')),
  MatterWorldWrap = require(path.resolve(__dirname, '../shared/matter-world-wrap.js'))(m),
  gameloop = require('node-gameloop'),
  modelGenerator = require(path.resolve(__dirname, 'modelGenerator.js'))(m),
  miscUtils = require(path.resolve(__dirname, '../shared/miscUtils.js'));

const ENGINE_PARAMS = physicsConfig.engineParams;
const MOVEMENT_FORCES = physicsConfig.movementForces;

let updateNum = 0;

m.Engine.update = m.Common.chain(
    m.Engine.update,
    MatterWorldWrap.update
);

//========== GLOBALS ==========\\
let gameLoopId;
let allPlayersBySocketId = {};
let game;
let playersToAdd = [];
let playersToRemove = [];

let b_boxA = m.Bodies.rectangle(400, 200, 80, 80, {
	isStatic: false,
  label: 'boxA'
});
m.Body.setMass(b_boxA, 20);

const engine = m.Engine.create({ enableSleeping: false });
engine.timing.delta = 1000/ENGINE_PARAMS.FPS;
engine.timing.timeScale = ENGINE_PARAMS.TIME_SCALE; //default is 1
engine.world.gravity.scale = ENGINE_PARAMS.GRAVITY; //default is 0.001
engine.world.bounds.min = { x: 0, y: 0 };
engine.world.bounds.max = { x: ENGINE_PARAMS.WIDTH, y: ENGINE_PARAMS.HEIGHT };

let boundaries = modelGenerator.createBoundaries(ENGINE_PARAMS.WIDTH, ENGINE_PARAMS.HEIGHT);
m.World.add(engine.world, _.values(boundaries));

const numSquares = miscUtils.getRandomInt(5, 10);
let squares = [];
for (let i = 0; i < numSquares; i++) {
  const squareSize = miscUtils.getRandomInt(5, 25);
  let square = modelGenerator.createSquare(squareSize, squareSize);
  m.Body.setPosition(square, {
    x: miscUtils.getRandomInt(40, ENGINE_PARAMS.WIDTH - 40),
    y: miscUtils.getRandomInt(40, ENGINE_PARAMS.HEIGHT - 40)
  });
  squares.push(square);
}
m.World.add(engine.world, squares);

process.on('message', (message) => {
  console.log(message.message);
  let player;
  switch(message.message) {
    case procConstants.P_START_GAME:
      initGameLoop();
      break;

    case procConstants.P_ADD_PLAYER:
      let newPlayer = {
        id: message.data.socketId,
        body: modelGenerator.createPlayerModel(message.data.socketId),
        movementDirections: [],
        lastClientTimestamp: null,
        latency: 0,
        positionHistory: []
      };

      //Position the player
      m.Body.setPosition(newPlayer.body, { x: ENGINE_PARAMS.WIDTH / 2, y: ENGINE_PARAMS.HEIGHT / 2 });
      allPlayersBySocketId[newPlayer.id] = newPlayer;
      playersToAdd.push(newPlayer);
      break;

    case procConstants.P_REMOVE_PLAYER:
      player = allPlayersBySocketId[message.data.socketId];
      if (player) {
        playersToRemove.push(player);
        delete allPlayersBySocketId[message.data.socketId];
      }
      break;

    case procConstants.P_PLAYER_MOVE:
      player = allPlayersBySocketId[message.data.socketId];
      if (player) {
        player.movementDirections = message.data.directions;
        player.lastClientTimestamp = message.data.clientTimestamp;
      }
      break;

    case procConstants.P_UPDATE_PLAYER_LATENCY:
      player = allPlayersBySocketId[message.data.socketId];
      player.latency = message.data.latency;
      break;
  }
});

function initGameLoop() {
  clearInterval(sendUpdate);

  // setInterval(sendUpdate, 1000 / 30);
  setInterval(sendUpdate, 1000 / 30);
  gameLoopId = gameloop.setGameLoop(gameLoop, 1000 / ENGINE_PARAMS.FPS);
}

function pauseGameLoop() {
  clearInterval(sendUpdate);
  gameloop.clearGameLoop(gameLoopId);
}

function gameLoop(delta) {
  m.Events.trigger(engine, 'tick', { timestamp: engine.timing.timestamp });
  let playersThatMoved = [];
  //Resolve player movement requests
  _.each(_.values(allPlayersBySocketId), (player) => {
    //Set player position based on latency
    let currentPosition = JSON.parse(JSON.stringify(player.body.position));
    let ticksBehind = 1;
    let oldPosition = player.positionHistory[player.positionHistory.length - ticksBehind];
    while (oldPosition && (engine.timing.timestamp - oldPosition.timestamp < 2*player.latency)) {
      ticksBehind++;
      oldPosition = player.positionHistory[player.positionHistory.length - ticksBehind];
    }
    if (oldPosition) {
      m.Body.setPosition(player.body, oldPosition.position);
    }

    if (player.movementDirections.length > 0) {
      playersThatMoved.push({ id: player.id, lastClientTimestamp: player.lastClientTimestamp });
    }
    player.movementDirections.forEach((direction) => {
      m.Body.applyForce(player.body, player.body.position, MOVEMENT_FORCES[direction]);
    });
    player.movementDirections = [];
    m.Body.setPosition(player.body, currentPosition);
  });

  m.Engine.update(engine, engine.timing.delta);

  _.each(_.values(allPlayersBySocketId), (player) => {
    player.positionHistory.push({
      timestamp: engine.timing.timestamp,
      position: JSON.parse(JSON.stringify(player.body.position))
    });
    //TODO: splice position history to prevent it from growing too large
  });

  while(playersToAdd.length > 0) {
    let newPlayer = playersToAdd.pop();
    m.World.add(engine.world, newPlayer.body);
  }
  while(playersToRemove.length > 0) {
    let deletePlayer = playersToRemove.pop();
    m.World.remove(engine.world, deletePlayer.body);
  }

  m.Events.trigger(engine, 'afterTick', { timestamp: engine.timing.timestamp });
  // if (engine.timing.timestamp > 1000) {
  //   m.World.remove(engine.world, b_boxA);
  // }
  process.send({ message: procConstants.R_PLAYERS_THAT_MOVED, data: playersThatMoved });
}

function sendUpdate() {
  const bodies = miscUtils.removeCircular(m.Composite.allBodies(engine.world));
  const playerBodies = _.filter(bodies, (body) => body.label === 'player');
  const boundaryBodies = _.filter(bodies, (body) => body.label === 'boundary');
  const squareBodies = _.filter(bodies, (body) => body.label === 'square');
  const gameData = {
    bodies: {
      playerBodies: playerBodies,
      boundaryBodies: boundaryBodies,
      squareBodies: squareBodies
    },
    timestamp: engine.timing.timestamp,
    updateNum: updateNum++
  };
  const playerDataBySocketId = {};
  _.each(allPlayersBySocketId, (player, socketId) => {
    playerDataBySocketId[socketId] = {
      lastClientTimestamp: player.lastClientTimestamp
    }
  });
  process.send({
    message: procConstants.R_GAME_DATA, data: {
      gameData: gameData,
      playerDataBySocketId: playerDataBySocketId
    }
  });
}
