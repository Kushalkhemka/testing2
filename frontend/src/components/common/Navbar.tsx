import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut,
  User,
  Settings,
  Bell,
  Menu,
  X,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { getInitials } from '../../lib/utils';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <nav className="glass-card-strong sticky top-0 z-50 border-b border-dark-200/50 dark:border-dark-700/50">
      <div className="container-custom">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-lg group-hover:shadow-primary-500/50 transition-all">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text hidden sm:block">ExamPro</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            {/* Notifications */}
            <button className="relative p-2 rounded-xl hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors">
              <Bell className="w-5 h-5 text-dark-600 dark:text-dark-400" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full" />
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-dark-100 dark:hover:bg-dark-700 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-sm font-semibold">
                  {getInitials(user?.full_name || '')}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-semibold text-dark-900 dark:text-dark-100">
                    {user?.full_name}
                  </p>
                  <p className="text-xs text-dark-500 dark:text-dark-400 capitalize">
                    {user?.role}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-dark-500" />
              </button>

              {/* Dropdown */}
              <AnimatePresence>
                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-56 glass-card-strong py-2 shadow-xl z-20"
                    >
                      <Link
                        to="/profile"
                        className="flex items-center gap-3 px-4 py-2 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                      >
                        <User className="w-4 h-4 text-dark-500" />
                        <span className="text-sm text-dark-700 dark:text-dark-300">Profile</span>
                      </Link>
                      <Link
                        to="/settings"
                        className="flex items-center gap-3 px-4 py-2 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-dark-500" />
                        <span className="text-sm text-dark-700 dark:text-dark-300">Settings</span>
                      </Link>
                      <div className="divider my-2" />
                      <button
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors text-danger-600"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-medium">Logout</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-2 rounded-xl hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
          >
            {showMobileMenu ? (
              <X className="w-6 h-6 text-dark-600 dark:text-dark-400" />
            ) : (
              <Menu className="w-6 h-6 text-dark-600 dark:text-dark-400" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-dark-200/50 dark:border-dark-700/50"
          >
            <div className="container-custom py-4 space-y-2">
              <div className="flex items-center gap-3 px-4 py-3 bg-dark-50 dark:bg-dark-800 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-sm font-semibold">
                  {getInitials(user?.full_name || '')}
                </div>
                <div>
                  <p className="text-sm font-semibold text-dark-900 dark:text-dark-100">
                    {user?.full_name}
                  </p>
                  <p className="text-xs text-dark-500 dark:text-dark-400 capitalize">
                    {user?.role}
                  </p>
                </div>
              </div>

              <Link
                to="/profile"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                onClick={() => setShowMobileMenu(false)}
              >
                <User className="w-5 h-5 text-dark-500" />
                <span className="text-sm text-dark-700 dark:text-dark-300">Profile</span>
              </Link>

              <Link
                to="/settings"
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                onClick={() => setShowMobileMenu(false)}
              >
                <Settings className="w-5 h-5 text-dark-500" />
                <span className="text-sm text-dark-700 dark:text-dark-300">Settings</span>
              </Link>

              <button
                onClick={() => {
                  logout();
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors text-danger-600"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
