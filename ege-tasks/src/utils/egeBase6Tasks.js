import { shuffleArray } from './shuffle';
import { generateTextTaskVariants, generateUniqueTextTask } from './textTaskGeneration';

export const EGE_BASE_6_TYPES = {
  delivery: { label: 'Покупка с доставкой', subtopic: 'Выбор варианта из трех возможных' },
  tariffs: { label: 'Сравнение тарифов', subtopic: 'Выбор варианта из трех возможных' },
  luggage: { label: 'Ручная кладь', subtopic: 'Подбор комплекта или комбинации' },
};
export const TABLE_CHOICE_LABELS = Object.fromEntries(
  Object.entries(EGE_BASE_6_TYPES).map(([type, { label }]) => [type, label]),
);

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const table = (headers, rows) => [
  headers,
  headers.map(() => '---'),
  ...rows,
].map(row => `| ${row.join(' | ')} |`).join('\n');

function modelKey(type, parameters, rows) {
  // Названия и порядок предложений не меняют математическую задачу.
  return JSON.stringify([type, parameters, rows.map(row => JSON.stringify(row)).sort()]);
}

function delivery() {
  const quantity = randomInt(8, 24);
  const basePrice = randomInt(180, 480);
  const prices = [basePrice, basePrice + randomInt(4, 18), basePrice + randomInt(20, 34)];
  const freeDeliveryIndex = randomInt(0, 2);
  const paidDeliveryIndex = (freeDeliveryIndex + randomInt(1, 2)) % 3;
  const offers = prices.map((price, index) => {
    const subtotal = quantity * price;
    // Ровно один магазин с порогом даёт бесплатную доставку, другой — нет.
    const threshold = index === freeDeliveryIndex ? subtotal - randomInt(1, 10) * 10
      : index === paidDeliveryIndex ? subtotal + randomInt(0, 10) * 10
      : null;
    return [price, randomInt(12, 66) * 10, threshold];
  });
  const totals = offers.map(([price, fee, threshold]) => {
    const subtotal = quantity * price;
    return subtotal + (threshold !== null && subtotal > threshold ? 0 : fee);
  });
  if (new Set(totals).size !== 3) return null;

  const rows = shuffleArray(offers).map(([price, fee, threshold], index) => [
    'АБВ'[index], price, fee, threshold === null ? '—' : `При заказе дороже ${threshold} руб.`,
  ]);
  return {
    statement_md: [
      `Для школьного кружка нужно купить ${quantity} настольных ламп. В таблице указаны цены трёх магазинов и стоимость доставки всего заказа. Все лампы нужно купить в одном магазине.`,
      table(['Магазин', 'Цена лампы, руб.', 'Доставка, руб.', 'Условие бесплатной доставки'], rows),
      'Сколько рублей будет стоить самый дешёвый заказ с учётом доставки?',
    ].join('\n\n'),
    answer: String(Math.min(...totals)),
    modelKey: modelKey('delivery', quantity, offers),
  };
}

function tariffs() {
  const included = randomInt(15, 40) * 10;
  const minutes = included + randomInt(3, 14) * 10;
  const perMinute = randomInt(2, 5);
  const overage = randomInt(1, perMinute - 1);
  const payAsYouGo = minutes * perMinute;
  const packageFee = randomInt(25, 90) * 10;
  const packageTotal = packageFee + (minutes - included) * overage;
  const unlimitedFee = Math.max(packageFee + 10, Math.min(payAsYouGo, packageTotal) + randomInt(-16, 16) * 10);
  const totals = [payAsYouGo, packageTotal, unlimitedFee];
  if (new Set(totals).size !== 3) return null;

  const offers = [[0, 0, perMinute], [packageFee, included, overage], [unlimitedFee, null, null]];
  const rows = shuffleArray(offers).map(([fee, limit, rate], index) => [
    'АБВ'[index], fee, limit ?? 'Без ограничений', rate ?? '—',
  ]);
  return {
    statement_md: [
      `Клиент выбирает тариф мобильной связи. Плата за минуты сверх пакета начисляется дополнительно к абонентской плате. За месяц клиент разговаривает по телефону ${minutes} минут.`,
      table(['Тариф', 'Абонентская плата, руб. в месяц', 'Минуты в пакете', 'Цена минуты сверх пакета, руб.'], rows),
      'Сколько рублей клиент заплатит за месяц по самому дешёвому для него тарифу?',
    ].join('\n\n'),
    answer: String(Math.min(...totals)),
    modelKey: modelKey('tariffs', minutes, offers),
  };
}

function luggage() {
  // Масса хранится в десятых долях килограмма, чтобы точно проверять границы.
  const limits = [randomInt(50, 58), randomInt(35, 42), randomInt(18, 25), randomInt(7, 12) * 10];
  const misses = shuffleArray([0, 1, 2, 3]);
  const bags = shuffleArray([null, null, ...misses].map(miss => limits.map((limit, index) =>
    miss === index ? limit + randomInt(1, 5) : limit - randomInt(0, 6)
  )));
  const answer = bags.flatMap((bag, index) =>
    bag.every((value, dimension) => value <= limits[dimension]) ? [index + 1] : []
  ).join('');
  const kg = value => (value / 10).toFixed(1).replace(/\.0$/, '').replace('.', ',');
  const [length, height, width, mass] = limits;
  return {
    statement_md: [
      `Авиакомпания разрешает брать в ручную кладь сумки длиной не более ${length} см, высотой не более ${height} см, шириной не более ${width} см и массой не более ${kg(mass)} кг. Параметры сумок приведены в таблице.`,
      table(['№ сумки', 'Длина, см', 'Высота, см', 'Ширина, см', 'Масса, кг'],
        bags.map(([l, h, w, m], index) => [index + 1, l, h, w, kg(m)])),
      'Какие сумки подходят для ручной клади? Запишите их номера в порядке возрастания без пробелов и запятых.',
    ].join('\n\n'),
    answer,
    modelKey: modelKey('luggage', limits, bags),
  };
}

const makeTask = { delivery, tariffs, luggage };

export function generateEgeBase6Task(type, usedModels, usedStatements) {
  return generateUniqueTextTask(makeTask[type], EGE_BASE_6_TYPES[type].label, usedModels, usedStatements);
}

export function generateTableChoiceVariants(settings) {
  return generateTextTaskVariants(settings, EGE_BASE_6_TYPES, generateEgeBase6Task);
}
