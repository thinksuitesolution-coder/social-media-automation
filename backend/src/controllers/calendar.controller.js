const { db, convertDoc, snapToArr } = require('../utils/firebase');
const geminiService = require('../services/gemini.service');

async function generateCalendar(req, res, next) {
  try {
    const uid = req.user.uid;
    const { clientId, month, year } = req.body;
    if (!clientId || !month || !year) return res.status(400).json({ error: 'clientId, month, year required' });

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists || clientDoc.data().userId !== uid) return res.status(404).json({ error: 'Client not found' });
    const client = convertDoc(clientDoc);

    const calId = `${uid}_${clientId}_${month}_${year}`;
    const existing = await db.collection('socialCalendars').doc(calId).get();
    if (existing.exists) {
      // Delete existing calendar days and posts before regenerating
      const daysSnap = await db.collection('socialCalendarDays').where('calendarId', '==', calId).get();
      const delBatch = db.batch();
      for (const day of daysSnap.docs) {
        delBatch.delete(day.ref);
        delBatch.delete(db.collection('socialPosts').doc(day.id));
      }
      delBatch.delete(db.collection('socialCalendars').doc(calId));
      await delBatch.commit();
    }

    const days = await geminiService.generateCalendar({
      brandName: client.name, niche: client.niche, tone: client.tone,
      targetAudience: client.targetAudience, month: Number(month), year: Number(year),
      brandInfo: client.brandInfo || null,
    });

    await db.collection('socialCalendars').doc(calId).set({
      id: calId, calendarId: calId, userId: uid, clientId,
      month: Number(month), year: Number(year), createdAt: new Date().toISOString(),
    });

    const batch = db.batch();
    const savedDays = [];
    for (const d of days) {
      const dayRef = db.collection('socialCalendarDays').doc();
      const dayData = {
        id: dayRef.id, calendarId: calId, userId: uid, clientId,
        date: d.date,
        topic: d.topic, theme: d.theme, contentType: d.contentType,
        postingTime: d.postingTime, createdAt: new Date().toISOString(),
      };
      batch.set(dayRef, dayData);
      savedDays.push(dayData);
    }
    await batch.commit();

    res.status(201).json({
      calendarId: calId, userId: uid, clientId, month: Number(month), year: Number(year),
      days: savedDays.sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (err) { next(err); }
}

async function getCalendar(req, res, next) {
  try {
    const uid = req.user.uid;
    const { clientId, month, year } = req.params;
    const calId = `${uid}_${clientId}_${month}_${year}`;

    const calDoc = await db.collection('socialCalendars').doc(calId).get();
    if (!calDoc.exists) return res.status(404).json({ error: 'Calendar not found' });

    const daysSnap = await db.collection('socialCalendarDays')
      .where('calendarId', '==', calId)
      .orderBy('date', 'asc')
      .get();

    const days = snapToArr(daysSnap);

    const daysWithPosts = await Promise.all(days.map(async (day) => {
      const postDoc = await db.collection('socialPosts').doc(day.id).get();
      return { ...day, post: postDoc.exists ? convertDoc(postDoc) : null };
    }));

    res.json({ ...convertDoc(calDoc), days: daysWithPosts });
  } catch (err) { next(err); }
}

async function updateCalendarDay(req, res, next) {
  try {
    const uid = req.user.uid;
    const ref = db.collection('socialCalendarDays').doc(req.params.dayId);
    const doc = await ref.get();
    if (!doc.exists || doc.data().userId !== uid) return res.status(404).json({ error: 'Day not found' });

    const { topic, theme, contentType, postingTime, date } = req.body;
    const update = { updatedAt: new Date().toISOString() };
    if (topic) update.topic = topic;
    if (theme) update.theme = theme;
    if (contentType) update.contentType = contentType;
    if (postingTime) update.postingTime = postingTime;
    if (date) update.date = date;

    await ref.update(update);
    res.json(convertDoc(await ref.get()));
  } catch (err) { next(err); }
}

async function deleteCalendar(req, res, next) {
  try {
    const uid = req.user.uid;
    const { clientId, month, year } = req.params;
    const calId = `${uid}_${clientId}_${month}_${year}`;

    const calDoc = await db.collection('socialCalendars').doc(calId).get();
    if (!calDoc.exists) return res.status(404).json({ error: 'Calendar not found' });

    const daysSnap = await db.collection('socialCalendarDays').where('calendarId', '==', calId).get();
    const batch = db.batch();
    for (const day of daysSnap.docs) {
      batch.delete(day.ref);
      batch.delete(db.collection('socialPosts').doc(day.id));
    }
    batch.delete(db.collection('socialCalendars').doc(calId));
    await batch.commit();

    res.json({ message: 'Calendar deleted' });
  } catch (err) { next(err); }
}

module.exports = { generateCalendar, getCalendar, updateCalendarDay, deleteCalendar };
