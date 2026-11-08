import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import EgeBaseTaskGeneratorModal from '../components/worksheet/EgeBaseTaskGeneratorModal';
import { EGE_BASE_GENERATORS, generateEgeBaseTask } from '../utils/egeBaseGeneratedTasks';
import { api } from '../services/pocketbase';
import KimTaskContent, { KimAnswer } from '../components/worksheet/KimTaskContent';
vi.mock('../services/pocketbase', () => ({ api: { createTask: vi.fn() } }));
const topic={id:'t14',exam_type:'ege_base',ege_number:14};
const subtopics=[{id:'s14',topic:'t14',name:'Действия с десятичными дробями'}];
const target={vi:0,ti:0,task:{id:'old',topic:'t14',source:'Генератор Lemma · ЕГЭ база · decimal:trickFraction'}};
const onApply=vi.fn(),onCancel=vi.fn();
function mount(extra={}) { return render(<App><EgeBaseTaskGeneratorModal target={target} topic={topic} subtopics={subtopics} usedStatements={[]} onApply={onApply} onCancel={onCancel} {...extra} /></App>); }
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();api.createTask.mockImplementation(async draft=>({...draft,id:'saved',code:'Б14-999'}));});
describe('новая задача с предпросмотром',()=>{
  it('предпросмотр и отмена не записывают задачу в банк',async()=>{
    mount(); expect(screen.getByText('Сохранить в банк и подставить').closest('button')).toBeDisabled();
    fireEvent.click(screen.getByText('Сгенерировать'));
    await screen.findByText('Ответ:');
    expect(api.createTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Отмена'));expect(onCancel).toHaveBeenCalledOnce();expect(api.createTask).not.toHaveBeenCalled();
  });
  it('сохраняет тему, подтему и подставляет серверную запись с ID и кодом',async()=>{
    mount();fireEvent.click(screen.getByText('Сгенерировать'));await screen.findByText('Ответ:');
    fireEvent.click(screen.getByText('Сохранить в банк и подставить'));
    await waitFor(()=>expect(onApply).toHaveBeenCalledOnce());
    expect(api.createTask).toHaveBeenCalledWith(expect.objectContaining({topic:'t14',subtopic:['s14']}));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({id:'saved',code:'Б14-999'}));
  });
  it('при ошибке записи оставляет предпросмотр для повторной попытки',async()=>{
    api.createTask.mockRejectedValueOnce(new Error('offline'));
    mount();fireEvent.click(screen.getByText('Сгенерировать'));await screen.findByText('Ответ:');
    fireEvent.click(screen.getByText('Сохранить в банк и подставить'));
    await screen.findByText('Не удалось сохранить задачу в банк. Попробуйте ещё раз.');
    expect(onApply).not.toHaveBeenCalled();
    await waitFor(()=>expect(screen.getByText('Сохранить в банк и подставить').closest('button')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Сохранить в банк и подставить'));
    await waitFor(()=>expect(onApply).toHaveBeenCalledOnce());
  });
});

describe('чертежи сгенерированных задач в существующем КИМ', () => {
  it.each(['graph:f_tangent_match', 'graph:b_char_match', 'chart:match_rate', 'chart:bar_max'])('%s рисует SVG и сохраняет таблицу соответствия', async id => {
    const g = EGE_BASE_GENERATORS.find(g => g.id === id);
    const graphTopic = { id: 'graphTopic', exam_type: 'ege_base', ege_number: g.number };
    const task = await generateEgeBaseTask({ topic: graphTopic, subtopics: [{ id:'graphSub', topic:graphTopic.id, name:g.subtopic }], generatorId:id });
    const { container } = render(<><KimTaskContent task={task} answerTable /><KimAnswer task={task} /></>);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('.katex-error')).toBeNull();
    if(g.number === 7) {
      expect(container.querySelector('.kim-answer-table')).not.toBeNull();
      expect(container.querySelector('.kim-answer-table').querySelectorAll('td')).toHaveLength(4);
    }
  });
});
