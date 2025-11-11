import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card-strong p-10 max-w-md w-full"
      >
        <h1 className="text-3xl font-bold gradient-text mb-4">Create Account</h1>
        <p className="text-dark-600 dark:text-dark-400 mb-8">Register page - To be implemented</p>
        <Link to="/login" className="btn-outline">
          Back to Login
        </Link>
      </motion.div>
    </div>
  );
}
