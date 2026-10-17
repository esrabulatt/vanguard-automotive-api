// Yeni randevularda satış ekibine WhatsApp bildirimi (Meta WhatsApp Cloud API).
// Ayarlar .env dosyasından okunur; eksikse mesaj gönderilmez, randevu yine de kaydedilir.
const cars = require('../data/cars');

const TYPE_LABELS = { showroom: 'Showroom Ziyareti', home: 'Adresinizde Özel Sunum' };
const SLOT_LABELS = { morning: 'Sabah (09-12)', noon: 'Öğle (12-15)', afternoon: 'Akşamüstü (15-19)' };
const REGION_LABELS = {
  'istanbul-europe': 'İstanbul (Avrupa)',
  'istanbul-asia': 'İstanbul (Anadolu)',
  bodrum: 'Bodrum',
  ankara: 'Ankara',
};

const config = () => ({
  token: process.env.WHATSAPP_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  // Bildirimin gideceği numara(lar), ülke koduyla ve virgülle: 905321234567,905441234567
  to: (process.env.WHATSAPP_NOTIFY_TO || '').split(',').map((n) => n.replace(/\D/g, '')).filter(Boolean),
  // Meta'da onaylı şablon adı. Boşsa düz metin gönderilir (yalnızca alıcı son 24 saatte numaraya yazdıysa iletilir)
  template: process.env.WHATSAPP_TEMPLATE,
  templateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'tr',
  apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
});

const isConfigured = () => {
  const c = config();
  return Boolean(c.token && c.phoneNumberId && c.to.length);
};

const formatDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

/** Şablon değişkenleri ve düz metin için ortak alanlar */
const fields = (a) => {
  const car = a.carId ? cars.find((c) => c.id === a.carId) : null;
  return {
    customer: a.customerName,
    phone: a.phone,
    car: car ? `${car.brand} ${car.name}` : 'Model seçilmedi',
    service: TYPE_LABELS[a.type] || a.type,
    when: `${formatDate(a.date)} · ${SLOT_LABELS[a.timeSlot] || a.timeSlot}`,
    place: a.type === 'home' ? `${REGION_LABELS[a.region] || a.region} / ${a.address}` : 'Vadistanbul Showroom',
  };
};

const textMessage = (a) => {
  const f = fields(a);
  return [
    '🔔 *Yeni Özel Sunum Randevusu*',
    '',
    `👤 ${f.customer}`,
    `📞 ${f.phone}`,
    `🚙 ${f.car}`,
    `📍 ${f.service} — ${f.place}`,
    `🗓 ${f.when}`,
    '',
    'Müşteriyi 1 saat içinde arayın.',
  ].join('\n');
};

const sendTo = async (to, appointment) => {
  const c = config();
  const f = fields(appointment);
  const body = c.template
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: c.template,
          language: { code: c.templateLang },
          // Şablon gövdesinde sırasıyla {{1}}..{{6}}: müşteri, telefon, araç, hizmet, yer, zaman
          components: [
            {
              type: 'body',
              parameters: [f.customer, f.phone, f.car, f.service, f.place, f.when].map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: textMessage(appointment) } };

  const res = await fetch(`https://graph.facebook.com/${c.apiVersion}/${c.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error?.message || `WhatsApp API ${res.status}`);
  }
};

/** Randevuyu tüm alıcılara bildirir. Dönüş: { status: 'sent' | 'failed' | 'not_configured', error? } */
const notifyAppointment = async (appointment) => {
  if (!isConfigured()) {
    console.log(`[whatsapp] Ayarlanmadı, bildirim gönderilmedi. Randevu ${appointment.id}:\n${textMessage(appointment)}`);
    return { status: 'not_configured' };
  }
  const errors = [];
  for (const to of config().to) {
    try {
      await sendTo(to, appointment);
    } catch (err) {
      errors.push(`${to}: ${err.message}`);
    }
  }
  if (errors.length) {
    console.error('[whatsapp] Gönderilemedi:', errors.join(' | '));
    return { status: 'failed', error: errors.join(' | ') };
  }
  return { status: 'sent' };
};

module.exports = { notifyAppointment, isConfigured, textMessage };
