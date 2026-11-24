import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Farmer, Kebele } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Search, Plus, Upload, Filter, Eye, UserPlus, RefreshCw, X, AlertCircle, Camera, User } from 'lucide-react';

export const FarmersPage: React.FC = () => {
  const navigate = useNavigate();

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [kebeles, setKebeles] = useState<Kebele[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kebeleFilter, setKebeleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fuelFilter, setFuelFilter] = useState('');

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Photo State
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    nationalId: '',
    kebeleId: '',
    landSizeHectares: 2.5,
    waterSource: 'LAKE_TANA',
    waterSourceDetail: '',
    pumpFuelType: 'Diesel',
    pumpHorsepower: '10 HP',
    pumpModel: '',
    primaryCrops: 'Onion, Tomato',
    irrigationSeason: 'Bega / Dry Season 2026',
  });

  // CSV Import State
  const [csvText, setCsvText] = useState(
    `fullName,phone,nationalId,landSizeHectares,pumpFuelType,pumpHorsepower,primaryCrops
Girma Wolde,+251 918 881 122,ETH-BD-2024-1010,2.5,Diesel,12 HP,Onion
Tirunesh Dibaba,+251 918 882 233,ETH-BD-2024-1011,1.8,Benzene,7.5 HP,Pepper
Getachew Reda,+251 918 883 344,ETH-BD-2024-1012,3.2,Diesel,14 HP,Tomato`
  );

  const fetchFarmers = async () => {
    setLoading(true);
    try {
      const [resFarmers, resKebeles] = await Promise.all([
        api.get('/farmers', {
          params: {
            search: search || undefined,
            kebeleId: kebeleFilter || undefined,
            eligibilityStatus: statusFilter || undefined,
            fuelType: fuelFilter || undefined,
            limit: 50,
          },
        }),
        api.get('/meta/kebeles'),
      ]);

      if (resFarmers.data.success) {
        setFarmers(resFarmers.data.data);
      }
      if (resKebeles.data.success) {
        setKebeles(resKebeles.data.kebeles);
        if (!formData.kebeleId && resKebeles.data.kebeles.length > 0) {
          setFormData((prev) => ({ ...prev, kebeleId: resKebeles.data.kebeles[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to load farmers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarmers();
  }, [search, kebeleFilter, statusFilter, fuelFilter]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    if (!e.target.files || e.target.files.length === 0) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }

    const file = e.target.files[0];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setPhotoError('Invalid file format. Please upload a JPG or PNG image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('File size exceeds 5MB limit. Please select a smaller photo.');
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setModalError(null);

    const targetKebeleId = formData.kebeleId || (kebeles.length > 0 ? kebeles[0].id : '');

    try {
      if (photoFile) {
        // Send as multipart/form-data
        const payload = new FormData();
        payload.append('fullName', formData.fullName);
        payload.append('phone', formData.phone);
        if (formData.nationalId) payload.append('nationalId', formData.nationalId);
        payload.append('kebeleId', targetKebeleId);
        payload.append('landSizeHectares', String(formData.landSizeHectares));
        payload.append('waterSource', formData.waterSource);
        if (formData.waterSourceDetail) payload.append('waterSourceDetail', formData.waterSourceDetail);
        payload.append('pumpFuelType', formData.pumpFuelType);
        if (formData.pumpHorsepower) payload.append('pumpHorsepower', formData.pumpHorsepower);
        if (formData.pumpModel) payload.append('pumpModel', formData.pumpModel);
        if (formData.primaryCrops) payload.append('primaryCrops', formData.primaryCrops);
        if (formData.irrigationSeason) payload.append('irrigationSeason', formData.irrigationSeason);
        payload.append('photo', photoFile);

        const res = await api.post('/farmers', payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res.data.success) {
          setShowRegisterModal(false);
          setPhotoFile(null);
          setPhotoPreview(null);
          fetchFarmers();
        }
      } else {
        const res = await api.post('/farmers', {
          ...formData,
          kebeleId: targetKebeleId,
          landSizeHectares: Number(formData.landSizeHectares),
        });

        if (res.data.success) {
          setShowRegisterModal(false);
          setPhotoFile(null);
          setPhotoPreview(null);
          fetchFarmers();
        }
      }
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to register farmer');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCsvImport = async () => {
    setFormLoading(true);
    setModalError(null);

    try {
      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',').map((h) => h.trim());
      const farmersList = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim());
        const item: any = {};
        headers.forEach((h, i) => {
          item[h] = values[i];
        });
        return item;
      });

      const res = await api.post('/farmers/bulk-import', { farmers: farmersList });
      if (res.data.success) {
        setShowImportModal(false);
        fetchFarmers();
      }
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Import failed');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            Farmer Registry
          </h1>
          <p className="text-xs text-gov-muted">
            Manage irrigation farmers, farm locations, pump profiles and fuel eligibility
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3 py-2 rounded-[8px] transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Upload size={14} className="text-gov-muted" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => setShowRegisterModal(true)}
            className="bg-gov-blue hover:bg-gov-blueHover text-white text-xs font-semibold px-3.5 py-2 rounded-[8px] transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={14} />
            <span>Register Farmer</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-gov-line rounded-[13px] p-3.5 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, Farmer ID, or phone..."
            className="w-full pl-9 pr-3 py-2 border border-gov-line rounded-[8px] text-xs text-gov-ink placeholder:text-gray-400 focus:outline-none focus:border-gov-blue bg-white"
          />
          <Search size={15} className="absolute left-3 top-2.5 text-gov-muted" />
        </div>

        <select
          value={kebeleFilter}
          onChange={(e) => setKebeleFilter(e.target.value)}
          className="border border-gov-line rounded-[8px] px-3 py-2 text-xs text-gov-ink bg-white focus:outline-none"
        >
          <option value="">All Kebeles</option>
          {kebeles.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>

        <select
          value={fuelFilter}
          onChange={(e) => setFuelFilter(e.target.value)}
          className="border border-gov-line rounded-[8px] px-3 py-2 text-xs text-gov-ink bg-white focus:outline-none"
        >
          <option value="">All Fuel Types</option>
          <option value="Diesel">Diesel</option>
          <option value="Benzene">Benzene</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gov-line rounded-[8px] px-3 py-2 text-xs text-gov-ink bg-white focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="ELIGIBLE">Eligible</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="INELIGIBLE">Ineligible</option>
        </select>

        <button
          onClick={fetchFarmers}
          className="p-2 border border-gov-line rounded-[8px] hover:bg-gray-50 text-gov-muted"
          title="Refresh table"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Farmers Data Table matching prototype */}
      <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-line bg-gray-50/50">
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Farmer ID
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Full Name
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Kebele / Location
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Land Size
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Pump Fuel
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Card Status
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Eligibility
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {farmers.map((farmer) => (
                <tr key={farmer.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="p-3 font-semibold text-gov-blue">{farmer.farmerCode}</td>
                  <td className="p-3 font-medium text-gov-ink">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {farmer.photoUrl ? (
                          <img
                            src={farmer.photoUrl.startsWith('http') ? farmer.photoUrl : `http://localhost:5000${farmer.photoUrl}`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={13} className="text-gray-400" />
                        )}
                      </div>
                      <div>
                        <span>{farmer.fullName}</span>
                        {!farmer.photoUrl && (
                          <span className="block text-[9px] text-amber-700 font-normal">
                            No photo
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-gov-muted">{farmer.kebele?.name}</td>
                  <td className="p-3 text-gov-ink">
                    {farmer.irrigationProfile?.landSizeHectares} ha
                  </td>
                  <td className="p-3 font-medium">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                        farmer.irrigationProfile?.pumpFuelType === 'Diesel'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {farmer.irrigationProfile?.pumpFuelType || 'Diesel'}
                    </span>
                  </td>
                  <td className="p-3">
                    <StatusBadge
                      status={farmer.cards?.[0]?.status || 'PENDING'}
                      label={farmer.cards?.[0]?.status === 'ACTIVE' ? 'Card Issued' : undefined}
                    />
                  </td>
                  <td className="p-3">
                    <StatusBadge status={farmer.eligibilityStatus} />
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => navigate(`/farmers/${farmer.id}`)}
                      className="inline-flex items-center gap-1 border border-gov-line hover:bg-gray-100 text-gov-ink px-2.5 py-1 rounded-[6px] text-xs font-semibold transition-colors"
                    >
                      <Eye size={12} />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))}
              {farmers.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gov-muted text-xs">
                    No farmer records match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER FARMER MODAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-gov-line shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-gov-line flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gov-softBlue text-gov-blue grid place-items-center">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gov-ink m-0">Register New Irrigation Farmer</h3>
                  <p className="text-[11px] text-gov-muted m-0">የባሕር ዳር ከተማ አስተዳደር ግብርና መምሪያ · Bahir Dar City Administration Office of Agriculture</p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-gov-muted hover:text-gov-ink p-1"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="m-5 mb-0 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="p-5 space-y-4">
              {/* Photo Upload Row */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-20 h-24 bg-white border-2 border-dashed border-slate-300 rounded-lg overflow-hidden flex flex-col items-center justify-center shrink-0 shadow-xs relative">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-2 text-center text-slate-400">
                      <Camera size={22} className="mb-1" />
                      <span className="text-[9px] font-semibold leading-tight">Passport Photo</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1 text-left w-full">
                  <label className="block text-xs font-bold text-gov-ink">
                    Farmer Photograph (የአርሶ አደሩ ፎቶግራፍ)
                  </label>
                  <p className="text-[11px] text-gov-muted leading-tight">
                    Upload official passport-style portrait (JPG, JPEG, PNG, max 5MB).
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <label className="cursor-pointer bg-white border border-gov-line hover:bg-slate-100 text-gov-ink px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs inline-flex items-center gap-1.5 transition-colors">
                      <Upload size={13} />
                      <span>{photoFile ? 'Change Photo' : 'Select Photo'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </label>
                    {photoFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(null);
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {photoError && (
                    <p className="text-[11px] text-red-600 font-semibold mt-1">{photoError}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#526177] mb-1">
                    Full Name (የአርሶ አደሩ ስም) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Abebe Tesfaye"
                    className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs focus:outline-none focus:border-gov-blue bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#526177] mb-1">
                    Phone Number (ስልክ ቁጥር) *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+251 918 000 000"
                    className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs focus:outline-none focus:border-gov-blue bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#526177] mb-1">
                    National / Kebele ID
                  </label>
                  <input
                    type="text"
                    value={formData.nationalId}
                    onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                    placeholder="ETH-BD-2026-..."
                    className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs focus:outline-none focus:border-gov-blue bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#526177] mb-1">
                    Kebele Location (ቀበሌ) *
                  </label>
                  <select
                    required
                    value={formData.kebeleId}
                    onChange={(e) => setFormData({ ...formData, kebeleId: e.target.value })}
                    className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs focus:outline-none focus:border-gov-blue bg-white"
                  >
                    {kebeles.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} ({k.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#526177] mb-1">
                    Land Size in Hectares (የመሬት ስፋት በሄክታር) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={formData.landSizeHectares}
                    onChange={(e) => setFormData({ ...formData, landSizeHectares: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs focus:outline-none focus:border-gov-blue bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#526177] mb-1">
                    Water Source (የውሃ ምንጭ) *
                  </label>
                  <select
                    value={formData.waterSource}
                    onChange={(e) => setFormData({ ...formData, waterSource: e.target.value })}
                    className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs focus:outline-none focus:border-gov-blue bg-white"
                  >
                    <option value="LAKE_TANA">Lake Tana (ጣና ሀይቅ)</option>
                    <option value="BLUE_NILE">Blue Nile (ዓባይ ወንዝ)</option>
                    <option value="BOREHOLE">Deep Borehole (ጥልቅ ጉድጓድ)</option>
                    <option value="RIVER_DIVERSION">River Diversion (ወንዝ ጠለፋ)</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#526177] mb-1">
                    Pump Fuel Type (የሞተር ነዳጅ ዓይነት) *
                  </label>
                  <select
                    value={formData.pumpFuelType}
                    onChange={(e) => setFormData({ ...formData, pumpFuelType: e.target.value })}
                    className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs focus:outline-none focus:border-gov-blue bg-white"
                  >
                    <option value="Diesel">Diesel (ናፍጣ)</option>
                    <option value="Benzene">Benzene (ቤንዚን)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#526177] mb-1">
                    Pump Capacity / Horsepower
                  </label>
                  <input
                    type="text"
                    value={formData.pumpHorsepower}
                    onChange={(e) => setFormData({ ...formData, pumpHorsepower: e.target.value })}
                    placeholder="e.g. 10 HP / 12 HP"
                    className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs focus:outline-none focus:border-gov-blue bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#526177] mb-1">
                    Primary Irrigated Crops (የሚመረተው ሰብል)
                  </label>
                  <input
                    type="text"
                    value={formData.primaryCrops}
                    onChange={(e) => setFormData({ ...formData, primaryCrops: e.target.value })}
                    placeholder="e.g. Onion, Tomato, Potato, Maize"
                    className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs focus:outline-none focus:border-gov-blue bg-white"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gov-line flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 border border-gov-line rounded-lg text-xs font-semibold text-gov-ink hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-gov-blue hover:bg-gov-blueHover text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {formLoading ? 'Registering...' : 'Save & Issue QR Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-gov-line shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gov-line flex justify-between items-center bg-gray-50/50">
              <h3 className="text-sm font-bold text-gov-ink m-0">Bulk Import Farmers via CSV</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gov-muted hover:text-gov-ink p-1"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="m-5 mb-0 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{modalError}</span>
              </div>
            )}

            <div className="p-5 space-y-3">
              <p className="text-xs text-gov-muted">
                Paste CSV formatted text with the required column headers (fullName, phone, landSizeHectares, pumpFuelType, pumpHorsepower).
              </p>

              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full p-3 font-mono text-[11px] border border-gov-line rounded-lg focus:outline-none focus:border-gov-blue bg-gray-50"
              />

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 border border-gov-line rounded-lg text-xs font-semibold text-gov-ink hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCsvImport}
                  disabled={formLoading}
                  className="px-4 py-2 bg-gov-blue hover:bg-gov-blueHover text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {formLoading ? 'Importing...' : 'Execute Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
