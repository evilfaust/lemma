/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const topics = app.findCollectionByNameOrId("topics");

  // 1. Обновляем поле exam_type: добавляем ege_profile и trig к существующим значениям
  topics.fields.add(new Field({
    "id":           "select_topics_exam_type",
    "name":         "exam_type",
    "type":         "select",
    "required":     false,
    "presentable":  false,
    "hidden":       false,
    "system":       false,
    "maxSelect":    1,
    "values":       ["ege_base", "ege_profile", "mordkovich", "oral", "vpr", "trig", "other"]
  }));

  // 2. Добавляем поле exam_part (для профильного ЕГЭ: часть 1 или часть 2)
  topics.fields.add(new Field({
    "id":           "number_topics_exam_part",
    "name":         "exam_part",
    "type":         "number",
    "required":     false,
    "presentable":  false,
    "hidden":       false,
    "system":       false,
    "min":          null,
    "max":          null,
    "onlyInt":      true
  }));

  app.save(topics);
  console.log('Updated exam_type values and added exam_part field to topics');

  // 3. Создаём темы для тригонометрических генераторов
  const db = app.db();
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  const trigTopics = [
    { id: 'trigtopic000001', title: 'Вычисление тригонометрических выражений', order: 100 },
    { id: 'trigtopic000002', title: 'Простейшие тригонометрические уравнения',  order: 101 },
    { id: 'trigtopic000003', title: 'Обратные тригонометрические функции',       order: 102 },
    { id: 'trigtopic000004', title: 'Формулы двойного аргумента',                order: 103 },
    { id: 'trigtopic000005', title: 'Уравнения f(kx+b)=a',                       order: 104 },
    { id: 'trigtopic000006', title: 'Формулы приведения',                        order: 105 },
    { id: 'trigtopic000007', title: 'Формулы сложения',                          order: 106 },
  ];

  for (const t of trigTopics) {
    db.newQuery(
      `INSERT OR IGNORE INTO topics (id, created, updated, title, section, exam_type, "order")
       VALUES ('${t.id}', '${now}', '${now}', '${t.title}', 'Алгебра', 'trig', ${t.order})`
    ).execute();
  }
  console.log('Created 7 trig topics');

}, (app) => {
  // Откат: возвращаем exam_type к старым значениям, удаляем exam_part, удаляем trig-темы
  const topics = app.findCollectionByNameOrId("topics");

  topics.fields.add(new Field({
    "id":          "select_topics_exam_type",
    "name":        "exam_type",
    "type":        "select",
    "required":    false,
    "presentable": false,
    "hidden":      false,
    "system":      false,
    "maxSelect":   1,
    "values":      ["ege_base", "mordkovich", "oral", "vpr", "other"]
  }));

  const examPartField = topics.fields.getByName("exam_part");
  if (examPartField) topics.fields.remove(examPartField);

  app.save(topics);

  const db = app.db();
  const ids = ['trigtopic000001','trigtopic000002','trigtopic000003',
                'trigtopic000004','trigtopic000005','trigtopic000006','trigtopic000007'];
  db.newQuery(`DELETE FROM topics WHERE id IN ('${ids.join("','")}')`).execute();
  console.log('Rolled back: removed exam_part, restored exam_type values, deleted trig topics');
});
