'use strict';
/* Точная связь замечаний CHECK с отдельными правилами. Все данные локальные. */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const cs = value => `<span class="cs">${esc(value)}</span>`;
  const p = text => `<p>${text}</p>`;
  const ref = (section, group, title, row) => ({section, group, title, row});
  const letter = title => ref('pravopisanie', 'Какую букву писать', title);
  const sign = (group, title) => ref('znaki', group, title);
  const uk = letter('Оу или Ꙋ');
  const ya = letter('Ꙗ или Ѧ');
  const i = letter('И, І или Ѵ');
  const oxia = sign('Ударения', 'Оксия');
  const varia = sign('Ударения', 'Вария');
  const psili = sign('Придыхание', 'Звательце');

  // Поиск только по полному адресу блока. Чужое или первое правило не подставляется.
  function readBlock(address) {
    const section = (window.SECTIONS || []).find(item => item.id === address.section);
    const group = section?.groups?.find(item => item.title === address.group);
    const block = group?.blocks?.find(item => item.title === address.title);
    if (!block?.html) return null;
    let html = block.html;
    if (address.row) {
      // Строка таблицы переносится целиком, включая все примеры и вложенную разметку.
      const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) || [];
      const row = rows.find(item => address.row.test(item));
      if (!row) return null;
      const head = html.match(/<thead\b[^>]*>[\s\S]*?<\/thead>/)?.[0] || '';
      html = `<table class="tbl">${head}<tbody>${row}</tbody></table>`;
    }
    return {title:block.title, sub:block.sub || '', html, section:section.title};
  }

  const RULES = {
    'punct': {title:'Вопросительный знак', intro:`В церковнославянском тексте вопрос обозначается знаком ${cs(';')}.`, refs:[ref('chtenie', 'Знаки препинания', 'Таблица знаков', /<td\b[^>]*>;\s*<\/td>/)]},
    'e': {title:'Є и е вместо э', intro:`Буква ${cs('э')} не входит в церковнославянскую азбуку. Выбор ${cs('є')} или ${cs('е')} зависит от места в слове.`, refs:[letter('Е или Є')]},
    'e-start': {title:'Є в начале слова', intro:`В начале слова пишется широкое ${cs('є')}.`, refs:[letter('Е или Є')]},
    'yo': {title:'Е вместо ё', intro:`В церковнославянском письме нет буквы ${cs('ё')}; ${cs('е')} читается как [е].`, refs:[ref('chtenie', 'Правила чтения', '2. Е — не Ё')]},
    'o-start': {title:'Ѻ в начале слова', intro:`В начале слова употребляется широкое ${cs('ѻ')}; в ряде слов по традиции пишется ${cs('ѡ')}. Программа предлагает ${cs('ѻ')}, но выбор буквы в конкретном слове нужно сверить со словарём.`, refs:[letter('О, Ѻ или Ѡ')]},
    'u': {title:'Оу и ꙋ', intro:`Для звука [у] в начале слова пишется ${cs('оу')}, в середине и в конце — ${cs('ꙋ')}. Отдельное ${cs('у')} служит также буквой-цифрой 400.`, refs:[uk]},
    'uk': {title:'Оу в начале слова', intro:`Начальное ${cs('ꙋ')} заменяется сочетанием ${cs('оу')}. Придыхание и ударение ставятся над второй частью сочетания.`, refs:[uk]},
    'uk-mid': {title:'Ꙋ в середине и в конце слова', intro:`В середине и в конце слова обычно пишется ${cs('ꙋ')}, а не сочетание ${cs('оу')}.`, refs:[uk]},
    'ya': {title:'Ꙗ и ѧ вместо я', intro:`Русская буква ${cs('я')} заменяется церковнославянскими ${cs('ꙗ')} или ${cs('ѧ')}. Выбор зависит от места в слове и значения.`, refs:[ya]},
    'ya-start': {title:'Ꙗ в начале слова', intro:`Обычно в начале слова пишется ${cs('ꙗ')}. Исключения: ${cs('ѧ҆зы́къ')} — орган или речь, и ${cs('ѧ҆̀')} — «их».`, refs:[ya]},
    'ya-mid': {title:'Ѧ в середине и в конце слова', intro:`В середине и в конце слова пишется ${cs('ѧ')}, а не ${cs('ꙗ')}.`, refs:[ya]},
    'i-before-vowel': {title:'І перед гласной', intro:`Перед гласной и перед ${cs('й')} пишется десятеричное ${cs('і')}.`, refs:[i]},
    'i-before-cons': {title:'И перед согласной', intro:`Перед согласной обычно пишется ${cs('и')}. Буква ${cs('і')} сохраняется в ${cs('мі́ръ')} «вселенная», ${cs('вїно̀')} и в греческих словах: это замечание требует проверки по смыслу и словарю.`, refs:[i]},
    'zelo': {title:'Корни с ѕ', intro:`В отмеченном корне проверяется написание буквы ${cs('ѕ')}. Правило распространяется и на производные слова.`, refs:[letter('З или Ѕ')]},
    'psi': {title:'Ѱ в греческих словах', intro:`В словах ${cs('ѱало́мъ')} и ${cs('ѱалти́рь')} греческому ψ соответствует буква ${cs('ѱ')}, а не сочетание ${cs('пс')}.`, refs:[letter('Ѯ и Ѱ')]},
    'ksi': {title:'Ѯ в греческих словах', intro:`В имени ${cs('а҆леѯа́ндръ')} греческому ξ соответствует буква ${cs('ѯ')}, а не сочетание ${cs('кс')}.`, refs:[letter('Ѯ и Ѱ')]},
    'fymiam': {title:'Ижица в греческом слове', intro:`Словарное написание — ${cs('ѳѷмїа́мъ')}: греческая υ в θυμίαμα передаётся ижицей. Замена всей формы автоматически не выполняется.`, refs:[i]},
    'ot': {title:'Предлог ѿ', intro:`Предлог «от» записывается одной буквой ${cs('ѿ')}.`, refs:[letter('Ѿ')]},
    'yer': {title:'Ъ на конце слова', intro:`После твёрдой согласной на конце слова пишется ${cs('ъ')}. Он не произносится; мягкость обозначается буквой ${cs('ь')}.`, refs:[ref('pravopisanie', 'Ещё о правописании', 'Ъ, Ь и ерок')]},
    'psili': {title:'Придыхание над начальной гласной', intro:'Над гласной в начале слова ставится звательце. Знак не произносится.', refs:[psili]},
    'psili-mid': {title:'Место придыхания', intro:`Звательце относится к начальной гласной слова. В сочетании ${cs('оу')} оно ставится над ${cs('у')}; в остальных позициях внутри слова программа предлагает его убрать.`, refs:[psili]},
    'order': {title:'Порядок придыхания и ударения', intro:`В Unicode сначала записывается придыхание, затем ударение: ${cs('а҆́')}. Обратный порядок может нарушать расположение знаков в шрифте.`, kind:'typing', refs:[]},
    'varia-mid': {title:'Вария — над последней буквой', intro:`Тяжёлое ударение (вария) ставится на самом конце слова. В начале и в середине употребляется оксия.`, refs:[varia, oxia]},
    'oxia-end': {title:'Вария на конце слова', intro:'На конечной ударной гласной обычно ставится вария. Если следом идёт безударное слово (бо, же, ли, мѧ…), сохраняется оксия.', refs:[varia]},
    'varia-encl': {title:'Оксия перед безударным словом', intro:`Перед безударным словом конечная вария заменяется оксией: ${cs('землѧ̀ → землѧ́ же')}. Замечание учитывает следующее слово в вашем тексте.`, refs:[oxia]},
    'apostrof': {title:'Апостроф в односложном слове', intro:'В слове из одной ударной гласной ставится апостроф: звательце с варией. Перед следующим безударным словом выбор ударения требует учёта контекста.', refs:[sign('Придыхание', 'Апостроф')]},
    'no-stress': {title:'Проверьте знак ударения', intro:'В этом слове программа не нашла знака ударения. Знаки ставятся в словах, кроме безударных. Проверка не определяет место ударения: выберите его по словарю и нужной форме слова.', refs:[], kind:'check'},
    'two-stress': {title:'Несколько знаков ударения', intro:'В одном слове обнаружено больше одного знака ударения. Проверьте, не остался ли старый знак после вставки нового и правильно ли разделены слова. Проверка не выбирает ударение за вас.', refs:[], kind:'check'}
  };

  function base(word) {
    return word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[іїѵ]/g, 'и').replace(/ꙋ|ᲂу|оу/g, 'у');
  }

  function configuration(issue) {
    if (issue.rule === 'sacred') {
      const word = base(issue.word || '');
      const special = word === 'богъ' ? 'Бог' : word === 'ангелъ' ? 'Ангел' : '';
      return {title:'Священное слово под титлом', intro:'Священные имена и связанные с ними слова пишутся сокращённо под титлом. В некоторых случаях написание зависит от значения: решение нужно принимать в контексте.', refs:special ? [ref('titla', 'Под титлом — священное, полностью — обычное', special)] : [sign('Титла', 'Простое титло'), sign('Титла', 'Буквенные титла')]};
    }
    if (issue.rule === 'digits') {
      const number = Number(issue.word);
      const refs = [ref('cifir', 'Правила', 'Где титло')];
      if (number >= 11 && number <= 19) refs.push(ref('cifir', 'Правила', '11–19 — наоборот'));
      if (number === 0) refs.splice(0, 1, ref('cifir', 'Правила', 'Нуля нет'));
      return {title:'Буквенная запись числа', intro:'В церковнославянской цифири числа обозначаются буквами с титлом. Это предложение изменить способ записи числа, а не ошибка в его значении.', refs};
    }
    if (issue.rule === 'latin') return {title:'Латинская буква в слове', intro:'В кириллическом слове найдена латинская буква, похожая по начертанию. Это разные символы Unicode: одинаковый внешний вид не делает их одной буквой. Проверьте раскладку и замените случайный латинский символ кириллическим.', refs:[], kind:'typing'};
    if (issue.rule === 'spell') return {title:'Словарные варианты SCI', intro:`Точное написание этого слова не найдено в орфографическом словаре SCI. Ниже — словарные формы с тем же буквенным остовом после снятия надстрочных знаков и сведения парных букв (например, ${cs('е/ѣ, о/ѡ, и/і')}).`, html:p('Совпадение остова не доказывает, что формы имеют одинаковое значение. Разные ударения и буквы могут различать грамматические формы и слова. Выберите вариант по смыслу предложения; программа не определяет нужную форму автоматически.') + p('Это результат словарного сопоставления. Конкретное правило, объясняющее различие этих вариантов, проверка не установила.'), refs:[], kind:'dictionary'};
    if (issue.rule === 'unknown') return {title:'Слово не найдено в SCI', intro:'Точная форма слова не найдена в орфографическом словаре SCI; близкого варианта с тем же буквенным остовом тоже нет.', html:p('Словарь содержит не все формы и имена. Отсутствие слова само по себе не доказывает ошибку. Проверьте буквы, надстрочные знаки и значение по тексту или другому словарю.') + p('Для этого замечания конкретное нарушенное правило не определено.'), refs:[], kind:'dictionary'};
    return Object.prototype.hasOwnProperty.call(RULES, issue.rule) ? RULES[issue.rule] : {title:'Пояснение к замечанию', intro:'Для этого замечания в справочнике нет отдельного сопоставленного правила. Проверьте отмеченное слово в контексте.', html:issue.msg ? p(esc(issue.msg)) : '', refs:[], kind:'check'};
  }

  // Чистая модель также используется для проверки полноты карты без открытия окна.
  function resolve(input) {
    const issue = input && typeof input === 'object' ? input : {};
    const config = configuration(issue);
    const blocks = config.refs.map(readBlock).filter(Boolean);
    const missing = config.refs.length - blocks.length;
    return {
      rule:String(issue.rule || ''), title:config.title, intro:config.intro, html:config.html || '',
      kind:config.kind || 'rule', blocks, missing,
      word:String(issue.word || ''), fixed:typeof issue.fixed === 'string' ? issue.fixed : typeof issue.fix === 'string' ? issue.fix : '',
      alts:Array.isArray(issue.alts) ? [...new Set(issue.alts.filter(item => typeof item === 'string'))] : []
    };
  }

  let dialog, returnFocus;
  function ensureDialog() {
    if (dialog?.isConnected) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'rule-popup';
    dialog.setAttribute('aria-labelledby', 'rulePopupTitle');
    dialog.innerHTML = '<div class="rule-popup-shell"><header class="rule-popup-head"><h2 id="rulePopupTitle"></h2><button class="rule-popup-close" type="button" aria-label="Закрыть правило" autofocus>×</button></header><div class="rule-popup-scroll" tabindex="0"></div><footer class="rule-popup-foot"></footer></div>';
    dialog.querySelector('.rule-popup-close').addEventListener('click', () => dialog.close());
    let backdropStart = false;
    dialog.addEventListener('pointerdown', event => {backdropStart = event.target === dialog && outside(event);});
    dialog.addEventListener('click', event => {
      if (backdropStart && event.target === dialog && outside(event)) dialog.close();
      backdropStart = false;
    });
    dialog.addEventListener('close', () => {
      if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
      returnFocus = null;
    });
    document.body.append(dialog);
    return dialog;
  }

  function outside(event) {
    const box = dialog.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  }

  function open(issue) {
    const model = resolve(issue);
    const popup = ensureDialog();
    if (!popup.open) returnFocus = document.activeElement;
    popup.querySelector('h2').textContent = model.title;
    const alternatives = model.alts.length ? `<section class="rule-popup-variants"><h3>Словарные варианты</h3><ul>${model.alts.map(word => `<li class="cs">${esc(word)}</li>`).join('')}</ul></section>` : '';
    const context = model.word ? `<div class="rule-popup-context"><div><span>В вашем тексте</span><strong class="cs">${esc(model.word)}</strong></div>${model.fixed && model.fixed !== model.word ? `<span class="rule-popup-arrow" aria-hidden="true">→</span><div><span>Предложено</span><strong class="cs">${esc(model.fixed)}</strong></div>` : ''}</div>` : '';
    popup.querySelector('.rule-popup-scroll').innerHTML = `${context}<div class="rule-popup-explanation">${p(model.intro)}${model.html}</div>${alternatives}${model.blocks.map(block => `<section class="rule-popup-block"><h3>${esc(block.title)}${block.sub ? `<span>${esc(block.sub)}</span>` : ''}</h3>${block.html}</section>`).join('')}${model.missing ? '<p class="rule-popup-note">Блок справочника недоступен. Выше приведено пояснение к выбранному замечанию.</p>' : ''}`;
    const sources = [...new Set(model.blocks.map(block => block.section))];
    popup.querySelector('.rule-popup-foot').textContent = model.kind === 'dictionary' ? 'Орфографический словарь SCI · словарное сопоставление' : sources.length ? `Справочник · ${sources.join(' · ')}` : model.kind === 'typing' ? 'Проверка ввода' : 'Пояснение к проверке';
    popup.querySelector('.rule-popup-scroll').scrollTop = 0;
    if (!popup.open) popup.showModal();
    popup.querySelector('.rule-popup-close').focus({preventScroll:true});
    return true;
  }

  window.RULE_POPUP = Object.freeze({open, resolve, close:() => dialog?.open && dialog.close()});
})();
