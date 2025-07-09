# Kern-Energy-Nexus

Kern-Energy-Nexus is an advanced refinery-focused Quality Management and Document Control system. It is designed to support project lifecycle management, quality control workflows, document integrity, and ISO 9001-style traceability across multiple departments, including drafting, engineering, QC, and maintenance.

This system is being built for internal use within Kern-Energy and tailored to refinery operations with scalable modularity and extensibility in mind.

# Core Features

Role-Based Access Control (RBAC)

Drafting Request Lifecycle Management

Structured Review & Approval Process

Real-Time Notifications + Email Integration

Integrated Analytics (Drafter, Engineer, Admin views)

Document Control (Check-In / Check-Out + Final Archiving)

ISO 9001-Style Traceability + Revision Management

Smart Ticket Numbering & Revision Threads

# Technologies Used

Python 3.11+

Flask (Modular Blueprint Architecture)

SQLite (local development DB)

Flask-Login (session management)

Flask-Mail (email notifications)

Jinja2 + TailwindCSS (UI layout)

python-dotenv (environment config)

Chart.js / ApexCharts (interactive analytics)

# Directory Structure (Initial)

KERN-ENERGY-NEXUS/
├── app/
│ ├── **init**.py
│ ├── config.py
│ ├── extensions.py
│
│ ├── auth/ # Authentication module
│ │ ├── **init**.py
│ │ ├── routes.py
│ │ └── forms.py
│
│ ├── models/ # SQLAlchemy models
│ │ ├── **init**.py
│ │ ├── user.py
│ │ ├── ticket.py
│ │ ├── document.py
│ │ ├── project.py
│ │ ├── revision.py
│ │ └── form_submission.py
│
│ ├── routes/ # All blueprints registered here
│ │ ├── **init**.py # Mounts all Blueprints
│ │ ├── dashboard.py # Shared landing dashboard
│ │ ├── drafting.py
│ │ ├── engineering.py
│ │ ├── quality.py
│ │ ├── document_control.py
│ │ └── analytics.py
│
│ ├── services/ # Business logic & controllers
│ │ ├── email_service.py
│ │ ├── file_manager.py
│ │ ├── ticket_manager.py
│ │ └── analytics_engine.py
│
│ ├── notifications/ # Internal app alerts/alarms
│ │ └── dispatch.py
│
│ ├── utils/ # Shared helper modules
│ │ ├── security.py
│ │ └── validators.py
│
│ ├── static/
│ │ ├── css/
│ │ │ └── main.css # Central styling (Tailwind, variables)
│ │ └── img/
│ │ └── nexus-logo.png
│
│ ├── templates/
│ │ ├── base.html
│ │ ├── layouts/
│ │ │ ├── navbar.html
│ │ │ └── footer.html
│ │ ├── pages/
│ │ │ ├── auth/
│ │ │ │ └── login.html
│ │ │ ├── dashboard/
│ │ │ │ └── index.html
│ │ │ ├── drafting/
│ │ │ │ ├── request_form.html
│ │ │ │ ├── ticket_view.html
│ │ │ │ └── analytics.html
│ │ │ ├── engineering/
│ │ │ │ ├── project_overview.html
│ │ │ │ ├── review_queue.html
│ │ │ │ └── performance_dashboard.html
│ │ │ ├── quality/
│ │ │ │ └── form_submission.html
│ │ │ ├── document_control/
│ │ │ │ ├── checkout_tracker.html
│ │ │ │ └── archive_history.html
│ │ │ └── analytics/
│ │ │ └── insights.html
│
├── scripts/ # CLI admin tools
│ ├── add_user.py
│ ├── init_db.py
│ └── reset_db.py
│
├── migrations/ # Alembic or schema versioning
│ └── (placeholder)
│
├── logs/ # App log files
│ └── kern_energy_nexus.log
│
├── modules/ # Future external plugin space
│ └── (reserved for growth)
│
├── instance/ # Local SQLite or .env overrides
│ └── (ignored in version control)
│
├── run.py # Entry point
├── README.md # Project setup, architecture, and notes
├── requirements.txt
├── .env

This structure will grow as we implement new modules and platform features.

# Environment Setup for home editing

python -m venv venv
venv\Scripts\activate.bat

Requirements

# Check version for Python 3.11+

python --version

# pip installed globally be sure clean pip and start empty

pip freeze > uninstall.txt
for /F %i in (uninstall.txt) do pip uninstall -y %i
del uninstall.txt

No .exe installer required

# Step 1: Clone Repo

# This inst set up yet as of 03/27/2025

git clone https://github.com/your-org/kern-energy-nexus.git
cd kern-energy-nexus

# Step 2: Set Up Environment

pip install -r requirements.txt

# Step 3: Create .env File

Example:

SECRET_KEY=your-secure-key
FLASK_ENV=development
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-email
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=your-sender

# Step 4: Initialize Database

python scripts/init_db.py

# Or Migrate for mods

# Only before any migrations if already have a init skip

python -m alembic init migrations
python -m alembic revision --autogenerate -m "Initial-Rebuild"
python -m alembic upgrade head

# Step 5: Create an Admin User

python scripts\add_user.py --username "ggetzfrid" --actual_name "Grant Getzfrid" --email "ggetzfrid@kernenergy.com" --password "password" --role "admin"

# Step 6: Run the App

python run.py
or enable debug preferred
python -m flask run --debug

# Getting Started

Log in as Admin

Navigate to the Drafting Request Tracker

Assign new requests to drafters

Monitor ticket lifecycle and approvals

Review analytics in the Admin Dashboard

# Expansion Plan

This README will be updated alongside the system to include:

Document Control Subsystem

Project Control Expansion

Quality Forms Module

Notification Architecture

Smart Search / Tagging System

REST API Access for External Systems

# Notes

Ticket numbers start at 25DDDC080

Final packages will be archived locally as .zip bundles

No contractor email notifications — only internal role-based routing

Revision threads are persistent and auditable

This is a secure internal system for Kern-Energy refinery operations. All development follows ISO 9001 and industry best practices.
