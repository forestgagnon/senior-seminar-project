const path = require('path'),
  procConstants = require(path.resolve(__dirname, 'procConstants.js')),
  physicsConfig = require(path.resolve(__dirname, '../shared/physicsConfig.js')),
  m = require('matter-js'),
  gameloop = require('node-gameloop');

const engineParams = physicsConfig.engineParams;

let b_ground = m.Bodies.rectangle(400, 780, 810, 40, {
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

let game;

process.on('message', (message) => {
  console.log(message.message);
  switch(message.message) {
    case procConstants.P_START_GAME:
      initGame();
      break;
  }
});

function initGame(){
  clearInterval(sendUpdate);

  setInterval(sendUpdate, 250);
  const gameLoopId = gameloop.setGameLoop(gameLoop, 1000 / engineParams.FPS);
}

function gameLoop(delta) {
  m.Events.trigger(engine, 'tick', { timestamp: engine.timing.timestamp });
  m.Engine.update(engine, engine.timing.delta);
  m.Events.trigger(engine, 'afterTick', { timestamp: engine.timing.timestamp });
}

function sendUpdate() {
  const data = {
    engineParams: engineParams,
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
