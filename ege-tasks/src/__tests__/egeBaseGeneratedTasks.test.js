import { describe, it, expect, vi } from 'vitest';
import katex from 'katex';
import { EGE_BASE_GENERATORS, generatorsForTopic, generateEgeBaseTask, generatedChartSpec } from '../utils/egeBaseGeneratedTasks';
import { makeChartTask, CHART_CATEGORIES } from '../utils/chartReadingTasks';
import { parseChartSpec, docToChart } from '../utils/chartSpec';
import { parseCoordPlot, coordPlotSvg } from '../utils/coordPlot';
import { buildEgeBaseVariants } from '../utils/buildEgeBaseVariants';

const topics = [3, 7, 14, 16, 17].map(n => ({ id: `topic${n}`, exam_type: 'ege_base', ege_number: n }));
const subtopics = [...new Map(EGE_BASE_GENERATORS.map(g => [`${g.number}:${g.subtopic}`, g])).values()]
  .map((g, i) => ({ id: `sub${i}`, topic: `topic${g.number}`, name: g.subtopic }));
const argsFor = g => ({ topic: topics.find(t => t.ege_number === g.number), subtopics, generatorId: g.id });

describe('прототипы базового ЕГЭ', () => {
  it('не подмешивает профильные производные и непроверенные тригонометрические типы', () => {
    expect([...new Set(EGE_BASE_GENERATORS.map(g => g.number))].sort((a,b)=>a-b)).toEqual([3,7,14,16,17]);
    expect(EGE_BASE_GENERATORS.filter(g => g.id.startsWith('graph:')).map(g => g.id)).toEqual([
      'graph:f_tangent_match', 'graph:f_sign_match', 'graph:b_interval_match',
      'graph:b_tangent_graphs', 'graph:b_linear_slope', 'graph:b_char_match',
    ]);
    expect(EGE_BASE_GENERATORS.some(g => g.id === 'logEquation:logAsBase')).toBe(false);
    expect(EGE_BASE_GENERATORS.filter(g => g.id.startsWith('trig:')).map(g => g.id)).toEqual(['trig:identity_sc', 'trig:identity_tg', 'trig:standardAngles']);
    expect(EGE_BASE_GENERATORS.filter(g => g.id.startsWith('trigNumeric:')).map(g => g.id)).toEqual(['trigNumeric:reductionRatio', 'trigNumeric:complementaryProduct', 'trigNumeric:standardAngles']);
    expect(generatorsForTopic({ ...topics[0], exam_type: 'ege_profile' }, subtopics)).toEqual([]);
  });
  it('подтемы ищутся только внутри нужной темы; нет подтемы — нет генерации', async () => {
    const g = EGE_BASE_GENERATORS[0];
    expect(generatorsForTopic(argsFor(g).topic, [])).toEqual([]);
    expect(generatorsForTopic(argsFor(g).topic, subtopics, ['missing'])).toEqual([]);
    await expect(generateEgeBaseTask({ ...argsFor(g), subtopics: subtopics.map(s=>({...s,topic:'wrong'})) })).rejects.toThrow('подходящего генератора');
  });
  it.each(EGE_BASE_GENERATORS.map(g => [g.id, g]))('%s: условие, тема/подтема, ответ в бланк и чертёж', async (_id, g) => {
    const used = new Set();
    for (let i=0; i<3; i++) {
      const task = await generateEgeBaseTask({ ...argsFor(g), used });
      expect(task.topic).toBe(`topic${g.number}`);
      expect(task.subtopic).toEqual([subtopics.find(s=>s.topic===task.topic && s.name===g.subtopic).id]);
      expect(task).not.toHaveProperty('code'); expect(task).not.toHaveProperty('id');
      expect(task.answer).toMatch(/^-?\d+(,\d+)?$/); expect(task.statement_md).not.toMatch(/undefined|NaN/);
      if (g.number === 7) { expect(task.answer).toMatch(/^[1-4]{4}$/); expect(new Set(task.answer).size).toBe(4); expect(task.statement_md).toContain('|'); }
      for (const m of task.statement_md.matchAll(/```(chart|plot)\n([\s\S]*?)\n```/g)) {
        if(m[1]==='chart') expect(parseChartSpec(m[2]).errors).toEqual([]);
        else { const model=parseCoordPlot(m[2]); expect(model.errors).toEqual([]); expect(coordPlotSvg(model)).toContain('<svg'); }
      }
      for (const m of task.statement_md.matchAll(/(?<!\$)\$(?!\$)([^$]+)\$/g)) expect(()=>katex.renderToString(m[1], { throwOnError:true })).not.toThrow();
    }
    expect(used.size).toBe(3);
  });
  it.each(CHART_CATEGORIES)('%s: chart DSL сохраняет данные и подписи', cat => {
    const task = makeChartTask(cat); expect(task).toBeTruthy();
    const {doc,errors} = parseChartSpec(generatedChartSpec(task.chart)); expect(errors).toEqual([]);
    const back=docToChart(doc), original=JSON.parse(JSON.stringify(task.chart));
    expect(back.y).toMatchObject({min:original.y.min || 0,max:original.y.max || 0,grid:original.y.grid});
    expect(back.x.groups || []).toEqual(original.x.groups || []); expect(back.y.unit).toBe(original.y.unit);
    if(original.type==='bar') { expect(back.bars).toEqual(original.bars); expect(back.x.ticks).toEqual(original.x.ticks); }
    else { expect(back.series.map(s=>s.points)).toEqual(original.series.map(s=>s.points));
      for(const tick of original.x.ticks) expect(back.x.ticks).toContainEqual(tick);
    }
  });
});
const bankSlot = { topicId:'topic3', source:'bank', subtopics:[], difficulty:[], tags:[] };
const genSlot = { topicId:'topic14', source:'generated', generatorId:'decimal:trickFraction', subtopics:[], difficulty:[], tags:[] };
function fakeApi() { let id=0; return { getTasks:vi.fn(async()=>[1,2,3].map(n=>({id:`bank${n}`,topic:'topic3',difficulty:'2'}))), createTask:vi.fn(async data=>({...data,id:`new${++id}`,code:`Б14-${id}`})) }; }
const build = (api, extra={})=>buildEgeBaseVariants({slots:[bankSlot,genSlot],topics,subtopics,variantsCount:3,variantsMode:'different',api,...extra});
describe('сборка и сохранение смешанного варианта',()=>{
  it('сохраняет новые задачи и порядок слотов без повторов между вариантами',async()=>{
    const api=fakeApi(),variants=await build(api); expect(api.createTask).toHaveBeenCalledTimes(3);
    expect(new Set(variants.map(v=>v.tasks[0].id)).size).toBe(3); expect(new Set(variants.map(v=>v.tasks[1].statement_md)).size).toBe(3);
    variants.forEach(v=>expect(v.tasks.map(t=>t.topic)).toEqual(['topic3','topic14']));
  });
  it.each(['same','shuffled'])('%s сохраняет один набор, использует реальные ID',async mode=>{
    const api=fakeApi(),variants=await build(api,{variantsMode:mode}); expect(api.createTask).toHaveBeenCalledTimes(1); expect(variants).toHaveLength(3);
    variants.forEach(v=>{
      expect(v.tasks.map(t=>t.id)).toEqual(variants[0].tasks.map(t=>t.id));
      expect(v.tasks.map(t=>t.topic)).toEqual(['topic3','topic14']);
    });
  });
  it('фиксация приоритетнее генерации',async()=>{
    const api=fakeApi(),pin={id:'pin',topic:'topic14'}; const variants=await build(api,{slots:[bankSlot,{...genSlot,pinnedTask:pin}]});
    expect(api.createTask).not.toHaveBeenCalled(); expect(api.getTasks).toHaveBeenCalledTimes(1); expect(variants.every(v=>v.tasks[1]===pin)).toBe(true);
  });
  it('пустой банк не сдвигает нумерацию и не вызывает запись',async()=>{
    const api=fakeApi();api.getTasks.mockResolvedValue([]); await expect(build(api)).rejects.toThrow('№3');expect(api.createTask).not.toHaveBeenCalled();
  });
  it('сообщает количество созданных задач при ошибке записи',async()=>{
    const api=fakeApi();api.createTask.mockResolvedValueOnce({id:'new',topic:'topic14'}).mockRejectedValueOnce(new Error('offline'));
    await expect(build(api)).rejects.toThrow('Уже сохранено в банк: 1');
  });
  it('не генерирует в неподдерживаемую подтему',async()=>{
    const api=fakeApi();await expect(build(api,{slots:[{...genSlot,subtopics:['bad']}]})).rejects.toThrow('Выберите подходящий тип'); expect(api.createTask).not.toHaveBeenCalled();
  });
});
