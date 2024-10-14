const express = require('express');
const path = require('path');
const session = require('express-session'); 
const https = require('https');
const fs = require('fs');
const axios = require('axios');
const querystring = require('querystring');

const app = express();

// Constants for SMART on FHIR
const clientId = '0f6f1b7b-0612-428a-8c05-832e5c14ad99';     // SmartTest-Provider(2-localhost)
const clientSecret = 'YOUR_CLIENT_SECRET';                    // Replace with your actual client secret
const redirectUri = 'https://localhost:3000/callback';
const fhirBaseUrl = 'https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d';
const authBaseUrl = 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/provider/authorize';
const tokenUrl = 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/hosts/api.cernermillennium.com/protocols/oauth2/profiles/smart-v1/token';
const RANDOM_STATE_STRING = 'ABC1234';  // You should generate a new random state string for security

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

// Route to start the OAuth2 authorization process (Launch SMART on FHIR)
app.get('/launch', (req, res) => {
  // Typically, the `launch` parameter is passed when the app is launched from the EHR
  const launch = req.query.launch || 'mockLaunchContext'; // Replace with the actual launch context if applicable

  const authUrl = `${authBaseUrl}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=launch profile fhirUser openid patient/Patient.read&state=${RANDOM_STATE_STRING}&launch=${launch}&aud=${encodeURIComponent(fhirBaseUrl)}`;
  
  res.redirect(authUrl);
});

// Route for handling the OAuth2 callback
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  // Validate the state parameter (make sure it matches the original one sent)
  if (state !== RANDOM_STATE_STRING) {
    return res.status(400).send('Invalid state parameter');
  }

  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    // Exchange the authorization code for an access token
    const tokenResponse = await axios.post(tokenUrl, querystring.stringify({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;

    // Use the access token to make FHIR API calls
    const patientDataResponse = await axios.get(`${fhirBaseUrl}/Patient/12345`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // Display patient data
    res.json(patientDataResponse.data);

  } catch (error) {
    console.error('Error during token exchange or FHIR API call:', error);
    res.status(500).send('Token exchange or API call failed');
  }
});

// Route for the OAuth callback page (to display loading or error message in case of failure)
app.get('/callback', (req, res) => {
  res.sendFile(path.join(__dirname, 'callback.html'));
});

// Route for the main app (root)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the HTTPS server
const port = process.env.PORT || 3000;
https.createServer(sslOptions, app).listen(port, () => {
  console.log(`Server running with HTTPS on https://localhost:${port}`);
});
