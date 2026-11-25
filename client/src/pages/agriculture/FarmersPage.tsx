import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getAssetUrl } from '../../services/api';
import { Farmer, Kebele, SubCity } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Search, Plus, Upload, Filter, Eye, UserPlus, RefreshCw, X, AlertCircle, Camera, User, CheckCircle2 } from 'lucide-react';

export const FarmersPage: React.FC = () => {
  const navigate = useNavigate();

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [subCities, setSubCities] = useState<SubCity[]>([]);
  const [kebeles, setKebeles] = useState<Kebele[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subCityFilter, setSubCityFilter] = useState('');
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
  const initialFormData = {
    fullName: '',
    gender: '', // Required: 'ወንድ' | 'ሴት'
    subCityId: '', // Required: exactly the 4 Sub-Cities
    kebeleId: '', // Required: dependent on subCityId
    landSizeHectares: '',
    primaryCrops: '',
    pumpFuelType: 'Diesel',
    declaredFuelLiters: '',
    phone: '',
    nationalId: '',
  };

  const [formData, setFormData] = useState(initialFormData);

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
      const [resFarmers, resSubCities, resKebeles] = await Promise.all([
        api.get('/farmers', {
          params: {
            search: search || undefined,
            subCityId: subCityFilter || undefined,
            kebeleId: kebeleFilter || undefined,
            eligibilityStatus: statusFilter || undefined,
            fuelType: fuelFilter || undefined,
            limit: 50,
          },
        }),
        api.get('/meta/sub-cities'),
        api.get('/meta/kebeles'),
      ]);

      if (resFarmers.data.success) {
        setFarmers(resFarmers.data.data);
      }
      if (resSubCities.data.success) {
        setSubCities(resSubCities.data.subCities);
      }
      if (resKebeles.data.success) {
        setKebeles(resKebeles.data.kebeles);
      }
    } catch (err) {
      console.error('Failed to load farmers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarmers();
  }, [search, subCityFilter, kebeleFilter, statusFilter, fuelFilter]);

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

  const handleSubCityChange = (newSubCityId: string) => {
    // When Sub-City changes, clear the previous Kebele selection as required
    setFormData((prev) => ({
      ...prev,
      subCityId: newSubCityId,
      kebeleId: '',
    }));
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setModalError(null);

    // Client-side validations
    if (!formData.fullName.trim()) {
      setModalError('Full Name is required / ሙሉ ስም ማስገባት ግዴታ ነው');
      setFormLoading(false);
      return;
    }

    if (!formData.gender) {
      setModalError('Gender is required / ጾታ መምረጥ ግዴታ ነው');
      setFormLoading(false);
      return;
    }

    if (!formData.subCityId) {
      setModalError('Sub-City selection is required / ክፍለ ከተማ መምረጥ ግዴታ ነው');
      setFormLoading(false);
      return;
    }

    if (!formData.kebeleId) {
      setModalError('Kebele selection is required / ቀበሌ መምረጥ ግዴታ ነው');
      setFormLoading(false);
      return;
    }

    const landSize = parseFloat(formData.landSizeHectares as string);
    if (isNaN(landSize) || landSize <= 0) {
      setModalError('Farm size must be greater than 0 / የማሳ ስፋት ከ 0 በላይ መሆን አለበት');
      setFormLoading(false);
      return;
    }

    if (!formData.primaryCrops.trim()) {
      setModalError('Crop type is required / የሰብል አይነት ማስገባት ግዴታ ነው');
      setFormLoading(false);
      return;
    }

    if (!formData.pumpFuelType) {
      setModalError('Fuel type is required / የነዳጅ አይነት መምረጥ ግዴታ ነው');
      setFormLoading(false);
      return;
    }

    const declaredLiters = parseFloat(formData.declaredFuelLiters as string);
    if (isNaN(declaredLiters) || declaredLiters <= 0) {
      setModalError('Required fuel quantity must be greater than 0 / የሚያስፈልግ ነዳጅ መጠን ከ 0 በላይ መሆን አለበት');
      setFormLoading(false);
      return;
    }

    if (!formData.phone.trim() || formData.phone.trim().length < 9) {
      setModalError('Valid phone number is required / ትክክለኛ ስልክ ቁጥር ማስገባት ግዴታ ነው');
      setFormLoading(false);
      return;
    }

    try {
      if (photoFile) {
        const payload = new FormData();
        payload.append('fullName', formData.fullName.trim());
        payload.append('gender', formData.gender);
        payload.append('subCityId', formData.subCityId);
        payload.append('kebeleId', formData.kebeleId);
        payload.append('landSizeHectares', String(landSize));
        payload.append('primaryCrops', formData.primaryCrops.trim());
        payload.append('pumpFuelType', formData.pumpFuelType);
        payload.append('declaredFuelLiters', String(declaredLiters));
        payload.append('phone', formData.phone.trim());
        if (formData.nationalId) payload.append('nationalId', formData.nationalId.trim());
        payload.append('photo', photoFile);

        const res = await api.post('/farmers', payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res.data.success) {
          setShowRegisterModal(false);
          setFormData(initialFormData);
          setPhotoFile(null);
          setPhotoPreview(null);
          fetchFarmers();
        }
      } else {
        const res = await api.post('/farmers', {
          fullName: formData.fullName.trim(),
          gender: formData.gender,
          subCityId: formData.subCityId,
          kebeleId: formData.kebeleId,
          landSizeHectares: landSize,
          primaryCrops: formData.primaryCrops.trim(),
          pumpFuelType: formData.pumpFuelType,
          declaredFuelLiters: declaredLiters,
          phone: formData.phone.trim(),
          nationalId: formData.nationalId ? formData.nationalId.trim() : null,
        });

        if (res.data.success) {
          setShowRegisterModal(false);
          setFormData(initialFormData);
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
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, Farmer ID, or phone..."
            className="w-full pl-9 pr-3 py-2 border border-gov-line rounded-[8px] text-xs text-gov-ink placeholder:text-gray-400 focus:outline-none focus:border-gov-blue bg-white"
          />
          <Search size={15} className="absolute left-3 top-2.5 text-gov-muted" />
        </div>

        {/* Sub-City Filter */}
        <select
          value={subCityFilter}
          onChange={(e) => {
            setSubCityFilter(e.target.value);
            setKebeleFilter('');
          }}
          className="border border-gov-line rounded-[8px] px-3 py-2 text-xs text-gov-ink bg-white focus:outline-none"
        >
          <option value="">All Sub-Cities / ሁሉም ክፍለ ከተሞች</option>
          {subCities.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.name}
            </option>
          ))}
        </select>

        {/* Kebele Filter (Dependent on Sub-City if selected) */}
        <select
          value={kebeleFilter}
          onChange={(e) => setKebeleFilter(e.target.value)}
          className="border border-gov-line rounded-[8px] px-3 py-2 text-xs text-gov-ink bg-white focus:outline-none"
        >
          <option value="">All Kebeles / ሁሉም ቀበሌዎች</option>
          {(subCityFilter ? kebeles.filter((k) => k.subCityId === subCityFilter) : kebeles).map((k) => (
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
          <option value="">All Fuel Types / ነዳጅ ዓይነት</option>
          <option value="Diesel">ናፍጣ — Diesel</option>
          <option value="Benzene">ቤንዚል — Benzene</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gov-line rounded-[8px] px-3 py-2 text-xs text-gov-ink bg-white focus:outline-none"
        >
          <option value="">All Statuses / ሁኔታ</option>
          <option value="ELIGIBLE">Eligible (ብቁ)</option>
          <option value="UNDER_REVIEW">Under Review (በግምገማ ላይ)</option>
          <option value="SUSPENDED">Suspended (የታገደ)</option>
          <option value="INELIGIBLE">Ineligible (ብቁ ያልሆነ)</option>
        </select>

        <button
          onClick={fetchFarmers}
          className="p-2 border border-gov-line rounded-[8px] hover:bg-gray-50 text-gov-muted cursor-pointer"
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
                  Full Name / ሙሉ ስም
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Gender / ጾታ
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Location (Sub-City & Kebele)
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Farm Size
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Fuel & Declared L
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
                            src={getAssetUrl(farmer.photoUrl)}
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
                  <td className="p-3 text-gov-muted">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                      {farmer.gender || 'ወንድ'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="font-semibold text-gov-ink">{farmer.kebele?.name}</div>
                    <div className="text-[10px] text-gov-muted">
                      {farmer.subCity?.name || farmer.kebele?.subCity?.name || farmer.kebele?.location?.name || 'ባሕር ዳር'}
                    </div>
                  </td>
                  <td className="p-3 text-gov-ink font-semibold">
                    {farmer.irrigationProfile?.landSizeHectares} ha
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                        farmer.irrigationProfile?.pumpFuelType === 'Diesel'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {farmer.irrigationProfile?.pumpFuelType === 'Benzene' ? 'ቤንዚል' : 'ናፍጣ'}
                    </span>
                    <span className="block text-[10px] text-gov-muted mt-0.5 font-mono">
                      Req: {farmer.declaredFuelLiters || farmer.irrigationProfile?.declaredFuelLiters || '—'} L
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
                      className="inline-flex items-center gap-1 border border-gov-line hover:bg-gray-100 text-gov-ink px-2.5 py-1 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))}
              {farmers.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gov-muted text-xs">
                    No farmer records match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER FARMER MODAL — OFFICIAL 4-SECTION AGRICULTURE STRUCTURE */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-gov-line shadow-2xl overflow-hidden my-4 sm:my-8 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gov-line flex justify-between items-center bg-gray-50/70 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gov-softBlue text-gov-blue grid place-items-center shrink-0">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gov-ink m-0">
                    Beneficiary Farmer Registration · የአርሶ አደር ምዝገባ
                  </h3>
                  <p className="text-[11px] text-gov-muted m-0">
                    የባሕር ዳር ከተማ አስተዳደር ግብርና መምሪያ · Bahir Dar City Agriculture Office
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRegisterModal(false);
                  setModalError(null);
                }}
                className="text-gov-muted hover:text-gov-ink p-1 rounded-lg hover:bg-gray-200/60 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Alert */}
            {modalError && (
              <div className="m-4 mb-0 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2 shrink-0">
                <AlertCircle size={15} className="shrink-0" />
                <span className="font-medium">{modalError}</span>
              </div>
            )}

            {/* Form Scroll Body */}
            <form onSubmit={handleRegisterSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
              {/* SECTION 1 — FARMER INFORMATION */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200 text-xs font-bold text-gov-ink">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] grid place-items-center">
                    1
                  </span>
                  <span>Farmer Information (የአርሶ አደር መረጃ)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name (ሙሉ ስም) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="e.g. አበበ ተስፋዬ"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 bg-white"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Gender (ጾታ) <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 bg-white"
                    >
                      <option value="">Select Gender / ጾታ ይምረጡ</option>
                      <option value="ወንድ">ወንድ (Male)</option>
                      <option value="ሴት">ሴት (Female)</option>
                    </select>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number (ስልክ ቁጥር) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+251 9... or 09..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 bg-white"
                    />
                  </div>

                  {/* National / Kebele ID */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      National / Kebele ID (መታወቂያ ቁጥር)
                    </label>
                    <input
                      type="text"
                      value={formData.nationalId}
                      onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                      placeholder="Optional ID / e.g. ETH-BD-..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 bg-white"
                    />
                  </div>
                </div>

                {/* Photo Upload Row */}
                <div className="pt-2 flex items-center gap-3">
                  <div className="w-12 h-14 bg-white border border-slate-300 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                    {photoPreview ? (
                      <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={18} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 text-xs">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 cursor-pointer font-medium text-slate-700">
                      <Upload size={12} />
                      <span>{photoFile ? 'Change Photo' : 'Upload Photo (Optional)'}</span>
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
                        className="ml-2 text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                    {photoError && <p className="text-[11px] text-red-600 mt-0.5">{photoError}</p>}
                  </div>
                </div>
              </div>

              {/* SECTION 2 — ADMINISTRATIVE LOCATION */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200 text-xs font-bold text-gov-ink">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] grid place-items-center">
                    2
                  </span>
                  <span>Administrative Location (አስተዳደራዊ አካባቢ)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Sub-City */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sub-City (ክፍለ ከተማ) <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.subCityId}
                      onChange={(e) => handleSubCityChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 bg-white"
                    >
                      <option value="">Select Sub-City / ክፍለ ከተማ ይምረጡ</option>
                      {subCities.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dependent Kebele / Location */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kebele / Location (ቀበሌ / አካባቢ) <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      disabled={!formData.subCityId}
                      value={formData.kebeleId}
                      onChange={(e) => setFormData({ ...formData, kebeleId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!formData.subCityId
                          ? 'First select Sub-City / አስቀድመው ክፍለ ከተማ ይምረጡ'
                          : 'Select Kebele / ቀበሌ ይምረጡ'}
                      </option>
                      {kebeles
                        .filter((k) => k.subCityId === formData.subCityId)
                        .map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name}
                          </option>
                        ))}
                    </select>
                    {formData.subCityId && (
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {kebeles.filter((k) => k.subCityId === formData.subCityId).length} locations available in this Sub-City
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 3 — AGRICULTURAL INFORMATION */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200 text-xs font-bold text-gov-ink">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] grid place-items-center">
                    3
                  </span>
                  <span>Agricultural Information (የግብርና መረጃ)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Farm Size */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Farm Size (የማሳ ስፋት በሄክታር) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={formData.landSizeHectares}
                        onChange={(e) => setFormData({ ...formData, landSizeHectares: e.target.value })}
                        placeholder="e.g. 1.25"
                        className="w-full pl-3 pr-14 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 bg-white font-mono"
                      />
                      <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400 pointer-events-none">
                        ha / ሄክታር
                      </span>
                    </div>
                  </div>

                  {/* Crop Type */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Crop Type (የሰብል አይነት) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.primaryCrops}
                      onChange={(e) => setFormData({ ...formData, primaryCrops: e.target.value })}
                      placeholder="e.g. ሽንኩርት፣ ቲማቲም (Onion, Tomato)"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4 — FUEL REQUIREMENT */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200 text-xs font-bold text-gov-ink">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] grid place-items-center">
                    4
                  </span>
                  <span>Fuel Requirement (የነዳጅ ፍላጎት)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Fuel Type */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Fuel Type (የነዳጅ አይነት) <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.pumpFuelType}
                      onChange={(e) => setFormData({ ...formData, pumpFuelType: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 bg-white"
                    >
                      <option value="Diesel">ናፍጣ — Diesel</option>
                      <option value="Benzene">ቤንዚል — Benzene</option>
                    </select>
                  </div>

                  {/* Required Fuel Quantity */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Required Fuel Quantity (የሚያስፈልግ ነዳጅ በሌትር) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        required
                        value={formData.declaredFuelLiters}
                        onChange={(e) => setFormData({ ...formData, declaredFuelLiters: e.target.value })}
                        placeholder="e.g. 100"
                        className="w-full pl-3 pr-12 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 bg-white font-mono"
                      />
                      <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400 pointer-events-none">
                        L / ሌትር
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 italic pt-1">
                  * Note: Declared requirement for irrigation pumps (subject to official Agriculture request & Trade Office quota approval).
                </p>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowRegisterModal(false);
                    setModalError(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel / ሰርዝ
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {formLoading ? (
                    <span>Registering...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Register & Issue QR Card (መዝግብ እና ካርድ አውጣ)</span>
                    </>
                  )}
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
