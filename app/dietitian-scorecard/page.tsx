'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface DietitianScorecardData {
  overallScore: number;
  employeeName: string;
  acc: number;
  manager: string;
  seniorManager: string;
  salesAchieved: number;
  commerceAchieved: number;
  numberOfLeads: number;
  totalTalktime: number;
  avgNPS: number;
  avgLatestCSAT: number;
  conversionPercent: number;
}

interface SM {
  id: string;
  name: string;
  role: string;
}

export default function DietitianScorecardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  const [sms, setSms] = useState<SM[]>([]);
  const [selectedSM, setSelectedSM] = useState<string>('');
  const [scorecardData, setScorecardData] = useState<DietitianScorecardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check authentication
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

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return '';
  };

  // Fetch hierarchy data to get SM list
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchHierarchyData = async () => {
      try {
        const response = await fetch('/api/hierarchy');
        if (!response.ok) throw new Error('Failed to fetch hierarchy data');
        const { sms: hierarchySms } = await response.json();
        
        setSms(hierarchySms);
        
        // Auto-select current user if they are an SM
        if (userRole === 'sm') {
          const currentUserSM = hierarchySms.find((sm: SM) => 
            sm.name.toLowerCase() === userName.toLowerCase()
          );
          if (currentUserSM) {
            setSelectedSM(currentUserSM.name);
          }
        }
      } catch (err) {
        console.error('Error fetching hierarchy data:', err);
        setError('Failed to load SM data');
      }
    };

    fetchHierarchyData();
  }, [isAuthenticated, userRole, userName]);

  // Fetch scorecard data
  useEffect(() => {
    if (!isAuthenticated) return;
    if (userRole === 'admin' && !selectedSM) return;
    if (userRole === 'sm' && !selectedSM) return;

    const fetchScorecardData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/dietitian-scorecard');
        if (!response.ok) throw new Error('Failed to fetch scorecard data');
        const data = await response.json();
        
        // Filter data by selected SM
        const filteredData = data.filter((item: DietitianScorecardData) => 
          item.seniorManager === selectedSM
        );
        
        setScorecardData(filteredData);
      } catch (err) {
        console.error('Error fetching scorecard data:', err);
        setError('Failed to load scorecard data');
      } finally {
        setLoading(false);
      }
    };

    fetchScorecardData();
  }, [isAuthenticated, selectedSM, userRole]);

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

  // Sort data by overall score (descending) and then by manager
  const sortedData = useMemo(() => {
    return [...scorecardData].sort((a, b) => {
      // First by overall score (descending)
      if (b.overallScore !== a.overallScore) {
        return b.overallScore - a.overallScore;
      }
      // Then by manager name (ascending) to group by manager
      return a.manager.localeCompare(b.manager);
    });
  }, [scorecardData]);

  const formatNumber = (num: number) => {
    if (num === 0) return '0';
    if (Number.isInteger(num)) return num.toString();
    return num.toFixed(1);
  };

  const formatPercentage = (num: number) => {
    return `${formatNumber(num)}%`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 9) return 'score-high';
    if (score >= 6) return 'score-medium';
    return 'score-low';
  };

  const getRowBackgroundColor = (score: number) => {
    if (score >= 9) return 'row-score-high';
    if (score >= 6) return 'row-score-medium';
    return 'row-score-low';
  };

  if (isAuthenticated === null) {
    return (
      <div className="crm-root">
        <div className="loading-full">Checking authentication...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="crm-root">
      <aside className="crm-aside">
        <div className="brand">
          <span className="brand-main">Fitelo</span> <span className="brand-sub">SM Dashboard</span>
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
          <button className="logout-btn" onClick={handleLogout}>⎋ Logout</button>
        </div>
      </aside>

      <section className="crm-main">
        <header className="top">
          <div>
            <h1 className="title">Dietitian Scorecard</h1>
            <p className="subtitle">Performance metrics for dietitians</p>
          </div>
          <div className="actions">
            <button className="btn" title="Refresh" onClick={() => window.location.reload()}>
              ⟲ Refresh
            </button>
          </div>
        </header>

        {/* SM Selection for Admin */}
        {userRole === 'admin' && (
          <div className="selection-row">
            <div className="select-group">
              <label className="select-label">Select SM:</label>
              <select
                className="select"
                value={selectedSM}
                onChange={(e) => setSelectedSM(e.target.value)}
              >
                <option value="">-- Select SM --</option>
                {sms.map(sm => (
                  <option key={sm.id} value={sm.name}>{sm.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Welcome message for SM */}
        {userRole === 'sm' && (
          <div className="user-welcome">
            <h3>Welcome, {userName}</h3>
            <p>Viewing dietitian scorecard for your team</p>
          </div>
        )}

        {error && (
          <div className="error">
            <h2>Error Loading Data</h2>
            <p>{error}</p>
            <button className="btn" onClick={() => window.location.reload()} style={{ marginTop: '16px' }}>
              Try Again
            </button>
          </div>
        )}

        {loading && (
          <div className="loading">Loading dietitian scorecard data...</div>
        )}

        {!loading && !error && selectedSM && (
          <div className="section">
            <h2 className="section-title">
              Dietitian Scorecard {userRole === 'admin' && `- ${selectedSM}`}
            </h2>
            
            {sortedData.length === 0 ? (
              <div className="card">
                <div className="no-data">
                  <h3>No Data Available</h3>
                  <p>No dietitian scorecard data found for {selectedSM}.</p>
                </div>
              </div>
            ) : (
              <div className="scorecard-table-container">
                <div className="scorecard-table">
                  <div className="table-header">
                    <div className="header-cell score-cell">Score</div>
                    <div className="header-cell name-cell">Employee</div>
                    <div className="header-cell number-cell">ACC</div>
                    <div className="header-cell name-cell">Manager</div>
                    <div className="header-cell number-cell">Sales %</div>
                    <div className="header-cell number-cell">Commerce %</div>
                    <div className="header-cell number-cell">Leads</div>
                    <div className="header-cell number-cell">Talktime</div>
                    <div className="header-cell number-cell">NPS</div>
                    <div className="header-cell number-cell">CSAT</div>
                    <div className="header-cell number-cell">Conversion %</div>
                  </div>
                  
                  <div className="table-body">
                    {sortedData.map((row, index) => (
                      <div key={index} className={`table-row ${getRowBackgroundColor(row.overallScore)}`}>
                        <div className="cell score-cell">
                          <div className={`score-badge ${getScoreColor(row.overallScore)}`}>
                            {formatNumber(row.overallScore)}
                          </div>
                        </div>
                        <div className="cell name-cell employee-name">
                          {row.employeeName}
                        </div>
                        <div className="cell number-cell">
                          {formatNumber(row.acc)}
                        </div>
                        <div className="cell name-cell manager-name">
                          {row.manager}
                        </div>
                        <div className="cell number-cell percentage">
                          {formatPercentage(row.salesAchieved)}
                        </div>
                        <div className="cell number-cell percentage">
                          {formatPercentage(row.commerceAchieved)}
                        </div>
                        <div className="cell number-cell">
                          {formatNumber(row.numberOfLeads)}
                        </div>
                        <div className="cell number-cell">
                          {formatNumber(row.totalTalktime)}
                        </div>
                        <div className="cell number-cell">
                          {formatNumber(row.avgNPS)}
                        </div>
                        <div className="cell number-cell">
                          {formatNumber(row.avgLatestCSAT)}
                        </div>
                        <div className="cell number-cell percentage">
                          {formatPercentage(row.conversionPercent)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !error && !selectedSM && userRole === 'admin' && (
          <div className="section">
            <div className="card">
              <div className="no-data">
                <h3>Select an SM</h3>
                <p>Please select a Senior Manager to view their dietitian scorecard.</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <style jsx global>{`
        .loading-full{display:flex;justify-content:center;align-items:center;height:100vh;font-size:18px;color:#64748b}
        .loading,.error,.no-data{display:flex;flex-direction:column;justify-content:center;align-items:center;height:200px;font-size:18px;color:var(--muted);text-align:center}
        .error{color:#ef4444}
        .error h2{margin:0 0 8px 0;color:#dc2626}
        .error p{margin:0 0 16px 0;max-width:400px;line-height:1.5}
        .no-data h3{margin:0 0 8px 0;color:var(--text)}
        .no-data p{margin:0;color:var(--muted)}
        .user-info{margin-top:auto;padding:16px;border-top:1px solid var(--line);text-align:center}
        .user-name{font-weight:600;color:var(--text)}
        .user-role{font-size:12px;color:var(--muted);margin-top:4px}
        .user-email{font-size:11px;color:var(--muted);margin-top:2px;margin-bottom:12px}
        .logout-btn{width:100%;background:#ef4444;color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:14px}
        .logout-btn:hover{background:#dc2626}
        .user-welcome{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px}
        .user-welcome h3{margin:0 0 4px 0;color:var(--text);font-size:16px}
        .user-welcome p{margin:0;color:var(--muted);font-size:14px}

        /* Scorecard Table Styles */
        .scorecard-table-container {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .scorecard-table {
          width: 100%;
          display: flex;
          flex-direction: column;
          font-size: 13px;
        }

        .table-header {
          display: grid;
          grid-template-columns: 80px minmax(120px, 1fr) 70px minmax(100px, 1fr) 80px 90px 70px 90px 70px 80px 90px;
          gap: 8px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #FFFFFF;
          font-weight: 700;
          position: sticky;
          top: 0;
          z-index: 10;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .header-cell {
          padding: 8px 4px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 700;
          color: #FFFFFF !important;
        }

        .header-cell.number-cell {
          justify-content: center;
        }

        .header-cell.name-cell {
          justify-content: flex-start;
        }

        /* Force white color for ALL header cells */
        .scorecard-table .table-header .header-cell {
          color: #FFFFFF !important;
        }

        .table-body {
          max-height: 60vh;
          overflow-y: auto;
        }

        .table-row {
          display: grid;
          grid-template-columns: 80px minmax(120px, 1fr) 70px minmax(100px, 1fr) 80px 90px 70px 90px 70px 80px 90px;
          gap: 8px;
          padding: 10px 16px;
          align-items: center;
          border-bottom: 1px solid #f1f5f9;
          transition: all 0.2s ease;
          min-height: 48px;
        }

        .table-row:hover {
          background: #f8fafc;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        /* Score-based row background colors */
        .row-score-low {
          background: rgba(254, 226, 226, 0.3); /* Very light red */
        }

        .row-score-medium {
          background: rgba(254, 243, 199, 0.3); /* Very light yellow */
        }

        .row-score-high {
          background: rgba(220, 252, 231, 0.3); /* Very light green */
        }

        .cell {
          padding: 6px 4px;
          display: flex;
          align-items: center;
          min-height: 32px;
        }

        .score-cell {
          justify-content: center;
        }

        .name-cell {
          justify-content: flex-start;
          font-weight: 500;
          color: var(--text);
        }

        .employee-name {
          font-weight: 600;
          color: #1e293b;
        }

        .manager-name {
          color: #64748b;
          font-size: 12px;
        }

        .number-cell {
          justify-content: center;
          font-weight: 600;
          color: #475569;
          font-feature-settings: 'tnum';
          font-variant-numeric: tabular-nums;
        }

        .percentage {
          color: #059669;
        }

        .score-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 8px;
          border: 2px solid;
          font-weight: 700;
          font-size: 12px;
          min-width: 50px;
          font-feature-settings: 'tnum';
          font-variant-numeric: tabular-nums;
        }

        .score-high {
          background: #dcfce7;
          border-color: #22c55e;
          color: #166534;
        }

        .score-medium {
          background: #fef3c7;
          border-color: #f59e0b;
          color: #92400e;
        }

        .score-low {
          background: #fee2e2;
          border-color: #ef4444;
          color: #991b1b;
        }

        /* Responsive adjustments */
        @media (max-width: 1400px) {
          .table-header,
          .table-row {
            grid-template-columns: 70px minmax(100px, 1fr) 60px minmax(90px, 1fr) 70px 80px 60px 80px 60px 70px 80px;
            gap: 6px;
            padding: 8px 12px;
          }
          
          .header-cell {
            font-size: 11px;
            padding: 6px 2px;
          }
          
          .cell {
            padding: 4px 2px;
            font-size: 12px;
          }
          
          .score-badge {
            padding: 4px 8px;
            min-width: 45px;
            font-size: 11px;
          }
        }

        /* Scrollbar styling */
        .table-body::-webkit-scrollbar {
          width: 6px;
        }

        .table-body::-webkit-scrollbar-track {
          background: #f1f5f9;
        }

        .table-body::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }

        .table-body::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
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
          --pill-bg:#f8fafc;
          --pill-br:#e5e7eb;
        }

        *{box-sizing:border-box}
        html,body{height:100%}
        body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif}

        .crm-root{display:grid;grid-template-columns:260px 1fr;min-height:100vh}
        .crm-aside{background:#fff;border-right:1px solid var(--line);padding:18px 16px;display:flex;flex-direction:column}
        .brand{font-weight:700;font-size:18px;margin:4px 6px 14px}
        .brand-main{color:#111827}
        .brand-sub{color:#f97316;margin-left:6px}
        .zap{margin-left:6px}

        .nav{display:flex;flex-direction:column;gap:4px}
        .nav-item{display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;color:#0f172a;text-decoration:none;cursor:pointer}
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

        .selection-row{display:flex;gap:20px;align-items:end}
        .select-group{display:flex;flex-direction:column;gap:6px}
        .select-label{font-size:13px;font-weight:600;color:#374151}
        .select{background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px 12px;min-width:200px;outline:none}
        .select:focus{border-color:#cbd5e1}

        .section{margin-top:8px}
        .section-title{font-size:16px;font-weight:600;color:#111827;margin:0 0 12px 0}

        .card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
      `}</style>
    </div>
  );
}