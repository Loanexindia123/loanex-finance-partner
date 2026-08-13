## Bank Account Verification

> **Note:** Bank Statement Analysis PDF flow is temporarily disabled (IDSPay returns
> `User not authorized to access this service`). Active path is penny-less account verify.

### APIs

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/verification/bank/status` | JWT |
| POST | `/api/v1/verification/bank/verify` | JWT |

### Behaviour

- Fail-closed: bank is **never** marked `VERIFIED` without a successful IDSPay response.
- Provider: **IDSPAY** via `POST .../bank-verification/pennyless`
- Payload: `api_id`, `api_key`, `token_id`, `account_number`, `bank_ifsc`, `ifsc_details`
- Credentials: `DIGILOCKER_API_ID`, `DIGILOCKER_API_KEY`, `DIGILOCKER_TOKEN_ID`
- Requires completed PAN verification
- On success → stores masked account + hash, sets bank verified flags, returns `nextStep: VERIFICATION_SUMMARY`

### Env

```
BANK_VERIFICATION_PROVIDER=IDSPAY
BANK_VERIFICATION_LATITUDE=28.6139
BANK_VERIFICATION_LONGITUDE=77.2090
```

### Frontend

- Live KYC page: `/verification` (Aadhaar → PAN → **Bank** section)
- On bank success → `/verification/summary` (EMI eligibility)
