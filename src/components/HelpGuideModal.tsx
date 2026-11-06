'use client';

import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Rocket,
  ShieldCheck,
  HelpCircle,
  AlertTriangle,
  Sparkles,
  Clock,
  Shuffle,
  Smartphone,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'quickstart' | 'rules' | 'dictionary' | 'troubleshooting';
}

export default function HelpGuideModal({ isOpen, onClose, initialTab = 'quickstart' }: HelpGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'quickstart' | 'rules' | 'dictionary' | 'troubleshooting'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const dictionaryItems = [
    {
      term: 'Send Window (09:00 - 20:00)',
      category: 'Safety',
      explanation: 'Restricts sending to normal daytime business hours. WhatsApp bans numbers that send marketing messages late at night when recipients report them as spam.',
      recommended: 'Keep enabled between 09:00 and 20:00.',
    },
    {
      term: 'Send Now (Override Window)',
      category: 'Controls',
      explanation: 'Bypasses the nighttime restriction and runs your entire campaign immediately to 100% completion in a single click, regardless of the time.',
      recommended: 'Use only when you urgently need to dispatch an offer or announcement right now.',
    },
    {
      term: 'Min & Max Delay (Jitter)',
      category: 'Pacing',
      explanation: 'Randomized pause (e.g. 12 to 25 seconds) between sending each message. If all messages are sent at exact same millisecond, WhatsApp marks you as a robot.',
      recommended: '12s minimum delay, 25s maximum delay.',
    },
    {
      term: 'Simulate Typing',
      category: 'Anti-Ban',
      explanation: 'Shows "typing..." in WhatsApp for 2-4 seconds before sending the message, mimicking real human conversation.',
      recommended: 'Keep Checked (Active).',
    },
    {
      term: 'Multi-Message Variations',
      category: 'Delivery',
      explanation: 'Allows creating 2 to 5 slight variations of your text (e.g. Base, Warm, Formal). BulkFlow rotates them so no two consecutive contacts receive identical text.',
      recommended: 'Create at least 2 variations for campaigns larger than 50 contacts.',
    },
    {
      term: 'Distribution Mode',
      category: 'Rotation',
      explanation: 'Controls how variations are distributed: "Single" sends one template to all; "Rotate" cycles Variation 1, 2, 3 in order; "Random" picks randomly.',
      recommended: 'Rotate or Single for standard announcements.',
    },
    {
      term: 'Circuit Breaker',
      category: 'Protection',
      explanation: 'An emergency brake. If your phone loses internet connection, runs out of battery, or gets logged out, the system safely pauses the campaign so no contacts are lost or failed.',
      recommended: 'Automatic. When your phone reconnects, click "Resume".',
    },
    {
      term: 'Batch Break & Pause',
      category: 'Pacing',
      explanation: 'Takes a short 5-minute break after every 30 messages to cool down your WhatsApp socket and prevent rate limits.',
      recommended: '30 messages batch size, 5 minutes pause.',
    },
    {
      term: 'Reset Session (Instances)',
      category: 'Instances',
      explanation: 'Clears stale Baileys pairing tokens in case WhatsApp fails to link with QR code ("Couldn\'t link device"). Generates a fresh handshake.',
      recommended: 'Click when re-linking or if phone camera fails to pair.',
    },
    {
      term: 'Warmup Mode',
      category: 'New Numbers',
      explanation: 'Gradually increases daily volume on brand-new SIM cards (e.g. 20 on day 1, 40 on day 2) to build WhatsApp sender trust.',
      recommended: 'Always use for newly registered numbers under 30 days old.',
    },
  ];

  const filteredDictionary = dictionaryItems.filter(
    (item) =>
      item.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.explanation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-serif font-black italic">
              i
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>User Guide & Feature Dictionary</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Beginner Friendly
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Everything you need to send campaigns safely without bans</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-slate-950/40 border-b border-slate-800 flex gap-2 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('quickstart')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 font-semibold transition shrink-0 cursor-pointer ${
              activeTab === 'quickstart'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>3-Min Quick Start</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 font-semibold transition shrink-0 cursor-pointer ${
              activeTab === 'rules'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Anti-Ban Rules</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dictionary')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 font-semibold transition shrink-0 cursor-pointer ${
              activeTab === 'dictionary'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Features Dictionary ({dictionaryItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('troubleshooting')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 font-semibold transition shrink-0 cursor-pointer ${
              activeTab === 'troubleshooting'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Troubleshooting</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* TAB 1: QUICK START */}
          {activeTab === 'quickstart' && (
            <div className="space-y-4">
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4">
                <h3 className="font-bold text-emerald-300 text-xs mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>How to Launch Your Campaign in 4 Simple Steps</span>
                </h3>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  BulkFlow handles all anti-ban delays, typing simulations, and failover automatically. Just follow these steps:
                </p>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-xs">Link Your WhatsApp Number</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Go to the <strong>Instances</strong> tab. Click <strong>Scan QR</strong> and scan the code using WhatsApp on your phone (under <em>Settings &rarr; Linked Devices &rarr; Link a Device</em>). The instance will turn green (OPEN).
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-xs">Upload Audience (CSV / List)</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Go to <strong>Contacts</strong> and import your CSV with columns <code className="bg-slate-800 px-1 py-0.5 rounded text-emerald-300">phone,name</code>. Invalid numbers or non-WhatsApp numbers are automatically filtered out.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-xs">Compose Message & Upload Media</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Click <strong>New Campaign</strong>. Choose your target list, write your text (use <code className="bg-slate-800 px-1 py-0.5 rounded text-emerald-300">&#123;&#123;name&#125;&#125;</code> for personal greeting), and upload an image (JPG/PNG) if needed.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-xs">Launch or Schedule</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Click <strong>Launch Campaign Now</strong>. The engine steps through contacts automatically with human pauses (12-25s) between each. You can monitor live progress or download the status CSV when done.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ANTI-BAN RULES */}
          {activeTab === 'rules' && (
            <div className="space-y-3">
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4">
                <h3 className="font-bold text-amber-300 text-xs mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>The 4 Golden Rules to Prevent WhatsApp Account Bans</span>
                </h3>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  WhatsApp protects its users from automated spam. Following these simple rules keeps your business number 100% safe:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                  <span className="font-bold text-white text-xs flex items-center gap-1 text-emerald-400">
                    <Clock className="w-3.5 h-3.5" /> 1. Keep Human Delays (12-25s)
                  </span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Never send messages instantly. BulkFlow's default 12–25 second jitter mimics a real person typing on a phone.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                  <span className="font-bold text-white text-xs flex items-center gap-1 text-blue-400">
                    <Clock className="w-3.5 h-3.5" /> 2. Respect Daytime Hours (09:00 - 20:00)
                  </span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Sending late at night annoys customers and causes instant spam reporting. Only send between 9 AM and 8 PM.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                  <span className="font-bold text-white text-xs flex items-center gap-1 text-purple-400">
                    <Shuffle className="w-3.5 h-3.5" /> 3. Rotate 2-3 Message Variations
                  </span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Identical text sent hundreds of times triggers Meta's hash filters. Creating 2-3 variations bypasses duplicate detection.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                  <span className="font-bold text-white text-xs flex items-center gap-1 text-amber-400">
                    <Smartphone className="w-3.5 h-3.5" /> 4. Daily Quotas (50 - 200/day)
                  </span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    New numbers should stay under 50-80 messages/day. Mature numbers can safely send 150-250/day. Connect multiple numbers to scale up!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FEATURES DICTIONARY */}
          {activeTab === 'dictionary' && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Search any function or button (e.g. override, circuit breaker, delay)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />

              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {filteredDictionary.map((item, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                        <span className="text-emerald-400 font-mono text-[11px]">&#9656;</span>
                        <span>{item.term}</span>
                      </h4>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {item.explanation}
                    </p>
                    <div className="bg-slate-900/80 rounded-xl p-2 border border-slate-850 flex items-center gap-1.5 text-[11px] text-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span><strong>Best Practice:</strong> {item.recommended}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: TROUBLESHOOTING */}
          {activeTab === 'troubleshooting' && (
            <div className="space-y-3">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Problem: "Couldn't link device" when scanning QR code</span>
                </h4>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  <strong>Solution:</strong> In the QR code modal, click the amber <strong>"Reset Session"</strong> button. This clears old pairing locks from Baileys. Wait 2 seconds, then scan the fresh QR code.
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-bold text-rose-300 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Problem: Campaign says "Circuit Breaker Triggered"</span>
                </h4>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  <strong>Solution:</strong> Your phone lost internet connection or was logged out from WhatsApp. Re-link your instance in the <strong>Instances</strong> tab. Once it shows green (OPEN), go back to Campaigns and click <strong>Resume</strong>.
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-bold text-blue-300 text-xs flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>Problem: "Campaign Paused by Anti-Ban Guardrails (Sending Window)"</span>
                </h4>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  <strong>Solution:</strong> The current time is outside 09:00 - 20:00. If you want to dispatch it right now anyway, click the orange <strong>"Send Now (Override Window)"</strong> button. It will run through the entire campaign to completion.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Anti-Ban Protection is active across all campaigns</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer"
          >
            Got it, Let's Go!
          </button>
        </div>
      </div>
    </div>
  );
}
