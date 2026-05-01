import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Calendar from './pages/Calendar';
import Posts from './pages/Posts';
import Accounts from './pages/Accounts';
import BrandIntelligence from './pages/BrandIntelligence';
import ContentTools from './pages/ContentTools';
import FestivalEngine from './pages/FestivalEngine';
import OptimizationTools from './pages/OptimizationTools';
import ProtectionTools from './pages/ProtectionTools';
import QualityChecker from './pages/QualityChecker';
import LoadingSpinner from './components/LoadingSpinner';

function PrivateRoute({ children }) {
  const { admin, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  return admin ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { admin, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  return admin ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="calendar/:clientId" element={<Calendar />} />
            <Route path="posts/:clientId" element={<Posts />} />
            <Route path="accounts/:clientId" element={<Accounts />} />
            {/* Phase 7-10 — AI Features */}
            <Route path="brand-intel/:clientId" element={<BrandIntelligence />} />
            <Route path="content-tools/:clientId" element={<ContentTools />} />
            <Route path="festival/:clientId" element={<FestivalEngine />} />
            <Route path="optimize/:clientId" element={<OptimizationTools />} />
            <Route path="protection/:clientId" element={<ProtectionTools />} />
            <Route path="quality/:clientId" element={<QualityChecker />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
