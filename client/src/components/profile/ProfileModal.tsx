import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  X,
  Camera,
  Trash2,
  User as UserIcon,
  Mail,
  ShieldCheck,
  Building,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  AtSign,
  Fuel,
} from 'lucide-react';
import { UserAvatar, getRoleTitle, getAvatarUrl } from '../common/UserAvatar';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  // Password change states
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const roleInfo = getRoleTitle(user.role);

  // Handle image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size must be less than 5MB');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Please select a valid image file (JPG, PNG, or WebP)');
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
    setRemoveAvatar(false);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setRemoveAvatar(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit Profile Changes
  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage('Full name is required');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append('fullName', fullName.trim());
      formData.append('email', email.trim());

      if (selectedFile) {
        formData.append('avatar', selectedFile);
      } else if (removeAvatar) {
        formData.append('removeAvatar', 'true');
      }

      const res = await api.put('/auth/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success && res.data.user) {
        updateUser(res.data.user);
        setSuccessMessage('Profile updated successfully');
        setSelectedFile(null);
        setRemoveAvatar(false);
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);
      } else {
        setErrorMessage(res.data.message || 'Failed to update profile');
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to update profile'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordError('Please provide your current password');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const res = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      if (res.data.success) {
        setPasswordSuccess('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setPasswordSuccess(null);
          setShowPasswordSection(false);
        }, 2500);
      } else {
        setPasswordError(res.data.message || 'Failed to change password');
      }
    } catch (err: any) {
      setPasswordError(
        err.response?.data?.message || err.message || 'Failed to update password'
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const currentDisplayAvatar = previewUrl
    ? previewUrl
    : removeAvatar
    ? null
    : getAvatarUrl(user.avatarUrl);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Top Accent Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-gov-navy via-gov-blue to-gov-green" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gov-softBlue text-gov-blue flex items-center justify-center font-bold">
              <UserIcon size={16} />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-slate-800 leading-tight">
                User Profile & Credentials
              </h2>
              <p className="text-[11px] text-slate-500">
                Digital Fuel Coupon System — Account Settings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Container */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Notifications */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* User Hero & Avatar Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar with Camera Overlay */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white shadow-md bg-white flex items-center justify-center">
                {currentDisplayAvatar ? (
                  <img
                    src={currentDisplayAvatar}
                    alt={user.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gov-navy to-[#1f3a5f] text-white flex items-center justify-center text-2xl font-bold select-none">
                    {user.fullName ? user.fullName.slice(0, 2).toUpperCase() : 'US'}
                  </div>
                )}
              </div>

              {/* Upload trigger button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gov-blue text-white shadow-md hover:bg-blue-700 flex items-center justify-center transition-colors ring-2 ring-white"
                title="Upload Profile Photo"
              >
                <Camera size={15} />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Identity Info & Action Buttons */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-[17px] font-bold text-slate-900">
                  {fullName || user.fullName}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-100/70 text-blue-700 border border-blue-200/60">
                  <AtSign size={11} />
                  {user.username}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${roleInfo.bg}`}
                >
                  <ShieldCheck size={12} />
                  {roleInfo.title}
                </span>
              </div>

              <p className="text-[12px] text-slate-500 flex items-center justify-center sm:justify-start gap-1.5">
                {user.fuelStation ? (
                  <>
                    <Fuel size={13} className="text-amber-600" />
                    <span>{user.fuelStation.name}</span>
                  </>
                ) : (
                  <>
                    <Building size={13} className="text-slate-500" />
                    <span>
                      {user.office?.name ||
                        'Bahir Dar City Administration Office of Agriculture'}
                    </span>
                  </>
                )}
              </p>

              {/* Avatar management buttons */}
              <div className="pt-1 flex items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-semibold text-gov-blue hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                >
                  <Camera size={12} />
                  <span>Choose new photo</span>
                </button>

                {(user.avatarUrl || previewUrl) && !removeAvatar && (
                  <>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-[11px] font-medium text-rose-600 hover:text-rose-800 hover:underline inline-flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Profile Edit Form */}
          <form onSubmit={handleSubmitProfile} className="space-y-4">
            <h3 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
              Personal Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-[12px] font-medium text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <UserIcon size={14} />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-gov-blue/20 focus:border-gov-blue transition-colors text-slate-800"
                    placeholder="Enter full name"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-[12px] font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail size={14} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-gov-blue/20 focus:border-gov-blue transition-colors text-slate-800"
                    placeholder="user@example.com"
                  />
                </div>
              </div>
            </div>

            {/* Read-Only Account System Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-1">
                  Username (System Handle)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <AtSign size={14} />
                  </div>
                  <input
                    type="text"
                    disabled
                    value={user.username}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-100/70 text-slate-600 cursor-not-allowed select-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-1">
                  System Role
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <ShieldCheck size={14} />
                  </div>
                  <input
                    type="text"
                    disabled
                    value={roleInfo.title}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-100/70 text-slate-600 cursor-not-allowed select-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-gov-blue hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <span>Save Profile</span>
                )}
              </button>
            </div>
          </form>

          {/* Security & Password Change Accordion */}
          <div className="border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-700 hover:text-gov-blue transition-colors group"
            >
              <div className="flex items-center gap-2">
                <KeyRound size={15} className="text-gov-blue" />
                <span>Security & Password Change</span>
              </div>
              <span className="text-[11px] font-semibold text-gov-blue group-hover:underline">
                {showPasswordSection ? 'Collapse' : 'Update Password'}
              </span>
            </button>

            {showPasswordSection && (
              <form
                onSubmit={handleChangePassword}
                className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5 animate-in fade-in"
              >
                {passwordSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                {passwordError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="text-rose-600 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-gov-blue/20 focus:border-gov-blue bg-white"
                    placeholder="Enter current password"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-gov-blue/20 focus:border-gov-blue bg-white"
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-gov-blue/20 focus:border-gov-blue bg-white"
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isChangingPassword ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <span>Update Password</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Protected by Institutional RBAC</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
