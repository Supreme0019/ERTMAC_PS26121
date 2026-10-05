# NWIS Live Drilling Cutaway — React starter

A compact React Three Fiber geological cutaway panel intended to sit beside your existing live parameter cards and alerts. It consumes the Node.js backend's existing SSE events; it does not change the backend.

## Important scope note

The supplied `Wells 3.zip` contains `nwis-backend` and its realtime/replay code, but no React frontend files. This is therefore a drop-in component starter, not a merge into your unseen frontend. Copy the component into your frontend and adapt the import/path conventions if needed.

## 1. Install dependencies in your React frontend

```bash
npm install three @react-three/fiber @react-three/drei
```

## 2. Configure the backend URL

Create/update your frontend `.env`:

```env
VITE_API_URL=http://localhost:4000/api
```

Use your actual backend port/base URL. `VITE_API_URL` should include `/api` because the backend mounts realtime routes under that prefix.

## 3. Add the component

Copy `src/components/live-drilling/` into your frontend's `src/components/live-drilling/` folder, then render:

```jsx
import LiveDrillingPanel from './components/live-drilling/LiveDrillingPanel';

export default function Dashboard() {
  return (
    <div className="dashboard-grid">
      <LiveDrillingPanel wellId="b1000000-0000-0000-0000-000000000001" compact />
      {/* Keep your existing parameter cards / alert components beside or below it. */}
    </div>
  );
}
```

Replace the example well ID with the seeded demo well UUID if it differs in your database. The backend replay service currently defaults to `b1000000-0000-0000-0000-000000000001` (`NWIS-DEMO-01`).

## 4. API and SSE contract used

- `POST /api/realtime/replay/start` with `{ "wellId": "...", "speedMs": 3000 }` — authenticated; uses `localStorage.getItem('token')` as a bearer token, matching a common existing app pattern. If your auth token is stored elsewhere, adjust `apiRequest()`.
- `POST /api/realtime/replay/stop` — authenticated.
- `GET /api/realtime/replay/status` — optional auth.
- `GET /api/realtime/:wellId/state` — optional auth.
- `GET /api/realtime/:wellId` — SSE stream.
- SSE events: `well-update`, `risk-update`, and `alert`.

Native browser `EventSource` cannot send an arbitrary bearer Authorization header. In the supplied backend the stream route is currently not wrapped in `authenticate`; if you secure it later, use cookie auth or a fetch-based SSE client that can attach headers.

## 5. Behavior and limitations

- The drill assembly smoothly interpolates between received depth values and rotates based on RPM.
- The risk interval is a **visual demo interval** from 2,800 to 2,850 m, not a geological survey model. Update it from your actual well/event data when available.
- Risk alert color is driven by backend `risk-update` results or a received `alert` event; the fixed interval itself is not treated as proof of risk.
- The backend replay has eight sample frames, loops after the last frame, and emits frames at the selected interval. It currently does not read CSV.
- Start/stop controls are connected to the backend. A dedicated reset endpoint does not currently exist.
- Test in a development environment first. 3D rendering may need reduced DPR or simpler geometry on low-powered devices.
