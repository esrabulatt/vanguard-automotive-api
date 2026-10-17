const express = require('express');
const { randomUUID } = require('crypto');
const cars = require('../data/cars');

const router = express.Router();

// Rezervasyonlar şimdilik memory'de tutuluyor; server yeniden başlayınca sıfırlanır.
const bookings = [];

const REQUIRED_FIELDS = ['carId', 'startDate', 'endDate', 'customerName', 'email', 'totalPrice'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "YYYY-MM-DD" formatında ve takvimde gerçekten var olan bir tarih mi? (örn. 2026-02-30 geçersiz)
const isValidDate = (value) => {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const validateBooking = (body) => {
  const missing = REQUIRED_FIELDS.filter(
    (field) => body[field] === undefined || body[field] === null || body[field] === ''
  );
  if (missing.length > 0) {
    return missing.map((field) => `'${field}' alanı zorunludur.`);
  }

  const errors = [];
  const { carId, startDate, endDate, customerName, email, totalPrice } = body;

  if (typeof carId !== 'string') errors.push("'carId' string olmalıdır.");
  if (typeof customerName !== 'string' || customerName.trim().length < 2) {
    errors.push("'customerName' en az 2 karakter olmalıdır.");
  }
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    errors.push("'email' geçerli bir e-posta adresi olmalıdır.");
  }
  if (typeof totalPrice !== 'number' || !Number.isFinite(totalPrice) || totalPrice <= 0) {
    errors.push("'totalPrice' pozitif bir sayı olmalıdır.");
  }

  const startValid = isValidDate(startDate);
  const endValid = isValidDate(endDate);
  if (!startValid) errors.push("'startDate' YYYY-MM-DD formatında geçerli bir tarih olmalıdır.");
  if (!endValid) errors.push("'endDate' YYYY-MM-DD formatında geçerli bir tarih olmalıdır.");

  if (startValid && endValid) {
    const today = new Date().toISOString().slice(0, 10);
    if (startDate < today) errors.push("'startDate' geçmiş bir tarih olamaz.");
    if (endDate <= startDate) errors.push("'endDate', 'startDate' tarihinden sonra olmalıdır.");
  }

  return errors;
};

// GET /api/bookings — oluşturulan rezervasyonları görmek için (test kolaylığı)
router.get('/', (req, res) => {
  res.status(200).json({ success: true, count: bookings.length, data: bookings });
});

// POST /api/bookings
router.post('/', (req, res) => {
  const body = req.body || {};

  const errors = validateBooking(body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Geçersiz rezervasyon verisi.', errors });
  }

  const car = cars.find((c) => c.id === body.carId);
  if (!car) {
    return res.status(404).json({ success: false, message: 'Araç bulunamadı.' });
  }

  if (!car.isAvailable) {
    return res.status(409).json({ success: false, message: 'Bu araç şu anda kiralamaya uygun değil.' });
  }

  // Aynı araç için tarih çakışması kontrolü (iade günü yeni bir kiralamanın başlangıcı olabilir)
  const hasOverlap = bookings.some(
    (b) => b.carId === car.id && body.startDate < b.endDate && b.startDate < body.endDate
  );
  if (hasOverlap) {
    return res.status(409).json({ success: false, message: 'Araç seçilen tarihlerde zaten rezerve edilmiş.' });
  }

  const booking = {
    id: randomUUID(),
    carId: car.id,
    startDate: body.startDate,
    endDate: body.endDate,
    customerName: body.customerName.trim(),
    email: body.email.trim().toLowerCase(),
    totalPrice: body.totalPrice,
    createdAt: new Date().toISOString(),
  };

  bookings.push(booking);

  res.status(201).json({ success: true, data: booking });
});

module.exports = router;
