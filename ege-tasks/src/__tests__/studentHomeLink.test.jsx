import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CabinetLink } from '../student/pwa/InstallApp';

// v3.9.372: с любой страницы ученика есть дорога на главную.
describe('ссылка «Главная» на отдельных страницах ученика', () => {
  it('рисуется и в обычном браузере, не только в установленном приложении', () => {
    render(<CabinetLink />);
    const link = screen.getByRole('link', { name: /Главная/ });
    expect(link.getAttribute('href')).toBe('/student/');
  });

  it('есть на каждой отдельной странице — и на экране «недоступно»', () => {
    const pages = {
      'components/stereo/StudentStereoBoard.jsx': 1,
      'components/stereo/StudentStereoManual.jsx': 1,
      'components/planim/StudentPlanimManual.jsx': 1,
      'components/student/StudentWorkShow.jsx': 2,
      'components/geometry/student/StudentGeometryWork.jsx': 2,
      'components/theory/StudentTheoryArticle.jsx': 2,
    };
    for (const [file, min] of Object.entries(pages)) {
      const src = readFileSync(resolve(__dirname, '..', file), 'utf8');
      const uses = (src.match(/<CabinetLink\b/g) || []).length;
      expect(uses, file).toBeGreaterThanOrEqual(min);
    }
  });

  it('у выдачи «Главная» есть на входе и в тесте (с вопросом)', () => {
    const src = readFileSync(resolve(__dirname, '..', 'StudentApp.jsx'), 'utf8');
    expect(src).not.toMatch(/currentView !== 'auth' && \(\s*<div className="student-top-bar"/);
    expect(src).toMatch(/onClick=\{currentView === 'test' \? confirmLeaveTest : undefined\}/);
  });
});
