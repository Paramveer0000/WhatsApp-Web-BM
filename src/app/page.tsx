'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Send, 
  BarChart3, 
  Radio, 
  PlusCircle, 
  Server, 
  Users, 
  MessageSquare, 
  History, 
  Settings as SettingsIcon, 
  LogOut, 
  ShieldCheck, 
  RefreshCw, 
  Play, 
  Pause, 
  Square, 
  Download, 
  Trash2, 
  Copy, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Eye, 
  FileSpreadsheet, 
  Filter, 
  Sparkles, 
  Bold, 
  Italic, 
  Strikethrough, 
  Code,
  Smartphone,
  ShieldAlert,
  Terminal,
  Zap,
  Layers,
  ArrowRight,
  Image as ImageIcon,
  Video,
  FileText,
  Upload,
  CheckCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import * as XLSX from 'xlsx';
import LiveWhatsAppBubble from '@/components/LiveWhatsAppBubble';
import QRCodeModal from '@/components/QRCodeModal';

export default function AppDashboard() {
  const router = useRouter();

  // Active Tab
  const [currentTab, setCurrentTab] = useState<'overview' | 'live' | 'wizard' | 'instances' | 'contacts' | 'replies' | 'history' | 'settings'>('overview');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Global State
  const [instances, setInstances] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  // Live Campaign SSE State
  const [liveStats, setLiveStats] = useState<any>(null);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [jitterInfo, setJitterInfo] = useState<any>(null);
  const [recipientsList, setRecipientsList] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [inspectRecipient, setInspectRecipient] = useState<any>(null);

  // Modal State
  const [qrModalInstance, setQrModalInstance] = useState<string | null>(null);
  const [newInstanceModal, setNewInstanceModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');

  // Contacts & Import State
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactLists, setContactLists] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [importingFile, setImportingFile] = useState(false);
  const [importStats, setImportStats] = useState<any>(null);

  // Settings State
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsSavedMsg, setSettingsSavedMsg] = useState('');

  // Replies Inbox State
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [replyInputText, setReplyInputText] = useState('');

  // Campaign Wizard State
  const [wizName, setWizName] = useState(`Campaign-${Date.now().toString().slice(-4)}`);
  const [wizInstances, setWizInstances] = useState<string[]>([]);
  const [wizListIds, setWizListIds] = useState<string[]>([]);
  const [wizTemplate, setWizTemplate] = useState(
    `{Hi|Hello|Dear} {name|Valued Customer},\n\nWe are pleased to share our newest updates with your team at *{company|your company}*!\n\nUse code: ~OLDCODE~ \`SPECIAL20\` for _20% off_ your order.\n\n{Best regards|Warm wishes},\nMarketing Team`
  );
  const [wizMediaType, setWizMediaType] = useState('text');
  const [wizMediaUrl, setWizMediaUrl] = useState('');
  const [wizFileName, setWizFileName] = useState('');
  const [replyInstance, setReplyInstance] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [syncingReplies, setSyncingReplies] = useState(false);
  const [uploadingChat, setUploadingChat] = useState(false);
  const [wizMinDelay, setWizMinDelay] = useState(12);
  const [wizMaxDelay, setWizMaxDelay] = useState(25);
  const [wizSimulateTyping, setWizSimulateTyping] = useState(true);
  const [wizBatchSize, setWizBatchSize] = useState(30);
  const [wizBatchDuration, setWizBatchDuration] = useState(5);
  const [wizRotation, setWizRotation] = useState('ROUND_ROBIN');
  const [wizConsentConfirmed, setWizConsentConfirmed] = useState(false);
  const [wizLaunching, setWizLaunching] = useState(false);
  const [wizError, setWizError] = useState<string | null>(null);

  // Check Auth
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.push('/login');
        } else {
          setCurrentUser(data.user);
          loadInitialData();
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  // SSE Event Listener for Live Campaign
  useEffect(() => {
    const sse = new EventSource('/api/events');

    sse.addEventListener('progress', (e: any) => {
      try {
        const d = JSON.parse(e.data);
        if (d.campaignId === activeCampaignId) {
          setLiveStats(d.stats);
        }
      } catch {}
    });

    sse.addEventListener('log', (e: any) => {
      try {
        const d = JSON.parse(e.data);
        if (d.campaignId === activeCampaignId && activeCampaignId) {
          setLiveLogs((prev) => [d, ...prev.slice(0, 100)]);
          loadCampaignRecipients(activeCampaignId);
        }
      } catch {}
    });

    sse.addEventListener('jitter', (e: any) => {
      try {
        const d = JSON.parse(e.data);
        if (d.campaignId === activeCampaignId) {
          setJitterInfo(d);
        }
      } catch {}
    });

    return () => {
      sse.close();
    };
  }, [activeCampaignId]);

  const loadInitialData = () => {
    loadInstances();
    loadCampaigns();
    loadAnalytics();
    loadContactsAndLists();
    loadSettings();
    loadReplies();
  };

  const loadInstances = async () => {
    const res = await fetch('/api/evolution/instances');
    const d = await res.json();
    if (d.success) setInstances(d.instances || []);
  };

  const loadCampaigns = async () => {
    const res = await fetch('/api/campaigns');
    const d = await res.json();
    if (d.success) {
      setCampaigns(d.campaigns || []);
      const running = d.campaigns.find((c: any) => c.status === 'RUNNING' || c.status === 'PAUSED');
      if (running && !activeCampaignId) {
        setActiveCampaignId(running.id);
      }
    }
  };

  const loadAnalytics = async () => {
    const res = await fetch('/api/analytics');
    const d = await res.json();
    if (d.success) setAnalytics(d);
  };

  const loadContactsAndLists = async () => {
    const [cRes, lRes, bRes] = await Promise.all([
      fetch('/api/contacts'),
      fetch('/api/lists'),
      fetch('/api/blacklist'),
    ]);
    const cData = await cRes.json();
    const lData = await lRes.json();
    const bData = await bRes.json();

    if (cData.success) setContacts(cData.contacts || []);
    if (lData.success) setContactLists(lData.lists || []);
    if (bData.success) setBlacklist(bData.blacklist || []);
  };

  const loadSettings = async () => {
    const res = await fetch('/api/settings');
    const d = await res.json();
    if (d.success) setSettings(d.settings || {});
  };

  const loadReplies = async () => {
    const res = await fetch('/api/replies');
    const d = await res.json();
    if (d.success) setConversations(d.conversations || []);
  };

  const loadCampaignRecipients = async (campId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campId}/recipients?status=${statusFilter}&search=${encodeURIComponent(recipientSearch)}`);
      const d = await res.json();
      if (d.success) setRecipientsList(d.recipients || []);
    } catch {}
  };

  useEffect(() => {
    if (activeCampaignId) {
      loadCampaignRecipients(activeCampaignId);
    }
  }, [activeCampaignId, statusFilter, recipientSearch]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const downloadSampleCSV = () => {
    const csv = 'phone,name,company,city,tags\n919876543210,Rahul Sharma,Acme Corp,Mumbai,VIP;Lead\n919876543211,Priya Patel,Innovate Ltd,Delhi,Customer\n919876543212,Amit Verma,Alpha Labs,Bangalore,Enterprise\n919876543213,Neha Singh,Logistics Pro,Hyderabad,Partner\n919876543214,Vikram Mehta,Apex Tech,Chennai,Active';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_contacts_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadSampleXLSX = () => {
    const data = [
      { phone: '919876543210', name: 'Rahul Sharma', company: 'Acme Corp', city: 'Mumbai', tags: 'VIP;Lead' },
      { phone: '919876543211', name: 'Priya Patel', company: 'Innovate Ltd', city: 'Delhi', tags: 'Customer' },
      { phone: '919876543212', name: 'Amit Verma', company: 'Alpha Labs', city: 'Bangalore', tags: 'Enterprise' },
      { phone: '919876543213', name: 'Neha Singh', company: 'Logistics Pro', city: 'Hyderabad', tags: 'Partner' },
      { phone: '919876543214', name: 'Vikram Mehta', company: 'Apex Tech', city: 'Chennai', tags: 'Active' },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, 'sample_contacts_template.xlsx');
  };

  const handleSendReply = async () => {
    if (!replyInputText.trim() || !selectedConversation) return;
    const instName = replyInstance || instances[0]?.name;
    if (!instName) {
      alert('Please connect at least one WhatsApp instance to send replies.');
      return;
    }

    setSendingReply(true);
    try {
      const res = await fetch('/api/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedConversation,
          text: replyInputText.trim(),
          instanceName: instName,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to send reply');

      setConversationMessages((prev) => [
        ...prev,
        {
          id: 'REPLY_' + Date.now(),
          type: 'outgoing',
          text: replyInputText.trim(),
          time: new Date(),
          status: 'SENT',
          instance: instName,
        },
      ]);
      setReplyInputText('');
    } catch (err: any) {
      alert('Send reply failed: ' + err.message);
    } finally {
      setSendingReply(false);
    }
  };

  const handleSyncChats = async () => {
    setSyncingReplies(true);
    try {
      const res = await fetch('/api/replies?sync=true');
      const d = await res.json();
      if (d.success) {
        setConversations(d.conversations || []);
        alert(`Synced ${d.conversations?.length || 0} WhatsApp conversations!`);
      } else {
        alert(d.error || 'Sync failed');
      }
    } catch (err: any) {
      alert('Sync failed: ' + err.message);
    } finally {
      setSyncingReplies(false);
    }
  };

  const handleUploadChat = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;

      const lines = content.split(/\r?\n/);
      const parsed: Array<{ date: string; sender: string; text: string; isMe: boolean }> = [];
      const lineRegex = /^(?:\[?(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}[,\s]+\d{1,2}:\d{1,2}(?::\d{1,2})?(?:\s*[AaPp][Mm])?)\]?)[ -]+([^:]+):\s*(.+)$/;

      let currentMsg: { date: string; sender: string; text: string; isMe: boolean } | null = null;

      for (const line of lines) {
        const match = line.match(lineRegex);
        if (match) {
          if (currentMsg) parsed.push(currentMsg);
          const rawDate = match[1];
          const rawSender = match[2].trim();
          const rawText = match[3].trim();
          const isMe =
            /^(you|me|admin|system|bulkflow)/i.test(rawSender) ||
            rawSender.toLowerCase() === (currentUser?.name || '').toLowerCase();

          currentMsg = {
            date: new Date(rawDate).toISOString(),
            sender: rawSender,
            text: rawText,
            isMe,
          };
        } else if (currentMsg && line.trim()) {
          currentMsg.text += '\n' + line.trim();
        }
      }
      if (currentMsg) parsed.push(currentMsg);

      if (parsed.length === 0) {
        alert('Could not parse any messages from this file. Please ensure it is a valid WhatsApp exported .txt chat file.');
        return;
      }

      setUploadingChat(true);
      try {
        const res = await fetch('/api/replies/upload-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: selectedConversation,
            messages: parsed,
          }),
        });
        const d = await res.json();
        if (d.success) {
          alert(`Successfully uploaded ${d.count} previous chat messages!`);
          const threadRes = await fetch(`/api/replies?phone=${encodeURIComponent(selectedConversation)}`);
          const threadData = await threadRes.json();
          if (threadData.success) {
            setConversationMessages(threadData.messages || []);
          }
        } else {
          alert(d.error || 'Failed to save uploaded chat');
        }
      } catch (err: any) {
        alert('Upload failed: ' + err.message);
      } finally {
        setUploadingChat(false);
      }
    };
    reader.readAsText(file);
  };

  // Campaign Control
  const handleCampaignControl = async (campId: string, action: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (!res.ok) alert(d.error || 'Action failed');
      loadCampaigns();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Launch Campaign from Wizard
  const handleLaunchCampaign = async () => {
    try {
      setWizError(null);
      if (!wizName.trim()) throw new Error('Campaign name is required.');
      if (wizInstances.length === 0) throw new Error('Please select at least one WhatsApp instance.');
      if (wizListIds.length === 0) throw new Error('Please select at least one contact list.');
      if (!wizConsentConfirmed) throw new Error('Please confirm opt-in consent compliance.');

      setWizLaunching(true);

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: wizName.trim(),
          instanceIds: wizInstances,
          listIds: wizListIds,
          variants: [{ content: wizTemplate, mediaType: wizMediaType, mediaUrl: wizMediaUrl, fileName: wizFileName || (wizMediaType === 'document' ? 'document.pdf' : undefined) }],
          minDelay: Number(wizMinDelay),
          maxDelay: Number(wizMaxDelay),
          simulateTyping: wizSimulateTyping,
          batchBreakSize: Number(wizBatchSize),
          batchBreakDuration: Number(wizBatchDuration),
          rotationMode: wizRotation,
          consentConfirmed: true,
          launchImmediately: true,
        }),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to create campaign');

      setActiveCampaignId(d.campaign.id);
      loadCampaigns();
      setCurrentTab('live');
    } catch (err: any) {
      setWizError(err.message);
    } finally {
      setWizLaunching(false);
    }
  };

  // Create Instance
  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName.trim()) return;

    try {
      const res = await fetch('/api/evolution/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: newInstanceName.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to create instance');

      setNewInstanceModal(false);
      setQrModalInstance(newInstanceName.trim());
      setNewInstanceName('');
      loadInstances();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to save settings');
      setSettingsSavedMsg('Settings saved successfully!');
      setTimeout(() => setSettingsSavedMsg(''), 3000);
      loadSettings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40">
              <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white tracking-tight">BulkFlow Manager</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  Evolution v2
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Self-Hosted WhatsApp Gateway</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80 text-xs font-medium">
            <button
              onClick={() => setCurrentTab('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentTab === 'overview' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setCurrentTab('live')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentTab === 'live' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Campaign</span>
              {activeCampaign?.status === 'RUNNING' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('wizard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentTab === 'wizard' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Campaign</span>
            </button>

            <button
              onClick={() => setCurrentTab('instances')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentTab === 'instances' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Instances</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
                {instances.length}
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('contacts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentTab === 'contacts' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Contacts & Lists</span>
            </button>

            <button
              onClick={() => setCurrentTab('replies')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentTab === 'replies' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Replies</span>
              {conversations.some((c) => c.status === 'UNREAD') && (
                <span className="w-2 h-2 rounded-full bg-teal-400"></span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentTab === 'history' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>

            <button
              onClick={() => setCurrentTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentTab === 'settings' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </nav>

          {/* User Profile Pill & Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 font-mono text-[11px]">{currentUser?.email}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                {currentUser?.role || 'OPERATOR'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main View Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* 1. OVERVIEW DASHBOARD */}
        {currentTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Connected Instances
                </div>
                <div className="text-2xl font-bold text-emerald-400 font-mono">
                  {analytics?.summary?.connectedInstancesCount || 0} / {analytics?.summary?.instancesCount || 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Baileys gateway connections</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Today's Dispatches
                </div>
                <div className="text-2xl font-bold text-white font-mono">
                  {analytics?.summary?.totalSentToday || 0} / {analytics?.summary?.totalDailyCap || 200}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Daily pacing cap quota</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Active Running Campaigns
                </div>
                <div className="text-2xl font-bold text-amber-400 font-mono">
                  {analytics?.summary?.activeCampaignsCount || 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Processing in background</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Total Contacts & Opt-Outs
                </div>
                <div className="text-2xl font-bold text-teal-400 font-mono">
                  {analytics?.summary?.totalContactsCount || 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {analytics?.summary?.blacklistCount || 0} blacklisted
                </div>
              </div>
            </div>

            {/* 7-Day Performance Chart (Recharts) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">7-Day Dispatch & Delivery Trends</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Real-time volume delivered, read receipts, and delivery attempts</p>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  Live Analytics
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics?.chartData || []}>
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="sent" stroke="#10b981" fillOpacity={1} fill="url(#colorSent)" />
                    <Area type="monotone" dataKey="delivered" stroke="#38bdf8" fillOpacity={0.2} fill="#38bdf8" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Instances & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Instances Status List */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" />
                    <span>WhatsApp Gateway Instances</span>
                  </h3>
                  <button
                    onClick={() => setCurrentTab('instances')}
                    className="text-xs text-emerald-400 hover:underline cursor-pointer"
                  >
                    Manage
                  </button>
                </div>

                <div className="space-y-2">
                  {instances.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-6 text-center">
                      No instances created yet. Click "Instances" to link WhatsApp.
                    </div>
                  ) : (
                    instances.slice(0, 4).map((inst) => (
                      <div key={inst.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-xs text-white font-mono">{inst.name}</div>
                          <div className="text-[11px] text-slate-400">
                            Sent today: {inst.sentToday} / {inst.dailyCap} cap
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          inst.status === 'OPEN' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-red-950 text-red-300'
                        }`}>
                          {inst.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Best Practice Compliance Checklist */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Compliance & Anti-Ban Guardrails</span>
                </h3>

                <ul className="text-xs text-slate-300 space-y-2.5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Consent Verification:</strong> Every launch requires opt-in confirmation with recorded audit timestamp.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Auto Opt-Out Engine:</strong> Automatic blacklist ingestion on keywords like STOP, CANCEL, or RUKO.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Smart Pacing & Cooldowns:</strong> Automatic batch breaks and randomized sleep jitter between sends.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Emergency Circuit-Breaker:</strong> Instant pause upon detection of session disconnects or consecutive errors.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 2. LIVE CAMPAIGN DASHBOARD */}
        {currentTab === 'live' && (
          <div className="space-y-6">
            {activeCampaign ? (
              <>
                {/* Campaign Header & Controls */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-xl font-bold text-white">{activeCampaign.name}</h1>
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase ${
                        activeCampaign.status === 'RUNNING' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 animate-pulse' :
                        activeCampaign.status === 'PAUSED' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' :
                        activeCampaign.status === 'COMPLETED' ? 'bg-blue-950 text-blue-300' : 'bg-red-950 text-red-300'
                      }`}>
                        {activeCampaign.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2 font-mono">
                      <span>Pacing: <strong>{activeCampaign.minDelay}s - {activeCampaign.maxDelay}s</strong></span>
                      <span>&bull;</span>
                      <span>Typing: <strong>{activeCampaign.simulateTyping ? 'Simulated' : 'Off'}</strong></span>
                      <span>&bull;</span>
                      <span>Rotation: <strong>{activeCampaign.rotationMode}</strong></span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {activeCampaign.status === 'RUNNING' ? (
                      <button
                        onClick={() => handleCampaignControl(activeCampaign.id, 'PAUSE')}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCampaignControl(activeCampaign.id, 'RESUME')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleCampaignControl(activeCampaign.id, 'ABORT')}
                      className="px-3 py-2 bg-red-950 hover:bg-red-900 text-red-300 border border-red-500/30 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Abort</span>
                    </button>

                    <button
                      onClick={() => handleCampaignControl(activeCampaign.id, 'RESEND_FAILED')}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                      title="Re-queue failed messages"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Retry Failed</span>
                    </button>

                    <a
                      href={`/api/campaigns/${activeCampaign.id}/export?format=csv`}
                      download
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Export CSV</span>
                    </a>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400 uppercase">Total Contacts</div>
                    <div className="text-2xl font-bold font-mono text-white">{liveStats?.total || activeCampaign.stats?.total || 0}</div>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-emerald-400 uppercase">Sent / Delivered</div>
                    <div className="text-2xl font-bold font-mono text-emerald-400">{liveStats?.sent || activeCampaign.stats?.sent || 0}</div>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-red-400 uppercase">Failed</div>
                    <div className="text-2xl font-bold font-mono text-red-400">{liveStats?.failed || activeCampaign.stats?.failed || 0}</div>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-teal-400 uppercase">Replies</div>
                    <div className="text-2xl font-bold font-mono text-teal-400">{liveStats?.replied || activeCampaign.stats?.replied || 0}</div>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-amber-400 uppercase">Pending</div>
                    <div className="text-2xl font-bold font-mono text-amber-400">{liveStats?.pending || activeCampaign.stats?.pending || 0}</div>
                  </div>
                </div>

                {/* Pacing Jitter Card */}
                {jitterInfo && jitterInfo.countdown > 0 && activeCampaign.status === 'RUNNING' && (
                  <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center animate-pulse">
                        {jitterInfo.countdown}s
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Safe Anti-Ban Pacing Active</div>
                        <div className="text-[11px] text-slate-400">
                          Next dispatch to <strong className="text-emerald-400 font-mono">{jitterInfo.nextPhone || 'contact'}</strong> in {jitterInfo.countdown}s...
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 font-mono hidden sm:inline">Human randomized jitter</span>
                  </div>
                )}

                {/* Real-Time Live Logs & Recipient Table */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Event Log Stream */}
                  <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-[500px]">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Event Stream (SSE)</h3>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs pr-1">
                      {liveLogs.length === 0 ? (
                        <div className="text-slate-500 italic text-center py-16 text-xs">Awaiting queue dispatch events...</div>
                      ) : (
                        liveLogs.map((log, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded-lg border text-[11px] leading-relaxed ${
                              log.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-200' :
                              log.type === 'error' ? 'bg-red-950/40 border-red-500/20 text-red-200' :
                              log.type === 'warning' ? 'bg-amber-950/40 border-amber-500/20 text-amber-200' :
                              log.type === 'danger' ? 'bg-red-950/80 border-red-500/50 text-red-100 font-bold' :
                              'bg-slate-950 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                              <span>{log.status}</span>
                              <span>{new Date().toLocaleTimeString()}</span>
                            </div>
                            {log.phone && <div>To: <strong className="text-white">{log.phone}</strong></div>}
                            {log.message && <div className="truncate">{log.message}</div>}
                            {log.error && <div className="text-red-400 font-semibold">{log.error}</div>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Recipients Data Table */}
                  <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-[500px]">
                    {/* Filter Tabs */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3">
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                        {['ALL', 'SENT', 'FAILED', 'PENDING'].map((f) => (
                          <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                              statusFilter === f ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>

                      <div className="relative w-full sm:w-48">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                        <input
                          type="text"
                          value={recipientSearch}
                          onChange={(e) => setRecipientSearch(e.target.value)}
                          placeholder="Search phone or name..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1 text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800 sticky top-0">
                          <tr>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Phone</th>
                            <th className="p-2.5">Name</th>
                            <th className="p-2.5">Sent At</th>
                            <th className="p-2.5 text-right">Inspect</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                          {recipientsList.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-800/40">
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  r.status === 'SENT' || r.status === 'DELIVERED' || r.status === 'READ' ? 'bg-emerald-950 text-emerald-300' :
                                  r.status === 'FAILED' ? 'bg-red-950 text-red-300' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono text-emerald-400">{r.phone}</td>
                              <td className="p-2.5 text-slate-200">{r.name || '<empty>'}</td>
                              <td className="p-2.5 text-slate-400 text-[11px] font-mono">
                                {r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : '-'}
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  onClick={() => setInspectRecipient(r)}
                                  className="p-1 text-slate-400 hover:text-white"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-16 text-center bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center">
                <Radio className="w-12 h-12 text-emerald-400 mb-3 opacity-60" />
                <h3 className="text-base font-bold text-white">No Active Campaign Running</h3>
                <p className="text-xs text-slate-400 mt-1 mb-5">Launch a new bulk campaign to monitor real-time queue execution.</p>
                <button
                  onClick={() => setCurrentTab('wizard')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition cursor-pointer"
                >
                  Create & Launch Campaign
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. CAMPAIGN WIZARD */}
        {currentTab === 'wizard' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Create Bulk WhatsApp Campaign</h2>

              {/* Step 1: Campaign Details & Instance */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Campaign Name & Instances Assignment
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={wizName}
                    onChange={(e) => setWizName(e.target.value)}
                    placeholder="Campaign Name"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />

                  <div>
                    <select
                      multiple
                      value={wizInstances}
                      onChange={(e) => setWizInstances(Array.from(e.target.selectedOptions, (o) => o.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono h-20"
                    >
                      {instances.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.status})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Hold Ctrl to select multiple instances for rotation</span>
                  </div>
                </div>
              </div>

              {/* Step 2: Select Contact Lists */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Select Target Contact Lists
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {contactLists.map((l) => {
                    const isSelected = wizListIds.includes(l.id);
                    return (
                      <div
                        key={l.id}
                        onClick={() => {
                          if (isSelected) setWizListIds(wizListIds.filter((id) => id !== l.id));
                          else setWizListIds([...wizListIds, l.id]);
                        }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition ${
                          isSelected ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200' : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="font-bold text-xs">{l.name}</div>
                        <div className="text-[11px] text-slate-400 mt-1">{l._count?.contacts || 0} contacts</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Message Composer & Live Preview */}
              <div className="space-y-4 pt-2">
                {/* Media Format Selector */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider mr-1">
                    Message Type:
                  </span>
                  {(['text', 'image', 'video', 'document'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setWizMediaType(t)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer ${
                        wizMediaType === t
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {t === 'text' && <MessageSquare className="w-3.5 h-3.5" />}
                      {t === 'image' && <ImageIcon className="w-3.5 h-3.5" />}
                      {t === 'video' && <Video className="w-3.5 h-3.5" />}
                      {t === 'document' && <FileText className="w-3.5 h-3.5" />}
                      <span>{t}</span>
                    </button>
                  ))}
                </div>

                {/* Media Inputs (if not text) */}
                {wizMediaType !== 'text' && (
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5" />
                      <span>{wizMediaType.toUpperCase()} Media Attachment Settings</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Upload {wizMediaType.toUpperCase()} File:
                        </label>
                        <input
                          type="file"
                          accept={
                            wizMediaType === 'image'
                              ? 'image/*'
                              : wizMediaType === 'video'
                              ? 'video/mp4,video/quicktime,video/webm'
                              : '.pdf,.doc,.docx,.xls,.xlsx,.zip'
                          }
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (wizMediaType === 'document' && !wizFileName) {
                              setWizFileName(file.name);
                            }
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const result = evt.target?.result as string;
                              if (result) setWizMediaUrl(result);
                            };
                            reader.readAsDataURL(file);
                          }}
                          className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Or Direct Media Public URL:
                        </label>
                        <input
                          type="text"
                          value={wizMediaUrl.startsWith('data:') ? '[Local file loaded]' : wizMediaUrl}
                          onChange={(e) => setWizMediaUrl(e.target.value)}
                          placeholder={`https://example.com/asset.${wizMediaType === 'image' ? 'jpg' : wizMediaType === 'video' ? 'mp4' : 'pdf'}`}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {wizMediaType === 'document' && (
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Document Display Filename:
                          </label>
                          <input
                            type="text"
                            value={wizFileName}
                            onChange={(e) => setWizFileName(e.target.value)}
                            placeholder="e.g. Catalog_Product_Guide_2026.pdf"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        {wizMediaType === 'text' ? 'Message Template & Spintax' : 'Media Caption & Spintax'}
                      </label>
                      <span className="text-[11px] text-emerald-400">Tag fallback supported: <code>{'{name|Valued Customer}'}</code></span>
                    </div>

                    <textarea
                      rows={8}
                      value={wizTemplate}
                      onChange={(e) => setWizTemplate(e.target.value)}
                      placeholder={wizMediaType === 'text' ? 'Type message body...' : 'Type caption for this media...'}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="lg:col-span-5">
                    <LiveWhatsAppBubble
                      content={wizTemplate}
                      mediaType={wizMediaType}
                      mediaUrl={wizMediaUrl}
                      caption={wizTemplate}
                      sampleRecipient={{ name: 'Rahul Sharma', phone: '919876543210' }}
                    />
                  </div>
                </div>
              </div>

              {/* Step 4: Anti-Ban Pacing & Delays */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Min Delay (s)</label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={wizMinDelay}
                    onChange={(e) => setWizMinDelay(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Max Delay (s)</label>
                  <input
                    type="number"
                    min="10"
                    max="300"
                    value={wizMaxDelay}
                    onChange={(e) => setWizMaxDelay(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Instance Rotation Mode</label>
                  <select
                    value={wizRotation}
                    onChange={(e) => setWizRotation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  >
                    <option value="ROUND_ROBIN">Round Robin</option>
                    <option value="LEAST_USED">Least Used</option>
                  </select>
                </div>
              </div>

              {/* Step 5: Compliance Confirmation */}
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consent"
                  checked={wizConsentConfirmed}
                  onChange={(e) => setWizConsentConfirmed(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 mt-0.5 rounded cursor-pointer"
                />
                <label htmlFor="consent" className="text-xs text-emerald-200/90 leading-relaxed cursor-pointer">
                  <strong>Consent Confirmation:</strong> I confirm and certify that all contacts in this campaign have explicitly opted in to receive WhatsApp communications from my organization.
                </label>
              </div>

              {wizError && (
                <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-200">
                  {wizError}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleLaunchCampaign}
                  disabled={wizLaunching || !wizConsentConfirmed}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{wizLaunching ? 'Initializing Campaign...' : 'Launch Bulk Campaign Now'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. INSTANCES MANAGER */}
        {currentTab === 'instances' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Evolution API Instances</h2>
                <p className="text-xs text-slate-400">Manage Baileys WhatsApp Web connected devices</p>
              </div>

              <button
                onClick={() => setNewInstanceModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Instance</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {instances.map((inst) => (
                <div key={inst.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white text-sm">{inst.name}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      inst.status === 'OPEN' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-red-950 text-red-300'
                    }`}>
                      {inst.status}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <div>Connected: {inst.profileNumber || 'Not linked'}</div>
                    <div>Daily Cap: {inst.sentToday} / {inst.dailyCap}</div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => setQrModalInstance(inst.name)}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg"
                    >
                      Scan QR
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(`/api/evolution/instances/${encodeURIComponent(inst.name)}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'restart' }),
                        });
                        loadInstances();
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg"
                      title="Restart Instance"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. CONTACTS & LISTS */}
        {currentTab === 'contacts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Contacts & Blacklist Manager</h2>
                <p className="text-xs text-slate-400">Total contacts: {contacts.length} &bull; Blacklist: {blacklist.length}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Drag & Drop Import Box */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Import Contacts (CSV / XLSX)</span>
                </h3>

                {/* Sample Template Downloads */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Sample Contact Templates</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Pre-filled with 5 contacts</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Download a ready template with sample contacts, edit with your numbers, and upload.</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={downloadSampleCSV}
                      className="flex-1 py-1.5 px-3 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Sample CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadSampleXLSX}
                      className="flex-1 py-1.5 px-3 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Download Sample Excel</span>
                    </button>
                  </div>
                </div>

                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                      const workbook = XLSX.read(data, { type: 'array' });
                      const sheet = workbook.Sheets[workbook.SheetNames[0]];
                      const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

                      if (json.length === 0) return alert('Empty file');

                      const headers = Object.keys(json[0]);
                      const phoneCol = headers.find((h) => /phone|mobile|whatsapp|number/i.test(h)) || headers[0];
                      const nameCol = headers.find((h) => /name|full/i.test(h));

                      setImportingFile(true);
                      const res = await fetch('/api/contacts/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          rows: json,
                          phoneColumn: phoneCol,
                          nameColumn: nameCol,
                          listName: file.name.replace(/\.[^/.]+$/, ''),
                        }),
                      });
                      const resData = await res.json();
                      setImportingFile(false);
                      if (resData.success) {
                        setImportStats(resData.stats);
                        loadContactsAndLists();
                      }
                    };
                    reader.readAsArrayBuffer(file);
                  }}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                />

                {importStats && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="text-emerald-400 font-bold">Import Summary:</div>
                    <div>Valid imported: {importStats.validCount}</div>
                    <div>Duplicates removed: {importStats.duplicatesCount}</div>
                    <div>Blacklisted skipped: {importStats.blacklistedCount}</div>
                  </div>
                )}
              </div>

              {/* Contacts Table */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-sm font-bold text-white mb-3">Persisted Contact Database</h3>
                <div className="overflow-y-auto max-h-96 rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Phone</th>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Opt-In</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {contacts.map((c) => (
                        <tr key={c.id}>
                          <td className="p-2.5 font-mono text-emerald-400">{c.phone}</td>
                          <td className="p-2.5">{c.name || '-'}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300">
                              Opted-In
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. REPLIES INBOX */}
        {currentTab === 'replies' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[680px]">
            {/* Conversation List */}
            <div className="md:col-span-4 border-r border-slate-800 flex flex-col h-full bg-slate-950/40">
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Replies Inbox</span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full font-mono">{conversations.length}</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleSyncChats}
                  disabled={syncingReplies}
                  title="Sync WhatsApp Chats from connected instances"
                  className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingReplies ? 'animate-spin' : ''}`} />
                  <span>{syncingReplies ? 'Syncing...' : 'Sync Chats'}</span>
                </button>
              </div>

              <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="text-center py-16 px-4 space-y-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-slate-500">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="text-xs text-slate-400 font-medium">No conversations loaded yet.</div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Click <strong className="text-emerald-400">Sync Chats</strong> to pull recent WhatsApp chats from your connected instance, or upload chat history.
                    </p>
                    <button
                      type="button"
                      onClick={handleSyncChats}
                      disabled={syncingReplies}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <RefreshCw className={`w-3 h-3 ${syncingReplies ? 'animate-spin' : ''}`} />
                      <span>Sync WhatsApp Chats Now</span>
                    </button>
                  </div>
                ) : (
                  conversations.map((c) => (
                    <div
                      key={c.phone}
                      onClick={async () => {
                        setSelectedConversation(c.phone);
                        const res = await fetch(`/api/replies?phone=${encodeURIComponent(c.phone)}`);
                        const d = await res.json();
                        if (d.success) setConversationMessages(d.messages || []);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                        selectedConversation === c.phone
                          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-800/60 border border-emerald-500/30 flex items-center justify-center font-bold text-white text-xs shrink-0 mt-0.5">
                        {(c.pushName || c.phone || 'W')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center gap-1">
                          <span className="font-bold text-xs text-white truncate">{c.pushName || c.phone}</span>
                          <span className="text-[9px] text-slate-500 shrink-0 font-mono">
                            {c.lastReceivedAt ? new Date(c.lastReceivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-emerald-400/80">{c.phone}</div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{c.lastMessage}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Conversation Thread */}
            <div className="md:col-span-8 flex flex-col h-full bg-[#0b141a]">
              {selectedConversation ? (
                <>
                  {/* Thread Header */}
                  <div className="p-3 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between z-10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-700/80 flex items-center justify-center font-bold text-white text-xs">
                        {(selectedConversation || 'W')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white font-mono">{selectedConversation}</div>
                        <div className="text-[10px] text-emerald-400">WhatsApp Contact</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition">
                        <Upload className="w-3 h-3 text-emerald-400" />
                        <span>{uploadingChat ? 'Uploading...' : 'Upload Previous Chat (.txt)'}</span>
                        <input
                          type="file"
                          accept=".txt"
                          onChange={handleUploadChat}
                          disabled={uploadingChat}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Messages Bubble Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
                    {conversationMessages.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2 text-slate-400">
                        <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500">
                          <MessageSquare className="w-5 h-5" />
                        </div>
                        <div className="text-xs font-semibold text-slate-300">No previous messages in thread</div>
                        <p className="text-[11px] text-slate-500 max-w-xs">
                          Send a reply below to initiate conversation, or click "Upload Previous Chat (.txt)" to import chat history.
                        </p>
                      </div>
                    ) : (
                      conversationMessages.map((m: any, idx: number) => {
                        const isOutgoing = m.type === 'outgoing';
                        const bodyText = m.text || m.body || '';
                        const timeStr = m.time || m.receivedAt || m.sentAt;
                        return (
                          <div
                            key={m.id || idx}
                            className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-[75%] rounded-xl px-3.5 py-2 shadow-sm text-xs leading-relaxed break-words space-y-1 ${
                                isOutgoing
                                  ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                                  : 'bg-[#202c33] text-[#e9edef] rounded-tl-none border border-[#2a3942]'
                              }`}
                            >
                              {m.sender && (
                                <div className={`text-[10px] font-bold ${isOutgoing ? 'text-emerald-300/80' : 'text-emerald-400'}`}>
                                  {m.sender}
                                </div>
                              )}
                              <div className="whitespace-pre-wrap">{bodyText}</div>
                              <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 mt-1">
                                <span>{timeStr ? new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                {isOutgoing && <CheckCheck className="w-3 h-3 text-[#53bdeb]" />}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Reply Input Bar */}
                  <div className="p-3 bg-[#202c33] border-t border-[#2a3942] space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-medium">Send from instance:</span>
                      <select
                        value={replyInstance || (instances.find((i) => i.status === 'OPEN')?.name || instances[0]?.name || '')}
                        onChange={(e) => setReplyInstance(e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      >
                        {instances.map((i) => (
                          <option key={i.id} value={i.name}>
                            {i.name} ({i.status}) {i.status === 'OPEN' ? '🟢' : '⚪'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <textarea
                        rows={2}
                        value={replyInputText}
                        onChange={(e) => setReplyInputText(e.target.value)}
                        placeholder="Type reply message to send via WhatsApp..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendReply();
                          }
                        }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none font-sans placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={sendingReply || !replyInputText.trim()}
                        className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition flex items-center gap-1.5 h-full shrink-0"
                      >
                        <Send className="w-4 h-4" />
                        <span>{sendingReply ? 'Sending...' : 'Send Reply'}</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2 text-slate-500">
                  <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-600">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-semibold text-slate-400">No conversation selected</div>
                  <p className="text-[11px] text-slate-500 max-w-sm">
                    Select a conversation from the left to view previous messages and send instant WhatsApp replies.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 7. SETTINGS */}
        {currentTab === 'settings' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-3xl mx-auto space-y-6">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Gateway & Security Settings</h2>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Evolution API Base URL</label>
                <input
                  type="text"
                  value={settings['EVOLUTION_API_URL'] || ''}
                  onChange={(e) => setSettings({ ...settings, EVOLUTION_API_URL: e.target.value })}
                  placeholder="http://localhost:8080"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Global API Key (Stored Encrypted AES-256-GCM)
                </label>
                <input
                  type="password"
                  value={settings['GLOBAL_API_KEY'] || ''}
                  onChange={(e) => setSettings({ ...settings, GLOBAL_API_KEY: e.target.value })}
                  placeholder="Enter Evolution API Global Key"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                  Auto Opt-Out Keywords (Comma Separated)
                </label>
                <input
                  type="text"
                  value={settings['AUTO_OPT_OUT_KEYWORDS'] || 'STOP,UNSUBSCRIBE,CANCEL,NO,RUKO'}
                  onChange={(e) => setSettings({ ...settings, AUTO_OPT_OUT_KEYWORDS: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              {settingsSavedMsg && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-200">
                  {settingsSavedMsg}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 8. CAMPAIGN HISTORY */}
        {currentTab === 'history' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-white">Campaign History & Reports</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Progress</th>
                    <th className="p-4">Created</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-850">
                      <td className="p-4 font-bold text-white">{c.name}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4 font-mono">{c.stats?.sent || 0} / {c.stats?.total || 0}</td>
                      <td className="p-4 text-slate-400 font-mono text-[11px]">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setActiveCampaignId(c.id);
                            setCurrentTab('live');
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs"
                        >
                          View Live
                        </button>
                        <a
                          href={`/api/campaigns/${c.id}/export?format=csv`}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-xs"
                        >
                          CSV
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* QR Code Scanner Modal */}
      {qrModalInstance && (
        <QRCodeModal
          isOpen={Boolean(qrModalInstance)}
          instanceName={qrModalInstance}
          onClose={() => setQrModalInstance(null)}
          onConnected={() => loadInstances()}
        />
      )}

      {/* Create Instance Modal */}
      {newInstanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Create New WhatsApp Instance</h3>
            <form onSubmit={handleCreateInstance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Instance Identifier</label>
                <input
                  type="text"
                  required
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="e.g. marketing-primary"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewInstanceModal(false)}
                  className="px-4 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow"
                >
                  Create & Get QR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

