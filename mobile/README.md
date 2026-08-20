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
https://verifitormob-backend.vercel.app/api
```

All HTTP and multipart requests are created by `MongoDataApiService` from that
constant.

The same Flutter code can target another environment at build time without
changing source files:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
flutter build web --dart-define=API_BASE_URL=https://verifitormob-backend.vercel.app/api
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
