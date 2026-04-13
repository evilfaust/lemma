import { Row, Col, Form, Radio, Switch, Input } from 'antd';
import { getCryptogramLetterCount } from '../../utils/cryptogram';

/**
 * Компонент настроек форматирования для печати
 */
const FormatSettings = ({
  columns,
  setColumns,
  fontSize,
  setFontSize,
  solutionSpace,
  setSolutionSpace,
  compactMode,
  setCompactMode,
  hideTaskPrefixes,
  setHideTaskPrefixes,
  showStudentInfo,
  setShowStudentInfo,
  showAnswersInline,
  setShowAnswersInline,
  showAnswersPage,
  setShowAnswersPage,
  variantLabel,
  setVariantLabel,
  cryptogramEnabled,
  setCryptogramEnabled,
  cryptogramPhrase,
  setCryptogramPhrase,
  tasksCount = 0,
}) => {
  const lettersCount = getCryptogramLetterCount(cryptogramPhrase);

  return (
    <>
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Form.Item
            label="Колонки"
            tooltip={compactMode ? "В компактном режиме - количество вариантов в ряд" : "Колонки для задач в варианте"}
          >
            <Radio.Group
              value={columns}
              onChange={(e) => setColumns(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value={1}>1</Radio.Button>
              <Radio.Button value={2}>2</Radio.Button>
              <Radio.Button value={3}>3</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Col>

        <Col xs={24} md={8}>
          <Form.Item label="Размер шрифта">
            <Radio.Group
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value={10}>10pt</Radio.Button>
              <Radio.Button value={12}>12pt</Radio.Button>
              <Radio.Button value={14}>14pt</Radio.Button>
              <Radio.Button value={16}>16pt</Radio.Button>
              <Radio.Button value={20}>20pt</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Col>

        <Col xs={24} md={6}>
          <Form.Item label="Место для решения">
            <Radio.Group
              value={solutionSpace}
              onChange={(e) => setSolutionSpace(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="none">Нет</Radio.Button>
              <Radio.Button value="small">Мало</Radio.Button>
              <Radio.Button value="medium">Средне</Radio.Button>
              <Radio.Button value="large">Много</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Form.Item label="Компактный режим">
            <Switch checked={compactMode} onChange={setCompactMode} />
          </Form.Item>
        </Col>

        <Col xs={24} md={6}>
          <Form.Item
            label="Скрыть «Вычислите:» и т.п."
            tooltip="Убирает типовые фразы из начала условия задач"
          >
            <Switch checked={hideTaskPrefixes} onChange={setHideTaskPrefixes} />
          </Form.Item>
        </Col>

        <Col xs={24} md={6}>
          <Form.Item label="Поля для ФИО">
            <Switch
              checked={showStudentInfo}
              onChange={setShowStudentInfo}
              disabled={compactMode}
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={6}>
          <Form.Item label="Ответы в тексте">
            <Switch
              checked={showAnswersInline}
              onChange={setShowAnswersInline}
              disabled={compactMode || cryptogramEnabled}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Form.Item label="Лист с ответами">
            <Switch checked={showAnswersPage} onChange={setShowAnswersPage} />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item label="Название варианта">
            <Input
              value={variantLabel}
              onChange={(e) => setVariantLabel(e.target.value)}
              placeholder="Вариант"
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={6}>
          <Form.Item
            label="Шифровка по ответам"
            tooltip="Каждому ответу будет соответствовать буква, а ниже появится таблица для расшифровки"
          >
            <Switch checked={cryptogramEnabled} onChange={setCryptogramEnabled} />
          </Form.Item>
        </Col>
      </Row>

      {cryptogramEnabled && (
        <Row gutter={16}>
          <Col xs={24} md={18}>
            <Form.Item
              label="Слово или фраза"
              extra={`Букв без пробелов: ${lettersCount}. Задач в варианте: ${tasksCount}. Для корректной шифровки эти числа должны совпадать.`}
            >
              <Input
                value={cryptogramPhrase}
                onChange={(e) => setCryptogramPhrase(e.target.value)}
                placeholder="Например: ТЕОРЕМА ПИФАГОРА"
              />
            </Form.Item>
          </Col>
        </Row>
      )}
    </>
  );
};

export default FormatSettings;
