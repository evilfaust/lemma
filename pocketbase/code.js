import PocketBase from 'pocketbase';

const PB_URL = process.env.VITE_PB_URL || process.env.PB_URL || 'https://task-ege.oipav.ru';
const pb = new PocketBase(PB_URL);

async function generateCode(topicId) {
  const topic = await pb.collection('topics').getOne(topicId);

  const ege = topic.ege_number;

  const tasks = await pb.collection('tasks').getFullList({
    filter: `topic="${topicId}"`,
    fields: 'code',
  });

  const numbers = tasks
    .map(t => t.code)
    .filter(Boolean)
    .map(c => parseInt(c.split('-')[1]))
    .filter(n => !isNaN(n));

  const next = (Math.max(0, ...numbers) + 1)
    .toString()
    .padStart(3, '0');

  return `${ege}-${next}`;
}
