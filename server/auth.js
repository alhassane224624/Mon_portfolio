import crypto from 'node:crypto';

const SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const TTL_MS = 1000 * 60 * 60 * 8; // 8 heures

const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function createToken() {
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp: Date.now() + TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
}

export function checkPassword(password) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = crypto.createHash('sha256').update(String(password)).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function requireAdmin(req, res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!verifyToken(token)) return res.status(401).json({ error: 'Non autorisé' });
  next();
}

// Limiteur de débit simple en mémoire : `max` requêtes par `windowMs` et par IP.
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  // Purge périodique des IP inactives pour éviter que la Map grossisse indéfiniment.
  setInterval(() => {
    const now = Date.now();
    for (const [ip, times] of hits) if (!times.some((t) => now - t < windowMs)) hits.delete(ip);
  }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      res.set('Retry-After', String(Math.ceil((windowMs - (now - recent[0])) / 1000)));
      return res.status(429).json({ error: 'Trop de requêtes, réessayez plus tard.' });
    }
    recent.push(now);
    hits.set(req.ip, recent);
    next();
  };
}
