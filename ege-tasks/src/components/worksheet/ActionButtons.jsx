import { Button, Space, Tooltip, Badge, Segmented } from 'antd';
import {
  ReloadOutlined,
  PrinterOutlined,
  FilePdfOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  RocketOutlined,
} from '@ant-design/icons';

/**
 * Компонент кнопок действий для генераторов.
 *
 * @param {boolean} hasVariants - есть ли сгенерированные варианты
 * @param {boolean} loading - загрузка генерации
 * @param {Function} onGenerate - обработчик генерации (submit формы)
 * @param {Function} onOpenLoad - открыть модалку загрузки
 * @param {Function} onSave - открыть модалку сохранения
 * @param {Function} onPrint - печать
 * @param {Function} onExportPDF - экспорт в PDF
 * @param {Function} onReset - сброс
 * @param {string} pdfMethod - метод PDF (puppeteer/legacy)
 * @param {Function} setPdfMethod - установить метод PDF
 * @param {boolean} puppeteerAvailable - доступен ли Puppeteer
 * @param {boolean} exporting - идёт экспорт
 * @param {boolean} saving - идёт сохранение
 * @param {string} generateLabel - текст кнопки генерации
 * @param {boolean} generateDisabled - кнопка генерации отключена
 * @param {string} saveLabel - текст кнопки сохранения
 * @param {string} loadLabel - текст кнопки загрузки
 */
const ActionButtons = ({
  hasVariants = false,
  loading = false,
  onGenerate,
  onOpenLoad,
  onSave,
  onPrint,
  onExportPDF,
  onReset,
  pdfMethod = 'puppeteer',
  setPdfMethod,
  puppeteerAvailable = true,
  exporting = false,
  saving = false,
  generateLabel = 'Сформировать работу',
  generateDisabled = false,
  saveLabel = 'Сохранить работу',
  loadLabel = 'Открыть сохранённую',
}) => {
  return (
    <Space wrap>
      {onGenerate ? (
        <Button
          type="primary"
          htmlType="submit"
          icon={<ReloadOutlined />}
          loading={loading}
          size="large"
          disabled={generateDisabled}
        >
          {generateLabel}
        </Button>
      ) : null}

      {onOpenLoad && (
        <Button
          icon={<FolderOpenOutlined />}
          onClick={onOpenLoad}
          size="large"
        >
          {loadLabel}
        </Button>
      )}

      {hasVariants && (
        <>
          {onSave && (
            <Button
              icon={<SaveOutlined />}
              onClick={onSave}
              loading={saving}
              size="large"
            >
              {saveLabel}
            </Button>
          )}

          {onPrint && (
            <Button
              icon={<PrinterOutlined />}
              onClick={onPrint}
              size="large"
            >
              Печать
            </Button>
          )}

          {onExportPDF && (
            <Tooltip
              title={
                pdfMethod === 'puppeteer'
                  ? 'Высокое качество PDF с идеальным рендерингом формул'
                  : 'Стандартный экспорт PDF'
              }
            >
              <Badge
                count={pdfMethod === 'puppeteer' ? <RocketOutlined style={{ color: '#52c41a' }} /> : 0}
                offset={[-5, 5]}
              >
                <Button
                  icon={<FilePdfOutlined />}
                  onClick={onExportPDF}
                  loading={exporting}
                  size="large"
                >
                  Сохранить PDF
                </Button>
              </Badge>
            </Tooltip>
          )}

          {setPdfMethod && (
            <Segmented
              options={[
                {
                  label: (
                    <Tooltip title="Новая технология: высокое качество, быстрая генерация">
                      <span>
                        <RocketOutlined /> Новый
                      </span>
                    </Tooltip>
                  ),
                  value: 'puppeteer',
                  disabled: !puppeteerAvailable,
                },
                {
                  label: (
                    <Tooltip title="Классический метод экспорта">
                      <span>Обычный</span>
                    </Tooltip>
                  ),
                  value: 'legacy',
                },
              ]}
              value={pdfMethod}
              onChange={setPdfMethod}
              size="large"
            />
          )}

          {onReset && (
            <Button onClick={onReset} size="large">
              Сбросить
            </Button>
          )}
        </>
      )}
    </Space>
  );
};

export default ActionButtons;
