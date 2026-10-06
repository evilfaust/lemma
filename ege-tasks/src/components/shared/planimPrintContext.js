import { createContext } from 'react';

// Место планиметрического чертежа на печатном листе: { widthMm, heightMm,
// letterMm }. Его ставит печатный лист (SheetTask, рабочий лист геометрии), а
// PlanimSVG строит чертёж сразу под это место (planimPrintSvgFromSpec): фигура
// вписывается, буквы остаются высотой letterMm — как буквы формул в условии.
// Без провайдера — обычный «резиновый» чертёж для экрана.
export const PlanimPrintContext = createContext(null);
