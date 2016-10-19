const path = require('path'),
  procConstants = require(path.resolve(__dirname, 'procConstants.js')),
  physicsConfig = require(path.resolve(__dirname, '../shared/physicsConfig.js')),
  m = require('matter-js'),
  gameloop = require('node-gameloop'),
  modelGenerator = require(path.resolve(__dirname, 'modelGenerator.js'));

const engineParams = physicsConfig.engineParams;

//========== GLOBALS ==========\\
let gameLoopId;
let allPlayersBySocketId = {};
let game;
let playersToAdd = [];
let playersToRemove = [];


let b_ground = m.Bodies.rectangle(engineParams.WIDTH / 2, engineParams.HEIGHT - 20, engineParams.WIDTH + 10, 40, {
	isStatic: true,
  label: 'ground'
});

let b_boxA = m.Bodies.rectangle(400, 200, 80, 80, {
	isStatic: false,
  label: 'boxA'
});
m.Body.setMass(b_boxA, 20);

const engine = m.Engine.create();
engine.timing.delta = 1000/engineParams.FPS;
engine.timing.timeScale = engineParams.TIME_SCALE; //default is 1
engine.world.gravity.scale = engineParams.GRAVITY; //default is 0.001

m.World.add(engine.world, [b_boxA, b_ground]);

process.on('message', (message) => {
  console.log(message.message);
  switch(message.message) {
    case procConstants.P_START_GAME:
      initGameLoop();
      break;

    case procConstants.P_ADD_PLAYER:
      let newPlayer = modelGenerator.createPlayerModel(message.data.socketId);

      //Position the player
      m.Body.setPosition(newPlayer, { x: 50, y: engineParams.HEIGHT - 100 });
      allPlayersBySocketId[message.data.socketId] = newPlayer;
      playersToAdd.push(newPlayer);
      break;

    case procConstants.P_REMOVE_PLAYER:
      let player = allPlayersBySocketId[message.data.socketId];
      playersToRemove.push(player);
      delete allPlayersBySocketId[message.data.socketId];
      break;
  }
});

function initGameLoop(){
  clearInterval(sendUpdate);

  setInterval(sendUpdate, 1000);
  gameLoopId = gameloop.setGameLoop(gameLoop, 1000 / engineParams.FPS);
}

function pauseGameLoop(){
  clearInterval(sendUpdate);
  gameloop.clearGameLoop(gameLoopId);
}

function gameLoop(delta) {
  m.Events.trigger(engine, 'tick', { timestamp: engine.timing.timestamp });
  m.Engine.update(engine, engine.timing.delta);
  m.Events.trigger(engine, 'afterTick', { timestamp: engine.timing.timestamp });

  while(playersToAdd.length > 0) {
    let newPlayer = playersToAdd.pop();
    m.World.add(engine.world, newPlayer);
  }
  while(playersToRemove.length > 0) {
    let deletePlayer = playersToRemove.pop();
    m.World.remove(engine.world, deletePlayer);
  }
  // if (engine.timing.timestamp > 1000) {
  //   m.World.remove(engine.world, b_boxA);
  // }
}

function sendUpdate() {
  const data = {
    //engineParams: engineParams,
    bodies: removeCircular(m.Composite.allBodies(engine.world)),
    timestamp: engine.timing.timestamp
  };
  process.send({ message: procConstants.R_GAME_DATA, data: data })
}

function removeCircular(object) {
  let cache = [];
  return JSON.parse(JSON.stringify(object, function(key, value) {
      if (typeof value === 'object' && value !== null) {
          if (cache.indexOf(value) !== -1) {
              // Circular reference found, discard key
              return;
          }
          // Store value in our collection
          cache.push(value);
      }
      return value;
  }));
}
