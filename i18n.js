// ===================== Maison Meka — Arabic / English ===================== //
/* Loaded first, in the <head> of every page. When the visitor has chosen
   Arabic, the page is switched to right-to-left with Arabic fonts before it
   is drawn, and every piece of English text — written in the HTML or added
   later by the scripts — is replaced by its Arabic translation.
   Product names and descriptions come in Arabic from the dashboard data
   (see products.js); this file covers the interface itself. */

(function () {
  let lang = 'en';
  try { lang = localStorage.getItem('mm-lang') === 'ar' ? 'ar' : 'en'; } catch {}
  window.MM_LANG = lang;
  window.mmSetLang = (l) => { try { localStorage.setItem('mm-lang', l); } catch {} location.reload(); };
  if (lang !== 'ar') return;

  const html = document.documentElement;
  html.lang = 'ar';
  html.dir = 'rtl';
  html.classList.add('lang-ar', 'i18n-pending');
  /* Arabic faces: Amiri for titles and names, Tajawal for everything else */
  const font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = 'assets/fonts/arabic.css';
  document.head.appendChild(font);
  const hide = document.createElement('style');
  hide.textContent = 'html.i18n-pending body{opacity:0}';
  document.head.appendChild(hide);

  /* ---------- the dictionary: English text → Arabic ---------- */
  const D = {
    // header, menu, footer
    'HOME':'الرئيسية', 'Home':'الرئيسية', 'SHOP':'المتجر', 'Shop':'المتجر', 'WISHLIST':'المفضلة', 'Wishlist':'المفضلة',
    'CATEGORIES':'الأقسام', 'Categories':'الأقسام', 'ABOUT US':'من نحن', 'About Us':'من نحن', 'CONTACT':'تواصل معنا', 'Contact Us':'تواصل معنا',
    'Collections':'المجموعات', 'Custom Orders':'طلبات خاصة', 'DISCOVER':'اكتشف', 'HELP & INFO':'المساعدة', 'FAQs':'الأسئلة الشائعة',
    'Shipping & Delivery':'الشحن والتوصيل', 'Returns & Exchanges':'الاسترجاع والاستبدال', 'Terms & Conditions':'الشروط والأحكام',
    'Privacy Policy':'سياسة الخصوصية', 'FOLLOW US':'تابعونا', 'POWERED BY':'تطوير', 'EN':'EN',
    'CURATED WITH SOUL,':'منتقاة بروح،', 'MADE TO LAST.':'وصُنعت لتدوم.',
    'Timeless pieces, thoughtfully designed\nto bring beauty, warmth, and harmony\ninto your space.':'قطع خالدة، مصممة بعناية\nلتمنح مساحتك الجمال والدفء والانسجام.',
    'Crafted for a life well lived':'صُنعت لحياة تُعاش بجمال',
    // hero + home
    'CURATED':'منتقاة', 'HOME ART':'فن المنزل', 'Elegance in every detail.':'أناقة في كل تفصيلة.',
    'Timeless pieces chosen to bring character, beauty,\nand elegance into your space.':'قطع خالدة مختارة لتمنح مساحتك\nالشخصية والجمال والأناقة.',
    'SHOP THE COLLECTION':'تسوّق المجموعة', 'SCROLL TO DISCOVER':'مرّر للاكتشاف',
    'PREMIUM QUALITY':'جودة فاخرة', 'Carefully selected materials for lasting beauty.':'خامات مختارة بعناية لجمال يدوم.',
    'FAST & RELIABLE DELIVERY':'توصيل سريع وموثوق', 'Quick delivery to your doorstep.':'توصيل سريع حتى باب منزلك.',
    'SECURE PACKAGING':'تغليف آمن', 'Every piece wrapped to arrive flawless.':'كل قطعة مغلّفة لتصل بلا عيب.',
    'CUSTOMER SUPPORT':'خدمة العملاء', "We're here to help 24/7.":'نحن هنا لمساعدتك دائماً.',
    'EXPLORE OUR COLLECTION':'اكتشف مجموعتنا', 'Shop by Category':'تسوّق حسب القسم',
    'Curated pieces to elevate every corner of your home':'قطع منتقاة ترتقي بكل ركن في منزلك',
    'TIMELESS OBJECTS':'قطع خالدة', 'BEAUTIFULLY CURATED FOR YOU':'منتقاة بعناية من أجلك',
    'OUR CLIENTS':'عملاؤنا', 'Real Homes, Real Stories':'بيوت حقيقية، قصص حقيقية',
    'BEST SELLERS':'الأكثر مبيعاً', 'BEST':'الأكثر', 'SELLERS':'مبيعاً',
    'Uniquely chosen.\nBeautifully crafted.\nLoved by our community.':'مختارة بتميّز.\nمصنوعة بإتقان.\nيحبها مجتمعنا.',
    'Uniquely chosen. Beautifully crafted. Loved by our community.':'مختارة بتميّز. مصنوعة بإتقان. يحبها مجتمعنا.',
    'FOLLOW & SHOP ON INSTAGRAM':'تابع وتسوّق عبر إنستجرام', 'TIMELESS PIECES. · LASTING STORIES.':'قطع خالدة · قصص تدوم',
    'INSPIRE YOUR SPACE':'ألهم مساحتك', 'Straight from our Instagram — the pieces our clients are loving now':'مباشرة من إنستجرام — القطع التي يحبها عملاؤنا الآن',
    'FOLLOW & GET INSPIRED':'تابعنا واستلهم', 'ON\nINSTAGRAM':'على\nإنستجرام', 'INSTAGRAM':'إنستجرام', 'ON':'على',
    'Join our community and discover\nhow beauty lives in the details.':'انضم إلى مجتمعنا واكتشف\nكيف يسكن الجمال في التفاصيل.',
    'FOLLOW OUR JOURNEY':'تابع رحلتنا', 'MAISON MEKA':'ميزون ميكا', 'Discount':'الخصم',
    'OUR FAVORITES':'المفضلة لدينا', 'Best Sellers':'الأكثر مبيعاً', 'Shop Best Sellers':'تسوّق الأكثر مبيعاً',
    'The most loved pieces, chosen by our community to bring beauty and warmth into every home.':'القطع الأكثر حباً، اختارها مجتمعنا لتمنح كل بيت الجمال والدفء.',
    'Most\nLoved':'الأكثر\nحباً', 'Previous':'السابق', 'Next':'التالي',
    'Skip':'تخطي', 'Tap for sound':'اضغط لتشغيل الصوت', 'Save order photo':'حفظ صورة الطلب',
    'A gift for you':'هدية لك', 'Use this code on your order':'استخدم هذا الكود على طلبك', 'Copy code':'نسخ الكود',
    'Copied!':'تم النسخ!', 'Continue shopping':'متابعة التسوق', 'FREE SHIPPING':'شحن مجاني', 'On any order':'على أي طلب',
    'Code copied — it will be applied in your bag':'تم نسخ الكود — سيُطبّق تلقائياً في حقيبتك',
    'This page has wandered off':'هذه الصفحة غير موجودة',
    "The page you were looking for isn't here — but every piece in the house is a click away.":'الصفحة التي تبحث عنها ليست هنا — لكن كل قطع الدار على بُعد ضغطة.',
    'Back to Home':'العودة للرئيسية', 'Shop the Collection':'تسوّق المجموعة', 'Page not found':'الصفحة غير موجودة',
    'LOVED BY\nOUR CLIENTS':'محبوبة\nمن عملائنا',
    'Every piece we create becomes a part of\nbeautiful homes and even more beautiful memories.':'كل قطعة نختارها تصبح جزءاً من\nبيوت جميلة وذكريات أجمل.',
    'TIMELESS PIECES. · LASTING STORIES.':'قطع خالدة · قصص تدوم',
    'BRING ELEGANCE':'أضف الأناقة', 'TO EVERY CORNER':'إلى كل ركن',
    'Discover more of our latest pieces,\nbehind the scenes, and styling inspiration.\nJoin our community.':'اكتشف أحدث قطعنا\nوكواليسنا وأفكار التنسيق.\nانضم إلى مجتمعنا.', 'EXPLORE MORE BEAUTIFUL PIECES':'اكتشف المزيد من القطع الجميلة',
    // categories (fallback text before the data arrives)
    'Antiques & Vintage':'تحف وأنتيكات', 'Tableaux':'لوحات', 'Murano':'مورانو', 'Lamp Stands & Lampdaire':'أباجورات ولامبادير',
    'Vases':'فازات', 'Cachpots':'كاشبوهات', 'Potiches':'بوتيشات', 'Wall Plates':'أطباق حائط', 'Bonboniera':'بونبونيرات',
    'Jardinière':'جاردينيرات', 'Stands & Stools':'ستاندات وكراسي', 'Candle Holders':'شمعدانات', 'Center Pieces':'سنترات', 'Decor':'ديكور', 'Tea Set, Plates & Trays':'أطقم شاي وأطباق وصواني', 'Discover the collection':'اكتشف المجموعة', 'Tea sets, serving plates and trays for the table and the tea hour.':'أطقم شاي وأطباق تقديم وصواني للمائدة ولوقت الشاي.',
    // shop page
    'The Collection':'المجموعة', 'Maison Meka · Home Art':'ميزون ميكا · فن المنزل', 'Shop the Edit':'تسوّق التشكيلة',
    'Pieces':'قطعة', 'Piece':'قطعة', 'All Pieces':'كل القطع', 'Filter By':'تصفية حسب', 'Category':'القسم', 'Price':'السعر',
    'Material':'الخامة', 'Availability':'التوفر', 'In Stock Only':'المتوفر فقط', 'Clear All':'مسح الكل', 'Filter':'تصفية',
    'Filter & Sort':'تصفية وترتيب', 'Sort by':'ترتيب حسب', 'Featured':'المميز', 'Newest':'الأحدث', 'Price: Low to High':'السعر: من الأقل للأعلى',
    'Price: High to Low':'السعر: من الأعلى للأقل', 'Name A–Z':'الاسم أ–ي', 'Relevance':'الأكثر صلة',
    'Nothing matches — yet':'لا توجد نتائج — حتى الآن', 'Try widening the price, or clearing a filter or two.':'جرّب توسيع نطاق السعر أو إزالة بعض عوامل التصفية.',
    'Clear Filters':'مسح التصفية', 'BESPOKE SOURCING':'توفير حسب الطلب', 'Looking for something\nparticular?':'تبحث عن\nقطعة بعينها؟',
    'Tell us the piece you have in mind — the size, the finish, the room it belongs to — and we will find it for you.':'أخبرنا بالقطعة التي تتخيلها — المقاس واللمسة والمكان الذي تنتمي إليه — وسنجدها لك.',
    'Message us on Instagram':'راسلنا على إنستجرام', 'Glass':'زجاج', 'Ceramic':'سيراميك', 'Porcelain':'بورسلين', 'Metal':'معدن', 'Wood':'خشب',
    'View Piece':'عرض القطعة', 'Add to Cart':'أضف إلى الحقيبة', 'Added':'تمت الإضافة', 'Sold Out':'نفدت الكمية',
    'In Stock':'متوفر', 'Low Stock':'كمية محدودة', 'New':'جديد', 'Bestseller':'الأكثر مبيعاً', 'Sale':'خصم', 'Limited':'إصدار محدود',
    // product page
    'Dimensions':'المقاسات', 'Buy It Now':'اشترِ الآن', 'Added to Cart':'تمت الإضافة إلى الحقيبة', 'Product Details':'تفاصيل المنتج',
    'Materials & Care':'الخامات والعناية', 'Ordering & Delivery':'الطلب والتوصيل',
    'Add the piece to your bag and send your order to us on Instagram — we confirm availability, delivery and payment with you personally by direct message.':'أضف القطعة إلى حقيبتك وأرسل طلبك إلينا على إنستجرام — نؤكد معك التوفر والتوصيل والدفع شخصياً عبر الرسائل.',
    'Premium Materials':'خامات فاخرة', 'Glass, porcelain and gilded metal, made to last.':'زجاج وبورسلين ومعدن مذهّب، صُنعت لتدوم.',
    'Timeless Design':'تصميم خالد', 'A piece that fits every interior style.':'قطعة تناسب كل أسلوب ديكور.',
    'Versatile Use':'استخدامات متعددة', 'On a console, a shelf or a dining table.':'على الكونسول أو الرف أو طاولة الطعام.',
    'Curated With Care':'منتقاة بعناية', 'Hand-picked by Maison Meka, one by one.':'تختارها ميزون ميكا بيدها، قطعة قطعة.',
    'You May Also Like':'قد يعجبك أيضاً', 'View All':'عرض الكل', 'Color':'اللون', 'Size':'المقاس',
    // bag
    'YOUR BAG':'حقيبتك', 'pieces kept aside':'قطع محجوزة', 'Your bag is empty':'حقيبتك فارغة',
    'Every piece begins with a first glance.':'كل قطعة تبدأ بنظرة أولى.', 'BROWSE THE COLLECTION':'تصفّح المجموعة',
    'Subtotal':'المجموع الفرعي', 'Shipping':'الشحن', 'Calculated at order':'يُحسب عند الطلب', 'Total':'الإجمالي',
    'ORDER FROM INSTAGRAM':'اطلب عبر إنستجرام', 'We complete every order personally, by direct message.':'نُتمّ كل طلب شخصياً عبر الرسائل المباشرة.',
    'Apply':'تطبيق', 'Code applied':'تم تطبيق الكود', 'Free shipping':'شحن مجاني', 'VIEW BAG':'عرض الحقيبة', 'VIEW':'عرض',
    'Please add your name and phone number.':'من فضلك أضف اسمك ورقم هاتفك.', 'Your bag is empty.':'حقيبتك فارغة.',
    'This code is not valid.':'هذا الكود غير صالح.', 'This code is not active yet.':'هذا الكود غير مفعّل بعد.', 'This code has expired.':'انتهت صلاحية هذا الكود.',
    'This code does not apply to the pieces in your bag.':'هذا الكود لا ينطبق على القطع الموجودة في حقيبتك.',
    'Saved to your wishlist':'تمت الإضافة إلى المفضلة', 'Removed from your wishlist':'تمت الإزالة من المفضلة',
    // search + wishlist
    'SEARCH':'بحث', 'Filters':'تصفية', 'Results Found':'نتيجة', 'No pieces match that search — try another word.':'لا توجد قطع مطابقة — جرّب كلمة أخرى.',
    'KEPT ASIDE':'محفوظة لك', 'The pieces you have set your heart on, waiting quietly for their room.':'القطع التي أحببتها، تنتظر مكانها بهدوء.',
    'Pieces Saved':'قطعة محفوظة', 'Collection Value':'قيمة المجموعة', 'MOVE ALL TO CART':'نقل الكل إلى الحقيبة', 'CLEAR':'مسح',
    'Nothing kept aside yet':'لا توجد قطع محفوظة بعد', 'Wander the collection and tap the heart on anything that stops you.':'تجوّل في المجموعة واضغط على القلب عند أي قطعة تلفت نظرك.',
    'SAVED':'محفوظة', 'ADD TO CART':'أضف إلى الحقيبة', 'Wishlist cleared':'تم مسح المفضلة', 'Added to cart':'تمت الإضافة إلى الحقيبة',
    // policies (headings — the articles are swapped whole)
    'Customer Care':'خدمة العملاء', 'Help & Info':'المساعدة', 'Legal':'قانوني', 'Still have a question?':'لديك سؤال آخر؟',
    'Message us — we answer every order and enquiry personally.':'راسلنا — نرد على كل طلب واستفسار بأنفسنا.',
    // attributes
    'Search for products, categories, styles…':'ابحث عن منتجات أو أقسام أو أساليب…', 'Discount code':'كود الخصم',
    'Full name':'الاسم بالكامل', 'Phone number':'رقم الهاتف', 'City / Area':'المدينة / المنطقة',
    'Menu':'القائمة', 'Search':'بحث', 'Cart':'الحقيبة', 'Close':'إغلاق', 'Close menu':'إغلاق القائمة', 'Close bag':'إغلاق الحقيبة',
    'Change language':'تغيير اللغة', 'Save to wishlist':'أضف إلى المفضلة', 'Next photo':'الصورة التالية', 'Previous photo':'الصورة السابقة'
  };
  /* text that carries a number or a name */
  const P = [
    [/^(.+) added to your bag$/, 'تمت إضافة $1 إلى حقيبتك'],
    [/^(\d+) × (.+) added to your bag$/, 'تمت إضافة $1 × $2 إلى حقيبتك'],
    [/^Collection (\d+) \/ (\d+)$/, 'المجموعة $1 / $2'],
    [/^Show (\d+) Pieces$/, 'عرض $1 قطعة'],
    [/^(\d+) pieces? added to cart$/, 'تمت إضافة $1 قطعة إلى الحقيبة'],
    [/^(.+) removed$/, 'تمت إزالة $1'],
    [/^Minimum order for this code is (.+)\.$/, 'الحد الأدنى للطلب لهذا الكود $1.'],
    [/^Order (MM-\d+) sent\. Its details and photo link are copied — just paste them in our Instagram chat\.$/, 'تم إرسال الطلب $1. تم نسخ تفاصيله ورابط صورته — فقط الصقها في محادثتنا على إنستجرام.'],
    [/^(\d+)% off$/, 'خصم $1%'],
    [/^Sale (\d+)%$/, 'خصم $1%'],
    [/^(\d+)% OFF$/, 'خصم $1%'],
    [/^(.+) OFF$/, 'خصم $1'],
    [/^Minimum order (.+?)( · Valid until (.+))?$/, (m, a, b, d) => `الحد الأدنى للطلب ${a}${d ? ` · ساري حتى ${d}` : ''}`],
    [/^On any order · Valid until (.+)$/, 'على أي طلب · ساري حتى $1'],
    [/^Go to (\d+)$/, 'انتقل إلى $1'],
    [/^(.+) off$/, 'خصم $1'],
    [/^Maison Meka \| Home Art$/, 'ميزون ميكا | فن المنزل'],
    [/^(.+) \| Maison Meka$/, (m, a) => `${D[a] || a} | ميزون ميكا`]
  ];
  const money = (s) => s.replace(/EGP\s?([\d,]+)/g, '$1 ج.م');
  const norm = (s) => s.replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').trim();

  const tr = (raw) => {
    const key = norm(raw);
    if (!key || !/[A-Za-z]/.test(key)) return key.includes('EGP') ? money(key) : null;
    if (D[key] != null) return D[key];
    const flat = key.replace(/\n/g, ' ');
    if (D[flat] != null) return D[flat];
    for (const [re, to] of P) if (re.test(key)) return money(key.replace(re, to));
    if (/EGP\s?\d/.test(key)) return money(key);
    return null;
  };
  window.MM_T = (s) => tr(s) ?? s;

  /* an element made only of text and <br> is translated as one sentence */
  const BLOCK = 'p,h1,h2,h3,h4,h5,a,button,span,label,li,em,strong,b,small,option,dt,dd,summary,figcaption';
  const onlyTextAndBr = (el) => [...el.childNodes].every(n => n.nodeType === 3 || (n.nodeType === 1 && n.tagName === 'BR'));
  const textWithBreaks = (el) => [...el.childNodes].map(n => n.nodeType === 3 ? n.nodeValue.replace(/\s+/g, ' ') : '\n').join('');

  const translateEl = (el) => {
    if (el.closest('script,style,svg,textarea,[data-no-i18n]')) return;
    if (el.matches(BLOCK) && el.querySelector('br') && onlyTextAndBr(el)) {
      const t = tr(textWithBreaks(el));
      if (t != null) { el.innerHTML = t.split('\n').map(x => x.replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]))).join('<br>'); return; }
    }
    ['placeholder', 'aria-label', 'title'].forEach(a => {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) { const t = tr(v); if (t != null && t !== v) el.setAttribute(a, t); }
    });
  };
  const translateText = (node) => {
    if (!node.parentElement || node.parentElement.closest('script,style,svg,textarea,[data-no-i18n]')) return;
    const v = node.nodeValue;
    if (!v || !v.trim()) return;
    const t = tr(v);
    if (t != null && t !== v.trim()) node.nodeValue = v.replace(v.trim(), t);
  };
  const walk = (root) => {
    if (root.nodeType === 3) return translateText(root);
    if (root.nodeType !== 1) return;
    translateEl(root);
    root.querySelectorAll('*').forEach(translateEl);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n; while ((n = it.nextNode())) translateText(n);
  };

  /* whole articles (the policy pages) are swapped from an Arabic template */
  const swapTemplates = () => {
    document.querySelectorAll('template[data-ar-for]').forEach(t => {
      const target = document.querySelector(t.dataset.arFor);
      if (target) target.innerHTML = t.innerHTML;
    });
  };

  const start = () => {
    swapTemplates();
    document.title = tr(document.title) ?? document.title;
    walk(document.body);
    html.classList.remove('i18n-pending');
    new MutationObserver((muts) => muts.forEach(m => {
      if (m.type === 'characterData') return translateText(m.target);
      if (m.type === 'attributes') return translateEl(m.target);
      m.addedNodes.forEach(walk);
    })).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] });
    new MutationObserver(() => { const t = tr(document.title); if (t && t !== document.title) document.title = t; })
      .observe(document.querySelector('title') || document.head, { childList: true, characterData: true, subtree: true });
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
  /* never leave the page hidden, whatever happens */
  setTimeout(() => html.classList.remove('i18n-pending'), 1500);
})();
