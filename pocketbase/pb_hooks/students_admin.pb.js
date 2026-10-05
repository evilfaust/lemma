/// <reference path="../pb_data/types.d.ts" />

/**
 * Модерация учеников: операции, которые нельзя сделать обычным update.
 *
 *   POST /api/students/set-password       { studentId, password? }
 *   POST /api/students/issue-credentials  { studentId, username?, password? }
 *   POST /api/students/delete             { studentId, dryRun? }
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
    if (requested && requested.length < 6) {
      return c.json(400, { error: "Пароль короче 6 символов" });
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
    // Пароль выдал учитель — при входе ученик придумает свой (v3.9.294).
    try { student.set("must_change_password", true); } catch (err) { /* поля ещё нет */ }
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

/**
 * Выдать ученику человекочитаемый логин и простой пароль (v3.9.294).
 * Работает и с учеником «без аккаунта» (external): запись та же, поэтому
 * отметки журнала, посещаемость и заметки остаются при нём.
 *   username — желаемый логин; занят другим учеником → ivanov.p2, ivanov.p3…
 *              (сервер видит всех учеников, клиент — только своих);
 *   password — не короче 6, пусто → сгенерировать.
 * Ставит external = false и must_change_password = true.
 * → { ok, username, password }
 */
routerAdd("POST", "/api/students/issue-credentials", (c) => {
  function generatePassword() {
    const words = ["kit", "sad", "dub", "mak", "yak", "kran", "zima", "reka", "sneg", "tigr", "zubr", "mayak", "kedr", "mir", "raketa"];
    const digits = "23456789";
    let out = words[Math.floor(Math.random() * words.length)];
    for (let i = 0; i < 3; i += 1) out += digits.charAt(Math.floor(Math.random() * digits.length));
    return out;
  }

  try {
    const info = c.requestInfo();
    const auth = info.auth;
    if (!auth) return c.json(401, { error: "Требуется авторизация учителя" });
    const authCollection = auth.collection().name;
    const isSuperuser = authCollection === "_superusers";
    if (!isSuperuser && authCollection !== "teachers") {
      return c.json(403, { error: "Выдать логин может только учитель" });
    }
    const role = isSuperuser ? "superadmin" : auth.getString("role");
    if (role === "viewer") return c.json(403, { error: "Недостаточно прав" });
    const isSuperadmin = isSuperuser || role === "superadmin";
    const teacherId = auth.id;
    const teacherName = isSuperuser ? "superuser" : (auth.getString("name") || auth.getString("username") || "?");

    const body = info.body || {};
    const studentId = (body["studentId"] || "").toString();
    const wanted = (body["username"] || "").toString().trim().toLowerCase();
    const requested = (body["password"] || "").toString();
    if (!studentId) return c.json(400, { error: "studentId обязателен" });
    if (wanted && !/^[a-z0-9_][a-z0-9_.-]{2,}$/.test(wanted)) {
      return c.json(400, { error: "Логин: латиница, цифры, точка, дефис; от 3 символов" });
    }
    if (requested && requested.length < 6) {
      return c.json(400, { error: "Пароль короче 6 символов" });
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

    // Свободный логин: желаемый, иначе с цифрой. Свой текущий логин — не помеха.
    const taken = (u) => {
      try {
        const r = $app.findFirstRecordByFilter("students", "username = {:u} && id != {:id}", { u: u, id: studentId });
        return !!r;
      } catch (err) {
        return false; // не найдено
      }
    };
    let username = student.getString("username");
    if (wanted) {
      username = "";
      for (let i = 1; i < 100 && !username; i += 1) {
        const candidate = i === 1 ? wanted : wanted + i;
        if (!taken(candidate)) username = candidate;
      }
      if (!username) return c.json(409, { error: "Не нашлось свободного логина" });
    }

    const password = requested || generatePassword();
    student.set("username", username);
    student.setPassword(password);
    student.set("external", false);
    if (!owner && !isSuperuser) student.set("owner", teacherId);
    try { student.set("must_change_password", true); } catch (err) { /* поля ещё нет */ }
    $app.save(student);

    try {
      const collection = $app.findCollectionByNameOrId("audit_log");
      const record = new Record(collection);
      record.set("teacher_id", teacherId);
      record.set("teacher_name", teacherName);
      record.set("action", "update");
      record.set("collection_name", "students");
      record.set("record_id", studentId);
      record.set("record_summary", ("выдан логин @" + username + ": " + student.getString("name")).slice(0, 500));
      $app.save(record);
    } catch (err) {
      console.warn("[students-admin] audit log failed: " + String(err));
    }

    return c.json(200, { ok: true, username: username, password: password });
  } catch (err) {
    console.error("[students-admin] issue-credentials failed: " + String(err));
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
      { collection: "journal_marks", field: "student", label: "отметки в журнале" },
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
