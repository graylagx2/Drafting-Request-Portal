# scripts/add_user.py
# python scripts\add_user.py --username "ggetzfrid" --actual_name "Grant Getzfrid" --email "ggetzfrid@kernenergy.com" --password "password" --role "admin" 

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import argparse
from app import create_app
from app.extensions import db
from app.models.user import User
from app.utils.security import hash_password

app = create_app()

def create_user(username, email, password, role, actual_name):
    with app.app_context():
        if User.query.filter_by(username=username).first():
            print(f"* Username '{username}' already exists.")
            return
        if User.query.filter_by(email=email).first():
            print(f"* Email '{email}' already in use.")
            return

        user = User(
            username=username,
            actual_name=actual_name,
            email=email,
            password=hash_password(password),
            role=role
        )
        db.session.add(user)
        db.session.commit()
        print(f"[*] User '{username}' created with role '{role}'.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Add a new user to Kern-Energy-Nexus")
    parser.add_argument('--username', required=True, help='Username for login')
    parser.add_argument('--actual_name', required=True, help='Full name of the user')
    parser.add_argument('--email', required=True, help='Email address')
    parser.add_argument('--password', required=True, help='Password (will be hashed)')
    parser.add_argument('--role', required=True, help='Role: admin, drafter, engineer, qc, etc.')

    args = parser.parse_args()
    create_user(args.username, args.email, args.password, args.role, args.actual_name)
