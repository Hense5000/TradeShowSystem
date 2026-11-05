// Terms of Service, Privacy Policy and Cookie Notice shown on /legal.
// Plain data so the texts are easy to update without touching the page layout.

export const LEGAL_EFFECTIVE_DATE = "5 November 2026";
export const LEGAL_COMPANY = "NielsenGoApps, CVR 20012994, Danmarksvej 26, 2nd floor left, 8800 Viborg, Denmark";
export const LEGAL_EMAIL = "hn@vivolead.com";

export type LegalBlock =
  | { p: string }
  | { list: string[] }
  | { table: { head: string[]; rows: string[][] } };

export type LegalSubsection = { title: string; blocks: LegalBlock[] };
export type LegalSection = { id: string; title: string; intro?: LegalBlock[]; parts: LegalSubsection[] };

export const LEGAL_SECTIONS: LegalSection[] = [
  {
    id: "terms",
    title: "Terms of Service",
    parts: [
      {
        title: "1. Who we are",
        blocks: [
          {
            p: `Trade Show System (the "Service") at https://tss.ngasoft.dk is provided by ${LEGAL_COMPANY} ("we", "us"). Contact: ${LEGAL_EMAIL}.`,
          },
        ],
      },
      {
        title: "2. Who may use the Service",
        blocks: [
          {
            p: "The Service is for businesses only. By creating an account you confirm that you act on behalf of a company or other organisation (the \"Customer\") and that you have authority to accept these Terms for it. Consumer protection rules for private persons therefore do not apply.",
          },
        ],
      },
      {
        title: "3. The Service",
        blocks: [
          {
            p: "The Service gives access to a shared directory of exhibition centres, organisers, trade shows and exhibitors, together with tools for favourites, lead follow-up, notes, meeting plans, exports, email notifications and AI-assisted search. We may improve, change or remove features at any time. We will give reasonable notice of changes that materially reduce the Service.",
          },
        ],
      },
      {
        title: "4. Accounts and users",
        blocks: [
          {
            list: [
              "Each user must have their own login. Logins may not be shared between people. The Service may log out other sessions and ask for an email code on new devices to enforce this.",
              "The Customer is responsible for the users it invites, for keeping passwords safe, and for all activity in its account.",
              `Tell us at once at ${LEGAL_EMAIL} if you suspect unauthorised access.`,
            ],
          },
        ],
      },
      {
        title: "5. Free trial",
        blocks: [
          {
            p: "New Customers get a 7-day free trial. During the trial, downloads and exports (Excel, CSV, CRM export, calendar files, print/PDF of meeting plans) are not available. When the trial ends, access is blocked until a paid subscription is started. No payment card is required for the trial, and it does not convert to a paid plan automatically.",
          },
        ],
      },
      {
        title: "6. Prices, payment and seats",
        blocks: [
          {
            list: [
              "Basic: 49 EUR per user per month. Pro: 99 EUR per user per month. Prices exclude VAT, which is added where required.",
              "Payment is handled by Stripe. Subscriptions are billed monthly in advance and renew automatically until cancelled.",
              "The number of paid seats follows the number of users in the account. Adding a user is charged at once for the rest of the period; removing a user gives a credit on the next invoice.",
              "If payment fails or the subscription ends, access to the account may be blocked until payment is made.",
              "We may change prices with at least 30 days' notice by email. The new price applies from the next billing period after the notice.",
            ],
          },
        ],
      },
      {
        title: "7. Cancellation",
        blocks: [
          {
            p: "The account owner can cancel at any time via the Billing page (Stripe customer portal). Cancellation takes effect at the end of the current billing period. Fees already paid are not refunded, unless mandatory law requires it.",
          },
        ],
      },
      {
        title: "8. Fair use and download limits",
        blocks: [
          {
            p: "Exhibitor downloads are limited per user per day (currently 1 trade show on Basic and 5 on Pro). You may not:",
          },
          {
            list: [
              "resell, republish or share the directory data, or build a competing database from it;",
              "scrape, copy in bulk or access the Service with automated tools, except through features we provide;",
              "use contact data for unlawful marketing, spam, or in breach of GDPR or marketing law;",
              "try to break security, overload the Service, or access other customers' data.",
            ],
          },
          { p: "We may suspend accounts that break these rules." },
        ],
      },
      {
        title: "9. Directory data",
        blocks: [
          {
            p: "The shared directory is compiled from public sources such as trade show websites and exhibitor lists, partly with AI. We do our best to keep it correct, but it may be incomplete, out of date or wrong. Always check important details (dates, venues, contacts) with the source.",
          },
          {
            p: "When you use exhibitor contact details to contact people, you are responsible for doing so lawfully, including having a legal basis under GDPR and following the rules on direct marketing in your country.",
          },
        ],
      },
      {
        title: "10. Your data",
        blocks: [
          {
            p: "Your own content (favourites, lead status, notes, project values, file links, meeting plans, support messages and the like) belongs to you. You give us the right to store and process it only to provide the Service. Our handling of personal data is described in the Privacy Policy below.",
          },
        ],
      },
      {
        title: "11. AI features",
        blocks: [
          {
            p: "Some features use artificial intelligence (Anthropic's Claude) to find trade shows, exhibitors, event pages and contact details. AI output can be wrong and must be checked before you rely on it.",
          },
        ],
      },
      {
        title: "12. Third-party services",
        blocks: [
          {
            p: "You may connect your own Hunter.io account with your own API key. Your use of Hunter.io is governed by Hunter's own terms, and any lookups use your Hunter credits. Contacts found with your key are only visible to your account. Links to files you store elsewhere (Google Drive, Dropbox, Box, SharePoint etc.) are governed by those providers' terms.",
          },
        ],
      },
      {
        title: "13. Availability",
        blocks: [
          {
            p: "We aim for high availability but do not guarantee that the Service is always available or error-free. We may carry out maintenance, preferably outside normal Danish business hours.",
          },
        ],
      },
      {
        title: "14. Liability",
        blocks: [
          {
            list: [
              "The Service is provided \"as is\". To the extent permitted by law, we are not liable for indirect losses, such as lost profit, lost business, lost data or lost goodwill.",
              "Our total liability per calendar year is limited to the fees the Customer paid us in the 12 months before the claim arose.",
              "These limits do not apply to damage caused by gross negligence or intent.",
            ],
          },
        ],
      },
      {
        title: "15. Suspension and termination",
        blocks: [
          {
            p: "We may suspend or close an account if the Customer materially breaches these Terms or does not pay. After an account is closed, we delete the Customer's data as described in the Privacy Policy.",
          },
        ],
      },
      {
        title: "16. Changes to these Terms",
        blocks: [
          {
            p: "We may update these Terms. We will tell account owners by email or in the Service at least 30 days before material changes take effect. Continued use after that date means you accept the new Terms.",
          },
        ],
      },
      {
        title: "17. Governing law and disputes",
        blocks: [
          {
            p: "These Terms are governed by Danish law. Disputes are settled by the Danish courts, with the District Court of Viborg (Retten i Viborg) as first instance.",
          },
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    parts: [
      {
        title: "1. Data controller",
        blocks: [
          {
            p: `${LEGAL_COMPANY}, is responsible for the personal data described here. Questions and requests: ${LEGAL_EMAIL}.`,
          },
          { p: "We have two roles:" },
          {
            list: [
              "Controller for data about our users (accounts, billing, login security, support) and for the shared trade show and exhibitor directory.",
              "Processor for the content customers add in their own account (favourites, lead notes, responsible users, project values, file links, meeting plans, contacts found with the customer's own Hunter key). Here the customer is the controller, and our Data Processing Agreement applies. It is available on request.",
            ],
          },
        ],
      },
      {
        title: "2. What data we process and why",
        blocks: [
          {
            table: {
              head: ["Data", "Whose", "Purpose", "Legal basis (GDPR)", "Kept"],
              rows: [
                ["Name, email, hashed password, company, role", "Users", "Create and run the account", "Contract, art. 6(1)(b)", "While the account exists"],
                ["Billing details (name, address, VAT number, payment status)", "Account owners", "Charge subscriptions", "Contract, art. 6(1)(b); bookkeeping law, art. 6(1)(c)", "5 years after the financial year (Danish Bookkeeping Act)"],
                ["Login codes, trusted devices, session data", "Users", "Secure login, stop login sharing", "Legitimate interest, art. 6(1)(f)", "Codes minutes; trusted devices 30 days"],
                ["Email settings and notification log", "Users", "Send daily emails, reminders and alerts the user has chosen", "Contract, art. 6(1)(b)", "While the account exists"],
                ["Support requests and replies", "Users", "Answer support", "Contract / legitimate interest", "While the account exists"],
                ["Exhibitor business contacts (company, contact name, job title, work email, phone, website, country, booth)", "Employees of exhibiting companies", "Provide the shared trade show directory", "Legitimate interest, art. 6(1)(f)", "While relevant; deleted when the trade show is removed or on request"],
                ["Customer content (favourites, notes, follow-ups, project values, file links, meeting plans)", "Customers' leads and users", "Provide the Service to the customer", "We act as processor", "Until the customer deletes it or closes the account"],
              ],
            },
          },
          { p: "We do not sell personal data, and we do not use it for advertising." },
        ],
      },
      {
        title: "3. Exhibitor contact data (information under art. 14)",
        blocks: [
          {
            p: "The directory contains business contact details for people working at companies that exhibit at trade shows. We collect them from public sources: trade show exhibitor lists, the companies' own websites, and, when a customer uses their own Hunter.io key, Hunter.io. AI (Anthropic's Claude) helps us find and structure this public information.",
          },
          {
            p: `Our legitimate interest is to help businesses find relevant trade shows and business partners. We only store work-related details, not private data. If you are listed and want your details corrected or removed, or you object to the processing, write to ${LEGAL_EMAIL} and we will act within one month.`,
          },
        ],
      },
      {
        title: "4. Processors and recipients",
        blocks: [
          {
            table: {
              head: ["Provider", "What they do", "Location / safeguard"],
              rows: [
                ["Vercel Inc.", "Hosting of the website and app", "USA/EU; EU Standard Contractual Clauses and EU–US Data Privacy Framework"],
                ["Neon Inc. (Databricks)", "Database (Postgres)", "USA/EU; Data Processing Agreement and EU Standard Contractual Clauses"],
                ["Stripe Payments Europe Ltd.", "Subscription payments, invoices, customer portal", "Ireland/USA; SCCs and DPF"],
                ["Resend Inc.", "Sending emails (login codes, notifications, billing links, support)", "USA; SCCs"],
                ["Anthropic PBC", "AI search for trade shows, exhibitors, event pages and contacts", "USA; SCCs. Anthropic does not use API data to train its models"],
                ["Hunter.io (Hunter Web Services)", "Contact lookups, only with the customer's own API key", "France/EU"],
              ],
            },
          },
          {
            p: "We may also share data with authorities when the law requires it, and with advisers (accountant, lawyer) under confidentiality.",
          },
        ],
      },
      {
        title: "5. Transfers outside the EU/EEA",
        blocks: [
          {
            p: "Some providers are in the USA. Transfers are covered by the EU–US Data Privacy Framework where the provider is certified, and otherwise by the EU Commission's Standard Contractual Clauses.",
          },
        ],
      },
      {
        title: "6. Security",
        blocks: [
          {
            p: "We use encrypted connections (HTTPS), hashed passwords, email codes on new devices, one active session per user, encrypted storage of customers' Hunter API keys, and access control so customers only see their own account data.",
          },
        ],
      },
      {
        title: "7. Deletion when an account closes",
        blocks: [
          {
            p: "When a customer closes their account, we delete the account's users and content within 30 days, except data we must keep under bookkeeping law. Backups are overwritten within a further 30 days.",
          },
        ],
      },
      {
        title: "8. Your rights",
        blocks: [
          {
            p: `You have the right to access, correct and delete your data, to restrict or object to processing, and to data portability. Write to ${LEGAL_EMAIL}. We answer within one month.`,
          },
          {
            p: "You can complain to the Danish Data Protection Agency (Datatilsynet), Carl Jacobsens Vej 35, 2500 Valby, www.datatilsynet.dk.",
          },
        ],
      },
      {
        title: "9. Changes",
        blocks: [
          { p: "We may update this policy. The current version is always available on this page, with its effective date at the top." },
        ],
      },
    ],
  },
  {
    id: "cookies",
    title: "Cookie Notice",
    intro: [
      {
        p: "Trade Show System only uses cookies that are strictly necessary to log in and keep your account secure. We do not use analytics, advertising or tracking cookies, and we do not share cookie data with third parties. Because these cookies are necessary for the Service to work, they do not require consent, and no cookie banner is shown.",
      },
      {
        table: {
          head: ["Cookie", "Purpose", "Duration"],
          rows: [
            ["authjs.session-token (or __Secure-authjs.session-token)", "Keeps you logged in", "Session / until you log out"],
            ["authjs.csrf-token, authjs.callback-url", "Protects the login form against forgery and returns you to the right page", "Session"],
            ["tss_login", "Remembers a login in progress while you enter the email code", "A few minutes"],
            ["tss_device", "Remembers that this browser is trusted, so you are not asked for an email code every time", "30 days"],
          ],
        },
      },
      {
        p: "You can delete or block cookies in your browser settings, but then you cannot log in. Payments happen on Stripe's own pages, which set their own cookies under Stripe's cookie policy.",
      },
      { p: `Questions: ${LEGAL_EMAIL}.` },
    ],
    parts: [],
  },
];
