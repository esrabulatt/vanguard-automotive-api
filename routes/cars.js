const express = require('express');
const cars = require('../data/cars');

const router = express.Router();

const normalize = (value) => String(value).trim().toLowerCase();

// GET /api/cars?category=SUV&brand=BMW&search=x5
router.get('/', (req, res) => {
  const { category, brand, search } = req.query;
  let result = cars;

  if (category) {
    result = result.filter((car) => normalize(car.category) === normalize(category));
  }

  if (brand) {
    result = result.filter((car) => normalize(car.brand) === normalize(brand));
  }

  if (search) {
    const term = normalize(search);
    result = result.filter((car) =>
      [car.name, car.brand, car.category].some((field) => normalize(field).includes(term))
    );
  }

  res.status(200).json({ success: true, count: result.length, data: result });
});

// GET /api/cars/featured — "/:id" route'undan önce tanımlanmalı
router.get('/featured', (req, res) => {
  const featured = cars.filter((car) => car.isFeatured);
  res.status(200).json({ success: true, count: featured.length, data: featured });
});

// GET /api/cars/:id
router.get('/:id', (req, res) => {
  const car = cars.find((c) => c.id === req.params.id);

  if (!car) {
    return res.status(404).json({ success: false, message: 'Araç bulunamadı.' });
  }

  res.status(200).json({ success: true, data: car });
});

module.exports = router;
