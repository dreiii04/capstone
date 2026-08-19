import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import ConfirmModal from '../../components/ConfirmModal';
import { ChevronRight, UserPlus, ShieldCheck, Briefcase, Save, X, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

export default function AddRegistrar() {
  const navigate = useNavigate();
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);

  const showConfirm = ({ title, message, onConfirm, type = 'info', confirmText = 'Confirm', cancelText = 'Cancel' }) => {
    setConfirmConfig({
      title,
      message,
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          await onConfirm();
        } catch (err) {
          console.error(err);
        } finally {
          setConfirmConfig(null);
        }
      },
      type,
      confirmText,
      cancelText,
      isLoading: false
    });
  };

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'Registrar Staff'
  });

  // Validation errors
  const [errors, setErrors] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });

  // Function to generate a secure 8-character password
  const generatePassword = () => {
    const charset = {
      upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      lower: "abcdefghijklmnopqrstuvwxyz",
      number: "0123456789",
      special: "!@#$%^&*"
    };

    let password = "";
    password += charset.upper.charAt(Math.floor(Math.random() * charset.upper.length));
    password += charset.lower.charAt(Math.floor(Math.random() * charset.lower.length));
    password += charset.number.charAt(Math.floor(Math.random() * charset.number.length));
    password += charset.special.charAt(Math.floor(Math.random() * charset.special.length));

    const allChars = Object.values(charset).join("");
    for (let i = 0; i < 4; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    setGeneratedPassword(password.split('').sort(() => 0.5 - Math.random()).join(''));
  };

  useEffect(() => {
    generatePassword();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
      isValid = false;
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
      isValid = false;
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleAddRegistrar = () => {
    // Validation
    if (!validateForm()) {
      setToast({ show: true, message: 'Please fix the errors before submitting', type: 'error' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
      return;
    }

    showConfirm({
      title: 'Register Registrar Account',
      message: `Are you sure you want to register a new ${formData.role} account for ${formData.firstName} ${formData.lastName}?`,
      type: 'info',
      confirmText: 'Register',
      onConfirm: async () => {
        setLoading(true);
        try {
          console.log('Sending request to /registrars with data:', {
            name: `${formData.firstName} ${formData.lastName}`,
            email: formData.email,
            role: formData.role
          });

          const response = await api.post('/registrars', {
            name: `${formData.firstName} ${formData.lastName}`,
            email: formData.email,
            password: generatedPassword,
            role: formData.role
          });

          console.log('Response:', response.data);

          setToast({ show: true, message: 'New Registrar added successfully!', type: 'success' });
          setTimeout(() => {
            setToast({ show: false, message: '', type: 'success' });
            navigate('/manage-registrar');
          }, 2000);
        } catch (error) {
          console.error('Error adding registrar:', error);
          console.error('Error response:', error.response);
          console.error('Error request:', error.request);

          let errorMessage = 'Failed to add registrar';

          if (error.response) {
            // Server responded with error
            errorMessage = error.response.data?.message || errorMessage;
            if (error.response.status === 404) {
              errorMessage = 'API endpoint not found. Please restart the backend server.';
            } else if (error.response.status === 403) {
              errorMessage = 'Access denied. You must be logged in as a Super Admin.';
            } else if (error.response.status === 401) {
              errorMessage = 'Unauthorized. Please log in again.';
            }
          } else if (error.request) {
            // Request made but no response
            errorMessage = 'Server is not responding. Please check if the backend is running.';
          } else {
            // Something else happened
            errorMessage = error.message;
          }

          setToast({ show: true, message: errorMessage, type: 'error' });
          setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <Layout>
      <div className="p-8 bg-[#F8FAFC] min-h-screen font-sans relative">

        {toast.show && (
          <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[10001] flex items-center gap-3 px-6 py-3 rounded-lg shadow-2xl text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-[#1D2D44]'
            }`}>
            {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
            <p className="font-bold text-sm">{toast.message}</p>
          </div>
        )}

        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-[12px] mb-6 text-gray-400 uppercase tracking-widest font-bold">
            <span className="cursor-pointer hover:text-[#1D2D44]" onClick={() => navigate('/manage-registrar')}>Manage Registrar</span>
            <ChevronRight size={14} />
            <span className="text-[#1D2D44]">Add New Registrar</span>
          </div>

          <h2 className="text-[24px] font-bold text-[#1D2D44] mb-8">Registrar Registration</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-6 text-[#1D2D44]">
                  <UserPlus size={20} />
                  <h3 className="text-[16px] font-bold uppercase tracking-wider">Basic Information</h3>
                </div>
                <div className="space-y-5">
                  <FormInput
                    label="First Name"
                    placeholder="e.g. Maria"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    error={errors.firstName}
                  />
                  <FormInput
                    label="Last Name"
                    placeholder="e.g. Santos"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    error={errors.lastName}
                  />
                  <FormInput
                    label="Email Address"
                    placeholder="registrar.maria@university.edu"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    error={errors.email}
                  />
                </div>
              </section>

              <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-6 text-[#1D2D44]">
                  <ShieldCheck size={20} />
                  <h3 className="text-[16px] font-bold uppercase tracking-wider">Security</h3>
                </div>
                <div className="space-y-5">
                  <FormInput label="Employee ID" placeholder="e.g. 2024-REG-001" />

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[12px] font-bold text-gray-500 uppercase tracking-tight">Auto-Generated Password</label>
                      <button
                        onClick={generatePassword}
                        className="text-[#1D2D44] text-[10px] font-bold flex items-center gap-1 hover:underline uppercase"
                      >
                        <RefreshCw size={12} /> Regenerate
                      </button>
                    </div>
                    <input
                      type="text"
                      value={generatedPassword}
                      readOnly
                      className="w-full bg-[#F1F5F9] border border-gray-200 rounded-lg p-3 text-sm font-mono text-[#1D2D44] font-bold text-center tracking-widest"
                    />
                    <p className="text-[10px] text-gray-400 italic">Complexity: Uppercase, Lowercase, Number, & Special Char.</p>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 h-full">
                <div className="flex items-center gap-2 mb-6 text-[#1D2D44]">
                  <Briefcase size={20} />
                  <h3 className="text-[16px] font-bold uppercase tracking-wider">Access & Roles</h3>
                </div>
                <div className="space-y-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[12px] font-bold text-gray-500 uppercase tracking-tight">Specific Responsibility (Optional)</label>
                    <textarea
                      placeholder="e.g. Handles Transcript of Records..."
                      className="w-full bg-white border border-gray-300 rounded-lg p-3 text-sm h-48 outline-none focus:border-[#1D2D44] resize-none transition-all"
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-10">
            {/* Styled according to the requested "Cancel" image */}
            <button
              onClick={() => navigate('/manage-registrar')}
              className="bg-white border border-gray-300 text-gray-600 px-8 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <X size={14} /> Cancel
            </button>
            <button
              onClick={handleAddRegistrar}
              disabled={loading}
              className="bg-[#1D2D44] text-white px-10 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-[#152030] shadow-lg active:scale-95 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Adding...
                </>
              ) : (
                <>
                  <Save size={14} /> Add Registrar
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmConfig !== null}
        onClose={() => setConfirmConfig(null)}
        onConfirm={confirmConfig?.onConfirm}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        type={confirmConfig?.type}
        confirmText={confirmConfig?.confirmText}
        cancelText={confirmConfig?.cancelText}
        isLoading={confirmConfig?.isLoading}
      />
    </Layout>
  );
}

function FormInput({ label, placeholder = "", name, value, onChange, error }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[12px] font-bold text-gray-500 uppercase tracking-tight">{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full bg-white border rounded-lg p-3 text-sm outline-none transition-all ${error
          ? 'border-red-500 focus:border-red-500'
          : 'border-gray-300 focus:border-[#1D2D44]'
          }`}
      />
      {error && (
        <p className="text-[10px] text-red-600 font-medium flex items-center gap-1">
          <span className="text-red-500">•</span> {error}
        </p>
      )}
    </div>
  );
}