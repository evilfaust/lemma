import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { App as AntApp } from 'antd';
import {
  translit, loginCandidates, suggestLogin, suggestLogins, isMachineLogin, isValidLogin, simplePassword,
} from '../utils/studentLogins';
import { credentialCardsHtml, credentialsText } from '../utils/credentialCards';
import { validateUsername } from '../utils/studentModeration';

// Человекочитаемые логины и простые пароли учеников (v3.9.294).

const mockApi = vi.hoisted(() => ({
  issueStudentCredentials: vi.fn(),
  createStudentAccount: vi.fn(),
  changeOwnStudentPassword: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

// eslint-disable-next-line import/first
import StudentLoginsModal from '../components/students/StudentLoginsModal';
// eslint-disable-next-line import/first
import StudentPasswordChange from '../components/student/StudentPasswordChange';

describe('логины', () => {
  it('транслитерация — школьная, без лишних знаков', () => {
    expect(translit('Щукина')).toBe('schukina');
    expect(translit('Хабибуллин')).toBe('habibullin');
    expect(translit('Юлия')).toBe('yuliya');
    expect(translit('Пётр')).toBe('petr');
    expect(translit('Бойко-Цой')).toBe('boykotsoy');
    expect(translit("O'Neil")).toBe('oneil');
  });

  it('фамилия.буква → две буквы → имя целиком → с цифрой', () => {
    expect(loginCandidates('Иванов Пётр').slice(0, 4)).toEqual(['ivanov.p', 'ivanov.pe', 'ivanov.petr', 'ivanov.p2']);
    expect(suggestLogin('Иванов Пётр', ['ivanov.p'])).toBe('ivanov.pe');
    expect(suggestLogin('Иванов Пётр', ['IVANOV.P', 'ivanov.pe', 'ivanov.petr'])).toBe('ivanov.p2');
    expect(loginCandidates('Ли')[0]).toBe('li.st'); // короче 3 символов — дописываем
    expect(loginCandidates('')[0]).toBe('uchenik');
  });

  it('список учитывает уже выданное в нём же', () => {
    const m = suggestLogins([
      { id: 'a', name: 'Петров Илья' }, { id: 'b', name: 'Петров Иван' }, { id: 'c', name: 'Петров Игорь' },
    ]);
    expect([...m.values()]).toEqual(['petrov.i', 'petrov.iv', 'petrov.ig']);
  });

  it('логины проходят и шаблон PB, и проверку карточки ученика', () => {
    for (const name of ['Иванов Пётр', 'Щукина Юлия', 'Ёлкин Ян', 'Ли']) {
      const login = suggestLogin(name);
      expect(isValidLogin(login)).toBe(true);
      expect(/^[\w][\w.-]*$/.test(login)).toBe(true);
      expect(validateUsername(login)).toBe('');
    }
  });

  it('машинные логины распознаются', () => {
    expect(isMachineLogin('st_ab12cd')).toBe(true);
    expect(isMachineLogin('ext_a1b2c3d4')).toBe(true);
    expect(isMachineLogin('ivanov.p')).toBe(false);
  });
});

describe('простые пароли', () => {
  it('слово + 3 цифры, без l/o/0/1, не короче 6', () => {
    for (let i = 0; i < 300; i++) {
      const p = simplePassword();
      expect(p).toMatch(/^[a-z]+[2-9]{3}$/);
      expect(p).not.toMatch(/[lo01]/);
      expect(p.length).toBeGreaterThanOrEqual(6);
    }
  });
  it('детерминирован от rand', () => {
    expect(simplePassword(() => 0)).toBe('kit222');
  });
});

describe('карточки', () => {
  const rows = [{ name: 'Иванов <Пётр>', username: 'ivanov.p', password: 'kit234' }];
  it('HTML: экранирование, сайт, подсказка про смену пароля', () => {
    const html = credentialCardsHtml(rows, { title: '10 Геометрия UP' });
    expect(html).toContain('Иванов &lt;Пётр&gt;');
    expect(html).toContain('student.oipav.ru');
    expect(html).toContain('ivanov.p');
    expect(html).toContain('придумай свой пароль');
    expect(html).toContain('10 Геометрия UP');
  });
  it('текст для копирования', () => {
    expect(credentialsText(rows)).toBe('Вход: https://student.oipav.ru\nИванов <Пётр>\tлогин: ivanov.p\tпароль: kit234');
  });
});

describe('окно «Логины и пароли»', () => {
  const group = { id: 'g1', name: '10 Геометрия UP', year: '2026/2027' };
  const students = [
    { id: 's1', name: 'Иванов Пётр', username: 'ext_aa11bb22', external: true },
    { id: 's2', name: 'Петрова Анна', username: 'st_q1w2e3' },
    { id: 's3', name: 'Сидоров Олег', username: 'sidorov.o' },
  ];

  beforeEach(() => {
    mockApi.issueStudentCredentials.mockReset();
    mockApi.createStudentAccount.mockReset();
    mockApi.issueStudentCredentials.mockImplementation(async (id, { username, password }) => ({ username, password }));
    mockApi.createStudentAccount.mockImplementation(async ({ username, password }) => ({ username, password }));
  });
  afterEach(cleanup);

  const open = (props = {}) => render(
    <AntApp>
      <StudentLoginsModal open group={group} students={students} taken={['ivanov.p']} onClose={() => {}} {...props} />
    </AntApp>,
  );

  it('без аккаунта и с машинным логином отмечены, человеческий — нет; занятый логин обходится', () => {
    open();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Выдать: Иванов Пётр').checked).toBe(true);
    expect(within(dialog).getByLabelText('Выдать: Петрова Анна').checked).toBe(true);
    expect(within(dialog).getByLabelText('Выдать: Сидоров Олег').checked).toBe(false);
    expect(within(dialog).getByDisplayValue('ivanov.pe')).toBeTruthy(); // ivanov.p занят
    expect(within(dialog).getByDisplayValue('petrova.a')).toBeTruthy();
    expect(within(dialog).getByText('Выдать (2)')).toBeTruthy();
  });

  it('выдача: существующим — на ту же запись, новым — создание; итог для карточек', async () => {
    const onDone = vi.fn();
    open({ onDone });
    fireEvent.click(screen.getByText('Новые ученики (которых ещё нет в группе)'));
    fireEvent.change(screen.getByPlaceholderText(/по одному на строку/), { target: { value: 'Новиков Глеб' } });
    fireEvent.click(screen.getByText('Добавить в таблицу'));
    // У ученика с человеческим логином выдаётся только новый пароль
    fireEvent.click(screen.getByLabelText('Выдать: Сидоров Олег'));
    fireEvent.click(screen.getByText('Выдать (4)'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());

    const ids = mockApi.issueStudentCredentials.mock.calls.map(([id, o]) => [id, o.username]);
    expect(ids).toEqual([['s1', 'ivanov.pe'], ['s2', 'petrova.a'], ['s3', 'sidorov.o']]);
    const [created] = mockApi.createStudentAccount.mock.calls[0];
    expect(created).toMatchObject({ name: 'Новиков Глеб', groupId: 'g1', username: 'novikov.g' });
    expect(created.password).toMatch(/^[a-z]+[2-9]{3}$/);
    expect(await screen.findByText('Печать карточек')).toBeTruthy();
  });

  it('два одинаковых логина в списке не пускают выдачу', () => {
    open();
    const input = screen.getByDisplayValue('petrova.a');
    fireEvent.change(input, { target: { value: 'ivanov.pe' } });
    expect(screen.getAllByText('такой логин уже в списке').length).toBe(1);
    expect(screen.getByText('Выдать (2)').closest('button').disabled).toBe(true);
  });
});

describe('ученик: «Придумай свой пароль»', () => {
  afterEach(cleanup);
  const setup = () => {
    const onDone = vi.fn();
    const onLater = vi.fn();
    render(<AntApp><StudentPasswordChange student={{ name: 'Пётр', username: 'ivanov.p' }} onDone={onDone} onLater={onLater} /></AntApp>);
    const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    return { onDone, onLater, fill };
  };

  it('пароли не совпали — не отправляем; совпали — меняем и отдаём новую запись', async () => {
    mockApi.changeOwnStudentPassword.mockReset();
    mockApi.changeOwnStudentPassword.mockResolvedValue({ id: 's1', must_change_password: false });
    const { onDone, fill } = setup();
    expect(screen.getByText('ivanov.p')).toBeTruthy();
    fill('Пароль с карточки', 'kit234');
    fill('Новый пароль', 'moy-parol');
    fill('Новый пароль ещё раз', 'drugoy');
    fireEvent.click(screen.getByText('Сохранить пароль'));
    expect(await screen.findByText('Пароли не совпадают')).toBeTruthy();
    expect(mockApi.changeOwnStudentPassword).not.toHaveBeenCalled();

    fill('Новый пароль ещё раз', 'moy-parol');
    fireEvent.click(screen.getByText('Сохранить пароль'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ id: 's1', must_change_password: false }));
    expect(mockApi.changeOwnStudentPassword).toHaveBeenCalledWith('kit234', 'moy-parol');
  });

  it('«Позже» откладывает', () => {
    const { onLater } = setup();
    fireEvent.click(screen.getByText('Позже'));
    expect(onLater).toHaveBeenCalled();
  });
});
