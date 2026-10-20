import { describe, expect, it } from 'vitest';
import {
  activeGroupIds, groupsByStudent, planJoinGroup, planLeaveGroup, planStudentGroups,
} from '../utils/studentGroups';

const row = (group, status = 'active', student = 's1') => ({ group, status, student });

describe('activeGroupIds — где ученик состоит сейчас', () => {
  it('основная группа первой, остальные — по порядку членств', () => {
    const rows = [row('ege'), row('param')];
    expect(activeGroupIds(rows, 'param')).toEqual(['param', 'ege']);
  });

  it('закрытые членства не считаются', () => {
    const rows = [row('param'), row('ege', 'left'), row('old', 'transferred')];
    expect(activeGroupIds(rows, 'param')).toEqual(['param']);
  });

  it('указатель без строки членства — тоже группа ученика', () => {
    expect(activeGroupIds([], 'g1')).toEqual(['g1']);
  });

  it('указатель на группу, откуда ученик выбыл, — не группа', () => {
    expect(activeGroupIds([row('g1', 'left')], 'g1')).toEqual([]);
  });

  it('пустой статус — действующее членство (старые строки)', () => {
    expect(activeGroupIds([{ group: 'g1', status: '' }], '')).toEqual(['g1']);
  });
});

describe('planJoinGroup — добавить в группу', () => {
  it('Иван: добавили в «Параметр» — «11 ЕГЭ» остаётся', () => {
    const plan = planJoinGroup({ active: ['ege'], pointer: 'ege', groupId: 'param' });
    expect(plan).toEqual({ join: ['param'], close: [], pointer: 'ege' });
  });

  it('ученик без группы — новая становится основной', () => {
    expect(planJoinGroup({ active: [], pointer: '', groupId: 'g1' }))
      .toEqual({ join: ['g1'], close: [], pointer: 'g1' });
  });

  it('«перевести сюда» закрывает все прежние группы', () => {
    const plan = planJoinGroup({ active: ['a', 'b'], pointer: 'a', groupId: 'c', move: true });
    expect(plan).toEqual({ join: ['c'], close: ['a', 'b'], pointer: 'c' });
  });

  it('уже в группе — ничего не делаем', () => {
    expect(planJoinGroup({ active: ['a', 'b'], pointer: 'a', groupId: 'b' }))
      .toEqual({ join: [], close: [], pointer: 'a' });
  });
});

describe('planLeaveGroup — отвязать от одной группы', () => {
  it('из неосновной: основная не трогается', () => {
    expect(planLeaveGroup({ active: ['param', 'ege'], pointer: 'param', groupId: 'ege' }))
      .toEqual({ join: [], close: ['ege'], pointer: 'param' });
  });

  it('из основной: основной становится оставшаяся группа', () => {
    expect(planLeaveGroup({ active: ['param', 'ege'], pointer: 'param', groupId: 'param' }))
      .toEqual({ join: [], close: ['param'], pointer: 'ege' });
  });

  it('из единственной — ученик без группы', () => {
    expect(planLeaveGroup({ active: ['g1'], pointer: 'g1', groupId: 'g1' }))
      .toEqual({ join: [], close: ['g1'], pointer: '' });
  });
});

describe('planStudentGroups — карточка ученика', () => {
  it('явно выбранная основная группа', () => {
    expect(planStudentGroups({ active: ['a'], pointer: 'a', wanted: ['a', 'b'], primary: 'b' }))
      .toEqual({ join: ['b'], close: [], pointer: 'b' });
  });

  it('основная не из списка — остаётся прежняя', () => {
    expect(planStudentGroups({ active: ['a'], pointer: 'a', wanted: ['a', 'b'], primary: 'zzz' }))
      .toEqual({ join: ['b'], close: [], pointer: 'a' });
  });

  it('дубли и пустые значения в списке игнорируются', () => {
    expect(planStudentGroups({ active: [], pointer: '', wanted: ['a', '', 'a'] }))
      .toEqual({ join: ['a'], close: [], pointer: 'a' });
  });

  it('пустой список — все группы закрываются', () => {
    expect(planStudentGroups({ active: ['a', 'b'], pointer: 'a', wanted: [] }))
      .toEqual({ join: [], close: ['a', 'b'], pointer: '' });
  });
});

describe('groupsByStudent — группы всех учеников разом', () => {
  it('учитывает членства и указатели', () => {
    const memberships = [
      row('old', 'left', 'ivan'), row('param', 'active', 'ivan'), row('ege', 'active', 'ivan'),
      row('base', 'active', 'petya'),
    ];
    const students = [
      { id: 'ivan', teaching_group: 'param' },
      { id: 'petya', teaching_group: 'base' },
      { id: 'olya', teaching_group: 'base' },
      { id: 'kolya', teaching_group: '' },
    ];
    expect(groupsByStudent(memberships, students)).toEqual({
      ivan: ['param', 'ege'],
      petya: ['base'],
      olya: ['base'],
      kolya: [],
    });
  });
});
