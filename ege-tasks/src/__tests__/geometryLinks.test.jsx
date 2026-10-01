import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';
import { geometryWorkColumnPreset, findRefColumn, findSheetColumn } from '../utils/classJournal';
import {
  stereoSpecFromMarkdown, requestOpenInStereoEditor, takeStereoOpenRequest, STEREO_OPEN_KEY, parseStereoBlock,
} from '../utils/stereo/dsl';

describe('журнал: колонка по геометрической работе', () => {
  it('баллы, максимум — по задаче на позицию, ссылка на работу', () => {
    expect(geometryWorkColumnPreset({ id: 'w1', title: ' Сечения ', positions: 5 })).toEqual({
      title: 'Сечения',
      scale: 'points',
      max_score: 5,
      category: 'Контрольная',
      ref: { type: 'geometry_work', id: 'w1', title: 'Сечения' },
    });
    expect(geometryWorkColumnPreset({ id: 'w2', positions: 0 })).not.toHaveProperty('max_score');
    expect(geometryWorkColumnPreset(null)).toBeNull();
  });

  it('колонка ищется по типу и id ссылки — лист и работа не путаются', () => {
    const cols = [
      { id: 'a', ref: { type: 'sheet', id: 'x' } },
      { id: 'b', ref: { type: 'geometry_work', id: 'x' } },
    ];
    expect(findRefColumn(cols, 'geometry_work', 'x').id).toBe('b');
    expect(findSheetColumn(cols, 'x').id).toBe('a');
    expect(findRefColumn(cols, 'geometry_work', 'y')).toBeNull();
  });
});

describe('построение из решения задачи', () => {
  it('блок ```stereo достаётся из markdown', () => {
    const md = 'Построение:\n\n```stereo\nкуб 4\nM на AA1 1:2\n```\n\nОтвет: треугольник';
    expect(stereoSpecFromMarkdown(md)).toBe('куб 4\nM на AA1 1:2');
    expect(parseStereoBlock(stereoSpecFromMarkdown(md)).scene.ops).toHaveLength(1);
    expect(stereoSpecFromMarkdown('нет блока')).toBeNull();
  });

  it('запрос на открытие забирается один раз', () => {
    sessionStorage.clear();
    const scene = { body: { kind: 'cube', a: 4 }, ops: [] };
    expect(requestOpenInStereoEditor(scene, { yaw: 10, pitch: 20, zoom: 1 })).toBe(true);
    expect(takeStereoOpenRequest()).toEqual({ scene, camera: { yaw: 10, pitch: 20, zoom: 1 } });
    expect(takeStereoOpenRequest()).toBeNull();
    sessionStorage.setItem(STEREO_OPEN_KEY, '{"scene":{"ops":"битый"}}');
    expect(takeStereoOpenRequest()).toBeNull();
  });
});

describe('стереоредактор открывает построение задачи', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('пустой черновик — построение открывается сразу', () => {
    const { scene } = parseStereoBlock('куб 4\nM на AA1 1:2 // данная точка\nN на CC1');
    requestOpenInStereoEditor(scene, null);
    render(<AntApp><StereoEditor /></AntApp>);
    expect(screen.getByText('M ∈ AA₁, AM : MA₁ = 1 : 2')).toBeTruthy();
    expect(screen.getByText('N ∈ CC₁, середина')).toBeTruthy();
    expect(sessionStorage.getItem(STEREO_OPEN_KEY)).toBeNull();
  });

  it('в черновике есть шаги — сначала переспрос', async () => {
    localStorage.setItem('stereo.editor.v1', JSON.stringify({
      scene: { body: { kind: 'cube', a: 4 }, ops: [{ id: 'x', type: 'pointOnLine', name: 'K', ref: ['B', 'C'], t: 0.5, ratio: [1, 1] }] },
    }));
    const { scene } = parseStereoBlock('куб 4\nM на AA1 1:2');
    requestOpenInStereoEditor(scene, null);
    render(<AntApp><StereoEditor /></AntApp>);
    expect(screen.getByText('K ∈ BC, середина')).toBeTruthy();
    await screen.findAllByText('Открыть построение задачи?'); // antd дублирует заголовок в разметке
    expect(document.querySelectorAll('.ant-modal-confirm')).toHaveLength(1); // а окно — одно
    fireEvent.click(screen.getByText('Открыть'));
    expect(await screen.findByText('M ∈ AA₁, AM : MA₁ = 1 : 2')).toBeTruthy();
  });
});
