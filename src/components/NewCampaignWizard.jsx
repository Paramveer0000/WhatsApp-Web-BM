import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  Type, 
  Clock, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Layers, 
  Sparkles, 
  Bold, 
  Italic, 
  Strikethrough, 
  Code, 
  ShieldCheck, 
  FileText,
  UserCheck,
  Smartphone,
  Info
} from 'lucide-react';
import WhatsAppPreview from './WhatsAppPreview';
import { validateSpintax } from '../utils/spintax';

export default function NewCampaignWizard({
  instances = [],
  selectedInstance,
  setSelectedInstance,
  settings,
  onCampaignCreated
}) {
  // Campaign Info State
  const [campaignName, setCampaignName] = useState(`Campaign-${new Date().toLocaleDateString('en-GB').replace(/\//g, '')}-${Math.floor(100 + Math.random() * 900)}`);
  const [instanceName, setInstanceName] = useState(selectedInstance || (instances[0]?.instanceName || instances[0]?.name || ''));

  // Recipients File / Ingestion State
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [phoneColumn, setPhoneColumn] = useState('');
  const [nameColumn, setNameColumn] = useState('');
  const [fileName, setFileName] = useState('');
  const [defaultCountryCode, setDefaultCountryCode] = useState(settings.default_country_code || '91');
  const [inputMode, setInputMode] = useState('upload'); // 'upload' | 'manual'
  const [manualText, setManualText] = useState('');
  const fileInputRef = useRef(null);

  // Message Composer State
  const [messageTemplate, setMessageTemplate] = useState(
    `{Hi|Hello|Dear} {name},\n\nWe are excited to share our latest updates with you at *{company}*.\n\nEnjoy an exclusive _20% discount_ on your next order! Use code: ~EXPIRED~ \`SPECIAL20\`.\n\n{Have a wonderful day|Best regards},\nThe Team`
  );
  const textareaRef = useRef(null);

  // Anti-Ban & Pacing State
  const [minDelay, setMinDelay] = useState(Number(settings.default_min_delay || 12));
  const [maxDelay, setMaxDelay] = useState(Number(settings.default_max_delay || 25));
  const [simulateTyping, setSimulateTyping] = useState(true);

  // Submitting
  const [launching, setLaunching] = useState(false);
  const [formError, setFormError] = useState(null);

  // File Upload & Parsing Handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!json || json.length === 0) {
          setFormError('The uploaded file contains no data rows.');
          return;
        }

        const detectedHeaders = Object.keys(json[0] || {});
        setHeaders(detectedHeaders);
        setRawRows(json);

        // Auto-detect phone column
        const phoneMatch = detectedHeaders.find(h => 
          /phone|mobile|whatsapp|number|contact|tel/i.test(h)
        ) || detectedHeaders[0];
        setPhoneColumn(phoneMatch || '');

        // Auto-detect name column
        const nameMatch = detectedHeaders.find(h => 
          /name|full_?name|client|customer|first_?name/i.test(h)
        );
        setNameColumn(nameMatch || '');
        setFormError(null);
      } catch (err) {
        setFormError(`Failed to parse file: ${err.message}`);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Manual Paste Handler
  const handleManualParse = () => {
    if (!manualText.trim()) return;

    const lines = manualText.split('\n').map(l => l.trim()).filter(Boolean);
    const rows = [];

    for (const line of lines) {
      // Supports formats: "9876543210, John Doe" or "9876543210" or "John Doe <9876543210>"
      const parts = line.split(/[,\t|]/);
      let phone = parts[0]?.trim();
      let name = parts[1]?.trim() || '';

      // If user typed name first and phone second
      if (phone && isNaN(phone.replace(/[^0-9]/g, '')) && parts[1]) {
        name = parts[0]?.trim();
        phone = parts[1]?.trim();
      }

      rows.push({
        Phone: phone,
        Name: name
      });
    }

    setHeaders(['Phone', 'Name']);
    setPhoneColumn('Phone');
    setNameColumn('Name');
    setRawRows(rows);
    setFileName(`Manual Input (${rows.length} rows)`);
    setFormError(null);
  };

  // Clean and deduplicate recipient rows
  const { validRecipients, duplicatesCount, invalidCount } = useMemo(() => {
    if (!rawRows.length || !phoneColumn) {
      return { validRecipients: [], duplicatesCount: 0, invalidCount: 0 };
    }

    const seenPhones = new Set();
    const valid = [];
    let duplicates = 0;
    let invalid = 0;

    for (const row of rawRows) {
      let rawPhone = String(row[phoneColumn] || '').trim();
      // Strip non-digits
      let cleaned = rawPhone.replace(/[^\d]/g, '');

      if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
      if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.substring(1);

      // Prepend country code if 10 digits
      if (cleaned.length === 10 && defaultCountryCode) {
        cleaned = defaultCountryCode.replace(/[^\d]/g, '') + cleaned;
      }

      if (cleaned.length < 10 || cleaned.length > 16) {
        invalid++;
        continue;
      }

      if (seenPhones.has(cleaned)) {
        duplicates++;
        continue;
      }

      seenPhones.add(cleaned);

      // Gather custom variables
      const customVars = {};
      for (const [key, val] of Object.entries(row)) {
        if (key !== phoneColumn && key !== nameColumn) {
          customVars[key] = val;
        }
      }

      valid.push({
        phone: cleaned,
        name: nameColumn ? String(row[nameColumn] || '').trim() : '',
        custom_variables: customVars
      });
    }

    return {
      validRecipients: valid,
      duplicatesCount: duplicates,
      invalidCount: invalid
    };
  }, [rawRows, phoneColumn, nameColumn, defaultCountryCode]);

  // Insert Variable Chip at Textarea cursor
  const insertVariable = (varName) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = messageTemplate;
    const insertion = `{${varName}}`;

    const updated = text.substring(0, start) + insertion + text.substring(end);
    setMessageTemplate(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 10);
  };

  // Insert WhatsApp Formatting Tag around selection
  const insertFormat = (prefix, suffix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = messageTemplate;
    const selected = text.substring(start, end) || 'text';

    const formatted = `${prefix}${selected}${suffix}`;
    const updated = text.substring(0, start) + formatted + text.substring(end);
    setMessageTemplate(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 10);
  };

  // Spintax Validation
  const spintaxValidation = useMemo(() => {
    return validateSpintax(messageTemplate);
  }, [messageTemplate]);

  // Launch Campaign
  const handleLaunchCampaign = async () => {
    try {
      setFormError(null);

      if (!campaignName.trim()) {
        setFormError('Please enter a Campaign Name.');
        return;
      }

      if (!instanceName) {
        setFormError('Please select an Evolution API instance to dispatch messages.');
        return;
      }

      if (validRecipients.length === 0) {
        setFormError('No valid recipients found. Please upload a file with valid phone numbers.');
        return;
      }

      if (!messageTemplate.trim()) {
        setFormError('Message template cannot be empty.');
        return;
      }

      if (!spintaxValidation.isValid) {
        setFormError(`Spintax syntax error: ${spintaxValidation.message}`);
        return;
      }

      setLaunching(true);

      // 1. Create Campaign
      const createRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName.trim(),
          instanceName: instanceName.trim(),
          messageTemplate,
          minDelay: Number(minDelay) || 12,
          maxDelay: Number(maxDelay) || 25,
          simulateTyping: simulateTyping ? 1 : 0,
          recipients: validRecipients
        })
      });

      const createData = await createRes.json();
      if (!createData.success) {
        throw new Error(createData.error || 'Failed to create campaign');
      }

      const campaignId = createData.campaign.id;

      // 2. Start Campaign immediately
      const startRes = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: 'POST'
      });
      const startData = await startRes.json();

      if (!startData.success) {
        throw new Error(startData.error || 'Failed to start campaign queue');
      }

      // Notify parent to switch to Live Dashboard
      if (onCampaignCreated) {
        onCampaignCreated(createData.campaign);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Step 1: Campaign Details & Instance */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
            1
          </div>
          <h2 className="text-base font-bold text-white">Campaign Setup & Evolution Gateway</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Campaign Name
            </label>
            <input
              type="text"
              required
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Diwali Promo 2026"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Evolution WhatsApp Instance
            </label>
            {instances.length > 0 ? (
              <select
                value={instanceName}
                onChange={(e) => {
                  setInstanceName(e.target.value);
                  setSelectedInstance(e.target.value);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              >
                {instances.map((i, idx) => {
                  const name = i.instance?.instanceName || i.name || i.instanceName || `inst-${idx}`;
                  const state = i.connectionStatus || i.instance?.state || i.state || 'connected';
                  return (
                    <option key={name} value={name}>
                      {name} ({state})
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="flex items-center justify-between bg-amber-950/40 border border-amber-500/30 rounded-xl px-3.5 py-2 text-xs text-amber-200">
                <span>No instances found. Create one in the Instances tab first.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 2: Recipient Ingestion & Column Mapping */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
              2
            </div>
            <h2 className="text-base font-bold text-white">Recipient Ingestion & Validation</h2>
          </div>

          {/* Toggle between Upload File and Manual Paste */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setInputMode('upload')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                inputMode === 'upload' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CSV / Excel Upload
            </button>
            <button
              type="button"
              onClick={() => setInputMode('manual')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                inputMode === 'manual' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Paste Contacts
            </button>
          </div>
        </div>

        {inputMode === 'upload' ? (
          <div>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-8 text-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/70 transition flex flex-col items-center justify-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                {fileName ? fileName : 'Drag & drop your CSV or Excel (.xlsx) file here'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports .csv, .xlsx, and .xls files. Column headers will be auto-detected.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              rows={4}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Paste contacts here, one per line:&#10;9876543210, Rahul Sharma&#10;9876543211, Priya Patel&#10;9876543212, Amit Kumar"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleManualParse}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
            >
              Parse Pasted Contacts
            </button>
          </div>
        )}

        {/* Column Mapping & Cleaning Configuration */}
        {headers.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-800 space-y-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Column Mapping & Phone Normalization
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Target Phone Column */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Target Phone Number <span className="text-red-400">*</span>
                </label>
                <select
                  value={phoneColumn}
                  onChange={(e) => setPhoneColumn(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="">-- Select Phone Column --</option>
                  {headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Contact Name Column */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Contact Name (Optional)
                </label>
                <select
                  value={nameColumn}
                  onChange={(e) => setNameColumn(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="">-- None (leave empty) --</option>
                  {headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Default Country Code */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Auto Country Code (if 10 digits)
                </label>
                <input
                  type="text"
                  value={defaultCountryCode}
                  onChange={(e) => setDefaultCountryCode(e.target.value)}
                  placeholder="91"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Validation & Cleaning Summary Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">
                  Valid Cleaned Contacts: <strong className="text-emerald-400 font-mono text-sm">{validRecipients.length}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span className="text-slate-300">
                  Duplicates Removed: <strong className="text-amber-400 font-mono">{duplicatesCount}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-slate-300">
                  Invalid / Skipped: <strong className="text-red-400 font-mono">{invalidCount}</strong>
                </span>
              </div>
            </div>

            {/* Preview First 5 Rows */}
            {validRecipients.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400">
                  Sample Ingested Contacts (First 5 of {validRecipients.length}):
                </span>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Phone (Cleaned)</th>
                        <th className="p-2.5">Contact Name</th>
                        <th className="p-2.5">Custom Variables</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {validRecipients.slice(0, 5).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="p-2.5 text-slate-500 font-mono">{i + 1}</td>
                          <td className="p-2.5 font-mono text-emerald-400 font-medium">{r.phone}</td>
                          <td className="p-2.5 text-slate-200">{r.name || '<empty>'}</td>
                          <td className="p-2.5 text-slate-400 font-mono text-[11px]">
                            {Object.keys(r.custom_variables).length > 0
                              ? JSON.stringify(r.custom_variables)
                              : 'None'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 3: Message Composer & Live WhatsApp Phone Preview */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
            3
          </div>
          <h2 className="text-base font-bold text-white">Message Composer & Personalization</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Composer & Variables */}
          <div className="lg:col-span-7 space-y-4">
            {/* Formatting Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 p-2 rounded-xl border border-slate-800">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => insertFormat('*', '*')}
                  title="Bold (*text*)"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Bold className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Bold</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertFormat('_', '_')}
                  title="Italic (_text_)"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs italic transition flex items-center gap-1 cursor-pointer"
                >
                  <Italic className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Italic</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertFormat('~', '~')}
                  title="Strikethrough (~text~)"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs line-through transition flex items-center gap-1 cursor-pointer"
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Strike</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertFormat('```', '```')}
                  title="Monospace (```code```)"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition flex items-center gap-1 cursor-pointer"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Code</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Spintax: <code className="text-emerald-400 font-mono">{'{Hi|Hello}'}</code></span>
              </div>
            </div>

            {/* Variable Chips */}
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Click to Insert Personalization Tag:
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => insertVariable('name')}
                  className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-mono transition cursor-pointer"
                >
                  + {'{name}'}
                </button>
                <button
                  type="button"
                  onClick={() => insertVariable('phone')}
                  className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-mono transition cursor-pointer"
                >
                  + {'{phone}'}
                </button>

                {/* Additional dynamic columns from CSV */}
                {headers.filter(h => h !== phoneColumn && h !== nameColumn).map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => insertVariable(h)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-mono transition cursor-pointer"
                  >
                    + {'{'}{h}{'}'}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <textarea
                ref={textareaRef}
                rows={9}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Type your WhatsApp message template here..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 leading-relaxed"
              />
            </div>

            {/* Spintax Syntax Feedback Banner */}
            <div className={`p-3 rounded-xl text-xs flex items-center justify-between ${
              spintaxValidation.isValid
                ? 'bg-slate-900/60 border border-slate-800 text-slate-400'
                : 'bg-red-950/60 border border-red-500/40 text-red-200'
            }`}>
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Anti-Ban Spintax: Rotate variations like <code className="text-emerald-300 font-mono">{'{Greetings|Hello|Hi}'}</code> to prevent account flagging.
                </span>
              </div>
              {!spintaxValidation.isValid && (
                <span className="text-red-400 font-semibold">{spintaxValidation.message}</span>
              )}
            </div>
          </div>

          {/* Right: Live WhatsApp Chat Bubble Preview */}
          <div className="lg:col-span-5">
            <WhatsAppPreview
              template={messageTemplate}
              recipients={validRecipients}
              defaultRecipient={{
                name: 'Rahul Sharma',
                phone: '919876543210',
                custom_variables: { company: 'Acme Global', discount: '20%' }
              }}
            />
          </div>
        </div>
      </div>

      {/* Step 4: Anti-Ban Pacing & Queue Parameters */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
            4
          </div>
          <h2 className="text-base font-bold text-white">Anti-Ban Pacing & Safe Queue Engine</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Min & Max Delay Jitter */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Random Pacing Delay (Seconds)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">Min Delay</span>
                <input
                  type="number"
                  min="2"
                  max="120"
                  value={minDelay}
                  onChange={(e) => setMinDelay(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">Max Delay</span>
                <input
                  type="number"
                  min="2"
                  max="300"
                  value={maxDelay}
                  onChange={(e) => setMaxDelay(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              A random sleep duration between <strong>{minDelay}s</strong> and <strong>{maxDelay}s</strong> will occur before each message dispatch.
            </p>
          </div>

          {/* Typing Simulation Toggle */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Human Typing Simulation
            </label>
            <div 
              onClick={() => setSimulateTyping(!simulateTyping)}
              className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between cursor-pointer hover:border-slate-700 transition"
            >
              <div>
                <div className="text-xs font-semibold text-slate-200">Simulate "typing..." status</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Sends presence composing state 2s before dispatch</div>
              </div>
              <div className={`w-11 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                simulateTyping ? 'bg-emerald-600' : 'bg-slate-700'
              }`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-300 ${
                  simulateTyping ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </div>
          </div>

          {/* Emergency Circuit-Breaker & Quality Gate Info */}
          <div className="space-y-2 bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Evaluation & Quality Layer Active</span>
            </div>
            <p className="text-[11px] text-emerald-300/80 leading-relaxed">
              Every task is verified on WhatsApp before dispatch. Inactive numbers are auto-skipped, spam trigger keywords are filtered, and circuit breakers halt if consecutive dispatches fail.
            </p>
          </div>
        </div>

        {/* Form Error Banner */}
        {formError && (
          <div className="mt-6 p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Launch Button */}
        <div className="mt-8 pt-5 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Total Ready to Dispatch: <strong className="text-emerald-400 font-mono text-sm">{validRecipients.length}</strong> contacts
          </div>

          <button
            type="button"
            onClick={handleLaunchCampaign}
            disabled={launching || validRecipients.length === 0}
            className="px-7 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-xl shadow-emerald-900/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4 -rotate-12" />
            <span>{launching ? 'Initializing Campaign...' : 'Launch Bulk Campaign Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

