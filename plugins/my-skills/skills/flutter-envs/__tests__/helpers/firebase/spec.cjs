"use strict";
// The spec's own example (3.7): dev and staging share acme-dev-staging, production has acme-prod.

function shopSpec(change = (s) => s) {
  return change({
    version: 1,
    production: "production",
    environments: {
      dev: { id: "com.acme.shop.dev", name: "Shop Dev", firebase: "acme-dev-staging" },
      staging: { id: "com.acme.shop.staging", name: "Shop Staging", firebase: "acme-dev-staging" },
      production: { id: "com.acme.shop", name: "Shop", firebase: "acme-prod" },
    },
  });
}

module.exports = { shopSpec };
