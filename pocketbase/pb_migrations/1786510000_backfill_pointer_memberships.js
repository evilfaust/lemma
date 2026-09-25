/// <reference path="../pb_data/types.d.ts" />

// Досоздать членства ученикам, у которых указатель students.teaching_group стоит
// на группе, а строки в group_memberships для неё нет (v3.9.238).
//
// Откуда взялись: «Вписать вручную» и «Аккаунты» в карточке класса и смена
// группы в карточке ученика писали только указатель, минуя setStudentGroup.
// Пока у группы не было ни одного членства, такие ученики находились по
// указателю; появилось первое — и они пропадали из состава, журнала класса и
// посещаемости (25.09.2026: двое в «8 кл», 15 в «10 Геометрия UP» висели на
// одном указателе). Фронт v3.9.238 и пишет членство, и читает таких учеников
// сам (withPointerMembers), а эта миграция чинит историю: без строки членства
// ученика не увидел бы и мастер перевода на следующий год.
//
// Как в бэкфилле 1784300000: владелец — владелец группы, год — год группы,
// дата зачисления — 1 сентября этого года. Статус — из профиля ученика
// (выпускник/выбывший с неснятым указателем действующим не становится).
// Идемпотентно: у кого строка уже есть (любого статуса), того не трогаем.
// Откат удаляет ровно созданные здесь строки — по пометке в note.

const NOTE = "бэкфилл 1786510000: указатель без членства";

migrate((app) => {
  const col = app.findCollectionByNameOrId("group_memberships");
  const groups = {};
  for (const g of app.findRecordsByFilter("teaching_groups", "id != ''", "", 0, 0)) {
    groups[g.id] = g;
  }

  function joinedFromYear(year, fallback) {
    const m = String(year || "").match(/^(\d{4})/);
    return m ? `${m[1]}-09-01 00:00:00.000Z` : fallback;
  }

  let n = 0;
  for (const s of app.findRecordsByFilter("students", "teaching_group != ''", "", 0, 0)) {
    const gid = s.get("teaching_group");
    const g = groups[gid];
    if (!g) continue; // висячая ссылка на удалённую группу — пропускаем

    const has = app.findRecordsByFilter(
      "group_memberships", "student = {:s} && group = {:g}", "", 1, 0, { s: s.id, g: gid },
    );
    if (has.length) continue;

    const profile = s.get("status");
    const status = profile === "graduated" ? "graduated" : profile === "left" ? "left" : "active";

    const rec = new Record(col);
    rec.set("owner", g.get("owner"));
    rec.set("student", s.id);
    rec.set("group", gid);
    rec.set("year", g.get("year") || "");
    rec.set("joined", joinedFromYear(g.get("year"), s.get("created")));
    rec.set("status", status);
    rec.set("note", NOTE);
    app.save(rec);
    n += 1;
  }
  console.log(`[1786510000] Досоздано членств по указателю: ${n}`);
}, (app) => {
  const recs = app.findRecordsByFilter("group_memberships", "note = {:n}", "", 0, 0, { n: NOTE });
  for (const r of recs) app.delete(r);
  console.log(`[1786510000] Откат: удалено членств ${recs.length}`);
});
