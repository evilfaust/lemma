import { currentAcademicYear } from '../../../utils/academicYear';

// Подпись группы в пикерах каникулярных заданий.
//
// Перевод на новый учебный год создаёт НОВУЮ запись группы («10 кл» 2025/2026 →
// «11 БАЗА» 2026/2027), и в списке за все годы одинаковые названия соседствуют.
// Поэтому у групп прошлых лет дописываем год — иначе кампанию легко завести не
// тому классу, а потом искать её в новом.
export function groupSelectLabel(g, currentYear = currentAcademicYear()) {
  if (!g) return '';
  const grade = g.grade ? ` · ${g.grade} кл.` : '';
  const year = g.year && g.year !== currentYear ? ` · ${g.year}` : '';
  return `${g.name}${grade}${year}`;
}
