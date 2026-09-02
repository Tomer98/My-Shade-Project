# Smart Shade — One-Pager

**Student:** Tomer Barel
**Institution:** Holon Institute of Technology (HIT), Faculty of Science
**Based on:** the *MaintControl* initiation document by Mark Israel

---

## Goal

Building a multi-tenant system that solves the supervision and control gap in routine
maintenance — across several companies and locations — while also **closing the loop**:
the system does not only track the work, it operates the equipment, detects when that
equipment stops responding, and generates the maintenance work that fixes it.

## Problem

Routine maintenance suffers from two gaps the specification identifies. In the field,
a worker has no platform telling them what to do, in what order, and whether procedures
changed. In the control room, there is no real-time measure of what maintenance was
actually performed.

## Solution

One platform serving both sides. Field workers get an installable Android app with
ordered daily missions, subtask checklists, on-site photo evidence and turn-by-turn
navigation. Managers get a browser dashboard with live telemetry, assignment by skill
and availability, a failed-mission queue, an approved knowledge base, and reporting.

## Methodology

A responsive React 19 client for desktop and mobile, packaged for Android with
Capacitor from the same codebase. A Node.js/Express 5 REST API over MySQL 8, with
JWT authentication and three-role access control enforced server-side. Real-time
updates over WebSocket rather than polling. Deployed on AWS (EC2, S3) behind HTTPS,
with the frontend on Vercel. 101 automated tests across Jest, Supertest and Vitest.

## Key Features

- **Maintenance missions** — recurring jobs with subtask checklists. Completing all
  subtasks reschedules the next visit automatically; any failure escalates to the
  manager instead.
- **Automatic service tickets** — a blocked subtask opens a ticket pre-filled with
  the room, timestamp and the worker's own explanation.
- **Equipment management** — assets tracked per room with a service status; missions
  can target a specific asset so history follows the equipment.
- **Knowledge base** — guides authored by workers, approved by a manager before they
  become visible, ordered by average rating.
- **Reporting** — completion rate, load per worker and room, equipment condition, and
  the subtasks that fail most often. CSV export.
- **Real-time automation** — a weighted algorithm (60% temperature, 40% light) with
  hysteresis, evaluated every 5 seconds and pushed live to every connected client.
- **Multi-tenancy** — every record belongs to a company, enforced in the JWT and in
  every query rather than filtered in the interface.
- **Multilanguage** — English and Hebrew with full right-to-left layout.

## Screens

Login · Sign up (pending admin approval) · Reset password · Campus map ·
Room dashboard · Daily missions · Mission detail with checklist and location history ·
Knowledge base · Equipment · Reports · Alerts · User management

## Conclusion

The system delivers the specification's field-maintenance workflow in full, and extends
it with the real-time control-room view that §0.1 asks for but leaves undefined.
Roughly half the codebase exists to make the system operable rather than merely
functional — deployment, multi-tenancy, resilience against a failing weather API, and
a test suite that makes changing the code safe. What began as a task-tracking
requirement became a system that both performs maintenance work and creates it.

---

**Stack:** React 19 · Vite · Capacitor · Node.js · Express 5 · Socket.io · MySQL 8 ·
Docker · AWS EC2/S3 · Vercel · Jest · Vitest

**Repository:** github.com/Tomer98/My-Shade-Project
