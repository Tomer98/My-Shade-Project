import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getAuthHeader } from '../utils/auth';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../i18n/LanguageContext';
import { API_BASE_URL } from '../config';
import { socket } from '../socket';
import './GuidesPanel.css';

/**
 * Star rating control. Read-only when the viewer can't rate.
 */
const StarRating = ({ value, onRate }) => (
    <span className="star-rating">
        {[1, 2, 3, 4, 5].map(n => (
            <button
                key={n}
                type="button"
                className={`star ${n <= Math.round(value) ? 'filled' : ''}`}
                onClick={() => onRate?.(n)}
                disabled={!onRate}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
            >
                ★
            </button>
        ))}
    </span>
);

/**
 * GuidesPanel
 * Knowledge base: any user can author a guide, which stays Pending until a
 * manager/admin approves it. Approved guides are ordered by average rating.
 */
const GuidesPanel = ({ user }) => {
    const showNotification = useNotification();
    const { t } = useLanguage();

    const [guides, setGuides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ title: '', content: '' });
    const [media, setMedia] = useState(null);
    const [saving, setSaving] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    const isReviewer = user.role === 'admin' || user.role === 'maintenance';

    const fetchGuides = useCallback(async () => {
        const config = getAuthHeader();
        if (!config) return;

        try {
            const res = await axios.get(`${API_BASE_URL}/guides`, config);
            if (res.data.success) setGuides(res.data.data);
        } catch (err) {
            console.error('Error loading guides:', err);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            await fetchGuides();
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [fetchGuides]);

    useEffect(() => {
        socket.on('refresh_guides', fetchGuides);
        return () => socket.off('refresh_guides', fetchGuides);
    }, [fetchGuides]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const config = getAuthHeader();
        if (!config) {
            showNotification('Session expired. Please log in again.', 'error');
            return;
        }

        setSaving(true);
        try {
            const body = new FormData();
            body.append('title', form.title);
            body.append('content', form.content);
            if (media) body.append('media', media);

            await axios.post(`${API_BASE_URL}/guides`, body, {
                headers: { ...config.headers, 'Content-Type': 'multipart/form-data' }
            });

            showNotification('Guide submitted for approval.', 'success');
            setForm({ title: '', content: '' });
            setMedia(null);
            setShowForm(false);
            fetchGuides();
        } catch (err) {
            console.error('Error submitting guide:', err);
            showNotification('Failed to submit guide.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleReview = async (id, status) => {
        const config = getAuthHeader();
        if (!config) return;

        try {
            await axios.put(`${API_BASE_URL}/guides/${id}/review`, { status }, config);
            showNotification(`Guide ${status.toLowerCase()}.`, 'success');
            fetchGuides();
        } catch (err) {
            console.error('Error reviewing guide:', err);
            showNotification('Failed to update guide.', 'error');
        }
    };

    const handleRate = async (id, rating) => {
        const config = getAuthHeader();
        if (!config) return;

        try {
            await axios.post(`${API_BASE_URL}/guides/${id}/rate`, { rating }, config);
            showNotification('Rating saved.', 'success');
            fetchGuides();
        } catch (err) {
            console.error('Error rating guide:', err);
            showNotification('Failed to save rating.', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('common.confirmDelete'))) return;
        const config = getAuthHeader();
        if (!config) return;

        try {
            await axios.delete(`${API_BASE_URL}/guides/${id}`, config);
            showNotification('Guide deleted.', 'success');
            fetchGuides();
        } catch (err) {
            console.error('Error deleting guide:', err);
            showNotification('Failed to delete guide.', 'error');
        }
    };

    return (
        <div className="guides-panel fade-in">
            <div className="guides-header">
                <h3>📚 {t('guides.title')}</h3>
                <button className="guide-primary-btn" onClick={() => setShowForm(!showForm)}>
                    ✍️ {t('guides.new')}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="guide-form">
                    <input
                        required
                        type="text"
                        placeholder={t('guides.titleField')}
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                    />
                    <textarea
                        rows="4"
                        placeholder={t('guides.content')}
                        value={form.content}
                        onChange={e => setForm({ ...form, content: e.target.value })}
                    />
                    <label className="guide-file-label">
                        📎 {t('guides.attach')}
                        <input
                            type="file"
                            accept="image/*,video/*"
                            onChange={e => setMedia(e.target.files?.[0] || null)}
                        />
                    </label>
                    {media && <span className="guide-file-name">{media.name}</span>}

                    <div className="guide-form-actions">
                        <button type="button" className="guide-secondary-btn" onClick={() => setShowForm(false)}>
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className="guide-primary-btn" disabled={saving}>
                            {saving ? t('common.loading') : t('guides.submit')}
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <p className="guides-empty">{t('common.loading')}</p>
            ) : guides.length === 0 ? (
                <p className="guides-empty">{t('guides.none')}</p>
            ) : (
                <div className="guides-grid">
                    {guides.map(guide => {
                        const isExpanded = expandedId === guide.id;
                        const canDelete = user.role === 'admin' || guide.author_id === user.id;

                        return (
                            <div key={guide.id} className={`guide-card ${guide.status !== 'Approved' ? 'unapproved' : ''}`}>
                                <div className="guide-card-header">
                                    <h4 onClick={() => setExpandedId(isExpanded ? null : guide.id)}>
                                        {guide.title}
                                    </h4>
                                    {guide.status !== 'Approved' && (
                                        <span className={`guide-status ${guide.status.toLowerCase()}`}>
                                            {guide.status === 'Pending' ? t('guides.pending') : guide.status}
                                        </span>
                                    )}
                                </div>

                                <div className="guide-meta">
                                    {t('guides.by')} {guide.author_name || '—'}
                                    <span className="guide-sep">•</span>
                                    <StarRating
                                        value={Number(guide.avg_rating) || 0}
                                        onRate={guide.status === 'Approved' ? (n) => handleRate(guide.id, n) : null}
                                    />
                                    <span className="guide-rating-count">
                                        ({guide.rating_count} {t('guides.ratings')})
                                    </span>
                                </div>

                                {isExpanded && (
                                    <div className="guide-body">
                                        {guide.content && <p>{guide.content}</p>}
                                        {guide.media_path && (
                                            <a href={guide.media_path} target="_blank" rel="noopener noreferrer">
                                                🖼️ View attachment
                                            </a>
                                        )}
                                    </div>
                                )}

                                <div className="guide-actions">
                                    {isReviewer && guide.status === 'Pending' && (
                                        <>
                                            <button className="guide-approve-btn" onClick={() => handleReview(guide.id, 'Approved')}>
                                                ✅ {t('guides.approve')}
                                            </button>
                                            <button className="guide-reject-btn" onClick={() => handleReview(guide.id, 'Rejected')}>
                                                ✖ {t('guides.reject')}
                                            </button>
                                        </>
                                    )}
                                    {canDelete && (
                                        <button className="guide-delete-btn" onClick={() => handleDelete(guide.id)}>
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default GuidesPanel;
