import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

export const db = getFirestore();

export const withExpress = (handler, config) => {
  if (config) handler.__config = config;
  return handler;
};
