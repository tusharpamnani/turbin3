import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
dotenv.config();
import { monitor as positionMonitor } from './positionMonitor';
import { matchingService } from './matchingService';


const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});



app.get('/health', (_req, res) => {
  res.status(200).json({ 
    status: 'OK',
    services: {
      orderMatching: true,
      positionMonitor: positionMonitor.isRunning || false,
    }
  });
});

const server = app.listen(PORT, () => {

  console.log('Starting background services...');


  positionMonitor.start().then(() => {
    console.log('Position monitor started successfully');
  }).catch((err) => {
    console.error('Error starting position monitor:', err);
  });
  
  matchingService.start().then(() => {
    console.log('Matching service started successfully');
  }).catch((err) => {
    console.error('Error starting matching service:', err);
  });
  
});

process.on('SIGINT', async () => {
  console.log('Shutting down server...');

  positionMonitor.stop();
  matchingService.stop();

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
}); 