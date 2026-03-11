// Keep client-only packages out of the OpenNext server handler bundle.
// The server never executes these modules, but bundling them inflates the worker artifact.
const proxy = new Proxy(function () {}, {
  get(_target, prop) {
    if (prop === "then") return undefined;
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
