const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

exports.db = getFirestore();

exports.withExpress = (handler) => handler;
