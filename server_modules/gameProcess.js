const path = require('path'),
  _ = require('underscore'),
  Victor = require('victor'),
  procConstants = require(path.resolve(__dirname, 'procConstants.js')),
  m = require(path.resolve(__dirname, '../shared/matter-edge-build.js')),
  physicsConfig = require(path.resolve(__dirname, '../shared/physicsConfig.js'))(m),
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

const engine = m.Engine.create({ enableSleeping: false });
engine.timing.delta = 1000/ENGINE_PARAMS.FPS;
engine.timing.timeScale = ENGINE_PARAMS.TIME_SCALE; //default is 1
engine.world.gravity.scale = ENGINE_PARAMS.GRAVITY; //default is 0.001
engine.world.bounds.min = { x: 0, y: 0 };
engine.world.bounds.max = { x: ENGINE_PARAMS.WIDTH, y: ENGINE_PARAMS.HEIGHT };

m.Events.on(engine, "tick", handleCollisions);

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
        latestClientBodyData: null
      };

      //Position the player //TODO: add spawnpoints
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
        player.movementDirections = player.movementDirections.concat(message.data.directions);
        player.lastClientTimestamp = message.data.clientTimestamp;
        player.latestClientBodyData = message.data.clientPlayerBodyData;
      }
      break;

    case procConstants.P_UPDATE_PLAYER_LATENCY:
      player = allPlayersBySocketId[message.data.socketId];
      player.latency = message.data.latency;
      player.body.latency = message.data.latency;
      break;
  }
});

function handleCollisions(e) {
  e.collisionStart.forEach((pair) => {
    const { bodyA, bodyB } = pair;
    physicsConfig.boundaryBounceHandler(bodyA, bodyB);
  });
}

function initGameLoop() {
  clearInterval(sendUpdate);

  setInterval(sendUpdate, 1000 / 30);
  gameLoopId = gameloop.setGameLoop(gameLoop, 1000 / ENGINE_PARAMS.FPS);
}

function pauseGameLoop() {
  clearInterval(sendUpdate);
  gameloop.clearGameLoop(gameLoopId);
}

function updatePlayerBody(playerBody, bodyData) {
  let latestClientPositionVictor = new Victor(bodyData.position.x, bodyData.position.y);
  let distance = latestClientPositionVictor.distance(new Victor(playerBody.position.x, playerBody.position.y));
  console.log(distance);
  m.Body.setPosition(playerBody, bodyData.position);
  m.Body.setVelocity(playerBody, bodyData.velocity);
}

function gameLoop(delta) {
  let playersThatMoved = [];

  //Resolve player movement requests
  _.each(allPlayersBySocketId, (player) => {

    if (player.movementDirections.length > 0) {
      playerMoved = true
      if (player.latestClientPosition !== null) {
        updatePlayerBody(player.body, player.latestClientBodyData);
      }
      playersThatMoved.push({ id: player.id, lastClientTimestamp: player.lastClientTimestamp });
    }
    player.movementDirections.forEach((direction) => {
      m.Body.applyForce(player.body, player.body.position, MOVEMENT_FORCES[direction]);
    });
    player.movementDirections = [];
  });

  tickEngine();

  while(playersToAdd.length > 0) {
    let newPlayer = playersToAdd.pop();
    m.World.add(engine.world, newPlayer.body);
  }
  while(playersToRemove.length > 0) {
    let deletePlayer = playersToRemove.pop();
    m.World.remove(engine.world, deletePlayer.body);
  }

  process.send({ message: procConstants.R_PLAYERS_THAT_MOVED, data: playersThatMoved });
}

function tickEngine() {
  m.Events.trigger(engine, 'tick', {
    timestamp: engine.timing.timestamp,
    collisionStart: engine.pairs.collisionStart,
    collisionActive: engine.pairs.collisionActive
  });
  m.Engine.update(engine, engine.timing.delta);
  m.Events.trigger(engine, 'afterTick', { timestamp: engine.timing.timestamp });
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
