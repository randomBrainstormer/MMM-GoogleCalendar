const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const http = require('http');
const destroyer = require('server-destroy');

console.log('Starting authorization process...');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PATH = 'token.json';

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) {
    console.log('Error loading client secret file:', err);
    return;
  }
  console.log('Successfully loaded credentials.json');
  authorize(JSON.parse(content), listEvents);
});

// Authorize function
function authorize(credentials, callback) {
  console.log('Authorizing with provided credentials...');
  const { client_secret, client_id, redirect_uris = [] } = credentials.installed || credentials.web || {};
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  console.log('Checking for existing token...');
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) {
      console.log('No existing token found, requesting new access token...');
      return getAccessToken(oAuth2Client, callback, redirect_uris); // Fetch new token if not available
    }
    console.log('Token found, proceeding...');
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

// Get Access Token function
function getAccessToken(oAuth2Client, callback, redirect_uris) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Generated auth URL:', authUrl);

  // Desktop app flow (localhost)
  const server = http.createServer(async (req, res) => {
    console.log(`Incoming request: ${req.method} ${req.url}`); // Log incoming requests
    try {
      if (req.url.startsWith('/')) { // Accept any path
        console.log(`Handling callback for: ${req.url}`);
        const qs = new URL(req.url, `http://localhost:${req.socket.localPort}`).searchParams;
        res.end('Authentication successful! Please return to the console.');
        server.destroy();
        const { tokens } = await oAuth2Client.getToken(qs.get('code'));
        oAuth2Client.setCredentials(tokens);
        fs.writeFile(TOKEN_PATH, JSON.stringify(tokens), (err) => {
          if (err) console.error(err);
          console.log('Token stored to', TOKEN_PATH);
        });
        callback(oAuth2Client);
      }
    } catch (e) {
      console.error(e);
    }
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
  });

  server.listen(80, () => {
    console.log('Server listening at http://localhost');
    console.log('Opening browser for authorization:', authUrl);
    import('open').then((open) => {
      open.default(authUrl);
      console.log(`If the browser does not open, visit this URL: ${authUrl}`);
    });
  });
  destroyer(server);
}

// List events to confirm authorization
function listEvents(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  calendar.calendarList.list({}, (err, res) => {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    const calendars = res.data.items;
    if (calendars.length) {
      console.log('Your calendars:');
      calendars.forEach((cal) => console.log(`- ${cal.summary} (ID: ${cal.id})`));
    } else {
      console.log('No calendars found.');
    }
  });
}
