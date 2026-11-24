import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { User, FuelStation } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Plus, UserPlus, KeyRound, RefreshCw, X, AlertCircle } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Create Form State
  const [createData, setCreateData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'AGRICULTURE_OFFICE',
    fuelStationId: '',
  });

  const [newPassword, setNewPassword] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resUsers, resStations] = await Promise.all([
        api.get('/system/users'),
        api.get('/meta/stations'),
      ]);

      if (resUsers.data.success) setUsers(resUsers.data.users);
      if (resStations.data.success) {
        setStations(resStations.data.stations);
        if (resStations.data.stations.length > 0) {
          setCreateData((prev) => ({ ...prev, fuelStationId: resStations.data.stations[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setModalError(null);

    try {
      const res = await api.post('/system/users', {
        ...createData,
        fuelStationId: createData.role === 'STATION_ADMIN' ? createData.fuelStationId : null,
      });

      if (res.data.success) {
        setShowCreateModal(false);
        fetchData();
      }
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setFormLoading(true);
    setModalError(null);

    try {
      const res = await api.post(`/system/users/${selectedUser.id}/reset-password`, {
        newPassword,
      });

      if (res.data.success) {
        setShowResetModal(false);
        setNewPassword('');
        alert('Password reset successfully!');
      }
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleUserStatus = async (userToToggle: any) => {
    try {
      await api.put(`/system/users/${userToToggle.id}`, {
        fullName: userToToggle.fullName,
        email: userToToggle.email,
        role: userToToggle.role,
        isActive: !userToToggle.isActive,
      });
      fetchData();
    } catch (err) {
      alert('Failed to update user status');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            Users & Roles Management
          </h1>
          <p className="text-xs text-gov-muted">
            Configure system accounts, assign role permissions and scope users to offices or fuel stations
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-gov-blue hover:bg-gov-blueHover text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={14} />
          <span>Create User</span>
        </button>
      </div>

      {/* Table matching prototype */}
      <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-line bg-gray-50/50">
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  User
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Assigned Role
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Office / Station Scope
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Account Status
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Last Login
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="p-3 font-semibold text-gov-ink">
                    <div>{u.fullName}</div>
                    <div className="text-[10px] font-mono text-gov-muted">{u.username}</div>
                  </td>
                  <td className="p-3 font-medium text-gov-blue">
                    {u.role.replace(/_/g, ' ')}
                  </td>
                  <td className="p-3 text-gov-muted">
                    {u.fuelStation?.name || u.office?.name || 'Central Administration'}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={u.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                  </td>
                  <td className="p-3 text-gov-muted">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never logged in'}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => toggleUserStatus(u)}
                      className="text-xs text-gov-muted hover:text-gov-ink underline font-semibold"
                    >
                      {u.isActive ? 'Suspend' : 'Activate'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setShowResetModal(true);
                      }}
                      className="border border-gov-line hover:bg-gray-100 text-gov-ink px-2 py-1 rounded-[6px] text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <KeyRound size={12} />
                      <span>Reset Pwd</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-gov-line shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gov-line flex justify-between items-center bg-gray-50/50">
              <h3 className="text-sm font-bold text-gov-ink m-0">Create New System User</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gov-muted hover:text-gov-ink">
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="m-5 mb-0 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={createData.username}
                  onChange={(e) => setCreateData({ ...createData, username: e.target.value })}
                  placeholder="e.g. station2.operator"
                  className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={createData.fullName}
                  onChange={(e) => setCreateData({ ...createData, fullName: e.target.value })}
                  placeholder="e.g. Solomon Kassa"
                  className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  value={createData.password}
                  onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1">User Role *</label>
                <select
                  value={createData.role}
                  onChange={(e) => setCreateData({ ...createData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs bg-white focus:outline-none"
                >
                  <option value="AGRICULTURE_OFFICE">Agriculture Office</option>
                  <option value="TRADE_OFFICE">Trade Office</option>
                  <option value="STATION_ADMIN">Fuel Station Administrator</option>
                  <option value="SYSTEM_ADMIN">System Administrator</option>
                </select>
              </div>

              {createData.role === 'STATION_ADMIN' && (
                <div>
                  <label className="block text-xs font-semibold text-[#526177] mb-1">Assign to Fuel Station *</label>
                  <select
                    value={createData.fuelStationId}
                    onChange={(e) => setCreateData({ ...createData, fuelStationId: e.target.value })}
                    className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs bg-white focus:outline-none"
                  >
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.location})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-gov-line">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gov-line rounded-lg text-xs font-semibold text-gov-ink hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-gov-blue hover:bg-gov-blueHover text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {formLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-gov-line shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gov-line flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xs font-bold text-gov-ink m-0">Reset Password: {selectedUser.username}</h3>
              <button onClick={() => setShowResetModal(false)} className="text-gov-muted hover:text-gov-ink">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1">New Password *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs bg-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gov-line">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 border border-gov-line rounded-lg text-xs font-semibold text-gov-ink hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-gov-blue hover:bg-gov-blueHover text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {formLoading ? 'Resetting...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
