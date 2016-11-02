module.exports = {
  removeCircular(object) {
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
  },

  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  },

  getRandom(min, max) {
    return Math.random() * (max - min) + min;
  }
};
