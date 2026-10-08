import type { ReactNode } from 'react';
import { Icon } from './ui';

export const answerLetters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
export type AnswerState = string;

// One answer row. The student exam and the committee's read-only preview both render this, so the
// two cannot drift apart.
export function AnswerOption({
  name,
  type,
  index,
  text,
  state,
  checked,
  result,
  onChange,
  readOnly = false,
}: {
  name: string;
  type: 'single_choice' | 'multi_select';
  index: number;
  text: string;
  state: AnswerState;
  checked: boolean;
  result: 'correct-chosen' | 'correct' | 'incorrect' | null;
  onChange?: () => void;
  readOnly?: boolean;
}) {
  return (
    <label className={`answer-option ${state}`}>
      <input
        type={type === 'multi_select' ? 'checkbox' : 'radio'}
        name={name}
        checked={checked}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
        onChange={readOnly ? () => {} : onChange}
      />
      <span className="answer-letter">{answerLetters[index]}</span>
      <span className="answer-text">{text}</span>
      {result === 'incorrect' ? (
        <span className="answer-result">
          <Icon name="close" size={16} />
          <span className="answer-result-label">غير صحيحة</span>
        </span>
      ) : result ? (
        <span className="answer-result">
          <Icon name="check" size={16} />
          <span className="answer-result-label">
            {result === 'correct-chosen' ? 'إجابتك صحيحة' : 'الصحيحة'}
          </span>
        </span>
      ) : null}
    </label>
  );
}

// The feedback block shown after an answer is locked.
export function AnswerFeedback({
  status,
  explanation,
  children,
}: {
  status: 'correct' | 'incorrect' | 'pending' | 'checking';
  explanation: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`answer-feedback ${status === 'pending' || status === 'checking' ? '' : status}`}
      role="status"
    >
      <strong>
        <Icon
          name={
            status === 'checking'
              ? 'refresh'
              : status === 'pending'
                ? 'lock'
                : status === 'correct'
                  ? 'check'
                  : 'close'
          }
          size={18}
          className={status === 'checking' ? 'spin' : undefined}
        />
        {status === 'checking'
          ? 'جارٍ التحقق من إجابتك…'
          : status === 'pending'
            ? 'تم تثبيت إجابتك'
            : status === 'correct'
              ? 'إجابتك صحيحة'
              : 'إجابتك غير صحيحة'}
      </strong>
      <p>
        {status === 'checking'
          ? 'ثوانٍ قليلة ونعرض لك النتيجة.'
          : status === 'pending'
            ? 'ستظهر النتيجة عند عودة الاتصال.'
            : explanation}
      </p>
      {children}
    </div>
  );
}
