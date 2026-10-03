import { useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import { api } from '../../shared/services/pocketbase';
import { currentAcademicYear } from '../../utils/academicYear';

// Классы учителя за все годы — один запрос на страницу (панель эфира и
// библиотека открываются вместе). Сбой не кэшируется.
let groupsPromise = null;
function loadGroups() {
  if (!groupsPromise) {
    groupsPromise = Promise.resolve()
      .then(() => api.getTeachingGroups({ allYears: true }))
      .then((list) => (Array.isArray(list) ? list : []))
      .catch((e) => { groupsPromise = null; throw e; });
  }
  return groupsPromise;
}

/** Для тестов: забыть загруженные классы. */
export function _resetStereoGroups() {
  groupsPromise = null;
}

/**
 * Классы (и курсы), которым адресован эфир или чертёж: у их учеников он
 * появляется в личном кабинете. Предлагаются классы текущего учебного года;
 * уже выбранный прошлогодний класс остаётся в списке с пометкой года
 * (после перевода ученики видят его через членство, см. stereo_feed.pb.js).
 */
export default function StereoGroupsSelect({ value, onChange, size, placeholder, disabled, style }) {
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    let alive = true;
    loadGroups().then((list) => { if (alive) setGroups(list); }).catch(() => { if (alive) setGroups([]); });
    return () => { alive = false; };
  }, []);

  const selected = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const options = useMemo(() => {
    const year = currentAcademicYear();
    return (groups || [])
      .filter((g) => !g.year || g.year === year || selected.includes(g.id))
      .map((g) => ({
        value: g.id,
        label: g.year && g.year !== year ? `${g.name} · ${g.year}` : g.name,
      }));
  }, [groups, selected]);

  return (
    <Select
      mode="multiple"
      allowClear
      size={size}
      style={{ width: '100%', ...style }}
      value={groups ? selected.filter((id) => options.some((o) => o.value === id)) : []}
      onChange={onChange}
      options={options}
      loading={groups === null}
      disabled={disabled}
      placeholder={placeholder || 'Классы'}
      aria-label="Классы"
      optionFilterProp="label"
      maxTagCount="responsive"
    />
  );
}
