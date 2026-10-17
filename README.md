# Rent a Car API

Scout Motors ilhamlı araç kiralama frontend'i (React + TypeScript) için hazırlanmış bağımsız bir Express.js REST API. Veritabanı kullanılmıyor: araçlar `data/cars.js` içinde mock olarak, rezervasyonlar ise memory'de tutuluyor.

## Kurulum ve çalıştırma

Node.js 18.11+ gerekir (`--watch` desteği için).

```bash
npm install
npm run dev   # geliştirme: dosya değişince otomatik yeniden başlar (node --watch)
npm start     # production
```

API varsayılan olarak **http://localhost:3001** adresinde çalışır. Portu değiştirmek için: `PORT=4000 npm start`

> macOS'ta 5000 portu AirPlay Receiver tarafından kullanıldığı için 3001 seçildi.

## Proje yapısı

```text
rent-a-car-api/
├── server.js          # Express app, middleware (CORS, JSON), 404 ve error handler
├── routes/
│   ├── cars.js        # /api/cars endpoint'leri (listeleme, filtre, featured, detay)
│   ├── bookings.js    # /api/bookings endpoint'leri (validasyon + memory'de saklama)
│   └── orders.js      # /api/orders endpoint'leri (satın alma ön rezervasyonu)
├── data/
│   └── cars.js        # 12 adet arazi SUV'u (mock veri)
└── package.json
```

## Response formatı

Başarılı:

```json
{ "success": true, "data": { } }
```

Liste döndüren endpoint'lerde ek olarak `count` alanı bulunur:

```json
{ "success": true, "count": 3, "data": [ ] }
```

Hata:

```json
{ "success": false, "message": "Araç bulunamadı." }
```

Validasyon hatalarında (400) tüm hatalar `errors` dizisinde döner:

```json
{
  "success": false,
  "message": "Geçersiz rezervasyon verisi.",
  "errors": ["'email' geçerli bir e-posta adresi olmalıdır."]
}
```

## Endpoint'ler

| Method | URL | Açıklama |
| ------ | --- | -------- |
| GET | `/api/cars` | Tüm araçlar. `category`, `brand`, `search` query parametreleri birlikte kullanılabilir |
| GET | `/api/cars/featured` | `isFeatured === true` olan araçlar |
| GET | `/api/cars/:id` | Tek araç (yoksa 404) |
| POST | `/api/bookings` | Yeni rezervasyon oluşturur (201) |
| POST | `/api/orders` | Aracı satın almak için kaparo ile ön rezervasyon yapar (201) |
| GET | `/api/orders` | Satın alma ön rezervasyonlarını listeler (test kolaylığı için) |
| POST | `/api/appointments` | Showroom ziyareti veya adreste özel sunum randevusu talebi (201) |
| GET | `/api/appointments` | Randevu taleplerini listeler (test kolaylığı için) |
| GET | `/api/bookings` | Oluşturulan rezervasyonları listeler (test kolaylığı için) |

### Filtreleme

Tüm filtreler büyük/küçük harfe duyarsızdır.

- `category`: tam eşleşme (`Off-Road`, `Luxury`)
- `brand`: tam eşleşme (`Land Rover`, `Range Rover`, `Mercedes-Benz`, `Toyota`, `Jeep`, `Suzuki`, `Lexus`, `GMC`)
- `search`: araç adı, marka veya kategoride geçen metin

```
GET /api/cars?category=Off-Road
GET /api/cars?brand=Land Rover
GET /api/cars?search=defender
GET /api/cars?category=Off-Road&brand=Toyota
```

### POST /api/bookings

```json
{
  "carId": "car-1",
  "startDate": "2026-10-15",
  "endDate": "2026-10-18",
  "customerName": "Esra Bulat",
  "email": "example@email.com",
  "totalPrice": 7500
}
```

Başarılı yanıt (201): gönderilen alanlar + otomatik `id` (UUID) ve `createdAt` (ISO tarih).

Kontroller:

| Durum | Status |
| ----- | ------ |
| Eksik alan, geçersiz e-posta, `totalPrice` pozitif sayı değil, tarih `YYYY-MM-DD` değil, `startDate` geçmişte, `endDate <= startDate` | 400 |
| Bozuk JSON body | 400 |
| `carId` ile araç bulunamadı | 404 |
| Araç `isAvailable: false` (örn. `car-8`) | 409 |
| Araç seçilen tarihlerde başka bir rezervasyonla çakışıyor | 409 |

> `totalPrice` frontend'den gelen değer olarak saklanır, server tarafında yeniden hesaplanmaz.
> Rezervasyonlar memory'de tutulduğu için server yeniden başlayınca silinir.

### POST /api/orders

Aracı satın almak için ön rezervasyon. Kaparo (`deposit`) server'da satış fiyatının %2'si olarak hesaplanır; body'de gönderilse bile dikkate alınmaz.

```json
{
  "carId": "car-12",
  "customerName": "Esra Bulat",
  "email": "example@email.com",
  "phone": "0532 123 45 67"
}
```

Başarılı yanıt (201):

```json
{
  "success": true,
  "data": {
    "id": "73aff7b0-e76e-4fa2-8c6c-232318829099",
    "carId": "car-12",
    "customerName": "Esra Bulat",
    "email": "example@email.com",
    "phone": "0532 123 45 67",
    "price": 21000000,
    "deposit": 420000,
    "status": "reserved",
    "createdAt": "2026-10-09T20:43:20.975Z"
  }
}
```

Kontroller:

| Durum | Status |
| ----- | ------ |
| Eksik alan, geçersiz e-posta, telefon 10-13 rakam değil | 400 |
| `carId` ile araç bulunamadı | 404 |
| Araç `isAvailable: false` veya daha önce rezerve edilmiş | 409 |

> Rezerve edilen aracın `isAvailable` değeri `false` olur. Siparişler memory'de tutulduğu için server yeniden başlayınca hem siparişler hem araç durumları sıfırlanır.

### POST /api/appointments

VIP özel sunum randevusu. Aracı rezerve etmez (`isAvailable` değişmez); danışman müşteriyi arayıp sunumu planlar.

```json
{
  "carId": "car-1",
  "customerName": "Esra Bulat",
  "phone": "0532 123 45 67",
  "type": "showroom",
  "date": "2026-10-20",
  "timeSlot": "morning"
}
```

- `carId`: isteğe bağlı (genel showroom randevusunda boş bırakılabilir; yanıtta `null`)
- `type`: `showroom` (Showroom ziyareti) | `home` (Adresinizde özel sunum)
- `region`: sadece `home` için zorunlu; `istanbul-europe` | `istanbul-asia` | `bodrum` | `ankara`
- `address`: sadece `home` için zorunlu; adres / semt (örn. `"Sarıyer, Tarabya"`)
- `phone`: 10-11 hane (örn. `"0532 123 45 67"`)
- `timeSlot`: `morning` (Sabah) | `noon` (Öğle) | `afternoon` (Akşamüstü)
- `date`: bugünden en fazla 60 gün sonrasına kadar

Başarılı yanıt (201): gönderilen alanlar + `id`, `status: "pending"`, `createdAt`. Hatalar: 400 (validasyon), 404 (araç yok).

## Randevuların saklanması ve WhatsApp bildirimi

- Randevular `data/vanguard.db` SQLite dosyasında kalıcı tutulur (Node 22.13+ yerleşik `node:sqlite`, ek paket yok). Dosya Git'e eklenmez.
- Her yeni randevu satış ekibine **WhatsApp** ile bildirilir (Meta WhatsApp Cloud API). Bildirim arka planda gider; müşteri beklemez.
- Ayarlar `.env` dosyasından okunur: `.env.example` dosyasını `.env` olarak kopyalayıp doldurun, ardından `npm run dev`.
- Ayar yoksa randevu yine kaydedilir, mesaj metni sunucu konsoluna yazılır ve bildirim durumu `not_configured` olur.
- `GET /api/appointments` her randevunun `notification` alanında bildirim durumunu gösterir: `sent` | `failed` | `not_configured`.
- `POST /api/appointments/:id/notify` gönderilemeyen bir bildirimi yeniden dener.

### WhatsApp şablonu

İşletmenin başlattığı mesajlar için Meta onaylı bir şablon gerekir. Önerilen şablon (Kategori: *Utility*, Dil: *Turkish*):

```
Yeni özel sunum randevusu
Müşteri: {{1}}
Telefon: {{2}}
Araç: {{3}}
Hizmet: {{4}}
Yer: {{5}}
Zaman: {{6}}
```

Onaylanınca adını `WHATSAPP_TEMPLATE` olarak girin. Şablon girilmezse düz metin gönderilir; bu yalnızca alıcı son 24 saat içinde işletme numarasına yazmışsa iletilir.

## Status code'lar

| Kod | Anlam |
| --- | ----- |
| 200 | Başarılı GET |
| 201 | Rezervasyon / satın alma ön rezervasyonu oluşturuldu |
| 400 | Hatalı request / validasyon hatası |
| 404 | Araç veya endpoint bulunamadı |
| 409 | Araç müsait değil / tarih çakışması |
| 500 | Sunucu hatası |

## TypeScript tipleri (frontend için)

```ts
type Category = 'Off-Road' | 'Luxury';

interface Car {
  id: string;
  name: string;
  brand: string;
  category: Category;
  pricePerDay: number; // günlük kira (TL)
  price: number;       // satış fiyatı (TL)
  year: number;        // model yılı
  image: string;
  gallery: string[];
  specs: {
    seats: number;
    transmission: string;
    fuelType: string;
    acceleration: string;
    rangeOrHorsepower: string;
  };
  features: string[];
  /** Detay sayfası: her görselin altındaki açıklama (gallery ile aynı sırada) */
  story: { title: string; text: string }[];
  /** İsteğe bağlı: detay sayfası açılışında oynatılan video */
  video?: { src: string; srcMobile?: string; poster?: string };
  isFeatured: boolean;
  isAvailable: boolean;
}

interface Booking {
  id: string;
  carId: string;
  startDate: string;
  endDate: string;
  customerName: string;
  email: string;
  totalPrice: number;
  createdAt: string;
}

interface Order {
  id: string;
  carId: string;
  customerName: string;
  email: string;
  phone: string;
  price: number;
  deposit: number;
  status: 'reserved';
  createdAt: string;
}

type ApiSuccess<T> = { success: true; data: T; count?: number };
type ApiError = { success: false; message: string; errors?: string[] };
type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

## Görseller

Görseller Unsplash CDN'inden geliyor (hepsinin erişilebilir olduğu kontrol edildi). Her fotoğraf listedeki modelle elle eşleştirildi; bazıları modelin bir önceki kasasına ait olabilir (örn. Range Rover Sport, Land Cruiser).
