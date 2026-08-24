import { useState } from 'react';
import axios from 'axios';
import { getAuthHeader } from '../utils/auth';
import { sortStaffForArea, describeStaff } from '../utils/staffRanking';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../i18n/LanguageContext';
import { API_BASE_URL } from '../config';
import './MissionsPanel.css';

/**
 * NewMissionForm
 * Manager tool for defining a maintenance mission: which area, how often it
 * recurs, who performs it, and the subtask checklist to be completed on site.
 */
const NewMissionForm = ({ areas, staff, onClose, onCreated }) => {
    const showNotification = useNotification();
    const { t } = useLanguage();

    const [form, setForm] = useState({
        area_id: '',
        title: '',
        description: '',
        frequency_days: 30,
        scheduled_date: new Date().toISOString().slice(0, 10),
        assigned_to: '',
    });
    const [subtasks, setSubtasks] = useState(['']);
    const [saving, setSaving] = useState(false);

    // Drives the "in area" ranking as soon as a room is picked
    const selectedRoom = areas.find(a => String(a.id) === String(form.area_id));
    const selectedRoomName = selectedRoom?.name || selectedRoom?.room || '';

    const updateSubtask = (index, value) => {
        setSubtasks(prev => prev.map((s, i) => (i === index ? value : s)));
    };

    const removeSubtask = (index) => {
        setSubtasks(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const config = getAuthHeader();
        if (!config) {
            showNotification('Session expired. Please log in again.', 'error');
            return;
        }

        const cleanSubtasks = subtasks.map(s => s.trim()).filter(Boolean);

        setSaving(true);
        try {
            await axios.post(`${API_BASE_URL}/missions`, {
                ...form,
                assigned_to: form.assigned_to || null,
                subtasks: cleanSubtasks,
            }, config);

            showNotification('Mission created.', 'success');
            onCreated();
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to create mission.';
            showNotification(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mission-form-overlay" onClick={onClose}>
            <div className="mission-form-card" onClick={(e) => e.stopPropagation()}>
                <h4>{t('missions.new')}</h4>

                <form onSubmit={handleSubmit} className="mission-form">
                    <label>
                        {t('missions.room')}
                        <select
                            required
                            value={form.area_id}
                            onChange={e => setForm({ ...form, area_id: e.target.value })}
                        >
                            <option value="">—</option>
                            {areas.map(a => (
                                <option key={a.id} value={a.id}>{a.name || a.room}</option>
                            ))}
                        </select>
                    </label>

                    <label>
                        {t('missions.title.field')}
                        <input
                            required
                            type="text"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                        />
                    </label>

                    <label>
                        {t('missions.description')}
                        <textarea
                            rows="2"
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                        />
                    </label>

                    <div className="mission-form-row">
                        <label>
                            {t('missions.date')}
                            <input
                                required
                                type="date"
                                value={form.scheduled_date}
                                onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                            />
                        </label>

                        <label>
                            {t('missions.frequency')}
                            <input
                                type="number"
                                min="1"
                                value={form.frequency_days}
                                onChange={e => setForm({ ...form, frequency_days: parseInt(e.target.value) || 1 })}
                            />
                        </label>
                    </div>

                    <label>
                        {t('missions.assignTo')}
                        <select
                            value={form.assigned_to}
                            onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                        >
                            <option value="">{t('missions.unassigned')}</option>
                            {sortStaffForArea(staff, selectedRoomName).map(s => (
                                <option key={s.id} value={s.id}>
                                    {describeStaff(s, selectedRoomName)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="subtask-editor">
                        <span className="subtask-editor-label">{t('missions.subtasks')}</span>
                        {subtasks.map((st, i) => (
                            <div key={i} className="subtask-editor-row">
                                <input
                                    type="text"
                                    placeholder={t('missions.subtaskPlaceholder')}
                                    value={st}
                                    onChange={e => updateSubtask(i, e.target.value)}
                                />
                                {subtasks.length > 1 && (
                                    <button type="button" className="subtask-remove" onClick={() => removeSubtask(i)}>
                                        ✖
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            type="button"
                            className="mission-secondary-btn"
                            onClick={() => setSubtasks([...subtasks, ''])}
                        >
                            ➕ {t('missions.addSubtask')}
                        </button>
                    </div>

                    <div className="mission-form-actions">
                        <button type="button" className="mission-secondary-btn" onClick={onClose}>
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className="mission-primary-btn" disabled={saving}>
                            {saving ? t('common.loading') : t('missions.create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewMissionForm;
