import { Result } from 'antd';
export default function StudentDeadlineNotice() {
  return <Result status="warning" title="Срок сдачи истёк"
    subTitle="В этой работе установлен строгий срок. Начать или отправить работу больше нельзя. Обратитесь к учителю, если нужно продлить срок." />;
}
