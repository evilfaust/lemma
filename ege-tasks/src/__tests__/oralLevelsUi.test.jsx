/**
 * Страницы устного счёта: уровень, метки экзаменов и «Готовлю к …».
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from 'antd';
import OralLogarithmsGenerator from '../components/OralLogarithmsGenerator';
import OralPowersRootsGenerator from '../components/OralPowersRootsGenerator';
import OralEgeBaseGenerator from '../components/OralEgeBaseGenerator';
import OralFractionsGenerator from '../components/OralFractionsGenerator';
import LogExpEquationsGenerator from '../components/LogExpEquationsGenerator';
import { POW_LABELS } from '../utils/oral/powers';

const wrapper = ({ children }) => <MemoryRouter><App>{children}</App></MemoryRouter>;

/** Чекбокс типа по его подписи. */
const checkboxOf = (label) => {
  const el = screen.getByText(label).closest('label');
  return el.querySelector('input[type="checkbox"]');
};

describe('страницы разделов устного счёта', () => {
  const PAGES = [
    ['логарифмы', OralLogarithmsGenerator, 'П8'],
    ['степени и корни', OralPowersRootsGenerator, 'О8'],
    ['десятичные', OralEgeBaseGenerator, 'Б14'],
    ['дроби', OralFractionsGenerator, 'О6'],
    ['уравнения', LogExpEquationsGenerator, 'П7'],
  ];

  for (const [name, Page, tag] of PAGES) {
    it(`${name}: уровень, метки и лист`, () => {
      const { container } = render(<Page />, { wrapper });
      expect(screen.getByText('Как на экзамене')).toBeTruthy();
      expect(screen.getByText('Сложнее')).toBeTruthy();
      expect(screen.getAllByText(tag).length).toBeGreaterThan(0);
      // уровни по всем трём проверяет oralAnswers.test.js; здесь — что лист собирается
      fireEvent.click(screen.getByText('Разминка'));
      fireEvent.click(screen.getByText('Сформировать'));
      expect(container.querySelectorAll('.katex').length).toBeGreaterThan(10);
    });
  }

  it('«Готовлю к: ОГЭ» оставляет только типы ОГЭ', () => {
    render(<OralPowersRootsGenerator />, { wrapper });
    const panel = screen.getByText('Готовлю к:').parentElement;
    fireEvent.click(within(panel).getByText('ОГЭ'));
    expect(checkboxOf(POW_LABELS.rootOfProduct).checked).toBe(true);
    expect(checkboxOf(POW_LABELS.sqrtDiffSquares).checked).toBe(false);
    fireEvent.click(within(panel).getByText('все типы'));
    expect(checkboxOf(POW_LABELS.sqrtDiffSquares).checked).toBe(true);
  });

  it('у уравнений нет кнопки ОГЭ — таких заданий там нет', () => {
    render(<LogExpEquationsGenerator />, { wrapper });
    const panel = screen.getByText('Готовлю к:').parentElement;
    expect(within(panel).queryByText('ОГЭ')).toBeNull();
    expect(within(panel).getByText('Профиль')).toBeTruthy();
  });
});
