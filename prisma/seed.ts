import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Default Admin if no users
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash,
        name: 'System Administrator',
        role: 'ADMIN',
      },
    });
    console.log(`Created default admin user: ${admin.email} (Password: Admin@123)`);
  }

  // 2. Initial Settings
  const defaultSettings = [
    { key: 'EVOLUTION_API_URL', value: 'http://localhost:8080', isEncrypted: false },
    { key: 'GLOBAL_API_KEY', value: '', isEncrypted: true },
    { key: 'DEFAULT_COUNTRY_CODE', value: '91', isEncrypted: false },
    { key: 'MIN_DELAY_DEFAULT', value: '12', isEncrypted: false },
    { key: 'MAX_DELAY_DEFAULT', value: '25', isEncrypted: false },
    { key: 'DAILY_CAP_DEFAULT', value: '200', isEncrypted: false },
    { key: 'AUTO_OPT_OUT_KEYWORDS', value: 'STOP,UNSUBSCRIBE,CANCEL,NO,RUKO,MAT BHEJO', isEncrypted: false },
    { key: 'AUTO_OPT_OUT_CONFIRMATION', value: 'You have been unsubscribed and will not receive further messages.', isEncrypted: false },
  ];

  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log('Settings seeded.');

  // 3. Sample Contacts & List
  const sampleList = await prisma.contactList.upsert({
    where: { name: 'VIP Customers & Leads' },
    update: {},
    create: {
      name: 'VIP Customers & Leads',
      description: 'Initial seed list for testing bulk campaigns',
    },
  });

  const sampleContacts = [
    { phone: '919876543210', name: 'Rahul Sharma', customFields: JSON.stringify({ company: 'Acme Corp', city: 'Mumbai' }) },
    { phone: '919876543211', name: 'Priya Patel', customFields: JSON.stringify({ company: 'Innovate Ltd', city: 'Delhi' }) },
    { phone: '919876543212', name: 'Amit Verma', customFields: JSON.stringify({ company: 'Alpha Labs', city: 'Bangalore' }) },
    { phone: '919876543213', name: 'Neha Singh', customFields: JSON.stringify({ company: 'Logistics Pro', city: 'Hyderabad' }) },
    { phone: '919876543214', name: 'Vikram Mehta', customFields: JSON.stringify({ company: 'Apex Tech', city: 'Chennai' }) },
  ];

  for (const c of sampleContacts) {
    const contact = await prisma.contact.upsert({
      where: { phone: c.phone },
      update: {},
      create: {
        phone: c.phone,
        name: c.name,
        customFields: c.customFields,
        tags: JSON.stringify(['leads', 'seed']),
        optInStatus: true,
      },
    });

    await prisma.listContact.upsert({
      where: {
        listId_contactId: {
          listId: sampleList.id,
          contactId: contact.id,
        },
      },
      update: {},
      create: {
        listId: sampleList.id,
        contactId: contact.id,
      },
    });
  }
  console.log('Sample contacts and list seeded.');

  // 4. Sample Message Template
  await prisma.messageTemplate.upsert({
    where: { name: 'Exclusive Festival Offer' },
    update: {},
    create: {
      name: 'Exclusive Festival Offer',
      content: '{Hi|Hello|Dear} {name|Valued Customer},\n\nWe are excited to share a special celebration discount with your team at *{company|your company}*!\n\nUse voucher code: ~OLD20~ `SPECIAL20` for an exclusive _20% discount_ on your next order.\n\n{Best regards|Warm wishes},\nMarketing Team\n\n_Reply STOP to unsubscribe_',
      tags: JSON.stringify(['promotional', 'festive']),
    },
  });
  console.log('Sample templates seeded.');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

