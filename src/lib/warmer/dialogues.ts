// Pre-built authentic dialogue exchanges for WhatsApp Number Warmer
// Designed to emulate 100% human, casual, non-promotional everyday chats between 2 people.

export interface DialogueTurn {
  sender: 'A' | 'B';
  text: string;
  delayMs?: number;
}

export interface DialogueScript {
  id: string;
  topic: 'casual' | 'business' | 'tech' | 'travel' | 'lifestyle';
  title: string;
  turns: DialogueTurn[];
}

export const WARMER_TOPICS = [
  { id: 'casual', name: 'Casual & Friendly', icon: 'Smile', desc: 'Weekend plans, lunch, weather & daily check-in' },
  { id: 'business', name: 'Business & Office', icon: 'Briefcase', desc: 'Sync calls, document reviews & project status' },
  { id: 'tech', name: 'Tech & Gadgets', icon: 'Smartphone', desc: 'Software updates, battery life & laptop tips' },
  { id: 'travel', name: 'Travel & Trips', icon: 'Plane', desc: 'Road trips, flight queries & hotel tips' },
  { id: 'lifestyle', name: 'Lifestyle & Food', icon: 'Coffee', desc: 'Cafe reviews, gym routines & favorite movies' },
] as const;

export const SCRIPTED_DIALOGUES: DialogueScript[] = [
  // 1. Casual Topic
  {
    id: 'cas-1',
    topic: 'casual',
    title: 'Lunch Catch-up',
    turns: [
      { sender: 'A', text: '{Hey|Hi|Hello}! Are you free for lunch today around 1:30 PM?' },
      { sender: 'B', text: '{Hey!|Hi there!|Hello!} Yes, 1:30 works great. Where are we heading?' },
      { sender: 'A', text: 'How about that Italian place near the corner? Heard their pasta is great.' },
      { sender: 'B', text: 'Sounds delicious! See you there in an hour 👍' },
    ],
  },
  {
    id: 'cas-2',
    topic: 'casual',
    title: 'Weekend Plans',
    turns: [
      { sender: 'A', text: 'Any exciting plans for the upcoming weekend?' },
      { sender: 'B', text: 'Nothing major, mostly catching up on reading and maybe a quick drive on Sunday. You?' },
      { sender: 'A', text: 'Thinking of checking out the new art gallery downtown if the weather stays nice.' },
      { sender: 'B', text: 'Oh nice! Let me know how it is, I have been wanting to visit too.' },
    ],
  },
  {
    id: 'cas-3',
    topic: 'casual',
    title: 'Morning Check-in',
    turns: [
      { sender: 'A', text: 'Good morning! Hope you had a restful evening.' },
      { sender: 'B', text: 'Morning! Yes indeed, feeling energized today. Ready for a productive week!' },
      { sender: 'A', text: 'Same here! Have a wonderful day ahead.' },
      { sender: 'B', text: 'Thanks, you too!' },
    ],
  },
  {
    id: 'cas-4',
    topic: 'casual',
    title: 'Coffee Break',
    turns: [
      { sender: 'A', text: 'Need a quick coffee break, coffee machine on 3rd floor is finally working.' },
      { sender: 'B', text: 'Haha finally! Grab an espresso for me if you are there.' },
      { sender: 'A', text: 'Sure thing, coming right over.' },
      { sender: 'B', text: 'Appreciate it, thank you!' },
    ],
  },

  // 2. Business Topic
  {
    id: 'biz-1',
    topic: 'business',
    title: 'Meeting Schedule Sync',
    turns: [
      { sender: 'A', text: 'Hi, can we reschedule our 4:00 PM review to 4:30 PM? A client call ran over.' },
      { sender: 'B', text: 'Sure, 4:30 PM is completely fine. I updated the calendar invite.' },
      { sender: 'A', text: 'Perfect, thank you for understanding.' },
      { sender: 'B', text: 'No problem at all, see you then.' },
    ],
  },
  {
    id: 'biz-2',
    topic: 'business',
    title: 'Document Confirmation',
    turns: [
      { sender: 'A', text: 'Just sent over the updated presentation deck via email. Please check when you have a moment.' },
      { sender: 'B', text: 'Got it, reviewing the revenue slide now. The formatting looks much cleaner.' },
      { sender: 'A', text: 'Great, let me know if we need any more revisions before the client presentation.' },
      { sender: 'B', text: 'Everything looks solid, ready to share with stakeholders!' },
    ],
  },
  {
    id: 'biz-3',
    topic: 'business',
    title: 'Invoice Status',
    turns: [
      { sender: 'A', text: 'Hi! Just wanted to confirm if the vendor invoice from yesterday was approved?' },
      { sender: 'B', text: 'Yes, finance team processed it this morning. Reference number should arrive by 5 PM.' },
      { sender: 'A', text: 'Awesome, thanks for the swift update!' },
    ],
  },

  // 3. Tech & Gadgets
  {
    id: 'tech-1',
    topic: 'tech',
    title: 'Battery & OS Update',
    turns: [
      { sender: 'A', text: 'Did you install the new software update yesterday? Any battery drain issues?' },
      { sender: 'B', text: 'Installed it last night. Actually seems a bit smoother and battery life is holding up well.' },
      { sender: 'A', text: 'Good to know, will start the update on my device now.' },
      { sender: 'B', text: 'Just make sure you are on Wi-Fi, the download is around 2.4 GB.' },
    ],
  },
  {
    id: 'tech-2',
    topic: 'tech',
    title: 'Monitor Setup',
    turns: [
      { sender: 'A', text: 'Which secondary monitor were you using for your work desk?' },
      { sender: 'B', text: 'Using the 27-inch 4K Dell Ultrasharp. Color accuracy and USB-C power delivery are top tier.' },
      { sender: 'A', text: 'Sounds ideal, going to check if it is on discount on Amazon.' },
      { sender: 'B', text: 'I think there was a 10% coupon yesterday, check the product page.' },
    ],
  },

  // 4. Travel & Trips
  {
    id: 'trv-1',
    topic: 'travel',
    title: 'Weekend Road Trip',
    turns: [
      { sender: 'A', text: 'Planning a quick mountain drive this weekend. Any scenic route recommendations?' },
      { sender: 'B', text: 'Take the old highway route early morning around 6 AM. Zero traffic and stunning valley views.' },
      { sender: 'A', text: 'Noted! Any good breakfast spots along the way?' },
      { sender: 'B', text: 'Stop by the hillside cafe at milestone 42, their hot coffee and fresh croissants are amazing.' },
    ],
  },
  {
    id: 'trv-2',
    topic: 'travel',
    title: 'Flight Status',
    turns: [
      { sender: 'A', text: 'Did your flight land on schedule or was there air traffic delay?' },
      { sender: 'B', text: 'Landed 10 minutes early surprisingly! Just waiting for check-in baggage now.' },
      { sender: 'A', text: 'Glad to hear. Have a safe ride to the hotel!' },
      { sender: 'B', text: 'Thanks! Will ping once I reach.' },
    ],
  },

  // 5. Lifestyle & Food
  {
    id: 'life-1',
    topic: 'lifestyle',
    title: 'Gym & Fitness',
    turns: [
      { sender: 'A', text: 'Going for the evening workout today or morning tomorrow?' },
      { sender: 'B', text: 'Doing a light 5K run this evening around 6:30 PM. Care to join?' },
      { sender: 'A', text: 'Count me in! Meeting at the park track?' },
      { sender: 'B', text: 'Yes, near the main entrance fountain.' },
    ],
  },
  {
    id: 'life-2',
    topic: 'lifestyle',
    title: 'Movie Recommendation',
    turns: [
      { sender: 'A', text: 'Watched any good sci-fi or mystery movies recently?' },
      { sender: 'B', text: 'Watched Arrival again over the weekend. What a masterpiece of storytelling!' },
      { sender: 'A', text: 'One of my all-time favorites too! The sound design and ending give goosebumps every time.' },
      { sender: 'B', text: '100% agreed! Rare to find films of that caliber.' },
    ],
  },
];

// Helper to resolve Spintax in template turns
export function resolveSpintax(text: string): string {
  return text.replace(/\{([^}]+)\}/g, (_, choices) => {
    const parts = choices.split('|');
    return parts[Math.floor(Math.random() * parts.length)].trim();
  });
}

// Get a random dialogue script for a selected topic
export function getRandomDialogue(topic: string = 'casual'): DialogueScript {
  const matching = SCRIPTED_DIALOGUES.filter(
    (d) => topic === 'all' || d.topic === topic
  );
  if (matching.length === 0) return SCRIPTED_DIALOGUES[0];
  return matching[Math.floor(Math.random() * matching.length)];
}

