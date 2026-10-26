import type { ScientificReference } from '../domain/types';

/**
 * Scientific reference registry.
 *
 * Every entry records what was actually consulted, when, and what the known
 * limitations are. No entry is listed here unless it is genuinely relevant to
 * the values or the constraints used by the application.
 */
export const REFERENCES: ScientificReference[] = [
  {
    id: 'ref-inrae-feedtables',
    titleAr: 'جداول تركيب القيم الغذائية للأعلاف — INRAE-CIRAD-AFZ',
    titleOriginal: 'INRAE-CIRAD-AFZ Feed tables: Composition and nutritive values of feeds',
    authors: 'INRAE, CIRAD, AFZ (Association Française de Zootechnie)',
    year: 2021,
    edition: 'الإصدار المنشور على feedtables.com (نظام INRA 2018 للطاقة والبروتين)',
    url: 'https://www.feedtables.com/',
    coversAr: 'الأغنام والماعز والأبقار وغيرها من المجترات، مع قيم طاقة وبروتين بنظام INRA 2018',
    energySystem: 'UFL / UFV / ME / NEL (INRA 2018، على أساس المادة الجافة)',
    proteinSystem: 'PDI و PDIA (نظام Systali / INRA 2018)',
    unitsNoteAr:
      'الطاقة بوحدات UFL أو UFV لكل كغ مادة جافة. البروتين بالغرام PDI لكل كغ مادة جافة. المعادن بالغرام لكل كغ مادة جافة. نسب التركيب الكيميائي كنسبة مئوية من المادة الجافة.',
    limitationsAr:
      'القيم المنشورة متوسطات إحصائية لمجموعة عينات وليست تحليلاً لعينة محددة؛ تنشر الجداول أيضاً نطاقات تباين واسعة. لا تغني عن التحليل المخبري للدفعة الفعلية. القيم محسوبة عند مستوى تغذية مرجعي (FL2) وقد تختلف عند مستويات إنتاج مختلفة.',
    reviewedOn: '2026-10-23',
    accessStatus: 'consulted',
    accessNoteAr:
      'تم الاطلاع على صفحات التركيب المنشورة علناً لكل مادة علفية مستخدمة في هذا التطبيق، ونُقلت القيم كما هي على أساس المادة الجافة.',
  },
  {
    id: 'ref-nrc-2007',
    titleAr: 'الاحتياجات الغذائية للمجترات الصغيرة: الأغنام والماعز والإبليات',
    titleOriginal:
      'Nutrient Requirements of Small Ruminants: Sheep, Goats, Cervids, and New World Camelids',
    authors: 'National Research Council (U.S.), Committee on Nutrient Requirements of Small Ruminants',
    year: 2007,
    edition: 'الطبعة الأولى',
    url: 'https://nap.nationalacademies.org/catalog/11654/nutrient-requirements-of-small-ruminants-sheep-goats-cervids-and-new-world-camelids',
    doi: '10.17226/11654',
    coversAr: 'الأغنام والماعز حسب الفئة الإنتاجية (نمو، تسمين، صيانة، حمل، إدرار، فحول)',
    energySystem: 'الطاقة القابلة للاستقلاب (ME) والطاقة القابلة للهضم (DE) و TDN',
    proteinSystem: 'البروتين الخام (CP) مع تفصيل البروتين غير المتحلل في الكركش',
    unitsNoteAr:
      'ME بالميغاكالوري/كغ مادة جافة، CP كنسبة مئوية من المادة الجافة، الكالسيوم والفوسفور كنسبة مئوية من المادة الجافة، استهلاك المادة الجافة كنسبة من الوزن الحي.',
    limitationsAr:
      'جداول المتطلبات متاحة فقط كصور صفحات داخل قارئ NAP، ولم يتسنَّ استخراجها آلياً والتحقق منها في بيئة التطوير هذه. لذلك لا يستخدم التطبيق أي قيمة عددية من هذا المرجع.',
    reviewedOn: '2026-10-23',
    accessStatus: 'not_consulted',
    accessNoteAr:
      'تم التحقق من وجود المرجع وبياناته الببليوغرافية فقط. لم تُقرأ جداول المتطلبات، ولذلك لم تُستورد أي قيمة عددية منه إلى التطبيق.',
  },
  {
    id: 'ref-inrae-2018-book',
    titleAr: 'تغذية المجترات: الفيزيولوجيا والبيانات التجريبية والتطبيقات العملية',
    titleOriginal:
      'Ruminant nutrition: physiology, experimental data and practical consequences (INRAE 2018)',
    authors: 'INRAE — إشراف P. Nozière, D. Sauvant, L. Delaby',
    year: 2018,
    edition: 'Quae / INRAE',
    url: 'https://www.inrae.fr/en/news/animal-feed-tables',
    coversAr: 'المجترات: الأبقار والأغنام والماعز',
    energySystem: 'UFL / UFV / ME / NEL (INRA 2018)',
    proteinSystem: 'PDI / PDIA (Systali)',
    unitsNoteAr: 'نفس وحدات جداول INRAE-CIRAD-AFZ.',
    limitationsAr:
      'الكتاب غير متاح مجاناً بالكامل؛ لم تُقرأ فصول المتطلبات، ولذلك لم تُستورد منه أي قيمة عددية. بُني هيكل النظام فقط اعتماداً على الوصف المنشور علناً لوحدات القياس.',
    reviewedOn: '2026-10-23',
    accessStatus: 'partially_consulted',
    accessNoteAr:
      'تم الاطلاع على الصفحة التعريفية المنشورة علناً وعلى توثيق وحدات القياس في جداول INRAE-CIRAD-AFZ. لم تُقرأ جداول المتطلبات العددية.',
  },
];

export function getReference(id: string): ScientificReference | undefined {
  return REFERENCES.find((r) => r.id === id);
}

export const ACCESS_STATUS_LABEL_AR: Record<ScientificReference['accessStatus'], string> = {
  consulted: 'تم الاطلاع على المحتوى',
  partially_consulted: 'اطلاع جزئي',
  not_consulted: 'لم يُطلع على المحتوى',
};

export const ACCESS_STATUS_STYLE: Record<ScientificReference['accessStatus'], string> = {
  consulted: 'bg-brand-100 text-brand-900',
  partially_consulted: 'bg-amber-100 text-amber-900',
  not_consulted: 'bg-red-100 text-red-900',
};
