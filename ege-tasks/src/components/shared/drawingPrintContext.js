import { createContext } from 'react';

// Место чертежа (```planim / ```stereo) на печатном листе: { widthMm, heightMm,
// letterMm }. Его ставит печатный лист (SheetTask), а PlanimSVG / StereoSVG
// строят чертёж сразу под это место: фигура вписывается, буквы остаются
// высотой letterMm — как буквы формул в условии. Без провайдера — обычный
// «резиновый» чертёж для экрана.
export const DrawingPrintContext = createContext(null);
