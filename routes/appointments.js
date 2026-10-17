const express = require('express');
const { randomUUID } = require('crypto');
const cars = require('../data/cars');
const db = require('../lib/db');
const { notifyAppointment } = require('../lib/whatsapp');

const router = express.Router();

// Özel sunum randevuları SQLite'ta (data/vanguard.db) kalıcı tutulur; her yeni randevu ekibe WhatsApp'tan bildirilir.
// Randevu aracı rezerve etmez; danışman müşteriyi arayıp sunumu planlar.

const TYPES = ['showroom', 'home'];
const TIME_SLOTS = ['morning', 'noon', 'afternoon'];
const REGIONS = ['istanbul-europe', 'istanbul-asia', 'bodrum', 'ankara'];
const MAX_DAYS_AHEAD = 60;
// carId isteğe bağlı: sitedeki genel 'Özel Sunum' randevusunda müşteri henüz model seçmemiş olabilir
const REQUIRED_FIELDS = ['customerName', 'phone', 'type', 'date', 'timeSlot'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_REGEX = /^\+?[\d\s()-]{10,20}$/;

const isValidDate = (value) => {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const validateAppointment = (body) => {
  const missing = REQUIRED_FIELDS.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
  if (missing.length > 0) return missing.map((field) => `'${field}' alanı zorunludur.`);

  const errors = [];
  const { carId, customerName, phone, type, date, timeSlot } = body;

  if (carId !== undefined && carId !== null && typeof carId !== 'string') errors.push("'carId' string olmalıdır.");
  if (typeof customerName !== 'string' || customerName.trim().length < 2) {
    errors.push("'customerName' en az 2 karakter olmalıdır.");
  }
  const digits = typeof phone === 'string' ? phone.replace(/\D/g, '') : '';
  if (typeof phone !== 'string' || !PHONE_REGEX.test(phone.trim()) || digits.length < 10 || digits.length > 11) {
    errors.push("'phone' geçerli bir telefon numarası olmalıdır.");
  }
  if (!TYPES.includes(type)) errors.push(`'type' şunlardan biri olmalıdır: ${TYPES.join(', ')}.`);
  // Adreste sunumda bölge ve adres / semt zorunludur
  if (type === 'home') {
    if (!REGIONS.includes(body.region)) errors.push(`'region' şunlardan biri olmalıdır: ${REGIONS.join(', ')}.`);
    if (typeof body.address !== 'string' || body.address.trim().length < 3) {
      errors.push("'address' adreste sunum için zorunludur (en az 3 karakter, örn. 'Sarıyer, Tarabya').");
    }
  }
  if (!TIME_SLOTS.includes(timeSlot)) errors.push(`'timeSlot' şunlardan biri olmalıdır: ${TIME_SLOTS.join(', ')}.`);

  if (!isValidDate(date)) {
    errors.push("'date' YYYY-MM-DD formatında geçerli bir tarih olmalıdır.");
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const last = new Date(Date.now() + MAX_DAYS_AHEAD * 86400000).toISOString().slice(0, 10);
    if (date < today) errors.push("'date' geçmiş bir tarih olamaz.");
    if (date > last) errors.push(`'date' en fazla ${MAX_DAYS_AHEAD} gün sonrası olabilir.`);
  }

  return errors;
};

// GET /api/appointments — oluşturulan randevuları görmek için (test kolaylığı)
router.get('/', (req, res) => {
  const appointments = db.listAppointments();
  res.status(200).json({ success: true, count: appointments.length, data: appointments });
});

// POST /api/appointments — showroom ziyareti veya adreste özel sunum talebi
router.post('/', (req, res) => {
  const body = req.body || {};

  const errors = validateAppointment(body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Geçersiz randevu verisi.', errors });
  }

  const car = body.carId ? cars.find((c) => c.id === body.carId) : null;
  if (body.carId && !car) {
    return res.status(404).json({ success: false, message: 'Araç bulunamadı.' });
  }

  const appointment = {
    id: randomUUID(),
    carId: car ? car.id : null,
    customerName: body.customerName.trim(),
    phone: body.phone.trim(),
    type: body.type,
    date: body.date,
    timeSlot: body.timeSlot,
    ...(body.type === 'home' ? { region: body.region, address: body.address.trim() } : {}),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  db.insertAppointment(appointment);
  // Müşteriyi bekletmemek için yanıt hemen döner; bildirim arka planda gönderilir ve sonucu kaydedilir
  res.status(201).json({ success: true, data: appointment });
  notifyAppointment(appointment)
    .then(({ status, error }) => db.setNotification(appointment.id, status, error))
    .catch((err) => db.setNotification(appointment.id, 'failed', err.message));
});

// POST /api/appointments/:id/notify — gönderilemeyen bir bildirimi yeniden dener
router.post('/:id/notify', async (req, res) => {
  const appointment = db.getAppointment(req.params.id);
  if (!appointment) return res.status(404).json({ success: false, message: 'Randevu bulunamadı.' });
  const result = await notifyAppointment(appointment);
  db.setNotification(appointment.id, result.status, result.error);
  res.status(result.status === 'sent' ? 200 : 502).json({ success: result.status === 'sent', data: result });
});

module.exports = router;
