import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getAuthHeader } from '../utils/auth';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../i18n/LanguageContext';
import { API_BASE_URL } from '../config';
import { socket } from '../socket';
import './EquipmentPanel.css';

const STATUSES = ['Operational', 'NeedsService', 'OutOfOrder'];

/**
 * EquipmentPanel
 * The serviceable assets installed in each room. Items needing attention sort
 * to the top, and their service status can be changed inline so a worker can
 * flag a fault without leaving the list.
 */
const EquipmentPanel = ({ user, areas }) => {
    const showNotification = useNotification();
    const { t } = useLanguage();

    const [equipment, setEquipment] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState('');
    const [form, setForm] = useState({
        name: '', serial_number: '', equipment_type: '', area_id: '', installed_at: '',
    });

    const canEdit = user.role === 'admin' || user.role === 'maintenance';

    const fetchEquipment = useCallback(async () => {
        const config = getAuthHeader();
        if (!config) return;

        try {
            const query = filter ? `?status=${filter}` : '';
            const res = await axios.get(`${API_BASE_URL}/equipment${query}`, config);
            if (res.data.success) setEquipment(res.data.data);
        } catch (err) {
            console.error('Error loading equipment:', err);
        }
    }, [filter]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            await fetchEquipment();
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [fetchEquipment]);

    useEffect(() => {
        socket.on('refresh_equipment', fetchEquipment);
        return () => socket.off('refresh_equipment', fetchEquipment);
    }, [fetchEquipment]);

    const handleCreate = async (e) => {
        e.preventDefault();
        const config = getAuthHeader();
        if (!config) return;

        try {
            await axios.post(`${API_BASE_URL}/equipment`, {
                ...form,
                area_id: form.area_id || null,
                installed_at: form.installed_at || null,
            }, config);

            showNotification(t('equipment.added'), 'success');
            setForm({ name: '', serial_number: '', equipment_type: '', area_id: '', installed_at: '' });
            setShowForm(false);
            fetchEquipment();
        } catch (err) {
            console.error('Error adding equipment:', err);
            showNotification(t('equipment.addFailed'), 'error');
        }
    };

    const handleStatusChange = async (id, status) => {
        const config = getAuthHeader();
        if (!config) return;

        try {
            await axios.put(`${API_BASE_URL}/equipment/${id}`, { status }, config);
            showNotification(t('equipment.updated'), 'success');
            fetchEquipment();
        } catch (err) {
            console.error('Error updating equipment:', err);
            showNotification(t('equipment.updateFailed'), 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('common.confirmDelete'))) return;
        const config = getAuthHeader();
        if (!config) return;

        try {
            await axios.delete(`${API_BASE_URL}/equipment/${id}`, config);
            showNotification(t('equipment.deleted'), 'success');
            fetchEquipment();
        } catch (err) {
            console.error('Error deleting equipment:', err);
            showNotification(t('equipment.deleteFailed'), 'error');
        }
    };

    return (
        <div className="equipment-panel fade-in">
            <div className="equipment-header">
                <h3>🔧 {t('equipment.title')}</h3>
                <div className="equipment-header-actions">
                    <select
                        className="equipment-filter"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    >
                        <option value="">{t('equipment.allStatuses')}</option>
                        {STATUSES.map(s => (
                            <option key={s} value={s}>{t(`equipment.status.${s}`)}</option>
                        ))}
                    </select>
                    {canEdit && (
                        <button className="equipment-primary-btn" onClick={() => setShowForm(!showForm)}>
                            ➕ {t('equipment.add')}
                        </button>
                    )}
                </div>
            </div>

            {showForm && canEdit && (
                <form onSubmit={handleCreate} className="equipment-form">
                    <input required type="text" placeholder={t('equipment.name')}
                        value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    <input type="text" placeholder={t('equipment.serial')}
                        value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} />
                    <input type="text" placeholder={t('equipment.type')}
                        value={form.equipment_type} onChange={e => setForm({ ...form, equipment_type: e.target.value })} />
                    <select value={form.area_id} onChange={e => setForm({ ...form, area_id: e.target.value })}>
                        <option value="">{t('equipment.noRoom')}</option>
                        {areas.map(a => <option key={a.id} value={a.id}>{a.name || a.room}</option>)}
                    </select>
                    <input type="date" value={form.installed_at}
                        onChange={e => setForm({ ...form, installed_at: e.target.value })} />
                    <button type="submit" className="equipment-primary-btn">{t('common.save')}</button>
                </form>
            )}

            {loading ? (
                <p className="equipment-empty">{t('common.loading')}</p>
            ) : equipment.length === 0 ? (
                <p className="equipment-empty">{t('equipment.none')}</p>
            ) : (
                <div className="equipment-grid">
                    {equipment.map(item => (
                        <div key={item.id} className={`equipment-card status-${item.status.toLowerCase()}`}>
                            <div className="equipment-card-header">
                                <h4>{item.name}</h4>
                                {item.equipment_type && (
                                    <span className="equipment-type">{item.equipment_type}</span>
                                )}
                            </div>

                            <div className="equipment-meta">
                                {item.serial_number && <div>🏷️ {item.serial_number}</div>}
                                <div>📍 {item.area_name || t('equipment.noRoom')}</div>
                                {item.installed_at && (
                                    <div>📅 {new Date(item.installed_at).toLocaleDateString()}</div>
                                )}
                                {Number(item.open_missions) > 0 && (
                                    <div className="equipment-open">
                                        🧰 {item.open_missions} {t('equipment.openMissions')}
                                    </div>
                                )}
                            </div>

                            <div className="equipment-actions">
                                {canEdit ? (
                                    <select
                                        className={`equipment-status-select ${item.status.toLowerCase()}`}
                                        value={item.status}
                                        onChange={e => handleStatusChange(item.id, e.target.value)}
                                    >
                                        {STATUSES.map(s => (
                                            <option key={s} value={s}>{t(`equipment.status.${s}`)}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <span className={`equipment-status-badge ${item.status.toLowerCase()}`}>
                                        {t(`equipment.status.${item.status}`)}
                                    </span>
                                )}

                                {user.role === 'admin' && (
                                    <button className="equipment-delete-btn" onClick={() => handleDelete(item.id)}>
                                        🗑️
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EquipmentPanel;
