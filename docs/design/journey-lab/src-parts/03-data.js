/* ---------- captured screenshots (local demo, isolated data directory) ---------- */
const IMG = {
  exam_hint: '@@img:exam_hint@@',
  exam_locked: '@@img:exam_all_locked@@',
  receipt: '@@img:receipt@@',
  m_exam: '@@img:m_exam@@',
  admin_top: '@@img:admin_competition_top@@',
  admin_actions: '@@img:admin_competition_actions@@',
  admin_questions: '@@img:admin_questions@@',
  admin_coverage: '@@img:admin_coverage@@',
  admin_testrun: '@@img:admin_testrun@@',
};

/* ---------- illustrative content for the prototype (not the approved question bank) ---------- */
const LET = ['أ', 'ب', 'ج', 'د'];
const PAGES = {
  2: { toc: true },
  3: { t: 'المطلب الأول: معنى الانتماء', p: ['الانتماء ارتباط صادق بالوطن، يظهر في الولاء له والعمل من أجله والمحافظة على مكتسباته، وليس مجرد الإقامة على أرضه.', 'ومن أبرز صوره المشاركة في خدمة المجتمع، وإتقان العمل، والاعتزاز بالهوية.'] },
  4: { t: 'المطلب الثاني: اللحمة الوطنية', p: ['تقوم اللحمة الوطنية على التعاون والتكاتف والثقة المتبادلة بين أفراد المجتمع على اختلاف مناطقهم وأعمارهم.', 'وكلما قويت الروابط بين الناس كان المجتمع أقدر على مواجهة التحديات.'] },
  5: { t: 'المطلب الثالث: الحوار واحترام الاختلاف', p: ['الاختلاف في الرأي أمر طبيعي، وإدارته بالحوار والاحترام دليل وعي. نستمع إلى المتحدث حتى ينتهي، ونناقش الفكرة لا الشخص.', 'ولا يكون الاختلاف سببًا للقطيعة أو الإساءة.'] },
  6: { t: 'المطلب الرابع: المسؤولية والواجب', p: ['تظهر المسؤولية تجاه الوطن في المحافظة على المرافق العامة، والالتزام بالأنظمة، والتحقق من الأخبار قبل تداولها.', 'وكل سلوك صغير يسهم في صورة المجتمع الكبرى.'] },
  7: { t: 'الأمانة في نقل الأخبار', p: ['قبل أن تعيد نشر أي خبر تحقق من مصدره ومن تاريخه، فالخبر غير الدقيق قد يضر بالناس وبثقتهم في بعضهم.', 'والأمانة في النقل جزء من الانتماء.'] },
  8: { t: 'خطر الشائعات', p: ['تضعف الشائعات الثقة وتفرّق الصفوف وتشغل المجتمع عن أولوياته، ومواجهتها تكون بنشر المعلومة الصحيحة من مصدرها.', 'ويبدأ ذلك من الفرد قبل الجماعة.'] },
  9: { t: 'حقوق الوطن على أبنائه', p: ['من حقوق الوطن على أبنائه صون مقدراته والمحافظة عليها، وأداء الواجب بإخلاص قبل المطالبة بالحقوق.', 'والمواطن الواعي يوازن بين ما له وما عليه.'] },
  10: { t: 'دور الأسرة والمدرسة', p: ['للأسرة والمدرسة دور كبير في غرس القيم الوطنية، ويكون ذلك بالقدوة الحسنة والحوار الهادئ لا بالتلقين وحده.', 'وتتكامل أدوارهما مع المجتمع كله.'] },
  11: { t: 'النقد البنّاء وثمرات الوحدة', p: ['النقد البنّاء يقترن بالاحترام ويقدّم حلولًا قابلة للتطبيق.', 'ومن ثمرات الوحدة الوطنية الأمن والاستقرار والتنمية المستمرة.'] },
  12: { t: 'خاتمة', p: ['الوطن أمانة في أعناق أبنائه، وحبه يُترجم عملًا وتعاونًا وإخلاصًا.', 'نسأل الله أن يحفظ وطننا وأهله.'] },
};
const TOC = [
  ['المطلب الأول: معنى الانتماء', 3],
  ['المطلب الثاني: اللحمة الوطنية', 4],
  ['المطلب الثالث: الحوار واحترام الاختلاف', 5],
  ['المطلب الرابع: المسؤولية والواجب', 6],
  ['حقوق الوطن وواجباته', 9],
  ['النقد البنّاء وثمرات الوحدة', 11],
];
const BOOK_PAGES = 12;
const QS = [
  { q: 'ما المقصود بالانتماء للوطن؟', o: ['الارتباط بالوطن والولاء له وتحمّل المسؤولية تجاهه', 'الإقامة فيه دون الاهتمام بشؤونه', 'المقارنة الدائمة بينه وبين غيره', 'انتظار الآخرين ليعملوا من أجله'], a: [0], pg: 3, ex: 'الانتماء ارتباط صادق بالوطن يظهر في الولاء والعمل والمحافظة على مكتسباته.', topic: 'معنى الانتماء' },
  { q: 'أي مما يلي يقوّي اللحمة الوطنية؟', o: ['تضخيم الخلافات', 'التعاون والتكاتف بين أفراد المجتمع', 'تداول الشائعات', 'العزلة عن الآخرين'], a: [1], pg: 4, ex: 'تقوم اللحمة الوطنية على التعاون والتكاتف والثقة المتبادلة.', topic: 'اللحمة الوطنية' },
  { q: 'كيف نتعامل مع الاختلاف في الرأي؟', o: ['بالسخرية من صاحب الرأي', 'برفع الصوت حتى يقتنع', 'باحترام المتحدث ومناقشة الفكرة', 'بترك الحوار نهائيًا'], a: [2], pg: 5, ex: 'نستمع إلى المتحدث حتى ينتهي ونناقش الفكرة لا الشخص.', topic: 'الحوار' },
  { q: 'اختر جميع السلوكيات التي تعبّر عن المسؤولية تجاه الوطن.', o: ['المحافظة على المرافق العامة', 'الالتزام بالأنظمة', 'التحقق من الخبر قبل نشره', 'التهاون في أداء الواجبات'], a: [0, 1, 2], pg: 6, ex: 'المسؤولية تظهر في المحافظة على المرافق والالتزام بالأنظمة والتحقق من الأخبار.', multi: true, topic: 'المسؤولية' },
  { q: 'ما الخطوة المناسبة قبل إعادة نشر خبر؟', o: ['نشره بسرعة', 'الاعتماد على عدد المشاركات', 'التحقق من المصدر', 'الاكتفاء بالعنوان'], a: [2], pg: 7, ex: 'تحقق من مصدر الخبر وتاريخه قبل إعادة نشره.', topic: 'الأمانة' },
  { q: 'ما أثر الشائعات في المجتمع؟', o: ['تزيد الثقة بين الناس', 'تضعف الثقة وتفرّق الصفوف', 'تقوّي الترابط', 'لا أثر لها'], a: [1], pg: 8, ex: 'تضعف الشائعات الثقة وتفرّق الصفوف وتشغل المجتمع عن أولوياته.', topic: 'الأمانة' },
  { q: 'أي الأمثلة التالية من حقوق الوطن على المواطن؟', o: ['المطالبة دون عطاء', 'صون مقدراته والمحافظة عليها', 'إهمال الممتلكات العامة', 'الاكتفاء بالانتقاد'], a: [1], pg: 9, ex: 'من حقوق الوطن صون مقدراته وأداء الواجب بإخلاص.', topic: 'الحقوق والواجبات' },
  { q: 'كيف تسهم الأسرة في تعزيز الانتماء؟', o: ['بالقدوة الحسنة والحوار الهادئ', 'بالتلقين وحده', 'بترك الأمر للمدرسة', 'بتجنب الحديث عن الوطن'], a: [0], pg: 10, ex: 'تغرس الأسرة القيم الوطنية بالقدوة الحسنة والحوار الهادئ.', topic: 'دور الأسرة' },
  { q: 'متى يكون النقد بنّاءً؟', o: ['إذا قُصد به الإساءة', 'إذا اقترن بالاحترام وقدّم حلولًا', 'إذا كان علنيًا فقط', 'إذا تكرر كثيرًا'], a: [1], pg: 11, ex: 'النقد البنّاء يقترن بالاحترام ويقدّم حلولًا قابلة للتطبيق.', topic: 'الحوار' },
  { q: 'ما أبرز ثمرات الوحدة الوطنية؟', o: ['كثرة الخلافات', 'الأمن والاستقرار والتنمية', 'ضعف الثقة', 'العزلة'], a: [1], pg: 11, ex: 'من ثمرات الوحدة الوطنية الأمن والاستقرار والتنمية المستمرة.', topic: 'ثمرات الوحدة' },
];

/* ---------- findings: each one is tagged observed (seen in the running demo), code (read in source) or both ---------- */
const FINDINGS = [
  { id: 'S1', s: 'student', sev: 'P1', ev: 'observed', t: 'The result reads "20 / 5" for 5 correct out of 20', why: 'In a right-to-left paragraph, two numbers around a slash flip. The one moment a student waits for shows the wrong order.', fix: 'Wrap the pair in a left-to-right isolate, or write "5 من 20". Use the same helper for every number pair.', ref: 'participation.tsx:290', step: 7 },
  { id: 'S2', s: 'student', sev: 'P1', ev: 'observed', t: 'The final Submit button sits below the fold on question 20', why: 'At 1366x768 the card scrolls inside a fixed overlay. After the last lock, "Next" is disabled and the only forward action is out of view.', fix: 'A review and submit sheet that opens by itself after the last lock, plus a sticky footer action.', ref: 'participation.tsx:479, globals.css:4810', step: 6 },
  { id: 'S3', s: 'student', sev: 'P1', ev: 'code', t: 'The intro prints the raw state code to students', why: 'The line renders competition.state as stored, so a student can read "OPEN" or "SCHEDULED" in an Arabic sentence.', fix: 'Map states to plain Arabic and show the closing time as a relative phrase with the exact time on demand.', ref: 'participation.tsx:250', step: 1 },
  { id: 'S4', s: 'student', sev: 'P2', ev: 'observed', t: 'The book opens on the cover of a 66-page PDF with no way to find a chapter', why: 'The first thing a student sees in the reader is the cover, full width. There is no contents list, outline or remembered position. Finding the topic is most of the work.', fix: 'Open at the contents page, add the PDF outline as a jump menu, and restore the last page. In-book search is a separate decision for the committee.', ref: 'pdf-book-reader.tsx:124', step: 2 },
  { id: 'S5', s: 'student', sev: 'P2', ev: 'both', t: 'The hint appears from nowhere and is never explained', why: 'The link only exists after the student scrolls past the source page. Nobody is told that rule, so most will never find the hint.', fix: 'Show a locked hint with one plain sentence about how it unlocks, without revealing the source page.', ref: 'participation.tsx:450, competition-domain.ts:159', step: 4 },
  { id: 'S6', s: 'student', sev: 'P2', ev: 'observed', t: 'The reader toolbar is cramped and reads backwards', why: 'Zoom shows "+ 100% -" in a right-to-left bar, the minus is a hyphen, the download icon has no label, and the title row wraps at 1024px.', fix: 'One compact bar: contents, page stepper, zoom, night mode. Real minus glyph, labelled controls, 40px targets.', ref: 'pdf-book-reader.tsx:234', step: 2 },
  { id: 'S7', s: 'student', sev: 'P2', ev: 'code', t: 'After locking, the explanation never points back to the book', why: 'The student has just learned the right answer but cannot open the page it came from. That is the best learning moment in the whole flow.', fix: 'Add an "open page N" chip in the feedback. It is safe because the answer is already immutable.', ref: 'participation.tsx:411', step: 3 },
  { id: 'S8', s: 'student', sev: 'P2', ev: 'observed', t: 'Progress is split across a 3px bar, a counter and a 20-cell map', why: 'None of them says right or wrong. The map only separates answered from current, and below 360px it turns into a dropdown.', fix: 'One segmented strip that doubles as the map: correct, incorrect, pending, current. Each cell carries an icon, not only a colour.', ref: 'participation.tsx:341, 501', step: 3 },
  { id: 'S9', s: 'student', sev: 'P2', ev: 'observed', t: 'On a phone the book replaces the question', why: 'The book is a full-screen dialog. The student must memorise the question, close the book and re-read. The screen below the map is empty.', fix: 'A draggable lower pane: the question stays visible while the book is open.', ref: 'participation.tsx:526', step: 2 },
  { id: 'S10', s: 'student', sev: 'P2', ev: 'observed', t: 'Sync copy is wrong and repeated', why: '"جارٍ مزامنة 1 أحداث" has the wrong number agreement. A pending lock shows three lines saying nearly the same thing.', fix: 'Use Arabic plural rules and one calm line. Move the retry into the status chip.', ref: 'participation.tsx:333, 426', step: 5 },
  { id: 'S11', s: 'student', sev: 'P3', ev: 'code', t: 'No keyboard shortcuts for a task repeated 20 times', why: 'Options, lock and next all need the pointer. The radio circle duplicates the letter badge.', fix: '1 to 4 select, Enter locks then advances, arrows move. Drop the radio circle.', ref: 'participation.tsx:378', step: 3 },
  { id: 'S12', s: 'student', sev: 'P3', ev: 'observed', t: 'The receipt is a number and a statement, nothing to learn from', why: 'No review of missed questions, no pages to revisit, and the participant number is set in a typewriter face with a tiny copy link.', fix: 'Score as a sentence with the same segmented strip, a missed-question review with page links, and a ticket-style number.', ref: 'participation.tsx:264', step: 7 },
  { id: 'S13', s: 'student', sev: 'P3', ev: 'code', t: 'A hint can never unlock when the source is the last page', why: 'Eligibility is "pages read beyond the source". If the source is the final page there is no page beyond it.', fix: 'Reject it in the question editor, or unlock on reaching the page for the last page only.', ref: 'competition-domain.ts:159', step: 4 },
  { id: 'A1', s: 'admin', sev: 'P1', ev: 'code', t: 'Open, close, publish and unpublish run with no confirmation', why: 'Seven equal-weight buttons, no impact summary, no reason shown for the disabled ones. One mis-click on "Open now" exposes the competition to every registrant.', fix: 'One next action at a time with its preconditions, and a hold-to-confirm sheet that states the impact.', ref: 'admin-competition.tsx:150', tab: 'admin' },
  { id: 'A2', s: 'admin', sev: 'P1', ev: 'observed', t: 'The state is a raw code and the page mixes a settings form with lifecycle controls', why: '"DRAFT · الإصدار 1" is the main status line, and the full SHA-256 sits in the main notice with its own scrollbar.', fix: 'Plain-language state, a six-step track, and the checksum behind a disclosure.', ref: 'admin-competition.tsx:26', tab: 'admin' },
  { id: 'A3', s: 'admin', sev: 'P2', ev: 'observed', t: 'Date fields show a US placeholder and a sentence floats in the form grid', why: '"mm/dd/yyyy --:-- --" appears in an Arabic interface. The policy sentence about feedback sits in a grid cell as if it were a field.', fix: 'Show the schedule as formatted Arabic text with a countdown, and move policy sentences into their own group.', ref: 'admin-competition.tsx:66, 95', tab: 'admin' },
  { id: 'A4', s: 'admin', sev: 'P2', ev: 'code', t: 'Two question fields change nothing a student can see', why: 'Hint start and end are stored and validated, but the participant view always shows the source page and the one before it.', fix: 'Derive the hint from the source page in the editor and remove the two inputs, or make the participant view honour them.', ref: 'participation.tsx:453, admin-question-bank.tsx:221', tab: 'admin' },
  { id: 'A5', s: 'admin', sev: 'P2', ev: 'observed', t: 'The question bank is 60 near-identical cards with no progress toward 20 per stage', why: 'Every card repeats the same two buttons, the approve button is disabled grey on all of them, and version history is raw JSON.', fix: 'Stage counters at the top, compact rows, bulk approve, and a live student preview in the editor.', ref: 'admin-question-bank.tsx:311', tab: 'admin' },
  { id: 'A6', s: 'admin', sev: 'P2', ev: 'observed', t: 'Book coverage is 66 identical boxes, mostly "0 أسئلة"', why: 'A long scroll to see a pattern that one row could show.', fix: 'A single density strip, with crowded pages flagged.', ref: 'admin-question-bank.tsx:420', tab: 'admin' },
  { id: 'A7', s: 'admin', sev: 'P2', ev: 'observed', t: 'Settings and the student result screen are never shown together', why: 'The leaderboard and feedback policy are chosen from a dropdown. Nothing shows what a student will actually read.', fix: 'A "what the student sees" preview next to the result-visibility choice.', ref: 'admin-competition.tsx:97', tab: 'admin' },
  { id: 'A8', s: 'admin', sev: 'P3', ev: 'observed', t: 'Duplicate headings and a marketing line in an operations screen', why: 'The tab name appears as a small label, as the page title and again as the card title. "إدارة واعية. تجربة متكاملة." sits above all three.', fix: 'One heading per level and no tagline in the work area.', ref: 'admin.tsx:376', tab: 'admin' },
];

/* ---------- journey steps ---------- */
const STEPS = [
  { id: 1, name: 'Intro', who: 'Opens the competition', moment: 'A 13-year-old taps the link from school. They want to know what will happen, how long it takes, and whether they can stop.',
    today: ['S3'], shot: null,
    nocap: ['أهلًا {الاسم}', '{المرحلة} · 20 سؤالًا من الكتاب، دون مؤقت لكل سؤال', 'حالة المسابقة: OPEN · تفتح ...'],
    proposed: ['Four facts a student can read in five seconds, one primary action.', 'A "book is ready offline" line, since the reader already caches the PDF.', 'Closing time as "in 3 days", exact time one tap away.', 'The 3D book opens when the student starts. It is the one authored moment.'],
    lens: [['Impeccable', 'Jordan persona: first action clear in five seconds'], ['Taste', 'one primary CTA, hero fits the first screen'], ['img2threejs', 'procedural book, stylised'], ['Emil', 'rare moment, so motion earns its place']] },
  { id: 2, name: 'Reading', who: 'Looks for the answer in the book', moment: 'The question is on the right, the book on the left. The student scrolls to find the chapter.',
    today: ['S4', 'S6', 'S9'], shot: { d: 'exam_hint', m: 'm_exam', pins: [[33.5, 17.4, 'S4'], [6, 17.3, 'S6'], [76, 88, 'S8']], mpins: [[50, 92, 'S9']] },
    proposed: ['Opens at the contents page, with a contents menu and the last page restored.', 'One bar: contents, page stepper, zoom, night mode. Real minus, 40px targets.', 'Phone: draggable lower pane, so the question never disappears.', 'Optional in-book search (switch above). A committee decision, because it changes difficulty.'],
    lens: [['Impeccable', 'Casey persona: one thumb, interruptions, no memory bridge'], ['Taste', 'dark mode parity, honest controls'], ['Emil', 'drag with momentum snap, no animation on keyboard paging']] },
  { id: 3, name: 'Answering', who: 'Chooses and locks an answer', moment: 'The student picks an option, locks it, and sees whether they were right. The answer cannot change afterwards.',
    today: ['S7', 'S8', 'S11'], shot: { d: 'exam_hint', m: 'm_exam', pins: [[76, 62, 'S7'], [76, 88, 'S8'], [96, 41, 'S11']], mpins: [[50, 80, 'S8']] },
    proposed: ['Letter badge only, no radio circle. 1 to 4 select, Enter locks.', 'The lock button stays in a sticky footer, so it never scrolls away.', 'Feedback slides in at 220ms and offers "open page N" for the explanation.', 'The top strip turns green or red with an icon, and is the question map.'],
    lens: [['Impeccable', 'Alex persona: keyboard path for a task repeated 20 times'], ['Emil', 'press scale 0.97, ease-out 160 to 220ms, no animation for keyboard moves'], ['Taste', 'tactile :active, never colour alone']] },
  { id: 4, name: 'Hint', who: 'Wants a hint', moment: 'The student is stuck and has read for a while. The hint shows two pages only.',
    today: ['S5', 'S13'], shot: { d: 'exam_hint', pins: [[25.6, 23.8, 'S5'], [57.8, 71, 'S5']] },
    proposed: ['A locked hint states the rule in one sentence, without naming the page.', 'Unlocked, it says exactly what it shows: two pages.', 'A visible way back to the whole book.'],
    lens: [['Impeccable', 'heuristic 6 and 10: recognition and contextual help'], ['Emil', 'state change, not decoration: 160ms crossfade']] },
  { id: 5, name: 'Connection', who: 'Loses the connection', moment: 'The signal drops in the middle of the exam, or the tab reloads. Answers are already stored on the device.',
    today: ['S10'], shot: { d: 'exam_locked', pins: [[58.6, 17, 'S10'], [76, 71, 'S10']] },
    proposed: ['Switch "Offline" above, then lock an answer.', 'One calm banner, one status chip, one pending cell in the strip.', 'On reconnect the result flips in place. No blocking dialogs.'],
    lens: [['Impeccable', 'heuristic 1 and 9: status and recovery'], ['Emil', 'asymmetric timing: banner in 220ms, quiet exit']] },
  { id: 6, name: 'Submit', who: 'Sends the final answers', moment: 'All questions are locked. The student needs a clear last step and a sense that it is final.',
    today: ['S2'], shot: { d: 'exam_locked', pins: [[90, 97, 'S2']] },
    proposed: ['A review sheet opens after the last lock: the strip, the counts, one warning, one action.', '"Review first" returns without losing place.'],
    lens: [['Impeccable', 'heuristic 5: prevent the irreversible slip'], ['Taste', 'one intent per CTA']] },
  { id: 7, name: 'Result', who: 'Sees the result', moment: 'The student wants to know how they did, keep their number, and know what happens next.',
    today: ['S1', 'S12'], shot: { d: 'receipt', pins: [[57.5, 85.7, 'S1'], [61.5, 55.7, 'S12']] },
    proposed: ['The score is a sentence plus the same segmented strip.', 'Missed questions open with the explanation and a page chip that opens the reader.', 'The participant number is a ticket with a clear copy action.', 'The leaderboard line follows the committee setting (try it in the admin view).', 'The book closes on the ticket. Same motif as the opening.'],
    lens: [['Impeccable', 'peak-end rule: the end is what students remember'], ['img2threejs', 'same model, closing motion'], ['Taste', 'avoid the big-number-and-label template']] },
];

const SCORES = {
  student: { max: 40, rows: [
    ['Visibility of system status', 3, 'Save state exists. Sync copy is wrong and submit is hidden.'],
    ['Match with the real world', 3, 'Plain Arabic. The raw state code leaks in the intro.'],
    ['User control and freedom', 3, 'Locking is deliberate policy. No review after submit.'],
    ['Consistency and standards', 3, 'One component language. Reader controls break it.'],
    ['Error prevention', 3, 'Select then lock is good. Submit has no review.'],
    ['Recognition over recall', 2, 'Hint rule is invisible, book position is unknown.'],
    ['Flexibility and efficiency', 2, 'No shortcuts, no search, no restore of position.'],
    ['Aesthetic and minimalist design', 3, 'Clean, but three progress widgets say one thing.'],
    ['Error recovery', 3, 'Offline durability is strong. The copy is not.'],
    ['Help and documentation', 2, 'Rules live on the intro only.'],
  ] },
  admin: { max: 36, na: 'Error recovery was not exercised, so it is scored n/a.', rows: [
    ['Visibility of system status', 2, 'Raw DRAFT code, no readiness view.'],
    ['Match with the real world', 2, 'Version and checksum jargon in the main status line.'],
    ['User control and freedom', 2, 'No confirmation, no undo for lifecycle actions.'],
    ['Consistency and standards', 3, 'Components are consistent.'],
    ['Error prevention', 1, 'Irreversible actions are one click.'],
    ['Recognition over recall', 2, 'Disabled buttons give no reason.'],
    ['Flexibility and efficiency', 2, 'No bulk approve, no stage counters.'],
    ['Aesthetic and minimalist design', 2, 'Duplicate headings, floating sentence.'],
    ['Help and documentation', 2, 'One footnote at the bottom of the form.'],
  ] },
};
const PERSONAS = [
  ['Jordan, first-timer', 'Reads the intro, sees "OPEN" in the middle of an Arabic sentence, and cannot tell how long the competition takes. In the exam the hint is invisible, so the only way forward is to scroll a 66-page book from the cover.'],
  ['Casey, one hand on a phone', 'Opens the book and the question vanishes. Reading the page, then remembering the options, then closing the book to answer. Below the map the screen is empty while the book is hidden.'],
  ['Sam, keyboard and screen reader', 'Status icons carry text, which is good. The question map is 20 buttons in a row with no shortcuts, and the pending-sync line announces "1 أحداث".'],
];

/* ---------- ideas ---------- */
const IDEAS = [
  { id: 'I01', t: 'Review and submit sheet', fixes: ['S2'], eff: 'M', imp: 'High', where: 'participation.tsx, globals.css', lens: 'Impeccable, Emil' },
  { id: 'I02', t: 'Result numerals and Arabic plural helper', fixes: ['S1', 'S10'], eff: 'S', imp: 'High', where: 'participation.tsx', lens: 'Impeccable' },
  { id: 'I03', t: 'Intro: plain-language state, four facts, offline readiness', fixes: ['S3'], eff: 'M', imp: 'High', where: 'participation.tsx', lens: 'Impeccable, Taste' },
  { id: 'I04', t: 'Segmented progress strip that doubles as the question map', fixes: ['S8'], eff: 'M', imp: 'Med', where: 'participation.tsx, globals.css', lens: 'Impeccable, Emil' },
  { id: 'I05', t: 'Reader opens at contents, outline menu, restore last page', fixes: ['S4', 'S6'], eff: 'M', imp: 'High', where: 'pdf-book-reader.tsx', lens: 'Impeccable' },
  { id: 'I06', t: 'Visible hint states with the unlock rule in words', fixes: ['S5', 'S13'], eff: 'S', imp: 'Med', where: 'participation.tsx, competition-domain.ts', lens: 'Impeccable' },
  { id: 'I07', t: 'Source-page chip in the feedback after locking', fixes: ['S7'], eff: 'S', imp: 'High', where: 'participation.tsx', lens: 'Impeccable' },
  { id: 'I08', t: 'Phone: draggable book pane with the question visible', fixes: ['S9'], eff: 'L', imp: 'High', where: 'participation.tsx, globals.css', lens: 'Impeccable, Emil' },
  { id: 'I09', t: 'Keyboard shortcuts for options, lock and navigation', fixes: ['S11'], eff: 'S', imp: 'Med', where: 'participation.tsx', lens: 'Emil' },
  { id: 'I10', t: 'Result screen with review, pages to revisit and ticket number', fixes: ['S12'], eff: 'M', imp: 'High', where: 'participation.tsx', lens: 'Impeccable, Taste' },
  { id: 'I11', t: '3D book on the intro and result screens', fixes: [], eff: 'M', imp: 'Med', where: 'new component, three@r128 or r16x', lens: 'img2threejs, Emil' },
  { id: 'I12', t: 'Night reading mode for the book', fixes: [], eff: 'S', imp: 'Med', where: 'pdf-book-reader.tsx', lens: 'Taste' },
  { id: 'I13', t: 'In-book search (committee decision first)', fixes: [], eff: 'M', imp: 'Med', where: 'pdf-book-reader.tsx', lens: 'Impeccable' },
  { id: 'I14', t: 'Admin launch control: track, readiness checklist, hold-to-confirm', fixes: ['A1', 'A2'], eff: 'L', imp: 'High', where: 'admin-competition.tsx', lens: 'Impeccable, Emil' },
  { id: 'I15', t: 'Admin "what the student sees" preview for result visibility', fixes: ['A3', 'A7'], eff: 'M', imp: 'Med', where: 'admin-competition.tsx', lens: 'Impeccable' },
  { id: 'I16', t: 'Question workshop: live student preview, stage counters, remove dead hint fields', fixes: ['A4', 'A5'], eff: 'M', imp: 'High', where: 'admin-question-bank.tsx', lens: 'Impeccable' },
  { id: 'I17', t: 'Coverage density strip', fixes: ['A6'], eff: 'S', imp: 'Low', where: 'admin-question-bank.tsx', lens: 'Impeccable' },
  { id: 'I18', t: 'Adopt DESIGN.md and the motion rules as the single source', fixes: [], eff: 'S', imp: 'Med', where: 'DESIGN.md (written)', lens: 'design-md, Emil' },
];

/* admin shots: Today view */
const ADMIN_SHOTS = [
  { k: 'admin_top', t: 'Competition page, top', pins: [[65.9, 49.3, 'A2'], [34.4, 54.6, 'A2'], [75.4, 38.3, 'A8'], [75.4, 16, 'A8']] },
  { k: 'admin_actions', t: 'Competition page, actions', pins: [[24.9, 18, 'A3'], [22.7, 9.8, 'A3'], [51, 72.9, 'A1'], [59.8, 63.8, 'A1']] },
  { k: 'admin_questions', t: 'Question bank', pins: [[65.3, 37, 'A5'], [72, 42, 'A5']] },
  { k: 'admin_coverage', t: 'Book coverage', pins: [[44, 39, 'A6']] },
];
