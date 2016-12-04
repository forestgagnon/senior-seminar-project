const engineParams = {
  TIME_SCALE: 0.75,
	FPS: 60,
	GRAVITY: 0.000, //default is 0.00
	WIDTH: 800,
	HEIGHT: 800
};

const movementForces = {
  UP: { x: 0, y: -0.015 },
  DOWN: { x: 0, y: 0.015 },
  LEFT: { x: -0.015, y: 0 },
  RIGHT: { x: 0.015, y: 0 },
};

module.exports = {
  engineParams: engineParams,
  movementForces: movementForces
};
