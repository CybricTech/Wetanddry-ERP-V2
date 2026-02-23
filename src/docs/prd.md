# PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Project Title:** Wet & Dry Ltd Enterprise Resource Planning System (ERP)
**Prepared By:** Cybric Technologies
**Date:** October 30th 2025
**Version:** 3.0 (Updated February 2026)
**Last Updated:** February 23rd, 2026

---

## 1. Executive Summary
The Wet & Dry ERP is a specialized Enterprise Resource Planning solution tailored for the ready-mix concrete industry. The system digitizes the end-to-end operations of Wet & Dry Ltd, replacing manual paper trails with a centralized digital infrastructure.

The core objective is to create a "Single Source of Truth" for inventory, asset logistics, production formulas (Mixology), customer relationships, sales orders, and financial accountability.

---

## 2. Strategic Objectives
* **Operational Integrity:** Eliminate human error in material calculations and delivery tracking.
* **Inventory Control:** Centralize stock management with real-time deduction logic for cement, aggregates, and consumables across multiple storage locations.
* **Asset Maximization:** Monitor truck lifecycles, maintenance schedules, and fuel efficiency to reduce downtime.
* **Financial Accountability:** Link operational inputs (diesel, materials) directly to financial outputs (billing, cost analysis).
* **Customer Management:** Maintain comprehensive client records with credit tracking, project management, and sales pipeline visibility.
* **Data-Driven Decisions:** Real-time dashboards and financial reports for operational and strategic decision-making.

---

## 3. User Roles & Governance

| Role | Access Level & Responsibilities | Permission Count |
| :--- | :--- | :--- |
| **Super Admin** | Full system governance; configuration of global settings, user management, all module access, and audit log access. | 38 permissions |
| **Manager** | Oversees logistics, approves workflows, manages fleet operations, CRM, orders, and monitors reports. | 30 permissions |
| **Storekeeper** | Controls inventory ingress/egress; manages storage locations; validates physical stock; logs fuel consumption. | 10 permissions |
| **Accountant** | Read-only financial oversight; views inventory, maintenance, fuel records, CRM, and financial reports. | 18 permissions |

### Permission Groups
Permissions are enforced at both the page level (server-side redirects) and the action level (server action authorization checks). Key permission groups include:
* User & Staff Management
* Fleet Operations (trucks, maintenance, documents)
* Inventory (CRUD, approvals, reconciliation)
* Production (recipes, runs, scheduling)
* Fuel Management
* CRM (clients, contacts, expenses)
* Orders & Payments
* Reporting & Analytics

---

## 4. Functional Requirements

### 4.1 Dashboard
**Purpose:** To provide a real-time operational overview across all modules.

**Implemented Features:**
* Summary statistics for trucks, inventory, production, and orders
* Truck status breakdown (Available, In Use, Maintenance)
* Low stock alerts and total inventory valuation
* Recent activity feed (fuel logs, exceptions, production runs)
* Quick-navigation links to key modules
* Responsive, mobile-friendly layout
* Role-based content visibility

### 4.2 Truck & Fleet Management Module
**Purpose:** To maintain a digital registry of all heavy machinery and logistics assets, ensuring optimal uptime and asset longevity.

**Implemented Features:**
* **Digital Asset Registry:** Full CRUD for vehicles including plate number, model, purchase date, capacity, mileage, and status tracking (Available, In Use, Maintenance).
* **Component Lifecycle Tracking:** Dedicated tracking for high-wear components (Tires, Batteries, Filters, Brakes, etc.). Records installation dates and calculates expected replacement dates based on lifespan.
* **Maintenance Records:** Log service history with date, type, cost, mileage at service, and status tracking.
* **Maintenance Scheduler:** Automated scheduling based on date intervals, mileage intervals, or both. Priority levels (Low, Medium, High, Critical) with due date/mileage tracking.
* **Spare Parts Inventory:** Track parts by Part Number, Name, Quantity, Minimum Quantity, Purchase Price, and Supplier with low-stock alerts.
* **Document Management:** Store and manage truck certifications, insurance, and inspection documents with expiry date tracking and file uploads via Cloudinary.
* **Fuel Consumption Tracking:** Per-truck fuel logs with efficiency calculations (km/L).
* **Fleet Analytics:** Dashboard with aggregate statistics (total trucks, maintenance overdue, fuel costs).

### 4.3 Advanced Inventory Management
**Purpose:** To manage multi-location stock levels with strict distinction between storage locations to prevent "virtual pooling" of physical assets.

**Implemented Features:**
* **Storage Location Management:** Support for Silos, Containers, and Warehouses with independent capacity tracking and level monitoring.
* **Category Logic:** Items categorized as *Assets*, *Consumables*, or *Equipment*.
* **Perishable Management:** Expiry date tracking for chemical admixtures with 30-day expiration alerts.
* **Approval Workflow:**
    1. Storekeeper initiates "Material Request" or "Stock In/Out".
    2. Admin/Manager reviews and approves or rejects.
    3. System updates Master Inventory Record.
* **Stock Transactions:** Full IN, OUT, and ADJUSTMENT transaction logging with supplier info, invoice numbers, waybill numbers, and ATC numbers (for cement).
* **Price History Tracking:** Material price changes recorded over time with effective dates and source references.
* **Stock Reconciliation:** Periodic physical-vs-system count audits with Draft, In Progress, and Completed status tracking per storage location.
* **Low Stock Alerts:** Automatic notifications when items fall below configured minimum thresholds.
* **Batch Tracking:** Lot/batch number assignment for traceability.

### 4.4 Production Automation (Mixology Integration)
**Purpose:** To automate material deduction based on production output, ensuring the digital inventory matches physical consumption.

**Implemented Features:**
1. **Recipe Configuration:** Admin defines "Master Recipes" (e.g., C10, C25, C30) with exact ingredient quantities and units, linked to inventory items.
2. **Production Runs:** Operators select a recipe and quantity (m³), and the system calculates total required materials.
3. **Auto-Deduction:** The system automatically debits calculated amounts from the Inventory Module upon production completion.
4. **Variance Tracking:** Planned vs. actual material usage is tracked per production run, with variances flagged for review.
5. **Production Scheduling:** Future production runs can be scheduled with status tracking (Scheduled, In Progress, Completed, Delayed, Rescheduled).
6. **Client & Order Attribution:** Production runs are linked to specific clients, sales orders, and storage locations (silos).

### 4.5 Diesel & Fuel Intelligence
**Purpose:** To track fuel costs against operational output with high granularity.

**Implemented Features:**
* **Fuel Consumption Logs:** Per-truck and per-equipment fuel logging with date, liters, cost, and mileage tracking.
* **Fuel Efficiency Metrics:** Automatic calculation of km/L efficiency for trucks. Mileage updates integrated with truck records.
* **Fuel Deposits:** Record bulk fuel purchases with liters, price per liter, total cost, supplier information, and recording user tracking.
* **Equipment Fueling:** Fuel issuance expanded beyond trucks to include generators, pumps, compressors, and other equipment.
* **Equipment Registry:** Manage non-vehicle equipment (Generators, Pumps, Compressors) with status tracking.

**Planned Enhancements:**
* Fuel reconciliation module with running balance, historical pricing logs, and blended pricing calculations for mixed deposits.
* Route-based fuel issuance calculation.

### 4.6 Production Exceptions (Dump & Divert)
**Purpose:** To handle non-standard delivery scenarios where concrete cannot be delivered to the original customer, ensuring financial and inventory accuracy.

**Implemented Features:**
* **Exception Logging:** Record dump and divert events with type, reason, quantity, and unit tracking.
* **Attribution:** Link exceptions to specific trucks, recipes, or clients.
* **Reason Categories:** Bad mix, truck breakdown, client rejection, traffic delay, equipment failure, and other configurable reasons.
* **Status Tracking:** Resolved vs. unresolved exception management.
* **Dashboard View:** Overview of all exceptions with filtering.

### 4.7 Customer Relationship Management (CRM)
**Purpose:** To manage the complete customer lifecycle from acquisition through ongoing service delivery.

**Implemented Features:**
* **Client Registry:** Full CRUD with auto-generated client codes (CLI-001, CLI-002, etc.).
* **Client Types:** Business, Individual, and Government classifications.
* **Client Categories:** VIP, Regular, New, and Dormant segmentation.
* **Status Management:** Active, Inactive, Suspended, and Blacklisted states.
* **Contact Management:** Multiple contacts per client with primary contact designation, including name, role, email, and phone.
* **Document Storage:** Contracts, agreements, and quotes with expiry tracking and Cloudinary file uploads.
* **Credit Management:** Credit limits, current balance tracking, and wallet balance for prepayments.
* **Client Statistics:** Aggregated metrics including total orders, volume ordered, and total expenses per client.
* **Search & Filtering:** By status, category, and free-text search.

### 4.8 Sales Orders & Payments
**Purpose:** To manage the full sales pipeline from order creation through fulfillment and payment collection.

**Implemented Features:**
* **Sales Orders:** Create orders with auto-generated order numbers (SO-YYYY-00001).
* **Order Line Items:** Specify quantities and unit prices per recipe/product.
* **Order Lifecycle:** Draft, Pending, Active, Fulfilled, Closed, and Cancelled statuses.
* **Order Activation Threshold:** Configurable threshold (default 30%) — orders activate only when sufficient payment is received.
* **Payment Recording:** Multiple payment methods (Cash, Bank Transfer, Cheque, Prepayment Drawdown).
* **Payment Schedules:** Define installment plans with due dates, amounts, and status tracking (Pending, Paid, Overdue).
* **Prepayment System:** Client prepayments with wallet-based drawdown for order payments.
* **Delivery Tracking:** Monitor delivered quantities vs. ordered quantities per line item.
* **Financial Summary:** Real-time total amount, paid amount, and remaining balance per order.

### 4.9 Staff Management
**Purpose:** To maintain a comprehensive employee registry for workforce management.

**Implemented Features:**
* **Staff Registry:** Employee records with personal details (name, email, phone, address).
* **Role & Department Tracking:** Organize staff by role and department.
* **Status Management:** Active, On Leave, Terminated, and Contract statuses.
* **Document Storage:** ID documents, contracts, and agreements with expiry tracking.
* **Search & Filtering:** By name, role, department, and status.

### 4.10 User Management
**Purpose:** To control system access through user account administration.

**Implemented Features:**
* **User CRUD:** Create, read, update, and delete system user accounts (Super Admin only).
* **Role Assignment:** Assign one of four roles (Super Admin, Manager, Storekeeper, Accountant) with corresponding permission sets.
* **Password Security:** Bcrypt-hashed passwords with secure credential management.

### 4.11 Global Search
**Purpose:** To provide instant cross-module search capability from anywhere in the application.

**Implemented Features:**
* Search across 5 entity types: Trucks, Inventory Items, Staff, Clients, and Orders.
* Debounced search input (300ms) for performance.
* Real-time dropdown results with category badges and icons.
* Direct navigation to matched entity pages.
* Minimum 2-character input threshold; maximum 5 results per category.

### 4.12 Notification System
**Purpose:** To proactively alert users of important events requiring attention.

**Implemented Features:**
* **In-App Notifications:** Real-time notification bell with unread count and notification list.
* **Web Push Notifications:** Browser-level push notifications via the Web Push API.
* **User Preferences:** Configurable notification settings per user.
* **Event-Based Triggers:**
    * Low stock alerts (items below minimum threshold)
    * Maintenance due reminders
    * Document expiry warnings
    * Material request approval/rejection notifications
    * Production run completion alerts
    * Exception alerts (dump/divert events)

---

## 5. Reporting & Analytics

### 5.1 Finance Module
**Implemented Features:**
* **Company-Wide Financials:** Aggregated financial overview accessible to Manager, Accountant, and Super Admin roles.
* **Inventory Valuation:** Total inventory value calculations across all storage locations.
* **Fuel Cost Analysis:** Last 30 days fuel spending breakdown.
* **Maintenance Cost Tracking:** Service and repair expense summaries.
* **Spare Parts Inventory Value:** Total value of spare parts on hand.
* **Production Metrics:** Recent production run counts and output volumes.
* **Stock Movement Analysis:** IN/OUT transaction values for recent periods.

### 5.2 KPI Dashboard
* Truck status distribution and availability rates.
* Stock levels and low-stock item counts.
* Recent activity feeds across all modules.
* Total inventory valuation.

### 5.3 Planned Reporting Enhancements
* % Schedule Adherence for Maintenance.
* Stock Accuracy % (System vs. Physical Count from reconciliation data).
* Fuel Efficiency Trends (Liters per Trip / km per Liter).
* Mix Consistency % (planned vs. actual material usage).
* CRM-specific metrics (customer acquisition, sales pipeline, conversion rates).
* Diesel Cost/Day and Material Cost per m³ of concrete produced.

---

## 6. Technical Architecture & Stack

### 6.1 Implemented Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router) | Full-stack React framework with Server Actions |
| **Language** | TypeScript | End-to-end type safety |
| **UI Library** | React 19 | Component-based frontend |
| **Styling** | Tailwind CSS 4 | Utility-first responsive design |
| **Database** | PostgreSQL (Neon) | Cloud-hosted relational database |
| **ORM** | Prisma 6 | Type-safe database access with migrations |
| **Authentication** | NextAuth 5 (Auth.js) | Email/password authentication with session management |
| **File Storage** | Cloudinary | Document and image upload/storage |
| **Form Handling** | React Hook Form + Zod | Client-side validation with runtime type checking |
| **Notifications** | Web Push API + In-App | Browser push and in-app notification system |
| **Icons** | Lucide React | Consistent iconography |
| **Animations** | Framer Motion | UI animations and transitions |
| **Hosting** | Vercel | Cloud deployment with edge functions |

### 6.2 Architecture Patterns
* **Server Actions:** All database operations use Next.js Server Actions with automatic permission checking and cache revalidation.
* **Parallel Data Fetching:** Server components use `Promise.all()` for concurrent data loading.
* **RBAC Enforcement:** Permissions checked at both page level (server-side redirects) and action level (authorization errors).
* **Modal-Based Forms:** Create/edit operations use modal dialogs with React Hook Form validation.
* **Toast Notifications:** User feedback via Sonner toast library.

### 6.3 Security
* **Role-Based Access Control (RBAC):** Enforced at both UI and API/action levels with 30+ granular permissions.
* **HTTPS/TLS:** Encryption for all data in transit (enforced by Vercel).
* **Password Hashing:** Bcrypt with salt for all user credentials.
* **Session Management:** Secure, server-validated sessions via NextAuth.
* **Input Validation:** Zod schema validation on all form inputs and server actions.

### 6.4 Database Schema
The system implements **23 core database models** organized across modules:
* **Fleet:** Truck, TruckDocument, MaintenanceRecord, MaintenanceSchedule, Part, SparePartInventory, FuelLog, FuelDeposit
* **Inventory:** InventoryItem, StorageLocation, StockTransaction, MaterialRequest, MaterialPriceHistory, StockReconciliation
* **Production:** Recipe, RecipeIngredient, ProductionRun, ProductionMaterialUsage
* **CRM & Sales:** Client, ClientContact, ClientDocument, SalesOrder, OrderLineItem, Payment, PaymentScheduleItem, Prepayment
* **Projects & Finance:** Project, Expense
* **Operations:** Equipment, ExceptionLog, Staff
* **System:** User, Notification

---

## 7. System Review Status

Based on the comprehensive system review conducted on February 15, 2026, the following is the current status of identified issues:

### 7.1 Resolved Issues
* Fleet module crashes when adding maintenance records, components, scheduling, and documents — **Fixed** (permissions and error handling added).
* Fuel deposit functionality (add litres and price per litre) — **Implemented** with full deposit tracking.
* Global search non-functional — **Implemented** with search across 5 entity types.
* Login page branding ("EMS" to "ERP") — **Updated**.

### 7.2 Outstanding Issues (Tracked for Future Sprints)

**High Priority:**
* Fuel reconciliation system needed — running balance with blended pricing for mixed deposits.
* Stock Out form layout/spacing issues preventing proper submission.
* Staff document uploads not persisting correctly.
* Reports module not displaying CRM-specific data metrics.
* Fuel issuance expanded to equipment but reconciliation logic still needed.

**Medium Priority:**
* "Create New Order" popup using outdated UI design.
* Search bar styling inconsistency between Fleets and Orders modules.
* Staff page should auto-redirect after successful save.
* Document viewer UX in Staff module should match Inventory module patterns.
* "Update stored unit cost" checkbox needs clearer help text/tooltip.
* Expenses functionality should be moved from CRM to Reports/Finance module.
* CRM Analytics section needs CRM-specific metrics or removal.

**Low Priority:**
* "POWERED BY CYBRIC TECHNOLOGIES" text should link to Cybric.tech.
