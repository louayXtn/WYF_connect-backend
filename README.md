# WYF Backend

A secure, scalable RESTful API built with Node.js, Express, and MongoDB to connect young entrepreneurs (ideas & startups) with investors.

## Key Features
- *Authentication & Security:* JWT-based auth using HTTP-only cookies and bcryptjs password hashing.
- *Role-Based Access Control (RBAC):* Distinct permissions and workflows for youth, investor, and admin roles.
- *KYC Identity Verification:* Two-step document verification system (ID card + Selfie) powered by imageKit.
- *Projects & Opportunities:* Structured schemas and endpoints for submitting startup ideas, publishing funding opportunities, and managing applications.

## Tech Stack
- *Runtime & Framework:* Node.js, Express.js
- *Database & OD…



Simple Express + MongoDB backend for WYF Connect (local dev).

Run:

```bash
cd backend
npm install
cp .env.example .env
# set MONGO_URI if needed
npm run dev
```
