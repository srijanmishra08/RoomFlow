import sys

content = """# RoomFlow - Interactive Interior Design Client Portal

A micro-SaaS web application for interior designers to build interactive 3D room models and share them with clients through a client portal.

## Features

- 3D Room Builder with Three.js + React Three Fiber
- Client Portal with interactive 3D viewer
- Project, Room, Client, and Asset management
- Object metadata (status, material, brand, cost, delivery date)
- Comments and approvals system
- Role-based authentication (Designer / Client)
- Progress tracking with visual status indicators

## Tech Stack

- Next.js + React + TailwindCSS
- Three.js + React Three Fiber + Drei
- PostgreSQL + Prisma ORM
- Auth.js (NextAuth v5)
- Zod validation
- Jest testing
- GitHub Actions CI

## Getting Started

1. `npm install`
2. `cp .env.example .env` (configure DATABASE_URL and AUTH_SECRET)
3. `npm run db:push && npm run db:generate`
4. `npm run db:seed` (optional demo data)
5. `npm run dev`

Demo credentials: designer@roomflow.app / password123

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Register designer |
| GET/POST | /api/projects | List/create projects |
| GET/PATCH/DELETE | /api/projects/[id] | Project detail |
| GET/POST | /api/projects/[id]/rooms | Room management |
| GET/POST | /api/rooms/[roomId]/objects | Room objects |
| PATCH/DELETE | /api/objects/[objectId] | Update/delete object |
| GET/POST | /api/objects/[objectId]/comments | Comments |
| GET/POST | /api/clients | Client management |
| GET/POST | /api/assets | Asset library |
| GET | /api/client-portal/[projectId] | Public portal data |

## License

MIT
"""

with open("README.md", "w") as f:
    f.write(content)

print("README written successfully")
