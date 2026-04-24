# dgmobile

React Native (Expo) mobile companion app for the DigCard digital business card platform.

## Stack

- **Expo** ~52 with Expo Router (file-based routing)
- **React Native** 0.76
- **expo-secure-store** for auth token storage
- **expo-camera** for QR code scanning
- **react-native-qrcode-svg** for QR code display
- **axios** for API communication

## Project Structure

```
dgmobile/
├── app/
│   ├── _layout.jsx          # Root layout (AuthProvider, ThemeProvider)
│   ├── index.jsx            # Redirect: auth check → login or dashboard
│   ├── (auth)/
│   │   ├── _layout.jsx
│   │   ├── login.jsx
│   │   └── register.jsx
│   ├── (tabs)/
│   │   ├── _layout.jsx      # Bottom tab bar
│   │   ├── dashboard.jsx
│   │   ├── cards.jsx
│   │   ├── scan.jsx         # QR scanner
│   │   ├── leads.jsx
│   │   └── settings.jsx
│   └── card/
│       └── [id].jsx         # Card detail / QR display / share
├── src/
│   ├── context/
│   │   └── AuthContext.jsx
│   └── services/
│       └── api.js
├── assets/
│   └── fonts/
├── app.json
├── babel.config.js
├── tsconfig.json
└── package.json
```

## Getting Started

```bash
cd dgmobile
npm install
npx expo start
```

## Configuration

Update `API_BASE_URL` in `src/services/api.js` to point to your backend:

```js
export const API_BASE_URL = 'https://your-backend.com/api';
```

## Path Aliases

`@/` maps to `src/` — configured in `tsconfig.json`.
