'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  FileText, 
  ExternalLink, 
  Copy, 
  QrCode, 
  Edit3, 
  Trash2, 
  Check, 
  Sparkles, 
  AlertCircle, 
  ArrowUp, 
  ArrowDown, 
  ToggleLeft, 
  ToggleRight, 
  MessageSquare, 
  CheckCircle2, 
  Layers, 
  Users, 
  Send,
  X,
  Phone,
  HelpCircle,
  Clock
} from 'lucide-react';
import { QrCodeSvg } from './QrCodeSvg';
import { toast } from '@/lib/toast';
import { api } from '@/lib/api';

interface FormFieldItem {
  id: string;
  label: string;
  type: 'text' | 'phone' | 'email' | 'number' | 'select' | 'textarea' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[];
  isSystem?: boolean;
}

interface FormRecord {
  id: string;
  title: string;
  description?: string | null;
  slug: string;
  fields: FormFieldItem[];
  tag?: string | null;
  isActive: boolean;
  autoReplyEnabled: boolean;
  autoReplyInstance?: string | null;
  autoReplyTemplate?: string | null;
  submissionCount: number;
  createdAt: string;
}

export function FormBuilderView() {
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<any[]>([]);

  // Modals state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedFormForQr, setSelectedFormForQr] = useState<FormRecord | null>(null);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Editor State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [tag, setTag] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyInstance, setAutoReplyInstance] = useState('');
  const [autoReplyTemplate, setAutoReplyTemplate] = useState(
    'Hi {name}! Thank you for your inquiry. Our team will assist you shortly.'
  );
  const [fields, setFields] = useState<FormFieldItem[]>([]);

  // Fetch all forms
  const loadForms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/forms');
      if (res.data?.success) {
        setForms(res.data.forms || []);
      }
    } catch (err: any) {
      toast.error('Failed to load forms list');
    } finally {
      setLoading(false);
    }
  };

  // Fetch instances for auto-reply selector
  const loadInstances = async () => {
    try {
      const res = await api.get('/api/instances');
      if (res.data?.instances) {
        setInstances(res.data.instances);
      }
    } catch {}
  };

  useEffect(() => {
    loadForms();
    loadInstances();
  }, []);

  // Initialize new form
  const handleOpenCreate = () => {
    setEditingFormId(null);
    setTitle('');
    setDescription('');
    setSlug('');
    setTag('');
    setIsActive(true);
    setAutoReplyEnabled(false);
    setAutoReplyInstance(instances[0]?.name || '');
    setAutoReplyTemplate('Hi {name}! Thank you for your inquiry. Our team will assist you shortly.');
    setFields([
      { id: 'f_name', label: 'Full Name', type: 'text', required: true, placeholder: 'Enter your name', isSystem: true },
      { id: 'f_phone', label: 'WhatsApp Number', type: 'phone', required: true, placeholder: '9876543210', isSystem: true },
    ]);
    setEditModalOpen(true);
  };

  // Open edit modal
  const handleOpenEdit = (form: FormRecord) => {
    setEditingFormId(form.id);
    setTitle(form.title);
    setDescription(form.description || '');
    setSlug(form.slug);
    setTag(form.tag || '');
    setIsActive(form.isActive);
    setAutoReplyEnabled(form.autoReplyEnabled);
    setAutoReplyInstance(form.autoReplyInstance || (instances[0]?.name || ''));
    setAutoReplyTemplate(form.autoReplyTemplate || 'Hi {name}! Thank you for your inquiry. Our team will assist you shortly.');
    setFields(form.fields || []);
    setEditModalOpen(true);
  };

  // Add field
  const handleAddField = (type: FormFieldItem['type']) => {
    const fieldCount = fields.length + 1;
    const newField: FormFieldItem = {
      id: `f_${type}_${Date.now().toString(36)}`,
      label: type === 'select' ? 'Select Option' : type === 'email' ? 'Email Address' : type === 'number' ? 'Quantity' : `Custom ${type.toUpperCase()}`,
      type,
      required: false,
      placeholder: type === 'select' ? 'Choose...' : '',
      options: type === 'select' ? ['Option 1', 'Option 2', 'Option 3'] : undefined,
    };
    setFields([...fields, newField]);
  };

  // Update field
  const handleUpdateField = (index: number, updates: Partial<FormFieldItem>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...updates };
    setFields(next);
  };

  // Reorder field
  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const next = [...fields];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setFields(next);
  };

  // Remove field
  const handleRemoveField = (index: number) => {
    if (fields[index].isSystem) {
      toast.error('System core fields (Name and WhatsApp Number) cannot be removed.');
      return;
    }
    setFields(fields.filter((_, i) => i !== index));
  };

  // Toggle active
  const handleToggleActive = async (form: FormRecord) => {
    try {
      const res = await api.put(`/api/forms/${form.id}`, { isActive: !form.isActive });
      if (res.data?.success) {
        setForms(forms.map((f) => (f.id === form.id ? { ...f, isActive: !form.isActive } : f)));
        toast.success(`Form is now ${!form.isActive ? 'Active' : 'Paused'}`);
      }
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  // Save form (Create or Update)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Form title is required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        slug: slug.trim() || undefined,
        tag: tag.trim() || null,
        isActive,
        autoReplyEnabled,
        autoReplyInstance: autoReplyEnabled ? autoReplyInstance : null,
        autoReplyTemplate: autoReplyEnabled ? autoReplyTemplate : null,
        fields,
      };

      if (editingFormId) {
        const res = await api.put(`/api/forms/${editingFormId}`, payload);
        if (res.data?.success) {
          toast.success('Form updated successfully');
          setEditModalOpen(false);
          loadForms();
        }
      } else {
        const res = await api.post('/api/forms', payload);
        if (res.data?.success) {
          toast.success('New form created successfully');
          setEditModalOpen(false);
          loadForms();
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  // Delete form
  const handleDeleteForm = async (id: string) => {
    if (!confirm('Are you sure you want to delete this form? Existing CRM leads will be preserved.')) return;
    try {
      const res = await api.delete(`/api/forms/${id}`);
      if (res.data?.success) {
        toast.success('Form deleted successfully');
        setForms(forms.filter((f) => f.id !== id));
      }
    } catch {
      toast.error('Failed to delete form');
    }
  };

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-indigo-400" />
            Custom Lead Forms & Public Share Links
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Build branded lead generation forms, generate public share URLs & QR codes, and trigger instant WhatsApp auto-replies.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Custom Form
        </button>
      </div>

      {/* Forms Table / Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">
          Loading custom forms...
        </div>
      ) : forms.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1.5">No Lead Forms Created Yet</h3>
          <p className="text-xs text-slate-400 mb-6">
            Create your first custom form to capture WhatsApp-verified leads from social media, posters, or website links.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            Build My First Form
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => {
            const publicUrl = `${originUrl}/f/${form.slug}`;

            return (
              <div
                key={form.id}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-bold text-white line-clamp-1">
                      {form.title}
                    </h3>
                    <span
                      onClick={() => handleToggleActive(form)}
                      className={`cursor-pointer px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase transition-colors ${
                        form.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {form.isActive ? 'Active' : 'Closed'}
                    </span>
                  </div>

                  {form.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                      {form.description}
                    </p>
                  )}

                  {/* Submission & Tag Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-medium flex items-center gap-1.5">
                      <Users className="w-3 h-3" />
                      {form.submissionCount} Submissions
                    </span>

                    {form.tag && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono">
                        #{form.tag}
                      </span>
                    )}

                    {form.autoReplyEnabled && (
                      <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        Auto-Reply ON
                      </span>
                    )}
                  </div>

                  {/* Share Link Preview Box */}
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl mb-4 flex items-center justify-between text-xs font-mono text-slate-400">
                    <span className="truncate mr-2 text-[11px] text-slate-300 select-all">
                      {publicUrl}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(publicUrl);
                        toast.success('Form share link copied!');
                      }}
                      className="p-1 hover:text-white transition-colors"
                      title="Copy Public Link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedFormForQr(form);
                        setQrModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      QR Code
                    </button>

                    <a
                      href={`/f/${form.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Preview
                    </a>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(form)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                      title="Edit Form"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteForm(form.id)}
                      className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
                      title="Delete Form"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR CODE MODAL */}
      {qrModalOpen && selectedFormForQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setQrModalOpen(false);
                setSelectedFormForQr(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-1">
              Public Form QR Code
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Print or share this QR code on flyers, packaging, or counter stands.
            </p>

            <QrCodeSvg
              url={`${originUrl}/f/${selectedFormForQr.slug}`}
              title={selectedFormForQr.title}
              size={220}
            />
          </div>
        </div>
      )}

      {/* CREATE / EDIT FORM BUILDER MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl my-8 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-white mb-1">
              {editingFormId ? 'Edit Custom Lead Form' : 'Build New Lead Form'}
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Configure inputs, set custom share slugs, and customize WhatsApp instant welcome replies.
            </p>

            <form onSubmit={handleSaveForm} className="space-y-6">
              {/* Basic Metadata */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Form Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Diwali Mega Offer Inquiry"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Description / Banner Subtitle (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Shown at the top of the public form to give context..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Custom URL Slug
                    </label>
                    <div className="flex items-center">
                      <span className="text-xs text-slate-500 font-mono pl-3 py-2.5 bg-slate-950 border border-r-0 border-slate-800 rounded-l-xl">
                        /f/
                      </span>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="diwali-offer-2026"
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-r-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Auto-Tag in CRM
                    </label>
                    <input
                      type="text"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      placeholder="e.g. diwali-leads"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* VISUAL FIELD BUILDER */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    Form Fields Schema ({fields.length})
                  </h3>

                  {/* Add Field Dropdown Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddField('text')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
                    >
                      + Text
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddField('number')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
                    >
                      + Number
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddField('email')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
                    >
                      + Email
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddField('select')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
                    >
                      + Select
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddField('textarea')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
                    >
                      + Textarea
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddField('checkbox')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
                    >
                      + Checkbox
                    </button>
                  </div>
                </div>

                {/* Fields List */}
                <div className="space-y-2.5">
                  {fields.map((field, idx) => (
                    <div
                      key={field.id}
                      className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-[10px] font-mono text-slate-500 w-5">
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => handleUpdateField(idx, { label: e.target.value })}
                            className="bg-transparent border-b border-slate-700 focus:border-indigo-400 text-xs font-semibold text-white px-1 py-0.5 focus:outline-none flex-1"
                          />
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-800 text-slate-400">
                            {field.type}
                          </span>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-[11px] text-slate-400 select-none cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.required}
                              disabled={field.isSystem}
                              onChange={(e) => handleUpdateField(idx, { required: e.target.checked })}
                              className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                            />
                            Required
                          </label>

                          <button
                            type="button"
                            onClick={() => handleMoveField(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 hover:text-white disabled:opacity-20 text-slate-400"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveField(idx, 'down')}
                            disabled={idx === fields.length - 1}
                            className="p-1 hover:text-white disabled:opacity-20 text-slate-400"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          {!field.isSystem && (
                            <button
                              type="button"
                              onClick={() => handleRemoveField(idx)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Placeholder / Extra Settings */}
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={(e) => handleUpdateField(idx, { placeholder: e.target.value })}
                          placeholder="Placeholder text..."
                          className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none"
                        />

                        {/* Options editor for Select */}
                        {field.type === 'select' && (
                          <input
                            type="text"
                            value={(field.options || []).join(', ')}
                            onChange={(e) =>
                              handleUpdateField(idx, {
                                options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean),
                              })
                            }
                            placeholder="Options (comma-separated)..."
                            className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none font-mono"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* INSTANT WHATSAPP AUTO-REPLY PANEL */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                      Instant WhatsApp Auto-Reply
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Automatically message the lead as soon as they submit the form.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoReplyEnabled}
                      onChange={(e) => setAutoReplyEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {autoReplyEnabled && (
                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Dispatch WhatsApp Instance
                      </label>
                      <select
                        value={autoReplyInstance}
                        onChange={(e) => setAutoReplyInstance(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                      >
                        {instances.map((i) => (
                          <option key={i.id || i.name} value={i.name}>
                            {i.name} ({i.status || 'CONNECTED'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-300">
                          Welcome Message Template
                        </label>
                        {/* Dynamic Field Chips */}
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setAutoReplyTemplate((prev) => `${prev} {name}`)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-indigo-400"
                          >
                            +{'{name}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAutoReplyTemplate((prev) => `${prev} {phone}`)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-emerald-400"
                          >
                            +{'{phone}'}
                          </button>
                          {fields.filter((f) => !f.isSystem).map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setAutoReplyTemplate((prev) => `${prev} {${f.id}}`)}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300"
                            >
                              +{`{${f.id}}`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        rows={3}
                        value={autoReplyTemplate}
                        onChange={(e) => setAutoReplyTemplate(e.target.value)}
                        placeholder="Hi {name}! Thanks for reaching out..."
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingFormId ? 'Update Form' : 'Publish Form'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
