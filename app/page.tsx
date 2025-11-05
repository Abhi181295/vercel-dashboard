// app/page.tsx

'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const revalidate = 300; // 5 minutes

/** ============================================================================
 *  LIGHT CRM UI — Updated with color-coded percentages, improved headers, and drill-down modal
 * ========================================================================== */
 
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

type Metric = { achieved: number; target: number; pct: number };
type Block = { y: Metric; w: Metric; m: Metric };
type RevenueMetrics = {
  service: Block;
  commerce: Block;
};

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

type Leaf = {
  id: string;
  name: string;
  role: 'AM' | 'FLAP';
  metrics: RevenueMetrics;
  managerId?: string;
  smId?: string;
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

type Manager = {
  id: string;
  name: string;
  role: 'M';
  metrics: RevenueMetrics;
  children: Leaf[];
  smId?: string;
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

type SM = {
  id: string;
  name: string;
  role: 'SM';
  metrics: RevenueMetrics;
  children: Manager[];
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

function pct(a: number, t: number) {
  return t ? Math.round((a / t) * 100) : 0;
}

function fmt(n: number) {
  return n.toLocaleString('en-IN');
}

function fmtLakhs(n: number): string {
  const valueInLakhs = n / 100000;
  return valueInLakhs.toFixed(1);
}

function metric(a: number, t: number, isSales: boolean = false): Metric {
  if (isSales) {
    const aInLakhs = a / 100000;
    const tInLakhs = t / 100000;
    return { achieved: aInLakhs, target: tInLakhs, pct: pct(a, t) };
  }
  return { achieved: a, target: t, pct: pct(a, t) };
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
          role: 'M',
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

  // Convert to array
  return Array.from(smMap.values());
}

// Modal Component
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

  // Update active period when the period prop changes
  useEffect(() => {
    setActivePeriod(period);
  }, [period]);

  // Fetch funnel data when modal opens
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
    </div>
  );
}	

function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  
  const [selectedSM, setSelectedSM] = useState<SM | null>(null);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [revType, setRevType] = useState<'service' | 'commerce'>('service');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false); // New state for refresh

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({
    userName: '',
    userRole: '',
    period: 'y' as 'y' | 'w' | 'm',
    revType: 'service' as 'service' | 'commerce'
  });

  // Helper function to get cookie value
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
        // Get user info from cookies/localStorage
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
      
      const response = await fetch('/api/hierarchy');
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const { sms, managers, ams } = await response.json();
      
      // Filter data based on user role
      let filteredData = sms;
      if (userRole === 'sm') {
        // For SM users, only show their own data
        filteredData = sms.filter((sm: UserWithTargets) => 
          sm.name.toLowerCase() === userName.toLowerCase()
        );
      }
      
      const hierarchy = buildHierarchy(filteredData, managers, ams);
      setData(hierarchy as any);
      
      if (hierarchy.length > 0) {
        setSelectedSM(hierarchy[0] as any);
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

  const handleLogout = () => {
    // Clear all auth cookies
    document.cookie = 'isAuthenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'userEmail=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'userName=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    // Clear localStorage
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    
    router.push('/login');
  };

  const managersToDisplay = useMemo(() => {
    if (selectedManager) {
      return [selectedManager];
    } else if (selectedSM) {
      return selectedSM.children || [];
    }
    return [];
  }, [selectedSM, selectedManager]);

  const filteredAMs = useMemo(() => {
    if (selectedManager) {
      return selectedManager.children || [];
    } else if (selectedSM) {
      return (selectedSM.children || []).flatMap((m: Manager) => m.children || []);
    }
    return [];
  }, [selectedSM, selectedManager]);

  const handleSMChange = (smId: string) => {
    const sm = data.find(s => s.id === smId) || null;
    setSelectedSM(sm);
    setSelectedManager(null);
  };

  const handleManagerChange = (managerId: string) => {
    if (!managerId) {
      setSelectedManager(null);
      return;
    }
    
    const manager = selectedSM?.children?.find((m: Manager) => m.id === managerId) || null;
    setSelectedManager(manager);
  };

  const handleMetricClick = (userName: string, userRole: string, period: 'y' | 'w' | 'm') => {
    setModalData({
      userName,
      userRole,
      period,
      revType
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
            <a className="nav-item active" onClick={() => router.push('/')}>
              <span className="i">🏠</span> Dashboard
            </a>
            <a className="nav-item" onClick={() => router.push('/')}>
              <span className="i">👥</span> Revenue
            </a>
            <a className="nav-item" onClick={() => router.push('/')}>
              <span className="i">✅</span> Quality
            </a>
            <a className="nav-item" onClick={() => router.push('/issues')}>
              <span className="i">🛠️</span> Issues
            </a>
            <a className="nav-item" onClick={() => router.push('/')}>
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
          <div className="loading">Loading data from Google Sheets...</div>
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
            <a className="nav-item active" onClick={() => router.push('/')}>
              <span className="i">🏠</span> Dashboard
            </a>
            <a className="nav-item" onClick={() => router.push('/')}>
              <span className="i">👥</span> Revenue
            </a>
            <a className="nav-item" onClick={() => router.push('/')}>
              <span className="i">✅</span> Quality
            </a>
            <a className="nav-item" onClick={() => router.push('/issues')}>
              <span className="i">🛠️</span> Issues
            </a>
            <a className="nav-item" onClick={() => router.push('/')}>
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
          <a className="nav-item active" onClick={() => router.push('/')}>
            <span className="i">🏠</span> Dashboard
          </a>
          <a className="nav-item" onClick={() => router.push('/')}>
            <span className="i">👥</span> Revenue
          </a>
          <a className="nav-item" onClick={() => router.push('/')}>
            <span className="i">✅</span> Quality
          </a>
          <a className="nav-item" onClick={() => router.push('/issues')}>
            <span className="i">🛠️</span> Issues
          </a>
          <a className="nav-item" onClick={() => router.push('/')}>
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
            <h1 className="title">Revenue Management</h1>
            <p className="subtitle">Live data from Google Sheets</p>
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
            <button className="btn" title="Export CSV">⬇ Export CSV</button>
            <button className="btn" title="Show Filters">⚲ Show Filters</button>
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

          <div className="select-group">
            <label className="select-label">Select Manager:</label>
            <select 
              className="select" 
              value={selectedManager?.id || ''}
              onChange={(e) => handleManagerChange(e.target.value)}
              disabled={!selectedSM}
            >
              <option value="">-- All Managers --</option>
              {selectedSM?.children?.map((manager: Manager) => (
                <option key={manager.id} value={manager.id}>{manager.name}</option>
              ))}
            </select>
          </div>
        </div>

        {userRole === 'sm' && (
          <div className="user-welcome">
            <h3>Welcome, {userName}</h3>
            <p>Viewing your team's performance data</p>
          </div>
        )}

        <div className="rev-toggle">
          <button
            className={`rev-pill ${revType === 'service' ? 'active' : ''}`}
            onClick={() => setRevType('service')}
            title="Show Service revenue metrics"
          >
            Service Revenue
          </button>
          <button
            className={`rev-pill ${revType === 'commerce' ? 'active' : ''}`}
            onClick={() => setRevType('commerce')}
            title="Show Commerce revenue metrics"
          >
            Commerce Revenue
          </button>
        </div>

        {selectedSM && (
          <div className="section">
            <h2 className="section-title">SM Performance</h2>
            <div className="card">
              <div className="sm-data">
                <div className="sm-header">
                  <div className="sm-name">
                    <span className="nm">{selectedSM.name}</span>
                    <span className="badge sm">SM</span>
                  </div>
                  <div className="sm-role">Senior Manager</div>
                </div>
                
                <div className="metrics-grid">
                  <div className="metric-group">
                    <div className="period-title">Yesterday</div>
                    <Metrics 
                      m={selectedSM.metrics[revType].y} 
                      isSales={revType === 'service'}
                      onClick={() => handleMetricClick(selectedSM.name, 'SM', 'y')}
                    />
                  </div>
                  <div className="metric-group">
                    <div className="period-title">WTD</div>
                    <Metrics 
                      m={selectedSM.metrics[revType].w} 
                      isSales={revType === 'service'}
                      onClick={() => handleMetricClick(selectedSM.name, 'SM', 'w')}
                    />
                  </div>
                  <div className="metric-group">
                    <div className="period-title">MTD</div>
                    <Metrics 
                      m={selectedSM.metrics[revType].m} 
                      isSales={revType === 'service'}
                      onClick={() => handleMetricClick(selectedSM.name, 'SM', 'm')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedSM && managersToDisplay.length > 0 && (
          <div className="section">
            <h2 className="section-title">
              Managers {selectedManager ? `- ${selectedManager.name}` : `under ${selectedSM.name}`}
            </h2>
            <div className="card">
              <div className="thead">
                <div className="h-name">
                  <div className="h-title">Manager Name</div>
                  <div className="h-sub">Reporting to {selectedSM.name}</div>
                </div>
                <div className="h-role">
                  <div className="h-title">Role</div>
                </div>
                <div className="h-group merged">
                  <div className="g-title">Yesterday</div>
                  <div className="g-sub">
                    <span>Achieved</span><span>Target</span><span>%</span>
                  </div>
                </div>
                <div className="h-group merged">
                  <div className="g-title">WTD</div>
                  <div className="g-sub">
                    <span>Achieved</span><span>Target</span><span>%</span>
                  </div>
                </div>
                <div className="h-group merged">
                  <div className="g-title">MTD</div>
                  <div className="g-sub">
                    <span>Achieved</span><span>Target</span><span>%</span>
                  </div>
                </div>
              </div>

              <div className="tbody">
                {managersToDisplay.map(manager => (
                  <div key={manager.id} className="row">
                    <div className="c-name">
                      <span className="nm">{manager.name}</span>
                      <span className="badge m">M</span>
                    </div>
                    <div className="c-role">Manager</div>
                    <Metrics 
                      m={manager.metrics[revType].y} 
                      isSales={revType === 'service'}
                      onClick={() => handleMetricClick(manager.name, 'Manager', 'y')}
                    />
                    <Metrics 
                      m={manager.metrics[revType].w} 
                      isSales={revType === 'service'}
                      onClick={() => handleMetricClick(manager.name, 'Manager', 'w')}
                    />
                    <Metrics 
                      m={manager.metrics[revType].m} 
                      isSales={revType === 'service'}
                      onClick={() => handleMetricClick(manager.name, 'Manager', 'm')}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {filteredAMs.length > 0 && (
          <div className="section">
            <h2 className="section-title">
              AMs/FLAP {selectedManager ? `under ${selectedManager.name}` : `under ${selectedSM?.name}`}
            </h2>
            <div className="card">
              <div className="thead">
                <div className="h-name">
                  <div className="h-title">AM/FLAP Name</div>
                  <div className="h-sub">Team members</div>
                </div>
                <div className="h-role">
                  <div className="h-title">Role</div>
                </div>
                <div className="h-group merged">
                  <div className="g-title">Yesterday</div>
                  <div className="g-sub">
                    <span>Achieved</span><span>Target</span><span>%</span>
                  </div>
                </div>
                <div className="h-group merged">
                  <div className="g-title">WTD</div>
                  <div className="g-sub">
                    <span>Achieved</span><span>Target</span><span>%</span>
                  </div>
                </div>
                <div className="h-group merged">
                  <div className="g-title">MTD</div>
                  <div className="g-sub">
                    <span>Achieved</span><span>Target</span><span>%</span>
                  </div>
                </div>
              </div>

              <div className="tbody">
                {filteredAMs.map(am => (
                  <div key={am.id} className="row">
                    <div className="c-name">
                      <span className="nm">{am.name}</span>
                      <span className={`badge ${am.role === 'AM' ? 'am' : 'flap'}`}>{am.role}</span>
                    </div>
                    <div className="c-role">{am.role === 'AM' ? 'Assistant Manager' : 'FLAP'}</div>
                    <Metrics 
                      m={am.metrics[revType].y} 
                      isSales={revType === 'service'}
                      onClick={() => handleMetricClick(am.name, am.role, 'y')}
                    />
                    <Metrics 
                      m={am.metrics[revType].w} 
                      isSales={revType === 'service'}
                      onClick={() => handleMetricClick(am.name, am.role, 'w')}
                    />
                    <Metrics 
                      m={am.metrics[revType].m} 
                      isSales={revType === 'service'}
                      onClick={() => handleMetricClick(am.name, am.role, 'm')}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {data.length === 0 && !loading && (
          <div className="section">
            <div className="card">
              <div className="no-data">
                <h3>No Data Available</h3>
                <p>No SM data found in the Google Sheet.</p>
              </div>
            </div>
          </div>
        )}

        <MetricsModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          userName={modalData.userName}
          userRole={modalData.userRole}
          period={modalData.period}
          revType={modalData.revType}
        />
      </section>

      <style jsx global>{`
        .loading-full {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-size: 18px;
          color: #64748b;
        }

        .loading, .error, .no-data {
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
        
        .no-data h3 {
          margin: 0 0 8px 0;
          color: var(--text);
        }
        
        .no-data p {
          margin: 0;
          color: var(--muted);
        }

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
      `}</style>
      <style jsx global>{CSS}</style>
    </div>
  );
}

function Metrics({ m, isSales = false, onClick }: { m: Metric; isSales?: boolean; onClick?: () => void }) {
  const formatValue = (value: number) => {
    if (isSales) {
      return fmtLakhs(value * 100000);
    }
    return fmt(value);
  };

  const getPercentageColor = (pct: number) => {
    if (pct >= 80) return 'good';
    if (pct >= 50) return 'warn';
    return 'low';
  };

  return (
    <div className="grp">
      <div className="nums">
        <div className="n clickable" onClick={onClick}>{formatValue(m.achieved)}</div>
        <div className="n clickable" onClick={onClick}>{formatValue(m.target)}</div>
        <div className={`n pct ${getPercentageColor(m.pct)} clickable`} onClick={onClick}>{m.pct}%</div>
      </div>
    </div>
  );
}

/* =============================== CSS ====================================== */

const CSS = `
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

*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif}

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
.btn:hover:not(:disabled){opacity:.9}
.btn:disabled{opacity:0.6;cursor:not-allowed;}
.btn-secondary{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
.btn-secondary:hover{background:#f8fafc}

/* Selection dropdowns */
.selection-row{display:flex;gap:20px;align-items:end}
.select-group{display:flex;flex-direction:column;gap:6px}
.select-label{font-size:13px;font-weight:600;color:#374151}
.select{background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px 12px;min-width:200px;outline:none}
.select:focus{border-color:#cbd5e1}
.select:disabled{background:#f9fafb;color:#6b7280}

/* Revenue toggle pills */
.rev-toggle{display:flex;gap:8px;align-items:center;margin:8px 0 4px}
.rev-pill{background:#fff;border:1px solid var(--line);color:#0f172a;padding:8px 14px;border-radius:999px;cursor:pointer;box-shadow:0 1px 0 rgba(15,23,42,.04)}
.rev-pill.active{background:#0f172a;color:#fff;border-color:#0f172a}

/* Sections */
.section{margin-top:8px}
.section-title{font-size:16px;font-weight:600;color:#111827;margin:0 0 12px 0}

/* SM Data Card */
.sm-data{padding:16px}
.sm-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--line2)}
.sm-name{display:flex;align-items:center;gap:10px}
.metrics-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}

.metric-group{border:1px solid var(--line2);border-radius:10px;padding:12px}
.period-title{font-size:14px;font-weight:600;color:#374151;margin-bottom:8px;text-align:center}

/* Table card */
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}

/* Table header - IMPROVED ALIGNMENT */
.thead,.row{display:grid;grid-template-columns:minmax(260px,1fr) 160px repeat(3, 1fr)}
.thead{background:linear-gradient(180deg,#ffffff,#fbfbfb);border-bottom:1px solid var(--line2)}
.h-name,.h-role,.h-group{padding:12px;text-align:center}
.h-title{font-size:12px;text-transform:uppercase;letter-spacing:.02em;color:#111827;font-weight:700}
.h-sub{font-size:12px;color:#94a3b8;margin-top:2px}
.h-group.merged{grid-column:span 1}
.h-group .g-title{font-size:12px;text-transform:uppercase;letter-spacing:.02em;color:#111827;font-weight:700;margin-bottom:4px}
.h-group .g-sub{display:grid;grid-template-columns:1fr 1fr 60px;gap:12px;font-size:12px;color:#94a3b8}

/* Rows */
.tbody{display:flex;flex-direction:column}
.row{padding:12px;align-items:center;border-bottom:1px solid var(--line2);transition:background .12s ease}
.row:hover{background:#fafbfd}

.c-name{display:flex;align-items:center;gap:10px}
.c-role{color:#64748b;text-align:center}

.nm{font-weight:600}

.grp{padding:0 10px;text-align:center}
.nums{display:grid;grid-template-columns:1fr 1fr 60px;gap:12px;align-items:center}
.n{font-weight:600}
.n.pct{justify-self:end}
.n.pct.low{color:var(--low)}
.n.pct.warn{color:var(--warn)}
.n.pct.good{color:var(--good)}
.clickable{cursor:pointer;transition:all 0.2s ease}
.clickable:hover{transform:scale(1.05);background:#f8fafc;border-radius:4px;padding:2px 4px}

/* Badges */
.badge{font-size:11px;border-radius:999px;padding:4px 10px;border:1px solid var(--line)}
.badge.sm{background:#ecfdf5}
.badge.m{background:#eef2ff}
.badge.am{background:#fff7ed}
.badge.flap{background:#fffdea}

/* Modal Styles */
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
  z-index: 1000;
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
  border-bottom: 1px solid var(--line);
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
  border-bottom: 1px solid var(--line);
}

.user-info-modal {
  font-size: 14px;
  color: #6b7280;
}

.period-selector {
  display: flex;
  gap: 8px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--line);
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
  border-bottom: 1px solid var(--line);
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
  border: 1px solid var(--line);
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
  border-top: 1px solid var(--line);
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
`;

export default DashboardPage;