import { rand, randInt, rat } from './linearExpr';
import { generateTextTaskVariants, generateUniqueTextTask } from './textTaskGeneration';
import { makeEgeBase5Maze } from './egeBase5Maze';
import { decimalWithComma, probabilityTask, roundedProbabilityTask } from './egeBase5Answers';
import { CLASSICAL_TASKS } from './egeBase5Classical';

const CLASSICAL_PROBABILITY = 'Классическое определение вероятности';
const PROBABILITY_THEOREMS = 'Теоремы о вероятностях событий';
const classicalTypes = Object.fromEntries(Object.entries(CLASSICAL_TASKS).map(([key, { label, maxTasks }]) => [
  key, { label, maxTasks, subtopic: CLASSICAL_PROBABILITY },
]));
export const EGE_BASE_5_TYPES = {
  ...classicalTypes,
  independent: { label: 'Два независимых события', subtopic: PROBABILITY_THEOREMS },
  allThree: { label: 'Все три события', subtopic: PROBABILITY_THEOREMS },
  neither: { label: 'Ни одно из двух событий', subtopic: PROBABILITY_THEOREMS },
  bothGood: { label: 'Оба изделия исправны', subtopic: PROBABILITY_THEOREMS },
  sequence: { label: 'Заданный порядок попаданий и промахов', subtopic: PROBABILITY_THEOREMS },
  total: { label: 'Полная вероятность: два поставщика', subtopic: PROBABILITY_THEOREMS },
  totalMiss: { label: 'Полная вероятность: случайный выбор и промах', subtopic: PROBABILITY_THEOREMS },
  inverse: { label: 'Полная вероятность: найти долю поставщика', subtopic: PROBABILITY_THEOREMS },
  conditional: { label: 'Условная вероятность после проверки', subtopic: PROBABILITY_THEOREMS },
  maze: { label: 'Вероятность выхода из лабиринта', subtopic: PROBABILITY_THEOREMS },
};
export const PROBABILITY_LABELS = Object.fromEntries(
  Object.entries(EGE_BASE_5_TYPES).map(([type, { label }]) => [type, label]),
);
export const PROBABILITY_GROUPS = [CLASSICAL_PROBABILITY, PROBABILITY_THEOREMS].map(label => ({
  label,
  keys: Object.keys(EGE_BASE_5_TYPES).filter(type => EGE_BASE_5_TYPES[type].subtopic === label),
}));

const hundredths = value => decimalWithComma(rat(value, 100));

function deliveries(neither = false) {
  // Одна вероятность задана в десятых, другая — не более чем в сотых.
  const first = randInt(2, 9) * 10;
  const second = randInt(15, 95);
  const outcome = neither ? 'ни один заказ не доставят до конца дня' : 'оба заказа доставят до конца дня';
  const statement = `Покупатель оформил по одному заказу в двух магазинах. Вероятность того, что магазин А доставит заказ до конца дня, равна ${hundredths(first)}, а для магазина Б эта вероятность равна ${hundredths(second)}. События доставки заказов до конца дня независимы. Какова вероятность, что ${outcome}?`;
  const numerator = neither ? (100 - first) * (100 - second) : first * second;
  return probabilityTask(statement, numerator, 10_000, [neither ? 'neither' : 'independent', Math.min(first, second), Math.max(first, second)]);
}

function allThree() {
  const first = randInt(2, 8) * 10;
  const second = randInt(2, 8) * 10;
  const third = randInt(20, 90);
  const statement = `В справочной службе работают три оператора. В выбранный момент вероятности того, что первый, второй и третий оператор заняты, равны соответственно ${hundredths(first)}, ${hundredths(second)} и ${hundredths(third)}. Занятость операторов независима. Найдите вероятность того, что в этот момент заняты все три оператора.`;
  return probabilityTask(statement, first * second * third, 1_000_000,
    ['allThree', ...[first, second, third].sort((a, b) => a - b)], 4);
}

function bothGood() {
  const first = randInt(1, 30);
  const second = randInt(1, 30);
  const statement = `В упаковке две батарейки из разных партий. Вероятности брака первой и второй батареек равны ${hundredths(first)} и ${hundredths(second)} соответственно. Наличие брака у одной батарейки не зависит от наличия брака у другой. Найдите вероятность того, что обе батарейки окажутся исправными.`;
  return probabilityTask(statement, (100 - first) * (100 - second), 10_000,
    ['bothGood', Math.min(first, second), Math.max(first, second)], 4);
}

function sequence() {
  const hitChance = randInt(32, 89);
  const hits = randInt(2, 4);
  const misses = randInt(1, 3);
  const shots = hits + misses;
  const statement = `Биатлонист делает ${shots} независимых выстрелов по разным мишеням, по одному в каждую. Вероятность попадания при каждом выстреле равна ${hundredths(hitChance)}. Найдите вероятность того, что он попадёт в каждую из первых ${hits} мишеней, а по остальным промахнётся.`;
  return roundedProbabilityTask(statement, hitChance ** hits * (100 - hitChance) ** misses, 100 ** shots,
    ['sequence', hitChance, hits, misses]);
}

function total() {
  const share = randInt(3, 17) * 5;
  const first = randInt(1, 18);
  const second = randInt(1, 18);
  if (first === second) return null;
  const statement = `На склад поступают детали с двух фабрик. Доля деталей с первой фабрики — ${share}%, остальные поступают со второй. Среди деталей первой фабрики ${first}% бракованных, среди деталей второй — ${second}%. Какова вероятность, что случайно выбранная на складе деталь окажется бракованной?`;
  const lowerRateShare = first < second ? share : 100 - share;
  return probabilityTask(statement, share * first + (100 - share) * second, 10_000,
    ['total', Math.min(first, second), Math.max(first, second), lowerRateShare], 4);
}

function totalMiss() {
  const bows = rand([20, 25, 40, 50]);
  const tuned = randInt(3, bows - 3);
  const first = randInt(6, 9) * 10;
  const second = randInt(2, 5) * 10;
  const statement = `В спортивной секции ${bows} луков. Число настроенных луков — ${tuned}. Спортсмен наугад выбирает один лук и стреляет. Вероятность попасть в мишень из настроенного лука равна ${hundredths(first)}, из ненастроенного — ${hundredths(second)}. Найдите вероятность промаха.`;
  return probabilityTask(statement, tuned * (100 - first) + (bows - tuned) * (100 - second), bows * 100,
    ['totalMiss', bows, tuned, first, second], 4);
}

function inverse() {
  const second = randInt(40, 65);
  const difference = rand([10, 20, 30]);
  const first = second + difference;
  const share = randInt(2, 18);
  const overall = second + difference * share / 20;
  if (!Number.isInteger(overall)) return null;
  const statement = `Агрофирма закупает яйца у двух хозяйств. В первом хозяйстве доля яиц высшей категории составляет ${first}%, во втором — ${second}%. Среди всех яиц, закупленных агрофирмой, ${overall}% яиц высшей категории. Какова вероятность, что случайно выбранное яйцо из закупленной партии поступило из первого хозяйства?`;
  return probabilityTask(statement, share, 20, ['inverse', first, second, overall]);
}

function conditional() {
  const defective = randInt(5, 30);
  const detected = randInt(45, 95);
  const statement = `На фабрике ${defective}% выпущенных тарелок имеют дефект. При проверке выявляют ${detected}% дефектных тарелок. Выявленные дефектные тарелки отбраковывают, все остальные поступают в продажу. Какова вероятность, что случайно выбранная среди поступивших в продажу тарелка исправна?`;
  return roundedProbabilityTask(statement, (100 - defective) * 100, 10_000 - defective * detected,
    ['conditional', defective, detected]);
}

function maze() {
  const { statement, denominator, model } = makeEgeBase5Maze();
  return probabilityTask(statement, 1, denominator, model, 4);
}

const makeTask = {
  independent: () => deliveries(), allThree,
  neither: () => deliveries(true), bothGood, sequence, total, totalMiss, inverse, conditional, maze,
};

export function generateEgeBase5Task(type, usedModels, usedStatements) {
  const make = CLASSICAL_TASKS[type]?.make || makeTask[type];
  return generateUniqueTextTask(make, EGE_BASE_5_TYPES[type].label, usedModels, usedStatements);
}

export function generateProbabilityVariants(settings) {
  return generateTextTaskVariants(settings, EGE_BASE_5_TYPES, generateEgeBase5Task);
}
