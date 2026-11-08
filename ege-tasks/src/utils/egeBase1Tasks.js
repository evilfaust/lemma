import { generateTextTaskVariants, generateUniqueTextTask } from './textTaskGeneration';

export const EGE_BASE_1_TYPES = {
  packs: { label: 'Округление вверх', subtopic: 'Округление с избытком' },
  shelves: { label: 'Округление вниз', subtopic: 'Округление с недостатком' },
  change: { label: 'Покупка и сдача', subtopic: 'Разные задачи' },
  savings: { label: 'Экономия с проездным', subtopic: 'Разные задачи' },
};
export const EVERYDAY_MATH_LABELS = Object.fromEntries(
  Object.entries(EGE_BASE_1_TYPES).map(([type, { label }]) => [type, label]),
);

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function packs() {
  const days = randomInt(5, 12);
  const daily = randomInt(18, 68) * 5;
  const packSize = randomInt(4, 10) * 50;
  const total = days * daily;
  if (total % packSize === 0) return null;
  return {
    statement_md: `Для работы кружка ежедневно нужно ${daily} листов бумаги. Занятия продлятся ${days} дней. В одной пачке ${packSize} листов. Какое наименьшее количество пачек бумаги нужно купить на все дни?`,
    answer: String(Math.ceil(total / packSize)),
    modelKey: JSON.stringify(['packs', days, daily, packSize]),
  };
}

function shelves() {
  const boxes = randomInt(5, 12);
  const inBox = randomInt(18, 48);
  const capacity = randomInt(28, 62);
  const books = boxes * inBox;
  if (books % capacity === 0) return null;
  return {
    statement_md: `В библиотеку привезли ${boxes} одинаковых коробок с книгами. Число книг в каждой коробке — ${inBox}. На каждой полке помещается не более ${capacity} книг. Сколько полок можно заполнить полностью?`,
    answer: String(Math.floor(books / capacity)),
    modelKey: JSON.stringify(['shelves', boxes, inBox, capacity]),
  };
}

function change() {
  const quantity = randomInt(5, 9);
  const price = randomInt(65, 190);
  const total = quantity * price;
  const payment = [500, 1000, 2000].find(note => note > total);
  return {
    statement_md: `Один билет стоит ${price} руб. Покупатель купил ${quantity} билетов и дал кассиру купюру достоинством ${payment} руб. Сколько рублей сдачи должен получить покупатель?`,
    answer: String(payment - total),
    modelKey: JSON.stringify(['change', quantity, price, payment]),
  };
}

function savings() {
  const trips = randomInt(20, 48);
  const fare = randomInt(35, 85);
  const pass = Math.floor((trips * fare - randomInt(12, 35) * 10) / 10) * 10;
  return {
    statement_md: `Разовая поездка стоит ${fare} руб., а месячный проездной — ${pass} руб. Пассажир купил проездной. Число поездок за месяц — ${trips}. Сколько рублей он сэкономил по сравнению с оплатой каждой поездки отдельно?`,
    answer: String(trips * fare - pass),
    modelKey: JSON.stringify(['savings', trips, fare, pass]),
  };
}

const makeTask = { packs, shelves, change, savings };

export function generateEgeBase1Task(type, usedModels, usedStatements) {
  return generateUniqueTextTask(makeTask[type], EGE_BASE_1_TYPES[type].label, usedModels, usedStatements);
}

export function generateEverydayMathVariants(settings) {
  return generateTextTaskVariants(settings, EGE_BASE_1_TYPES, generateEgeBase1Task);
}
