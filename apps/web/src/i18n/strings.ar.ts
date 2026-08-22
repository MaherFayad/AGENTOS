/* =============================================================================
 * i18n/strings.ar.ts — Modern Standard Arabic.
 *
 * Owner: rtl-arabic-pdpl-specialist · Spec §1.4 ("MSA labels stay noun-form, no
 * italics in Arabic — use weight contrast instead").
 *
 * This is a rewrite, not a translation. The English voice is terse, confident
 * and contemptuous of manual work; the Arabic has to be the same person
 * speaking, not a dictionary standing in for them. Where a line depends on an
 * English rhythm that MSA does not have, it is `todo()` — the English shows,
 * the gap is countable, and a native reviewer fixes it in one pass.
 *
 * THE REGISTER: nominal and formal. Interface labels are verbal nouns
 * (masdar) — تشغيل / جدولة / إرسال / اختيار — never imperatives
 * (شغّل / جدوِل / أرسِل / اختر). Running prose inside empty states and
 * descriptions may use verbs, because it is prose and a person is speaking.
 *
 * THE TYPOGRAPHY (enforced in apps/web/src/styles/rtl.css, not here):
 *   - No italic. Arabic has no italic form; faux-obliquing it is the single
 *     most obvious tell that a design was translated rather than made. The
 *     `[[accent]]` phrase renders as WEIGHT contrast in Arabic.
 *   - No letter-spacing. Arabic is a connected script and tracking severs the
 *     joins. Wide-tracked Latin labels become size + weight + word-spacing.
 *   - Western digits with tabular-nums, isolated LTR inside the RTL line.
 * ============================================================================= */

import { todo, type EntryFor } from './entry';
import type { en, StringKey } from './strings.en';

type Catalog = { readonly [K in StringKey]: EntryFor<(typeof en)[K]> };

export const ar: Catalog = {
  /* §2.0 App shell ---------------------------------------------------------- */
  'shell.tab.map': 'الخريطة',
  'shell.tab.dashboards': 'اللوحات',
  'shell.tab.chart': 'المخطّط',
  /* `المحادثات` — conversations, the term Arabic UI uses for message threads. Chosen by
     `shell-navigation-engineer` with the M16 rename and routed to
     `rtl-arabic-pdpl-specialist`, who owns this catalogue's wording; `السلاسل` is the
     literal "chains" and reads as a data structure rather than a place. */
  'shell.tab.threads': 'المحادثات',

  'shell.search.jobs': 'البحث في المهامّ',
  'shell.search.panels': 'البحث في اللوحات',
  'shell.search.label': 'البحث',

  'shell.eyebrow.navigation': 'التنقّل',
  'shell.action.newSession': 'جلسة جديدة',
  'shell.action.fullscreen': 'ملء الشاشة',
  'shell.action.exitFullscreen': 'الخروج من ملء الشاشة',
  'shell.action.help': 'المساعدة',
  'shell.action.close': 'إغلاق',
  'shell.action.back': 'رجوع',

  'shell.zoom.in': 'تكبير',
  'shell.zoom.out': 'تصغير',
  'shell.zoom.level': '{percent}%',

  'shell.status.online': 'شبكة Tailnet متّصلة',
  'shell.status.offline': 'شبكة Tailnet غير متاحة',
  'shell.status.queue': {
    zero: 'المشغّل خامل',
    one: 'عملية تشغيل واحدة في الانتظار',
    two: 'عمليتا تشغيل في الانتظار',
    few: '{count} عمليات تشغيل في الانتظار',
    many: '{count} عملية تشغيل في الانتظار',
    other: '{count} عملية تشغيل في الانتظار',
  },
  'shell.cost.today': '{amount} اليوم',

  /* مؤشّر الكلفة — القراءات الخمس وثلاث حالات لغياب القراءة.
   * الصيغة اسميّة: «تعذّر» و«غير معروف» بدل صيغة الأمر. */
  'shell.cost.state.unpriced': 'بلا تسعير',
  'shell.cost.state.outage': 'الإنفاق غير معروف',
  'shell.cost.state.noLedger': 'لا سجلّ',
  'shell.cost.state.unavailable': 'لا بيانات كلفة',
  'shell.cost.loading': 'جارٍ قراءة إنفاق الوكلاء اليوم.',
  'shell.cost.amount': 'إنفاق الوكلاء حتى الآن اليوم: {amount}.',
  'shell.cost.zero':
    'لم تُسجَّل أيّ عملية تشغيل اليوم، فلم يُنفَق شيء. سجلّ التشغيل متّصل، فهذا الصفر قراءة لا تخمين.',
  'shell.cost.unpriced':
    'سُجِّلت عمليات تشغيل اليوم ولا يحمل أيّ منها سعرًا بعد، فإنفاق اليوم غير معروف. وهذا ليس صفرًا.',
  'shell.cost.outage':
    'سجلّ التشغيل لا يستجيب، فإنفاق اليوم غير معروف — وليس صفرًا. التشغيل مستمرّ وسيُسجَّل فور عودة قاعدة البيانات.',
  'shell.cost.noLedger':
    'لا سجلّ تشغيل مهيّأ لهذا المشغّل، فلا إنفاق يُقرأ. هذا وضع طبيعي في ملفّ التطوير، لا خلل.',
  'shell.cost.notBuilt':
    'لا يُبلِغ Langfuse عن الإنفاق بعد، فلا رقم يُعرض هنا. سيمتلئ هذا الحقل مع أوّل عملية تشغيل تُرصَد.',
  'shell.cost.malformed':
    'وصل إنفاق اليوم بصيغة لا تفهمها هذه النسخة — وبدونها يتطابق الصفر الحقيقي مع انقطاع السجلّ، فلا يُعرض رقم. هذا خلل هنا، لا واقعة عن إنفاقك.',
  'shell.cost.offline': 'تعذّر الوصول إلى Langfuse لقراءة إنفاق اليوم. قد يكون هذا الجهاز خارج شبكة Tailnet.',

  'shell.status.malformed':
    'ردّ المشغّل بشيء لا تفهمه هذه النسخة، فحالته غير معروفة لا غير متّصلة.',
  'shell.search.graph.malformed':
    'وصل فهرس الوكلاء بصيغة لا تفهمها هذه النسخة، فالبحث فارغ لا خاطئ.',
  'shell.search.panels.malformed':
    'وصل فهرس اللوحات بصيغة لا تفهمها هذه النسخة، فالبحث فارغ لا خاطئ.',

  /* مبدّل المشاريع (`Plan §23.10`). الصيغة اسميّة: «تغيير المشروع» لا «غيّر».
   * «مقيَّد به» تترجم scoped to it بوصفها حالة، لا فعلًا يطلب من القارئ شيئًا. */
  'shell.project.none': 'لا مشروع',
  'shell.project.list': 'المشاريع',
  'shell.project.mounted': 'مثبَّت',
  'shell.project.elsewhere': 'في مكان آخر',
  'shell.project.title': 'المشروع {project}. كل ما على الشاشة مقيَّد به.',
  'shell.project.aria.confirmed': 'المشروع: {project}. مؤكَّد من المشغّل. تغيير المشروع.',
  'shell.project.aria.unconfirmed': 'المشروع: {project}. غير مؤكَّد من المشغّل. تغيير المشروع.',
  'shell.project.empty':
    'لم يذكر المشغّل أيّ مشروع. لا شيء هنا تخمين — يعرض المبدّل ما قيل له وحسب.',
  'shell.project.onlyOne':
    'مشروع واحد مثبَّت. لا شيء آخر ينتقل إليه التبديل، فلا شيء هنا يُثبت أنّ تقييد المشاريع يعمل — بل يُثبت أنّه موجود فقط.',
  'shell.project.isolationOff':
    'يفيد المشغّل بأنّ اتّصاله بقاعدة البيانات يتجاوز أمن مستوى الصفوف، فعزل المشاريع غير مطبَّق تحت هذه الأسماء.',
  'shell.project.isolationUnknown': 'لم يذكر المشغّل ما إذا كان عزل المشاريع مطبَّقًا.',

  'shell.breadcrumb.allDepartments': 'كل الأقسام',
  'shell.counter.live': '{live} من {total} قيد التشغيل',
  'shell.counter.yourTree': 'شجرتك',
  'shell.counter.yourTree.hint': 'عرض الوكلاء المثبَّتين وقيد التشغيل فقط.',

  /* §2.1–2.2 MAP ------------------------------------------------------------ */
  'map.department.previous': 'القسم السابق',
  'map.department.next': 'القسم التالي',
  'map.node.state.live': 'قيد التشغيل',
  'map.node.state.draft': 'مسوّدة',
  'map.node.state.failing': 'متعطّل',
  'map.node.state.dormant': 'خامل',
  'map.node.state.scheduled': 'مجدول',
  'map.node.state.awaitingApproval': 'بانتظار الموافقة',
  'map.node.open': 'فتح {name}',

  'map.empty.title': 'لم تُبنَ المجرّة بعد',
  'map.empty.notBuilt':
    'لم يُبنَ مخطّط الخريطة بعد. شغّل {command} — وحتى ذلك الحين تبقى المجرّة فارغة عن قصد.',
  'map.empty.malformed': 'مخطّط الخريطة ليس حمولة رسم بياني، فلا شيء يُرسَم.',
  'map.empty.offline': 'تعذّر الوصول إلى المشغّل، فلا خريطة تُرسَم.',
  'map.focus.previous': 'التركيز على القسم السابق',
  'map.focus.next': 'التركيز على القسم التالي',

  /* §3.3 الدماغ الثاني عند الصفر. الأرقام غربيّة ومعزولة LTR داخل السطر. */
  'map.brain.eyebrow': 'الدماغ الثاني',
  'map.brain.count': {
    one: 'سؤال واحد مُجاب من {total}',
    two: 'سؤالان مُجابان من {total}',
    few: '{answered} أسئلة مُجابة من {total}',
    many: '{answered} سؤالًا مُجابًا من {total}',
    other: '{answered} من {total} سؤال مُجاب',
  },
  'map.brain.noCount': 'لا إجابات مقابلة بعد',
  'map.brain.hint': 'شغّل مقابلة الشركة — تمتلئ المجرّة كلّما وصلت الإجابات',
  'map.brain.aria': {
    one: 'الدماغ الثاني، سؤال واحد مُجاب من {total}. شغّل مقابلة الشركة لملء المجرّة.',
    two: 'الدماغ الثاني، سؤالان مُجابان من {total}. شغّل مقابلة الشركة لملء المجرّة.',
    few: 'الدماغ الثاني، {answered} أسئلة مُجابة من {total}. شغّل مقابلة الشركة لملء المجرّة.',
    many: 'الدماغ الثاني، {answered} سؤالًا مُجابًا من {total}. شغّل مقابلة الشركة لملء المجرّة.',
    other: 'الدماغ الثاني، {answered} من {total} سؤال مُجاب. شغّل مقابلة الشركة لملء المجرّة.',
  },
  'map.brain.aria.noCount': 'الدماغ الثاني، لا إجابات مقابلة بعد. شغّل مقابلة الشركة لملء المجرّة.',

  'map.node.aria.branch': 'فرع قسم',
  'map.node.aria.live': 'قيد التشغيل',
  'map.node.aria.failing': 'متعطّل في التدقيق',
  'map.node.aria.dormant': 'خامل، ليس قيد التشغيل بعد',
  'map.node.aria.scheduled': 'مجدول',
  'map.node.aria.awaitingApproval': 'بانتظار الموافقة',
  'a11y.galaxyGroup': 'مجرّة الوكلاء',

  /* §2.3 / §2.6.5 Drawers --------------------------------------------------- */
  'drawer.section.breaksInto': 'التفرّعات',
  'drawer.section.wiredInto': 'الأدوات الموصولة',
  'drawer.section.buildsOn': 'المتطلّبات السابقة',
  'drawer.section.replaces': 'ما يحلّ محلّه',
  'drawer.section.ladder': 'السلّم',
  'drawer.section.theHuman': 'الإنسان',
  'drawer.section.lastRuns': 'آخر عمليات التشغيل',
  'drawer.section.inputs': 'المدخلات',
  'drawer.section.skills': 'المهارات',
  'drawer.section.tools': 'الأدوات',
  'drawer.section.whatItDoes': 'ما يفعله',
  'drawer.section.howToRunIt': 'طريقة التشغيل',
  'drawer.section.fromManualToAutonomous': 'من اليدوي إلى الذاتي',

  'drawer.skillFile.available': {
    one: 'ملفّ مهارة واحد قابل للتشغيل · لك أن تنزّله',
    two: 'ملفّا مهارة قابلان للتشغيل · لك أن تنزّلهما',
    few: '{count} ملفّات مهارات قابلة للتشغيل · لك أن تنزّلها',
    many: '{count} ملفّ مهارة قابل للتشغيل · لك أن تنزّله',
    other: '{count} ملفّ مهارة قابل للتشغيل · لك أن تنزّله',
  },
  // TODO(ar): "Take it" is an English idiom for "this is yours, download it".
  // تنزيل duplicates drawer.action.download and loses the gift. A native
  // reviewer picks the phrase; until then the English shows and is countable.
  'drawer.action.take': todo('Take it'),
  'drawer.action.run': 'تشغيل الآن',
  'drawer.action.schedule': 'جدولة',
  'drawer.action.read': 'قراءة',
  'drawer.action.download': 'تنزيل',
  'drawer.action.moreDetail': 'تفاصيل أكثر',
  'drawer.action.close': 'إغلاق',
  'drawer.empty.loading': 'جارٍ تحميل هذا الوكيل…',
  'drawer.empty.missing': 'تعذّر تحميل هذا الوكيل.',

  /* المقدّمات الثلاث لأيّ قسم أخفق. الأولى منقولة حرفيًّا عن `work.failed` المتقاعد، لأنّ
   * صياغتها كانت صحيحة وإنّما كان الفرع الذي يختارها خاطئًا: كان القسمان يفتتحان بها كلّ
   * إخفاق، والمشغّل يُجيب فعلًا بـ 503 ثمّ تُطبع كلماته تحتها فتناقضها. */
  'drawer.failure.unreachable': 'تعذّر الوصول إلى المشغّل، فهذه القائمة فارغة بدل أن تكون خاطئة.',
  'drawer.failure.refused':
    'أجاب المشغّل، لكنّه لم يستطع إنتاج هذه القائمة. لا يُعرض شيء بدل أن يُختلق شيء.',
  'drawer.failure.unreadable':
    'أجاب المشغّل، لكن بصيغة لا تقدر هذه النسخة على قراءتها. لا يُعرض شيء بدل أن يُختلق شيء.',
  'drawer.ladder.now': 'الآن',
  'drawer.console.title': 'المخرجات',
  'drawer.console.running': 'قيد التشغيل',
  'drawer.console.finished': 'انتهى خلال {duration}',
  'drawer.inputs.required': 'مطلوب',
  'drawer.inputs.submit': 'التشغيل بهذه المدخلات',

  'tier.human-led': 'قيادة بشرية',
  'tier.assisted': 'مساعدة بشرية',
  'tier.autonomous': 'تشغيل ذاتي كامل',
  'tier.human-led.blurb': 'يقودها إنسان.',
  'tier.assisted.blurb': 'يكتب الذكاء الاصطناعي المسوّدة، ويوافق عليها إنسان.',
  'tier.autonomous.blurb': 'يشغّلها الذكاء الاصطناعي دون إشراف.',

  'phase.1-foundation': 'التأسيس',
  'phase.2-capture': 'الالتقاط',
  'phase.3-generate': 'التوليد',
  'phase.4-orchestrate': 'التنسيق',
  'phase.1-foundation.blurb': 'البيانات ودماغ الشركة',
  'phase.2-capture.blurb': 'تصنيف واستخراج وتقييم',
  'phase.3-generate.blurb': 'إنتاج العمل واتّخاذ الإجراء',
  'phase.4-orchestrate.blurb': 'وكلاء ومراقبة وحلقات',

  /* §2.4–2.5 DASHBOARDS ----------------------------------------------------- */
  'dashboards.eyebrow': 'طبقة المخرجات',
  'dashboards.title': 'مراكز القيادة',
  // The accent phrase carries the same emphasis as the Latin serif italic —
  // rendered as weight contrast, never obliqued (§1.4).
  'dashboards.subtitle': 'شكل كل قسم [[حين يُدير العمل نفسه]].',
  'dashboards.carousel.previous': 'مركز القيادة السابق',
  'dashboards.carousel.next': 'مركز القيادة التالي',
  'dashboards.widget.updated': 'آخر تحديث {time}',
  'dashboards.widget.source.langfuse': 'من آثار التشغيل',
  'dashboards.widget.source.sql': 'من صفوف مخرجات الوكلاء',

  /* §2.6 CHART -------------------------------------------------------------- */
  'chart.title': '{department} · نشر الذكاء الاصطناعي',
  'chart.stats':
    '{autonomous} من {total} مهمّة تعمل ذاتيًا، و{assisted} بمساعدة بشرية، والباقي يبقى بشريًا.',
  'chart.row.jobCount': {
    zero: 'لا مهامّ',
    one: 'مهمّة واحدة',
    two: 'مهمّتان',
    few: '{count} مهامّ',
    many: '{count} مهمّة',
    other: '{count} مهمّة',
  },
  'chart.card.expand': 'توسيع {name}',
  'chart.card.collapse': 'طيّ {name}',
  'chart.phaseTag': '{index} · {phase}',

  /* THREADS — the fourth tab (`Plan §23.5`, `Plan §23.8`) --------------------
   *
   * The three `threads.mount.*` scaffold keys are gone with `ThreadsMount.tsx`.
   * `المحادثات` is kept as the term for a thread — chosen with the tab rename,
   * over the literal `السلاسل`, which reads as a data structure and not a place.
   *
   * WRITTEN OUT RATHER THAN `todo()`d, and that was not optional: `i18n.test.ts`
   * caps the untranslated set at five keys for the whole app, and this surface
   * alone is thirty. §23.11 rule 6 also asks that a new surface be
   * Arabic-reviewed *before* it ships rather than after. **The wording is
   * `rtl-arabic-pdpl-specialist`'s to correct — it is routed to them, not
   * assumed to be finished.**
   *
   * TWO TERMS OF ART, PICKED ONCE AND USED THROUGHOUT:
   *   الإرسال الجماعي   fan-out (`@@`) — "collective sending". Not `بثّ`
   *                     (broadcast), which reads as one-to-many *listening* and
   *                     loses that each member answers independently and costs
   *                     its own run.
   *   عملية تشغيل        a run. The unit of money in this product, so it keeps
   *                     the same phrase as the runner's copy elsewhere.
   *
   * The plural of `threads.fanout.count` uses all six CLDR classes. English gets
   * away with one/other here; Arabic does not, and this is the one string in the
   * product where the number is the whole point of the sentence.
   *
   * NO CURRENCY IN ANY OF THESE, in either language. `i18n.test.ts` fails on a
   * currency symbol under `threads.` — the count is real and the money is not. */
  'threads.eyebrow': 'المحادثات',
  'threads.billing':
    'الجلسة محسوبة على اشتراكك في Claude. أمّا عمليات تشغيل محادثة الوكيل فمحسوبة على مساحة المشغّل المحدودة بسقف. حسابان مختلفان.',

  'threads.group.agent': 'محادثات الوكلاء',
  /* ADR-042 session: the thread list route landed, so `threads.agent.unreadable` — which
     said no such route existed — is gone from both catalogues. These describe states that
     can now actually occur. No plural key: see the English catalogue on why a label and a
     bare numeral are used instead of an inflected count. */
  'threads.agent.empty':
    '\u2068لا توجد محادثات وكلاء بعد. وجّه واحدة أدناه — \u2068@design/product-designer\u2069 لوكيل واحد، أو \u2068#design\u2069 للقسم كله.\u2069',
  'threads.agent.loading': 'جارٍ قراءة المحادثات…',
  'threads.agent.notBuilt':
    'الخادم لا يقدّم قائمة المحادثات على هذا الجهاز. لم يُفقد شيء — المحادثات مخزّنة في Postgres، وهذه مشكلة وصول لا محادثة مفقودة.',
  'threads.agent.malformed':
    'أجابت قائمة المحادثات بصيغة لا يعرفها هذا الإصدار. هذا اختلاف في العقد بين الخادم والتطبيق، وليس خطأً منك.',
  'threads.agent.offline':
    'تعذّر الوصول إلى الخادم، لذلك لا يمكن سرد محادثات الوكلاء. قد يكون هذا الجهاز خارج شبكة tailnet.',
  'threads.agent.noProject': 'لم يُحدَّد أي مشروع، فلا توجد محادثات لعرضها.',
  'threads.agent.turnsLabel': 'الأدوار',
  'threads.agent.truncated': 'يُعرض \u2068{shown}\u2069 من \u2068{total}\u2069.',

  'threads.compose.label': 'محادثة جديدة',
  /* THE SIGIL RUN IS ISOLATED, AND THE PREVIOUS NOTE HERE WAS WRONG TWICE.
   *
   * It said no isolation was needed and that the field is `dir="auto"` "by virtue
   * of being a textarea". A textarea is not `dir="auto"` by default, and with the
   * root at `dir="rtl"` an empty field takes the parent's direction, so this
   * placeholder is laid out in an RTL paragraph.
   *
   * MEASURED IN CHROME, per character, with `Range.getBoundingClientRect()` —
   * not derived from UAX #9 and not assumed. Written bare, the visual line is:
   *
   *     … أو اكتب من دون عنوان — design/product-designer · #design · @@design@
   *
   * The leading `@` is a bidi-NEUTRAL at the start of the paragraph (sor = R),
   * so it takes the paragraph's own direction and detaches — it lands at the far
   * end of the Latin block, where it reads as a trailing character on `@@sales`.
   * `@sales` loses its sigil and `@@sales` appears to grow one, in the single
   * field where `@` vs `#` vs `@@` is the entire grammar and the difference
   * between one run and N. The same measurement with U+2068 … U+2069 returns
   * the line intact.
   *
   * U+2068 FIRST STRONG ISOLATE / U+2069 POP, as `\u`-escapes rather than typed
   * invisibles: the same pair `format.ts`'s `isolate()` puts around every
   * interpolated value, so the product has one isolation idiom and not two. Typed
   * invisibly they are the characters a later editor deletes without seeing.
   * `i18n.test.ts` → "isolates a sigil that starts a Latin run" is the gate. */
  'threads.compose.placeholder':
    '\u2068@design/product-designer · #design · @@design\u2069 — أو اكتب من دون عنوان',
  'threads.compose.send': 'إرسال',
  'threads.compose.review': 'مراجعة الإرسال الجماعي',
  /* Nominal, not interrogative (§1.4: MSA labels stay noun-form). Its sibling in
     the mailbox composer is the same phrase, shortened the way English shortens
     "How this message lands" to "How it lands". */
  'threads.compose.levelLabel': 'كيفية وصول هذه الرسالة',
  'threads.compose.unknownDepartment':
    'لا يوجد في خريطة هذا المشروع قسم باسم {name}. الإرسال مسموح على أيّ حال — المشغّل هو من يحلّ العناوين، وهذه القائمة قد تكون قديمة.',
  'threads.compose.noProject':
    'هذا العنوان لا يسمّي مشروعًا، والمحادثة تنتمي إلى مشروع. افتحها من مبدّل المشاريع ليتمّ الإرسال.',
  'threads.compose.offline':
    'تعذّر الوصول إلى المشغّل، فلم يُرسَل شيء. قد يكون هذا الجهاز خارج شبكة Tailnet.',
  'threads.compose.refusedFallback': 'رفض المشغّل هذا الطلب ولم يذكر السبب.',
  'threads.compose.malformed':
    'أُنشئت المحادثة وعاد الجواب بشكل لا تفهمه هذه النسخة، فلا مكان لتوجيهك إليه. هذا خلل هنا.',

  'threads.fanout.eyebrow': 'تأكيد الإرسال الجماعي',
  'threads.fanout.count': {
    one: 'هذا يخاطب {name}، وفيه عضو واحد. أي عملية تشغيل واحدة، لكلّ عضو واحدة.',
    two: 'هذا يخاطب {name}، وفيه عضوان. أي عمليّتا تشغيل، لكلّ عضو واحدة.',
    few: 'هذا يخاطب {name}، وفيه {count} أعضاء. أي {count} عمليات تشغيل، لكلّ عضو واحدة.',
    many: 'هذا يخاطب {name}، وفيه {count} عضوًا. أي {count} عملية تشغيل، لكلّ عضو واحدة.',
    other: 'هذا يخاطب {name}، وفيه {count} عضو. أي {count} عملية تشغيل، لكلّ عضو واحدة.',
  },
  'threads.fanout.countUnknown':
    'هذا يخاطب كلّ أعضاء {name} ويبدأ عملية تشغيل لكلّ واحد منهم. عدد الأعضاء لم يُحصَ هنا، فلا يُعرض أيّ رقم.',
  'threads.fanout.refused':
    'لن تبدأ أيّ عملية تشغيل اليوم: الإرسال الجماعي موقوف حتى يُثبت سقف الإنفاق قدرته على الرفض، ولم يُفعَّل قطّ. تُفتح المحادثة على أيّ حال، ويرافقها الرفض. يُرفع الحجب بـ: {unblockedBy}.',
  'threads.fanout.cancel': 'إلغاء',
  'threads.fanout.open': 'فتح المحادثة',

  'threads.one.eyebrow': 'محادثة',
  'threads.one.loading': 'جارٍ قراءة المحادثة…',
  'threads.one.unavailableTitle': 'لا شيء لعرضه',
  'threads.one.notFound':
    'لا توجد محادثة بهذا المُعرِّف في هذا المشروع. ومُعرِّف محادثة من مشروع آخر يُقرأ بالطريقة نفسها، عن قصد.',
  'threads.one.malformed':
    'عادت المحادثة بشكل لا تفهمه هذه النسخة. المشغّل وهذا التطبيق غير متوافقين — وهذا خلل هنا، لا محادثة مفقودة.',
  'threads.one.offline':
    'تعذّر الوصول إلى المشغّل، فلا يمكن قراءة هذه المحادثة. قد يكون هذا الجهاز خارج شبكة Tailnet.',
  'threads.one.noProject':
    'هذا العنوان لا يسمّي مشروعًا، وكلّ محادثة تنتمي إلى مشروع. افتحها من مبدّل المشاريع.',
  'threads.one.emptyTitle': 'لا مداخلات بعد',
  'threads.one.empty': 'المحادثة موجودة ولم يُقَل فيها شيء.',
  /* «صندوق البريد», not «صندوق الوارد». The mailbox is one object with one name,
     and this row was the only place calling it an *inbox* — three other strings
     (`a11y.threads.interrupt.note`, both mailbox dispositions) already say
     البريد. Two names for one mechanism is the translated-not-made tell. */
  'threads.one.inMailbox': 'ما زالت في صندوق البريد',

  'threads.state.open': 'مفتوحة',
  'threads.state.running': 'قيد التشغيل',
  'threads.state.waiting': 'بانتظارك',
  'threads.state.closed': 'مغلقة',
  'threads.state.failed': 'فاشلة',

  'threads.kind.human': 'أنت',
  'threads.kind.agent': 'وكيل',
  'threads.kind.question': 'سؤال',
  'threads.kind.answer': 'إجابة',
  'threads.kind.system': 'النظام',

  /* §3.1 SESSIONS — now the session group inside THREADS --------------------- */
  'sessions.state.working': 'قيد العمل',
  'sessions.state.awaitingPermission': 'بانتظار إذن',
  'sessions.state.idle': 'خاملة',
  'sessions.permission.title': 'مطلوب إذن',
  'sessions.permission.body': '{session} تطلب استخدام {tool}.',
  'sessions.permission.allow': 'سماح',
  'sessions.permission.deny': 'رفض',
  'sessions.compose.placeholder': 'توجيه الجلسة',
  'sessions.compose.send': 'إرسال',
  'sessions.meta.elapsed': 'قيد التشغيل منذ {duration}',

  // «المُرحِّل» is the relay throughout this section — one term per concept, so
  // the gate, the list and the transcript are talking about the same thing.
  'sessions.eyebrow': 'الجلسات',
  'sessions.waiting': {
    one: 'جلسة واحدة بانتظارك',
    two: 'جلستان بانتظارك',
    few: '{count} جلسات بانتظارك',
    many: '{count} جلسة بانتظارك',
    other: '{count} جلسة بانتظارك',
  },
  'sessions.billing': 'محسوبة على اشتراكك في Claude، لا على السقف الشهري للمشغّل.',
  'sessions.list.loading': 'جارٍ قراءة المُرحِّل…',
  'sessions.list.undecryptable': {
    one: 'تعذّر فكّ تشفير جلسة واحدة على المُرحِّل بمفتاح هذا الجهاز.',
    two: 'تعذّر فكّ تشفير جلستين على المُرحِّل بمفتاح هذا الجهاز.',
    few: 'تعذّر فكّ تشفير {count} جلسات على المُرحِّل بمفتاح هذا الجهاز.',
    many: 'تعذّر فكّ تشفير {count} جلسة على المُرحِّل بمفتاح هذا الجهاز.',
    other: 'تعذّر فكّ تشفير {count} جلسة على المُرحِّل بمفتاح هذا الجهاز.',
  },

  'sessions.view.back': 'الجلسات',
  'sessions.view.title': 'الجلسة',
  'sessions.view.meta': '{id} · محسوبة على اشتراكك في Claude',
  'sessions.connection.connecting': 'جارٍ الاتّصال بالجلسة…',
  'sessions.connection.reconnecting': 'جارٍ إعادة الاتّصال. ما تراه هو كلّ شيء حتّى لحظة الانقطاع.',
  'sessions.connection.offline': 'غير متّصل. هذا نصّ الجلسة كما كان عند آخر اتّصال.',
  'sessions.transcript.label': 'نصّ الجلسة',
  'sessions.transcript.gap':
    'فاتت بعض الأسطر بينما كان هذا الجهاز غير متّصل، وكان مخزن الإعادة في المُرحِّل قد تجاوزها.',
  'sessions.transcript.permission': 'إذن · {tool} · {summary}',
  'sessions.compose.label': 'مراسلة هذه الجلسة',
  'sessions.permission.eyebrow': 'بانتظارك',

  'sessions.push.enable': 'تنبيه هذا الهاتف',
  'sessions.push.enabled': 'الإشعارات مفعّلة',
  'sessions.push.names': 'إظهار أسماء الجلسات على شاشة القفل',
  'sessions.push.failed': 'تعذّر تفعيل الإشعارات.',

  'sessions.gate.title': 'فتح جلساتك',
  'sessions.gate.body':
    'نصوص الجلسات مشفّرة من طرف إلى طرف. الصق مفتاح الاسترجاع الذي يطبعه {command} على الجهاز الذي يعمل عليه Claude Code، وسيفكّ هذا المتصفّح تشفيرها محلّيًا.',
  'sessions.gate.secret': 'مفتاح الاسترجاع',
  'sessions.gate.token': 'رمز اقتران المُرحِّل',
  'sessions.gate.tokenHint': 'رمز المُرحِّل، اختياري الآن',
  'sessions.gate.unlock': 'فتح القفل',
  'sessions.gate.note':
    'يُشتقّ المفتاح هنا ويُخزَّن في هذا المتصفّح وحده. لا يُرسَل إلى المُرحِّل، ولا يُكتَب في أيّ سجلّ، ولا يمكن لأيّ نصّ برمجيّ في هذه الصفحة تصديره.',

  /* §3.2 Runs --------------------------------------------------------------- */
  'run.state.queued': 'في الانتظار',
  'run.state.running': 'قيد التشغيل',
  'run.state.succeeded': 'ناجح',
  'run.state.failed': 'فاشل',
  'run.state.awaitingApproval': 'بانتظار موافقتك',
  'run.approval.approve': 'موافقة',
  'run.approval.reject': 'رفض',
  'run.schedule.next': 'التشغيل التالي {time}',
  'run.schedule.none': 'بلا جدولة',
  'run.error.generic': 'توقّف التشغيل قبل أن ينتهي. السبب موجود في الأثر.',
  'run.error.offline': 'المشغّل غير متاح. لم يضِع شيء؛ أعد المحاولة حين تعود الشبكة.',

  /* Empty states ------------------------------------------------------------ */
  'empty.library.title': 'المكتبة فارغة',
  'empty.library.body': 'وجّه أداة الاستيراد إلى مستودع، وترسم الخريطة نفسها من البيانات الوصفية.',

  'empty.department.title': 'لا شيء يعمل في هذا القسم بعد',
  'empty.department.body':
    'كل مهمّة هنا ما زالت تُؤدّى يدويًا. هذه هي قائمة الانتظار، وتستحقّ أن تُقرأ على هذا الأساس.',

  'empty.runs.title': 'لم يُشغَّل هذا الوكيل قطّ',
  'empty.runs.body': 'أوّل تشغيل يضع تكلفته ومدّته ورابط أثره هنا.',

  'empty.search.title': 'لا نتائج لـ «{query}»',
  'empty.search.body': {
    zero: 'المكتبة فارغة، فلا شيء ليطابق.',
    one: 'تضمّ المكتبة وكيلًا واحدًا، وهو لا يستجيب لذلك.',
    two: 'تضمّ المكتبة وكيلين، ولا يستجيب أيٌّ منهما لذلك.',
    few: 'تضمّ المكتبة {count} وكلاء، ولا يستجيب أيٌّ منهم لذلك.',
    many: 'تضمّ المكتبة {count} وكيلًا، ولا يستجيب أيٌّ منهم لذلك.',
    other: 'تضمّ المكتبة {count} وكيل، ولا يستجيب أيٌّ منهم لذلك.',
  },

  'empty.panels.title': 'لا مراكز قيادة بعد',
  'empty.panels.body': 'اللوحة ملفّ JSON في مجلّد panels/. اكتب واحدًا فيظهر في العرض الدوّار.',

  'empty.widget.title': 'لا بيانات بعد',
  'empty.widget.body': 'ترسم هذه الأداة ما تكتبه الوكلاء، ولن تخترع رقمًا لتملأ الفراغ.',

  'empty.chartCell.title': 'لا شيء في هذا المستوى وهذه المرحلة',
  'empty.chartCell.body': 'الخانة الفارغة جواب حقيقي: لم تُرسم هنا أيّ مهمّة بعد.',

  'empty.sessions.title': 'لا شيء يعمل الآن',
  'empty.sessions.body':
    'ابدأ جلسة Claude Code على أيّ جهاز مقترن بهذا المُرحِّل فتظهر هنا، بنصّها وبزرّ يجيب عن طلبات الإذن أينما كنت.',

  'empty.relay.title': 'لا جواب من المُرحِّل',
  'empty.relay.body':
    'لم يضِع شيء. الجلسات ما زالت على أجهزتها، وتمتلئ هذه القائمة فور أن يجيب المُرحِّل.',

  'empty.transcript.title': 'لا شيء بعد',
  'empty.transcript.body': 'لم تقل هذه الجلسة شيئًا منذ أن بدأت. اكتب في الأسفل لتوجيهها.',

  'empty.audit.title': 'لم يجرِ أيّ تدقيق',
  'empty.audit.body': 'يمشي المدقّق على المستودع والآثار، ثمّ يعلّم الخريطة. يستغرق ذلك دقيقة تقريبًا.',

  'empty.brain.title': 'دماغ الشركة فارغ',
  'empty.brain.body': 'شغّل المقابلة. عشرون سؤالًا مرّة واحدة أرخص من شرح نفسك لكلّ وكيل إلى الأبد.',

  'empty.inputs.title': 'لا مدخلات لهذا الوكيل',
  'empty.inputs.body': 'اضغط تشغيل. هو يعرف أين يبحث.',

  /* Provenance (Plan §10) ---------------------------------------------------
   * Filed by design-system-guardian as `todo()` and correctly so — fork, drift
   * and orphan are terms of art in a cascade nobody has shipped, and the MSA
   * noun is a register decision, not a lookup. Answered 2026-08-17 by the owner.
   *
   * The register choices, written down so the next person does not re-litigate:
   *   fork      → «نسخة متفرّعة» (a branched copy), not «شوكة». The Latin metaphor
   *               is a garden fork; the Arabic technical register has no such
   *               idiom and importing it is the textual equivalent of a faux
   *               italic — obviously translated rather than written.
   *   drifted   → «متباعدة» (grown apart), which keeps the sense of distance from
   *               the parent rather than of error. A drifted fork is not broken.
   *   orphaned  → «يتيمة». The metaphor exists in MSA technical usage and carries
   *               the same finality, so this one does transfer.
   * Nominal throughout, and `{commit}` / `{parent}` stay Western-digit LTR runs
   * isolated inside the RTL line (format.ts `isolate`). -------------------- */
  'provenance.badge.global': 'عامّة',
  'provenance.badge.project': 'المشروع',
  'provenance.badge.fork': 'نسخة متفرّعة {commit}',
  'provenance.badge.drifted': 'نسخة متباعدة {commit}',
  'provenance.badge.orphaned': 'نسخة يتيمة {commit}',

  /* Accessibility ----------------------------------------------------------- */
  'a11y.provenance.global': 'مأخوذ من المكتبة العامّة.',
  'a11y.provenance.project': 'مأخوذ من مكتبة هذا المشروع.',
  'a11y.provenance.fork': 'متفرّع عن {parent} عند {commit}، ولا يزال مطابقًا لأصله.',
  'a11y.provenance.drifted': 'متفرّع عن {parent} عند {commit}. وقد تغيّر الأصل منذ ذلك الحين.',
  'a11y.provenance.orphaned': 'متفرّع عن {parent} عند {commit}. ولم يعد الأصل موجودًا.',

  /* The absence of provenance, filed as `todo()` by drawer-engineer 2026-08-17.
   *
   * Not a lookup, which is why it is not guessed here: the five keys above are
   * *answers* and this is the admission that there is none, so it has to sit in
   * the same register as them without borrowing any of their nouns — and the
   * long form names two causes whose MSA phrasing is a choice about how much of
   * our plumbing a reader should be shown. The English renders meanwhile and the
   * gap is countable, which is what `todo()` is for. Routed to
   * rtl-arabic-pdpl-specialist.
   *
   * The long form was **re-worded on 2026-08-17** and the Arabic must be written
   * against this version, not the previous one. It used to end *"the agent detail
   * this drawer reads does not carry it yet"*, which stopped being true when
   * `AgentDetail.sourceRef` shipped mid-M15 — a user-facing sentence asserting a
   * fact about our plumbing that had since changed. It now names both sources
   * that could have answered and says neither did, which is a statement about
   * this render rather than about the contract, and so cannot go stale the same
   * way. */
  'drawer.provenance.unknown': todo('Source unknown'),
  'a11y.provenance.unknown': todo(
    'Which library this agent came from is not known. The agent detail did not say, ' +
      'and no run of this agent has said either.',
  ),

  /* Plan §12 — threads. Added by design-system-guardian with the two monochrome
   * registers, and split deliberately rather than filed wholesale as `todo()`.
   *
   * WRITTEN HERE: the counts and the behaviour sentences. «عملية تشغيل» is already
   * this catalogue's word for a run (`shell.status.queue`), so reusing it is
   * consistency, not a guess, and the five plural classes are grammar rather than
   * taste. The behaviour sentences describe what each form and each level *does*
   * and never name it, which is what makes writing them now safe.
   *
   * THE THREE LEVEL NAMES ARE ALSO WRITTEN, AND THE LINE AGAINST §10.7's PRECEDENT
   * IS DRAWN ON PURPOSE. That precedent left five provenance terms as `todo()`
   * because they are METAPHORS with no Arabic technical idiom — «fork» is a garden
   * fork, and importing it is the textual equivalent of a faux italic.
   * `note` · `steer` · `halt` are not metaphors; they are three actions, and MSA
   * has a direct verbal noun for each. Guessing a metaphor and writing an ordinary
   * verbal noun are different acts, and only the first is what this file's header
   * warns against. `rtl-arabic-pdpl-specialist` owns the register and may overwrite
   * all three without a decision-request; a message is filed saying so.
   *
   * LEFT AS `todo()`: «Chief of Staff» ALONE. It is a role title, not a UI verb,
   * and it has at least three defensible renderings — رئيس الأركان is military,
   * رئيس الديوان is administrative, مدير المكتب is corporate — whose choice says
   * something about what this product thinks that agent IS. That is a company
   * decision, not a translation one. So `a11y.threads.address.default` was reworded
   * IN ENGLISH to describe the recipient rather than name it, and is written here:
   * choosing the title later must not force a rewrite of the sentence around it.
   *
   * «على الأقلّ» is postposed, so the lower-bound form is not the exact form plus
   * a prefix — which is also true of the mark that draws it. ------------------ */
  'threads.address.default': todo('Chief of Staff'),

  'threads.cost.runs': {
    zero: 'لا عمليات تشغيل',
    one: 'عملية تشغيل واحدة',
    two: 'عمليتا تشغيل',
    few: '{count} عمليات تشغيل',
    many: '{count} عملية تشغيل',
    other: '{count} عملية تشغيل',
  },
  'threads.cost.runsAtLeast': {
    one: 'عملية تشغيل واحدة على الأقلّ',
    two: 'عمليتا تشغيل على الأقلّ',
    few: '{count} عمليات تشغيل على الأقلّ',
    many: '{count} عملية تشغيل على الأقلّ',
    other: '{count} عملية تشغيل على الأقلّ',
  },
  'threads.cost.unresolved': 'لم تُحصَ عمليات التشغيل بعد',

  'threads.interrupt.note': 'ملاحظة',
  'threads.interrupt.steer': 'توجيه',
  'threads.interrupt.halt': 'إيقاف',

  'a11y.threads.address.direct': 'يذهب إلى {name}. عملية تشغيل واحدة، بالضبط.',
  'a11y.threads.address.dispatch':
    'يذهب إلى مسؤول {name}، فيجيب بنفسه أو يوكّل غيره — أي عملية تشغيل واحدة على الأقلّ.',
  'a11y.threads.address.fanout':
    'يذهب إلى كلّ عضو في {name}، ويجيب كلٌّ منهم على حدة. عملية تشغيل لكلّ واحد.',
  'a11y.threads.address.default':
    'بلا عنوان، فيذهب هذا إلى المستقبِل الافتراضي للمشروع، الذي يفرز أو يجيب أو يحوّل — أي عملية تشغيل واحدة على الأقلّ.',

  'a11y.threads.interrupt.note':
    'ينتظر هذا في صندوق البريد ويُقرأ عند أوّل فاصل بين أداة وأخرى. ولا يتعطّل شيء جارٍ.',
  'a11y.threads.interrupt.steer': 'يُحقَن هذا في الجلسة الجارية الآن ويغيّر مسارها أثناء العمل.',
  'a11y.threads.interrupt.halt': 'يوقف هذا العملَ، ويحفظ ما أُنجِز، ثمّ يسألك قبل المتابعة.',
  /* Reworded with its English pair: the old reason («لا شيء قيد التشغيل في هذا
   * الخيط») was thread-model §4.2's no-run-in-flight refusal, and this build refuses
   * every steer regardless. Only the first clause moved; the second is kept verbatim
   * because it was already right. */
  'a11y.threads.interrupt.undeliverable':
    'لا يمكن توجيه عملية تشغيل جارية في هذه النسخة، فسيُرفض هذا بدل أن يُدرَج في الانتظار.',

  /* The mailbox composer (`Plan §12`), added by `drawer-engineer`.
   *
   * WRITTEN, NOT `todo()`d — and the reason is a gate rather than a preference.
   * The first draft filed all seventeen as `todo()`, which took the untranslated
   * count from 3 to 20 against `i18n.test.ts`'s ceiling of 5. That test is right
   * and the draft was wrong: a ceiling exists so that "it is temporary" cannot
   * become how seventeen more untranslated strings arrive. Raising it to fit this
   * surface would have been a gate widened to fit the debt, and deleting the copy
   * to fit the gate would have deleted the honesty the surface is *for*.
   *
   * So the same line §10.7 and the register block above draw: these are ordinary
   * declarative sentences about a delivery mechanism, with no metaphor and no
   * English rhythm to lose — «سُلِّمت إلى عملية التشغيل الجارية» is what happened,
   * not a figure of speech. That is the case the header's `todo()` rule does not
   * cover, and it is a different act from guessing «fork».
   *
   * The register is `rtl-arabic-pdpl-specialist`'s and **all seventeen may be
   * overwritten without a decision-request**; an `fyi` says so. The one thing that
   * must survive any rewrite is the distinction in the two `disposition` lines: a
   * note that waits in the mailbox and a note handed to a live run are different
   * events, and one Arabic sentence for both is the silent downgrade this composer
   * exists to refuse, arriving in translation instead of in code.
   *
   * There is deliberately no key here for the steer refusal's reason: the composer
   * renders `a11y.threads.interrupt.undeliverable` above, already written.
   *
   * REVIEWED 2026-08-18 by `rtl-arabic-pdpl-specialist`, §23.11 rule 6. Four of the
   * seventeen changed, and the call to write them rather than file seventeen `todo()`s
   * was the right one — none of the four was a guess, all four were a word choice, and
   * a ceiling raised to admit seventeen placeholders would not have been recoverable.
   * What changed and why is on each line: `levelLabel` (وصول reads as *access*),
   * `emptyBody` (register), `noThread` (بثّ is the broadcast this file already
   * rejected), `appendState.failed` (a different root from the state badge). The
   * disposition pair is kept exactly as written — the distinction it draws is right
   * and it is the load-bearing one. */
  'threads.mailbox.bodyLabel': 'إرسال إلى هذه المحادثة',
  'threads.mailbox.bodyPlaceholder': 'ما الذي ينبغي أن يعرفه الوكيل؟',
  /* Was «طريقة الوصول», which in an Arabic interface reads as *access method* —
     وصول carries "access" at least as strongly as "arrival", and a label above a
     permission-shaped control is exactly where a reader takes the wrong one.
     Naming الرسالة disambiguates it, and it is now the same phrase as
     `threads.compose.levelLabel`, shortened as the English pair is. */
  'threads.mailbox.levelLabel': 'كيفية وصول الرسالة',
  'threads.mailbox.send': 'إرسال',
  'threads.mailbox.sending': 'جارٍ الإرسال…',
  /* Terser, and in the register the English keeps: a flat statement of a rule,
     not a description of a particular message's needs. */
  'threads.mailbox.emptyBody': 'لا رسالة بلا نصّ. لم يُرسَل شيء.',
  /* «تدفّق التشغيل», not «بثّ التشغيل». This file's own THREADS header rejects
     بثّ for exactly the reason it fails here — it reads as *broadcast*, one-to-many,
     which is the fan-out sense and not a stream. تدفّق is the stream. */
  'threads.mailbox.noThread':
    'لا يذكر تدفّق التشغيل المحادثةَ التي تنتمي إليها هذه العملية، فلا صندوق بريد يُخاطَب من هنا بعد.',

  /* The two sentences that carry the whole surface. «في انتظار الدور» is waiting
   * in a queue; «سُلِّمت» is handed over and received. Keep them distinct. */
  'threads.mailbox.disposition.queued':
    'في انتظار الدور داخل صندوق البريد. لم يقرأها أحد بعد — تقرأها عملية التشغيل التالية لهذه المحادثة.',
  'threads.mailbox.disposition.deliveredToRun':
    'سُلِّمت إلى عملية التشغيل الجارية، وتقرأها عند أوّل استدعاء أداة مكتمل.',

  /* Past tense throughout, exactly as in English: this is the state read *before*
   * the message was written, and a present-tense rendering here would undo the
   * `api-contracts.md` correction of 2026-08-18. */
  'threads.mailbox.appendState.open': 'كانت المحادثة مفتوحة عند إضافة هذه الرسالة.',
  'threads.mailbox.appendState.running': 'كانت المحادثة قيد التشغيل عند إضافة هذه الرسالة.',
  'threads.mailbox.appendState.waiting': 'كانت المحادثة تنتظر جوابًا عن سؤال عند إضافة هذه الرسالة.',
  'threads.mailbox.appendState.closed': 'كانت المحادثة مغلقة عند إضافة هذه الرسالة.',
  /* «فشلت», not «تعطّلت». The state a reader sees on the badge is
     `threads.state.failed` = «فاشلة»; a sentence about that state has to use the
     same root or it describes a different event (تعطّل is a breakdown, which is a
     cause and not the state). */
  'threads.mailbox.appendState.failed': 'كانت المحادثة قد فشلت عند إضافة هذه الرسالة.',
  'threads.mailbox.appendStateCaveat':
    'هذه هي الحالة المقروءة قبل كتابة الرسالة، لا الحالة بعدها.',
  'threads.mailbox.haltNotYetMoved':
    'الإيقاف لا ينقل المحادثة بنفسه. تقرؤه عملية التشغيل عند أوّل تفريغ لصندوق البريد، فتوقف الجلسة وتنقل المحادثة عندئذٍ.',

  /* M17 · `Plan §13` — مخرجات العمل وشاشة مراجعة الفروق والحكم.
   *
   * «مُسجَّل» مقابل «مُلاحَظ» هو التمييز الذي يحمله هذا الباب كلّه: قيمة كُتبت في
   * السجلّ ليست قيمة راقبها شيء وهي تحدث. الفعل المبني للمجهول مقصود في
   * `work.push.unknownWhy` و`work.recordedWhy` — لا فاعل، لأنّه لا فاعل. */
  'drawer.section.work': 'مخرجات العمل',
  'work.scopeNote':
    'أحدث مخرجات العمل في هذا المشروع. لا يحمل المسار مرشّحًا لكل وكيل، فهذه القائمة غير مقصورة على هذا الوكيل.',
  'work.filter.all': 'الكل',
  'work.filter.review': 'في انتظار المراجعة',
  'work.loading': 'جارٍ البحث عن مخرجات العمل…',
  'work.empty':
    'لم تترك أيّ عملية تشغيل مخرجات عمل. لم يُنفَّذ شيء بعد، ولا مشروع لديه مستودع مسحوب، فهذه القائمة فارغة لا مُرشَّحة.',
  'work.emptyReview': 'لا شيء ينتظر المراجعة.',
  /* `work.failed` و`work.unreadable` تقاعدا إلى `drawer.failure.*` — مفاتيح واحدة ومكوّن
     واحد لقسمَي «آخر عمليات التشغيل» و«مخرجات العمل» في التشريحين معًا. */
  'work.commits': {
    zero: 'لا إيداعات',
    one: 'إيداع واحد',
    two: 'إيداعان',
    few: '{count} إيداعات',
    many: '{count} إيداعًا',
    other: '{count} إيداع',
  },
  'work.files': {
    zero: 'لا ملفّات',
    one: 'ملفّ واحد',
    two: 'ملفّان',
    few: '{count} ملفّات',
    many: '{count} ملفًّا',
    other: '{count} ملفّ',
  },
  'work.lines': '+{insertions} −{deletions}',
  'work.push.local': 'لم يُرفَع',
  'work.push.pushed': 'مرفوع',
  'work.push.none': 'لا شيء للرفع',
  'work.push.unknown': 'حالة الرفع غير معروفة',
  'work.push.observedAt': 'فُحصت {time}.',
  'work.push.unknownWhy':
    'لم يُنظر قطّ فيما إذا كان هذا الفرع قد غادر الجهاز. وهذا ليس كعدم وجود ما يُرفَع.',
  'work.pr': 'طلب دمج {number}',
  'work.pr.open': 'طلب الدمج مفتوح',
  'work.pr.merged': 'طلب الدمج مدموج',
  'work.pr.closed': 'طلب الدمج مغلق',
  'work.pr.draft': 'طلب الدمج مسوّدة',
  'work.ci.pending': 'التكامل المستمر قيد الانتظار',
  'work.ci.passing': 'التكامل المستمر ناجح',
  'work.ci.failing': 'التكامل المستمر فاشل',
  'work.ci.unknown': 'حالة التكامل المستمر غير معروفة',
  'work.tests': {
    zero: 'لا اختبارات',
    one: 'نجح {passed} من اختبار واحد',
    two: 'نجح {passed} من اختبارين',
    few: 'نجح {passed} من {count} اختبارات',
    many: 'نجح {passed} من {count} اختبارًا',
    other: 'نجح {passed} من {count} اختبار',
  },
  'work.recorded': 'مُسجَّل',
  'work.recordedWhy':
    'لا شيء في هذا الإصدار يفتح طلب دمج أو يشغّل تكاملًا مستمرًّا أو يشغّل اختبارات. هذه القيمة كُتبت في السجلّ، ولم يراقب شيء هنا حدوثها.',
  'work.diffGone': 'أُزيلت شجرة العمل الخاصة بهذه العملية، فلم تعد فروقها قابلة للقراءة.',
  'work.blocked': 'متوقّفة — طرحت عليك سؤالًا',
  'work.review.open': 'مراجعة هذا التغيير',
  'work.thread.open': 'فتح المحادثة التي تنتمي إليها هذه العملية',

  'work.diff.title': 'المراجعة',
  'work.diff.close': 'إغلاق المراجعة',
  'work.diff.tree': 'الشجرة {sha}',
  'work.diff.loading': 'جارٍ قراءة الفروق…',
  'work.diff.empty': 'لم تغيّر هذه العملية أيّ ملفّ.',
  'work.diff.binary': 'ملفّ ثنائي. يُعلَّم ولا يُرسَل بايتاته أبدًا.',
  'work.diff.withheld': {
    zero: 'لم يُحجب أيّ سطر في هذا الملفّ.',
    one: 'لم يُرسَل سطر إضافيّ واحد في هذا الملفّ.',
    two: 'لم يُرسَل سطران إضافيّان في هذا الملفّ.',
    few: 'لم تُرسَل {count} أسطر إضافيّة في هذا الملفّ.',
    many: 'لم يُرسَل {count} سطرًا إضافيًّا في هذا الملفّ.',
    other: 'لم يُرسَل {count} سطر إضافيّ في هذا الملفّ.',
  },
  'work.diff.more': 'عرض ملفّات أخرى',
  'work.diff.holdFull': {
    zero: 'لا يحتفظ المتصفّح بأيّ سطر من هذا الفرق ولن يحمّل المزيد. أعد فتح المراجعة للمتابعة من صفحة جديدة.',
    one: 'يحتفظ المتصفّح بسطر واحد من هذا الفرق ولن يحمّل المزيد. أعد فتح المراجعة للمتابعة من صفحة جديدة.',
    two: 'يحتفظ المتصفّح بسطرين من هذا الفرق ولن يحمّل المزيد. أعد فتح المراجعة للمتابعة من صفحة جديدة.',
    few: 'يحتفظ المتصفّح بـ{count} أسطر من هذا الفرق ولن يحمّل المزيد. أعد فتح المراجعة للمتابعة من صفحة جديدة.',
    many: 'يحتفظ المتصفّح بـ{count} سطرًا من هذا الفرق ولن يحمّل المزيد. أعد فتح المراجعة للمتابعة من صفحة جديدة.',
    other: 'يحتفظ المتصفّح بـ{count} سطر من هذا الفرق ولن يحمّل المزيد. أعد فتح المراجعة للمتابعة من صفحة جديدة.',
  },
  'work.diff.moved':
    'تحرّكت شجرة العمل بينما كانت هذه الشاشة مفتوحة. حمّل الفروق من جديد — نصف شجرة ونصف أخرى ليسا تغييرًا يُوافَق عليه.',
  'work.diff.unavailable':
    'شجرة العمل لهذه العملية لم تعد موجودة، فلا فروق تُقرأ. وهذا ليس كعملية لم تغيّر شيئًا.',
  'work.diff.status.added': 'مضاف',
  'work.diff.status.modified': 'معدّل',
  'work.diff.status.deleted': 'محذوف',
  'work.diff.status.renamed': 'معاد التسمية',
  'work.diff.status.binary': 'ثنائي',

  'work.review.body.approved': 'وافقتُ على هذا التغيير.',
  'work.review.body.changes': 'طلبتُ تعديلات على هذا التغيير.',
  'work.review.approve': 'الموافقة',
  'work.review.changes': 'طلب تعديلات',
  'work.review.note': 'ملاحظة للدور التالي (اختيارية)',
  'work.review.approved': 'سُجّلت الموافقة في محادثة هذه العملية، مقابل الشجرة {sha}.',
  'work.review.requested': 'سُجّل طلب التعديلات. يصل الوكيلَ في دوره التالي.',
  'work.review.notMerge':
    'هذا يسجّل حكمًا في محادثة العملية نفسها. لا يرفع ولا يفتح طلب دمج ولا يدمج — لا شيء في هذا الإصدار يفعل ذلك.',
  'work.review.noThread': 'محادثة هذه العملية غير معروفة هنا، فلا شيء يُسجَّل الحكم عليه.',
  'work.review.noTree':
    'لا تستطيع هذه الصفحة تسمية الشجرة التي قرأتها، والحكم الذي لا يسمّي ما نظر إليه ادّعاء بلا مشاهدة.',
  'work.review.failed': 'لم يُسجَّل الحكم. {message}',

  'a11y.mapCanvas': 'مجرّة الوكلاء. استخدم مفاتيح الأسهم للتنقّل بين الأقسام.',
  'a11y.drawer': 'تفاصيل الوكيل',
  'a11y.carousel': 'مراكز القيادة',
  'a11y.matrix': 'مصفوفة النشر: مستوى الاستقلالية مقابل مرحلة النشر',
  'a11y.liveRegion.runStarted': 'بدأ التشغيل.',
  'a11y.liveRegion.runFinished': 'انتهى التشغيل.',
};
