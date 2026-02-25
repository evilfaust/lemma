const BENEFITS = [
  'Вход по ссылке или QR-коду',
  'Чистый, понятный интерфейс без лишнего',
  'Авто-сохранение ответов в процессе',
  'Мгновенный результат после отправки',
  'Коллекция достижений за успехи',
]

const StudentExperience = () => (
  <section className="landing-student landing-section" id="students">
    <div className="landing-container">
      <div className="landing-student-inner">
        {/* Text */}
        <div className="landing-student-text landing-animate">
          <h2 className="landing-section-title">
            Удобно для <span className="landing-gradient-text-accent">учеников</span>
          </h2>
          <p className="landing-section-subtitle">
            Минималистичный интерфейс, который не отвлекает от задач.
            Работает на любом телефоне.
          </p>
          <ul className="landing-student-list">
            {BENEFITS.map((b, i) => (
              <li key={i} className="landing-student-list-item landing-stagger">
                <span className="landing-student-check">{'\u2713'}</span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Phone Mockup */}
        <div className="landing-phone-wrapper landing-animate">
          <div className="landing-phone">
            <div className="landing-phone-notch" />
            <div className="landing-phone-screen">
              <div className="landing-phone-header">
                <div className="landing-phone-header-title">Контрольная работа #5</div>
                <div className="landing-phone-header-sub">Вариант 2 &bull; 6 задач</div>
              </div>

              <div className="landing-phone-task">
                <div className="landing-phone-task-num">Задача 1</div>
                <div className="landing-phone-task-text">
                  Найдите значение выражения 3² + 4²
                </div>
                <input className="landing-phone-input" placeholder="Ваш ответ..." readOnly value="25" />
              </div>

              <div className="landing-phone-task">
                <div className="landing-phone-task-num">Задача 2</div>
                <div className="landing-phone-task-text">
                  Решите уравнение: 2x + 5 = 17
                </div>
                <input className="landing-phone-input" placeholder="Ваш ответ..." readOnly />
              </div>

              <div className="landing-phone-task">
                <div className="landing-phone-task-num">Задача 3</div>
                <div className="landing-phone-task-text">
                  Упростите: (a + b)² − a²
                </div>
                <input className="landing-phone-input" placeholder="Ваш ответ..." readOnly />
              </div>

              <button className="landing-phone-btn" disabled>Отправить ответы</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
)

export default StudentExperience
