import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { BookOpen, Clock, Award, TrendingUp } from 'lucide-react';

export default function StudentDashboard() {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container-custom py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold gradient-text mb-2">
            Welcome, {user?.full_name}!
          </h1>
          <p className="text-dark-600">Ready for your next exam?</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { icon: BookOpen, label: 'Upcoming Exams', value: '3', color: 'primary' },
            { icon: Clock, label: 'Total Hours', value: '24.5', color: 'secondary' },
            { icon: Award, label: 'Avg Score', value: '85%', color: 'success' },
            { icon: TrendingUp, label: 'Progress', value: '+12%', color: 'accent' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="stats-card"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-dark-600 text-sm font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold text-dark-900 mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-${stat.color}-500 to-${stat.color}-600 flex items-center justify-center shadow-lg`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-8 text-center"
        >
          <h2 className="text-2xl font-bold mb-4">Student Dashboard</h2>
          <p className="text-dark-600 mb-6">
            Full dashboard with exam cards, upcoming tests, and performance analytics to be implemented.
          </p>
          <button onClick={logout} className="btn-danger">
            Logout
          </button>
        </motion.div>
      </div>
    </div>
  );
}
