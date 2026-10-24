# Database Mapping — UI field ↔ Sheet column

The exact `Transactions` header order is preserved (columns A–W). The backend
reads/writes **by header name**, so column order is never assumed or changed.

## `Transactions` (A–W)

| # | Sheet column | UI field | Written by | Notes |
|---|---|---|---|---|
| A | Transaction ID | — (auto) | server | `EXP-YYYYMMDD-####` |
| B | Timestamp | — (auto) | server | `dd/MM/yyyy HH:mm:ss` on create |
| C | Expense Date | Expense Date | user | `dd/MM/yyyy` (from date picker) |
| D | Type of Transaction | Type | user | dropdown |
| E | Amount Recv By | Amount Received By | user | PAYMENT RECV only |
| F | Expense Category | Category | user | dropdown |
| G | Customer Name | Customer | user | conditional |
| H | Employee Name | Employee / Payee | user | searchable |
| I | Payment Method | Method | user | dropdown |
| J | Amount | Amount | user | number |
| K | Approved By | Approved By | user | dropdown |
| L | Bill / Payment Proof | proof upload | server | `Expense_Sheet_Images/…` |
| M | Expense Reference Proof | ref proof | server | optional |
| N | Purpose / Remarks | Purpose | user | text |
| O | Status | Status | server | default `PAID` |
| P | Entered By | — | server | principal name |
| Q | User Email | — | server | principal email |
| R | Record Status | — | server | `Active` / `Deleted` |
| S | Updated At | — | server | ISO, on edit |
| T | Updated By | — | server | on edit |
| U | Deleted By | — | server | on soft-delete |
| V | Deleted At | — | server | on soft-delete |
| W | Delete Reason | delete reason | user | on soft-delete |

## Master sheets

| Sheet | Columns |
|---|---|
| `Employee_Master` | Employee ID, Name, Department, Designation, Mobile, Email, Active, Approval Limit, Remarks |
| `Category_Master` | Category ID, Category Name, Type, Active, Display Order, Needs Customer, Description |
| `Approver_Master` | Approver ID, Name, Email, Level, Active |
| `Receiver_Master` | Receiver ID, Name, Active, Display Order |
| `User_Master` | User ID, Name, Email, Mobile, Role, Department, Password Hash, Active, Can Add, Can Edit, Can Delete, Can Approve, Can Export, Can View Dashboard, Can Manage Masters, Last Login |
| `Settings` | Key, Value, Type, Group, Description |
| `Audit_Log` | At, User Email, User Name, Action, Entity, Record ID, Details, IP, Source |
| `Counters` | Key, Value, Note |

## ID sequences
| Entity | Format | Generator |
|---|---|---|
| Transaction | `EXP-YYYYMMDD-####` | `nextTxId_` (per expense date) |
| Employee | `EMP-###` | `nextMasterId_` |
| Category | `CAT-###` | `nextMasterId_` |
| Approver | `APR-###` | `nextMasterId_` |
| Receiver | `RCV-###` | `nextMasterId_` |
| User | `USR-###` | `nextMasterId_` |

## Password hash format
`sha256$<iterations>$<saltHex>$<base64>` — iterate SHA-256 over
`saltHex + password`, carrying the Base64 string forward each round
(`iterations` = 5000). Implemented in `hashPassword_` / `verifyPassword_` (`Lib.gs`)
and matched client-side only for the offline demo.
