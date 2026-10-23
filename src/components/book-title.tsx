import { preload } from 'react-dom';

// The competition title as it is lettered on the book cover. The artwork is the cover's own
// calligraphy, extracted as vector paths (public/images/competition/book-title.svg) and drawn
// through a CSS mask in `.book-title`, so it takes the colour of the surrounding text.
const artwork = '/images/competition/book-title.svg';

export function BookTitle() {
  preload(artwork, { as: 'image' });
  return (
    <>
      <span className="sr-only">مسابقة الانتماء واللحمة الوطنية</span>
      <small className="book-title-kicker" aria-hidden="true">
        مسابقة
      </small>
      <span className="book-title" aria-hidden="true" />
    </>
  );
}
