#!/usr/bin/env python
"""Create admin user in Supabase PostgreSQL."""
import sys
import bcrypt
import psycopg2

# Database connection
conn = psycopg2.connect(
    host="db.dwswmirwfsqkerybszsg.supabase.co",
    port=5432,
    user="postgres",
    password="DarksoulZ0193$",
    dbname="postgres"
)
cur = conn.cursor()

# Hash the password using bcrypt
password = "ConvoFlow@123"
salt = bcrypt.gensalt(rounds=12)
hashed_password = bcrypt.hashpw(password.encode(), salt).decode()

# Check if admin already exists
cur.execute("SELECT id FROM agents WHERE email = %s", ("admin@convoflow.ai",))
existing = cur.fetchone()

if existing:
    print("✓ Admin user already exists")
else:
    # Create admin user
    cur.execute(
        """
        INSERT INTO agents (id, name, email, hashed_password, is_active, created_at)
        VALUES (gen_random_uuid(), %s, %s, %s, true, NOW())
        RETURNING id, email
        """,
        ("Admin", "admin@convoflow.ai", hashed_password)
    )
    agent_id, email = cur.fetchone()
    conn.commit()
    print(f"✓ Created admin user: {email} (ID: {agent_id})")
    print(f"  Password: {password}")

conn.close()
