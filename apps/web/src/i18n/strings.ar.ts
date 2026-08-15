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
  'shell.tab.sessions': 'الجلسات',

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

  /* §3.1 SESSIONS ----------------------------------------------------------- */
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

  'empty.sessions.title': 'لا جلسات مفتوحة',
  'empty.sessions.body': 'ابدأ واحدة هنا فتتبعك إلى هاتفك، بطلبات الإذن كلّها.',

  'empty.audit.title': 'لم يجرِ أيّ تدقيق',
  'empty.audit.body': 'يمشي المدقّق على المستودع والآثار، ثمّ يعلّم الخريطة. يستغرق ذلك دقيقة تقريبًا.',

  'empty.brain.title': 'دماغ الشركة فارغ',
  'empty.brain.body': 'شغّل المقابلة. عشرون سؤالًا مرّة واحدة أرخص من شرح نفسك لكلّ وكيل إلى الأبد.',

  'empty.inputs.title': 'لا مدخلات لهذا الوكيل',
  'empty.inputs.body': 'اضغط تشغيل. هو يعرف أين يبحث.',

  /* Accessibility ----------------------------------------------------------- */
  'a11y.mapCanvas': 'مجرّة الوكلاء. استخدم مفاتيح الأسهم للتنقّل بين الأقسام.',
  'a11y.drawer': 'تفاصيل الوكيل',
  'a11y.carousel': 'مراكز القيادة',
  'a11y.matrix': 'مصفوفة النشر: مستوى الاستقلالية مقابل مرحلة النشر',
  'a11y.liveRegion.runStarted': 'بدأ التشغيل.',
  'a11y.liveRegion.runFinished': 'انتهى التشغيل.',
};
