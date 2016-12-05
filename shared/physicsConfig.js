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

const boundaryBounceForces = {
  UP: { x: 0, y: -0.025 },
  DOWN: { x: 0, y: 0.025 },
  LEFT: { x: -0.025, y: 0 },
  RIGHT: { x: 0.025, y: 0 },
};

const BOUNDARY_BOUNCE_FORCE_MULTIPLIER = 0.2;

module.exports = (m) => {
  return {
    engineParams: engineParams,
    movementForces: movementForces,
    boundaryBounceHandler(bodyA, bodyB) {
      let bodyToBounce;
      let boundaryBody;
      if (bodyA.label === 'boundary') {
        boundaryBody = bodyA;
        bodyToBounce = bodyB;
      }
      else if (bodyB.label === 'boundary') {
        boundaryBody = bodyB;
        bodyToBounce = bodyA;
      }
      if (bodyToBounce !== undefined) {
        switch (boundaryBody.boundaryType) {
          case 'BOTTOM':
            m.Body.applyForce(bodyToBounce, bodyToBounce.position, {
              x: boundaryBounceForces.UP.x * bodyToBounce.mass * BOUNDARY_BOUNCE_FORCE_MULTIPLIER,
              y: boundaryBounceForces.UP.y * bodyToBounce.mass * BOUNDARY_BOUNCE_FORCE_MULTIPLIER,
            });
            break;
          case 'TOP':
            m.Body.applyForce(bodyToBounce, bodyToBounce.position, {
              x: boundaryBounceForces.DOWN.x * bodyToBounce.mass * BOUNDARY_BOUNCE_FORCE_MULTIPLIER,
              y: boundaryBounceForces.DOWN.y * bodyToBounce.mass * BOUNDARY_BOUNCE_FORCE_MULTIPLIER,
            });
            break;
          case 'LEFT':
            m.Body.applyForce(bodyToBounce, bodyToBounce.position, {
              x: boundaryBounceForces.RIGHT.x * bodyToBounce.mass * BOUNDARY_BOUNCE_FORCE_MULTIPLIER,
              y: boundaryBounceForces.RIGHT.y * bodyToBounce.mass * BOUNDARY_BOUNCE_FORCE_MULTIPLIER,
            });
            break;
          case 'RIGHT':
            m.Body.applyForce(bodyToBounce, bodyToBounce.position, {
              x: boundaryBounceForces.LEFT.x * bodyToBounce.mass * BOUNDARY_BOUNCE_FORCE_MULTIPLIER,
              y: boundaryBounceForces.LEFT.y * bodyToBounce.mass * BOUNDARY_BOUNCE_FORCE_MULTIPLIER,
            });
            break;

        }
      }
    }
  };
};
