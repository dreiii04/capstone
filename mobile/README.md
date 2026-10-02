# Verifitor Mobile

Flutter client for Verifitor document requests, payments, notifications, and
account management.

## API architecture

The mobile and web clients use separate API deployments with client-specific
route contracts. Both backends can use the same database and authentication
settings, but the Flutter client must target the mobile backend because routes
such as `/profile`, `/payments/receipt`, and `/refunds` are not exposed by the
web-admin API.

```text
Web client ----> Web API ----\
                            > Shared database
Mobile client -> Mobile API -/
```

The mobile API URL is defined once in `lib/constants.dart` as
`ApiConstants.baseUrl`:

```text
https://verifitor-backend-beta.vercel.app/api
```

All HTTP and multipart requests are created by `MongoDataApiService` from that
constant.

The same Flutter code can target another environment at build time without
changing source files:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
flutter build apk --release --dart-define=API_BASE_URL=https://verifitor-backend-beta.vercel.app/api
flutter build web --dart-define=API_BASE_URL=https://verifitor-backend-beta.vercel.app/api
```

For a browser deployment, set the backend's `ALLOWED_ORIGIN` environment
variable to the web application's HTTPS origin. Multiple web origins are
comma-separated. Native mobile requests do not send a browser origin and use
the same backend automatically.

## Expected API contract

The mobile client retains these existing relative routes under the shared
`/api` prefix:

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/register/request-otp`
- `POST /auth/register/verify-otp`
- `POST /auth/forgot-password/request-otp`
- `POST /auth/forgot-password/verify-otp`
- `POST /auth/forgot-password/reset`
- `GET, PUT /profile`
- `POST /profile/photo`
- `PUT /profile/password`
- `GET, POST /requests`
- `GET /receipts`
- `POST /payments/receipt`
- `GET /notifications`
- `GET /transactions`
- `POST /refunds`

Unsuccessful authentication responses display the message returned by the
shared API, including inactive or deactivated account messages.

## Run and verify

```powershell
flutter pub get
flutter run
flutter analyze
flutter test
```

## Request processing and account recovery configuration

New mobile passwords support 8–1024 characters (including long UTF-8
passwords). New credentials use Node.js scrypt with a random salt; existing
bcrypt hashes remain valid for login. The mobile API rejects passwords longer
than 1024 characters before hashing or verification. Legacy bcrypt credentials
retain bcrypt's 72-byte comparison behavior until the account holder changes
or resets the password. The email entered at registration is trimmed and
lowercased, and ownership is still proven through the existing OTP flow.

Express stays unavailable until the Registrar supplies all policy values.
Configure `EXPRESS_REQUEST_POLICY` on the **mobile backend** with JSON shaped
like this (the values below illustrate the format and are not school policy):

```json
{"documents":["<eligible catalog document>"],"additionalFee":0,"processingTime":"<Registrar-approved target>","startsWhen":"<Registrar-approved starting event>"}
```

The backend calculates the extra fee and total from this policy; values sent
by a client cannot change the price. `GET /api/request-policy` exposes the
published options to the app. Express requests receive `processingOption:
"express"` and `priority: 1` in the shared MongoDB request record. Staff
software must read these fields to display and sort Express requests.

The tracking UI maps stored statuses as follows: `Pending for Payment` waits
for a receipt; `Pending` waits for staff; `In Process` is processing;
`Released`/`Ready to Claim` is ready; `Claimed`/`Completed` is finished.
`Needs Update`, `Rejected`, and `Cancelled` are shown as exceptions. A stage
gets a timestamp only when the backend has recorded one in `statusHistory`.
For older records without that history, the app shows the current status and
its known request date without inventing prior progress.
