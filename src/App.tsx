import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import GlobalLayout from './components/Layout/GlobalLayout';

function App() {
  const { user, profile, loading } = useAuth();
  const [activeModule, setActiveModule] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Login />;
  }

  return (
    <GlobalLayout activeModule={activeModule} onModuleChange={setActiveModule}>
      {/* Dashboard Content */}
      {activeModule === 'dashboard' && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-sm text-gray-600 mb-1">Total Trucks</div>
              <div className="text-3xl font-bold text-gray-900">12</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-sm text-gray-600 mb-1">Active Deliveries</div>
              <div className="text-3xl font-bold text-blue-600">8</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-sm text-gray-600 mb-1">Low Stock Items</div>
              <div className="text-3xl font-bold text-red-600">3</div>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder for other modules */}
      {activeModule !== 'dashboard' && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 capitalize">
            {activeModule.replace('-', ' ')}
          </h1>
          <p className="text-gray-600">
            This module will be built next. Click Dashboard to see the overview.
          </p>
        </div>
      )}
    </GlobalLayout>
  );
}

export default App;