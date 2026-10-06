import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../../../shared/services/pocketbase';
import {
  incomingFor, isNextDue, materialVisible, nextLessonFor, studentFacing,
} from '../../../utils/homework';

const HW_TYPES = new Set(['material', 'session', 'text', 'work_view']);

/**
 * ДЗ сохранённого урока для карточки урока (v3.9.293): что задано на нём, к
 * какому уроку уйдёт «ДЗ к след.» и что задали к нему на прошлых уроках.
 * Уроки класса вокруг грузятся только у групп, которые видят ученики, — у
 * остальных ДЗ ученикам не уходит. Учитель видит то же, что ученик: скрытые
 * уроки и скрытые файлы не считаются.
 * → { own: [пункт], next: урок | null, incoming: [{ item, from }], loading }
 */
export default function useLessonHomework(lesson) {
  const group = lesson?.expand?.group || null;
  const facing = studentFacing(group);
  const [neighbours, setNeighbours] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setNeighbours(null);
    if (!lesson?.id || !lesson.group || !facing) return undefined;
    const base = dayjs(lesson.date_plan);
    api.getLessons({
      groupId: lesson.group,
      from: base.subtract(60, 'day').toISOString(),
      to: base.add(120, 'day').toISOString(),
    })
      .then((list) => { if (!cancelled) setNeighbours(list); })
      .catch(() => { if (!cancelled) setNeighbours([]); });
    return () => { cancelled = true; };
  }, [lesson?.id, lesson?.group, lesson?.date_plan, facing]);

  return useMemo(() => {
    if (!lesson || !facing) return { own: [], next: null, incoming: [], loading: false };
    const isCourse = group?.kind === 'course';
    const visible = (l) => (l.hidden_from_students ? [] : (l.materials || []).filter((m) => materialVisible(m, isCourse)));
    const own = visible(lesson).filter((m) => m.role === 'homework' && HW_TYPES.has(m.type));
    if (!neighbours) return { own, next: null, incoming: [], loading: true };
    return {
      own,
      next: own.some(isNextDue) ? nextLessonFor(lesson, neighbours) : null,
      incoming: incomingFor(lesson, neighbours, visible),
      loading: false,
    };
  }, [lesson, group, facing, neighbours]);
}
