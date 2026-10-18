import type { Database, Queryable } from './database';
import { identityLookup, normalizePhone, keyedHash } from './otp-crypto';
import { isProduction } from './runtime';
import { createHash } from 'node:crypto';

// Ordered, transactional migrations shared by PostgreSQL and local PGlite.
export const migrations = [
  {
    id: '001_baseline',
    sql: `
    CREATE TABLE IF NOT EXISTS participants (id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, backup TEXT, stage TEXT NOT NULL, region TEXT NOT NULL, locality TEXT NOT NULL, village TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, participant_id TEXT, role TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, body JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, participant_id TEXT UNIQUE NOT NULL REFERENCES participants(id), questions JSONB NOT NULL, answers JSONB NOT NULL DEFAULT '{}', revision INT NOT NULL DEFAULT 0, score INT, submitted_at TIMESTAMPTZ, receipt TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS audit (id BIGSERIAL PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, value JSONB NOT NULL);
    ALTER TABLE participants ADD COLUMN IF NOT EXISTS institution TEXT;
    ALTER TABLE participants ADD COLUMN IF NOT EXISTS gender TEXT;
  `,
  },
  {
    id: '002_secure_otp',
    sql: `
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_source TEXT NOT NULL DEFAULT 'legacy';
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS actor TEXT;
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE otp_challenges (
      id TEXT PRIMARY KEY, participant_id TEXT REFERENCES participants(id),
      purpose TEXT NOT NULL CHECK(purpose IN ('REGISTER','LOGIN','ADMIN_TEST')),
      phone_e164 TEXT NOT NULL, phone_hash TEXT NOT NULL, provider TEXT NOT NULL,
      provider_reference TEXT, otp_digest TEXT, payload_json JSONB NOT NULL DEFAULT '{}',
      attempt_count INT NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 5),
      send_count INT NOT NULL DEFAULT 1, last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      request_ip_hash TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('SENDING','SENT','FAILED','USED','SUPERSEDED')),
      admin_actor TEXT, config_fingerprint TEXT NOT NULL
    );
    CREATE INDEX otp_expiry ON otp_challenges(expires_at);
    CREATE INDEX otp_phone ON otp_challenges(phone_hash, created_at);
    CREATE TABLE security_locks (key TEXT PRIMARY KEY, touched_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE otp_rate_events (id BIGSERIAL PRIMARY KEY, key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX otp_rate_lookup ON otp_rate_events(key, created_at);
    CREATE TABLE security_events (id BIGSERIAL PRIMARY KEY, action TEXT NOT NULL, actor TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX security_events_time ON security_events(created_at, action);
    INSERT INTO settings(id,value) VALUES ('otp_security','{}') ON CONFLICT DO NOTHING;
  `,
  },
  {
    id: '003_book_competitions',
    sql: `
    CREATE TABLE book_versions (id TEXT PRIMARY KEY, body JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE competitions (id TEXT PRIMARY KEY, body JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    INSERT INTO competitions(id,body) VALUES ('legacy-demo','{"id":"legacy-demo","title":"العرض السابق (أرشيف)","state":"CLOSED","opensAt":null,"closesAt":null,"closedAt":null,"feedbackMode":"formal","leaderboardMode":"hidden","closingPolicy":"immediate","graceMinutes":0,"bookVersionId":"legacy","frozenAt":null,"version":1}');
    ALTER TABLE attempts DROP CONSTRAINT IF EXISTS attempts_participant_id_key;
    ALTER TABLE attempts ADD COLUMN competition_id TEXT NOT NULL DEFAULT 'legacy-demo' REFERENCES competitions(id);
    ALTER TABLE attempts ADD COLUMN stage TEXT;
    ALTER TABLE attempts ADD COLUMN participant_number TEXT;
    ALTER TABLE attempts ADD COLUMN max_score INT;
    ALTER TABLE attempts ADD COLUMN percentage DOUBLE PRECISION;
    ALTER TABLE attempts ADD COLUMN recovery_until TIMESTAMPTZ;
    ALTER TABLE attempts ADD CONSTRAINT attempts_participant_competition_key UNIQUE(participant_id,competition_id);
    ALTER TABLE attempts ADD CONSTRAINT attempts_competition_number_key UNIQUE(competition_id,participant_number);
    UPDATE attempts SET max_score=jsonb_array_length(questions),percentage=CASE WHEN score IS NOT NULL AND jsonb_array_length(questions)>0 THEN score*100.0/jsonb_array_length(questions) END;
    CREATE TABLE competition_question_sets (competition_id TEXT NOT NULL REFERENCES competitions(id), stage TEXT NOT NULL CHECK(stage IN ('middle','highschool','university')), questions JSONB NOT NULL, PRIMARY KEY(competition_id,stage));
    CREATE TABLE question_versions (question_id TEXT NOT NULL REFERENCES questions(id), version INT NOT NULL, body JSONB NOT NULL, actor TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(question_id,version));
    INSERT INTO question_versions(question_id,version,body,actor) SELECT id,(body->>'version')::int,body,'migration' FROM questions;
    CREATE TABLE attempt_questions (attempt_id TEXT NOT NULL REFERENCES attempts(id), question_id TEXT NOT NULL, ordinal INT NOT NULL, snapshot JSONB NOT NULL, PRIMARY KEY(attempt_id,question_id), UNIQUE(attempt_id,ordinal));
    CREATE TABLE attempt_answers (attempt_id TEXT NOT NULL, question_id TEXT NOT NULL, selected JSONB NOT NULL, checked_at TIMESTAMPTZ, synced_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(attempt_id,question_id), FOREIGN KEY(attempt_id,question_id) REFERENCES attempt_questions(attempt_id,question_id));
    CREATE TABLE attempt_events (attempt_id TEXT NOT NULL REFERENCES attempts(id), client_event_id TEXT NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(attempt_id,client_event_id));
    CREATE TABLE admin_test_runs (id TEXT PRIMARY KEY, actor TEXT NOT NULL, competition_id TEXT NOT NULL REFERENCES competitions(id), stage TEXT NOT NULL, config JSONB NOT NULL, questions JSONB NOT NULL, answers JSONB NOT NULL DEFAULT '{}', revision INT NOT NULL DEFAULT 0, submitted_at TIMESTAMPTZ, score INT, percentage DOUBLE PRECISION, participant_number TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE admin_test_events (run_id TEXT NOT NULL REFERENCES admin_test_runs(id), client_event_id TEXT NOT NULL, payload JSONB NOT NULL, PRIMARY KEY(run_id,client_event_id));
    CREATE TABLE attempt_recoveries (id BIGSERIAL PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id), actor TEXT NOT NULL, reason TEXT NOT NULL, before_state JSONB NOT NULL, after_state JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX attempts_campaign_stage ON attempts(competition_id,stage,submitted_at);
    `,
  },
  {
    id: '004_question_corrections',
    sql: `CREATE TABLE competition_corrections (
      competition_id TEXT NOT NULL REFERENCES competitions(id), question_id TEXT NOT NULL,
      policy TEXT NOT NULL CHECK(policy='award_credit'), reason TEXT NOT NULL, actor TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(competition_id,question_id)
    );`,
  },
  {
    id: '005_backend_integrity',
    sql: `
      ALTER TABLE admin_test_runs ADD COLUMN invalidated_at TIMESTAMPTZ;
      ALTER TABLE admin_test_runs ADD CONSTRAINT admin_test_stage CHECK(stage IN ('middle','highschool','university'));
      ALTER TABLE attempts ADD CONSTRAINT attempts_stage CHECK(stage IS NULL OR stage IN ('middle','highschool','university'));
      ALTER TABLE attempts ADD CONSTRAINT attempts_revision CHECK(revision >= 0);
      ALTER TABLE attempts ADD CONSTRAINT attempts_score CHECK(score IS NULL OR (score >= 0 AND score <= max_score));
      ALTER TABLE attempts ADD CONSTRAINT attempts_percentage CHECK(percentage IS NULL OR percentage BETWEEN 0 AND 100);
      ALTER TABLE attempt_questions ADD CONSTRAINT attempt_question_ordinal CHECK(ordinal BETWEEN 0 AND 19);
      ALTER TABLE attempt_answers ADD CONSTRAINT attempt_answer_array CHECK(jsonb_typeof(selected)='array');
      CREATE INDEX admin_tests_owner ON admin_test_runs(actor,competition_id,stage) WHERE invalidated_at IS NULL;
      CREATE INDEX attempt_recovery_expiry ON attempts(competition_id,recovery_until) WHERE recovery_until IS NOT NULL;
      CREATE INDEX otp_participant ON otp_challenges(participant_id);
      CREATE INDEX sessions_participant ON sessions(participant_id);
      CREATE INDEX attempt_questions_question ON attempt_questions(question_id);
      CREATE INDEX question_bank_stage ON questions((body->>'stage'),(body->>'bookVersionId'));
      CREATE INDEX attempt_recoveries_attempt ON attempt_recoveries(attempt_id);
    `,
  },
  {
    id: '006_immutable_attempts',
    sql: `
      CREATE FUNCTION guard_attempt_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.questions IS DISTINCT FROM NEW.questions OR OLD.participant_id IS DISTINCT FROM NEW.participant_id
          OR OLD.competition_id IS DISTINCT FROM NEW.competition_id OR OLD.stage IS DISTINCT FROM NEW.stage
          OR OLD.participant_number IS DISTINCT FROM NEW.participant_number THEN
          RAISE EXCEPTION 'Attempt snapshots and ownership are immutable';
        END IF;
        IF OLD.submitted_at IS NOT NULL AND (NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR NEW.receipt IS DISTINCT FROM OLD.receipt) THEN
          RAISE EXCEPTION 'Submitted attempt cannot be reopened';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER immutable_attempt BEFORE UPDATE ON attempts FOR EACH ROW EXECUTE FUNCTION guard_attempt_snapshot();
      CREATE FUNCTION guard_locked_answer() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.checked_at IS NOT NULL AND (TG_OP='DELETE' OR NEW.selected IS DISTINCT FROM OLD.selected OR NEW.checked_at IS DISTINCT FROM OLD.checked_at) THEN
          RAISE EXCEPTION 'First checked answer is immutable';
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER immutable_answer BEFORE UPDATE OR DELETE ON attempt_answers FOR EACH ROW EXECUTE FUNCTION guard_locked_answer();
      CREATE FUNCTION guard_snapshot_rows() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Attempt question snapshots are immutable'; END $$;
      CREATE TRIGGER immutable_question_snapshot BEFORE UPDATE OR DELETE ON attempt_questions FOR EACH ROW EXECUTE FUNCTION guard_snapshot_rows();
    `,
  },
  {
    id: '007_fixed_function_paths',
    sql: `
      ALTER FUNCTION guard_attempt_snapshot() SET search_path=pg_catalog;
      ALTER FUNCTION guard_locked_answer() SET search_path=pg_catalog;
      ALTER FUNCTION guard_snapshot_rows() SET search_path=pg_catalog;
    `,
  },
  {
    id: '008_winners',
    sql: `
      CREATE TABLE competition_awards (
        competition_id TEXT NOT NULL REFERENCES competitions(id),
        award_key TEXT NOT NULL,
        stage TEXT CHECK(stage IS NULL OR stage IN ('middle','highschool','university')),
        place INT NOT NULL CHECK(place BETWEEN 1 AND 6),
        attempt_id TEXT REFERENCES attempts(id),
        label TEXT,
        reason TEXT,
        decided_by TEXT NOT NULL,
        decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY(competition_id,award_key),
        CHECK((stage IS NOT NULL AND attempt_id IS NOT NULL) OR (stage IS NULL AND label IS NOT NULL))
      );
      CREATE UNIQUE INDEX competition_awards_attempt ON competition_awards(competition_id,attempt_id) WHERE attempt_id IS NOT NULL;
      CREATE TABLE competition_winner_publications (
        competition_id TEXT PRIMARY KEY REFERENCES competitions(id),
        published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        published_by TEXT NOT NULL,
        show_names BOOLEAN NOT NULL,
        snapshot JSONB NOT NULL
      );
    `,
  },
  {
    id: '009_participant_admin',
    sql: `
      ALTER TABLE participants ADD COLUMN erased_at TIMESTAMPTZ;
      CREATE INDEX participants_phone ON participants(phone);
      CREATE INDEX participants_created ON participants(created_at);
    `,
  },
  {
    id: '010_book_storage',
    sql: `
      CREATE TABLE book_files (sha256 TEXT PRIMARY KEY, bytes BYTEA NOT NULL, size_bytes INT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE book_uploads (id TEXT PRIMARY KEY, actor TEXT NOT NULL, title TEXT NOT NULL, sha256 TEXT NOT NULL, size_bytes INT NOT NULL, parts INT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE book_upload_chunks (upload_id TEXT NOT NULL REFERENCES book_uploads(id) ON DELETE CASCADE, part INT NOT NULL, bytes BYTEA NOT NULL, PRIMARY KEY(upload_id,part));
    `,
  },
  {
    id: '011_meeting_rules',
    sql: `
      ALTER TABLE attempt_questions DROP CONSTRAINT attempt_question_ordinal;
      ALTER TABLE attempt_questions ADD CONSTRAINT attempt_question_ordinal CHECK(ordinal BETWEEN 0 AND 29);
      UPDATE competitions SET body = jsonb_set(body, '{eligibility,cities,الشرقية}',
        '["الدمام","الأحساء","الجبيل","القطيف","الخبر","الخفجي","رأس تنورة","بقيق","النعيرية","قرية العليا","البيضاء","حفر الباطن"]'::jsonb)
        WHERE body->'eligibility'->'cities' ? 'الشرقية';
      DELETE FROM competition_question_sets WHERE competition_id IN (
        SELECT c.id FROM competitions c WHERE c.id=(SELECT value #>> '{}' FROM settings WHERE id='current_competition')
          AND c.body->>'state'='DRAFT' AND NOT EXISTS(SELECT 1 FROM attempts a WHERE a.competition_id=c.id)
      );
      UPDATE competitions c SET body = body || jsonb_build_object(
        'questionCounts', jsonb_build_object('middle',20,'highschool',25,'university',30),
        'answerMode','final_submission','frozenAt',NULL,'version',COALESCE((body->>'version')::int,0)+1)
        WHERE c.id=(SELECT value #>> '{}' FROM settings WHERE id='current_competition')
          AND body->>'state'='DRAFT' AND NOT EXISTS(SELECT 1 FROM attempts a WHERE a.competition_id=c.id);
    `,
  },
  {
    id: '012_meeting_saved_copy',
    // Frozen SQL: future public-copy edits must not change this migration checksum.
    sql: `UPDATE settings SET value=replace(value::text,'مسابقة الانتماءواللحمة الوطنية', 'مسابقة الانتماء واللحمة الوطنية')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'معرفة تُلهمنا. وانتماء يجمعنا.', 'معرفة تُلهمنا، وانتماء يجمعنا.')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'لطلاب وطالبات المتوسطة والثانوية', 'لطلاب وطالبات المرحلتين المتوسطة والثانوية')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'كتاب يفتح باب الانتماء.', 'كتاب يفتح آفاق الانتماء.')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'لمعرفتكم قيمة. ولتميّزكم تقدير.', 'لمعرفتكم قيمة، ولتميّزكم تقدير.')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'6 مراكز في كل مرحلة تعليمية', 'ستة مراكز للفائزين في كل مرحلة تعليمية')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'من أول صفحة، إلى مشاركة تفتخر بها.', 'من أول صفحة إلى مشاركة تفخر بها.')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'سجّل حضورك', 'سجّل مشاركتك')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'ثلاث خطوات. وأثرٌ يبقى.', 'ثلاث خطوات، وأثرٌ يبقى.')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'اقرأ. شارك. اترك أثرًا.', 'اقرأ، وشارك، واترك أثرًا.')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'لكل مرحلة، مساحة للمعرفة.', 'لكل مرحلة مساحة للمعرفة.')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'إجابات واضحة، لبداية مطمئنة.', 'إجابات واضحة لبداية مطمئنة.')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'صفحة جديدة تبدأ بك', 'رحلتك المعرفية تبدأ من هنا')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'خذ وقتك في القراءة. المعرفة تستحق.', 'تمهّل في القراءة؛ فالمعرفة تستحق التأمل.')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'خذ وقتك. المعرفة تستحق.', 'تمهّل في القراءة؛ فالمعرفة تستحق التأمل.')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'سياسة تثبيت الإجابات', 'آلية الإجابة وإرسال المشاركة')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'لكل مرحلة 20 سؤالًا', 'للمتوسطة 20 سؤالًا، وللثانوية 25 سؤالًا، وللجامعية 30 سؤالًا')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'يمكنك تعديل اختيارك حتى تضغط «تحقق من الإجابة»، وبعدها تُثبت الإجابة نهائيًا.', 'يمكنك تعديل إجاباتك حتى الإرسال النهائي، وبعده تُعتمد الإجابات ولا يمكن تغييرها.')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'تظهر الإجابة الصحيحة والتوضيح بعد تثبيت إجابتك فقط، ولا يمكن تغيير الإجابة المثبتة.', 'تظهر الإجابات الصحيحة والتوضيحات بعد الإرسال النهائي المؤكد من الخادم فقط، ولا يمكن تغيير الإجابات بعد الإرسال.')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'تظهر الإجابة الصحيحة والتوضيح بعد تثبيت إجابة السؤال، ولا يمكن تغيير الإجابة المثبتة.', 'يمكن تعديل جميع الإجابات حتى الإرسال النهائي. تظهر الإجابات الصحيحة والتوضيحات بعد استلام المشاركة نهائيًا.')::jsonb WHERE id='site_content';
UPDATE settings SET value=replace(value::text,'تعتمد جميع الأسئلة على محتوى كتاب «الانتماء واللحمة الوطنية»، وتكون الأسئلة موضوعية فقط.', 'تعتمد الأسئلة على كتاب «الانتماء واللحمة الوطنية»، مع ثلاثة أسئلة عن الجهة المنظمة تستند إلى مصادر رسمية في كل مرحلة. جميع الأسئلة موضوعية.')::jsonb WHERE id='site_content';
      UPDATE settings SET value=jsonb_set(value,'{bookTopics}',
        '["تعريف الوطن والمواطنة والانتماء واللحمة الوطنية.","تأصيل الانتماء للوطن ومحبته في نصوص الوحيين.","الانتماء والمواطنة في حياة السلف الصالح.","الانتماء واللحمة الوطنية في الشريعة.","حقوق الانتماء إلى الوطن.","محاذير لا بد من التنبه لها."]'::jsonb)
        WHERE id='site_content' AND value->'bookTopics'=
        '["مفهوم الانتماء الوطني ومرتكزاته الشرعية.","اللحمة الوطنية وأثرها في مواجهة التحديات الفكرية.","دور الشباب في حماية المكتسبات الوطنية.","رؤية المملكة 2030 وتعزيز الهوية الوطنية.","صور واقعية للتماسك المجتمعي في المملكة."]'::jsonb;
    `,
  },
  {
    id: '013_hero_intro_copy',
    // Frozen SQL: committee homepage notes, hero subtitle wording.
    sql: `UPDATE settings SET value=replace(value::text,'نقرأ لنفهم معنى الانتماء، ونشارك في تعزيز اللحمة الوطنية. رحلة معرفية تبدأ بصفحة.', 'صفحاتٌ تُثري المعرفة، وقيمٌ تُرسّخ الانتماء، ووعيٌ يُعزّز اللُّحمة الوطنية.')::jsonb WHERE id='site_content';`,
  },
  {
    id: '014_simulation',
    sql: `
      CREATE TABLE simulation_runs (
        id TEXT PRIMARY KEY, competition_id TEXT NOT NULL REFERENCES competitions(id), actor TEXT NOT NULL,
        config JSONB NOT NULL, banks JSONB NOT NULL, opened_at TIMESTAMPTZ NOT NULL,
        entry_closes_at TIMESTAMPTZ NOT NULL, finish_until TIMESTAMPTZ NOT NULL,
        closed_at TIMESTAMPTZ, version INT NOT NULL DEFAULT 1 CHECK(version>0),
        CHECK(entry_closes_at>=opened_at AND finish_until>entry_closes_at));
      CREATE INDEX simulation_runs_campaign ON simulation_runs(competition_id,opened_at DESC);
      CREATE TABLE simulation_attempts (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES simulation_runs(id),
        participant_id TEXT NOT NULL REFERENCES participants(id),
        stage TEXT NOT NULL CHECK(stage IN ('middle','highschool','university')),
        participant_number TEXT NOT NULL, questions JSONB NOT NULL, answers JSONB NOT NULL DEFAULT '{}',
        revision INT NOT NULL DEFAULT 0 CHECK(revision>=0), submitted_at TIMESTAMPTZ,
        score INT CHECK(score IS NULL OR score BETWEEN 0 AND jsonb_array_length(questions)),
        percentage DOUBLE PRECISION CHECK(percentage IS NULL OR percentage BETWEEN 0 AND 100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(run_id,participant_id));
      CREATE TABLE simulation_events (
        attempt_id TEXT NOT NULL REFERENCES simulation_attempts(id), client_event_id TEXT NOT NULL,
        payload JSONB NOT NULL, PRIMARY KEY(attempt_id,client_event_id));
      CREATE FUNCTION guard_simulation_attempt() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
      BEGIN
        IF OLD.questions IS DISTINCT FROM NEW.questions OR OLD.run_id IS DISTINCT FROM NEW.run_id
          OR OLD.participant_id IS DISTINCT FROM NEW.participant_id OR OLD.stage IS DISTINCT FROM NEW.stage
          OR OLD.participant_number IS DISTINCT FROM NEW.participant_number OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
          RAISE EXCEPTION 'Practice snapshots and ownership are immutable';
        END IF;
        IF OLD.submitted_at IS NOT NULL AND OLD IS DISTINCT FROM NEW THEN RAISE EXCEPTION 'Submitted practice cannot be changed'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER immutable_simulation_attempt BEFORE UPDATE ON simulation_attempts FOR EACH ROW EXECUTE FUNCTION guard_simulation_attempt();
      CREATE TRIGGER immutable_simulation_events BEFORE UPDATE OR DELETE ON simulation_events FOR EACH ROW EXECUTE FUNCTION guard_snapshot_rows();
      CREATE FUNCTION guard_simulation_run() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
      BEGIN
        IF OLD.config IS DISTINCT FROM NEW.config OR OLD.banks IS DISTINCT FROM NEW.banks
          OR OLD.competition_id IS DISTINCT FROM NEW.competition_id OR OLD.actor IS DISTINCT FROM NEW.actor
          OR OLD.opened_at IS DISTINCT FROM NEW.opened_at OR NEW.entry_closes_at>OLD.entry_closes_at
          OR NEW.finish_until>OLD.finish_until THEN RAISE EXCEPTION 'Practice content and deadlines cannot be extended'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER immutable_simulation_run BEFORE UPDATE ON simulation_runs FOR EACH ROW EXECUTE FUNCTION guard_simulation_run();
    `,
  },
  {
    id: '015_prize_draw',
    sql: `
      CREATE TABLE prize_draws (
        id TEXT PRIMARY KEY, competition_id TEXT NOT NULL REFERENCES competitions(id),
        stage TEXT CHECK(stage IS NULL OR stage IN ('middle','highschool','university')),
        prizes JSONB NOT NULL CHECK(jsonb_typeof(prizes)='array' AND jsonb_array_length(prizes) BETWEEN 1 AND 20),
        alternates INT NOT NULL CHECK(alternates BETWEEN 0 AND 5),
        exclude_ranked BOOLEAN NOT NULL, exclude_flags BOOLEAN NOT NULL,
        pool JSONB NOT NULL, pool_size INT NOT NULL CHECK(pool_size > 0), pool_fingerprint TEXT NOT NULL,
        frozen_by TEXT NOT NULL, frozen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        seed_commitment TEXT, seed TEXT, committed_by TEXT, committed_at TIMESTAMPTZ,
        drawn_by TEXT, drawn_at TIMESTAMPTZ,
        cancelled_by TEXT, cancelled_at TIMESTAMPTZ, cancel_reason TEXT,
        CHECK((seed IS NULL) = (seed_commitment IS NULL) AND (seed IS NULL) = (committed_at IS NULL)),
        CHECK(drawn_at IS NULL OR seed IS NOT NULL),
        CHECK(drawn_at IS NULL OR cancelled_at IS NULL));
      CREATE UNIQUE INDEX prize_draws_one_open ON prize_draws(competition_id) WHERE drawn_at IS NULL AND cancelled_at IS NULL;
      CREATE TABLE prize_draw_entries (
        draw_id TEXT NOT NULL REFERENCES prize_draws(id), position INT NOT NULL CHECK(position > 0),
        role TEXT NOT NULL CHECK(role IN ('winner','alternate')), prize_index INT,
        attempt_id TEXT NOT NULL REFERENCES attempts(id), participant_number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','unreachable','ineligible')),
        note TEXT, decided_by TEXT, decided_at TIMESTAMPTZ,
        PRIMARY KEY(draw_id,position), UNIQUE(draw_id,attempt_id),
        CHECK((role='winner') = (prize_index IS NOT NULL)));
      CREATE FUNCTION guard_prize_draw() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
      BEGIN
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Prize draws are append-only'; END IF;
        IF OLD.competition_id IS DISTINCT FROM NEW.competition_id OR OLD.stage IS DISTINCT FROM NEW.stage
          OR OLD.prizes IS DISTINCT FROM NEW.prizes OR OLD.alternates IS DISTINCT FROM NEW.alternates
          OR OLD.exclude_ranked IS DISTINCT FROM NEW.exclude_ranked OR OLD.exclude_flags IS DISTINCT FROM NEW.exclude_flags
          OR OLD.pool IS DISTINCT FROM NEW.pool OR OLD.pool_size IS DISTINCT FROM NEW.pool_size
          OR OLD.pool_fingerprint IS DISTINCT FROM NEW.pool_fingerprint OR OLD.frozen_by IS DISTINCT FROM NEW.frozen_by
          OR OLD.frozen_at IS DISTINCT FROM NEW.frozen_at THEN RAISE EXCEPTION 'A frozen draw pool is immutable'; END IF;
        IF (OLD.seed IS NOT NULL AND (OLD.seed IS DISTINCT FROM NEW.seed OR OLD.seed_commitment IS DISTINCT FROM NEW.seed_commitment
            OR OLD.committed_by IS DISTINCT FROM NEW.committed_by OR OLD.committed_at IS DISTINCT FROM NEW.committed_at))
          OR (OLD.drawn_at IS NOT NULL AND (OLD.drawn_at IS DISTINCT FROM NEW.drawn_at OR OLD.drawn_by IS DISTINCT FROM NEW.drawn_by))
          OR (OLD.cancelled_at IS NOT NULL AND (OLD.cancelled_at IS DISTINCT FROM NEW.cancelled_at
            OR OLD.cancelled_by IS DISTINCT FROM NEW.cancelled_by OR OLD.cancel_reason IS DISTINCT FROM NEW.cancel_reason))
          OR (OLD.drawn_at IS NULL AND NEW.drawn_at IS NOT NULL AND OLD.seed IS NULL)
          OR (OLD.cancelled_at IS NOT NULL AND NEW.drawn_at IS NOT NULL)
          THEN RAISE EXCEPTION 'Draw steps are recorded once and in order'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER immutable_prize_draw BEFORE UPDATE OR DELETE ON prize_draws FOR EACH ROW EXECUTE FUNCTION guard_prize_draw();
      CREATE FUNCTION guard_prize_draw_entry() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
      BEGIN
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Prize draw entries are append-only'; END IF;
        IF OLD.draw_id IS DISTINCT FROM NEW.draw_id OR OLD.position IS DISTINCT FROM NEW.position
          OR OLD.role IS DISTINCT FROM NEW.role OR OLD.prize_index IS DISTINCT FROM NEW.prize_index
          OR OLD.attempt_id IS DISTINCT FROM NEW.attempt_id OR OLD.participant_number IS DISTINCT FROM NEW.participant_number
          OR OLD.status <> 'pending' THEN RAISE EXCEPTION 'A draw result is recorded once'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER immutable_prize_draw_entry BEFORE UPDATE OR DELETE ON prize_draw_entries FOR EACH ROW EXECUTE FUNCTION guard_prize_draw_entry();
    `,
  },
  {
    id: '016_registration_source',
    // The post link code a participant arrived with (?ref=...), for analytics attribution only.
    sql: `
      ALTER TABLE participants ADD COLUMN source TEXT CHECK(source IS NULL OR source ~ '^[a-z0-9][a-z0-9_-]{0,39}$');
      CREATE INDEX participants_source ON participants(source) WHERE source IS NOT NULL;
    `,
  },
];
export const migrationChecksum = (sql: string) => createHash('sha256').update(sql).digest('hex');
export async function migrate(db: Database) {
  await db.transaction(async (tx) => {
    if (db.kind === 'postgres') await tx.query('SELECT pg_advisory_xact_lock(72831004)');
    await tx.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    await tx.exec('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT');
    for (const migration of migrations) {
      const applied = (
        await tx.query<{ checksum: string | null }>(
          'SELECT checksum FROM schema_migrations WHERE id=$1',
          [migration.id],
        )
      ).rows[0];
      if (applied) {
        if (applied.checksum && applied.checksum !== migrationChecksum(migration.sql))
          throw new Error(`Migration checksum mismatch: ${migration.id}`);
        if (!applied.checksum)
          await tx.query('UPDATE schema_migrations SET checksum=$1 WHERE id=$2', [
            migrationChecksum(migration.sql),
            migration.id,
          ]);
        continue;
      }
      await tx.exec(migration.sql);
      if (migration.id === '002_secure_otp') {
        await migrateIdentities(tx);
        await tx.query('INSERT INTO settings(id,value) VALUES ($1,$2)', [
          'identity_key_check',
          JSON.stringify(keyedHash('key-check', 'nbc-identity-key', 'IDENTITY_LOOKUP_SECRET')),
        ]);
      }
      await tx.query('INSERT INTO schema_migrations(id,checksum) VALUES ($1,$2)', [
        migration.id,
        migrationChecksum(migration.sql),
      ]);
    }
  });
}
async function migrateIdentities(tx: Queryable) {
  const { rows } = await tx.query<{ id: string; identity: string; phone: string }>(
    'SELECT id,identity,phone FROM participants',
  );
  if (isProduction() && rows.some((p) => p.identity.startsWith('DEMO-')))
    throw new Error(
      'Refusing to migrate synthetic participants into production. Use a fresh production database.',
    );
  for (const p of rows) {
    if (p.identity.startsWith('DEMO-') || p.identity.startsWith('h1:')) continue;
    await tx.query('UPDATE participants SET identity=$1,phone=$2 WHERE id=$3', [
      identityLookup(p.identity),
      normalizePhone(p.phone),
      p.id,
    ]);
  }
}
export async function migrationsCurrent(db: Queryable) {
  try {
    const applied = (
      await db.query<{ id: string; checksum: string | null }>(
        'SELECT id,checksum FROM schema_migrations',
      )
    ).rows;
    return migrations.every((m) =>
      applied.some((a) => a.id === m.id && a.checksum === migrationChecksum(m.sql)),
    );
  } catch {
    return false;
  }
}
