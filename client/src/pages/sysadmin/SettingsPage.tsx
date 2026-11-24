import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { SystemSetting } from '../../types';
import { Settings, Save, CheckCircle2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/settings');
      if (res.data.success) {
        setSettings(res.data.settings);
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value } : s))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await api.put('/system/settings', {
        settings: settings.map((s) => ({ key: s.key, value: s.value })),
      });
      if (res.data.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            System Configuration
          </h1>
          <p className="text-xs text-gov-muted">
            Global system parameters, quota allocation rules and QR format standards
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gov-blue hover:bg-gov-blueHover text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
        >
          <Save size={14} />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-[#e5f7ef] border border-green-300 text-[#117a54] p-3 rounded-lg text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 size={16} />
          <span>System configuration successfully updated and committed to central store.</span>
        </div>
      )}

      {/* Form matching prototype */}
      <form onSubmit={handleSave} className="bg-white border border-gov-line rounded-[13px] p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {settings.map((setting) => (
            <div key={setting.id} className="space-y-1">
              <label className="block text-xs font-semibold text-[#526177]">
                {setting.key.replace(/_/g, ' ')}
              </label>
              <input
                type="text"
                value={setting.value}
                onChange={(e) => handleChange(setting.key, e.target.value)}
                className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs text-gov-ink bg-white focus:outline-none focus:border-gov-blue font-medium"
              />
              {setting.description && (
                <span className="text-[10px] text-gov-muted block">{setting.description}</span>
              )}
            </div>
          ))}
        </div>
      </form>
    </div>
  );
};
