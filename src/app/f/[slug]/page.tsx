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
  ChevronDown,
  Star,
  Calendar,
  Hash,
  HelpCircle
} from 'lucide-react';
import { FormFieldDefinition, isFieldVisible } from '@/lib/forms';

interface FormMeta {
  id: string;
  title: string;
  description?: string | null;
  slug: string;
  fields: FormFieldDefinition[];
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
        data.form.fields.forEach((f: FormFieldDefinition) => {
          if (f.type === 'checkbox') initialData[f.id] = false;
          else if (f.type === 'checkbox_group') initialData[f.id] = [];
          else if (f.type === 'rating') initialData[f.id] = 0;
          else if (f.type === 'section_header') {
            // no-op for section header
          } else initialData[f.id] = '';
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

  const handleCheckboxGroupToggle = (fieldId: string, option: string) => {
    const current: string[] = Array.isArray(formData[fieldId]) ? formData[fieldId] : [];
    const next = current.includes(option)
      ? current.filter((x) => x !== option)
      : [...current, option];
    handleChange(fieldId, next);
  };

  const validate = (): boolean => {
    if (!form) return false;
    const errors: Record<string, string> = {};

    for (const field of form.fields) {
      if (field.type === 'section_header') continue;
      if (!isFieldVisible(field, formData)) continue;

      const val = formData[field.id];

      if (field.required) {
        if (field.type === 'checkbox') {
          if (!val) errors[field.id] = 'You must check this box to proceed.';
        } else if (field.type === 'checkbox_group') {
          if (!Array.isArray(val) || val.length === 0) {
            errors[field.id] = `Please select at least one option for ${field.label}.`;
          }
        } else if (field.type === 'rating') {
          if (!val || Number(val) <= 0) {
            errors[field.id] = `Please provide a rating for ${field.label}.`;
          }
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

      <div className="max-w-2xl w-full mx-auto my-auto">
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
        <div className="bg-slate-900/85 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
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
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="border-b border-slate-800/80 pb-5">
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

              {/* Responsive 2-column Grid for Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {form?.fields.map((field) => {
                  if (!isFieldVisible(field, formData)) return null;

                  const errorMsg = fieldErrors[field.id];
                  const value = formData[field.id] ?? '';
                  const colSpan = field.width === 'half' ? 'sm:col-span-1 col-span-1' : 'sm:col-span-2 col-span-1';

                  // 1. SECTION DIVIDER / HEADER
                  if (field.type === 'section_header') {
                    return (
                      <div key={field.id} className="sm:col-span-2 col-span-1 pt-4 pb-1 border-b border-slate-800">
                        <h3 className="text-sm font-bold text-white tracking-wide uppercase text-indigo-400">
                          {field.label}
                        </h3>
                        {field.helpText && (
                          <p className="text-xs text-slate-400 mt-1">{field.helpText}</p>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={field.id} className={`${colSpan} space-y-1.5`}>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-300">
                          {field.label}
                          {field.required && <span className="text-rose-400 ml-1 font-bold">*</span>}
                        </label>
                      </div>

                      {field.helpText && (
                        <p className="text-[11px] text-slate-400 leading-tight">{field.helpText}</p>
                      )}

                      {/* 2. PHONE / WHATSAPP INPUT */}
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
                            className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-950/70 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                              errorMsg
                                ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : 'border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                            }`}
                          />
                        </div>
                      ) : field.type === 'email' ? (
                        /* 3. EMAIL INPUT */
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Mail className="w-4 h-4 text-sky-400" />
                          </div>
                          <input
                            type="email"
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            placeholder={field.placeholder || 'name@example.com'}
                            className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-950/70 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                              errorMsg
                                ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : 'border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                            }`}
                          />
                        </div>
                      ) : field.type === 'select' ? (
                        /* 4. SELECT DROPDOWN */
                        <div className="relative">
                          <select
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            className={`w-full px-3.5 py-2.5 bg-slate-950/70 border rounded-xl text-sm text-white focus:outline-none appearance-none transition-all ${
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
                      ) : field.type === 'radio' ? (
                        /* 5. RADIO CARDS */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {field.options?.map((opt, idx) => {
                            const isSelected = value === opt;
                            return (
                              <button
                                type="button"
                                key={idx}
                                onClick={() => handleChange(field.id, opt)}
                                className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs font-medium transition-all ${
                                  isSelected
                                    ? 'bg-indigo-600/15 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500'
                                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                <span>{opt}</span>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-700'
                                }`}>
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : field.type === 'checkbox_group' ? (
                        /* 6. MULTI-CHECKBOX GROUP */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {field.options?.map((opt, idx) => {
                            const isChecked = Array.isArray(value) && value.includes(opt);
                            return (
                              <button
                                type="button"
                                key={idx}
                                onClick={() => handleCheckboxGroupToggle(field.id, opt)}
                                className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs font-medium transition-all ${
                                  isChecked
                                    ? 'bg-emerald-600/15 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500'
                                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                <span>{opt}</span>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                  isChecked ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-slate-700'
                                }`}>
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : field.type === 'rating' ? (
                        /* 7. STAR RATING WIDGET */
                        <div className="flex items-center gap-2 pt-1">
                          {[1, 2, 3, 4, 5].map((star) => {
                            const active = Number(value) >= star;
                            return (
                              <button
                                type="button"
                                key={star}
                                onClick={() => handleChange(field.id, star)}
                                className="p-1 hover:scale-110 transition-transform"
                              >
                                <Star
                                  className={`w-6 h-6 ${
                                    active
                                      ? 'text-amber-400 fill-amber-400'
                                      : 'text-slate-600 hover:text-slate-500'
                                  }`}
                                />
                              </button>
                            );
                          })}
                          {Number(value) > 0 && (
                            <span className="text-xs font-semibold text-amber-400 ml-2">
                              {value} / 5
                            </span>
                          )}
                        </div>
                      ) : field.type === 'date' ? (
                        /* 8. DATE PICKER */
                        <div className="relative">
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            className={`w-full px-3.5 py-2.5 bg-slate-950/70 border rounded-xl text-sm text-white focus:outline-none transition-all ${
                              errorMsg
                                ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                                : 'border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                            }`}
                          />
                        </div>
                      ) : field.type === 'textarea' ? (
                        /* 9. TEXTAREA */
                        <textarea
                          rows={3}
                          value={value}
                          onChange={(e) => handleChange(field.id, e.target.value)}
                          placeholder={field.placeholder || ''}
                          className={`w-full px-3.5 py-2.5 bg-slate-950/70 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                            errorMsg
                              ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                          }`}
                        />
                      ) : field.type === 'checkbox' ? (
                        /* 10. CONSENT CHECKBOX */
                        <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => handleChange(field.id, e.target.checked)}
                            className="w-4 h-4 mt-0.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                          />
                          <span className="text-xs text-slate-300 select-none">
                            {field.placeholder || field.label}
                          </span>
                        </label>
                      ) : (
                        /* 11. TEXT / NUMBER */
                        <div className="relative">
                          <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            placeholder={field.placeholder || ''}
                            className={`w-full px-3.5 py-2.5 bg-slate-950/70 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
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
                className="w-full mt-6 py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:ring-4 focus:ring-indigo-500/30 shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
          <p className="text-[11px] text-slate-500 font-medium">
            Powered by WhatsApp Business Suite
          </p>
        </div>
      </div>
    </div>
  );
}
