import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import EgeBaseStructureTable from '../components/worksheet/EgeBaseStructureTable';

vi.mock('../components/worksheet/SuccessRateCell', () => ({ default: () => <span>70%</span> }));
const topics = [1,3,7,14].map(n => ({ id:`t${n}`,ege_number:n,exam_type:'ege_base',title:`ЕГЭ-База. №${n} Тема ${n}` }));
const subtopics = [
  {id:'s3',topic:'t3',name:'Определение величины по графику'},
  {id:'s7',topic:'t7',name:'Анализ графиков функций'},
  {id:'s14',topic:'t14',name:'Действия с десятичными дробями'},
  {id:'unsupported',topic:'t14',name:'Разные задачи'},
];
const slots=topics.map(t=>({topicId:t.id,source:'bank',generatorId:null,pinnedTask:null,subtopics:[],difficulty:[],tags:[]}));
function setup(extra={}) {
  const props={slots,topics,subtopics,canGenerate:true,loading:false,onUpdateSlot:vi.fn(),onSetSlots:vi.fn(),onPin:vi.fn(),onUnpin:vi.fn(),...extra};
  const view=render(<EgeBaseStructureTable {...props} />); return {...props,...view};
}
afterEach(cleanup);
const rowFor=n=>screen.getByText(`Тема ${n}`).closest('tr');
describe('доступность генерации в структуре базового ЕГЭ',()=>{
  it('показывает метки, даже когда все задачи выбираются из банка',()=>{
    setup();expect(screen.getAllByText('Есть генератор')).toHaveLength(3);
    expect(within(rowFor(1)).queryByText('Есть генератор')).toBeNull();
    expect(within(rowFor(14)).getByText('Есть генератор')).toBeInTheDocument();
    expect(within(rowFor(14)).getByRole('radio',{name:'Из банка'})).toBeChecked();
  });
  it('фильтр меняет только показ, действия сохраняют исходный номер слота',()=>{
    const props=setup();fireEvent.click(screen.getByText('С генерацией · 3'));
    expect(screen.queryByText('Тема 1')).toBeNull();
    fireEvent.click(within(rowFor(3)).getByRole('button',{name:'Выбрать задачу №3'}));expect(props.onPin).toHaveBeenCalledWith(1);
    fireEvent.click(within(rowFor(14)).getByRole('radio',{name:/Новая задача/}));
    expect(props.onUpdateSlot).toHaveBeenCalledWith(3,'generatorId','decimal:sumTimes');
    expect(props.onSetSlots).not.toHaveBeenCalled();
  });
  it('массовое включение сохраняет фиксацию и не обходит выбранную неподдерживаемую подтему',()=>{
    const pinned={...slots[1],pinnedTask:{id:'pin',code:'Б3-1'}};
    const input=[slots[0],pinned,slots[2],{...slots[3],subtopics:['unsupported']}];
    const props=setup({slots:input});fireEvent.click(screen.getByRole('button',{name:'Генерация где доступна'}));
    const result=props.onSetSlots.mock.calls[0][0](input);
    expect(result[0]).toBe(input[0]);expect(result[1]).toBe(pinned);
    expect(result[2]).toMatchObject({source:'generated',generatorId:'graph:f_tangent_match'});
    expect(result[3]).toBe(input[3]);
  });
  it('возвращает выбор из банка, сохраняя фильтры и зафиксированные задачи',()=>{
    const pin={...slots[2],pinnedTask:{id:'p',code:'Б7-1'},source:'generated',generatorId:'graph:f_sign_match'};
    const input=[slots[0],slots[1],pin,{...slots[3],source:'generated',generatorId:'decimal:diffTimes',subtopics:['s14'],difficulty:[2]}];
    const props=setup({slots:input});fireEvent.click(screen.getByRole('button',{name:'Всё из банка'}));
    const result=props.onSetSlots.mock.calls[0][0](input);
    expect(result[2]).toBe(pin);expect(result[3]).toMatchObject({source:'bank',generatorId:null,subtopics:['s14'],difficulty:[2]});
  });
  it('отмечает поддерживаемые подтемы прямо в списке выбора',()=>{
    setup();fireEvent.mouseDown(screen.getByRole('combobox',{name:'Подтемы №14'}));
    expect(screen.getByText('⚡ Действия с десятичными дробями')).toBeInTheDocument();
    expect(screen.getByText('Разные задачи')).toBeInTheDocument();
  });
  it('при неподдерживаемом фильтре сохраняет общую метку темы и объясняет ограничение',()=>{
    setup({slots:[{...slots[3],subtopics:['unsupported']}]});
    expect(screen.getByText('Есть генератор')).toBeInTheDocument();
    expect(screen.getByRole('radio',{name:/Новая задача/})).toBeDisabled();
    expect(screen.getByText('Для выбранных подтем — только банк')).toBeInTheDocument();
  });
  it('viewer видит доступность, но не может включить создание задач',()=>{
    setup({canGenerate:false});expect(screen.getAllByText('Есть генератор')).toHaveLength(3);
    expect(screen.queryByRole('button',{name:'Генерация где доступна'})).toBeNull();
    screen.getAllByRole('radio',{name:/Новая задача/}).forEach(r=>expect(r).toBeDisabled());
  });
});
