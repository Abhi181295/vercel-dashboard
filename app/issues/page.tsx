// app/issues/page.tsx

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

// NEW: Manager issue type (same shape as AM)
type IssueM = {
  id: string;
  name: string;
  role: 'M';
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
  
  // State for issue details panel
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<string>('');
  const [underperformingAMs, setUnderperformingAMs] = useState<IssueAM[]>([]);
  const [underperformingMs, setUnderperformingMs] = useState<IssueM[]>([]);
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

  const metric = (a: number, t: number, isSales: boolean = false) => {
    const pct = t ? Math.round((a / t) * 100) : 0;
    if (isSales) {
      const aInLakhs = a / 100000;
      const tInLakhs = t / 100000;
      return { achieved: aInLakhs, target: tInLakhs, pct };
    }
    return { achieved: a, target: t, pct };
  };

  const fmtLakhs = (n: number): string => {
    const valueInLakhs = n / 100000;
    return valueInLakhs.toFixed(1);
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
    }

    loadData();
  }, [isAuthenticated, userRole, userName]);

  // Calculate underperforming AMs (≤ 25% of daily target)
  const calculateUnderperformingAMs = useMemo(() => {
    if (!selectedSM) return [];

    const underperformers: IssueAM[] = [];
    const seenAMs = new Set();
    
    const allAMs: any[] = [];
    selectedSM.children?.forEach((manager: any) => {
      manager.children?.forEach((am: any) => {
        if ((am.role === 'AM' || am.role === 'FLAP') && !seenAMs.has(am.id)) {
          seenAMs.add(am.id);
          allAMs.push(am);
        }
      });
    });

    allAMs.forEach(am => {
      const achieved = am.achieved?.service?.y || 0;
      const target = am.scaledTargets?.service?.y || am.targets?.service || 0;
      const performancePct = target > 0 ? (achieved / target) * 100 : 0;
      
      if (performancePct <= 25) {
        underperformers.push({
          id: am.id,
          name: am.name,
          role: am.role,
          metrics: {
            service: {
              y: metric(am.achieved?.service?.y || 0, am.scaledTargets?.service?.y || am.targets?.service || 0, true),
              w: metric(am.achieved?.service?.w || 0, am.scaledTargets?.service?.w || am.targets?.service || 0, true),
              m: metric(am.achieved?.service?.m || 0, am.scaledTargets?.service?.m || am.targets?.service || 0, true),
            }
          }
        });
      }
    });

    return underperformers;
  }, [selectedSM]);

  // NEW: Calculate underperforming Managers (≤ 25% of daily target)
  const calculateUnderperformingMs = useMemo(() => {
    if (!selectedSM) return [];

    const underperformers: IssueM[] = [];
    const managers: any[] = selectedSM.children || [];

    managers.forEach((m: any) => {
      const achieved = m.achieved?.service?.y || 0;
      const target = m.scaledTargets?.service?.y || m.targets?.service || 0;
      const performancePct = target > 0 ? (achieved / target) * 100 : 0;

      if (performancePct <= 25) {
        underperformers.push({
          id: m.id,
          name: m.name,
          role: 'M',
          metrics: {
            service: {
              y: metric(m.achieved?.service?.y || 0, m.scaledTargets?.service?.y || m.targets?.service || 0, true),
              w: metric(m.achieved?.service?.w || 0, m.scaledTargets?.service?.w || m.targets?.service || 0, true),
              m: metric(m.achieved?.service?.m || 0, m.scaledTargets?.service?.m || m.targets?.service || 0, true),
            }
          }
        });
      }
    });

    return underperformers;
  }, [selectedSM]);

  // 🔧 FIX: Filter dietitians by selected SM for admins; for SM users, filter by their own name
  const filteredDietitians = useMemo(() => {
    if (userRole === 'sm') {
      return underperformingDietitians.filter(dietitian => 
        dietitian.smName.toLowerCase() === userName.toLowerCase()
      );
    }
    if (selectedSM?.name) {
      return underperformingDietitians.filter(d => 
        d.smName.toLowerCase() === selectedSM.name.toLowerCase()
      );
    }
    return underperformingDietitians;
  }, [underperformingDietitians, userRole, userName, selectedSM]);

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
      setUnderperformingMs(calculateUnderperformingMs);
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

  // counts for the card
  const amCount = calculateUnderperformingAMs.length;
  const mCount = calculateUnderperformingMs.length;

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
          {/* Issue Card 1: Underperforming (M + AM) */}
          <div className="issue-card">
            <div className="issue-header">
              <h3 className="issue-title">Underperforming M and AMs</h3>
              <div className="issue-count">{amCount + mCount}</div>
            </div>
            <p className="issue-description">
              AMs & Ms performing at or below 25% of their daily target
            </p>
            <button 
              className="view-details-btn"
              onClick={() => handleViewDetails('underperforming')}
              disabled={(amCount + mCount) === 0}
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

        {/* Issue Details Panel */}
        {isPanelOpen && (
          <IssueDetailsPanel
            isOpen={isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
            issueType={selectedIssue}
            ams={underperformingAMs}
            ms={underperformingMs}
            dietitians={filteredDietitians}
            onMetricClick={handleMetricClick}
          />
        )}

        {/* Funnel Metrics Modal */}
        <MetricsModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          userName={modalData.userName}
          userRole={modalData.userRole}
          period={modalData.period}
          revType={modalData.revType}
        />
      </section>

      {/* ⛔ CSS below is exactly as in your file — unchanged */}
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
          background: #ef4444;
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

        .view-details-btn {
          background: #0f172a;
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

        .rev-toggle{display:flex;gap:8px;align-items:center;margin:8px 0 4px}
        .rev-pill{background:#fff;border:1px solid var(--line);color:#0f172a;padding:8px 14px;border-radius:999px;cursor:pointer;box-shadow:0 1px 0 rgba(15,23,42,.04)}
        .rev-pill.active{background:#0f172a;color:#fff;border-color:#0f172a}
        .rev-pill:disabled{background:#f3f4f6;color:#9ca3af;cursor:not-allowed}

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

// Issue Details Panel Component - CSS/markup kept, only added Ms section using same classes
function IssueDetailsPanel({ 
  isOpen, 
  onClose, 
  issueType, 
  ams, 
  ms,
  dietitians,
  onMetricClick 
}: { 
  isOpen: boolean;
  onClose: () => void;
  issueType: string;
  ams: IssueAM[];
  ms: IssueM[];
  dietitians: DietitianGap[];
  onMetricClick: (name: string, role: string, period: 'y' | 'w' | 'm') => void;
}) {
  if (!isOpen) return null;

  const getPercentageColor = (pct: number) => {
    if (pct >= 80) return 'good';
    if (pct >= 50) return 'warn';
    return 'low';
  };

  const fmtLakhs = (n: number): string => {
    const valueInLakhs = n / 100000;
    return valueInLakhs.toFixed(1);
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel-content" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Issue Details</h2>
          <button className="panel-close" onClick={onClose}>×</button>
        </div>
        
        <div className="panel-body">
          {issueType === 'underperforming' && (
            <>
              {/* AMs block (unchanged UI classes) */}
              <div className="issue-info">
                <h3>Underperforming AMs</h3>
                <p>AMs performing at or below 25% of their daily target</p>
                <div className="issue-count-badge">{ams.length} AMs found</div>
              </div>

              {ams.length > 0 ? (
                <div className="ams-list">
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
                      {ams.map(am => (
                        <div key={`${am.id}-${am.name}`} className="row">
                          <div className="c-name">
                            <span className="nm">{am.name}</span>
                            <span className={`badge ${am.role === 'AM' ? 'am' : 'flap'}`}>{am.role}</span>
                          </div>
                          <div className="c-role">{am.role === 'AM' ? 'Assistant Manager' : 'FLAP'}</div>
                          
                          {/* Yesterday */}
                          <div className="grp">
                            <div className="nums">
                              <div className="n achieved clickable" onClick={() => onMetricClick(am.name, am.role, 'y')}>
                                {am.metrics.service.y.achieved.toFixed(1)}L
                              </div>
                              <div className="n target clickable" onClick={() => onMetricClick(am.name, am.role, 'y')}>
                                {am.metrics.service.y.target.toFixed(1)}L
                              </div>
                              <div className={`n pct ${getPercentageColor(am.metrics.service.y.pct)} clickable`} onClick={() => onMetricClick(am.name, am.role, 'y')}>
                                {am.metrics.service.y.pct}%
                              </div>
                            </div>
                          </div>
                          
                          {/* WTD */}
                          <div className="grp">
                            <div className="nums">
                              <div className="n achieved clickable" onClick={() => onMetricClick(am.name, am.role, 'w')}>
                                {am.metrics.service.w.achieved.toFixed(1)}L
                              </div>
                              <div className="n target clickable" onClick={() => onMetricClick(am.name, am.role, 'w')}>
                                {am.metrics.service.w.target.toFixed(1)}L
                              </div>
                              <div className={`n pct ${getPercentageColor(am.metrics.service.w.pct)} clickable`} onClick={() => onMetricClick(am.name, am.role, 'w')}>
                                {am.metrics.service.w.pct}%
                              </div>
                            </div>
                          </div>
                          
                          {/* MTD */}
                          <div className="grp">
                            <div className="nums">
                              <div className="n achieved clickable" onClick={() => onMetricClick(am.name, am.role, 'm')}>
                                {am.metrics.service.m.achieved.toFixed(1)}L
                              </div>
                              <div className="n target clickable" onClick={() => onMetricClick(am.name, am.role, 'm')}>
                                {am.metrics.service.m.target.toFixed(1)}L
                              </div>
                              <div className={`n pct ${getPercentageColor(am.metrics.service.m.pct)} clickable`} onClick={() => onMetricClick(am.name, am.role, 'm')}>
                                {am.metrics.service.m.pct}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-issues">
                  <p>No underperforming AMs found</p>
                </div>
              )}

              {/* Ms block (uses same classes; no CSS change) */}
              <div className="issue-info" style={{ marginTop: '24px' }}>
                <h3>Underperforming Ms</h3>
                <p>Ms performing at or below 25% of their daily target</p>
                <div className="issue-count-badge">{ms.length} Ms found</div>
              </div>

              {ms.length > 0 ? (
                <div className="ams-list">
                  <div className="card">
                    <div className="thead">
                      <div className="h-name">
                        <div className="h-title">Manager Name</div>
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
                      {ms.map(m => (
                        <div key={`${m.id}-${m.name}`} className="row">
                          <div className="c-name">
                            <span className="nm">{m.name}</span>
                            <span className="badge">M</span>
                          </div>
                          <div className="c-role">Manager</div>

                          {/* Yesterday */}
                          <div className="grp">
                            <div className="nums">
                              <div className="n achieved clickable" onClick={() => onMetricClick(m.name, m.role, 'y')}>
                                {m.metrics.service.y.achieved.toFixed(1)}L
                              </div>
                              <div className="n target clickable" onClick={() => onMetricClick(m.name, m.role, 'y')}>
                                {m.metrics.service.y.target.toFixed(1)}L
                              </div>
                              <div className={`n pct ${getPercentageColor(m.metrics.service.y.pct)} clickable`} onClick={() => onMetricClick(m.name, m.role, 'y')}>
                                {m.metrics.service.y.pct}%
                              </div>
                            </div>
                          </div>

                          {/* WTD */}
                          <div className="grp">
                            <div className="nums">
                              <div className="n achieved clickable" onClick={() => onMetricClick(m.name, m.role, 'w')}>
                                {m.metrics.service.w.achieved.toFixed(1)}L
                              </div>
                              <div className="n target clickable" onClick={() => onMetricClick(m.name, m.role, 'w')}>
                                {m.metrics.service.w.target.toFixed(1)}L
                              </div>
                              <div className={`n pct ${getPercentageColor(m.metrics.service.w.pct)} clickable`} onClick={() => onMetricClick(m.name, m.role, 'w')}>
                                {m.metrics.service.w.pct}%
                              </div>
                            </div>
                          </div>

                          {/* MTD */}
                          <div className="grp">
                            <div className="nums">
                              <div className="n achieved clickable" onClick={() => onMetricClick(m.name, m.role, 'm')}>
                                {m.metrics.service.m.achieved.toFixed(1)}L
                              </div>
                              <div className="n target clickable" onClick={() => onMetricClick(m.name, m.role, 'm')}>
                                {m.metrics.service.m.target.toFixed(1)}L
                              </div>
                              <div className={`n pct ${getPercentageColor(m.metrics.service.m.pct)} clickable`} onClick={() => onMetricClick(m.name, m.role, 'm')}>
                                {m.metrics.service.m.pct}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              ) : (
                <div className="no-issues">
                  <p>No underperforming Ms found</p>
                </div>
              )}
            </>
          )}

          {issueType === 'dietitians' && (
            <>
              <div className="issue-info">
                <h3>Underperforming Dietitians</h3>
                <p>Dietitians with zero sales for 3+ consecutive days</p>
                <div className="issue-count-badge">{dietitians.length} Dietitians found</div>
              </div>

              {dietitians.length > 0 ? (
                <div className="dietitians-list">
                  <div className="card">
                    <div className="thead">
                      <div className="h-name">
                        <div className="h-title">Dietitian Name</div>
                      </div>
                      <div className="h-role">
                        <div className="h-title">SM Name</div>
                      </div>
                      <div className="h-group">
                        <div className="g-title">Zero Days</div>
                      </div>
                      <div className="h-group merged">
                        <div className="g-title">Sales</div>
                        <div className="g-sub">
                          <span>Target</span><span>Achieved</span><span>%</span>
                        </div>
                      </div>
                    </div>

                    <div className="tbody">
                      {dietitians.map((dietitian, index) => (
                        <div key={`${dietitian.dietitianName}-${index}`} className="row">
                          <div className="c-name">
                            <span className="nm">{dietitian.dietitianName}</span>
                          </div>
                          <div className="c-role">{dietitian.smName}</div>
                          
                          {/* Zero Days */}
                          <div className="grp">
                            <div className="zero-days">
                              <div className="n days">{dietitian.consecutiveZeroDays}</div>
                            </div>
                          </div>
                          
                          {/* Sales Metrics */}
                          <div className="grp">
                            <div className="nums">
                              <div className="n target">
                                {fmtLakhs(dietitian.salesTarget)}L
                              </div>
                              <div className="n achieved">
                                {fmtLakhs(dietitian.salesAchieved)}L
                              </div>
                              <div className={`n pct ${getPercentageColor(dietitian.percentAchieved)}`}>
                                {dietitian.percentAchieved}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-issues">
                  <p>No underperforming dietitians found</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ⛔ Styles for panel are unchanged and already present globally below in your file */}
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

        .issue-info {
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--line);
        }

        .issue-info h3 {
          margin: 0 0 8px 0;
          color: #111827;
          font-size: 18px;
        }

        .issue-info p {
          margin: 0 0 12px 0;
          color: #6b7280;
          font-size: 14px;
        }

        .issue-count-badge {
          background: #ef4444;
          color: white;
          padding: 6px 12px;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 600;
          display: inline-block;
        }

        .card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 14px;
          overflow: hidden;
        }

        .thead {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 160px repeat(3, 1fr);
          background: linear-gradient(180deg, #ffffff, #fbfbfb);
          border-bottom: 1px solid var(--line2);
          padding: 12px 16px;
        }

        .h-name, .h-role, .h-group {
          padding: 12px;
          text-align: center;
        }

        .h-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: #111827;
          font-weight: 700;
        }

        .h-sub {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 2px;
        }

        .h-group.merged {
          grid-column: span 1;
        }

        .h-group .g-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: #111827;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .h-group .g-sub {
          display: grid;
          grid-template-columns: 1fr 1fr 60px;
          gap: 12px;
          font-size: 12px;
          color: #94a3b8;
        }

        .h-group .g-sub span:nth-child(1) { text-align: left; }
        .h-group .g-sub span:nth-child(2) { text-align: center; }
        .h-group .g-sub span:nth-child(3) { text-align: right; }

        .tbody {
          display: flex;
          flex-direction: column;
        }

        .row {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 160px repeat(3, 1fr);
          padding: 12px 16px;
          align-items: center;
          border-bottom: 1px solid var(--line2);
          transition: background 0.12s ease;
        }

        .row:hover {
          background: #fafbfd;
        }

        .row:last-child {
          border-bottom: none;
        }

        .c-name {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .c-role {
          color: #64748b;
          text-align: center;
        }

        .nm {
          font-weight: 600;
        }

        .grp {
          padding: 0 10px;
        }

        .nums {
          display: grid;
          grid-template-columns: 1fr 1fr 60px;
          gap: 12px;
          align-items: center;
        }

        .zero-days {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .n {
          font-weight: 600;
          font-size: 14px;
        }

        .n.days {
          background: #ef4444;
          color: white;
          padding: 6px 12px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 14px;
          min-width: 40px;
        }

        .n.achieved {
          text-align: left;
          justify-self: start;
        }

        .n.target {
          text-align: center;
          justify-self: center;
        }

        .n.pct {
          text-align: right;
          justify-self: end;
          font-size: 13px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .n.pct.low {
          color: var(--low);
          background: #fef2f2;
        }

        .n.pct.warn {
          color: var(--warn);
          background: #fffbeb;
        }

        .n.pct.good {
          color: var(--good);
          background: #f0fdf4;
        }

        .clickable {
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 2px 4px;
          border-radius: 4px;
        }

        .clickable:hover {
          background: #f8fafc;
          transform: scale(1.05);
        }

        .badge {
          font-size: 11px;
          border-radius: 999px;
          padding: 4px 10px;
          border: 1px solid var(--line);
        }

        .badge.am {
          background: #fff7ed;
        }

        .badge.flap {
          background: #fffdea;
        }

        .no-issues {
          text-align: center;
          padding: 40px 20px;
          color: #6b7280;
        }

        /* Dietitians specific styling - IMPROVED */
        .dietitians-list .thead {
          grid-template-columns: minmax(200px, 1fr) minmax(150px, 1fr) 120px minmax(200px, 1fr);
        }

        .dietitians-list .row {
          grid-template-columns: minmax(200px, 1fr) minmax(150px, 1fr) 120px minmax(200px, 1fr);
        }

        .dietitians-list .h-group.merged {
          grid-column: span 1;
        }

        .dietitians-list .h-group .g-sub {
          display: grid;
          grid-template-columns: 1fr 1fr 80px;
          gap: 12px;
          font-size: 12px;
          color: #94a3b8;
        }

        .dietitians-list .h-group .g-sub span {
          text-align: center;
        }

        .dietitians-list .nums {
          display: grid;
          grid-template-columns: 1fr 1fr 80px;
          gap: 12px;
          align-items: center;
        }

        .dietitians-list .n.achieved,
        .dietitians-list .n.target,
        .dietitians-list .n.pct {
          text-align: center;
          justify-self: center;
        }

        .dietitians-list .zero-days .n.days {
          background: #ef4444;
          color: white;
          padding: 6px 12px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 14px;
          min-width: 40px;
        }

        .dietitians-list .c-name,
        .dietitians-list .c-role {
          padding: 0 12px;
        }

        .dietitians-list .grp {
          padding: 0 12px;
        }
      `}</style>
    </div>
  );
}

// Metrics Modal Component (same as main dashboard)
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
