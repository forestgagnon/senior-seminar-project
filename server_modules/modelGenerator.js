const collisionFilterCategories = {
  WALL: 0x0001,
  PLAYER: 0x0002,
  OTHER: 0x0003
};

module.exports = (m) => {
  return {
    createPlayerModel(id) {
      return m.Bodies.circle(0, 0, 20, {
        mass: 5,
        label: 'player',
        playerId: id,
        maxVelocity: 20,
        collisionFilter: {
          category: collisionFilterCategories.PLAYER,
          mask: collisionFilterCategories.WALL & collisionFilterCategories.OTHER
        }
      });
    },

    createBoundaries(width, height) {
      const boundaryCollisionFilter = {
        category: collisionFilterCategories.WALL
      };
      return {
        bottom: m.Bodies.rectangle(width / 2, height - 20, width, 40, {
        	isStatic: true,
          label: 'boundary',
          boundaryType: 'bottom',
          collisionFilter: boundaryCollisionFilter
        }),
        top: m.Bodies.rectangle(width / 2, 20, width, 40, {
        	isStatic: true,
          label: 'boundary',
          boundaryType: 'top',
          collisionFilter: boundaryCollisionFilter
        }),
        left: m.Bodies.rectangle(20, height / 2, 40, height - 80, {
        	isStatic: true,
          label: 'boundary',
          boundaryType: 'left',
          collisionFilter: boundaryCollisionFilter
        }),
        right: m.Bodies.rectangle(width - 20, height / 2, 40, height - 80, {
        	isStatic: true,
          label: 'boundary',
          boundaryType: 'right',
          collisionFilter: boundaryCollisionFilter
        })
      }
    },

    createSquare(width, height) {
      return m.Bodies.rectangle(0, 0, width, height, {
        label: 'square',
        maxVelocity: 50,
        collisionFilter: {
          category: collisionFilterCategories.OTHER
        }
      });
    }
  }
};
