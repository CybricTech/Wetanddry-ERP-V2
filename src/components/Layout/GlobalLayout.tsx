import React, { useState } from 'react';
import { LayoutDashboard, Truck, Package, Fuel, FlaskConical, Users, Settings, Bell, Search, Menu, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface GlobalLayoutProps {
  children: React.ReactNode;
  activeModule: string;
  onModuleChange: (module: string) => void;
}

export default function GlobalLayout({ children, activeModule, onModuleChange }: GlobalLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { profile, signOut } = useAuth();

  const modules = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'trucks', name: 'Truck & Asset Management', icon: Truck },
    { id: 'inventory', name: 'Inventory Management', icon: Package },
    { id: 'diesel', name: 'Diesel Management', icon: Fuel },
    { id: 'mixology', name: 'Mixology (Recipes)', icon: FlaskConical },
    { id: 'users', name: 'User Management', icon: Users },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`bg-blue-900 text-white transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-64'} flex flex-col`}>
        {/* Logo Area */}
        <div className="p-4 border-b border-blue-800 flex items-center justify-between">
          {!sidebarCollapsed && (
            <div>
              <h1 className="text-xl font-bold">Wet & Dry Ltd</h1>
              <p className="text-xs text-blue-300">Enterprise Management</p>
            </div>
          )}
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-blue-800 rounded"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto py-4">
          {modules.map((module) => {
            const Icon = module.icon;
            const isActive = activeModule === module.id;
            return (
              <button
                key={module.id}
                onClick={() => onModuleChange(module.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                  isActive 
                    ? 'bg-blue-800 border-l-4 border-yellow-400' 
                    : 'hover:bg-blue-800/50'
                }`}
              >
                <Icon size={20} />
                {!sidebarCollapsed && <span className="text-sm font-medium">{module.name}</span>}
              </button>
            );
          })}
        </nav>

        {/* User Profile Area */}
        <div className="p-4 border-t border-blue-800">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-blue-900">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{profile?.full_name}</p>
                <p className="text-xs text-blue-300 capitalize">{profile?.role?.replace('_', ' ')}</p>
              </div>
              <button onClick={handleLogout} className="p-2 hover:bg-blue-800 rounded">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-blue-900 mx-auto">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* Search Bar */}
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search trucks, materials, records..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="relative p-2 hover:bg-gray-100 rounded-lg">
              <Bell size={20} className="text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
