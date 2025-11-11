# Online Examination System

A comprehensive, full-stack online examination platform with AI-powered proctoring and automated evaluation using Google Gemini 2.5 Pro.

## 🌟 Features

### User Management
- **Role-based access control** (Admin, Teacher, Student)
- User authentication with JWT
- Profile management
- User activity tracking

### Question Management
- Support for multiple question types:
  - MCQ (Single Correct)
  - MCQ (Multiple Correct)
  - True/False
  - Subjective
  - Fill in the Blanks
- Rich question editor with image support
- Tags and categorization by subject/topic/difficulty
- Import/Export functionality (JSON, CSV, Excel)
- Question bank management

### Exam Creation & Management
- Flexible exam configuration
- Customizable parameters:
  - Duration
  - Total marks
  - Passing marks
  - Negative marking
  - Question randomization
  - Option shuffling
- Exam scheduling with time slots
- Multiple attempts support
- Draft/Published/Archived status

### 🎥 AI-Powered Proctoring System
- **Real-time monitoring** via WebSocket (Socket.IO)
- **Client-side AI detection** using MediaPipe/TensorFlow.js:
  - Face detection and tracking
  - Multiple faces detection
  - Person leaving frame
  - Mobile phone detection
  - Suspicious object detection
  - Looking away detection
  - Tab switching detection
  - Copy-paste attempts
  - Audio monitoring for conversations
- **Pre-exam verification**:
  - Student photo capture
  - ID verification
  - System compatibility check
- **Event logging** with severity levels (Low, Medium, High, Critical)
- **Automatic termination** after multiple critical violations
- **Recording capabilities** (video, audio, screen)
- **Real-time alerts** for teachers/admins

### 🤖 AI-Based Evaluation
- **Google Gemini 2.5 Pro integration** for subjective answer evaluation
- Automatic evaluation of:
  - MCQ questions
  - True/False questions
  - Subjective questions (AI-powered)
- Manual evaluation override
- Partial marking support
- AI feedback generation

### Exam Interface
- Competitive exam-like interface
- Question navigation panel
- Mark for review functionality
- Timer with auto-submit
- Question palette/map
- Image support in questions
- Responsive design

### 📊 Comprehensive Reporting
- **Individual Performance Reports**:
  - Score breakdown
  - Question-wise analysis
  - Time analysis
  - Strengths and weaknesses
  - Proctoring violations summary
- **Class-wise Reports**:
  - Score distribution
  - Average/Median/Min/Max scores
  - Pass/Fail statistics
  - Question difficulty analysis
  - Top performers
- **Proctoring Reports**:
  - Violation timeline
  - Risk level assessment
  - Flagged students list
  - Evidence screenshots/videos
- **Evaluation Reports**:
  - AI vs Manual evaluation stats
  - Pending evaluations
  - Evaluation accuracy

## 🏗️ Tech Stack

### Backend
- **Node.js** + **Express** + **TypeScript**
- **Supabase** (PostgreSQL database + Storage)
- **Socket.IO** for real-time proctoring
- **Google Gemini 2.5 Pro** for AI evaluation
- **JWT** for authentication
- **Multer** for file uploads
- **XLSX** / **CSV-Parser** for import/export

### Frontend (To be implemented)
- **React** + **TypeScript**
- **Tailwind CSS** for styling
- **Socket.IO Client** for real-time features
- **MediaPipe** / **TensorFlow.js** for client-side AI
- **React Router** for navigation
- **Axios** for API calls

## 📁 Project Structure

```
online-examination-system/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── supabase.ts
│   │   │   └── logger.ts
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── questionController.ts
│   │   │   ├── examController.ts
│   │   │   ├── examAttemptController.ts
│   │   │   ├── proctoringController.ts
│   │   │   ├── evaluationController.ts
│   │   │   ├── importExportController.ts
│   │   │   └── reportController.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── validate.ts
│   │   ├── routes/
│   │   │   ├── index.ts
│   │   │   ├── authRoutes.ts
│   │   │   ├── questionRoutes.ts
│   │   │   ├── examRoutes.ts
│   │   │   ├── attemptRoutes.ts
│   │   │   ├── proctoringRoutes.ts
│   │   │   ├── evaluationRoutes.ts
│   │   │   ├── importExportRoutes.ts
│   │   │   └── reportRoutes.ts
│   │   ├── services/
│   │   │   └── proctoringSocket.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   └── auth.ts
│   │   └── server.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   └── (To be implemented)
├── DATABASE_SCHEMA.md
└── README.md
```

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Supabase account
- Google Cloud account (for Gemini API)

### Backend Setup

1. **Clone the repository**
   ```bash
   cd online-examination-system
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Setup Supabase**
   - Create a new project on [Supabase](https://supabase.com)
   - Go to Project Settings > API
   - Copy your project URL and API keys

4. **Create database tables**
   - Open Supabase SQL Editor
   - Copy and execute the SQL from `DATABASE_SCHEMA.md`
   - This will create all necessary tables, indexes, and RLS policies

5. **Setup Supabase Storage Buckets**
   Create the following buckets in Supabase Storage:
   - `profile-images`
   - `question-images`
   - `proctoring-evidence`
   - `proctoring-recordings`
   - `question-imports`
   - `exam-attachments`

6. **Get Google Gemini API Key**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key

7. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your credentials:
   ```env
   PORT=5000
   NODE_ENV=development

   # Supabase
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # JWT
   JWT_SECRET=your_super_secret_jwt_key_change_this
   JWT_EXPIRES_IN=7d

   # Gemini API
   GEMINI_API_KEY=your_gemini_api_key

   # CORS
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

   # File Upload
   MAX_FILE_SIZE_MB=10
   UPLOAD_DIR=uploads
   ```

8. **Create necessary directories**
   ```bash
   mkdir logs uploads
   ```

9. **Build and start the backend**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm run build
   npm start
   ```

10. **Verify backend is running**
    Visit `http://localhost:5000/api/health`
    You should see: `{"success": true, "message": "Online Examination System API is running"}`

## 📡 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication
Most endpoints require authentication. Include the JWT token in the header:
```
Authorization: Bearer <your_jwt_token>
```

### API Endpoints

#### Authentication (`/auth`)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login
- `GET /auth/profile` - Get current user profile
- `PUT /auth/profile` - Update profile
- `POST /auth/change-password` - Change password
- `GET /auth/users` - Get all users (Admin only)
- `PUT /auth/users/:userId/status` - Update user status (Admin only)
- `DELETE /auth/users/:userId` - Delete user (Admin only)

#### Questions (`/questions`)
- `GET /questions` - Get all questions (with filters)
- `GET /questions/:id` - Get question by ID
- `POST /questions` - Create question (Teacher/Admin)
- `PUT /questions/:id` - Update question (Teacher/Admin)
- `DELETE /questions/:id` - Delete question (Teacher/Admin)
- `POST /questions/bulk-delete` - Bulk delete questions
- `GET /questions/meta/subjects` - Get all subjects
- `GET /questions/meta/topics` - Get topics
- `GET /questions/meta/statistics` - Get question statistics

#### Exams (`/exams`)
- `GET /exams` - Get all exams
- `GET /exams/:id` - Get exam by ID
- `POST /exams` - Create exam (Teacher/Admin)
- `PUT /exams/:id` - Update exam (Teacher/Admin)
- `DELETE /exams/:id` - Delete exam (Teacher/Admin)
- `POST /exams/:id/questions` - Add questions to exam
- `DELETE /exams/:id/questions/:questionId` - Remove question
- `PUT /exams/:id/questions/reorder` - Reorder questions
- `POST /exams/:id/schedules` - Create exam schedule
- `GET /exams/:id/schedules` - Get exam schedules
- `POST /exams/:id/publish` - Publish exam

#### Exam Attempts (`/attempts`)
- `POST /attempts/start` - Start exam attempt (Student)
- `GET /attempts/:id` - Get attempt details
- `POST /attempts/:id/answers` - Submit answer for question
- `POST /attempts/:id/submit` - Submit exam
- `POST /attempts/:id/auto-submit` - Auto-submit when time expires
- `POST /attempts/:id/terminate` - Terminate attempt (Teacher/Admin)
- `GET /attempts/exam/:examId/student` - Get student's attempts
- `GET /attempts/exam/:examId/all` - Get all attempts (Teacher/Admin)

#### Proctoring (`/proctoring`)
- `POST /proctoring/events` - Record proctoring event
- `GET /proctoring/events/attempt/:attemptId` - Get events for attempt
- `PUT /proctoring/events/:id/review` - Review event (Teacher/Admin)
- `POST /proctoring/events/bulk-review` - Bulk review events
- `POST /proctoring/recordings` - Store recording metadata
- `GET /proctoring/recordings/attempt/:attemptId` - Get recordings
- `GET /proctoring/report/attempt/:attemptId` - Get proctoring report
- `GET /proctoring/flagged/exam/:examId` - Get flagged attempts

#### Evaluation (`/evaluation`)
- `POST /evaluation/response/:response_id` - Evaluate single response
- `POST /evaluation/attempt/:attempt_id` - Evaluate entire attempt
- `PUT /evaluation/response/:response_id/manual` - Manual evaluation
- `GET /evaluation/attempt/:attempt_id/status` - Get evaluation status

#### Import/Export (`/import-export`)
- `POST /import-export/import` - Import questions from file
- `POST /import-export/export` - Export questions to file
- `GET /import-export/import-history` - Get import history
- `GET /import-export/template` - Download question template

#### Reports (`/reports`)
- `GET /reports/student/:student_id/exam/:exam_id` - Individual report
- `GET /reports/class/exam/:exam_id` - Class report (Teacher/Admin)
- `GET /reports/proctoring/exam/:exam_id` - Proctoring report
- `GET /reports/evaluation/exam/:exam_id` - Evaluation report
- `GET /reports/dashboard` - Dashboard analytics

### Socket.IO Events

#### Student Events (Emit)
- `join-proctoring` - Join proctoring session
- `proctoring-frame` - Send video frame
- `proctoring-event` - Report detected violation
- `screen-data` - Send screen capture
- `audio-event` - Report audio activity
- `leave-proctoring` - Leave session
- `heartbeat` - Keep connection alive

#### Student Events (Receive)
- `proctoring-joined` - Successfully joined
- `proctoring-error` - Error occurred
- `frame-received` - Frame acknowledged
- `event-recorded` - Event recorded
- `attempt-terminated` - Exam terminated
- `heartbeat-ack` - Heartbeat response

#### Teacher/Admin Events (Emit)
- `monitor-exam` - Start monitoring exam
- `stop-monitor` - Stop monitoring

#### Teacher/Admin Events (Receive)
- `monitoring-started` - Monitoring started
- `active-students` - List of active students
- `student-joined-exam` - Student joined
- `student-frame` - Student's video frame
- `student-screen` - Student's screen
- `proctoring-violation` - Violation detected
- `audio-violation` - Audio violation
- `student-left-exam` - Student left
- `student-disconnected` - Student disconnected
- `attempt-terminated-notification` - Attempt terminated

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Row-level security (RLS) in Supabase
- Rate limiting
- Helmet.js for security headers
- Input validation
- CORS configuration
- Secure file uploads

## 🎯 Key Functionalities

### Proctoring System Flow
1. Student starts exam → Pre-exam verification (photo + ID)
2. WebSocket connection established
3. Continuous monitoring:
   - Video frames analyzed by MediaPipe
   - Screen capture periodically
   - Audio monitoring
   - Browser events (tab switch, copy-paste, etc.)
4. Violations automatically logged
5. Critical violations → Automatic termination
6. All events stored with timestamps and evidence

### Evaluation Flow
1. Student submits exam
2. MCQ questions auto-evaluated
3. Subjective questions sent to Gemini API
4. AI provides score + feedback
5. Teacher can override with manual evaluation
6. Final results calculated including proctoring score
7. Reports generated

## 📝 Database Schema

See `DATABASE_SCHEMA.md` for detailed database structure including:
- All 14 tables with relationships
- Indexes for performance
- Row-level security policies
- Storage buckets configuration

## 🎨 Frontend Implementation (Next Steps)

The frontend will include:

### Student Interface
- Login/Registration
- Dashboard with upcoming exams
- Exam taking interface with proctoring
- Results and performance analysis

### Teacher Interface
- Dashboard with exam overview
- Question bank management
- Exam creation and scheduling
- Live exam monitoring
- Evaluation interface
- Reports and analytics

### Admin Interface
- User management
- System settings
- Global analytics
- Audit logs

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📦 Deployment

### Recommended Platforms
- **Backend**: Railway, Render, Heroku
- **Frontend**: Vercel, Netlify
- **Database**: Supabase (already cloud)

### Production Checklist
- [ ] Set NODE_ENV=production
- [ ] Use strong JWT secret
- [ ] Configure proper CORS origins
- [ ] Set up SSL certificates
- [ ] Enable rate limiting
- [ ] Configure logging
- [ ] Set up monitoring (e.g., Sentry)
- [ ] Regular database backups

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License

## 👥 Support

For issues and questions, please create an issue in the repository.

## 🔮 Future Enhancements

- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] Advanced analytics with ML insights
- [ ] Integration with LMS platforms
- [ ] Blockchain-based certificate generation
- [ ] Voice-based questions
- [ ] Collaborative coding questions
- [ ] Plagiarism detection for code
- [ ] Advanced biometric authentication

---

**Built with ❤️ for fair and secure online examinations**
