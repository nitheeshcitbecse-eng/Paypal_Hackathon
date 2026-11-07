export type Decision = "Approved" | "Held" | "Blocked";

export interface Transaction {
  id: string;
  merchant: string;
  merchantInitials: string;
  product: string;
  agent: string;
  amount: number;
  currency: string;
  date: string;
  status: Decision;
  category: string;
  reason: string;
  receiptId: string;
}

export const transactions: Transaction[] = [
  {
    id: "PP-AG-99214-X",
    merchant: "Autonomous Research Lab",
    merchantInitials: "AR",
    product: "Enterprise LLM API Token Pack",
    agent: "ResearchPilot",
    amount: 349,
    currency: "USD",
    date: "Today, 10:42 AM",
    status: "Held",
    category: "Software",
    reason: "Exceeds standard agent autonomy cap ($250.00) by $99.00.",
    receiptId: "rcpt_7F3B2A9914",
  },
  {
    id: "PP-AG-99208-K",
    merchant: "Adobe",
    merchantInitials: "A",
    product: "Creative Cloud subscription",
    agent: "CreativeCopilot",
    amount: 54.99,
    currency: "USD",
    date: "Today, 9:18 AM",
    status: "Approved",
    category: "Software",
    reason: "Trusted merchant and under the $250 per-transaction limit.",
    receiptId: "rcpt_82ED1208A4",
  },
  {
    id: "PP-AG-99197-J",
    merchant: "Unverified Cloud Hosting",
    merchantInitials: "UC",
    product: "Dedicated compute instance",
    agent: "DevOpsRunner",
    amount: 450,
    currency: "USD",
    date: "Today, 8:56 AM",
    status: "Blocked",
    category: "Cloud services",
    reason: "Merchant is not a verified PayPal merchant and has no return policy.",
    receiptId: "rcpt_A9231C509B",
  },
  {
    id: "PP-AG-99183-C",
    merchant: "Office Depot",
    merchantInitials: "OD",
    product: "Ergonomic desk accessories",
    agent: "OfficeAssist",
    amount: 82.4,
    currency: "USD",
    date: "Yesterday, 4:32 PM",
    status: "Approved",
    category: "Office Supplies",
    reason: "Within the configured budget from a verified merchant.",
    receiptId: "rcpt_D912A84C02",
  },
  {
    id: "PP-AG-99169-T",
    merchant: "CryptoVault",
    merchantInitials: "CV",
    product: "Digital asset wallet bundle",
    agent: "ResearchPilot",
    amount: 129,
    currency: "USD",
    date: "Yesterday, 2:10 PM",
    status: "Blocked",
    category: "Crypto",
    reason: "Crypto purchases are hard-blocked by your Strict policy.",
    receiptId: "rcpt_113AA91B08",
  },
  {
    id: "PP-AG-99155-M",
    merchant: "Delta Air Lines",
    merchantInitials: "DL",
    product: "SFO → SEA · round trip",
    agent: "TravelMate",
    amount: 218,
    currency: "USD",
    date: "Yesterday, 11:06 AM",
    status: "Approved",
    category: "Travel",
    reason: "Approved under the travel budget with a 24-hour cancellation window.",
    receiptId: "rcpt_0FB82E43C1",
  },
];

export const activity = transactions.slice(1, 5);

export const spendingByDay = [
  { day: "Mon", amount: 42 },
  { day: "Tue", amount: 115 },
  { day: "Wed", amount: 76 },
  { day: "Thu", amount: 195 },
  { day: "Fri", amount: 88 },
  { day: "Sat", amount: 56 },
  { day: "Sun", amount: 128 },
];
