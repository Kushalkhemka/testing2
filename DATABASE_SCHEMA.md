# Online Examination System - Database Schema

## Overview
This document describes the complete database schema for the Online Examination System using Supabase PostgreSQL.

---

## Tables

### 1. users
Stores all user information with role-based access.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  profile_image_url TEXT,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

---

### 2. questions
Stores all question types with metadata.

```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('mcq_single', 'mcq_multiple', 'true_false', 'subjective', 'fill_blank')),
  question_text TEXT NOT NULL,
  question_image_url TEXT,
  difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  subject VARCHAR(100),
  topic VARCHAR(100),
  marks DECIMAL(5,2) NOT NULL DEFAULT 1.0,
  negative_marks DECIMAL(5,2) DEFAULT 0.0,
  options JSONB, -- For MCQ: [{"id": "A", "text": "option1", "image_url": null}, ...]
  correct_answers JSONB NOT NULL, -- For MCQ: ["A"] or ["A", "B"], for true_false: [true], for subjective: ["sample answer"]
  explanation TEXT,
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_questions_type ON questions(question_type);
CREATE INDEX idx_questions_subject ON questions(subject);
CREATE INDEX idx_questions_created_by ON questions(created_by);
CREATE INDEX idx_questions_tags ON questions USING GIN(tags);
```

---

### 3. exams
Stores exam configuration and metadata.

```sql
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  subject VARCHAR(100),
  duration_minutes INTEGER NOT NULL,
  total_marks DECIMAL(7,2) NOT NULL,
  passing_marks DECIMAL(7,2),
  negative_marking_enabled BOOLEAN DEFAULT false,
  randomize_questions BOOLEAN DEFAULT false,
  randomize_options BOOLEAN DEFAULT false,
  show_results_immediately BOOLEAN DEFAULT false,
  allow_review BOOLEAN DEFAULT true,
  proctoring_enabled BOOLEAN DEFAULT true,
  proctoring_strictness VARCHAR(20) DEFAULT 'medium' CHECK (proctoring_strictness IN ('low', 'medium', 'high')),
  instructions TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_exams_created_by ON exams(created_by);
CREATE INDEX idx_exams_status ON exams(status);
```

---

### 4. exam_questions
Maps questions to exams with ordering.

```sql
CREATE TABLE exam_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  marks_override DECIMAL(5,2), -- Override default question marks
  negative_marks_override DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(exam_id, question_id),
  UNIQUE(exam_id, question_order)
);

CREATE INDEX idx_exam_questions_exam ON exam_questions(exam_id);
CREATE INDEX idx_exam_questions_question ON exam_questions(question_id);
```

---

### 5. exam_schedules
Manages exam scheduling for different groups/batches.

```sql
CREATE TABLE exam_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  schedule_name VARCHAR(255),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  allowed_students JSONB, -- Array of student IDs or null for all
  max_attempts INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_exam_schedules_exam ON exam_schedules(exam_id);
CREATE INDEX idx_exam_schedules_time ON exam_schedules(start_time, end_time);
```

---

### 6. exam_attempts
Tracks each student's exam attempt.

```sql
CREATE TABLE exam_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES exam_schedules(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  attempt_number INTEGER DEFAULT 1,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  time_remaining_seconds INTEGER,
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'auto_submitted', 'terminated')),
  ip_address VARCHAR(45),
  user_agent TEXT,
  proctoring_verified BOOLEAN DEFAULT false,
  pre_exam_photo_url TEXT,
  pre_exam_id_photo_url TEXT,
  system_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(exam_id, student_id, attempt_number)
);

CREATE INDEX idx_exam_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX idx_exam_attempts_student ON exam_attempts(student_id);
CREATE INDEX idx_exam_attempts_status ON exam_attempts(status);
```

---

### 7. exam_responses
Stores student answers for each question.

```sql
CREATE TABLE exam_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  response JSONB, -- MCQ: ["A"], subjective: {"text": "answer", "attachments": []}, etc.
  time_spent_seconds INTEGER,
  visited_at TIMESTAMP WITH TIME ZONE,
  answered_at TIMESTAMP WITH TIME ZONE,
  is_marked_for_review BOOLEAN DEFAULT false,
  marks_obtained DECIMAL(5,2),
  ai_evaluation JSONB, -- For subjective: {"score": 8, "feedback": "...", "model": "gemini-2.5-pro"}
  evaluated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  evaluated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(attempt_id, question_id)
);

CREATE INDEX idx_exam_responses_attempt ON exam_responses(attempt_id);
CREATE INDEX idx_exam_responses_question ON exam_responses(question_id);
```

---

### 8. proctoring_events
Records all proctoring-related events during exam.

```sql
CREATE TABLE proctoring_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID REFERENCES exam_attempts(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'face_not_detected', 'multiple_faces', 'no_face_visible',
    'mobile_detected', 'unauthorized_object', 'person_left',
    'suspicious_movement', 'looking_away', 'tab_switch',
    'window_blur', 'fullscreen_exit', 'copy_paste',
    'right_click', 'suspicious_audio', 'background_noise',
    'other_person_detected', 'keyboard_pattern_unusual'
  )),
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  evidence_url TEXT, -- Screenshot/video clip URL
  metadata JSONB, -- Additional data like coordinates, detection confidence, etc.
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  auto_flagged BOOLEAN DEFAULT true,
  reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  action_taken VARCHAR(50) -- 'warning', 'terminated', 'ignored', etc.
);

CREATE INDEX idx_proctoring_events_attempt ON proctoring_events(attempt_id);
CREATE INDEX idx_proctoring_events_type ON proctoring_events(event_type);
CREATE INDEX idx_proctoring_events_severity ON proctoring_events(severity);
CREATE INDEX idx_proctoring_events_timestamp ON proctoring_events(timestamp);
```

---

### 9. proctoring_recordings
Stores metadata for proctoring video/audio recordings.

```sql
CREATE TABLE proctoring_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID REFERENCES exam_attempts(id) ON DELETE CASCADE,
  recording_type VARCHAR(20) CHECK (recording_type IN ('video', 'audio', 'screen')),
  file_url TEXT NOT NULL,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  start_timestamp TIMESTAMP WITH TIME ZONE,
  end_timestamp TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_proctoring_recordings_attempt ON proctoring_recordings(attempt_id);
```

---

### 10. exam_results
Aggregated exam results and scores.

```sql
CREATE TABLE exam_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID REFERENCES exam_attempts(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  total_questions INTEGER NOT NULL,
  attempted_questions INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  incorrect_answers INTEGER DEFAULT 0,
  marks_obtained DECIMAL(7,2) DEFAULT 0,
  negative_marks DECIMAL(7,2) DEFAULT 0,
  final_score DECIMAL(7,2) DEFAULT 0,
  percentage DECIMAL(5,2),
  grade VARCHAR(5),
  pass_status BOOLEAN,
  rank INTEGER,
  time_taken_seconds INTEGER,
  proctoring_violations_count INTEGER DEFAULT 0,
  proctoring_score DECIMAL(5,2) DEFAULT 100.0, -- 0-100, penalties for violations
  ai_evaluated BOOLEAN DEFAULT false,
  manually_reviewed BOOLEAN DEFAULT false,
  subject_wise_performance JSONB, -- {"Math": {"correct": 5, "total": 10}, ...}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(attempt_id)
);

CREATE INDEX idx_exam_results_exam ON exam_results(exam_id);
CREATE INDEX idx_exam_results_student ON exam_results(student_id);
CREATE INDEX idx_exam_results_score ON exam_results(final_score DESC);
```

---

### 11. question_imports
Tracks question import history.

```sql
CREATE TABLE question_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  imported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  file_name VARCHAR(255),
  file_url TEXT,
  total_questions INTEGER,
  successful_imports INTEGER,
  failed_imports INTEGER,
  error_log JSONB,
  import_format VARCHAR(20) CHECK (import_format IN ('csv', 'json', 'excel', 'qti')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_question_imports_user ON question_imports(imported_by);
```

---

### 12. audit_logs
System-wide audit trail.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(created_at);
```

---

### 13. notifications
User notifications system.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(50) CHECK (type IN ('exam_scheduled', 'exam_reminder', 'result_published', 'proctoring_alert', 'system', 'other')),
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
```

---

### 14. system_settings
Global system configuration.

```sql
CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Row Level Security (RLS) Policies

Supabase supports Row Level Security. Here are recommended policies:

### Users Table
```sql
-- Users can read their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### Questions Table
```sql
-- Teachers can view all questions
CREATE POLICY "Teachers can view questions" ON questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );

-- Teachers can create questions
CREATE POLICY "Teachers can create questions" ON questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );
```

### Exam Attempts
```sql
-- Students can view their own attempts
CREATE POLICY "Students can view own attempts" ON exam_attempts
  FOR SELECT USING (student_id = auth.uid());

-- Teachers can view attempts for their exams
CREATE POLICY "Teachers can view exam attempts" ON exam_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM exams WHERE exams.id = exam_attempts.exam_id AND exams.created_by = auth.uid()
    )
  );
```

---

## Indexes Summary

All necessary indexes have been created for:
- Foreign key relationships
- Frequently queried columns (email, role, status, timestamps)
- Search optimization (GIN indexes for arrays and JSONB)

---

## Database Functions and Triggers

### Update Timestamp Trigger
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ... (apply to all relevant tables)
```

---

## Data Relationships Diagram

```
users (1) ─── (N) questions [created_by]
users (1) ─── (N) exams [created_by]
users (1) ─── (N) exam_attempts [student_id]

exams (1) ─── (N) exam_questions [exam_id]
exams (1) ─── (N) exam_schedules [exam_id]
exams (1) ─── (N) exam_attempts [exam_id]

questions (1) ─── (N) exam_questions [question_id]
questions (1) ─── (N) exam_responses [question_id]

exam_attempts (1) ─── (N) exam_responses [attempt_id]
exam_attempts (1) ─── (N) proctoring_events [attempt_id]
exam_attempts (1) ─── (N) proctoring_recordings [attempt_id]
exam_attempts (1) ─── (1) exam_results [attempt_id]
```

---

## Storage Buckets (Supabase Storage)

1. **profile-images** - User profile pictures
2. **question-images** - Images used in questions
3. **proctoring-evidence** - Screenshots and video clips from proctoring
4. **proctoring-recordings** - Full exam recordings (video/audio/screen)
5. **question-imports** - Uploaded question bank files
6. **exam-attachments** - Any exam-related documents

---

## Initial Seed Data

### Admin User
```sql
INSERT INTO users (email, password_hash, full_name, role)
VALUES ('admin@example.com', '$hashed_password', 'System Admin', 'admin');
```

### System Settings
```sql
INSERT INTO system_settings (key, value, description) VALUES
  ('gemini_api_key', '""', 'Google Gemini API Key for AI evaluation'),
  ('proctoring_enabled_default', 'true', 'Enable proctoring by default'),
  ('max_file_upload_size_mb', '10', 'Maximum file upload size'),
  ('session_timeout_minutes', '30', 'Session timeout duration');
```

---

This schema supports:
- ✅ Multiple user roles with RLS
- ✅ All question types with flexible structure
- ✅ Comprehensive exam configuration
- ✅ Advanced proctoring with event tracking
- ✅ AI-based evaluation support
- ✅ Detailed analytics and reporting
- ✅ Audit trails and security
- ✅ Scalability and performance optimization
