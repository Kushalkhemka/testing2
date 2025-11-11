// User Types
export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student'
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  profile_image_url?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

// Question Types
export enum QuestionType {
  MCQ_SINGLE = 'mcq_single',
  MCQ_MULTIPLE = 'mcq_multiple',
  TRUE_FALSE = 'true_false',
  SUBJECTIVE = 'subjective',
  FILL_BLANK = 'fill_blank'
}

export enum DifficultyLevel {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}

export interface QuestionOption {
  id: string;
  text: string;
  image_url?: string;
}

export interface Question {
  id: string;
  created_by: string;
  question_type: QuestionType;
  question_text: string;
  question_image_url?: string;
  difficulty_level?: DifficultyLevel;
  subject?: string;
  topic?: string;
  marks: number;
  negative_marks: number;
  options?: QuestionOption[];
  correct_answers: any[];
  explanation?: string;
  tags?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Exam Types
export enum ExamStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export interface Exam {
  id: string;
  created_by: string;
  title: string;
  description?: string;
  subject?: string;
  duration_minutes: number;
  total_marks: number;
  passing_marks?: number;
  negative_marking_enabled: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
  show_results_immediately: boolean;
  allow_review: boolean;
  proctoring_enabled: boolean;
  proctoring_strictness: string;
  instructions?: string;
  status: ExamStatus;
  created_at: string;
  updated_at: string;
}

export interface ExamSchedule {
  id: string;
  exam_id: string;
  schedule_name?: string;
  start_time: string;
  end_time: string;
  allowed_students?: string[];
  max_attempts: number;
  created_at: string;
}

// Exam Attempt Types
export enum AttemptStatus {
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  AUTO_SUBMITTED = 'auto_submitted',
  TERMINATED = 'terminated'
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  schedule_id: string;
  student_id: string;
  attempt_number: number;
  started_at: string;
  submitted_at?: string;
  time_remaining_seconds?: number;
  status: AttemptStatus;
  proctoring_verified: boolean;
  created_at: string;
}

export interface ExamResponse {
  id: string;
  attempt_id: string;
  question_id: string;
  response?: any;
  time_spent_seconds?: number;
  visited_at?: string;
  answered_at?: string;
  is_marked_for_review: boolean;
  marks_obtained?: number;
}

// Proctoring Types
export enum ProctoringEventType {
  FACE_NOT_DETECTED = 'face_not_detected',
  MULTIPLE_FACES = 'multiple_faces',
  NO_FACE_VISIBLE = 'no_face_visible',
  MOBILE_DETECTED = 'mobile_detected',
  UNAUTHORIZED_OBJECT = 'unauthorized_object',
  PERSON_LEFT = 'person_left',
  SUSPICIOUS_MOVEMENT = 'suspicious_movement',
  LOOKING_AWAY = 'looking_away',
  TAB_SWITCH = 'tab_switch',
  WINDOW_BLUR = 'window_blur',
  FULLSCREEN_EXIT = 'fullscreen_exit',
  COPY_PASTE = 'copy_paste',
  RIGHT_CLICK = 'right_click',
  SUSPICIOUS_AUDIO = 'suspicious_audio',
  BACKGROUND_NOISE = 'background_noise',
  OTHER_PERSON_DETECTED = 'other_person_detected'
}

export enum EventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ProctoringEvent {
  id: string;
  attempt_id: string;
  event_type: ProctoringEventType;
  severity: EventSeverity;
  description?: string;
  evidence_url?: string;
  timestamp: string;
}

// Result Types
export interface ExamResult {
  id: string;
  attempt_id: string;
  exam_id: string;
  student_id: string;
  total_questions: number;
  attempted_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  marks_obtained: number;
  negative_marks: number;
  final_score: number;
  percentage: number;
  grade?: string;
  pass_status: boolean;
  rank?: number;
  time_taken_seconds: number;
  proctoring_violations_count: number;
  proctoring_score: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

export interface PaginatedResponse<T> extends ApiResponse {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  role?: UserRole;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Dashboard Stats
export interface DashboardStats {
  total_exams?: number;
  published_exams?: number;
  draft_exams?: number;
  total_attempts?: number;
  total_questions?: number;
  upcoming_exams?: number;
  completed_exams?: number;
  average_score?: number;
}
