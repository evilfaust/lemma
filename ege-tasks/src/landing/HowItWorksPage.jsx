import React, { useEffect, useState } from 'react'
import { APP_VERSION, BUILD_DATE } from '@shared/version/buildInfo'

/* ─── static data ─── */

const formatDate = (iso) => iso ? iso.slice(0, 10) : ''

// Цифры округлены вниз (октябрь 2026): 30,7 тыс. задач банка + 18 тыс. по
// геометрии; тесты — `npm test`. Сверять при больших изменениях.
const HERO_FACTS = [
  { value: '48 000+', label: 'Задач в банке: ЕГЭ, ОГЭ, ВПР и 18 000 по геометрии', color: 'cyan' },
  { value: '45+', label: 'Генераторов и тренажёров: от устного счёта до сечений куба', color: 'pink' },
  { value: '106', label: 'Достижений трёх уровней редкости для мотивации', color: 'purple' },
  { value: '4 200+', label: 'Автотестов: ответы генераторов пересчитываются по напечатанному условию', color: 'orange' },
]

const CORE_MODULES = [
  {
    num: '01', color: 'cyan', wide: true,
    title: 'Банк задач',
    desc: '30 000+ задач ЕГЭ, ОГЭ и ВПР с формулами, чертежами, решениями и критериями. Раздел «Банк задач» показывает покрытие экзаменов по номерам заданий, что требует внимания и какие задачи чаще всего решают с ошибкой.',
    details: [
      'LaTeX (KaTeX) и Markdown с мгновенным предпросмотром, расширенный редактор на CodeMirror с подсветкой ошибок в формулах',
      'Картинки из Библиотеки, скриншотом или файлом; чертежи текстом — планиметрия, стерео, графики, диаграммы, числовые прямые',
      'Импорт с «Решу ЕГЭ» по ссылке или номеру: база, профиль, ОГЭ, ВПР — с критериями и чертежами',
      'Нормализация формул словарём и LLM, перепарсинг задачи с диффом ДО/ПОСЛЕ',
      'Массовые операции: теги, сложность, источник, перенос в геометрию',
    ],
    tags: ['«Решу ЕГЭ»', 'LaTeX', 'Покрытие экзаменов', 'Чертежи текстом'],
  },
  {
    num: '02', color: 'pink',
    title: 'Генератор задач',
    desc: 'Лист задач или карточки из банка по темам, тегам и сложности — с подбором по образцу, разными сюжетами или «анти-дублем».',
    details: [
      'Лист: 1–2 колонки, «N на лист», место для решения в клетку',
      'Карточки: 1–8 на лист A4, тираж на класс, ключ',
      'Чертёж сбоку, текст обтекает',
    ],
    tags: ['Лист', 'Карточки', 'Подбор'],
  },
  {
    num: '03', color: 'purple',
    title: 'Тренажёры',
    desc: 'Параметрические генераторы: бесконечно много вариантов, ответ считает модель, а не таблица.',
    details: [
      'Тригонометрия — 15 листов, от радиан до уравнений части 2 с отбором корней',
      'Уравнения и неравенства, системы, метод интервалов',
      'Производные, задания по графику, диаграммы',
      'Устный счёт: уровни, метки О6 · Б14 · П8, ответ «как в бланке»',
    ],
    tags: ['∞ вариантов', 'Тест A/B/C/D', 'Вписать ответ'],
  },
  {
    num: '04', color: 'orange', wide: true,
    title: 'Контрольные, входные и импорт работ',
    desc: 'Конструктор контрольной из блоков разных тем, входная контрольная с оформленным листом и импорт работы коллеги целиком — из файла, по номерам «Решу ЕГЭ» или через промпт для ИИ.',
    details: [
      'Три режима генерации: уникальные задачи / одинаковые с перемешиванием / одинаковые',
      'Редактор работы: замена задачи похожей, параллельные варианты, перенос между вариантами',
      'Печать листом общего движка: только чёрная краска, клетка, ключ учителю',
      'Показ условий ученикам без выдачи — для разбора у доски',
      'Работа → марафон защиты задач одной кнопкой',
    ],
    tags: ['3 режима', 'Импорт .md', 'Номера Решу', 'Показ условий'],
  },
  {
    num: '05', color: 'pink', wide: true,
    title: 'Варианты КИМ и игровые форматы',
    desc: 'Полные экзаменационные варианты в стиле ФИПИ и форматы для вовлекающих уроков.',
    details: [
      'ЕГЭ базовый (21 задание), профильный по КИМ-2027 (20 заданий, с критериями части 2), ОГЭ (25, со связным блоком 1–5)',
      'КИМ-печать: обложка, бланк ответа, предпросмотр «как в печати», лист ответов учителю',
      'QR-листы, пиксель-арт (в том числе командный), шифровки, кроссворды',
      'Маршрутный лист с ИИ-генерацией цепочки, «Сортировщик» уравнений',
      'Марафон защиты задач: трекер, очередь, живая доска, отрезные листы',
    ],
    tags: ['КИМ-2027', 'QR', 'Пиксель-арт', 'Марафон'],
  },
  {
    num: '06', color: 'cyan',
    title: 'Живые стереочертежи',
    desc: 'Свой редактор: сечения, перпендикуляры, углы, тела вращения. Эфир на телефоны учеников по ссылке.',
    details: [
      'Кликами или командами: «сечение MNK»',
      '«Все смотрят сюда» и показ по шагам',
      'Библиотека и пособия ученикам',
    ],
    tags: ['Эфир', 'Сечения', 'Тела вращения'],
  },
  {
    num: '07', color: 'pink',
    title: 'Планиметрия',
    desc: 'Простые чертежи без GeoGebra: треугольник с высотой, вписанная окружность, касательные — строками в условии задачи.',
    details: [
      'Блок ```planim в задачах и теории',
      'На печати строится под место',
      'Пометки, подписи-формулы, скрытие',
    ],
    tags: ['```planim', 'Печать', 'Библиотека'],
  },
  {
    num: '08', color: 'cyan', wide: true,
    title: 'Геометрия',
    desc: 'Единый банк: свои задачи и 17 600 задач МЦНМО с фасетами «объект · метод · факт». Работы с параллельными вариантами и генератор задач по стереометрии.',
    details: [
      'Генератор: сечения, углы, расстояния, объёмы и первая часть ЕГЭ (Б11, Б13, П3) — ответ сверяется с чертежом',
      'Работы «позиции × варианты»: подбор параллелей по смыслу, перенос между вариантами',
      'Печать листом задач и карточками A5/A4 с авто-раскладкой чертежа',
      'Ссылка ученикам: условия и чертежи — картинкой, живые или по шагам',
      'GeoGebra и фото-вложения к решению — для сложного',
    ],
    tags: ['МЦНМО', 'Фасеты', 'Генератор', 'Работы'],
  },
  {
    num: '09', color: 'orange', wide: true,
    title: 'Урок и календарь',
    desc: 'Рабочий стол «Сегодня», календарь по парам и окно урока, в котором собраны все материалы — с тем, как их получит ученик.',
    details: [
      'Материалы урока одним списком: решать онлайн · только условия · писали на бумаге · посмотреть · только мне',
      'ДЗ «к следующему уроку» — дата считается по расписанию класса',
      'Посещаемость, заметки урока на блочном редакторе, КТП с экспортом в Word',
      'Подписка календаря на телефон (iPhone, Google, Яндекс), школьный календарь, два учителя на класс',
      'Классы и перевод на новый учебный год, ученик в нескольких группах',
    ],
    tags: ['Сегодня', 'Пары', 'ДЗ', '.ics', 'КТП → Word'],
  },
  {
    num: '10', color: 'purple',
    title: 'Журнал класса',
    desc: 'Бумажные и онлайн-работы в одной сетке — вместо Google Таблиц.',
    details: [
      'Шкалы: баллы, 2–5, зачёт, %',
      'Интенсив, зачёт и экзамен',
      'Отзывы ИИ без имён учеников',
    ],
    tags: ['4+ · w · .4−', 'Excel'],
  },
  {
    num: '11', color: 'pink',
    title: 'Теория и ТДФ',
    desc: 'Статьи с формулами и крутящимися чертежами; ТДФ — теоремы, определения, формулы.',
    details: [
      'Статья по ссылке ученикам, личные и открытые',
      'ТДФ: листы с пропусками, карточки, ведомость',
      'Листы формул и печатная тема «Лист»',
    ],
    tags: ['CodeMirror', 'Пропуски', 'Карточки'],
  },
  {
    num: '12', color: 'cyan', wide: true,
    title: 'Умный подбор задач',
    desc: 'Семантический (векторный) поиск по смыслу задачи на эмбеддингах bge-m3. Помогает находить похожее, избегать повторов и собирать честные параллельные варианты.',
    details: [
      '«Похожие задачи» в карточке и догенерация работы похожими',
      'Анти-дубль: повторы внутри варианта и относительно прошлых работ',
      'Параллельные варианты одинаковой сложности со структурной подписью задачи',
      'Режимы подбора: по образцу, разные сюжеты (MMR), анти-дубль + бейдж новизны',
      'Дедуп-кластеры в банке и адресная работа над ошибками класса',
    ],
    tags: ['bge-m3', 'sqlite-vec', 'Анти-дубль', 'Параллели'],
  },
]

const TEACHER_FEATURES = [
  '«Сегодня»: идущий урок, расписание дня, к подготовке на неделе, что требует внимания',
  'Классы и группы, логины учеников вида ivanov.p, перевод на новый учебный год',
  'Журнал класса: бумажные и онлайн-работы, интенсивы, зачёты, отзывы ИИ',
  'Выдача по ссылке и QR-коду, дедлайны, попытки, проходной балл, «ещё попытка слабым»',
  'Проверка бумажных бланков по фото и ручной ввод ответов',
  'Тепловые карты ошибок и адресная работа над ошибками в один клик',
  'Excel результатов для деканата: задания 1/0, успеваемость, качество знаний',
  'Банк задач: покрытие экзаменов, дубли и похожие, «требует внимания»',
  'Совместная работа: шаринг работ, передача учеников, роли и журнал действий',
]

const STUDENT_FEATURES = [
  'Ставится на телефон как приложение (PWA) и обновляется само',
  'Главная — «что делать»: идёт урок, задания со сроком, ближайший урок',
  'Расписание и домашние задания по неделям, материалы урока',
  'Тест по ссылке или QR-коду, ответы сохраняются по ходу',
  'Результат сразу; «ещё попытка» от учителя — без перезагрузки',
  'Эфир стереочертежей, пособия и статьи теории от учителя',
  'Простой логин, пароль меняется при первом входе',
  'Галерея из 106 достижений и страница прогресса',
]

const FLOW_STEPS = [
  { num: '01', title: 'Подготовка работы', text: 'Учитель собирает работу из банка, генератора или импортом: фильтры, сложность, число вариантов. Параллельные варианты подбираются по смыслу.', side: 'teacher' },
  { num: '02', title: 'Выдача', text: 'Работа ставится в урок как «решать онлайн» — с QR-кодом и ссылкой. Можно задать дедлайн, число попыток, проходной балл, включить достижения и скрыть результаты до проверки.', side: 'teacher' },
  { num: '03', title: 'Решение', text: 'Ученик открывает задание с телефона или из кабинета и получает вариант по кругу (round-robin). Ответы сохраняются по ходу.', side: 'student' },
  { num: '04', title: 'Автоматическая проверка', text: 'Ответ сравнивается по значению: 0,5 = 1/2, \\frac{1}{3}, смешанные числа, корни и π (√3/2 ≠ 0,866), альтернативы через «|». Результат — сразу.', side: 'student' },
  { num: '05', title: 'Награды', text: 'Достижения за результат, скорость, серию попыток и время суток; «розыгрыш» — одна из подходящих наград выпадает с весом по редкости.', side: 'student' },
  { num: '06', title: 'Анализ и коррекция', text: 'Результаты встают в журнал класса, тепловая карта показывает слабые задания. Одной кнопкой — «ещё попытка» тем, кто ниже порога, или адресная работа над ошибками.', side: 'teacher' },
]

const ACHIEVEMENTS_DATA = {
  total: 106,
  random: [
    { rarity: 'legendary', label: 'Легендарные', condition: '90%+ правильных', color: '#ffbe0b', examples: 'Железный человек, Джедай, Титан' },
    { rarity: 'rare', label: 'Редкие', condition: '70–89% правильных', color: '#8338ec', examples: 'Алхимик, Стратег, Мастер' },
    { rarity: 'common', label: 'Обычные', condition: '40–69% правильных', color: '#06d6a0', examples: 'Первые шаги, Упрямый, Искатель' },
  ],
  conditional: [
    { icon: '🎯', name: 'По результату', desc: '100% правильных, 90%+ правильных, точный процент' },
    { icon: '⚡', name: 'По скорости', desc: 'За 5 минут, за 3 минуты' },
    { icon: '🔢', name: 'По количеству', desc: '1-я, 3-я, 10-я, 50-я, 100-я попытка' },
    { icon: '🌙', name: 'Специальные', desc: 'Ночная сова, ранняя пташка, воин выходных; 18 ачивок придумали сами ученики' },
  ],
}

const TECH_STACK = [
  {
    title: 'Frontend Core',
    items: [
      { name: 'React', ver: '18.2', note: 'UI библиотека' },
      { name: 'Vite', ver: '5.0', note: 'Multi-page сборка: учитель, ученик, лендинг' },
      { name: 'Ant Design', ver: '5.12', note: 'UI учителя (ученик и лендинг — без неё)' },
      { name: 'PocketBase SDK', ver: '0.21', note: 'API клиент' },
    ],
  },
  {
    title: 'Рендеринг & Редакторы',
    items: [
      { name: 'KaTeX', ver: '0.16.9', note: 'LaTeX формулы' },
      { name: 'react-markdown', ver: '10.1', note: 'Markdown + GFM' },
      { name: 'CodeMirror 6', ver: '', note: 'Редактор теории и задач (lazy)' },
      { name: 'BlockNote', ver: '0.31', note: 'Блочный редактор заметок + LaTeX' },
      { name: 'Свои движки', ver: '', note: 'стереометрия и планиметрия → SVG, без зависимостей' },
      { name: 'GeoGebra', ver: '', note: 'сложные чертежи геометрии и ТДФ' },
    ],
  },
  {
    title: 'Backend & Сервисы',
    items: [
      { name: 'PocketBase', ver: '0.36.4', note: 'SQLite + Auth + Files + JS-хуки' },
      { name: 'Node.js', ver: '20', note: 'backend helper: «Решу», LaTeX-LLM, бланки, вектор' },
      { name: 'sqlite-vec', ver: '', note: 'векторный индекс (cosine) для поиска похожих' },
      { name: 'Ollama bge-m3', ver: '1024d', note: 'эмбеддинги задач для семантики' },
      { name: 'Vision-LLM', ver: '', note: 'распознавание фото бланков ответов' },
    ],
  },
  {
    title: 'Инфраструктура & Качество',
    items: [
      { name: 'nginx', ver: '', note: 'Reverse proxy + SSL (Let\'s Encrypt)' },
      { name: 'systemd', ver: '', note: '2 сервиса на VPS' },
      { name: 'Raspberry Pi', ver: '', note: 'статика учительского приложения' },
      { name: 'S3 Timeweb', ver: '', note: 'off-site бэкапы' },
      { name: 'Vitest', ver: '', note: '4 200+ тестов, ~240 файлов' },
    ],
  },
]

const DB_COLLECTIONS = [
  { group: 'Задачи', items: [
    { name: 'tasks', desc: 'Банк задач ЕГЭ / ОГЭ / ВПР', fields: 'code, topic, subtopic[], tags, difficulty, statement_md, answer, solution_md, sdamgia_id, criteria_md', rel: 'topics, subtopics, tags' },
    { name: 'task_images', desc: 'Чертежи импорта «Решу ЕГЭ»', fields: 'role (condition/solution/criteria), order, file', rel: 'tasks (cascade)' },
    { name: 'geometry_tasks', desc: 'Банк геометрии (свои + МЦНМО)', fields: 'code, section, origin, tags (фасеты), drawing_svg, hints, solution_files', rel: 'geometry_topics, geometry_tags' },
  ]},
  { group: 'Работы & Выдача', items: [
    { name: 'works / variants', desc: 'Работы и их варианты', fields: 'title, class, show_open · number, order (json)', rel: 'tasks[]' },
    { name: 'work_sessions', desc: 'Выдачи', fields: 'is_open, deadline, max_attempts, passing_score, results_hidden', rel: 'works, mc_tests' },
    { name: 'attempts / attempt_answers', desc: 'Попытки и ответы', fields: 'status, score, source (student/scan), drill_answers · is_correct', rel: 'sessions, students, variants' },
    { name: 'generator_sheets / mc_tests', desc: 'Листы генераторов и тесты', fields: 'settings, tasks_data (снимок) · variants, answer_mode', rel: '—' },
  ]},
  { group: 'Классы & Журнал', items: [
    { name: 'teaching_groups', desc: 'Классы, группы, курсы', fields: 'name, year, prev_group, color, student_schedule', rel: 'teachers' },
    { name: 'group_memberships', desc: 'Состав по годам', fields: 'status (active/transferred/graduated)', rel: 'teaching_groups, students' },
    { name: 'journal_columns / marks / blocks', desc: 'Журнал класса', fields: 'scale, weight, role · value (текстом) · kind (интенсив/зачёт/экзамен)', rel: 'teaching_groups, lessons' },
  ]},
  { group: 'Уроки & Календарь', items: [
    { name: 'lessons', desc: 'Уроки', fields: 'date, time_slot, materials (json: deliver, required), hidden_from_students', rel: 'teaching_groups' },
    { name: 'lesson_attendance', desc: 'Посещаемость', fields: 'status (present/late/excused/absent)', rel: 'lessons, students' },
    { name: 'teacher_notes / teacher_todos', desc: 'Заметки (BlockNote) и дела', fields: 'body (json), links, is_pinned · due_date', rel: 'teaching_groups, lessons' },
    { name: 'school_events · courses / ktp_entries', desc: 'Школьный календарь и КТП', fields: 'date_start, kind · topic, hours, week_no, planned_results', rel: 'teaching_groups' },
  ]},
  { group: 'Чертежи & Теория', items: [
    { name: 'stereo_rooms', desc: 'Эфир стереочертежа', fields: 'code, scene, camera, pulse, live, groups', rel: 'teaching_groups' },
    { name: 'stereo_scenes', desc: 'Библиотека чертежей', fields: 'kind (stereo/planim), scene, public, groups', rel: 'teaching_groups' },
    { name: 'theory_articles', desc: 'Статьи теории', fields: 'content_md, theme_settings, public, owner', rel: 'theory_categories, teachers' },
    { name: 'tdf_sets / tdf_items', desc: 'ТДФ', fields: 'type (12 типов), formulation_md, question_md, geogebra_base64', rel: 'tdf_sets (cascade)' },
  ]},
  { group: 'Ученики & Вектор', items: [
    { name: 'students', desc: 'Auth-коллекция учеников', fields: 'username, name, teaching_group, must_change_password, external', rel: 'teaching_groups' },
    { name: 'achievements', desc: '106 достижений', fields: 'type (random/condition), rarity, condition_value', rel: '—' },
    { name: 'task_families', desc: 'Семьи задач (вектор)', fields: 'type (dedup_cluster/variant_family/reviewed_not_dup)', rel: 'task_family_members' },
    { name: 'vec_tasks', desc: 'Эмбеддинги bge-m3 (vec.db)', fields: '1024d, cosine — отдельная sqlite-vec БД', rel: 'tasks (ATTACH ro)' },
  ]},
]

// Числа — реальные: методы доменных модулей shared/services/pb/*.js
// (собраны в один api) + библиотека материалов + ручки backend helper.
const API_GROUPS = [
  { name: 'Работы & Листы', count: 94, desc: 'works, worksheets (QR, пиксель-арт, марафон, шифровки, маршрутные листы, тесты), generator_sheets' },
  { name: 'Задачи & Справочники', count: 70, desc: 'tasks, catalog, topics, extras — банк, дубли, покрытие, снимок для фильтров' },
  { name: 'Ученики & Классы', count: 70, desc: 'students, groups, memberships, rollover, courses — состав по годам, логины, перевод года' },
  { name: 'Геометрия & Чертежи', count: 63, desc: 'geometry (банк, работы, фасеты), stereo (эфир, библиотека, кабинет ученика)' },
  { name: 'Уроки & Календарь', count: 47, desc: 'lessons, ktp, notes, todos, schoolEvents, calendarFeed (.ics)' },
  { name: 'Теория, ТДФ, Листки', count: 45, desc: 'theory, tdf, listki' },
  { name: 'Тестирование', count: 36, desc: 'sessions, answers, achievements — выдачи, попытки, бланки, повторы' },
  { name: 'Журнал', count: 27, desc: 'journal (колонки, отметки, интенсивы), extjournal «Решу», attendance' },
  { name: 'Каникулы', count: 21, desc: 'programs, campaigns — каникулярные задания по ученикам' },
  { name: 'Библиотека материалов', count: 15, desc: 'materialsApi — файлы и папки во втором PocketBase' },
  { name: 'Backend helper', count: 17, desc: '/parse-sdamgia, /fetch-image, /latex-fix, /scan-blank, /scan-task-list, /intensive-feedback, /similar, /parallel-variants, /seed-select, /diverse, /novelty…' },
]

const VPS_ARCH = [
  { service: 'PocketBase', port: '8095', systemd: 'pocketbase-ege', desc: 'Backend API + Auth + Files + SQLite + JS-хуки (ленты ученика, .ics, слияние учеников)' },
  { service: 'Backend helper', port: '3001', systemd: 'pdf-service-ege', desc: 'Парсер «Решу», LaTeX-LLM, распознавание бланков, векторный поиск. PDF не генерирует — печать в браузере' },
  { service: 'Raspberry Pi', port: '443', systemd: 'docker nginx', desc: 'Статика учительского приложения (l.oipav.ru) и лаборатория: Grist и HedgeDoc' },
]

const VERSION_MILESTONES = [
  { ver: '1.0', date: 'Январь 2026', title: 'Первый релиз', desc: 'Генераторы карточек и устного счёта, управление задачами, LaTeX, фильтрация, печать', color: 'cyan' },
  { ver: '1.5', date: 'Январь 2026', title: 'Теория', desc: 'Модуль теории, создание задач через интерфейс', color: 'cyan' },
  { ver: '2.0', date: 'Февраль 2026', title: 'Контрольные работы', desc: 'Конструктор из блоков тем, 3 режима генерации, drag & drop между вариантами', color: 'pink' },
  { ver: '3.0', date: 'Февраль 2026', title: 'Ученический интерфейс', desc: 'Полный поток тестирования: вход → тест → автопроверка → результаты. Редактор работ, выдача по QR', color: 'purple' },
  { ver: '3.1', date: 'Февраль 2026', title: 'Достижения', desc: 'Первые 30 достижений, аккаунты учеников, панель прогресса', color: 'orange' },
  { ver: '3.4', date: 'Февраль 2026', title: 'Переезд на VPS', desc: 'PocketBase на task-ege.oipav.ru, nginx, SSL, автобэкапы каждые 6 часов', color: 'cyan' },
  { ver: '3.6', date: 'Февраль 2026', title: 'Геометрия + лендинг', desc: 'GeoGebra-интеграция, листы A5, student.oipav.ru, лендинг', color: 'purple' },
  { ver: '3.8', date: 'Март 2026', title: 'ТДФ', desc: 'Теоремы, определения, формулы: конспекты и варианты опроса, экспорт в Markdown', color: 'cyan' },
  { ver: '3.9.31', date: 'Апрель 2026', title: 'Импорт «Решу ЕГЭ»', desc: 'Парсер sdamgia (база, профиль, ОГЭ, ВПР) с критериями и чертежами, LLM-нормализация LaTeX. Маршрутные листы, QR и пиксель-арт', color: 'pink' },
  { ver: '3.9.38', date: 'Май 2026', title: 'Векторный поиск', desc: 'Семантический подбор на bge-m3 + sqlite-vec: похожие, анти-дубль, параллельные варианты, работа над ошибками', color: 'purple' },
  { ver: '3.9.50', date: 'Май 2026', title: 'Пространство учителя', desc: 'Классы, журнал оценок, КТП с экспортом в Word, календарь уроков, заметки на блочном редакторе', color: 'orange' },
  { ver: '3.9.96', date: 'Июнь 2026', title: 'Организация урока', desc: 'Библиотека материалов, расписание пар и интенсивов, посещаемость, ученики «без аккаунта», числовые прямые', color: 'pink' },
  { ver: '3.9.110', date: 'Июнь–июль 2026', title: 'Банк МЦНМО и листки', desc: '17 600 задач по геометрии МЦНМО, листки Р. К. Гордина (57 школа), курсы-интенсивы', color: 'cyan' },
  { ver: '3.9.116', date: 'Июль 2026', title: 'Бланки по фото и несколько учителей', desc: 'Проверка бланков ответов №1 по фотографии; владельцы данных, шаринг работ, передача учеников', color: 'purple' },
  { ver: '3.9.130', date: 'Август 2026', title: 'Открытый код', desc: 'Лицензия AGPL-3.0 вместо «все права защищены»', color: 'orange' },
  { ver: '3.9.149', date: 'Сентябрь 2026', title: 'Печатный движок и «Уравнения»', desc: 'Входная контрольная и общий лист печати: только чёрная краска, колонки, «N на лист». Генераторы уравнений, неравенств, метода интервалов; сохранённые листы', color: 'pink' },
  { ver: '3.9.192', date: 'Сентябрь 2026', title: 'ЕГЭ-2027', desc: 'Профильный ЕГЭ переведён на 20 заданий; архивные темы', color: 'cyan' },
  { ver: '3.9.214', date: 'Сентябрь 2026', title: 'Раздел «Функции»', desc: 'Задания по графику, вычисление производных, графики и диаграммы — ответ считает та же модель, что рисует чертёж', color: 'purple' },
  { ver: '3.9.236', date: 'Сентябрь 2026', title: 'Журнал класса', desc: 'Бумажные и онлайн-работы в одной сетке, интенсив, черновики отзывов от ИИ без имён учеников', color: 'orange' },
  { ver: '3.9.244', date: 'Сентябрь 2026', title: 'Живые стереочертежи', desc: 'Свой редактор сечений с эфиром на телефоны учеников; редактор планиметрии (3.9.264)', color: 'pink' },
  { ver: '3.9.271', date: 'Октябрь 2026', title: 'Геометрия как раздел', desc: 'Единый банк с фасетами, работы с вариантами, генератор задач по стереометрии, ссылка ученикам', color: 'cyan' },
  { ver: '3.9.291', date: 'Октябрь 2026', title: 'Уроки и ДЗ ученикам', desc: 'Расписание и ДЗ в кабинете, «ДЗ к следующему уроку», новая главная ученика, показ условий без выдачи', color: 'purple' },
  { ver: '3.9.347', date: 'Октябрь 2026', title: 'Тригонометрия на модели', desc: 'Ядро генераторов и сторож-тест: каждый ответ пересчитывается по напечатанному условию; тела вращения в стереоредакторе', color: 'orange' },
  { ver: '3.9.358', date: 'Октябрь 2026', title: 'Материалы урока и PWA', desc: 'Материалы урока одним списком, кабинет ученика как приложение на телефоне, подписка календаря, «Банк задач»', color: 'pink' },
]

const ANSWER_CHECKER_FEATURES = [
  { icon: '½', title: 'Дроби и десятичные', desc: '0,5 = 1/2 = \\frac{1}{2}; смешанные числа 2 1/3 = 7/3' },
  { icon: '√', title: 'Корни и π — точно', desc: '√3/2 ≠ 0,866: значение сравнивается точно, а не приближённо' },
  { icon: '|', title: 'Альтернативы', desc: 'Несколько правильных ответов через разделитель «|»' },
  { icon: '✓', title: 'Засчитать вручную', desc: 'Спорный ответ учитель засчитывает или исправляет — балл пересчитается' },
]

const TEACHER_NAV = [
  { key: 'workspace', label: 'Моё пространство', comp: 'Сегодня · Классы · Календарь · КТП · Журнал · Заметки · Дела · Библиотека · Каникулы' },
  { key: 'tasks', label: 'Все задачи', comp: 'Список с фильтрами и массовыми операциями' },
  { key: 'bank', label: 'Банк задач', comp: 'Обзор, покрытие экзаменов, справочники, дубли, похожие' },
  { key: 'worksheets', label: 'Рабочие листы', comp: 'Генератор · Варианты ЕГЭ/ОГЭ · Калькулятор баллов · Контрольные · Входная · Тесты с выбором' },
  { key: 'gamification', label: 'Геймификация', comp: 'QR · Пиксель-арт · Командный · Шифровки · Маршрутный лист · Марафон · Кроссворды · Сортировщик' },
  { key: 'works', label: 'Мои работы', comp: 'Работы, тесты, листы генераторов, выдачи и результаты' },
  { key: 'students', label: 'Ученики', comp: 'Прогресс · Тепловая карта · Достижения' },
  { key: 'import', label: 'Импорт', comp: 'Задачи (файл, «Решу», промпт для ИИ) · Работа целиком' },
  { key: 'geometry', label: 'Геометрия', comp: 'Задачи · Работы · Генератор задач · Планиметрия · Стереометрия' },
  { key: 'trig', label: 'Тригонометрия', comp: '15 листов: от единичной окружности до уравнений части 2' },
  { key: 'math', label: 'Устный счёт · Уравнения · Функции', comp: '7 + 8 + 3 генератора' },
  { key: 'tdf', label: 'ТДФ · Теория · Листки', comp: 'Наборы и карточки, статьи, листки Гордина' },
]

/* ─── component ─── */

const HowItWorksPage = () => {
  const [navScrolled, setNavScrolled] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('v2-visible'); obs.unobserve(e.target) }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
    )
    document.querySelectorAll('.v2-reveal').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const scrollTo = id => {
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="v2-page v2-how-page">
      {/* NAV */}
      <nav className={`v2-nav ${navScrolled ? 'v2-nav--scrolled' : ''}`}>
        <div className="v2-container v2-nav-inner">
          <a href="/landing.html" className="v2-nav-logo">
            <img src="/lemma-logo-new.png" alt="Lemma" className="v2-nav-logo-img" />
          </a>
          <ul className={`v2-nav-links ${mobileOpen ? 'v2-nav-links--open' : ''}`}>
            <li><a onClick={() => scrollTo('overview')}>Обзор</a></li>
            <li><a onClick={() => scrollTo('modules')}>Модули</a></li>
            <li><a onClick={() => scrollTo('interfaces')}>Интерфейсы</a></li>
            <li><a onClick={() => scrollTo('flow')}>Поток работы</a></li>
            <li><a onClick={() => scrollTo('achievements')}>Достижения</a></li>
            <li><a onClick={() => scrollTo('tech')}>Технологии</a></li>
            <li><a onClick={() => scrollTo('versions')}>Версии</a></li>
            <li>
              <a href="https://github.com/evilfaust/lemma" className="v2-btn v2-btn--primary v2-nav-cta">
                GitHub
              </a>
            </li>
          </ul>
          <button className="v2-nav-burger" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <header className="v2-how-hero" id="overview">
        <div className="v2-how-hero-mesh" />
        <div className="v2-container" style={{ position: 'relative', zIndex: 2 }}>
          <div className="v2-how-hero-badge">v{APP_VERSION} • {formatDate(BUILD_DATE)}</div>

          <h1 className="v2-how-title">
            Lemma —<br />
            <span className="v2-gradient-text">полный обзор платформы</span>
          </h1>

          <p className="v2-how-subtitle">
            Рабочее место учителя математики: банк задач с импортом из «Решу ЕГЭ», генераторы и тренажёры с проверенными ответами, полные варианты КИМ, поиск похожих задач по смыслу, живые стереочертежи с эфиром на телефоны учеников, геометрия, теория и ТДФ, уроки с материалами и ДЗ, журнал класса и проверка бланков по фото. Учитель, ученик и лендинг — три отдельных приложения.
          </p>

          <div className="v2-how-hero-actions">
            <a href="https://github.com/evilfaust/lemma" className="v2-btn v2-btn--primary">Исходный код на GitHub</a>
            <a href="/landing.html" className="v2-btn v2-btn--outline">← На главную</a>
          </div>

          <div className="v2-how-facts">
            {HERO_FACTS.map(f => (
              <div className="v2-how-fact" key={f.value}>
                <div className="v2-how-fact-value" style={{ color: `var(--v2-${f.color})` }}>{f.value}</div>
                <p>{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ═══════════════════ CORE MODULES (Bento Grid) ═══════════════════ */}
      <section className="v2-section" id="modules">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Экосистема</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
              Основные <span className="v2-gradient-text">модули</span>
            </h2>
            <p>От банка задач и генераторов до чертежей, уроков и журнала класса.</p>
          </div>

          <div className="v2-bento v2-reveal">
            {CORE_MODULES.map((m, i) => (
              <article key={i} className={`v2-bento-card v2-bento-card--${m.color} ${m.wide ? 'v2-bento-card--wide' : ''} v2-stagger`}>
                <div className={`v2-bento-num v2-bento-num--${m.color}`}>{m.num}</div>
                <h3 className="v2-bento-title">{m.title}</h3>
                <p className="v2-bento-desc">{m.desc}</p>
                {m.details && (
                  <ul className="v2-how-list" style={{ marginTop: 12 }}>
                    {m.details.map((d, j) => <li key={j}>{d}</li>)}
                  </ul>
                )}
                <div className="v2-bento-tags" style={{ marginTop: 12 }}>
                  {m.tags.map((t, j) => (
                    <span key={j} className={`v2-bento-tag v2-bento-tag--${m.color}`}>{t}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ WORK EDITOR & ANALYTICS ═══════════════════ */}
      <section className="v2-section v2-how-interfaces" id="work-tools">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Инструменты</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              Мои работы и <span className="v2-gradient-text--hot">банк задач</span>
            </h2>
          </div>

          <div className="v2-how-feature-grid v2-reveal">
            <div className="v2-how-feature-card v2-stagger">
              <h3 style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-display)', fontSize: 20 }}>
                WorkEditor
              </h3>
              <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.65 }}>
                «Мои работы» — работы, тесты и листы генераторов с папками и закреплением. В редакторе — состав вариантов, выдачи, результаты и уроки, к которым работа прикреплена.
              </p>
              <ul className="v2-how-list" style={{ marginTop: 12 }}>
                <li>Замена задачи похожей, параллельные варианты, перенос между вариантами</li>
                <li>Печать листом общего движка, показ условий ученикам без выдачи</li>
                <li>Результаты по всем выдачам, «ещё попытка», Excel, ручное закрытие результатов</li>
                <li>Защита: при наличии попыток — только «Сохранить как новую»</li>
              </ul>
            </div>

            <div className="v2-how-feature-card v2-stagger">
              <h3 style={{ color: 'var(--v2-pink)', fontFamily: 'var(--v2-font-display)', fontSize: 20 }}>
                Банк задач
              </h3>
              <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.65 }}>
                Обзор банка: покрытие экзаменов по номерам заданий (есть ли ответ, решение, в работах ли, решаемость), «Требует внимания» со ссылками в отфильтрованный список, состав и источники.
              </p>
              <ul className="v2-how-list" style={{ marginTop: 12 }}>
                <li>Справочники тем, подтем, тегов и источников</li>
                <li>Дубли по тексту и «похожие» по смыслу — пометить, объединить, удалить</li>
                <li>«Чаще всего ошибаются» — по попыткам учеников</li>
                <li>Лёгкий снимок банка для фильтров без тяжёлых полей</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ TWO INTERFACES ═══════════════════ */}
      <section className="v2-section" id="interfaces" style={{ background: 'rgba(255,255,255,0.01)' }}>
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Архитектура</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              Два изолированных <span className="v2-gradient-text">интерфейса</span>
            </h2>
            <p>Учитель и ученик работают в разных приложениях. Общий код (API, MathRenderer, движки чертежей) вынесен в shared/ и utils/.</p>
          </div>

          <div className="v2-how-columns v2-reveal">
            {/* Teacher */}
            <div className="v2-how-column v2-stagger" style={{ borderColor: 'rgba(0,245,212,0.2)' }}>
              <h3 style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-display)' }}>
                Учитель <span style={{ fontFamily: 'var(--v2-font-mono)', fontSize: 14, color: 'var(--v2-text-muted)' }}>l.oipav.ru</span>
              </h3>
              <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.65, marginBottom: 16 }}>
                Рабочее место учителя: подготовка работ, уроки, выдача и проверка, журнал класса. Роли superadmin / editor / viewer и доступ по разделам.
              </p>
              <div className="v2-how-student-list">
                {TEACHER_FEATURES.map((f, i) => (
                  <div className="v2-how-student-item" key={i}>
                    <span style={{ background: 'var(--v2-cyan)', boxShadow: '0 0 18px rgba(0,245,212,0.6)' }} />
                    <p>{f}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Student */}
            <div className="v2-how-column v2-stagger" style={{ borderColor: 'rgba(131,56,236,0.2)' }}>
              <h3 style={{ color: 'var(--v2-purple)', fontFamily: 'var(--v2-font-display)' }}>
                Ученик <span style={{ fontFamily: 'var(--v2-font-mono)', fontSize: 14, color: 'var(--v2-text-muted)' }}>student.oipav.ru</span>
              </h3>
              <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.65, marginBottom: 16 }}>
                Кабинет ученика для телефона, ставится как приложение. Деплоится отдельно; лёгкий старт — экраны грузятся по мере надобности.
              </p>
              <div className="v2-how-student-list">
                {STUDENT_FEATURES.map((f, i) => (
                  <div className="v2-how-student-item" key={i}>
                    <span style={{ background: 'var(--v2-purple)', boxShadow: '0 0 18px rgba(131,56,236,0.6)' }} />
                    <p>{f}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Teacher navigation */}
          <div className="v2-reveal" style={{ marginTop: 40 }}>
            <h3 style={{ fontFamily: 'var(--v2-font-display)', fontSize: 20, marginBottom: 16 }}>
              Меню учителя — <span style={{ color: 'var(--v2-text-muted)' }}>{TEACHER_NAV.length} разделов</span>
            </h3>
            <div className="v2-how-modules">
              {TEACHER_NAV.map(n => (
                <div className="v2-how-module" key={n.key}>
                  <h3 style={{ fontFamily: 'var(--v2-font-mono)', fontSize: 13, color: 'var(--v2-cyan)' }}>{n.label}</h3>
                  <p style={{ fontSize: 13 }}>{n.comp}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ TESTING FLOW ═══════════════════ */}
      <section className="v2-section v2-how-process" id="flow">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Поток работы</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              От <span className="v2-gradient-text--hot">создания</span> до <span className="v2-gradient-text--hot">анализа</span>
            </h2>
            <p>Полный цикл: учитель готовит работу → ученики решают → автопроверка → достижения → журнал и коррекция</p>
          </div>

          <div className="v2-how-flow v2-reveal">
            {FLOW_STEPS.map(step => (
              <div className="v2-how-flow-item v2-stagger" key={step.num} style={{
                borderLeft: `3px solid var(--v2-${step.side === 'teacher' ? 'cyan' : 'purple'})`,
              }}>
                <div className="v2-how-flow-num" style={{
                  background: step.side === 'teacher' ? 'rgba(0,245,212,0.15)' : 'rgba(131,56,236,0.15)',
                  color: step.side === 'teacher' ? 'var(--v2-cyan)' : 'var(--v2-purple)',
                }}>{step.num}</div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {step.title}
                    <span style={{
                      fontSize: 11,
                      fontFamily: 'var(--v2-font-mono)',
                      color: step.side === 'teacher' ? 'var(--v2-cyan)' : 'var(--v2-purple)',
                      opacity: 0.7,
                      textTransform: 'uppercase',
                    }}>{step.side === 'teacher' ? 'учитель' : 'ученик'}</span>
                  </h4>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ ACHIEVEMENT SYSTEM ═══════════════════ */}
      <section className="v2-section" id="achievements">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Мотивация</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              <span className="v2-gradient-text">{ACHIEVEMENTS_DATA.total}</span> достижений
            </h2>
            <p>Геймификация учебного процесса: случайные бейджи за каждую попытку + условные разблокировки. Глобальная дедупликация по всем сессиям.</p>
          </div>

          {/* Random badges */}
          <div className="v2-how-tech-grid v2-reveal">
            {ACHIEVEMENTS_DATA.random.map(r => (
              <div className="v2-how-tech-card v2-stagger" key={r.rarity} style={{ borderColor: `${r.color}33` }}>
                <h3 style={{ color: r.color, fontFamily: 'var(--v2-font-display)', fontSize: 18 }}>
                  {r.label}
                </h3>
                <p style={{ color: 'var(--v2-text-dim)', marginTop: 8, lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--v2-text)' }}>{r.condition}</strong><br />
                  {r.examples}
                </p>
              </div>
            ))}
          </div>

          {/* Conditional achievements */}
          <div className="v2-how-feature-grid v2-reveal" style={{ marginTop: 20 }}>
            {ACHIEVEMENTS_DATA.conditional.map(c => (
              <div className="v2-how-feature-card v2-stagger" key={c.name} style={{ padding: 16 }}>
                <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{c.icon}</span> {c.name}
                </h3>
                <p style={{ color: 'var(--v2-text-dim)', marginTop: 6, lineHeight: 1.5, fontSize: 14 }}>{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Extra info */}
          <div className="v2-reveal" style={{ marginTop: 24 }}>
            <div className="v2-how-feature-card" style={{ background: 'linear-gradient(135deg, rgba(0,245,212,0.04), rgba(131,56,236,0.04))' }}>
              <ul className="v2-how-list">
                <li>Учитель может выдать достижения вручную из панели результатов</li>
                <li>«Розыгрыш»: из подходящих наград за попытку выпадает одна, вес — по редкости</li>
                <li>Включение/отключение достижений на уровне сессии</li>
                <li>Polling каждые 10 секунд для обновления наград от учителя</li>
                <li>Achievement Engine: <code style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-mono)' }}>utils/achievementEngine.js</code></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ ANSWER CHECKER ═══════════════════ */}
      <section className="v2-section v2-how-interfaces">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Автопроверка</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              Умная проверка <span className="v2-gradient-text--hot">ответов</span>
            </h2>
            <p>Ответ сравнивается по значению: дроби, десятичные, корни, π и альтернативные ответы.</p>
          </div>

          <div className="v2-how-feature-grid v2-reveal">
            {ANSWER_CHECKER_FEATURES.map(f => (
              <div className="v2-how-feature-card v2-stagger" key={f.title}>
                <h3 style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24, fontFamily: 'var(--v2-font-mono)', color: 'var(--v2-cyan)' }}>{f.icon}</span>
                  {f.title}
                </h3>
                <p style={{ color: 'var(--v2-text-dim)', marginTop: 8, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="v2-reveal" style={{ marginTop: 20 }}>
            <div className="v2-how-feature-card" style={{ fontFamily: 'var(--v2-font-mono)', fontSize: 14, lineHeight: 1.8, color: 'var(--v2-text-dim)' }}>
              <span style={{ color: 'var(--v2-text-muted)' }}>// Примеры эквивалентных ответов:</span><br />
              <span style={{ color: 'var(--v2-cyan)' }}>0,5</span> = <span style={{ color: 'var(--v2-cyan)' }}>1/2</span> = <span style={{ color: 'var(--v2-cyan)' }}>\frac{'{1}{2}'}</span><br />
              <span style={{ color: 'var(--v2-cyan)' }}>2 1/3</span> = <span style={{ color: 'var(--v2-cyan)' }}>7/3</span><br />
              <span style={{ color: 'var(--v2-cyan)' }}>√3/2</span> ≠ <span style={{ color: 'var(--v2-pink)' }}>0,866</span> — корни и π сравниваются точно<br />
              <span style={{ color: 'var(--v2-pink)' }}>3|3,0</span> — альтернативные формы через «|»<br />
              <span style={{ color: 'var(--v2-text-muted)' }}>// utils/answerChecker.js · drillAnswer.js · exactValue.js</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ PDF EXPORT & IMPORT ═══════════════════ */}
      <section className="v2-section">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Ввод / Вывод</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              Печать и <span className="v2-gradient-text">импорт</span>
            </h2>
          </div>

          <div className="v2-how-feature-grid v2-reveal">
            <div className="v2-how-feature-card v2-stagger">
              <h3 style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-display)', fontSize: 20 }}>
                Печать из браузера
              </h3>
              <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.65, marginBottom: 12 }}>
                Всё печатается на стороне ученика и учителя — сервер PDF не генерирует.
              </p>
              <ul className="v2-how-list">
                <li><strong style={{ color: 'var(--v2-text)' }}>Общий печатный движок:</strong> миллиметровая вёрстка A4, только чёрная краска, 1–2 колонки, «N на лист», 2 варианта на листе</li>
                <li><strong style={{ color: 'var(--v2-text)' }}>Место для решения:</strong> клетка 5 мм, линейка или пусто; чертёж сбоку, решение обходит его «Г»-образно</li>
                <li><strong style={{ color: 'var(--v2-text)' }}>Чертежи под место:</strong> планиметрия и стерео строятся заново под размер на бумаге, буквы как в условии</li>
                <li><strong style={{ color: 'var(--v2-text)' }}>PDF:</strong> из диалога печати или html2pdf.js — ничего не уходит на сервер</li>
              </ul>
            </div>

            <div className="v2-how-feature-card v2-stagger">
              <h3 style={{ color: 'var(--v2-pink)', fontFamily: 'var(--v2-font-display)', fontSize: 20 }}>
                Импорт задач
              </h3>
              <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.65, marginBottom: 12 }}>
                Несколько способов наполнения банка — и переноса чужих работ.
              </p>
              <ul className="v2-how-list">
                <li><strong style={{ color: 'var(--v2-text)' }}>«Решу ЕГЭ»:</strong> страница, номер или скриншот списка номеров → задачи с критериями и чертежами</li>
                <li><strong style={{ color: 'var(--v2-text)' }}>Работа целиком (.md):</strong> шапка, варианты, ответы и чертежи текстом; с фото — через готовый промпт для ИИ</li>
                <li><strong style={{ color: 'var(--v2-text)' }}>Markdown + YAML:</strong> файлы задач с темой, подтемой, сложностью и тегами</li>
                <li><strong style={{ color: 'var(--v2-text)' }}>Создание вручную:</strong> редактор с предпросмотром, конструкторы графиков, диаграмм и чертежей</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ TECH STACK ═══════════════════ */}
      <section className="v2-section v2-how-process" id="tech">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Под капотом</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              Технологический <span className="v2-gradient-text">стек</span>
            </h2>
          </div>

          <div className="v2-how-tech-grid v2-reveal" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {TECH_STACK.map(group => (
              <div className="v2-how-tech-card v2-stagger" key={group.title}>
                <h3 style={{ fontFamily: 'var(--v2-font-mono)', color: 'var(--v2-cyan)', fontSize: 14 }}>
                  // {group.title}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                  {group.items.map(item => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ width: 4, height: 4, background: 'var(--v2-cyan)', borderRadius: '50%', flexShrink: 0, marginTop: 8 }} />
                      <div>
                        <span style={{ color: 'var(--v2-text)', fontWeight: 600 }}>{item.name}</span>
                        {item.ver && <span style={{ color: 'var(--v2-text-muted)', fontFamily: 'var(--v2-font-mono)', fontSize: 12, marginLeft: 6 }}>{item.ver}</span>}
                        <span style={{ color: 'var(--v2-text-dim)', fontSize: 13, marginLeft: 6 }}>— {item.note}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ DATABASE SCHEMA ═══════════════════ */}
      <section className="v2-section" id="database">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Данные</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              База данных — <span className="v2-gradient-text">основные коллекции</span>
            </h2>
            <p>PocketBase (SQLite) — единая база: REST API, Auth, файлы, правила доступа на уровне коллекций и JS-хуки.</p>
          </div>

          {DB_COLLECTIONS.map(group => (
            <div className="v2-reveal" key={group.group} style={{ marginBottom: 28 }}>
              <h3 style={{ fontFamily: 'var(--v2-font-display)', fontSize: 18, marginBottom: 12, color: 'var(--v2-text)' }}>
                {group.group}
              </h3>
              <div className="v2-how-data-grid">
                {group.items.map(item => (
                  <div className="v2-how-data-card" key={item.name}>
                    <h3>{item.name}</h3>
                    <p style={{ marginBottom: 6 }}>{item.desc}</p>
                    <div style={{ fontSize: 12, color: 'var(--v2-text-muted)', fontFamily: 'var(--v2-font-mono)', lineHeight: 1.5 }}>
                      {item.fields}
                    </div>
                    {item.rel !== '—' && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        <span style={{ color: 'var(--v2-text-muted)' }}>rel: </span>
                        <span style={{ color: 'var(--v2-purple)' }}>{item.rel}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Schema diagram */}
          <div className="v2-reveal">
            <div className="v2-how-feature-card" style={{ fontFamily: 'var(--v2-font-mono)', fontSize: 13, lineHeight: 1.9, color: 'var(--v2-text-dim)', background: '#0a0a0a' }}>
              <h3 style={{ fontFamily: 'var(--v2-font-display)', fontSize: 16, color: 'var(--v2-text)', marginBottom: 12 }}>Схема связей</h3>
              <span style={{ color: 'var(--v2-cyan)' }}>topics</span> ←── subtopics.topic, tasks.topic<br />
              <span style={{ color: 'var(--v2-pink)' }}>tasks</span> ←── variants.tasks, attempt_answers.task, task_images.task<br />
              <span style={{ color: 'var(--v2-pink)' }}>works</span> ←── variants.work, work_sessions.work<br />
              <span style={{ color: 'var(--v2-purple)' }}>work_sessions</span> ←── attempts.session<br />
              <span style={{ color: 'var(--v2-purple)' }}>teaching_groups</span> ←── group_memberships.group, lessons.group, journal_columns.group, prev_group<br />
              <span style={{ color: 'var(--v2-orange)' }}>lessons</span> ←── lesson_attendance.lesson, journal_columns.lesson<br />
              <span style={{ color: 'var(--v2-orange)' }}>students</span> ←── attempts.student, group_memberships.student, journal_marks.student<br />
              <span style={{ color: 'var(--v2-orange)' }}>teachers</span> ←── owner в личных коллекциях, co_teachers у класса
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ VPS DEPLOY ═══════════════════ */}
      <section className="v2-section v2-how-interfaces">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Инфраструктура</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              Архитектура <span className="v2-gradient-text">деплоя</span>
            </h2>
          </div>

          {/* VPS Architecture diagram */}
          <div className="v2-reveal">
            <div className="v2-how-feature-card" style={{ background: '#0a0a0a', fontFamily: 'var(--v2-font-mono)', fontSize: 13, lineHeight: 2, color: 'var(--v2-text-dim)' }}>
              <span style={{ color: 'var(--v2-cyan)', fontWeight: 600 }}>nginx (443)</span> → task-ege.oipav.ru<br />
              {'  '}<span style={{ color: 'var(--v2-text-muted)' }}>/api/, /_/</span>{'    '}→ PocketBase <span style={{ color: 'var(--v2-purple)' }}>(:8095)</span>{'   '}systemd: pocketbase-ege<br />
              {'  '}<span style={{ color: 'var(--v2-text-muted)' }}>/pdf/</span>{'        '}→ Backend helper <span style={{ color: 'var(--v2-purple)' }}>(:3001)</span>{'  '}systemd: pdf-service-ege<br />
              <br />
              <span style={{ color: 'var(--v2-cyan)', fontWeight: 600 }}>nginx (443)</span> → student.oipav.ru<br />
              {'  '}<span style={{ color: 'var(--v2-text-muted)' }}>/</span>{'            '}→ /var/www/student-ege/student.html <span style={{ color: 'var(--v2-purple)' }}>(SPA + PWA)</span><br />
              <br />
              <span style={{ color: 'var(--v2-cyan)', fontWeight: 600 }}>nginx (443)</span> → lemma.oipav.ru{'  '}→ /var/www/landings/lemma/ <span style={{ color: 'var(--v2-purple)' }}>(лендинг)</span><br />
              <span style={{ color: 'var(--v2-cyan)', fontWeight: 600 }}>Raspberry Pi</span> → l.oipav.ru{'     '}→ учительское приложение <span style={{ color: 'var(--v2-purple)' }}>(Docker nginx)</span>
            </div>
          </div>

          <div className="v2-how-tech-grid v2-reveal" style={{ marginTop: 20 }}>
            {VPS_ARCH.map(s => (
              <div className="v2-how-tech-card v2-stagger" key={s.service}>
                <h3 style={{ fontFamily: 'var(--v2-font-display)', color: 'var(--v2-cyan)', fontSize: 16, marginBottom: 4 }}>
                  {s.service}
                </h3>
                <div style={{ fontFamily: 'var(--v2-font-mono)', fontSize: 12, color: 'var(--v2-text-muted)', marginBottom: 10 }}>
                  порт {s.port} • {s.systemd}
                </div>
                <p style={{ color: 'var(--v2-text-dim)', lineHeight: 1.5, fontSize: 14, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Backup info */}
          <div className="v2-reveal" style={{ marginTop: 20 }}>
            <div className="v2-how-feature-card" style={{ background: 'linear-gradient(135deg, rgba(0,245,212,0.04), rgba(131,56,236,0.04))' }}>
              <h3 style={{ fontFamily: 'var(--v2-font-display)', fontSize: 18, marginBottom: 12 }}>Резервное копирование</h3>
              <ul className="v2-how-list">
                <li>Автоматические бэкапы на VPS каждые 6 часов (root-cron): 4 последних локально</li>
                <li>Off-site в S3 (Timeweb): 30 суточных + 12 месячных копий</li>
                <li>В бэкап входят <code style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-mono)' }}>data.db</code>, <code style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-mono)' }}>vec.db</code> (вектор-индекс) и <code style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-mono)' }}>storage/</code> (чертежи)</li>
                <li>Безопасный бэкап через <code style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-mono)' }}>sqlite3 .backup</code> — safe while running</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ API OVERVIEW ═══════════════════ */}
      <section className="v2-section" id="api">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">API</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              <span className="v2-gradient-text--hot">{API_GROUPS.reduce((s, g) => s + g.count, 0)}+</span> методов API
            </h2>
            <p>Тонкий barrel <code style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-mono)' }}>pocketbase.js</code> реэкспортирует доменные модули <code style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-mono)' }}>shared/services/pb/*.js</code>. Контракт <code style={{ color: 'var(--v2-cyan)', fontFamily: 'var(--v2-font-mono)' }}>import {'{ api }'}</code> неизменен.</p>
          </div>

          <div className="v2-how-data-grid v2-reveal">
            {API_GROUPS.map(g => (
              <div className="v2-how-data-card v2-stagger" key={g.name}>
                <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{g.name}</span>
                  <span style={{ fontSize: 18, color: 'var(--v2-text)', fontFamily: 'var(--v2-font-display)' }}>{g.count}</span>
                </h3>
                <p style={{ fontSize: 12, fontFamily: 'var(--v2-font-mono)', lineHeight: 1.5 }}>{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ VERSION HISTORY ═══════════════════ */}
      <section className="v2-section v2-how-process" id="versions">
        <div className="v2-container">
          <div className="v2-section-header v2-reveal">
            <span className="v2-label">Эволюция</span>
            <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}>
              История <span className="v2-gradient-text">версий</span>
            </h2>
            <p>Ключевые вехи развития платформы — от первого генератора до полной экосистемы.</p>
          </div>

          <div className="v2-how-flow v2-reveal">
            {VERSION_MILESTONES.map(m => (
              <div className="v2-how-flow-item v2-stagger" key={m.ver} style={{
                borderLeft: `3px solid var(--v2-${m.color})`,
              }}>
                <div className="v2-how-flow-num" style={{
                  background: `rgba(${m.color === 'cyan' ? '0,245,212' : m.color === 'pink' ? '255,0,110' : m.color === 'purple' ? '131,56,236' : '251,86,7'},0.15)`,
                  color: `var(--v2-${m.color})`,
                  fontSize: 12,
                  width: 'auto',
                  minWidth: 84,
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 18,
                  whiteSpace: 'nowrap',
                }}>v{m.ver}</div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {m.title}
                    <span style={{ fontSize: 12, fontFamily: 'var(--v2-font-mono)', color: 'var(--v2-text-muted)' }}>{m.date}</span>
                  </h4>
                  <p>{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA + FOOTER ═══════════════════ */}
      <section className="v2-section">
        <div className="v2-container">
          <div className="v2-how-highlight v2-reveal">
            <div className="v2-how-highlight-card">
              <span className="v2-label">Готовы начать?</span>
              <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
                Управляйте учебным процессом <span className="v2-gradient-text">эффективно</span>
              </h2>
              <p>
                Бесплатно и с открытым кодом (AGPL-3.0). Ученики подключаются по ссылке или QR-коду. Импорт из «Решу ЕГЭ», варианты КИМ-2027, тренажёры с проверенными ответами, живые чертежи, уроки и журнал класса, проверка бланков по фото и 106 достижений.
              </p>
              <div className="v2-how-highlight-actions">
                <a href="https://github.com/evilfaust/lemma" className="v2-btn v2-btn--primary">Исходный код на GitHub →</a>
                <a href="/landing.html" className="v2-btn v2-btn--outline">← На главную</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="v2-footer">
        <div className="v2-container v2-footer-inner">
          <span>Lemma &copy; {new Date().getFullYear()} • v{APP_VERSION}</span>
          <a href="https://github.com/evilfaust/lemma" className="v2-footer-link">github.com/evilfaust/lemma</a>
        </div>
      </footer>
    </div>
  )
}

export default HowItWorksPage
