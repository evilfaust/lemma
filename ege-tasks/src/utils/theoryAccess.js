// Кто что может со статьёй теории (v3.9.390). Копия правил коллекции
// theory_articles (миграция 1788900000): статья — личная, коллегам видна
// только открытая (`public`), править и удалять может автор и superadmin.
// Статья без owner (создана фронтом до v3.9.390) — общая, как раньше.

/** Может ли учитель править, удалять и открывать/закрывать статью. */
export function canManageArticle(article, teacher) {
  if (!article || !teacher) return false;
  if (teacher.role === 'viewer') return false;
  if (teacher.role === 'superadmin') return true;
  return !article.owner || article.owner === teacher.id;
}

/** Статья чужая (открыта коллегой) — показываем автора и не даём править. */
export function isColleagueArticle(article, teacher) {
  return !!article?.owner && !!teacher && article.owner !== teacher.id;
}

/** Имя автора из expand.owner (или пусто, если коллега не раскрыт). */
export function articleAuthorName(article) {
  const o = article?.expand?.owner;
  return (o && (o.name || o.username)) || '';
}
