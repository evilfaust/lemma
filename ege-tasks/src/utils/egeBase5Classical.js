import { decimalWithComma, exactOrRounded, probabilityTask } from './egeBase5Answers';
import { rand, randInt, rat } from './linearExpr';

const directStories = [
  (total, count) => `Число участников соревнований — ${total}. Из них ${count} представляют команду «Север». Порядок выступлений определяется жеребьёвкой. Какова вероятность, что первым выступит участник команды «Север»?`,
  (total, count) => `В наборе ${total} экзаменационных билетов. Вопрос по механике есть в ${count} из них. Школьник наугад вытягивает один билет. Какова вероятность, что в нём есть вопрос по механике?`,
  (total, count) => `На празднике наугад раздают ${total} подарочных наборов, по одному каждому гостю. В ${count} из них лежит пазл с изображением животного. Какова вероятность, что Марине достанется такой набор?`,
  (total, count) => `В коробке ${total} конфет, из которых ${count} с орехом. Из коробки наугад вынимают одну конфету. Какова вероятность, что она окажется с орехом?`,
];

function draw() {
  const total = rand([20, 25, 40, 50, 80, 100, 125, 160, 200, 250]);
  const count = randInt(3, Math.floor(total * 0.8));
  return probabilityTask(rand(directStories)(total, count), count, total, ['draw', total, count]);
}

const qualityTotals = [100, 125, 200, 250, 400, 500, 800, 1000, 2000];
const smallTotals = [20, 25, 40, 50, 80, 100, 125];
const complementStories = [
  {
    totals: qualityTotals,
    text: (total, count) => `В партии ${total} аккумуляторов. Число неисправных аккумуляторов — ${count}. Из всей партии наугад выбирают один аккумулятор. Какова вероятность, что он окажется исправным?`,
  },
  {
    totals: qualityTotals,
    text: (total, count) => `В магазин привезли ${total} садовых насосов. Число насосов с протечкой — ${count}. Один насос выбирают наугад для проверки. Какова вероятность, что он не протекает?`,
  },
  {
    totals: smallTotals,
    text: (total, count) => `Число экзаменационных вопросов — ${total}. Илья не выучил ${count} из них. Какова вероятность, что в результате жеребьёвки ему достанется выученный вопрос?`,
  },
  {
    totals: smallTotals,
    text: (total, count) => `При включении телевизор выбирает наугад один из ${total} доступных каналов. В этот момент на ${count} из них идут новости. Какова вероятность, что телевизор включится на канале без новостей?`,
  },
];

function complement() {
  const story = rand(complementStories);
  const total = rand(story.totals);
  const excluded = randInt(2, Math.floor(total / 5));
  return probabilityTask(story.text(total, excluded), total - excluded, total, ['complement', total, excluded]);
}

function schedule() {
  const total = rand([40, 50, 64, 80, 100, 120, 125, 160]);
  const laterDay = randInt(Math.ceil(total * 0.15), Math.floor(total * 0.35));
  const firstTwoDays = total - 2 * laterDay;
  const firstDay = randInt(Math.ceil(firstTwoDays / 3), Math.floor(firstTwoDays * 2 / 3));
  const secondDay = firstTwoDays - firstDay;
  const statement = rand([
    `Конференция длится четыре дня. Общее число запланированных докладов — ${total}. Число докладов в первый день — ${firstDay}, во второй — ${secondDay}. Остальные доклады распределены поровну между третьим и четвёртым днями. Место в расписании для каждого доклада определяется жеребьёвкой. Какова вероятность, что доклад профессора Крылова состоится в третий день?`,
    `Музыкальный конкурс длится четыре дня. Общее число выступлений — ${total}. На первый день отведено ${firstDay} мест в расписании, на второй — ${secondDay}. Остальные места разделены поровну между третьим и четвёртым днями. Исполнители вытягивают места по жребию. Какова вероятность, что выступление Алины назначат на последний день?`,
  ]);
  return probabilityTask(statement, laterDay, total, ['schedule', total, Math.min(firstDay, secondDay), Math.max(firstDay, secondDay)]);
}

function listedGroups() {
  const total = rand([16, 20, 25, 32, 40, 50, 64, 80, 100]);
  const selected = randInt(3, Math.floor(total / 2));
  const first = randInt(2, total - selected - 2);
  const second = total - selected - first;
  const statement = rand([
    `В парке такси машины трёх цветов: белых — ${first}, жёлтых — ${second}, синих — ${selected}. На вызов отправляют одну случайно выбранную машину. Какова вероятность, что к пассажиру приедет синяя машина?`,
    `В пекарне осталось несколько пирожков. Число пирожков с рисом — ${first}, с капустой — ${second}, с вишней — ${selected}. Покупатель наугад выбирает один пирожок. Какова вероятность, что ему достанется пирожок с вишней?`,
    `На фестивале участвуют несколько команд. Число команд из Казани — ${first}, из Перми — ${second}, из Тулы — ${selected}. Порядок выступлений определяют жребием. Какова вероятность, что последней выступит команда из Тулы?`,
  ]);
  return probabilityTask(statement, selected, total, ['listedGroups', selected, Math.min(first, second), Math.max(first, second)]);
}

function remainder() {
  const total = rand([100, 125, 150, 200, 250, 300, 400, 500]);
  const first = randInt(Math.ceil(total / 4), Math.floor(total / 2));
  const second = randInt(Math.ceil(total / 4), Math.floor(total * 0.45));
  const statement = rand([
    `Общее число участников олимпиады — ${total}. В первой аудитории разместили ${first} человек, во второй — ${second}, остальных направили в резервную. Какова вероятность, что случайно выбранный участник писал олимпиаду в резервной аудитории?`,
    `Общее число участников конкурса — ${total}. Число участников из Казани — ${first}, из Самары — ${second}, остальные из Уфы. Порядок выступлений определяют жребием. Какова вероятность, что первым выступит участник из Уфы?`,
  ]);
  return probabilityTask(statement, total - first - second, total, ['remainder', total, Math.min(first, second), Math.max(first, second)]);
}

function flights() {
  const capacity = randInt(4, 20);
  const fullTrips = randInt(2, 10);
  const last = randInt(0, capacity - 1);
  const total = fullTrips * capacity + last;
  const trip = randInt(1, fullTrips + Number(last > 0));
  const transport = rand(['катер', 'вертолёт']);
  const statement = `Число туристов в группе — ${total}. Для перевозки группы используют ${transport} вместимостью ${capacity} мест. Все рейсы, кроме, возможно, последнего, полностью заполнены. Порядок перевозки определяют жребием. Какова вероятность, что турист Лев отправится рейсом №${trip}?`;
  return exactOrRounded(statement, trip > fullTrips ? last : capacity, total, ['flights', total, capacity, trip]);
}

function opponent() {
  const total = randInt(8, 63) * 2;
  const club = randInt(3, total - 3);
  const statement = `Перед первым туром турнира по бадминтону участников случайным образом разбивают на пары. Общее число игроков — ${total}. Клуб «Старт» представляют ${club} игроков, в том числе Олег. Какова вероятность, что соперник Олега в первом туре тоже окажется из клуба «Старт»?`;
  return exactOrRounded(statement, club - 1, total - 1, ['opponent', total, club]);
}

function ratio() {
  const first = randInt(1, 32);
  const second = randInt(2, 45);
  const parts = rat(first, second);
  const { n, d } = parts;
  const statement = rand([
    `В коробке вперемешку лежат пакетики с зелёным и чёрным чаем. Отношение количества зелёных пакетиков к количеству чёрных равно ${n} : ${d}. Из коробки наугад берут один пакетик. Какова вероятность, что в нём зелёный чай?`,
    `В ящике белые и чёрные шары. На каждые ${n} белых приходится ${d} чёрных. Из ящика наугад достают один шар. Какова вероятность, что он белый?`,
    `В партии сумок на каждые ${n} сумок без дефектов приходится ${d} сумок с дефектами. Одну сумку выбирают наугад. Какова вероятность, что она без дефектов?`,
  ]);
  return exactOrRounded(statement, n, n + d, ['ratio', n, d]);
}

function frequency() {
  const total = rand([1000, 2000, 3000, 4000]);
  const probability = randInt(25, 95);
  const offset = randInt(1, 20) * rand([-1, 1]);
  const repaired = (probability + offset) * total / 1000;
  const estimate = decimalWithComma(rat(probability, 1000));
  const statement = `Вероятность гарантийного ремонта нового электрочайника в течение года оценивают как ${estimate}. В городе продали ${total} электрочайников, и ${repaired} из них в течение года поступили в гарантийный ремонт. На сколько относительная частота ремонта отличается от этой вероятности?`;
  return probabilityTask(statement, Math.abs(offset), 1000, ['frequency', probability, total, repaired]);
}

function clock() {
  const ticks = rand([12, 60]);
  const start = randInt(0, ticks - 1);
  const arc = randInt(1, ticks - 1);
  const end = (start + arc) % ticks;
  const unit = ticks === 12 ? 'часовая' : 'минутная';
  const scale = ticks === 12 ? '12 часовыми отметками' : '60 минутными делениями, пронумерованными от 0 до 59';
  const display = value => ticks === 12 && value === 0 ? 12 : value;
  const statement = `Механические часы с ${scale} остановились. Считайте, что положение ${unit === 'часовая' ? 'часовой' : 'минутной'} стрелки на полном обороте равномерно случайно. Какова вероятность, что ${unit} стрелка остановилась на дуге от отметки ${display(start)} до отметки ${display(end)}, если идти по ходу стрелки?`;
  return exactOrRounded(statement, arc, ticks, ['clock', ticks, start, arc]);
}

function relativeOrder() {
  const total = randInt(3, 15);
  const first = randInt(1, total);
  const last = randInt(first, total);
  if (first === 1 && last === total) return null;
  const place = first === last ? `будет иметь номер ${first}` : `будет иметь номер от ${first} до ${last} включительно`;
  const statement = `На фестивале выступят коллективы из разных городов. Число коллективов, приехавших из городов Поволжья, — ${total}, среди них «Квартал». Порядок всех выступлений определяют жребием. Какова вероятность, что выступление «Квартала» ${place}, если считать только выступления коллективов из Поволжья?`;
  return exactOrRounded(statement, last - first + 1, total, ['relativeOrder', total, first, last]);
}

const comparisons = [
  { text: 'ровно', matches: (value, target) => value === target },
  { text: 'не менее', matches: (value, target) => value >= target },
  { text: 'не более', matches: (value, target) => value <= target },
];

function dice() {
  const count = randInt(2, 3);
  const comparison = rand(comparisons);
  // Для трёх костей оставляем суммы у краёв диапазона: их можно перебрать вручную.
  let target = randInt(3, 11);
  if (count === 3) {
    if (comparison.text === 'не менее') target = randInt(14, 17);
    else if (comparison.text === 'не более') target = randInt(4, 7);
    else target = rand([randInt(4, 8), randInt(13, 17)]);
  }
  const total = 6 ** count;
  let favorable = 0;
  for (let i = 0; i < total; i++) {
    let sum = 0;
    for (let outcome = i, die = 0; die < count; die++, outcome = Math.floor(outcome / 6)) {
      sum += outcome % 6 + 1;
    }
    if (comparison.matches(sum, target)) favorable++;
  }
  const statement = `Бросают ${count} обычные симметричные игральные кости независимо друг от друга. Найдите вероятность того, что сумма выпавших очков будет ${comparison.text} ${target}.`;
  return exactOrRounded(statement, favorable, total, ['dice', count, target, comparison.text]);
}

function coin() {
  const count = randInt(2, 6);
  const target = randInt(1, count - 1);
  const comparison = rand(comparisons);
  const total = 2 ** count;
  let favorable = 0;
  for (let i = 0; i < total; i++) {
    const heads = i.toString(2).replace(/0/g, '').length;
    if (comparison.matches(heads, target)) favorable++;
  }
  const statement = `Симметричную монету подбрасывают несколько раз независимо. Число бросков — ${count}. Какова вероятность, что орёл выпадет ${comparison.text} ${target} раз?`;
  return exactOrRounded(statement, favorable, total, ['coin', count, target, comparison.text]);
}

export const CLASSICAL_TASKS = {
  draw: { label: 'Прямой случайный выбор', make: draw },
  complement: { label: 'Противоположное событие', make: complement },
  schedule: { label: 'Выбор после расчёта группы', make: schedule },
  listedGroups: { label: 'Выбор из нескольких групп', make: listedGroups },
  remainder: { label: 'Группа, оставшаяся после распределения', make: remainder },
  flights: { label: 'Случайное распределение по рейсам', make: flights },
  opponent: { label: 'Соперник по жребию', make: opponent },
  ratio: { label: 'Выбор при заданном отношении', make: ratio },
  frequency: { label: 'Относительная частота и вероятность', make: frequency },
  clock: { label: 'Случайное положение стрелки часов', make: clock },
  relativeOrder: { label: 'Место в случайном порядке', make: relativeOrder },
  dice: { label: 'Сумма на игральных костях', make: dice, maxTasks: 40 },
  coin: { label: 'Число орлов при бросках монеты', make: coin, maxTasks: 40 },
};
