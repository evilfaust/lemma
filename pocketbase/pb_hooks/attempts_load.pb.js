/// <reference path="../pb_data/types.d.ts" />

/**
 * GET /api/attempts/variant-load?session=<id> — сколько раз выдан каждый
 * вариант в выдаче (аудит 25.10.2026, шаг 2).
 *
 * Ученик раздаёт варианты по кругу (useStudentSession: вариант с наименьшим
 * числом назначений), поэтому раньше читал ВСЕ попытки выдачи — с ФИО,
 * баллами и устройствами одноклассников. После миграции 1789100100 чужие
 * попытки ему не видны, а для круга достаточно двух полей: здесь отдаются
 * только `variant` и `mc_variant` каждой попытки, без людей.
 *
 * Без входа (гость тоже раздаёт варианты); неизвестная выдача — пустой список.
 */
routerAdd("GET", "/api/attempts/variant-load", (c) => {
  const session = String(c.request.url.query().get("session") || "");
  if (!/^[a-z0-9]{15}$/.test(session)) return c.json(400, { error: "Нужна выдача" });
  const result = new DynamicModel({ data: "" });
  $app.db().newQuery(
    "SELECT json_group_array(json_object('variant', variant, 'mc_variant', mc_variant)) AS data " +
    "FROM attempts WHERE session = {:session}"
  ).bind({ session: session }).one(result);
  c.response.header().set("Cache-Control", "no-store");
  return c.blob(200, "application/json; charset=utf-8", toBytes('{"items":' + (result.data || "[]") + "}"));
});
