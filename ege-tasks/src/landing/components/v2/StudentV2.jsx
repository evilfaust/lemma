const BENEFITS = [
  'Ставится на телефон как приложение — значок на экране, без адресной строки',
  'Главная — «что делать»: идёт урок, задания со сроком, ближайший урок',
  'Расписание и домашние задания по неделям',
  'Тест по ссылке или QR-коду, ответы сохраняются по ходу',
  'Результат сразу; «ещё попытка» от учителя — без перезагрузки',
  'Эфир стереочертежей и пособия учителя — в кабинете',
  'Простой логин вида ivanov.p, пароль меняется при первом входе',
  '106 достижений за успехи',
]

// Макет главной ученика (StudentHome): Сейчас → Сделать → Ближайший урок → Результаты.
const StudentV2 = () => (
  <section className="v2-student v2-section" id="students">
    <div className="v2-container">
      <div className="v2-student-inner">
        <div className="v2-student-text v2-reveal">
          <span className="v2-label">Для учеников</span>
          <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)', marginTop: 16 }}>
            Кабинет <span className="v2-gradient-text">в телефоне</span>
          </h2>
          <p>Ученик открывает приложение и сразу видит, что делать сегодня. Ничего лишнего.</p>
          <ul className="v2-student-list">
            {BENEFITS.map(b => (
              <li key={b} className="v2-student-item v2-stagger">
                <span className="v2-student-check">✓</span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="v2-phone-wrap v2-reveal">
          <div className="v2-phone">
            <div className="v2-phone-notch" />
            <div className="v2-phone-screen v2-sh">
              <div className="v2-sh-hello">Привет, Петя 👋</div>

              <div className="v2-sh-title">Сейчас</div>
              <div className="v2-sh-card v2-sh-card--now">
                <div className="v2-sh-card-top">
                  <span className="v2-sh-pulse" />
                  <b>Алгебра · идёт урок</b>
                </div>
                <div className="v2-sh-card-sub">до 15:40 · 2 задания на уроке</div>
              </div>

              <div className="v2-sh-title">Сделать · 2</div>
              <div className="v2-sh-card">
                <div className="v2-sh-row">
                  <div>
                    <b>Простейшие уравнения</b>
                    <div className="v2-sh-card-sub">на уроке · обязательно</div>
                  </div>
                  <span className="v2-sh-btn">Решать</span>
                </div>
                <div className="v2-sh-row">
                  <div>
                    <b>Вариант 12, часть 1</b>
                    <div className="v2-sh-card-sub">ДЗ к понедельнику</div>
                  </div>
                  <span className="v2-sh-btn v2-sh-btn--ghost">Открыть</span>
                </div>
              </div>

              <div className="v2-sh-title">Ближайший урок</div>
              <div className="v2-sh-card">
                <b>Геометрия</b>
                <div className="v2-sh-card-sub">Пятница · 2 пара · эфир чертежа</div>
              </div>

              <div className="v2-sh-title">Последние результаты</div>
              <div className="v2-sh-card v2-sh-row">
                <span>Самостоятельная №3</span>
                <b className="v2-sh-score">18 / 20</b>
              </div>

              <div className="v2-sh-tabs">
                <span className="is-active">Главная</span>
                <span>Уроки</span>
                <span>Прогресс</span>
                <span>Достижения</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
)

export default StudentV2
