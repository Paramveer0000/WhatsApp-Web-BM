'use client';

import React, { useState } from 'react';
import { renderMessage, formatWhatsAppToHtml, countSpintaxVariations } from '@/lib/spintax';
import { 
  Smartphone, RefreshCw, CheckCheck, Video, Phone, MoreVertical, 
  FileText, Image as ImageIcon, Play, Smile, Paperclip, Mic, ChevronLeft, ChevronRight
} from 'lucide-react';

interface Props {
  content: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  caption?: string | null;
  sampleRecipient?: { name?: string | null; phone?: string; company?: string; customVariables?: any };
  appendOptOut?: boolean;
  variantLabel?: string;
  currentVariantIndex?: number;
  totalVariants?: number;
  onPrevVariant?: () => void;
  onNextVariant?: () => void;
}

export default function LiveWhatsAppBubble({
  content,
  mediaType,
  mediaUrl,
  caption,
  sampleRecipient = { name: 'Rahul Sharma', phone: '+91 98765 43210', company: 'Acme Corp' },
  appendOptOut = true,
  variantLabel,
  currentVariantIndex,
  totalVariants,
  onPrevVariant,
  onNextVariant,
}: Props) {
  const [rerollKey, setRerollKey] = useState(0);

  const renderedText = React.useMemo(() => {
    return renderMessage(content, sampleRecipient, {
      appendOptOut,
      optOutText: 'Reply STOP to unsubscribe',
    });
  }, [content, sampleRecipient, appendOptOut, rerollKey]);

  const renderedCaption = React.useMemo(() => {
    return caption ? renderMessage(caption, sampleRecipient) : '';
  }, [caption, sampleRecipient, rerollKey]);

  const html = formatWhatsAppToHtml(renderedText);
  const captionHtml = formatWhatsAppToHtml(renderedCaption);
  const variations = countSpintaxVariations(content);

  const currentTime = React.useMemo(() => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Top Device Bar & Controls */}
      <div className="w-full max-w-[380px] mb-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between text-xs text-slate-300 shadow-md">
        <div className="flex items-center gap-1.5 font-bold text-white">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span>WhatsApp Preview</span>
        </div>

        <div className="flex items-center gap-2">
          {totalVariants && totalVariants > 1 && (
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-[11px] font-mono text-emerald-400">
              {onPrevVariant && (
                <button type="button" onClick={onPrevVariant} className="hover:text-white cursor-pointer">
                  <ChevronLeft className="w-3 h-3" />
                </button>
              )}
              <span>V{((currentVariantIndex ?? 0) + 1)}/{totalVariants}</span>
              {onNextVariant && (
                <button type="button" onClick={onNextVariant} className="hover:text-white cursor-pointer">
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setRerollKey((k) => k + 1)}
            title="Shuffle Spintax variation"
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-0.5 rounded-lg border border-slate-700 text-[11px] font-medium transition cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 text-emerald-400" />
            <span>Shuffle</span>
          </button>
        </div>
      </div>

      {/* Realistic Smartphone Chassis */}
      <div className="w-full max-w-[380px] rounded-[36px] bg-[#111b21] border-[6px] border-slate-700/90 shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden relative">
        {/* Top Speaker Notch & Camera Dot */}
        <div className="pt-2 pb-1.5 bg-[#1f2c34] flex items-center justify-center relative select-none z-20">
          <div className="w-16 h-3 bg-black/90 rounded-full flex items-center justify-center gap-1.5 shadow-inner">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 border border-slate-700/60" />
            <div className="w-6 h-1 rounded-full bg-slate-800/80" />
          </div>
        </div>

        {/* WhatsApp App Header Bar */}
        <div className="bg-[#1f2c34] px-3.5 py-2.5 flex items-center justify-between border-b border-[#2a3942] z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center font-bold text-white text-xs shadow">
              {(sampleRecipient.name || 'R')[0].toUpperCase()}
            </div>
            <div>
              <div className="text-white text-xs font-semibold leading-tight truncate max-w-[150px]">
                {sampleRecipient.name || 'Rahul Sharma'}
              </div>
              <div className="text-emerald-400 text-[10px] leading-tight flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                <span>online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3.5 text-[#aebac1]">
            <Video className="w-4 h-4 cursor-pointer hover:text-white transition" />
            <Phone className="w-3.5 h-3.5 cursor-pointer hover:text-white transition" />
            <MoreVertical className="w-3.5 h-3.5 cursor-pointer hover:text-white transition" />
          </div>
        </div>

        {/* WhatsApp Chat Area Screen */}
        <div 
          className="h-[460px] overflow-y-auto p-4 flex flex-col justify-end space-y-2 relative"
          style={{
            backgroundColor: '#0b141a',
            backgroundImage: `radial-gradient(#1f2c34 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        >
          {/* Centered Today Date Pill */}
          <div className="flex justify-center my-1 select-none">
            <span className="bg-[#182229] text-[#8696a0] text-[10px] font-semibold px-2.5 py-0.5 rounded-md shadow-sm border border-slate-800/60 uppercase tracking-wider">
              Today
            </span>
          </div>

          {/* Outgoing Message Bubble (Right-aligned, WhatsApp green) */}
          <div className="self-end max-w-[90%] bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-xs px-3.5 py-2.5 shadow-lg text-xs leading-relaxed break-words border border-[#005c4b]/60 space-y-2">
            {/* Attached Media */}
            {mediaType && mediaType !== 'text' && (
              <div className="rounded-xl overflow-hidden bg-emerald-950/40 p-2 border border-emerald-500/20 text-slate-300">
                {mediaType === 'image' && (
                  mediaUrl ? (
                    <img src={mediaUrl} alt="media preview" className="rounded-lg max-h-48 object-cover mx-auto" />
                  ) : (
                    <div className="py-7 flex flex-col items-center justify-center text-slate-400 gap-1 bg-[#121b22] rounded-lg">
                      <ImageIcon className="w-7 h-7 text-emerald-400" />
                      <span className="text-[10px] font-mono">[IMAGE ATTACHMENT]</span>
                    </div>
                  )
                )}

                {mediaType === 'video' && (
                  mediaUrl ? (
                    <video src={mediaUrl} controls className="rounded-lg max-h-48 w-full object-cover" />
                  ) : (
                    <div className="py-7 flex flex-col items-center justify-center text-slate-400 gap-1 bg-[#121b22] rounded-lg relative">
                      <div className="w-9 h-9 rounded-full bg-emerald-700 flex items-center justify-center text-white shadow">
                        <Play className="w-4 h-4 ml-0.5" />
                      </div>
                      <span className="text-[10px] font-mono mt-1">[VIDEO ATTACHMENT]</span>
                    </div>
                  )
                )}

                {mediaType === 'document' && (
                  <div className="p-2.5 bg-[#121b22] rounded-lg border border-slate-700/50 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-950 border border-red-500/40 flex items-center justify-center text-red-300 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[11px] font-bold text-white truncate">
                        {mediaUrl && !mediaUrl.startsWith('data:') ? mediaUrl.split('/').pop() : 'Document_Attachment.pdf'}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono">PDF Document &bull; 1.2 MB</div>
                    </div>
                  </div>
                )}

                {captionHtml && (
                  <div className="mt-1.5 text-left text-xs leading-normal" dangerouslySetInnerHTML={{ __html: captionHtml }} />
                )}
              </div>
            )}

            {/* Rendered HTML Message Body */}
            {html ? (
              <div 
                className="whitespace-pre-wrap font-sans text-xs text-[#e9edef] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: html }} 
              />
            ) : (
              <span className="text-emerald-300/50 italic text-[11px]">
                Type your message template to see live preview...
              </span>
            )}

            {/* Bubble Footer: Timestamp & Blue Double Checks */}
            <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0] select-none pt-0.5">
              <span>{currentTime}</span>
              <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
            </div>
          </div>
        </div>

        {/* WhatsApp Bottom Composer Mockup */}
        <div className="bg-[#1f2c34] px-3 py-2 flex items-center gap-2 border-t border-[#2a3942] z-20">
          <div className="flex items-center gap-1.5 text-[#8696a0]">
            <Smile className="w-4 h-4 hover:text-white cursor-pointer transition" />
          </div>
          <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5 text-xs text-slate-400 select-none">
            Message
          </div>
          <div className="flex items-center gap-2 text-[#8696a0]">
            <Paperclip className="w-4 h-4 hover:text-white cursor-pointer transition" />
            <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow cursor-pointer">
              <Mic className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Bottom Home Indicator Bar */}
        <div className="h-3.5 bg-[#1f2c34] flex items-center justify-center">
          <div className="w-24 h-1 bg-slate-600 rounded-full" />
        </div>
      </div>
    </div>
  );
}
