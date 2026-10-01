'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { DemoNote, Icon } from './ui';

const highlights = [
  {
    label: 'المعرفة في متناولك',
    title: 'كتاب يفتح باب الانتماء.',
    text: 'اقرأ كتاب المسابقة، وارجع إليه في أي وقت أثناء الإجابة.',
    icon: 'book',
  },
  {
    label: 'مساحة للفهم والتأمل',
    title: 'خذ وقتك. المعرفة تستحق.',
    text: 'لا مؤقت للإجابة، ويمكنك مراجعة الأسئلة قبل الإرسال.',
    icon: 'clock',
  },
  {
    label: 'فرص متكافئة للجميع',
    title: 'معرفتك هي ما يصنع الفرق.',
    text: 'تُحتسب النتائج وفق الدرجات، ولا تُستخدم السرعة للفصل عند التعادل.',
    icon: 'shield',
  },
];

export function CompetitionHero() {
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const reducedMotion = mounted && prefersReducedMotion;
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const running = !paused && !reducedMotion && visible && inView && !hovered && !focused;

  useEffect(() => {
    setMounted(true);
    const visibility = () => setVisible(!document.hidden);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(
      () => setActive((value) => (value + 1) % highlights.length),
      7000,
    );
    return () => window.clearInterval(timer);
  }, [running, active]);

  const highlight = highlights[active];
  return (
    <section
      ref={ref}
      className="competition-hero"
      data-motion={running ? 'running' : 'paused'}
      aria-label="مسابقة الانتماء واللحمة الوطنية"
    >
      <div className="competition-hero-texture" aria-hidden="true" />
      <div className="container competition-hero-grid">
        <div className="competition-hero-copy">
          <p className="eyebrow light">
            <span /> معرفة تُلهمنا. وانتماء يجمعنا.
          </p>
          <h1>
            <span className="sr-only">مسابقة الانتماء واللحمة الوطنية</span>
            <Image
              src="/images/competition/type-ivory-0.png"
              alt=""
              width={877}
              height={168}
              sizes="(max-width: 760px) 88vw, 46vw"
              preload
            />
            <Image
              src="/images/competition/type-ivory-1.png"
              alt=""
              width={894}
              height={170}
              sizes="(max-width: 760px) 88vw, 46vw"
              preload
            />
            <span className="identity-hero-title" aria-hidden="true">
              <small>مسابقة</small>
              <span>الانتماء</span>
              <span>واللحمة الوطنية</span>
            </span>
          </h1>
          <p className="competition-hero-intro">
            نقرأ لنفهم معنى الانتماء، ونشارك في تعزيز
            <br className="desktop-only" /> اللحمة الوطنية. رحلة معرفية تبدأ بصفحة.
          </p>
          <div className="button-row">
            <Link href="/register" className="button hero-gold">
              سجّل في المسابقة <Icon />
            </Link>
            <Link href="/book" className="button hero-outline">
              <Icon name="book" /> اقرأ كتاب المسابقة
            </Link>
          </div>
          <p className="competition-hero-audience">
            لطلاب وطالبات المتوسطة والثانوية والجامعات والكليات المعتمدة
          </p>
          <div
            className="hero-highlights"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
            }}
          >
            <div className="hero-highlight-content" aria-live="off">
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={active}
                  className="hero-highlight"
                  initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
                  transition={{ duration: reducedMotion ? 0 : 0.35 }}
                >
                  <Icon name={highlight.icon} size={27} />
                  <div>
                    <span>{highlight.label}</span>
                    <h2>{highlight.title}</h2>
                    <p>{highlight.text}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="hero-motion-controls">
              <div className="hero-slide-selectors" aria-label="اختيار معلومة">
                {highlights.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    aria-label={item.label}
                    aria-pressed={active === index}
                    onClick={() => {
                      setActive(index);
                      setPaused(true);
                    }}
                  >
                    <span />
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="hero-pause"
                aria-pressed={paused || Boolean(reducedMotion)}
                disabled={Boolean(reducedMotion)}
                onClick={() => setPaused(!paused)}
              >
                {reducedMotion ? 'الحركة مخفّضة' : paused ? 'تشغيل الحركة' : 'إيقاف الحركة'}
                <span aria-hidden="true">{paused || reducedMotion ? '▷' : 'Ⅱ'}</span>
              </button>
            </div>
          </div>
        </div>
        <div className="competition-book-scene">
          <div className="book-halo" aria-hidden="true" />
          <div className="book-orbit" aria-hidden="true" />
          <div className="competition-book-float">
            <Link
              href="/book"
              className="competition-book-link"
              aria-label="افتح كتاب الانتماء واللحمة الوطنية"
            >
              <Image
                src="/images/competition/book-cover.png"
                alt="غلاف كتاب الانتماء واللحمة الوطنية لعبدالرحمن بن عبدالله السند"
                width={921}
                height={1300}
                sizes="(max-width: 760px) 62vw, 330px"
                preload
              />
            </Link>
          </div>
          <p className="book-scene-caption">
            <span /> كتاب المسابقة <span />
          </p>
          <p className="book-scene-author">عبدالرحمن بن عبدالله السند</p>
        </div>
      </div>
      <div className="container competition-hero-bottom">
        <DemoNote compact />
        <a href="#organizations">
          الجهات المشاركة <span aria-hidden="true">↓</span>
        </a>
        <span>نقرأ لننتمي</span>
      </div>
    </section>
  );
}
