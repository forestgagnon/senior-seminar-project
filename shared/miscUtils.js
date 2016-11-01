module.exports = {
  removeCircular: function(object) {
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
};
