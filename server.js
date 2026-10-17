const express = require('express');
const cors = require('cors');

const carsRouter = require('./routes/cars');
const bookingsRouter = require('./routes/bookings');
const ordersRouter = require('./routes/orders');
const appointmentsRouter = require('./routes/appointments');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'Vanguard Automotive API',
      endpoints: ['GET /api/cars', 'GET /api/cars/featured', 'GET /api/cars/:id', 'POST /api/bookings', 'GET /api/orders', 'POST /api/orders', 'GET /api/appointments', 'POST /api/appointments', 'POST /api/appointments/:id/notify'],
    },
  });
});

// Routes
app.use('/api/cars', carsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/appointments', appointmentsRouter);

// Bilinmeyen route'lar
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Endpoint bulunamadı: ${req.method} ${req.originalUrl}` });
});

// Genel error handler
app.use((err, req, res, next) => {
  // express.json() bozuk JSON body aldığında
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Geçersiz JSON formatı.' });
  }

  console.error(err);
  res.status(err.status || 500).json({ success: false, message: 'Sunucu hatası oluştu.' });
});

// Vercel uygulamayı kendisi çalıştırır; yerelde sunucuyu biz başlatırız
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚗 Vanguard Automotive API çalışıyor: http://localhost:${PORT}`);
  });
}

module.exports = app;
