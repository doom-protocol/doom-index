// Universal stub for excluding heavy/browser-only libraries from the server bundle.
// This proxy handles any property access, function call, or constructor call.
const proxy = new Proxy(function () {}, {
  get(_target, prop) {
    if (prop === "then") return undefined; // Prevent promise resolution loops
    if (prop === "default") return proxy;
    return proxy;
  },
  apply() {
    return proxy;
  },
  construct() {
    return proxy;
  },
});

module.exports = proxy;
