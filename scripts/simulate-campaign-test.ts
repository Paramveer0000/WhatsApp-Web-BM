import fs from 'fs';
import path from 'path';
import { assignTwoLayerDistribution } from '../src/lib/distribution';
import { renderMessage } from '../src/lib/spintax';
import { generateSmartFallbackVariations } from '../src/app/api/ai/variations/route';

// 1. Generate 60 realistic test contacts
const FIRST_NAMES = [
  'Rahul', 'Priya', 'Amit', 'Neha', 'Vikram', 'Ananya', 'Rohan', 'Sneha',
  'Karan', 'Pooja', 'Deepak', 'Divya', 'Sanjay', 'Kavita', 'Manish', 'Ritu',
  'Gaurav', 'Swati', 'Alok', 'Megha', 'Naveen', 'Shweta', 'Rajesh', 'Sunita',
  'Suresh', 'Anita', 'Vikas', 'Preeti', 'Arjun', 'Simran'
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Verma', 'Singh', 'Mehta', 'Reddy', 'Chopra', 'Nair',
  'Gupta', 'Kumar', 'Kapoor', 'Bose', 'Malhotra', 'Joshi', 'Bhatia'
];

const COMPANIES = [
  'Acme Corp', 'Apex Tech', 'Alpha Labs', 'Logistics Pro', 'Innovate Ltd',
  'Dock Marketing', 'Falcon Garden Tools', 'Zenith Retail', 'Nexus Solutions',
  'Orbit Global', 'Horizon Enterprises', 'Pinnacle Systems'
];

const contacts = Array.from({ length: 60 }, (_, i) => {
  const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
  const lastName = LAST_NAMES[i % LAST_NAMES.length];
  const company = COMPANIES[i % COMPANIES.length];
  const phone = `+91 98${String(76543210 + i * 31).slice(0, 8)}`;

  return {
    id: `rec_${String(i + 1).padStart(3, '0')}`,
    contactId: `cnt_${String(i + 1).padStart(3, '0')}`,
    name: `${firstName} ${lastName}`,
    phone,
    customVariables: {
      name: `${firstName} ${lastName}`,
      company,
      city: i % 2 === 0 ? 'Delhi' : 'Mumbai',
    },
  };
});

// 2. Base message provided by user (Dhanteras / Diwali DJ Night Invitation)
const baseMessage = `Hey {name|friend}! 😊

We would love to invite you to celebrate **Dhanteras with us at Dhanteras Drive-In – A Diwali DJ Night Under the Stars!** ✨

Join us for a beautiful evening filled with music, festive vibes, delicious food, traditional décor, and lots of fun.

📅 **6th November (Friday)**
⏰ 7 PM – 1 AM
📍 Farmhouse, near IT Park, Chandigarh

Come along with your friends and family and make this Diwali season memorable! ❤️

We'd be delighted to have you with us.

**DM "DIWALI" to RSVP!**`;

// 3. Generate 13 warm, polite variations (Message 1 = Base, Messages 2-13 = Warm & Polite Variations)
const aiVariations = generateSmartFallbackVariations(baseMessage);
const variants = [
  {
    id: 'var_1',
    position: 1,
    label: 'Message 1 (Base)',
    content: baseMessage,
  },
  ...aiVariations.map((v, i) => ({
    id: `var_${i + 2}`,
    position: i + 2,
    label: v.label,
    content: v.content,
  })),
];

// 4. Two WhatsApp Instances (Matching user setup: za & z)
const instances = [
  { id: 'inst_1', name: 'za', profileNumber: '+91 98765 00001', dailyCap: 200, sentToday: 12 },
  { id: 'inst_2', name: 'z',  profileNumber: '+91 98765 00002', dailyCap: 200, sentToday: 8 },
];

console.log(`Starting Two-Layer Distribution Test for ${contacts.length} contacts across ${instances.length} numbers using ${variants.length} message variants...`);

// 5. Execute Two-Layer Distribution Engine
const distribution = assignTwoLayerDistribution({
  contacts,
  instances,
  variants,
  allocationStrategy: 'BLOCKS',
  blockSize: 4,
  staggerVariations: true,
  stickyConversations: true,
  allocationSeed: 42,
});

console.log(`\nAllocation complete! Summary by instance:`);
Object.values(distribution.instanceStats).forEach((stats) => {
  const share = ((stats.allocatedCount / contacts.length) * 100).toFixed(1);
  console.log(`- Instance "${stats.instanceName}": ${stats.allocatedCount} contacts (${share}%)`);
});

// 6. Render final received message for every single contact
const results = distribution.allocations.map((r, idx) => {
  const contactName = r.name || 'Valued Customer';
  const companyName = r.customVariables?.company || 'Your Company';
  const renderedMessage = renderMessage(r.variantContent, {
    name: contactName,
    phone: r.phone,
    customVariables: { company: companyName },
  }, {
    appendOptOut: true,
    optOutText: 'Reply STOP to opt out',
  });

  return {
    recipientIndex: idx + 1,
    recipientId: r.id,
    name: contactName,
    company: companyName,
    phone: r.phone,
    instanceName: r.instanceName,
    variantId: r.variantId,
    variantIndex: r.variantPosition,
    variantLabel: r.variantLabel,
    rotationIndex: r.instanceSeq + 1,
    finalMessageReceived: renderedMessage,
  };
});

// 7. Write Markdown Report
let mdContent = `# Campaign Simulation Test Results (60 Test Contacts)

**Executed At:** ${new Date().toISOString()}  
**Total Recipients:** ${contacts.length}  
**Instances Used:** 2 (${instances.map(i => i.name).join(', ')})  
**Message Variants:** ${variants.length} (Warm, Polite, Meaning-Preserving Variations)  
**Layer 1 Strategy:** BLOCKS (Block Size: 4, Staggered Offsets)  
**Layer 2 Rotation:** Independent Sequential Rotation per Number  

---

## Instance Workload Distribution
| Instance Name | Allocated Contacts | Share % | Remaining Daily Cap |
| :--- | :--- | :--- | :--- |
${Object.values(distribution.instanceStats).map(s => {
  const share = ((s.allocatedCount / contacts.length) * 100).toFixed(1);
  return `| **${s.instanceName}** | ${s.allocatedCount} contacts | ${share}% | ${s.remainingCapacity} msgs |`;
}).join('\n')}

---

## Contact Messages Breakdown (All 60 Recipients)

| # | Contact Name | Company | Phone | Sending Instance | Variant | Rendered Message Preview |
| :-: | :--- | :--- | :--- | :-: | :-: | :--- |
${results.map(r => `| **${r.recipientIndex}** | ${r.name} | ${r.company} | \`${r.phone}\` | **${r.instanceName}** | M${r.variantIndex} | ${r.finalMessageReceived.replace(/\n+/g, ' ')} |`).join('\n')}

---

## Detailed Message Inspection (Sample First 12 Recipients)

${results.slice(0, 12).map(r => `
### Recipient #${r.recipientIndex}: ${r.name} (${r.company})
- **Phone:** \`${r.phone}\`
- **Sending Number:** \`${r.instanceName}\`
- **Assigned Variant:** **Message ${r.variantIndex} (${r.variantLabel})**
\`\`\`whatsapp
${r.finalMessageReceived}
\`\`\`
`).join('\n')}

`;

fs.writeFileSync(path.join(process.cwd(), 'campaign-simulation-test-results.md'), mdContent, 'utf8');

// 8. Write JSON Data File
fs.writeFileSync(
  path.join(process.cwd(), 'campaign-simulation-test-results.json'),
  JSON.stringify({
    metadata: {
      generatedAt: new Date().toISOString(),
      totalRecipients: contacts.length,
      instances: instances.map(i => i.name),
      variantCount: variants.length,
      allocationStrategy: 'BLOCKS',
      blockSize: 4,
      staggerVariations: true,
    },
    instanceStats: distribution.instanceStats,
    results,
  }, null, 2),
  'utf8'
);

console.log(`\n Successfully generated test files:`);
console.log(`- campaign-simulation-test-results.md (${mdContent.length} bytes)`);
console.log(`- campaign-simulation-test-results.json (${results.length} recipients)`);
