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

  // Filter dietitians based on user role
  const filteredDietitians = useMemo(() => {
    if (userRole === 'sm') {
      return underperformingDietitians.filter(dietitian => 
        dietitian.smName.toLowerCase() === userName.toLowerCase()
      );
    }
    return underperformingDietitians;
  }, [underperformingDietitians, userRole, userName]);

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
    </div>
  );
}