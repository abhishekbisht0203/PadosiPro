/**
 * The service catalogue that ships with the app.
 *
 * Modelled on the categories shown on app.padosipro.com so the app feels like
 * the real product. Names are deliberately short — they are the labels the user
 * sees in a multi-select list — and every one has a description explaining what
 * the Lifestyle Manager actually takes off their plate.
 */

export interface SeedCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tasks: Array<{ name: string; subcategory: string; description: string }>;
}

export const CATALOGUE: SeedCategory[] = [
  {
    id: 'errands',
    title: 'Errands & Daily Tasks',
    subtitle: 'Bills, banks, documents, government work',
    icon: 'check-square',
    tasks: [
      { name: 'Bill payments', subcategory: 'Payments & Renewals', description: 'Electricity, water, gas and society maintenance paid on time, with the receipts kept in one place.' },
      { name: 'Courier pickup & drop', subcategory: 'Pickups & Deliveries', description: 'Collect or drop parcels and return items when nobody is home during office hours.' },
      { name: 'Grocery pickup & restocking', subcategory: 'Pickups & Deliveries', description: 'A weekly essentials run — atta, pulses, milk, cleaning supplies — before the shelves run out.' },
      { name: 'Bank work', subcategory: 'Documents & Government', description: 'Standing in queues for deposits, withdrawals, passbook updates and KYC paperwork.' },
      { name: 'Queue standing', subcategory: 'Documents & Government', description: 'Banking, government office and temple queues handled so you do not lose a working morning to it.' },
      { name: 'Document printing, scanning & notarization', subcategory: 'Documents & Government', description: 'Print, scan, photocopy and get documents notarised without leaving home.' },
    ],
  },
  {
    id: 'home',
    title: 'Home Services',
    subtitle: 'AC, plumbing, electrical, cleaning, repairs',
    icon: 'home',
    tasks: [
      { name: 'Deep cleaning', subcategory: 'Cleaning', description: 'Kitchen, bathrooms, sofas and windows cleaned properly by a vetted team.' },
      { name: 'Regular cleaning', subcategory: 'Cleaning', description: 'A scheduled house cleaning routine on days and times that suit you.' },
      { name: 'AC service & installation', subcategory: 'Appliances & Utilities', description: 'Servicing before summer, new AC installation, and repairs when it stops cooling.' },
      { name: 'Plumber', subcategory: 'Repairs', description: 'Leaks, blocked drains, fittings and installations handled by a plumber you do not have to hunt for.' },
      { name: 'Electrician', subcategory: 'Appliances & Utilities', description: 'Wiring, switchboards, fans and appliance faults, with the work checked after it is done.' },
      { name: 'Carpentry & painting', subcategory: 'Repairs', description: 'Furniture assembly, minor carpentry and painting work coordinated end to end.' },
      { name: 'Pest control', subcategory: 'Appliances & Utilities', description: 'Cockroaches, termites, rodents and mosquitoes, treated on a schedule so they stay away.' },
      { name: 'Water tank & motor maintenance', subcategory: 'Appliances & Utilities', description: 'Overhead tank cleaning, motor servicing and water supply checks before the season changes.' },
    ],
  },
  {
    id: 'travel',
    title: 'Travel & Tourism',
    subtitle: 'Flights, hotels, visas, transfers, itineraries',
    icon: 'map-pin',
    tasks: [
      { name: 'Flight & hotel booking', subcategory: 'Book Travel', description: 'Flights and stays compared and booked for the dates that actually work for you.' },
      { name: 'Train booking', subcategory: 'Book Travel', description: 'Regular and Tatkal tickets, waitlist tracking and confirmations sent to you.' },
      { name: 'Visa paperwork', subcategory: 'Documents & Visa', description: 'Visa document preparation, appointments and application submission handled.' },
      { name: 'Itinerary planning', subcategory: 'Book Travel', description: 'Day-by-day plans with transfers, timings and buffer, so the trip runs itself.' },
      { name: 'Airport pickup & drop', subcategory: 'Local Transport', description: 'Cab booked for arrival and departure, tracked to your terminal.' },
      { name: 'Car rental', subcategory: 'Local Transport', description: 'Self-drive or with-driver rentals for the length of your trip.' },
      { name: 'Travel insurance coordination', subcategory: 'Book Travel', description: 'Policy comparison, paperwork and claims support when you need to use it.' },
    ],
  },
  {
    id: 'health',
    title: 'Health & Medical',
    subtitle: 'Doctor visits, pharmacy, labs, physio',
    icon: 'heart',
    tasks: [
      { name: 'Doctor appointment scheduling', subcategory: 'Appointments & Tests', description: 'Specialist and clinic slots booked around your work, with reminders before the visit.' },
      { name: 'Home doctor visit', subcategory: 'Appointments & Tests', description: 'A doctor at home for fevers, minor illness and anyone who should not travel.' },
      { name: 'Pharmacy & medicine refills', subcategory: 'Records & Reports', description: 'Prescriptions sent to your pharmacy and refills arranged before you run out.' },
      { name: 'Lab test booking & pickup', subcategory: 'Appointments & Tests', description: 'Tests booked at home or at a lab, and reports collected and summarised for you.' },
      { name: 'Physio at home', subcategory: 'Appointments & Tests', description: 'Physiotherapy sessions at home for recovery, injury and post-operative care.' },
      { name: 'Second opinion coordination', subcategory: 'Records & Reports', description: 'Reports organised and a second opinion arranged with an independent specialist.' },
      { name: 'Medical travel coordination', subcategory: 'Hospital & Emergency', description: 'Travel, admission and discharge logistics when treatment needs a hospital.' },
    ],
  },
  {
    id: 'senior',
    title: 'Senior Care',
    subtitle: 'Check-ins, medicines, vitals, companionship',
    icon: 'users',
    tasks: [
      { name: 'Daily wellness check-ins', subcategory: 'Daily Care', description: 'A call or visit every day to confirm food, sleep and general well-being.' },
      { name: 'Medicine reminders & management', subcategory: 'Medical Support', description: 'Doses tracked, refills arranged and adherence confirmed for every medicine.' },
      { name: 'Vitals monitoring', subcategory: 'Medical Support', description: 'BP, sugar and weight recorded on a schedule and escalated if they drift.' },
      { name: 'Home safety checks', subcategory: 'Safety & Mobility', description: 'Walkways, lighting, rails and switches reviewed to make the home safer.' },
      { name: 'Companionship', subcategory: 'Family Care', description: 'Company for walks, temple visits and outings, on the days you cannot be there.' },
      { name: 'Hospital visit accompaniment', subcategory: 'Medical Support', description: 'Someone who travels to and waits through every appointment.' },
    ],
  },
  {
    id: 'events',
    title: 'Events & Management',
    subtitle: 'Weddings, décor, catering, photography',
    icon: 'calendar',
    tasks: [
      { name: 'Venue shortlisting & booking', subcategory: 'Planning & Venue', description: 'Options compared on price, capacity and location, then booked and confirmed.' },
      { name: 'Budget tracking & vendor payments', subcategory: 'Planning & Venue', description: 'One sheet of every cost, every advance paid and every balance still due.' },
      { name: 'Wedding coordination', subcategory: 'Planning & Venue', description: 'End-to-end coordination so the family attends the wedding instead of managing it.' },
      { name: 'Décor & florals', subcategory: 'Vendors & Services', description: 'Décor, flowers and setup designed, sourced and installed on the day.' },
      { name: 'Catering coordination', subcategory: 'Vendors & Services', description: 'Menus finalised, tastings arranged and quantities tracked for the guest count.' },
      { name: 'Photography & videography booking', subcategory: 'Vendors & Services', description: 'Photographers and cinematographers booked with shot lists agreed in advance.' },
      { name: 'Guest list & travel & stay', subcategory: 'Guests', description: 'RSVPs tracked, and travel and accommodation arranged for out-of-town guests.' },
      { name: 'Event day logistics', subcategory: 'Event Day & After', description: 'A run sheet, on-site coordination and someone who handles whatever changes.' },
    ],
  },
  {
    id: 'workforce',
    title: 'Workforce Management',
    subtitle: 'Maids, cooks, drivers, nannies, payroll',
    icon: 'briefcase',
    tasks: [
      { name: 'Maid onboarding & replacement', subcategory: 'Hire Staff', description: 'Verified help found, introduced to the home, and replaced quickly if it does not work.' },
      { name: 'Cook scheduling & backup', subcategory: 'Hire Staff', description: 'A cook for the days you need one, with a backup when they call in sick.' },
      { name: 'Driver hiring & verification', subcategory: 'Hire Staff', description: 'Drivers sourced with licence and police verification completed.' },
      { name: 'Nanny sourcing', subcategory: 'Hire Staff', description: 'Nannies and helpers with background checks and references verified.' },
      { name: 'Attendance & salary tracking', subcategory: 'Staff Records & Payroll', description: 'Attendance, leaves and salaries recorded so nothing is disputed at month end.' },
      { name: 'Police verification handling', subcategory: 'Verification', description: 'Verification paperwork filed and followed up until it comes back.' },
      { name: 'Exit & transition support', subcategory: 'Replacement & Exit', description: 'Notice periods, dues and handover handled without awkwardness.' },
    ],
  },
  {
    id: 'tech',
    title: 'Digital & Tech Help',
    subtitle: 'WiFi, CCTV, smart locks, device repair',
    icon: 'wifi',
    tasks: [
      { name: 'Wi-Fi & router installation', subcategory: 'Internet & Home Tech', description: 'Router configured, dead zones fixed and the whole home covered.' },
      { name: 'CCTV & smart home setup', subcategory: 'Internet & Home Tech', description: 'Cameras, smart locks and sensors installed and set up on your phone.' },
      { name: 'Device troubleshooting', subcategory: 'Device Setup', description: 'Phone, laptop or tablet fixed at home, or recovered if it will not boot.' },
      { name: 'New phone & laptop setup', subcategory: 'Device Setup', description: 'New devices configured with your accounts, apps and data migrated across.' },
      { name: 'Data backup & recovery', subcategory: 'Accounts & Data', description: 'Photos and important files backed up, and recovered when they are lost.' },
      { name: 'Cyber safety assistance', subcategory: 'Safety & Support', description: 'Help after a scam, a suspicious message, or a compromised account.' },
      { name: 'Help for seniors with apps', subcategory: 'Safety & Support', description: 'Patience, in person, to get video calls and essential apps working.' },
    ],
  },
  {
    id: 'relocation',
    title: 'Relocation Services',
    subtitle: 'Packers, movers, handover, paperwork',
    icon: 'truck',
    tasks: [
      { name: 'PG / house search support', subcategory: 'Find a Home', description: 'Shortlistings, visits and negotiation handled while you are still in your old city.' },
      { name: 'Local area orientation', subcategory: 'Find a Home', description: 'Schools, hospitals, markets and commute times explained before you commit.' },
      { name: 'Packers & movers booking', subcategory: 'Move Execution', description: 'Packing, loading and transport booked with a damage policy in place.' },
      { name: 'House shifting coordination', subcategory: 'Move Execution', description: 'Day-of coordination so the move finishes on the day it was planned for.' },
      { name: 'Utility transfer setup', subcategory: 'Transfers & Paperwork', description: 'Electricity, gas and internet connections shifted to the new address.' },
      { name: 'Society onboarding', subcategory: 'Set Up New Home', description: 'Move-in formalities, keys, parking and housekeeping setup handled.' },
    ],
  },
  {
    id: 'nutrition',
    title: 'NutriFix',
    subtitle: 'Groceries, food delivery, diet plans, meal prep',
    icon: 'shopping-bag',
    tasks: [
      { name: 'Order groceries', subcategory: 'Groceries', description: 'Your regular list ordered from a store near you, with the bill kept.' },
      { name: 'Order food', subcategory: 'Groceries', description: 'Dinner or a full day of meals ordered in, tracked until it arrives.' },
      { name: 'Family nutrition planning', subcategory: 'Diet Plans', description: 'Meal plans for the whole house based on who eats what and who is on a diet.' },
      { name: 'Personalized diet planning', subcategory: 'Diet Plans', description: 'A diet matched to your goals, your preferences and your budget.' },
      { name: 'Nutritionist consultation', subcategory: 'Diet Plans', description: 'Sessions booked and the plan followed up between appointments.' },
      { name: 'Meal subscription coordination', subcategory: 'Meal Delivery', description: 'A recurring meal plan set up, paused or changed whenever you need.' },
      { name: 'Kitchen hygiene checks', subcategory: 'Groceries', description: 'Periodic checks on storage, expiry dates and preparation hygiene.' },
    ],
  },
  {
    id: 'fashion',
    title: 'Fashion & Styling',
    subtitle: 'Salon at home, tailoring, styling, gifting',
    icon: 'scissors',
    tasks: [
      { name: 'Salon at home', subcategory: 'Styling', description: 'Haircuts, colour, facials and spa treatments at home on a booked slot.' },
      { name: 'Event outfit planning', subcategory: 'Styling', description: 'Outfits planned for the occasion, including backup options.' },
      { name: 'Wardrobe organisation', subcategory: 'Styling', description: 'Seasonal storage, repairs flagged and duplicates given away.' },
      { name: 'Tailoring & alterations', subcategory: 'Tailoring & Alterations', description: 'Measurements taken, alterations tracked and pieces collected and returned.' },
      { name: 'Fabric & accessory sourcing', subcategory: 'Sourcing', description: 'Fabric, footwear and accessories sourced and ordered to your specification.' },
      { name: 'Last-minute outfit fixes', subcategory: 'Garment Care', description: 'A tear, a stain or a missing button fixed the day of the event.' },
    ],
  },
  {
    id: 'religious',
    title: 'Religious & Cultural',
    subtitle: 'Pandit booking, puja, temple visits',
    icon: 'sunrise',
    tasks: [
      { name: 'Pooja & pandit booking', subcategory: 'Pooja & Priest', description: 'A verified priest booked, with samagri and timing coordinated.' },
      { name: 'Festival preparation support', subcategory: 'Festivals & Rituals', description: 'Everything needed for the festival bought, arranged and in place on time.' },
      { name: 'Muhurat & calendar planning', subcategory: 'Festivals & Rituals', description: 'Auspicious dates checked and family events planned around them.' },
      { name: 'Temple visit coordination', subcategory: 'Pilgrimage & Community', description: 'Darshan arrangements, special entry and travel to and from the temple.' },
      { name: 'Pilgrimage planning', subcategory: 'Pilgrimage & Community', description: 'Multi-day pilgrimage routes, stays and logistics handled.' },
      { name: 'Funeral & condolence logistics', subcategory: 'Festivals & Rituals', description: 'Support with arrangements, travel and paperwork at a difficult time.' },
      { name: 'Charity & donation coordination', subcategory: 'Materials & Offerings', description: 'Donations routed to verified organisations, with receipts.' },
    ],
  },
  {
    id: 'business',
    title: 'Business Support',
    subtitle: 'Registration, GST, bookkeeping, compliance',
    icon: 'file-text',
    tasks: [
      { name: 'Company registration support', subcategory: 'Company Setup', description: 'Incorporation paperwork filed and tracked with the registrar.' },
      { name: 'GST & tax filing assistance', subcategory: 'Tax & Compliance', description: 'Returns prepared, filed and acknowledged before each deadline.' },
      { name: 'Compliance tracking & reminders', subcategory: 'Tax & Compliance', description: 'A calendar of every statutory due date with reminders ahead of it.' },
      { name: 'CA & accountant coordination', subcategory: 'Documents & Legal', description: 'Your accountant briefed, documents collected and meetings scheduled.' },
      { name: 'License & permit renewals', subcategory: 'Documents & Legal', description: 'Shop, trade and local permits tracked and renewed before they lapse.' },
      { name: 'Digital signature handling', subcategory: 'Documents & Legal', description: 'Documents signed digitally on time, with the trail kept.' },
      { name: 'Vendor invoice follow-ups', subcategory: 'Office Admin', description: 'Invoices raised, chased and reconciled so nothing is paid twice.' },
    ],
  },
  {
    id: 'education',
    title: 'Education Support',
    subtitle: 'Tutors, admissions, exam prep',
    icon: 'book-open',
    tasks: [
      { name: 'Tutor search & scheduling', subcategory: 'Tutors & Classes', description: 'Tutors matched to the subject and grade, then scheduled weekly.' },
      { name: 'Online class setup help', subcategory: 'Tutors & Classes', description: 'Devices, apps and connectivity sorted before the first class.' },
      { name: 'Parent-teacher meeting coordination', subcategory: 'Tutors & Classes', description: 'Meetings scheduled so you can attend without taking a day off.' },
      { name: 'School admission assistance', subcategory: 'Admissions', description: 'Applications, documents and interaction rounds handled for you.' },
      { name: 'Fee payment & reminders', subcategory: 'Tutors & Classes', description: 'Fees paid on time and receipted, with reminders before due dates.' },
      { name: 'Exam form filling', subcategory: 'Exams & Forms', description: 'Competitive and board exam forms filled, submitted and acknowledged.' },
      { name: 'Skill course enrollment', subcategory: 'Courses & Career', description: 'Short courses and certifications shortlisted and enrolled.' },
    ],
  },
  {
    id: 'finance',
    title: 'Insurance & Loans',
    subtitle: 'Compare policies, plan loans, paperwork handled',
    icon: 'shield',
    tasks: [
      { name: 'Compare insurance policies', subcategory: 'Insurance', description: 'Health, motor and home policies compared on premium and cover, not on sales pitch.' },
      { name: 'Policy renewal & document handling', subcategory: 'Insurance', description: 'Renewals done before expiry and every document stored and accessible.' },
      { name: 'Insurance claim coordination', subcategory: 'Claims', description: 'Claims filed, documents assembled and followed up until they are settled.' },
      { name: 'Loan application paperwork', subcategory: 'Loans', description: 'Documents collected, forms filed and the application tracked end to end.' },
      { name: 'Home loan & EMI tracking', subcategory: 'Loans', description: 'Statements, prepayment maths and EMI dates tracked in one place.' },
      { name: 'Investment & savings review', subcategory: 'Advisory', description: 'A scheduled review of where the money sits, with the trade-offs explained.' },
    ],
  },
];
