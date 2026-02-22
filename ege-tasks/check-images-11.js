import PocketBase from 'pocketbase';

const PB_URL = process.env.VITE_PB_URL || process.env.PB_URL || 'https://task-ege.oipav.ru';
const pb = new PocketBase(PB_URL);

const topics = await pb.collection('topics').getFullList({
  filter: 'ege_number = 11'
});

if (topics.length > 0) {
  const topic = topics[0];
  const tasks = await pb.collection('tasks').getFullList({
    filter: `topic = "${topic.id}"`,
    fields: 'id,code,has_image,image_url,statement_md',
    sort: 'code'
  });

  console.log(`📊 Задачи по теме №11: ${tasks.length}\n`);

  tasks.forEach(task => {
    const hasUrl = !!task.image_url;
    const hasFlag = task.has_image;
    const hasInText = task.statement_md?.includes('![image]');

    const status = hasUrl ? '✅' : '❌';
    const textStatus = hasInText ? '⚠️ (в тексте)' : '';

    console.log(`${status} ${task.code}: has_image=${hasFlag}, url=${hasUrl ? 'есть' : 'нет'} ${textStatus}`);

    if (hasUrl) {
      console.log(`   ${task.image_url.substring(0, 60)}...`);
    }
  });
}
