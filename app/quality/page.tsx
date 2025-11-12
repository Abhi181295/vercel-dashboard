// app/quality/page.tsx

'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Reuse existing types from main dashboard
type UserWithTargets = {
  id: string;
  name: string;
  role: 'SM' | 'M' | 'AM' | 'FLAP' | 'EM';
  targets?: {
    service: number;
    commerce: number;
  };
  managerId?: string;
  smId?: string;
};

type Leaf = {
  id: string;
  name: string;
  role: 'AM' | 'FLAP' | 'EM';
  metrics: {
    quality: {
      avgWeeklyWeightLoss: number;
      weeklyOnTrackPct: number;
      monthlyOnTrackPct: number;
    };
    customerRating?: {
      ytdAvgCSAT: number;
      wtdAvgCSAT: number;
      latestCSAT: number;
      ytdAvgNPS: number;
      mtdAvgNPS: number;
    };
  };
  managerId?: string;
  smId?: string;
};

type Manager = {
  id: string;
  name: string;
  role: 'M';
  metrics: {
    quality: {
      avgWeeklyWeightLoss: number;
      weeklyOnTrackPct: number;
      monthlyOnTrackPct: number;
    };
    customerRating?: {
      ytdAvgCSAT: number;
      wtdAvgCSAT: number;
      latestCSAT: number;
      ytdAvgNPS: number;
      mtdAvgNPS: number;
    };
  };
  children: Leaf[];
  smId?: string;
};

type SM = {
  id: string;
  name: string;
  role: 'SM';
  metrics: {
    quality: {
      avgWeeklyWeightLoss: number;
      weeklyOnTrackPct: number;
      monthlyOnTrackPct: number;
    };
    customerRating?: {
      ytdAvgCSAT: number;
      wtdAvgCSAT: number;
      latestCSAT: number;
      ytdAvgNPS: number;
      mtdAvgNPS: number;
    };
  };
  children: Manager[];
  ems?: Leaf[];
};

function buildQualityHierarchy(
  sms: UserWithTargets[],
  managers: UserWithTargets[],
  ams: UserWithTargets[],
  ems: UserWithTargets[] = [],
  qualityData: any,
  customerRatingData: any
) {
  const smMap = new Map(
    sms.map(sm => [
      sm.id,
      {
        ...sm,
        children: [] as any[],
        ems: [] as any[],
        metrics: {
          quality: {
            avgWeeklyWeightLoss: qualityData[sm.id]?.avgWeeklyWeightLoss || 0,
            weeklyOnTrackPct: qualityData[sm.id]?.weeklyOnTrackPct || 0,
            monthlyOnTrackPct: qualityData[sm.id]?.monthlyOnTrackPct || 0,
          },
          customerRating: customerRatingData[sm.id] ? {
            ytdAvgCSAT: customerRatingData[sm.id].ytdAvgCSAT || 0,
            wtdAvgCSAT: customerRatingData[sm.id].wtdAvgCSAT || 0,
            latestCSAT: customerRatingData[sm.id].latestCSAT || 0,
            ytdAvgNPS: customerRatingData[sm.id].ytdAvgNPS || 0,
            mtdAvgNPS: customerRatingData[sm.id].mtdAvgNPS || 0,
          } : undefined
        },
      },
    ])
  );

  const managerMap = new Map(
    managers.map(manager => [
      manager.id,
      {
        ...manager,
        children: [] as any[],
        metrics: {
          quality: {
            avgWeeklyWeightLoss: qualityData[manager.id]?.avgWeeklyWeightLoss || 0,
            weeklyOnTrackPct: qualityData[manager.id]?.weeklyOnTrackPct || 0,
            monthlyOnTrackPct: qualityData[manager.id]?.monthlyOnTrackPct || 0,
          },
          customerRating: customerRatingData[manager.id] ? {
            ytdAvgCSAT: customerRatingData[manager.id].ytdAvgCSAT || 0,
            wtdAvgCSAT: customerRatingData[manager.id].wtdAvgCSAT || 0,
            latestCSAT: customerRatingData[manager.id].latestCSAT || 0,
            ytdAvgNPS: customerRatingData[manager.id].ytdAvgNPS || 0,
            mtdAvgNPS: customerRatingData[manager.id].mtdAvgNPS || 0,
          } : undefined
        },
      },
    ])
  );

  managers.forEach(manager => {
    if (manager.smId && smMap.has(manager.smId)) {
      const sm = smMap.get(manager.smId)!;
      const managerWithMetrics = managerMap.get(manager.id)!;
      sm.children.push(managerWithMetrics);
    }
  });

  // Keep virtual "Direct Reports" for grouping AMs without a manager
  ams.forEach(am => {
    if (am.managerId && managerMap.has(am.managerId)) {
      const manager = managerMap.get(am.managerId)!;
      manager.children.push({
        ...am,
        metrics: {
          quality: {
            avgWeeklyWeightLoss: qualityData[am.id]?.avgWeeklyWeightLoss || 0,
            weeklyOnTrackPct: qualityData[am.id]?.weeklyOnTrackPct || 0,
            monthlyOnTrackPct: qualityData[am.id]?.monthlyOnTrackPct || 0,
          },
          customerRating: customerRatingData[am.id] ? {
            ytdAvgCSAT: customerRatingData[am.id].ytdAvgCSAT || 0,
            wtdAvgCSAT: customerRatingData[am.id].wtdAvgCSAT || 0,
            latestCSAT: customerRatingData[am.id].latestCSAT || 0,
            ytdAvgNPS: customerRatingData[am.id].ytdAvgNPS || 0,
            mtdAvgNPS: customerRatingData[am.id].mtdAvgNPS || 0,
          } : undefined
        },
      });
    } else if (am.smId && smMap.has(am.smId)) {
      const sm = smMap.get(am.smId)!;
      const virtualManagerId = `virtual-m-${am.smId}`;
      if (!managerMap.has(virtualManagerId)) {
        const virtualManager: any = {
          id: virtualManagerId,
          name: 'Direct Reports',
          role: 'M',
          smId: am.smId,
          children: [],
          metrics: {
            quality: {
              avgWeeklyWeightLoss: 0,
              weeklyOnTrackPct: 0,
              monthlyOnTrackPct: 0,
            }
          },
        };
        managerMap.set(virtualManagerId, virtualManager);
        sm.children.push(virtualManager);
      }
      const virtualManager = managerMap.get(virtualManagerId)!;
      virtualManager.children.push({
        ...am,
        metrics: {
          quality: {
            avgWeeklyWeightLoss: qualityData[am.id]?.avgWeeklyWeightLoss || 0,
            weeklyOnTrackPct: qualityData[am.id]?.weeklyOnTrackPct || 0,
            monthlyOnTrackPct: qualityData[am.id]?.monthlyOnTrackPct || 0,
          },
          customerRating: customerRatingData[am.id] ? {
            ytdAvgCSAT: customerRatingData[am.id].ytdAvgCSAT || 0,
            wtdAvgCSAT: customerRatingData[am.id].wtdAvgCSAT || 0,
            latestCSAT: customerRatingData[am.id].latestCSAT || 0,
            ytdAvgNPS: customerRatingData[am.id].ytdAvgNPS || 0,
            mtdAvgNPS: customerRatingData[am.id].mtdAvgNPS || 0,
          } : undefined
        },
      });
    }
  });

  ems.forEach(em => {
    if (em.smId && smMap.has(em.smId)) {
      const sm = smMap.get(em.smId)!;
      sm.ems!.push({
        ...em,
        metrics: {
          quality: {
            avgWeeklyWeightLoss: qualityData[em.id]?.avgWeeklyWeightLoss || 0,
            weeklyOnTrackPct: qualityData[em.id]?.weeklyOnTrackPct || 0,
            monthlyOnTrackPct: qualityData[em.id]?.monthlyOnTrackPct || 0,
          },
          customerRating: customerRatingData[em.id] ? {
            ytdAvgCSAT: customerRatingData[em.id].ytdAvgCSAT || 0,
            wtdAvgCSAT: customerRatingData[em.id].wtdAvgCSAT || 0,
            latestCSAT: customerRatingData[em.id].latestCSAT || 0,
            ytdAvgNPS: customerRatingData[em.id].ytdAvgNPS || 0,
            mtdAvgNPS: customerRatingData[em.id].mtdAvgNPS || 0,
          } : undefined
        },
      } as Leaf);
    }
  });

  return Array.from(smMap.values());
}

// Component for percentage display with color coding
function PercentageDisplay({ value }: { value: number }) {
  const getPercentageColor = (pct: number) => {
    if (pct >= 80) return 'good';
    if (pct >= 50) return 'warn';
    return 'low';
  };

  return (
    <div className={`n pct ${getPercentageColor(value)}`}>
      {value.toFixed(1)}%
    </div>
  );
}

// Component for CSAT display with color coding
function CSATDisplay({ value }: { value: number }) {
  const getCSATColor = (csat: number) => {
    if (csat >= 4.5) return 'good';
    if (csat >= 3.0) return 'warn';
    return 'low';
  };

  const formatValue = (val: number) => {
    return val === 0 ? '—' : val.toFixed(1);
  };

  return (
    <div className={`n csat ${getCSATColor(value)}`} title={value === 0 ? 'No data' : `CSAT: ${value.toFixed(1)}`}>
      {formatValue(value)}
    </div>
  );
}

// Component for NPS display with color coding
function NPSDisplay({ value }: { value: number }) {
  const getNPSColor = (nps: number) => {
    if (nps >= 8.0) return 'good';
    if (nps >= 5.0) return 'warn';
    return 'low';
  };

  const formatValue = (val: number) => {
    return val === 0 ? '—' : val.toFixed(1);
  };

  return (
    <div className={`n nps ${getNPSColor(value)}`} title={value === 0 ? 'No data' : `NPS: ${value.toFixed(1)}`}>
      {formatValue(value)}
    </div>
  );
}

export default function QualityPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  const [selectedSM, setSelectedSM] = useState<SM | null>(null);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'weightloss' | 'customerRating'>('weightloss');

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return '';
  };

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

  const loadData = async () => {
    try {
      setLoading(true);
      const [hierarchyResponse, qualityResponse, customerRatingResponse] = await Promise.all([
        fetch('/api/hierarchy'),
        fetch('/api/quality'),
        fetch('/api/customer-rating')
      ]);
      
      if (!hierarchyResponse.ok) throw new Error('Failed to fetch hierarchy data');
      if (!qualityResponse.ok) throw new Error('Failed to fetch quality data');
      if (!customerRatingResponse.ok) console.warn('Failed to fetch customer rating data, continuing without it...');

      const { sms, managers, ams, ems } = await hierarchyResponse.json();
      const { quality } = await qualityResponse.json();
      const customerRatingData = customerRatingResponse.ok ? await customerRatingResponse.json() : { customerRating: {} };

      let filteredData = sms;
      if (userRole === 'sm') {
        filteredData = sms.filter(
          (sm: UserWithTargets) => sm.name.toLowerCase() === userName.toLowerCase()
        );
      }

      const hierarchy = buildQualityHierarchy(filteredData, managers, ams, ems || [], quality, customerRatingData.customerRating || {});
      setData(hierarchy as any);
      if (hierarchy.length > 0) setSelectedSM(hierarchy[0] as any);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data from Google Sheets. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
  }, [isAuthenticated, userRole, userName]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
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

  // Filter out the virtual "Direct Reports" everywhere in Manager UI
  const filterOutDirectReports = (arr: Manager[] = []) =>
    (arr || []).filter(m => (m?.name || '').toLowerCase() !== 'direct reports');

  const managersToDisplay = useMemo(() => {
    if (selectedManager) return filterOutDirectReports([selectedManager]);
    else if (selectedSM) return filterOutDirectReports(selectedSM.children || []);
    return [];
  }, [selectedSM, selectedManager]);

  const emsToDisplay = useMemo(() => (selectedSM ? selectedSM.ems || [] : []), [selectedSM]);

  const filteredAMs = useMemo(() => {
    if (selectedManager) return selectedManager.children || [];
    else if (selectedSM) return (selectedSM.children || []).flatMap((m: Manager) => m.children || []);
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
    const validManagers = filterOutDirectReports(selectedSM?.children || []);
    const manager = validManagers.find((m: Manager) => m.id === managerId) || null;
    setSelectedManager(manager);
  };

  const formatWeightLoss = (value: number) => {
  if (value === 0) return '—';
  const truncated = Math.trunc(value * 100) / 100;
  return `${truncated.toFixed(2)} kg`;
};

  // Render different content based on active tab
  const renderContent = () => {
    if (activeTab === 'weightloss') {
      return renderWeightlossContent();
    } else {
      return renderCustomerRatingContent();
    }
  };

  const renderWeightlossContent = () => (
    <>
      {/* ======= SM Performance ======= */}
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
                  <div className="period-title">Avg Weekly Weight Loss</div>
                  <div className="grp">
                    <div className="nums-one">
                      <div className="n n-strong">
                        {formatWeightLoss(selectedSM.metrics.quality.avgWeeklyWeightLoss)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="metric-group">
                  <div className="period-title">% Weekly On Track</div>
                  <div className="grp">
                    <div className="nums-one">
                      <PercentageDisplay value={selectedSM.metrics.quality.weeklyOnTrackPct} />
                    </div>
                  </div>
                </div>
                <div className="metric-group">
                  <div className="period-title">% Monthly On Track</div>
                  <div className="grp">
                    <div className="nums-one">
                      <PercentageDisplay value={selectedSM.metrics.quality.monthlyOnTrackPct} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======= Managers table ======= */}
      {selectedSM && managersToDisplay.length > 0 && (
        <div className="section">
          <h2 className="section-title">
            Managers {selectedManager ? `- ${selectedManager.name}` : `under ${selectedSM.name}`}
          </h2>
          <div className="card weightloss-table">
            <div className="thead">
              <div className="h-name">
                <div className="h-title">Manager Name</div>
                <div className="h-sub">Reporting to {selectedSM.name}</div>
              </div>
              <div className="h-role"><div className="h-title">Role</div></div>
              <div className="h-group merged h-period">
                <div className="g-title">Avg Weekly Weight Loss</div>
                <div className="g-sub g-sub-one"><span>Weight Loss</span></div>
              </div>
              <div className="h-group merged h-period">
                <div className="g-title">% Weekly On Track</div>
                <div className="g-sub g-sub-one"><span>Percentage</span></div>
              </div>
              <div className="h-group merged h-period">
                <div className="g-title">% Monthly On Track</div>
                <div className="g-sub g-sub-one"><span>Percentage</span></div>
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
                  <div className="grp">
                    <div className="nums-one">
                      <div className="n n-strong">
                        {formatWeightLoss(manager.metrics.quality.avgWeeklyWeightLoss)}
                      </div>
                    </div>
                  </div>
                  <div className="grp">
                    <div className="nums-one">
                      <PercentageDisplay value={manager.metrics.quality.weeklyOnTrackPct} />
                    </div>
                  </div>
                  <div className="grp">
                    <div className="nums-one">
                      <PercentageDisplay value={manager.metrics.quality.monthlyOnTrackPct} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======= EMs table ======= */}
      {selectedSM && (selectedSM.ems?.length || 0) > 0 && (
        <div className="section">
          <h2 className="section-title">EMs under {selectedSM.name}</h2>
          <div className="card weightloss-table">
            <div className="thead">
              <div className="h-name"><div className="h-title">EM Name</div><div className="h-sub">Executive Managers</div></div>
              <div className="h-role"><div className="h-title">Role</div></div>
              <div className="h-group merged h-period"><div className="g-title">Avg Weekly Weight Loss</div><div className="g-sub g-sub-one"><span>Weight Loss</span></div></div>
              <div className="h-group merged h-period"><div className="g-title">% Weekly On Track</div><div className="g-sub g-sub-one"><span>Percentage</span></div></div>
              <div className="h-group merged h-period"><div className="g-title">% Monthly On Track</div><div className="g-sub g-sub-one"><span>Percentage</span></div></div>
            </div>

            <div className="tbody">
              {emsToDisplay.map((em: Leaf) => (
                <div key={em.id} className="row">
                  <div className="c-name"><span className="nm">{em.name}</span><span className="badge am">EM</span></div>
                  <div className="c-role">EM</div>
                  <div className="grp">
                    <div className="nums-one">
                      <div className="n n-strong">
                        {formatWeightLoss(em.metrics.quality.avgWeeklyWeightLoss)}
                      </div>
                    </div>
                  </div>
                  <div className="grp">
                    <div className="nums-one">
                      <PercentageDisplay value={em.metrics.quality.weeklyOnTrackPct} />
                    </div>
                  </div>
                  <div className="grp">
                    <div className="nums-one">
                      <PercentageDisplay value={em.metrics.quality.monthlyOnTrackPct} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======= AMs/FLAP table ======= */}
      {filteredAMs.length > 0 && (
        <div className="section">
          <h2 className="section-title">
            AMs/FLAP {selectedManager ? `under ${selectedManager.name}` : `under ${selectedSM?.name}`}
          </h2>
          <div className="card weightloss-table">
            <div className="thead">
              <div className="h-name"><div className="h-title">AM/FLAP Name</div><div className="h-sub">Team members</div></div>
              <div className="h-role"><div className="h-title">Role</div></div>
              <div className="h-group merged h-period"><div className="g-title">Avg Weekly Weight Loss</div><div className="g-sub g-sub-one"><span>Weight Loss</span></div></div>
              <div className="h-group merged h-period"><div className="g-title">% Weekly On Track</div><div className="g-sub g-sub-one"><span>Percentage</span></div></div>
              <div className="h-group merged h-period"><div className="g-title">% Monthly On Track</div><div className="g-sub g-sub-one"><span>Percentage</span></div></div>
            </div>

            <div className="tbody">
              {filteredAMs.map(am => (
                <div key={am.id} className="row">
                  <div className="c-name">
                    <span className="nm">{am.name}</span>
                    <span className={`badge ${am.role === 'AM' ? 'am' : 'flap'}`}>{am.role}</span>
                  </div>
                  <div className="c-role">{am.role === 'AM' ? 'Assistant Manager' : am.role}</div>
                  <div className="grp">
                    <div className="nums-one">
                      <div className="n n-strong">
                        {formatWeightLoss(am.metrics.quality.avgWeeklyWeightLoss)}
                      </div>
                    </div>
                  </div>
                  <div className="grp">
                    <div className="nums-one">
                      <PercentageDisplay value={am.metrics.quality.weeklyOnTrackPct} />
                    </div>
                  </div>
                  <div className="grp">
                    <div className="nums-one">
                      <PercentageDisplay value={am.metrics.quality.monthlyOnTrackPct} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderCustomerRatingContent = () => (
    <>
      {/* ======= SM Performance ======= */}
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
              <div className="metrics-grid customer-rating-grid">
                {/* CSAT Metrics */}
                <div className="metric-group csat-band">
                  <div className="period-title">YTD Avg CSAT</div>
                  <div className="grp">
                    <div className="nums-one">
                      <CSATDisplay value={selectedSM.metrics.customerRating?.ytdAvgCSAT || 0} />
                    </div>
                  </div>
                </div>
                <div className="metric-group csat-band">
                  <div className="period-title">WTD Avg CSAT</div>
                  <div className="grp">
                    <div className="nums-one">
                      <CSATDisplay value={selectedSM.metrics.customerRating?.wtdAvgCSAT || 0} />
                    </div>
                  </div>
                </div>
                <div className="metric-group csat-band">
                  <div className="period-title">Latest CSAT</div>
                  <div className="grp">
                    <div className="nums-one">
                      <CSATDisplay value={selectedSM.metrics.customerRating?.latestCSAT || 0} />
                    </div>
                  </div>
                </div>
                
                {/* NPS Metrics */}
                <div className="metric-group nps-band">
                  <div className="period-title">YTD Avg NPS</div>
                  <div className="grp">
                    <div className="nums-one">
                      <NPSDisplay value={selectedSM.metrics.customerRating?.ytdAvgNPS || 0} />
                    </div>
                  </div>
                </div>
                <div className="metric-group nps-band">
                  <div className="period-title">MTD Avg NPS</div>
                  <div className="grp">
                    <div className="nums-one">
                      <NPSDisplay value={selectedSM.metrics.customerRating?.mtdAvgNPS || 0} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======= Managers table ======= */}
      {selectedSM && managersToDisplay.length > 0 && (
        <div className="section">
          <h2 className="section-title">
            Managers {selectedManager ? `- ${selectedManager.name}` : `under ${selectedSM.name}`}
          </h2>
          <div className="card customer-rating-table">
            <div className="thead">
              <div className="h-name">
                <div className="h-title">Manager Name</div>
                <div className="h-sub">Reporting to {selectedSM.name}</div>
              </div>
              <div className="h-role"><div className="h-title">Role</div></div>
              
              {/* CSAT Columns */}
              <div className="h-group merged h-period csat-band">
                <div className="g-title">YTD Avg CSAT</div>
                <div className="g-sub g-sub-one"><span>CSAT</span></div>
              </div>
              <div className="h-group merged h-period csat-band">
                <div className="g-title">WTD Avg CSAT</div>
                <div className="g-sub g-sub-one"><span>CSAT</span></div>
              </div>
              <div className="h-group merged h-period csat-band">
                <div className="g-title">Latest CSAT</div>
                <div className="g-sub g-sub-one"><span>CSAT</span></div>
              </div>
              
              {/* NPS Columns */}
              <div className="h-group merged h-period nps-band">
                <div className="g-title">YTD Avg NPS</div>
                <div className="g-sub g-sub-one"><span>NPS</span></div>
              </div>
              <div className="h-group merged h-period nps-band">
                <div className="g-title">MTD Avg NPS</div>
                <div className="g-sub g-sub-one"><span>NPS</span></div>
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
                  
                  {/* CSAT Cells */}
                  <div className="grp csat-band">
                    <div className="nums-one">
                      <CSATDisplay value={manager.metrics.customerRating?.ytdAvgCSAT || 0} />
                    </div>
                  </div>
                  <div className="grp csat-band">
                    <div className="nums-one">
                      <CSATDisplay value={manager.metrics.customerRating?.wtdAvgCSAT || 0} />
                    </div>
                  </div>
                  <div className="grp csat-band">
                    <div className="nums-one">
                      <CSATDisplay value={manager.metrics.customerRating?.latestCSAT || 0} />
                    </div>
                  </div>
                  
                  {/* NPS Cells */}
                  <div className="grp nps-band">
                    <div className="nums-one">
                      <NPSDisplay value={manager.metrics.customerRating?.ytdAvgNPS || 0} />
                    </div>
                  </div>
                  <div className="grp nps-band">
                    <div className="nums-one">
                      <NPSDisplay value={manager.metrics.customerRating?.mtdAvgNPS || 0} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======= EMs table ======= */}
      {selectedSM && (selectedSM.ems?.length || 0) > 0 && (
        <div className="section">
          <h2 className="section-title">EMs under {selectedSM.name}</h2>
          <div className="card customer-rating-table">
            <div className="thead">
              <div className="h-name"><div className="h-title">EM Name</div><div className="h-sub">Executive Managers</div></div>
              <div className="h-role"><div className="h-title">Role</div></div>
              
              {/* CSAT Columns */}
              <div className="h-group merged h-period csat-band"><div className="g-title">YTD Avg CSAT</div><div className="g-sub g-sub-one"><span>CSAT</span></div></div>
              <div className="h-group merged h-period csat-band"><div className="g-title">WTD Avg CSAT</div><div className="g-sub g-sub-one"><span>CSAT</span></div></div>
              <div className="h-group merged h-period csat-band"><div className="g-title">Latest CSAT</div><div className="g-sub g-sub-one"><span>CSAT</span></div></div>
              
              {/* NPS Columns */}
              <div className="h-group merged h-period nps-band"><div className="g-title">YTD Avg NPS</div><div className="g-sub g-sub-one"><span>NPS</span></div></div>
              <div className="h-group merged h-period nps-band"><div className="g-title">MTD Avg NPS</div><div className="g-sub g-sub-one"><span>NPS</span></div></div>
            </div>

            <div className="tbody">
              {emsToDisplay.map((em: Leaf) => (
                <div key={em.id} className="row">
                  <div className="c-name"><span className="nm">{em.name}</span><span className="badge am">EM</span></div>
                  <div className="c-role">EM</div>
                  
                  {/* CSAT Cells */}
                  <div className="grp csat-band">
                    <div className="nums-one">
                      <CSATDisplay value={em.metrics.customerRating?.ytdAvgCSAT || 0} />
                    </div>
                  </div>
                  <div className="grp csat-band">
                    <div className="nums-one">
                      <CSATDisplay value={em.metrics.customerRating?.wtdAvgCSAT || 0} />
                    </div>
                  </div>
                  <div className="grp csat-band">
                    <div className="nums-one">
                      <CSATDisplay value={em.metrics.customerRating?.latestCSAT || 0} />
                    </div>
                  </div>
                  
                  {/* NPS Cells */}
                  <div className="grp nps-band">
                    <div className="nums-one">
                      <NPSDisplay value={em.metrics.customerRating?.ytdAvgNPS || 0} />
                    </div>
                  </div>
                  <div className="grp nps-band">
                    <div className="nums-one">
                      <NPSDisplay value={em.metrics.customerRating?.mtdAvgNPS || 0} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======= AMs/FLAP table ======= */}
      {filteredAMs.length > 0 && (
        <div className="section">
          <h2 className="section-title">
            AMs/FLAP {selectedManager ? `under ${selectedManager.name}` : `under ${selectedSM?.name}`}
          </h2>
          <div className="card customer-rating-table">
            <div className="thead">
              <div className="h-name"><div className="h-title">AM/FLAP Name</div><div className="h-sub">Team members</div></div>
              <div className="h-role"><div className="h-title">Role</div></div>
              
              {/* CSAT Columns */}
              <div className="h-group merged h-period csat-band"><div className="g-title">YTD Avg CSAT</div><div className="g-sub g-sub-one"><span>CSAT</span></div></div>
              <div className="h-group merged h-period csat-band"><div className="g-title">WTD Avg CSAT</div><div className="g-sub g-sub-one"><span>CSAT</span></div></div>
              <div className="h-group merged h-period csat-band"><div className="g-title">Latest CSAT</div><div className="g-sub g-sub-one"><span>CSAT</span></div></div>
              
              {/* NPS Columns */}
              <div className="h-group merged h-period nps-band"><div className="g-title">YTD Avg NPS</div><div className="g-sub g-sub-one"><span>NPS</span></div></div>
              <div className="h-group merged h-period nps-band"><div className="g-title">MTD Avg NPS</div><div className="g-sub g-sub-one"><span>NPS</span></div></div>
            </div>

            <div className="tbody">
              {filteredAMs.map(am => (
                <div key={am.id} className="row">
                  <div className="c-name">
                    <span className="nm">{am.name}</span>
                    <span className={`badge ${am.role === 'AM' ? 'am' : 'flap'}`}>{am.role}</span>
                  </div>
                  <div className="c-role">{am.role === 'AM' ? 'Assistant Manager' : am.role}</div>
                  
                  {/* CSAT Cells - FIXED: Use customerRating instead of quality */}
                  <div className="grp csat-band">
                    <div className="nums-one">
                      <CSATDisplay value={am.metrics.customerRating?.ytdAvgCSAT || 0} />
                    </div>
                  </div>
                  <div className="grp csat-band">
                    <div className="nums-one">
                      <CSATDisplay value={am.metrics.customerRating?.wtdAvgCSAT || 0} />
                    </div>
                  </div>
                  <div className="grp csat-band">
                    <div className="nums-one">
                      <CSATDisplay value={am.metrics.customerRating?.latestCSAT || 0} />
                    </div>
                  </div>
                  
                  {/* NPS Cells - FIXED: Use customerRating instead of quality */}
                  <div className="grp nps-band">
                    <div className="nums-one">
                      <NPSDisplay value={am.metrics.customerRating?.ytdAvgNPS || 0} />
                    </div>
                  </div>
                  <div className="grp nps-band">
                    <div className="nums-one">
                      <NPSDisplay value={am.metrics.customerRating?.mtdAvgNPS || 0} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isAuthenticated === null) {
    return (
      <div className="crm-root">
        <div className="loading-full">Checking authentication...</div>
      </div>
    );
  }
  if (!isAuthenticated) return null;

  if (loading && !refreshing) {
    return (
      <div className="crm-root">
        <aside className="crm-aside">
          <div className="brand">
            <span className="brand-main">Fitelo</span> <span className="brand-sub">SM Dashboard</span>
            <span className="zap">⚡</span>
          </div>
          <nav className="nav">
            <a className="nav-item" onClick={() => router.push('/')}><span className="i">🏠</span> Dashboard</a>
            <a className="nav-item" onClick={() => router.push('/')}><span className="i">👥</span> Revenue</a>
            <a className="nav-item active"><span className="i">✅</span> Quality</a>
            <a className="nav-item" onClick={() => router.push('/issues')}><span className="i">🛠️</span> Issues</a>
            <a className="nav-item"><span className="i">📊</span> Analytics</a>
          </nav>
          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-role">{userRole === 'admin' ? 'Administrator' : 'Senior Manager'}</div>
            <div className="user-email">{userEmail}</div>
            <button className="logout-btn" onClick={handleLogout}>⎋ Logout</button>
          </div>
        </aside>
        <section className="crm-main">
          <div className="loading">Loading quality data from Google Sheets...</div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="crm-root">
        <aside className="crm-aside">
          <div className="brand">
            <span className="brand-main">Fitelo</span> <span className="brand-sub">SM Dashboard</span>
            <span className="zap">⚡</span>
          </div>
          <nav className="nav">
            <a className="nav-item" onClick={() => router.push('/')}><span className="i">🏠</span> Dashboard</a>
            <a className="nav-item" onClick={() => router.push('/')}><span className="i">👥</span> Revenue</a>
            <a className="nav-item active"><span className="i">✅</span> Quality</a>
            <a className="nav-item" onClick={() => router.push('/issues')}><span className="i">🛠️</span> Issues</a>
            <a className="nav-item"><span className="i">📊</span> Analytics</a>
          </nav>
          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-role">{userRole === 'admin' ? 'Administrator' : 'Senior Manager'}</div>
            <div className="user-email">{userEmail}</div>
            <button className="logout-btn" onClick={handleLogout}>⎋ Logout</button>
          </div>
        </aside>
        <section className="crm-main">
          <div className="error">
            <h2>Error Loading Data</h2>
            <p>{error}</p>
            <button className="btn" onClick={() => window.location.reload()} style={{ marginTop: '16px' }}>
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
          <span className="brand-main">Fitelo</span> <span className="brand-sub">SM Dashboard</span>
          <span className="zap">⚡</span>
        </div>
        <nav className="nav">
          <a className="nav-item" onClick={() => router.push('/')}><span className="i">🏠</span> Dashboard</a>
          <a className="nav-item" onClick={() => router.push('/')}><span className="i">👥</span> Revenue</a>
          <a className="nav-item active"><span className="i">✅</span> Quality</a>
          <a className="nav-item" onClick={() => router.push('/issues')}><span className="i">🛠️</span> Issues</a>
          <a className="nav-item"><span className="i">📊</span> Analytics</a>
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
            <h1 className="title">Quality Management</h1>
            <p className="subtitle">Live quality metrics from Google Sheets</p>
          </div>
          <div className="actions">
            <button className="btn" title="Refresh" onClick={handleRefresh} disabled={refreshing}>
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
              {filterOutDirectReports(selectedSM?.children || []).map((manager: Manager) => (
                <option key={manager.id} value={manager.id}>{manager.name}</option>
              ))}
            </select>
          </div>
        </div>

        {userRole === 'sm' && (
          <div className="user-welcome">
            <h3>Welcome, {userName}</h3>
            <p>Viewing your team's quality metrics</p>
          </div>
        )}

        {/* Quality Toggle */}
        <div className="rev-toggle">
          <button
            className={`rev-pill ${activeTab === 'weightloss' ? 'active' : ''}`}
            onClick={() => setActiveTab('weightloss')}
            title="Show Weightloss metrics"
          >
            Weightloss Metrics
          </button>
          <button
            className={`rev-pill ${activeTab === 'customerRating' ? 'active' : ''}`}
            onClick={() => setActiveTab('customerRating')}
            title="Show Customer Rating metrics"
          >
            Customer Rating
          </button>
        </div>

        {/* Dynamic Content based on active tab */}
        {renderContent()}

        {data.length === 0 && !loading && (
          <div className="section">
            <div className="card">
              <div className="no-data">
                <h3>No Data Available</h3>
                <p>No quality data found in the Google Sheet.</p>
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

        /* Quality-specific styles */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        
        .customer-rating-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 20px;
        }
        
        .metric-group {
          border: 1px solid var(--line2);
          border-radius: 14px;
          padding: 14px;
          position: relative;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 1px 0 rgba(15,23,42,0.02);
          transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
        }
        
        /* Weightloss metric groups */
        .metric-group:nth-child(1) {
          border-left: 6px solid var(--acc1-br);
          background: linear-gradient(180deg, var(--acc1-bg), #ffffff);
        }
        
        .metric-group:nth-child(2) {
          border-left: 6px solid var(--acc2-br);
          background: linear-gradient(180deg, var(--acc2-bg), #ffffff);
        }
        
        .metric-group:nth-child(3) {
          border-left: 6px solid var(--acc3-br);
          background: linear-gradient(180deg, var(--acc3-bg), #ffffff);
        }
        
        /* Customer Rating bands */
        .metric-group.csat-band {
          border-left: 6px solid var(--csat-band-br);
          background: linear-gradient(180deg, var(--csat-band-bg), #ffffff);
        }
        
        .metric-group.nps-band {
          border-left: 6px solid var(--nps-band-br);
          background: linear-gradient(180deg, var(--nps-band-bg), #ffffff);
        }
        
        .metric-group:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(15,23,42,0.06);
        }
        
        .period-title {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .02em;
          color: #111827;
          margin: 0 auto 10px auto;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--line2);
        }
        
        .metric-group:nth-child(1) .period-title {
          background: rgba(22,163,74,0.06);
          border-color: var(--acc1-br);
        }
        
        .metric-group:nth-child(2) .period-title {
          background: rgba(59,130,246,0.06);
          border-color: var(--acc2-br);
        }
        
        .metric-group:nth-child(3) .period-title {
          background: rgba(139,92,246,0.06);
          border-color: var(--acc3-br);
        }
        
        .metric-group.csat-band .period-title {
          background: rgba(59,130,246,0.06);
          border-color: var(--csat-band-br);
        }
        
        .metric-group.nps-band .period-title {
          background: rgba(139,92,246,0.06);
          border-color: var(--nps-band-br);
        }
        
        .nums-one {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          align-items: center;
          justify-items: center;
        }
        
        .n-strong {
          font-weight: 800;
          font-size: 18px;
          color: #111827;
        }
        
        /* Table adjustments */
        /* Weightloss table (3 metrics) */
        .weightloss-table .thead, 
        .weightloss-table .row {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 160px repeat(3, 1fr);
        }
        
        /* Customer Rating table (5 metrics) */
        .customer-rating-table .thead, 
        .customer-rating-table .row {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 160px repeat(5, 1fr);
        }
        
        /* Band styling for headers */
        .h-group.csat-band {
          background: var(--csat-band-bg-soft);
          border-left: 4px solid var(--csat-band-br-soft);
        }
        
        .h-group.nps-band {
          background: var(--nps-band-bg-soft);
          border-left: 4px solid var(--nps-band-br-soft);
        }
        
        /* Band styling for cells */
        .grp.csat-band .n {
          background: var(--csat-band-bg-soft);
          border-color: var(--csat-band-br-soft);
        }
        
        .grp.nps-band .n {
          background: var(--nps-band-bg-soft);
          border-color: var(--nps-band-br-soft);
        }
        
        /* Percentage color coding */
        .n.pct.low {
          color: var(--low);
          border-color: #fecaca;
          background: #fff1f2;
        }
        
        .n.pct.warn {
          color: var(--warn);
          border-color: #fde68a;
          background: #fffbeb;
        }
        
        .n.pct.good {
          color: var(--good);
          border-color: #bbf7d0;
          background: #f0fdf4;
        }
        
        /* CSAT color coding */
        .n.csat.low {
          color: var(--low);
          border-color: #fecaca;
          background: #fff1f2;
        }
        
        .n.csat.warn {
          color: var(--warn);
          border-color: #fde68a;
          background: #fffbeb;
        }
        
        .n.csat.good {
          color: var(--good);
          border-color: #bbf7d0;
          background: #f0fdf4;
        }
        
        /* NPS color coding */
        .n.nps.low {
          color: var(--low);
          border-color: #fecaca;
          background: #fff1f2;
        }
        
        .n.nps.warn {
          color: var(--warn);
          border-color: #fde68a;
          background: #fffbeb;
        }
        
        .n.nps.good {
          color: var(--good);
          border-color: #bbf7d0;
          background: #f0fdf4;
        }
        
        /* No data styling */
        .n:empty:before {
          content: "—";
          color: var(--muted);
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
          
          /* Weightloss Metrics */
          --acc1-bg:#f0fdf4;
          --acc1-br:#bbf7d0;
          --acc2-bg:#eef6ff;
          --acc2-br:#cfe5ff;
          --acc3-bg:#f6f0ff;
          --acc3-br:#e4d4ff;
          --acc1-bg-soft: rgba(22,163,74,0.05);
          --acc1-br-soft: rgba(22,163,74,0.12);
          --acc2-bg-soft: rgba(59,130,246,0.05);
          --acc2-br-soft: rgba(59,130,246,0.12);
          --acc3-bg-soft: rgba(139,92,246,0.05);
          --acc3-br-soft: rgba(139,92,246,0.12);
          
          /* Customer Rating Bands */
          --csat-band-bg: #eef6ff;
          --csat-band-br: #cfe5ff;
          --nps-band-bg: #f6f0ff;
          --nps-band-br: #e4d4ff;
          --csat-band-bg-soft: rgba(59,130,246,0.05);
          --csat-band-br-soft: rgba(59,130,246,0.12);
          --nps-band-bg-soft: rgba(139,92,246,0.05);
          --nps-band-br-soft: rgba(139,92,246,0.12);
          
          --pill-bg:#f8fafc;
          --pill-br:#e5e7eb;
        }

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
        .select:disabled{background:#f9fafb;color:#6b7280}

        /* Revenue toggle */
        .rev-toggle{display:flex;gap:8px;align-items:center;margin:8px 0 4px}
        .rev-pill{background:#fff;border:1px solid var(--line);color:#0f172a;padding:8px 14px;border-radius:999px;cursor:pointer;box-shadow:0 1px 0 rgba(15,23,42,.04)}
        .rev-pill.active{background:#0f172a;color:#fff;border-color:#0f172a}

        .section{margin-top:8px}
        .section-title{font-size:16px;font-weight:600;color:#111827;margin:0 0 12px 0}

        .sm-data{padding:16px}
        .sm-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--line2)}
        .sm-name{display:flex;align-items:center;gap:10px}

        .card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
        .thead{background:linear-gradient(180deg,#ffffff,#fbfbfb);border-bottom:1px solid var(--line2)}
        .h-name,.h-role,.h-group{padding:12px;text-align:center}
        .h-title{font-size:12px;text-transform:uppercase;letter-spacing:.02em;color:#111827;font-weight:700}
        .h-sub{font-size:12px;color:#94a3b8;margin-top:2px}
        .h-group.merged{grid-column:span 1}
        .h-group .g-title{font-size:12px;text-transform:uppercase;letter-spacing:.02em;color:#111827;font-weight:700;margin-bottom:4px}
        .g-sub-one{display:flex;justify-content:center;align-items:center;text-align:center;height:100%;}

        .tbody{display:flex;flex-direction:column}
        .row{padding:12px;align-items:center;border-bottom:1px solid var(--line2);transition:background .12s ease}
        .row:hover{background:#fafbfd}

        .c-name{display:flex;align-items:center;gap:10px}
        .c-role{color:#64748b;text-align:center}
        .nm{font-weight:600}

        .grp{padding:0 10px;text-align:center}
        .n{font-weight:700;background:var(--pill-bg);border:1px solid var(--pill-br);border-radius:10px;padding:6px 8px;line-height:1.2;box-shadow:inset 0 1px 0 rgba(255,255,255,0.7)}
        .n.pct

        .badge{font-size:11px;border-radius:999px;padding:4px 10px;border:1px solid var(--line)}
        .badge.sm{background:#ecfdf5}
        .badge.m{background:#eef2ff}
        .badge.am{background:#fff7ed}
        .badge.flap{background:#fffdea}
      `}</style>
    </div>
  );
}