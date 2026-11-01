   // Point d'entrée Vercel : l'application Express est exportée, Vercel s'occupe du serveur.
   // L'import direct d'express est nécessaire : Vercel s'en sert pour détecter ce fichier.
   import express from 'express';
   import app from './server/app.js';

   export { express };
   export default app;