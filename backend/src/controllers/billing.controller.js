const { db, admin, snapToArr, convertDoc } = require('../utils/firebase');

const PLANS = {
  STARTER: { price: 2999, maxClients: 3, maxPosts: 90, maxUsers: 2, maxAccounts: 6, aiCredits: 500 },
  PRO:     { price: 5999, maxClients: 10, maxPosts: 300, maxUsers: 5, maxAccounts: 20, aiCredits: 2000 },
  AGENCY:  { price: 12999, maxClients: 50, maxPosts: 1500, maxUsers: 20, maxAccounts: 100, aiCredits: 10000 },
};

// GET /billing/subscription
async function getSubscription(req, res) {
  try {
    const { uid: userId } = req.user;
    const snap = await db.collection('socialSubscriptions')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snap.empty) {
      // Auto create trial subscription
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      const docRef = await db.collection('socialSubscriptions').add({
        userId, planId: 'STARTER', status: 'TRIAL',
        trialEndsAt: admin.firestore.Timestamp.fromDate(trialEnd),
        currentPeriodStart: admin.firestore.FieldValue.serverTimestamp(),
        currentPeriodEnd: admin.firestore.Timestamp.fromDate(trialEnd),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const doc = await docRef.get();
      return res.json({ subscription: convertDoc(doc) });
    }
    res.json({ subscription: convertDoc(snap.docs[0]) });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /billing/usage
async function getUsage(req, res) {
  try {
    const { uid: userId } = req.user;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [clientsSnap, postsSnap, aiSnap] = await Promise.all([
      db.collection('socialClients').where('userId', '==', userId).get(),
      db.collection('socialPosts').where('userId', '==', userId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfMonth)).get(),
      db.collection('socialAIUsage').where('userId', '==', userId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfMonth)).get(),
    ]);

    const aiUsage = snapToArr(aiSnap);
    const aiCreditsUsed = aiUsage.reduce((sum, u) => sum + (u.credits || 1), 0);

    res.json({
      usage: {
        activeClients: clientsSnap.size,
        postsCreated: postsSnap.size,
        aiCreditsUsed,
        apiCalls: aiUsage.length,
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /billing/invoices
async function getInvoices(req, res) {
  try {
    const { uid: userId } = req.user;
    const snap = await db.collection('socialInvoices')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(12)
      .get();
    res.json({ invoices: snapToArr(snap) });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /billing/upgrade
async function upgrade(req, res) {
  try {
    const { uid: userId } = req.user;
    const { planId } = req.body;

    if (!PLANS[planId]) return res.status(400).json({ error: 'Invalid plan' });

    const plan = PLANS[planId];

    // In production: create Razorpay order here
    // const Razorpay = require('razorpay');
    // const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    // const order = await razorpay.orders.create({ amount: plan.price * 100, currency: 'INR', receipt: `sub_${userId}_${Date.now()}` });

    // For now, return mock order (replace with real Razorpay in production)
    const mockOrderId = `order_${Date.now()}`;

    // Log upgrade intent
    await db.collection('socialBillingEvents').add({
      userId, type: 'UPGRADE_INTENT',
      planId, amount: plan.price,
      orderId: mockOrderId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      razorpayOrderId: mockOrderId,
      amount: plan.price * 100,
      currency: 'INR',
      planId,
      paymentLink: `Contact support to complete upgrade to ${planId}`,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { getSubscription, getUsage, getInvoices, upgrade };
