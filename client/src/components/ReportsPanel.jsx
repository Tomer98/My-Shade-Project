import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getAuthHeader } from '../utils/auth';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../i18n/LanguageContext';
import { API_BASE_URL } from '../config';
import './ReportsPanel.css';

// Categorical palette, kept consistent between the charts and the status chips
const PRIORITY_COLORS = {
    Low: '#3498db', Medium: '#f1c40f', High: '#e67e22', Critical: '#e74c3c',
};
const EQUIPMENT_COLORS = {
    Operational: '#27ae60', NeedsService: '#f39c12', OutOfOrder: '#e74c3c',
};

/**
 * Formats a Date as the YYYY-MM-DD the report endpoints expect.
 */
const isoDate = (date) => date.toISOString().slice(0, 10);

// Computed once when the module loads rather than on every render, so the
// default window stays stable across re-renders.
const DEFAULT_RANGE = {
    from: isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    to: isoDate(new Date()),
};

/**
 * ReportsPanel
 * The manager's "database questioning": aggregate views over maintenance
 * activity for a chosen window, plus the underlying mission rows.
 */
const ReportsPanel = () => {
    const showNotification = useNotification();
    const { t } = useLanguage();

    const [range, setRange] = useState(DEFAULT_RANGE);
    const [summary, setSummary] = useState(null);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showRows, setShowRows] = useState(false);

    const fetchReport = useCallback(async () => {
        const config = getAuthHeader();
        if (!config) return;

        try {
            const query = `?from=${range.from}&to=${range.to}`;
            const [summaryRes, rowsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/reports/summary${query}`, config),
                axios.get(`${API_BASE_URL}/reports/missions${query}`, config),
            ]);
            if (summaryRes.data.success) setSummary(summaryRes.data.data);
            if (rowsRes.data.success) setRows(rowsRes.data.data);
        } catch (err) {
            console.error('Error loading report:', err);
            showNotification(t('reports.failed'), 'error');
        }
    }, [range, showNotification, t]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            await fetchReport();
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [fetchReport]);

    /**
     * Downloads the mission rows as CSV. Values are quoted and internal quotes
     * doubled so commas in a title cannot break the columns.
     */
    const exportCsv = () => {
        if (rows.length === 0) return;

        const headers = ['id', 'title', 'status', 'area_name', 'assignee',
                         'equipment_name', 'scheduled_date', 'completed_at',
                         'subtasks', 'subtasks_done'];
        const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

        const csv = [
            headers.join(','),
            ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `missions-${range.from}-to-${range.to}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (loading) return <div className="reports-panel fade-in"><p className="reports-empty">{t('common.loading')}</p></div>;
    if (!summary) return <div className="reports-panel fade-in"><p className="reports-empty">{t('reports.failed')}</p></div>;

    const workerData = summary.byWorker.map(w => ({
        name: w.username,
        completed: Number(w.completed) || 0,
        failed: Number(w.failed) || 0,
    }));

    const areaData = summary.byArea
        .filter(a => Number(a.missions) > 0)
        .map(a => ({ name: a.area_name, missions: Number(a.missions) }));

    return (
        <div className="reports-panel fade-in">
            <div className="reports-header">
                <h3>📊 {t('reports.title')}</h3>
                <div className="reports-controls">
                    <label>
                        {t('reports.from')}
                        <input type="date" value={range.from}
                            onChange={e => setRange({ ...range, from: e.target.value })} />
                    </label>
                    <label>
                        {t('reports.to')}
                        <input type="date" value={range.to}
                            onChange={e => setRange({ ...range, to: e.target.value })} />
                    </label>
                    <button className="reports-btn" onClick={exportCsv} disabled={rows.length === 0}>
                        ⬇ {t('reports.export')}
                    </button>
                </div>
            </div>

            {/* Headline figures */}
            <div className="reports-stats">
                <div className="stat-tile">
                    <span className="stat-value">{summary.missions.total}</span>
                    <span className="stat-label">{t('reports.totalMissions')}</span>
                </div>
                <div className="stat-tile good">
                    <span className="stat-value">{summary.missions.Completed || 0}</span>
                    <span className="stat-label">{t('reports.completed')}</span>
                </div>
                <div className="stat-tile bad">
                    <span className="stat-value">{summary.missions.Failed || 0}</span>
                    <span className="stat-label">{t('reports.failedMissions')}</span>
                </div>
                <div className="stat-tile">
                    <span className="stat-value">
                        {summary.missions.completionRate === null ? '—' : `${summary.missions.completionRate}%`}
                    </span>
                    <span className="stat-label">{t('reports.completionRate')}</span>
                </div>
            </div>

            <div className="reports-grid">
                {/* Workload and reliability per worker */}
                <div className="report-card">
                    <h4>{t('reports.byWorker')}</h4>
                    {workerData.length === 0 ? (
                        <p className="reports-empty">{t('reports.noData')}</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={workerData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="completed" stackId="a" fill="#27ae60" name={t('reports.completed')} />
                                <Bar dataKey="failed" stackId="a" fill="#e74c3c" name={t('reports.failedMissions')} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Which rooms consume the most maintenance */}
                <div className="report-card">
                    <h4>{t('reports.byArea')}</h4>
                    {areaData.length === 0 ? (
                        <p className="reports-empty">{t('reports.noData')}</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={areaData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="missions" fill="#2980b9" />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Equipment condition right now */}
                <div className="report-card">
                    <h4>{t('reports.equipment')}</h4>
                    {summary.equipmentByStatus.length === 0 ? (
                        <p className="reports-empty">{t('reports.noData')}</p>
                    ) : (
                        <ul className="report-list">
                            {summary.equipmentByStatus.map(e => (
                                <li key={e.status}>
                                    <span className="dot" style={{ background: EQUIPMENT_COLORS[e.status] }} />
                                    {t(`equipment.status.${e.status}`)}
                                    <strong>{e.count}</strong>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Reported issues by severity */}
                <div className="report-card">
                    <h4>{t('reports.alerts')}</h4>
                    {summary.alertsByPriority.length === 0 ? (
                        <p className="reports-empty">{t('reports.noData')}</p>
                    ) : (
                        <ul className="report-list">
                            {summary.alertsByPriority.map(a => (
                                <li key={a.priority}>
                                    <span className="dot" style={{ background: PRIORITY_COLORS[a.priority] }} />
                                    {a.priority}
                                    <strong>{a.count}</strong>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Subtasks that keep failing — the recurring blockers */}
                <div className="report-card wide">
                    <h4>{t('reports.blockers')}</h4>
                    {summary.topBlockers.length === 0 ? (
                        <p className="reports-empty">{t('reports.noBlockers')}</p>
                    ) : (
                        <ul className="report-list">
                            {summary.topBlockers.map((b, i) => (
                                <li key={i}>
                                    <span className="dot" style={{ background: '#e74c3c' }} />
                                    {b.title}
                                    <strong>{b.failures}×</strong>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* The underlying rows behind the aggregates */}
            <div className="report-card">
                <div className="report-rows-header">
                    <h4>{t('reports.rows')} ({rows.length})</h4>
                    <button className="reports-btn subtle" onClick={() => setShowRows(!showRows)}>
                        {showRows ? t('reports.hide') : t('reports.show')}
                    </button>
                </div>

                {showRows && (
                    <div className="report-table-wrapper">
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>{t('reports.col.title')}</th>
                                    <th>{t('reports.col.room')}</th>
                                    <th>{t('reports.col.assignee')}</th>
                                    <th>{t('reports.col.status')}</th>
                                    <th>{t('reports.col.progress')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.id}>
                                        <td>{r.id}</td>
                                        <td>{r.title}</td>
                                        <td>{r.area_name}</td>
                                        <td>{r.assignee || '—'}</td>
                                        <td>
                                            <span className={`row-status ${r.status.toLowerCase()}`}>{r.status}</span>
                                        </td>
                                        <td>{Number(r.subtasks_done) || 0}/{r.subtasks}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportsPanel;
