// Universal stub for excluding heavy libraries from server bundle
// This proxy handles any property access, function call, or constructor call
const proxy = new Proxy(function () {}, {
  get (target, prop) {
    if (prop === "then") return undefined; // Prevent promise resolution loops
    if (prop === "default") return proxy;
    return proxy;
  },
  apply () {
    return proxy;
  },
  construct () {
    return proxy;
  },
});

module.exports = proxy;
