import { useMemo } from 'react'
import { planimSvgFromSpec } from '../../../utils/planim/dsl'

// Планиметрический чертёж из текста — тот же блок ```planim, что учитель
// пишет в условии задачи. SVG строит наш же движок, исходник — константа
// страницы, поэтому вставка разметкой безопасна.
export const PLANIM_SPEC = [
  'треугольник ABC 7 8 6',
  'цвет',
  'H = высота B AC',
  'I = вписанная ABC',
  'угол BAC α',
].join('\n')

export default function PlanimSample() {
  const svg = useMemo(() => {
    try { return planimSvgFromSpec(PLANIM_SPEC) } catch { return '' }
  }, [])
  return <div className="v2-planim-figure" dangerouslySetInnerHTML={{ __html: svg }} />
}
