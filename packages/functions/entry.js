const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const express = require('express');
const apiRoutes = require('virtual:api-routes');

initializeApp();

const createApp = (routes) => {
  const app = express();
  app.use(express.json());
  routes.forEach((route) => app.all(route.path, route.handler));
  return app;
};

const standalone = apiRoutes.filter((r) => r.handler.__config);
const merged = apiRoutes.filter((r) => !r.handler.__config);

if (merged.length > 0) {
  exports.api = onRequest({ memory: '256MiB' }, createApp(merged));
}

standalone.forEach((route) => {
  exports[route.functionName] = onRequest(route.handler.__config, createApp([route]));
});
