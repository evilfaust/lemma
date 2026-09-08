/// <reference path="../pb_data/types.d.ts" />

/**
 * Модерация учеников: операции, которые нельзя сделать обычным update.
 *
 *   POST /api/students/set-password  { studentId, password? }
 *   POST /api/students/delete        { studentId, dryRun? }
 *
 * Почему хук, а не правила PocketBase:
 *  • пароль auth-записи меняется только суперюзером либо с `oldPassword`
 *    (которого у учителя нет) — учителю иначе остаётся заводить ученику
 *    второй аккаунт, а потом сливать его (см. merge_students.pb.js);
 *  • `students.deleteRule` = null (удаление закрыто наглухо), чтобы никто не
 *    снёс ученика вместе с попытками и посещаемостью; здесь удаление
 *    разрешается ТОЛЬКО для аккаунта без единой связи.
 *
 * Оба роута требуют токен учителя (editor+) и работают в его скоупе:
 * свой ученик или ещё не привязанный (owner = ""); superadmin — любой.
 *
 * ВАЖНО: обработчики хуков выполняются в изолированном контексте и НЕ видят
 * переменные внешней области файла — всё объявляется внутри колбэка.
 */

routerAdd("POST", "/api/students/set-password", (c) => {
  function generatePassword() {
    // Без похожих символов (0/O, 1/l/I) — пароль диктуется вслух и переписывается.
    const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < 8; i += 1) {
      out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return out;
  }

  function logAudit(app, teacherId, teacherName, studentId, summary) {
    try {
      const collection = app.findCollectionByNameOrId("audit_log");
      const record = new Record(collection);
      record.set("teacher_id", teacherId);
      record.set("teacher_name", teacherName);
      record.set("action", "update");
      record.set("collection_name", "students");
      record.set("record_id", studentId);
      record.set("record_summary", summary.slice(0, 500));
      app.save(record);
    } catch (err) {
      console.warn("[students-admin] audit log failed: " + String(err));
    }
  }

  try {
    const info = c.requestInfo();
    const auth = info.auth;
    if (!auth) return c.json(401, { error: "Требуется авторизация учителя" });

    const authCollection = auth.collection().name;
    const isSuperuser = authCollection === "_superusers";
    if (!isSuperuser && authCollection !== "teachers") {
      return c.json(403, { error: "Менять пароль ученика может только учитель" });
    }
    const role = isSuperuser ? "superadmin" : auth.getString("role");
    if (role === "viewer") {
      return c.json(403, { error: "Недостаточно прав" });
    }
    const isSuperadmin = isSuperuser || role === "superadmin";
    const teacherId = auth.id;
    const teacherName = isSuperuser ? "superuser" : (auth.getString("name") || auth.getString("username") || "?");

    const body = info.body || {};
    const studentId = (body["studentId"] || "").toString();
    const requested = (body["password"] || "").toString();
    if (!studentId) return c.json(400, { error: "studentId обязателен" });
    if (requested && requested.length < 8) {
      return c.json(400, { error: "Пароль короче 8 символов" });
    }

    let student;
    try {
      student = $app.findRecordById("students", studentId);
    } catch (err) {
      return c.json(404, { error: "Ученик не найден" });
    }

    const owner = student.getString("owner");
    if (!isSuperadmin && owner !== "" && owner !== teacherId) {
      return c.json(403, { error: "Ученик принадлежит другому учителю" });
    }

    const password = requested || generatePassword();
    student.setPassword(password);
    $app.save(student);

    logAudit($app, teacherId, teacherName, studentId,
      "сброшен пароль: " + (student.getString("name") || student.getString("username")));

    return c.json(200, {
      ok: true,
      username: student.getString("username"),
      password: password,
    });
  } catch (err) {
    console.error("[students-admin] set-password failed: " + String(err));
    return c.json(500, { error: String(err) });
  }
});

routerAdd("POST", "/api/students/delete", (c) => {
  try {
    // Всё, что ссылается на ученика. Непустая связь = удалять нельзя:
    // такой аккаунт либо сливают с другим, либо помечают статусом «выбыл».
    const RELATIONS = [
      { collection: "attempts", field: "student", label: "попытки" },
      { collection: "study_programs", field: "student", label: "учебные программы" },
      { collection: "course_members", field: "student", label: "участие в курсах" },
      { collection: "lesson_attendance", field: "student", label: "отметки посещаемости" },
      { collection: "teacher_todos", field: "student", label: "дела учителя" },
      { collection: "group_memberships", field: "student", label: "членство в группах" },
    ];

    function countRelated(app, collection, field, studentId) {
      try {
        return app.findRecordsByFilter(collection, field + " = {:id}", "", 0, 0, { id: studentId }).length;
      } catch (err) {
        // Коллекции может не быть (старая копия БД) — считаем, что связей нет.
        console.warn("[students-admin] count failed for " + collection + ": " + String(err));
        return 0;
      }
    }

    function logAudit(app, teacherId, teacherName, studentId, summary) {
      try {
        const collection = app.findCollectionByNameOrId("audit_log");
        const record = new Record(collection);
        record.set("teacher_id", teacherId);
        record.set("teacher_name", teacherName);
        record.set("action", "delete");
        record.set("collection_name", "students");
        record.set("record_id", studentId);
        record.set("record_summary", summary.slice(0, 500));
        app.save(record);
      } catch (err) {
        console.warn("[students-admin] audit log failed: " + String(err));
      }
    }

    const info = c.requestInfo();
    const auth = info.auth;
    if (!auth) return c.json(401, { error: "Требуется авторизация учителя" });

    const authCollection = auth.collection().name;
    const isSuperuser = authCollection === "_superusers";
    if (!isSuperuser && authCollection !== "teachers") {
      return c.json(403, { error: "Удалять аккаунт ученика может только учитель" });
    }
    const role = isSuperuser ? "superadmin" : auth.getString("role");
    if (role !== "superadmin" && !isSuperuser) {
      // Удаление — самая необратимая операция раздела, оставляем её superadmin.
      return c.json(403, { error: "Удаление доступно только суперадмину" });
    }
    const teacherId = auth.id;
    const teacherName = isSuperuser ? "superuser" : (auth.getString("name") || auth.getString("username") || "?");

    const body = info.body || {};
    const studentId = (body["studentId"] || "").toString();
    const dryRun = body["dryRun"] === true;
    if (!studentId) return c.json(400, { error: "studentId обязателен" });

    let student;
    try {
      student = $app.findRecordById("students", studentId);
    } catch (err) {
      return c.json(404, { error: "Ученик не найден" });
    }

    const counts = {};
    const blocking = [];
    for (const rel of RELATIONS) {
      const n = countRelated($app, rel.collection, rel.field, studentId);
      counts[rel.collection] = n;
      if (n > 0) blocking.push(rel.label + ": " + n);
    }

    const label = student.getString("name") || student.getString("username");

    if (dryRun) {
      return c.json(200, { ok: true, dryRun: true, counts: counts, blocking: blocking, name: label });
    }
    if (blocking.length) {
      return c.json(409, {
        error: "У ученика есть данные — удалять нельзя",
        blocking: blocking,
        counts: counts,
      });
    }

    $app.delete(student);
    logAudit($app, teacherId, teacherName, studentId, "удалён пустой аккаунт: " + label);

    return c.json(200, { ok: true, deleted: true, name: label });
  } catch (err) {
    console.error("[students-admin] delete failed: " + String(err));
    return c.json(500, { error: String(err) });
  }
});
