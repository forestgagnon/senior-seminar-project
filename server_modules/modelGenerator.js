const m = require('matter-js');

module.exports = {
  createPlayerModel(id) {
    return m.Bodies.circle(0, 0, 20, {
      mass: 20,
      label: id
    });
  }

}
