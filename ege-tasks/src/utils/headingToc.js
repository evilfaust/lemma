/**
 * Пункт оглавления из готового заголовка статьи (HTML после KaTeX и DOMPurify).
 *
 * textContent у формулы KaTeX склеивает MathML-разметку с видимым набором
 * («nn∈N…») — в оглавлении получалась каша. Поэтому:
 *  - html — сам заголовок как есть: формулы в оглавлении рисуются формулами;
 *  - text — простой текст, где формула записана исходным LaTeX ($…$):
 *    для подсказок, поиска и проверки «заголовок не пустой».
 */
export function headingTocEntry(h) {
  const plain = h.cloneNode(true);
  plain.querySelectorAll('.katex').forEach((k) => {
    const tex = k.querySelector('annotation')?.textContent;
    k.replaceWith(tex ? `$${tex}$` : k.textContent);
  });
  return {
    text: plain.textContent.replace(/\s+/g, ' ').trim(),
    html: h.innerHTML.trim(),
  };
}
