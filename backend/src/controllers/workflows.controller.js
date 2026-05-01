const { db, admin, snapToArr, convertDoc } = require('../utils/firebase');

// GET /workflows/:clientId
async function getWorkflows(req, res) {
  try {
    const { clientId } = req.params;
    const { userId } = req.user;
    const snap = await db.collection('socialWorkflows')
      .where('clientId', '==', clientId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json({ workflows: snapToArr(snap) });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /workflows
async function createWorkflow(req, res) {
  try {
    const { userId } = req.user;
    const { clientId, name, isDefault, steps } = req.body;

    // If setting as default, unset others
    if (isDefault) {
      const existing = await db.collection('socialWorkflows')
        .where('clientId', '==', clientId)
        .where('isDefault', '==', true)
        .get();
      const batch = db.batch();
      existing.docs.forEach((d) => batch.update(d.ref, { isDefault: false }));
      await batch.commit();
    }

    const docRef = await db.collection('socialWorkflows').add({
      clientId, userId, name,
      isDefault: isDefault || false,
      steps: steps || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: docRef.id, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// PUT /workflows/:id/default
async function setDefault(req, res) {
  try {
    const { id } = req.params;
    const doc = await db.collection('socialWorkflows').doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const wf = doc.data();

    // Unset all others for this client
    const existing = await db.collection('socialWorkflows')
      .where('clientId', '==', wf.clientId)
      .where('isDefault', '==', true)
      .get();
    const batch = db.batch();
    existing.docs.forEach((d) => batch.update(d.ref, { isDefault: false }));
    batch.update(db.collection('socialWorkflows').doc(id), { isDefault: true });
    await batch.commit();

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// DELETE /workflows/:id
async function deleteWorkflow(req, res) {
  try {
    const { id } = req.params;
    await db.collection('socialWorkflows').doc(id).delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { getWorkflows, createWorkflow, setDefault, deleteWorkflow };
