import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getAuthHeader } from '../utils/auth';
import { sortStaffForArea, describeStaff } from '../utils/staffRanking';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../i18n/LanguageContext';
import { API_BASE_URL } from '../config';
import { socket } from '../socket';
import MissionDetail from './MissionDetail';
import NewMissionForm from './NewMissionForm';
import './MissionsPanel.css';

/**
 * MissionsPanel
 * Worker view: today's missions in scheduled order, with a "start first mission"
 * entry point and a Close Day action.
 * Manager view: additionally shows failed missions for reassignment and a form
 * to create new missions.
 */
const MissionsPanel = ({ user, areas }) => {
    const showNotification = useNotification();
    const { t } = useLanguage();

    const [missions, setMissions] = useState([]);
    const [failedMissions, setFailedMissions] = useState([]);
    const [staff, setStaff] = useState([]);
    const [activeMission, setActiveMission] = useState(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [showFailed, setShowFailed] = useState(false);
    const [loading, setLoading] = useState(true);

    const isManager = user.role === 'admin' || user.role === 'maintenance';

    const fetchMissions = useCallback(async () => {
        const config = getAuthHeader();
        if (!config) return;

        try {
            const res = await axios.get(`${API_BASE_URL}/missions?scope=today`, config);
            if (res.data.success) setMissions(res.data.data);
        } catch (err) {
            console.error('Error loading missions:', err);
        }
    }, []);

    const fetchFailed = useCallback(async () => {
        if (!isManager) return;
        const config = getAuthHeader();
        if (!config) return;

        try {
            const res = await axios.get(`${API_BASE_URL}/missions?status=Failed`, config);
            if (res.data.success) setFailedMissions(res.data.data);
        } catch (err) {
            console.error('Error loading failed missions:', err);
        }
    }, [isManager]);

    const fetchStaff = useCallback(async () => {
        if (user.role !== 'admin') return;
        const config = getAuthHeader();
        if (!config) return;

        try {
            const res = await axios.get(`${API_BASE_URL}/users`, config);
            if (res.data.success) {
                setStaff(res.data.data.filter(u => u.role === 'maintenance' || u.role === 'admin'));
            }
        } catch (err) {
            console.error('Error loading staff:', err);
        }
    }, [user.role]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            await Promise.all([fetchMissions(), fetchFailed(), fetchStaff()]);
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [fetchMissions, fetchFailed, fetchStaff]);

    // Keep the list live when another user completes or assigns work
    useEffect(() => {
        const refresh = () => { fetchMissions(); fetchFailed(); };
        socket.on('refresh_missions', refresh);
        return () => socket.off('refresh_missions', refresh);
    }, [fetchMissions, fetchFailed]);

    const handleCloseDay = async () => {
        if (!window.confirm(t('missions.closeDayConfirm'))) return;

        const config = getAuthHeader();
        if (!config) return;

        try {
            const res = await axios.post(`${API_BASE_URL}/missions/close-day`, {}, config);
            showNotification(res.data.message, 'success');
            fetchMissions();
        } catch (err) {
            console.error('Error closing day:', err);
            showNotification('Failed to close the day.', 'error');
        }
    };

    const handleAssign = async (missionId, userId) => {
        const config = getAuthHeader();
        if (!config || !userId) return;

        try {
            await axios.put(`${API_BASE_URL}/missions/${missionId}/assign`, { assigned_to: userId }, config);
            showNotification('Mission assigned.', 'success');
            fetchMissions();
            fetchFailed();
        } catch (err) {
            console.error('Error assigning mission:', err);
            showNotification('Failed to assign mission.', 'error');
        }
    };

    // Drilled into a single mission — show its checklist instead of the list
    if (activeMission) {
        return (
            <MissionDetail
                mission={activeMission}
                user={user}
                onBack={() => { setActiveMission(null); fetchMissions(); fetchFailed(); }}
                onChanged={() => { fetchMissions(); fetchFailed(); }}
            />
        );
    }

    const listToShow = showFailed ? failedMissions : missions;

    return (
        <div className="missions-panel fade-in">
            <div className="missions-header">
                <h3>{showFailed ? t('missions.failed') : t('missions.title')}</h3>
                <div className="missions-header-actions">
                    {isManager && (
                        <button
                            className={`mission-tab-btn ${showFailed ? 'active' : ''}`}
                            onClick={() => setShowFailed(!showFailed)}
                        >
                            ⚠️ {t('missions.failed')} ({failedMissions.length})
                        </button>
                    )}
                    {isManager && (
                        <button className="mission-primary-btn" onClick={() => setShowNewForm(true)}>
                            ➕ {t('missions.new')}
                        </button>
                    )}
                    {!showFailed && missions.length > 0 && (
                        <button className="mission-secondary-btn" onClick={handleCloseDay}>
                            🌙 {t('missions.closeDay')}
                        </button>
                    )}
                </div>
            </div>

            {showNewForm && (
                <NewMissionForm
                    areas={areas}
                    staff={staff}
                    onClose={() => setShowNewForm(false)}
                    onCreated={() => { setShowNewForm(false); fetchMissions(); }}
                />
            )}

            {loading ? (
                <p className="missions-empty">{t('common.loading')}</p>
            ) : listToShow.length === 0 ? (
                <p className="missions-empty">{t('missions.none')}</p>
            ) : (
                <>
                    {!showFailed && (
                        <button className="start-first-btn" onClick={() => setActiveMission(listToShow[0])}>
                            ▶ {t('missions.start')}
                        </button>
                    )}

                    <ul className="missions-list">
                        {listToShow.map((mission, index) => {
                            const done = mission.subtasks.filter(s => s.status === 'Done').length;
                            const total = mission.subtasks.length;

                            return (
                                <li
                                    key={mission.id}
                                    className={`mission-card status-${mission.status.toLowerCase()}`}
                                    onClick={() => setActiveMission(mission)}
                                >
                                    <div className="mission-card-index">{index + 1}</div>
                                    <div className="mission-card-body">
                                        <div className="mission-card-title">{mission.title}</div>
                                        <div className="mission-card-meta">
                                            📍 {mission.room_name}
                                            <span className="mission-card-sep">•</span>
                                            {t('missions.scheduled')}: {new Date(mission.scheduled_date).toLocaleDateString()}
                                            <span className="mission-card-sep">•</span>
                                            {mission.assigned_to_name
                                                ? `${t('missions.assignedTo')}: ${mission.assigned_to_name}`
                                                : t('missions.unassigned')}
                                        </div>
                                        {total > 0 && (
                                            <div className="mission-progress">
                                                <div
                                                    className="mission-progress-fill"
                                                    style={{ width: `${(done / total) * 100}%` }}
                                                />
                                                <span className="mission-progress-label">{done}/{total}</span>
                                            </div>
                                        )}
                                    </div>

                                    {user.role === 'admin' && (
                                        <select
                                            className="mission-assign-select"
                                            value={mission.assigned_to || ''}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => handleAssign(mission.id, e.target.value)}
                                        >
                                            <option value="" disabled>{t('missions.assignTo')}</option>
                                            {sortStaffForArea(staff, mission.room_name).map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {describeStaff(s, mission.room_name)}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </div>
    );
};

export default MissionsPanel;
