module.exports = (Matter) => {
  const Body = Matter.Body,
    Common = Matter.Common,
    Composite = Matter.Composite;
  return {
    update: function(engine) {
      engine = engine;

      var world = engine.world,
      bodies = Composite.allBodies(world);
      for (var i = 0; i < bodies.length; i += 1) {
        var body = bodies[i],
          x = null,
          y = null;
        if (body.bounds.min.x > world.bounds.max.x) {
          x = world.bounds.min.x - (body.bounds.max.x - body.position.x);
        } else if (body.bounds.max.x < world.bounds.min.x) {
          x = world.bounds.max.x - (body.bounds.min.x - body.position.x);
        }

        if (body.bounds.min.y > world.bounds.max.y) {
          y = world.bounds.min.y - (body.bounds.max.y - body.position.y);
        } else if (body.bounds.max.y < world.bounds.min.y) {
          y = world.bounds.max.y - (body.bounds.min.y - body.position.y);
        }

        if (x !== null || y !== null) {
          Body.setPosition(body, {
              x: x || body.position.x,
              y: y || body.position.y
          });
        }
        //Enforce velocity maximum
        if (body.maxVelocity !== undefined) {
          let velocity = { x: body.velocity.x, y: body.velocity.y };
          const maxVelocity = body.maxVelocity;
          let velocityChanged = false;
          if(Math.abs(velocity.x) > body.maxVelocity) {
            velocity.x = velocity.x > 0 ? maxVelocity : -maxVelocity;
            velocityChanged = true;
          }
          if(Math.abs(velocity.y) > maxVelocity) {
            velocity.y = velocity.y > 0 ? maxVelocity : -maxVelocity;
            velocityChanged = true;
          }
          if (velocityChanged) {
            Body.setVelocity(body, velocity);
          }
        }
      }
    }
  }

};
