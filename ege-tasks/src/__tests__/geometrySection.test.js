import { describe, it, expect } from 'vitest';
import { guessGeometrySection, isStereoTagName, hasStereoWords } from '../utils/geometrySection';

describe('isStereoTagName — фасеты МЦНМО', () => {
  it('пространственные фигуры и приёмы', () => {
    for (const n of [
      'Куб', 'Правильная четырёхгранная пирамида', 'Двугранный угол', 'Сфера, вписанная в пирамиду',
      'Угол прямой с плоскостью', 'Расстояние между скрещивающимися прямыми', 'Площадь сечения',
      'Сечение многогранника', 'Объём тела вращения', 'Теорема о трёх перпендикулярах',
      'Метод координат в пространстве', 'Поворот относительно прямой', 'Клин',
    ]) expect(isStereoTagName(n), n).toBe(true);
  });

  it('планиметрия, которую задевают слова «сечение» и «плоскость»', () => {
    for (const n of [
      'Пересечение трёх (или более) прямых в одной точке',
      'Откладывание луча в данной полуплоскости угла, равного данному',
      'Расстояние между двумя точками на координатной плоскости',
      'Расположение точек на плоскости относительно прямой',
      'Если ABCD — прямоугольник, а M — произвольная точка плоскости (пространства), то MA^2+MC^2=MB^2+MD^2.',
      'Симметрия относительно прямой', 'Вписанный угол', 'Трапеция', '',
    ]) expect(isStereoTagName(n), n).toBe(false);
  });
});

describe('hasStereoWords — условие без фасетов', () => {
  it('находит тела и рёбра', () => {
    expect(hasStereoWords('В правильной треугольной призме $ABCA_1B_1C_1$…')).toBe(true);
    expect(hasStereoWords('Точки на рёбрах куба')).toBe(true);
    expect(hasStereoWords('Найдите угол между прямой и плоскостью $ABC$')).toBe(true);
    expect(hasStereoWords('Прямая перпендикулярна к плоскости треугольника')).toBe(true);
  });

  it('не путает с планиметрией', () => {
    expect(hasStereoWords('На плоскости провели 100 прямых')).toBe(false);
    expect(hasStereoWords('Решите кубическое уравнение')).toBe(false);
    expect(hasStereoWords('Шарнирный четырёхугольник')).toBe(false);
    expect(hasStereoWords('Хорды окружности пересекаются в точке M')).toBe(false);
  });
});

describe('guessGeometrySection', () => {
  it('тема своей задачи решает', () => {
    expect(guessGeometrySection({ topicTitle: 'Стереометрия', statement: 'Постройте чертёж' })).toBe('stereo');
    expect(guessGeometrySection({ topicTitle: 'Планиметрия', statement: 'В кубе…' })).toBe('planim');
  });

  it('фасет или текст', () => {
    expect(guessGeometrySection({ tagNames: ['Трапеция', 'Объём пирамиды'] })).toBe('stereo');
    expect(guessGeometrySection({ statement: 'Сфера касается граней тетраэдра' })).toBe('stereo');
    expect(guessGeometrySection({ tagNames: ['Вписанный угол'], statement: 'В треугольнике ABC…' })).toBe('planim');
    expect(guessGeometrySection()).toBe('planim');
  });
});
