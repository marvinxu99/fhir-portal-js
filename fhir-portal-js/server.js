// server.js
const express = require('express');
const path = require('path');
const session = require('express-session'); 
const https = require('https');
const fs = require('fs');
const axios = require('axios');
const querystring = require('querystring');


const app = express();

// Load SSL certificate and key
const sslOptions = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

// Initialize express-session middleware
app.use(session({
  secret: 'your_secret_key',  // Use a strong secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }   // Set secure to true if using HTTPS
}));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));


// Route for the OAuth callback page
app.get('/callback', (req, res) => {
  res.sendFile(path.join(__dirname, 'callback.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
const port = process.env.PORT || 3000;
https.createServer(sslOptions, app).listen(port, () => {
  console.log(`Server running with HTTPS on https://localhost:${port}`);
});
