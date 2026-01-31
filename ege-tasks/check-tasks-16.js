import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

const topics = await pb.collection('topics').getFullList({ filter: 'ege_number = 16' });
if (topics.length > 0) {
  const topic = topics[0];
  const tasks = await pb.collection('tasks').getFullList({
    filter: `topic = "${topic.id}"`,
    fields: 'id,code,source'
  });
  console.log(`Всего задач по теме №16: ${tasks.length}`);

  const bySource = {};
  tasks.forEach(t => {
    bySource[t.source] = (bySource[t.source] || 0) + 1;
  });

  console.log('\nПо источникам:');
  Object.entries(bySource).forEach(([src, count]) => {
    console.log(`  ${src}: ${count}`);
  });
}
