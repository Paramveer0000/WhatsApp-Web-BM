'use client';

import React, { useState, useEffect } from 'react';
import {
  Columns as ColumnsIcon,
  Plus,
  Type,
  Hash,
  Calendar,
  ListFilter,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  Sparkles,
} from 'lucide-react';
import { toast } from '@/lib/toast';

export interface CrmCustomFieldItem {
  id: string;
  name: string;
  key: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN';
  options?: string | null;
  description?: string | null;
  isVisible: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export function SmartColumnsView() {
  const [columns, setColumns] = useState<CrmCustomFieldItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState<CrmCustomFieldItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formType, setFormType] = useState<'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN'>('TEXT');
  const [formDescription, setFormDescription] = useState('Direct input field');
  const [formIsVisible, setFormIsVisible] = useState(true);
  const [formOptions, setFormOptions] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchColumns = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/crm/columns');
      const data = await res.json();
      if (data.success && Array.isArray(data.columns)) {
        setColumns(data.columns);
      }
    } catch {
      toast.error('Failed to load custom fields');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColumns();
  }, []);

  const openAddModal = () => {
    setEditingField(null);
    setFormName('');
    setFormKey('');
    setFormType('TEXT');
    setFormDescription('Direct input field');
    setFormIsVisible(true);
    setFormOptions('');
    setShowModal(true);
  };

  const openEditModal = (field: CrmCustomFieldItem) => {
    setEditingField(field);
    setFormName(field.name);
    setFormKey(field.key);
    setFormType(field.type);
    setFormDescription(field.description || 'Direct input field');
    setFormIsVisible(field.isVisible);
    let opts = '';
    if (field.options) {
      try {
        const parsed = JSON.parse(field.options);
        opts = Array.isArray(parsed) ? parsed.join(', ') : field.options;
      } catch {
        opts = field.options;
      }
    }
    setFormOptions(opts);
    setShowModal(true);
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setSubmitting(true);
    try {
      const optionsArray = formType === 'DROPDOWN' && formOptions.trim()
        ? formOptions.split(',').map((s) => s.trim()).filter(Boolean)
        : null;

      if (editingField) {
        // PUT update
        const res = await fetch('/api/crm/columns', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingField.id,
            name: formName.trim(),
            description: formDescription.trim(),
            isVisible: formIsVisible,
            options: optionsArray,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update field');
        toast.success(`Custom column "${formName}" updated!`, 'Field Updated');
      } else {
        // POST create
        const res = await fetch('/api/crm/columns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            key: formKey.trim() || undefined,
            type: formType,
            description: formDescription.trim(),
            isVisible: formIsVisible,
            options: optionsArray,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create field');
        toast.success(`Custom column "${formName}" created!`, 'Field Added');
      }

      setShowModal(false);
      fetchColumns();
    } catch (err: any) {
      toast.error(err.message, 'Operation Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVisibility = async (field: CrmCustomFieldItem) => {
    try {
      const res = await fetch('/api/crm/columns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: field.id,
          isVisible: !field.isVisible,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to toggle visibility');

      setColumns((prev) =>
        prev.map((c) => (c.id === field.id ? { ...c, isVisible: !c.isVisible } : c))
      );
      toast.success(
        `Field "${field.name}" is now ${!field.isVisible ? 'visible' : 'hidden'} in contacts table`,
        'Visibility Updated'
      );
    } catch (err: any) {
      toast.error(err.message, 'Toggle Failed');
    }
  };

  const handleDeleteField = async (field: CrmCustomFieldItem) => {
    if (!confirm(`Are you sure you want to delete column "${field.name}"? Data in contact records for this column will remain in their raw JSON.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/crm/columns?id=${field.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete field');

      toast.success(`Custom column "${field.name}" deleted`, 'Column Removed');
      setColumns((prev) => prev.filter((c) => c.id !== field.id));
    } catch (err: any) {
      toast.error(err.message, 'Delete Failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header matching Zolo Suit Manage Columns */}
      <div>
        <div className="text-[11px] font-medium text-slate-400 day:text-slate-500 mb-1 flex items-center gap-1.5">
          <span>Dashboard</span>
          <span>&gt;</span>
          <span>Manage</span>
          <span>&gt;</span>
          <span className="text-white day:text-slate-900 font-semibold">Columns</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0c57e4] flex items-center justify-center text-white shadow-lg shadow-blue-900/30">
              <ColumnsIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white day:text-slate-900 flex items-center gap-2">
                Smart Columns
              </h1>
              <p className="text-xs text-slate-400 day:text-slate-600">
                Customize your CRM database schema with dynamic fields
              </p>
            </div>
          </div>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-[#0c57e4] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-900/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Custom Field</span>
          </button>
        </div>
      </div>

      {/* Schema Header Section */}
      <div className="flex items-center justify-between border-b border-slate-800 day:border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-300 day:text-slate-700 uppercase tracking-wider">
            Active Schema Layout
          </span>
        </div>
        <span className="text-xs font-mono text-slate-400 day:text-slate-600">
          {columns.length} FIELDS DEFINED
        </span>
      </div>

      {/* Grid of Dynamic Field Cards (Matching Zolo Suit Columns Card Style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            Loading custom columns...
          </div>
        ) : columns.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/50 day:bg-slate-100 rounded-2xl border border-dashed border-slate-800 day:border-slate-300">
            <p className="text-sm font-semibold mb-1">No custom columns defined yet</p>
            <p className="text-xs text-slate-400 mb-4">Add fields like Company, City, Budget, or Designation to extend contact records.</p>
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-[#0c57e4] text-white rounded-xl text-xs font-bold"
            >
              + Add Custom Field
            </button>
          </div>
        ) : (
          columns.map((col) => (
            <div
              key={col.id}
              className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl p-5 shadow-xl space-y-4 hover:border-slate-700 day:hover:border-slate-300 transition"
            >
              {/* Card Top: Name & Visible Badge */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white day:text-slate-900">
                    {col.name}
                  </h3>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                    key: {col.key}
                  </p>
                </div>

                {col.isVisible ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    VISIBLE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    HIDDEN
                  </span>
                )}
              </div>

              {/* Type Badge & Description (Matching Screenshot) */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 day:text-slate-700">
                  {col.type === 'TEXT' && <Type className="w-3.5 h-3.5 text-blue-400" />}
                  {col.type === 'NUMBER' && <Hash className="w-3.5 h-3.5 text-emerald-400" />}
                  {col.type === 'DATE' && <Calendar className="w-3.5 h-3.5 text-purple-400" />}
                  {col.type === 'DROPDOWN' && <ListFilter className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{col.type}</span>
                </div>
                <p className="text-xs text-slate-400 day:text-slate-500">
                  {col.description || 'Direct input field'}
                </p>
              </div>

              {/* Card Actions: Edit & Delete */}
              <div className="pt-3 border-t border-slate-800 day:border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openEditModal(col)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white day:hover:text-slate-900 transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleToggleVisibility(col)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-blue-400 transition cursor-pointer"
                  >
                    {col.isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{col.isVisible ? 'Hide' : 'Show'}</span>
                  </button>
                </div>

                <button
                  onClick={() => handleDeleteField(col)}
                  className="flex items-center gap-1 text-xs font-semibold text-rose-400/80 hover:text-rose-400 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Custom Field Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 day:border-slate-200">
              <h2 className="text-base font-bold text-white day:text-slate-900 flex items-center gap-2">
                <ColumnsIcon className="w-4 h-4 text-[#0c57e4]" />
                <span>{editingField ? `Edit Column: ${editingField.name}` : 'Add Custom Field'}</span>
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveField} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-300 day:text-slate-700 block mb-1">
                  Field Display Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (!editingField) {
                      setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                    }
                  }}
                  placeholder="e.g. Budget, City, Company"
                  className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl p-2.5 text-white day:text-slate-900 focus:outline-none focus:border-[#0c57e4]"
                  required
                />
              </div>

              {!editingField && (
                <div>
                  <label className="font-semibold text-slate-300 day:text-slate-700 block mb-1">
                    Database Key Identifier
                  </label>
                  <input
                    type="text"
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                    placeholder="e.g. budget, city, company"
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl p-2.5 font-mono text-slate-400"
                  />
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-300 day:text-slate-700 block mb-1">
                  Field Data Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  disabled={Boolean(editingField)}
                  className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl p-2.5 text-white day:text-slate-900 focus:outline-none focus:border-[#0c57e4]"
                >
                  <option value="TEXT">TEXT (Single line text / string)</option>
                  <option value="NUMBER">NUMBER (Numeric values / currency)</option>
                  <option value="DATE">DATE (Calendar date)</option>
                  <option value="DROPDOWN">DROPDOWN (Selection list)</option>
                </select>
              </div>

              {formType === 'DROPDOWN' && (
                <div>
                  <label className="font-semibold text-slate-300 day:text-slate-700 block mb-1">
                    Dropdown Options (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={formOptions}
                    onChange={(e) => setFormOptions(e.target.value)}
                    placeholder="e.g. Retail, Wholesale, Enterprise, Student"
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl p-2.5 text-white day:text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-300 day:text-slate-700 block mb-1">
                  Help Text / Description
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Direct input field"
                  className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl p-2.5 text-white day:text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isVisibleCheck"
                  checked={formIsVisible}
                  onChange={(e) => setFormIsVisible(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0c57e4] focus:ring-0 bg-slate-950 border-slate-700 cursor-pointer"
                />
                <label htmlFor="isVisibleCheck" className="text-xs text-slate-300 day:text-slate-700 cursor-pointer">
                  Display as active column in Contacts & Leads table
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800 day:border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formName.trim()}
                  className="px-5 py-2 bg-[#0c57e4] hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl font-bold transition shadow-md shadow-blue-900/30"
                >
                  {submitting ? 'Saving...' : editingField ? 'Save Changes' : 'Create Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

