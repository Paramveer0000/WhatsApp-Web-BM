'use client';

import React, { useState } from 'react';
import { renderMessage, formatWhatsAppToHtml, countSpintaxVariations } from '@/lib/spintax';
import { Smartphone, RefreshCw, CheckCheck, Video, Phone, MoreVertical, FileText, Image as ImageIcon, Play } from 'lucide-react';

interface Props {
  content: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  caption?: string | null;
  sampleRecipient?: { name?: string | null; phone?: string; customVariables?: any };
  appendOptOut?: boolean;
}

export default function LiveWhatsAppBubble({
  content,
  mediaType,
  mediaUrl,
  caption,
  sampleRecipient = { name: 'Rahul Sharma', phone: '919876543210' },
  appendOptOut = true,
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

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Header */}
      <div className="px-4 py-2.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-200">WhatsApp Preview</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            {variations} unique variant{variations !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => setRerollKey((k) => k + 1)}
            title="Shuffle Spintax Variation"
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700 font-medium transition cursor-pointer text-xs"
          >
            <RefreshCw className="w-3 h-3 text-emerald-400" />
            <span>Shuffle</span>
          </button>
        </div>
      </div>

      {/* Phone Mockup Screen */}
      <div className="flex-1 flex flex-col bg-[#0b141a] relative min-h-[380px]">
        {/* WhatsApp App Bar */}
        <div className="bg-[#202c33] px-3 py-2 flex items-center justify-between border-b border-[#2a3942] z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-700/80 flex items-center justify-center font-bold text-white text-xs shadow">
              {(sampleRecipient.name || 'W')[0].toUpperCase()}
            </div>
            <div>
              <div className="text-white text-xs font-semibold leading-tight">
                {sampleRecipient.name || sampleRecipient.phone}
              </div>
              <div className="text-emerald-400 text-[10px] leading-tight">online</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <Video className="w-3.5 h-3.5" />
            <Phone className="w-3.5 h-3.5" />
            <MoreVertical className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Wallpaper & Chat Area */}
        <div className="flex-1 p-4 overflow-y-auto flex flex-col justify-end relative">
          {/* WhatsApp Sent Bubble */}
          <div className="self-end max-w-[85%] bg-[#005c4b] text-[#e9edef] rounded-lg rounded-tr-none px-3 py-2 shadow-md text-xs leading-relaxed break-words border border-[#005c4b]/50 space-y-2">
            {mediaType && mediaType !== 'text' && (
              <div className="rounded-lg overflow-hidden bg-emerald-950/40 p-2 border border-emerald-500/20 text-slate-300">
                {mediaType === 'image' && (
                  mediaUrl ? (
                    <img src={mediaUrl} alt="media preview" className="rounded max-h-48 object-cover mx-auto" />
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1 bg-[#121b22] rounded">
                      <ImageIcon className="w-8 h-8 text-emerald-400" />
                      <span className="text-[10px] font-mono">[IMAGE ATTACHMENT]</span>
                    </div>
                  )
                )}

                {mediaType === 'video' && (
                  mediaUrl ? (
                    <video src={mediaUrl} controls className="rounded max-h-48 w-full object-cover" />
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1 bg-[#121b22] rounded relative">
                      <div className="w-10 h-10 rounded-full bg-emerald-700/80 flex items-center justify-center text-white shadow">
                        <Play className="w-5 h-5 ml-0.5" />
                      </div>
                      <span className="text-[10px] font-mono mt-1">[VIDEO ATTACHMENT]</span>
                    </div>
                  )
                )}

                {mediaType === 'document' && (
                  <div className="p-3 bg-[#121b22] rounded-lg border border-slate-700/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-950/80 border border-red-500/40 flex items-center justify-center text-red-300">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-xs font-bold text-white truncate">
                        {mediaUrl && !mediaUrl.startsWith('data:') ? mediaUrl.split('/').pop() : 'Document_Attachment.pdf'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">PDF Document &bull; 1.2 MB</div>
                    </div>
                  </div>
                )}

                {captionHtml && (
                  <div className="mt-2 text-left" dangerouslySetInnerHTML={{ __html: captionHtml }} />
                )}
              </div>
            )}

            {html ? (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <span className="text-emerald-300/50 italic text-[11px]">
                Type your message template to see live preview...
              </span>
            )}

            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#8696a0]">
              <span>{currentTime}</span>
              <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
            </div>
          </div>
        </div>

        {/* WhatsApp Footer */}
        <div className="bg-[#202c33] px-3 py-2 flex items-center gap-2 border-t border-[#2a3942] z-10 opacity-70">
          <div className="flex-1 bg-[#2a3942] rounded-lg px-3 py-1 text-xs text-slate-400">
            Type a message...
          </div>
        </div>
      </div>
    </div>
  );
}

