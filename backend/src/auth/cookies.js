const cookie = require('cookie');
const { config } = require('../config/env');

const { cookieName, secureCookies } = config.session;

const baseOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: secureCookies,
  path: '/'
};

const readSessionId = (cookieHeader) => {
  if (!cookieHeader) return null;
  return cookie.parse(cookieHeader)[cookieName] || null;
};

const setSessionCookie = (res, sessionId, ttlSeconds) => {
  res.cookie(cookieName, sessionId, { ...baseOptions, maxAge: ttlSeconds * 1000 });
};

const clearSessionCookie = (res) => {
  res.clearCookie(cookieName, baseOptions);
};

module.exports = { readSessionId, setSessionCookie, clearSessionCookie };
