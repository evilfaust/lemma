const CHECKLIST = [
  'Темы строго по кодификатору ЕГЭ',
  'LaTeX-формулы в каждой задаче',
  'Печать в формате А5 / А6 / А4',
  'Работает на телефонах учеников',
  'Высококачественный PDF экспорт',
  'Геометрия с GeoGebra-чертежами',
]

const TeacherTestimonials = () => (
  <section className="landing-testimonials landing-section">
    <div className="landing-container">
      <div className="landing-section-header landing-animate">
        <h2 className="landing-section-title">
          Создано <span className="landing-gradient-text">учителем</span> для учителей
        </h2>
      </div>

      <div className="landing-testimonial-card landing-animate">
        <p className="landing-testimonial-quote">
          Разработано практикующим учителем математики.
          Каждая функция проверена на реальных уроках
          и создана для решения конкретных задач преподавания.
        </p>

        <div className="landing-checklist">
          {CHECKLIST.map((item, i) => (
            <div key={i} className="landing-checklist-item landing-stagger">
              <span className="landing-checklist-icon">{'\u2713'}</span>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
)

export default TeacherTestimonials
