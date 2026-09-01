import express from 'express';
import path from 'path';
import flightsHandler from './api/flights.ts';

const app = express();
const PORT = 3000;

app.use(express.json());

// API route
app.all('/api/flights', flightsHandler);

// Serve static files (like index.html)
app.use(express.static(process.cwd()));

// Fallback to index.html for SPA if needed
app.use((req, res) => {
  res.sendFile(path.join(process.cwd(), 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
