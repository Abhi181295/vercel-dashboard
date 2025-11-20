'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Reuse existing types from main dashboard
type UserWithTargets = {
  id: string;
  name: string;
  role: 'SM' | 'M' | 'AM' | 'FLAP';
  targets: {
    service: number;
    commerce: number;
  };
  scaledTargets?: {
    service: {
      y: number;
      w: number;
      m: number;
    };
    commerce: {
      y: number;
      w: number;
      m: number;
    };
  };
  achieved?: {
    service: {
      y: number;
      w: number;
      m: number;
    };
    commerce: {
      y: number;
      w: number;
      m: number;
    };
  };
  managerId?: string;
  smId?: string;
};

type SM = {
  id: string;
  name: string;
  role: 'SM';
  metrics: any;
  children: any[];
  targets: {
    service: number;
    commerce: number;
  };
  scaledTargets?: {
    service: {
      y: number;
      w: number;
      m: number;
    };
    commerce: {
      y: number;
      w: number;
      m: number;
    };
  };
  achieved?: {
    service: {
      y: number;
      w: number;
      m: number;
    };
    commerce: {
      y: number;
      w: number;
      m: number;
    };
  };
};

type DietitianQualityRecord = {
  customerCode: string;
  dietitianName: string;
  subscriptionStartDate: string;
  emName: string;
  flapName: string;
  amName: string;
  managerName: string;
  smName: string;
  csatScore: number;
  npsScore: number;
};

export default function OpportunitiesPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  
  const [selectedSM, setSelectedSM] = useState<SM | null>(null);
  const [data, setData] = useState<SM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for opportunity details panel
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<string>('');
  
  // State for High NPS/CSAT data
  const [highNpsData, setHighNpsData] = useState<DietitianQualityRecord[]>([]);
  const [highCsatData, setHighCsatData] = useState<DietitianQualityRecord[]>([]);
  const [loadingNps, setLoadingNps] = useState(false);
  const [loadingCsat, setLoadingCsat] = useState(false);
  
  // State for filters
  const [qualityFilters, setQualityFilters] = useState({
    manager: '',
    am: '',
    flap: '',
    em: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    managers: [] as string[],
    ams: [] as string[],
    flaps: [] as string[],
    ems: [] as string[]
  });

  // State for quality details panel
  const [isQualityPanelOpen, setIsQualityPanelOpen] = useState(false);
  const [selectedQualityType, setSelectedQualityType] = useState<'nps' | 'csat' | ''>('');
  const [activeQualityType, setActiveQualityType] = useState<'high' | ''>('');

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
        
        const [hierarchyResponse] = await Promise.all([
          fetch('/api/hierarchy')
        ]);
        
        if (!hierarchyResponse.ok) {
          throw new Error('Failed to fetch hierarchy data');
        }
        
        const { sms, managers, ams } = await hierarchyResponse.json();
        
        // Filter data based on user role
        let filteredData = sms;
        if (userRole === 'sm') {
          filteredData = sms.filter((sm: UserWithTargets) => 
            sm.name.toLowerCase() === userName.toLowerCase()
          );
        }
        
        // Build hierarchy similar to main dashboard
        const hierarchy = filteredData.map((sm: any) => ({
          ...sm,
          children: managers.filter((m: any) => m.smId === sm.id).map((manager: any) => ({
            ...manager,
            children: ams.filter((am: any) => am.managerId === manager.id || am.smId === sm.id)
          }))
        }));
        
        setData(hierarchy);
        
        if (hierarchy.length > 0) {
          setSelectedSM(hierarchy[0]);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data from Google Sheets. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated, userRole, userName]);

  // Auto-load quality data when page loads or SM changes
  useEffect(() => {
    if (selectedSM || userRole === 'sm') {
      const smName = userRole === 'sm' ? userName : selectedSM?.name;
      if (smName) {
        loadInitialQualityData(smName);
        fetchFilterOptions();
      }
    }
  }, [selectedSM, userRole, userName]);

  const loadInitialQualityData = async (smName: string) => {
    try {
      // Load High NPS data
      const npsResponse = await fetch(`/api/high-nps-issues?smName=${smName}&type=high`);
      if (npsResponse.ok) {
        const npsData = await npsResponse.json();
        setHighNpsData(npsData.records || []);
      }

      // Load High CSAT data  
      const csatResponse = await fetch(`/api/high-csat-issues?smName=${smName}&type=high`);
      if (csatResponse.ok) {
        const csatData = await csatResponse.json();
        setHighCsatData(csatData.records || []);
      }
    } catch (error) {
      console.error('Error loading initial quality data:', error);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const smName = userRole === 'sm' ? userName : selectedSM?.name;
      if (!smName) return;

      const queryParams = new URLSearchParams({ smName });
      const response = await fetch(`/api/quality-records?${queryParams}`);
      
      if (response.ok) {
        const data = await response.json();
        setFilterOptions(data.filterOptions);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  // Handle quality view for High NPS/CSAT in panel
  const handleQualityView = async (metric: 'nps' | 'csat', type: 'high') => {
    const smName = userRole === 'sm' ? userName : selectedSM?.name;
    if (!smName) return;

    const queryParams = new URLSearchParams({
      smName,
      type,
      ...(qualityFilters.manager && { managerName: qualityFilters.manager }),
      ...(qualityFilters.am && { amName: qualityFilters.am }),
      ...(qualityFilters.flap && { flapName: qualityFilters.flap }),
      ...(qualityFilters.em && { emName: qualityFilters.em })
    });

    if (metric === 'nps') {
      setLoadingNps(true);
      setActiveQualityType(type);
      try {
        const response = await fetch(`/api/high-nps-issues?${queryParams}`);
        if (response.ok) {
          const data = await response.json();
          setHighNpsData(data.records);
        }
      } catch (error) {
        console.error('Error fetching High NPS data:', error);
      } finally {
        setLoadingNps(false);
      }
    } else {
      setLoadingCsat(true);
      setActiveQualityType(type);
      try {
        const response = await fetch(`/api/high-csat-issues?${queryParams}`);
        if (response.ok) {
          const data = await response.json();
          setHighCsatData(data.records);
        }
      } catch (error) {
        console.error('Error fetching High CSAT data:', error);
      } finally {
        setLoadingCsat(false);
      }
    }
  };

  // Handle filter changes
  const handleFilterChange = (filterType: string, value: string) => {
    setQualityFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
    
    // Reset dependent filters
    if (filterType === 'manager') {
      setQualityFilters(prev => ({
        ...prev,
        am: '',
        flap: '',
        em: ''
      }));
    } else if (filterType === 'am') {
      setQualityFilters(prev => ({
        ...prev,
        flap: '',
        em: ''
      }));
    } else if (filterType === 'flap') {
      setQualityFilters(prev => ({
        ...prev,
        em: ''
      }));
    }

    // Reset active views when filters change
    setActiveQualityType('');
    setHighNpsData([]);
    setHighCsatData([]);
  };

  // Handle quality details view with HIGH pre-selected
  const handleQualityDetails = async (qualityType: 'nps' | 'csat') => {
    setSelectedQualityType(qualityType);
    setIsQualityPanelOpen(true);
    
    // Set HIGH as active quality type by default
    setActiveQualityType('high');
    
    const smName = userRole === 'sm' ? userName : selectedSM?.name;
    if (!smName) return;

    // Reset filters
    setQualityFilters({ manager: '', am: '', flap: '', em: '' });
    
    // Load HIGH data for the selected quality type
    const queryParams = new URLSearchParams({ 
      smName, 
      type: 'high'
    });
    
    if (qualityType === 'nps') {
      setLoadingNps(true);
      try {
        const response = await fetch(`/api/high-nps-issues?${queryParams}`);
        if (response.ok) {
          const data = await response.json();
          setHighNpsData(data.records || []);
        }
      } catch (error) {
        console.error('Error fetching High NPS data:', error);
      } finally {
        setLoadingNps(false);
      }
    } else {
      setLoadingCsat(true);
      try {
        const response = await fetch(`/api/high-csat-issues?${queryParams}`);
        if (response.ok) {
          const data = await response.json();
          setHighCsatData(data.records || []);
        }
      } catch (error) {
        console.error('Error fetching High CSAT data:', error);
      } finally {
        setLoadingCsat(false);
      }
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

  const handleSMChange = (smId: string) => {
    const sm = data.find(s => s.id === smId) || null;
    setSelectedSM(sm);
    
    // Reset quality filters when SM changes
    setQualityFilters({ manager: '', am: '', flap: '', em: '' });
    setActiveQualityType('');
    setHighNpsData([]);
    setHighCsatData([]);
    
    // Auto-load quality data for new SM
    if (sm) {
      loadInitialQualityData(sm.name);
    } else if (userRole === 'sm') {
      loadInitialQualityData(userName);
    }
  };

  const handleViewDetails = (opportunityType: string) => {
    setSelectedOpportunity(opportunityType);
    setIsPanelOpen(true);
  };

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
            <a className="nav-item active">
              <span className="i">🚀</span> Opportunities
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
          <div className="loading">Loading opportunities data...</div>
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
            <a className="nav-item active">
              <span className="i">🚀</span> Opportunities
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
          <a className="nav-item active">
            <span className="i">🚀</span> Opportunities
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
            <h1 className="title">Opportunities Management</h1>
            <p className="subtitle">Identify and leverage high-performing quality metrics</p>
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
                value={selectedSM?.id || ''}
                onChange={(e) => handleSMChange(e.target.value)}
              >
                <option value="">-- Select SM --</option>
                {data.map(sm => (
                  <option key={sm.id} value={sm.id}>{sm.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {userRole === 'sm' && (
          <div className="user-welcome">
            <h3>Welcome, {userName}</h3>
            <p>Viewing your team's quality opportunities</p>
          </div>
        )}

        {/* Opportunities Cards */}
        <div className="issues-grid">
          {/* High NPS Opportunities Card */}
          <div className="issue-card">
            <div className="issue-header">
              <h3 className="issue-title">High NPS Opportunities</h3>
              <div className="issue-count" style={{background: '#10b981'}}>{highNpsData.length}</div>
            </div>
            <p className="issue-description">
              Clients with high NPS scores (9-10)
              <br />
              <small>Excellent customer satisfaction and loyalty</small>
            </p>
            
            <button 
              className="view-details-btn"
              onClick={() => handleQualityDetails('nps')}
              style={{background: '#10b981'}}
            >
              View Details →
            </button>
          </div>

          {/* High CSAT Opportunities Card */}
          <div className="issue-card">
            <div className="issue-header">
              <h3 className="issue-title">High CSAT Opportunities</h3>
              <div className="issue-count" style={{background: '#10b981'}}>{highCsatData.length}</div>
            </div>
            <p className="issue-description">
              Clients with high CSAT scores (4-5)
              <br />
              <small>Outstanding service experience</small>
            </p>
            
            <button 
              className="view-details-btn"
              onClick={() => handleQualityDetails('csat')}
              style={{background: '#10b981'}}
            >
              View Details →
            </button>
          </div>
        </div>

        {/* Quality Details Panel */}
        {isQualityPanelOpen && (
          <QualityDetailsPanel
            isOpen={isQualityPanelOpen}
            onClose={() => {
              setIsQualityPanelOpen(false);
              setSelectedQualityType('');
              setActiveQualityType('');
            }}
            qualityType={selectedQualityType as 'nps' | 'csat'}
            filters={qualityFilters}
            filterOptions={filterOptions}
            onFilterChange={handleFilterChange}
            onQualityView={handleQualityView}
            npsData={highNpsData}
            csatData={highCsatData}
            loadingNps={loadingNps}
            loadingCsat={loadingCsat}
            activeQualityType={activeQualityType}
          />
        )}
      </section>

      {/* CSS Styles */}
      <style jsx global>{`
        .issues-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }

        .issue-card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 20px;
          transition: all 0.2s ease;
        }

        .issue-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .issue-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .issue-title {
          margin: 0;
          color: var(--text);
          font-size: 18px;
          font-weight: 600;
        }

        .issue-count {
          background: #10b981;
          color: white;
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 14px;
          font-weight: 600;
          min-width: 30px;
          text-align: center;
        }

        .issue-description {
          margin: 0 0 20px 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.5;
        }

        .issue-description small {
          font-size: 12px;
          color: #94a3b8;
          font-style: italic;
        }

        .view-details-btn {
          background: #10b981;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
          width: 100%;
        }

        .view-details-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .view-details-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .no-data {
          text-align: center;
          padding: 40px 20px;
          color: #64748b;
          font-style: italic;
        }

        .loading {
          text-align: center;
          padding: 20px;
          color: #64748b;
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

        /* Quality Table Styles */
        .quality-table-container {
          margin-top: 16px;
          border: 1px solid var(--line);
          border-radius: 8px;
          overflow: auto;
          background: white;
        }

        .quality-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 800px;
        }

        .quality-table thead {
          background: #f8fafc;
          border-bottom: 2px solid var(--line);
        }

        .quality-table th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          font-size: 13px;
          color: #374151;
          border-right: 1px solid var(--line);
          white-space: nowrap;
        }

        .quality-table th:last-child {
          border-right: none;
        }

        .quality-table tbody tr {
          border-bottom: 1px solid var(--line);
          transition: background-color 0.2s;
        }

        .quality-table tbody tr:hover {
          background: #fafbfd;
        }

        .quality-table tbody tr:last-child {
          border-bottom: none;
        }

        .quality-table td {
          padding: 12px 16px;
          font-size: 14px;
          color: var(--text);
          border-right: 1px solid var(--line);
          white-space: nowrap;
        }

        .quality-table td:last-child {
          border-right: none;
        }

        .score-cell {
          font-weight: 600;
          text-align: center;
          padding: 6px 12px;
          border-radius: 6px;
          min-width: 60px;
        }

        .score-cell.high {
          background: #f0fdf4;
          color: #059669;
          border: 1px solid #bbf7d0;
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
      `}</style>
    </div>
  );
}

// Quality Table Component for Opportunities
function QualityTable({ records, type }: {
  records: DietitianQualityRecord[];
  type: 'nps' | 'csat';
}) {
  return (
    <div className="quality-table-container">
      <table className="quality-table">
        <thead>
          <tr>
            <th>Customer Code</th>
            <th>Dietitian Name</th>
            <th>Subscription Start</th>
            <th>AM Name</th>
            <th>FLAP Name</th>
            <th>Manager Name</th>
            <th>SM Name</th>
            <th>{type === 'nps' ? 'NPS Score' : 'CSAT Score'}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={`${record.customerCode}-${index}`}>
              <td>{record.customerCode}</td>
              <td>{record.dietitianName}</td>
              <td>{record.subscriptionStartDate}</td>
              <td>{record.amName}</td>
              <td>{record.flapName}</td>
              <td>{record.managerName}</td>
              <td>{record.smName}</td>
              <td className={`score-cell high`}>
                {type === 'nps' ? record.npsScore : record.csatScore}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Quality Details Panel Component for Opportunities
function QualityDetailsPanel({ 
  isOpen, 
  onClose, 
  qualityType,
  filters,
  filterOptions,
  onFilterChange,
  onQualityView,
  npsData,
  csatData,
  loadingNps,
  loadingCsat,
  activeQualityType
}: { 
  isOpen: boolean;
  onClose: () => void;
  qualityType: 'nps' | 'csat';
  filters: any;
  filterOptions: any;
  onFilterChange: (filterType: string, value: string) => void;
  onQualityView: (metric: 'nps' | 'csat', type: 'high') => void;
  npsData: DietitianQualityRecord[];
  csatData: DietitianQualityRecord[];
  loadingNps: boolean;
  loadingCsat: boolean;
  activeQualityType: string;
}) {
  if (!isOpen) return null;

  const currentData = qualityType === 'nps' ? npsData : csatData;
  const currentLoading = qualityType === 'nps' ? loadingNps : loadingCsat;

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel-content" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>High {qualityType.toUpperCase()} Opportunities Details</h2>
          <button className="panel-close" onClick={onClose}>×</button>
        </div>
        
        <div className="panel-body">
          <div className="quality-panel-filters">
            <h3>Filters</h3>
            <div className="filters-grid">
              <div className="filter-group">
                <label className="filter-label">Manager:</label>
                <select 
                  className="filter-select"
                  value={filters.manager}
                  onChange={(e) => onFilterChange('manager', e.target.value)}
                >
                  <option value="">All Managers</option>
                  {filterOptions.managers.map((manager: string) => (
                    <option key={manager} value={manager}>{manager}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">AM:</label>
                <select 
                  className="filter-select"
                  value={filters.am}
                  onChange={(e) => onFilterChange('am', e.target.value)}
                >
                  <option value="">All AMs</option>
                  {filterOptions.ams.map((am: string) => (
                    <option key={am} value={am}>{am}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">FLAP:</label>
                <select 
                  className="filter-select"
                  value={filters.flap}
                  onChange={(e) => onFilterChange('flap', e.target.value)}
                >
                  <option value="">All FLAPs</option>
                  {filterOptions.flaps.map((flap: string) => (
                    <option key={flap} value={flap}>{flap}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">EM:</label>
                <select 
                  className="filter-select"
                  value={filters.em}
                  onChange={(e) => onFilterChange('em', e.target.value)}
                >
                  <option value="">All EMs</option>
                  {filterOptions.ems.map((em: string) => (
                    <option key={em} value={em}>{em}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="quality-panel-actions">
            <div className="quality-buttons">
              <button 
                className={`quality-btn ${activeQualityType === 'high' ? 'active' : ''}`}
                onClick={() => onQualityView(qualityType, 'high')}
                style={{background: activeQualityType === 'high' ? '#10b981' : '#fff'}}
              >
                HIGH {qualityType.toUpperCase()} ({(qualityType === 'nps' ? '9-10' : '4-5')})
              </button>
            </div>
          </div>

          <div className="quality-panel-results">
            {currentLoading ? (
              <div className="loading">Loading High {qualityType.toUpperCase()} data...</div>
            ) : currentData.length > 0 ? (
              <QualityTable 
                records={currentData} 
                type={qualityType}
              />
            ) : (
              <div className="no-data">
                {activeQualityType 
                  ? `No High ${qualityType.toUpperCase()} records found`
                  : 'Select a filter option or click HIGH to view data'
                }
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .panel-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: flex-end;
          z-index: 1000;
        }

        .panel-content {
          background: white;
          width: 85%;
          max-width: 1200px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          box-shadow: -4px 0 16px rgba(0, 0, 0, 0.1);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--line);
        }

        .panel-header h2 {
          margin: 0;
          color: #111827;
          font-size: 20px;
        }

        .panel-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
          border-radius: 4px;
        }

        .panel-close:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .quality-panel-filters {
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--line);
        }

        .quality-panel-filters h3 {
          margin: 0 0 16px 0;
          color: #111827;
          font-size: 18px;
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

        .quality-panel-actions {
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--line);
        }

        .quality-buttons {
          display: flex;
          gap: 12px;
        }

        .quality-btn {
          background: #fff;
          border: 1px solid var(--line);
          color: var(--text);
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          flex: 1;
        }

        .quality-btn.active {
          background: #10b981;
          color: #fff;
          border-color: #10b981;
        }

        .quality-btn:hover:not(.active) {
          background: #f8fafc;
        }

        .quality-panel-results {
          flex: 1;
        }

        .loading, .no-data {
          text-align: center;
          padding: 40px 20px;
          color: #64748b;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}