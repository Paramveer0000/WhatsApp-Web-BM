export interface IndustryCategory {
  id: string;
  name: string;
  iconName: string;
  description: string;
}

export interface IndustryTemplate {
  id: string;
  industryId: string;
  title: string;
  category: string;
  content: string;
  mediaType: 'text' | 'image' | 'video' | 'document';
  recommendedVariables: string[];
  usageCount: number;
}

export const INDUSTRY_CATEGORIES: IndustryCategory[] = [
  { id: 'all', name: 'All Industries', iconName: 'Layers', description: 'Browse all curated WhatsApp templates' },
  { id: 'general', name: 'General Marketing', iconName: 'Sparkles', description: 'Promotions, announcements & festive greetings' },
  { id: 'ecommerce', name: 'E-Commerce & Retail', iconName: 'ShoppingBag', description: 'Abandoned cart, flash sale & order status' },
  { id: 'realestate', name: 'Real Estate', iconName: 'Building2', description: 'Property launches, site visits & pricing alerts' },
  { id: 'healthcare', name: 'Healthcare & Clinics', iconName: 'HeartPulse', description: 'Appointment bookings, checkup alerts & test reports' },
  { id: 'education', name: 'Education & Coaching', iconName: 'GraduationCap', description: 'Free masterclasses, admission alerts & course reminders' },
  { id: 'b2b', name: 'B2B & IT Services', iconName: 'Briefcase', description: 'Product demos, commercial proposals & renewals' },
  { id: 'finance', name: 'Finance & Insurance', iconName: 'CircleDollarSign', description: 'Policy renewals, loan approvals & tax savings' },
  { id: 'automotive', name: 'Automotive', iconName: 'Car', description: 'Service reminders, test drive bookings & warranty' },
  { id: 'restaurant', name: 'Food & Restaurants', iconName: 'UtensilsCrossed', description: 'Table reservations, BOGO weekend deals & catering' },
  { id: 'fitness', name: 'Gym & Fitness', iconName: 'Dumbbell', description: 'Free trial passes, renewal discounts & personal training' },
  { id: 'travel', name: 'Travel & Hospitality', iconName: 'Plane', description: 'Vacation packages, flight deals & resort bookings' },
];

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  // --- GENERAL MARKETING ---
  {
    id: 'gen-1',
    industryId: 'general',
    title: 'Special 20% Discount Flash Offer',
    category: 'Promotional',
    content: '{Hi|Hello|Greetings} {name|Valued Customer}!\n\nExciting news from *{company|our store}*! We have reserved an exclusive *20% discount* for you on all our best-sellers.\n\nUse voucher code: `SPECIAL20` at checkout.\n\n{Shop now|Claim your discount} before the voucher expires on Sunday night!\n\n_Reply STOP to unsubscribe_',
    mediaType: 'text',
    recommendedVariables: ['name', 'company'],
    usageCount: 420,
  },
  {
    id: 'gen-2',
    industryId: 'general',
    title: 'VIP Community Welcome & Onboarding',
    category: 'Onboarding',
    content: '{Welcome|Glad to have you} {name|Friend}!\n\nThank you for joining our VIP WhatsApp broadcast group at *{company|BulkFlow}*. As an insider member, you receive:\n• 24-hour early access to seasonal releases\n• Dedicated priority WhatsApp support desk\n• Member-only discount codes\n\nSave this contact number to never miss an update!',
    mediaType: 'text',
    recommendedVariables: ['name', 'company'],
    usageCount: 310,
  },
  {
    id: 'gen-3',
    industryId: 'general',
    title: 'Customer Feedback & 5-Star Rating',
    category: 'Feedback',
    content: 'Hi {name|there}! How was your recent experience with our team at *{company|our service}*? ⭐\n\nWe would love to hear your feedback! Reply with a number from *1 (poor)* to *5 (exceptional)*.\n\nYour honest opinion helps us serve you better every day!',
    mediaType: 'text',
    recommendedVariables: ['name', 'company'],
    usageCount: 185,
  },

  // --- E-COMMERCE & RETAIL ---
  {
    id: 'ecom-1',
    industryId: 'ecommerce',
    title: 'Abandoned Cart Recovery & Free Delivery',
    category: 'Sales Recovery',
    content: 'Hey {name|there}! 👋 We noticed you left some awesome items in your shopping bag at *{company|our store}*.\n\nTo help you complete your order, here is an exclusive *FREE SHIPPING + 10% OFF* coupon code: `CART10`.\n\nComplete your checkout here: https://example.com/cart\n\n_Hurry, your cart items are reserved for only 12 more hours!_',
    mediaType: 'text',
    recommendedVariables: ['name', 'company'],
    usageCount: 890,
  },
  {
    id: 'ecom-2',
    industryId: 'ecommerce',
    title: 'Order Dispatched & Live Tracking Link',
    category: 'Transactional',
    content: '{Great news|Awesome news} {name|Customer}! 📦\n\nYour order *#{orderId|10482}* has been dispatched from our fulfillment hub and is on its way to you!\n\nCarrier: *Express Delivery*\nEstimated Arrival: _Within 2-3 business days_\nLive Tracking: https://track.example.com?id={orderId|10482}\n\nReply *TRACK* if you have any delivery queries.',
    mediaType: 'text',
    recommendedVariables: ['name', 'orderId'],
    usageCount: 1250,
  },
  {
    id: 'ecom-3',
    industryId: 'ecommerce',
    title: 'Weekend 24-Hour BOGO Clearance Sale',
    category: 'Flash Sale',
    content: '🔥 *24-HOUR WEEKEND FLASH SALE* 🔥\n\nHi {name|Shopper}! Buy 1 and Get 1 FREE on our entire seasonal catalog this weekend only.\n\nUse Code: `BOGOFREE` at checkout.\nBrowse collection: https://example.com/bogo\n\nStock is strictly limited. Grab your favorites before they sell out!',
    mediaType: 'text',
    recommendedVariables: ['name'],
    usageCount: 640,
  },

  // --- REAL ESTATE ---
  {
    id: 're-1',
    industryId: 'realestate',
    title: 'Exclusive Luxury Residence Pre-Launch',
    category: 'New Launch',
    content: '{Dear|Hello} {name|Investor},\n\nWe are pleased to introduce *{project|The Grand Residences}* — our newest premium 3 & 4 BHK luxury residences located at *{city|Prime City Center}*.\n\n✨ *Key Highlights*:\n• Zero Pre-EMI till possession\n• Exclusive sky deck & infinity pool\n• Pre-launch pricing starting from ₹1.45 Cr*\n\nReply *BROCHURE* for floor plans or *VISIT* to schedule a private VIP site tour this weekend.',
    mediaType: 'text',
    recommendedVariables: ['name', 'project', 'city'],
    usageCount: 512,
  },
  {
    id: 're-2',
    industryId: 'realestate',
    title: 'Open House & Site Inspection Invitation',
    category: 'Site Visit',
    content: 'Hi {name|there}! Are you free this Saturday or Sunday? 🏡\n\nWe are hosting an exclusive *Open House & Sample Flat Showcase* at *{project|Palm Meadows}*.\n\nComplimentary refreshments and instant booking discount vouchers worth ₹2,50,000 will be provided to all attendees!\n\nReply *CONFIRM* to reserve your family visit slot.',
    mediaType: 'text',
    recommendedVariables: ['name', 'project'],
    usageCount: 380,
  },
  {
    id: 're-3',
    industryId: 'realestate',
    title: 'Price Drop & Lucrative ROI Alert',
    category: 'Investor Update',
    content: '📈 *Investor Alert: 8.5% Guaranteed Rental Yield*\n\nHi {name|Investor}, prime commercial retail suites at *{project|Tech Park Mall}* are now available with a limited-period ₹15 Lakh price drop!\n\n• High footfall IT corridor\n• 9-year pre-leased blue chip tenants\n\nReply *ROI* to receive the detailed financial prospectus and lease summary.',
    mediaType: 'text',
    recommendedVariables: ['name', 'project'],
    usageCount: 295,
  },

  // --- HEALTHCARE & CLINICS ---
  {
    id: 'hc-1',
    industryId: 'healthcare',
    title: 'Doctor Appointment Confirmation',
    category: 'Appointments',
    content: 'Dear {name|Patient},\n\nYour consultation with *{doctor|Dr. Sharma}* is confirmed for *{date|Tomorrow at 11:30 AM}* at *{clinic|Wellness Care Clinic}*.\n\n📍 Clinic Address: {city|Main Healthcare Road}\n\nPlease arrive 10 minutes prior to your slot. Reply *RESCHEDULE* if you need to adjust your timing.',
    mediaType: 'text',
    recommendedVariables: ['name', 'doctor', 'date', 'clinic', 'city'],
    usageCount: 780,
  },
  {
    id: 'hc-2',
    industryId: 'healthcare',
    title: 'Annual Comprehensive Health Checkup',
    category: 'Preventative',
    content: '{Hello|Dear} {name|Patient}! Regular preventative health checkups ensure your family stays healthy and protected. 🩺\n\nBook our *Full Body Health Package* this month at an exclusive 40% discount (Includes 75+ vital parameters, ECG & doctor consultation).\n\nHome blood sample collection is available at zero extra fee!\n\nReply *HEALTH* to book your home visit today.',
    mediaType: 'text',
    recommendedVariables: ['name'],
    usageCount: 460,
  },

  // --- EDUCATION & COACHING ---
  {
    id: 'edu-1',
    industryId: 'education',
    title: 'Free Live Masterclass & Interactive Webinar',
    category: 'Webinar',
    content: '🎓 *Free Live Masterclass Invitation*\n\nHi {name|Student}! Ready to crack your dream career in *{course|Full-Stack AI Engineering}*?\n\nJoin our industry expert for an exclusive live 90-minute workshop:\n📅 Date: *This Saturday at 6:00 PM*\n💻 Meeting Link: https://meet.example.com/class\n\nSeats are strictly capped at 250 learners. Reply *PASS* to lock your seat!',
    mediaType: 'text',
    recommendedVariables: ['name', 'course'],
    usageCount: 690,
  },
  {
    id: 'edu-2',
    industryId: 'education',
    title: 'Admissions Open & Merit Scholarship Exam',
    category: 'Admissions',
    content: '{Dear Parent|Hello} {name|Student},\n\nAdmissions for the upcoming 2026 academic batch at *{institute|Apex Academy}* are now officially open!\n\nParticipate in our *National Scholarship Aptitude Test* and win up to 100% tuition fee waiver.\n\nRegister for the free scholarship test here: https://example.com/scholarship\nReply *INFO* for syllabus and sample papers.',
    mediaType: 'text',
    recommendedVariables: ['name', 'institute'],
    usageCount: 520,
  },

  // --- B2B & IT SERVICES ---
  {
    id: 'b2b-1',
    industryId: 'b2b',
    title: 'Executive 1-on-1 Product Demo Request',
    category: 'Sales Discovery',
    content: 'Hi {name|there}! I noticed your team at *{company|your business}* is scaling your WhatsApp outreach operations.\n\nOur platform automates high-deliverability bulk messaging, multi-agent shared inboxes, and AI chatbots with zero ban risk.\n\nDo you have 10 minutes this Wednesday or Thursday for a quick live walkthrough?\n\nReply with your preferred time slot or reply *DEMO*!',
    mediaType: 'text',
    recommendedVariables: ['name', 'company'],
    usageCount: 440,
  },
  {
    id: 'b2b-2',
    industryId: 'b2b',
    title: 'Quotation Follow-up & Custom Integration',
    category: 'Proposal',
    content: '{Hello|Hi} {name|Partner},\n\nFollowing up on the commercial proposal we shared for *{company|your organization}*.\n\nOur technical team has already prepared the custom API sandbox credentials and sandbox gateway for your team to test.\n\nLet us know if you have any questions regarding the pricing tiers or security guardrails!',
    mediaType: 'text',
    recommendedVariables: ['name', 'company'],
    usageCount: 310,
  },

  // --- FINANCE & INSURANCE ---
  {
    id: 'fin-1',
    industryId: 'finance',
    title: 'Insurance Policy Renewal & Grace Notice',
    category: 'Renewal',
    content: 'Dear {name|Policyholder},\n\nThis is a friendly reminder that your *{policy|Comprehensive Health Cover}* policy *#{policyNo|POL-8842}* is due for renewal on *{dueDate|Sunday}*.\n\nKeep your family continuously covered with no lapse in waiting periods.\n\nPay online in 60 seconds via UPI/Cards: https://pay.example.com/renew\nReply *HELP* to speak with our renewal desk.',
    mediaType: 'text',
    recommendedVariables: ['name', 'policy', 'policyNo', 'dueDate'],
    usageCount: 890,
  },
  {
    id: 'fin-2',
    industryId: 'finance',
    title: 'Pre-Approved Business Growth Capital Loan',
    category: 'Loan Offer',
    content: '💼 *Pre-Approved Working Capital Facility*\n\nHi {name|Business Owner}! Based on your recent turnover at *{company|your enterprise}*, you are eligible for pre-approved credit up to *₹25,00,000* at a special 9.25% p.a.* interest rate.\n\n• Zero collateral required\n• Disbursed in 4 business hours\n\nReply *LOAN* or click here to claim: https://example.com/apply',
    mediaType: 'text',
    recommendedVariables: ['name', 'company'],
    usageCount: 560,
  },

  // --- AUTOMOTIVE & CAR CARE ---
  {
    id: 'auto-1',
    industryId: 'automotive',
    title: 'Periodic Vehicle Service & Maintenance Due',
    category: 'Service',
    content: '{Hi|Hello} {name|Car Owner}! 🚗\n\nOur records indicate that your vehicle *{vehicle|car}* is due for its periodic 10,000 km general service.\n\nBook your service this week and receive:\n✨ Free 40-point safety inspection\n✨ Free foam wash & interior vacuuming\n✨ Free doorstep pick & drop\n\nReply *BOOK* with your preferred date and time slot!',
    mediaType: 'text',
    recommendedVariables: ['name', 'vehicle'],
    usageCount: 670,
  },
  {
    id: 'auto-2',
    industryId: 'automotive',
    title: 'VIP Test Drive Booking Invitation',
    category: 'Test Drive',
    content: 'Hi {name|there}! Experience the exhilarating performance of the all-new *{model|Turbo SUV 2026}*.\n\nWe will bring the test drive vehicle right to your doorstep at *{city|your city}* at your convenience.\n\nReply *YES* to schedule your doorstep test drive today!',
    mediaType: 'text',
    recommendedVariables: ['name', 'model', 'city'],
    usageCount: 390,
  },

  // --- RESTAURANTS & FOOD ---
  {
    id: 'rest-1',
    industryId: 'restaurant',
    title: 'Weekend Chef Special Table Reservation',
    category: 'Dine-In',
    content: '🍽️ *Weekend Gourmet Experience at {restaurant|Spice Bistro}*\n\nHi {name|Foodie}! Our executive chef has crafted an exclusive 5-course weekend tasting menu.\n\nEnjoy a complimentary dessert platter and a flat 15% discount on early table reservations.\n\nReply *TABLE* with your guest count to reserve your table!',
    mediaType: 'text',
    recommendedVariables: ['name', 'restaurant'],
    usageCount: 480,
  },
  {
    id: 'rest-2',
    industryId: 'restaurant',
    title: 'Buy 1 Pizza Get 1 Free Promo Code',
    category: 'Delivery',
    content: '🍕 *Pizza Night Treat for {name|Friend}!* 🍕\n\nCravings calling? Order any Large Gourmet Pizza and get a Medium Pizza *100% FREE*!\n\nUse Code: `PIZZAWEEK` at checkout.\nOrder on WhatsApp: https://menu.example.com\n\nDelivered fresh & piping hot in 30 minutes!',
    mediaType: 'text',
    recommendedVariables: ['name'],
    usageCount: 790,
  },

  // --- GYM & FITNESS ---
  {
    id: 'fit-1',
    industryId: 'fitness',
    title: '3-Day Free Gym Workout VIP Pass',
    category: 'Free Pass',
    content: '💪 *Ready to Crush Your Fitness Goals, {name|Champion}?*\n\nClaim your exclusive *3-Day All-Access VIP Pass* at *{gym|Iron Elite Fitness}*.\n\nIncludes access to world-class strength equipment, steam/sauna, and 1 complimentary body composition analysis session!\n\nReply *PASS* to activate your pass starting today.',
    mediaType: 'text',
    recommendedVariables: ['name', 'gym'],
    usageCount: 510,
  },
  {
    id: 'fit-2',
    industryId: 'fitness',
    title: 'Annual Gym Membership Renewal Offer',
    category: 'Renewal',
    content: 'Hi {name|there}! Your fitness journey has been inspiring! 🏆\n\nRenew your annual membership at *{gym|Powerhouse Fitness}* this month and get *3 MONTHS EXTRA FREE* + complimentary personal trainer sessions.\n\nOffer valid for the next 48 hours only. Reply *RENEW* to lock this deal!',
    mediaType: 'text',
    recommendedVariables: ['name', 'gym'],
    usageCount: 340,
  },

  // --- TRAVEL & HOSPITALITY ---
  {
    id: 'trv-1',
    industryId: 'travel',
    title: 'Dream Vacation Package & Early Bird Deal',
    category: 'Holiday Package',
    content: '✈️ *Escape to {destination|Goa / Maldives}!* 🏝️\n\nHi {name|Traveler}, plan your next holiday with our all-inclusive 4N/5D luxury vacation package starting at just ₹14,999/person.\n\nIncludes 4-star beach resort stay, breakfast, sightseeing & airport transfers!\n\nReply *HOLIDAY* for customized itinerary and flight options.',
    mediaType: 'text',
    recommendedVariables: ['name', 'destination'],
    usageCount: 620,
  },
  {
    id: 'trv-2',
    industryId: 'travel',
    title: 'Resort Stay Booking & Check-In Details',
    category: 'Confirmation',
    content: 'Dear {name|Guest},\n\nWe look forward to welcoming you to *{resort|Ocean View Resort}* on *{checkInDate|Friday}*! 🌊\n\nBooking ID: *#{bookingId|RES-993}*\nCheck-In Time: *2:00 PM*\n\nEarly check-in requests can be confirmed by replying to this chat. Have a wonderful stay with us!',
    mediaType: 'text',
    recommendedVariables: ['name', 'resort', 'checkInDate', 'bookingId'],
    usageCount: 430,
  },
];

