export interface ExamplePage {
  title: string;
  url: string;
  description: string;
}

export interface ExampleGroup {
  label: string;
  pages: ExamplePage[];
}

export const exampleGroups: ExampleGroup[] = [
  {
    label: "Dashboards",
    pages: [
      { title: "Default", url: "/examples/default", description: "Metric cards, performance chart, customers table." },
      { title: "CRM", url: "/examples/crm", description: "Pipeline, opportunities table and reminders." },
      { title: "Finance", url: "/examples/finance", description: "Cash flow, spending and card overview." },
      { title: "Analytics", url: "/examples/analytics", description: "Traffic KPIs, top pages and sources." },
      { title: "Productivity", url: "/examples/productivity", description: "Tasks and focus overview." },
      { title: "E-commerce", url: "/examples/ecommerce", description: "Orders, inventory and top products." },
      { title: "Academy", url: "/examples/academy", description: "Schedule, assignments and performance." },
      { title: "Logistics", url: "/examples/logistics", description: "Fleet and shipment tracking." },
      { title: "Infrastructure", url: "/examples/infrastructure", description: "Servers and service health." },
      { title: "File manager", url: "/examples/file-manager", description: "Storage overview and files." },
      { title: "Patient monitoring", url: "/examples/patient-monitoring", description: "Vitals and alerts." },
      { title: "Crypto", url: "/examples/crypto", description: "Portfolio, price chart and exchanges." },
      { title: "HR", url: "/examples/hr", description: "People, hiring and time-off." },
    ],
  },
  {
    label: "Apps",
    pages: [
      { title: "Products", url: "/examples/products", description: "Product catalogue with a data table." },
      { title: "Email", url: "/examples/mail", description: "Mail client layout." },
      { title: "Chat", url: "/examples/chat", description: "Chat inside the dashboard shell." },
      { title: "Chat (full page)", url: "/examples/chat-app", description: "Standalone chat layout." },
      { title: "Calendar", url: "/examples/calendar", description: "Event calendar." },
      { title: "Kanban", url: "/examples/kanban", description: "Drag-and-drop board." },
      { title: "Tasks", url: "/examples/tasks", description: "Task table with filters." },
      { title: "Invoice", url: "/examples/invoice", description: "Invoice builder and preview." },
    ],
  },
  {
    label: "Pages",
    pages: [
      { title: "Profile", url: "/examples/profile", description: "Profile and settings page." },
      { title: "Users", url: "/examples/users", description: "User management table." },
      { title: "Roles", url: "/examples/roles", description: "Roles and permissions." },
      { title: "Coming soon", url: "/examples/coming-soon", description: "Placeholder page." },
    ],
  },
  {
    label: "Legacy dashboards",
    pages: [
      { title: "Default V1", url: "/examples/default-v1", description: "Previous default dashboard." },
      { title: "CRM V1", url: "/examples/crm-v1", description: "Previous CRM dashboard." },
      { title: "Finance V1", url: "/examples/finance-v1", description: "Previous finance dashboard." },
      { title: "Analytics V1", url: "/examples/analytics-v1", description: "Previous analytics dashboard." },
    ],
  },
  {
    label: "Authentication",
    pages: [
      { title: "Login v1", url: "/examples/auth/v1/login", description: "Split-screen login." },
      { title: "Register v1", url: "/examples/auth/v1/register", description: "Split-screen register." },
      { title: "Login v2", url: "/examples/auth/v2/login", description: "Centered login with side panel." },
      { title: "Register v2", url: "/examples/auth/v2/register", description: "Centered register with side panel." },
    ],
  },
];
