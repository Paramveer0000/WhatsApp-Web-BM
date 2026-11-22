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
  MessageSquare, 
  CheckCircle2, 
  Layers, 
  Users, 
  Send,
  X,
  Phone,
  HelpCircle,
  Clock,
  Eye,
  Settings,
  Calendar,
  Star,
  Hash,
  Mail,
  Type,
  AlignLeft,
  ChevronDown,
  Radio,
  CheckSquare,
  Minus,
  Sliders,
  Globe,
  Share2,
  Smartphone
} from 'lucide-react';
import { QrCodeSvg } from './QrCodeSvg';
import { toast } from '@/lib/toast';
import { api } from '@/lib/api';
import { FormFieldDefinition, FormFieldType, isFieldVisible } from '@/lib/forms';

interface FormRecord {
  id: string;
  title: string;
  description?: string | null;
  slug: string;
  fields: FormFieldDefinition[];
  tag?: string | null;
  isActive: boolean;
  autoReplyEnabled: boolean;
  autoReplyInstance?: string | null;
  autoReplyTemplate?: string | null;
  submissionCount: number;
  createdAt: string;
}

const FIELD_TYPE_CONFIG: Record<
  FormFieldType,
  { label: string; icon: any; defaultLabel: string; hasOptions?: boolean }
> = {
  text: { label: 'Short Text', icon: Type, defaultLabel: 'Short Question' },
  textarea: { label: 'Paragraph', icon: AlignLeft, defaultLabel: 'Detailed Description' },
  phone: { label: 'WhatsApp Number', icon: Phone, defaultLabel: 'WhatsApp Number' },
  email: { label: 'Email Address', icon: Mail, defaultLabel: 'Email Address' },
  number: { label: 'Number / Budget', icon: Hash, defaultLabel: 'Estimated Budget' },
  select: { label: 'Dropdown', icon: ChevronDown, defaultLabel: 'Select Option', hasOptions: true },
  radio: { label: 'Single Choice', icon: Radio, defaultLabel: 'Choose One Service', hasOptions: true },
  checkbox_group: { label: 'Multi-Checkboxes', icon: CheckSquare, defaultLabel: 'Services Interested In', hasOptions: true },
  date: { label: 'Date Picker', icon: Calendar, defaultLabel: 'Preferred Appointment Date' },
  rating: { label: 'Star Rating', icon: Star, defaultLabel: 'How urgent is your requirement?' },
  section_header: { label: 'Section Header', icon: Minus, defaultLabel: 'Project Information' },
  checkbox: { label: 'Consent Checkbox', icon: Check, defaultLabel: 'I agree to receive updates via WhatsApp' },
};

export function FormBuilderView() {
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<any[]>([]);

  // Modals state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'fields' | 'settings' | 'preview'>('fields');
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
    'Hi {name}! Thank you for your inquiry. Our team will assist you shortly on WhatsApp.'
  );
  const [fields, setFields] = useState<FormFieldDefinition[]>([]);
  const [newOptionInputs, setNewOptionInputs] = useState<Record<number, string>>({});

  // Preview Test State
  const [previewData, setPreviewData] = useState<Record<string, any>>({});

  // Fetch all forms
  const loadForms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/forms', { silent: true });
      if (res?.success || res?.data?.success) {
        setForms(res.forms || res.data?.forms || []);
      }
    } catch {
      // Handled silently to avoid noisy toasts during server restarts
    } finally {
      setLoading(false);
    }
  };

  const loadInstances = async () => {
    try {
      const res = await api.get('/api/instances', { silent: true });
      if (res?.instances || res?.data?.instances) {
        setInstances(res.instances || res.data?.instances || []);
      }
    } catch {}
  };

  useEffect(() => {
    loadForms();
    loadInstances();
  }, []);

  // Initialize new form with standard modern lead generation template
  const handleOpenCreate = () => {
    setEditingFormId(null);
    setTitle('New Lead Inquiry');
    setDescription('Please fill in your requirements below and our team will get in touch.');
    setSlug('');
    setTag('');
    setIsActive(true);
    setAutoReplyEnabled(false);
    setAutoReplyInstance(instances[0]?.name || '');
    setAutoReplyTemplate('Hi {name}! Thank you for your inquiry. Our team will assist you shortly.');
    setActiveTab('fields');
    setFields([
      { 
        id: 'f_name', 
        label: 'Full Name', 
        type: 'text', 
        required: true, 
        placeholder: 'Enter your name', 
        width: 'half', 
        isSystem: true 
      },
      { 
        id: 'f_phone', 
        label: 'WhatsApp Number', 
        type: 'phone', 
        required: true, 
        placeholder: '9876543210', 
        helpText: 'We will send your quotes directly on this WhatsApp number',
        width: 'half', 
        isSystem: true 
      },
      {
        id: 'f_email',
        label: 'Email Address',
        type: 'email',
        required: false,
        placeholder: 'name@example.com',
        width: 'half',
      },
      {
        id: 'f_budget',
        label: 'Estimated Budget',
        type: 'select',
        required: false,
        width: 'half',
        options: ['Under ₹25,000', '₹25,000 - ₹1,00,000', '₹1,00,000 - ₹5,00,000', '₹5,00,000+'],
      },
      {
        id: 'f_services',
        label: 'Services Required',
        type: 'checkbox_group',
        required: false,
        width: 'full',
        options: ['WhatsApp Marketing', 'Lead Generation', 'Chatbot Automation', 'CRM Setup'],
      },
      {
        id: 'f_notes',
        label: 'Project Details / Special Requests',
        type: 'textarea',
        required: false,
        placeholder: 'Tell us more about your timeline and expectations...',
        width: 'full',
      }
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
    setAutoReplyTemplate(form.autoReplyTemplate || 'Hi {name}! Thank you for your inquiry.');
    setFields(form.fields || []);
    setActiveTab('fields');
    setEditModalOpen(true);
  };

  // Add field to schema
  const handleAddField = (type: FormFieldType) => {
    const config = FIELD_TYPE_CONFIG[type];
    const newField: FormFieldDefinition = {
      id: `f_${type}_${Date.now().toString(36)}`,
      label: config.defaultLabel,
      type,
      required: false,
      width: type === 'textarea' || type === 'section_header' || type === 'checkbox_group' ? 'full' : 'half',
      placeholder: type === 'select' ? 'Select an option...' : '',
      options: config.hasOptions ? ['Option A', 'Option B', 'Option C'] : undefined,
    };
    setFields([...fields, newField]);
  };

  // Update field property
  const handleUpdateField = (index: number, updates: Partial<FormFieldDefinition>) => {
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

  // Add Option to Select / Radio / Checkbox group
  const handleAddOption = (fieldIdx: number) => {
    const text = (newOptionInputs[fieldIdx] || '').trim();
    if (!text) return;
    const currentOptions = fields[fieldIdx].options || [];
    handleUpdateField(fieldIdx, { options: [...currentOptions, text] });
    setNewOptionInputs((prev) => ({ ...prev, [fieldIdx]: '' }));
  };

  // Remove Option from Select / Radio / Checkbox group
  const handleRemoveOption = (fieldIdx: number, optIdx: number) => {
    const currentOptions = fields[fieldIdx].options || [];
    handleUpdateField(fieldIdx, { options: currentOptions.filter((_, i) => i !== optIdx) });
  };

  // Toggle active
  const handleToggleActive = async (form: FormRecord) => {
    try {
      const res = await api.put(`/api/forms/${form.id}`, { isActive: !form.isActive });
      if (res?.success || res?.data?.success) {
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
      setActiveTab('fields');
      toast.error('Please enter a Form Title before publishing');
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
        if (res?.success || res?.data?.success) {
          toast.success('Form updated successfully');
          setEditModalOpen(false);
          loadForms();
        } else {
          toast.error(res?.error || res?.message || 'Failed to update form');
        }
      } else {
        const res = await api.post('/api/forms', payload);
        if (res?.success || res?.data?.success) {
          toast.success('New form published successfully! 🚀');
          setEditModalOpen(false);
          loadForms();
        } else {
          toast.error(res?.error || res?.message || 'Failed to create form');
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
      if (res?.success || res?.data?.success) {
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
            Build responsive, mobile-first lead capture forms, generate shareable links & QR codes, and trigger WhatsApp auto-replies.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
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
            Create your first custom form to capture WhatsApp-verified leads from posters, ads, or website links.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-md cursor-pointer"
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
                      className="p-1 hover:text-white transition-colors cursor-pointer"
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
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
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
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Edit Form"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteForm(form.id)}
                      className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
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
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl my-8 relative max-h-[92vh] flex flex-col">
            <button
              onClick={() => setEditModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header & Tabs */}
            <div className="pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingFormId ? 'Edit Custom Lead Form' : 'Build Custom Lead Form'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure questions, validation rules, visual width, and auto-replies.
                  </p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('fields')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'fields'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Field Schema ({fields.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'settings'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Form Settings & WhatsApp Reply
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Live Preview
                </button>
              </div>
            </div>

            {/* TAB CONTENT (Scrollable Area) */}
            <div className="flex-1 overflow-y-auto py-5 pr-1 space-y-6">
              {/* TAB 1: FIELD SCHEMA BUILDER */}
              {activeTab === 'fields' && (
                <div className="space-y-6">
                  {/* Basic Form Meta */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
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

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Subtitle / Description (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Shown at the top of the form..."
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Add Field Palette Buttons */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Add Field Question
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(Object.keys(FIELD_TYPE_CONFIG) as FormFieldType[]).map((type) => {
                        const cfg = FIELD_TYPE_CONFIG[type];
                        const Icon = cfg.icon;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleAddField(type)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-[11px] font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Icon className="w-3.5 h-3.5 text-indigo-400" />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Field Cards List */}
                  <div className="space-y-3">
                    {fields.map((field, idx) => {
                      const cfg = FIELD_TYPE_CONFIG[field.type] || FIELD_TYPE_CONFIG.text;
                      const Icon = cfg.icon;

                      return (
                        <div
                          key={field.id}
                          className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3 text-xs shadow-inner"
                        >
                          {/* Card Top Row: Order, Icon, Title, Type, Width, Controls */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800/60">
                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                              <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                                #{idx + 1}
                              </span>
                              <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => handleUpdateField(idx, { label: e.target.value })}
                                placeholder="Question / Field Prompt..."
                                className="bg-transparent border-b border-slate-700 focus:border-indigo-400 text-xs font-bold text-white px-1 py-0.5 focus:outline-none flex-1"
                              />
                              <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-mono bg-slate-800 text-slate-400 shrink-0">
                                {cfg.label}
                              </span>
                            </div>

                            {/* Controls: Required, Width, Move, Delete */}
                            <div className="flex items-center gap-3">
                              {field.type !== 'section_header' && (
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
                              )}

                              {/* Width Selector */}
                              {field.type !== 'section_header' && (
                                <select
                                  value={field.width || 'half'}
                                  onChange={(e) => handleUpdateField(idx, { width: e.target.value as any })}
                                  className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-300 focus:outline-none"
                                >
                                  <option value="half">1/2 Width (Grid)</option>
                                  <option value="full">Full Width</option>
                                </select>
                              )}

                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleMoveField(idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 hover:text-white disabled:opacity-20 text-slate-400 cursor-pointer"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveField(idx, 'down')}
                                  disabled={idx === fields.length - 1}
                                  className="p-1 hover:text-white disabled:opacity-20 text-slate-400 cursor-pointer"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {!field.isSystem && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveField(idx)}
                                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                  title="Delete Field"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Card Second Row: Placeholder & Help text */}
                          {field.type !== 'section_header' && field.type !== 'checkbox' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5 font-medium">
                                  Placeholder text
                                </label>
                                <input
                                  type="text"
                                  value={field.placeholder || ''}
                                  onChange={(e) => handleUpdateField(idx, { placeholder: e.target.value })}
                                  placeholder="e.g. Enter value..."
                                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] text-slate-400 mb-0.5 font-medium">
                                  Helper text / Hint (optional)
                                </label>
                                <input
                                  type="text"
                                  value={field.helpText || ''}
                                  onChange={(e) => handleUpdateField(idx, { helpText: e.target.value })}
                                  placeholder="Explains what to enter..."
                                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none"
                                />
                              </div>
                            </div>
                          )}

                          {/* Card Options Editor (For Dropdown, Radio, Checkbox Group) */}
                          {cfg.hasOptions && (
                            <div className="space-y-2 pt-1">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase">
                                Available Choices ({(field.options || []).length})
                              </label>

                              {/* Options Pills */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(field.options || []).map((opt, optIdx) => (
                                  <span
                                    key={optIdx}
                                    className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 flex items-center gap-1.5"
                                  >
                                    <span>{opt}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOption(idx, optIdx)}
                                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>

                              {/* Add Option Input */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={newOptionInputs[idx] || ''}
                                  onChange={(e) => setNewOptionInputs({ ...newOptionInputs, [idx]: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddOption(idx);
                                    }
                                  }}
                                  placeholder="Type choice and press Enter..."
                                  className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none flex-1 max-w-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddOption(idx)}
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                  + Add Choice
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: FORM SETTINGS & WHATSAPP AUTO-REPLY */}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  {/* Public Slug & Tag */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Custom URL Share Slug
                      </label>
                      <div className="flex items-center">
                        <span className="text-xs text-slate-500 font-mono pl-3 py-2 bg-slate-950 border border-r-0 border-slate-800 rounded-l-xl">
                          /f/
                        </span>
                        <input
                          type="text"
                          value={slug}
                          onChange={(e) => setSlug(e.target.value)}
                          placeholder="diwali-offer-2026"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-r-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Direct public URL: {originUrl}/f/{slug || 'auto-slug'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Auto-Tag in CRM
                      </label>
                      <input
                        type="text"
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                        placeholder="e.g. diwali-leads"
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Auto-tags incoming submissions so you can segment them in Lead CRM.
                      </p>
                    </div>
                  </div>

                  {/* Instant WhatsApp Auto-Reply */}
                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                          Instant WhatsApp Auto-Reply
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Automatically send a WhatsApp message to the respondent immediately upon form submission.
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
                      <div className="space-y-3 pt-2">
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
                            {/* Dynamic Chips */}
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setAutoReplyTemplate((prev) => `${prev} {name}`)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-indigo-400 cursor-pointer"
                              >
                                +{'{name}'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setAutoReplyTemplate((prev) => `${prev} {phone}`)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-emerald-400 cursor-pointer"
                              >
                                +{'{phone}'}
                              </button>
                              {fields.filter((f) => !f.isSystem).map((f) => (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={() => setAutoReplyTemplate((prev) => `${prev} {${f.id}}`)}
                                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 cursor-pointer"
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
                            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: LIVE INTERACTIVE PREVIEW */}
              {activeTab === 'preview' && (
                <div className="max-w-md mx-auto bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                  <div className="text-center pb-2 border-b border-slate-800/80">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                      WhatsApp Verified Inquiry
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">
                      {title || 'Untitled Form'}
                    </h3>
                    {description && (
                      <p className="text-xs text-slate-400 mt-1">{description}</p>
                    )}
                  </div>

                  {/* Render preview inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {fields.map((field) => {
                      const isHalf = field.width === 'half' && field.type !== 'textarea';
                      const val = previewData[field.id] ?? '';

                      if (field.type === 'section_header') {
                        return (
                          <div key={field.id} className="sm:col-span-2 pt-2 border-t border-slate-800 mt-1">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                              {field.label}
                            </h4>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={field.id}
                          className={`${isHalf ? 'sm:col-span-1' : 'sm:col-span-2'} space-y-1`}
                        >
                          <label className="block text-[11px] font-medium text-slate-300">
                            {field.label}
                            {field.required && <span className="text-rose-400 ml-1">*</span>}
                          </label>

                          {field.helpText && (
                            <p className="text-[10px] text-slate-500">{field.helpText}</p>
                          )}

                          {field.type === 'textarea' ? (
                            <textarea
                              rows={2}
                              placeholder={field.placeholder || ''}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none"
                            />
                          ) : field.type === 'select' ? (
                            <select className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none">
                              <option value="">{field.placeholder || 'Select...'}</option>
                              {(field.options || []).map((o, i) => (
                                <option key={i} value={o}>{o}</option>
                              ))}
                            </select>
                          ) : field.type === 'radio' ? (
                            <div className="space-y-1">
                              {(field.options || []).map((o, i) => (
                                <label key={i} className="flex items-center gap-2 p-1.5 bg-slate-900 rounded-lg border border-slate-800 cursor-pointer">
                                  <input type="radio" name={field.id} className="text-indigo-600" />
                                  <span className="text-xs text-slate-300">{o}</span>
                                </label>
                              ))}
                            </div>
                          ) : field.type === 'checkbox_group' ? (
                            <div className="space-y-1">
                              {(field.options || []).map((o, i) => (
                                <label key={i} className="flex items-center gap-2 p-1.5 bg-slate-900 rounded-lg border border-slate-800 cursor-pointer">
                                  <input type="checkbox" className="rounded text-indigo-600" />
                                  <span className="text-xs text-slate-300">{o}</span>
                                </label>
                              ))}
                            </div>
                          ) : field.type === 'rating' ? (
                            <div className="flex items-center gap-1 py-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} className="w-5 h-5 text-amber-400 fill-amber-400 cursor-pointer" />
                              ))}
                            </div>
                          ) : (
                            <input
                              type={field.type === 'phone' ? 'tel' : field.type === 'email' ? 'email' : 'text'}
                              placeholder={field.placeholder || ''}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-2"
                  >
                    <span>Submit & Request Callback</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveForm}
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : editingFormId ? 'Update Form' : 'Publish Form'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
