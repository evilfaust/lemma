import { useState, useEffect } from 'react';

export function useTrigMCModal() {
  const [modalOpen, setModalOpen] = useState(false);
  const [printTest, setPrintTest] = useState(null);

  useEffect(() => {
    if (!printTest) return;
    const timer = setTimeout(() => {
      const style = document.createElement('style');
      style.id = 'trig-mc-page-style';
      style.textContent = '@page { size: A4 portrait; margin: 0; }';
      document.head.appendChild(style);
      window.print();
      setTimeout(() => {
        document.getElementById('trig-mc-page-style')?.remove();
        setPrintTest(null);
      }, 1500);
    }, 100);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printTest?.id]);

  const handlePrint = (testRecord) => {
    setModalOpen(false);
    setTimeout(() => setPrintTest(testRecord), 50);
  };

  return { modalOpen, setModalOpen, printTest, handlePrint };
}
