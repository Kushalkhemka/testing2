# ExamPro Frontend

Modern, beautifully designed React frontend for the Online Examination System.

## 🎨 Design Features

- **Modern Glassmorphism** UI with backdrop blur effects
- **Smooth Animations** using Framer Motion
- **Custom Gradient System** with unique color palettes
- **Responsive Design** that works on all devices
- **Dark Mode Support** (ready to implement)
- **Accessibility** focused components

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
src/
├── pages/              # Page components
│   ├── auth/          # Login, Register
│   ├── student/       # Student dashboard & exams
│   ├── teacher/       # Teacher dashboard & management
│   └── admin/         # Admin dashboard
├── components/        # Reusable components
│   ├── common/       # Shared components
│   ├── exam/         # Exam-related components
│   └── proctoring/   # Proctoring components
├── lib/              # Utilities & API client
├── store/            # Zustand state management
├── types/            # TypeScript types
└── index.css         # Global styles & Tailwind

## 🎯 Completed Features

✅ Modern authentication pages with animations
✅ Role-based routing (Student, Teacher, Admin)
✅ API client with interceptors
✅ State management with Zustand
✅ Custom Tailwind design system
✅ Utility functions
✅ Type definitions

## 🚧 To Be Implemented

### Student Interface
- [ ] Exam cards with countdown timers
- [ ] Exam taking interface with question navigation
- [ ] Pre-exam proctoring verification
- [ ] Real-time proctoring with MediaPipe
- [ ] Results and analytics dashboard
- [ ] Performance history

### Teacher Interface
- [ ] Question bank management
- [ ] Exam creation wizard
- [ ] Live exam monitoring dashboard
- [ ] Evaluation interface
- [ ] Reports and analytics
- [ ] Student management

### Admin Interface
- [ ] User management (CRUD)
- [ ] System settings
- [ ] Global analytics
- [ ] Audit logs viewer

### Proctoring System
- [ ] MediaPipe face detection
- [ ] TensorFlow.js object detection
- [ ] Screen capture
- [ ] Audio monitoring
- [ ] Socket.IO real-time communication
- [ ] Violation alerts

### Common Components
- [ ] Charts (Recharts integration)
- [ ] Data tables
- [ ] File upload
- [ ] Rich text editor
- [ ] Modal dialogs
- [ ] Toast notifications (✅ already integrated)

## 🎨 Design System

### Colors
- **Primary**: Blue shades for main actions
- **Secondary**: Purple shades for accents
- **Accent**: Orange shades for highlights
- **Success**: Green for positive feedback
- **Danger**: Red for errors and warnings
- **Dark**: Slate grays for text and backgrounds

### Components
All components use the custom design system defined in `index.css`:

- `.glass-card` - Glassmorphism cards
- `.btn-primary` - Primary action buttons
- `.gradient-text` - Gradient text effects
- `.stats-card` - Animated stats cards
- `.exam-card` - Exam display cards
- And many more...

### Animations
Smooth animations using:
- Framer Motion for component animations
- Custom Tailwind keyframes
- Hover effects and transitions

## 📦 Key Dependencies

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Zustand** - State management
- **Axios** - HTTP client
- **Socket.IO Client** - Real-time communication
- **React Router** - Routing
- **Lucide React** - Icons
- **React Hot Toast** - Notifications
- **Date-fns** - Date formatting
- **Recharts** - Charts (for analytics)
- **MediaPipe** - AI proctoring
- **TensorFlow.js** - Object detection

## 🎓 Usage

### Authentication
```typescript
import { useAuthStore } from '@/store/authStore';

const { login, logout, user, isAuthenticated } = useAuthStore();

// Login
await login(email, password);

// Logout
logout();
```

### API Calls
```typescript
import api from '@/lib/api';

// Get exams
const exams = await api.getExams();

// Create question
const question = await api.createQuestion(data);
```

### Styling
```tsx
// Use custom classes from design system
<div className="glass-card p-6">
  <h1 className="gradient-text">Beautiful Title</h1>
  <button className="btn-primary">Click Me</button>
</div>
```

## 🔧 Configuration

### Environment Variables
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### Tailwind Configuration
See `tailwind.config.js` for custom colors, animations, and utilities.

## 🤝 Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Follow the design system
4. Add animations for smooth UX
5. Test on multiple screen sizes
6. Ensure accessibility

## 📄 License

MIT License

---

**Built with modern design principles for an exceptional user experience**
