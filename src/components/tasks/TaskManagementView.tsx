'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Clock,
  Calendar,
  AlertCircle,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  Trash2,
  Edit2,
  Phone,
  User,
  MessageSquare,
  RefreshCw,
  X,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface CrmTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  assignedTo: string | null;
  contactPhone: string | null;
  dealId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function TaskManagementView() {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, pending: 0, completed: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('PENDING');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);
  const [savingTask, setSavingTask] = useState(false);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formPriority, setFormPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [formAssignedTo, setFormAssignedTo] = useState('Param');
  const [formContactPhone, setFormContactPhone] = useState('');

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();

      if (data.success) {
        setTasks(data.tasks || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err: any) {
      toast.error('Failed to load CRM tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter, priorityFilter, searchQuery]);

  const openCreateModal = () => {
    setEditingTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormDueDate('');
    setFormPriority('MEDIUM');
    setFormAssignedTo('Param');
    setFormContactPhone('');
    setShowTaskModal(true);
  };

  const openEditModal = (task: CrmTask) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
    setFormPriority(task.priority);
    setFormAssignedTo(task.assignedTo || 'Param');
    setFormContactPhone(task.contactPhone || '');
    setShowTaskModal(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    try {
      setSavingTask(true);
      const payload: any = {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        dueDate: formDueDate ? new Date(formDueDate).toISOString() : null,
        priority: formPriority,
        assignedTo: formAssignedTo.trim() || 'Param',
        contactPhone: formContactPhone.trim() || null,
      };

      if (editingTask) {
        payload.id = editingTask.id;
        const res = await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update task');
        toast.success('Task updated successfully');
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create task');
        toast.success('Task created successfully');
      }

      setShowTaskModal(false);
      fetchTasks();
    } catch (err: any) {
      toast.error(err.message || 'Error saving task');
    } finally {
      setSavingTask(false);
    }
  };

  const toggleTaskStatus = async (task: CrmTask) => {
    try {
      const nextStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: nextStatus }),
      });
      if (!res.ok) throw new Error('Failed to toggle status');

      toast.success(nextStatus === 'COMPLETED' ? 'Task marked complete! 🎉' : 'Task marked pending');
      fetchTasks();
    } catch (err: any) {
      toast.error('Could not update task status');
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete task');
      toast.success('Task removed');
      fetchTasks();
    } catch (err: any) {
      toast.error('Could not delete task');
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400">
            High Priority
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
            Medium
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400">
            Low
          </span>
        );
    }
  };

  const renderDueDate = (dueDateStr: string | null) => {
    if (!dueDateStr) return <span className="text-slate-500 text-xs">No due date</span>;
    const due = new Date(dueDateStr);
    const now = new Date();
    const isOverdue = due.getTime() < now.getTime();
    const isToday = due.toDateString() === now.toDateString();

    return (
      <span
        className={`flex items-center gap-1 text-xs font-medium ${
          isOverdue
            ? 'text-rose-400'
            : isToday
            ? 'text-amber-400'
            : 'text-slate-400 day:text-slate-600'
        }`}
      >
        <Calendar className="w-3.5 h-3.5" />
        {isOverdue && <span className="font-bold">[Overdue]</span>}
        {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Stats Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 dark:bg-slate-900/90 day:bg-white border border-slate-800 day:border-slate-200 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-950/40">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white day:text-slate-900 tracking-tight">
              Task & Follow-up Management
            </h2>
            <p className="text-xs text-slate-400 day:text-slate-500">
              Track CRM follow-ups, client callbacks, and broadcast campaign tasks
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-950/30 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Metrics Counter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/70 day:bg-white border border-slate-800 day:border-slate-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 day:text-slate-500 font-medium">Pending Tasks</p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">{metrics.pending}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 day:bg-white border border-slate-800 day:border-slate-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 day:text-slate-500 font-medium">Completed</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{metrics.completed}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 day:bg-white border border-slate-800 day:border-slate-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 day:text-slate-500 font-medium">Total Tracked</p>
            <h3 className="text-2xl font-bold text-white day:text-slate-900 mt-1">{metrics.total}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/70 day:bg-white border border-slate-800 day:border-slate-200 p-3 rounded-xl">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'PENDING', label: 'Pending' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'ALL', label: 'All Tasks' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-400 day:text-slate-600 hover:text-white day:hover:text-slate-900 hover:bg-slate-800 day:hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-800 day:bg-slate-200 mx-1 hidden sm:block" />

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-800 day:bg-slate-100 border border-slate-700 day:border-slate-300 rounded-lg px-2.5 py-1 text-xs text-white day:text-slate-800"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tasks or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/80 day:bg-slate-50 border border-slate-700/80 day:border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white day:text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <p className="text-xs">Loading tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center p-8 bg-slate-900/50 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 day:bg-slate-200 flex items-center justify-center text-slate-400 day:text-slate-500 mb-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-white day:text-slate-900">All clear! No tasks found</h3>
          <p className="text-xs text-slate-400 day:text-slate-500 max-w-sm mt-1 mb-4">
            {searchQuery
              ? 'No tasks matched your search filter.'
              : 'Add scheduled follow-ups, client reminders, and outreach assignments.'}
          </p>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create a Task</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((task) => {
            const isCompleted = task.status === 'COMPLETED';

            return (
              <div
                key={task.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border transition-all ${
                  isCompleted
                    ? 'bg-slate-900/40 day:bg-slate-50/60 border-slate-800/60 day:border-slate-200 opacity-60'
                    : 'bg-slate-900/80 day:bg-white border-slate-800 day:border-slate-200 hover:border-blue-500/40'
                }`}
              >
                {/* Checkbox and Title Details */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <button
                    onClick={() => toggleTaskStatus(task)}
                    className="mt-0.5 text-slate-400 hover:text-emerald-400 transition cursor-pointer shrink-0"
                    title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4
                        className={`text-sm font-medium ${
                          isCompleted
                            ? 'line-through text-slate-400 day:text-slate-500'
                            : 'text-white day:text-slate-900'
                        }`}
                      >
                        {task.title}
                      </h4>
                      {getPriorityBadge(task.priority)}
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-400 day:text-slate-600 line-clamp-1">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-slate-400 day:text-slate-500 pt-1 flex-wrap">
                      {renderDueDate(task.dueDate)}

                      {task.contactPhone && (
                        <a
                          href={`https://wa.me/${task.contactPhone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-emerald-400 hover:underline"
                        >
                          <Phone className="w-3 h-3" />
                          <span>+{task.contactPhone}</span>
                        </a>
                      )}

                      {task.assignedTo && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{task.assignedTo}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => openEditModal(task)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white day:hover:text-slate-900 hover:bg-slate-800 day:hover:bg-slate-100 transition"
                    title="Edit task"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 day:hover:bg-slate-100 transition"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Creation / Edit Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 day:border-slate-200">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-sm text-white day:text-slate-900">
                  {editingTask ? 'Edit Task' : 'Create New CRM Task'}
                </h3>
              </div>
              <button
                onClick={() => setShowTaskModal(false)}
                className="text-slate-400 hover:text-white day:hover:text-slate-800 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 day:text-slate-700 mb-1">
                  Task Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Follow up on custom API quote"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-800 day:bg-slate-50 border border-slate-700 day:border-slate-300 rounded-xl px-3.5 py-2 text-xs text-white day:text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 day:text-slate-700 mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Additional context or notes regarding this follow-up..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-800 day:bg-slate-50 border border-slate-700 day:border-slate-300 rounded-xl px-3.5 py-2 text-xs text-white day:text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 day:text-slate-700 mb-1">
                    Due Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full bg-slate-800 day:bg-slate-50 border border-slate-700 day:border-slate-300 rounded-xl px-3.5 py-2 text-xs text-white day:text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 day:text-slate-700 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full bg-slate-800 day:bg-slate-50 border border-slate-700 day:border-slate-300 rounded-xl px-3.5 py-2 text-xs text-white day:text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 day:text-slate-700 mb-1">
                    Contact Phone (WhatsApp)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 919876543210"
                    value={formContactPhone}
                    onChange={(e) => setFormContactPhone(e.target.value)}
                    className="w-full bg-slate-800 day:bg-slate-50 border border-slate-700 day:border-slate-300 rounded-xl px-3.5 py-2 text-xs text-white day:text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 day:text-slate-700 mb-1">
                    Assigned Agent
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Param"
                    value={formAssignedTo}
                    onChange={(e) => setFormAssignedTo(e.target.value)}
                    className="w-full bg-slate-800 day:bg-slate-50 border border-slate-700 day:border-slate-300 rounded-xl px-3.5 py-2 text-xs text-white day:text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800 day:border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white day:hover:text-slate-800 hover:bg-slate-800 day:hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTask}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition cursor-pointer"
                >
                  {savingTask ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

