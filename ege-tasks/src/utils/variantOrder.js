// Порядок задач варианта (`variants.order`) и «личные» настройки задачи в нём:
// размер чертежа (`imageSize` ↔ `task.kimImageSize`) и место чертежа на листе
// (`figurePlacement`), место для решения (`solutionSpace`, v3.9.384). Их ставят Генератор, КИМ и печать работы, а читают и
// пишут и Генератор, и редактор работы — поэтому в одном месте: редактор,
// писавший `order` без них, стирал выбор, сделанный при печати.

/** Задачи варианта → `order` для записи в PB. */
export function variantOrder(tasks = []) {
  return tasks.map((t, idx) => ({
    taskId: t.id,
    position: idx,
    ...(t.kimImageSize ? { imageSize: t.kimImageSize } : {}),
    ...(t.figurePlacement ? { figurePlacement: t.figurePlacement } : {}),
    ...(t.solutionSpace != null ? { solutionSpace: t.solutionSpace } : {}),
  }));
}

/** Задача + её пункт `order` → задача с личными настройками (или та же запись). */
export function withOrderExtras(task, entry) {
  const extra = {
    ...(entry?.imageSize ? { kimImageSize: entry.imageSize } : {}),
    ...(entry?.figurePlacement ? { figurePlacement: entry.figurePlacement } : {}),
    ...(entry?.solutionSpace != null ? { solutionSpace: entry.solutionSpace } : {}),
  };
  return Object.keys(extra).length ? { ...task, ...extra } : task;
}
