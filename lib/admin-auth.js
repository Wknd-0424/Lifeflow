const { createHash, createHmac, randomBytes, timingSafeEqual } = require('node:crypto');

const cookieName = 'lifeflow_admin';
const sessionSeconds = 8 * 60 * 60;
const digest = value => createHash('sha256').update(value).digest();
const sign = (value, password) => createHmac('sha256', password)
  .update('lifeflow-admin-session:' + value).digest('base64url');

function validSession(req, password) {
  const cookie = req.headers?.cookie?.split(';').map(value => value.trim())
    .find(value => value.startsWith(cookieName + '='));
  const token = cookie?.slice(cookieName.length + 1) || '';
  const match = /^(\d{10,13}\.[\w-]{32})\.([\w-]{43})$/.exec(token);
  if (!match || Number(match[1].split('.')[0]) <= Date.now()) return false;
  return timingSafeEqual(Buffer.from(match[2]), Buffer.from(sign(match[1], password)));
}

function authorize(req, res, route, json, { body, secure = false } = {}) {
  const password = process.env.LIFEFLOW_ADMIN_PASSWORD;
  if (!password || password.length < 20) {
    if (route === '/api/login') {
      json(503, { error: 'Admin login is unavailable. Configure LIFEFLOW_ADMIN_PASSWORD with at least 20 characters.' });
    } else {
      json(401, { error: 'Sign in to access LifeFlow.' });
    }
    return false;
  }

  if (req.method === 'POST' &&
      (['cross-site', 'same-site'].includes(req.headers?.['sec-fetch-site']) ||
       req.headers?.['content-type']?.split(';')[0] !== 'application/json')) {
    json(403, { error: 'Request blocked.' });
    return false;
  }

  const setCookie = (value, age) => res.setHeader('Set-Cookie',
    `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`);

  if (req.method === 'POST' && route === '/api/login') {
    const supplied = body?.password;
    if (typeof supplied !== 'string' || supplied.length > 1024 ||
        !timingSafeEqual(digest(supplied), digest(password))) {
      json(401, { error: 'Incorrect admin password.' });
    } else {
      const value = `${Date.now() + sessionSeconds * 1000}.${randomBytes(24).toString('base64url')}`;
      setCookie(`${value}.${sign(value, password)}`, sessionSeconds);
      json(200, { ok: true });
    }
    return false;
  }
  if (!validSession(req, password)) {
    json(401, { error: 'Sign in to access LifeFlow.' });
    return false;
  }
  if (req.method === 'POST' && route === '/api/logout') {
    setCookie('', 0);
    json(200, { ok: true });
    return false;
  }
  return true;
}

module.exports = { authorize };
