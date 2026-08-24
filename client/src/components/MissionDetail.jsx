import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { getAuthHeader } from '../utils/auth';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../i18n/LanguageContext';
import { API_BASE_URL } from '../config';
import './MissionsPanel.css';

/**
 * MissionDetail
 * The working view for a single mission: the subtask checklist where each item
 * is marked Done or Failed (a failure requires an explanation and may carry a
 * photo), plus the location's visit history and GPS navigation to the site.
 */
const MissionDetail = ({ mission, user, onBack, onChanged }) => {
    const showNotification = useNotification();
    const { t } = useLanguage();

    const [subtasks, setSubtasks] = useState(mission.subtasks || []);
    const [history, setHistory] = useState([]);
    const [busyId, setBusyId] = useState(null);
    const [finishing, setFinishing] = useState(false);

    // Tracks which subtask a chosen photo belongs to
    const photoInputRef = useRef(null);
    const pendingPhotoSubtask = useRef(null);

    const fetchHistory = useCallback(async () => {
        const config = getAuthHeader();
        if (!config) return;
        try {
            const res = await axios.get(`${API_BASE_URL}/missions/history/${mission.area_id}`, config);
            if (res.data.success) setHistory(res.data.data);
        } catch (err) {
            console.error('Error loading location history:', err);
        }
    }, [mission.area_id]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    /**
     * Persist a subtask's outcome. `photo` is optional and sent as multipart
     * so the server can push it to object storage.
     */
    const saveSubtask = async (subtaskId, status, comment, photo) => {
        const config = getAuthHeader();
        if (!config) {
            showNotification('Session expired. Please log in again.', 'error');
            return;
        }

        setBusyId(subtaskId);
        try {
            let body;
            let headers = { ...config.headers };

            if (photo) {
                body = new FormData();
                body.append('status', status);
                if (comment) body.append('comment', comment);
                body.append('photo', photo);
                headers['Content-Type'] = 'multipart/form-data';
            } else {
                body = { status, comment };
            }

            const res = await axios.put(`${API_BASE_URL}/missions/subtasks/${subtaskId}`, body, { headers });

            setSubtasks(prev => prev.map(s =>
                s.id === subtaskId
                    ? {
                        ...s,
                        status,
                        comment: comment ?? s.comment,
                        // Show the new photo straight away rather than waiting for a refetch
                        photo_path: res.data?.photoPath ?? s.photo_path,
                    }
                    : s
            ));
            if (onChanged) onChanged();
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to update subtask.';
            showNotification(msg, 'error');
        } finally {
            setBusyId(null);
        }
    };

    const handleMarkDone = (subtask) => saveSubtask(subtask.id, 'Done', null, null);

    const handleMarkFailed = (subtask) => {
        // The spec requires a written reason whenever a subtask can't be done
        const reason = window.prompt(t('missions.commentPrompt'));
        if (!reason) return;
        saveSubtask(subtask.id, 'Failed', reason, null);
    };

    const handlePhotoClick = (subtask) => {
        pendingPhotoSubtask.current = subtask;
        photoInputRef.current?.click();
    };

    const handlePhotoSelected = async (e) => {
        const file = e.target.files?.[0];
        const subtask = pendingPhotoSubtask.current;
        e.target.value = '';
        if (!file || !subtask) return;

        await saveSubtask(subtask.id, subtask.status === 'Pending' ? 'Done' : subtask.status, subtask.comment, file);
        showNotification('Photo attached.', 'success');
    };

    // A room only has a real destination once an admin has recorded its GPS position
    const hasGps = Number.isFinite(Number(mission.latitude)) && Number.isFinite(Number(mission.longitude))
        && mission.latitude !== null && mission.longitude !== null;

    /**
     * Open turn-by-turn navigation to the site.
     *
     * Deliberately synchronous: mobile browsers only honour window.open during
     * the click itself, so opening it from inside an async geolocation callback
     * gets swallowed by the popup blocker. Google Maps already routes from the
     * device's current location when no origin is given, so asking for the
     * position ourselves would add a permission prompt and buy nothing.
     */
    const handleNavigate = () => {
        if (!hasGps) {
            showNotification(
                'This room has no GPS location yet. An admin can set it from the room dashboard.',
                'error'
            );
            return;
        }

        const destination = `${mission.latitude},${mission.longitude}`;
        window.open(
            `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
            '_blank',
            'noopener'
        );
    };

    const handleFinish = async () => {
        const config = getAuthHeader();
        if (!config) return;

        setFinishing(true);
        try {
            const res = await axios.put(`${API_BASE_URL}/missions/${mission.id}/complete`, {}, config);
            showNotification(res.data.message, res.data.status === 'Completed' ? 'success' : 'info');
            if (onChanged) onChanged();
            onBack();
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to finish mission.';
            showNotification(msg, 'error');
        } finally {
            setFinishing(false);
        }
    };

    const allResolved = subtasks.length > 0 && subtasks.every(s => s.status !== 'Pending');
    const canWork = user.role !== 'planner';

    return (
        <div className="mission-detail fade-in">
            <div className="mission-detail-header">
                <button className="mission-secondary-btn" onClick={onBack}>← {t('common.back')}</button>
                <h3>{mission.title}</h3>
                <button
                    className="mission-secondary-btn"
                    onClick={handleNavigate}
                    disabled={!hasGps}
                    title={hasGps ? '' : 'No GPS location set for this room'}
                >
                    🧭 {t('missions.navigate')}
                </button>
            </div>

            <div className="mission-detail-meta">
                📍 <strong>{mission.room_name}</strong>
                <span className="mission-card-sep">•</span>
                {t('missions.scheduled')}: {new Date(mission.scheduled_date).toLocaleDateString()}
                {mission.description && <p className="mission-detail-desc">{mission.description}</p>}
            </div>

            <div className="mission-detail-grid">
                {/* Checklist */}
                <div className="mission-subtasks-card">
                    <h4>{t('missions.subtasks')}</h4>

                    {subtasks.length === 0 ? (
                        <p className="missions-empty">—</p>
                    ) : (
                        <ul className="subtask-list">
                            {subtasks.map(st => (
                                <li key={st.id} className={`subtask-item subtask-${st.status.toLowerCase()}`}>
                                    <div className="subtask-main">
                                        <span className="subtask-status-icon">
                                            {st.status === 'Done' ? '✅' : st.status === 'Failed' ? '❌' : '⬜'}
                                        </span>
                                        <span className="subtask-title">{st.title}</span>
                                    </div>

                                    {st.comment && (
                                        <div className="subtask-comment">💬 {st.comment}</div>
                                    )}

                                    {st.photo_path && (
                                        <a
                                            className="subtask-photo"
                                            href={st.photo_path}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Open full size"
                                        >
                                            <img src={st.photo_path} alt={`Evidence for ${st.title}`} />
                                        </a>
                                    )}

                                    {canWork && mission.status !== 'Completed' && (
                                        <div className="subtask-actions">
                                            <button
                                                className="subtask-btn done"
                                                disabled={busyId === st.id}
                                                onClick={() => handleMarkDone(st)}
                                                title={t('missions.markDone')}
                                            >
                                                ✓
                                            </button>
                                            <button
                                                className="subtask-btn failed"
                                                disabled={busyId === st.id}
                                                onClick={() => handleMarkFailed(st)}
                                                title={t('missions.markFailed')}
                                            >
                                                ✗
                                            </button>
                                            <button
                                                className="subtask-btn photo"
                                                disabled={busyId === st.id}
                                                onClick={() => handlePhotoClick(st)}
                                                title={t('missions.addPhoto')}
                                            >
                                                📷
                                            </button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}

                    {canWork && mission.status !== 'Completed' && (
                        <button
                            className="mission-primary-btn finish-btn"
                            onClick={handleFinish}
                            disabled={!allResolved || finishing}
                            title={!allResolved ? 'Mark every subtask first' : ''}
                        >
                            {finishing ? t('common.loading') : `🏁 ${t('missions.finish')}`}
                        </button>
                    )}
                </div>

                {/* Location history */}
                <div className="mission-history-card">
                    <h4>{t('missions.history')}</h4>
                    {history.length === 0 ? (
                        <p className="missions-empty">{t('missions.noHistory')}</p>
                    ) : (
                        <ul className="history-list">
                            {history.map(h => (
                                <li key={h.id} className="history-item">
                                    <div className="history-row">
                                        <span className={`history-badge ${h.status.toLowerCase()}`}>{h.status}</span>
                                        <span className="history-date">
                                            {h.completed_at ? new Date(h.completed_at).toLocaleString() : '—'}
                                        </span>
                                    </div>
                                    <div className="history-user">👤 {h.performed_by || 'Unknown'}</div>
                                    {h.notes?.map((n, i) => (
                                        <div key={i} className="history-note">
                                            {n.comment && <div>💬 {n.title}: {n.comment}</div>}
                                            {n.photo_path && (
                                                <a href={n.photo_path} target="_blank" rel="noopener noreferrer">
                                                    🖼️ Photo
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* `capture` hints mobile browsers to offer the camera directly */}
            <input
                type="file"
                ref={photoInputRef}
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handlePhotoSelected}
            />
        </div>
    );
};

export default MissionDetail;
