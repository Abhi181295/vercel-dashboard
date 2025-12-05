'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface HierarchyUser {
  id: string;
  name: string;
  role: 'SM' | 'M' | 'AM' | 'FLAP' | 'EM' | 'Dietitian';
  children?: HierarchyUser[];
  todayCounselling?: number;
  todayFollowUps?: number;
  yesterdayCounselling?: number;
  yesterdayFollowUps?: number;
}

export default function DailyTasksPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  
  const [selectedSM, setSelectedSM] = useState<HierarchyUser | null>(null);
  const [data, setData] = useState<HierarchyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for filters
  const [filters, setFilters] = useState({
    manager: '',
    am: '',
    flap: '',
    em: ''
  });

  // State for filter options
  const [filterOptions, setFilterOptions] = useState({
    sms: [] as string[],
    managers: [] as string[],
    ams: [] as string[],
    flaps: [] as string[],
    ems: [] as string[]
  });

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return '';
  };

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = () => {
      const hasCookie = document.cookie.includes('isAuthenticated=true');
      const hasLocalStorage = localStorage.getItem('isAuthenticated') === 'true';
      const authenticated = hasCookie || hasLocalStorage;
      
      if (authenticated) {
        const email = localStorage.getItem('userEmail') || getCookie('userEmail');
        const name = localStorage.getItem('userName') || decodeURIComponent(getCookie('userName') || '');
        const role = localStorage.getItem('userRole') || getCookie('userRole');
        
        setUserEmail(email || '');
        setUserName(name || '');
        setUserRole(role || '');
      }
      
      setIsAuthenticated(authenticated);
      
      if (!authenticated) {
        router.push('/login');
      }
    };

    setTimeout(checkAuth, 100);
  }, [router]);

  // Fetch data on component mount after authentication
  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadData() {
      try {
        setLoading(true);
        
        // For SM users, use their name; for admins, no filter initially
        const smName = userRole === 'sm' ? userName : '';
        
        const response = await fetch(`/api/daily-tasks${smName ? `?smName=${encodeURIComponent(smName)}` : ''}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch daily tasks data');
        }
        
        const { hierarchy, filterOptions } = await response.json();
        
        setData(hierarchy);
        setFilterOptions(filterOptions);
        
        if (hierarchy.length > 0) {
          // For SM users, automatically select their SM
          if (userRole === 'sm') {
            const userSM = hierarchy.find((sm: HierarchyUser) => 
              sm.name.toLowerCase() === userName.toLowerCase()
            );
            setSelectedSM(userSM || hierarchy[0]);
          } else {
            setSelectedSM(hierarchy[0]);
          }
        }

      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load daily tasks data from Google Sheets. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated, userRole, userName]);

  // Update filter options when SM changes
  useEffect(() => {
    async function updateFiltersForSM() {
      if (!selectedSM) return;
      
      try {
        const response = await fetch(`/api/daily-tasks?smName=${encodeURIComponent(selectedSM.name)}`);
        if (response.ok) {
          const { filterOptions } = await response.json();
          setFilterOptions(filterOptions);
        }
      } catch (error) {
        console.error('Error updating filter options:', error);
      }
    }
    
    if (selectedSM) {
      updateFiltersForSM();
    }
  }, [selectedSM]);

  const handleSMChange = async (smName: string) => {
    const sm = data.find(s => s.name === smName) || null;
    setSelectedSM(sm);
    
    // Reset filters when SM changes
    setFilters({ manager: '', am: '', flap: '', em: '' });
    
    // Update filter options for the selected SM
    if (sm) {
      try {
        const response = await fetch(`/api/daily-tasks?smName=${encodeURIComponent(sm.name)}`);
        if (response.ok) {
          const { filterOptions } = await response.json();
          setFilterOptions(filterOptions);
        }
      } catch (error) {
        console.error('Error updating filter options:', error);
      }
    }
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
    
    // Reset dependent filters
    if (filterType === 'manager') {
      setFilters(prev => ({
        ...prev,
        am: '',
        flap: '',
        em: ''
      }));
    } else if (filterType === 'am') {
      setFilters(prev => ({
        ...prev,
        flap: '',
        em: ''
      }));
    } else if (filterType === 'flap') {
      setFilters(prev => ({
        ...prev,
        em: ''
      }));
    }
  };

  const handleLogout = () => {
    document.cookie = 'isAuthenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'userEmail=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'userName=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    
    router.push('/login');
  };

  // Helper function to find all dietitians recursively
  const findAllDietitians = (user: HierarchyUser): HierarchyUser[] => {
    if (user.role === 'Dietitian') {
      return [user];
    }
    
    let dietitians: HierarchyUser[] = [];
    if (user.children) {
      user.children.forEach(child => {
        dietitians = [...dietitians, ...findAllDietitians(child)];
      });
    }
    
    return dietitians;
  };

  // Filter data based on selected filters
  const filteredManagers = useMemo(() => {
    if (!selectedSM) return [];
    
    let managers = selectedSM.children?.filter((child: any) => child.role === 'M') || [];
    
    if (filters.manager) {
      managers = managers.filter((m: any) => 
        m.name.toLowerCase() === filters.manager.toLowerCase()
      );
    }
    
    return managers;
  }, [selectedSM, filters.manager]);

  const filteredAMs = useMemo(() => {
    if (!selectedSM) return [];
    
    let allAMs: any[] = [];
    
    // Get AMs/FLAPs from all managers under this SM
    const managers = selectedSM.children?.filter((child: any) => child.role === 'M') || [];
    managers.forEach((manager: any) => {
      const amsFlaps = manager.children?.filter((child: any) => 
        child.role === 'AM' || child.role === 'FLAP'
      ) || [];
      allAMs = [...allAMs, ...amsFlaps];
    });
    
    // Also get AMs/FLAPs directly under SM (if any)
    const directAMsFlaps = selectedSM.children?.filter((child: any) => 
      child.role === 'AM' || child.role === 'FLAP'
    ) || [];
    allAMs = [...allAMs, ...directAMsFlaps];
    
    // Apply filters
    if (filters.manager) {
      const manager = selectedSM.children?.find((m: any) => 
        m.role === 'M' && m.name.toLowerCase() === filters.manager.toLowerCase()
      );
      allAMs = manager?.children?.filter((child: any) => 
        child.role === 'AM' || child.role === 'FLAP'
      ) || [];
    }
    
    if (filters.am) {
      allAMs = allAMs.filter((am: any) => 
        am.role === 'AM' && am.name.toLowerCase() === filters.am.toLowerCase()
      );
    }
    
    if (filters.flap) {
      allAMs = allAMs.filter((am: any) => 
        am.role === 'FLAP' && am.name.toLowerCase() === filters.flap.toLowerCase()
      );
    }
    
    return allAMs;
  }, [selectedSM, filters.manager, filters.am, filters.flap]);

  const filteredEMs = useMemo(() => {
    if (!selectedSM) return [];
    
    let allEMs: any[] = [];
    
    // Get EMs from all AMs/FLAPs under this SM
    const allAMsFlaps = filteredAMs;
    
    allAMsFlaps.forEach((amFlap: any) => {
      const ems = amFlap.children?.filter((child: any) => child.role === 'EM') || [];
      allEMs = [...allEMs, ...ems];
    });
    
    // Also get EMs directly under SM (if any)
    const directEMs = selectedSM.children?.filter((child: any) => child.role === 'EM') || [];
    allEMs = [...allEMs, ...directEMs];
    
    // Also get EMs directly under Managers (if any)
    const managers = selectedSM.children?.filter((child: any) => child.role === 'M') || [];
    managers.forEach((manager: any) => {
      const managerEMs = manager.children?.filter((child: any) => child.role === 'EM') || [];
      allEMs = [...allEMs, ...managerEMs];
    });
    
    // Apply EM filter
    if (filters.em) {
      allEMs = allEMs.filter((em: any) => 
        em.name.toLowerCase() === filters.em.toLowerCase()
      );
    }
    
    return allEMs;
  }, [selectedSM, filteredAMs, filters.em]);

  const filteredDietitians = useMemo(() => {
    if (!selectedSM) return [];
    
    // Find all dietitians recursively under the selected SM
    let allDietitians = findAllDietitians(selectedSM);
    
    // Apply filters
    if (filters.manager) {
      allDietitians = allDietitians.filter(dietitian => {
        // Check if dietitian is under the filtered manager
        const isUnderManager = (user: HierarchyUser, targetManager: string): boolean => {
          if (!user.children) return false;
          
          for (const child of user.children) {
            if (child.role === 'M' && child.name.toLowerCase() === targetManager.toLowerCase()) {
              // Check if dietitian is under this manager
              return findAllDietitians(child).some(d => d.id === dietitian.id);
            }
            if (isUnderManager(child, targetManager)) {
              return true;
            }
          }
          return false;
        };
        
        return isUnderManager(selectedSM, filters.manager);
      });
    }
    
    if (filters.am) {
      allDietitians = allDietitians.filter(dietitian => {
        const isUnderAM = (user: HierarchyUser, targetAM: string): boolean => {
          if (!user.children) return false;
          
          for (const child of user.children) {
            if (child.role === 'AM' && child.name.toLowerCase() === targetAM.toLowerCase()) {
              return findAllDietitians(child).some(d => d.id === dietitian.id);
            }
            if (isUnderAM(child, targetAM)) {
              return true;
            }
          }
          return false;
        };
        
        return isUnderAM(selectedSM, filters.am);
      });
    }
    
    if (filters.flap) {
      allDietitians = allDietitians.filter(dietitian => {
        const isUnderFLAP = (user: HierarchyUser, targetFLAP: string): boolean => {
          if (!user.children) return false;
          
          for (const child of user.children) {
            if (child.role === 'FLAP' && child.name.toLowerCase() === targetFLAP.toLowerCase()) {
              return findAllDietitians(child).some(d => d.id === dietitian.id);
            }
            if (isUnderFLAP(child, targetFLAP)) {
              return true;
            }
          }
          return false;
        };
        
        return isUnderFLAP(selectedSM, filters.flap);
      });
    }
    
    if (filters.em) {
      allDietitians = allDietitians.filter(dietitian => {
        const isUnderEM = (user: HierarchyUser, targetEM: string): boolean => {
          if (!user.children) return false;
          
          for (const child of user.children) {
            if (child.role === 'EM' && child.name.toLowerCase() === targetEM.toLowerCase()) {
              return findAllDietitians(child).some(d => d.id === dietitian.id);
            }
            if (isUnderEM(child, targetEM)) {
              return true;
            }
          }
          return false;
        };
        
        return isUnderEM(selectedSM, filters.em);
      });
    }
    
    return allDietitians;
  }, [selectedSM, filters.manager, filters.am, filters.flap, filters.em]);

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="crm-root">
        <div className="loading-full">Checking authentication...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="crm-root">
        <aside className="crm-aside">
          <div className="brand">
            <span className="brand-main">Fitelo</span>{' '}
            <span className="brand-sub">SM Dashboard</span>
            <span className="zap">⚡</span>
          </div>

           <nav className="nav">
  <a className="nav-item" onClick={() => router.push('/')}>
    <span className="i">🏠</span> Dashboard
  </a>
  <a className="nav-item" onClick={() => router.push('/')}>
    <span className="i">👥</span> Revenue
  </a>
  <a className="nav-item" onClick={() => router.push('/quality')}>
    <span className="i">✅</span> Quality
  </a>
  <a className="nav-item" onClick={() => router.push('/issues')}>
    <span className="i">🛠️</span> Issues
  </a>
  <a className="nav-item" onClick={() => router.push('/opportunities')}>
    <span className="i">🚀</span> Opportunities
  </a>
  <a className="nav-item" onClick={() => router.push('/daily-tasks')}>
  <span className="i">📋</span> Daily Tasks
</a>

<a className="nav-item" onClick={() => router.push('/dietitian-scorecard')}>
  <span className="i">📊</span> Dietitian Scorecard
</a>

  <a className="nav-item">
    <span className="i">📊</span> Analytics
  </a>
</nav>

          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-role">{userRole === 'admin' ? 'Administrator' : 'Senior Manager'}</div>
            <div className="user-email">{userEmail}</div>
            <button className="logout-btn" onClick={handleLogout}>
              ⎋ Logout
            </button>
          </div>
        </aside>
        <section className="crm-main">
          <div className="loading">Loading daily tasks data...</div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="crm-root">
        <aside className="crm-aside">
          <div className="brand">
            <span className="brand-main">Fitelo</span>{' '}
            <span className="brand-sub">SM Dashboard</span>
            <span className="zap">⚡</span>
          </div>

           <nav className="nav">
  <a className="nav-item" onClick={() => router.push('/')}>
    <span className="i">🏠</span> Dashboard
  </a>
  <a className="nav-item" onClick={() => router.push('/')}>
    <span className="i">👥</span> Revenue
  </a>
  <a className="nav-item" onClick={() => router.push('/quality')}>
    <span className="i">✅</span> Quality
  </a>
  <a className="nav-item" onClick={() => router.push('/issues')}>
    <span className="i">🛠️</span> Issues
  </a>
  <a className="nav-item" onClick={() => router.push('/opportunities')}>
    <span className="i">🚀</span> Opportunities
  </a>
  <a className="nav-item" onClick={() => router.push('/daily-tasks')}>
  <span className="i">📋</span> Daily Tasks
</a>

<a className="nav-item" onClick={() => router.push('/dietitian-scorecard')}>
  <span className="i">📊</span> Dietitian Scorecard
</a>

  <a className="nav-item">
    <span className="i">📊</span> Analytics
  </a>
</nav>

          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-role">{userRole === 'admin' ? 'Administrator' : 'Senior Manager'}</div>
            <div className="user-email">{userEmail}</div>
            <button className="logout-btn" onClick={handleLogout}>
              ⎋ Logout
            </button>
          </div>
        </aside>
        <section className="crm-main">
          <div className="error">
            <h2>Error Loading Data</h2>
            <p>{error}</p>
            <button 
              className="btn" 
              onClick={() => window.location.reload()}
              style={{ marginTop: '16px' }}
            >
              Try Again
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="crm-root">
      <aside className="crm-aside">
        <div className="brand">
          <span className="brand-main">Fitelo</span>{' '}
          <span className="brand-sub">SM Dashboard</span>
          <span className="zap">⚡</span>
        </div>

         <nav className="nav">
  <a className="nav-item" onClick={() => router.push('/')}>
    <span className="i">🏠</span> Dashboard
  </a>
  <a className="nav-item" onClick={() => router.push('/')}>
    <span className="i">👥</span> Revenue
  </a>
  <a className="nav-item" onClick={() => router.push('/quality')}>
    <span className="i">✅</span> Quality
  </a>
  <a className="nav-item" onClick={() => router.push('/issues')}>
    <span className="i">🛠️</span> Issues
  </a>
  <a className="nav-item" onClick={() => router.push('/opportunities')}>
    <span className="i">🚀</span> Opportunities
  </a>
  <a className="nav-item" onClick={() => router.push('/daily-tasks')}>
  <span className="i">📋</span> Daily Tasks
</a>

<a className="nav-item" onClick={() => router.push('/dietitian-scorecard')}>
  <span className="i">📊</span> Dietitian Scorecard
</a>

  <a className="nav-item">
    <span className="i">📊</span> Analytics
  </a>
</nav>

        <div className="user-info">
          <div className="user-name">{userName}</div>
          <div className="user-role">{userRole === 'admin' ? 'Administrator' : 'Senior Manager'}</div>
          <div className="user-email">{userEmail}</div>
          <button className="logout-btn" onClick={handleLogout}>
            ⎋ Logout
          </button>
        </div>
      </aside>

      <section className="crm-main">
        <header className="top">
          <div>
            <h1 className="title">Daily Tasks</h1>
            <p className="subtitle">Track daily counselling and follow-up tasks</p>
            <p className="date-info">Today's Date: {new Date().toLocaleDateString('en-IN', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>

          <div className="actions">
            <button 
              className="btn" 
              title="Refresh" 
              onClick={() => window.location.reload()}
            >
              ⟲ Refresh
            </button>
          </div>
        </header>

        <div className="selection-row">
          {userRole === 'admin' && (
            <div className="select-group">
              <label className="select-label">Select SM:</label>
              <select 
                className="select" 
                value={selectedSM?.name || ''}
                onChange={(e) => handleSMChange(e.target.value)}
              >
                <option value="">-- Select SM --</option>
                {filterOptions.sms.map(sm => (
                  <option key={sm} value={sm}>{sm}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {userRole === 'sm' && (
          <div className="user-welcome">
            <h3>Welcome, {userName}</h3>
            <p>Viewing your team's daily tasks</p>
          </div>
        )}

        {/* Filters Section */}
        <div className="filters-section">
          <h3 className="filters-title">Filters</h3>
          <div className="filters-grid">
            <div className="filter-group">
              <label className="filter-label">Manager:</label>
              <select 
                className="filter-select"
                value={filters.manager}
                onChange={(e) => handleFilterChange('manager', e.target.value)}
                disabled={!selectedSM || filterOptions.managers.length === 0}
              >
                <option value="">All Managers</option>
                {filterOptions.managers.map((manager: string) => (
                  <option key={manager} value={manager}>{manager}</option>
                ))}
              </select>
              {!selectedSM && <div className="filter-hint">Select an SM first</div>}
              {selectedSM && filterOptions.managers.length === 0 && <div className="filter-hint">No managers found</div>}
            </div>

            <div className="filter-group">
              <label className="filter-label">AM:</label>
              <select 
                className="filter-select"
                value={filters.am}
                onChange={(e) => handleFilterChange('am', e.target.value)}
                disabled={!selectedSM || filterOptions.ams.length === 0}
              >
                <option value="">All AMs</option>
                {filterOptions.ams.map((am: string) => (
                  <option key={am} value={am}>{am}</option>
                ))}
              </select>
              {!selectedSM && <div className="filter-hint">Select an SM first</div>}
              {selectedSM && filterOptions.ams.length === 0 && <div className="filter-hint">No AMs found</div>}
            </div>

            <div className="filter-group">
              <label className="filter-label">FLAP:</label>
              <select 
                className="filter-select"
                value={filters.flap}
                onChange={(e) => handleFilterChange('flap', e.target.value)}
                disabled={!selectedSM || filterOptions.flaps.length === 0}
              >
                <option value="">All FLAPs</option>
                {filterOptions.flaps.map((flap: string) => (
                  <option key={flap} value={flap}>{flap}</option>
                ))}
              </select>
              {!selectedSM && <div className="filter-hint">Select an SM first</div>}
              {selectedSM && filterOptions.flaps.length === 0 && <div className="filter-hint">No FLAPs found</div>}
            </div>

            <div className="filter-group">
              <label className="filter-label">EM:</label>
              <select 
                className="filter-select"
                value={filters.em}
                onChange={(e) => handleFilterChange('em', e.target.value)}
                disabled={!selectedSM || filterOptions.ems.length === 0}
              >
                <option value="">All EMs</option>
                {filterOptions.ems.map((em: string) => (
                  <option key={em} value={em}>{em}</option>
                ))}
              </select>
              {!selectedSM && <div className="filter-hint">Select an SM first</div>}
              {selectedSM && filterOptions.ems.length === 0 && <div className="filter-hint">No EMs found</div>}
            </div>
          </div>
        </div>

        {/* SM Table */}
        {selectedSM && (
          <div className="section">
            <h2 className="section-title">Senior Manager</h2>
            <div className="card">
              <DailyTasksTable 
                data={[selectedSM]} 
                type="sm" 
              />
            </div>
          </div>
        )}

        {/* Managers Table */}
        {filteredManagers.length > 0 && (
          <div className="section">
            <h2 className="section-title">Managers</h2>
            <div className="card">
              <DailyTasksTable 
                data={filteredManagers} 
                type="manager" 
              />
            </div>
          </div>
        )}

        {/* AMs/FLAPs Table */}
        {filteredAMs.length > 0 && (
          <div className="section">
            <h2 className="section-title">AMs/FLAPs</h2>
            <div className="card">
              <DailyTasksTable 
                data={filteredAMs} 
                type="am" 
              />
            </div>
          </div>
        )}

        {/* EMs Table */}
        {filteredEMs.length > 0 && (
          <div className="section">
            <h2 className="section-title">EMs</h2>
            <div className="card">
              <DailyTasksTable 
                data={filteredEMs} 
                type="em" 
              />
            </div>
          </div>
        )}

        {/* Dietitians Table */}
        {filteredDietitians.length > 0 && (
          <div className="section">
            <h2 className="section-title">Dietitians</h2>
            <div className="card">
              <DailyTasksTable 
                data={filteredDietitians} 
                type="dietitian" 
              />
            </div>
          </div>
        )}

        {!selectedSM && data.length === 0 && (
          <div className="section">
            <div className="card">
              <div className="no-data">
                <h3>No Data Available</h3>
                <p>No SM data found.</p>
              </div>
            </div>
          </div>
        )}

        {selectedSM && 
         filteredManagers.length === 0 && 
         filteredAMs.length === 0 && 
         filteredEMs.length === 0 && 
         filteredDietitians.length === 0 && (
          <div className="section">
            <div className="card">
              <div className="no-data">
                <h3>No Team Members Found</h3>
                <p>No team members found for the selected filters under {selectedSM.name}.</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <style jsx global>{`
        .filters-section {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .filters-title {
          margin: 0 0 16px 0;
          color: var(--text);
          font-size: 16px;
          font-weight: 600;
        }

        .filters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .filter-label {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        .filter-select {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 14px;
          width: 100%;
        }

        .filter-select:disabled {
          background: #f9fafb;
          color: #6b7280;
          cursor: not-allowed;
        }

        .filter-hint {
          font-size: 12px;
          color: #6b7280;
          font-style: italic;
        }

        .daily-tasks-table {
          width: 100%;
        }

        .daily-tasks-thead {
          display: grid;
          grid-template-columns: minmax(200px, 1fr) minmax(150px, 1fr) 1fr 1fr;
          background: linear-gradient(180deg, #ffffff, #fbfbfb);
          border-bottom: 1px solid var(--line2);
          padding: 12px 16px;
        }

        .daily-tasks-row {
          display: grid;
          grid-template-columns: minmax(200px, 1fr) minmax(150px, 1fr) 1fr 1fr;
          padding: 12px 16px;
          align-items: center;
          border-bottom: 1px solid var(--line2);
          transition: background 0.12s ease;
        }

        .daily-tasks-row:hover {
          background: #fafbfd;
        }

        .daily-tasks-row:last-child {
          border-bottom: none;
        }

        .daily-tasks-h-name {
          padding: 12px;
        }

        .daily-tasks-h-role {
          padding: 12px;
          text-align: center;
        }

        .daily-tasks-h-group {
          padding: 12px;
          text-align: center;
        }

        .daily-tasks-h-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: #111827;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .daily-tasks-h-sub {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
        }

        .daily-tasks-h-sub.yesterday {
          grid-template-columns: 1fr 1fr 1fr;
        }

        .daily-tasks-c-name {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .daily-tasks-c-role {
          color: #64748b;
          text-align: center;
        }

        .daily-tasks-grp {
          padding: 0 8px;
        }

        .daily-tasks-nums {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          align-items: center;
        }

        .daily-tasks-nums.yesterday {
          grid-template-columns: 1fr 1fr 1fr;
        }

        .daily-tasks-n {
          font-weight: 600;
          font-size: 13px;
          text-align: center;
          padding: 8px 4px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
        }

        .daily-tasks-n.today {
          background: #dbeafe;
          border-color: #3b82f6;
          color: #1e40af;
        }

        .nm {
          font-weight: 600;
        }

        .badge {
          font-size: 11px;
          border-radius: 999px;
          padding: 4px 10px;
          border: 1px solid var(--line);
        }

        .badge.sm {
          background: #ecfdf5;
        }

        .badge.m {
          background: #eef2ff;
        }

        .badge.am {
          background: #fff7ed;
        }

        .badge.flap {
          background: #fffdea;
        }

        .badge.em {
          background: #f0fdf4;
        }

        .badge.dietitian {
          background: #f8fafc;
        }

        .no-data {
          text-align: center;
          padding: 40px 20px;
          color: #64748b;
          font-style: italic;
        }

        .loading-full {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-size: 18px;
          color: #64748b;
        }

        .user-welcome {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .user-welcome h3 {
          margin: 0 0 4px 0;
          color: var(--text);
          font-size: 16px;
        }

        .user-welcome p {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
        }

        .date-info {
          margin: 4px 0 0 0;
          color: #6b7280;
          font-size: 14px;
          font-style: italic;
        }
      `}</style>

      <style jsx global>{`
        :root{
          --bg:#f8fafc;
          --card:#ffffff;
          --line:#e5e7eb;
          --line2:#eef0f3;
          --muted:#64748b;
          --text:#0f172a;
          --good:#16a34a;
          --warn:#f59e0b;
          --low:#dc2626;
        }

        .crm-root{display:grid;grid-template-columns:260px 1fr;min-height:100vh}
        .crm-aside{background:#ffffff;border-right:1px solid var(--line);padding:18px 16px;display:flex;flex-direction:column}
        .brand{font-weight:700;font-size:18px;margin:4px 6px 14px}
        .brand-main{color:#111827}
        .brand-sub{color:#f97316;margin-left:6px}
        .zap{margin-left:6px}

        .nav{display:flex;flex-direction:column;gap:4px}
        .nav-item{display:flex;align-items:center;gap:10px;padding:10px 10px;border-radius:10px;color:#0f172a;text-decoration:none;cursor:pointer}
        .nav-item:hover{background:#f3f4f6}
        .nav-item.active{background:#eef2ff}

        .crm-main{padding:18px 22px 40px;display:flex;flex-direction:column;gap:16px}
        .top{display:flex;justify-content:space-between;align-items:center}
        .title{margin:0 0 4px 0}
        .subtitle{margin:0;color:var(--muted)}
        .date-info{margin:4px 0 0 0;color:#6b7280;font-size:14px;font-style:italic}
        .actions{display:flex;gap:8px}
        .btn{background:#0f172a;color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer}
        .btn:hover{opacity:.9}

        .selection-row{display:flex;gap:20px;align-items:end}
        .select-group{display:flex;flex-direction:column;gap:6px}
        .select-label{font-size:13px;font-weight:600;color:#374151}
        .select{background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px 12px;min-width:200px;outline:none}
        .select:focus{border-color:#cbd5e1}
        .select:disabled{background:#f9fafb;color:#6b7280}

        .user-info {
          margin-top: auto;
          padding: 16px;
          border-top: 1px solid var(--line);
          text-align: center;
        }

        .user-name {
          font-weight: 600;
          color: var(--text);
        }

        .user-role {
          font-size: 12px;
          color: var(--muted);
          margin-top: 4px;
        }

        .user-email {
          font-size: 11px;
          color: var(--muted);
          margin-top: 2px;
          margin-bottom: 12px;
        }

        .logout-btn {
          width: 100%;
          background: #ef4444;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .logout-btn:hover {
          background: #dc2626;
        }

        .loading, .error {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 200px;
          font-size: 18px;
          color: var(--muted);
          text-align: center;
        }
        
        .error {
          color: #ef4444;
        }
        
        .error h2 {
          margin: 0 0 8px 0;
          color: #dc2626;
        }
        
        .error p {
          margin: 0 0 16px 0;
          max-width: 400px;
          line-height: 1.5;
        }

        .section {
          margin-top: 8px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 12px 0;
        }

        .card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 14px;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

// Daily Tasks Table Component
function DailyTasksTable({ data, type }: { data: any[], type: 'sm' | 'manager' | 'am' | 'em' | 'dietitian' }) {
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SM': return 'sm';
      case 'M': return 'm';
      case 'AM': return 'am';
      case 'FLAP': return 'flap';
      case 'EM': return 'em';
      case 'Dietitian': return 'dietitian';
      default: return '';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'SM': return 'Senior Manager';
      case 'M': return 'Manager';
      case 'AM': return 'Assistant Manager';
      case 'FLAP': return 'FLAP';
      case 'EM': return 'Executive Manager';
      case 'Dietitian': return 'Dietitian';
      default: return role;
    }
  };

  return (
    <div className="daily-tasks-table">
      <div className="daily-tasks-thead">
        <div className="daily-tasks-h-name">
          <div className="daily-tasks-h-title">
            {type === 'sm' ? 'SM Name' : 
             type === 'manager' ? 'Manager Name' :
             type === 'am' ? 'AM/FLAP Name' :
             type === 'em' ? 'EM Name' : 'Dietitian Name'}
          </div>
          <div className="daily-tasks-h-sub">
            {type === 'sm' ? 'Senior Manager' : 
             type === 'manager' ? 'Reporting Manager' :
             type === 'am' ? 'Team members' :
             type === 'em' ? 'Executive Manager' : 'Dietitian'}
          </div>
        </div>
        
        <div className="daily-tasks-h-role">
          <div className="daily-tasks-h-title">Role</div>
        </div>

        {/* Today Column */}
        <div className="daily-tasks-h-group">
          <div className="daily-tasks-h-title">Today</div>
          <div className="daily-tasks-h-sub">
            <span>#Counselling</span>
            <span>#Follow-ups</span>
          </div>
        </div>

        {/* Yesterday Column */}
        <div className="daily-tasks-h-group">
          <div className="daily-tasks-h-title">Yesterday</div>
          <div className="daily-tasks-h-sub yesterday">
            <span>#Counselling</span>
            <span>#Follow-ups</span>
            <span>#Counselling Completed</span>
            {/*<span>#Follow-ups Completed</span>*/}
          </div>
        </div>
      </div>

      <div className="daily-tasks-tbody">
        {data.map((item) => (
          <div key={item.id} className="daily-tasks-row">
            <div className="daily-tasks-c-name">
              <span className="nm">{item.name}</span>
              <span className={`badge ${getRoleBadge(item.role)}`}>{item.role}</span>
            </div>
            
            <div className="daily-tasks-c-role">
              {getRoleDisplayName(item.role)}
            </div>

            {/* Today Metrics */}
            <div className="daily-tasks-grp">
              <div className="daily-tasks-nums">
                <div className="daily-tasks-n today">{item.todayCounselling || 0}</div>
                <div className="daily-tasks-n today">{item.todayFollowUps || 0}</div>
              </div>
            </div>

            {/* Yesterday Metrics */}
            <div className="daily-tasks-grp">
              <div className="daily-tasks-nums yesterday">
                <div className="daily-tasks-n yesterday">{item.yesterdayCounselling || 0}</div>
                <div className="daily-tasks-n">{item.yesterdayFollowUps || 0}</div>
                <div className="daily-tasks-n">{item.yesterdayCounsellingCompleted || 0}</div>
                 {/* <div className="daily-tasks-n">{item.yesterdayFollowUpsCompleted || 0}</div>*/}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}