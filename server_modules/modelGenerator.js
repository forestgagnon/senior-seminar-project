const m = require('matter-js');

module.exports = {
  createPlayerModel(id) {
    return m.Bodies.circle(0, 0, 20, {
      mass: 20,
      label: 'player',
      playerId: id
    });
  },

  createBoundaries(width, height) {
    return {
      bottom: m.Bodies.rectangle(width / 2, height - 20, width, 40, {
      	isStatic: true,
        label: 'boundary',
        boundaryType: 'bottom'
      }),
      top: m.Bodies.rectangle(width / 2, 20, width, 40, {
      	isStatic: true,
        label: 'boundary',
        boundaryType: 'top'
      }),
      left: m.Bodies.rectangle(20, height / 2, 40, height - 80, {
      	isStatic: true,
        label: 'boundary',
        boundaryType: 'left'
      }),
      right: m.Bodies.rectangle(width - 20, height / 2, 40, height - 80, {
      	isStatic: true,
        label: 'boundary',
        boundaryType: 'right'
      })
    }
  }

}
