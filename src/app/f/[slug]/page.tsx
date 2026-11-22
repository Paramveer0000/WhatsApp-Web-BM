'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  MessageCircle, 
  Loader2, 
  Phone, 
  Mail, 
  User, 
  FileText,
  Check,
  ChevronDown
} from 'lucide-react';

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'phone' | 'email' | 'number' | 'select' | 'textarea' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[];
  isSystem?: boolean;
}

interface FormMeta {
  id: string;
  title: string;
  description?: string | null;
  slug: string;
  fields: FormField[];
  isActive: boolean;
}

export default function PublicFormPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [form, setForm] = useState<FormMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Form inputs state
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');

  useEffect(() => {
    if (!slug) return;

    async function loadForm() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/public/forms/${encodeURIComponent(slug)}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || 'Form not found or is currently closed.');
          return;
        }

        setForm(data.form);
        // Initialize default empty values
        const initialData: Record<string, any> = {};
        data.form.fields.forEach((f: FormField) => {
          if (f.type === 'checkbox') initialData[f.id] = false;
          else initialData[f.id] = '';
        });
        setFormData(initialData);
      } catch (err: any) {
        setError('Unable to load form. Please check your internet connection and try again.');
      } finally {
        setLoading(false);
      }
    }

    loadForm();
  }, [slug]);

  const handleChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    if (fieldErrors[fieldId]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    if (!form) return false;
    const errors: Record<string, string> = {};

    for (const field of form.fields) {
      const val = formData[field.id];

      if (field.required) {
        if (field.type === 'checkbox') {
          if (!val) errors[field.id] = 'You must check this box to proceed.';
        } else if (val === undefined || val === null || String(val).trim() === '') {
          errors[field.id] = `${field.label} is required.`;
        }
      }

      // Format validations
      if (val && String(val).trim()) {
        if (field.type === 'phone' || field.id === 'f_phone') {
          const digits = String(val).replace(/[^0-9]/g, '');
          if (digits.length < 10) {
            errors[field.id] = 'Please enter a valid 10-digit WhatsApp number.';
          }
        } else if (field.type === 'email' || field.id === 'f_email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(String(val).trim())) {
            errors[field.id] = 'Please enter a valid email address.';
          }
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        ...formData,
        _hp: honeypot, // Anti-bot honeypot field
      };

      const res = await fetch(`/api/public/forms/${encodeURIComponent(slug)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to submit form. Please try again.');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('A network error occurred. Please try submitting again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-sm text-slate-400">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center shadow-xl backdrop-blur-xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Form Unavailable</h2>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          <p className="text-xs text-slate-500">Please reach out to the sender for an updated link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Hidden invisible honeypot to block bots */}
      <input
        type="text"
        name="_hp"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      <div className="max-w-xl w-full mx-auto my-auto">
        {/* Brand / WhatsApp Badge */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-sm">
            <MessageCircle className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold tracking-wide text-emerald-400 uppercase">
            WhatsApp Verified Inquiry
          </span>
        </div>

        {/* Card Container */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {submitted ? (
            /* Thank You Confirmation Screen */
            <div className="text-center py-6 sm:py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/10">
                <Check className="w-8 h-8 stroke-[2.5]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Thank You!</h2>
              <p className="text-base font-medium text-slate-300 mb-4">
                Your response has been successfully recorded.
              </p>
              <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                Our executive will get in touch with you shortly on your WhatsApp number. Have a wonderful day!
              </p>
              <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Encrypted & secure response delivery</span>
              </div>
            </div>
          ) : (
            /* Active Lead Form Inputs */
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {form?.title}
                </h1>
                {form?.description && (
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                    {form.description}
                  </p>
                )}
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4 pt-2">
                {form?.fields.map((field) => {
                  const errorMsg = fieldErrors[field.id];
                  const value = formData[field.id] ?? '';

                  return (
                    <div key={field.id} className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-300">
                        {field.label}
                        {field.required && <span className="text-rose-400 ml-1 font-bold">*</span>}
                      </label>

                      {/* Input Types */}
                      {field.type === 'phone' || field.id === 'f_phone' ? (
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Phone className="w-4 h-4 text-emerald-400" />
                          </div>
                          <input
                            type="tel"
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            placeholder={field.placeholder || '9876543210'}
                            className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                              errorMsg
                                ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : 'border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                            }`}
                          />
                        </div>
                      ) : field.type === 'email' ? (
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Mail className="w-4 h-4 text-sky-400" />
                          </div>
                          <input
                            type="email"
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            placeholder={field.placeholder || 'name@example.com'}
                            className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                              errorMsg
                                ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : 'border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                            }`}
                          />
                        </div>
                      ) : field.type === 'select' ? (
                        <div className="relative">
                          <select
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            className={`w-full px-3.5 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-white focus:outline-none appearance-none transition-all ${
                              errorMsg
                                ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : 'border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                            }`}
                          >
                            <option value="" disabled className="bg-slate-900 text-slate-400">
                              {field.placeholder || 'Select an option...'}
                            </option>
                            {field.options?.map((opt, idx) => (
                              <option key={idx} value={opt} className="bg-slate-900 text-white">
                                {opt}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          value={value}
                          onChange={(e) => handleChange(field.id, e.target.value)}
                          placeholder={field.placeholder || ''}
                          className={`w-full px-3.5 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                            errorMsg
                              ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                          }`}
                        />
                      ) : field.type === 'checkbox' ? (
                        <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => handleChange(field.id, e.target.checked)}
                            className="w-4 h-4 mt-0.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                          />
                          <span className="text-xs text-slate-300 select-none">
                            {field.placeholder || field.label}
                          </span>
                        </label>
                      ) : (
                        <div className="relative">
                          <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            placeholder={field.placeholder || ''}
                            className={`w-full px-3.5 py-2.5 bg-slate-950/60 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                              errorMsg
                                ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : 'border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                            }`}
                          />
                        </div>
                      )}

                      {errorMsg && (
                        <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1 font-medium">
                          <AlertCircle className="w-3 h-3" />
                          {errorMsg}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-6 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:ring-4 focus:ring-indigo-500/30 shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Response...</span>
                  </>
                ) : (
                  <>
                    <span>Submit & Request Callback</span>
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center mt-6">
          <p className="text-[11px] text-slate-600 font-medium">
            Powered by BulkFlow WhatsApp CRM
          </p>
        </div>
      </div>
    </div>
  );
}
