/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TranscriptItem {
  id: string;
  speakerName: string;
  text: string;
  timestamp: number;
}

export interface MinutesExportOptions {
  meetingTitle: string;
  roomId: string;
  date: string;
  durationFormatted: string;
  attendees: string[];
  transcript: TranscriptItem[];
}

export class LiveTranscriber {
  private recognition: any = null;
  public isListening = false;
  private onCaptionCallback: ((text: string) => void) | null = null;
  private lang: string = 'ar-SA';

  constructor(lang: 'ar' | 'en' = 'ar', onCaption: (text: string) => void) {
    this.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    this.onCaptionCallback = onCaption;
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.warn('SpeechRecognition API not available in this browser environment.');
      return;
    }

    try {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.lang;

      this.recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }

        const activeText = finalText || interimText;
        if (activeText.trim() && this.onCaptionCallback) {
          this.onCaptionCallback(activeText.trim());
        }
      };

      this.recognition.onerror = (err: any) => {
        if (err.error !== 'no-speech') {
          console.warn('Speech recognition error:', err.error);
        }
      };

      this.recognition.onend = () => {
        // Auto-restart if listening was not stopped manually
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch {
            // ignore
          }
        }
      };
    } catch (e) {
      console.warn('Failed to initialize SpeechRecognition:', e);
    }
  }

  public setLanguage(lang: 'ar' | 'en') {
    this.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    if (this.recognition) {
      this.recognition.lang = this.lang;
      if (this.isListening) {
        this.stop();
        this.start();
      }
    }
  }

  public start(): boolean {
    if (!this.recognition) return false;
    try {
      this.isListening = true;
      this.recognition.start();
      return true;
    } catch {
      return false;
    }
  }

  public stop() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Generate a formatted Boardroom Meeting Minutes Document (محضر الاجتماع)
 */
export function generateMeetingMinutesMarkdown(opts: MinutesExportOptions): string {
  const attendeesList = opts.attendees.map((a) => `- ${a}`).join('\n');
  const transcriptList =
    opts.transcript.length > 0
      ? opts.transcript
          .map(
            (t) =>
              `**[${new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${t.speakerName}:**\n> ${t.text}\n`
          )
          .join('\n')
      : '_No recorded speech during this session._';

  return `# ${opts.meetingTitle} - محضر الاجتماع الرسمي

**تاريخ الانعقاد:** ${opts.date}  
**رمز قاعة الاجتماع (Room ID):** \`${opts.roomId}\`  
**مدة الجلسة:** ${opts.durationFormatted}  
**النظام المستخدم:** ABDULKAREM BOARD MEETING (Ultra HD & E2EE)  

---

## 1. قائمة الحضور وأعضاء المجلس (Attendees)
${attendeesList}

---

## 2. جدول الأعمال والتفريغ المباشر للجلسة (Minutes & Discussion Log)
${transcriptList}

---

## 3. التوصيات والقرارات المعتمدة (Decisions & Action Items)
- [x] تم اعتماد وتوثيق مجريات الاجتماع إلكترونياً.
- [ ] متابعة المهام المطروحة في الجلسة حسب المحضر أعلاه.

---
*تم توليد هذا المحضر تلقائياً بواسطة نظام ABDULKAREM BOARD MEETING*  
*جميع الحقوق محفوظة © ABDULKAREM BOARD MEETING*
`;
}

/**
 * Trigger browser file download of the meeting minutes
 */
export function downloadMeetingMinutes(markdown: string, filename = 'board-meeting-minutes.md') {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}
