# AppSheet Application Analysis & Feature Map

Analysis of the existing **ExpenseSheet** AppSheet app (view `Expense_Sheet`) and
its V2 Google Sheets database, and how each capability is reproduced in this
website + Android app.

## Data model (9 sheets, reproduced exactly — nothing renamed/reordered)

| Sheet | Rows | Purpose |
|---|---|---|
| `Transactions` | 1,178 | Main ledger. 23 columns incl. soft-delete + audit fields. |
| `Employee_Master` | 130 | Employees / payees (ID, Name, Dept, …, Approval Limit). |
| `Category_Master` | 8 | Categories with `Type` (Expense/Receipt/Return) + `Needs Customer`. |
| `Approver_Master` | 3 | Approvers with `Level`. |
| `Receiver_Master` | 2 | Who money is received by (VISHU SIR, SURENDRA SIR). |
| `User_Master` | 3 | Users, roles, hashed passwords, 9 permission flags. |
| `Settings` | 20 | Business rules (thresholds, proof, limits, locks…). |
| `Audit_Log` | — | Timestamped actions. |
| `Counters` | — | Sequences + live self-check formulas. |

## Form fields & dropdown domains (the "questions")

| Field | Input | Source / rule |
|---|---|---|
| Type of Transaction | dropdown | `PAYMENT PAID`, `PAYMENT RECV`, `RECV FROM EMPLOYEE` |
| Expense Date | date | within `ALLOW_BACKDATE_DAYS` (30) … `ALLOW_FUTURE_DAYS` (0) |
| Expense Category | dropdown | active `Category_Master`, ordered by Display Order |
| Customer Name | text | **required** when the category's `Needs Customer` = TRUE |
| Employee / Payee | searchable | `Employee_Master` (hidden for PAYMENT RECV) |
| Amount Received By | dropdown | `Receiver_Master` (shown only for PAYMENT RECV) |
| Payment Method | dropdown | `ONLINE TRANSACTION`, `CASH` |
| Amount | number | > 0 |
| Approved By | dropdown | `Approver_Master` |
| Bill / Payment Proof | image | uploaded to `Expense_Sheet_Images` on Drive |
| Expense Reference Proof | image | optional secondary proof |
| Purpose / Remarks | text | free text |

## Business logic / validation (from `Settings`, all enforced server-side)

| Rule | Setting | Behaviour |
|---|---|---|
| Proof for online | `REQUIRE_PROOF_ONLINE=TRUE` | block online entry with no proof |
| Proof for large cash | `REQUIRE_PROOF_CASH_ABOVE=5000` | block cash ≥ ₹5,000 with no proof |
| Back-date limit | `ALLOW_BACKDATE_DAYS=30` | reject dates older than 30 days |
| Future limit | `ALLOW_FUTURE_DAYS=0` | reject future dates |
| Duplicate guard | `DUPLICATE_WINDOW_MIN=5` | same amount+type+party in 5 min → confirm |
| High-value flag | `HIGH_VALUE_THRESHOLD=25000` | warn (not block) |
| Cash alerts | `CASH_WARNING_BELOW=4000`, `CASH_CRITICAL_BELOW=3000` | dashboard colour flags |
| Spend spike | `SPIKE_MULTIPLIER=2` | today > 2× 30-day avg → flag |
| Month lock | `MONTH_LOCK_BEFORE` | block add/edit on/before a date |
| Opening balance | `OPENING_BALANCE`, `OPENING_BALANCE_DATE` | cash-in-hand base |
| FY / currency | `FY_START_MONTH=4`, `CURRENCY_SYMBOL=₹` | Indian FY, ₹ |
| Session | `SESSION_DAYS=30` | login remembered 30 days |

## Workflows / automations reproduced
- **Auto ID**: `EXP-YYYYMMDD-####` per expense date (same scheme as existing data).
- **Timestamp** on create; **Updated At/By** on edit.
- **Soft delete**: sets `Record Status=Deleted` + `Deleted By/At/Reason`; restorable.
- **Audit logging** of every login/create/update/delete/restore.
- **Role-based access** via the 9 `Can *` flags (enforced on the server).
- **Proof capture** to the same Drive folder, stored as `Expense_Sheet_Images/…`.

## Improvements over the original
- Live KPI dashboard with charts and anomaly flags.
- Server-side search across the whole ledger + date-range reports + CSV export.
- Installable PWA + APK, offline app shell, dark mode.
- Tunable rules from a Settings screen; full audit visibility in-app.
