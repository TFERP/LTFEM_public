import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Issuer, generators } from 'openid-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const SESSION_MAX_AGE_DAYS = Number(process.env.SESSION_MAX_AGE_DAYS || 1);

const {
  ENTRA_TENANT_ID,
  ENTRA_CLIENT_ID,
  ENTRA_CLIENT_SECRET,
  ENTRA_REDIRECT_URI,
  SESSION_SECRET,
} = process.env;

for (const [name, value] of Object.entries({
  ENTRA_TENANT_ID,
  ENTRA_CLIENT_ID,
  ENTRA_CLIENT_SECRET,
  ENTRA_REDIRECT_URI,
  SESSION_SECRET,
})) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}

const issuer = await Issuer.discover(
  `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0`
);
const client = new issuer.Client({
  client_id: ENTRA_CLIENT_ID,
  client_secret: ENTRA_CLIENT_SECRET,
  redirect_uris: [ENTRA_REDIRECT_URI],
  response_types: ['code'],
});

const app = express();
app.set('trust proxy', 1);

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    },
  })
);

app.get('/health', (req, res) => res.status(200).send('ok'));

app.get('/login', (req, res) => {
  const state = generators.state();
  const nonce = generators.nonce();
  req.session.state = state;
  req.session.nonce = nonce;
  const authUrl = client.authorizationUrl({
    scope: 'openid profile email',
    state,
    nonce,
  });
  res.redirect(authUrl);
});

app.get('/oauth2callback', async (req, res, next) => {
  try {
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(ENTRA_REDIRECT_URI, params, {
      state: req.session.state,
      nonce: req.session.nonce,
    });
    const claims = tokenSet.claims();
    req.session.user = {
      name: claims.name,
      email: claims.preferred_username || claims.email,
    };
    delete req.session.state;
    delete req.session.nonce;
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.use((req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
});

app.use(express.static(path.join(__dirname, '..', 'docs')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on port ${PORT}`);
});
