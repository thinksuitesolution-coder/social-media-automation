const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, convertDoc, snapToArr } = require('../utils/firebase');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const snap = await db.collection('admins').where('email', '==', email).limit(1).get();
    if (snap.empty) return res.status(401).json({ error: 'Invalid credentials' });

    const admin = convertDoc(snap.docs[0]);
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, admin: { id: admin.id, email: admin.email } });
  } catch (err) { next(err); }
}

async function me(req, res, next) {
  try {
    const doc = await db.collection('admins').doc(req.admin.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const { password, ...rest } = convertDoc(doc);
    res.json(rest);
  } catch (err) { next(err); }
}

module.exports = { login, me };
