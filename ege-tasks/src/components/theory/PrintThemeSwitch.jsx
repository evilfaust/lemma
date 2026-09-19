import { Segmented, Tooltip } from 'antd';
import { PRINT_THEMES, normalizePrintTheme } from '../../utils/theoryThemes';

const HINT = 'Оформление листа при печати и в PDF. «Лист» — только чёрная краска: '
    + 'ни плашек, ни цветных врезок, не зависит от галки «печатать фоны» в браузере.';

/**
 * Переключатель печатной темы теории («Классика» / «Лист»).
 * Общий для просмотра статьи, редактора и сборщика конспекта.
 */
export default function PrintThemeSwitch({ value, onChange, size = 'small' }) {
    return (
        <Tooltip title={HINT}>
            <Segmented
                size={size}
                value={normalizePrintTheme(value)}
                onChange={onChange}
                options={PRINT_THEMES}
            />
        </Tooltip>
    );
}
