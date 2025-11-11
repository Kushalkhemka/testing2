import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';

export default function TeacherDashboard() {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container-custom py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-bold gradient-text mb-8">
            Teacher Dashboard - {user?.full_name}
          </h1>
          <div className="glass-card p-8">
            <p className="text-dark-600 mb-6">
              Full teacher interface with exam creation, question management, live monitoring, and reports to be implemented.
            </p>
            <button onClick={logout} className="btn-danger">
              Logout
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
