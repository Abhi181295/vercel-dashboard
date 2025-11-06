'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const revalidate = 300; // 5 minutes

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

type IssueAM = {
  id: string;
  name: string;
  role: 'AM' | 'FLAP';
  metrics: {
    service: {
      y: { achieved: number; target: number; pct: number };
      w: { achieved: number; target: number; pct: number };
      m: { achieved: number; target: number; pct: number };
    };
  };
};

type DietitianGap = {
  dietitianName: string;
  smName: string;
  consecutiveZeroDays: number;
  salesTarget: number;
  salesAchieved: number;
  percentAchieved: number;
};

// Funnel Data Interface (reuse from main dashboard)
interface FunnelData {
  teamSize: number;
  rawTallies: {
    ytd: {
      calls: number;
      connected: number;
      talktime: number;
      leads: number;
      totalLinks: number;
      salesLinks: number;
      conv: number;
      salesConv: number;
    };
    wtd: {
      calls: number;
      connected: number;
      talktime: number;
      leads: number;
      totalLinks: number;
      salesLinks: number;
      conv: number;
      salesConv: number;
    };
    mtd: {
      calls: number;
      connected: number;
      talktime: number;
      leads: number;
      totalLinks: number;
      salesLinks: number;
      conv: number;
      salesConv: number;
    };
  };
  metrics: {
    ytd: {
      callsPerDtPerDay: number;
      connectivity: number;
      ttPerConnectedCall: number;
      leadsPerDtPerDay: number;
      leadVsConnected: number;
      mightPay: number;
      convPercent: number;
      salesTeamConv: number;
    };
    wtd: {
      callsPerDtPerDay: number;
      connectivity: number;
      ttPerConnectedCall: number;
      leadsPerDtPerDay: number;
      leadVsConnected: number;
      mightPay: number;
      convPercent: number;
      salesTeamConv: number;
    };
    mtd: {
      callsPerDtPerDay: number;
      connectivity: number;
      ttPerConnectedCall: number;
      leadsPerDtPerDay: number;
      leadVsConnected: number;
      mightPay: number;
      convPercent: number;
      salesTeamConv: number;
    };
  };
}

function metric(a: number, t: number, isSales: boolean = false) {
  const pct = t ? Math.round((a / t) * 100) : 0;
  if (isSales) {
    const aInLakhs = a / 100000;
    const tInLakhs = t / 100000;
    return { achieved: aInLakhs, target: tInLakhs, pct };
  }
  return { achieved: a, target: t, pct };
}

function fmtLakhs(n: number): string {
  const valueInLakhs = n / 100000;
  return valueInLakhs.toFixed(1);
}

function buildHierarchy(sms: UserWithTargets[], managers: UserWithTargets[], ams: UserWithTargets[]) {
  const smMap = new Map(sms.map(sm => [sm.id, {
    ...sm,
    children: [] as any[],
    metrics: {
      service: {
        y: metric(sm.achieved?.service.y || 0, sm.scaledTargets?.service.y || sm.targets.service, true),
        w: metric(sm.achieved?.service.w || 0, sm.scaledTargets?.service.w || sm.targets.service, true),
        m: metric(sm.achieved?.service.m || 0, sm.scaledTargets?.service.m || sm.targets.service, true),
      },
      commerce: {
        y: metric(sm.achieved?.commerce.y || 0, sm.scaledTargets?.commerce.y || sm.targets.commerce, false),
        w: metric(sm.achieved?.commerce.w || 0, sm.scaledTargets?.commerce.w || sm.targets.commerce, false),
        m: metric(sm.achieved?.commerce.m || 0, sm.scaledTargets?.commerce.m || sm.targets.commerce, false),
      },
    }
  }]));

  const managerMap = new Map(managers.map(manager => [manager.id, {
    ...manager,
    children: [] as any[],
    metrics: {
      service: {
        y: metric(manager.achieved?.service.y || 0, manager.scaledTargets?.service.y || manager.targets.service, true),
        w: metric(manager.achieved?.service.w || 0, manager.scaledTargets?.service.w || manager.targets.service, true),
        m: metric(manager.achieved?.service.m || 0, manager.scaledTargets?.service.m || manager.targets.service, true),
      },
      commerce: {
        y: metric(manager.achieved?.commerce.y || 0, manager.scaledTargets?.commerce.y || manager.targets.commerce, false),
        w: metric(manager.achieved?.commerce.w || 0, manager.scaledTargets?.commerce.w || manager.targets.commerce, false),
        m: metric(manager.achieved?.commerce.m || 0, manager.scaledTargets?.commerce.m || manager.targets.commerce, false),
      },
    }
  }]));

  // Assign managers to SMs
  managers.forEach(manager => {
    if (manager.smId && smMap.has(manager.smId)) {
      const sm = smMap.get(manager.smId)!;
      const managerWithMetrics = managerMap.get(manager.id)!;
      sm.children.push(managerWithMetrics);
    }
  });

  // Assign AMs to Managers or directly to SMs if no manager
  ams.forEach(am => {
    if (am.managerId && managerMap.has(am.managerId)) {
      // AM has a manager
      const manager = managerMap.get(am.managerId)!;
      manager.children.push({
        ...am,
        metrics: {
          service: {
            y: metric(am.achieved?.service.y || 0, am.scaledTargets?.service.y || am.targets.service, true),
            w: metric(am.achieved?.service.w || 0, am.scaledTargets?.service.w || am.targets.service, true),
            m: metric(am.achieved?.service.m || 0, am.scaledTargets?.service.m || am.targets.service, true),
          },
          commerce: {
            y: metric(am.achieved?.commerce.y || 0, am.scaledTargets?.commerce.y || am.targets.commerce, false),
            w: metric(am.achieved?.commerce.w || 0, am.scaledTargets?.commerce.w || am.targets.commerce, false),
            m: metric(am.achieved?.commerce.m || 0, am.scaledTargets?.commerce.m || am.targets.commerce, false),
          },
        }
      });
    } else if (am.smId && smMap.has(am.smId)) {
      // AM reports directly to SM (no manager)
      const sm = smMap.get(am.smId)!;
      const virtualManagerId = `virtual-m-${am.smId}`;
      if (!managerMap.has(virtualManagerId)) {
        const virtualManager: any = {
          id: virtualManagerId,
          name: 'Direct Reports',
          role: 'M' as const,
          smId: am.smId,
          children: [],
          targets: { service: 0, commerce: 0 },
          scaledTargets: { service: { y: 0, w: 0, m: 0 }, commerce: { y: 0, w: 0, m: 0 } },
          achieved: { service: { y: 0, w: 0, m: 0 }, commerce: { y: 0, w: 0, m: 0 } },
          metrics: {
            service: { y: metric(0, 0, true), w: metric(0, 0, true), m: metric(0, 0, true) },
            commerce: { y: metric(0, 0, false), w: metric(0, 0, false), m: metric(0, 0, false) }
          }
        };
        managerMap.set(virtualManagerId, virtualManager);
        sm.children.push(virtualManager);
      }
      const virtualManager = managerMap.get(virtualManagerId)!;
      virtualManager.children.push({
        ...am,
        metrics: {
          service: {
            y: metric(am.achieved?.service.y || 0, am.scaledTargets?.service.y || am.targets.service, true),
            w: metric(am.achieved?.service.w || 0, am.scaledTargets?.service.w || am.targets.service, true),
            m: metric(am.achieved?.service.m || 0, am.scaledTargets?.service.m || am.targets.service, true),
          },
          commerce: {
            y: metric(am.achieved?.commerce.y || 0, am.scaledTargets?.commerce.y || am.targets.commerce, false),
            w: metric(am.achieved?.commerce.w || 0, am.scaledTargets?.commerce.w || am.targets.commerce, false),
            m: metric(am.achieved?.commerce.m || 0, am.scaledTargets?.commerce.m || am.targets.commerce, false),
          },
        }
      });
    }
  });

  // Convert to array and ensure proper typing
  return Array.from(smMap.values()).map(sm => ({
    ...sm,
    role: 'SM' as const
  }));
}

export default function IssuesPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  
  const [selectedSM, setSelectedSM] = useState<SM | null>(null);
  const [data, setData] = useState<SM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // State for issue details panel
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<string>('');
  const [underperformingAMs, setUnderperformingAMs] = useState<IssueAM[]>([]);
  const [underperformingDietitians, setUnderperformingDietitians] = useState<DietitianGap[]>([]);

  // Modal state for funnel data
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({
    userName: '',
    userRole: '',
    period: 'y' as 'y' | 'w' | 'm',
    revType: 'service' as 'service' | 'commerce'
  });

  // Reuse existing helper functions
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

  // Load data function that can be called independently
  const loadData = async () => {
    try {
      setLoading(true);
      
      const [hierarchyResponse, dietitianGapsResponse] = await Promise.all([
        fetch('/api/hierarchy'),
        fetch('/api/dietitian-gaps')
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
      
      const hierarchy = buildHierarchy(filteredData, managers, ams);
      
      setData(hierarchy as SM[]);
      
      if (hierarchy.length > 0) {
        setSelectedSM(hierarchy[0] as SM);
      }

      // Load dietitian gaps data
      if (dietitianGapsResponse.ok) {
        const gapsData = await dietitianGapsResponse.json();
        setUnderperformingDietitians(gapsData.dietitianGaps || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data from Google Sheets. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount after authentication
  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
  }, [isAuthenticated, userRole, userName]);

  // Improved refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Calculate underperforming AMs (≤ 25% of daily target)
  const calculateUnderperformingAMs = useMemo(() => {
    if (!selectedSM) return [];

    const underperformers: IssueAM[] = [];
    const seenAMs = new Set();
    
    // Get all AMs under the selected SM
    const allAMs: any[] = [];
    selectedSM.children?.forEach((manager: any) => {
      manager.children?.forEach((am: any) => {
        if ((am.role === 'AM' || am.role === 'FLAP') && !seenAMs.has(am.id)) {
          seenAMs.add(am.id);
          allAMs.push(am);
        }
      });
    });

    // Check each AM's performance
    allAMs.forEach(am => {
      const achieved = am.achieved?.service?.y || 0;
      const target = am.scaledTargets?.service?.y || am.targets.service;
      
      // Calculate percentage
      const performancePct = target > 0 ? (achieved / target) * 100 : 0;
      
      if (performancePct <= 25) {
        underperformers.push({
          id: am.id,
          name: am.name,
          role: am.role,
          metrics: {
            service: {
              y: metric(am.achieved?.service.y || 0, am.scaledTargets?.service.y || am.targets.service, true),
              w: metric(am.achieved?.service.w || 0, am.scaledTargets?.service.w || am.targets.service, true),
              m: metric(am.achieved?.service.m || 0, am.scaledTargets?.service.m || am.targets.service, true),
            }
          }
        });
      }
    });

    return underperformers;
  }, [selectedSM]);

  // FIXED: Filter dietitians based on user role AND selected SM
  const filteredDietitians = useMemo(() => {
    if (userRole === 'sm') {
      return underperformingDietitians.filter(dietitian => 
        dietitian.smName.toLowerCase() === userName.toLowerCase()
      );
    } else if (userRole === 'admin' && selectedSM) {
      // Filter for admin when SM is selected
      return underperformingDietitians.filter(dietitian => 
        dietitian.smName.toLowerCase() === selectedSM.name.toLowerCase()
      );
    }
    return underperformingDietitians; // Show all for admin when no SM selected
  }, [underperformingDietitians, userRole, userName, selectedSM]); // Added selectedSM dependency

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
  };

  const handleViewDetails = (issueType: string) => {
    setSelectedIssue(issueType);
    if (issueType === 'underperforming') {
      setUnderperformingAMs(calculateUnderperformingAMs);
    }
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setSelectedIssue('');
  };

  const handleMetricClick = (userName: string, userRole: string, period: 'y' | 'w' | 'm') => {
    setModalData({
      userName,
      userRole,
      period,
      revType: 'service'
    });
    setModalOpen(true);
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

  if (loading && !refreshing) {
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
            <a className="nav-item active">
              <span className="i">🛠️</span> Issues
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
          <div className="loading">Loading issues data...</div>
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
            <a className="nav-item active">
              <span className="i">🛠️</span> Issues
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
          <a className="nav-item active">
            <span className="i">🛠️</span> Issues
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
            <h1 className="title">Issues Management</h1>
            <p className="subtitle">Track and resolve team performance issues</p>
          </div>

          <div className="actions">
            <button 
              className="btn" 
              title="Refresh" 
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : '⟲ Refresh'}
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
            <p>Viewing your team's performance issues</p>
          </div>
        )}

        <div className="rev-toggle">
          <button className="rev-pill active">
            Service Revenue
          </button>
          <button className="rev-pill" disabled>
            Commerce Revenue
          </button>
        </div>

        {/* Issues Cards */}
        <div className="issues-grid">
          {/* Issue Card 1: Underperforming AMs */}
          <div className="issue-card">
            <div className="issue-header">
              <h3 className="issue-title">Underperforming AMs</h3>
              <div className="issue-count">{calculateUnderperformingAMs.length}</div>
            </div>
            <p className="issue-description">
              AMs performing at or below 25% of their daily target
            </p>
            <button 
              className="view-details-btn"
              onClick={() => handleViewDetails('underperforming')}
              disabled={calculateUnderperformingAMs.length === 0}
            >
              View Details →
            </button>
          </div>

          {/* Issue Card 2: Underperforming Dietitians */}
          <div className="issue-card">
            <div className="issue-header">
              <h3 className="issue-title">Underperforming Dietitians</h3>
              <div className="issue-count">{filteredDietitians.length}</div>
            </div>
            <p className="issue-description">
              Dietitians with zero sales for 3+ consecutive days
            </p>
            <button 
              className="view-details-btn"
              onClick={() => handleViewDetails('dietitians')}
              disabled={filteredDietitians.length === 0}
            >
              View Details →
            </button>
          </div>
        </div>
      </section>

      {/* Details Panel - INTEGRATED DIRECTLY */}
      {isPanelOpen && (
        <div className="details-panel-overlay" onClick={handleClosePanel}>
          <div className="details-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <h2 className="panel-title">
                {selectedIssue === 'underperforming' ? 'Underperforming AMs' : 'Underperforming Dietitians'}
              </h2>
              <button className="panel-close" onClick={handleClosePanel}>×</button>
            </div>
            
            <div className="panel-content">
              {selectedIssue === 'underperforming' && (
                <div className="issue-details">
                  <h3>AMs Performing at or Below 25% of Daily Target</h3>
                  {underperformingAMs.length === 0 ? (
                    <p className="no-issues">No underperforming AMs found</p>
                  ) : (
                    <div className="issues-list">
                      {underperformingAMs.map(am => (
                        <div key={am.id} className="issue-item">
                          <div className="issue-item-header">
                            <span className="issue-item-name">{am.name}</span>
                            <span className={`badge ${am.role === 'AM' ? 'am' : 'flap'}`}>{am.role}</span>
                          </div>
                          <div className="issue-item-metrics">
                            <div className="metric-row">
                              <span>Yesterday:</span>
                              <span className={`pct ${am.metrics.service.y.pct <= 25 ? 'low' : ''}`}>
                                {am.metrics.service.y.pct}%
                              </span>
                            </div>
                            <div className="metric-row">
                              <span>Achieved:</span>
                              <span>{fmtLakhs(am.metrics.service.y.achieved * 100000)}L</span>
                            </div>
                            <div className="metric-row">
                              <span>Target:</span>
                              <span>{fmtLakhs(am.metrics.service.y.target * 100000)}L</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedIssue === 'dietitians' && (
                <div className="issue-details">
                  <h3>Dietitians with 3+ Consecutive Zero Sales Days</h3>
                  {filteredDietitians.length === 0 ? (
                    <p className="no-issues">No underperforming dietitians found</p>
                  ) : (
                    <div className="issues-list">
                      {filteredDietitians.map((dietitian, index) => (
                        <div key={index} className="issue-item">
                          <div className="issue-item-header">
                            <span className="issue-item-name">{dietitian.dietitianName}</span>
                            <span className="badge dietitian">Dietitian</span>
                          </div>
                          <div className="issue-item-metrics">
                            <div className="metric-row">
                              <span>SM:</span>
                              <span>{dietitian.smName}</span>
                            </div>
                            <div className="metric-row">
                              <span>Zero Days:</span>
                              <span className="low">{dietitian.consecutiveZeroDays} days</span>
                            </div>
                            <div className="metric-row">
                              <span>Sales Achieved:</span>
                              <span>₹{dietitian.salesAchieved.toLocaleString()}</span>
                            </div>
                            <div className="metric-row">
                              <span>Sales Target:</span>
                              <span>₹{dietitian.salesTarget.toLocaleString()}</span>
                            </div>
                            <div className="metric-row">
                              <span>Percent Achieved:</span>
                              <span className={`pct ${dietitian.percentAchieved <= 25 ? 'low' : ''}`}>
                                {dietitian.percentAchieved}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metrics Modal - INTEGRATED DIRECTLY */}
      {modalOpen && (
        <MetricsModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          userName={modalData.userName}
          userRole={modalData.userRole}
          period={modalData.period}
          revType={modalData.revType}
        />
      )}

      <style jsx global>{`
        .crm-root {
          display: grid;
          grid-template-columns: 260px 1fr;
          min-height: 100vh;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .crm-aside {
          background: #ffffff;
          border-right: 1px solid #e5e7eb;
          padding: 18px 16px;
          display: flex;
          flex-direction: column;
        }

        .brand {
          font-weight: 700;
          font-size: 18px;
          margin: 4px 6px 14px;
        }

        .brand-main {
          color: #111827;
        }

        .brand-sub {
          color: #f97316;
          margin-left: 6px;
        }

        .zap {
          margin-left: 6px;
        }

        .nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 10px;
          color: #0f172a;
          text-decoration: none;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .nav-item:hover {
          background: #f3f4f6;
        }

        .nav-item.active {
          background: #eef2ff;
        }

        .nav-item .i {
          font-size: 16px;
        }

        .user-info {
          margin-top: auto;
          padding: 16px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
        }

        .user-name {
          font-weight: 600;
          color: #111827;
        }

        .user-role {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }

        .user-email {
          font-size: 11px;
          color: #64748b;
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
          transition: background-color 0.2s;
        }

        .logout-btn:hover {
          background: #dc2626;
        }

        .crm-main {
          padding: 18px 22px 40px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #f8fafc;
        }

        .top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .title {
          margin: 0 0 4px 0;
          color: #111827;
          font-size: 24px;
          font-weight: 700;
        }

        .subtitle {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        .btn {
          background: #0f172a;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 14px;
          transition: opacity 0.2s;
        }

        .btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .selection-row {
          display: flex;
          gap: 20px;
          align-items: end;
        }

        .select-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .select-label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .select {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px 12px;
          min-width: 200px;
          outline: none;
          font-size: 14px;
        }

        .select:focus {
          border-color: #cbd5e1;
        }

        .select:disabled {
          background: #f9fafb;
          color: #6b7280;
        }

        .user-welcome {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .user-welcome h3 {
          margin: 0 0 4px 0;
          color: #111827;
          font-size: 16px;
        }

        .user-welcome p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }

        .rev-toggle {
          display: flex;
          gap: 8px;
          align-items: center;
          margin: 8px 0 4px;
        }

        .rev-pill {
          background: #fff;
          border: 1px solid #e5e7eb;
          color: #0f172a;
          padding: 8px 14px;
          border-radius: 999px;
          cursor: pointer;
          box-shadow: 0 1px 0 rgba(15,23,42,.04);
          transition: all 0.2s;
        }

        .rev-pill.active {
          background: #0f172a;
          color: #fff;
          border-color: #0f172a;
        }

        .rev-pill:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .issues-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 16px;
        }

        .issue-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          transition: box-shadow 0.2s;
        }

        .issue-card:hover {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .issue-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .issue-title {
          margin: 0;
          color: #111827;
          font-size: 18px;
          font-weight: 600;
        }

        .issue-count {
          background: #ef4444;
          color: white;
          border-radius: 999px;
          padding: 4px 12px;
          font-size: 14px;
          font-weight: 600;
        }

        .issue-description {
          margin: 0 0 16px 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.5;
        }

        .view-details-btn {
          background: #0f172a;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          width: 100%;
        }

        .view-details-btn:hover:not(:disabled) {
          background: #1e293b;
          transform: translateY(-1px);
        }

        .view-details-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
          transform: none;
        }

        .loading-full {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-size: 18px;
          color: #64748b;
        }

        .loading, .error {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 200px;
          font-size: 18px;
          text-align: center;
        }

        .loading {
          color: #64748b;
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

        /* Details Panel Styles */
        .details-panel-overlay {
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

        .details-panel {
          background: white;
          width: 600px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
          background: #f8fafc;
        }

        .panel-title {
          margin: 0;
          color: #111827;
          font-size: 20px;
          font-weight: 600;
        }

        .panel-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #64748b;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .panel-close:hover {
          background: #e5e7eb;
        }

        .panel-content {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }

        .issue-details h3 {
          margin: 0 0 20px 0;
          color: #374151;
          font-size: 16px;
          font-weight: 600;
        }

        .no-issues {
          text-align: center;
          color: #64748b;
          font-style: italic;
          padding: 40px 0;
        }

        .issues-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .issue-item {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
        }

        .issue-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .issue-item-name {
          font-weight: 600;
          color: #111827;
          font-size: 16px;
        }

        .badge {
          font-size: 12px;
          border-radius: 999px;
          padding: 4px 8px;
          border: 1px solid #e5e7eb;
        }

        .badge.am {
          background: #fff7ed;
          color: #9a3412;
        }

        .badge.flap {
          background: #fffdea;
          color: #854d0e;
        }

        .badge.dietitian {
          background: #ecfdf5;
          color: #065f46;
        }

        .issue-item-metrics {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
        }

        .metric-row span:first-child {
          color: #64748b;
        }

        .metric-row span:last-child {
          font-weight: 500;
          color: #111827;
        }

        .pct.low {
          color: #dc2626;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

// Metrics Modal Component
function MetricsModal({ isOpen, onClose, userName, userRole, period, revType }: {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userRole: string;
  period: 'y' | 'w' | 'm';
  revType: 'service' | 'commerce';
}) {
  const [activePeriod, setActivePeriod] = useState<'y' | 'w' | 'm'>(period);
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActivePeriod(period);
  }, [period]);

  useEffect(() => {
    if (isOpen) {
      fetchFunnelData();
    }
  }, [isOpen, userName, userRole]);

  const fetchFunnelData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/funnel?name=${encodeURIComponent(userName)}&role=${userRole}`);
      if (!response.ok) {
        throw new Error('Failed to fetch funnel data');
      }
      const data = await response.json();
      setFunnelData(data);
    } catch (err) {
      console.error('Error fetching funnel data:', err);
      setError('Failed to load detailed metrics');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const periodLabels = {
    y: 'Yesterday',
    w: 'WTD (Week to Date)',
    m: 'MTD (Month to Date)'
  };

  const periodMap = {
    y: 'ytd',
    w: 'wtd', 
    m: 'mtd'
  } as const;

  const currentPeriod = periodMap[activePeriod];
  const rawData = funnelData?.rawTallies?.[currentPeriod];
  const metricsData = funnelData?.metrics?.[currentPeriod];

  const formatNumber = (num: number) => {
    if (num === 0) return '-';
    return Number.isInteger(num) ? num.toString() : num.toFixed(1);
  };

  const formatPercentage = (num: number) => {
    if (num === 0) return '-';
    return `${(num * 100).toFixed(1)}%`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Funnel and Key Metrics</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-subheader">
          <div className="user-info-modal">
            <strong>{userName}</strong> • {userRole} • {revType === 'service' ? 'Service Revenue' : 'Commerce Revenue'}
            {funnelData && <span> • Team Size: {funnelData.teamSize}</span>}
          </div>
        </div>

        <div className="period-selector">
          <button
            className={`period-btn ${activePeriod === 'y' ? 'active' : ''}`}
            onClick={() => setActivePeriod('y')}
          >
            Yesterday
          </button>
          <button
            className={`period-btn ${activePeriod === 'w' ? 'active' : ''}`}
            onClick={() => setActivePeriod('w')}
          >
            WTD
          </button>
          <button
            className={`period-btn ${activePeriod === 'm' ? 'active' : ''}`}
            onClick={() => setActivePeriod('m')}
          >
            MTD
          </button>
        </div>

        {loading && (
          <div className="modal-loading">
            <div className="loading">Loading funnel data...</div>
          </div>
        )}

        {error && (
          <div className="modal-error">
            <div className="error">{error}</div>
            <button className="btn" onClick={fetchFunnelData} style={{ marginTop: '16px' }}>
              Retry
            </button>
          </div>
        )}

        {funnelData && !loading && (
          <>
            <div className="modal-section">
              <h3>Funnel Metrics - {periodLabels[activePeriod]}</h3>
              <div className="metrics-table">
                <table>
                  <thead>
                    <tr>
                      <th>Team Size</th>
                      <th>Calls</th>
                      <th>Connected</th>
                      <th>Talktime (hrs)</th>
                      <th>Leads</th>
                      <th>Total Links</th>
                      <th>Sales Links</th>
                      <th>Conv</th>
                      <th>Sales Conv</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{funnelData.teamSize}</td>
                      <td>{formatNumber(rawData?.calls || 0)}</td>
                      <td>{formatNumber(rawData?.connected || 0)}</td>
                      <td>{formatNumber(rawData?.talktime || 0)}</td>
                      <td>{formatNumber(rawData?.leads || 0)}</td>
                      <td>{formatNumber(rawData?.totalLinks || 0)}</td>
                      <td>{formatNumber(rawData?.salesLinks || 0)}</td>
                      <td>{formatNumber(rawData?.conv || 0)}</td>
                      <td>{formatNumber(rawData?.salesConv || 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-section">
              <h3>Performance Metrics - {periodLabels[activePeriod]}</h3>
              <div className="metrics-table">
                <table>
                  <thead>
                    <tr>
                      <th>Call per Dt. per day</th>
                      <th>Connectivity %</th>
                      <th>TT per connected call (min)</th>
                      <th>Leads per Dt. per day</th>
                      <th>Lead % vs Connected Call</th>
                      <th>Might Pay %</th>
                      <th>Conv %</th>
                      <th>Sales Team Conv %</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{formatNumber(metricsData?.callsPerDtPerDay || 0)}</td>
                      <td>{formatPercentage(metricsData?.connectivity || 0)}</td>
                      <td>{formatNumber(metricsData?.ttPerConnectedCall || 0)}</td>
                      <td>{formatNumber(metricsData?.leadsPerDtPerDay || 0)}</td>
                      <td>{formatPercentage(metricsData?.leadVsConnected || 0)}</td>
                      <td>{formatPercentage(metricsData?.mightPay || 0)}</td>
                      <td>{formatPercentage(metricsData?.convPercent || 0)}</td>
                      <td>{formatPercentage(metricsData?.salesTeamConv || 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1001;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 1200px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          color: #111827;
          font-size: 20px;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
          border-radius: 4px;
        }

        .modal-close:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .modal-subheader {
          padding: 16px 24px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
        }

        .user-info-modal {
          font-size: 14px;
          color: #6b7280;
        }

        .period-selector {
          display: flex;
          gap: 8px;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .period-btn {
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .period-btn.active {
          background: #111827;
          color: white;
          border-color: #111827;
        }

        .period-btn:hover:not(.active) {
          background: #e5e7eb;
        }

        .modal-section {
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-section:last-of-type {
          border-bottom: none;
        }

        .modal-section h3 {
          margin: 0 0 16px 0;
          color: #111827;
          font-size: 16px;
        }

        .metrics-table {
          overflow-x: auto;
        }

        .metrics-table table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .metrics-table th,
        .metrics-table td {
          padding: 12px;
          text-align: center;
          border: 1px solid #e5e7eb;
        }

        .metrics-table th {
          background: #f8fafc;
          font-weight: 600;
          color: #374151;
        }

        .metrics-table td {
          color: #6b7280;
        }

        .modal-actions {
          padding: 20px 24px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: flex-end;
        }

        .modal-loading, .modal-error {
          padding: 40px 24px;
          text-align: center;
        }

        .modal-loading .loading, .modal-error .error {
          height: auto;
          margin: 0;
        }

        .btn {
          background: #0f172a;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
        }

        .btn:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}