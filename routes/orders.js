const express = require('express');
const { randomUUID } = require('crypto');
const cars = require('../data/cars');

const router = express.Router();

// Satın alma ön rezervasyonları şimdilik memory'de tutuluyor; server yeniden başlayınca sıfırlanır.
const orders = [];

// Ön rezervasyon kaparosu: satış fiyatının %2'si. Server'da hesaplanır, client'tan alınmaz.
const DEPOSIT_RATE = 0.02;

const REQUIRED_FIELDS = ['carId', 'customerName', 'email', 'phone'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Boşluk, tire, parantez ve baştaki + dışında 10-13 rakam (örn. 0532 123 45 67, +90 532 123 45 67)
const PHONE_REGEX = /^\+?[\d\s()-]{10,20}$/;

const validateOrder = (body) => {
  const missing = REQUIRED_FIELDS.filter(
    (field) => body[field] === undefined || body[field] === null || body[field] === ''
  );
  if (missing.length > 0) {
    return missing.map((field) => `'${field}' alanı zorunludur.`);
  }

  const errors = [];
  const { carId, customerName, email, phone } = body;

  if (typeof carId !== 'string') errors.push("'carId' string olmalıdır.");
  if (typeof customerName !== 'string' || customerName.trim().length < 2) {
    errors.push("'customerName' en az 2 karakter olmalıdır.");
  }
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    errors.push("'email' geçerli bir e-posta adresi olmalıdır.");
  }
  const digits = typeof phone === 'string' ? phone.replace(/\D/g, '') : '';
  if (typeof phone !== 'string' || !PHONE_REGEX.test(phone.trim()) || digits.length < 10 || digits.length > 13) {
    errors.push("'phone' geçerli bir telefon numarası olmalıdır.");
  }

  return errors;
};

// GET /api/orders — oluşturulan ön rezervasyonları görmek için (test kolaylığı)
router.get('/', (req, res) => {
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

// POST /api/orders — aracı satın almak için kaparo ile ön rezervasyon
router.post('/', (req, res) => {
  const body = req.body || {};

  const errors = validateOrder(body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Geçersiz rezervasyon verisi.', errors });
  }

  const car = cars.find((c) => c.id === body.carId);
  if (!car) {
    return res.status(404).json({ success: false, message: 'Araç bulunamadı.' });
  }

  if (!car.isAvailable || orders.some((o) => o.carId === car.id)) {
    return res.status(409).json({ success: false, message: 'Bu araç satışa uygun değil veya başka bir müşteri tarafından rezerve edildi.' });
  }

  const order = {
    id: randomUUID(),
    carId: car.id,
    customerName: body.customerName.trim(),
    email: body.email.trim().toLowerCase(),
    phone: body.phone.trim(),
    price: car.price,
    deposit: Math.round(car.price * DEPOSIT_RATE),
    status: 'reserved',
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  // Rezerve edilen araç listede artık müsait görünmez (memory'de; restart'ta sıfırlanır)
  car.isAvailable = false;

  res.status(201).json({ success: true, data: order });
});

module.exports = router;
