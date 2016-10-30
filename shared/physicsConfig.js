const engineParams = {
  TIME_SCALE: 0.75,
	FPS: 60,
	GRAVITY: 0.001, //default is 0.00
	WIDTH: 800,
	HEIGHT: 800
};

const movementForces = {
  up: { x: 0, y: -0.2 },
  down: { x: 0, y: 0.2 },
  left: { x: -0.2, y: 0 },
  right: { x: 0.2, y: 0 },
};

module.exports = {
  engineParams: engineParams,
  movementForces: movementForces
};
