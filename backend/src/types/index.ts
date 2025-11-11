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
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
}

export interface AuthRequest extends Express.Request {
  user?: User;
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
  created_at: Date;
  updated_at: Date;
}

// Exam Types
export enum ExamStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export enum ProctoringStrictness {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
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
  proctoring_strictness: ProctoringStrictness;
  instructions?: string;
  status: ExamStatus;
  created_at: Date;
  updated_at: Date;
}

export interface ExamQuestion {
  id: string;
  exam_id: string;
  question_id: string;
  question_order: number;
  marks_override?: number;
  negative_marks_override?: number;
  created_at: Date;
}

export interface ExamSchedule {
  id: string;
  exam_id: string;
  schedule_name?: string;
  start_time: Date;
  end_time: Date;
  allowed_students?: string[];
  max_attempts: number;
  created_at: Date;
  updated_at: Date;
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
  started_at: Date;
  submitted_at?: Date;
  time_remaining_seconds?: number;
  status: AttemptStatus;
  ip_address?: string;
  user_agent?: string;
  proctoring_verified: boolean;
  pre_exam_photo_url?: string;
  pre_exam_id_photo_url?: string;
  system_info?: any;
  created_at: Date;
  updated_at: Date;
}

export interface ExamResponse {
  id: string;
  attempt_id: string;
  question_id: string;
  response?: any;
  time_spent_seconds?: number;
  visited_at?: Date;
  answered_at?: Date;
  is_marked_for_review: boolean;
  marks_obtained?: number;
  ai_evaluation?: {
    score: number;
    feedback: string;
    model: string;
  };
  evaluated_by?: string;
  evaluated_at?: Date;
  created_at: Date;
  updated_at: Date;
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
  OTHER_PERSON_DETECTED = 'other_person_detected',
  KEYBOARD_PATTERN_UNUSUAL = 'keyboard_pattern_unusual'
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
  metadata?: any;
  timestamp: Date;
  auto_flagged: boolean;
  reviewed: boolean;
  reviewed_by?: string;
  reviewed_at?: Date;
  action_taken?: string;
}

export enum RecordingType {
  VIDEO = 'video',
  AUDIO = 'audio',
  SCREEN = 'screen'
}

export interface ProctoringRecording {
  id: string;
  attempt_id: string;
  recording_type: RecordingType;
  file_url: string;
  duration_seconds?: number;
  file_size_bytes?: number;
  start_timestamp?: Date;
  end_timestamp?: Date;
  metadata?: any;
  created_at: Date;
}

// Results Types
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
  ai_evaluated: boolean;
  manually_reviewed: boolean;
  subject_wise_performance?: any;
  created_at: Date;
  updated_at: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Socket Types
export interface SocketUser {
  userId: string;
  attemptId: string;
  socketId: string;
}

export interface ProctoringData {
  attemptId: string;
  timestamp: Date;
  frameData?: string; // Base64 encoded image
  audioData?: any;
  screenData?: string;
  metadata?: any;
}

// Import/Export Types
export enum ImportFormat {
  CSV = 'csv',
  JSON = 'json',
  EXCEL = 'excel',
  QTI = 'qti'
}

export interface QuestionImport {
  id: string;
  imported_by: string;
  file_name: string;
  file_url: string;
  total_questions: number;
  successful_imports: number;
  failed_imports: number;
  error_log?: any;
  import_format: ImportFormat;
  created_at: Date;
}
