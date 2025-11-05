// app/login/page.tsx

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// SM credentials mapping
const SM_CREDENTIALS = {
  'manpreet.sidhu@fitelo.co': {
    name: 'Manpreet Kaur Sidhu',
    password: 'Manpreet123',
    role: 'sm'
  },
  'manpreet.kaur@fitelo.co': {
    name: 'Manpreet Kaur Dhillon', 
    password: 'Manpreet456',
    role: 'sm'
  },
  'palak.thakur@fitelo.co': {
    name: 'Palak Thakur',
    password: 'Palak123',
    role: 'sm'
  },
  'nandini.sharma@fitelo.co': {
    name: 'Nandini Soti',
    password: 'Nandini123',
    role: 'sm'
  },
  'santdeep@fitelo.co': {
    name: 'Santdeep Singh',
    password: 'Santdeep123',
    role: 'sm'
  },
  'admin@fitelo.co': {
    name: 'Admin User',
    password: 'Fitelo12345@',
    role: 'admin'
  }
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const user = SM_CREDENTIALS[email as keyof typeof SM_CREDENTIALS];
    
    if (user && password === user.password) {
      try {
        // Set authentication cookies
        document.cookie = `isAuthenticated=true; path=/; max-age=86400`;
        document.cookie = `userEmail=${email}; path=/; max-age=86400`;
        document.cookie = `userName=${encodeURIComponent(user.name)}; path=/; max-age=86400`;
        document.cookie = `userRole=${user.role}; path=/; max-age=86400`;
        
        // Also set in localStorage for client-side checks
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userName', user.name);
        localStorage.setItem('userRole', user.role);
        
        // Redirect to dashboard
        router.push(next);
      } catch (err) {
        setError('Login failed. Please try again.');
      }
    } else {
      setError('Invalid email or password.');
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Fitelo SM Dashboard</h1>
          <p>Sign in to access your team dashboard</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoComplete="username"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          padding: 20px;
        }
        
        .login-card {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          width: 100%;
          max-width: 400px;
        }
        
        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }
        
        .login-header h1 {
          margin: 0 0 8px 0;
          color: #111827;
          font-size: 24px;
          font-weight: 700;
        }
        
        .login-header p {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }
        
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .form-group label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }
        
        .form-group input {
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
        }
        
        .form-group input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .error-message {
          background: #fef2f2;
          color: #dc2626;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          border: 1px solid #fecaca;
        }
        
        .login-button {
          background: #111827;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        
        .login-button:hover:not(:disabled) {
          opacity: 0.9;
        }
        
        .login-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
